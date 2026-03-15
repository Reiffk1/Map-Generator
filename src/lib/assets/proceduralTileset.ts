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
  dirt: string;
  wood: string;
  water: string;
  wall: string;
  wallEdge: string;
  wallInner: string;
  door: string;
  doorFrame: string;
  doorLocked: string;
  doorSecret: string;
  doorBoss: string;
  metal: string;
  torchGlow: string;
  barrel: string;
  chest: string;
  bones: string;
  decor: string;
  fogUnseen: string;
  fogSeen: string;
  fogVisible: string;
  bg: string;
}

const palettes: Record<ProceduralTilesetOptions['style'], Palette> = {
  pixel: {
    floor: '#3d3530',
    floorAlt: '#443b35',
    floorLine: '#302a25',
    dirt: '#5a4634',
    wood: '#6c5137',
    water: '#244c5a',
    wall: '#1a1510',
    wallEdge: '#2e2820',
    wallInner: '#0f0c08',
    door: '#5c3d28',
    doorFrame: '#3a2618',
    doorLocked: '#7e6a2e',
    doorSecret: '#67584b',
    doorBoss: '#6f2024',
    metal: '#6c747d',
    torchGlow: '#ff9933',
    barrel: '#6b4830',
    chest: '#c4993a',
    bones: '#b0a898',
    decor: '#8d7a63',
    fogUnseen: 'rgba(6, 6, 8, 0.94)',
    fogSeen: 'rgba(12, 12, 16, 0.58)',
    fogVisible: 'rgba(0, 0, 0, 0.08)',
    bg: '#0a0a0b',
  },
  ink: {
    floor: '#f0e8d8',
    floorAlt: '#e8dfc8',
    floorLine: '#d0c4a8',
    dirt: '#cbbda0',
    wood: '#b7a184',
    water: '#92b5bf',
    wall: '#111111',
    wallEdge: '#333333',
    wallInner: '#000000',
    door: '#888888',
    doorFrame: '#444444',
    doorLocked: '#8a6e2d',
    doorSecret: '#8b8072',
    doorBoss: '#7a3a3a',
    metal: '#6d6d6d',
    torchGlow: '#ffcc66',
    barrel: '#999999',
    chest: '#666666',
    bones: '#bbbbbb',
    decor: '#717171',
    fogUnseen: 'rgba(18, 18, 18, 0.9)',
    fogSeen: 'rgba(28, 28, 28, 0.35)',
    fogVisible: 'rgba(255, 255, 255, 0.05)',
    bg: '#faf6ee',
  },
  battlemap: {
    floor: '#4a4038',
    floorAlt: '#524840',
    floorLine: '#3a3228',
    dirt: '#5d4937',
    wood: '#6e5338',
    water: '#2d5362',
    wall: '#1e1816',
    wallEdge: '#342e28',
    wallInner: '#0e0c0a',
    door: '#6b4a32',
    doorFrame: '#3e2a1a',
    doorLocked: '#93763a',
    doorSecret: '#766456',
    doorBoss: '#74272c',
    metal: '#717984',
    torchGlow: '#ffaa44',
    barrel: '#7a5538',
    chest: '#d4a84a',
    bones: '#a09888',
    decor: '#8e7d6c',
    fogUnseen: 'rgba(8, 8, 10, 0.9)',
    fogSeen: 'rgba(12, 12, 14, 0.42)',
    fogVisible: 'rgba(0, 0, 0, 0.05)',
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

const doorRoles: TileRole[] = [
  'door_closed_ns',
  'door_closed_ew',
  'door_open_ns',
  'door_open_ew',
  'door_locked_ns',
  'door_locked_ew',
  'door_secret_ns',
  'door_secret_ew',
  'door_boss_ns',
  'door_boss_ew',
];

const decorRoles: TileRole[] = [
  'decor_torch',
  'decor_barrel',
  'decor_table',
  'decor_chest',
  'decor_crate',
  'decor_bookshelf',
  'decor_altar',
  'decor_switch',
  'decor_bed',
  'decor_fountain',
  'decor_statue',
  'decor_trap_plate',
  'decor_bones',
  'decor_rubble',
  'decor_pillar',
  'decor_crack',
];

const openSides: Record<WallRole, { n: boolean; e: boolean; s: boolean; w: boolean }> = {
  wall_island: { n: false, e: false, s: false, w: false },
  wall_end_n: { n: true, e: false, s: false, w: false },
  wall_end_e: { n: false, e: true, s: false, w: false },
  wall_end_s: { n: false, e: false, s: true, w: false },
  wall_end_w: { n: false, e: false, s: false, w: true },
  wall_edge_ns: { n: true, e: false, s: true, w: false },
  wall_edge_ew: { n: false, e: true, s: false, w: true },
  wall_corner_ne: { n: true, e: true, s: false, w: false },
  wall_corner_se: { n: false, e: true, s: true, w: false },
  wall_corner_sw: { n: false, e: false, s: true, w: true },
  wall_corner_nw: { n: true, e: false, s: false, w: true },
  wall_t_n: { n: true, e: true, s: false, w: true },
  wall_t_e: { n: true, e: true, s: true, w: false },
  wall_t_s: { n: false, e: true, s: true, w: true },
  wall_t_w: { n: true, e: false, s: true, w: true },
  wall_cross: { n: true, e: true, s: true, w: true },
};

function drawFloorTile(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  s: number,
  pal: Palette,
  variant: number,
  role: TileRole,
  style?: ProceduralTilesetOptions['style'],
) {
  const base =
    role === 'floor_dirt' ? pal.dirt :
      role === 'floor_wood' ? pal.wood :
        role === 'floor_water' ? pal.water :
          variant % 2 === 0 ? pal.floor : pal.floorAlt;
  ctx.fillStyle = base;
  ctx.fillRect(x, y, s, s);

  if (role === 'floor_water') {
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = Math.max(1, s / 16);
    for (let row = 0; row < 3; row += 1) {
      const oy = y + (row + 1) * (s / 4);
      ctx.beginPath();
      ctx.moveTo(x + s * 0.15, oy);
      ctx.quadraticCurveTo(x + s * 0.45, oy - 2, x + s * 0.75, oy);
      ctx.stroke();
    }
    return;
  }

  if (role === 'floor_wood') {
    ctx.strokeStyle = pal.floorLine;
    ctx.lineWidth = Math.max(1, s / 12);
    for (let row = 1; row < 4; row += 1) {
      const oy = y + row * (s / 4);
      ctx.beginPath();
      ctx.moveTo(x, oy);
      ctx.lineTo(x + s, oy);
      ctx.stroke();
    }
    return;
  }

  if (style === 'battlemap') {
    const seed = ((variant * 7919 + 31) >>> 0);
    for (let py = 0; py < s; py += 2) {
      for (let px = 0; px < s; px += 2) {
        const n = ((px * 374761393 + py * 668265263 + seed) >>> 0) % 256;
        const offset = (n % 16) - 8;
        const baseRgb = role === 'floor_dirt' ? [93, 73, 55] : [74, 64, 56];
        ctx.fillStyle = `rgb(${baseRgb[0]! + offset},${baseRgb[1]! + offset},${baseRgb[2]! + offset})`;
        ctx.fillRect(x + px, y + py, 2, 2);
      }
    }
  }

  ctx.strokeStyle = pal.floorLine;
  ctx.lineWidth = Math.max(1, s / 16);
  ctx.strokeRect(x + 0.5, y + 0.5, s - 1, s - 1);
}

function drawWallTile(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  s: number,
  pal: Palette,
  role: WallRole,
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
      iw,
      ih,
    );
  }
}

function drawDoorTile(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  s: number,
  pal: Palette,
  role: TileRole,
) {
  const isNS = role.endsWith('_ns');
  const isOpen = role.startsWith('door_open');
  const isLocked = role.startsWith('door_locked');
  const isSecret = role.startsWith('door_secret');
  const isBoss = role.startsWith('door_boss');

  ctx.fillStyle = pal.doorFrame;
  ctx.fillRect(x, y, s, s);

  const gap = Math.max(2, s / 4);
  const fillColor =
    isBoss ? pal.doorBoss :
      isSecret ? pal.doorSecret :
        isLocked ? pal.doorLocked :
          pal.door;
  ctx.fillStyle = fillColor;

  if (isOpen) {
    if (isNS) {
      ctx.fillRect(x + gap, y, s * 0.22, s);
      ctx.fillRect(x + s - gap - s * 0.22, y, s * 0.22, s);
    } else {
      ctx.fillRect(x, y + gap, s, s * 0.22);
      ctx.fillRect(x, y + s - gap - s * 0.22, s, s * 0.22);
    }
  } else if (isNS) {
    ctx.fillRect(x + gap, y, s - gap * 2, s);
  } else {
    ctx.fillRect(x, y + gap, s, s - gap * 2);
  }

  ctx.strokeStyle = isSecret ? pal.metal : pal.doorFrame;
  ctx.lineWidth = Math.max(1, s / 12);
  if (!isOpen) {
    if (isNS) {
      ctx.strokeRect(x + gap, y + 1, s - gap * 2, s - 2);
      ctx.beginPath();
      ctx.moveTo(x + s / 2, y + 1);
      ctx.lineTo(x + s / 2, y + s - 1);
      ctx.stroke();
    } else {
      ctx.strokeRect(x + 1, y + gap, s - 2, s - gap * 2);
      ctx.beginPath();
      ctx.moveTo(x + 1, y + s / 2);
      ctx.lineTo(x + s - 1, y + s / 2);
      ctx.stroke();
    }
  }

  if (isLocked) {
    ctx.fillStyle = pal.metal;
    ctx.fillRect(x + s * 0.42, y + s * 0.38, s * 0.16, s * 0.18);
  }

  if (isSecret) {
    ctx.strokeStyle = pal.metal;
    ctx.setLineDash([Math.max(1, s / 10), Math.max(1, s / 12)]);
    ctx.strokeRect(x + 2, y + 2, s - 4, s - 4);
    ctx.setLineDash([]);
  }

  if (isBoss) {
    ctx.strokeStyle = pal.metal;
    ctx.lineWidth = Math.max(1, s / 10);
    if (isNS) {
      ctx.beginPath();
      ctx.moveTo(x + s * 0.28, y + 2);
      ctx.lineTo(x + s * 0.28, y + s - 2);
      ctx.moveTo(x + s * 0.72, y + 2);
      ctx.lineTo(x + s * 0.72, y + s - 2);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.moveTo(x + 2, y + s * 0.28);
      ctx.lineTo(x + s - 2, y + s * 0.28);
      ctx.moveTo(x + 2, y + s * 0.72);
      ctx.lineTo(x + s - 2, y + s * 0.72);
      ctx.stroke();
    }
  }
}

function drawDecorTile(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  s: number,
  pal: Palette,
  role: TileRole,
) {
  const cx = x + s / 2;
  const cy = y + s / 2;
  const r = s / 4;

  switch (role) {
    case 'decor_torch':
      ctx.fillStyle = pal.torchGlow;
      ctx.globalAlpha = 0.24;
      ctx.beginPath();
      ctx.arc(cx, cy, r * 1.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = pal.metal;
      ctx.fillRect(cx - 1, y + s * 0.18, 2, s * 0.48);
      ctx.fillStyle = pal.torchGlow;
      ctx.beginPath();
      ctx.moveTo(cx, y + s * 0.18);
      ctx.lineTo(cx + r * 0.8, y + s * 0.42);
      ctx.lineTo(cx - r * 0.8, y + s * 0.42);
      ctx.closePath();
      ctx.fill();
      break;
    case 'decor_barrel':
      ctx.fillStyle = pal.barrel;
      ctx.beginPath();
      ctx.ellipse(cx, cy, r * 0.85, r * 1.1, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = pal.metal;
      ctx.lineWidth = Math.max(1, s / 12);
      ctx.stroke();
      break;
    case 'decor_chest':
    case 'decor_crate':
      ctx.fillStyle = role === 'decor_chest' ? pal.chest : pal.barrel;
      ctx.fillRect(cx - r, cy - r * 0.72, r * 2, r * 1.44);
      ctx.strokeStyle = pal.doorFrame;
      ctx.lineWidth = Math.max(1, s / 12);
      ctx.strokeRect(cx - r, cy - r * 0.72, r * 2, r * 1.44);
      if (role === 'decor_chest') {
        ctx.fillStyle = pal.metal;
        ctx.fillRect(cx - r * 0.14, cy - r * 0.18, r * 0.28, r * 0.34);
      } else {
        ctx.beginPath();
        ctx.moveTo(cx - r, cy - r * 0.72);
        ctx.lineTo(cx + r, cy + r * 0.72);
        ctx.moveTo(cx + r, cy - r * 0.72);
        ctx.lineTo(cx - r, cy + r * 0.72);
        ctx.stroke();
      }
      break;
    case 'decor_table':
      ctx.fillStyle = pal.decor;
      ctx.fillRect(cx - r * 1.2, cy - r * 0.7, r * 2.4, r * 1.4);
      ctx.fillRect(cx - r, cy + r * 0.4, r * 0.18, r * 0.8);
      ctx.fillRect(cx + r * 0.82, cy + r * 0.4, r * 0.18, r * 0.8);
      break;
    case 'decor_bookshelf':
      ctx.fillStyle = pal.decor;
      ctx.fillRect(cx - r * 0.92, cy - r * 1.1, r * 1.84, r * 2.2);
      ctx.strokeStyle = pal.floorLine;
      ctx.lineWidth = Math.max(1, s / 16);
      for (let row = 0; row < 3; row += 1) {
        const oy = cy - r * 0.7 + row * (r * 0.7);
        ctx.beginPath();
        ctx.moveTo(cx - r * 0.92, oy);
        ctx.lineTo(cx + r * 0.92, oy);
        ctx.stroke();
      }
      break;
    case 'decor_altar':
      ctx.fillStyle = pal.decor;
      ctx.fillRect(cx - r * 0.9, cy - r * 0.55, r * 1.8, r * 1.1);
      ctx.fillRect(cx - r * 0.45, cy + r * 0.55, r * 0.9, r * 0.45);
      break;
    case 'decor_switch':
      ctx.fillStyle = pal.metal;
      ctx.fillRect(cx - r * 0.2, cy - r * 0.8, r * 0.4, r * 0.9);
      ctx.beginPath();
      ctx.moveTo(cx, cy - r * 0.85);
      ctx.lineTo(cx + r * 0.9, cy - r * 1.15);
      ctx.strokeStyle = pal.metal;
      ctx.lineWidth = Math.max(1, s / 12);
      ctx.stroke();
      break;
    case 'decor_bed':
      ctx.fillStyle = pal.decor;
      ctx.fillRect(cx - r * 1.1, cy - r * 0.7, r * 2.2, r * 1.4);
      ctx.fillStyle = pal.bones;
      ctx.fillRect(cx - r * 1.1, cy - r * 0.7, r * 0.55, r * 0.55);
      break;
    case 'decor_fountain':
      ctx.fillStyle = pal.water;
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.95, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = pal.wallEdge;
      ctx.lineWidth = Math.max(1, s / 12);
      ctx.stroke();
      break;
    case 'decor_statue':
      ctx.fillStyle = pal.decor;
      ctx.beginPath();
      ctx.arc(cx, cy - r * 0.7, r * 0.38, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(cx - r * 0.4, cy - r * 0.35, r * 0.8, r * 1.5);
      break;
    case 'decor_trap_plate':
      ctx.fillStyle = pal.metal;
      ctx.fillRect(cx - r * 1.05, cy - r * 0.55, r * 2.1, r * 1.1);
      ctx.strokeStyle = pal.floorLine;
      ctx.lineWidth = Math.max(1, s / 16);
      ctx.strokeRect(cx - r * 1.05, cy - r * 0.55, r * 2.1, r * 1.1);
      break;
    case 'decor_bones':
      ctx.fillStyle = pal.bones;
      ctx.globalAlpha = 0.75;
      for (let i = 0; i < 3; i += 1) {
        const bx = cx + (i - 1) * r * 0.55;
        const by = cy + ((i * 7) % 3 - 1) * r * 0.32;
        ctx.fillRect(bx, by, Math.max(1, s / 6), Math.max(1, s / 16));
      }
      ctx.globalAlpha = 1;
      break;
    case 'decor_rubble':
    case 'decor_crack':
      ctx.fillStyle = pal.bones;
      ctx.globalAlpha = 0.5;
      for (let i = 0; i < 4; i += 1) {
        const rx = x + ((i * 11 + 3) % 7) * s / 8;
        const ry = y + ((i * 5 + 2) % 6) * s / 7;
        ctx.fillRect(rx, ry, Math.max(1, s / 8), Math.max(1, s / 8));
      }
      ctx.globalAlpha = 1;
      if (role === 'decor_crack') {
        ctx.strokeStyle = pal.wallInner;
        ctx.lineWidth = Math.max(1, s / 14);
        ctx.beginPath();
        ctx.moveTo(x + s * 0.18, y + s * 0.18);
        ctx.lineTo(x + s * 0.4, y + s * 0.45);
        ctx.lineTo(x + s * 0.28, y + s * 0.82);
        ctx.lineTo(x + s * 0.7, y + s * 0.74);
        ctx.stroke();
      }
      break;
    case 'decor_pillar':
      ctx.fillStyle = pal.wallEdge;
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.85, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = pal.wall;
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.55, 0, Math.PI * 2);
      ctx.fill();
      break;
  }
}

function drawFogTile(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  s: number,
  pal: Palette,
  role: TileRole,
) {
  const fill =
    role === 'fog_unseen' ? pal.fogUnseen :
      role === 'fog_seen' ? pal.fogSeen :
        pal.fogVisible;
  ctx.fillStyle = fill;
  ctx.fillRect(x, y, s, s);
}

export function generateProceduralAtlas(options: ProceduralTilesetOptions): {
  canvas: HTMLCanvasElement;
  manifest: AssetPackManifest;
} {
  const s = options.tileSizePx;
  const pal = palettes[options.style] ?? palettes.pixel;
  const tiles: TileDefinition[] = [];
  let nextId = 1;

  const addTile = (role: TileRole, col: number, row: number): number => {
    const id = nextId++;
    tiles.push({ id, role, atlasX: col * s, atlasY: row * s, atlasW: s, atlasH: s });
    return id;
  };

  let row = 0;

  for (let v = 0; v < 4; v += 1) {
    addTile('floor_stone', v, row);
  }
  addTile('floor_dirt', 4, row);
  addTile('floor_dirt', 5, row);
  addTile('floor_wood', 6, row);
  addTile('floor_water', 7, row);
  row += 1;

  for (let i = 0; i < wallRoles.length; i += 1) {
    addTile(wallRoles[i], i % COLS, row + Math.floor(i / COLS));
  }
  row += Math.ceil(wallRoles.length / COLS);

  for (let i = 0; i < doorRoles.length; i += 1) {
    addTile(doorRoles[i], i % COLS, row + Math.floor(i / COLS));
  }
  addTile('stairs_up', 10, row);
  addTile('stairs_down', 11, row);
  row += Math.ceil((doorRoles.length + 2) / COLS);

  for (let i = 0; i < decorRoles.length; i += 1) {
    addTile(decorRoles[i], i % COLS, row + Math.floor(i / COLS));
  }
  row += Math.ceil(decorRoles.length / COLS);

  addTile('fog_unseen', 0, row);
  addTile('fog_seen', 1, row);
  addTile('fog_visible', 2, row);
  row += 1;

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
      drawFloorTile(ctx, tx, ty, s, pal, tile.id, tile.role, options.style);
    } else if (tile.role.startsWith('wall_')) {
      drawWallTile(ctx, tx, ty, s, pal, tile.role as WallRole);
    } else if (tile.role.startsWith('door_')) {
      drawDoorTile(ctx, tx, ty, s, pal, tile.role);
    } else if (tile.role.startsWith('stairs_')) {
      drawFloorTile(ctx, tx, ty, s, pal, tile.id, 'floor_stone', options.style);
      ctx.strokeStyle = pal.metal;
      ctx.lineWidth = Math.max(1, s / 12);
      const goingUp = tile.role === 'stairs_up';
      for (let i = 0; i < 4; i += 1) {
        const oy = ty + (goingUp ? 4 - i : i + 1) * (s / 6);
        ctx.beginPath();
        ctx.moveTo(tx + s * 0.2, oy);
        ctx.lineTo(tx + s * 0.8, oy);
        ctx.stroke();
      }
    } else if (tile.role.startsWith('decor_')) {
      drawFloorTile(ctx, tx, ty, s, pal, 0, 'floor_stone', options.style);
      drawDecorTile(ctx, tx, ty, s, pal, tile.role);
    } else if (tile.role.startsWith('fog_')) {
      drawFogTile(ctx, tx, ty, s, pal, tile.role);
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
