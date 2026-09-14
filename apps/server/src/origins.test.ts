import { describe, expect, it } from "vitest";
import { normalizeOrigin, parseCorsOrigins, resolveCorsOrigin } from "./origins.js";

describe("cors origins", () => {
  it("falls back to local Next and dedupes extra entries", () => {
    expect(parseCorsOrigins(undefined)).toEqual([
      "http://localhost:3000",
      "http://127.0.0.1:3000",
    ]);
    expect(parseCorsOrigins(" https://soneo.app, https://soneo.app ")).toEqual([
      "https://soneo.app",
      "https://www.soneo.app",
    ]);
  });

  it("strips Coolify UI ports, slashes and quotes from pasted origins", () => {
    expect(normalizeOrigin("https://soneo.app:3000/")).toBe("https://soneo.app");
    expect(normalizeOrigin('"https://api.soneo.app:4000"')).toBe(
      "https://api.soneo.app",
    );
    expect(
      resolveCorsOrigin(
        "https://soneo.app",
        parseCorsOrigins("https://soneo.app:3000"),
      ),
    ).toBe("https://soneo.app");
  });
});
