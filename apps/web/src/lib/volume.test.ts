import { describe, expect, it } from "vitest";
import { clampVolume, volumeStorageKey } from "./volume";

describe("peer volume", () => {
  it("clamps to 0–1 and treats invalid values as full volume", () => {
    expect(clampVolume(0.4)).toBe(0.4);
    expect(clampVolume(-2)).toBe(0);
    expect(clampVolume(3)).toBe(1);
    expect(clampVolume(Number.NaN)).toBe(1);
  });

  it("stores screen volume separately from voice", () => {
    expect(volumeStorageKey("kara")).toBe("kara");
    expect(volumeStorageKey("kara", "camera")).toBe("kara");
    expect(volumeStorageKey("kara", "screen")).toBe("kara::screen");
  });
});
