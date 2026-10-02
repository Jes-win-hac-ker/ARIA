"""Pytest test verifying API contract compliance with AgentResponse Pydantic schema (AGENTS.md section 6)."""
import pytest
from rest_framework.test import APIClient

from api.models import ChatSession, Message, ToolCall
from api.schemas import AgentResponse
from api.schemas import Citation


@pytest.fixture
def api_client():
    return APIClient()


def test_citation_schema_preserves_retrieval_timestamp():
    timestamp = "2026-10-01T12:00:00+00:00"
    citation = Citation(
        document="annual-report.pdf",
        locator="Page 12",
        snippet="Reported results.",
        timestamp=timestamp,
    )

    assert citation.model_dump()["timestamp"] == timestamp


@pytest.mark.django_db
def test_api_ask_contract_strictly_matches_agent_response_schema(api_client):
    """
    Sends a valid research query to /api/ask/ and asserts the JSON response
    strictly matches the AgentResponse Pydantic schema keys and types.
    """
    query_payload = {"question": "What was Reliance FY2024 net profit margin?"}

    response = api_client.post(
        "/api/ask/",
        data=query_payload,
        format="json",
    )

    assert response.status_code == 200
    data = response.json()

    # 1. Exact key match with AgentResponse fields
    expected_keys = set(AgentResponse.model_fields.keys())
    actual_keys = set(data.keys())
    assert actual_keys == expected_keys, f"Schema mismatch. Missing: {expected_keys - actual_keys}, Extra: {actual_keys - expected_keys}"

    # 2. Strict Pydantic model validation
    validated = AgentResponse.model_validate(data)
    assert validated.correlation_id == data["correlation_id"]
    assert isinstance(validated.answer, str)
    assert isinstance(validated.refused, bool)
    assert isinstance(validated.citations, list)
    assert isinstance(validated.tool_outputs, list)
    assert isinstance(validated.warnings, list)
    assert isinstance(validated.token_usage, int)
    assert isinstance(validated.latency_ms, int)


@pytest.mark.django_db
def test_delete_session_cascades_and_erases_all_data(api_client):
    """
    Verifies that calling DELETE /api/sessions/{session_id}/ performs a cascade delete
    on the ChatSession model, automatically deleting all related Message and ToolCall rows,
    and returns 200 OK with {"status": "data_erased"}.
    """
    session_id = "test-session-cascade-erasure"
    session = ChatSession.objects.create(session_id=session_id)
    msg = Message.objects.create(
        session=session,
        role="user",
        content="What was Reliance FY2024 net profit margin?",
        correlation_id="11111111-1111-1111-1111-111111111111",
    )
    ToolCall.objects.create(
        message=msg,
        tool_name="financial_calculator",
        input_args={"formula": "(net_profit / revenue) * 100"},
        output_result={"result_percent": 7.89},
        latency_ms=10,
        correlation_id="11111111-1111-1111-1111-111111111111",
    )

    # Verify rows exist before deletion
    assert ChatSession.objects.filter(session_id=session_id).exists()
    assert Message.objects.filter(session=session).count() == 1
    assert ToolCall.objects.filter(message=msg).count() == 1

    # Send DELETE request
    response = api_client.delete(f"/api/sessions/{session_id}/")

    assert response.status_code == 200
    assert response.json() == {"status": "data_erased"}

    # Assert all rows across ChatSession, Message, and ToolCall are deleted in database
    assert not ChatSession.objects.filter(session_id=session_id).exists()
    assert not Message.objects.filter(session__session_id=session_id).exists()
    assert not ToolCall.objects.filter(message__session__session_id=session_id).exists()


@pytest.mark.django_db
def test_delete_session_not_found(api_client):
    """Assert DELETE returns 404 when session does not exist."""
    response = api_client.delete("/api/sessions/non-existent-session-id/")
    assert response.status_code == 404


@pytest.mark.django_db
def test_sequential_queries_preserve_session_context(api_client):
    """
    Sends two sequential queries with the same session_id:
    Query 1: 'What was Reliance FY2024 net profit margin?'
    Query 2: 'And TCS?'
    Asserts the second response correctly understands the context and returns TCS's margin.
    """
    session_id = "test-sequential-context-session"

    # Turn 1: Discuss Reliance margin
    resp1 = api_client.post(
        "/api/ask/",
        data={
            "question": "What was Reliance FY2024 net profit margin?",
            "session_id": session_id,
        },
        format="json",
    )
    assert resp1.status_code == 200
    data1 = resp1.json()
    assert not data1["refused"]
    assert "7.88" in data1["answer"] or "7.89" in data1["answer"] or "RELIANCE" in data1["answer"].upper()

    # Turn 2: Follow-up question relying on previous context ("And TCS?")
    resp2 = api_client.post(
        "/api/ask/",
        data={
            "question": "And TCS?",
            "session_id": session_id,
        },
        format="json",
    )
    assert resp2.status_code == 200
    data2 = resp2.json()
    assert not data2["refused"]

    # Assert response understands context: mentions TCS and margin / 19.59%
    answer_lower = data2["answer"].lower()
    assert "tcs" in answer_lower
    assert "margin" in answer_lower or "19.59" in data2["answer"]

    # Assert tool outputs executed deterministic tool for TCS
    tool_names = [t["tool_name"] for t in data2.get("tool_outputs", [])]
    assert "financial_calculator" in tool_names or "fundamentals_lookup" in tool_names

    # Assert MySQL message history contains 4 ordered messages
    messages = list(Message.objects.filter(session__session_id=session_id).order_by("created_at"))
    assert len(messages) == 4
    assert messages[0].role == "user"
    assert "Reliance" in messages[0].content
    assert messages[1].role == "assistant"
    assert messages[2].role == "user"
    assert "And TCS?" in messages[2].content
    assert messages[3].role == "assistant"


def test_conversation_history_passed_to_gemini_system_prompt():
    """Unit test: verify conversation_history is injected into systemInstruction for Gemini."""
    import os
    from unittest.mock import patch
    from agent.llm import synthesize_research_answer

    history = "User: What is Reliance's margin?\nAssistant: It was 20%.\nUser: And TCS?"
    with patch("agent.llm._call_gemini_api", return_value=("Mock contextual answer", 42)) as mock_gemini:
        with patch.dict(os.environ, {"GEMINI_API_KEY": "dummy_key_for_test"}):
            synthesize_research_answer(
                question="And TCS?",
                tool_outputs=[],
                citations=[],
                default_answer="Default",
                conversation_history=history,
            )
            assert mock_gemini.called
            _, kwargs = mock_gemini.call_args
            passed_system_prompt = kwargs.get("system_prompt", "")
            assert "User: What is Reliance's margin?" in passed_system_prompt
            assert "Assistant: It was 20%." in passed_system_prompt
            assert "User: And TCS?" in passed_system_prompt


