import { describe, expect, it } from "vitest";
import { meetGridColumns, meetGridLayout } from "./layout";

describe("meet grid", () => {
  it("grows columns with participant count like Meet", () => {
    expect(meetGridColumns(1)).toBe(1);
    expect(meetGridColumns(2)).toBe(2);
    expect(meetGridColumns(4)).toBe(2);
    expect(meetGridColumns(5)).toBe(3);
    expect(meetGridColumns(9)).toBe(3);
    expect(meetGridColumns(10)).toBe(4);
  });

  it("picks a single wide 16:9 tile for one person", () => {
    const layout = meetGridLayout(1, 1280, 720);
    expect(layout.columns).toBe(1);
    expect(layout.rows).toBe(1);
    expect(layout.tileWidth / layout.tileHeight).toBeCloseTo(16 / 9, 5);
    expect(layout.tileHeight).toBeCloseTo(720, 5);
  });

  it("places two people side by side in a landscape room", () => {
    const layout = meetGridLayout(2, 1280, 720);
    expect(layout.columns).toBe(2);
    expect(layout.rows).toBe(1);
    expect(layout.tileWidth / layout.tileHeight).toBeCloseTo(16 / 9, 5);
  });

  it("keeps two 16:9 tiles side by side after the chat column opens", () => {
    const layout = meetGridLayout(2, 900, 640);
    expect(layout.columns).toBe(2);
    expect(layout.rows).toBe(1);
    expect(layout.tileWidth / layout.tileHeight).toBeCloseTo(16 / 9, 5);
  });

  it("uses a 2x2 grid for four people", () => {
    const layout = meetGridLayout(4, 1280, 720);
    expect(layout.columns).toBe(2);
    expect(layout.rows).toBe(2);
  });

  it("uses three columns for five people in a wide room", () => {
    const layout = meetGridLayout(5, 1280, 720);
    expect(layout.columns).toBe(3);
    expect(layout.rows).toBe(2);
  });

  it("stacks two people in a portrait phone so tiles stay large", () => {
    const layout = meetGridLayout(2, 390, 640);
    expect(layout.columns).toBe(1);
    expect(layout.rows).toBe(2);
    expect(layout.tileWidth / layout.tileHeight).toBeCloseTo(16 / 9, 5);
  });

  it("stacks people in a tall narrow room", () => {
    const layout = meetGridLayout(3, 360, 900);
    expect(layout.columns).toBe(1);
    expect(layout.rows).toBe(3);
  });
});
