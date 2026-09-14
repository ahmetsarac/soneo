"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ApiError, createRoom, joinRoom } from "@/lib/api";
import { writeSession } from "@/lib/session";

type Mode = "create" | "join";

export function HomeEntry() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("create");
  const [nickname, setNickname] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setPending(true);

    try {
      const result =
        mode === "create"
          ? await createRoom(nickname)
          : await joinRoom(code, nickname);

      writeSession({
        roomCode: result.room.code,
        participantId: result.participant.id,
        nickname: result.participant.nickname,
      });

      router.push(`/room/${result.room.code}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Bir şeyler ters gitti.");
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5">
      <div className="flex rounded-full bg-white/5 p-1">
        <button
          type="button"
          onClick={() => setMode("create")}
          className={`flex-1 rounded-full px-4 py-2 text-sm font-medium transition ${
            mode === "create"
              ? "bg-acid text-ink"
              : "text-mist hover:text-paper"
          }`}
        >
          Oda oluştur
        </button>
        <button
          type="button"
          onClick={() => setMode("join")}
          className={`flex-1 rounded-full px-4 py-2 text-sm font-medium transition ${
            mode === "join" ? "bg-acid text-ink" : "text-mist hover:text-paper"
          }`}
        >
          Odaya katıl
        </button>
      </div>

      <label className="flex flex-col gap-2">
        <span className="text-xs font-medium tracking-wide text-mist uppercase">
          Nick
        </span>
        <input
          autoFocus
          autoComplete="nickname"
          maxLength={20}
          value={nickname}
          onChange={(event) => setNickname(event.target.value)}
          placeholder="ör. kara"
          className="h-12 rounded-2xl border border-line bg-ink px-4 text-paper outline-none transition placeholder:text-mist/50 focus:border-acid"
        />
      </label>

      {mode === "join" && (
        <label className="flex flex-col gap-2">
          <span className="text-xs font-medium tracking-wide text-mist uppercase">
            Oda kodu
          </span>
          <input
            autoComplete="off"
            spellCheck={false}
            maxLength={6}
            value={code}
            onChange={(event) =>
              setCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))
            }
            placeholder="7K2M9Q"
            className="h-12 rounded-2xl border border-line bg-ink px-4 font-mono tracking-[0.35em] text-paper outline-none transition placeholder:tracking-[0.35em] placeholder:text-mist/50 focus:border-acid"
          />
        </label>
      )}

      {error && (
        <p className="rounded-xl border border-ember/30 bg-ember/10 px-3 py-2 text-sm text-ember">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending || !nickname.trim() || (mode === "join" && code.length < 6)}
        className="h-12 rounded-2xl bg-acid text-sm font-semibold text-ink transition hover:bg-acid-glow disabled:cursor-not-allowed disabled:opacity-40"
      >
        {pending
          ? mode === "create"
            ? "Oda açılıyor…"
            : "Katılıyor…"
          : mode === "create"
            ? "Odayı aç"
            : "Odaya gir"}
      </button>
    </form>
  );
}
