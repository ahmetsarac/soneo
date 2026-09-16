export type PresenceCue = "join" | "leave";

type Tone = {
  freq: number;
  delay: number;
  duration: number;
  peak: number;
};

const JOIN_TONES: Tone[] = [
  { freq: 523.25, delay: 0, duration: 0.11, peak: 0.16 },
  { freq: 783.99, delay: 0.08, duration: 0.16, peak: 0.2 },
];

const LEAVE_TONES: Tone[] = [
  { freq: 659.25, delay: 0, duration: 0.1, peak: 0.13 },
  { freq: 440, delay: 0.07, duration: 0.18, peak: 0.16 },
];

let cueContext: AudioContext | null = null;

export function presenceCueFromMessage(message: {
  kind: string;
  text: string;
}): PresenceCue | null {
  if (message.kind !== "system") return null;
  if (message.text.endsWith(" katıldı")) return "join";
  if (message.text.endsWith(" ayrıldı")) return "leave";
  return null;
}

export function tonesForCue(kind: PresenceCue) {
  return kind === "join" ? JOIN_TONES : LEAVE_TONES;
}

function audioContext() {
  if (typeof window === "undefined") return null;
  const Ctor =
    window.AudioContext ||
    (window as typeof window & { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!Ctor) return null;
  if (!cueContext) cueContext = new Ctor();
  return cueContext;
}

function playTone(context: AudioContext, tone: Tone, when: number) {
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(tone.freq, when);

  const attack = 0.008;
  const end = when + tone.duration;
  gain.gain.setValueAtTime(0, when);
  gain.gain.linearRampToValueAtTime(tone.peak, when + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, end);

  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start(when);
  oscillator.stop(end + 0.02);
}

export async function playPresenceCue(kind: PresenceCue) {
  const context = audioContext();
  if (!context) return;
  if (context.state === "suspended") {
    try {
      await context.resume();
    } catch {
      return;
    }
  }

  const start = context.currentTime + 0.01;
  for (const tone of tonesForCue(kind)) {
    playTone(context, tone, start + tone.delay);
  }
}
