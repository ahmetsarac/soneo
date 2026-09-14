function stripWrappingQuotes(value: string) {
  return value.replace(/^['"]|['"]$/g, "");
}

export function normalizeOrigin(raw: string) {
  const trimmed = stripWrappingQuotes(raw.trim()).replace(/\/+$/, "");
  if (!trimmed) return "";
  try {
    const url = new URL(trimmed);
    if (url.port === "80") url.port = "";
    if (url.port === "443") url.port = "";
    if (url.protocol === "https:" && (url.port === "3000" || url.port === "4000")) {
      url.port = "";
    }
    return url.origin;
  } catch {
    return trimmed;
  }
}

export function parseCorsOrigins(raw: string | undefined) {
  const value = raw?.trim() || "http://localhost:3000,http://127.0.0.1:3000";
  const origins = value
    .split(",")
    .map((item) => normalizeOrigin(item))
    .filter(Boolean);
  const expanded = new Set<string>();
  for (const origin of origins) {
    expanded.add(origin);
    try {
      const url = new URL(origin);
      if (url.hostname === "localhost" || url.hostname.endsWith(".localhost")) {
        continue;
      }
      if (url.hostname.startsWith("www.")) {
        url.hostname = url.hostname.slice(4);
        expanded.add(url.origin);
      } else {
        url.hostname = `www.${url.hostname}`;
        expanded.add(url.origin);
      }
    } catch {
      // keep the raw origin
    }
  }
  return [...expanded];
}

export function resolveCorsOrigin(requestOrigin: string | undefined, allowed: string[]) {
  if (!requestOrigin) return allowed[0] ?? "";
  const normalized = normalizeOrigin(requestOrigin);
  return allowed.includes(normalized) ? requestOrigin : null;
}
