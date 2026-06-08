import type { SessionData } from '../../../../shared/types/localdb'

type SessionChangeListener = (session: SessionData | null) => void

const sessionChangeListeners = new Set<SessionChangeListener>()

export function onSessionChanged(listener: SessionChangeListener): () => void {
  sessionChangeListeners.add(listener)
  return () => {
    sessionChangeListeners.delete(listener)
  }
}

export function notifySessionChanged(session: SessionData | null): void {
  for (const listener of sessionChangeListeners) {
    listener(session)
  }
}
