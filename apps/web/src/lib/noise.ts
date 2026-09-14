const STORAGE_KEY = "soneo.noiseSuppression";

export function parseNoiseSuppression(raw: string | null) {
  if (raw === "0" || raw === "false") return false;
  if (raw === "1" || raw === "true") return true;
  return true;
}

export function readNoiseSuppression() {
  if (typeof window === "undefined") return true;
  try {
    return parseNoiseSuppression(localStorage.getItem(STORAGE_KEY));
  } catch {
    return true;
  }
}

export function writeNoiseSuppression(on: boolean) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, on ? "1" : "0");
}
