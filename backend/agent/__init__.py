"""Agent orchestration package.

Per AGENTS.md: the LLM handles language only; tools handle facts, math, and
decisions. Every final response must pass Pydantic validation before it
reaches the user (see api.schemas.AgentResponse).
"""
from .guardrails import GuardrailResult, STANDARD_REFUSAL_MESSAGE, check_preflight_guardrail
from .router import calculate_math, route_and_execute

__all__ = [
    "GuardrailResult",
    "STANDARD_REFUSAL_MESSAGE",
    "calculate_math",
    "check_preflight_guardrail",
    "route_and_execute",
]
