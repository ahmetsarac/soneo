import type { Session } from "./api";

const KEY = "soneo.session";

export function readSession(): Session | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Session;
    if (!parsed.roomCode || !parsed.participantId || !parsed.nickname) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function writeSession(session: Session) {
  sessionStorage.setItem(KEY, JSON.stringify(session));
}

export function clearSession() {
  sessionStorage.removeItem(KEY);
}
