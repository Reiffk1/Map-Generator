import type {
  ActivityEntry,
  AnchorRecord,
  CorridorSegment,
  DoorwayRecord,
  FloorRoom,
  LayerRecord,
  MapRecord,
  MapViewSettings,
  MarkerRecord,
  NoteRecord,
  PathConnection,
  ProjectRecord,
  ProjectTemplate,
  RegionZone,
  RoomNode,
  SnapshotRecord,
  TransitionRecord,
  WorkspaceState,
} from '../models/types';
import { buildRoomWalls } from '../lib/floorplan';

const now = () => new Date().toISOString();
const layerId = (mapId: string, name: string) => `${mapId}_layer_${name}`;

export const createDefaultLayers = (mapId: string): LayerRecord[] => [
  { id: layerId(mapId, 'background'), name: 'Tracing Surface', type: 'background', visible: true, locked: false, opacity: 1, order: 0 },
  { id: layerId(mapId, 'terrain'), name: 'Ink and Sketch', type: 'terrain', visible: true, locked: false, opacity: 1, order: 1 },
  { id: layerId(mapId, 'rooms'), name: 'Floorplan', type: 'rooms', visible: true, locked: false, opacity: 1, order: 2 },
  { id: layerId(mapId, 'paths'), name: 'Routes and Corridors', type: 'paths', visible: true, locked: false, opacity: 1, order: 3 },
  { id: layerId(mapId, 'transitions'), name: 'Doors and Links', type: 'transitions', visible: true, locked: false, opacity: 1, order: 4 },
  { id: layerId(mapId, 'icons'), name: 'Pins and Symbols', type: 'icons', visible: true, locked: false, opacity: 1, order: 5 },
  { id: layerId(mapId, 'notes'), name: 'Field Notes', type: 'notes', visible: true, locked: false, opacity: 1, order: 6 },
  { id: layerId(mapId, 'labels'), name: 'Anchors and Labels', type: 'labels', visible: true, locked: false, opacity: 1, order: 7 },
  { id: layerId(mapId, 'overlay'), name: 'Review Overlays', type: 'overlay', visible: true, locked: false, opacity: 1, order: 8 },
  { id: layerId(mapId, 'archive'), name: 'Archive', type: 'archive', visible: true, locked: false, opacity: 0.8, order: 9 },
];

export const createDefaultView = (): MapViewSettings => ({
  zoom: 1,
  pan: { x: 0, y: 0 },
  hasUserAdjusted: false,
  viewMode: 'plan_2d',
  fogMode3d: 'cone',
  renderStyle2d: 'tile',
  assetPackId: 'default-pixel',
  stylePackId: 'stonekeep',
  showGrid: true,
  snapToGrid: true,
  gridSize: 48,
  showLegend: true,
  dimUnknown: true,
  showFogOfKnowledge: true,
  showCompleted: true,
  showOnlyUnresolved: false,
  showOnlyLoot: false,
  showOnlyDoors: false,
  showOnlyUncertain: false,
  showMinimap: true,
  showToolHints: true,
  showLegacyGraph: false,
  showDoorLabels: true,
  floorSurfaceStyle: 'stonekeep',
  wallStyle: 'stone',
  overlayPreset: 'all',
  lightPreset: 'torch',
  orbitDistance: 780,
  followDistance: 260,
  quality3d: 'medium',
});

const floorRoom = (mapId: string, input: Partial<FloorRoom> & Pick<FloorRoom, 'id' | 'label' | 'bounds'>): FloorRoom => ({
  kind: 'floor_room',
  layerId: input.layerId ?? layerId(mapId, 'rooms'),
  color: input.color ?? '#efe5d4',
  tags: input.tags ?? [],
  state: input.state ?? 'seen',
  noteIds: input.noteIds ?? [],
  createdAt: input.createdAt ?? now(),
  updatedAt: input.updatedAt ?? now(),
  subtitle: input.subtitle,
  footprint: input.footprint ?? [input.bounds],
  roomShape: input.roomShape ?? 'rectangle',
  roomType: input.roomType ?? 'chamber',
  fillPattern: input.fillPattern ?? 'ash',
  dangerLevel: input.dangerLevel ?? 1,
  lootCount: input.lootCount ?? 0,
  checklist: input.checklist ?? [],
  ...input,
});

const legacyRoom = (room: FloorRoom): RoomNode => ({
  kind: 'room',
  id: `${room.id}_legacy`,
  layerId: room.layerId,
  label: room.label,
  subtitle: room.subtitle,
  color: '#352327',
  tags: [...room.tags],
  state: room.state,
  noteIds: [...room.noteIds],
  createdAt: room.createdAt,
  updatedAt: room.updatedAt,
  position: { x: room.bounds.x, y: room.bounds.y },
  size: { width: room.bounds.width, height: room.bounds.height },
  shape: 'rectangle',
  description: '',
  dangerLevel: room.dangerLevel,
  lootCount: room.lootCount,
  checklist: [...room.checklist],
  template: room.roomType === 'loot' ? 'loot_room' : room.roomType === 'safe' ? 'safe_room' : room.roomType === 'puzzle' ? 'puzzle_room' : room.roomType === 'secret' ? 'hidden_room' : 'hallway',
});

const corridor = (mapId: string, input: Partial<CorridorSegment> & Pick<CorridorSegment, 'id' | 'points' | 'width' | 'color' | 'state'>): CorridorSegment => ({
  layerId: input.layerId ?? layerId(mapId, 'paths'),
  label: input.label,
  connectedRoomIds: input.connectedRoomIds ?? [],
  requirement: input.requirement,
  tags: input.tags ?? [],
  noteIds: input.noteIds ?? [],
  createdAt: input.createdAt ?? now(),
  updatedAt: input.updatedAt ?? now(),
  ...input,
});

const pathFromCorridor = (item: CorridorSegment): PathConnection => ({
  id: `${item.id}_legacy`,
  layerId: item.layerId,
  points: item.points,
  color: item.color,
  width: Math.max(3, Math.round(item.width / 10)),
  arrows: item.state === 'one_way' ? 'forward' : 'none',
  state: item.state,
  label: item.label,
  requirement: item.requirement,
  tags: [...item.tags],
  noteIds: [...item.noteIds],
  createdAt: item.createdAt,
  updatedAt: item.updatedAt,
});

const doorway = (mapId: string, input: Partial<DoorwayRecord> & Pick<DoorwayRecord, 'id' | 'label' | 'position' | 'orientation' | 'transitionType'>): DoorwayRecord => ({
  layerId: input.layerId ?? layerId(mapId, 'transitions'),
  color: input.color ?? '#9f3038',
  doorwayState: input.doorwayState ?? 'open',
  width: input.width ?? 34,
  attachedRoomId: input.attachedRoomId,
  transitionId: input.transitionId,
  tags: input.tags ?? [],
  noteIds: input.noteIds ?? [],
  createdAt: input.createdAt ?? now(),
  updatedAt: input.updatedAt ?? now(),
  ...input,
});

const transition = (mapId: string, input: Partial<TransitionRecord> & Pick<TransitionRecord, 'id' | 'label' | 'color' | 'position' | 'size' | 'transitionType' | 'state' | 'transitionState' | 'markerState'>): TransitionRecord => ({
  kind: 'transition',
  layerId: input.layerId ?? layerId(mapId, 'transitions'),
  tags: input.tags ?? [],
  noteIds: input.noteIds ?? [],
  createdAt: input.createdAt ?? now(),
  updatedAt: input.updatedAt ?? now(),
  angle: input.angle ?? 0,
  certainty: input.certainty ?? 'confirmed',
  oneWay: input.oneWay ?? false,
  hidden: input.hidden ?? false,
  disabled: input.disabled ?? false,
  intentionallyUnpaired: input.intentionallyUnpaired ?? false,
  doorwayId: input.doorwayId,
  destinationMapId: input.destinationMapId,
  destinationAnchorId: input.destinationAnchorId,
  returnTransitionId: input.returnTransitionId,
  requirement: input.requirement,
  pairedLabel: input.pairedLabel,
  ...input,
});

const marker = (mapId: string, input: Partial<MarkerRecord> & Pick<MarkerRecord, 'id' | 'label' | 'color' | 'position' | 'iconId' | 'markerType' | 'state'>): MarkerRecord => ({
  kind: 'marker',
  layerId: input.layerId ?? layerId(mapId, 'icons'),
  tags: input.tags ?? [],
  noteIds: input.noteIds ?? [],
  createdAt: input.createdAt ?? now(),
  updatedAt: input.updatedAt ?? now(),
  size: input.size ?? 22,
  opacity: input.opacity ?? 1,
  labelVisible: input.labelVisible ?? false,
  badges: input.badges ?? [],
  markerState: input.markerState ?? 'default',
  ...input,
});

const note = (mapId: string, input: Partial<NoteRecord> & Pick<NoteRecord, 'id' | 'title' | 'body' | 'position' | 'color' | 'state'>): NoteRecord => ({
  layerId: input.layerId ?? layerId(mapId, 'notes'),
  tags: input.tags ?? [],
  priority: input.priority ?? 'normal',
  category: input.category ?? 'general',
  spoiler: input.spoiler ?? false,
  pinned: input.pinned ?? false,
  collapsed: input.collapsed ?? false,
  completed: input.completed ?? false,
  linkedMapIds: input.linkedMapIds ?? [],
  createdAt: input.createdAt ?? now(),
  updatedAt: input.updatedAt ?? now(),
  attachedEntityId: input.attachedEntityId,
  attachedEntityKind: input.attachedEntityKind,
  ...input,
});

const anchor = (mapId: string, id: string, name: string, x: number, y: number, color: string): AnchorRecord => ({
  id,
  layerId: layerId(mapId, 'labels'),
  name,
  position: { x, y },
  color,
  mapId,
});

const zone = (mapId: string, input: Partial<RegionZone> & Pick<RegionZone, 'id' | 'label' | 'color' | 'bounds'>): RegionZone => ({
  layerId: input.layerId ?? layerId(mapId, 'overlay'),
  opacity: input.opacity ?? 0.12,
  tags: input.tags ?? [],
  ...input,
});

const mapFromFloorplan = (
  base: Omit<MapRecord, 'rooms' | 'paths' | 'wallSegments' | 'props'> & {
    floorRooms: FloorRoom[];
    corridors: CorridorSegment[];
    props?: MapRecord['props'];
  },
): MapRecord => ({
  ...base,
  rooms: base.floorRooms.map(legacyRoom),
  paths: base.corridors.map(pathFromCorridor),
  wallSegments: base.floorRooms.flatMap((room) => buildRoomWalls(layerId(base.id, 'rooms'), room)),
  props: base.props ?? [],
});

const chapelId = 'map_red_chapel';
const atriumId = 'map_crimson_atrium';
const tunnelsId = 'map_sump_tunnels';

export const sampleProject: ProjectRecord = (() => {
  const createdAt = now();
  const chapel = mapFromFloorplan({
    id: chapelId,
    name: 'Red Chapel',
    subtitle: 'Outer staging area',
    region: 'Reliquary of Ash',
    floor: 'Entry',
    accent: '#6d1e25',
    style: 'floorplan',
    notes: 'Start here in the tutorial: draw literal rooms first, then route marks and links.',
    completion: 68,
    favorite: true,
    layers: createDefaultLayers(chapelId),
    background: undefined,
    floorRooms: [
      floorRoom(chapelId, { id: 'chapel_entry', label: 'Reliquary Steps', subtitle: 'Approach from the outer chapel', bounds: { x: 744, y: 1056, width: 384, height: 216 }, roomType: 'safe', state: 'visited', dangerLevel: 0 }),
      floorRoom(chapelId, { id: 'chapel_nave', label: 'Red Chapel', subtitle: 'Simple tutorial-friendly hub', bounds: { x: 552, y: 576, width: 768, height: 336 }, roomType: 'junction', state: 'visited' }),
      floorRoom(chapelId, { id: 'chapel_sidecrypt', label: 'Side Crypt', subtitle: 'Optional loot room', bounds: { x: 1392, y: 552, width: 264, height: 216 }, roomType: 'loot', state: 'seen', lootCount: 1 }),
    ],
    corridors: [
      corridor(chapelId, { id: 'chapel_axis', points: [{ x: 936, y: 1056 }, { x: 936, y: 912 }, { x: 936, y: 576 }], width: 80, color: '#efe5d4', state: 'confirmed', connectedRoomIds: ['chapel_entry', 'chapel_nave'] }),
      corridor(chapelId, { id: 'chapel_sidecrypt_walk', points: [{ x: 1320, y: 672 }, { x: 1392, y: 672 }], width: 64, color: '#efe5d4', state: 'confirmed', connectedRoomIds: ['chapel_nave', 'chapel_sidecrypt'] }),
    ],
    doorways: [doorway(chapelId, { id: 'door_chapel_atrium', label: 'Reliquary Steps', position: { x: 936, y: 1272 }, orientation: 'south', transitionType: 'gate', transitionId: 'transition_chapel_atrium' })],
    routeOverlays: [{ id: 'route_chapel_push', layerId: layerId(chapelId, 'overlay'), label: 'Early push route', points: [{ x: 936, y: 1240 }, { x: 936, y: 720 }, { x: 1392, y: 672 }], width: 10, color: '#cf313f', opacity: 0.85, state: 'confirmed', tags: [], noteIds: [], createdAt, updatedAt: createdAt }],
    transitions: [transition(chapelId, { id: 'transition_chapel_atrium', label: 'Reliquary Steps', color: '#9f3038', position: { x: 936, y: 1272 }, size: { width: 34, height: 24 }, transitionType: 'gate', state: 'opened', transitionState: 'opened', markerState: 'default', destinationMapId: atriumId, destinationAnchorId: 'anchor_atrium_entry', doorwayId: 'door_chapel_atrium', pairedLabel: 'Chapel Gate' })],
    anchors: [anchor(chapelId, 'anchor_chapel_entry', 'Reliquary Steps', 936, 1224, '#9f3038')],
    markers: [marker(chapelId, { id: 'marker_chapel_npc', label: 'Caretaker', color: '#d9c8a5', position: { x: 756, y: 504 }, iconId: 'npc', markerType: 'npc', state: 'seen', labelVisible: true })],
    notesBoard: [note(chapelId, { id: 'note_chapel_tutorial', title: 'Good tutorial map', body: 'This map teaches room drawing, corridors, notes, and one clean linked exit.', position: { x: 456, y: 1020 }, color: '#e5b56d', state: 'resolved', category: 'general', completed: true, linkedMapIds: [chapelId] })],
    zones: [],
    sketches: [],
    view: createDefaultView(),
  });

  const atrium = mapFromFloorplan({
    id: atriumId,
    name: 'Crimson Atrium',
    subtitle: 'Main cathedral floor',
    region: 'Reliquary of Ash',
    floor: 'Sanctum',
    accent: '#9f3038',
    style: 'floorplan',
    notes: 'Use red route overlays for confirmed loops and keep secret drainage exits tentative until verified.',
    completion: 57,
    favorite: true,
    layers: createDefaultLayers(atriumId),
    background: undefined,
    floorRooms: [
      floorRoom(atriumId, { id: 'atrium_gate', label: 'South Gate', subtitle: 'Entry from the chapel', bounds: { x: 792, y: 1216, width: 288, height: 192 }, roomType: 'safe', state: 'visited', dangerLevel: 0 }),
      floorRoom(atriumId, { id: 'atrium_nave', label: 'Procession Hall', subtitle: 'Main vertical approach', bounds: { x: 768, y: 816, width: 336, height: 304 }, roomType: 'hall', state: 'visited' }),
      floorRoom(atriumId, { id: 'atrium_cross', label: 'Crimson Transept', subtitle: 'Crossroads under the reliquary', bounds: { x: 456, y: 480, width: 960, height: 240 }, roomType: 'junction', state: 'visited', lootCount: 1 }),
      floorRoom(atriumId, { id: 'atrium_ossuary', label: 'West Ossuary', subtitle: 'Bone shelves and a hidden grate', bounds: { x: 192, y: 336, width: 264, height: 216 }, roomType: 'secret', state: 'seen', dangerLevel: 3, tags: ['secret'] }),
      floorRoom(atriumId, { id: 'atrium_vestry', label: 'East Vestry', subtitle: 'Locked Sun Key branch', bounds: { x: 1416, y: 312, width: 288, height: 216 }, roomType: 'loot', state: 'seen', lootCount: 2, tags: ['key'] }),
    ],
    corridors: [
      corridor(atriumId, { id: 'atrium_main', points: [{ x: 936, y: 1216 }, { x: 936, y: 1120 }, { x: 936, y: 816 }], width: 88, color: '#efe5d4', state: 'confirmed', connectedRoomIds: ['atrium_gate', 'atrium_nave'] }),
      corridor(atriumId, { id: 'atrium_cross_axis', points: [{ x: 456, y: 600 }, { x: 936, y: 600 }, { x: 1416, y: 600 }], width: 84, color: '#efe5d4', state: 'confirmed', connectedRoomIds: ['atrium_cross'] }),
      corridor(atriumId, { id: 'atrium_secret_route', points: [{ x: 456, y: 444 }, { x: 336, y: 444 }], width: 64, color: '#efe5d4', state: 'uncertain', connectedRoomIds: ['atrium_ossuary'], label: 'Possible hidden drainage route' }),
    ],
    doorways: [
      doorway(atriumId, { id: 'door_atrium_chapel', label: 'Chapel Gate', position: { x: 936, y: 1408 }, orientation: 'south', transitionType: 'gate', transitionId: 'transition_atrium_chapel' }),
      doorway(atriumId, { id: 'door_atrium_grate', label: 'Bone Grate', position: { x: 192, y: 444 }, orientation: 'west', transitionType: 'tunnel', doorwayState: 'hidden', transitionId: 'transition_atrium_grate', tags: ['secret'] }),
      doorway(atriumId, { id: 'door_atrium_lock', label: 'Red Sigil Door', position: { x: 1416, y: 420 }, orientation: 'west', transitionType: 'door', doorwayState: 'locked', transitionId: 'transition_atrium_lock' }),
    ],
    routeOverlays: [{ id: 'route_atrium_main', layerId: layerId(atriumId, 'overlay'), label: 'Current confirmed push route', points: [{ x: 936, y: 1360 }, { x: 936, y: 600 }, { x: 1416, y: 420 }], width: 12, color: '#cf313f', opacity: 0.85, state: 'confirmed', tags: [], noteIds: [], createdAt, updatedAt: createdAt }],
    transitions: [
      transition(atriumId, { id: 'transition_atrium_chapel', label: 'Chapel Gate', color: '#9f3038', position: { x: 936, y: 1408 }, size: { width: 34, height: 24 }, transitionType: 'gate', state: 'opened', transitionState: 'opened', markerState: 'default', destinationMapId: chapelId, destinationAnchorId: 'anchor_chapel_entry', doorwayId: 'door_atrium_chapel', pairedLabel: 'Reliquary Steps' }),
      transition(atriumId, { id: 'transition_atrium_grate', label: 'Bone Grate', color: '#a84b52', position: { x: 192, y: 444 }, size: { width: 28, height: 28 }, transitionType: 'tunnel', state: 'suspected', transitionState: 'hidden', markerState: 'secret', certainty: 'suspected', doorwayId: 'door_atrium_grate', destinationMapId: tunnelsId, destinationAnchorId: 'anchor_tunnels_entry', hidden: true, pairedLabel: 'Grate Ladder' }),
      transition(atriumId, { id: 'transition_atrium_lock', label: 'Red Sigil Door', color: '#cf7c58', position: { x: 1416, y: 420 }, size: { width: 28, height: 28 }, transitionType: 'door', state: 'locked', transitionState: 'locked', markerState: 'locked', doorwayId: 'door_atrium_lock', requirement: 'Sun Key', intentionallyUnpaired: true }),
    ],
    anchors: [anchor(atriumId, 'anchor_atrium_entry', 'Atrium Steps', 936, 1320, '#e8b59b')],
    markers: [
      marker(atriumId, { id: 'marker_atrium_save', label: 'Ash Lantern', color: '#e7c37b', position: { x: 1110, y: 1160 }, iconId: 'save-point', markerType: 'save', state: 'visited', markerState: 'completed', labelVisible: true }),
      marker(atriumId, { id: 'marker_atrium_secret', label: 'Strange draft', color: '#c5545d', position: { x: 324, y: 280 }, iconId: 'possible-secret', markerType: 'secret', state: 'suspected', markerState: 'secret', badges: ['secret'], labelVisible: true }),
      marker(atriumId, { id: 'marker_atrium_key', label: 'Sun Key route', color: '#cf7c58', position: { x: 1548, y: 252 }, iconId: 'key-item', markerType: 'key', state: 'unknown', markerState: 'urgent', labelVisible: true }),
    ],
    notesBoard: [
      note(atriumId, { id: 'note_atrium_lock', title: 'Sigil door is still sealed', body: 'East vestry likely holds the Sun Key branch. Keep this in the revisit queue until the drainage puzzle is solved.', position: { x: 1376, y: 548 }, color: '#e5b56d', state: 'blocked', category: 'progress_blocker', priority: 'high', linkedMapIds: [atriumId, tunnelsId], attachedEntityId: 'transition_atrium_lock', attachedEntityKind: 'transition', tags: ['key', 'revisit'] }),
      note(atriumId, { id: 'note_atrium_secret', title: 'West wall may conceal a drainage ladder', body: 'Leave this path suspected, not confirmed, until the grate is actually opened from below.', position: { x: 72, y: 228 }, color: '#c88f94', state: 'open', category: 'secret_suspicion', linkedMapIds: [atriumId, tunnelsId], attachedEntityId: 'door_atrium_grate', attachedEntityKind: 'doorway', tags: ['secret'] }),
    ],
    zones: [zone(atriumId, { id: 'zone_atrium_patrol', label: 'Bell guardian patrol', color: '#6b2d34', bounds: { x: 720, y: 432, width: 456, height: 320 }, tags: ['danger'], opacity: 0.1 })],
    sketches: [{ id: 'sketch_atrium_blood', layerId: layerId(atriumId, 'terrain'), color: '#b92031', width: 7, opacity: 0.8, points: [{ x: 1032, y: 954 }, { x: 1080, y: 912 }, { x: 1116, y: 930 }] }],
    view: createDefaultView(),
  });

  const tunnels = mapFromFloorplan({
    id: tunnelsId,
    name: 'Sump Tunnels',
    subtitle: 'Drainage runs beneath the atrium',
    region: 'Reliquary of Ash',
    floor: 'Below',
    accent: '#7d2830',
    style: 'floorplan',
    notes: 'Literal route tracing matters most here. The drainage lines and floodgates are too abstract in graph form.',
    completion: 26,
    favorite: false,
    layers: createDefaultLayers(tunnelsId),
    background: undefined,
    floorRooms: [
      floorRoom(tunnelsId, { id: 'tunnels_entry', label: 'Grate Ladder', subtitle: 'Below the ossuary shelves', bounds: { x: 168, y: 360, width: 216, height: 168 }, roomType: 'secret', state: 'seen' }),
      floorRoom(tunnelsId, { id: 'tunnels_basin', label: 'Sump Hall', subtitle: 'Waterlogged central basin', bounds: { x: 552, y: 408, width: 480, height: 264 }, roomType: 'junction', state: 'seen', dangerLevel: 3 }),
      floorRoom(tunnelsId, { id: 'tunnels_furnace', label: 'Furnace Duct', subtitle: 'Likely Sun Key route', bounds: { x: 1248, y: 264, width: 360, height: 240 }, roomType: 'puzzle', state: 'suspected', dangerLevel: 4 }),
    ],
    corridors: [
      corridor(tunnelsId, { id: 'tunnels_main', points: [{ x: 384, y: 444 }, { x: 552, y: 444 }, { x: 1032, y: 540 }, { x: 1248, y: 540 }], width: 72, color: '#efe5d4', state: 'confirmed', connectedRoomIds: ['tunnels_entry', 'tunnels_basin'] }),
      corridor(tunnelsId, { id: 'tunnels_furnace_route', points: [{ x: 1248, y: 540 }, { x: 1248, y: 384 }], width: 64, color: '#efe5d4', state: 'event_gated', connectedRoomIds: ['tunnels_furnace'], requirement: 'Drain sump channel' }),
    ],
    doorways: [
      doorway(tunnelsId, { id: 'door_tunnels_atrium', label: 'Grate Ladder', position: { x: 168, y: 444 }, orientation: 'west', transitionType: 'ladder', transitionId: 'transition_tunnels_atrium' }),
      doorway(tunnelsId, { id: 'door_tunnels_sluice', label: 'Flood Sluice', position: { x: 1608, y: 384 }, orientation: 'east', transitionType: 'gate', doorwayState: 'locked', transitionId: 'transition_tunnels_sluice' }),
    ],
    routeOverlays: [{ id: 'route_tunnels_guess', layerId: layerId(tunnelsId, 'overlay'), label: 'Likely Sun Key route', points: [{ x: 192, y: 444 }, { x: 792, y: 540 }, { x: 1476, y: 384 }], width: 10, color: '#cf313f', opacity: 0.85, state: 'uncertain', tags: [], noteIds: [], createdAt, updatedAt: createdAt }],
    transitions: [
      transition(tunnelsId, { id: 'transition_tunnels_atrium', label: 'Grate Ladder', color: '#9f3038', position: { x: 168, y: 444 }, size: { width: 28, height: 28 }, transitionType: 'ladder', state: 'seen', transitionState: 'tentative', markerState: 'secret', certainty: 'suspected', doorwayId: 'door_tunnels_atrium', destinationMapId: atriumId, destinationAnchorId: 'anchor_atrium_entry', pairedLabel: 'Bone Grate' }),
      transition(tunnelsId, { id: 'transition_tunnels_sluice', label: 'Flood Sluice', color: '#cf7c58', position: { x: 1608, y: 384 }, size: { width: 28, height: 28 }, transitionType: 'gate', state: 'locked', transitionState: 'locked', markerState: 'locked', doorwayId: 'door_tunnels_sluice', requirement: 'Drain sump channel', intentionallyUnpaired: true }),
    ],
    anchors: [anchor(tunnelsId, 'anchor_tunnels_entry', 'Grate Ladder', 216, 444, '#9f3038')],
    markers: [
      marker(tunnelsId, { id: 'marker_tunnels_valve', label: 'Drain valve', color: '#cf313f', position: { x: 912, y: 696 }, iconId: 'puzzle', markerType: 'puzzle', state: 'unknown', markerState: 'urgent', labelVisible: true }),
      marker(tunnelsId, { id: 'marker_tunnels_cache', label: 'Ash cache', color: '#e7c37b', position: { x: 1476, y: 228 }, iconId: 'chest', markerType: 'loot', state: 'seen', markerState: 'missable', labelVisible: true, badges: ['missable'] }),
    ],
    notesBoard: [note(tunnelsId, { id: 'note_tunnels_route', title: 'Do not mark the furnace path confirmed yet', body: 'Keep the furnace route speculative until the sump is drained and the flood sluice can be tested.', position: { x: 1116, y: 756 }, color: '#c88f94', state: 'open', category: 'route_uncertainty', priority: 'high', linkedMapIds: [tunnelsId, atriumId], tags: ['uncertain', 'sun-key'] })],
    zones: [zone(tunnelsId, { id: 'zone_tunnels_flood', label: 'Flooded channel', color: '#70252e', bounds: { x: 432, y: 336, width: 696, height: 432 }, tags: ['hazard'], opacity: 0.12 })],
    sketches: [{ id: 'sketch_tunnels_leak', layerId: layerId(tunnelsId, 'terrain'), color: '#b92031', width: 6, opacity: 0.82, points: [{ x: 912, y: 624 }, { x: 954, y: 660 }, { x: 978, y: 720 }] }],
    view: createDefaultView(),
  });

  const sessionLog: ActivityEntry[] = [
    { id: 'activity_1', timestamp: createdAt, kind: 'map_created', mapId: chapelId, title: 'Seeded floorplan sample project', summary: 'Created a floorplan-first atlas with linked gates, secret grates, revisit blockers, and red route overlays.' },
    { id: 'activity_2', timestamp: createdAt, kind: 'transition_linked', mapId: chapelId, entityId: 'transition_chapel_atrium', title: 'Chapel and atrium linked', summary: 'Paired the lower chapel entry with the main atrium gate for click-through navigation.' },
    { id: 'activity_3', timestamp: createdAt, kind: 'state_changed', mapId: tunnelsId, entityId: 'note_tunnels_route', title: 'Sun Key route flagged', summary: 'Marked the furnace path as uncertain so it stays in review and revisit queues.' },
  ];

  const project: ProjectRecord = {
    id: 'project_reliquary',
    name: 'Crimson Reliquary Atlas',
    gameTitle: 'Reliquary of Ash (sample project)',
    playthroughNotes: 'This seeded project is tuned for literal floorplan charting. Draw rooms and corridors first, then layer route marks, secrets, loot, and linked doors on top.',
    createdAt,
    updatedAt: createdAt,
    globalTags: ['secret', 'revisit', 'key', 'boss', 'shortcut', 'drainage'],
    iconFavorites: ['door', 'locked-door', 'save-point', 'key-item', 'possible-secret', 'return-later'],
    assetFavorites: ['door.wood.basic', 'chest.wood.small', 'prop.barrel', 'prop.torch.wall'],
    recentIcons: ['save-point', 'possible-secret', 'key-item', 'npc', 'puzzle'],
    uploadedIcons: [],
    settings: { themeAccent: '#9f3038', defaultMapStyle: 'floorplan', defaultIconStyle: 'outlined', defaultMode: 'floorplan', textScale: 'md', iconScale: 'md', spoilerMode: 'mixed' },
    maps: [chapel, atrium, tunnels],
    sessionLog,
    snapshots: [],
  };

  const snapshot: SnapshotRecord = { id: 'snapshot_seed_floorplan', label: 'Seed Floorplan', createdAt, projectId: project.id, payload: structuredClone({ ...project, snapshots: [] }) };
  project.snapshots = [snapshot];
  return project;
})();

export const createWorkspaceFromProject = (project: ProjectRecord): WorkspaceState => ({
  projects: [project],
  activeProjectId: project.id,
  activeMapId: project.maps[0].id,
  openMapIds: [project.maps[0].id, project.maps[1]?.id].filter(Boolean) as string[],
  compareMapId: project.maps.find((map) => map.variantOfMapId)?.id,
  navigationBackstack: [],
  navigationForwardStack: [],
  lastSessionAt: now(),
});

export const createBlankProject = (template: ProjectTemplate = 'blank'): ProjectRecord => {
  const createdAt = now();
  const mapId = 'map_new';
  const layers = createDefaultLayers(mapId);
  const seedRooms = template === 'blank' ? [] : [floorRoom(mapId, { id: 'floor_seed', label: 'Mapped Room', subtitle: 'Begin charting here', bounds: { x: 768, y: 624, width: 288, height: 192 }, roomType: 'safe', state: 'seen', tags: ['seed'] })];
  return {
    id: 'project_new',
    name: 'New Cartography Project',
    gameTitle: '',
    playthroughNotes: '',
    createdAt,
    updatedAt: createdAt,
    globalTags: [],
    iconFavorites: ['door', 'question-mark', 'loot', 'return-later'],
    assetFavorites: ['door.wood.basic', 'chest.wood.small'],
    recentIcons: [],
    uploadedIcons: [],
    settings: { themeAccent: '#9f3038', defaultMapStyle: 'floorplan', defaultIconStyle: 'outlined', defaultMode: 'floorplan', textScale: 'md', iconScale: 'md', spoilerMode: 'mixed' },
    maps: [{
      id: mapId,
      name: template === 'floor_template' ? 'Floor 1' : template === 'image_trace' ? 'Traced Area' : 'Map 1',
      subtitle: template === 'blank' ? 'Untitled region' : 'Ready to chart',
      region: 'Unknown',
      floor: template === 'floor_template' ? '1F' : 'Area',
      accent: '#9f3038',
      style: template === 'node_map' ? 'hybrid' : 'floorplan',
      notes: '',
      completion: 0,
      favorite: true,
      layers,
      rooms: seedRooms.map(legacyRoom),
      paths: [],
      floorRooms: seedRooms,
      corridors: [],
      wallSegments: seedRooms.flatMap((room) => buildRoomWalls(layerId(mapId, 'rooms'), room)),
      doorways: [],
      routeOverlays: [],
      transitions: [],
      anchors: [],
      props: [],
      markers: [],
      notesBoard: [],
      zones: [],
      sketches: [],
      view: createDefaultView(),
    }],
    sessionLog: [{ id: 'activity_seed_new', timestamp: createdAt, kind: 'map_created', mapId, title: 'New project created', summary: `Started a ${template.replace('_', ' ')} floorplan workspace.` }],
    snapshots: [],
  };
};
