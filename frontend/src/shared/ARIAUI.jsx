import { useState } from 'react'

export function Icon({ name, children }) {
  return <span className={`icon icon-${name}`} aria-hidden="true">{children}</span>
}

export function CompanyLogo({ company, detail = false, className = '' }) {
  const [failed, setFailed] = useState(false)
  const classes = [detail ? 'company-detail-logo' : 'company-initial', className].filter(Boolean).join(' ')

  return (
    <span className={classes} aria-hidden="true">
      {failed ? company.initial : (
        <img
          src={company.logo}
          alt=""
          onError={() => setFailed(true)}
        />
      )}
    </span>
  )
}

export function ApiStatusDot({ health, className = '' }) {
  const labels = {
    checking: 'API checking',
    connected: 'API connected',
    degraded: 'API degraded',
    unreachable: 'API unreachable',
  }
  const label = labels[health] || 'API status unknown'

  return (
    <span
      className={`api-status-dot status-${health} ${className}`.trim()}
      role="img"
      aria-label={label}
      title={label}
    >
      <span className="status-dot" aria-hidden="true" />
    </span>
  )
}

export function BrandSymbol({ idPrefix }) {
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

export function StatusPill({ health }) {
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

export function ThemeToggle({ theme, onToggle }) {
  const nextTheme = theme === 'dark' ? 'light' : 'dark'

  return (
    <button
      className="theme-toggle-button"
      type="button"
      onClick={onToggle}
      aria-label={`Switch to ${nextTheme} mode`}
      title={`Switch to ${nextTheme} mode`}
    >
      <span aria-hidden="true">{theme === 'dark' ? '☼' : '☾'}</span>
    </button>
  )
}