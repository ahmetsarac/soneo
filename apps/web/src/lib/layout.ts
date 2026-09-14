export const TILE_ASPECT = 16 / 9;
export const TILE_GAP = 12;

export function meetGridColumns(count: number) {
  if (count <= 1) return 1;
  if (count <= 4) return 2;
  if (count <= 9) return 3;
  return 4;
}

export function meetGridLayout(
  count: number,
  width: number,
  height: number,
  gap = TILE_GAP,
) {
  if (count < 1 || width <= 0 || height <= 0) {
    return { columns: 1, rows: 1, tileWidth: 0, tileHeight: 0 };
  }

  let best = {
    columns: 1,
    rows: count,
    tileWidth: 0,
    tileHeight: 0,
    area: -1,
  };

  for (let columns = 1; columns <= count; columns += 1) {
    const rows = Math.ceil(count / columns);
    const cellWidth = (width - gap * (columns - 1)) / columns;
    const cellHeight = (height - gap * (rows - 1)) / rows;
    if (cellWidth <= 0 || cellHeight <= 0) continue;

    let tileWidth = cellWidth;
    let tileHeight = tileWidth / TILE_ASPECT;
    if (tileHeight > cellHeight) {
      tileHeight = cellHeight;
      tileWidth = tileHeight * TILE_ASPECT;
    }

    const area = tileWidth * tileHeight;
    if (area > best.area) {
      best = { columns, rows, tileWidth, tileHeight, area };
    }
  }

  return {
    columns: best.columns,
    rows: best.rows,
    tileWidth: best.tileWidth,
    tileHeight: best.tileHeight,
  };
}
