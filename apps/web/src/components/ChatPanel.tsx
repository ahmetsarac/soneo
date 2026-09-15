"use client";

import { useEffect, useRef, useState } from "react";
import { parseChatText } from "@/lib/chatText";
import type { ChatMessage } from "@/lib/realtime";

function formatTime(sentAt: number) {
  return new Intl.DateTimeFormat("tr-TR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(sentAt);
}

export function ChatPanel({
  messages,
  selfId,
  connected,
  onSend,
  onClose,
}: {
  messages: ChatMessage[];
  selfId: string;
  connected: boolean;
  onSend: (text: string) => boolean;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const text = draft.trim();
    if (!text) return;
    if (onSend(text)) setDraft("");
  }

  return (
    <aside className="flex h-full min-h-80 w-full flex-col border-t border-line lg:min-h-0 lg:w-80 lg:border-t-0 lg:border-l">
      <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
        <h2 className="font-display text-lg">Sohbet</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Sohbeti gizle"
          title="Sohbeti gizle"
          className="flex h-8 w-8 items-center justify-center rounded-full border border-line hover:border-acid"
        >
          <CollapseIcon />
        </button>
      </div>

        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 py-4">
        {messages.length === 0 && (
          <p className="m-auto text-center text-sm text-mist">
            Henüz mesaj yok. İlk cümleyi sen yaz.
          </p>
        )}
        {messages.map((message) =>
          message.kind === "system" ? (
            <p
              key={message.id}
              className="text-center text-[12px] text-mist"
            >
              {message.text}
            </p>
          ) : (
            <article
              key={message.id}
              className={`min-w-0 max-w-[90%] ${message.participantId === selfId ? "self-end" : ""}`}
            >
              <p className="mb-1 text-[11px] text-mist">
                {message.participantId === selfId
                  ? "sen"
                  : message.nickname}{" "}
                · {formatTime(message.sentAt)}
              </p>
              <p
                className={`overflow-hidden rounded-2xl px-3 py-2 text-sm leading-relaxed [overflow-wrap:anywhere] ${
                  message.participantId === selfId
                    ? "bg-acid text-ink"
                    : "bg-white/8"
                }`}
              >
                <ChatBody
                  text={message.text}
                  self={message.participantId === selfId}
                />
              </p>
            </article>
          ),
        )}
        <div ref={bottomRef} />
      </div>

      <form className="flex items-center gap-2 border-t border-line p-3" onSubmit={submit}>
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          maxLength={2000}
          disabled={!connected}
          placeholder={connected ? "Mesaj yaz" : "Bağlantı bekleniyor"}
          className="h-11 min-w-0 flex-1 rounded-xl border border-line bg-panel px-3 text-sm outline-none focus:border-acid disabled:cursor-not-allowed disabled:opacity-50 disabled:text-mist"
        />
        <button
          type="submit"
          disabled={!connected || !draft.trim()}
          aria-label="Gönder"
          title="Gönder"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-acid text-ink hover:bg-acid-glow disabled:opacity-40"
        >
          <SendIcon />
        </button>
      </form>
    </aside>
  );
}

function ChatBody({ text, self }: { text: string; self: boolean }) {
  return parseChatText(text).map((part, index) => {
    if (part.type !== "link") return part.value;
    return (
      <a
        key={`${part.href}-${index}`}
        href={part.href}
        target="_blank"
        rel="noopener noreferrer"
        className={`underline decoration-from-font underline-offset-2 [overflow-wrap:anywhere] ${
          self
            ? "text-ink decoration-ink/40 hover:decoration-ink"
            : "text-acid decoration-acid/50 hover:decoration-acid"
        }`}
      >
        {part.value}
      </a>
    );
  });
}

function SendIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 20V6M6 11l6-6 6 6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ChatExpandTab({
  unread = 0,
  onOpen,
}: {
  unread?: number;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label="Sohbeti aç"
      title="Sohbeti aç"
      className="absolute top-3 right-0 z-20 flex h-10 w-10 items-center justify-center rounded-l-2xl border border-r-0 border-line bg-panel hover:border-acid hover:text-acid"
    >
      <ExpandIcon />
      {unread > 0 && (
        <span className="absolute -top-1 -left-1 min-w-4 rounded-full bg-ember px-1 text-[10px] leading-4 font-semibold text-white">
          {unread > 9 ? "9+" : unread}
        </span>
      )}
    </button>
  );
}

function ExpandIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M5 5v14M16 8l-4 4 4 4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CollapseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        className="lg:hidden"
        d="M5 19h14M8 8l4 4 4-4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        className="hidden lg:block"
        d="M19 5v14M8 8l4 4-4 4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
