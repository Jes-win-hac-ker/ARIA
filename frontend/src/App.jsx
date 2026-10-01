import { useEffect, useRef, useState } from 'react'
import { askQuestion, healthCheck, mockMode } from './api/client.js'
import { getSessionId } from './utils/session.js'
import { BrandSymbol, Icon, StatusPill } from './shared/ARIAUI.jsx'
import { LandingPage, LoginPage } from './features/auth/AuthFlow.jsx'
import FollowedCompaniesView from './features/companies/FollowedCompaniesView.jsx'
import ResearchHistoryView from './features/research/ResearchHistoryView.jsx'
import ResearchWorkspace from './features/research/ResearchWorkspace.jsx'
import SettingsDialog from './features/settings/SettingsDialog.jsx'
import HomePage from './HomePage.jsx'

function readStoredTheme() {
    try {
        return window.localStorage.getItem('aria-theme') === 'dark' ? 'dark' : 'light'
    } catch {
        return 'light'
    }
}

function readFollowedCompanies() {
    try {
        const stored = JSON.parse(window.localStorage.getItem('aria-followed-companies') || '[]')
        if (!Array.isArray(stored)) return []
        return stored.filter(
            (company) =>
                company &&
                typeof company.name === 'string' &&
                typeof company.ticker === 'string',
        )
    } catch {
        return []
    }
}

export default function App() {
    const [entryPage, setEntryPage] = useState('login')
    const [health, setHealth] = useState('checking')
    const [sessionId] = useState(getSessionId)
    const [activeSection, setActiveSection] = useState('research')
    const [theme, setTheme] = useState(readStoredTheme)
    const [followedCompanies, setFollowedCompanies] = useState(readFollowedCompanies)
    const [selectedCompanies, setSelectedCompanies] = useState([])
    const [companyFormOpen, setCompanyFormOpen] = useState(false)
    const [companyName, setCompanyName] = useState('')
    const [companyTicker, setCompanyTicker] = useState('')
    const [settingsOpen, setSettingsOpen] = useState(false)
    const [privacyOpen, setPrivacyOpen] = useState(false)
    const [settingsNotice, setSettingsNotice] = useState('')
    const [question, setQuestion] = useState('')
    const [command, setCommand] = useState('')
    const [messages, setMessages] = useState([])
    const [error, setError] = useState(null)
    const [loading, setLoading] = useState(false)
    const [sidebarOpen, setSidebarOpen] = useState(true)
    const [activeTab, setActiveTab] = useState('sources')
    const [selectedCitation, setSelectedCitation] = useState(null)
    const composerRef = useRef(null)
    const threadEndRef = useRef(null)

    useEffect(() => {
        healthCheck()
            .then((data) => setHealth(data.status === 'ok' && data.database ? 'connected' : 'degraded'))
            .catch(() => setHealth('unreachable'))
    }, [])

    useEffect(() => {
        try {
            window.localStorage.setItem('aria-theme', theme)
        } catch {
            setSettingsNotice('Theme preference could not be saved in this browser.')
        }
        document.querySelector('meta[name="theme-color"]')?.setAttribute(
            'content',
            theme === 'dark' ? '#191d20' : '#f5f4f0',
        )
    }, [theme])

    useEffect(() => {
        try {
            window.localStorage.setItem('aria-followed-companies', JSON.stringify(followedCompanies))
        } catch {
            setSettingsNotice('Followed companies could not be saved in this browser.')
        }
    }, [followedCompanies])

    useEffect(() => {
        threadEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
    }, [messages, loading, error])

    useEffect(() => {
        if (entryPage === 'workspace') composerRef.current?.focus()
    }, [entryPage])

    useEffect(() => {
        function handleShortcut(event) {
            if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'b') {
                event.preventDefault()
                setSidebarOpen((open) => !open)
            }
            if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
                event.preventDefault()
                composerRef.current?.focus()
            }
        }
        window.addEventListener('keydown', handleShortcut)
        return () => window.removeEventListener('keydown', handleShortcut)
    }, [])

    useEffect(() => {
        if (!settingsOpen) return undefined
        function closeOnEscape(event) {
            if (event.key === 'Escape') {
                setSettingsOpen(false)
                setPrivacyOpen(false)
            }
        }
        window.addEventListener('keydown', closeOnEscape)
        return () => window.removeEventListener('keydown', closeOnEscape)
    }, [settingsOpen])

    async function ask(event) {
        event?.preventDefault()
        const submittedQuestion = (question || command).trim()
        if (!submittedQuestion || loading) return

        const messageId = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`
        setError(null)
        setQuestion('')
        setCommand('')
        setMessages((current) => [...current, {
            id: messageId,
            question: submittedQuestion,
            response: null,
            createdAt: new Date().toISOString(),
        }])
        setLoading(true)

        try {
            const result = await askQuestion(submittedQuestion)
            setMessages((current) =>
                current.map((message) => (message.id === messageId ? { ...message, response: result } : message)),
            )
            if (result.citations?.length) {
                setSelectedCitation(`${messageId}-0`)
                setActiveTab('sources')
            } else {
                setSelectedCitation(null)
            }
        } catch (requestError) {
            setError(requestError instanceof Error ? requestError.message : String(requestError))
            setMessages((current) => current.map((message) =>
                message.id === messageId ? { ...message, failed: true } : message,
            ))
        } finally {
            setLoading(false)
        }
    }

    function startNewResearch() {
        setMessages([])
        setActiveSection('research')
        setError(null)
        setQuestion('')
        setCommand('')
        setSelectedCitation(null)
        setActiveTab('sources')
        composerRef.current?.focus()
    }

    function chooseSuggestedQuestion(suggestion) {
        setQuestion(suggestion)
        composerRef.current?.focus()
    }

    function addFollowedCompany(event) {
        event.preventDefault()
        const name = companyName.trim()
        const ticker = companyTicker.trim().toUpperCase()
        if (!name || !ticker) return
        if (followedCompanies.some((company) => company.ticker.toUpperCase() === ticker)) {
            setSettingsNotice(`${ticker} is already in your followed companies.`)
            return
        }

        setFollowedCompanies((current) => [...current, { name, ticker }])
        setSelectedCompanies((current) => [...current, ticker])
        setCompanyName('')
        setCompanyTicker('')
        setCompanyFormOpen(false)
        setSettingsNotice(`${name} was added to this browser’s followed companies.`)
    }

    function toggleCompanySelection(ticker) {
        setSelectedCompanies((current) =>
            current.includes(ticker)
                ? current.filter((item) => item !== ticker)
                : current.length < 3
                    ? [...current, ticker]
                    : current,
        )
    }

    function prepareCompanyResearch(company) {
        setActiveSection('research')
        setQuestion(`Summarize the latest available public disclosures and management commentary for ${company.name} (${company.ticker}). Include citations and clearly state the source and retrieval time. Do not provide investment advice or price predictions.`)
        setEntryPage('workspace')
        composerRef.current?.focus()
    }

    function prepareCompanyComparison() {
        if (selectedCompanies.length < 2) return
        setActiveSection('research')
        const companies = followedCompanies.filter((company) => selectedCompanies.includes(company.ticker))
        const companyNames = companies.map((company) => `${company.name} (${company.ticker})`).join(' and ')
        setQuestion(`Compare ${companyNames} using only retrieved public filings and management commentary. Cite each source, identify the reporting period, and state when data is unavailable. Do not calculate financial metrics or provide investment advice.`)
        composerRef.current?.focus()
    }

    function showAuthenticationNotice(action) {
        setSettingsNotice(`${action} is unavailable: authentication is not configured for this API.`)
    }

    function removeFollowedCompany(company) {
        setFollowedCompanies((current) => current.filter((item) => item.ticker !== company.ticker))
        setSelectedCompanies((current) => current.filter((ticker) => ticker !== company.ticker))
    }

    function openResearchFromHistory(messageId) {
        setActiveSection('research')
        window.setTimeout(() => document.getElementById(`thread-${messageId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 0)
    }

    const latestQuestion = messages.at(-1)?.question

    if (entryPage === 'login') {
        return <LoginPage onLogin={() => setEntryPage('landing')} />
    }

    if (entryPage === 'landing') {
        return <LandingPage onStart={() => setEntryPage('company-search')} />
    }

    if (entryPage === 'company-search') {
        return <HomePage onCompanySelect={prepareCompanyResearch} />
    }

    return (
        <div className={`workstation theme-${theme} ${sidebarOpen ? '' : 'sidebar-collapsed'}`}>
            <header className="command-bar">
                <div className="command-brand">
                    <button
                        className="icon-button sidebar-toggle"
                        type="button"
                        onClick={() => setSidebarOpen((open) => !open)}
                        title="Toggle navigation sidebar (Ctrl+B)"
                        aria-label="Toggle navigation sidebar"
                        aria-expanded={sidebarOpen}
                    >
                        <Icon name="menu">☰</Icon>
                    </button>
                    <a className="brand" href="/" aria-label="ARIA research home">
                        <span className="brand-mark" aria-hidden="true">
                            <BrandSymbol idPrefix="header" />
                        </span>
                        <span className="brand-name">ARIA</span>
                    </a>
                    <span className="brand-tagline">ASK <i>·</i> RETRIEVE <i>·</i> INTERPRET <i>·</i> AUGMENT</span>
                </div>

                <form className="command-search" onSubmit={ask} role="search">
                    <Icon name="search">⌕</Icon>
                    <input
                        aria-label="Ask a financial research question"
                        value={command}
                        onChange={(event) => setCommand(event.target.value)}
                        placeholder="Ask a question about a filing or company…"
                        disabled={loading}
                    />
                    <kbd>⌘ K</kbd>
                </form>

                <div className="command-actions">
                    <StatusPill health={health} />
                </div>
            </header>

            <div className="workstation-body">
                {sidebarOpen && (
                    <aside className="workbench-sidebar" aria-label="Research navigation">
                        <div className="new-session-wrap">
                            <button className="new-session-button" type="button" onClick={startNewResearch}>
                                <Icon name="add">＋</Icon>
                                <span>New research session</span>
                            </button>
                        </div>
                        <div className="sidebar-scroll">
                            <div className="sidebar-label">WORKSPACE</div>
                            <nav className="side-navigation" aria-label="Workspace">
                                <button className={`side-nav-item ${activeSection === 'research' ? 'active' : ''}`} type="button" aria-current={activeSection === 'research' ? 'page' : undefined} onClick={() => setActiveSection('research')}>
                                    <Icon name="chat">▤</Icon><span>Research</span>
                                </button>
                                <button className={`side-nav-item ${activeSection === 'history' ? 'active' : ''}`} type="button" aria-current={activeSection === 'history' ? 'page' : undefined} onClick={() => setActiveSection('history')}>
                                    <Icon name="folder">◷</Icon><span>History</span>
                                    <span className="nav-count">{messages.length}</span>
                                </button>
                                <button className={`side-nav-item ${activeSection === 'library' ? 'active' : ''}`} type="button" aria-current={activeSection === 'library' ? 'page' : undefined} onClick={() => setActiveSection('library')}>
                                    <Icon name="folder">▧</Icon><span>Library</span>
                                    <span className="nav-count">{followedCompanies.length}</span>
                                </button>
                                <button className="side-nav-item" type="button" onClick={() => { setSettingsNotice(''); setSettingsOpen(true) }}>
                                    <Icon name="settings">⚙</Icon><span>Settings</span>
                                </button>
                            </nav>

                            <div className="sidebar-divider" />
                            <div className="sidebar-section-heading">
                                <span className="sidebar-label">CURRENT THREAD</span>
                                <span className="thread-state"><span />{messages.length ? `${messages.length} ${messages.length === 1 ? 'inquiry' : 'inquiries'}` : 'New'}</span>
                            </div>
                            {latestQuestion ? (
                                <button
                                    className="recent-thread"
                                    type="button"
                                    onClick={() => composerRef.current?.focus()}
                                    title={latestQuestion}
                                >
                                    <span className="recent-thread-title">{latestQuestion}</span>
                                    <span className="recent-thread-subtitle">In this session</span>
                                </button>
                            ) : (
                                <div className="sidebar-empty">Questions and their source trails will appear here in this session.</div>
                            )}

                        </div>
                        <div className="sidebar-bottom">
                            <div className="sidebar-preferences">
                                <span>Appearance</span>
                                <button
                                    className="sidebar-theme-toggle"
                                    type="button"
                                    onClick={() => setTheme((current) => current === 'dark' ? 'light' : 'dark')}
                                    aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
                                >
                                    <span aria-hidden="true">{theme === 'dark' ? '☾' : '☼'}</span>
                                    {theme === 'dark' ? 'Dark' : 'Light'}
                                </button>
                            </div>
                            <div className="sidebar-status"><StatusPill health={health} /></div>
                            <p>Source-grounded financial research</p>
                        </div>
                    </aside>
                )}

                <main className="research-workspace">
                    {activeSection === 'library' ? (
                        <FollowedCompaniesView
                            followedCompanies={followedCompanies}
                            selectedCompanies={selectedCompanies}
                            companyFormOpen={companyFormOpen}
                            setCompanyFormOpen={setCompanyFormOpen}
                            companyName={companyName}
                            setCompanyName={setCompanyName}
                            companyTicker={companyTicker}
                            setCompanyTicker={setCompanyTicker}
                            onAddCompany={addFollowedCompany}
                            onCompare={prepareCompanyComparison}
                            onToggleCompany={toggleCompanySelection}
                            onResearchCompany={prepareCompanyResearch}
                            onRemoveCompany={removeFollowedCompany}
                        />
                    ) : activeSection === 'history' ? (
                        <ResearchHistoryView
                            messages={messages}
                            onNewResearch={startNewResearch}
                            onOpenResearch={openResearchFromHistory}
                        />
                    ) : (
                        <ResearchWorkspace
                            messages={messages}
                            loading={loading}
                            error={error}
                            question={question}
                            setQuestion={setQuestion}
                            command={command}
                            ask={ask}
                            chooseSuggestedQuestion={chooseSuggestedQuestion}
                            composerRef={composerRef}
                            threadEndRef={threadEndRef}
                            activeTab={activeTab}
                            setActiveTab={setActiveTab}
                            selectedCitation={selectedCitation}
                            setSelectedCitation={setSelectedCitation}
                        />
                    )}
                </main>

                {settingsOpen && (
                    <SettingsDialog
                        health={health}
                        sessionId={sessionId}
                        mockMode={mockMode}
                        theme={theme}
                        setTheme={setTheme}
                        privacyOpen={privacyOpen}
                        setPrivacyOpen={setPrivacyOpen}
                        settingsNotice={settingsNotice}
                        onClose={() => setSettingsOpen(false)}
                        onShowAuthenticationNotice={showAuthenticationNotice}
                    />
                )}
            </div>
        </div>
    )
}
