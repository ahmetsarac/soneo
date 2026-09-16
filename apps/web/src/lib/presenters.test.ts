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
      resolveFocusedTile(
        people,
        ["a", "c"],
        { participantId: "a", surface: "screen" },
        "c",
      ),
    ).toEqual({ participantId: "a", surface: "screen" });
  });

  it("keeps a camera focus while someone is sharing", () => {
    expect(
      resolveFocusedTile(
        people,
        ["c"],
        { participantId: "a", surface: "camera" },
        "c",
      ),
    ).toEqual({ participantId: "a", surface: "camera" });
  });

  it("follows a new share when nothing is focused yet", () => {
    expect(resolveFocusedTile(people, ["c"], null, "c")).toEqual({
      participantId: "c",
      surface: "screen",
    });
  });

  it("falls back to another live share when the focused screen stops", () => {
    expect(
      resolveFocusedTile(
        people,
        ["c"],
        { participantId: "a", surface: "screen" },
        null,
      ),
    ).toEqual({ participantId: "c", surface: "screen" });
  });

  it("clears focus when nobody is sharing", () => {
    expect(
      resolveFocusedTile(
        people,
        [],
        { participantId: "a", surface: "camera" },
        null,
      ),
    ).toBe(null);
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
