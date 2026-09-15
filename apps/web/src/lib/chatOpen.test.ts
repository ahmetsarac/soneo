import { describe, expect, it } from "vitest";
import { parseChatOpen } from "./chatOpen";

describe("chat panel preference", () => {
  it("defaults to open and parses stored flags", () => {
    expect(parseChatOpen(null)).toBe(true);
    expect(parseChatOpen("1")).toBe(true);
    expect(parseChatOpen("0")).toBe(false);
    expect(parseChatOpen("false")).toBe(false);
  });
});
