"""Pydantic schema validating every final AI response (AGENTS.md section 6)."""
from typing import Any

from pydantic import BaseModel, Field


class Citation(BaseModel):
    document: str
    locator: str = Field(description="page, section, or tool name")
    snippet: str


class ToolOutput(BaseModel):
    tool_name: str
    input: dict[str, Any] = {}
    output: Any
    source: str
    timestamp: str


class AgentResponse(BaseModel):
    """Final response contract: validated before anything reaches the user."""

    answer: str
    refused: bool = False
    refusal_reason: str | None = None
    citations: list[Citation] = []
    tool_outputs: list[ToolOutput] = []
    warnings: list[str] = []
    token_usage: int = 0
    correlation_id: str
    latency_ms: int = 0
