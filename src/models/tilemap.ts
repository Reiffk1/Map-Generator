export const TILE_EMPTY = 0;
export const TILE_VOID = 0;

export type TileLayerName =
  | 'terrain'
  | 'floor'
  | 'walls'
  | 'doors'
  | 'decor'
  | 'fog';

export interface TileLayer {
  name: TileLayerName;
  data: Uint16Array;
}

export interface TileGrid {
  width: number;
  height: number;
  tileSizePx: 16 | 48;
  layers: Record<TileLayerName, TileLayer>;
}

export type TileRole =
  | 'void'
  | 'floor_stone'
  | 'floor_dirt'
  | 'floor_wood'
  | 'floor_water'
  | 'wall_solid'
  | 'wall_edge_n'
  | 'wall_edge_e'
  | 'wall_edge_s'
  | 'wall_edge_w'
  | 'wall_corner_ne'
  | 'wall_corner_se'
  | 'wall_corner_sw'
  | 'wall_corner_nw'
  | 'wall_inner_ne'
  | 'wall_inner_se'
  | 'wall_inner_sw'
  | 'wall_inner_nw'
  | 'wall_end_n'
  | 'wall_end_e'
  | 'wall_end_s'
  | 'wall_end_w'
  | 'wall_island'
  | 'wall_t_n'
  | 'wall_t_e'
  | 'wall_t_s'
  | 'wall_t_w'
  | 'wall_cross'
  | 'door_closed_ns'
  | 'door_closed_ew'
  | 'door_open_ns'
  | 'door_open_ew'
  | 'door_locked_ns'
  | 'door_locked_ew'
  | 'stairs_up'
  | 'stairs_down'
  | 'decor_torch'
  | 'decor_barrel'
  | 'decor_table'
  | 'decor_chest'
  | 'decor_bones'
  | 'decor_rubble'
  | 'decor_pillar'
  | 'decor_crack'
  | 'fog_unseen'
  | 'fog_seen'
  | 'fog_visible';

export interface TileDefinition {
  id: number;
  role: TileRole;
  atlasX: number;
  atlasY: number;
  atlasW: number;
  atlasH: number;
  variations?: number[];
}

export interface AssetPackManifest {
  id: string;
  name: string;
  author: string;
  license: 'CC0' | 'CC-BY' | 'custom';
  tileSizePx: number;
  atlasPath: string;
  atlasWidth: number;
  atlasHeight: number;
  tiles: TileDefinition[];
}

export interface LoadedAssetPack {
  manifest: AssetPackManifest;
  atlasImage: HTMLImageElement;
  roleIndex: Map<TileRole, number[]>;
}

export interface GeneratorParams {
  seed: string;
  width: number;
  height: number;
  tileSizePx: 16 | 48;
  algorithm: 'feature_growth' | 'grid_rooms' | 'bsp';
  roomCountMin: number;
  roomCountMax: number;
  roomSizeMin: number;
  roomSizeMax: number;
  corridorWidth: number;
  loopChance: number;
  doorRate: number;
  decorDensity: number;
  theme: 'pixel' | 'ink' | 'battlemap';
}

export const DEFAULT_GENERATOR_PARAMS: GeneratorParams = {
  seed: '',
  width: 64,
  height: 64,
  tileSizePx: 16,
  algorithm: 'feature_growth',
  roomCountMin: 6,
  roomCountMax: 14,
  roomSizeMin: 4,
  roomSizeMax: 10,
  corridorWidth: 2,
  loopChance: 0.15,
  doorRate: 0.6,
  decorDensity: 0.08,
  theme: 'pixel',
};

export function createEmptyTileGrid(
  width: number,
  height: number,
  tileSizePx: 16 | 48 = 16,
): TileGrid {
  const size = width * height;
  const makeLayer = (name: TileLayerName): TileLayer => ({
    name,
    data: new Uint16Array(size),
  });

  return {
    width,
    height,
    tileSizePx,
    layers: {
      terrain: makeLayer('terrain'),
      floor: makeLayer('floor'),
      walls: makeLayer('walls'),
      doors: makeLayer('doors'),
      decor: makeLayer('decor'),
      fog: makeLayer('fog'),
    },
  };
}

export function tileIndex(grid: TileGrid, x: number, y: number): number {
  return y * grid.width + x;
}

export function inBounds(grid: TileGrid, x: number, y: number): boolean {
  return x >= 0 && x < grid.width && y >= 0 && y < grid.height;
}

export function getTile(
  layer: TileLayer,
  grid: TileGrid,
  x: number,
  y: number,
): number {
  if (!inBounds(grid, x, y)) return TILE_EMPTY;
  return layer.data[tileIndex(grid, x, y)]!;
}

export function setTile(
  layer: TileLayer,
  grid: TileGrid,
  x: number,
  y: number,
  value: number,
): void {
  if (!inBounds(grid, x, y)) return;
  layer.data[tileIndex(grid, x, y)] = value;
}

export function serializeTileGrid(grid: TileGrid): object {
  const layers: Record<string, number[]> = {};
  for (const [name, layer] of Object.entries(grid.layers)) {
    layers[name] = Array.from((layer as TileLayer).data);
  }
  return {
    width: grid.width,
    height: grid.height,
    tileSizePx: grid.tileSizePx,
    layers,
  };
}

export function deserializeTileGrid(raw: {
  width: number;
  height: number;
  tileSizePx: number;
  layers: Record<string, number[]>;
}): TileGrid {
  const grid = createEmptyTileGrid(
    raw.width,
    raw.height,
    (raw.tileSizePx === 48 ? 48 : 16) as 16 | 48,
  );
  for (const [name, arr] of Object.entries(raw.layers)) {
    const layer = grid.layers[name as TileLayerName];
    if (layer && arr) {
      layer.data.set(arr.slice(0, grid.width * grid.height));
    }
  }
  return grid;
}
