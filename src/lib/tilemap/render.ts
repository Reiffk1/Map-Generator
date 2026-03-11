import type {
  TileGrid,
  TileLayer,
  LoadedAssetPack,
  TileDefinition,
} from '../../models/tilemap';
import { TILE_EMPTY, getTile, inBounds } from '../../models/tilemap';

const CHUNK_SIZE = 16;

// ---------- Cache types ----------

export interface TileRenderCache {
  chunks: Map<string, HTMLCanvasElement>;
  dirtyChunks: Set<string>;
  gridVersion: number;
}

export function createRenderCache(): TileRenderCache {
  return { chunks: new Map(), dirtyChunks: new Set(), gridVersion: 0 };
}

export function invalidateAll(cache: TileRenderCache): void {
  cache.chunks.clear();
  cache.dirtyChunks.clear();
  cache.gridVersion++;
}

export function invalidateChunkAt(
  cache: TileRenderCache,
  tileX: number,
  tileY: number,
): void {
  const cx = Math.floor(tileX / CHUNK_SIZE);
  const cy = Math.floor(tileY / CHUNK_SIZE);
  cache.dirtyChunks.add(`${cx},${cy}`);
}

// ---------- Atlas helper ----------

function drawTileFromAtlas(
  ctx: CanvasRenderingContext2D,
  atlas: HTMLImageElement,
  def: TileDefinition,
  dx: number,
  dy: number,
  dw: number,
  dh: number,
): void {
  ctx.drawImage(
    atlas,
    def.atlasX, def.atlasY, def.atlasW, def.atlasH,
    dx, dy, dw, dh,
  );
}

// ---------- Procedural fallback ----------

function hashCoord(x: number, y: number): number {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = ((h ^ (h >>> 13)) * 1274126177) | 0;
  return (h ^ (h >>> 16)) >>> 0;
}

function shadeVariation(base: string, x: number, y: number, range: number): string {
  const offset = (hashCoord(x, y) % (range * 2 + 1)) - range;
  const r = Math.min(255, Math.max(0, parseInt(base.slice(1, 3), 16) + offset));
  const g = Math.min(255, Math.max(0, parseInt(base.slice(3, 5), 16) + offset));
  const b = Math.min(255, Math.max(0, parseInt(base.slice(5, 7), 16) + offset));
  return `rgb(${r},${g},${b})`;
}

// Wall autotile IDs 7-22 map to roles with directional neighbor info
const WALL_ID_SIDES: Record<number, { n: boolean; e: boolean; s: boolean; w: boolean }> = {
  7:  { n: false, e: false, s: false, w: false }, // island
  8:  { n: true,  e: false, s: false, w: false }, // end_n
  9:  { n: false, e: true,  s: false, w: false }, // end_e
  10: { n: false, e: false, s: true,  w: false }, // end_s
  11: { n: false, e: false, s: false, w: true  }, // end_w
  12: { n: true,  e: false, s: true,  w: false }, // edge_ns
  13: { n: false, e: true,  s: false, w: true  }, // edge_ew
  14: { n: true,  e: true,  s: false, w: false }, // corner_ne
  15: { n: false, e: true,  s: true,  w: false }, // corner_se
  16: { n: false, e: false, s: true,  w: true  }, // corner_sw
  17: { n: true,  e: false, s: false, w: true  }, // corner_nw
  18: { n: true,  e: true,  s: false, w: true  }, // t_n
  19: { n: true,  e: true,  s: true,  w: false }, // t_e
  20: { n: false, e: true,  s: true,  w: true  }, // t_s
  21: { n: true,  e: false, s: true,  w: true  }, // t_w
  22: { n: true,  e: true,  s: true,  w: true  }, // cross
};

function drawProceduralWall(
  ctx: CanvasRenderingContext2D,
  sides: { n: boolean; e: boolean; s: boolean; w: boolean },
  dx: number,
  dy: number,
  size: number,
  worldX: number,
  worldY: number,
): void {
  ctx.fillStyle = shadeVariation('#1a1510', worldX, worldY, 4);
  ctx.fillRect(dx, dy, size, size);

  const edge = Math.max(2, size / 6);

  ctx.fillStyle = shadeVariation('#2e2820', worldX, worldY, 3);
  if (!sides.n) ctx.fillRect(dx, dy, size, edge);
  if (!sides.s) ctx.fillRect(dx, dy + size - edge, size, edge);
  if (!sides.w) ctx.fillRect(dx, dy, edge, size);
  if (!sides.e) ctx.fillRect(dx + size - edge, dy, edge, size);

  ctx.fillStyle = shadeVariation('#0f0c08', worldX, worldY, 2);
  const inset = edge;
  const iw = size - (sides.w ? 0 : inset) - (sides.e ? 0 : inset);
  const ih = size - (sides.n ? 0 : inset) - (sides.s ? 0 : inset);
  if (iw > 0 && ih > 0) {
    ctx.fillRect(
      dx + (sides.w ? 0 : inset),
      dy + (sides.n ? 0 : inset),
      iw, ih,
    );
  }
}

function drawProceduralTile(
  ctx: CanvasRenderingContext2D,
  tileId: number,
  dx: number,
  dy: number,
  size: number,
  worldX: number,
  worldY: number,
): void {
  if (tileId === TILE_EMPTY) return;

  const h = hashCoord(worldX, worldY);

  // Floor variants (IDs 1-4)
  if (tileId >= 1 && tileId <= 4) {
    const baseColors = ['#3d3530', '#3a3228', '#403830', '#383028'];
    ctx.fillStyle = shadeVariation(baseColors[tileId - 1]!, worldX, worldY, 6);
    ctx.fillRect(dx, dy, size, size);

    ctx.strokeStyle = 'rgba(0,0,0,0.18)';
    ctx.lineWidth = 1;
    ctx.strokeRect(dx + 0.5, dy + 0.5, size - 1, size - 1);

    if (h % 5 === 0) {
      ctx.fillStyle = 'rgba(255,255,255,0.04)';
      const sx = dx + (h % 7) * (size / 8);
      const sy = dy + ((h >>> 3) % 7) * (size / 8);
      ctx.fillRect(sx, sy, 2, 2);
    }
    return;
  }

  // Autotiled wall variants (IDs 7-22)
  const wallSides = WALL_ID_SIDES[tileId];
  if (wallSides) {
    drawProceduralWall(ctx, wallSides, dx, dy, size, worldX, worldY);
    return;
  }

  // Door (ID 3)
  if (tileId === 3) {
    ctx.fillStyle = shadeVariation('#5c3d28', worldX, worldY, 5);
    ctx.fillRect(dx, dy, size, size);
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.lineWidth = 1;
    ctx.strokeRect(dx + 1.5, dy + 1.5, size - 3, size - 3);
    ctx.strokeStyle = 'rgba(0,0,0,0.45)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    if (h % 2 === 0) {
      ctx.moveTo(dx + size / 2, dy + 2);
      ctx.lineTo(dx + size / 2, dy + size - 2);
    } else {
      ctx.moveTo(dx + 2, dy + size / 2);
      ctx.lineTo(dx + size - 2, dy + size / 2);
    }
    ctx.stroke();
    ctx.fillStyle = 'rgba(200,180,140,0.5)';
    ctx.beginPath();
    ctx.arc(dx + size * 0.65, dy + size * 0.5, size * 0.06, 0, Math.PI * 2);
    ctx.fill();
    return;
  }

  // Decor (IDs 10+)
  if (tileId >= 10) {
    const decorIndex = (tileId - 10) % 6;
    const cx = dx + size / 2;
    const cy = dy + size / 2;
    const r = size * 0.25;
    const palettes = ['#d4832e', '#7a5230', '#8c7c60', '#c9a84c', '#b8b0a0', '#6a6054'];
    ctx.fillStyle = palettes[decorIndex]!;

    if (decorIndex === 0) {
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,200,60,0.35)';
      ctx.beginPath(); ctx.arc(cx, cy, r * 1.8, 0, Math.PI * 2); ctx.fill();
    } else if (decorIndex === 1) {
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 1; ctx.stroke();
    } else if (decorIndex === 2) {
      ctx.fillRect(cx - r, cy - r * 0.6, r * 2, r * 1.2);
    } else if (decorIndex === 3) {
      ctx.fillRect(cx - r, cy - r * 0.7, r * 2, r * 1.4);
      ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 1;
      ctx.strokeRect(cx - r, cy - r * 0.7, r * 2, r * 1.4);
      ctx.beginPath(); ctx.moveTo(cx - r, cy); ctx.lineTo(cx + r, cy); ctx.stroke();
    } else {
      for (let i = 0; i < 3; i++) {
        const ox = ((hashCoord(worldX + i, worldY) % 5) - 2) * (size * 0.12);
        const oy = ((hashCoord(worldX, worldY + i) % 5) - 2) * (size * 0.12);
        ctx.beginPath(); ctx.arc(cx + ox, cy + oy, r * 0.45, 0, Math.PI * 2); ctx.fill();
      }
    }
  }
}

// ---------- Chunk rendering ----------

const LAYER_ORDER: readonly (keyof TileGrid['layers'])[] = [
  'terrain', 'floor', 'walls', 'doors', 'decor',
];

export function renderChunk(
  grid: TileGrid,
  assetPack: LoadedAssetPack | null,
  chunkX: number,
  chunkY: number,
): HTMLCanvasElement {
  const ts = grid.tileSizePx;
  const pxSize = CHUNK_SIZE * ts;
  const canvas = document.createElement('canvas');
  canvas.width = pxSize;
  canvas.height = pxSize;
  const ctx = canvas.getContext('2d')!;

  const startTX = chunkX * CHUNK_SIZE;
  const startTY = chunkY * CHUNK_SIZE;

  const tileLookup: Map<number, TileDefinition> | null = assetPack
    ? new Map(assetPack.manifest.tiles.map((t) => [t.id, t]))
    : null;

  for (const layerName of LAYER_ORDER) {
    const layer: TileLayer = grid.layers[layerName];
    for (let ly = 0; ly < CHUNK_SIZE; ly++) {
      const worldY = startTY + ly;
      if (worldY >= grid.height) break;
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        const worldX = startTX + lx;
        if (worldX >= grid.width) break;
        if (!inBounds(grid, worldX, worldY)) continue;

        const tileId = getTile(layer, grid, worldX, worldY);
        if (tileId === TILE_EMPTY) continue;

        const dx = lx * ts;
        const dy = ly * ts;

        if (tileLookup && assetPack) {
          const def = tileLookup.get(tileId);
          if (def) {
            drawTileFromAtlas(ctx, assetPack.atlasImage, def, dx, dy, ts, ts);
          }
        } else {
          drawProceduralTile(ctx, tileId, dx, dy, ts, worldX, worldY);
        }
      }
    }
  }

  return canvas;
}

// ---------- Main render ----------

/**
 * Render the tile grid into an output canvas.
 *
 * @param cullOnly When true, viewport info is used only for chunk culling.
 *   The canvas is NOT scaled/translated (useful when Konva or another
 *   layer handles zoom/pan).  Chunks are drawn at world positions and
 *   only the visible portion is re-rendered without clearing the full canvas.
 */
export function renderTileGrid(
  output: HTMLCanvasElement,
  grid: TileGrid,
  cache: TileRenderCache,
  assetPack: LoadedAssetPack | null,
  viewport: { x: number; y: number; width: number; height: number; zoom: number },
  cullOnly = false,
): void {
  const ctx = output.getContext('2d');
  if (!ctx) return;

  const ts = grid.tileSizePx;
  const chunkPx = CHUNK_SIZE * ts;
  const zoom = viewport.zoom;

  const minCX = Math.max(0, Math.floor(viewport.x / chunkPx));
  const minCY = Math.max(0, Math.floor(viewport.y / chunkPx));
  const maxCX = Math.min(
    Math.ceil(grid.width / CHUNK_SIZE) - 1,
    Math.floor((viewport.x + viewport.width / zoom) / chunkPx),
  );
  const maxCY = Math.min(
    Math.ceil(grid.height / CHUNK_SIZE) - 1,
    Math.floor((viewport.y + viewport.height / zoom) / chunkPx),
  );

  if (!cullOnly) {
    ctx.clearRect(0, 0, output.width, output.height);
    ctx.save();
    ctx.scale(zoom, zoom);
    ctx.translate(-viewport.x, -viewport.y);
  }

  for (let cy = minCY; cy <= maxCY; cy++) {
    for (let cx = minCX; cx <= maxCX; cx++) {
      const key = `${cx},${cy}`;

      if (cache.dirtyChunks.has(key)) {
        cache.chunks.delete(key);
        cache.dirtyChunks.delete(key);
      }

      let chunkCanvas = cache.chunks.get(key);
      if (!chunkCanvas) {
        chunkCanvas = renderChunk(grid, assetPack, cx, cy);
        cache.chunks.set(key, chunkCanvas);
      }

      ctx.drawImage(chunkCanvas, cx * chunkPx, cy * chunkPx);
    }
  }

  if (!cullOnly) {
    ctx.restore();
  }
}
