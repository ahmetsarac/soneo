"use client";

import { useEffect, useRef, useState } from "react";
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
}: {
  messages: ChatMessage[];
  selfId: string;
  connected: boolean;
  onSend: (text: string) => boolean;
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
    <aside className="flex h-full min-h-80 flex-col border-t border-line lg:min-h-0 lg:border-t-0 lg:border-l">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <h2 className="font-display text-lg">Sohbet</h2>
        <span className="text-[11px] tracking-wide text-mist uppercase">
          {connected ? "canlı" : "yeniden bağlanıyor"}
        </span>
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
              className={`max-w-[90%] ${message.participantId === selfId ? "self-end" : ""}`}
            >
              <p className="mb-1 text-[11px] text-mist">
                {message.participantId === selfId
                  ? "sen"
                  : message.nickname}{" "}
                · {formatTime(message.sentAt)}
              </p>
              <p
                className={`rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                  message.participantId === selfId
                    ? "bg-acid text-ink"
                    : "bg-white/8"
                }`}
              >
                {message.text}
              </p>
            </article>
          ),
        )}
        <div ref={bottomRef} />
      </div>

      <form className="border-t border-line p-3" onSubmit={submit}>
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          maxLength={2000}
          disabled={!connected}
          placeholder={connected ? "Mesaj yaz" : "Bağlantı bekleniyor"}
          className="h-11 w-full rounded-xl border border-line bg-panel px-3 text-sm outline-none focus:border-acid disabled:text-mist"
        />
      </form>
    </aside>
  );
}
