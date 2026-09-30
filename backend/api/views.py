"""API views: health probe and the ask endpoint stub."""
import time
import uuid

from django.db import connection
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

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

    # TODO(team): agent orchestration — RAG + filing retrieval tool +
    # financial calculator tool + price lookup tool (AGENTS.md section 5).

    payload = {
        'answer': (
            "ARIA is a research assistant stub. The agent pipeline is not "
            "wired yet, so I can only confirm your question was received."
        ),
        'refused': False,
        'refusal_reason': None,
        'citations': [],
        'tool_outputs': [],
        'warnings': ['agent_stub'],
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
