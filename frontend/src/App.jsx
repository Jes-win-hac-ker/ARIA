import { useState } from 'react'
import ResearchWorkspace from './ResearchWorkspace.jsx'

function BrandMark() {
    return (
        <div className="auth-brand-mark">
            <svg viewBox="0 0 64 64" aria-hidden="true">
                <defs>
                    <linearGradient id="aria-main" x1="18" y1="44" x2="47" y2="13">
                        <stop offset="0" stopColor="#28623B" />
                        <stop offset="1" stopColor="#99B94B" />
                    </linearGradient>

                    <linearGradient id="aria-secondary" x1="26" y1="53" x2="48" y2="30">
                        <stop offset="0" stopColor="#92A94F" />
                        <stop offset="1" stopColor="#C0D57A" />
                    </linearGradient>
                </defs>

                <path
                    d="M8 34c11 2 22 3 30-2 8-5 13-13 18-23l6-3-2 15-4-5c-5 9-10 15-18 18-9 4-20 1-30 0Z"
                    fill="url(#aria-main)"
                />

                <path
                    d="M18 47c11 2 23-3 31-16l4-8c-4 12-12 23-23 27-7 2-14 1-20-2Z"
                    fill="url(#aria-secondary)"
                />
            </svg>
        </div>
    )
}

function LoginPage({ onLogin }) {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')

    function handleSubmit(event) {
        event.preventDefault()

        // Frontend-only login for now.
        // Real authentication can be connected to the backend later.
        onLogin()
    }

    return (
        <main className="auth-page">
            <div className="auth-card">

                <div className="auth-brand">
                    <BrandMark />
                    <div>
                        <div className="auth-logo">ARIA</div>
                        <div className="auth-tagline">
                            ASK · RETRIEVE · INTERPRET · AUGMENT
                        </div>
                    </div>
                </div>

                <div className="auth-heading">
                    <span className="auth-overline">RESEARCH WORKSPACE</span>
                    <h1>Welcome back.</h1>
                    <p>
                        Sign in to continue your source-grounded financial research.
                    </p>
                </div>

                <form className="auth-form" onSubmit={handleSubmit}>
                    <label>
                        Email address
                        <input
                            type="email"
                            placeholder="you@example.com"
                            value={email}
                            onChange={(event) => setEmail(event.target.value)}
                            required
                        />
                    </label>

                    <label>
                        Password
                        <input
                            type="password"
                            placeholder="Enter your password"
                            value={password}
                            onChange={(event) => setPassword(event.target.value)}
                            required
                        />
                    </label>

                    <div className="auth-options">
                        <label className="remember-option">
                            <input type="checkbox" />
                            <span>Remember me</span>
                        </label>

                        <button type="button" className="text-button">
                            Forgot password?
                        </button>
                    </div>

                    <button className="primary-auth-button" type="submit">
                        Sign in
                        <span>→</span>
                    </button>
                </form>

                <div className="auth-divider">
                    <span>OR</span>
                </div>

                <button
                    className="secondary-auth-button"
                    type="button"
                    onClick={onLogin}
                >
                    Continue as demo user
                </button>

                <p className="auth-footer">
                    Don't have an account? <button type="button">Request access</button>
                </p>
            </div>

            <div className="auth-side-note">
                <span>TRACEABLE RESEARCH</span>
                <p>Every fact should have a source.</p>
            </div>
        </main>
    )
}

function LandingPage({ onStart }) {
    return (
        <main className="landing-page">

            <header className="landing-nav">
                <div className="landing-brand">
                    <BrandMark />

                    <div>
                        <strong>ARIA</strong>
                        <span>ASK · RETRIEVE · INTERPRET · AUGMENT</span>
                    </div>
                </div>

            </header>

            <section className="landing-hero">

                <div className="landing-copy">
                    <span className="auth-overline">
                        FINANCIAL RESEARCH INTELLIGENCE
                    </span>

                    <h1>
                        Research with
                        <br />
                        <em>evidence.</em>
                    </h1>

                    <p>
                        ARIA helps you investigate companies, filings and financial
                        concepts through source-grounded research and traceable evidence.
                    </p>

                    <div className="landing-actions">
                        <button
                            className="landing-primary-button"
                            onClick={onStart}
                        >
                            Start researching
                            <span>→</span>
                        </button>

                    </div>
                </div>

                <div className="landing-visual">
                    <div className="ticker-preview">
                        <div className="ticker-preview-header">
                            <span>WATCHED TICKERS</span>
                            <button type="button">+ Add</button>
                        </div>

                        <div className="ticker-row">
                            <span className="ticker-symbol reliance">RIL</span>
                            <span className="ticker-name">Reliance</span>
                            <span className="ticker-price">₹2,994.20</span>
                            <span className="ticker-change">(+1.4%)</span>
                        </div>

                        <div className="ticker-row">
                            <span className="ticker-symbol apple">AAPL</span>
                            <span className="ticker-name">Apple Inc.</span>
                            <span className="ticker-price">$182.40</span>
                            <span className="ticker-change">(+0.8%)</span>
                        </div>

                        <div className="ticker-row">
                            <span className="ticker-symbol microsoft">MSFT</span>
                            <span className="ticker-name">Microsoft</span>
                            <span className="ticker-price">$415.20</span>
                            <span className="ticker-change">(+2.1%)</span>
                        </div>

                        <div className="ticker-row">
                            <span className="ticker-symbol nvidia">NVDA</span>
                            <span className="ticker-name">NVIDIA</span>
                            <span className="ticker-price">$880.00</span>
                            <span className="ticker-change">(+3.7%)</span>
                        </div>
                    </div>
                </div>

            </section>


        </main>
    )
}

export default function App() {
    const [page, setPage] = useState('login')

    if (page === 'login') {
        return (
            <LoginPage
                onLogin={() => setPage('landing')}
            />
        )
    }

    if (page === 'landing') {
        return (
            <LandingPage
                onStart={() => setPage('workspace')}
            />
        )
    }

    return <ResearchWorkspace />
}