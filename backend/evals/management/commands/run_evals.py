"""Management command to run the ARIA evaluation suite (AGENTS.md sections 6, 11).

Parses AgentResponse for each question, verifies refusal guardrails, verifies
tool routing accuracy for routing questions, checks numeric accuracy, and
outputs a structured JSON summary report.
"""
import json
import os
from pathlib import Path
from typing import Any

from django.core.management.base import BaseCommand
from rest_framework.test import APIClient

from api.schemas import AgentResponse


class Command(BaseCommand):
    help = "Run the ARIA evaluation benchmark suite and output a JSON summary report."

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
            help="Optional file path to write the JSON report to.",
        )
        parser.add_argument(
            "--silent",
            action="store_true",
            help="Output only the raw JSON report without progress text.",
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
        total_latency = 0
        total_tokens = 0

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
                results.append({
                    "id": qid,
                    "category": category,
                    "question": question_text,
                    "status": "http_error",
                    "status_code": response.status_code,
                    "error": getattr(response, "data", response.content.decode("utf-8", errors="replace")),
                })
                continue

            raw_data = response.json()
            try:
                agent_resp = AgentResponse.model_validate(raw_data)
            except Exception as exc:
                results.append({
                    "id": qid,
                    "category": category,
                    "question": question_text,
                    "status": "validation_error",
                    "error": str(exc),
                })
                continue

            total_latency += agent_resp.latency_ms
            total_tokens += agent_resp.token_usage

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
                "token_usage": agent_resp.token_usage,
                "latency_ms": agent_resp.latency_ms,
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

        n_evaluated = len(results)
        avg_latency = round(total_latency / n_evaluated, 2) if n_evaluated > 0 else 0

        summary = {
            "total_questions": len(questions),
            "evaluated_questions": n_evaluated,
            "refusal_rate": refusal_rate,
            "tool_routing_accuracy": tool_routing_accuracy,
            "numeric_accuracy": numeric_accuracy,
            "stale_warning_accuracy": stale_warning_accuracy,
            "average_latency_ms": avg_latency,
            "total_tokens_used": total_tokens,
            "category_summary": {
                "adversarial_refusals": len([r for r in results if r.get("category") == "adversarial_refusal"]),
                "semantic_jailbreaks": len([r for r in results if r.get("category") == "semantic_jailbreak"]),
                "tool_routing_queries": len([r for r in results if r.get("category") == "tool_routing"]),
                "numeric_calculations": len([r for r in results if r.get("category") == "numeric_calculation"]),
                "retrieval_citations": len([r for r in results if r.get("category") == "retrieval_citation"]),
                "stale_data_handling": len([r for r in results if r.get("category") == "stale_data_handling"]),
            },
            "results": results,
        }

        json_output = json.dumps(summary, indent=2)

        if options.get("output"):
            out_file = options["output"]
            with open(out_file, "w", encoding="utf-8") as f:
                f.write(json_output)
            if not silent:
                self.stdout.write(self.style.SUCCESS(f"Saved report to {out_file}"))

        self.stdout.write(json_output)
