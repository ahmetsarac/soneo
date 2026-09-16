export type Surface = "camera" | "screen";

export type FocusedTile = {
  participantId: string;
  surface: Surface;
};

export function tileKey(tile: FocusedTile) {
  return `${tile.surface}:${tile.participantId}`;
}

export function parseTileKey(key: string): FocusedTile | null {
  const separator = key.indexOf(":");
  if (separator <= 0) return null;
  const surface = key.slice(0, separator);
  const participantId = key.slice(separator + 1);
  if (surface !== "camera" && surface !== "screen") return null;
  if (!participantId) return null;
  return { participantId, surface };
}

export function sharingParticipantIds(
  participants: { id: string; screenOn: boolean }[],
  selfId: string,
  selfScreenOn: boolean,
) {
  return participants
    .filter((person) =>
      person.id === selfId ? selfScreenOn : person.screenOn,
    )
    .map((person) => person.id);
}

export function newestShareId(previousIds: string[], nextIds: string[]) {
  for (let index = nextIds.length - 1; index >= 0; index -= 1) {
    const id = nextIds[index];
    if (id && !previousIds.includes(id)) return id;
  }
  return null;
}

export function isFocusedTileValid(
  focused: FocusedTile,
  participantIds: string[],
  sharingIds: string[],
) {
  if (!participantIds.includes(focused.participantId)) return false;
  if (focused.surface === "screen") {
    return sharingIds.includes(focused.participantId);
  }
  return true;
}

export function resolveFocusedTile(
  participantIds: string[],
  sharingIds: string[],
  focused: FocusedTile | null,
): FocusedTile | null {
  if (!focused) return null;
  if (!isFocusedTileValid(focused, participantIds, sharingIds)) return null;
  return focused;
}

export function orderFilmstrip<T extends { surface: Surface }>(tiles: T[]) {
  return [
    ...tiles.filter((tile) => tile.surface === "screen"),
    ...tiles.filter((tile) => tile.surface === "camera"),
  ];
}
