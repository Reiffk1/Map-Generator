import type { TileGrid } from '../../models/tilemap';
import { TILE_EMPTY, getTile, setTile, inBounds } from '../../models/tilemap';

const CARDINAL_OFFSETS: ReadonlyArray<readonly [number, number]> = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
];

/**
 * Generate a 1-tile-thick wall border around all floor regions.
 * Every empty cell in the walls layer that is cardinally adjacent to a
 * non-empty floor cell receives `wallTileId`.  The walls layer is cleared
 * before regeneration.
 */
export function generateWallsFromFloor(
  grid: TileGrid,
  wallTileId: number,
): void {
  const floorLayer = grid.layers.floor;
  const wallLayer = grid.layers.walls;
  const { width, height } = grid;

  wallLayer.data.fill(TILE_EMPTY);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (getTile(floorLayer, grid, x, y) !== TILE_EMPTY) continue;

      for (const [dx, dy] of CARDINAL_OFFSETS) {
        const nx = x + dx;
        const ny = y + dy;
        if (inBounds(grid, nx, ny) && getTile(floorLayer, grid, nx, ny) !== TILE_EMPTY) {
          setTile(wallLayer, grid, x, y, wallTileId);
          break;
        }
      }
    }
  }
}

/**
 * Place doors at specific positions. Each door is written to the doors layer
 * and any wall tile at the same position is removed.
 */
export function placeDoors(
  grid: TileGrid,
  doorPositions: Array<{ x: number; y: number; tileId: number }>,
): void {
  const doorLayer = grid.layers.doors;
  const wallLayer = grid.layers.walls;

  for (const { x, y, tileId } of doorPositions) {
    setTile(doorLayer, grid, x, y, tileId);
    setTile(wallLayer, grid, x, y, TILE_EMPTY);
  }
}

/**
 * Fill a rectangle in the floor layer with the given tile ID.
 */
export function carveFloorRect(
  grid: TileGrid,
  x: number,
  y: number,
  w: number,
  h: number,
  floorTileId: number,
): void {
  const floorLayer = grid.layers.floor;

  for (let dy = 0; dy < h; dy++) {
    for (let dx = 0; dx < w; dx++) {
      setTile(floorLayer, grid, x + dx, y + dy, floorTileId);
    }
  }
}

/**
 * Carve circular floor regions along a series of points (corridor brush).
 * For each point, all cells within `radius` (Euclidean) are set to
 * `floorTileId`.
 */
export function carveFloorBrush(
  grid: TileGrid,
  points: Array<{ x: number; y: number }>,
  radius: number,
  floorTileId: number,
): void {
  const floorLayer = grid.layers.floor;
  const r2 = radius * radius;

  for (const { x: cx, y: cy } of points) {
    const minX = Math.floor(cx - radius);
    const maxX = Math.ceil(cx + radius);
    const minY = Math.floor(cy - radius);
    const maxY = Math.ceil(cy + radius);

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const dx = x - cx;
        const dy = y - cy;
        if (dx * dx + dy * dy <= r2) {
          setTile(floorLayer, grid, x, y, floorTileId);
        }
      }
    }
  }
}
