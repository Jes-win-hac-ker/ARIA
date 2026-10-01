"""Pytest test verifying API contract compliance with AgentResponse Pydantic schema (AGENTS.md section 6)."""
import pytest
from rest_framework.test import APIClient

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
