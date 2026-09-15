export const TILE_ASPECT = 16 / 9;
export const TILE_GAP = 12;
export const MIN_PAIR_COLUMN_WIDTH = 180;

export function meetGridColumns(count: number) {
  if (count <= 1) return 1;
  if (count <= 4) return 2;
  if (count <= 9) return 3;
  return 4;
}

export function fitSixteenNine(cellWidth: number, cellHeight: number) {
  if (cellWidth <= 0 || cellHeight <= 0) {
    return { tileWidth: 0, tileHeight: 0 };
  }
  let tileWidth = cellWidth;
  let tileHeight = tileWidth / TILE_ASPECT;
  if (tileHeight > cellHeight) {
    tileHeight = cellHeight;
    tileWidth = tileHeight * TILE_ASPECT;
  }
  return { tileWidth, tileHeight };
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

  const pairWidth = (width - gap) / 2;
  if (count === 2 && pairWidth >= MIN_PAIR_COLUMN_WIDTH && height >= 120) {
    const tile = fitSixteenNine(pairWidth, height);
    return { columns: 2, rows: 1, ...tile };
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

    const tile = fitSixteenNine(cellWidth, cellHeight);
    const area = tile.tileWidth * tile.tileHeight;
    if (area > best.area) {
      best = { columns, rows, ...tile, area };
    }
  }

  return {
    columns: best.columns,
    rows: best.rows,
    tileWidth: best.tileWidth,
    tileHeight: best.tileHeight,
  };
}
