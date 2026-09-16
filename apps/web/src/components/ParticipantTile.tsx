"use client";

import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type SyntheticEvent,
} from "react";
import type { Participant } from "@/lib/api";
import { UserContextMenu } from "@/components/UserContextMenu";
import { VoiceMeter } from "@/components/VoiceMeter";
import {
  exitFullscreen,
  isOurFullscreen,
  shouldReleaseFullscreen,
  subscribeFullscreenChange,
  toggleFullscreen,
} from "@/lib/fullscreen";
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
  playAudio = true,
  onSelect,
  watchAction,
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
  playAudio?: boolean;
  onSelect?: () => void;
  watchAction?: {
    kind: "watch" | "stop";
    label: string;
    onClick: () => void;
  };
}) {
  const tileRef = useRef<HTMLElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const pressTimer = useRef(0);
  const pressOrigin = useRef<{ x: number; y: number } | null>(null);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
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

  useEffect(() => {
    const sync = () => {
      setFullscreen(isOurFullscreen(tileRef.current, videoRef.current));
    };
    sync();
    return subscribeFullscreenChange(sync, videoRef.current);
  }, [presenting, showVideo, trackKey]);

  useEffect(() => {
    if (!shouldReleaseFullscreen(presenting, showVideo)) return;
    if (!isOurFullscreen(tileRef.current, videoRef.current)) return;
    void exitFullscreen(videoRef.current);
  }, [presenting, showVideo]);

  function openMenu(x: number, y: number) {
    if (self) return;
    setMenu({ x, y });
  }

  function clearPress() {
    window.clearTimeout(pressTimer.current);
    pressTimer.current = 0;
    pressOrigin.current = null;
  }

  function onToggleFullscreen(event: SyntheticEvent) {
    event.stopPropagation();
    event.preventDefault();
    const tile = tileRef.current;
    if (!tile) return;
    void toggleFullscreen(tile, videoRef.current);
  }

  const showShareBadge = presenting;
  const interactive = Boolean(onSelect);
  const enlargeLabel = `${participant.nickname} kamerasını büyüt`;
  const Tag = interactive && !compact ? "button" : "article";
  const watchOverlay = watchAction?.kind === "watch";
  const stopWatch = watchAction?.kind === "stop";

  return (
    <Tag
      {...(interactive && !compact
        ? {
            type: "button" as const,
            "aria-label": enlargeLabel,
            onClick: onSelect,
          }
        : interactive
          ? {
              role: "button" as const,
              tabIndex: 0,
              "aria-label": enlargeLabel,
              onClick: onSelect,
              onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
                if (event.key !== "Enter" && event.key !== " ") return;
                event.preventDefault();
                onSelect?.();
              },
            }
          : {})}
      ref={(node) => {
        tileRef.current = node;
      }}
      className={`relative flex h-full min-h-0 w-full min-w-0 flex-col justify-end overflow-hidden border bg-panel text-left select-none transition ${
        interactive
          ? "m-0 min-h-0 cursor-pointer hover:border-acid"
          : "cursor-default"
      } ${compact ? "rounded-2xl p-2 touch-pan-x lg:touch-auto" : "rounded-3xl p-4"} ${
        presenting ? "group screen-share-tile" : ""
      } ${
        speaking
          ? "border-acid shadow-[0_0_0_1px_rgba(214,255,63,0.35)]"
          : "border-line"
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
      onDoubleClick={() => {
        if (compact || !presenting || !showVideo) return;
        const tile = tileRef.current;
        if (!tile) return;
        void toggleFullscreen(tile, videoRef.current);
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
      {!self && playAudio && <audio ref={audioRef} autoPlay />}
      {presenting && showVideo && !compact && (
        <button
          type="button"
          className={`absolute top-3 right-3 z-[2] flex h-10 w-10 items-center justify-center rounded-full bg-black/55 text-paper transition hover:bg-black/75 hover:text-acid ${
            fullscreen
              ? "opacity-100"
              : "opacity-100 lg:opacity-0 lg:group-hover:opacity-100 lg:group-focus-within:opacity-100"
          }`}
          title={fullscreen ? "Tam ekrandan çık" : "Tam ekran izle"}
          aria-label={fullscreen ? "Tam ekrandan çık" : "Tam ekran izle"}
          aria-pressed={fullscreen}
          onClick={onToggleFullscreen}
          onDoubleClick={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <FullscreenIcon exit={fullscreen} />
        </button>
      )}
      {connecting && (
        <div className="absolute inset-0 z-[1] flex flex-col items-center justify-center gap-2 bg-panel/80">
          <span className="h-7 w-7 animate-spin rounded-full border-2 border-line border-t-acid" />
          {!compact && <p className="text-xs text-mist">Bağlanıyor…</p>}
        </div>
      )}
      {watchOverlay && watchAction && (
        <div className="pointer-events-none absolute inset-0 z-[3] flex items-center justify-center p-2">
          <button
            type="button"
            onClick={watchAction.onClick}
            onPointerDown={(event) => event.stopPropagation()}
            className={`pointer-events-auto rounded-full bg-acid font-semibold text-ink hover:bg-acid-glow ${
              compact ? "px-2.5 py-1 text-[11px]" : "px-4 py-2 text-sm"
            }`}
          >
            {watchAction.label}
          </button>
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

      <div className="relative flex min-w-0 items-end justify-between gap-2">
        <p className="min-w-0 truncate text-sm font-medium drop-shadow">
          {participant.nickname}
          {self && <span className="text-mist"> (sen)</span>}
        </p>
        <div className="flex shrink-0 items-center gap-1.5">
          {showShareBadge && (
            <span className="rounded-full bg-acid px-2 py-0.5 text-[10px] font-semibold tracking-wide text-ink uppercase">
              ekran
            </span>
          )}
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

      {stopWatch && watchAction && (
        <button
          type="button"
          onClick={watchAction.onClick}
          onPointerDown={(event) => event.stopPropagation()}
          className="relative z-[2] mt-2 w-fit self-center rounded-full border border-acid bg-black/55 px-3 py-1.5 text-sm hover:bg-acid hover:text-ink"
        >
          {watchAction.label}
        </button>
      )}

      {menu && (
        <UserContextMenu
          nickname={participant.nickname}
          volume={volume}
          audioLabel={presenting ? "Yayın sesi" : "Kullanıcı sesi"}
          x={menu.x}
          y={menu.y}
          onVolumeChange={onVolumeChange}
          onClose={() => setMenu(null)}
        />
      )}
    </Tag>
  );
}

function FullscreenIcon({ exit }: { exit: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      {exit ? (
        <>
          <path
            d="M9 3v6H3M15 3v6h6M9 21v-6H3M15 21v-6h6"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      ) : (
        <>
          <path
            d="M9 3H3v6M15 3h6v6M9 21H3v-6M15 21h6v-6"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      )}
    </svg>
  );
}
