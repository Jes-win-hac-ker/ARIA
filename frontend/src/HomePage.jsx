import { useState } from 'react'
import { ApiStatusDot, ThemeToggle } from './shared/ARIAUI.jsx'

const companies = [
    {
        name: 'Reliance Industries',
        ticker: 'RELIANCE',
        initial: 'R',
        trend: 'up',
    },
    {
        name: 'TCS',
        ticker: 'TCS',
        initial: 'T',
        trend: 'down',
    },
    {
        name: 'HDFC Bank',
        ticker: 'HDFCBANK',
        initial: 'H',
        trend: 'up',
    },
    {
        name: 'Infosys',
        ticker: 'INFY',
        initial: 'In',
        trend: 'up',
    },
    {
        name: 'ICICI Bank',
        ticker: 'ICICIBANK',
        initial: 'IC',
        trend: 'up',
    },
]

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

export default function HomePage({ apiHealth, onCompanySelect, theme, onToggleTheme }) {
    const [search, setSearch] = useState('')

    const filteredCompanies = companies.filter((company) =>
        `${company.name} ${company.ticker}`
            .toLowerCase()
            .includes(search.toLowerCase())
    )

    function selectCompany(company) {
        onCompanySelect(company)
    }

    return (
        <main className={`home-page theme-${theme}`}>

            <header className="home-nav">
                <button className="home-menu-button" type="button">
                    <span></span>
                    <span></span>
                    <span></span>
                </button>

                <div className="home-nav-title">Search</div>

                <ThemeToggle theme={theme} onToggle={onToggleTheme} />
                <ApiStatusDot className="home-api-status" health={apiHealth} />
            </header>

            <section className="home-content">

                <div className="home-heading">
                    <h1>Find a Company</h1>
                    <p>
                        Search for a company (e.g. Reliance, TCS, HDFC...)
                    </p>
                </div>

                <div className="home-search-box">
                    <input
                        type="text"
                        placeholder="Search for a company (e.g. Reliance, TCS, HDFC...)"
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

                                <div className="company-initial">
                                    {company.initial}
                                </div>

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