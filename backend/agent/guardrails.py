"""Pre-flight regex guardrails for ARIA (AGENTS.md sections 2, 3, 11).

Short-circuits buy/sell/hold advice, market timing, price predictions,
and semantic jailbreaks BEFORE any LLM (Gemini) invocation occurs.
"""
from dataclasses import dataclass
import re

# Standard refusal message verbatim from AGENTS.md section 3
STANDARD_REFUSAL_MESSAGE = (
    "I can't provide buy/sell/hold recommendations or price predictions. "
    "I can show historical performance, management commentary, or document citations instead."
)

_ADVICE_PATTERNS = [
    # 1. Jailbreak / DAN / Roleplay framing seeking advice or predictions
    (
        re.compile(
            r"\b(?:ignore\s+(?:all\s+)?(?:previous\s+)?instructions|dan\s+mode|unrestricted|jailbreak)\b",
            re.IGNORECASE,
        ),
        "jailbreak_attempt",
    ),
    (
        re.compile(
            r"\b(?:roleplay|pretend|imagine|hypothetical\s+scenario|fictional\s+world)\b.*"
            r"\b(?:buy|sell|hold|invest|stock|crypto|price|forecast|target)\b",
            re.IGNORECASE,
        ),
        "jailbreak_attempt",
    ),

    # 2. Buy recommendations
    (
        re.compile(
            r"\b(?:should\s+i|shall\s+i|can\s+i|ought\s+to|is\s+it\s+(?:a\s+)?(?:good|right)\s+time\s+to|would\s+you\s+recommend)\s+"
            r"(?:buy|purchase|accumulate|invest\s+in|enter|go\s+long\s+on)\b",
            re.IGNORECASE,
        ),
        "buy_recommendation",
    ),
    (
        re.compile(
            r"\b(?:what|which|any)\s+(?:multibagger\s+|penny\s+)?(?:stock|share|equity|crypto|mutual\s+fund)s?\s+(?:should\s+i|to)\s+(?:buy|invest\s+in|purchase)\b",
            re.IGNORECASE,
        ),
        "buy_recommendation",
    ),
    (
        re.compile(
            r"\b(?:what\s+is\s+the\s+)?(?:best|top)\s+(?:multibagger\s+|penny\s+)?(?:stocks?|shares?|mutual\s+funds?|etfs?|funds?|equit(?:y|ies))\s+to\s+(?:buy|invest\s+in|purchase)(?:\s+now)?\b",
            re.IGNORECASE,
        ),
        "buy_recommendation",
    ),
    (
        re.compile(r"\bbuy\s+recommendation\b", re.IGNORECASE),
        "buy_recommendation",
    ),

    # 3. Sell / Exit recommendations
    (
        re.compile(
            r"\b(?:should\s+i|shall\s+i|can\s+i|ought\s+to|is\s+it\s+(?:a\s+)?(?:good|right)\s+time\s+to|time\s+to)\s+"
            r"(?:sell|dump|exit|liquidate|book\s+profits?\s+on|short)\b",
            re.IGNORECASE,
        ),
        "sell_recommendation",
    ),
    (
        re.compile(
            r"\b(?:when|should\s+i)\s+(?:to\s+)?(?:exit|sell)\b",
            re.IGNORECASE,
        ),
        "sell_recommendation",
    ),
    (
        re.compile(r"\bsell\s+recommendation\b", re.IGNORECASE),
        "sell_recommendation",
    ),

    # 4. Hold recommendations
    (
        re.compile(
            r"\b(?:should\s+i|shall\s+i|can\s+i|ought\s+to|do\s+i)\s+(?:hold|keep|retain)\b",
            re.IGNORECASE,
        ),
        "hold_recommendation",
    ),
    (
        re.compile(
            r"\b(?:hold\s+or\s+(?:sell|dump|exit)|(?:sell|dump|exit)\s+or\s+hold|buy\s+or\s+sell|sell\s+or\s+buy)\b",
            re.IGNORECASE,
        ),
        "hold_recommendation",
    ),

    # 5. Price predictions & Market timing
    (
        re.compile(
            r"\bwhere\s+will\s+(?:the\s+)?(?:nifty|sensex|[a-zA-Z0-9_\-\.]+)\s+be(?:\s+next|\s+tomorrow|\s+in|\s+at|\s+by|\s+this)?\b",
            re.IGNORECASE,
        ),
        "price_prediction",
    ),
    (
        re.compile(
            r"\bwhich\s+(?:stock|share|crypto|fund|token|equity)s?\s+will\s+(?:double|triple|grow|explode|moon|gain|cross|rally|hit)\b",
            re.IGNORECASE,
        ),
        "price_prediction",
    ),
    (
        re.compile(
            r"\b(?:predict|prediction|forecast|projected\s+price|target\s+price|price\s+target)\b",
            re.IGNORECASE,
        ),
        "price_prediction",
    ),
    (
        re.compile(
            r"\bwill\s+[a-zA-Z0-9_\-\.]+\s+(?:go\s+up|rise|fall|drop|crash|rally|moon|tank|recover|reach|hit|double|triple|cross)\b",
            re.IGNORECASE,
        ),
        "price_prediction",
    ),

    # 6. General investment advice / tips
    (
        re.compile(
            r"\b(?:give\s+me|share)\s+(?:some\s+)?(?:stock|trading|crypto)\s+(?:tips?|signals?|picks?|recommendations?)\b",
            re.IGNORECASE,
        ),
        "investment_advice",
    ),
    (
        re.compile(
            r"\b(?:recommend|suggest)\s+(?:me\s+)?(?:a\s+)?(?:stock|share|mutual\s+fund|portfolio)\s+to\s+invest\b",
            re.IGNORECASE,
        ),
        "investment_advice",
    ),
]


@dataclass(frozen=True)
class GuardrailResult:
    is_blocked: bool
    reason: str | None = None
    refusal_message: str | None = None


def check_preflight_guardrail(question: str) -> GuardrailResult:
    """Check a question against advice, prediction, and jailbreak regexes before calling any LLM."""
    cleaned = question.strip()
    for pattern, reason in _ADVICE_PATTERNS:
        if pattern.search(cleaned):
            return GuardrailResult(
                is_blocked=True,
                reason=reason,
                refusal_message=STANDARD_REFUSAL_MESSAGE,
            )

    return GuardrailResult(is_blocked=False)
