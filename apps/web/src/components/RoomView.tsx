"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ChatPanel } from "@/components/ChatPanel";
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
import { clampVolume, readPeerVolumes, writePeerVolumes } from "@/lib/volume";
import { isPeerConnected } from "@/lib/webrtc";

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
        className="rounded-full bg-acid px-5 py-2 text-sm font-semibold text-ink"
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
  const remotes = room.participants.filter((person) => person.id !== participantId);
  const waitingOnPeers =
    remotes.length > 0 &&
    remotes.every((person) => !isPeerConnected(media.iceStates[person.id]));

  useEffect(() => {
    setVolumes(readPeerVolumes());
  }, []);

  useEffect(() => {
    if (!waitingOnPeers) {
      setShowLinking(false);
      return;
    }
    setShowLinking(true);
    const timer = window.setTimeout(() => setShowLinking(false), 10_000);
    return () => window.clearTimeout(timer);
  }, [waitingOnPeers]);

  function setPeerVolume(nickname: string, value: number) {
    setVolumes((current) => {
      const next = { ...current, [nickname]: clampVolume(value) };
      writePeerVolumes(next);
      return next;
    });
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex items-center justify-between gap-4 border-b border-line px-4 py-3 md:px-6">
        <div className="flex items-center gap-3">
          <Link href="/" className="font-display text-lg tracking-tight">
            soneo
          </Link>
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
          <button
            type="button"
            onClick={onLeave}
            className="rounded-full border border-line px-3 py-1.5 hover:border-ember hover:text-ember"
          >
            Ayrıl
          </button>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="flex min-h-[55vh] flex-col gap-4 p-4 md:p-6 lg:min-h-0">
          <div className="flex shrink-0 items-end justify-between">
            <h2 className="font-display text-xl">Ses</h2>
            <p className="text-xs text-mist">
              {media.mediaError ??
                (waitingOnPeers ? "Bağlantı kuruluyor…" : "Aynı odada, tarayıcıdan tarayıcıya")}
            </p>
          </div>
          <div className="relative flex min-h-0 flex-1 flex-col">
            <ParticipantGrid
              presenterId={
                media.screenOn
                  ? participantId
                  : (room.participants.find((person) => person.screenOn)?.id ?? null)
              }
              onVolumeChange={setPeerVolume}
              tiles={room.participants.map((participant) => {
                const self = participant.id === participantId;
                const presenting = self ? media.screenOn : participant.screenOn;
                const cameraStream = self
                  ? media.localStream
                  : (media.remoteStreams[participant.id] ?? null);
                const screenStream = self
                  ? media.localScreen
                  : (media.remoteScreens[participant.id] ?? null);
                return {
                  participant,
                  self,
                  stream: presenting ? screenStream : cameraStream,
                  cameraStream,
                  level: media.levels[participant.id] ?? 0,
                  micOn: self ? media.micOn : participant.micOn,
                  camOn: self ? media.camOn : participant.camOn,
                  iceState: self ? undefined : media.iceStates[participant.id],
                  volume: self ? 0 : (volumes[participant.nickname] ?? 1),
                  presenting,
                };
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
            />
          </div>
        </section>

        <ChatPanel
          messages={channel.messages}
          selfId={participantId}
          connected={channel.connected}
          onSend={channel.sendChat}
        />
      </div>
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
            className="h-12 rounded-2xl bg-acid text-sm font-semibold text-ink disabled:opacity-40"
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
