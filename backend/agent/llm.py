"""
Hybrid LLM Synthesizer for ARIA (AGENTS.md sections 1, 2, 6).

Core Principle:
- The LLM handles language ONLY.
- Facts, math, and decisions come exclusively from deterministic tools and retrieved filings.
- Supports Google Gemini API (REST), Local Ollama, and deterministic fallback.
"""
import json
import os
import re
import time
import urllib.error
import urllib.parse
import urllib.request
from typing import Any

from api.schemas import Citation, ToolOutput

ARIA_SYSTEM_PROMPT = """You are ARIA, an AI financial research and explanation assistant.
Your sole job is to synthesize an explanation based ONLY on the verified factual context provided.

STRICT CONSTRAINTS (Non-negotiable compliance):
1. Never calculate ratios, percentages, growth rates, or arithmetic from memory. Use ONLY the exact numbers provided by the deterministic calculator.
2. Never give buy, sell, or hold recommendations, market timing advice, or price predictions.
3. Every factual statement must cite its source document or tool output. Explicitly include page numbers or sections when referencing filings.
4. If the provided context does not contain the answer, state clearly that the corporate disclosures do not provide this information.
5. Keep your tone objective, professional, and audit-ready.
6. You must reply in the exact same language and script (English, Hindi, or Hinglish) that the user used in their prompt. If the user asked in Hinglish, reply in Hinglish. Do not translate the proper nouns of the tools or the exact numerical figures.
"""



def _build_context_prompt(
    question: str,
    tool_outputs: list[ToolOutput],
    citations: list[Citation],
) -> str:
    """Builds a structured grounded context prompt for the LLM."""
    lines = [f"User Research Query: {question}\n", "--- VERIFIED FACTUAL CONTEXT ---"]

    if tool_outputs:
        lines.append("\n[DETERMINISTIC TOOL OUTPUTS]:")
        for idx, t in enumerate(tool_outputs, 1):
            lines.append(f"Tool {idx}: {t.tool_name}")
            lines.append(f"Source: {t.source} (Timestamp: {t.timestamp})")
            lines.append(f"Result: {json.dumps(t.output, default=str)}")

    if citations:
        lines.append("\n[RETRIEVED CORPORATE FILINGS & TRANSCRIPTS]:")
        for idx, c in enumerate(citations, 1):
            lines.append(f"Citation [{idx}]:")
            lines.append(f"  Document: {c.document} | Locator: {c.locator}")
            lines.append(f"  Retrieved: {c.timestamp or 'Timestamp unavailable'}")
            lines.append(f"  Excerpt: {c.snippet}")

    lines.append("\n--- END OF VERIFIED CONTEXT ---")
    lines.append(
        "\nProvide a factual, well-structured financial research briefing answering the query. "
        "Strictly ground every statement in the context above. Cite document names and page numbers."
    )
    return "\n".join(lines)


def _normalize_gemini_model(model_name: str | None) -> str:
    """Normalize model string to active Gemini API model identifiers."""
    if not model_name:
        return "gemini-flash-latest"
    cleaned = model_name.strip().lower().replace(" ", "-")
    if "pro" in cleaned:
        return "gemini-pro-latest"
    if "flash" in cleaned:
        return "gemini-flash-latest"
    return "gemini-flash-latest"


def _call_gemini_api(
    prompt: str,
    system_prompt: str,
    api_key: str,
    model: str = "gemini-flash-latest",
    token_cap: int = 2000,
    timeout: int = 15,
) -> tuple[str | None, int]:
    """Calls Google Gemini API using REST HTTPS."""
    target_model = _normalize_gemini_model(model)
    endpoint = f"https://generativelanguage.googleapis.com/v1beta/models/{target_model}:generateContent?key={api_key}"
    payload = {
        "contents": [
            {
                "role": "user",
                "parts": [{"text": prompt}],
            }
        ],
        "systemInstruction": {
            "parts": [{"text": system_prompt}],
        },
        "generationConfig": {
            "temperature": 0.1,
            "maxOutputTokens": token_cap,
        },
    }
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        endpoint,
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=timeout) as response:
            res_data = json.loads(response.read().decode("utf-8"))
            candidates = res_data.get("candidates", [])
            if candidates:
                parts = candidates[0].get("content", {}).get("parts", [])
                text = "".join(p.get("text", "") for p in parts).strip()
                usage = res_data.get("usageMetadata", {})
                tokens = usage.get("totalTokenCount", len(text.split()))
                return text, tokens
    except Exception:
        pass
    return None, 0


def _call_ollama_api(
    prompt: str,
    system_prompt: str,
    host: str = "http://localhost:11434",
    model: str = "qwen2.5:7b",
    token_cap: int = 2000,
    timeout: int = 15,
) -> tuple[str | None, int]:
    """Calls local Ollama API."""
    endpoint = f"{host.rstrip('/')}/api/generate"
    payload = {
        "model": model,
        "prompt": prompt,
        "system": system_prompt,
        "stream": False,
        "options": {
            "temperature": 0.1,
            "num_predict": token_cap,
        },
    }
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        endpoint,
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=timeout) as response:
            res_data = json.loads(response.read().decode("utf-8"))
            text = res_data.get("response", "").strip()
            eval_count = res_data.get("eval_count", len(text.split()))
            prompt_eval_count = res_data.get("prompt_eval_count", 0)
            return text, eval_count + prompt_eval_count
    except Exception:
        pass
    return None, 0


def is_hinglish_or_hindi(text: str) -> bool:
    """Detect whether a query is written in Hindi or Hinglish."""
    if any("\u0900" <= ch <= "\u097F" for ch in text):
        return True
    hinglish_markers = {
        "ka", "ke", "ki", "kya", "kyu", "kyun", "kitna", "kitni", "kitne",
        "hai", "hain", "karo", "batao", "bataiye", "dekh", "dekho",
        "anusaar", "mein", "se", "ko", "par", "bhi", "aur", "ya", "yeh", "woh"
    }
    tokens = set(re.findall(r"\b[a-zA-Z]+\b", text.lower()))
    return bool(tokens & hinglish_markers)


def synthesize_research_answer(
    question: str,
    tool_outputs: list[ToolOutput],
    citations: list[Citation],
    default_answer: str,
    conversation_history: str = "",
) -> tuple[str, int, int, list[str]]:
    """
    Synthesize natural language response using Hybrid LLM engine.
    Priority:
    1. Google Gemini API (if GEMINI_API_KEY is configured).
    2. Local Ollama (if OLLAMA_HOST or local server is reachable).
    3. Deterministic tool synthesis fallback (offline/CI mode).

    Returns: (synthesized_text, tokens_used, latency_ms, warnings)
    """
    start_time = time.monotonic()
    api_key = os.environ.get("GEMINI_API_KEY")
    ollama_host = os.environ.get("OLLAMA_HOST", "http://localhost:11434")
    token_cap = int(os.environ.get("LLM_TOKEN_CAP_PER_QUERY", "4000"))

    # Build grounded factual prompt
    prompt = _build_context_prompt(question, tool_outputs, citations)

    # Contextual system prompt with conversation history for Gemini / Ollama
    system_prompt = ARIA_SYSTEM_PROMPT
    if conversation_history:
        system_prompt = (
            f"{ARIA_SYSTEM_PROMPT}\n\n"
            f"--- RECENT CONVERSATION HISTORY ---\n"
            f"{conversation_history}\n"
            f"--- END CONVERSATION HISTORY ---"
        )

    # 1. Attempt Gemini API
    if api_key:
        model = os.environ.get("LLM_MODEL_NAME") or "gemini-flash-latest"
        text, tokens = _call_gemini_api(
            prompt=prompt,
            system_prompt=system_prompt,
            api_key=api_key,
            model=model,
            token_cap=token_cap,
        )
        if text:
            latency_ms = int((time.monotonic() - start_time) * 1000)
            enforced_tokens = min(tokens, token_cap)
            return text, enforced_tokens, latency_ms, []

    # 2. Attempt Local Ollama
    ollama_model = os.environ.get("OLLAMA_MODEL") or "llama3.2"
    text, tokens = _call_ollama_api(
        prompt=prompt,
        system_prompt=system_prompt,
        host=ollama_host,
        model=ollama_model,
        token_cap=token_cap,
    )
    if text:
        latency_ms = int((time.monotonic() - start_time) * 1000)
        enforced_tokens = min(tokens, token_cap)
        return text, enforced_tokens, latency_ms, []

    # 3. Dignified Deterministic Grounded Fallback (mid-demo network failure safe)
    latency_ms = int((time.monotonic() - start_time) * 1000)
    raw_tokens = 45 if (tool_outputs or citations) else 0
    enforced_tokens = min(raw_tokens, token_cap)

    fallback_warning = ["llm_offline_fallback: network_unreachable_grounded_fallback"]
    fallback_text = default_answer

    if is_hinglish_or_hindi(question):
        if tool_outputs:
            details = []
            co_name = "Company"
            q_lower = question.lower()
            if "tcs" in q_lower:
                co_name = "Tata Consultancy Services (TCS)"
            elif "reliance" in q_lower:
                co_name = "Reliance Industries Limited"
            elif "infy" in q_lower:
                co_name = "Infosys Limited"

            for t in tool_outputs:
                if t.tool_name == "financial_calculator" and isinstance(t.output, dict):
                    if "result_percent" in t.output:
                        details.append(f"net profit margin {t.output['result_percent']}%")
                elif t.tool_name == "fundamentals_lookup" and isinstance(t.output, dict):
                    fund = t.output.get("fundamentals") or t.output.get("stored_mysql_data", {}).get("fundamentals") or t.output.get("data")
                    if isinstance(fund, dict):
                        if "operating_margin_pct" in fund and not any("margin" in d for d in details):
                            details.append(f"operating margin {fund['operating_margin_pct']}%")
                        if "revenue_cr" in fund:
                            details.append(f"recorded revenue ₹{fund['revenue_cr']:,.0f} crore")
                        if "debt_cr" in fund:
                            details.append(f"recorded debt ₹{fund['debt_cr']:,.0f} crore")
                        elif "FY24_debt_cr" in fund:
                            details.append(f"recorded debt ₹{fund['FY24_debt_cr']:,.0f} crore")

            if details:
                fallback_text = (
                    f"Stored database records ke anusaar, {co_name} ka "
                    + " aur ".join(details)
                    + " hai. Proper nouns aur numeric figures deterministic tool outputs par aadharit hain."
                )
            else:
                fallback_text = f"Stored database records ke anusaar: {default_answer}"
    elif not tool_outputs and not citations:
        fallback_text = (
            "Live LLM services are currently unreachable, and no deterministic tool or filing matched this query. "
            "Please provide a financial research query referencing filings, financial ratios, or stock fundamentals."
        )

    return fallback_text, enforced_tokens, latency_ms, fallback_warning


