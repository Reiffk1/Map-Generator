import type { AssetPackManifest, LoadedAssetPack, TileRole, TileDefinition } from '../../models/tilemap';
import type { Tileset as TiledTileset, Tile as TiledTile, AnyProperty } from '@kayahr/tiled';
import { generateProceduralAtlas } from './proceduralTileset';

const packCache = new Map<string, LoadedAssetPack>();

const roleFallbacks: Partial<Record<TileRole, TileRole[]>> = {
  door_locked_ns: ['door_closed_ns'],
  door_locked_ew: ['door_closed_ew'],
  door_secret_ns: ['door_closed_ns'],
  door_secret_ew: ['door_closed_ew'],
  door_boss_ns: ['door_locked_ns', 'door_closed_ns'],
  door_boss_ew: ['door_locked_ew', 'door_closed_ew'],
  decor_crate: ['decor_chest', 'decor_barrel'],
  decor_bookshelf: ['decor_table'],
  decor_altar: ['decor_table', 'decor_pillar'],
  decor_switch: ['decor_torch'],
  decor_bed: ['decor_table'],
  decor_fountain: ['decor_pillar'],
  decor_statue: ['decor_pillar'],
  decor_trap_plate: ['decor_rubble'],
  fog_unseen: ['fog_seen', 'fog_visible'],
  fog_seen: ['fog_visible'],
};

function buildRoleIndex(tiles: AssetPackManifest['tiles']): Map<TileRole, number[]> {
  const index = new Map<TileRole, number[]>();
  for (const tile of tiles) {
    const existing = index.get(tile.role);
    if (existing) {
      existing.push(tile.id);
    } else {
      index.set(tile.role, [tile.id]);
    }
  }
  return index;
}

function canvasToImage(canvas: HTMLCanvasElement): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = canvas.toDataURL();
  });
}

function loadImageFromUrl(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load atlas: ${url}`));
    img.src = url;
  });
}

async function loadProceduralPack(
  style: 'pixel' | 'ink' | 'battlemap',
  tileSizePx: number,
): Promise<LoadedAssetPack> {
  const { canvas, manifest } = generateProceduralAtlas({ tileSizePx, style });
  const atlasImage = await canvasToImage(canvas);
  const roleIndex = buildRoleIndex(manifest.tiles);
  return { manifest, atlasImage, roleIndex };
}

const builtInPacks: Record<string, { style: 'pixel' | 'ink' | 'battlemap'; tileSize: number; atlasUrl: string }> = {
  'default-pixel': { style: 'pixel', tileSize: 16, atlasUrl: '/assets/tilesets/pixel-dungeon.png' },
  'default-ink': { style: 'ink', tileSize: 16, atlasUrl: '/assets/tilesets/ink-dungeon.png' },
  'default-battlemap': { style: 'battlemap', tileSize: 48, atlasUrl: '/assets/tilesets/battlemap-dungeon.png' },
};

const kenneyTinyDungeon: AssetPackManifest = {
  id: 'kenney-tiny-dungeon',
  name: 'Kenney Tiny Dungeon',
  author: 'Kenney (kenney.nl)',
  license: 'CC0',
  tileSizePx: 16,
  atlasPath: '/assets/kenney/tiny-dungeon.png',
  atlasWidth: 256,
  atlasHeight: 176,
  tiles: buildKenneyTinyDungeonTiles(),
};

const kenneyScribbleDungeons: AssetPackManifest = {
  id: 'kenney-scribble-dungeons',
  name: 'Kenney Scribble Dungeons',
  author: 'Kenney (kenney.nl)',
  license: 'CC0',
  tileSizePx: 16,
  atlasPath: '/assets/kenney/scribble-dungeons.png',
  atlasWidth: 256,
  atlasHeight: 176,
  tiles: buildKenneyScribbleDungeonTiles(),
};

function buildKenneyTinyDungeonTiles(): TileDefinition[] {
  const s = 16;
  let id = 1;
  const t = (role: TileRole, col: number, row: number): TileDefinition =>
    ({ id: id++, role, atlasX: col * s, atlasY: row * s, atlasW: s, atlasH: s });

  return [
    t('floor_stone', 0, 0), t('floor_stone', 1, 0), t('floor_dirt', 2, 0), t('floor_wood', 3, 0),
    t('wall_solid', 0, 1), t('wall_edge_n', 1, 1), t('wall_edge_e', 2, 1), t('wall_edge_s', 3, 1),
    t('wall_edge_w', 4, 1), t('wall_corner_ne', 5, 1), t('wall_corner_se', 6, 1),
    t('wall_corner_sw', 7, 1), t('wall_corner_nw', 8, 1),
    t('wall_inner_ne', 9, 1), t('wall_inner_se', 10, 1),
    t('wall_inner_sw', 11, 1), t('wall_inner_nw', 12, 1),
    t('door_closed_ns', 0, 2), t('door_closed_ew', 1, 2),
    t('door_open_ns', 2, 2), t('door_open_ew', 3, 2),
    t('stairs_up', 4, 2), t('stairs_down', 5, 2),
    t('decor_torch', 0, 3), t('decor_barrel', 1, 3), t('decor_table', 2, 3),
    t('decor_chest', 3, 3), t('decor_bones', 4, 3), t('decor_rubble', 5, 3),
    t('decor_pillar', 6, 3),
  ];
}

function buildKenneyScribbleDungeonTiles(): TileDefinition[] {
  const s = 16;
  let id = 1;
  const t = (role: TileRole, col: number, row: number): TileDefinition =>
    ({ id: id++, role, atlasX: col * s, atlasY: row * s, atlasW: s, atlasH: s });

  return [
    t('floor_stone', 0, 0), t('floor_stone', 1, 0), t('floor_dirt', 2, 0), t('floor_water', 3, 0),
    t('wall_solid', 0, 1), t('wall_edge_n', 1, 1), t('wall_edge_e', 2, 1), t('wall_edge_s', 3, 1),
    t('wall_edge_w', 4, 1), t('wall_corner_ne', 5, 1), t('wall_corner_se', 6, 1),
    t('wall_corner_sw', 7, 1), t('wall_corner_nw', 8, 1),
    t('wall_inner_ne', 9, 1), t('wall_inner_se', 10, 1),
    t('wall_inner_sw', 11, 1), t('wall_inner_nw', 12, 1),
    t('door_closed_ns', 0, 2), t('door_closed_ew', 1, 2),
    t('door_open_ns', 2, 2), t('door_open_ew', 3, 2),
    t('stairs_up', 4, 2), t('stairs_down', 5, 2),
    t('decor_torch', 0, 3), t('decor_barrel', 1, 3), t('decor_table', 2, 3),
    t('decor_chest', 3, 3), t('decor_bones', 4, 3), t('decor_rubble', 5, 3),
    t('decor_pillar', 6, 3), t('decor_crack', 7, 3),
  ];
}

const externalPacks: Record<string, AssetPackManifest> = {
  'kenney-tiny-dungeon': kenneyTinyDungeon,
  'kenney-scribble-dungeons': kenneyScribbleDungeons,
};

export function getDefaultPackIds(): string[] {
  return [...Object.keys(builtInPacks), ...Object.keys(externalPacks)];
}

export function getDefaultPackManifests(): AssetPackManifest[] {
  return [
    {
      id: 'default-pixel',
      name: 'Pixel Dungeon',
      author: 'Procedural',
      license: 'CC0',
      tileSizePx: 16,
      atlasPath: '',
      atlasWidth: 256,
      atlasHeight: 64,
      tiles: [],
    },
    {
      id: 'default-ink',
      name: 'Ink & Quill',
      author: 'Procedural',
      license: 'CC0',
      tileSizePx: 16,
      atlasPath: '',
      atlasWidth: 256,
      atlasHeight: 64,
      tiles: [],
    },
    {
      id: 'default-battlemap',
      name: 'Battlemap',
      author: 'Procedural',
      license: 'CC0',
      tileSizePx: 48,
      atlasPath: '',
      atlasWidth: 768,
      atlasHeight: 192,
      tiles: [],
    },
    kenneyTinyDungeon,
    kenneyScribbleDungeons,
  ];
}

export async function loadAssetPack(packId: string): Promise<LoadedAssetPack> {
  const cached = packCache.get(packId);
  if (cached) return cached;

  const builtIn = builtInPacks[packId];
  if (builtIn) {
    try {
      const { manifest } = generateProceduralAtlas({ tileSizePx: builtIn.tileSize, style: builtIn.style });
      const atlasImage = await loadImageFromUrl(builtIn.atlasUrl);
      const roleIndex = buildRoleIndex(manifest.tiles);
      const pack: LoadedAssetPack = { manifest: { ...manifest, atlasPath: builtIn.atlasUrl }, atlasImage, roleIndex };
      packCache.set(packId, pack);
      return pack;
    } catch {
      const pack = await loadProceduralPack(builtIn.style, builtIn.tileSize);
      packCache.set(packId, pack);
      return pack;
    }
  }

  const external = externalPacks[packId];
  if (external) {
    try {
      const atlasImage = await loadImageFromUrl(external.atlasPath);
      const roleIndex = buildRoleIndex(external.tiles);
      const pack: LoadedAssetPack = { manifest: external, atlasImage, roleIndex };
      packCache.set(packId, pack);
      return pack;
    } catch {
      const fallback = await loadProceduralPack('pixel', external.tileSizePx);
      packCache.set(packId, fallback);
      return fallback;
    }
  }

  const fallback = await loadProceduralPack('pixel', 16);
  packCache.set(packId, fallback);
  return fallback;
}

function extractTiledRole(tile: TiledTile): TileRole {
  const props: AnyProperty[] = tile.properties ?? [];
  const roleProp = props.find((p) => p.name === 'role');
  if (roleProp && 'value' in roleProp && typeof roleProp.value === 'string') {
    return roleProp.value as TileRole;
  }
  const typeProp = tile.type;
  if (typeProp && (typeProp.startsWith('floor_') || typeProp.startsWith('wall_') ||
      typeProp.startsWith('door_') || typeProp.startsWith('decor_') || typeProp.startsWith('fog_'))) {
    return typeProp as TileRole;
  }
  return 'void';
}

export async function loadTiledJsonPack(
  tiledJson: Record<string, unknown>,
  atlasImageUrl: string,
): Promise<LoadedAssetPack> {
  const atlasImage = await loadImageFromUrl(atlasImageUrl);
  const ts = tiledJson as unknown as TiledTileset;
  const tileWidth = ts.tilewidth || 16;
  const tileHeight = ts.tileheight || 16;
  const columns = ts.columns || Math.floor(atlasImage.width / tileWidth);
  const tileCount = ts.tilecount || columns * Math.floor(atlasImage.height / tileHeight);
  const margin = ts.margin || 0;
  const spacing = ts.spacing || 0;

  const tileProps = new Map<number, TiledTile>();
  if (ts.tiles) {
    for (const t of ts.tiles) tileProps.set(t.id, t);
  }

  const tiles: TileDefinition[] = [];
  for (let i = 0; i < tileCount; i++) {
    const col = i % columns;
    const row = Math.floor(i / columns);
    const tiledTile = tileProps.get(i);
    const role = tiledTile ? extractTiledRole(tiledTile) : (i === 0 ? 'floor_stone' : 'void');
    tiles.push({
      id: i + 1,
      role,
      atlasX: margin + col * (tileWidth + spacing),
      atlasY: margin + row * (tileHeight + spacing),
      atlasW: tileWidth,
      atlasH: tileHeight,
    });
  }

  const manifest: AssetPackManifest = {
    id: `tiled-import-${Date.now()}`,
    name: ts.name || 'Tiled Import',
    author: 'Imported',
    license: 'custom',
    tileSizePx: tileWidth,
    atlasPath: atlasImageUrl,
    atlasWidth: atlasImage.width,
    atlasHeight: atlasImage.height,
    tiles,
  };

  const roleIndex = buildRoleIndex(tiles);
  const pack: LoadedAssetPack = { manifest, atlasImage, roleIndex };
  packCache.set(manifest.id, pack);
  return pack;
}

export function getCachedPack(packId: string): LoadedAssetPack | undefined {
  return packCache.get(packId);
}

export function getTileIdsForRole(pack: LoadedAssetPack, role: TileRole): number[] {
  return pack.roleIndex.get(role) ?? [];
}

export function getBestTileForRoleOrFallback(
  pack: LoadedAssetPack,
  role: TileRole,
): number | undefined {
  const candidates = [role, ...(roleFallbacks[role] ?? []), 'floor_stone'] as TileRole[];
  for (const candidate of candidates) {
    const tileId = pack.roleIndex.get(candidate)?.[0];
    if (tileId) return tileId;
  }
  return undefined;
}

export function getTileDefById(pack: LoadedAssetPack, tileId: number): AssetPackManifest['tiles'][number] | undefined {
  return pack.manifest.tiles.find((t) => t.id === tileId);
}
