import { useEffect, useRef, useState } from 'react'
import { askQuestion, deleteSession, healthCheck, mockMode } from './api/client.js'
import { clearStoredSessionId, getSessionId, setStoredSessionId } from './utils/session.js'
import { readFollowedCompanies, readSavedReports, readStoredMessages, readStoredTheme, writeStoredTheme, writeStoredValue } from './utils/storage.js'
export default function App() {
    const [entryPage, setEntryPage] = useState('login')
    const [health, setHealth] = useState('checking')
    const [sessionId, setSessionId] = useState(getSessionId)
    const [activeSection, setActiveSection] = useState('research')
    const [theme, setTheme] = useState(readStoredTheme)
    const [followedCompanies, setFollowedCompanies] = useState(readFollowedCompanies)
    const [savedReports, setSavedReports] = useState(readSavedReports)
    const [companyFormOpen, setCompanyFormOpen] = useState(false)
    const [companyName, setCompanyName] = useState('')
    const [companyTicker, setCompanyTicker] = useState('')
    const [settingsOpen, setSettingsOpen] = useState(false)
    const [privacyOpen, setPrivacyOpen] = useState(false)
    const [settingsNotice, setSettingsNotice] = useState('')
    const [question, setQuestion] = useState('')
    const [command, setCommand] = useState('')
    const [messages, setMessages] = useState(readStoredMessages)
    const [researchCompany, setResearchCompany] = useState(null)
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
            window.localStorage.setItem('aria_messages', JSON.stringify(messages))
        } catch {
            // ignore storage quota errors
        }
    }, [messages])

    useEffect(() => {
        try {
            writeStoredTheme(theme)
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
            writeStoredValue('aria-followed-companies', followedCompanies)
        } catch {
            setSettingsNotice('Followed companies could not be saved in this browser.')
        }
    }, [followedCompanies])

    useEffect(() => {
        try {
            writeStoredValue('aria-saved-reports', savedReports)
        } catch {
            setSettingsNotice('Saved reports could not be stored in this browser.')
        }
    }, [savedReports])

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

        const currentSessionId = sessionId || getSessionId()
        const messageId = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`
        setError(null)
        setQuestion('')
        setCommand('')
        setSelectedCitation(null)
        setActiveTab('sources')
        const company = researchCompany
        setResearchCompany(null)
        setMessages((current) => [...current, {
            id: messageId,
            question: submittedQuestion,
            company,
            response: null,
            createdAt: new Date().toISOString(),
        }])
        setLoading(true)

        try {
            const result = await askQuestion(submittedQuestion, currentSessionId)
            if (result?.session_id) {
                setStoredSessionId(result.session_id)
                setSessionId(result.session_id)
            }
            setMessages((current) =>
                current.map((message) => (message.id === messageId ? { ...message, response: result } : message)),
            )
        } catch (requestError) {
            setError(requestError instanceof Error ? requestError.message : String(requestError))
            setMessages((current) => current.map((message) =>
                message.id === messageId ? { ...message, failed: true } : message,
            ))
        } finally {
            setLoading(false)
        }
    }

    async function handleClearHistory() {
        const idToDelete = sessionId || getSessionId()
        if (idToDelete) {
            try {
                await deleteSession(idToDelete)
            } catch (deleteError) {
                console.warn('Backend session deletion notice:', deleteError)
            }
        }
        clearStoredSessionId()
        try {
            window.localStorage.removeItem('aria_messages')
        } catch {}
        const newId = globalThis.crypto?.randomUUID?.() || `aria-${Date.now()}`
        setStoredSessionId(newId)
        setSessionId(newId)
        setMessages([])
        setError(null)
        setQuestion('')
        setCommand('')
        setResearchCompany(null)
        setSelectedCitation(null)
        setActiveTab('sources')
        setSettingsNotice('Chat history erased for DPDP compliance.')
        composerRef.current?.focus()
    }

    function startNewResearch() {
        setMessages([])
        setActiveSection('research')
        setError(null)
        setQuestion('')
        setCommand('')
        setResearchCompany(null)
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

        setFollowedCompanies((current) => [...current, { name, ticker, followedAt: new Date().toISOString() }])
        setCompanyName('')
        setCompanyTicker('')
        setCompanyFormOpen(false)
        setSettingsNotice(`${name} was added to this browser’s followed companies.`)
    }

    function toggleCompanyFollow(company) {
        const isFollowed = followedCompanies.some((item) => item.ticker === company.ticker)
        if (isFollowed) {
            setFollowedCompanies((current) => current.filter((item) => item.ticker !== company.ticker))
            return
        }

        setFollowedCompanies((current) => [...current, { name: company.name, ticker: company.ticker, followedAt: new Date().toISOString() }])
    }

    function toggleSavedReport(company, document) {
        setSavedReports((current) => {
            if (current.some((report) => report.filename === document.filename)) {
                return current.filter((report) => report.filename !== document.filename)
            }

            return [...current, {
                ...document,
                companyName: company.name,
                companyTicker: company.ticker,
                savedAt: new Date().toISOString(),
            }]
        })
    }

    function prepareCompanyResearch(company) {
        setActiveSection('research')
        setResearchCompany({
            name: company.name,
            ticker: company.ticker,
            initial: company.initial || company.name?.[0] || company.ticker?.[0],
        })
        setQuestion(`Summarize the latest available public disclosures and management commentary for ${company.name} (${company.ticker}). Include citations and clearly state the source and retrieval time. Do not provide investment advice or price predictions.`)
        setEntryPage('workspace')
        composerRef.current?.focus()
    }

    function navigateFromCompanyMenu(destination) {
        if (destination === 'settings') {
            setEntryPage('workspace')
            setSettingsNotice('')
            setSettingsOpen(true)
            return
        }

        if (destination === 'home') {
            setEntryPage('company-search')
            return
        }

        setActiveSection(destination)
        setEntryPage('workspace')
    }

    function prepareCompanyComparison() {
        if (selectedCompanies.length < 2) return
        setActiveSection('research')
        const companies = followedCompanies.filter((company) => selectedCompanies.includes(company.ticker))
        const companyNames = companies.map((company) => `${company.name} (${company.ticker})`).join(' and ')
        setQuestion(`Compare ${companyNames} using only retrieved public filings and management commentary. Cite each source, identify the reporting period, and state when data is unavailable. Do not calculate financial metrics or provide investment advice.`)
        composerRef.current?.focus()
    }

    function goToLogin() {
        setSettingsOpen(false)
        setEntryPage('login')
    }

    function exitGuestSession() {
        setMessages([])
        setQuestion('')
        setCommand('')
        setError(null)
        setSelectedCitation(null)
        setActiveTab('sources')
        setActiveSection('research')
        setSettingsOpen(false)
        setPrivacyOpen(false)
        setEntryPage('login')
    }

    function removeFollowedCompany(company) {
        setFollowedCompanies((current) => current.filter((item) => item.ticker !== company.ticker))
    }

    function openResearchFromHistory(messageId) {
        setActiveSection('research')
        window.setTimeout(() => document.getElementById(`thread-${messageId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 0)
    }

    const latestQuestion = messages.at(-1)?.question

    if (entryPage === 'login') {
        return (
            <LoginPage
                apiHealth={health}
                theme={theme}
                onToggleTheme={() => setTheme((current) => current === 'dark' ? 'light' : 'dark')}
                onLogin={() => setEntryPage('landing')}
            />
        )
    }

    if (entryPage === 'landing') {
        return (
            <LandingPage
                apiHealth={health}
                onStart={() => setEntryPage('company-search')}
                theme={theme}
                onToggleTheme={() => setTheme((current) => current === 'dark' ? 'light' : 'dark')}
            />
        )
    }

    if (entryPage === 'company-search') {
        return (
            <HomePage
                apiHealth={health}
                onCompanySelect={prepareCompanyResearch}
                onToggleFollow={toggleCompanyFollow}
                followedCompanies={followedCompanies}
                savedReports={savedReports}
                onToggleSaveReport={toggleSavedReport}
                theme={theme}
                onToggleTheme={() => setTheme((current) => current === 'dark' ? 'light' : 'dark')}
                onNavigate={navigateFromCompanyMenu}
            />
        )
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
                <div className="command-actions">
                    <ThemeToggle
                        theme={theme}
                        onToggle={() => setTheme((current) => current === 'dark' ? 'light' : 'dark')}
                    />
                    <ApiStatusDot health={health} />
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
                            <button
                                className="clear-history-button"
                                type="button"
                                onClick={handleClearHistory}
                                title="Cascade-delete session data from MySQL (DPDP)"
                            >
                                <Icon name="delete">🗑</Icon>
                                <span>Clear Chat (DPDP)</span>
                            </button>
                        </div>
                        <div className="sidebar-scroll">
                            <div className="sidebar-label">WORKSPACE</div>
                            <nav className="side-navigation" aria-label="Workspace">
                                <button
                                    className="side-nav-item"
                                    type="button"
                                    onClick={() => setEntryPage('company-search')}
                                >
                                    <Icon name="home">⌂</Icon><span>Home</span>
                                </button>
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
                    </aside>
                )}

                <main className="research-workspace">
                    {activeSection === 'library' ? (
                        <FollowedCompaniesView
                            followedCompanies={followedCompanies}
                            companyFormOpen={companyFormOpen}
                            setCompanyFormOpen={setCompanyFormOpen}
                            companyName={companyName}
                            setCompanyName={setCompanyName}
                            companyTicker={companyTicker}
                            setCompanyTicker={setCompanyTicker}
                            onAddCompany={addFollowedCompany}
                            onResearchCompany={prepareCompanyResearch}
                            onRemoveCompany={removeFollowedCompany}
                        />
                    ) : activeSection === 'history' ? (
                        <ResearchHistoryView
                            messages={messages}
                            followedCompanies={followedCompanies}
                            savedReports={savedReports}
                            onNewResearch={startNewResearch}
                            onOpenResearch={openResearchFromHistory}
                            onResearchCompany={prepareCompanyResearch}
                            onRemoveFollowedCompany={removeFollowedCompany}
                            onRemoveSavedReport={(filename) => setSavedReports((current) => current.filter((report) => report.filename !== filename))}
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
                            sessionId={sessionId}
                            onClearHistory={handleClearHistory}
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
                        onGoToLogin={goToLogin}
                        onExitGuestSession={exitGuestSession}
                    />
                )}
            </div>
        </div>
    )
}
