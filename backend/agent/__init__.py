"""Agent orchestration package.

Per AGENTS.md: the LLM handles language only; tools handle facts, math, and
decisions. Every final response must pass Pydantic validation before it
reaches the user (see api.schemas.AgentResponse).
"""
