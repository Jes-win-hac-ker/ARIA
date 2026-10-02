export const companies = [
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

export const documentsByTicker = {
    RELIANCE: relianceDocuments,
}

export const fiscalYears = ['FY2025-26', 'FY2024-25', 'FY2023-24', 'FY2022-23']

export const metricDefinitions = [
    { label: 'Revenue', field: 'revenue_cr', format: (value) => `₹${new Intl.NumberFormat('en-IN').format(value)} Cr` },
    { label: 'Net Profit', field: 'net_profit_cr', format: (value) => `₹${new Intl.NumberFormat('en-IN').format(value)} Cr` },
    { label: 'EPS', field: 'eps', format: (value) => `₹${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(value)}` },
]

const reportingPeriodToFiscalYear = {
    FY26: 'FY2025-26',
    FY24: 'FY2023-24',
    FY23: 'FY2022-23',
}

export function fiscalYearToReportingPeriod(fiscalYear) {
    const match = fiscalYear?.match(/^FY\d{2}-(\d{2})$/)
    return match ? `FY${match[1]}` : fiscalYear
}

export function reportingPeriodSortValue(period) {
    const match = period?.match(/^FY(\d{2})$/)
    return match ? Number(match[1]) : -1
}

export function toFiscalYear(reportingPeriod) {
    return reportingPeriodToFiscalYear[reportingPeriod] || reportingPeriod
}
