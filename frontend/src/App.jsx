<<<<<<< HEAD
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
=======
import { useEffect, useRef, useState } from 'react'
import { askQuestion, healthCheck, mockMode } from './api/client.js'
import { getSessionId } from './utils/session.js'

const suggestedQuestions = [
  'What risks did management highlight in the latest earnings call?',
  'Summarize the company’s recent capital allocation commentary.',
  'What does debt-to-equity measure?',
]

function readStoredTheme() {
  try {
    return window.localStorage.getItem('aria-theme') === 'dark' ? 'dark' : 'light'
  } catch {
    return 'light'
  }
}

function readFollowedCompanies() {
  try {
    const stored = JSON.parse(window.localStorage.getItem('aria-followed-companies') || '[]')
    if (!Array.isArray(stored)) return []
    return stored.filter(
      (company) =>
        company &&
        typeof company.name === 'string' &&
        typeof company.ticker === 'string',
    )
  } catch {
    return []
  }
}

function Icon({ name, children }) {
  return <span className={`icon icon-${name}`} aria-hidden="true">{children}</span>
}

function BrandSymbol({ idPrefix }) {
  const mainGradient = `${idPrefix}-mark-main`
  const secondaryGradient = `${idPrefix}-mark-secondary`

  return (
    <svg viewBox="0 0 64 64" focusable="false" aria-hidden="true">
      <defs>
        <linearGradient id={mainGradient} x1="18" y1="44" x2="47" y2="13" gradientUnits="userSpaceOnUse">
          <stop stopColor="#28623B" />
          <stop offset="1" stopColor="#99B94B" />
        </linearGradient>
        <linearGradient id={secondaryGradient} x1="26" y1="53" x2="48" y2="30" gradientUnits="userSpaceOnUse">
          <stop stopColor="#92A94F" />
          <stop offset="1" stopColor="#C0D57A" />
        </linearGradient>
      </defs>
      <path d="M8 34c11 2 22 3 30-2 8-5 13-13 18-23l6-3-2 15-4-5c-5 9-10 15-18 18-9 4-20 1-30 0Z" fill={`url(#${mainGradient})`} />
      <path d="M18 47c11 2 23-3 31-16l4-8c-4 12-12 23-23 27-7 2-14 1-20-2Z" fill={`url(#${secondaryGradient})`} />
    </svg>
  )
}

function StatusPill({ health }) {
  const labels = {
    checking: 'Checking API',
    connected: 'API connected',
    degraded: 'API degraded',
    unreachable: 'API unreachable',
  }

  return (
    <span className={`status-pill status-${health}`} aria-live="polite">
      <span className="status-dot" aria-hidden="true" />
      {labels[health]}
    </span>
  )
}

function ToolOutput({ tool }) {
  return (
    <details className="tool-output">
      <summary>
        <span className="tool-check" aria-hidden="true">✓</span>
        <span>{tool.tool_name}</span>
        <span className="tool-source">{tool.source}</span>
      </summary>
      <pre>{JSON.stringify(tool.output, null, 2)}</pre>
      <p className="tool-timestamp">Retrieved {tool.timestamp}</p>
    </details>
  )
}

function EvidenceTabs({ messages, activeTab, setActiveTab }) {
  const citationCount = messages.reduce((count, message) => count + (message.response?.citations?.length || 0), 0)
  const toolCount = messages.reduce((count, message) => count + (message.response?.tool_outputs?.length || 0), 0)

  return (
    <div className="inspector-tabs conversation-evidence-tabs" role="tablist" aria-label="Evidence panels">
      <button
        className={activeTab === 'sources' ? 'inspector-tab selected' : 'inspector-tab'}
        id="sources-tab"
        type="button"
        role="tab"
        aria-selected={activeTab === 'sources'}
        aria-controls="sources-panel"
        onClick={() => setActiveTab('sources')}
      >
        <Icon name="document">▤</Icon>
        <span>Sources</span>
        <span className="tab-count">{citationCount}</span>
      </button>
      <button
        className={activeTab === 'tools' ? 'inspector-tab selected' : 'inspector-tab'}
        id="tools-tab"
        type="button"
        role="tab"
        aria-selected={activeTab === 'tools'}
        aria-controls="tools-panel"
        onClick={() => setActiveTab('tools')}
      >
        <Icon name="tools">⌘</Icon>
        <span>Tool activity</span>
        <span className="tab-count">{toolCount}</span>
      </button>
    </div>
  )
}

function Inspector({ messages, activeTab, setActiveTab, selectedCitation, setSelectedCitation }) {
  const citations = messages.flatMap((message) =>
    (message.response?.citations || []).map((citation, index) => ({
      ...citation,
      id: `${message.id}-${index}`,
      index: index + 1,
      question: message.question,
    })),
  )
  const tools = messages.flatMap((message) => message.response?.tool_outputs || [])
  const selected = citations.find((citation) => citation.id === selectedCitation)

  return (
    <aside className="inspector-pane" aria-label="Research evidence">
      {activeTab === 'sources' ? (
        <div className="inspector-content" id="sources-panel" role="tabpanel" aria-labelledby="sources-tab">
          {selected ? (
            <>
              <div className="source-card">
                <div className="source-card-heading">
                  <span className="verified-mark" aria-hidden="true">✓</span>
                  <div className="source-title-wrap">
                    <h2>{selected.document}</h2>
                    <p>{selected.locator}</p>
                  </div>
                  <span className="source-number">[{selected.index}]</span>
                </div>
                <div className="source-excerpt">
                  <span className="overline">CITED EXCERPT</span>
                  <blockquote>{selected.snippet}</blockquote>
                </div>
                <div className="source-context">
                  <span className="overline">RELATED INQUIRY</span>
                  <p>{selected.question}</p>
                </div>
              </div>
              <div className="source-list-heading">
                <span className="overline">SOURCES IN THIS THREAD</span>
                <span className="tab-count">{citations.length}</span>
              </div>
              <div className="source-list">
                {citations.map((citation) => (
                  <button
                    className={citation.id === selected.id ? 'source-list-item active' : 'source-list-item'}
                    key={citation.id}
                    type="button"
                    onClick={() => setSelectedCitation(citation.id)}
                  >
                    <span className="source-list-number">[{citation.index}]</span>
                    <span className="source-list-copy">
                      <strong>{citation.document}</strong>
                      <span>{citation.locator}</span>
                    </span>
                    <span className="source-chevron" aria-hidden="true">›</span>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <div className="inspector-empty">
              <span className="empty-symbol" aria-hidden="true">▤</span>
              <h2>Source document drawer</h2>
              <p>Retrieved citations will appear here with their document name, location, and supporting excerpt.</p>
              <div className="empty-rule" />
              <span className="overline">TRACEABLE RESEARCH</span>
            </div>
          )}
        </div>
      ) : (
        <div className="inspector-content" id="tools-panel" role="tabpanel" aria-labelledby="tools-tab">
          {tools.length ? (
            <div className="activity-list">
              <div className="activity-intro">
                <span className="overline">DETERMINISTIC EVIDENCE</span>
                <h2>Tool activity</h2>
                <p>Outputs returned by the tools used in this research thread.</p>
              </div>
              {tools.map((tool, index) => <ToolOutput key={`${tool.tool_name}-${index}`} tool={tool} />)}
            </div>
          ) : (
            <div className="inspector-empty">
              <span className="empty-symbol" aria-hidden="true">⌘</span>
              <h2>No tool activity yet</h2>
              <p>When a research response uses a retrieval or calculator tool, its output and source will be shown here.</p>
            </div>
          )}
        </div>
      )}

      <div className="inspector-footer">
        <span className="footer-shield" aria-hidden="true">◇</span>
        <span>Every fact should have a source.</span>
      </div>
    </aside>
  )
}

export default function App() {
  const [health, setHealth] = useState('checking')
  const [sessionId] = useState(getSessionId)
  const [activeSection, setActiveSection] = useState('research')
  const [theme, setTheme] = useState(readStoredTheme)
  const [followedCompanies, setFollowedCompanies] = useState(readFollowedCompanies)
  const [selectedCompanies, setSelectedCompanies] = useState([])
  const [companyFormOpen, setCompanyFormOpen] = useState(false)
  const [companyName, setCompanyName] = useState('')
  const [companyTicker, setCompanyTicker] = useState('')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [privacyOpen, setPrivacyOpen] = useState(false)
  const [settingsNotice, setSettingsNotice] = useState('')
  const [question, setQuestion] = useState('')
  const [command, setCommand] = useState('')
  const [messages, setMessages] = useState([])
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [activeTab, setActiveTab] = useState('sources')
  const [selectedCitation, setSelectedCitation] = useState(null)
  const composerRef = useRef(null)
  const threadEndRef = useRef(null)

  useEffect(() => {
    healthCheck()
      .then((data) => setHealth(data.status === 'ok' && data.database ? 'connected' : 'degraded'))
      .catch(() => setHealth('unreachable'))
  }, [])

  useEffect(() => {
    try {
      window.localStorage.setItem('aria-theme', theme)
    } catch {
      setSettingsNotice('Theme preference could not be saved in this browser.')
    }
    document.querySelector('meta[name="theme-color"]')?.setAttribute(
      'content',
      theme === 'dark' ? '#191d20' : '#f5f4f0',
    )
  }, [theme])

  useEffect(() => {
    try {
      window.localStorage.setItem('aria-followed-companies', JSON.stringify(followedCompanies))
    } catch {
      setSettingsNotice('Followed companies could not be saved in this browser.')
    }
  }, [followedCompanies])

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages, loading, error])

  useEffect(() => {
    function handleShortcut(event) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'b') {
        event.preventDefault()
        setSidebarOpen((open) => !open)
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        composerRef.current?.focus()
      }
    }
    window.addEventListener('keydown', handleShortcut)
    return () => window.removeEventListener('keydown', handleShortcut)
  }, [])

  useEffect(() => {
    if (!settingsOpen) return undefined
    function closeOnEscape(event) {
      if (event.key === 'Escape') {
        setSettingsOpen(false)
        setPrivacyOpen(false)
      }
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [settingsOpen])

  async function ask(event) {
    event?.preventDefault()
    const submittedQuestion = (question || command).trim()
    if (!submittedQuestion || loading) return

    const messageId = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`
    setError(null)
    setQuestion('')
    setCommand('')
    setMessages((current) => [...current, {
      id: messageId,
      question: submittedQuestion,
      response: null,
      createdAt: new Date().toISOString(),
    }])
    setLoading(true)

    try {
      const result = await askQuestion(submittedQuestion)
      setMessages((current) =>
        current.map((message) => (message.id === messageId ? { ...message, response: result } : message)),
      )
      if (result.citations?.length) {
        setSelectedCitation(`${messageId}-0`)
        setActiveTab('sources')
      } else {
        setSelectedCitation(null)
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : String(requestError))
      setMessages((current) => current.map((message) =>
        message.id === messageId ? { ...message, failed: true } : message,
      ))
    } finally {
      setLoading(false)
    }
  }

  function startNewResearch() {
    setMessages([])
    setActiveSection('research')
    setError(null)
    setQuestion('')
    setCommand('')
    setSelectedCitation(null)
    setActiveTab('sources')
    composerRef.current?.focus()
  }

  function chooseSuggestedQuestion(suggestion) {
    setQuestion(suggestion)
    composerRef.current?.focus()
  }

  function addFollowedCompany(event) {
    event.preventDefault()
    const name = companyName.trim()
    const ticker = companyTicker.trim().toUpperCase()
    if (!name || !ticker) return
    if (followedCompanies.some((company) => company.ticker.toUpperCase() === ticker)) {
      setSettingsNotice(`${ticker} is already in your followed companies.`)
      return
    }

    setFollowedCompanies((current) => [...current, { name, ticker }])
    setSelectedCompanies((current) => [...current, ticker])
    setCompanyName('')
    setCompanyTicker('')
    setCompanyFormOpen(false)
    setSettingsNotice(`${name} was added to this browser’s followed companies.`)
  }

  function toggleCompanySelection(ticker) {
    setSelectedCompanies((current) =>
      current.includes(ticker)
        ? current.filter((item) => item !== ticker)
        : current.length < 3
          ? [...current, ticker]
          : current,
    )
  }

  function prepareCompanyResearch(company) {
    setActiveSection('research')
    setQuestion(`Summarize the latest available public disclosures and management commentary for ${company.name} (${company.ticker}). Include citations and clearly state the source and retrieval time. Do not provide investment advice or price predictions.`)
    composerRef.current?.focus()
  }

  function prepareCompanyComparison() {
    if (selectedCompanies.length < 2) return
    setActiveSection('research')
    const companies = followedCompanies.filter((company) => selectedCompanies.includes(company.ticker))
    const companyNames = companies.map((company) => `${company.name} (${company.ticker})`).join(' and ')
    setQuestion(`Compare ${companyNames} using only retrieved public filings and management commentary. Cite each source, identify the reporting period, and state when data is unavailable. Do not calculate financial metrics or provide investment advice.`)
    composerRef.current?.focus()
  }

  function showAuthenticationNotice(action) {
    setSettingsNotice(`${action} is unavailable: authentication is not configured for this API.`)
  }

  const latestQuestion = messages.at(-1)?.question
  return (
    <div className={`workstation theme-${theme} ${sidebarOpen ? '' : 'sidebar-collapsed'}`}>
      <header className="command-bar">
        <div className="command-brand">
          <button
            className="icon-button sidebar-toggle"
            type="button"
            onClick={() => setSidebarOpen((open) => !open)}
            title="Toggle navigation sidebar (Ctrl+B)"
            aria-label="Toggle navigation sidebar"
            aria-expanded={sidebarOpen}
          >
            <Icon name="menu">☰</Icon>
          </button>
          <a className="brand" href="/" aria-label="ARIA research home">
            <span className="brand-mark" aria-hidden="true">
              <BrandSymbol idPrefix="header" />
            </span>
            <span className="brand-name">ARIA</span>
          </a>
          <span className="brand-tagline">ASK <i>·</i> RETRIEVE <i>·</i> INTERPRET <i>·</i> AUGMENT</span>
        </div>

        <form className="command-search" onSubmit={ask} role="search">
          <Icon name="search">⌕</Icon>
          <input
            aria-label="Ask a financial research question"
            value={command}
            onChange={(event) => setCommand(event.target.value)}
            placeholder="Ask a question about a filing or company…"
            disabled={loading}
          />
          <kbd>⌘ K</kbd>
        </form>

        <div className="command-actions">
          <StatusPill health={health} />
        </div>
      </header>

      <div className="workstation-body">
        {sidebarOpen && (
          <aside className="workbench-sidebar" aria-label="Research navigation">
            <div className="new-session-wrap">
              <button className="new-session-button" type="button" onClick={startNewResearch}>
                <Icon name="add">＋</Icon>
                <span>New research session</span>
              </button>
            </div>
            <div className="sidebar-scroll">
              <div className="sidebar-label">WORKSPACE</div>
              <nav className="side-navigation" aria-label="Workspace">
                <button className={`side-nav-item ${activeSection === 'research' ? 'active' : ''}`} type="button" aria-current={activeSection === 'research' ? 'page' : undefined} onClick={() => setActiveSection('research')}>
                  <Icon name="chat">▤</Icon><span>Research</span>
                </button>
                <button className={`side-nav-item ${activeSection === 'history' ? 'active' : ''}`} type="button" aria-current={activeSection === 'history' ? 'page' : undefined} onClick={() => setActiveSection('history')}>
                  <Icon name="folder">◷</Icon><span>History</span>
                  <span className="nav-count">{messages.length}</span>
                </button>
                <button className={`side-nav-item ${activeSection === 'library' ? 'active' : ''}`} type="button" aria-current={activeSection === 'library' ? 'page' : undefined} onClick={() => setActiveSection('library')}>
                  <Icon name="folder">▧</Icon><span>Library</span>
                  <span className="nav-count">{followedCompanies.length}</span>
                </button>
                <button className="side-nav-item" type="button" onClick={() => { setSettingsNotice(''); setSettingsOpen(true) }}>
                  <Icon name="settings">⚙</Icon><span>Settings</span>
                </button>
              </nav>

              <div className="sidebar-divider" />
              <div className="sidebar-section-heading">
                <span className="sidebar-label">CURRENT THREAD</span>
                <span className="thread-state"><span />{messages.length ? `${messages.length} ${messages.length === 1 ? 'inquiry' : 'inquiries'}` : 'New'}</span>
              </div>
              {latestQuestion ? (
                <button
                  className="recent-thread"
                  type="button"
                  onClick={() => composerRef.current?.focus()}
                  title={latestQuestion}
                >
                  <span className="recent-thread-title">{latestQuestion}</span>
                  <span className="recent-thread-subtitle">In this session</span>
                </button>
              ) : (
                <div className="sidebar-empty">Questions and their source trails will appear here in this session.</div>
              )}

            </div>
            <div className="sidebar-bottom">
              <div className="sidebar-preferences">
                <span>Appearance</span>
                <button
                  className="sidebar-theme-toggle"
                  type="button"
                  onClick={() => setTheme((current) => current === 'dark' ? 'light' : 'dark')}
                  aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
                >
                  <span aria-hidden="true">{theme === 'dark' ? '☾' : '☼'}</span>
                  {theme === 'dark' ? 'Dark' : 'Light'}
                </button>
              </div>
              <div className="sidebar-status"><StatusPill health={health} /></div>
              <p>Source-grounded financial research</p>
            </div>
          </aside>
        )}

        <main className="research-workspace">
          {activeSection === 'library' ? (
          <section className="company-strip library-section" id="followed-companies" aria-labelledby="companies-heading">
            <div className="company-strip-heading">
              <div>
                <h1 id="companies-heading">Followed companies</h1>
                <p>Saved in this browser · fundamentals provider not configured</p>
              </div>
              <div className="company-strip-actions">
                <button
                  className="compare-button"
                  type="button"
                  onClick={prepareCompanyComparison}
                  disabled={selectedCompanies.length < 2}
                  title={selectedCompanies.length < 2 ? 'Select at least two companies to compare' : 'Prepare a sourced comparison question'}
                >
                  Compare selected{selectedCompanies.length ? ` (${selectedCompanies.length})` : ''}
                </button>
                <button className="add-company-button" type="button" onClick={() => setCompanyFormOpen((open) => !open)}>
                  <span aria-hidden="true">＋</span> Follow company
                </button>
              </div>
            </div>

            {companyFormOpen && (
              <form className="company-add-form" onSubmit={addFollowedCompany}>
                <label>
                  Company name
                  <input value={companyName} onChange={(event) => setCompanyName(event.target.value)} maxLength={120} placeholder="Company name" required />
                </label>
                <label>
                  Ticker
                  <input value={companyTicker} onChange={(event) => setCompanyTicker(event.target.value)} maxLength={20} placeholder="Ticker" required />
                </label>
                <button className="add-company-button" type="submit">Add to list</button>
              </form>
            )}

            {followedCompanies.length ? (
              <>
                <div className="followed-company-list">
                  {followedCompanies.map((company) => (
                    <article className="followed-company-card" key={company.ticker}>
                      <label className="company-select">
                        <input
                          type="checkbox"
                          checked={selectedCompanies.includes(company.ticker)}
                          disabled={!selectedCompanies.includes(company.ticker) && selectedCompanies.length >= 3}
                          onChange={() => toggleCompanySelection(company.ticker)}
                          aria-label={`Select ${company.name} for comparison`}
                        />
                        <span className="company-ticker">{company.ticker}</span>
                        <span className="company-name">{company.name}</span>
                      </label>
                      <span className="company-data-status"><span />Data source not configured</span>
                      <button className="company-research-button" type="button" onClick={() => prepareCompanyResearch(company)}>
                        Research
                      </button>
                      <button
                        className="remove-company-button"
                        type="button"
                        aria-label={`Remove ${company.name} from followed companies`}
                        onClick={() => {
                          setFollowedCompanies((current) => current.filter((item) => item.ticker !== company.ticker))
                          setSelectedCompanies((current) => current.filter((ticker) => ticker !== company.ticker))
                        }}
                      >
                        ×
                      </button>
                    </article>
                  ))}
                </div>
                <p className="company-strip-note">Company statistics are unavailable until a permitted fundamentals source is configured. Compare prepares a cited research question; it does not calculate metrics.</p>
              </>
            ) : (
              <div className="company-empty-state">
                <span>Follow a company by name and ticker to keep it in this browser and prepare cited research questions.</span>
              </div>
            )}
          </section>
          ) : activeSection === 'history' ? (
            <section className="history-section" aria-labelledby="history-heading">
              <header className="section-page-heading">
                <div>
                  <span className="overline">THIS BROWSER SESSION</span>
                  <h1 id="history-heading">Research history</h1>
                  <p>Questions asked during this session. History is cleared when you start a new research session or close this page.</p>
                </div>
                {messages.length > 0 && <button className="add-company-button" type="button" onClick={startNewResearch}>New session</button>}
              </header>
              {messages.length ? (
                <div className="history-list">
                  {[...messages].reverse().map((message, index) => (
                    <button
                      className="history-item"
                      id={`history-${message.id}`}
                      key={message.id}
                      type="button"
                      onClick={() => {
                        setActiveSection('research')
                        window.setTimeout(() => document.getElementById(`thread-${message.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 0)
                      }}
                    >
                      <span className="history-index">{String(messages.length - index).padStart(2, '0')}</span>
                      <span className="history-copy">
                        <strong>{message.question}</strong>
                        <span>{message.response?.correlation_id ? `Correlation ${message.response.correlation_id}` : message.failed ? 'Request failed' : message.response ? 'Response received' : 'Response pending'}</span>
                      </span>
                      <time dateTime={message.createdAt}>{new Date(message.createdAt).toLocaleString()}</time>
                      <span className="source-chevron" aria-hidden="true">›</span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="library-empty-state">
                  <span className="empty-symbol" aria-hidden="true">◷</span>
                  <h2>No research history yet</h2>
                  <p>Questions and their responses will appear here for this browser session.</p>
                  <button className="add-company-button" type="button" onClick={() => setActiveSection('research')}>Start researching</button>
                </div>
              )}
            </section>
          ) : (
          <div className="research-panels">
            <section className="conversation-pane" aria-label="Research conversation">
              <div className="conversation-scroll">
                {messages.length === 0 && !loading && (
                  <div className="welcome-state">
                    <div className="welcome-emblem"><BrandSymbol idPrefix="welcome" /></div>
                    <h2>What would you like<br />to understand?</h2>
                    <p>Ask about company disclosures or financial concepts. Responses are grounded in retrieved sources and deterministic tools.</p>
                    <div className="suggestions-label">SUGGESTED INQUIRIES</div>
                    <div className="suggested-questions">
                      {suggestedQuestions.map((suggestion) => (
                        <button key={suggestion} type="button" onClick={() => chooseSuggestedQuestion(suggestion)}>
                          <span>{suggestion}</span><span className="suggestion-arrow" aria-hidden="true">↗</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {messages.map((message) => (
                  <article className="conversation-turn" id={`thread-${message.id}`} key={message.id}>
                    <div className="user-message">
                      <div className="message-meta"><span>RESEARCH INQUIRY</span><span>YOU</span></div>
                      <p>{message.question}</p>
                    </div>
                    {message.response && (
                      <div className={`assistant-message ${message.response.refused ? 'refused' : ''}`}>
                        <div className="assistant-message-heading">
                          <div className="assistant-label"><span className="assistant-mark">✦</span><span>{message.response.refused ? 'RESEARCH BOUNDARY' : 'ARIA FINDINGS'}</span></div>
                          {message.response.refused ? (
                            <span className="boundary-badge">Boundary notice</span>
                          ) : message.response.citations?.length > 0 ? (
                            <span className="citation-count">{message.response.citations.length} {message.response.citations.length === 1 ? 'source' : 'sources'}</span>
                          ) : null}
                        </div>
                        {message.response.refusal_reason && <p className="refusal-reason">{message.response.refusal_reason}</p>}
                        <p className="assistant-answer">{message.response.answer}</p>
                        {message.response.warnings?.length > 0 && (
                          <div className="response-warnings" role="status">
                            {message.response.warnings.map((warning, index) => <p key={`${warning}-${index}`}>{warning}</p>)}
                          </div>
                        )}
                        {message.response.citations?.length > 0 && (
                          <div className="inline-citations">
                            <div className="inline-citations-heading">
                              <span className="overline">PRIMARY SOURCES</span>
                              <button type="button" onClick={() => setActiveTab('sources')}>Open source drawer ↗</button>
                            </div>
                            <div className="citation-chips">
                              {message.response.citations.map((citation, index) => {
                                const citationId = `${message.id}-${index}`
                                return (
                                  <button
                                    className={selectedCitation === citationId ? 'citation-chip active' : 'citation-chip'}
                                    key={citationId}
                                    type="button"
                                    onClick={() => {
                                      setSelectedCitation(citationId)
                                      setActiveTab('sources')
                                    }}
                                    aria-label={`Open citation ${index + 1}: ${citation.document}, ${citation.locator}`}
                                  >
                                    <span>[{index + 1}]</span>{citation.document}
                                  </button>
                                )
                              })}
                            </div>
                          </div>
                        )}
                        {message.response.tool_outputs?.length > 0 && (
                          <button className="tools-summary" type="button" onClick={() => setActiveTab('tools')}>
                            <Icon name="tools">⌘</Icon>
                            {message.response.tool_outputs.length} tool {message.response.tool_outputs.length === 1 ? 'output' : 'outputs'} recorded
                            <span>Inspect activity ↗</span>
                          </button>
                        )}
                        <div className="response-metadata">
                          {message.response.correlation_id && <span>Correlation <code>{message.response.correlation_id}</code></span>}
                          {Number.isFinite(message.response.latency_ms) && <span>{message.response.latency_ms} ms</span>}
                          {Number.isFinite(message.response.token_usage) && <span>{message.response.token_usage} tokens</span>}
                        </div>
                      </div>
                    )}
                  </article>
                ))}

                {loading && (
                  <div className="loading-message" role="status">
                    <span className="loading-spinner" aria-hidden="true" />
                    <div><strong>Retrieving and reviewing sources</strong><span>Waiting for the validated research response.</span></div>
                  </div>
                )}
                {error && (
                  <div className="request-error" role="alert">
                    <span aria-hidden="true">!</span>
                    <div><strong>Request could not be completed</strong><p>{error}</p></div>
                  </div>
                )}
                <div ref={threadEndRef} />
              </div>

              <EvidenceTabs
                messages={messages}
                activeTab={activeTab}
                setActiveTab={setActiveTab}
              />

              <form className="composer" onSubmit={ask}>
                <label className="sr-only" htmlFor="research-composer">Ask a research question</label>
                <textarea
                  id="research-composer"
                  ref={composerRef}
                  value={question}
                  onChange={(event) => setQuestion(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.shiftKey) {
                      event.preventDefault()
                      ask(event)
                    }
                  }}
                  placeholder="Ask a follow-up question about a filing or financial concept…"
                  rows="2"
                  disabled={loading}
                />
                <div className="composer-footer">
                  <span><span className="composer-shield" aria-hidden="true">◇</span> Answers are research-only and source-grounded.</span>
                  <div className="composer-actions">
                    <span className="keyboard-hint">SHIFT + ENTER FOR NEW LINE</span>
                    <button className="send-button" type="submit" disabled={loading || !(question || command).trim()}>
                      <span>{loading ? 'Working' : 'Ask ARIA'}</span><span aria-hidden="true">↗</span>
                    </button>
                  </div>
                </div>
              </form>
            </section>

            <Inspector
              messages={messages}
              activeTab={activeTab}
              setActiveTab={setActiveTab}
              selectedCitation={selectedCitation}
              setSelectedCitation={setSelectedCitation}
            />
          </div>
          )}
        </main>
      </div>

      {settingsOpen && (
        <div className="settings-backdrop" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setSettingsOpen(false)
        }}>
          <section className="settings-dialog" role="dialog" aria-modal="true" aria-labelledby="settings-title">
            <header className="settings-dialog-header">
              <div>
                <span className="settings-eyebrow">ARIA WORKSPACE</span>
                <h2 id="settings-title">Settings</h2>
              </div>
              <button className="settings-close" type="button" onClick={() => setSettingsOpen(false)} aria-label="Close settings">×</button>
            </header>

            <section className="settings-section">
              <div className="settings-section-heading">
                <h3>Account</h3>
                <span className="account-status"><span />No account connected</span>
              </div>
              <p className="settings-description">This API does not have sign-in or account endpoints configured. Research remains available without an account.</p>
              <div className="account-actions">
                <button type="button" onClick={() => showAuthenticationNotice('Sign in')}>Sign in</button>
                <button type="button" disabled title="No authenticated account is connected">Sign out</button>
              </div>
              <p className="auth-note">Sign-in and sign-out require backend authentication before they can manage an account.</p>
            </section>

            <section className="settings-section">
              <div className="settings-section-heading">
                <h3>Connection</h3>
                <StatusPill health={health} />
              </div>
              <dl className="settings-details">
                <div><dt>Request mode</dt><dd>{mockMode ? 'Mock mode' : 'ARIA API'}</dd></div>
                <div><dt>Frontend session ID</dt><dd><code>{sessionId}</code></dd></div>
              </dl>
              <p className="auth-note">The frontend session ID is stored in this browser and is not sent to the backend. Each API response provides its own correlation ID.</p>
            </section>

            <section className="settings-section">
              <div className="settings-section-heading">
                <h3>Appearance</h3>
                <span className="settings-current-value">{theme === 'dark' ? 'Dark' : 'Light'}</span>
              </div>
              <div className="theme-switch" role="group" aria-label="Color theme">
                <button className={theme === 'light' ? 'active' : ''} type="button" aria-pressed={theme === 'light'} onClick={() => setTheme('light')}>
                  <span aria-hidden="true">☼</span> Light
                </button>
                <button className={theme === 'dark' ? 'active' : ''} type="button" aria-pressed={theme === 'dark'} onClick={() => setTheme('dark')}>
                  <span aria-hidden="true">☾</span> Dark
                </button>
              </div>
            </section>

            <section className="settings-section">
              <div className="settings-section-heading">
                <h3>Privacy</h3>
                <span className="privacy-label">Research session</span>
              </div>
              <p className="settings-description">Questions are sent to the configured ARIA API unless mock mode is enabled. This app currently has no user login.</p>
              <button className="privacy-policy-button" type="button" onClick={() => setPrivacyOpen((open) => !open)}>
                <span><strong>Privacy policy</strong><small>What this app stores and sends</small></span>
                <span aria-hidden="true">{privacyOpen ? '−' : '›'}</span>
              </button>
              {privacyOpen && (
                <div className="privacy-policy-copy">
                  <p><strong>Questions and responses.</strong> Submitted questions are sent to the configured ARIA API unless mock mode is enabled. The current backend creates a MySQL session record containing a correlation ID and token-usage counter; it does not currently store question or response text in that model. History remains in page memory and is not saved.</p>
                  <p><strong>Followed companies and theme.</strong> These preferences are stored in this browser’s local storage and are not sent to the API by this interface.</p>
                  <p><strong>Accounts and third parties.</strong> Authentication and a fundamentals-data provider are not configured. Do not enter sensitive or personal financial information.</p>
                </div>
              )}
            </section>

            {settingsNotice && <p className="settings-notice" role="status">{settingsNotice}</p>}
            <footer className="settings-dialog-footer">
              <span>Research-only workspace</span>
              <button className="settings-done" type="button" onClick={() => setSettingsOpen(false)}>Done</button>
            </footer>
          </section>
        </div>
>>>>>>> origin/main
      )}
    </div>
  )
}