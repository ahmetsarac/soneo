export type ChatTextPart =
  | { type: "text"; value: string }
  | { type: "link"; value: string; href: string };

const LINK_RE = /\b((?:https?:\/\/|www\.)[^\s<]+)/gi;

export function hrefForChatLink(raw: string) {
  const href = /^https?:\/\//i.test(raw)
    ? raw
    : /^www\./i.test(raw)
      ? `https://${raw}`
      : null;
  if (!href) return null;
  try {
    const url = new URL(href);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.href;
  } catch {
    return null;
  }
}

function trimLink(raw: string) {
  return raw.replace(/[),.;!?]+$/g, "");
}

export function parseChatText(text: string): ChatTextPart[] {
  const parts: ChatTextPart[] = [];
  const pattern = new RegExp(LINK_RE.source, LINK_RE.flags);
  let last = 0;

  for (const match of text.matchAll(pattern)) {
    const raw = match[1] ?? "";
    const start = match.index ?? 0;
    if (start > last) {
      parts.push({ type: "text", value: text.slice(last, start) });
    }

    const value = trimLink(raw);
    const href = value ? hrefForChatLink(value) : null;
    if (href) {
      parts.push({ type: "link", value, href });
    } else if (raw) {
      parts.push({ type: "text", value: raw });
    }

    const punctuation = raw.slice(value.length);
    if (punctuation) {
      parts.push({ type: "text", value: punctuation });
    }
    last = start + raw.length;
  }

  if (last < text.length) {
    parts.push({ type: "text", value: text.slice(last) });
  }

  return parts.length > 0 ? parts : [{ type: "text", value: text }];
}
