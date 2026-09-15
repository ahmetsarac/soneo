const STORAGE_KEY = "soneo.chatOpen";
export const CHAT_DRAWER_MS = 300;

export function parseChatOpen(raw: string | null) {
  if (raw === "0" || raw === "false") return false;
  if (raw === "1" || raw === "true") return true;
  return true;
}

export function readChatOpen() {
  if (typeof window === "undefined") return true;
  try {
    return parseChatOpen(localStorage.getItem(STORAGE_KEY));
  } catch {
    return true;
  }
}

export function writeChatOpen(open: boolean) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, open ? "1" : "0");
}
