import { describe, expect, it } from "vitest";
import { parseNoiseSuppression } from "./noise";

describe("noise suppression preference", () => {
  it("defaults on and only turns off for explicit false values", () => {
    expect(parseNoiseSuppression(null)).toBe(true);
    expect(parseNoiseSuppression("1")).toBe(true);
    expect(parseNoiseSuppression("true")).toBe(true);
    expect(parseNoiseSuppression("0")).toBe(false);
    expect(parseNoiseSuppression("false")).toBe(false);
  });
});
