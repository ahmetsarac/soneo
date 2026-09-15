import { describe, expect, it } from "vitest";
import {
  isPolite,
  levelFromTimeDomain,
  litBarsFromLevel,
  decideIceCandidate,
  inboundVideoRole,
  assignInboundVideo,
  offerCollisionAction,
  canApplyRemoteDescription,
  isSdpOrderError,
  isPeerConnecting,
  isPeerConnected,
  sdpSessionId,
  shouldResetForOffer,
  shouldResetPeer,
  serializeDescription,
  nextSpeakingState,
  gatedVoiceLevel,
  SPEAK_HOLD_MS,
} from "./webrtc";

describe("webrtc helpers", () => {
  it("makes the lexicographically greater id polite to avoid offer glare", () => {
    expect(isPolite("a", "b")).toBe(false);
    expect(isPolite("b", "a")).toBe(true);
  });

  it("queues ICE until a remote description exists", () => {
    expect(
      decideIceCandidate(false, {
        candidate: "candidate:1",
        sdpMid: "0",
        sdpMLineIndex: 0,
      }),
    ).toBe("queue");
    expect(decideIceCandidate(false, null)).toBe("drop");
    expect(
      decideIceCandidate(true, {
        candidate: "candidate:1",
        sdpMid: "0",
        sdpMLineIndex: 0,
      }),
    ).toBe("apply");
    expect(decideIceCandidate(true, null)).toBe("apply");
  });

  it("returns 0 for silence and a high level for full amplitude", () => {
    expect(levelFromTimeDomain(new Uint8Array(8).fill(128))).toBe(0);
    expect(levelFromTimeDomain(new Uint8Array([128, 255, 0, 128]))).toBe(1);
  });

  it("lights more bars as the level rises", () => {
    expect(litBarsFromLevel(0)).toBe(0);
    expect(litBarsFromLevel(0.1)).toBe(0);
    expect(litBarsFromLevel(0.2)).toBe(1);
    expect(litBarsFromLevel(0.4)).toBe(2);
    expect(litBarsFromLevel(0.61)).toBe(4);
    expect(litBarsFromLevel(1)).toBe(5);
  });

  it("opens the speaking ring above room hiss and holds through short gaps", () => {
    expect(nextSpeakingState(0.08, false, 0, 0)).toEqual({
      speaking: false,
      holdUntil: 0,
    });
    expect(nextSpeakingState(0.25, false, 0, 1000)).toEqual({
      speaking: true,
      holdUntil: 1000 + SPEAK_HOLD_MS,
    });
    expect(nextSpeakingState(0.16, true, 0, 1000).speaking).toBe(true);
    expect(nextSpeakingState(0.05, true, 1300, 1200).speaking).toBe(true);
    expect(nextSpeakingState(0.05, true, 1100, 1200).speaking).toBe(false);
  });

  it("hides the meter while the speaking gate is closed", () => {
    expect(gatedVoiceLevel(0.4, false)).toBe(0);
    expect(gatedVoiceLevel(0.05, true)).toBeGreaterThan(0);
  });

  it("treats a second inbound video track as screen share", () => {
    expect(inboundVideoRole(0)).toBe("camera");
    expect(inboundVideoRole(1)).toBe("screen");
  });

  it("keeps the first unknown video as camera and the next as screen", () => {
    expect(assignInboundVideo("camera", false)).toBe("camera");
    expect(assignInboundVideo("screen", false)).toBe("screen");
    expect(assignInboundVideo("unknown", false)).toBe("camera");
    expect(assignInboundVideo("unknown", true)).toBe("screen");
  });

  it("rolls back polite offers during glare and ignores impolite ones", () => {
    expect(offerCollisionAction(true, false, "stable")).toBe("apply");
    expect(offerCollisionAction(true, true, "stable")).toBe("rollback");
    expect(offerCollisionAction(true, false, "have-local-offer")).toBe("rollback");
    expect(offerCollisionAction(false, true, "have-local-offer")).toBe("ignore");
  });

  it("drops leftover answers after the connection is already stable", () => {
    expect(canApplyRemoteDescription("have-local-offer", "answer")).toBe(true);
    expect(canApplyRemoteDescription("stable", "answer")).toBe(false);
    expect(canApplyRemoteDescription("stable", "offer")).toBe(true);
  });

  it("detects m-line order errors from a stale peer connection", () => {
    expect(
      isSdpOrderError(
        new Error(
          "Failed to set remote offer sdp: The order of m-lines in subsequent offer doesn't match order from previous offer/answer.",
        ),
      ),
    ).toBe(true);
    expect(isSdpOrderError(new Error("InvalidStateError"))).toBe(false);
  });

  it("treats missing ice as still connecting", () => {
    expect(isPeerConnecting(undefined)).toBe(true);
    expect(isPeerConnecting("checking")).toBe(true);
    expect(isPeerConnecting("connected")).toBe(false);
    expect(isPeerConnected(undefined)).toBe(false);
    expect(isPeerConnected("connected")).toBe(true);
    expect(isPeerConnected("completed")).toBe(true);
  });

  it("resets a peer after ICE failure or a new SDP session from a page reload", () => {
    expect(shouldResetPeer("connected", "connected")).toBe(false);
    expect(shouldResetPeer("failed", "connected")).toBe(true);
    expect(shouldResetPeer("connected", "disconnected")).toBe(true);
    expect(sdpSessionId("v=0\r\no=- 111 2 IN IP4 127.0.0.1\r\n")).toBe("111");
    expect(
      shouldResetForOffer(
        "v=0\r\no=- 111 2 IN IP4 127.0.0.1\r\n",
        "v=0\r\no=- 111 3 IN IP4 127.0.0.1\r\n",
      ),
    ).toBe(false);
    expect(
      shouldResetForOffer(
        "v=0\r\no=- 111 2 IN IP4 127.0.0.1\r\n",
        "v=0\r\no=- 222 2 IN IP4 127.0.0.1\r\n",
      ),
    ).toBe(true);
    expect(shouldResetForOffer(undefined, "v=0\r\no=- 222 2 IN IP4 127.0.0.1\r\n")).toBe(
      false,
    );
  });

  it("serializes SDP as plain type/sdp so signaling JSON stays valid", () => {
    expect(serializeDescription({ type: "offer", sdp: "v=0" })).toEqual({
      type: "offer",
      sdp: "v=0",
    });
    expect(serializeDescription({ type: "offer" })).toBeNull();
    expect(serializeDescription(null)).toBeNull();
  });
});
