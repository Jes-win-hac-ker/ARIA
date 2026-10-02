function readStoredJson(key, fallback) {
    try {
        return JSON.parse(window.localStorage.getItem(key) || JSON.stringify(fallback))
    } catch {
        return fallback
    }
}

export function readStoredTheme() {
    try {
        return window.localStorage.getItem('aria-theme') === 'dark' ? 'dark' : 'light'
    } catch {
        return 'light'
    }
}

export function writeStoredTheme(theme) {
    window.localStorage.setItem('aria-theme', theme)
}

export function readFollowedCompanies() {
    const stored = readStoredJson('aria-followed-companies', [])
    if (!Array.isArray(stored)) return []
    return stored.filter(
        (company) =>
            company &&
            typeof company.name === 'string' &&
            typeof company.ticker === 'string',
    )
}

export function readSavedReports() {
    const stored = readStoredJson('aria-saved-reports', [])
    if (!Array.isArray(stored)) return []
    return stored.filter(
        (report) =>
            report &&
            typeof report.filename === 'string' &&
            typeof report.companyName === 'string' &&
            typeof report.title === 'string' &&
            typeof report.savedAt === 'string',
    )
}

export function writeStoredValue(key, value) {
    window.localStorage.setItem(key, JSON.stringify(value))
}

export function readStoredMessages() {
    try {
        const stored = JSON.parse(window.localStorage.getItem('aria_messages') || '[]')
        return Array.isArray(stored) ? stored : []
    } catch {
        return []
    }
}
