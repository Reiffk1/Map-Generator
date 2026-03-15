import type { EntityState, TransitionType } from '../../models/types';
import type { TileRole } from '../../models/tilemap';

export type AssetFamily =
  | 'door'
  | 'wall'
  | 'floor'
  | 'chest'
  | 'loot_marker'
  | 'hazard'
  | 'save_point'
  | 'npc'
  | 'stairs'
  | 'ladder'
  | 'gate'
  | 'prop';

export interface AssetDefinition {
  id: string;
  family: AssetFamily;
  label: string;
  keywords: string[];
  defaultIconId: string;
  orientation: 'none' | 'cardinal';
  states: Array<{
    state: EntityState;
    label: string;
    tint?: string;
    tileRole?: TileRole;
    prefab3d?: 'procedural' | 'gltf';
  }>;
  tileRole?: TileRole;
  prefab3d?: { kind: 'procedural' | 'gltf'; path?: string };
}

const states = (
  input: Array<AssetDefinition['states'][number]>,
): AssetDefinition['states'] => input;

export const assetCatalog: AssetDefinition[] = [
  {
    id: 'door.wood.basic',
    family: 'door',
    label: 'Wood Door',
    keywords: ['door', 'wood', 'basic'],
    defaultIconId: 'door',
    orientation: 'cardinal',
    states: states([
      { state: 'seen', label: 'Closed', tileRole: 'door_closed_ns', prefab3d: 'gltf' },
      { state: 'opened', label: 'Open', tileRole: 'door_open_ns', prefab3d: 'gltf' },
      { state: 'locked', label: 'Locked', tileRole: 'door_locked_ns', prefab3d: 'gltf' },
    ]),
    tileRole: 'door_closed_ns',
    prefab3d: { kind: 'gltf', path: '/assets/models/doors/large_castle_door.glb' },
  },
  {
    id: 'door.iron.band',
    family: 'door',
    label: 'Iron-Bound Door',
    keywords: ['door', 'iron', 'banded'],
    defaultIconId: 'locked-door',
    orientation: 'cardinal',
    states: states([
      { state: 'seen', label: 'Closed', tileRole: 'door_closed_ns', prefab3d: 'gltf' },
      { state: 'opened', label: 'Open', tileRole: 'door_open_ns', prefab3d: 'gltf' },
      { state: 'locked', label: 'Locked', tileRole: 'door_locked_ns', prefab3d: 'gltf' },
    ]),
    tileRole: 'door_closed_ns',
    prefab3d: { kind: 'gltf', path: '/assets/models/doors/large_castle_door.glb' },
  },
  {
    id: 'door.secret.panel',
    family: 'door',
    label: 'Secret Panel',
    keywords: ['door', 'secret', 'panel'],
    defaultIconId: 'secret-door',
    orientation: 'cardinal',
    states: states([
      { state: 'suspected', label: 'Suspected', tileRole: 'door_secret_ns', prefab3d: 'procedural' },
      { state: 'hidden', label: 'Hidden', tileRole: 'door_secret_ns', prefab3d: 'procedural' },
      { state: 'opened', label: 'Opened', tileRole: 'door_open_ns', prefab3d: 'procedural' },
    ]),
    tileRole: 'door_secret_ns',
    prefab3d: { kind: 'procedural' },
  },
  {
    id: 'door.boss.double',
    family: 'door',
    label: 'Boss Door',
    keywords: ['door', 'boss', 'double'],
    defaultIconId: 'locked-door',
    orientation: 'cardinal',
    states: states([
      { state: 'seen', label: 'Closed', tileRole: 'door_boss_ns', prefab3d: 'procedural' },
      { state: 'locked', label: 'Locked', tileRole: 'door_boss_ns', prefab3d: 'procedural' },
      { state: 'opened', label: 'Open', tileRole: 'door_open_ns', prefab3d: 'procedural' },
    ]),
    tileRole: 'door_boss_ns',
    prefab3d: { kind: 'procedural' },
  },
  {
    id: 'gate.bars',
    family: 'gate',
    label: 'Bar Gate',
    keywords: ['gate', 'bars'],
    defaultIconId: 'gate',
    orientation: 'cardinal',
    states: states([
      { state: 'seen', label: 'Closed', prefab3d: 'procedural' },
      { state: 'locked', label: 'Locked', prefab3d: 'procedural' },
      { state: 'opened', label: 'Opened', prefab3d: 'procedural' },
    ]),
    prefab3d: { kind: 'procedural' },
  },
  {
    id: 'portcullis.chain',
    family: 'gate',
    label: 'Portcullis',
    keywords: ['portcullis', 'chain', 'gate'],
    defaultIconId: 'portcullis',
    orientation: 'cardinal',
    states: states([
      { state: 'seen', label: 'Closed', prefab3d: 'procedural' },
      { state: 'locked', label: 'Locked', prefab3d: 'procedural' },
      { state: 'opened', label: 'Opened', prefab3d: 'procedural' },
    ]),
    prefab3d: { kind: 'procedural' },
  },
  {
    id: 'stairs.up.stone',
    family: 'stairs',
    label: 'Stairs Up',
    keywords: ['stairs', 'up'],
    defaultIconId: 'stairs-up',
    orientation: 'none',
    states: states([{ state: 'seen', label: 'Seen', tileRole: 'stairs_up', prefab3d: 'procedural' }]),
    tileRole: 'stairs_up',
    prefab3d: { kind: 'procedural' },
  },
  {
    id: 'stairs.down.stone',
    family: 'stairs',
    label: 'Stairs Down',
    keywords: ['stairs', 'down'],
    defaultIconId: 'stairs-down',
    orientation: 'none',
    states: states([{ state: 'seen', label: 'Seen', tileRole: 'stairs_down', prefab3d: 'procedural' }]),
    tileRole: 'stairs_down',
    prefab3d: { kind: 'procedural' },
  },
  {
    id: 'ladder.wood',
    family: 'ladder',
    label: 'Wood Ladder',
    keywords: ['ladder', 'wood'],
    defaultIconId: 'ladder',
    orientation: 'cardinal',
    states: states([{ state: 'seen', label: 'Seen', prefab3d: 'procedural' }]),
    prefab3d: { kind: 'procedural' },
  },
  {
    id: 'elevator.platform',
    family: 'stairs',
    label: 'Elevator',
    keywords: ['elevator', 'platform'],
    defaultIconId: 'shortcut',
    orientation: 'none',
    states: states([{ state: 'seen', label: 'Seen', prefab3d: 'procedural' }]),
    prefab3d: { kind: 'procedural' },
  },
  {
    id: 'warp.rune',
    family: 'stairs',
    label: 'Warp Rune',
    keywords: ['warp', 'rune', 'portal'],
    defaultIconId: 'warp',
    orientation: 'none',
    states: states([{ state: 'seen', label: 'Seen', prefab3d: 'procedural' }]),
    prefab3d: { kind: 'procedural' },
  },
  {
    id: 'wall.stone.block',
    family: 'wall',
    label: 'Stone Block Wall',
    keywords: ['wall', 'stone', 'block'],
    defaultIconId: 'breakable-wall',
    orientation: 'none',
    states: states([{ state: 'seen', label: 'Seen' }]),
  },
  {
    id: 'wall.brick.red',
    family: 'wall',
    label: 'Red Brick Wall',
    keywords: ['wall', 'brick', 'red'],
    defaultIconId: 'breakable-wall',
    orientation: 'none',
    states: states([{ state: 'seen', label: 'Seen' }]),
  },
  {
    id: 'wall.ruin.cracked',
    family: 'wall',
    label: 'Cracked Ruin Wall',
    keywords: ['wall', 'ruin', 'cracked'],
    defaultIconId: 'breakable-wall',
    orientation: 'none',
    states: states([{ state: 'seen', label: 'Seen' }]),
  },
  {
    id: 'wall.wood.timber',
    family: 'wall',
    label: 'Timber Wall',
    keywords: ['wall', 'wood', 'timber'],
    defaultIconId: 'door',
    orientation: 'none',
    states: states([{ state: 'seen', label: 'Seen' }]),
  },
  {
    id: 'wall.metal.grate',
    family: 'wall',
    label: 'Metal Grate Wall',
    keywords: ['wall', 'metal', 'grate'],
    defaultIconId: 'portcullis',
    orientation: 'none',
    states: states([{ state: 'seen', label: 'Seen' }]),
  },
  {
    id: 'floor.stone.flagstone',
    family: 'floor',
    label: 'Flagstone Floor',
    keywords: ['floor', 'stone', 'flagstone'],
    defaultIconId: 'question-mark',
    orientation: 'none',
    states: states([{ state: 'seen', label: 'Seen', tileRole: 'floor_stone' }]),
    tileRole: 'floor_stone',
  },
  {
    id: 'floor.dirt.packed',
    family: 'floor',
    label: 'Packed Dirt Floor',
    keywords: ['floor', 'dirt'],
    defaultIconId: 'question-mark',
    orientation: 'none',
    states: states([{ state: 'seen', label: 'Seen', tileRole: 'floor_dirt' }]),
    tileRole: 'floor_dirt',
  },
  {
    id: 'floor.wood.planks',
    family: 'floor',
    label: 'Wood Planks',
    keywords: ['floor', 'wood'],
    defaultIconId: 'question-mark',
    orientation: 'none',
    states: states([{ state: 'seen', label: 'Seen', tileRole: 'floor_wood' }]),
    tileRole: 'floor_wood',
  },
  {
    id: 'floor.water.shallow',
    family: 'floor',
    label: 'Shallow Water',
    keywords: ['floor', 'water'],
    defaultIconId: 'question-mark',
    orientation: 'none',
    states: states([{ state: 'seen', label: 'Seen', tileRole: 'floor_water' }]),
    tileRole: 'floor_water',
  },
  {
    id: 'floor.marble.white',
    family: 'floor',
    label: 'White Marble',
    keywords: ['floor', 'marble'],
    defaultIconId: 'question-mark',
    orientation: 'none',
    states: states([{ state: 'seen', label: 'Seen', tileRole: 'floor_stone' }]),
    tileRole: 'floor_stone',
  },
  {
    id: 'chest.wood.small',
    family: 'chest',
    label: 'Small Wood Chest',
    keywords: ['chest', 'wood', 'small'],
    defaultIconId: 'chest',
    orientation: 'cardinal',
    states: states([
      { state: 'seen', label: 'Seen', tileRole: 'decor_chest', prefab3d: 'procedural' },
      { state: 'opened', label: 'Opened', tileRole: 'decor_chest', prefab3d: 'procedural' },
      { state: 'collected', label: 'Collected', tileRole: 'decor_chest', prefab3d: 'procedural' },
      { state: 'missed', label: 'Missed', tileRole: 'decor_chest', prefab3d: 'procedural' },
    ]),
    tileRole: 'decor_chest',
    prefab3d: { kind: 'procedural' },
  },
  {
    id: 'chest.wood.large',
    family: 'chest',
    label: 'Large Wood Chest',
    keywords: ['chest', 'wood', 'large'],
    defaultIconId: 'chest',
    orientation: 'cardinal',
    states: states([
      { state: 'seen', label: 'Seen', tileRole: 'decor_chest', prefab3d: 'procedural' },
      { state: 'opened', label: 'Opened', tileRole: 'decor_chest', prefab3d: 'procedural' },
      { state: 'collected', label: 'Collected', tileRole: 'decor_chest', prefab3d: 'procedural' },
      { state: 'missed', label: 'Missed', tileRole: 'decor_chest', prefab3d: 'procedural' },
    ]),
    tileRole: 'decor_chest',
    prefab3d: { kind: 'procedural' },
  },
  {
    id: 'chest.iron.lockbox',
    family: 'chest',
    label: 'Iron Lockbox',
    keywords: ['chest', 'iron', 'lockbox'],
    defaultIconId: 'chest',
    orientation: 'cardinal',
    states: states([
      { state: 'seen', label: 'Seen', tileRole: 'decor_chest', prefab3d: 'procedural' },
      { state: 'opened', label: 'Opened', tileRole: 'decor_chest', prefab3d: 'procedural' },
      { state: 'collected', label: 'Collected', tileRole: 'decor_chest', prefab3d: 'procedural' },
      { state: 'missed', label: 'Missed', tileRole: 'decor_chest', prefab3d: 'procedural' },
    ]),
    tileRole: 'decor_chest',
    prefab3d: { kind: 'procedural' },
  },
  {
    id: 'loot.marker.generic',
    family: 'loot_marker',
    label: 'Loot Marker',
    keywords: ['loot', 'marker'],
    defaultIconId: 'loot',
    orientation: 'none',
    states: states([
      { state: 'seen', label: 'Seen' },
      { state: 'collected', label: 'Collected' },
      { state: 'missed', label: 'Missed' },
      { state: 'urgent_revisit', label: 'Urgent Revisit' },
    ]),
  },
  {
    id: 'loot.marker.key_item',
    family: 'loot_marker',
    label: 'Key Item Marker',
    keywords: ['loot', 'key', 'item'],
    defaultIconId: 'key-item',
    orientation: 'none',
    states: states([
      { state: 'seen', label: 'Seen' },
      { state: 'collected', label: 'Collected' },
      { state: 'missed', label: 'Missed' },
      { state: 'urgent_revisit', label: 'Urgent Revisit' },
    ]),
  },
  {
    id: 'loot.marker.unique',
    family: 'loot_marker',
    label: 'Unique Loot Marker',
    keywords: ['loot', 'unique'],
    defaultIconId: 'loot',
    orientation: 'none',
    states: states([
      { state: 'seen', label: 'Seen' },
      { state: 'collected', label: 'Collected' },
      { state: 'missed', label: 'Missed' },
      { state: 'urgent_revisit', label: 'Urgent Revisit' },
    ]),
  },
  {
    id: 'hazard.trap.spike',
    family: 'hazard',
    label: 'Spike Trap',
    keywords: ['hazard', 'spike', 'trap'],
    defaultIconId: 'hazard',
    orientation: 'none',
    states: states([
      { state: 'suspected', label: 'Suspected' },
      { state: 'seen', label: 'Seen' },
      { state: 'inaccessible', label: 'Inaccessible' },
    ]),
  },
  {
    id: 'hazard.trap.gas',
    family: 'hazard',
    label: 'Gas Trap',
    keywords: ['hazard', 'gas', 'trap'],
    defaultIconId: 'hazard',
    orientation: 'none',
    states: states([
      { state: 'suspected', label: 'Suspected' },
      { state: 'seen', label: 'Seen' },
      { state: 'inaccessible', label: 'Inaccessible' },
    ]),
  },
  {
    id: 'hazard.pit.hole',
    family: 'hazard',
    label: 'Pit',
    keywords: ['hazard', 'pit', 'hole'],
    defaultIconId: 'dead-end',
    orientation: 'none',
    states: states([
      { state: 'suspected', label: 'Suspected' },
      { state: 'seen', label: 'Seen' },
      { state: 'inaccessible', label: 'Inaccessible' },
    ]),
  },
  {
    id: 'save.lantern',
    family: 'save_point',
    label: 'Save Lantern',
    keywords: ['save', 'lantern'],
    defaultIconId: 'save-point',
    orientation: 'none',
    states: states([
      { state: 'seen', label: 'Seen' },
      { state: 'visited', label: 'Visited' },
      { state: 'completed', label: 'Completed' },
    ]),
  },
  {
    id: 'save.crystal',
    family: 'save_point',
    label: 'Save Crystal',
    keywords: ['save', 'crystal'],
    defaultIconId: 'save-point',
    orientation: 'none',
    states: states([
      { state: 'seen', label: 'Seen' },
      { state: 'visited', label: 'Visited' },
      { state: 'completed', label: 'Completed' },
    ]),
  },
  {
    id: 'npc.generic',
    family: 'npc',
    label: 'NPC',
    keywords: ['npc', 'generic'],
    defaultIconId: 'npc',
    orientation: 'none',
    states: states([
      { state: 'seen', label: 'Seen' },
      { state: 'visited', label: 'Visited' },
      { state: 'completed', label: 'Completed' },
    ]),
  },
  {
    id: 'npc.vendor',
    family: 'npc',
    label: 'Vendor',
    keywords: ['npc', 'vendor'],
    defaultIconId: 'shop',
    orientation: 'none',
    states: states([
      { state: 'seen', label: 'Seen' },
      { state: 'visited', label: 'Visited' },
      { state: 'completed', label: 'Completed' },
    ]),
  },
  {
    id: 'npc.quest_giver',
    family: 'npc',
    label: 'Quest Giver',
    keywords: ['npc', 'quest'],
    defaultIconId: 'quest-giver',
    orientation: 'none',
    states: states([
      { state: 'seen', label: 'Seen' },
      { state: 'visited', label: 'Visited' },
      { state: 'completed', label: 'Completed' },
    ]),
  },
  {
    id: 'prop.barrel',
    family: 'prop',
    label: 'Barrel',
    keywords: ['prop', 'barrel'],
    defaultIconId: 'barrel',
    orientation: 'cardinal',
    states: states([{ state: 'seen', label: 'Seen', tileRole: 'decor_barrel', prefab3d: 'procedural' }]),
    tileRole: 'decor_barrel',
    prefab3d: { kind: 'procedural' },
  },
  {
    id: 'prop.crate',
    family: 'prop',
    label: 'Crate',
    keywords: ['prop', 'crate'],
    defaultIconId: 'crate',
    orientation: 'cardinal',
    states: states([{ state: 'seen', label: 'Seen', tileRole: 'decor_crate', prefab3d: 'procedural' }]),
    tileRole: 'decor_crate',
    prefab3d: { kind: 'procedural' },
  },
  {
    id: 'prop.table.long',
    family: 'prop',
    label: 'Long Table',
    keywords: ['prop', 'table', 'long'],
    defaultIconId: 'question-mark',
    orientation: 'cardinal',
    states: states([{ state: 'seen', label: 'Seen', tileRole: 'decor_table', prefab3d: 'procedural' }]),
    tileRole: 'decor_table',
    prefab3d: { kind: 'procedural' },
  },
  {
    id: 'prop.table.round',
    family: 'prop',
    label: 'Round Table',
    keywords: ['prop', 'table', 'round'],
    defaultIconId: 'question-mark',
    orientation: 'cardinal',
    states: states([{ state: 'seen', label: 'Seen', tileRole: 'decor_table', prefab3d: 'procedural' }]),
    tileRole: 'decor_table',
    prefab3d: { kind: 'procedural' },
  },
  {
    id: 'prop.torch.wall',
    family: 'prop',
    label: 'Wall Torch',
    keywords: ['prop', 'torch'],
    defaultIconId: 'question-mark',
    orientation: 'cardinal',
    states: states([{ state: 'seen', label: 'Seen', tileRole: 'decor_torch', prefab3d: 'procedural' }]),
    tileRole: 'decor_torch',
    prefab3d: { kind: 'procedural' },
  },
  {
    id: 'prop.rubble',
    family: 'prop',
    label: 'Rubble',
    keywords: ['prop', 'rubble'],
    defaultIconId: 'question-mark',
    orientation: 'none',
    states: states([{ state: 'seen', label: 'Seen', tileRole: 'decor_rubble', prefab3d: 'procedural' }]),
    tileRole: 'decor_rubble',
    prefab3d: { kind: 'procedural' },
  },
  {
    id: 'prop.pillar',
    family: 'prop',
    label: 'Pillar',
    keywords: ['prop', 'pillar'],
    defaultIconId: 'question-mark',
    orientation: 'none',
    states: states([{ state: 'seen', label: 'Seen', tileRole: 'decor_pillar', prefab3d: 'procedural' }]),
    tileRole: 'decor_pillar',
    prefab3d: { kind: 'procedural' },
  },
  {
    id: 'prop.bones',
    family: 'prop',
    label: 'Bones',
    keywords: ['prop', 'bones'],
    defaultIconId: 'question-mark',
    orientation: 'none',
    states: states([{ state: 'seen', label: 'Seen', tileRole: 'decor_bones', prefab3d: 'procedural' }]),
    tileRole: 'decor_bones',
    prefab3d: { kind: 'procedural' },
  },
  {
    id: 'prop.bookshelf',
    family: 'prop',
    label: 'Bookshelf',
    keywords: ['prop', 'bookshelf'],
    defaultIconId: 'lore',
    orientation: 'cardinal',
    states: states([{ state: 'seen', label: 'Seen', tileRole: 'decor_bookshelf', prefab3d: 'procedural' }]),
    tileRole: 'decor_bookshelf',
    prefab3d: { kind: 'procedural' },
  },
  {
    id: 'prop.altar',
    family: 'prop',
    label: 'Altar',
    keywords: ['prop', 'altar'],
    defaultIconId: 'question-mark',
    orientation: 'cardinal',
    states: states([{ state: 'seen', label: 'Seen', tileRole: 'decor_altar', prefab3d: 'procedural' }]),
    tileRole: 'decor_altar',
    prefab3d: { kind: 'procedural' },
  },
  {
    id: 'prop.switch.lever',
    family: 'prop',
    label: 'Lever',
    keywords: ['prop', 'switch', 'lever'],
    defaultIconId: 'switch',
    orientation: 'cardinal',
    states: states([{ state: 'seen', label: 'Seen', tileRole: 'decor_switch', prefab3d: 'procedural' }]),
    tileRole: 'decor_switch',
    prefab3d: { kind: 'procedural' },
  },
  {
    id: 'prop.bed',
    family: 'prop',
    label: 'Bed',
    keywords: ['prop', 'bed'],
    defaultIconId: 'question-mark',
    orientation: 'cardinal',
    states: states([{ state: 'seen', label: 'Seen', tileRole: 'decor_bed', prefab3d: 'procedural' }]),
    tileRole: 'decor_bed',
    prefab3d: { kind: 'procedural' },
  },
  {
    id: 'prop.fountain',
    family: 'prop',
    label: 'Fountain',
    keywords: ['prop', 'fountain'],
    defaultIconId: 'save-point',
    orientation: 'none',
    states: states([{ state: 'seen', label: 'Seen', tileRole: 'decor_fountain', prefab3d: 'procedural' }]),
    tileRole: 'decor_fountain',
    prefab3d: { kind: 'procedural' },
  },
  {
    id: 'prop.statue',
    family: 'prop',
    label: 'Statue',
    keywords: ['prop', 'statue'],
    defaultIconId: 'npc',
    orientation: 'cardinal',
    states: states([{ state: 'seen', label: 'Seen', tileRole: 'decor_statue', prefab3d: 'procedural' }]),
    tileRole: 'decor_statue',
    prefab3d: { kind: 'procedural' },
  },
  {
    id: 'prop.trap.floor_plate',
    family: 'prop',
    label: 'Floor Plate',
    keywords: ['prop', 'trap', 'plate'],
    defaultIconId: 'switch',
    orientation: 'cardinal',
    states: states([{ state: 'seen', label: 'Seen', tileRole: 'decor_trap_plate', prefab3d: 'procedural' }]),
    tileRole: 'decor_trap_plate',
    prefab3d: { kind: 'procedural' },
  },
];

export const findAsset = (id: string) => assetCatalog.find((asset) => asset.id === id);

export const listAssetsByFamily = (family?: AssetFamily) =>
  family ? assetCatalog.filter((asset) => asset.family === family) : assetCatalog;

export const searchAssets = (query: string, family?: AssetFamily) => {
  const needle = query.trim().toLowerCase();
  const pool = listAssetsByFamily(family);
  if (!needle) return pool;
  return pool.filter((asset) =>
    asset.id.toLowerCase().includes(needle) ||
    asset.label.toLowerCase().includes(needle) ||
    asset.keywords.some((keyword) => keyword.toLowerCase().includes(needle)),
  );
};

export const getAssetStateDefinition = (assetId: string, state?: EntityState) => {
  const asset = findAsset(assetId);
  if (!asset) return undefined;
  if (!state) return asset.states[0];
  return asset.states.find((entry) => entry.state === state) ?? asset.states[0];
};

export const getDoorStyleForTransitionType = (transitionType: TransitionType) => {
  switch (transitionType) {
    case 'door':
      return 'door.wood.basic';
    case 'gate':
      return 'gate.bars';
    case 'portcullis':
      return 'portcullis.chain';
    case 'stairs_up':
      return 'stairs.up.stone';
    case 'stairs_down':
      return 'stairs.down.stone';
    case 'ladder':
      return 'ladder.wood';
    case 'elevator':
      return 'elevator.platform';
    case 'warp':
      return 'warp.rune';
    default:
      return 'door.wood.basic';
  }
};

export const getTileRoleForAsset = (assetId: string, state?: EntityState) =>
  getAssetStateDefinition(assetId, state)?.tileRole ?? findAsset(assetId)?.tileRole;
