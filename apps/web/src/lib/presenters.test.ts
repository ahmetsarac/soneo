import { describe, expect, it } from "vitest";
import {
  newestShareId,
  orderFilmstrip,
  parseTileKey,
  resolveFocusedTile,
  sharingParticipantIds,
  tileKey,
} from "./presenters";

describe("sharingParticipantIds", () => {
  const people = [
    { id: "a", screenOn: true },
    { id: "b", screenOn: false },
    { id: "c", screenOn: true },
  ];

  it("uses the local screen flag for self", () => {
    expect(sharingParticipantIds(people, "b", true)).toEqual(["a", "b", "c"]);
    expect(sharingParticipantIds(people, "a", false)).toEqual(["c"]);
  });
});

describe("newestShareId", () => {
  it("returns the share that just started", () => {
    expect(newestShareId(["a"], ["a", "c"])).toBe("c");
  });

  it("prefers the latest new share when several appear at once", () => {
    expect(newestShareId([], ["a", "c"])).toBe("c");
  });

  it("returns null when nobody new is sharing", () => {
    expect(newestShareId(["a", "c"], ["a"])).toBe(null);
  });
});

describe("tile keys", () => {
  it("round-trips camera and screen keys", () => {
    expect(parseTileKey(tileKey({ participantId: "a", surface: "screen" }))).toEqual({
      participantId: "a",
      surface: "screen",
    });
    expect(parseTileKey("camera:b")).toEqual({
      participantId: "b",
      surface: "camera",
    });
  });
});

describe("resolveFocusedTile", () => {
  const people = ["a", "c"];

  it("keeps the current share while it is still live", () => {
    expect(
      resolveFocusedTile(people, ["a", "c"], {
        participantId: "a",
        surface: "screen",
      }),
    ).toEqual({ participantId: "a", surface: "screen" });
  });

  it("keeps a camera focus while someone is sharing", () => {
    expect(
      resolveFocusedTile(people, ["c"], {
        participantId: "a",
        surface: "camera",
      }),
    ).toEqual({ participantId: "a", surface: "camera" });
  });

  it("does not auto-watch a new share", () => {
    expect(resolveFocusedTile(people, ["c"], null)).toBe(null);
  });

  it("returns to the grid when the watched screen stops", () => {
    expect(
      resolveFocusedTile(people, ["c"], {
        participantId: "a",
        surface: "screen",
      }),
    ).toBe(null);
  });

  it("keeps a camera focus after shares end", () => {
    expect(
      resolveFocusedTile(people, [], {
        participantId: "a",
        surface: "camera",
      }),
    ).toEqual({ participantId: "a", surface: "camera" });
  });
});

describe("orderFilmstrip", () => {
  it("puts screen cards before cameras", () => {
    expect(
      orderFilmstrip([
        { surface: "camera" as const, id: "a" },
        { surface: "screen" as const, id: "b" },
        { surface: "camera" as const, id: "c" },
      ]).map((tile) => tile.id),
    ).toEqual(["b", "a", "c"]);
  });
});
