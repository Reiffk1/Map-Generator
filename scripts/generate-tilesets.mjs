/**
 * Generate CC0 procedural tileset atlas PNGs for shipping in-repo.
 * Run: node scripts/generate-tilesets.mjs
 */
import sharp from 'sharp';
import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, '..', 'public', 'assets', 'tilesets');

mkdirSync(OUT_DIR, { recursive: true });

// --- Drawing primitives on RGBA buffer ---
function createBuf(w, h) {
  return { data: Buffer.alloc(w * h * 4), w, h };
}

function setPixel(buf, x, y, r, g, b, a = 255) {
  x = Math.round(x); y = Math.round(y);
  if (x < 0 || x >= buf.w || y < 0 || y >= buf.h) return;
  const i = (y * buf.w + x) * 4;
  if (a < 255 && a > 0) {
    const fa = a / 255;
    const ia = 1 - fa;
    buf.data[i]   = Math.round(buf.data[i]   * ia + r * fa);
    buf.data[i+1] = Math.round(buf.data[i+1] * ia + g * fa);
    buf.data[i+2] = Math.round(buf.data[i+2] * ia + b * fa);
    buf.data[i+3] = Math.min(255, buf.data[i+3] + a);
  } else if (a === 255) {
    buf.data[i] = r; buf.data[i+1] = g; buf.data[i+2] = b; buf.data[i+3] = 255;
  }
}

function fillRect(buf, x, y, w, h, r, g, b, a = 255) {
  for (let dy = 0; dy < h; dy++)
    for (let dx = 0; dx < w; dx++)
      setPixel(buf, x + dx, y + dy, r, g, b, a);
}

function strokeRect(buf, x, y, w, h, r, g, b, lw = 1, a = 255) {
  for (let i = 0; i < lw; i++) {
    for (let dx = 0; dx < w; dx++) { setPixel(buf, x+dx, y+i, r,g,b,a); setPixel(buf, x+dx, y+h-1-i, r,g,b,a); }
    for (let dy = 0; dy < h; dy++) { setPixel(buf, x+i, y+dy, r,g,b,a); setPixel(buf, x+w-1-i, y+dy, r,g,b,a); }
  }
}

function fillCircle(buf, cx, cy, radius, r, g, b, a = 255) {
  const r2 = radius * radius;
  for (let dy = -Math.ceil(radius); dy <= Math.ceil(radius); dy++)
    for (let dx = -Math.ceil(radius); dx <= Math.ceil(radius); dx++)
      if (dx*dx + dy*dy <= r2) setPixel(buf, cx+dx, cy+dy, r, g, b, a);
}

function parseHex(hex) {
  const h = hex.replace('#','');
  return [parseInt(h.slice(0,2),16), parseInt(h.slice(2,4),16), parseInt(h.slice(4,6),16)];
}

// --- Palette definitions ---
const palettes = {
  pixel: {
    floor: '#3d3530', floorAlt: '#443b35', floorLine: '#302a25',
    wall: '#1a1510', wallEdge: '#2e2820', wallInner: '#0f0c08',
    door: '#5c3d28', doorFrame: '#3a2618',
    torchGlow: '#ff9933', barrel: '#6b4830', chest: '#c4993a', bones: '#b0a898',
    bg: '#0a0a0b',
  },
  ink: {
    floor: '#f0e8d8', floorAlt: '#e8dfc8', floorLine: '#d0c4a8',
    wall: '#111111', wallEdge: '#333333', wallInner: '#000000',
    door: '#888888', doorFrame: '#444444',
    torchGlow: '#ffcc66', barrel: '#999999', chest: '#666666', bones: '#bbbbbb',
    bg: '#faf6ee',
  },
  battlemap: {
    floor: '#4a4038', floorAlt: '#524840', floorLine: '#3a3228',
    wall: '#1e1816', wallEdge: '#342e28', wallInner: '#0e0c0a',
    door: '#6b4a32', doorFrame: '#3e2a1a',
    torchGlow: '#ffaa44', barrel: '#7a5538', chest: '#d4a84a', bones: '#a09888',
    bg: '#0c0a08',
  },
};

const COLS = 16;

const wallRoles = [
  'wall_island',
  'wall_end_n','wall_end_e','wall_end_s','wall_end_w',
  'wall_edge_ns','wall_edge_ew',
  'wall_corner_ne','wall_corner_se','wall_corner_sw','wall_corner_nw',
  'wall_t_n','wall_t_e','wall_t_s','wall_t_w',
  'wall_cross',
];

const openSides = {
  wall_island:    {n:0,e:0,s:0,w:0},
  wall_end_n:     {n:1,e:0,s:0,w:0},
  wall_end_e:     {n:0,e:1,s:0,w:0},
  wall_end_s:     {n:0,e:0,s:1,w:0},
  wall_end_w:     {n:0,e:0,s:0,w:1},
  wall_edge_ns:   {n:1,e:0,s:1,w:0},
  wall_edge_ew:   {n:0,e:1,s:0,w:1},
  wall_corner_ne: {n:1,e:1,s:0,w:0},
  wall_corner_se: {n:0,e:1,s:1,w:0},
  wall_corner_sw: {n:0,e:0,s:1,w:1},
  wall_corner_nw: {n:1,e:0,s:0,w:1},
  wall_t_n:       {n:1,e:1,s:0,w:1},
  wall_t_e:       {n:1,e:1,s:1,w:0},
  wall_t_s:       {n:0,e:1,s:1,w:1},
  wall_t_w:       {n:1,e:0,s:1,w:1},
  wall_cross:     {n:1,e:1,s:1,w:1},
};

function drawFloorTile(buf, x, y, s, pal, variant, style) {
  const base = variant % 2 === 0 ? parseHex(pal.floor) : parseHex(pal.floorAlt);
  if (style === 'battlemap') {
    const seed = ((variant * 7919 + 31) >>> 0);
    for (let py = 0; py < s; py++) {
      for (let px = 0; px < s; px++) {
        const n = ((px * 374761393 + py * 668265263 + seed) >>> 0) % 256;
        const offset = (n % 16) - 8;
        setPixel(buf, x+px, y+py, base[0]+offset, base[1]+offset, base[2]+offset);
      }
    }
  } else {
    fillRect(buf, x, y, s, s, ...base);
  }
  const [lr,lg,lb] = parseHex(pal.floorLine);
  strokeRect(buf, x, y, s, s, lr, lg, lb, 1);
  const hash = ((variant * 7919) >>> 0) % 8;
  if (hash < 3) {
    const cx = Math.floor(x + (hash+1)*s/4);
    const cy = Math.floor(y + ((hash*3+1)%4)*s/4);
    setPixel(buf, cx, cy, lr, lg, lb, 76);
    setPixel(buf, cx+1, cy, lr, lg, lb, 76);
  }
}

function drawWallTile(buf, x, y, s, pal, role) {
  const sides = openSides[role];
  const [wr,wg,wb] = parseHex(pal.wall);
  fillRect(buf, x, y, s, s, wr, wg, wb);
  const edge = Math.max(2, Math.floor(s/6));
  const [er,eg,eb] = parseHex(pal.wallEdge);
  if (!sides.n) fillRect(buf, x, y, s, edge, er, eg, eb);
  if (!sides.s) fillRect(buf, x, y+s-edge, s, edge, er, eg, eb);
  if (!sides.w) fillRect(buf, x, y, edge, s, er, eg, eb);
  if (!sides.e) fillRect(buf, x+s-edge, y, edge, s, er, eg, eb);
  const [ir,ig,ib] = parseHex(pal.wallInner);
  const inset = edge;
  const iw = s - (sides.w?0:inset) - (sides.e?0:inset);
  const ih = s - (sides.n?0:inset) - (sides.s?0:inset);
  if (iw > 0 && ih > 0) {
    fillRect(buf, x+(sides.w?0:inset), y+(sides.n?0:inset), iw, ih, ir, ig, ib);
  }
}

function drawDoorTile(buf, x, y, s, pal, isNS) {
  const [fr,fg,fb] = parseHex(pal.doorFrame);
  fillRect(buf, x, y, s, s, fr, fg, fb);
  const gap = Math.max(2, Math.floor(s/4));
  const [dr,dg,db] = parseHex(pal.door);
  if (isNS) {
    fillRect(buf, x+gap, y, s-gap*2, s, dr, dg, db);
    fillRect(buf, x+Math.floor(s/2), y, Math.max(1,Math.floor(s/8)), s, fr, fg, fb);
  } else {
    fillRect(buf, x, y+gap, s, s-gap*2, dr, dg, db);
    fillRect(buf, x, y+Math.floor(s/2), s, Math.max(1,Math.floor(s/8)), fr, fg, fb);
  }
}

function drawDecorTile(buf, x, y, s, pal, decorType) {
  const cx = Math.floor(x+s/2);
  const cy = Math.floor(y+s/2);
  const r = Math.floor(s/4);
  if (decorType === 'torch') {
    const [gr,gg,gb] = parseHex(pal.torchGlow);
    fillCircle(buf, cx, cy, Math.floor(r*1.5), gr, gg, gb, 76);
    fillCircle(buf, cx, cy, Math.floor(r*0.6), gr, gg, gb);
  } else if (decorType === 'barrel') {
    const [br,bg2,bb] = parseHex(pal.barrel);
    fillCircle(buf, cx, cy, r, br, bg2, bb);
  } else if (decorType === 'chest') {
    const [cr,cg,cb] = parseHex(pal.chest);
    fillRect(buf, cx-r, cy-Math.floor(r*0.7), r*2, Math.floor(r*1.4), cr, cg, cb);
    strokeRect(buf, cx-r, cy-Math.floor(r*0.7), r*2, Math.floor(r*1.4), ...parseHex(pal.doorFrame), 1);
  } else if (decorType === 'bones') {
    const [br,bg2,bb] = parseHex(pal.bones);
    for (let i = 0; i < 3; i++) {
      const bx = cx + (i-1)*Math.floor(r*0.6);
      const by = cy + ((i*7)%3-1)*Math.floor(r*0.4);
      setPixel(buf, bx, by, br, bg2, bb, 178);
      setPixel(buf, bx+1, by, br, bg2, bb, 178);
    }
  } else if (decorType === 'rubble') {
    const [br,bg2,bb] = parseHex(pal.bones);
    for (let i = 0; i < 4; i++) {
      const rx = x + ((i*11+3)%7)*Math.floor(s/8);
      const ry = y + ((i*5+2)%6)*Math.floor(s/7);
      setPixel(buf, rx, ry, br, bg2, bb, 127);
      setPixel(buf, rx+1, ry, br, bg2, bb, 127);
    }
  } else if (decorType === 'pillar') {
    const [er,eg,eb] = parseHex(pal.wallEdge);
    const [wr,wg,wb] = parseHex(pal.wall);
    fillCircle(buf, cx, cy, Math.floor(r*0.8), er, eg, eb);
    fillCircle(buf, cx, cy, Math.floor(r*0.5), wr, wg, wb);
  }
}

async function generateAtlas(styleName, tileSize) {
  const pal = palettes[styleName];
  let row = 0;

  // Floor tiles: row 0, 6 tiles (4 stone + 2 dirt)
  const floorCount = 6;
  row++;

  // Wall tiles: 16 variants
  const wallRowStart = row;
  row += Math.ceil(wallRoles.length / COLS);

  // Door tiles: 4 (ns closed, ew closed, ns open, ew open)
  const doorRow = row;
  row++;

  // Decor tiles: 6
  const decorRow = row;
  row++;

  const atlasW = COLS * tileSize;
  const atlasH = row * tileSize;
  const buf = createBuf(atlasW, atlasH);

  // Fill background
  const [bgr,bgg,bgb] = parseHex(pal.bg);
  fillRect(buf, 0, 0, atlasW, atlasH, bgr, bgg, bgb);

  // Draw floor tiles
  for (let v = 0; v < floorCount; v++) {
    drawFloorTile(buf, v*tileSize, 0, tileSize, pal, v+1, styleName);
  }

  // Draw wall tiles
  for (let i = 0; i < wallRoles.length; i++) {
    const col = i % COLS;
    const r = wallRowStart + Math.floor(i / COLS);
    drawWallTile(buf, col*tileSize, r*tileSize, tileSize, pal, wallRoles[i]);
  }

  // Draw door tiles
  drawDoorTile(buf, 0, doorRow*tileSize, tileSize, pal, true);
  drawDoorTile(buf, tileSize, doorRow*tileSize, tileSize, pal, false);
  drawDoorTile(buf, 2*tileSize, doorRow*tileSize, tileSize, pal, true);
  drawDoorTile(buf, 3*tileSize, doorRow*tileSize, tileSize, pal, false);

  // Draw decor tiles (on floor background)
  const decorTypes = ['torch', 'barrel', 'chest', 'bones', 'rubble', 'pillar'];
  for (let i = 0; i < decorTypes.length; i++) {
    const dx = i * tileSize;
    const dy = decorRow * tileSize;
    drawFloorTile(buf, dx, dy, tileSize, pal, 0, styleName);
    drawDecorTile(buf, dx, dy, tileSize, pal, decorTypes[i]);
  }

  const outPath = join(OUT_DIR, `${styleName}-dungeon.png`);
  await sharp(buf.data, { raw: { width: atlasW, height: atlasH, channels: 4 } })
    .png()
    .toFile(outPath);

  console.log(`  ✓ ${outPath} (${atlasW}×${atlasH})`);
  return { width: atlasW, height: atlasH, tileSize };
}

async function main() {
  console.log('Generating CC0 tileset atlas PNGs...\n');
  await generateAtlas('pixel', 16);
  await generateAtlas('ink', 16);
  await generateAtlas('battlemap', 48);
  console.log('\nDone! Atlases saved to public/assets/tilesets/');
}

main().catch((err) => { console.error(err); process.exit(1); });
