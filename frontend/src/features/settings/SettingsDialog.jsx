import { StatusPill } from '../../shared/ARIAUI.jsx'

export default function SettingsDialog({
  health,
  sessionId,
  mockMode,
  theme,
  setTheme,
  privacyOpen,
  setPrivacyOpen,
  settingsNotice,
  onClose,
  onShowAuthenticationNotice,
}) {
  return (
    <div className="settings-backdrop" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose()
    }}>
      <section className="settings-dialog" role="dialog" aria-modal="true" aria-labelledby="settings-title">
        <header className="settings-dialog-header">
          <div>
            <span className="settings-eyebrow">ARIA WORKSPACE</span>
            <h2 id="settings-title">Settings</h2>
          </div>
          <button className="settings-close" type="button" onClick={onClose} aria-label="Close settings">×</button>
        </header>

        <section className="settings-section">
          <div className="settings-section-heading">
            <h3>Account</h3>
            <span className="account-status"><span />No account connected</span>
          </div>
          <p className="settings-description">This API does not have sign-in or account endpoints configured. Research remains available without an account.</p>
          <div className="account-actions">
            <button type="button" onClick={() => onShowAuthenticationNotice('Sign in')}>Sign in</button>
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
              <p><strong>Saved reports, followed companies, and theme.</strong> Saved report names, corpus filenames, and save dates, followed company names, tickers, and follow dates, and the theme preference are stored in this browser’s local storage. Question history remains in page memory and is not saved. These saved-item details are not sent to the API by this interface.</p>
              <p><strong>Accounts and third parties.</strong> Authentication and a fundamentals-data provider are not configured. Do not enter sensitive or personal financial information.</p>
            </div>
          )}
        </section>

        {settingsNotice && <p className="settings-notice" role="status">{settingsNotice}</p>}
        <footer className="settings-dialog-footer">
          <span>Research-only workspace</span>
          <button className="settings-done" type="button" onClick={onClose}>Done</button>
        </footer>
      </section>
    </div>
  )
}