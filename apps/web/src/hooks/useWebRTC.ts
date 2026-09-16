"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Participant } from "@/lib/api";
import type { ServerEvent } from "@/lib/realtime";
import {
  ICE_SERVERS,
  assignInboundAudio,
  assignInboundVideo,
  canApplyRemoteDescription,
  decideIceCandidate,
  isPolite,
  isSdpOrderError,
  offerCollisionAction,
  shouldResetForOffer,
  shouldResetPeer,
  gatedVoiceLevel,
  levelFromTimeDomain,
  litBarsFromLevel,
  nextSpeakingState,
  serializeCandidate,
  serializeDescription,
  type SignalPayload,
} from "@/lib/webrtc";
import { createNoiseFilter, type NoiseFilter } from "@/lib/noiseFilter";
import { readNoiseSuppression, writeNoiseSuppression } from "@/lib/noise";

type PeerSlot = {
  pc: RTCPeerConnection;
  makingOffer: boolean;
  ignoreOffer: boolean;
  settingRemoteAnswer: boolean;
  iceTimer: number;
  restarts: number;
  pendingIce: RTCIceCandidateInit[];
  queuedLocalIce: RTCIceCandidateInit[];
  localSdpSent: boolean;
  pauseNego: boolean;
  signalChain: Promise<void>;
  audioSender: RTCRtpSender;
  videoSender: RTCRtpSender;
  screenSender: RTCRtpSender;
  screenAudioSender: RTCRtpSender;
  cameraTransceiver: RTCRtpTransceiver;
  screenTransceiver: RTCRtpTransceiver;
  screenAudioTransceiver: RTCRtpTransceiver;
};

type Meter = {
  stop: () => void;
};

type PlaceholderVideo = {
  track: MediaStreamTrack;
  stop: () => void;
};

function createPlaceholderVideo(): PlaceholderVideo | null {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = 16;
  canvas.height = 16;
  canvas.setAttribute("aria-hidden", "true");
  canvas.style.cssText =
    "position:fixed;left:-99px;top:-99px;width:1px;height:1px;opacity:0;pointer-events:none";
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  document.body.appendChild(canvas);
  const paint = () => {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, 16, 16);
  };
  paint();
  const stream = canvas.captureStream(5);
  const track = stream.getVideoTracks()[0];
  if (!track) {
    canvas.remove();
    return null;
  }
  track.enabled = true;
  const timer = window.setInterval(paint, 250);
  return {
    track,
    stop() {
      window.clearInterval(timer);
      track.stop();
      canvas.remove();
    },
  };
}

async function readMic() {
  try {
    return await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
      video: false,
    });
  } catch {
    return null;
  }
}

async function readDisplay() {
  const withAudio = {
    video: true,
    audio: {
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
    },
    systemAudio: "include" as const,
  };
  try {
    return await navigator.mediaDevices.getDisplayMedia(withAudio);
  } catch (err) {
    const name = err instanceof DOMException ? err.name : "";
    if (name === "AbortError" || name === "NotAllowedError") throw err;
    return navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: false,
    });
  }
}

function attachTrack(stream: MediaStream, track: MediaStreamTrack) {
  for (const existing of [...stream.getTracks()]) {
    if (existing.kind === track.kind && existing.id !== track.id) {
      stream.removeTrack(existing);
    }
  }
  if (!stream.getTracks().some((item) => item.id === track.id)) {
    stream.addTrack(track);
  }
}

async function readCamera() {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: false,
    video: {
      width: { ideal: 960 },
      height: { ideal: 540 },
      facingMode: "user",
    },
  });
  const track = stream.getVideoTracks()[0] ?? null;
  if (!track) {
    stream.getTracks().forEach((item) => item.stop());
    return null;
  }
  return track;
}

function startMeter(stream: MediaStream, onLevel: (level: number) => void): Meter {
  const originals = stream.getAudioTracks();
  if (originals.length === 0) {
    return { stop() {} };
  }

  const clones = originals.map((track) => track.clone());
  const context = new AudioContext();
  const source = context.createMediaStreamSource(new MediaStream(clones));
  const analyser = context.createAnalyser();
  analyser.fftSize = 512;
  analyser.smoothingTimeConstant = 0.5;
  source.connect(analyser);
  const bytes = new Uint8Array(analyser.fftSize);
  let raf = 0;
  let last = 0;
  let stopped = false;
  let speaking = false;
  let holdUntil = 0;

  const tick = () => {
    if (stopped) return;
    analyser.getByteTimeDomainData(bytes);
    const raw = levelFromTimeDomain(bytes);
    const now = performance.now();
    const next = nextSpeakingState(raw, speaking, holdUntil, now);
    speaking = next.speaking;
    holdUntil = next.holdUntil;
    const level = gatedVoiceLevel(raw, speaking);
    if (now - last > 40) {
      last = now;
      onLevel(level);
    }
    raf = requestAnimationFrame(tick);
  };

  void context.resume();
  tick();

  return {
    stop() {
      stopped = true;
      cancelAnimationFrame(raf);
      clones.forEach((track) => track.stop());
      void context.close();
    },
  };
}

function asSignal(data: unknown): SignalPayload | null {
  if (!data || typeof data !== "object") return null;
  return data as SignalPayload;
}

function enqueue(slot: PeerSlot, work: () => Promise<void>) {
  slot.signalChain = slot.signalChain
    .then(work)
    .catch((err) => {
      console.error(err);
    });
}

export function useWebRTC({
  selfId,
  peers,
  connected,
  sendSignal,
  sendMedia,
  subscribe,
}: {
  selfId: string;
  peers: Participant[];
  connected: boolean;
  sendSignal: (to: string, data: unknown) => boolean;
  sendMedia: (state: {
    micOn: boolean;
    camOn: boolean;
    screenOn: boolean;
  }) => boolean;
  subscribe: (listener: (event: ServerEvent) => void) => () => void;
}) {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>(
    {},
  );
  const [remoteScreens, setRemoteScreens] = useState<Record<string, MediaStream>>(
    {},
  );
  const [levels, setLevels] = useState<Record<string, number>>({});
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(false);
  const [screenOn, setScreenOn] = useState(false);
  const [localScreen, setLocalScreen] = useState<MediaStream | null>(null);
  const [mediaReady, setMediaReady] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [iceStates, setIceStates] = useState<Record<string, string>>({});
  const [noiseOn, setNoiseOn] = useState(true);

  const peersRef = useRef(new Map<string, PeerSlot>());
  const localRef = useRef<MediaStream | null>(null);
  const remotesRef = useRef(new Map<string, MediaStream>());
  const screensRef = useRef(new Map<string, MediaStream>());
  const screenStreamRef = useRef<MediaStream | null>(null);
  const cameraPlaceholderRef = useRef<PlaceholderVideo | null>(null);
  const noiseFilterRef = useRef<NoiseFilter | null>(null);
  const camRequestRef = useRef(0);
  const metersRef = useRef(new Map<string, Meter>());
  const sendSignalRef = useRef(sendSignal);
  const sendMediaRef = useRef(sendMedia);
  const micRef = useRef(micOn);
  const camRef = useRef(camOn);
  const screenOnRef = useRef(screenOn);
  const noiseOnRef = useRef(noiseOn);
  const applyOutgoingTracksRef = useRef<() => void>(() => undefined);
  const startNoiseFilterRef = useRef<() => Promise<boolean>>(async () => false);
  sendSignalRef.current = sendSignal;
  sendMediaRef.current = sendMedia;
  micRef.current = micOn;
  camRef.current = camOn;
  screenOnRef.current = screenOn;
  noiseOnRef.current = noiseOn;

  const setLevel = useCallback((id: string, level: number) => {
    setLevels((current) => {
      const previous = current[id] ?? 0;
      if (litBarsFromLevel(previous) === litBarsFromLevel(level)) {
        return current;
      }
      return { ...current, [id]: level };
    });
  }, []);

  const stopMeter = useCallback((id: string) => {
    metersRef.current.get(id)?.stop();
    metersRef.current.delete(id);
  }, []);

  const watchStream = useCallback(
    (id: string, stream: MediaStream) => {
      stopMeter(id);
      metersRef.current.set(id, startMeter(stream, (level) => setLevel(id, level)));
    },
    [setLevel, stopMeter],
  );

  const outgoingCameraTrack = useCallback(() => {
    const camera = localRef.current?.getVideoTracks()[0];
    if (camRef.current && camera && camera.readyState === "live") {
      camera.enabled = true;
      return camera;
    }
    return cameraPlaceholderRef.current?.track ?? null;
  }, []);

  const outgoingScreenTrack = useCallback(() => {
    const screen = screenStreamRef.current?.getVideoTracks()[0];
    if (screenOnRef.current && screen && screen.readyState === "live") return screen;
    return null;
  }, []);

  const outgoingScreenAudioTrack = useCallback(() => {
    const audio = screenStreamRef.current?.getAudioTracks()[0];
    if (screenOnRef.current && audio && audio.readyState === "live") return audio;
    return null;
  }, []);

  const outgoingAudioTrack = useCallback(() => {
    const original = localRef.current?.getAudioTracks()[0] ?? null;
    const processed = noiseFilterRef.current?.track ?? null;
    if (original) original.enabled = micRef.current;
    if (processed) processed.enabled = micRef.current;
    return processed ?? original;
  }, []);

  const applyOutgoingTracks = useCallback(() => {
    const audio = outgoingAudioTrack();
    const camera = outgoingCameraTrack();
    const screen = outgoingScreenTrack();
    const screenAudio = outgoingScreenAudioTrack();
    for (const slot of peersRef.current.values()) {
      void slot.audioSender.replaceTrack(audio);
      void slot.videoSender.replaceTrack(camera);
      void slot.screenSender.replaceTrack(screen);
      void slot.screenAudioSender.replaceTrack(screenAudio);
    }
  }, [
    outgoingAudioTrack,
    outgoingCameraTrack,
    outgoingScreenAudioTrack,
    outgoingScreenTrack,
  ]);
  applyOutgoingTracksRef.current = applyOutgoingTracks;

  const publishLocalStream = useCallback((stream: MediaStream) => {
    localRef.current = stream;
    setLocalStream(new MediaStream(stream.getTracks()));
  }, []);

  const releaseLocalCamera = useCallback(() => {
    camRequestRef.current += 1;
    const stream = localRef.current;
    if (!stream) return;
    for (const track of stream.getVideoTracks()) {
      stream.removeTrack(track);
      track.stop();
    }
    publishLocalStream(stream);
  }, [publishLocalStream]);

  const stopNoiseFilter = useCallback(() => {
    noiseFilterRef.current?.stop();
    noiseFilterRef.current = null;
  }, []);

  const applyMicConstraints = useCallback(async (browserNoise: boolean) => {
    const track = localRef.current?.getAudioTracks()[0];
    if (!track) return;
    try {
      await track.applyConstraints({
        echoCancellation: true,
        noiseSuppression: browserNoise,
        autoGainControl: true,
      });
    } catch {
      // some engines reject mixed constraint updates
    }
  }, []);

  const startNoiseFilter = useCallback(async () => {
    const source = localRef.current?.getAudioTracks()[0];
    if (!source) return false;
    stopNoiseFilter();
    await applyMicConstraints(false);
    const filter = await createNoiseFilter(source);
    if (!filter) {
      await applyMicConstraints(true);
      return false;
    }
    noiseFilterRef.current = filter;
    watchStream(selfId, filter.stream);
    applyOutgoingTracksRef.current();
    return true;
  }, [applyMicConstraints, selfId, stopNoiseFilter, watchStream]);
  startNoiseFilterRef.current = startNoiseFilter;

  const closePeer = useCallback(
    (id: string) => {
      const slot = peersRef.current.get(id);
      if (!slot) return;
      window.clearTimeout(slot.iceTimer);
      slot.pc.close();
      peersRef.current.delete(id);
      remotesRef.current.delete(id);
      screensRef.current.delete(id);
      stopMeter(id);
      setRemoteStreams((current) => {
        const next = { ...current };
        delete next[id];
        return next;
      });
      setRemoteScreens((current) => {
        if (!(id in current)) return current;
        const next = { ...current };
        delete next[id];
        return next;
      });
      setIceStates((current) => {
        const next = { ...current };
        delete next[id];
        return next;
      });
    },
    [stopMeter],
  );

  const publishRemote = useCallback((remoteId: string, stream: MediaStream) => {
    remotesRef.current.set(remoteId, stream);
    setRemoteStreams((current) => ({ ...current, [remoteId]: stream }));
  }, []);

  const publishScreen = useCallback((remoteId: string, stream: MediaStream) => {
    screensRef.current.set(remoteId, stream);
    setRemoteScreens((current) => ({ ...current, [remoteId]: stream }));
  }, []);

  const ensurePeer = useCallback(
    (remoteId: string, opts?: { pauseNego?: boolean }) => {
      const existing = peersRef.current.get(remoteId);
      if (existing) return existing;

      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      const audio = pc.addTransceiver("audio", { direction: "sendrecv" });
      const camera = pc.addTransceiver("video", { direction: "sendrecv" });
      const screen = pc.addTransceiver("video", { direction: "sendrecv" });
      const screenAudio = pc.addTransceiver("audio", { direction: "sendrecv" });
      const slot: PeerSlot = {
        pc,
        makingOffer: false,
        ignoreOffer: false,
        settingRemoteAnswer: false,
        iceTimer: 0,
        restarts: 0,
        pendingIce: [],
        queuedLocalIce: [],
        localSdpSent: false,
        pauseNego: Boolean(opts?.pauseNego),
        signalChain: Promise.resolve(),
        audioSender: audio.sender,
        videoSender: camera.sender,
        screenSender: screen.sender,
        screenAudioSender: screenAudio.sender,
        cameraTransceiver: camera,
        screenTransceiver: screen,
        screenAudioTransceiver: screenAudio,
      };
      peersRef.current.set(remoteId, slot);
      setIceStates((current) => ({ ...current, [remoteId]: pc.iceConnectionState }));

      void slot.audioSender.replaceTrack(outgoingAudioTrack());
      void slot.videoSender.replaceTrack(outgoingCameraTrack());
      void slot.screenSender.replaceTrack(outgoingScreenTrack());
      void slot.screenAudioSender.replaceTrack(outgoingScreenAudioTrack());

      const sendPayload = (data: unknown) => {
        sendSignalRef.current(remoteId, data);
      };

      const flushLocalIce = () => {
        const queued = slot.queuedLocalIce;
        slot.queuedLocalIce = [];
        for (const candidate of queued) {
          sendPayload({ candidate });
        }
      };

      const sendLocalIce = (candidate: RTCIceCandidateInit | null) => {
        const payload = candidate ? serializeCandidate(candidate) : null;
        if (!slot.localSdpSent) {
          if (payload?.candidate) slot.queuedLocalIce.push(payload);
          return;
        }
        sendPayload({ candidate: payload });
      };

      const publishLocalDescription = () => {
        const description = serializeDescription(pc.localDescription);
        if (!description) return;
        sendPayload({ description });
        slot.localSdpSent = true;
        flushLocalIce();
      };

      pc.onnegotiationneeded = () => {
        enqueue(slot, async () => {
          if (slot.pauseNego || pc.signalingState !== "stable") return;
          try {
            slot.makingOffer = true;
            slot.localSdpSent = false;
            slot.queuedLocalIce = [];
            await pc.setLocalDescription();
            publishLocalDescription();
          } finally {
            slot.makingOffer = false;
          }
        });
      };

      pc.onicecandidate = ({ candidate }) => {
        sendLocalIce(candidate ? candidate.toJSON() : null);
      };

      pc.ontrack = ({ track, transceiver }) => {
        if (track.kind === "video") {
          const known =
            transceiver === slot.screenTransceiver
              ? "screen"
              : transceiver === slot.cameraTransceiver
                ? "camera"
                : "unknown";
          const hasCameraVideo =
            (remotesRef.current.get(remoteId)?.getVideoTracks().length ?? 0) > 0;
          const role = assignInboundVideo(known, hasCameraVideo);

          if (role === "screen") {
            const current = screensRef.current.get(remoteId) ?? new MediaStream();
            attachTrack(current, track);
            const published = new MediaStream(current.getTracks());
            publishScreen(remoteId, published);
            const refresh = () => {
              const latest = screensRef.current.get(remoteId);
              if (!latest) return;
              publishScreen(remoteId, new MediaStream(latest.getTracks()));
            };
            track.addEventListener("unmute", refresh);
            track.addEventListener("mute", refresh);
            return;
          }
        }

        if (track.kind === "audio") {
          const known =
            transceiver === slot.screenAudioTransceiver
              ? "screen"
              : transceiver === audio
                ? "mic"
                : "unknown";
          const hasMic =
            (remotesRef.current.get(remoteId)?.getAudioTracks().length ?? 0) > 0;
          const audioRole = assignInboundAudio(known, hasMic);
          if (audioRole === "screen") {
            const current = screensRef.current.get(remoteId) ?? new MediaStream();
            attachTrack(current, track);
            const published = new MediaStream(current.getTracks());
            publishScreen(remoteId, published);
            const refresh = () => {
              const latest = screensRef.current.get(remoteId);
              if (!latest) return;
              publishScreen(remoteId, new MediaStream(latest.getTracks()));
            };
            track.addEventListener("unmute", refresh);
            track.addEventListener("mute", refresh);
            return;
          }
        }

        let remote = remotesRef.current.get(remoteId);
        if (!remote) remote = new MediaStream();
        for (const existing of [...remote.getTracks()]) {
          if (existing.kind === track.kind && existing.id !== track.id) {
            remote.removeTrack(existing);
          }
        }
        if (!remote.getTracks().some((item) => item.id === track.id)) {
          remote.addTrack(track);
        }
        const published = new MediaStream(remote.getTracks());
        publishRemote(remoteId, published);
        if (track.kind === "audio") watchStream(remoteId, published);
        const refresh = () => {
          const current = remotesRef.current.get(remoteId);
          if (!current) return;
          publishRemote(remoteId, new MediaStream(current.getTracks()));
        };
        track.addEventListener("unmute", refresh);
        track.addEventListener("mute", refresh);
      };

      pc.oniceconnectionstatechange = () => {
        const state = pc.iceConnectionState;
        setIceStates((current) => ({ ...current, [remoteId]: state }));
        if (state === "connected" || state === "completed") {
          slot.restarts = 0;
          window.clearTimeout(slot.iceTimer);
          return;
        }
        if (state === "disconnected") {
          window.clearTimeout(slot.iceTimer);
          slot.iceTimer = window.setTimeout(() => {
            if (
              pc.iceConnectionState === "disconnected" ||
              pc.iceConnectionState === "failed"
            ) {
              slot.restarts += 1;
              if (slot.restarts <= 3) pc.restartIce();
            }
          }, 2200);
          return;
        }
        if (state === "failed") {
          slot.restarts += 1;
          if (slot.restarts <= 3) pc.restartIce();
        }
      };

      return slot;
    },
    [outgoingAudioTrack, outgoingCameraTrack, outgoingScreenAudioTrack, outgoingScreenTrack, publishRemote, publishScreen, watchStream],
  );

  const handleSignal = useCallback(
    (from: string, data: unknown) => {
      const payload = asSignal(data);
      if (!payload) return;
      const incoming = payload.description
        ? serializeDescription(payload.description)
        : null;
      const slot =
        peersRef.current.get(from) ??
        ensurePeer(from, { pauseNego: incoming?.type === "offer" });

      enqueue(slot, async () => {
        const polite = isPolite(selfId, from);
        let active = peersRef.current.get(from) ?? slot;

        if (payload.description) {
          const description = serializeDescription(payload.description);
          if (!description) return;

          const existingRemoteSdp =
            active.pc.currentRemoteDescription?.sdp ??
            active.pc.remoteDescription?.sdp;
          if (
            description.type === "offer" &&
            (shouldResetForOffer(existingRemoteSdp, description.sdp) ||
              shouldResetPeer(active.pc.iceConnectionState, active.pc.connectionState))
          ) {
            closePeer(from);
            active = ensurePeer(from, { pauseNego: true });
          }

          const action =
            description.type === "offer"
              ? offerCollisionAction(
                  polite,
                  active.makingOffer,
                  active.pc.signalingState,
                )
              : "apply";

          if (action === "ignore") {
            active.ignoreOffer = true;
            active.pendingIce = [];
            return;
          }

          if (
            (description.type === "answer" || description.type === "pranswer") &&
            !canApplyRemoteDescription(active.pc.signalingState, description.type)
          ) {
            return;
          }

          if (action === "rollback") {
            active.makingOffer = false;
            try {
              await active.pc.setLocalDescription({ type: "rollback" });
            } catch {
              // some engines roll back inside setRemoteDescription
            }
          }

          active.ignoreOffer = false;
          active.settingRemoteAnswer = description.type === "answer";
          try {
            await active.pc.setRemoteDescription(description);
          } catch (err) {
            active.settingRemoteAnswer = false;
            if (description.type === "offer" && isSdpOrderError(err)) {
              closePeer(from);
              active = ensurePeer(from, { pauseNego: true });
              try {
                await active.pc.setRemoteDescription(description);
              } catch (retryErr) {
                if (retryErr instanceof DOMException && retryErr.name === "InvalidStateError") {
                  return;
                }
                throw retryErr;
              }
            } else if (err instanceof DOMException && err.name === "InvalidStateError") {
              return;
            } else {
              throw err;
            }
          }
          active.pauseNego = false;
          active.settingRemoteAnswer = false;

          const queued = active.pendingIce;
          active.pendingIce = [];
          for (const candidate of queued) {
            try {
              await active.pc.addIceCandidate(candidate);
            } catch (err) {
              if (!active.ignoreOffer) console.error(err);
            }
          }

          if (description.type === "offer") {
            active.localSdpSent = false;
            active.queuedLocalIce = [];
            await active.pc.setLocalDescription();
            const answer = serializeDescription(active.pc.localDescription);
            if (answer) {
              sendSignalRef.current(from, { description: answer });
              active.localSdpSent = true;
              const localQueued = active.queuedLocalIce;
              active.queuedLocalIce = [];
              for (const candidate of localQueued) {
                sendSignalRef.current(from, { candidate });
              }
            }
          }
          return;
        }

        if (payload.candidate === undefined) return;
        if (active.ignoreOffer) return;

        const decision = decideIceCandidate(
          Boolean(active.pc.currentRemoteDescription ?? active.pc.remoteDescription),
          payload.candidate,
        );
        if (decision === "queue" && payload.candidate) {
          active.pendingIce.push(payload.candidate);
          return;
        }
        if (decision === "apply") {
          try {
            await active.pc.addIceCandidate(payload.candidate);
          } catch (err) {
            if (!active.ignoreOffer) console.error(err);
          }
        }
      });
    },
    [closePeer, ensurePeer, selfId],
  );

  useEffect(() => {
    cameraPlaceholderRef.current = createPlaceholderVideo();
    let cancelled = false;
    void readMic().then(async (stream) => {
      if (cancelled) {
        stream?.getTracks().forEach((track) => track.stop());
        return;
      }
      localRef.current = stream;
      setLocalStream(stream);
      if (!stream) {
        setMicOn(false);
        setCamOn(false);
        setMediaError("Mikrofon izni yok; yine de odayı duyabilirsin.");
        setMediaReady(true);
        return;
      }
      const mic = stream.getAudioTracks()[0]?.enabled ?? false;
      setMicOn(mic);
      setCamOn(false);
      sendMediaRef.current({ micOn: mic, camOn: false, screenOn: false });
      watchStream(selfId, stream);
      setMediaReady(true);
      if (readNoiseSuppression()) {
        const ok = await startNoiseFilterRef.current();
        if (cancelled) return;
        noiseOnRef.current = ok;
        setNoiseOn(ok);
        if (!ok) writeNoiseSuppression(false);
      } else {
        noiseOnRef.current = false;
        setNoiseOn(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [selfId, watchStream]);

  useEffect(() => {
    if (!mediaReady || !connected) return;
    const remoteIds = new Set(peers.map((peer) => peer.id).filter((id) => id !== selfId));
    for (const id of remoteIds) ensurePeer(id);
    for (const id of [...peersRef.current.keys()]) {
      if (!remoteIds.has(id)) closePeer(id);
    }
    applyOutgoingTracks();
  }, [applyOutgoingTracks, closePeer, connected, ensurePeer, mediaReady, peers, selfId]);

  useEffect(() => {
    return subscribe((event) => {
      if (event.type === "signal") {
        handleSignal(event.from, event.data);
      }
    });
  }, [handleSignal, subscribe]);

  useEffect(() => {
    return () => {
      for (const id of [...peersRef.current.keys()]) closePeer(id);
      stopNoiseFilter();
      localRef.current?.getTracks().forEach((track) => track.stop());
      screenStreamRef.current?.getTracks().forEach((track) => track.stop());
      cameraPlaceholderRef.current?.stop();
      cameraPlaceholderRef.current = null;
      for (const meter of metersRef.current.values()) meter.stop();
      metersRef.current.clear();
    };
  }, [closePeer, stopNoiseFilter]);

  const publishMedia = useCallback(() => {
    sendMediaRef.current({
      micOn: micRef.current,
      camOn: camRef.current,
      screenOn: screenOnRef.current,
    });
  }, []);

  const stopScreenShare = useCallback(() => {
    const display = screenStreamRef.current;
    screenStreamRef.current = null;
    display?.getTracks().forEach((track) => track.stop());
    setLocalScreen(null);
    screenOnRef.current = false;
    setScreenOn(false);
    applyOutgoingTracks();
    publishMedia();
  }, [applyOutgoingTracks, publishMedia]);

  const toggleScreenShare = useCallback(async () => {
    if (screenOnRef.current) {
      stopScreenShare();
      return;
    }
    try {
      const display = await readDisplay();
      const track = display.getVideoTracks()[0];
      if (!track) {
        display.getTracks().forEach((item) => item.stop());
        return;
      }
      track.contentHint = "detail";
      track.enabled = true;
      track.onended = () => stopScreenShare();
      for (const audio of display.getAudioTracks()) {
        audio.onended = () => applyOutgoingTracks();
      }
      screenStreamRef.current = display;
      setLocalScreen(display);
      screenOnRef.current = true;
      setScreenOn(true);
      applyOutgoingTracks();
      publishMedia();
    } catch {
      // picker cancelled
    }
  }, [applyOutgoingTracks, publishMedia, stopScreenShare]);

  const toggleMic = useCallback(() => {
    const track = localRef.current?.getAudioTracks()[0];
    if (!track) return;
    const next = !micRef.current;
    micRef.current = next;
    setMicOn(next);
    applyOutgoingTracks();
    publishMedia();
  }, [applyOutgoingTracks, publishMedia]);

  const toggleCam = useCallback(async () => {
    if (camRef.current) {
      releaseLocalCamera();
      camRef.current = false;
      setCamOn(false);
      applyOutgoingTracks();
      publishMedia();
      return;
    }

    const request = ++camRequestRef.current;
    try {
      const track = await readCamera();
      if (!track || request !== camRequestRef.current) {
        track?.stop();
        return;
      }
      const stream = localRef.current ?? new MediaStream();
      for (const existing of stream.getVideoTracks()) {
        stream.removeTrack(existing);
        existing.stop();
      }
      track.enabled = true;
      stream.addTrack(track);
      publishLocalStream(stream);
      camRef.current = true;
      setCamOn(true);
      applyOutgoingTracks();
      publishMedia();
    } catch {
      // permission denied or no camera
    }
  }, [applyOutgoingTracks, publishLocalStream, publishMedia, releaseLocalCamera]);

  const toggleNoise = useCallback(async () => {
    const next = !noiseOnRef.current;
    writeNoiseSuppression(next);
    if (next) {
      const ok = await startNoiseFilter();
      noiseOnRef.current = ok;
      setNoiseOn(ok);
      if (!ok) writeNoiseSuppression(false);
      return;
    }
    stopNoiseFilter();
    await applyMicConstraints(true);
    if (localRef.current) watchStream(selfId, localRef.current);
    noiseOnRef.current = false;
    setNoiseOn(false);
    applyOutgoingTracks();
  }, [
    applyMicConstraints,
    applyOutgoingTracks,
    selfId,
    startNoiseFilter,
    stopNoiseFilter,
    watchStream,
  ]);

  return {
    localStream,
    localScreen,
    remoteStreams,
    remoteScreens,
    levels,
    micOn,
    camOn,
    screenOn,
    noiseOn,
    mediaError,
    iceStates,
    canToggleCam: mediaReady,
    canToggleMic: Boolean(localStream?.getAudioTracks()[0]),
    canToggleNoise: Boolean(localStream?.getAudioTracks()[0]),
    toggleMic,
    toggleCam,
    toggleNoise,
    toggleScreenShare,
  };
}
