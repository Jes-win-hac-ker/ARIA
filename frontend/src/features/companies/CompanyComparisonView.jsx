import { useEffect, useState } from 'react'
import { getComparisonData } from '../../api/client.js'
import { fiscalYears } from './companyData.js'

const metricGroups = {
    keyMetrics: [
        { label: 'Revenue', field: 'revenue_cr', format: 'crore' },
        { label: 'Net profit', field: 'net_profit_cr', format: 'crore' },
        { label: 'EPS', field: 'eps', format: 'rupee' },
    ],
    financials: [
        { label: 'Market capitalization', field: 'market_cap_cr', format: 'crore' },
        { label: 'Debt to equity', field: 'debt_to_equity', format: 'multiple' },
        { label: 'Return on equity', field: 'roe_pct', format: 'percent' },
        { label: 'Dividend yield', field: 'dividend_yield_pct', format: 'percent' },
    ],
    margins: [
        { label: 'Operating margin', field: 'operating_margin_pct', format: 'percent' },
    ],
}
const numberFormat = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 })

function formatMetric(value, format) {
    if (value === null || value === undefined || !Number.isFinite(Number(value))) return 'Unavailable'
    const formatted = numberFormat.format(Number(value))
    if (format === 'crore') return `₹${formatted} Cr`
    if (format === 'rupee') return `₹${formatted}`
    if (format === 'multiple') return `${formatted}×`
    return `${formatted}%`
}

function findRecord(records, ticker, fiscalYear) {
    return records.find((record) => record.ticker === ticker && record.fiscal_year === fiscalYear) || null
}

function MetricBar({ label, record, metric, scale, side, companyLabel, fiscalYear }) {
    const value = record?.[metric.field]
    const hasValue = value !== null && value !== undefined && Number.isFinite(Number(value))

    return (
        <div className="compare-metric-cell">
            <strong className="compare-cell-heading">{companyLabel} · {fiscalYear}</strong>
            <span>{formatMetric(value, metric.format)}</span>
            {hasValue && (
                <progress
                    className={`compare-bar compare-bar-${side}`}
                    value={Math.max(0, Number(value))}
                    max={scale || 1}
                    aria-label={`${label}: ${formatMetric(value, metric.format)}`}
                />
            )}
        </div>
    )
}

export default function CompanyComparisonView({ selectedCompany, companies }) {
    const [records, setRecords] = useState([])
    const [loading, setLoading] = useState(true)
    const [loadError, setLoadError] = useState('')
    const [leftTicker, setLeftTicker] = useState(selectedCompany.ticker)
    const [rightTicker, setRightTicker] = useState(
        companies.find((company) => company.ticker !== selectedCompany.ticker)?.ticker || selectedCompany.ticker,
    )
    const [leftYear, setLeftYear] = useState(fiscalYears[0])
    const [rightYear, setRightYear] = useState(fiscalYears[0])
    const [activeMetrics, setActiveMetrics] = useState('keyMetrics')
    const [hasCompared, setHasCompared] = useState(false)

    useEffect(() => {
        let cancelled = false
        getComparisonData()
            .then((data) => {
                if (!cancelled) setRecords(data.records || [])
            })
            .catch((error) => {
                if (!cancelled) setLoadError(error instanceof Error ? error.message : 'Comparison data unavailable.')
            })
            .finally(() => {
                if (!cancelled) setLoading(false)
            })

        return () => {
            cancelled = true
        }
    }, [])

    const leftCompany = companies.find((company) => company.ticker === leftTicker)
    const rightCompany = companies.find((company) => company.ticker === rightTicker)
    const leftRecord = findRecord(records, leftTicker, leftYear)
    const rightRecord = findRecord(records, rightTicker, rightYear)
    const metrics = metricGroups[activeMetrics]
    const sameCompanyDifferentYears = leftTicker === rightTicker && leftYear !== rightYear

    return (
        <section className="company-compare-view" aria-labelledby="compare-heading">
            <h2 id="compare-heading">{sameCompanyDifferentYears ? 'Compare Years' : 'Compare Companies'}</h2>
            <div className="compare-selectors">
                <div className="compare-side">
                    <label htmlFor="compare-company-left">Company</label>
                    <select id="compare-company-left" value={leftTicker} onChange={(event) => setLeftTicker(event.target.value)}>
                        {companies.map((company) => <option key={company.ticker} value={company.ticker}>{company.name}</option>)}
                    </select>
                    <label htmlFor="compare-year-left">Fiscal year</label>
                    <select id="compare-year-left" value={leftYear} onChange={(event) => setLeftYear(event.target.value)}>
                        {fiscalYears.map((year) => <option key={year} value={year}>{year}</option>)}
                    </select>
                </div>
                <div className="compare-side">
                    <label htmlFor="compare-company-right">Company</label>
                    <select id="compare-company-right" value={rightTicker} onChange={(event) => setRightTicker(event.target.value)}>
                        {companies.map((company) => <option key={company.ticker} value={company.ticker}>{company.name}</option>)}
                    </select>
                    <label htmlFor="compare-year-right">Fiscal year</label>
                    <select id="compare-year-right" value={rightYear} onChange={(event) => setRightYear(event.target.value)}>
                        {fiscalYears.map((year) => <option key={year} value={year}>{year}</option>)}
                    </select>
                </div>
            </div>
            <div className="compare-run-row">
                <button className="compare-run-button" type="button" onClick={() => setHasCompared(true)}>Compare</button>
            </div>

            <div className="compare-provenance">
                <div><strong>{leftCompany?.name || leftTicker}</strong><span>{leftRecord ? `${leftRecord.source} · As of ${leftRecord.as_of_date}` : `No stored data for ${leftTicker} · ${leftYear}`}</span></div>
                <div><strong>{rightCompany?.name || rightTicker}</strong><span>{rightRecord ? `${rightRecord.source} · As of ${rightRecord.as_of_date}` : `No stored data for ${rightTicker} · ${rightYear}`}</span></div>
            </div>

            <nav className="compare-metric-tabs" aria-label="Comparison metric groups">
                {[
                    ['keyMetrics', 'Key Metrics'],
                    ['financials', 'Financials'],
                    ['margins', 'Margins'],
                ].map(([key, label]) => (
                    <button
                        className={activeMetrics === key ? 'active' : ''}
                        key={key}
                        type="button"
                        aria-current={activeMetrics === key ? 'page' : undefined}
                        onClick={() => setActiveMetrics(key)}
                    >
                        {label}
                    </button>
                ))}
            </nav>

            {loading ? (
                <div className="compare-empty-state" role="status">Loading stored comparison data…</div>
            ) : loadError ? (
                <div className="compare-empty-state" role="alert">Stored comparison data is unavailable. Check that the API and database are running.</div>
            ) : !hasCompared ? (
                <div className="compare-empty-state">Choose two companies or two fiscal years, then select Compare.</div>
            ) : (
                <div className="compare-table-wrap">
                    <div className="compare-table-head">
                        <strong>Metric</strong>
                        <strong>{leftCompany?.name || leftTicker} · {leftYear}</strong>
                        <strong>{rightCompany?.name || rightTicker} · {rightYear}</strong>
                    </div>
                    {metrics.map((metric) => {
                        const leftValue = leftRecord?.[metric.field]
                        const rightValue = rightRecord?.[metric.field]
                        const values = [leftValue, rightValue].filter((value) => value !== null && value !== undefined).map(Number)
                        const scale = Math.max(0, ...values)

                        return (
                            <div className="compare-table-row" key={metric.field}>
                                <strong className="compare-metric-label">{metric.label}{metric.format === 'crore' ? ' (₹ Cr)' : metric.format === 'rupee' ? ' (₹)' : metric.format === 'percent' ? ' (%)' : ''}</strong>
                                <MetricBar
                                    label={`${metric.label} for ${leftCompany?.name || leftTicker}`}
                                    record={leftRecord}
                                    metric={metric}
                                    scale={scale}
                                    side="left"
                                    companyLabel={leftCompany?.name || leftTicker}
                                    fiscalYear={leftYear}
                                />
                                <MetricBar
                                    label={`${metric.label} for ${rightCompany?.name || rightTicker}`}
                                    record={rightRecord}
                                    metric={metric}
                                    scale={scale}
                                    side="right"
                                    companyLabel={rightCompany?.name || rightTicker}
                                    fiscalYear={rightYear}
                                />
                            </div>
                        )
                    })}
                    <p className="compare-disclaimer">Bars compare stored values within each metric; missing company/year records are shown as unavailable. Metrics may not be comparable across different sectors.</p>
                </div>
            )}
        </section>
    )
}
