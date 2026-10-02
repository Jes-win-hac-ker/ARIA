import { BrandSymbol, Icon } from '../../shared/ARIAUI.jsx'
import EvidenceInspector, { EvidenceTabs } from '../evidence/EvidenceInspector.jsx'

const suggestedQuestions = [
  'What risks did management highlight in the latest earnings call?',
  'Summarize the company’s recent capital allocation commentary.',
  'What does debt-to-equity measure?',
]

export default function ResearchWorkspace({
  messages,
  loading,
  error,
  question,
  setQuestion,
  command,
  ask,
  chooseSuggestedQuestion,
  composerRef,
  threadEndRef,
  activeTab,
  setActiveTab,
  selectedCitation,
  setSelectedCitation,
}) {
  return (
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
                      </div>
                      <div className="citation-chips">
                        {message.response.citations.map((citation, index) => {
                          const citationId = `${message.id}-${index}`
                          return (
                            <button
                              className={selectedCitation === citationId ? 'citation-chip active' : 'citation-chip'}
                              key={citationId}
                              type="button"
                              aria-expanded={selectedCitation === citationId && activeTab === 'sources'}
                              onClick={() => {
                                setSelectedCitation((current) => current === citationId && activeTab === 'sources' ? null : citationId)
                                setActiveTab('sources')
                              }}
                              aria-label={`Open citation ${index + 1}: ${citation.document}, ${citation.locator}, retrieved ${citation.timestamp || 'timestamp unavailable'}`}
                            >
                              <span className="citation-chip-index">[{index + 1}]</span>
                              <span className="citation-chip-document">{citation.document}</span>
                              <span className="citation-chip-meta">
                                {citation.locator || 'Location unavailable'} · Retrieved {citation.timestamp || 'Timestamp unavailable'}
                              </span>
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
              <div className="loading-copy">
                <strong>Retrieving and reviewing sources</strong>
                <span>ARIA is searching permitted filings and validating the response.</span>
                <span className="loading-activity" aria-hidden="true"><span /></span>
              </div>
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

        <EvidenceTabs messages={messages} activeTab={activeTab} setActiveTab={setActiveTab} selectedCitation={selectedCitation} />

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

      {(activeTab === 'tools' || (activeTab === 'sources' && selectedCitation)) && (
        <EvidenceInspector
          messages={messages}
          activeTab={activeTab}
          selectedCitation={selectedCitation}
          onClose={() => {
            setSelectedCitation(null)
            setActiveTab('sources')
          }}
        />
      )}
    </div>
  )
}