"""
Service layer for MySQL-backed session memory and tool-call tracking (AGENTS.md section 4.4 & 6).
Handles ChatSession, Message, and ToolCall models.
"""
from typing import Any
from django.utils import timezone
from .models import ChatSession, Message, ToolCall


def get_or_create_session(session_id: str) -> tuple[ChatSession, bool]:
    """Retrieve or create a chat session thread by ID."""
    return ChatSession.objects.get_or_create(session_id=session_id)


def record_user_message(session: ChatSession, content: str, correlation_id: str | None = None) -> Message:
    """Store an incoming user prompt linked to the session."""
    return Message.objects.create(
        session=session,
        role='user',
        content=content,
        correlation_id=correlation_id,
    )


def record_assistant_message(session: ChatSession, content: str, correlation_id: str | None = None) -> Message:
    """Store the final assistant response linked to the session."""
    return Message.objects.create(
        session=session,
        role='assistant',
        content=content,
        correlation_id=correlation_id,
    )


def record_tool_call(
    message: Message,
    tool_name: str,
    input_args: dict[str, Any],
    output_result: Any,
    latency_ms: int = 0,
) -> ToolCall:
    """
    Log a deterministic tool execution linked to the user's message.
    Ensures every fact and calculation is traceable.
    """
    return ToolCall.objects.create(
        message=message,
        tool_name=tool_name,
        input_args=input_args or {},
        output_result=output_result,
        latency_ms=max(0, int(latency_ms)),
    )


def add_session_token_usage(session: ChatSession, tokens: int) -> int:
    """Update accumulated token usage for a session."""
    if tokens > 0:
        session.token_usage += tokens
        session.save(update_fields=['token_usage', 'updated_at'])
    return session.token_usage


def get_conversation_history(session_id: str, limit: int = 20) -> list[dict[str, Any]]:
    """Retrieve ordered message history and associated tool calls for a session."""
    try:
        session = ChatSession.objects.get(session_id=session_id)
    except ChatSession.DoesNotExist:
        return []

    messages = (
        Message.objects.filter(session=session)
        .prefetch_related('tool_calls')
        .order_by('created_at')[:limit]
    )

    history = []
    for msg in messages:
        tools = [
            {
                'tool_name': tc.tool_name,
                'input_args': tc.input_args,
                'output_result': tc.output_result,
                'latency_ms': tc.latency_ms,
                'created_at': tc.created_at.isoformat(),
            }
            for tc in msg.tool_calls.all()
        ]
        history.append({
            'id': msg.id,
            'role': msg.role,
            'content': msg.content,
            'created_at': msg.created_at.isoformat(),
            'tool_calls': tools,
        })
    return history
