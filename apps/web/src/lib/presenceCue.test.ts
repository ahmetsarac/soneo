import { describe, expect, it } from "vitest";
import { presenceCueFromMessage, tonesForCue } from "./presenceCue";

describe("presence cues", () => {
  it("maps live system join and leave lines", () => {
    expect(
      presenceCueFromMessage({ kind: "system", text: "mavi katıldı" }),
    ).toBe("join");
    expect(
      presenceCueFromMessage({ kind: "system", text: "mavi ayrıldı" }),
    ).toBe("leave");
  });

  it("ignores chat and unrelated system text", () => {
    expect(
      presenceCueFromMessage({ kind: "user", text: "mavi katıldı" }),
    ).toBeNull();
    expect(
      presenceCueFromMessage({ kind: "system", text: "oda hazır" }),
    ).toBeNull();
  });

  it("uses a rising join and falling leave pair", () => {
    const join = tonesForCue("join");
    const leave = tonesForCue("leave");
    expect(join[1]?.freq).toBeGreaterThan(join[0]?.freq ?? 0);
    expect(leave[1]?.freq).toBeLessThan(leave[0]?.freq ?? 0);
  });
});
