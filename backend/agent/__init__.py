"""Agent orchestration package.

Per AGENTS.md: the LLM handles language only; tools handle facts, math, and
decisions. Every final response must pass Pydantic validation before it
reaches the user (see api.schemas.AgentResponse).
"""
from .guardrails import GuardrailResult, STANDARD_REFUSAL_MESSAGE, check_preflight_guardrail

__all__ = [
    "GuardrailResult",
    "STANDARD_REFUSAL_MESSAGE",
    "check_preflight_guardrail",
]
