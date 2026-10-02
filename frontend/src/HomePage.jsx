import { useEffect, useState } from 'react'
import { documentUrl, getComparisonData, getMarketMovers } from './api/client.js'
import { ApiStatusDot, CompanyLogo, ThemeToggle } from './shared/ARIAUI.jsx'
import CompanyComparisonView from './features/companies/CompanyComparisonView.jsx'
import {
    companies,
    documentsByTicker,
    fiscalYearToReportingPeriod,
    metricDefinitions,
    reportingPeriodSortValue,
    toFiscalYear,
} from './features/companies/companyData.js'

function CompanyNavigationPanel({ onClose, onNavigate }) {
    return (
        <div className="home-navigation-overlay">
            <button className="home-navigation-backdrop" type="button" onClick={onClose} aria-label="Close navigation" />
            <aside className="home-navigation-panel" aria-label="Main navigation">
                <div className="home-navigation-heading">
                    <strong>ARIA</strong>
                    <button className="home-navigation-close" type="button" onClick={onClose} aria-label="Close navigation">×</button>
                </div>
                <div className="home-navigation-label">WORKSPACE</div>
                <nav className="home-navigation-links" aria-label="Workspace">
                    {[
                        ['home', '⌂', 'Home'],
                        ['research', '▤', 'Research'],
                        ['history', '◷', 'History'],
                        ['library', '▧', 'Library'],
                        ['settings', '⚙', 'Settings'],
                    ].map(([destination, icon, label]) => (
                        <button
                            className="home-navigation-item"
                            key={destination}
                            type="button"
                            onClick={() => onNavigate(destination)}
                        >
                            <span aria-hidden="true">{icon}</span>
                            {label}
                        </button>
                    ))}
                </nav>
            </aside>
        </div>
    )
}

function TrendLine({ direction }) {
    return (
        <svg
            className={`company-trend ${direction}`}
            viewBox="0 0 80 30"
            aria-hidden="true"
        >
            <polyline
                points={
                    direction === 'down'
                        ? '2,10 14,5 27,12 39,9 51,17 63,14 76,22'
                        : '2,18 14,14 27,19 39,10 51,15 63,8 76,12'
                }
            />
        </svg>
    )
}

function SourceStatus({ quote }) {
    const available = quote?.found && quote.price !== null && quote.price !== undefined
    return (
        <span
            className={`company-source-status ${available ? 'available' : 'unavailable'}`}
            title={available ? `${quote.source} · Trade date ${quote.trade_date}` : 'No stored quote data available'}
        >
            <span className="company-source-status-dot" aria-hidden="true" />
        </span>
    )
}

export default function HomePage({
    apiHealth,
    onCompanySelect,
    onToggleFollow,
    followedCompanies,
    savedReports,
    onToggleSaveReport,
    onNavigate,
    theme,
    onToggleTheme,
}) {
    
    const [search, setSearch] = useState('')
    const [selectedCompany, setSelectedCompany] = useState(null)
    const [activeCompanyTab, setActiveCompanyTab] = useState('overview')
    const [reportingPeriod, setReportingPeriod] = useState('')
    const [fundamentals, setFundamentals] = useState([])
    const [marketMovers, setMarketMovers] = useState([])
    const [menuOpen, setMenuOpen] = useState(false)
    const [navigationOpen, setNavigationOpen] = useState(false)

    useEffect(() => {
        if (!menuOpen && !navigationOpen) return undefined
        function closeOnEscape(event) {
            if (event.key === 'Escape') {
                setMenuOpen(false)
                setNavigationOpen(false)
            }
        }
        window.addEventListener('keydown', closeOnEscape)
        return () => window.removeEventListener('keydown', closeOnEscape)
    }, [menuOpen, navigationOpen])

    useEffect(() => {
        let cancelled = false
        getComparisonData()
            .then((data) => {
                if (!cancelled) {
                    const records = Array.isArray(data.records) ? data.records : []
                    setFundamentals(records)
                }
            })
            .catch(() => {
                if (!cancelled) setFundamentals([])
            })
        return () => {
            cancelled = true
        }
    }, [])

    useEffect(() => {
        let cancelled = false
        getMarketMovers()
            .then((data) => {
                if (!cancelled) setMarketMovers(Array.isArray(data.movers) ? data.movers : [])
            })
            .catch(() => {
                if (!cancelled) setMarketMovers([])
            })
        return () => {
            cancelled = true
        }
    }, [])

    function navigateFromMenu(destination) {
        setMenuOpen(false)
        setNavigationOpen(false)
        if (destination === 'home') {
            backToSearch()
            return
        }
        onNavigate(destination)
    }

    function NavigationMenu() {
        return (
            <div className="home-menu-wrap">
                <button
                    className="home-menu-button"
                    type="button"
                    aria-label="Open navigation menu"
                    aria-expanded={menuOpen}
                    aria-haspopup="menu"
                    onClick={() => setMenuOpen((open) => !open)}
                >
                    <span></span>
                    <span></span>
                    <span></span>
                </button>
                {menuOpen && (
                    <nav className="home-menu-panel" aria-label="Main navigation" role="menu">
                        {[
                            ['home', 'Find a company'],
                            ['research', 'Research'],
                            ['history', 'History'],
                            ['library', 'Followed companies'],
                            ['settings', 'Settings'],
                        ].map(([destination, label]) => (
                            <button
                                key={destination}
                                type="button"
                                role="menuitem"
                                onClick={() => navigateFromMenu(destination)}
                            >
                                {label}
                            </button>
                        ))}
                    </nav>
                )}
            </div>
        )}

    const filteredCompanies = companies.filter((company) =>
        `${company.name} ${company.ticker}`
            .toLowerCase()
            .includes(search.toLowerCase())
    )
    const quoteByTicker = new Map(marketMovers.map((quote) => [quote.ticker, quote]))
    const latestDocuments = Object.entries(documentsByTicker)
        .flatMap(([ticker, documents]) => documents.map((document) => ({ ticker, ...document })))
        .sort((left, right) => right.timestamp.localeCompare(left.timestamp))
        .slice(0, 3)

    function selectCompany(company) {
        const documents = documentsByTicker[company.ticker] || []
        const documentPeriods = documents.map((document) => document.period)
        const dataPeriods = fundamentals
            .filter((record) => record.ticker === company.ticker)
            .map((record) => fiscalYearToReportingPeriod(record.fiscal_year))
        const periods = [...new Set([...documentPeriods, ...dataPeriods])]
            .sort((left, right) => reportingPeriodSortValue(right) - reportingPeriodSortValue(left))
        setSelectedCompany(company)
        setActiveCompanyTab('overview')
        setReportingPeriod(periods[0] || 'FY26')
    }

    function backToSearch() {
        setSelectedCompany(null)
        setActiveCompanyTab('overview')
    }

    function navigate(destination) {
        setMenuOpen(false)
        setNavigationOpen(false)
        if (destination === 'home') {
            setSelectedCompany(null)
            setActiveCompanyTab('overview')
            return
        }
        onNavigate(destination)
    }

    if (selectedCompany) {
        const companyDocuments = documentsByTicker[selectedCompany.ticker] || []
        const followed = followedCompanies.some((company) => company.ticker === selectedCompany.ticker)
        const fiscalYear = toFiscalYear(reportingPeriod)
        const fundamental = fundamentals.find((record) => (
            record.ticker === selectedCompany.ticker && record.fiscal_year === fiscalYear
        ))
        const visibleDocuments = activeCompanyTab === 'annual'
            ? companyDocuments.filter((document) => document.kind === 'annual')
            : activeCompanyTab === 'earnings'
                ? companyDocuments.filter((document) => document.kind === 'earnings')
                : companyDocuments
        const availablePeriods = [...new Set([
            ...companyDocuments.map((document) => document.period),
            ...fundamentals
                .filter((record) => record.ticker === selectedCompany.ticker)
                .map((record) => fiscalYearToReportingPeriod(record.fiscal_year)),
        ])].sort((left, right) => reportingPeriodSortValue(right) - reportingPeriodSortValue(left))

        return (
            <main className={`home-page theme-${theme}`}>
                <header className="home-nav">
                    <button className="company-back-icon" type="button" onClick={backToSearch} aria-label="Back to company search" title="Back to company search">←</button>
                    <button className="home-menu-button" type="button" onClick={() => setNavigationOpen(true)} aria-label="Open navigation" aria-expanded={navigationOpen}>
                        <span></span><span></span><span></span>
                    </button>
                    <div className="home-nav-title">Company overview</div>
                    <ThemeToggle theme={theme} onToggle={onToggleTheme} />
                    <ApiStatusDot className="home-api-status" health={apiHealth} />
                </header>

                <section className="company-detail" aria-labelledby="company-detail-name">
                    <div className="company-detail-heading">
                        <CompanyLogo company={selectedCompany} detail />
                        <div className="company-detail-identity">
                            <h1 id="company-detail-name">{selectedCompany.name}</h1>
                            <p>NSE: {selectedCompany.ticker}</p>
                        </div>
                        <button
                            className={followed ? 'company-follow-button followed' : 'company-follow-button'}
                            type="button"
                            aria-pressed={followed}
                            onClick={() => onToggleFollow(selectedCompany)}
                        >
                            {followed ? 'Following' : 'Follow'}
                        </button>
                    </div>

                    <nav className="company-detail-tabs" aria-label="Company information">
                        {[
                            ['overview', 'Overview'],
                            ['annual', 'Annual Reports'],
                            ['earnings', 'Earnings Calls'],
                            ['compare', 'Compare'],
                        ].map(([tab, label]) => (
                            <button
                                key={tab}
                                className={activeCompanyTab === tab ? 'company-detail-tab active' : 'company-detail-tab'}
                                type="button"
                                aria-current={activeCompanyTab === tab ? 'page' : undefined}
                                onClick={() => setActiveCompanyTab(tab)}
                            >
                                {label}
                            </button>
                        ))}
                    </nav>

                    {activeCompanyTab === 'compare' ? (
                        <CompanyComparisonView selectedCompany={selectedCompany} companies={companies} />
                    ) : (
                        <>
                            <div className="company-period-row">
                                <label htmlFor="reporting-period">Reporting period</label>
                                <select
                                    id="reporting-period"
                                    value={reportingPeriod}
                                    onChange={(event) => setReportingPeriod(event.target.value)}
                                    disabled={!availablePeriods.length}
                                >
                                    {availablePeriods.length ? (
                                        availablePeriods.map((period, index) => (
                                            <option key={period} value={period}>{period}{index === 0 ? ' (Latest available)' : ''}</option>
                                        ))
                                    ) : <option value="">Unavailable</option>}
                                </select>
                            </div>

                            <div className="company-metrics" aria-label={`Financial metrics for ${reportingPeriod || 'selected period'}`}>
                                {metricDefinitions.map((metric) => {
                                    const value = fundamental?.[metric.field]
                                    const hasValue = value !== null && value !== undefined && Number.isFinite(Number(value))
                                    return (
                                    <article className="company-metric" key={metric}>
                                        <h2>{metric.label}</h2>
                                        <strong>{hasValue ? metric.format(Number(value)) : 'Unavailable'}</strong>
                                        <span>
                                            {hasValue
                                                ? `Source: ${fundamental.source} · As of ${fundamental.as_of_date}`
                                                : `No verified metric summary for ${reportingPeriod || 'this company'}`}
                                        </span>
                                    </article>
                                    )
                                })}
                            </div>
                            <p className="company-metric-note">Use a cited filing or ask ARIA to retrieve the reported value. No unsourced figures are shown here.</p>

                            <section className="company-documents" aria-labelledby="available-documents-heading">
                                <div className="company-documents-heading">
                                    <h2 id="available-documents-heading">
                                        {activeCompanyTab === 'annual' ? 'Annual Reports' : activeCompanyTab === 'earnings' ? 'Earnings Calls' : 'Available Documents'}
                                    </h2>
                                    <span>{visibleDocuments.length}</span>
                                </div>
                                {visibleDocuments.length ? (
                                    <div className="company-document-list">
                                        {visibleDocuments.map((document) => (
                                            <article className="company-document-row" key={document.filename}>
                                                <a
                                                    className="company-document-link"
                                                    href={documentUrl(document.filename)}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                >
                                                    <span className="company-document-icon" aria-hidden="true">▤</span>
                                                    <span className="company-document-copy">
                                                        <strong>{document.title}</strong>
                                                        <span>{document.type} · {document.pages} pages · Filed {new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(new Date(document.timestamp))}</span>
                                                    </span>
                                                    <span className="company-document-arrow" aria-hidden="true">›</span>
                                                </a>
                                                <button
                                                    className="company-document-save"
                                                    type="button"
                                                    aria-pressed={savedReports.some((report) => report.filename === document.filename)}
                                                    onClick={() => onToggleSaveReport(selectedCompany, document)}
                                                >
                                                    {savedReports.some((report) => report.filename === document.filename) ? 'Saved' : 'Save'}
                                                </button>
                                            </article>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="company-documents-empty">
                                        No indexed {activeCompanyTab === 'annual' ? 'annual reports' : activeCompanyTab === 'earnings' ? 'earnings calls' : 'documents'} are available for this company yet.
                                    </div>
                                )}
                            </section>

                            <button className="company-ask-button" type="button" onClick={() => onCompanySelect(selectedCompany)}>
                                Ask AI about this company <span aria-hidden="true">→</span>
                            </button>
                        </>
                    )}
                </section>
                {navigationOpen && <CompanyNavigationPanel onClose={() => setNavigationOpen(false)} onNavigate={navigate} />}
            </main>
        )
    }

    return (
        <main className={`home-page theme-${theme}`}>

            <header className="home-nav">
                <NavigationMenu />

                <div className="home-nav-title">ARIA</div>

                <ThemeToggle theme={theme} onToggle={onToggleTheme} />
                <ApiStatusDot className="home-api-status" health={apiHealth} />
            </header>

            <section className="home-content">

                <h1 className="visually-hidden">Find a Company</h1>

                <div className="home-search-box">
                    <input
                        type="text"
                        aria-label="Search companies by name or ticker"
                        placeholder="Find a Company"
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                    />
                </div>

                <div className="popular-section">
                    <span className="popular-label">Popular companies</span>

                    <div className="company-chips">
                        {companies.map((company) => (
                            <button
                                key={company.ticker}
                                type="button"
                                className="company-chip"
                                onClick={() => selectCompany(company)}
                            >
                                {company.name}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="company-list">
                    {filteredCompanies.map((company) => (
                        <button
                            key={company.ticker}
                            type="button"
                            className="company-card"
                            onClick={() => selectCompany(company)}
                        >
                            <div className="company-info">

                                <CompanyLogo company={company} />

                                <div className="company-details">
                                    <div className="company-name">
                                        {company.name}
                                    </div>

                                    <div className="company-ticker">
                                        NSE: {company.ticker}
                                    </div>
                                </div>

                            </div>

                            <div className="company-card-right">
                                <SourceStatus quote={quoteByTicker.get(company.ticker)} />
                                <span className="company-arrow">›</span>
                            </div>
                        </button>
                    ))}

                    {filteredCompanies.length === 0 && (
                        <div className="no-company-results">
                            No company found
                        </div>
                    )}
                </div>

                <section className="research-snapshot" aria-labelledby="research-snapshot-heading">
                    <div className="research-snapshot-heading">
                        <div>
                            <span className="popular-label">SOURCE-BACKED OVERVIEW</span>
                            <h2 id="research-snapshot-heading">Research snapshot</h2>
                        </div>
                        <span className="research-snapshot-status">
                            {marketMovers.length ? 'Stored data available' : 'Waiting for stored data'}
                        </span>
                    </div>

                    <div className="research-snapshot-grid">
                        <section className="snapshot-panel snapshot-market" aria-labelledby="snapshot-market-heading">
                            <div className="snapshot-panel-heading">
                                <h3 id="snapshot-market-heading">Market snapshot</h3>
                                <span>NSE closing data</span>
                            </div>
                            <div className="snapshot-market-list">
                                {companies.slice(0, 4).map((company) => {
                                    const quote = quoteByTicker.get(company.ticker)
                                    const hasPrice = quote?.found && quote.price !== null && quote.price !== undefined
                                    return (
                                        <div className="snapshot-market-row" key={company.ticker}>
                                            <span>{company.ticker}</span>
                                            <strong>{hasPrice ? `₹${Number(quote.price).toLocaleString('en-IN', { maximumFractionDigits: 2 })}` : 'Unavailable'}</strong>
                                            <em className={quote?.change_pct < 0 ? 'negative' : 'positive'}>
                                                {hasPrice && quote.change_pct !== null ? `${Number(quote.change_pct) >= 0 ? '+' : ''}${quote.change_pct}%` : '—'}
                                            </em>
                                        </div>
                                    )
                                })}
                            </div>
                            <p className="snapshot-footnote">
                                {marketMovers[0]?.trade_date
                                    ? `Trade date ${marketMovers[0].trade_date} · Historical/stale, not live.`
                                    : 'No stored quote data is currently available.'}
                            </p>
                        </section>

                        <section className="snapshot-panel snapshot-documents" aria-labelledby="snapshot-documents-heading">
                            <div className="snapshot-panel-heading">
                                <h3 id="snapshot-documents-heading">Recent indexed sources</h3>
                                <span>{latestDocuments.length} shown</span>
                            </div>
                            {latestDocuments.length ? (
                                <div className="snapshot-document-list">
                                    {latestDocuments.map((document) => (
                                        <a className="snapshot-document-row" key={document.filename} href={documentUrl(document.filename)} target="_blank" rel="noreferrer">
                                            <span className="snapshot-document-kind">{document.kind === 'earnings' ? 'CALL' : 'FILING'}</span>
                                            <span>
                                                <strong>{document.title}</strong>
                                                <small>{document.ticker} · {document.type}</small>
                                            </span>
                                            <span aria-hidden="true">→</span>
                                        </a>
                                    ))}
                                </div>
                            ) : (
                                <p className="snapshot-empty">No indexed documents are available yet.</p>
                            )}
                        </section>
                    </div>

                    <div className="snapshot-actions">
                        <button type="button" onClick={() => onNavigate('research')}>Open research workspace <span aria-hidden="true">→</span></button>
                        <button type="button" onClick={() => onNavigate('library')}>View followed companies <span aria-hidden="true">→</span></button>
                    </div>
                </section>

            </section>
            {navigationOpen && <CompanyNavigationPanel onClose={() => setNavigationOpen(false)} onNavigate={navigate} />}
        </main>
    )
}