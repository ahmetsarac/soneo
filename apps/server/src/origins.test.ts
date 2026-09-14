import { describe, expect, it } from "vitest";
import { parseCorsOrigins } from "./origins.js";

describe("cors origins", () => {
  it("falls back to local Next and dedupes extra entries", () => {
    expect(parseCorsOrigins(undefined)).toEqual([
      "http://localhost:3000",
      "http://127.0.0.1:3000",
    ]);
    expect(parseCorsOrigins(" https://soneo.app, https://soneo.app ")).toEqual([
      "https://soneo.app",
    ]);
  });
});
