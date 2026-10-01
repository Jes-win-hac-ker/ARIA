import { Icon } from '../../shared/ARIAUI.jsx'

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

export function EvidenceTabs({ messages, activeTab, setActiveTab, selectedCitation }) {
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
        disabled={!selectedCitation}
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

export default function EvidenceInspector({ messages, activeTab, selectedCitation, onClose }) {
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
      <div className="inspector-drawer-heading">
        <span className="overline">{activeTab === 'sources' ? 'SOURCE DOCUMENT' : 'TOOL ACTIVITY'}</span>
        <button className="inspector-close" type="button" onClick={onClose} aria-label="Close evidence drawer" title="Close evidence drawer">×</button>
      </div>
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
                    <p className="source-retrieval-time">Retrieved {selected.timestamp || 'Timestamp unavailable'}</p>
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
                      <span className="source-retrieval-time">Retrieved {citation.timestamp || 'Timestamp unavailable'}</span>
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