const SESSION_STORAGE_KEY = 'aria_session_id'

export function getSessionId() {
  let sessionId = localStorage.getItem(SESSION_STORAGE_KEY)

  if (!sessionId) {
    sessionId = crypto.randomUUID()
    localStorage.setItem(SESSION_STORAGE_KEY, sessionId)
  }

  return sessionId
}