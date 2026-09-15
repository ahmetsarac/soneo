import { describe, expect, it } from "vitest";
import { pickFullscreenTarget, shouldReleaseFullscreen } from "./fullscreen";

describe("fullscreen target", () => {
  it("prefers the standard Fullscreen API on the tile", () => {
    expect(
      pickFullscreenTarget(
        { requestFullscreen: async () => undefined, webkitRequestFullscreen: () => undefined },
        { webkitEnterFullscreen: () => undefined },
      ),
    ).toEqual({ kind: "element", via: "standard" });
  });

  it("falls back to webkit element fullscreen", () => {
    expect(
      pickFullscreenTarget({ webkitRequestFullscreen: () => undefined }),
    ).toEqual({ kind: "element", via: "webkit" });
  });

  it("uses iOS video fullscreen when the tile cannot", () => {
    expect(
      pickFullscreenTarget({}, { webkitEnterFullscreen: () => undefined }),
    ).toEqual({ kind: "video-webkit" });
  });

  it("reports none when nothing is available", () => {
    expect(pickFullscreenTarget({})).toEqual({ kind: "none" });
  });
});

describe("screen share fullscreen", () => {
  it("keeps fullscreen while the share is live", () => {
    expect(shouldReleaseFullscreen(true, true)).toBe(false);
  });

  it("releases fullscreen when the share or video ends", () => {
    expect(shouldReleaseFullscreen(false, true)).toBe(true);
    expect(shouldReleaseFullscreen(true, false)).toBe(true);
  });
});
