import type { TileGrid, GeneratorParams } from '../../models/tilemap';
import {
  createEmptyTileGrid,
  DEFAULT_GENERATOR_PARAMS,
  setTile,
  getTile,
  inBounds,
  TILE_EMPTY,
} from '../../models/tilemap';
import type { Point } from '../../models/types';
import { autotileWallLayer, autotileFloorVariation, STANDARD_WALL_IDS, STANDARD_FLOOR_IDS } from '../tilemap/autotile';

// Tile IDs used during generation (pre-autotile)
const FLOOR = 1;
const WALL = 2;
const DOOR = 3;

export interface GeneratorOutput {
  tileGrid: TileGrid;
  rooms: Array<{
    id: string;
    label: string;
    bounds: { x: number; y: number; width: number; height: number };
    roomType: string;
    tileX: number;
    tileY: number;
    tileW: number;
    tileH: number;
  }>;
  doors: Array<{
    tileX: number;
    tileY: number;
    orientation: 'north' | 'south' | 'east' | 'west';
  }>;
}

interface RoomRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

type Rng = () => number;

// ---------------------------------------------------------------------------
// Seeded PRNG (simple LCG)
// ---------------------------------------------------------------------------

function createRng(seed: string): Rng {
  let s = 0;
  for (let i = 0; i < seed.length; i++) s = ((s << 5) - s + seed.charCodeAt(i)) | 0;
  if (s === 0) s = 12345;
  return () => {
    s = (s * 1664525 + 1013904223) | 0;
    return (s >>> 0) / 4294967296;
  };
}

function rngInt(rng: Rng, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

function rngSeed(): string {
  return Math.random().toString(36).slice(2, 10);
}

// ---------------------------------------------------------------------------
// Grid helpers
// ---------------------------------------------------------------------------

const BORDER = 2;

function carveRect(grid: TileGrid, x: number, y: number, w: number, h: number): void {
  const floor = grid.layers.floor;
  for (let dy = 0; dy < h; dy++) {
    for (let dx = 0; dx < w; dx++) {
      setTile(floor, grid, x + dx, y + dy, FLOOR);
    }
  }
}

function isFloor(grid: TileGrid, x: number, y: number): boolean {
  return getTile(grid.layers.floor, grid, x, y) === FLOOR;
}

function rectFits(grid: TileGrid, r: RoomRect, existing: RoomRect[]): boolean {
  if (r.x < BORDER || r.y < BORDER) return false;
  if (r.x + r.w > grid.width - BORDER) return false;
  if (r.y + r.h > grid.height - BORDER) return false;

  for (const e of existing) {
    const overlapX = Math.max(0, Math.min(r.x + r.w, e.x + e.w) - Math.max(r.x, e.x));
    const overlapY = Math.max(0, Math.min(r.y + r.h, e.y + e.h) - Math.max(r.y, e.y));
    if (overlapX > 1 && overlapY > 1) return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// Wall cell detection — find cells adjacent to carved floor but not floor
// ---------------------------------------------------------------------------

const DIR4: Point[] = [
  { x: 0, y: -1 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
];

function collectWallCandidates(grid: TileGrid): Point[] {
  const candidates: Point[] = [];
  const floor = grid.layers.floor;
  for (let y = BORDER; y < grid.height - BORDER; y++) {
    for (let x = BORDER; x < grid.width - BORDER; x++) {
      if (getTile(floor, grid, x, y) !== TILE_EMPTY) continue;
      for (const d of DIR4) {
        if (isFloor(grid, x + d.x, y + d.y)) {
          candidates.push({ x, y });
          break;
        }
      }
    }
  }
  return candidates;
}

// ---------------------------------------------------------------------------
// Room placement from a wall candidate
// ---------------------------------------------------------------------------

function tryPlaceRoom(
  grid: TileGrid,
  rng: Rng,
  wall: Point,
  params: GeneratorParams,
  existing: RoomRect[],
): RoomRect | null {
  const w = rngInt(rng, params.roomSizeMin, params.roomSizeMax);
  const h = rngInt(rng, params.roomSizeMin, params.roomSizeMax);

  // Try several offsets relative to the wall cell
  for (let attempt = 0; attempt < 8; attempt++) {
    const ox = rngInt(rng, 0, w - 1);
    const oy = rngInt(rng, 0, h - 1);
    const rect: RoomRect = { x: wall.x - ox, y: wall.y - oy, w, h };
    if (rectFits(grid, rect, existing)) return rect;
  }
  return null;
}

// ---------------------------------------------------------------------------
// L-shaped corridor carving
// ---------------------------------------------------------------------------

function carveCorridor(
  grid: TileGrid,
  rng: Rng,
  from: Point,
  to: Point,
  width: number,
): void {
  const half = Math.floor(width / 2);
  const horizFirst = rng() < 0.5;

  const carveHLine = (y: number, x0: number, x1: number) => {
    const minX = Math.min(x0, x1);
    const maxX = Math.max(x0, x1);
    for (let x = minX; x <= maxX; x++) {
      for (let dy = -half; dy < -half + width; dy++) {
        if (inBounds(grid, x, y + dy)) setTile(grid.layers.floor, grid, x, y + dy, FLOOR);
      }
    }
  };

  const carveVLine = (x: number, y0: number, y1: number) => {
    const minY = Math.min(y0, y1);
    const maxY = Math.max(y0, y1);
    for (let y = minY; y <= maxY; y++) {
      for (let dx = -half; dx < -half + width; dx++) {
        if (inBounds(grid, x + dx, y)) setTile(grid.layers.floor, grid, x + dx, y, FLOOR);
      }
    }
  };

  if (horizFirst) {
    carveHLine(from.y, from.x, to.x);
    carveVLine(to.x, from.y, to.y);
  } else {
    carveVLine(from.x, from.y, to.y);
    carveHLine(to.y, from.x, to.x);
  }
}

function roomCenter(r: RoomRect): Point {
  return { x: Math.floor(r.x + r.w / 2), y: Math.floor(r.y + r.h / 2) };
}

// ---------------------------------------------------------------------------
// Flood fill & connectivity
// ---------------------------------------------------------------------------

function floodFill(grid: TileGrid, startX: number, startY: number): Set<number> {
  const visited = new Set<number>();
  const stack: number[] = [];
  const key = (x: number, y: number) => y * grid.width + x;

  const startKey = key(startX, startY);
  stack.push(startKey);
  visited.add(startKey);

  while (stack.length > 0) {
    const k = stack.pop()!;
    const cx = k % grid.width;
    const cy = Math.floor(k / grid.width);

    for (const d of DIR4) {
      const nx = cx + d.x;
      const ny = cy + d.y;
      if (!inBounds(grid, nx, ny)) continue;
      const nk = key(nx, ny);
      if (visited.has(nk)) continue;
      if (getTile(grid.layers.floor, grid, nx, ny) !== FLOOR) continue;
      visited.add(nk);
      stack.push(nk);
    }
  }
  return visited;
}

function allFloorTiles(grid: TileGrid): Set<number> {
  const tiles = new Set<number>();
  const floor = grid.layers.floor;
  for (let y = 0; y < grid.height; y++) {
    for (let x = 0; x < grid.width; x++) {
      if (getTile(floor, grid, x, y) === FLOOR) tiles.add(y * grid.width + x);
    }
  }
  return tiles;
}

function ensureConnectivity(grid: TileGrid, rng: Rng, _rooms: RoomRect[], corridorWidth: number): void {
  for (let pass = 0; pass < 20; pass++) {
    const all = allFloorTiles(grid);
    if (all.size === 0) return;

    const first = all.values().next().value!;
    const reached = floodFill(grid, first % grid.width, Math.floor(first / grid.width));
    if (reached.size >= all.size) return;

    // Find closest pair between reached and unreached components
    let bestDist = Infinity;
    let bestA: Point = { x: 0, y: 0 };
    let bestB: Point = { x: 0, y: 0 };

    const unreached: number[] = [];
    for (const t of all) {
      if (!reached.has(t)) unreached.push(t);
    }

    // Sample up to 200 tiles from each side to keep it fast
    const sampleReached = Array.from(reached);
    const sampleA = sampleReached.length > 200
      ? Array.from({ length: 200 }, () => sampleReached[rngInt(rng, 0, sampleReached.length - 1)]!)
      : sampleReached;
    const sampleB = unreached.length > 200
      ? Array.from({ length: 200 }, () => unreached[rngInt(rng, 0, unreached.length - 1)]!)
      : unreached;

    for (const a of sampleA) {
      const ax = a % grid.width;
      const ay = Math.floor(a / grid.width);
      for (const b of sampleB) {
        const bx = b % grid.width;
        const by = Math.floor(b / grid.width);
        const dist = Math.abs(ax - bx) + Math.abs(ay - by);
        if (dist < bestDist) {
          bestDist = dist;
          bestA = { x: ax, y: ay };
          bestB = { x: bx, y: by };
        }
      }
    }

    carveCorridor(grid, rng, bestA, bestB, corridorWidth);
  }
}

// ---------------------------------------------------------------------------
// Wall layer generation
// ---------------------------------------------------------------------------

function buildWalls(grid: TileGrid): void {
  const floor = grid.layers.floor;
  const walls = grid.layers.walls;
  for (let y = 0; y < grid.height; y++) {
    for (let x = 0; x < grid.width; x++) {
      if (getTile(floor, grid, x, y) !== TILE_EMPTY) continue;
      for (const d of DIR4) {
        if (isFloor(grid, x + d.x, y + d.y)) {
          setTile(walls, grid, x, y, WALL);
          break;
        }
      }
      // Also check diagonals for wall corners
      if (getTile(walls, grid, x, y) === TILE_EMPTY) {
        const diags: Point[] = [
          { x: -1, y: -1 }, { x: 1, y: -1 },
          { x: -1, y: 1 }, { x: 1, y: 1 },
        ];
        for (const d of diags) {
          if (isFloor(grid, x + d.x, y + d.y)) {
            setTile(walls, grid, x, y, WALL);
            break;
          }
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Door placement
// ---------------------------------------------------------------------------

interface DoorInfo {
  tileX: number;
  tileY: number;
  orientation: 'north' | 'south' | 'east' | 'west';
}

function isInRoom(rooms: RoomRect[], x: number, y: number): number {
  for (let i = 0; i < rooms.length; i++) {
    const r = rooms[i]!;
    if (x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h) return i;
  }
  return -1;
}

function placeDoors(
  grid: TileGrid,
  rng: Rng,
  rooms: RoomRect[],
  doorRate: number,
): DoorInfo[] {
  const doors: DoorInfo[] = [];
  const placed = new Set<number>();
  const key = (x: number, y: number) => y * grid.width + x;

  for (let ri = 0; ri < rooms.length; ri++) {
    const room = rooms[ri]!;
    // Scan the border ring of the room
    for (let x = room.x - 1; x <= room.x + room.w; x++) {
      for (let y = room.y - 1; y <= room.y + room.h; y++) {
        const isEdge =
          x === room.x - 1 || x === room.x + room.w ||
          y === room.y - 1 || y === room.y + room.h;
        if (!isEdge) continue;
        if (!inBounds(grid, x, y)) continue;
        if (!isFloor(grid, x, y)) continue;
        if (placed.has(key(x, y))) continue;

        const insideRoom = isInRoom(rooms, x, y);
        if (insideRoom === ri) continue;

        if (rng() > doorRate) continue;

        let orientation: DoorInfo['orientation'] = 'north';
        if (y === room.y - 1) orientation = 'north';
        else if (y === room.y + room.h) orientation = 'south';
        else if (x === room.x - 1) orientation = 'west';
        else orientation = 'east';

        setTile(grid.layers.doors, grid, x, y, DOOR);
        placed.add(key(x, y));
        doors.push({ tileX: x, tileY: y, orientation });
      }
    }
  }
  return doors;
}

// ---------------------------------------------------------------------------
// Decor placement
// ---------------------------------------------------------------------------

/**
 * Constraint-based decor placement (WFC-inspired).
 *
 * Each decor type has placement constraints:
 *   - adjacency rules (what it can/can't be placed next to)
 *   - position affinity (wall-hugging, center, corner)
 *   - density limits per room
 *   - mutual exclusion radius
 *
 * The algorithm iterates cells in entropy order (fewest valid options first)
 * and collapses each cell to a decor type or empty, propagating constraints.
 */

const DECOR_TORCH = 10;
const DECOR_BARREL = 11;
const DECOR_CHEST = 12;
const DECOR_BONES = 13;
const DECOR_RUBBLE = 14;
const DECOR_PILLAR = 15;

interface DecorConstraint {
  id: number;
  wallAdjacent: boolean;
  minDistFromSame: number;
  maxPerRoom: number;
  weight: number;
  forbidNearDoor: boolean;
}

const DECOR_CONSTRAINTS: DecorConstraint[] = [
  { id: DECOR_TORCH,  wallAdjacent: true,  minDistFromSame: 4, maxPerRoom: 6,  weight: 3, forbidNearDoor: false },
  { id: DECOR_BARREL, wallAdjacent: true,  minDistFromSame: 2, maxPerRoom: 4,  weight: 2, forbidNearDoor: false },
  { id: DECOR_CHEST,  wallAdjacent: false, minDistFromSame: 6, maxPerRoom: 2,  weight: 1, forbidNearDoor: true },
  { id: DECOR_BONES,  wallAdjacent: false, minDistFromSame: 3, maxPerRoom: 5,  weight: 2, forbidNearDoor: false },
  { id: DECOR_RUBBLE, wallAdjacent: false, minDistFromSame: 2, maxPerRoom: 3,  weight: 1, forbidNearDoor: false },
  { id: DECOR_PILLAR, wallAdjacent: false, minDistFromSame: 3, maxPerRoom: 4,  weight: 1, forbidNearDoor: true },
];

function isAdjacentToWall(grid: TileGrid, x: number, y: number): boolean {
  const walls = grid.layers.walls;
  return (
    getTile(walls, grid, x-1, y) !== TILE_EMPTY ||
    getTile(walls, grid, x+1, y) !== TILE_EMPTY ||
    getTile(walls, grid, x, y-1) !== TILE_EMPTY ||
    getTile(walls, grid, x, y+1) !== TILE_EMPTY
  );
}

function isNearDoor(grid: TileGrid, x: number, y: number, radius: number): boolean {
  const doors = grid.layers.doors;
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      if (getTile(doors, grid, x+dx, y+dy) !== TILE_EMPTY) return true;
    }
  }
  return false;
}

function placeDecor(
  grid: TileGrid,
  rng: Rng,
  rooms: RoomRect[],
  density: number,
): void {
  const decor = grid.layers.decor;
  const doorsLayer = grid.layers.doors;

  for (const room of rooms) {
    const placed = new Map<number, number>();
    const placedPositions: Array<{ x: number; y: number; id: number }> = [];

    const candidates: Array<{ x: number; y: number; entropy: number }> = [];
    for (let y = room.y; y < room.y + room.h; y++) {
      for (let x = room.x; x < room.x + room.w; x++) {
        if (!isFloor(grid, x, y)) continue;
        if (getTile(doorsLayer, grid, x, y) !== TILE_EMPTY) continue;
        const validCount = DECOR_CONSTRAINTS.filter((c) => {
          if (c.wallAdjacent && !isAdjacentToWall(grid, x, y)) return false;
          if (c.forbidNearDoor && isNearDoor(grid, x, y, 2)) return false;
          return true;
        }).length;
        candidates.push({ x, y, entropy: validCount });
      }
    }

    candidates.sort((a, b) => a.entropy - b.entropy);

    for (const cell of candidates) {
      if (rng() >= density) continue;

      const validOptions: DecorConstraint[] = [];
      for (const c of DECOR_CONSTRAINTS) {
        if ((placed.get(c.id) ?? 0) >= c.maxPerRoom) continue;
        if (c.wallAdjacent && !isAdjacentToWall(grid, cell.x, cell.y)) continue;
        if (c.forbidNearDoor && isNearDoor(grid, cell.x, cell.y, 2)) continue;

        let tooClose = false;
        for (const p of placedPositions) {
          if (p.id === c.id) {
            const dist = Math.abs(p.x - cell.x) + Math.abs(p.y - cell.y);
            if (dist < c.minDistFromSame) { tooClose = true; break; }
          }
        }
        if (tooClose) continue;
        validOptions.push(c);
      }

      if (validOptions.length === 0) continue;

      const totalWeight = validOptions.reduce((sum, c) => sum + c.weight, 0);
      let roll = rng() * totalWeight;
      let chosen = validOptions[0]!;
      for (const c of validOptions) {
        roll -= c.weight;
        if (roll <= 0) { chosen = c; break; }
      }

      setTile(decor, grid, cell.x, cell.y, chosen.id);
      placed.set(chosen.id, (placed.get(chosen.id) ?? 0) + 1);
      placedPositions.push({ x: cell.x, y: cell.y, id: chosen.id });
    }
  }
}

// ---------------------------------------------------------------------------
// Room type assignment
// ---------------------------------------------------------------------------

const ROOM_TYPES = ['chamber', 'hall', 'loot', 'puzzle', 'safe', 'junction', 'stairs', 'boss'] as const;

function assignRoomType(rng: Rng, index: number, total: number): string {
  if (index === 0) return 'hall';
  if (index === total - 1) return 'boss';
  return ROOM_TYPES[rngInt(rng, 0, ROOM_TYPES.length - 1)]!;
}

// ---------------------------------------------------------------------------
// Grid-rooms algorithm
// ---------------------------------------------------------------------------

function generateGridRooms(
  grid: TileGrid,
  rng: Rng,
  p: GeneratorParams,
): RoomRect[] {
  const rooms: RoomRect[] = [];
  const targetCount = rngInt(rng, p.roomCountMin, p.roomCountMax);
  const cellW = Math.floor((grid.width - BORDER * 2) / Math.ceil(Math.sqrt(targetCount)));
  const cellH = Math.floor((grid.height - BORDER * 2) / Math.ceil(Math.sqrt(targetCount)));
  const cols = Math.floor((grid.width - BORDER * 2) / cellW);
  const rows = Math.floor((grid.height - BORDER * 2) / cellH);

  for (let gy = 0; gy < rows && rooms.length < targetCount; gy++) {
    for (let gx = 0; gx < cols && rooms.length < targetCount; gx++) {
      if (rng() < 0.15) continue;
      const w = rngInt(rng, p.roomSizeMin, Math.min(p.roomSizeMax, cellW - 2));
      const h = rngInt(rng, p.roomSizeMin, Math.min(p.roomSizeMax, cellH - 2));
      const x = BORDER + gx * cellW + rngInt(rng, 1, Math.max(1, cellW - w - 1));
      const y = BORDER + gy * cellH + rngInt(rng, 1, Math.max(1, cellH - h - 1));
      const rect: RoomRect = { x, y, w, h };
      if (rectFits(grid, rect, rooms)) {
        carveRect(grid, x, y, w, h);
        rooms.push(rect);
      }
    }
  }

  for (let i = 1; i < rooms.length; i++) {
    carveCorridor(grid, rng, roomCenter(rooms[i - 1]!), roomCenter(rooms[i]!), p.corridorWidth);
  }
  if (rooms.length > 2) {
    carveCorridor(grid, rng, roomCenter(rooms[rooms.length - 1]!), roomCenter(rooms[0]!), p.corridorWidth);
  }
  for (let i = 0; i < rooms.length; i++) {
    if (rng() < p.loopChance) {
      const j = rngInt(rng, 0, rooms.length - 1);
      if (j !== i) carveCorridor(grid, rng, roomCenter(rooms[i]!), roomCenter(rooms[j]!), p.corridorWidth);
    }
  }
  return rooms;
}

// ---------------------------------------------------------------------------
// BSP algorithm
// ---------------------------------------------------------------------------

interface BspNode {
  x: number; y: number; w: number; h: number;
  left?: BspNode; right?: BspNode;
  room?: RoomRect;
}

function bspSplit(node: BspNode, rng: Rng, minSize: number, depth: number): void {
  if (depth <= 0 || node.w < minSize * 2 + 3 && node.h < minSize * 2 + 3) return;

  const splitH = node.w > node.h ? false : node.h > node.w ? true : rng() < 0.5;
  const dim = splitH ? node.h : node.w;
  if (dim < minSize * 2 + 3) return;

  const split = rngInt(rng, minSize + 1, dim - minSize - 1);

  if (splitH) {
    node.left = { x: node.x, y: node.y, w: node.w, h: split };
    node.right = { x: node.x, y: node.y + split, w: node.w, h: node.h - split };
  } else {
    node.left = { x: node.x, y: node.y, w: split, h: node.h };
    node.right = { x: node.x + split, y: node.y, w: node.w - split, h: node.h };
  }

  bspSplit(node.left, rng, minSize, depth - 1);
  bspSplit(node.right, rng, minSize, depth - 1);
}

function bspPlaceRooms(node: BspNode, rng: Rng, p: GeneratorParams, grid: TileGrid, rooms: RoomRect[]): void {
  if (node.left && node.right) {
    bspPlaceRooms(node.left, rng, p, grid, rooms);
    bspPlaceRooms(node.right, rng, p, grid, rooms);
    return;
  }
  const padded = 2;
  const maxW = Math.min(p.roomSizeMax, node.w - padded * 2);
  const maxH = Math.min(p.roomSizeMax, node.h - padded * 2);
  if (maxW < p.roomSizeMin || maxH < p.roomSizeMin) return;

  const w = rngInt(rng, p.roomSizeMin, maxW);
  const h = rngInt(rng, p.roomSizeMin, maxH);
  const x = node.x + rngInt(rng, padded, Math.max(padded, node.w - w - padded));
  const y = node.y + rngInt(rng, padded, Math.max(padded, node.h - h - padded));
  const rect: RoomRect = { x, y, w, h };
  carveRect(grid, x, y, w, h);
  rooms.push(rect);
  node.room = rect;
}

function bspConnect(node: BspNode, rng: Rng, grid: TileGrid, corridorWidth: number): void {
  if (!node.left || !node.right) return;
  bspConnect(node.left, rng, grid, corridorWidth);
  bspConnect(node.right, rng, grid, corridorWidth);

  const getRoom = (n: BspNode): RoomRect | undefined => {
    if (n.room) return n.room;
    if (n.left) { const r = getRoom(n.left); if (r) return r; }
    if (n.right) return getRoom(n.right);
    return undefined;
  };

  const a = getRoom(node.left);
  const b = getRoom(node.right);
  if (a && b) carveCorridor(grid, rng, roomCenter(a), roomCenter(b), corridorWidth);
}

function generateBsp(grid: TileGrid, rng: Rng, p: GeneratorParams): RoomRect[] {
  const rooms: RoomRect[] = [];
  const root: BspNode = { x: BORDER, y: BORDER, w: grid.width - BORDER * 2, h: grid.height - BORDER * 2 };
  const depth = Math.max(3, Math.ceil(Math.log2(p.roomCountMax)));
  bspSplit(root, rng, p.roomSizeMin + 2, depth);
  bspPlaceRooms(root, rng, p, grid, rooms);
  bspConnect(root, rng, grid, p.corridorWidth);

  for (let i = 0; i < rooms.length; i++) {
    if (rng() < p.loopChance) {
      const j = rngInt(rng, 0, rooms.length - 1);
      if (j !== i) carveCorridor(grid, rng, roomCenter(rooms[i]!), roomCenter(rooms[j]!), p.corridorWidth);
    }
  }
  return rooms;
}

// ---------------------------------------------------------------------------
// Feature-growth algorithm (original)
// ---------------------------------------------------------------------------

function generateFeatureGrowth(
  grid: TileGrid,
  rng: Rng,
  p: GeneratorParams,
): RoomRect[] {
  const rooms: RoomRect[] = [];
  const targetRoomCount = rngInt(rng, p.roomCountMin, p.roomCountMax);
  const maxAttempts = targetRoomCount * 80;

  const initW = rngInt(rng, p.roomSizeMin, p.roomSizeMax);
  const initH = rngInt(rng, p.roomSizeMin, p.roomSizeMax);
  const initRoom: RoomRect = {
    x: Math.floor(p.width / 2 - initW / 2) + rngInt(rng, -3, 3),
    y: Math.floor(p.height / 2 - initH / 2) + rngInt(rng, -3, 3),
    w: initW,
    h: initH,
  };
  carveRect(grid, initRoom.x, initRoom.y, initRoom.w, initRoom.h);
  rooms.push(initRoom);

  let attempts = 0;
  while (rooms.length < targetRoomCount && attempts < maxAttempts) {
    attempts++;
    const candidates = collectWallCandidates(grid);
    if (candidates.length === 0) break;

    const wall = candidates[rngInt(rng, 0, candidates.length - 1)]!;
    const newRoom = tryPlaceRoom(grid, rng, wall, p, rooms);
    if (!newRoom) continue;

    carveRect(grid, newRoom.x, newRoom.y, newRoom.w, newRoom.h);
    rooms.push(newRoom);

    const prevRoom = rooms[rngInt(rng, 0, rooms.length - 2)]!;
    carveCorridor(grid, rng, roomCenter(prevRoom), roomCenter(newRoom), p.corridorWidth);

    if (rooms.length > 2 && rng() < p.loopChance) {
      const a = rooms[rngInt(rng, 0, rooms.length - 1)]!;
      const b = rooms[rngInt(rng, 0, rooms.length - 1)]!;
      if (a !== b) carveCorridor(grid, rng, roomCenter(a), roomCenter(b), p.corridorWidth);
    }
  }
  return rooms;
}

// ---------------------------------------------------------------------------
// Main generator
// ---------------------------------------------------------------------------

export function generateDungeon(params?: Partial<GeneratorParams>): GeneratorOutput {
  const p: GeneratorParams = { ...DEFAULT_GENERATOR_PARAMS, ...params };
  if (!p.seed) p.seed = rngSeed();
  const rng = createRng(p.seed);

  const grid = createEmptyTileGrid(p.width, p.height, p.tileSizePx);
  let rooms: RoomRect[];

  switch (p.algorithm) {
    case 'grid_rooms':
      rooms = generateGridRooms(grid, rng, p);
      break;
    case 'bsp':
      rooms = generateBsp(grid, rng, p);
      break;
    default:
      rooms = generateFeatureGrowth(grid, rng, p);
      break;
  }

  ensureConnectivity(grid, rng, rooms, p.corridorWidth);
  buildWalls(grid);
  autotileWallLayer(grid, STANDARD_WALL_IDS);
  autotileFloorVariation(grid, STANDARD_FLOOR_IDS, p.seed.length > 0 ? p.seed.charCodeAt(0) : 42);

  const doorInfos = placeDoors(grid, rng, rooms, p.doorRate);
  placeDecor(grid, rng, rooms, p.decorDensity);

  const outputRooms = rooms.map((r, i) => {
    const roomType = assignRoomType(rng, i, rooms.length);
    return {
      id: `room-${i}`,
      label: `${roomType.charAt(0).toUpperCase() + roomType.slice(1)} ${i + 1}`,
      bounds: { x: r.x, y: r.y, width: r.w, height: r.h },
      roomType,
      tileX: r.x,
      tileY: r.y,
      tileW: r.w,
      tileH: r.h,
    };
  });

  return { tileGrid: grid, rooms: outputRooms, doors: doorInfos };
}
