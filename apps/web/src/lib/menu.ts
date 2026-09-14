export function clampMenuPosition(
  x: number,
  y: number,
  menuWidth: number,
  menuHeight: number,
  viewportWidth: number,
  viewportHeight: number,
  pad = 8,
) {
  const maxLeft = Math.max(pad, viewportWidth - menuWidth - pad);
  const maxTop = Math.max(pad, viewportHeight - menuHeight - pad);
  return {
    left: Math.min(Math.max(pad, x), maxLeft),
    top: Math.min(Math.max(pad, y), maxTop),
  };
}
