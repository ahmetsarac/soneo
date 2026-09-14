export function parseCorsOrigins(raw: string | undefined) {
  const value = raw?.trim() || "http://localhost:3000,http://127.0.0.1:3000";
  return [...new Set(value.split(",").map((item) => item.trim()).filter(Boolean))];
}
