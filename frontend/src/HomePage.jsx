import { useEffect, useState } from 'react'
import { documentUrl } from './api/client.js'
import { ApiStatusDot, ThemeToggle } from './shared/ARIAUI.jsx'

const companies = [
    {
        name: 'Reliance Industries',
        ticker: 'RELIANCE',
        initial: 'R',
        logo: '/company-logos/reliance-industries.png',
        trend: 'up',
    },
    {
        name: 'TCS',
        ticker: 'TCS',
        initial: 'T',
        logo: '/company-logos/tcs.svg',
        trend: 'down',
    },
    {
        name: 'HDFC Bank',
        ticker: 'HDFCBANK',
        initial: 'H',
        logo: '/company-logos/hdfc-bank.svg',
        trend: 'up',
    },
    {
        name: 'Infosys',
        ticker: 'INFY',
        initial: 'In',
        logo: '/company-logos/infosys.svg',
        trend: 'up',
    },
    {
        name: 'ICICI Bank',
        ticker: 'ICICIBANK',
        initial: 'IC',
        logo: '/company-logos/icici-bank.svg',
        trend: 'up',
    },
]

const relianceDocuments = [
    { title: 'Audited Financial Results FY2025-26', filename: 'rag_1.pdf', kind: 'results', period: 'FY26', type: 'PDF', pages: 37, timestamp: '2026-04-24T18:00:00+05:30' },
    { title: 'Financial Results Presentation FY2025-26', filename: 'RAG_3.pdf', kind: 'results', period: 'FY26', type: 'PDF', pages: 72, timestamp: '2026-04-24T17:30:00+05:30' },
    { title: 'Earnings Call Q4 FY2025-26', filename: 'RAG_2.pdf', kind: 'earnings', period: 'FY26', type: 'Transcript', pages: 31, timestamp: '2026-04-24T20:30:00+05:30' },
    { title: 'Annual Report FY2023-24', filename: 'RIL_Annual_Report_FY24.pdf', kind: 'annual', period: 'FY24', type: 'PDF', pages: 181, timestamp: '2024-08-07T12:00:00+05:30' },
    { title: 'Earnings Call Q4 FY2023-24', filename: 'RIL_Concall_Transcript_Q4_FY24.pdf', kind: 'earnings', period: 'FY24', type: 'Transcript', pages: 23, timestamp: '2024-04-22T20:30:00+05:30' },
    { title: 'Earnings Call Q3 FY2023-24', filename: 'RIL_Concall_Transcript_Q3_FY24.pdf', kind: 'earnings', period: 'FY24', type: 'Transcript', pages: 23, timestamp: '2024-01-19T20:30:00+05:30' },
    { title: 'Annual Report FY2022-23', filename: 'RIL_Annual_Report_FY23.pdf', kind: 'annual', period: 'FY23', type: 'PDF', pages: 320, timestamp: '2023-08-05T12:00:00+05:30' },
    { title: 'Earnings Call Q4 FY2022-23', filename: 'RIL_Concall_Transcript_Q4_FY23.pdf', kind: 'earnings', period: 'FY23', type: 'Transcript', pages: 19, timestamp: '2023-04-21T20:30:00+05:30' },
]

const documentsByTicker = {
    RELIANCE: relianceDocuments,
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

function CompanyLogo({ company, detail = false }) {
    const [failed, setFailed] = useState(false)

    return (
        <span className={detail ? 'company-detail-logo' : 'company-initial'} aria-hidden="true">
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

export default function HomePage({ apiHealth, onCompanySelect, onToggleFollow, followedCompanies, theme, onToggleTheme, onNavigate }) {
    const [search, setSearch] = useState('')
    const [selectedCompany, setSelectedCompany] = useState(null)
    const [activeCompanyTab, setActiveCompanyTab] = useState('overview')
    const [reportingPeriod, setReportingPeriod] = useState('')
    const [menuOpen, setMenuOpen] = useState(false)

    useEffect(() => {
        if (!menuOpen) return undefined
        function closeOnEscape(event) {
            if (event.key === 'Escape') setMenuOpen(false)
        }
        window.addEventListener('keydown', closeOnEscape)
        return () => window.removeEventListener('keydown', closeOnEscape)
    }, [menuOpen])

    function navigateFromMenu(destination) {
        setMenuOpen(false)
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
        )
    }

    const filteredCompanies = companies.filter((company) =>
        `${company.name} ${company.ticker}`
            .toLowerCase()
            .includes(search.toLowerCase())
    )

    function selectCompany(company) {
        const documents = documentsByTicker[company.ticker] || []
        const periods = [...new Set(documents.map((document) => document.period))]
        setSelectedCompany(company)
        setActiveCompanyTab('overview')
        setReportingPeriod(periods[0] || '')
    }

    function backToSearch() {
        setSelectedCompany(null)
        setActiveCompanyTab('overview')
    }

    if (selectedCompany) {
        const companyDocuments = documentsByTicker[selectedCompany.ticker] || []
        const followed = followedCompanies.some((company) => company.ticker === selectedCompany.ticker)
        const visibleDocuments = activeCompanyTab === 'annual'
            ? companyDocuments.filter((document) => document.kind === 'annual')
            : activeCompanyTab === 'earnings'
                ? companyDocuments.filter((document) => document.kind === 'earnings')
                : companyDocuments

        return (
            <main className={`home-page theme-${theme}`}>
                <header className="home-nav">
                    <button className="company-back-icon" type="button" onClick={backToSearch} aria-label="Back to company search" title="Back to company search">←</button>
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

                    <div className="company-period-row">
                        <label htmlFor="reporting-period">Reporting period</label>
                        <select
                            id="reporting-period"
                            value={reportingPeriod}
                            onChange={(event) => setReportingPeriod(event.target.value)}
                            disabled={!companyDocuments.length}
                        >
                            {companyDocuments.length ? (
                                [...new Set(companyDocuments.map((document) => document.period))].map((period, index) => (
                                    <option key={period} value={period}>{period}{index === 0 ? ' (Latest available)' : ''}</option>
                                ))
                            ) : <option value="">Unavailable</option>}
                        </select>
                    </div>

                    <div className="company-metrics" aria-label={`Financial metrics for ${reportingPeriod || 'selected period'}`}>
                        {['Revenue', 'Net Profit', 'EPS'].map((metric) => (
                            <article className="company-metric" key={metric}>
                                <h2>{metric}</h2>
                                <strong>Unavailable</strong>
                                <span>No verified metric summary for {reportingPeriod || 'this company'}</span>
                            </article>
                        ))}
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
                                    <a
                                        className="company-document-row"
                                        href={documentUrl(document.filename)}
                                        key={document.filename}
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
                </section>
            </main>
        )
    }

    return (
        <main className={`home-page theme-${theme}`}>

            <header className="home-nav">
                <NavigationMenu />

                <div className="home-nav-title">Search</div>

                <ThemeToggle theme={theme} onToggle={onToggleTheme} />
                <ApiStatusDot className="home-api-status" health={apiHealth} />
            </header>

            <section className="home-content">

                <div className="home-heading">
                    <h1>Find a Company</h1>
                </div>

                <div className="home-search-box">
                    <input
                        type="text"
                        aria-label="Search companies by name or ticker"
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
                                <TrendLine direction={company.trend} />
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

            </section>
        </main>
    )
}