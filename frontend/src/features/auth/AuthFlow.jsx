export function LoginPage({ onLogin }) {
    return (
        <main className="auth-shell">
            <div className="auth-card">
                <span className="auth-badge">ARIA</span>
                <h1>Welcome back</h1>
                <p>
                    Research public filings, management commentary, and company context with
                    source-backed explanations.
                </p>
                <button type="button" className="primary-action" onClick={onLogin}>
                    Continue
                </button>
            </div>
        </main>
    )
}

export function LandingPage({ onStart }) {
    return (
        <main className="auth-shell">
            <div className="auth-card">
                <span className="auth-badge">Research Workspace</span>
                <h1>Ask company and market questions</h1>
                <p>
                    Search public filings, compare companies, and review evidence traces without
                    investment advice or price predictions.
                </p>
                <button type="button" className="primary-action" onClick={onStart}>
                    Start research
                </button>
            </div>
        </main>
    )
}
