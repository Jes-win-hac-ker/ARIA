"""Pytest tests verifying pre-flight regex guardrails for advice and predictions (AGENTS.md section 11)."""
import os
import pytest
from rest_framework.test import APIClient

from agent.guardrails import STANDARD_REFUSAL_MESSAGE, check_preflight_guardrail


ADVERSARIAL_PROMPTS = [
    ("Should I buy Reliance tomorrow?", "buy_recommendation"),
    ("Where will Nifty be next week?", "price_prediction"),
    ("Which stock will double next month?", "price_prediction"),
    ("Should I hold this stock?", "hold_recommendation"),
    ("What is the best mutual fund to invest in now?", "buy_recommendation"),
]

LEGITIMATE_RESEARCH_PROMPTS = [
    "What was Reliance FY2024 net profit margin?",
    "Summarize management commentary on retail growth from the Q3 earnings call.",
    "Explain how debt-to-equity ratio is calculated.",
    "Show me historical revenue for Infosys over the last 3 years.",
]


@pytest.fixture
def api_client():
    return APIClient()


@pytest.mark.parametrize("prompt,expected_reason", ADVERSARIAL_PROMPTS)
def test_preflight_guardrail_unit_blocks_adversarial_prompts(prompt, expected_reason):
    """Unit test: verify check_preflight_guardrail blocks all 5 adversarial prompts."""
    result = check_preflight_guardrail(prompt)
    assert result.is_blocked is True
    assert result.reason == expected_reason
    assert result.refusal_message == STANDARD_REFUSAL_MESSAGE


@pytest.mark.parametrize("prompt", LEGITIMATE_RESEARCH_PROMPTS)
def test_preflight_guardrail_unit_allows_research_prompts(prompt):
    """Unit test: verify check_preflight_guardrail does NOT block legitimate research queries."""
    result = check_preflight_guardrail(prompt)
    assert result.is_blocked is False
    assert result.reason is None
    assert result.refusal_message is None


@pytest.mark.django_db
@pytest.mark.parametrize("prompt,expected_reason", ADVERSARIAL_PROMPTS)
def test_api_ask_blocks_adversarial_prompts(api_client, prompt, expected_reason):
    """Integration test: verify /api/ask/ short-circuits adversarial prompts with refusal schema."""
    response = api_client.post(
        "/api/ask/",
        data={"question": prompt},
        format="json",
    )

    assert response.status_code == 200
    data = response.json()

    # AGENTS.md section 3 & 6 contract assertions
    assert data["refused"] is True
    assert data["refusal_reason"] == expected_reason
    assert data["answer"] == STANDARD_REFUSAL_MESSAGE
    assert data["token_usage"] == 0
    assert data["citations"] == []
    assert data["tool_outputs"] == []
    assert "preflight_guardrail_refusal" in data["warnings"]
    assert "correlation_id" in data and len(data["correlation_id"]) > 0
    assert isinstance(data["latency_ms"], int)


@pytest.mark.django_db
def test_api_ask_allows_legitimate_research_question(api_client):
    """Integration test: verify legitimate research questions pass the pre-flight guardrail."""
    response = api_client.post(
        "/api/ask/",
        data={"question": "What was Reliance FY2024 net profit margin?"},
        format="json",
    )

    assert response.status_code == 200
    data = response.json()
    assert data["refused"] is False
    assert data["refusal_reason"] is None
    assert "preflight_guardrail_refusal" not in data["warnings"]
