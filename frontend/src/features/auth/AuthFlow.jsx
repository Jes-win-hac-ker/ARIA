import { useState } from 'react'
import { BrandSymbol } from '../../shared/ARIAUI.jsx'

function BrandMark() {
    return (
        <span className="auth-brand-mark" aria-hidden="true">
            <BrandSymbol idPrefix="auth" />
        </span>
    )
}

export function LoginPage({ onLogin }) {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [passwordVisible, setPasswordVisible] = useState(false)
    const [notice, setNotice] = useState('')

    function handleSubmit(event) {
        event.preventDefault()
        setNotice('Authentication is not configured. Your password was not sent or saved.')
    }

    return (
        <main className="auth-page">
            <section className="auth-card" aria-labelledby="login-heading">
                <a className="auth-brand" href="/" aria-label="ARIA home">
                    <BrandMark />
                    <span>
                        <span className="auth-logo">ARIA</span>
                        <span className="auth-tagline">ASK · RETRIEVE · INTERPRET · AUGMENT</span>
                    </span>
                </a>

                <div className="auth-heading">
                    <span className="auth-overline">RESEARCH WORKSPACE</span>
                    <h1 id="login-heading">Welcome back</h1>
                    <p>Account sign-in is not configured yet. Continue as a guest to access ARIA research.</p>
                </div>

                <form className="auth-form" onSubmit={handleSubmit}>
                    <label htmlFor="login-email">
                        Email address
                        <input
                            id="login-email"
                            type="email"
                            autoComplete="username"
                            placeholder="you@example.com"
                            value={email}
                            onChange={(event) => setEmail(event.target.value)}
                            required
                        />
                    </label>

                    <label htmlFor="login-password">
                        Password
                        <span className="auth-password-field">
                            <input
                                id="login-password"
                                type={passwordVisible ? 'text' : 'password'}
                                autoComplete="current-password"
                                placeholder="Enter your password"
                                value={password}
                                onChange={(event) => setPassword(event.target.value)}
                                required
                            />
                            <button
                                className="auth-password-toggle"
                                type="button"
                                aria-label={passwordVisible ? 'Hide password' : 'Show password'}
                                aria-pressed={passwordVisible}
                                onClick={() => setPasswordVisible((visible) => !visible)}
                            >
                                {passwordVisible ? 'Hide' : 'Show'}
                            </button>
                        </span>
                    </label>

                    <div className="auth-options">
                        <label className="remember-option">
                            <input type="checkbox" />
                            <span>Remember me</span>
                        </label>
                        <button
                            className="text-button"
                            type="button"
                            onClick={() => setNotice('Password recovery is unavailable because authentication is not configured.')}
                        >
                            Forgot password?
                        </button>
                    </div>

                    {notice && <p className="auth-notice" role="status">{notice}</p>}

                    <button className="primary-auth-button" type="submit">
                        Sign in <span aria-hidden="true">→</span>
                    </button>
                </form>

                <div className="auth-divider"><span>OR</span></div>

                <button className="secondary-auth-button" type="button" onClick={onLogin}>
                    Continue as guest
                </button>

                <p className="auth-footer">Guest access does not use or save an account password.</p>
            </section>

            <div className="auth-side-note">
                <span>TRACEABLE RESEARCH</span>
                <p>Every fact should have a source.</p>
            </div>
        </main>
    )
}

export function LandingPage({ onStart }) {
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
                <span className="landing-nav-status">RESEARCH-ONLY WORKSPACE</span>
            </header>

            <section className="landing-hero">
                <div className="landing-copy">
                    <span className="auth-overline">FINANCIAL RESEARCH INTELLIGENCE</span>
                    <h1>Research with<br /><em>evidence.</em></h1>
                    <p>Investigate company disclosures and financial concepts through source-grounded research and traceable evidence.</p>
                    <div className="landing-actions">
                        <button className="landing-primary-button" type="button" onClick={onStart}>
                            Continue to research <span aria-hidden="true">→</span>
                        </button>
                    </div>
                </div>
                <div className="landing-visual">
                    <div className="research-preview">
                        <div className="preview-header">
                            <span>RESEARCH PRINCIPLES</span>
                            <span className="preview-live"><i />SOURCE-LED</span>
                        </div>
                        <div className="preview-content">
                            <div className="preview-row"><span>01</span><strong>Retrieve public disclosures</strong></div>
                            <div className="preview-row"><span>02</span><strong>Trace every factual claim</strong></div>
                            <div className="preview-row"><span>03</span><strong>Keep calculations deterministic</strong></div>
                        </div>
                    </div>
                </div>
            </section>
        </main>
    )
}
