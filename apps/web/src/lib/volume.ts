const STORAGE_KEY = "soneo.peerVolumes";

export function clampVolume(value: number) {
  if (!Number.isFinite(value)) return 1;
  return Math.min(1, Math.max(0, value));
}

export function readPeerVolumes(): Record<string, number> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const volumes: Record<string, number> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value === "number") volumes[key] = clampVolume(value);
    }
    return volumes;
  } catch {
    return {};
  }
}

export function writePeerVolumes(volumes: Record<string, number>) {
  if (typeof window === "undefined") return;
  const next: Record<string, number> = {};
  for (const [key, value] of Object.entries(volumes)) {
    next[key] = clampVolume(value);
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}
