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
  { value: 'stamp', label: 'Stamp', detail: 'Click once to drop a quick chamber block.' },
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
  corridorWidth: 72,
  transitionType: 'door',
  markerPreset: 'hazard',
  eraseMode: 'entity',
};

export const getRoomTypeDefinition = (roomType: FloorRoomType) =>
  roomTypeOptions.find((option) => option.value === roomType) ?? roomTypeOptions[1];

export const getTransitionDefinition = (transitionType: TransitionType) =>
  transitionOptions.find((option) => option.value === transitionType) ?? transitionOptions[0];

export const getMarkerPresetDefinition = (preset: MarkerPlacementPreset) =>
  markerPresetOptions.find((option) => option.value === preset) ?? markerPresetOptions[0];

export const describeRoomPlacement = (placement: RoomPlacementMode) =>
  placement === 'stamp' ? 'Stamped chamber' : 'Mapped chamber';
