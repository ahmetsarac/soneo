"use client";

import { VoiceMeter } from "@/components/VoiceMeter";

export function MediaBar({
  micOn,
  camOn,
  level,
  canToggleMic,
  canToggleCam,
  onToggleMic,
  onToggleCam,
  screenOn,
  onToggleScreen,
  noiseOn,
  canToggleNoise,
  onToggleNoise,
  chatOpen,
  chatUnread = 0,
  onToggleChat,
}: {
  micOn: boolean;
  camOn: boolean;
  level: number;
  canToggleMic: boolean;
  canToggleCam: boolean;
  onToggleMic: () => void;
  onToggleCam: () => void;
  screenOn: boolean;
  onToggleScreen: () => void;
  noiseOn: boolean;
  canToggleNoise: boolean;
  onToggleNoise: () => void;
  chatOpen: boolean;
  chatUnread?: number;
  onToggleChat: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4">
      <VoiceMeter level={micOn ? level : 0} />
      <button
        type="button"
        onClick={onToggleMic}
        disabled={!canToggleMic}
        aria-pressed={micOn}
        aria-label={micOn ? "Mikrofonu kapat" : "Mikrofonu aç"}
        className={`relative flex h-12 w-12 items-center justify-center rounded-full border transition disabled:opacity-40 ${
          micOn
            ? "border-line bg-white/8 hover:border-acid"
            : "border-ember bg-ember text-ink hover:border-ember"
        }`}
        title={micOn ? "Mikrofonu kapat" : "Mikrofonu aç"}
      >
        <MicIcon off={!micOn} />
      </button>
      <button
        type="button"
        onClick={onToggleCam}
        disabled={!canToggleCam}
        aria-pressed={camOn}
        aria-label={camOn ? "Kamerayı kapat" : "Kamerayı aç"}
        className={`flex h-12 w-12 items-center justify-center rounded-full border transition disabled:opacity-40 ${
          camOn
            ? "border-line bg-white/8 hover:border-acid"
            : "border-ember bg-ember text-ink hover:border-ember"
        }`}
        title={camOn ? "Kamerayı kapat" : "Kamerayı aç"}
      >
        <CamIcon off={!camOn} />
      </button>
      <button
        type="button"
        onClick={onToggleScreen}
        aria-pressed={screenOn}
        aria-label={screenOn ? "Paylaşımı durdur" : "Ekranı paylaş"}
        className={`flex h-12 w-12 items-center justify-center rounded-full border transition ${
          screenOn
            ? "border-acid bg-acid text-ink hover:bg-acid-glow"
            : "border-line bg-white/8 hover:border-acid"
        }`}
        title={screenOn ? "Paylaşımı durdur" : "Ekranı paylaş"}
      >
        <ScreenIcon />
      </button>
      <button
        type="button"
        onClick={onToggleNoise}
        disabled={!canToggleNoise}
        aria-pressed={noiseOn}
        aria-label={
          noiseOn ? "Gürültü engelleme açık" : "Gürültü engelleme kapalı"
        }
        className={`flex h-12 w-12 items-center justify-center rounded-full border transition disabled:opacity-40 ${
          noiseOn
            ? "border-acid bg-acid text-ink hover:bg-acid-glow"
            : "border-line bg-white/8 hover:border-acid"
        }`}
        title={noiseOn ? "Gürültü engelleme açık" : "Gürültü engelleme kapalı"}
      >
        <NoiseIcon />
      </button>
      <button
        type="button"
        onClick={onToggleChat}
        aria-pressed={chatOpen}
        aria-label={chatOpen ? "Sohbeti kapat" : "Sohbeti aç"}
        title={chatOpen ? "Sohbeti kapat" : "Sohbeti aç"}
        className={`relative flex h-12 w-12 items-center justify-center rounded-full border transition ${
          chatOpen
            ? "border-acid bg-acid text-ink hover:bg-acid-glow"
            : "border-line bg-white/8 hover:border-acid"
        }`}
      >
        <ChatIcon />
        {chatUnread > 0 && !chatOpen && (
          <span className="absolute -top-0.5 -right-0.5 min-w-4 rounded-full bg-ember px-1 text-[10px] leading-4 font-semibold text-white">
            {chatUnread > 9 ? "9+" : chatUnread}
          </span>
        )}
      </button>
    </div>
  );
}

function MicIcon({ off }: { off: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 3a3 3 0 0 1 3 3v6a3 3 0 1 1-6 0V6a3 3 0 0 1 3-3Z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M6.5 11a5.5 5.5 0 0 0 11 0M12 16.5V21"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      {off && (
        <path d="M4 5l16 14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      )}
    </svg>
  );
}

function CamIcon({ off }: { off: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="7" width="12" height="10" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M15 10.5l5-2.5v8l-5-2.5" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      {off && (
        <path d="M4 5l16 14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      )}
    </svg>
  );
}

function ScreenIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="4" width="18" height="12" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8 20h8M12 16v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function NoiseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 12h2l1.5-4 2 8 2-10 2 8 1.5-4H20"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ChatIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M5 6.5A2.5 2.5 0 0 1 7.5 4h9A2.5 2.5 0 0 1 19 6.5v7a2.5 2.5 0 0 1-2.5 2.5H11l-4 4v-4H7.5A2.5 2.5 0 0 1 5 13.5v-7Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}
