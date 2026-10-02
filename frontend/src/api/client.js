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

export async function getComparisonData() {
  const response = await fetch(`${API_BASE}/api/comparison-data/`)
  if (!response.ok) {
    throw new Error(`Comparison data request failed with HTTP ${response.status}`)
  }

  return response.json()
}

export async function getMarketMovers() {
  const response = await fetch(`${API_BASE}/api/market-movers/`)
  if (!response.ok) {
    throw new Error(`Market data request failed with HTTP ${response.status}`)
  }

  return response.json()
}

export async function askQuestion(question, sessionId = null) {
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
      session_id: sessionId || createMockCorrelationId(),
    }
  }

  const payload = { question }
  if (sessionId) {
    payload.session_id = sessionId
  }

  const response = await fetch(`${API_BASE}/api/ask/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!response.ok) {
    throw new Error(`Request failed with HTTP ${response.status}`)
  }

  return response.json()
}

export async function deleteSession(sessionId) {
  if (!sessionId) return { status: 'data_erased' }
  if (mockMode) {
    return { status: 'data_erased' }
  }

  const response = await fetch(`${API_BASE}/api/sessions/${encodeURIComponent(sessionId)}/`, {
    method: 'DELETE',
  })
  if (!response.ok && response.status !== 404) {
    throw new Error(`Delete session failed with HTTP ${response.status}`)
  }

  try {
    const text = await response.text()
    return text ? JSON.parse(text) : { status: 'data_erased' }
  } catch {
    return { status: 'data_erased' }
  }
}

