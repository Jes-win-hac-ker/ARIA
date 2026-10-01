const SESSION_STORAGE_KEY = 'aria-frontend-session-id'

export function getSessionId() {
  try {
    let sessionId = window.localStorage.getItem(SESSION_STORAGE_KEY)
    if (!sessionId) {
      sessionId = globalThis.crypto?.randomUUID?.() || `aria-${Date.now()}-${Math.random().toString(36).slice(2)}`
      window.localStorage.setItem(SESSION_STORAGE_KEY, sessionId)
    }
    return sessionId
  } catch {
    return 'browser-storage-unavailable'
  }
}
