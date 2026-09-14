"use client";

import { useEffect, useRef, useState } from "react";
import type { Participant } from "@/lib/api";
import { UserContextMenu } from "@/components/UserContextMenu";
import { VoiceMeter } from "@/components/VoiceMeter";
import { isPeerConnecting, litBarsFromLevel } from "@/lib/webrtc";

function hueFromName(name: string) {
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) % 360;
  return hash;
}

export function ParticipantTile({
  participant,
  self,
  stream,
  level,
  micOn,
  camOn,
  iceState,
  volume,
  onVolumeChange,
  presenting = false,
  compact = false,
}: {
  participant: Participant;
  self: boolean;
  stream: MediaStream | null;
  level: number;
  micOn: boolean;
  camOn: boolean;
  iceState?: string;
  volume: number;
  onVolumeChange: (volume: number) => void;
  presenting?: boolean;
  compact?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const pressTimer = useRef(0);
  const pressOrigin = useRef<{ x: number; y: number } | null>(null);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const hue = hueFromName(participant.nickname);
  const speaking = micOn && litBarsFromLevel(level) > 0;
  const liveVideo = Boolean(
    stream?.getVideoTracks().some((track) => track.readyState === "live"),
  );
  const showVideo = liveVideo && (presenting || camOn);
  const connecting = !self && isPeerConnecting(iceState);
  const localMuted = !self && volume === 0;
  const trackKey = stream
    ? stream.getTracks().map((track) => `${track.kind}:${track.id}`).join("|")
    : "";

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.srcObject = stream;
    video.muted = true;
    void video.play().catch(() => undefined);
    if (!stream) return;

    const replay = () => {
      video.srcObject = stream;
      void video.play().catch(() => undefined);
    };
    const tracks = stream.getVideoTracks();
    for (const track of tracks) {
      track.addEventListener("unmute", replay);
      track.addEventListener("ended", replay);
    }
    return () => {
      for (const track of tracks) {
        track.removeEventListener("unmute", replay);
        track.removeEventListener("ended", replay);
      }
    };
  }, [stream, trackKey, showVideo]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.srcObject = stream;
    const play = () => {
      void audio.play().catch(() => undefined);
    };
    play();
    window.addEventListener("pointerdown", play);
    window.addEventListener("keydown", play);
    return () => {
      window.removeEventListener("pointerdown", play);
      window.removeEventListener("keydown", play);
    };
  }, [stream, trackKey]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = volume;
    audio.muted = volume === 0;
  }, [volume, trackKey]);

  function openMenu(x: number, y: number) {
    if (self) return;
    setMenu({ x, y });
  }

  function clearPress() {
    window.clearTimeout(pressTimer.current);
    pressTimer.current = 0;
    pressOrigin.current = null;
  }

  return (
    <article
      className={`relative flex h-full min-h-0 cursor-default flex-col justify-end overflow-hidden rounded-3xl border bg-panel select-none transition ${
        compact ? "p-2" : "p-4"
      } ${
        speaking ? "border-acid shadow-[0_0_0_1px_rgba(214,255,63,0.35)]" : "border-line"
      }`}
      onContextMenu={(event) => {
        if (self) return;
        event.preventDefault();
        openMenu(event.clientX, event.clientY);
      }}
      onPointerDown={(event) => {
        if (self || event.pointerType !== "touch") return;
        clearPress();
        pressOrigin.current = { x: event.clientX, y: event.clientY };
        pressTimer.current = window.setTimeout(() => {
          openMenu(event.clientX, event.clientY);
          pressTimer.current = 0;
        }, 480);
      }}
      onPointerUp={clearPress}
      onPointerCancel={clearPress}
      onPointerMove={(event) => {
        const origin = pressOrigin.current;
        if (!origin) return;
        const dx = event.clientX - origin.x;
        const dy = event.clientY - origin.y;
        if (dx * dx + dy * dy > 144) clearPress();
      }}
    >
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className={`absolute inset-0 h-full w-full bg-black ${
          presenting ? "object-contain" : "object-cover"
        } ${self && !presenting ? "-scale-x-100" : ""} ${
          showVideo ? "opacity-100" : "opacity-0"
        }`}
      />
      {!self && <audio ref={audioRef} autoPlay />}
      {connecting && (
        <div className="absolute inset-0 z-[1] flex flex-col items-center justify-center gap-2 bg-panel/80">
          <span className="h-7 w-7 animate-spin rounded-full border-2 border-line border-t-acid" />
          {!compact && <p className="text-xs text-mist">Bağlanıyor…</p>}
        </div>
      )}
      {!showVideo && (
        <>
          <div
            className="absolute inset-0 opacity-40"
            style={{
              background: `radial-gradient(circle at 50% 30%, hsl(${hue} 70% 42%), transparent 62%)`,
            }}
          />
          <div
            className={`absolute top-1/2 left-1/2 flex -translate-x-1/2 items-center justify-center rounded-full font-semibold text-paper ${
              compact
                ? "h-12 w-12 -translate-y-1/2 text-lg"
                : "h-20 w-20 -translate-y-[70%] text-2xl"
            }`}
            style={{ background: `hsl(${hue} 45% 22%)` }}
          >
            {participant.nickname.slice(0, 1).toUpperCase()}
          </div>
        </>
      )}

      <div className="relative flex items-end justify-between gap-2">
        <p className="truncate text-sm font-medium drop-shadow">
          {participant.nickname}
          {self && <span className="text-mist"> (sen)</span>}
          {presenting && (
            <span className="ml-2 rounded-full bg-acid px-2 py-0.5 text-[10px] font-semibold tracking-wide text-ink uppercase">
              ekran
            </span>
          )}
        </p>
        <div className="flex shrink-0 items-center gap-1.5">
          {speaking && <VoiceMeter level={level} />}
          {localMuted && (
            <span className="rounded-full bg-black/45 px-2 py-0.5 text-[11px] tracking-wide text-ember uppercase">
              kısık
            </span>
          )}
          {!micOn && (
            <span className="rounded-full bg-black/45 px-2 py-0.5 text-[11px] tracking-wide text-paper uppercase">
              susturuldu
            </span>
          )}
          {(connecting || iceState === "checking") && (
            <span className="rounded-full bg-black/45 px-2 py-0.5 text-[11px] tracking-wide text-paper uppercase">
              bağlanıyor
            </span>
          )}
        </div>
      </div>

      {menu && (
        <UserContextMenu
          nickname={participant.nickname}
          volume={volume}
          x={menu.x}
          y={menu.y}
          onVolumeChange={onVolumeChange}
          onClose={() => setMenu(null)}
        />
      )}
    </article>
  );
}
