export const SESSION_STORAGE_KEY = 'aria_session_id'

export function getSessionId() {
  try {
    let sessionId = window.localStorage.getItem(SESSION_STORAGE_KEY)
    if (!sessionId) {
      sessionId = globalThis.crypto?.randomUUID?.() || `aria-${Date.now()}-${Math.random().toString(36).slice(2)}`
      window.localStorage.setItem(SESSION_STORAGE_KEY, sessionId)
    }
    return sessionId
  } catch {
    return globalThis.crypto?.randomUUID?.() || 'browser-storage-unavailable'
  }
}

export function setStoredSessionId(id) {
  try {
    if (id) {
      window.localStorage.setItem(SESSION_STORAGE_KEY, id)
    }
  } catch {
    // ignore storage exceptions
  }
}

export function clearStoredSessionId() {
  try {
    window.localStorage.removeItem(SESSION_STORAGE_KEY)
  } catch {
    // ignore storage exceptions
  }
}

