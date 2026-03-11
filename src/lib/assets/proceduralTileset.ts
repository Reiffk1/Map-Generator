import type { AssetPackManifest, TileDefinition, TileRole } from '../../models/tilemap';

export interface ProceduralTilesetOptions {
  tileSizePx: number;
  style: 'pixel' | 'ink' | 'battlemap';
}

const COLS = 16;

interface Palette {
  floor: string;
  floorAlt: string;
  floorLine: string;
  wall: string;
  wallEdge: string;
  wallInner: string;
  door: string;
  doorFrame: string;
  torchGlow: string;
  barrel: string;
  chest: string;
  bones: string;
  bg: string;
}

const palettes: Record<string, Palette> = {
  pixel: {
    floor: '#3d3530',
    floorAlt: '#443b35',
    floorLine: '#302a25',
    wall: '#1a1510',
    wallEdge: '#2e2820',
    wallInner: '#0f0c08',
    door: '#5c3d28',
    doorFrame: '#3a2618',
    torchGlow: '#ff9933',
    barrel: '#6b4830',
    chest: '#c4993a',
    bones: '#b0a898',
    bg: '#0a0a0b',
  },
  ink: {
    floor: '#f0e8d8',
    floorAlt: '#e8dfc8',
    floorLine: '#d0c4a8',
    wall: '#111111',
    wallEdge: '#333333',
    wallInner: '#000000',
    door: '#888888',
    doorFrame: '#444444',
    torchGlow: '#ffcc66',
    barrel: '#999999',
    chest: '#666666',
    bones: '#bbbbbb',
    bg: '#faf6ee',
  },
  battlemap: {
    floor: '#4a4038',
    floorAlt: '#524840',
    floorLine: '#3a3228',
    wall: '#1e1816',
    wallEdge: '#342e28',
    wallInner: '#0e0c0a',
    door: '#6b4a32',
    doorFrame: '#3e2a1a',
    torchGlow: '#ffaa44',
    barrel: '#7a5538',
    chest: '#d4a84a',
    bones: '#a09888',
    bg: '#0c0a08',
  },
};

type WallRole =
  | 'wall_island'
  | 'wall_end_n' | 'wall_end_e' | 'wall_end_s' | 'wall_end_w'
  | 'wall_edge_ns' | 'wall_edge_ew'
  | 'wall_corner_ne' | 'wall_corner_se' | 'wall_corner_sw' | 'wall_corner_nw'
  | 'wall_t_n' | 'wall_t_e' | 'wall_t_s' | 'wall_t_w'
  | 'wall_cross';

const wallRoles: WallRole[] = [
  'wall_island',
  'wall_end_n', 'wall_end_e', 'wall_end_s', 'wall_end_w',
  'wall_edge_ns', 'wall_edge_ew',
  'wall_corner_ne', 'wall_corner_se', 'wall_corner_sw', 'wall_corner_nw',
  'wall_t_n', 'wall_t_e', 'wall_t_s', 'wall_t_w',
  'wall_cross',
];

const openSides: Record<WallRole, { n: boolean; e: boolean; s: boolean; w: boolean }> = {
  wall_island:    { n: false, e: false, s: false, w: false },
  wall_end_n:     { n: true,  e: false, s: false, w: false },
  wall_end_e:     { n: false, e: true,  s: false, w: false },
  wall_end_s:     { n: false, e: false, s: true,  w: false },
  wall_end_w:     { n: false, e: false, s: false, w: true  },
  wall_edge_ns:   { n: true,  e: false, s: true,  w: false },
  wall_edge_ew:   { n: false, e: true,  s: false, w: true  },
  wall_corner_ne: { n: true,  e: true,  s: false, w: false },
  wall_corner_se: { n: false, e: true,  s: true,  w: false },
  wall_corner_sw: { n: false, e: false, s: true,  w: true  },
  wall_corner_nw: { n: true,  e: false, s: false, w: true  },
  wall_t_n:       { n: true,  e: true,  s: false, w: true  },
  wall_t_e:       { n: true,  e: true,  s: true,  w: false },
  wall_t_s:       { n: false, e: true,  s: true,  w: true  },
  wall_t_w:       { n: true,  e: false, s: true,  w: true  },
  wall_cross:     { n: true,  e: true,  s: true,  w: true  },
};

function drawFloorTile(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, s: number,
  pal: Palette, variant: number,
  style?: string,
) {
  ctx.fillStyle = variant % 2 === 0 ? pal.floor : pal.floorAlt;
  ctx.fillRect(x, y, s, s);

  if (style === 'battlemap') {
    const seed = ((variant * 7919 + 31) >>> 0);
    for (let py = 0; py < s; py += 2) {
      for (let px = 0; px < s; px += 2) {
        const n = ((px * 374761393 + py * 668265263 + seed) >>> 0) % 256;
        const offset = (n % 16) - 8;
        const base = variant % 2 === 0 ? [74, 64, 56] : [82, 72, 64];
        ctx.fillStyle = `rgb(${base[0]! + offset},${base[1]! + offset},${base[2]! + offset})`;
        ctx.fillRect(x + px, y + py, 2, 2);
      }
    }
    if (((seed * 3) >>> 0) % 7 < 2) {
      ctx.fillStyle = 'rgba(0,0,0,0.08)';
      const cx = x + ((seed % 5) + 1) * s / 6;
      const cy = y + (((seed >>> 8) % 5) + 1) * s / 6;
      ctx.beginPath();
      ctx.arc(cx, cy, s * 0.15, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = 'rgba(0,0,0,0.06)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, s - 1, s - 1);
    return;
  }

  ctx.strokeStyle = pal.floorLine;
  ctx.lineWidth = Math.max(1, s / 16);
  ctx.strokeRect(x + 0.5, y + 0.5, s - 1, s - 1);
  const hash = ((variant * 7919) >>> 0) % 8;
  if (hash < 3) {
    ctx.fillStyle = pal.floorLine;
    ctx.globalAlpha = 0.3;
    const cx = x + (hash + 1) * s / 4;
    const cy = y + ((hash * 3 + 1) % 4) * s / 4;
    ctx.fillRect(cx, cy, Math.max(1, s / 8), Math.max(1, s / 16));
    ctx.globalAlpha = 1;
  }
}

function drawWallTile(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, s: number,
  pal: Palette, role: WallRole,
) {
  const sides = openSides[role];
  ctx.fillStyle = pal.wall;
  ctx.fillRect(x, y, s, s);

  const edge = Math.max(2, s / 6);
  ctx.fillStyle = pal.wallEdge;
  if (!sides.n) ctx.fillRect(x, y, s, edge);
  if (!sides.s) ctx.fillRect(x, y + s - edge, s, edge);
  if (!sides.w) ctx.fillRect(x, y, edge, s);
  if (!sides.e) ctx.fillRect(x + s - edge, y, edge, s);

  ctx.fillStyle = pal.wallInner;
  const inset = edge;
  const iw = s - (sides.w ? 0 : inset) - (sides.e ? 0 : inset);
  const ih = s - (sides.n ? 0 : inset) - (sides.s ? 0 : inset);
  if (iw > 0 && ih > 0) {
    ctx.fillRect(
      x + (sides.w ? 0 : inset),
      y + (sides.n ? 0 : inset),
      iw, ih,
    );
  }
}

function drawDoorTile(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, s: number,
  pal: Palette, isNS: boolean,
) {
  ctx.fillStyle = pal.doorFrame;
  ctx.fillRect(x, y, s, s);

  const gap = Math.max(2, s / 4);
  ctx.fillStyle = pal.door;
  if (isNS) {
    ctx.fillRect(x + gap, y, s - gap * 2, s);
    ctx.fillStyle = pal.doorFrame;
    ctx.fillRect(x + s / 2 - 0.5, y, Math.max(1, s / 8), s);
  } else {
    ctx.fillRect(x, y + gap, s, s - gap * 2);
    ctx.fillStyle = pal.doorFrame;
    ctx.fillRect(x, y + s / 2 - 0.5, s, Math.max(1, s / 8));
  }
}

function drawDecorTile(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, s: number,
  pal: Palette, decorType: string,
) {
  const cx = x + s / 2;
  const cy = y + s / 2;
  const r = s / 4;

  switch (decorType) {
    case 'decor_torch':
      ctx.fillStyle = pal.torchGlow;
      ctx.globalAlpha = 0.3;
      ctx.beginPath();
      ctx.arc(cx, cy, r * 1.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = pal.torchGlow;
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.6, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'decor_barrel':
      ctx.fillStyle = pal.barrel;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = pal.doorFrame;
      ctx.lineWidth = Math.max(1, s / 12);
      ctx.stroke();
      break;
    case 'decor_chest':
      ctx.fillStyle = pal.chest;
      ctx.fillRect(cx - r, cy - r * 0.7, r * 2, r * 1.4);
      ctx.strokeStyle = pal.doorFrame;
      ctx.lineWidth = Math.max(1, s / 12);
      ctx.strokeRect(cx - r, cy - r * 0.7, r * 2, r * 1.4);
      ctx.fillRect(cx - r * 0.15, cy - r * 0.2, r * 0.3, r * 0.3);
      break;
    case 'decor_bones':
      ctx.fillStyle = pal.bones;
      ctx.globalAlpha = 0.7;
      for (let i = 0; i < 3; i++) {
        const bx = cx + (i - 1) * r * 0.6;
        const by = cy + ((i * 7) % 3 - 1) * r * 0.4;
        ctx.fillRect(bx, by, Math.max(1, s / 6), Math.max(1, s / 16));
      }
      ctx.globalAlpha = 1;
      break;
    case 'decor_rubble':
      ctx.fillStyle = pal.bones;
      ctx.globalAlpha = 0.5;
      for (let i = 0; i < 4; i++) {
        const rx = x + ((i * 11 + 3) % 7) * s / 8;
        const ry = y + ((i * 5 + 2) % 6) * s / 7;
        ctx.fillRect(rx, ry, Math.max(1, s / 8), Math.max(1, s / 8));
      }
      ctx.globalAlpha = 1;
      break;
    case 'decor_pillar':
      ctx.fillStyle = pal.wallEdge;
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = pal.wall;
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.5, 0, Math.PI * 2);
      ctx.fill();
      break;
  }
}

export function generateProceduralAtlas(options: ProceduralTilesetOptions): {
  canvas: HTMLCanvasElement;
  manifest: AssetPackManifest;
} {
  const s = options.tileSizePx;
  const pal = palettes[options.style] ?? palettes.pixel;
  const tiles: TileDefinition[] = [];
  let nextId = 1;

  const addTile = (role: TileRole, col: number, row: number, vars?: number[]): number => {
    const id = nextId++;
    tiles.push({ id, role, atlasX: col * s, atlasY: row * s, atlasW: s, atlasH: s, variations: vars });
    return id;
  };

  let row = 0;

  const floorIds: number[] = [];
  for (let v = 0; v < 4; v++) {
    floorIds.push(addTile('floor_stone', v, row));
  }
  addTile('floor_dirt', 4, row);
  addTile('floor_dirt', 5, row);
  row++;

  const wallIdMap: Record<string, number> = {};
  for (let i = 0; i < wallRoles.length; i++) {
    const col = i % COLS;
    const r = row + Math.floor(i / COLS);
    wallIdMap[wallRoles[i]] = addTile(wallRoles[i] as TileRole, col, r);
  }
  row += Math.ceil(wallRoles.length / COLS);

  addTile('door_closed_ns', 0, row);
  addTile('door_closed_ew', 1, row);
  addTile('door_open_ns', 2, row);
  addTile('door_open_ew', 3, row);
  row++;

  const decorRoles: TileRole[] = [
    'decor_torch', 'decor_barrel', 'decor_chest', 'decor_bones', 'decor_rubble', 'decor_pillar',
  ];
  for (let i = 0; i < decorRoles.length; i++) {
    addTile(decorRoles[i], i, row);
  }
  row++;

  const atlasW = COLS * s;
  const atlasH = row * s;
  const canvas = document.createElement('canvas');
  canvas.width = atlasW;
  canvas.height = atlasH;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = pal.bg;
  ctx.fillRect(0, 0, atlasW, atlasH);

  for (const tile of tiles) {
    const tx = tile.atlasX;
    const ty = tile.atlasY;

    if (tile.role.startsWith('floor_')) {
      drawFloorTile(ctx, tx, ty, s, pal, tile.id, options.style);
    } else if (tile.role.startsWith('wall_')) {
      drawWallTile(ctx, tx, ty, s, pal, tile.role as WallRole);
    } else if (tile.role.startsWith('door_')) {
      const isNS = tile.role.includes('_ns');
      drawDoorTile(ctx, tx, ty, s, pal, isNS);
    } else if (tile.role.startsWith('decor_')) {
      drawFloorTile(ctx, tx, ty, s, pal, 0, options.style);
      drawDecorTile(ctx, tx, ty, s, pal, tile.role);
    }
  }

  const manifest: AssetPackManifest = {
    id: `procedural-${options.style}`,
    name: options.style === 'ink' ? 'Ink & Quill' : options.style === 'battlemap' ? 'Battlemap' : 'Pixel Dungeon',
    author: 'Procedural',
    license: 'CC0',
    tileSizePx: s,
    atlasPath: '',
    atlasWidth: atlasW,
    atlasHeight: atlasH,
    tiles,
  };

  return { canvas, manifest };
}
