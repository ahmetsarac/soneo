import { describe, expect, it } from "vitest";
import { clampMenuPosition } from "./menu";

describe("context menu position", () => {
  it("keeps the menu inside the viewport near the right edge", () => {
    expect(clampMenuPosition(980, 20, 240, 160, 1000, 800)).toEqual({
      left: 752,
      top: 20,
    });
  });

  it("does not go above the padding", () => {
    expect(clampMenuPosition(-40, -10, 200, 100, 800, 600)).toEqual({
      left: 8,
      top: 8,
    });
  });
});
