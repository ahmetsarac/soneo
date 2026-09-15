import { describe, expect, it } from "vitest";
import { hrefForChatLink, parseChatText } from "./chatText";

describe("chat links", () => {
  it("keeps plain text as a single part", () => {
    expect(parseChatText("selam")).toEqual([{ type: "text", value: "selam" }]);
  });

  it("extracts http and https urls", () => {
    expect(parseChatText("bak https://soneo.example/room/AB12 ve http://ornek.com")).toEqual([
      { type: "text", value: "bak " },
      {
        type: "link",
        value: "https://soneo.example/room/AB12",
        href: "https://soneo.example/room/AB12",
      },
      { type: "text", value: " ve " },
      { type: "link", value: "http://ornek.com", href: "http://ornek.com/" },
    ]);
  });

  it("promotes www links to https", () => {
    expect(parseChatText("www.example.com/a")).toEqual([
      {
        type: "link",
        value: "www.example.com/a",
        href: "https://www.example.com/a",
      },
    ]);
  });

  it("keeps trailing punctuation outside the href", () => {
    expect(parseChatText("link: https://example.com.")).toEqual([
      { type: "text", value: "link: " },
      { type: "link", value: "https://example.com", href: "https://example.com/" },
      { type: "text", value: "." },
    ]);
  });

  it("rejects non-web protocols", () => {
    expect(hrefForChatLink("javascript:alert(1)")).toBeNull();
    expect(hrefForChatLink("ftp://files.example")).toBeNull();
  });
});
