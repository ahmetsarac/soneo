"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { ChatExpandTab, ChatPanel } from "@/components/ChatPanel";
import { MediaBar } from "@/components/MediaBar";
import { ParticipantGrid } from "@/components/ParticipantGrid";
import { useRoomChannel } from "@/hooks/useRoomChannel";
import { useWebRTC } from "@/hooks/useWebRTC";
import {
  ApiError,
  getRoom,
  joinRoom,
  leaveRoom,
  roomGoneKind,
  type Room,
} from "@/lib/api";
import { clearSession, readSession, writeSession } from "@/lib/session";
import { clampVolume, readPeerVolumes, writePeerVolumes, volumeStorageKey } from "@/lib/volume";
import { isPeerConnected } from "@/lib/webrtc";
import { readChatOpen, writeChatOpen, CHAT_DRAWER_MS } from "@/lib/chatOpen";
import {
  parseTileKey,
  resolveFocusedTile,
  sharingParticipantIds,
  tileKey,
  type FocusedTile,
} from "@/lib/presenters";

function GoneScreen({ kind }: { kind: "closed" | "missing" }) {
  return (
    <main className="mx-auto flex min-h-full max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="font-display text-3xl">
        {kind === "closed" ? "Oda kapatıldı" : "Oda yok"}
      </p>
      <p className="text-mist">
        {kind === "closed"
          ? "Son kişi ayrılınca bu oda silindi."
          : "Bu kodla hiç oda açılmamış."}
      </p>
      <Link
        href="/"
        className="rounded-full bg-acid px-5 py-2 text-sm font-semibold text-ink hover:bg-acid-glow"
      >
        Anasayfaya dön
      </Link>
    </main>
  );
}

function RoomSession({
  room,
  participantId,
  channel,
  copied,
  onCopy,
  onLeave,
}: {
  room: Room;
  participantId: string;
  channel: ReturnType<typeof useRoomChannel>;
  copied: boolean;
  onCopy: () => void;
  onLeave: () => void;
}) {
  const media = useWebRTC({
    selfId: participantId,
    peers: room.participants,
    connected: channel.connected,
    sendSignal: channel.sendSignal,
    sendMedia: channel.sendMedia,
    subscribe: channel.subscribe,
  });
  const [volumes, setVolumes] = useState<Record<string, number>>({});
  const [showLinking, setShowLinking] = useState(true);
  const [chatOpen, setChatOpen] = useState(true);
  const [chatUnread, setChatUnread] = useState(0);
  const [showExpandTab, setShowExpandTab] = useState(false);
  const [focusedTile, setFocusedTile] = useState<FocusedTile | null>(null);
  const messageCountRef = useRef(0);
  const remotes = room.participants.filter((person) => person.id !== participantId);
  const sharingIds = sharingParticipantIds(
    room.participants,
    participantId,
    media.screenOn,
  );
  const sharingKey = sharingIds.join(",");
  const participantKey = room.participants.map((person) => person.id).join(",");
  const waitingOnPeers =
    remotes.length > 0 &&
    remotes.every((person) => !isPeerConnected(media.iceStates[person.id]));

  useEffect(() => {
    setVolumes(readPeerVolumes());
    setChatOpen(readChatOpen());
  }, []);

  useEffect(() => {
    if (chatOpen) {
      setShowExpandTab(false);
      return;
    }
    const timer = window.setTimeout(() => setShowExpandTab(true), CHAT_DRAWER_MS);
    return () => window.clearTimeout(timer);
  }, [chatOpen]);

  useEffect(() => {
    const count = channel.messages.length;
    if (chatOpen) {
      messageCountRef.current = count;
      setChatUnread(0);
      return;
    }
    const added = count - messageCountRef.current;
    messageCountRef.current = count;
    if (added > 0) setChatUnread((current) => current + added);
  }, [channel.messages, chatOpen]);

  useEffect(() => {
    const nextSharing = sharingKey ? sharingKey.split(",") : [];
    const participantIds = participantKey ? participantKey.split(",") : [];
    setFocusedTile((current) =>
      resolveFocusedTile(participantIds, nextSharing, current),
    );
  }, [participantKey, sharingKey]);

  useEffect(() => {
    if (!waitingOnPeers) {
      setShowLinking(false);
      return;
    }
    setShowLinking(true);
    const timer = window.setTimeout(() => setShowLinking(false), 10_000);
    return () => window.clearTimeout(timer);
  }, [waitingOnPeers]);

  function setPeerVolume(
    nickname: string,
    value: number,
    surface: "camera" | "screen" = "camera",
  ) {
    setVolumes((current) => {
      const next = {
        ...current,
        [volumeStorageKey(nickname, surface)]: clampVolume(value),
      };
      writePeerVolumes(next);
      return next;
    });
  }

  function toggleChat() {
    const next = !chatOpen;
    setChatOpen(next);
    writeChatOpen(next);
    if (next) setChatUnread(0);
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex items-center justify-between gap-4 border-b border-line px-4 py-3 md:px-6">
        <div className="flex items-center gap-3">
          <p className="font-display text-lg tracking-tight text-acid">Soneo</p>
          <button
            type="button"
            onClick={onCopy}
            className="rounded-full border border-line bg-panel px-3 py-1 font-mono text-sm tracking-[0.2em] hover:border-acid"
          >
            {copied ? "kopyalandı" : room.code}
          </button>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="hidden text-mist sm:inline">
            {room.participants.length} kişi
          </span>
          <LeaveButton onLeave={onLeave} />
        </div>
      </header>

      <div className="relative min-h-0 flex-1">
        <div className="grid h-full min-h-0 lg:grid-cols-[minmax(0,1fr)_auto]">
        <section className="flex min-h-[55vh] flex-col gap-4 p-4 md:p-6 lg:min-h-0">
          <div className="flex shrink-0 items-end justify-between">
            <h2 className="font-display text-xl">Ses</h2>
            {(media.mediaError || waitingOnPeers) && (
              <p className="text-xs text-mist">
                {media.mediaError ?? "Bağlantı kuruluyor…"}
              </p>
            )}
          </div>
          <div className="relative flex min-h-0 flex-1 flex-col">
            <ParticipantGrid
              focusedKey={focusedTile ? tileKey(focusedTile) : null}
              onSelectTile={(key) => {
                const next = parseTileKey(key);
                if (next) setFocusedTile(next);
              }}
              onStopWatch={() => setFocusedTile(null)}
              onVolumeChange={setPeerVolume}
              tiles={room.participants.flatMap((participant) => {
                const self = participant.id === participantId;
                const sharing = self ? media.screenOn : participant.screenOn;
                const cameraStream = self
                  ? media.localStream
                  : (media.remoteStreams[participant.id] ?? null);
                const screenStream = self
                  ? media.localScreen
                  : (media.remoteScreens[participant.id] ?? null);
                const base = {
                  participant,
                  self,
                  level: media.levels[participant.id] ?? 0,
                  micOn: self ? media.micOn : participant.micOn,
                  camOn: self ? media.camOn : participant.camOn,
                  iceState: self ? undefined : media.iceStates[participant.id],
                };
                const camera = {
                  ...base,
                  id: tileKey({
                    participantId: participant.id,
                    surface: "camera",
                  }),
                  stream: cameraStream,
                  surface: "camera" as const,
                  presenting: false,
                  volume: self
                    ? 0
                    : (volumes[volumeStorageKey(participant.nickname, "camera")] ??
                      1),
                };
                if (!sharing) return [camera];
                return [
                  camera,
                  {
                    ...base,
                    id: tileKey({
                      participantId: participant.id,
                      surface: "screen",
                    }),
                    stream: screenStream,
                    surface: "screen" as const,
                    presenting: true,
                    volume: self
                      ? 0
                      : (volumes[volumeStorageKey(participant.nickname, "screen")] ??
                        1),
                  },
                ];
              })}
            />
            {waitingOnPeers && showLinking && (
              <div
                role="status"
                className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-ink/75 backdrop-blur-sm"
              >
                <span className="h-9 w-9 animate-spin rounded-full border-2 border-line border-t-acid" />
                <p className="font-display text-lg">Bağlantı kuruluyor</p>
                <p className="text-sm text-mist">Ses ve görüntü birkaç saniye içinde gelir.</p>
              </div>
            )}
          </div>
          <div className="shrink-0">
            <MediaBar
              micOn={media.micOn}
              camOn={media.camOn}
              screenOn={media.screenOn}
              noiseOn={media.noiseOn}
              level={media.levels[participantId] ?? 0}
              canToggleMic={media.canToggleMic}
              canToggleCam={media.canToggleCam}
              canToggleNoise={media.canToggleNoise}
              onToggleMic={media.toggleMic}
              onToggleCam={() => void media.toggleCam()}
              onToggleScreen={() => void media.toggleScreenShare()}
              onToggleNoise={() => void media.toggleNoise()}
              chatOpen={chatOpen}
              chatUnread={chatUnread}
              onToggleChat={toggleChat}
            />
          </div>
        </section>

        <div
          className={`grid min-h-0 overflow-hidden transition-[grid-template-columns,grid-template-rows] duration-300 ease-out motion-reduce:transition-none ${
            chatOpen
              ? "grid-rows-[1fr] lg:grid-cols-[1fr] lg:grid-rows-[minmax(0,1fr)]"
              : "grid-rows-[0fr] lg:grid-cols-[0fr] lg:grid-rows-[minmax(0,1fr)]"
          }`}
          aria-hidden={!chatOpen}
        >
          <div
            className={`min-h-0 min-w-0 overflow-hidden ${
              chatOpen ? "" : "pointer-events-none"
            }`}
            inert={!chatOpen}
          >
            <div
              className={`h-full w-full lg:w-80 transition-transform duration-300 ease-out motion-reduce:transition-none ${
                chatOpen
                  ? "translate-x-0 translate-y-0"
                  : "translate-y-full lg:translate-x-full lg:translate-y-0"
              }`}
            >
              <ChatPanel
                messages={channel.messages}
                selfId={participantId}
                connected={channel.connected}
                onSend={channel.sendChat}
                onClose={() => {
                  setChatOpen(false);
                  writeChatOpen(false);
                }}
              />
            </div>
          </div>
        </div>
        </div>
        {showExpandTab && (
          <ChatExpandTab
            unread={chatUnread}
            onOpen={() => {
              setChatOpen(true);
              writeChatOpen(true);
              setChatUnread(0);
            }}
          />
        )}
      </div>
    </div>
  );
}

function LeaveButton({ onLeave }: { onLeave: () => void }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onPointerDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((current) => !current)}
        className="rounded-full border border-ember bg-ember px-3 py-1.5 text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.35)] hover:brightness-110"
      >
        Ayrıl
      </button>
      {open && (
        <div
          role="dialog"
          aria-label="Odadan ayrılmayı onayla"
          className="absolute top-[calc(100%+10px)] right-0 z-50 w-64 rounded-2xl border border-line bg-panel px-3 py-2.5 shadow-[0_12px_32px_rgba(0,0,0,0.45)] before:absolute before:-top-1.5 before:right-5 before:h-3 before:w-3 before:rotate-45 before:border-t before:border-l before:border-line before:bg-panel"
        >
          <p className="relative text-sm leading-snug">
            Odadan ayrılmak istediğinize emin misiniz?
          </p>
          <div className="relative mt-2 flex gap-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="flex-1 rounded-full border border-line px-3 py-1.5 text-sm hover:border-acid"
            >
              Hayır
            </button>
            <button
              type="button"
              onClick={onLeave}
              className="flex-1 rounded-full border border-ember bg-ember px-3 py-1.5 text-sm text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.35)] hover:brightness-110"
            >
              Evet
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function RoomView({ code }: { code: string }) {
  const router = useRouter();
  const roomCode = code.toUpperCase();
  const [localRoom, setLocalRoom] = useState<Room | null>(null);
  const [participantId, setParticipantId] = useState<string | null>(null);
  const [nickname, setNickname] = useState("");
  const [needsNick, setNeedsNick] = useState(false);
  const [probing, setProbing] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [gone, setGone] = useState<"closed" | "missing" | null>(null);
  const [pending, setPending] = useState(false);
  const [copied, setCopied] = useState(false);

  const channel = useRoomChannel(roomCode, participantId);
  const room = channel.room ?? localRoom;
  const goneState = gone ?? channel.gone;

  const markGone = useCallback((kind: "closed" | "missing") => {
    const session = readSession();
    if (session?.roomCode === roomCode) clearSession();
    setGone(kind);
    setNeedsNick(false);
    setProbing(false);
  }, [roomCode]);

  const enter = useCallback(
    async (nick: string, existingId?: string, knownRoom?: Room) => {
      const currentRoom =
        knownRoom ??
        (await getRoom(roomCode).then((result) => result.room));

      if (!currentRoom) {
        throw new ApiError(404, "ROOM_NOT_FOUND", "Böyle bir oda yok.");
      }

      const alreadyIn =
        existingId &&
        currentRoom.participants.some((person) => person.id === existingId);

      if (alreadyIn && existingId) {
        setLocalRoom(currentRoom);
        setParticipantId(existingId);
        setNeedsNick(false);
        setProbing(false);
        return;
      }

      const joined = await joinRoom(roomCode, nick);
      writeSession({
        roomCode: joined.room.code,
        participantId: joined.participant.id,
        nickname: joined.participant.nickname,
      });
      setLocalRoom(joined.room);
      setParticipantId(joined.participant.id);
      setNeedsNick(false);
      setProbing(false);
    },
    [roomCode],
  );

  useEffect(() => {
    let cancelled = false;

    async function probe() {
      try {
        const current = await getRoom(roomCode);
        if (cancelled) return;

        const session = readSession();
        if (session?.roomCode === roomCode) {
          setNickname(session.nickname);
          await enter(session.nickname, session.participantId, current.room);
          return;
        }

        setNeedsNick(true);
        setProbing(false);
      } catch (err) {
        if (cancelled) return;
        const kind = roomGoneKind(err);
        if (kind) {
          markGone(kind);
          return;
        }
        setError(err instanceof ApiError ? err.message : "Oda kontrol edilemedi.");
        setProbing(false);
      }
    }

    void probe();
    return () => {
      cancelled = true;
    };
  }, [enter, markGone, roomCode]);

  async function onJoinGate(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      await enter(nickname);
    } catch (err) {
      const kind = roomGoneKind(err);
      if (kind) {
        markGone(kind);
        return;
      }
      setError(err instanceof ApiError ? err.message : "Odaya girilemedi.");
    } finally {
      setPending(false);
    }
  }

  async function onLeave() {
    if (participantId) {
      await leaveRoom(roomCode, participantId).catch(() => undefined);
    }
    clearSession();
    router.push("/");
  }

  async function onCopy() {
    await navigator.clipboard.writeText(roomCode);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  if (goneState) {
    return <GoneScreen kind={goneState} />;
  }

  if (probing) {
    return (
      <main className="flex min-h-full flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="text-mist">Oda kontrol ediliyor…</p>
        {error && <p className="text-sm text-ember">{error}</p>}
      </main>
    );
  }

  if (needsNick) {
    return (
      <main className="mx-auto flex min-h-full max-w-md flex-col justify-center px-6">
        <p className="text-xs tracking-[0.25em] text-mist uppercase">Oda</p>
        <h1 className="mt-2 font-mono text-3xl tracking-[0.2em]">{roomCode}</h1>
        <form onSubmit={onJoinGate} className="mt-8 flex flex-col gap-4">
          <input
            autoFocus
            maxLength={20}
            value={nickname}
            onChange={(event) => setNickname(event.target.value)}
            placeholder="Nickini yaz"
            className="h-12 rounded-2xl border border-line bg-panel px-4 outline-none focus:border-acid"
          />
          {error && <p className="text-sm text-ember">{error}</p>}
          <button
            type="submit"
            disabled={pending || !nickname.trim()}
            className="h-12 rounded-2xl bg-acid text-sm font-semibold text-ink hover:bg-acid-glow disabled:opacity-40"
          >
            {pending ? "Katılıyor…" : "Odaya gir"}
          </button>
        </form>
      </main>
    );
  }

  if (!room || !participantId) {
    return (
      <main className="flex min-h-full flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="text-mist">Odaya bağlanıyor…</p>
        {error && <p className="text-sm text-ember">{error}</p>}
      </main>
    );
  }

  return (
    <RoomSession
      room={room}
      participantId={participantId}
      channel={channel}
      copied={copied}
      onCopy={() => void onCopy()}
      onLeave={() => void onLeave()}
    />
  );
}
