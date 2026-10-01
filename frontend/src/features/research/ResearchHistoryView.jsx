export default function ResearchHistoryView({ messages, onNewResearch, onOpenResearch }) {
  return (
    <section className="history-section" aria-labelledby="history-heading">
      <header className="section-page-heading">
        <div>
          <span className="overline">THIS BROWSER SESSION</span>
          <h1 id="history-heading">Research history</h1>
          <p>Questions asked during this session. History is cleared when you start a new research session or close this page.</p>
        </div>
        {messages.length > 0 && <button className="add-company-button" type="button" onClick={onNewResearch}>New session</button>}
      </header>
      {messages.length ? (
        <div className="history-list">
          {[...messages].reverse().map((message, index) => (
            <button
              className="history-item"
              id={`history-${message.id}`}
              key={message.id}
              type="button"
              onClick={() => onOpenResearch(message.id)}
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
          <button className="add-company-button" type="button" onClick={onNewResearch}>Start researching</button>
        </div>
      )}
    </section>
  )
}