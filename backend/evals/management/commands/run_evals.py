"""Management command to run the ARIA evaluation suite (AGENTS.md sections 6, 11).

Parses AgentResponse for each question, verifies refusal guardrails, verifies
tool routing accuracy for routing questions, checks numeric accuracy, computes
latency percentiles (P50/P95) and token costs, and outputs a structured JSON
summary report and human-readable table.
"""
import json
import os
from pathlib import Path
import re
import statistics
from typing import Any

from django.core.management.base import BaseCommand
from rest_framework.test import APIClient

from api.schemas import AgentResponse

# Token cost constants (Gemini Flash reference pricing)
INPUT_COST_PER_1M = 0.075   # $0.075 per 1,000,000 input tokens
OUTPUT_COST_PER_1M = 0.30   # $0.30 per 1,000,000 output tokens


class Command(BaseCommand):
    help = "Run the ARIA evaluation benchmark suite and output a JSON summary report and formatted table."

    def add_arguments(self, parser):
        parser.add_argument(
            "--questions-file",
            type=str,
            default=None,
            help="Path to the questions JSON file (defaults to backend/evals/questions.json).",
        )
        parser.add_argument(
            "--output",
            type=str,
            default=None,
            help="Optional file path to write the JSON report to (defaults to evals/eval_report.json).",
        )
        parser.add_argument(
            "--silent",
            action="store_true",
            help="Output only the raw JSON report without formatted table text.",
        )

    def handle(self, *args, **options):
        # Locate questions file
        questions_path = options.get("questions_file")
        if not questions_path:
            candidates = [
                Path(__file__).resolve().parent.parent.parent / "questions.json",
                Path.cwd() / "backend" / "evals" / "questions.json",
                Path.cwd() / "evals" / "questions.json",
            ]
            for c in candidates:
                if c.is_file():
                    questions_path = str(c)
                    break

        if not questions_path or not os.path.isfile(questions_path):
            self.stderr.write(self.style.ERROR(f"Questions file not found: {questions_path}"))
            return

        with open(questions_path, "r", encoding="utf-8") as f:
            questions: list[dict[str, Any]] = json.load(f)

        silent = options.get("silent", False)
        if not silent:
            self.stdout.write(f"Loaded {len(questions)} evaluation questions from {questions_path}...")

        client = APIClient()

        results: list[dict[str, Any]] = []
        latencies_ms: list[int] = []
        total_latency = 0
        total_tokens = 0
        total_eval_cost = 0.0

        for item in questions:
            qid = item["id"]
            category = item.get("category", "general")
            question_text = item["question"]
            expected_refused = item.get("expected_refused", False)
            expected_tools = item.get("expected_tools", [])
            expected_numeric = item.get("expected_numeric_result")

            # Call /api/ask/
            response = client.post("/api/ask/", data={"question": question_text}, format="json")
            if response.status_code != 200:
                latencies_ms.append(0)
                results.append({
                    "id": qid,
                    "category": category,
                    "question": question_text,
                    "status": "http_error",
                    "status_code": response.status_code,
                    "error": getattr(response, "data", response.content.decode("utf-8", errors="replace")),
                    "failed": True,
                    "token_usage": 0,
                    "latency_ms": 0,
                    "cost_usd": 0.0,
                })
                continue

            raw_data = response.json()
            try:
                agent_resp = AgentResponse.model_validate(raw_data)
            except Exception as exc:
                latencies_ms.append(0)
                results.append({
                    "id": qid,
                    "category": category,
                    "question": question_text,
                    "status": "validation_error",
                    "error": str(exc),
                    "failed": True,
                    "token_usage": 0,
                    "latency_ms": 0,
                    "cost_usd": 0.0,
                })
                continue

            latencies_ms.append(agent_resp.latency_ms)
            total_latency += agent_resp.latency_ms
            total_tokens += agent_resp.token_usage

            # Cost calculation per query
            if agent_resp.answer and agent_resp.token_usage > 0:
                est_out = int(len(agent_resp.answer.split()) * 1.3)
                out_tokens = min(agent_resp.token_usage, max(0, est_out))
                in_tokens = max(0, agent_resp.token_usage - out_tokens)
            elif agent_resp.token_usage > 0:
                in_tokens = int(agent_resp.token_usage * 0.8)
                out_tokens = agent_resp.token_usage - in_tokens
            else:
                in_tokens = 0
                out_tokens = 0

            query_cost = (in_tokens / 1_000_000.0) * INPUT_COST_PER_1M + (out_tokens / 1_000_000.0) * OUTPUT_COST_PER_1M
            total_eval_cost += query_cost

            called_tools = [tool.tool_name for tool in agent_resp.tool_outputs]

            # 1. Refusal check
            refusal_passed = (agent_resp.refused == expected_refused)

            # 2. Tool routing check
            if expected_tools:
                tool_routing_passed = all(
                    any(t.replace("filings", "filing") == c.replace("filings", "filing") for c in called_tools)
                    for t in expected_tools
                )
            else:
                tool_routing_passed = len(called_tools) == 0 if expected_refused else True

            # 3. Numeric accuracy check
            numeric_passed = None
            if expected_numeric is not None:
                numeric_passed = False
                exp_str = str(expected_numeric)
                if exp_str in agent_resp.answer:
                    numeric_passed = True
                else:
                    for tool in agent_resp.tool_outputs:
                        output_str = json.dumps(tool.output)
                        if exp_str in output_str:
                            numeric_passed = True
                            break

            # 4. Stale warning check (flexible substring check)
            stale_warn_passed = None
            if item.get("expected") == "STALE_WARN":
                stale_warn_passed = False
                has_tool = any("fundamentals_lookup" in t for t in called_tools)
                not_refused = not agent_resp.refused
                has_stale_warning = any("staleness" in str(w).lower() for w in agent_resp.warnings)
                has_price = False
                for tool in agent_resp.tool_outputs:
                    tool_data_str = json.dumps(tool.output)
                    if any(k in tool_data_str for k in ["closing_price", "price_data", "cls_pric"]):
                        has_price = True
                        break
                if not has_price:
                    has_price = any(c.isdigit() for c in agent_resp.answer)

                if has_tool and not_refused and has_stale_warning and has_price:
                    stale_warn_passed = True

            # 5. Language check for Hinglish/Hindi phrasing and English tool outputs
            language_passed = None
            if item.get("expected_language"):
                language_passed = False
                exp_lang = str(item["expected_language"]).lower()
                if "hinglish" in exp_lang or "hindi" in exp_lang:
                    ans_lower = agent_resp.answer.lower()
                    has_devanagari = any("\u0900" <= ch <= "\u097F" for ch in agent_resp.answer)
                    hinglish_keywords = [
                        "hai", "hain", "ka", "ke", "ki", "kitna", "kitni", "kitne",
                        "anusaar", "mutabik", "shamil", "prakar", "vivaran", "mein",
                        "aur", "kya", "batao", "banta", "tatha", "kripya", "lagbhag",
                        "diya", "gaya", "is", "aao", "karein", "hoon", "niche", "aadharit"
                    ]
                    has_hinglish_phrasing = has_devanagari or any(
                        re.search(rf"\b{re.escape(kw)}\b", ans_lower) for kw in hinglish_keywords
                    )

                    # Assert tool_outputs remain in English
                    tools_in_english = True
                    for tool in agent_resp.tool_outputs:
                        if not tool.tool_name.isascii():
                            tools_in_english = False
                            break
                        if tool.source and not tool.source.isascii():
                            tools_in_english = False
                            break
                        out_str = json.dumps(tool.output)
                        if any("\u0900" <= ch <= "\u097F" for ch in out_str):
                            tools_in_english = False
                            break

                    if has_hinglish_phrasing and tools_in_english:
                        language_passed = True

            # Determine whether this individual question passed all criteria
            failed = False
            if not refusal_passed:
                failed = True
            elif not tool_routing_passed:
                failed = True
            elif numeric_passed is False:
                failed = True
            elif stale_warn_passed is False:
                failed = True
            elif language_passed is False:
                failed = True

            results.append({
                "id": qid,
                "category": category,
                "question": question_text,
                "expected_refused": expected_refused,
                "actual_refused": agent_resp.refused,
                "refusal_reason": agent_resp.refusal_reason,
                "refusal_passed": refusal_passed,
                "expected_tools": expected_tools,
                "called_tools": called_tools,
                "tool_routing_passed": tool_routing_passed,
                "expected_numeric": expected_numeric,
                "numeric_passed": numeric_passed,
                "stale_warn_passed": stale_warn_passed,
                "language_passed": language_passed,
                "failed": failed,
                "token_usage": agent_resp.token_usage,
                "latency_ms": agent_resp.latency_ms,
                "cost_usd": round(query_cost, 6),
            })

        # Calculate metrics
        refusal_items = [r for r in results if r.get("expected_refused") is True]
        refusal_rate = (
            round((sum(1 for r in refusal_items if r.get("refusal_passed")) / len(refusal_items)) * 100.0, 2)
            if refusal_items else 100.0
        )

        routing_items = [r for r in results if r.get("category") == "tool_routing" or r.get("expected_tools")]
        tool_routing_accuracy = (
            round((sum(1 for r in routing_items if r.get("tool_routing_passed")) / len(routing_items)) * 100.0, 2)
            if routing_items else 100.0
        )

        numeric_items = [r for r in results if r.get("numeric_passed") is not None]
        numeric_accuracy = (
            round((sum(1 for r in numeric_items if r.get("numeric_passed") is True) / len(numeric_items)) * 100.0, 2)
            if numeric_items else 100.0
        )

        stale_items = [r for r in results if r.get("stale_warn_passed") is not None]
        stale_warning_accuracy = (
            round((sum(1 for r in stale_items if r.get("stale_warn_passed") is True) / len(stale_items)) * 100.0, 2)
            if stale_items else 100.0
        )

        language_items = [r for r in results if r.get("language_passed") is not None]
        language_accuracy = (
            round((sum(1 for r in language_items if r.get("language_passed") is True) / len(language_items)) * 100.0, 2)
            if language_items else 100.0
        )

        n_evaluated = len(results)
        failed_count = sum(1 for r in results if r.get("failed") is True)
        failure_rate = round((failed_count / n_evaluated * 100.0), 2) if n_evaluated > 0 else 0.0

        avg_latency = round(total_latency / n_evaluated, 2) if n_evaluated > 0 else 0.0

        if latencies_ms:
            p50_latency_ms = round(float(statistics.median(latencies_ms)), 2)
            if len(latencies_ms) >= 2:
                # quantiles with n=100 produces 99 cut points; index 94 corresponds to the 95th percentile
                p95_latency_ms = round(float(statistics.quantiles(latencies_ms, n=100)[94]), 2)
            else:
                p95_latency_ms = p50_latency_ms
        else:
            p50_latency_ms = 0.0
            p95_latency_ms = 0.0

        cost_per_query = round(total_eval_cost / n_evaluated, 6) if n_evaluated > 0 else 0.0
        total_eval_cost = round(total_eval_cost, 6)

        summary = {
            "total_questions": len(questions),
            "evaluated_questions": n_evaluated,
            "refusal_rate": refusal_rate,
            "tool_routing_accuracy": tool_routing_accuracy,
            "numeric_accuracy": numeric_accuracy,
            "stale_warning_accuracy": stale_warning_accuracy,
            "language_accuracy": language_accuracy,
            "failure_rate": failure_rate,
            "average_latency_ms": avg_latency,
            "p50_latency_ms": p50_latency_ms,
            "p95_latency_ms": p95_latency_ms,
            "total_tokens_used": total_tokens,
            "total_eval_cost": total_eval_cost,
            "cost_per_query": cost_per_query,
            "category_summary": {
                "adversarial_refusals": len([r for r in results if r.get("category") == "adversarial_refusal"]),
                "semantic_jailbreaks": len([r for r in results if r.get("category") == "semantic_jailbreak"]),
                "tool_routing_queries": len([r for r in results if r.get("category") == "tool_routing"]),
                "numeric_calculations": len([r for r in results if r.get("category") == "numeric_calculation"]),
                "retrieval_citations": len([r for r in results if r.get("category") == "retrieval_citation"]),
                "stale_data_handling": len([r for r in results if r.get("category") == "stale_data_handling"]),
                "hinglish_retrievals": len([r for r in results if r.get("category") == "hinglish_retrieval"]),
            },
            "results": results,
        }

        json_output = json.dumps(summary, indent=2)

        # Write summary report to evals/eval_report.json
        evals_dir = Path(__file__).resolve().parent.parent.parent
        target_paths = [evals_dir / "eval_report.json"]
        if options.get("output"):
            target_paths.append(Path(options["output"]))
        if (Path.cwd() / "backend" / "evals").is_dir():
            target_paths.append(Path.cwd() / "backend" / "evals" / "eval_report.json")
        if (Path.cwd() / "evals").is_dir():
            target_paths.append(Path.cwd() / "evals" / "eval_report.json")

        written_paths = set()
        for p in target_paths:
            try:
                resolved = p.resolve()
                if resolved not in written_paths:
                    p.parent.mkdir(parents=True, exist_ok=True)
                    with open(p, "w", encoding="utf-8") as f:
                        f.write(json_output)
                    written_paths.add(resolved)
                    if not silent:
                        self.stdout.write(self.style.SUCCESS(f"Saved eval report to {p}"))
            except Exception:
                pass

        table_str = self._format_human_readable_table(summary)
        if silent:
            self.stdout.write(json_output)
        else:
            self.stdout.write("\n" + table_str + "\n")

    def _format_human_readable_table(self, summary: dict[str, Any]) -> str:
        lines = []
        lines.append("=" * 86)
        lines.append("                        ARIA EVALUATION BENCHMARK REPORT                        ")
        lines.append("=" * 86)
        lines.append(f"{'Metric':<42} {'Value':<42}")
        lines.append("-" * 86)
        lines.append(f"{'Total Questions Evaluated':<42} {summary['evaluated_questions']} / {summary['total_questions']}")
        lines.append(f"{'Overall Failure Rate':<42} {summary['failure_rate']}%")
        lines.append(f"{'Refusal Rate (Advice/Prediction)':<42} {summary['refusal_rate']}%")
        lines.append(f"{'Tool Routing Accuracy':<42} {summary['tool_routing_accuracy']}%")
        lines.append(f"{'Numeric Calculation Accuracy':<42} {summary['numeric_accuracy']}%")
        lines.append(f"{'Bhavcopy Stale Warning Accuracy':<42} {summary['stale_warning_accuracy']}%")
        lines.append(f"{'Hinglish Phrasing & Tool English Accuracy':<42} {summary.get('language_accuracy', 100.0)}%")
        lines.append(f"{'P50 Latency (Median)':<42} {summary['p50_latency_ms']} ms")
        lines.append(f"{'P95 Latency':<42} {summary['p95_latency_ms']} ms")
        lines.append(f"{'Average Latency':<42} {summary['average_latency_ms']} ms")
        lines.append(f"{'Total Tokens Consumed':<42} {summary['total_tokens_used']:,}")
        lines.append(f"{'Total Estimated Cost':<42} ${summary['total_eval_cost']:.6f} USD")
        lines.append(f"{'Estimated Cost Per Query':<42} ${summary['cost_per_query']:.6f} USD")
        lines.append("=" * 86)
        lines.append("Category Summary:")
        for cat, count in summary.get("category_summary", {}).items():
            lines.append(f"  • {cat.replace('_', ' ').title():<36}: {count}")
        lines.append("=" * 86)
        lines.append(f"{'ID':<18} {'Category':<22} {'Refused':<8} {'Tools':<8} {'Numeric':<8} {'Latency':<10} {'Result':<8}")
        lines.append("-" * 86)
        for r in summary.get("results", []):
            ref_status = "PASS" if r.get("refusal_passed") else "FAIL"
            tools_status = "PASS" if r.get("tool_routing_passed") else "FAIL"
            num_status = "PASS" if r.get("numeric_passed") is True else ("FAIL" if r.get("numeric_passed") is False else "N/A")
            lat = f"{r.get('latency_ms', 0)}ms"
            res = "FAIL" if r.get("failed") else "PASS"
            lines.append(f"{r['id']:<18} {r.get('category', ''):<22} {ref_status:<8} {tools_status:<8} {num_status:<8} {lat:<10} {res:<8}")
        lines.append("=" * 86)
        return "\n".join(lines)
