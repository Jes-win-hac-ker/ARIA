/**
 * @typedef {import('./types').HealthResponse} HealthResponse
 * @typedef {import('./types').AskResponse} AskResponse
 */


const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || ''
const MOCK_MODE = import.meta.env.VITE_MOCK_MODE === 'true'

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })

  if (!response.ok) {
    let message = `Request failed with HTTP ${response.status}`

    try {
      const data = await response.json()
      if (data.error) {
        message = data.error
      }
    } catch {
      // Response wasn't JSON, keep the default message.
    }

    throw new Error(message)
  }

  return response.json()
}

function mockHealthCheck() {
  return Promise.resolve({
    status: 'ok',
    database: true,
  })
}

function mockAskQuestion(question) {
  return Promise.resolve({
    answer: `Mock ARIA response: I received your research question — "${question}"`,
    refused: false,
    refusal_reason: null,
    citations: [],
    tool_outputs: [],
    warnings: ['mock_mode'],
    token_usage: 0,
    correlation_id: crypto.randomUUID(),
    latency_ms: 50,
  })
}

/**
 * @returns {Promise<HealthResponse>}
 */

export function healthCheck() {
  if (MOCK_MODE) {
    return mockHealthCheck()
  }

  return request('/api/health/')
}

/**
 * @param {string} question
 * @returns {Promise<AskResponse>}
 */

export function askQuestion(question) {
  if (MOCK_MODE) {
    return mockAskQuestion(question)
  }

  return request('/api/ask/', {
    method: 'POST',
    body: JSON.stringify({ question }),
  })
}