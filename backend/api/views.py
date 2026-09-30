"""API views: health probe and the ask endpoint stub."""
import time
import uuid

from django.db import connection
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from agent.guardrails import check_preflight_guardrail
from agent.router import route_and_execute
from .models import ChatSession
from .schemas import AgentResponse


def _safe_fallback(correlation_id: str, reason: str) -> dict:
    """Safe fallback response used whenever validation fails (AGENTS.md 6)."""
    return {
        'answer': 'Sorry, I could not produce a validated answer. Please try again.',
        'refused': False,
        'refusal_reason': None,
        'citations': [],
        'tool_outputs': [],
        'warnings': [f'validation_failed: {reason}'],
        'token_usage': 0,
        'correlation_id': correlation_id,
        'latency_ms': 0,
    }


@api_view(['GET'])
@permission_classes([])
def health(request):
    """Liveness + DB connectivity probe used by compose healthchecks."""
    db_ok = False
    try:
        with connection.cursor() as cursor:
            cursor.execute('SELECT 1')
            db_ok = True
    except Exception:
        db_ok = False
    return Response({'status': 'ok' if db_ok else 'degraded', 'database': db_ok})


@api_view(['POST'])
@permission_classes([])
def ask(request):
    """
    Stub ask endpoint.

    Wire the agent here: call tools, run RAG, then validate the model output
    with AgentResponse. If validation fails, return the safe fallback.
    """
    start = time.monotonic()
    correlation_id = str(uuid.uuid4())
    question = (request.data or {}).get('question', '').strip()

    if not question:
        return Response(
            {'error': "Field 'question' is required."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    # Pre-flight guardrail: short-circuit advice/prediction prompts before LLM (AGENTS.md section 3)
    guardrail_result = check_preflight_guardrail(question)
    if guardrail_result.is_blocked:
        refusal_payload = {
            'answer': guardrail_result.refusal_message,
            'refused': True,
            'refusal_reason': guardrail_result.reason,
            'citations': [],
            'tool_outputs': [],
            'warnings': ['preflight_guardrail_refusal'],
            'token_usage': 0,
            'correlation_id': correlation_id,
            'latency_ms': int((time.monotonic() - start) * 1000),
        }
        try:
            validated = AgentResponse.model_validate(refusal_payload)
        except Exception as exc:  # pragma: no cover
            return Response(_safe_fallback(correlation_id, str(exc)))

        ChatSession.objects.get_or_create(session_id=correlation_id)
        return Response(validated.model_dump())

    # Deterministic tool routing & execution (AGENTS.md sections 1 and 5)
    answer, tool_outputs, citations, warnings = route_and_execute(question)

    payload = {
        'answer': answer,
        'refused': False,
        'refusal_reason': None,
        'citations': [c.model_dump() for c in citations],
        'tool_outputs': [t.model_dump() for t in tool_outputs],
        'warnings': warnings,
        'token_usage': 0,
        'correlation_id': correlation_id,
        'latency_ms': int((time.monotonic() - start) * 1000),
    }

    try:
        validated = AgentResponse.model_validate(payload)
    except Exception as exc:  # pragma: no cover - defensive path
        return Response(_safe_fallback(correlation_id, str(exc)))

    # Session memory row (MySQL-backed; AGENTS.md section 4.4)
    ChatSession.objects.get_or_create(session_id=correlation_id)

    return Response(validated.model_dump())
