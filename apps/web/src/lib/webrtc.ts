export const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

export type SignalPayload = {
  description?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit | null;
};

export function isPolite(selfId: string, remoteId: string) {
  return selfId > remoteId;
}

export function decideIceCandidate(
  hasRemoteDescription: boolean,
  candidate: RTCIceCandidateInit | null,
): "apply" | "queue" | "drop" {
  const usable = Boolean(candidate?.candidate);
  if (!hasRemoteDescription) return usable ? "queue" : "drop";
  if (candidate === null || usable) return "apply";
  return "drop";
}

export function inboundVideoRole(existingVideoTracks: number) {
  return existingVideoTracks > 0 ? "screen" : "camera";
}

export function assignInboundVideo(
  transceiver: "camera" | "screen" | "unknown",
  cameraAlreadyHasVideo: boolean,
): "camera" | "screen" {
  if (transceiver === "screen") return "screen";
  if (transceiver === "camera") return "camera";
  return cameraAlreadyHasVideo ? "screen" : "camera";
}

export function offerCollisionAction(
  polite: boolean,
  makingOffer: boolean,
  signalingState: string,
): "apply" | "ignore" | "rollback" {
  const collision = makingOffer || signalingState !== "stable";
  if (!collision) return "apply";
  return polite ? "rollback" : "ignore";
}

export function canApplyRemoteDescription(signalingState: string, type: string) {
  if (type === "answer" || type === "pranswer") {
    return (
      signalingState === "have-local-offer" ||
      signalingState === "have-local-pranswer"
    );
  }
  return true;
}

export function isSdpOrderError(err: unknown) {
  const text = err instanceof Error ? err.message : String(err);
  return /m-lines/i.test(text) || /order from previous offer/i.test(text);
}

export function sdpSessionId(sdp?: string | null) {
  const match = sdp?.match(/^o=\S+\s+(\S+)/m);
  return match?.[1] ?? null;
}

export function shouldResetForOffer(
  existingRemoteSdp?: string | null,
  incomingSdp?: string | null,
) {
  const previous = sdpSessionId(existingRemoteSdp);
  const next = sdpSessionId(incomingSdp);
  return Boolean(previous && next && previous !== next);
}

export function isPeerConnecting(iceState?: string) {
  return (
    !iceState ||
    iceState === "new" ||
    iceState === "checking" ||
    iceState === "disconnected"
  );
}

export function isPeerConnected(iceState?: string) {
  return iceState === "connected" || iceState === "completed";
}

export function shouldResetPeer(iceState: string, connectionState: string) {
  return (
    iceState === "failed" ||
    iceState === "closed" ||
    connectionState === "failed" ||
    connectionState === "closed" ||
    connectionState === "disconnected"
  );
}

export function serializeDescription(
  desc: { type?: string; sdp?: string | null } | null | undefined,
): RTCSessionDescriptionInit | null {
  if (!desc?.type || typeof desc.sdp !== "string") return null;
  return { type: desc.type as RTCSdpType, sdp: desc.sdp };
}

export function serializeCandidate(
  candidate: RTCIceCandidateInit | null,
): RTCIceCandidateInit | null {
  if (!candidate) return null;
  return {
    candidate: candidate.candidate ?? "",
    sdpMid: candidate.sdpMid ?? null,
    sdpMLineIndex: candidate.sdpMLineIndex ?? null,
    usernameFragment: candidate.usernameFragment,
  };
}

const LEVEL_GAIN = 10;
const NOISE_FLOOR = 0.05;

export function levelFromTimeDomain(bytes: ArrayLike<number>) {
  if (bytes.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < bytes.length; i += 1) {
    const sample = (bytes[i]! - 128) / 128;
    sum += sample * sample;
  }
  return Math.min(1, Math.sqrt(sum / bytes.length) * LEVEL_GAIN);
}

export function litBarsFromLevel(level: number, barCount = 5) {
  const clamped = Math.min(1, Math.max(0, level));
  if (clamped < NOISE_FLOOR) return 0;
  return Math.min(barCount, Math.ceil(clamped * barCount));
}
