import { useEffect, useState } from 'react'

const API_BASE = import.meta.env.VITE_API_BASE_URL || ''

export default function App() {
  const [health, setHealth] = useState('checking…')
  const [question, setQuestion] = useState('')
  const [response, setResponse] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetch(`${API_BASE}/api/health/`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((d) => setHealth(d.status === 'ok' && d.database ? 'connected' : 'degraded'))
      .catch(() => setHealth('unreachable'))
  }, [])

  async function ask(e) {
    e.preventDefault()
    setError(null)
    setResponse(null)
    try {
      const r = await fetch(`${API_BASE}/api/ask/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question }),
      })
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      setResponse(await r.json())
    } catch (err) {
      setError(String(err))
    }
  }

  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', maxWidth: 720, margin: '3rem auto', padding: '0 1rem' }}>
      <h1>ARIA</h1>
      <p>Financial research &amp; explanation assistant — <strong>research-only</strong>.</p>
      <p>
        API status: <code>{health}</code>
      </p>

      <form onSubmit={ask}>
        <input
          style={{ width: '70%', padding: '0.5rem' }}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask a research question…"
          required
        />
        <button type="submit" style={{ padding: '0.5rem 1rem' }}>Ask</button>
      </form>

      {error && <p style={{ color: 'crimson' }}>Error: {error}</p>}

      {response && (
        <section style={{ marginTop: '1rem', background: '#f6f8fa', padding: '1rem', borderRadius: 8 }}>
          <p>{response.answer}</p>
          {response.refused && (
            <p style={{ color: 'darkorange' }}>Refused: {response.refusal_reason}</p>
          )}
          {response.warnings?.length > 0 && (
            <p style={{ color: 'gray' }}>Warnings: {response.warnings.join(', ')}</p>
          )}
          <small>correlation_id: {response.correlation_id}</small>
        </section>
      )}
    </main>
  )
}
