import { useState } from 'react'
import { documentUrl } from '../../api/client.js'

function formatHistoryTime(value) {
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return 'Time unavailable'

  const time = new Intl.DateTimeFormat('en-IN', { hour: 'numeric', minute: '2-digit' }).format(date)
  const today = new Date()
  if (date.toDateString() === today.toDateString()) return `Today · ${time}`

  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  if (date.toDateString() === yesterday.toDateString()) return `Yesterday · ${time}`

  const day = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }).format(date)
  return `${day} · ${time}`
}

export default function ResearchHistoryView({
  messages,
  followedCompanies,
  savedReports,
  onNewResearch,
  onOpenResearch,
  onResearchCompany,
  onRemoveFollowedCompany,
  onRemoveSavedReport,
}) {
  const [activeSection, setActiveSection] = useState('recent')
  const recentMessages = [...messages].reverse()
  const savedItems = [
    ...savedReports.map((report) => ({ type: 'report', key: report.filename, savedAt: report.savedAt, report })),
    ...followedCompanies.map((company) => ({ type: 'company', key: company.ticker, savedAt: company.followedAt || '', company })),
  ].sort((left, right) => {
    const leftTime = Date.parse(left.savedAt) || 0
    const rightTime = Date.parse(right.savedAt) || 0
    return rightTime - leftTime
  })

  return (
    <section className="history-section" aria-labelledby="history-heading">
      <header className="section-page-heading">
        <div>
          <span className="overline">RESEARCH WORKSPACE</span>
          <h1 id="history-heading">Research history</h1>
        </div>
        {activeSection === 'recent' && messages.length > 0 && (
          <button className="add-company-button" type="button" onClick={onNewResearch}>New session</button>
        )}
      </header>

      <div className="history-segments" role="tablist" aria-label="History sections">
        <button className={activeSection === 'recent' ? 'active' : ''} type="button" role="tab" aria-selected={activeSection === 'recent'} onClick={() => setActiveSection('recent')}>
          Recent <span>{messages.length}</span>
        </button>
        <button className={activeSection === 'saved' ? 'active' : ''} type="button" role="tab" aria-selected={activeSection === 'saved'} onClick={() => setActiveSection('saved')}>
          Saved <span>{savedReports.length + followedCompanies.length}</span>
        </button>
      </div>

      {activeSection === 'recent' ? (
        recentMessages.length ? (
          <div className="history-list">
            {recentMessages.map((message) => (
              <button
                className="history-item"
                id={`history-${message.id}`}
                key={message.id}
                type="button"
                onClick={() => onOpenResearch(message.id)}
              >
                <span className="history-company-mark" aria-hidden="true">{message.company?.initial || '◉'}</span>
                <span className="history-copy">
                  <span className="history-company-name">{message.company?.name || 'Research inquiry'}</span>
                  <strong>{message.question}</strong>
                  <time dateTime={message.createdAt}>{formatHistoryTime(message.createdAt)}</time>
                </span>
                <span className="source-chevron" aria-hidden="true">›</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="library-empty-state">
            <span className="empty-symbol" aria-hidden="true">◷</span>
            <h2>No recent research</h2>
            <p>Questions from this session will appear here.</p>
            <button className="add-company-button" type="button" onClick={onNewResearch}>Start researching</button>
          </div>
        )
      ) : (
        savedItems.length ? (
          <div className="history-list saved-items-list">
            {savedItems.map((item) => item.type === 'report' ? (
              <article className="saved-report-item" key={`report-${item.key}`}>
                <a className="saved-report-link" href={documentUrl(item.report.filename)} target="_blank" rel="noreferrer">
                  <span className="saved-report-icon" aria-hidden="true">▤</span>
                  <span className="history-copy">
                    <strong>{item.report.companyName} — {item.report.title}</strong>
                    <span>{item.report.type} · {item.report.pages} pages</span>
                    <time dateTime={item.report.savedAt}>Saved {formatHistoryTime(item.report.savedAt)}</time>
                  </span>
                  <span className="source-chevron" aria-hidden="true">›</span>
                </a>
                <button className="saved-report-remove" type="button" aria-label={`Remove ${item.report.title} from saved reports`} title="Remove saved report" onClick={() => onRemoveSavedReport(item.report.filename)}>⋯</button>
              </article>
            ) : (
              <article className="saved-company-item" key={`company-${item.key}`}>
                <span className="history-company-mark" aria-hidden="true">{item.company.initial || item.company.name?.[0] || '◉'}</span>
                <span className="history-copy">
                  <strong>{item.company.name}</strong>
                  <span>NSE: {item.company.ticker} · Followed in this browser</span>
                  {item.company.followedAt && <time dateTime={item.company.followedAt}>Followed {formatHistoryTime(item.company.followedAt)}</time>}
                </span>
                <button className="company-research-button" type="button" onClick={() => onResearchCompany(item.company)}>Research</button>
                <button className="saved-report-remove" type="button" aria-label={`Remove ${item.company.name} from followed companies`} title="Remove company" onClick={() => onRemoveFollowedCompany(item.company)}>×</button>
              </article>
            ))}
          </div>
        ) : (
          <div className="library-empty-state">
            <span className="empty-symbol" aria-hidden="true">▤</span>
            <h2>No saved items</h2>
            <p>Saved reports and followed companies will appear here.</p>
          </div>
        )
      )}
    </section>
  )
}