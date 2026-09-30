import { useEffect, useState } from 'react'
import { askQuestion, healthCheck } from './api/client'
import { getSessionId } from './utils/session'

export default function App() {
  const [sessionId] = useState(() => getSessionId())
  const [health, setHealth] = useState('checking…')
  const [question, setQuestion] = useState('')
  const [response, setResponse] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    healthCheck()
      .then((data) => {
        setHealth(
          data.status === 'ok' && data.database
            ? 'connected'
            : 'degraded'
        )
      })
      .catch(() => {
        setHealth('unreachable')
      })
  }, [])

  async function ask(e) {
    e.preventDefault()

    if (!question.trim()) return

    setError(null)
    setResponse(null)
    setLoading(true)

    try {
      const data = await askQuestion(question)
      setResponse(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main
      style={{
        fontFamily: 'system-ui, sans-serif',
        maxWidth: 720,
        margin: '3rem auto',
        padding: '0 1rem',
      }}
    >
      <h1>ARIA</h1>

      <p>
        Financial research &amp; explanation assistant —{' '}
        <strong>research-only</strong>.
      </p>

      <p>
        API status: <code>{health}</code>
      </p>
      <p>
        Session: <code>{sessionId}</code>
      </p>

      <form onSubmit={ask}>
        <input
          style={{ width: '70%', padding: '0.5rem' }}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask a research question…"
          disabled={loading}
        />

        <button
          type="submit"
          style={{ padding: '0.5rem 1rem' }}
          disabled={loading}
        >
          {loading ? 'Asking…' : 'Ask'}
        </button>
      </form>

      {error && (
        <p style={{ color: 'crimson' }}>
          Error: {error}
        </p>
      )}

      {response && (
        <section
          style={{
            marginTop: '1rem',
            background: '#f6f8fa',
            padding: '1rem',
            borderRadius: 8,
          }}
        >
          <p>{response.answer}</p>

          {response.refused && (
            <p style={{ color: 'darkorange' }}>
              Refused: {response.refusal_reason}
            </p>
          )}

          {response.warnings?.length > 0 && (
            <p style={{ color: 'gray' }}>
              Warnings: {response.warnings.join(', ')}
            </p>
          )}

          <small>
            correlation_id: {response.correlation_id}
          </small>
        </section>
      )}
    </main>
  )
}