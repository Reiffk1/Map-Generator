import type {
  EntityState,
  FloorRoomType,
  MarkerPlacementPreset,
  MarkerState,
  RoomPlacementMode,
  ToolSettings,
  TransitionType,
} from '../models/types';

export const roomPlacementOptions: Array<{ value: RoomPlacementMode; label: string; detail: string }> = [
  { value: 'rectangle', label: 'Rectangle', detail: 'Click-drag a literal chamber footprint.' },
  { value: 'paint', label: 'Paint', detail: 'Paint an orthogonal room footprint on the grid.' },
  { value: 'stamp', label: 'Stamp', detail: 'Click once to drop a parametric chamber block.' },
];

export const roomTypeOptions: Array<{ value: FloorRoomType; label: string; color: string }> = [
  { value: 'hall', label: 'Hall', color: '#efe4d2' },
  { value: 'chamber', label: 'Chamber', color: '#f4ebdb' },
  { value: 'junction', label: 'Junction', color: '#e8dbc6' },
  { value: 'loot', label: 'Loot', color: '#f1d6a4' },
  { value: 'secret', label: 'Secret', color: '#d9b1ba' },
  { value: 'safe', label: 'Safe', color: '#d9d4c4' },
  { value: 'stairs', label: 'Stairs', color: '#d5c7bf' },
  { value: 'boss', label: 'Boss', color: '#d7a8a1' },
];

export const corridorWidthOptions: Array<{ value: number; label: string; detail: string }> = [
  { value: 56, label: 'Tight', detail: 'Narrow passage or service hall.' },
  { value: 72, label: 'Hall', detail: 'Default corridor brush.' },
  { value: 96, label: 'Grand', detail: 'Wide boulevard or procession route.' },
];

export const transitionOptions: Array<{ value: TransitionType; label: string; iconId: string; color: string }> = [
  { value: 'door', label: 'Door', iconId: 'door', color: '#c53c48' },
  { value: 'portcullis', label: 'Portcullis', iconId: 'portcullis', color: '#b1775d' },
  { value: 'gate', label: 'Gate', iconId: 'gate', color: '#c46a52' },
  { value: 'stairs_up', label: 'Stairs Up', iconId: 'stairs-up', color: '#c56a49' },
  { value: 'stairs_down', label: 'Stairs Down', iconId: 'stairs-down', color: '#a9443c' },
  { value: 'ladder', label: 'Ladder', iconId: 'ladder', color: '#cb7d5b' },
  { value: 'warp', label: 'Warp', iconId: 'warp', color: '#d14f61' },
];

export const markerPresetOptions: Array<{
  value: MarkerPlacementPreset;
  label: string;
  iconId: string;
  color: string;
  markerType: string;
  markerState: MarkerState;
  state: EntityState;
  tags: string[];
}> = [
  {
    value: 'hazard',
    label: 'Hazard',
    iconId: 'hazard',
    color: '#cf313f',
    markerType: 'hazard',
    markerState: 'urgent',
    state: 'suspected',
    tags: ['hazard'],
  },
  {
    value: 'loot',
    label: 'Loot',
    iconId: 'loot',
    color: '#e0b35b',
    markerType: 'loot',
    markerState: 'default',
    state: 'seen',
    tags: ['loot'],
  },
  {
    value: 'chest',
    label: 'Chest',
    iconId: 'chest',
    color: '#d09d46',
    markerType: 'chest',
    markerState: 'default',
    state: 'seen',
    tags: ['loot', 'chest'],
  },
  {
    value: 'secret',
    label: 'Secret',
    iconId: 'possible-secret',
    color: '#cb6572',
    markerType: 'secret',
    markerState: 'secret',
    state: 'suspected',
    tags: ['secret'],
  },
  {
    value: 'save',
    label: 'Save',
    iconId: 'save-point',
    color: '#e2c27b',
    markerType: 'save',
    markerState: 'completed',
    state: 'visited',
    tags: ['checkpoint'],
  },
  {
    value: 'npc',
    label: 'NPC',
    iconId: 'npc',
    color: '#d8c7a6',
    markerType: 'npc',
    markerState: 'default',
    state: 'seen',
    tags: ['npc'],
  },
];

export const defaultToolSettings: ToolSettings = {
  roomPlacement: 'rectangle',
  roomType: 'chamber',
  roomPaintBrush: 1,
  roomPaintMode: 'add',
  roomStampSize: 6,
  roomStampShape: 'rectangle',
  roomStampRotation: 0,
  corridorWidth: 72,
  transitionType: 'door',
  doorStyleId: 'door.wood.basic',
  propAssetId: 'chest.wood.small',
  markerPreset: 'hazard',
  sketchWidth: 5,
  eraseMode: 'entity',
};

export const getRoomTypeDefinition = (roomType: FloorRoomType) =>
  roomTypeOptions.find((option) => option.value === roomType) ?? roomTypeOptions[1];

export const getTransitionDefinition = (transitionType: TransitionType) =>
  transitionOptions.find((option) => option.value === transitionType) ?? transitionOptions[0];

export const getMarkerPresetDefinition = (preset: MarkerPlacementPreset) =>
  markerPresetOptions.find((option) => option.value === preset) ?? markerPresetOptions[0];

export const describeRoomPlacement = (placement: RoomPlacementMode) =>
  placement === 'stamp' ? 'Stamped chamber' : placement === 'paint' ? 'Painted footprint' : 'Mapped chamber';
