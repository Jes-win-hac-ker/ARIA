const API_BASE = import.meta.env.VITE_API_BASE_URL || ''
export const mockMode = import.meta.env.VITE_MOCK_MODE === 'true'

export function documentUrl(filename) {
  return `${API_BASE.replace(/\/$/, '')}/api/documents/${encodeURIComponent(filename)}/`
}

function createMockCorrelationId() {
  return globalThis.crypto?.randomUUID?.() || `mock-${Date.now()}`
}

export async function healthCheck() {
  const response = await fetch(`${API_BASE}/api/health/`)
  if (!response.ok) {
    throw new Error(`Health check failed with HTTP ${response.status}`)
  }

  return response.json()
}

export async function askQuestion(question) {
  if (mockMode) {
    return {
      answer: 'Mock mode is enabled. This placeholder contains no financial research or factual company data.',
      refused: false,
      refusal_reason: null,
      citations: [],
      tool_outputs: [],
      warnings: ['Mock mode is enabled; this is not a response from the ARIA API.'],
      token_usage: 0,
      correlation_id: createMockCorrelationId(),
      latency_ms: 0,
    }
  }

  const response = await fetch(`${API_BASE}/api/ask/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question }),
  })
  if (!response.ok) {
    throw new Error(`Request failed with HTTP ${response.status}`)
  }

  return response.json()
}
