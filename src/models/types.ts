export type AppTheme = 'ember';

export type EditorMode =
  | 'floorplan'
  | 'graph'
  | 'ink'
  | 'portal'
  | 'navigate'
  | 'review';

export type ToolType =
  | 'select'
  | 'floorRoom'
  | 'corridor'
  | 'wall'
  | 'doorway'
  | 'prop'
  | 'marker'
  | 'note'
  | 'anchor'
  | 'route'
  | 'sketch'
  | 'erase'
  | 'measure';

export type MapStyle = 'floorplan' | 'graph' | 'hybrid';

export type EntityState =
  | 'unknown'
  | 'seen'
  | 'hidden'
  | 'visited'
  | 'cleared'
  | 'completed'
  | 'suspected'
  | 'inaccessible'
  | 'locked'
  | 'opened'
  | 'collected'
  | 'missed'
  | 'optional'
  | 'urgent_revisit';

export type PathState =
  | 'seen'
  | 'confirmed'
  | 'uncertain'
  | 'blocked'
  | 'locked'
  | 'one_way'
  | 'hidden'
  | 'event_gated'
  | 'item_gated'
  | 'dangerous'
  | 'shortcut'
  | 'temporary';

export type TransitionState =
  | 'unknown'
  | 'confirmed'
  | 'tentative'
  | 'locked'
  | 'hidden'
  | 'disabled'
  | 'broken'
  | 'opened';

export type TransitionType =
  | 'door'
  | 'portcullis'
  | 'stairs_up'
  | 'stairs_down'
  | 'ladder'
  | 'elevator'
  | 'warp'
  | 'hole'
  | 'gate'
  | 'tunnel'
  | 'bridge'
  | 'window_exit'
  | 'trapdoor';

export type MarkerState =
  | 'default'
  | 'locked'
  | 'hidden'
  | 'uncertain'
  | 'completed'
  | 'urgent'
  | 'missable'
  | 'secret';

export type NoteState =
  | 'open'
  | 'found'
  | 'collected'
  | 'resolved'
  | 'blocked'
  | 'missed';

export type RoomShape =
  | 'rectangle'
  | 'pill'
  | 'circle'
  | 'stamp'
  | 'outlined';

export type FloorRoomShape =
  | 'rectangle'
  | 'octagon'
  | 'apsidal'
  | 'circle'
  | 'irregular';

export type FloorRoomType =
  | 'hall'
  | 'chamber'
  | 'boss'
  | 'safe'
  | 'save'
  | 'loot'
  | 'puzzle'
  | 'secret'
  | 'junction'
  | 'stairs';

export type RoomPlacementMode = 'rectangle' | 'stamp' | 'paint';

export type MarkerPlacementPreset = 'hazard' | 'loot' | 'chest' | 'secret' | 'save' | 'npc';

export type DoorwayOrientation = 'north' | 'south' | 'east' | 'west';

export type DoorwayState = 'open' | 'locked' | 'hidden' | 'sealed' | 'suspected';

export type ViewMode = 'plan_2d' | 'second_follow' | 'third_orbit' | 'first_walk';

export type LayerType =
  | 'background'
  | 'terrain'
  | 'rooms'
  | 'paths'
  | 'transitions'
  | 'icons'
  | 'notes'
  | 'labels'
  | 'overlay'
  | 'archive';

export type SearchScope =
  | 'everything'
  | 'maps'
  | 'rooms'
  | 'notes'
  | 'markers'
  | 'transitions'
  | 'floorplan';

export type ReviewCategory =
  | 'unlinked_transitions'
  | 'uncertain_routes'
  | 'revisit_queue'
  | 'orphaned_objects'
  | 'disconnected_nodes'
  | 'map_link_gaps';

export type ProjectTemplate = 'blank' | 'node_map' | 'floor_template' | 'image_trace';

export type PlacementSource =
  | 'toolbar'
  | 'quick_add'
  | 'canvas'
  | 'duplicate'
  | 'sample'
  | 'import'
  | 'tutorial';

export interface Point {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface Bounds extends Point, Size {}

export interface ChecklistItem {
  id: string;
  label: string;
  done: boolean;
}

export interface ActivityEntry {
  id: string;
  timestamp: string;
  kind:
    | 'map_created'
    | 'room_added'
    | 'marker_added'
    | 'note_added'
    | 'transition_linked'
    | 'reviewed'
    | 'snapshot'
    | 'import'
    | 'export'
    | 'state_changed';
  mapId?: string;
  entityId?: string;
  title: string;
  summary: string;
}

export interface SnapshotRecord {
  id: string;
  label: string;
  createdAt: string;
  projectId: string;
  payload: ProjectRecord;
}

export interface LayerRecord {
  id: string;
  name: string;
  type: LayerType;
  visible: boolean;
  locked: boolean;
  opacity: number;
  order: number;
}

export interface EntityBase {
  id: string;
  layerId: string;
  label: string;
  color: string;
  tags: string[];
  state: EntityState;
  noteIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface RoomNode extends EntityBase {
  kind: 'room';
  position: Point;
  size: Size;
  shape: RoomShape;
  subtitle?: string;
  description?: string;
  dangerLevel: 0 | 1 | 2 | 3 | 4 | 5;
  lootCount: number;
  checklist: ChecklistItem[];
  template:
    | 'hallway'
    | 'intersection'
    | 'puzzle_room'
    | 'boss_room'
    | 'safe_room'
    | 'save_room'
    | 'loot_room'
    | 'npc_room'
    | 'hidden_room'
    | 'portal_room';
}

export interface FloorRoom extends EntityBase {
  kind: 'floor_room';
  subtitle?: string;
  bounds: Bounds;
  footprint: Bounds[];
  roomShape: FloorRoomShape;
  roomType: FloorRoomType;
  fillPattern: 'stone' | 'ash' | 'bloodline' | 'ruin';
  dangerLevel: 0 | 1 | 2 | 3 | 4 | 5;
  lootCount: number;
  checklist: ChecklistItem[];
}

export interface PathConnection {
  id: string;
  layerId: string;
  fromRoomId?: string;
  toRoomId?: string;
  points: Point[];
  label?: string;
  color: string;
  width: number;
  arrows: 'none' | 'forward' | 'both';
  dash?: number[];
  state: PathState;
  requirement?: string;
  tags: string[];
  noteIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CorridorSegment {
  id: string;
  layerId: string;
  label?: string;
  points: Point[];
  width: number;
  color: string;
  state: PathState;
  connectedRoomIds: string[];
  requirement?: string;
  tags: string[];
  noteIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface WallSegment {
  id: string;
  layerId: string;
  points: Point[];
  thickness: number;
  color: string;
  state: DoorwayState;
  tags: string[];
  noteIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface RouteOverlay {
  id: string;
  layerId: string;
  label?: string;
  points: Point[];
  width: number;
  color: string;
  opacity: number;
  state: PathState;
  tags: string[];
  noteIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface AnchorRecord {
  id: string;
  layerId: string;
  name: string;
  position: Point;
  color: string;
  mapId: string;
}

export interface DoorwayRecord {
  id: string;
  layerId: string;
  label: string;
  color: string;
  position: Point;
  orientation: DoorwayOrientation;
  doorwayState: DoorwayState;
  transitionType: TransitionType;
  width: number;
  doorStyleId?: string;
  attachedRoomId?: string;
  transitionId?: string;
  tags: string[];
  noteIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface PropRecord extends EntityBase {
  kind: 'prop';
  assetId: string;
  position: Point;
  orientation?: DoorwayOrientation;
  scale: number;
  rotationDeg: number;
}

export interface TransitionRecord extends EntityBase {
  kind: 'transition';
  transitionType: TransitionType;
  markerState: MarkerState;
  position: Point;
  size: Size;
  angle: number;
  certainty: 'confirmed' | 'suspected' | 'unknown';
  transitionState: TransitionState;
  doorwayId?: string;
  destinationMapId?: string;
  destinationAnchorId?: string;
  returnTransitionId?: string;
  oneWay: boolean;
  hidden: boolean;
  disabled: boolean;
  intentionallyUnpaired: boolean;
  requirement?: string;
  pairedLabel?: string;
}

export interface MarkerRecord extends EntityBase {
  kind: 'marker';
  markerType: string;
  markerState: MarkerState;
  iconId: string;
  position: Point;
  size: number;
  opacity: number;
  labelVisible: boolean;
  badges: MarkerState[];
}

export interface NoteRecord {
  id: string;
  layerId: string;
  title: string;
  body: string;
  position: Point;
  color: string;
  tags: string[];
  priority: 'low' | 'normal' | 'high' | 'critical';
  category:
    | 'loot'
    | 'puzzle'
    | 'boss_strategy'
    | 'revisit_later'
    | 'progress_blocker'
    | 'npc'
    | 'route_uncertainty'
    | 'secret_suspicion'
    | 'general';
  state: NoteState;
  spoiler: boolean;
  pinned: boolean;
  collapsed: boolean;
  completed: boolean;
  attachedEntityId?: string;
  attachedEntityKind?:
    | 'room'
    | 'marker'
    | 'transition'
    | 'floor_room'
    | 'doorway'
    | 'corridor'
    | 'route';
  linkedMapIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface RegionZone {
  id: string;
  layerId: string;
  label: string;
  color: string;
  opacity: number;
  bounds: Bounds;
  tags: string[];
}

export interface SketchStroke {
  id: string;
  layerId: string;
  color: string;
  width: number;
  opacity: number;
  points: Point[];
}

export interface BackgroundReference {
  id: string;
  name: string;
  src: string;
  opacity: number;
  locked: boolean;
}

export interface MapViewSettings {
  zoom: number;
  pan: Point;
  hasUserAdjusted: boolean;
  viewMode: ViewMode;
  fogMode3d: 'radius' | 'cone';
  renderStyle2d: 'vector' | 'tile';
  assetPackId: string;
  stylePackId: 'stonekeep' | 'parchment' | 'pixel' | 'ink' | 'battlemap';
  showGrid: boolean;
  snapToGrid: boolean;
  gridSize: number;
  showLegend: boolean;
  dimUnknown: boolean;
  showFogOfKnowledge: boolean;
  showCompleted: boolean;
  showOnlyUnresolved: boolean;
  showOnlyLoot: boolean;
  showOnlyDoors: boolean;
  showOnlyUncertain: boolean;
  showMinimap: boolean;
  showToolHints: boolean;
  showLegacyGraph: boolean;
  showDoorLabels: boolean;
  floorSurfaceStyle: 'stonekeep' | 'parchment_blueprint' | 'pixel_dungeon';
  wallStyle: 'stone' | 'brick' | 'ruin';
  overlayPreset: 'all' | 'exploration' | 'links';
  lightPreset: 'torch' | 'moonlit' | 'neutral';
  orbitTarget?: Point;
  orbitDistance?: number;
  followDistance?: number;
  quality3d?: 'low' | 'medium' | 'high';
}

export interface PlayerState {
  enabled: boolean;
  position: Point;
  headingDeg: number;
  lastVisitedRoomId?: string;
}

export interface MapRecord {
  id: string;
  name: string;
  subtitle?: string;
  region: string;
  floor: string;
  accent: string;
  style: MapStyle;
  notes?: string;
  variantOfMapId?: string;
  completion: number;
  favorite: boolean;
  background?: BackgroundReference;
  layers: LayerRecord[];
  rooms: RoomNode[];
  paths: PathConnection[];
  floorRooms: FloorRoom[];
  corridors: CorridorSegment[];
  wallSegments: WallSegment[];
  doorways: DoorwayRecord[];
  routeOverlays: RouteOverlay[];
  transitions: TransitionRecord[];
  anchors: AnchorRecord[];
  props: PropRecord[];
  markers: MarkerRecord[];
  notesBoard: NoteRecord[];
  zones: RegionZone[];
  sketches: SketchStroke[];
  view: MapViewSettings;
  player?: PlayerState;
  tileGrid?: import('./tilemap').TileGrid;
}

export interface UploadedIconAsset {
  id: string;
  label: string;
  src: string;
  keywords: string[];
  category: string;
}

export interface ProjectSettings {
  themeAccent: string;
  defaultMapStyle: MapStyle;
  defaultIconStyle: 'outlined' | 'filled' | 'duotone';
  defaultMode: EditorMode;
  textScale: 'sm' | 'md' | 'lg';
  iconScale: 'sm' | 'md' | 'lg';
  spoilerMode: 'conceal' | 'reveal' | 'mixed';
}

export interface ProjectRecord {
  id: string;
  name: string;
  gameTitle?: string;
  coverImage?: string;
  playthroughNotes?: string;
  createdAt: string;
  updatedAt: string;
  globalTags: string[];
  iconFavorites: string[];
  assetFavorites: string[];
  recentIcons: string[];
  uploadedIcons: UploadedIconAsset[];
  settings: ProjectSettings;
  maps: MapRecord[];
  sessionLog: ActivityEntry[];
  snapshots: SnapshotRecord[];
}

export interface SearchResult {
  id: string;
  mapId?: string;
  mapName?: string;
  kind:
    | 'map'
    | 'room'
    | 'marker'
    | 'note'
    | 'transition'
    | 'floor_room'
    | 'doorway';
  title: string;
  subtitle?: string;
  tags: string[];
}

export interface RoutePlanStep {
  mapId: string;
  mapName: string;
  transitionId?: string;
  anchorId?: string;
  label: string;
}

export interface RoutePlan {
  summary: string;
  steps: RoutePlanStep[];
}

export interface ReviewItem {
  id: string;
  mapId: string;
  mapName: string;
  category: ReviewCategory;
  title: string;
  subtitle?: string;
  severity: 'low' | 'medium' | 'high';
  entityId?: string;
}

export interface FilterState {
  states: EntityState[];
  markerTypes: string[];
  transitionStates: TransitionState[];
  tags: string[];
  iconCategories: string[];
}

export interface NavigationEntry {
  mapId: string;
  anchorId?: string;
  highlightedTransitionId?: string;
  timestamp: string;
}

export interface WorkspaceState {
  projects: ProjectRecord[];
  activeProjectId: string;
  activeMapId: string;
  openMapIds: string[];
  compareMapId?: string;
  navigationBackstack: NavigationEntry[];
  navigationForwardStack: NavigationEntry[];
  lastSessionAt: string;
}

export interface SelectionState {
  kind:
    | 'none'
    | 'room'
    | 'floor_room'
    | 'corridor'
    | 'wall'
    | 'doorway'
    | 'prop'
    | 'marker'
    | 'transition'
    | 'note'
    | 'anchor'
    | 'path'
    | 'zone'
    | 'route';
  ids: string[];
}

export interface SearchState {
  query: string;
  scope: SearchScope;
}

export interface OnboardingState {
  show: boolean;
  step: number;
  completed: boolean;
  dismissed: boolean;
}

export interface CanvasCursorHint {
  label: string;
  detail?: string;
}

export interface ToolSettings {
  roomPlacement: RoomPlacementMode;
  roomType: FloorRoomType;
  roomPaintBrush: 1 | 2 | 3 | 4 | 5;
  roomPaintMode: 'add' | 'subtract';
  roomStampSize: 6 | 8 | 10;
  roomStampShape: 'rectangle' | 'l_shape' | 't_shape' | 'cross';
  roomStampRotation: 0 | 90 | 180 | 270;
  corridorWidth: number;
  transitionType: TransitionType;
  doorStyleId?: string;
  propAssetId: string;
  markerPreset: MarkerPlacementPreset;
  sketchWidth: number;
  eraseMode: 'entity' | 'segment';
}

export interface PanelLayoutState {
  leftSidebar: number;
  rightSidebar: number;
  bottomPanel: number;
}

export interface UiState {
  theme: AppTheme;
  editorMode: EditorMode;
  activeTool: ToolType;
  focusMode: boolean;
  toolSettings: ToolSettings;
  search: SearchState;
  filters: FilterState;
  selection: SelectionState;
  hoveredEntityId?: string;
  linkingTransitionId?: string;
  commandPaletteOpen: boolean;
  iconPickerOpen: boolean;
  onboarding: OnboardingState;
  showLeftSidebar: boolean;
  showRightSidebar: boolean;
  showBottomPanel: boolean;
  bottomPanelTab:
    | 'review'
    | 'revisit'
    | 'legend'
    | 'history'
    | 'stats'
    | 'route_planner'
    | 'session'
    | 'search';
  routePlannerStart?: string;
  routePlannerEnd?: string;
  focusAnchorId?: string;
  highlightedTransitionId?: string;
  canvasHint?: CanvasCursorHint;
  canvasCursorWorld?: Point;
  canvasCursorSnapped?: Point;
  footprintEditRoomId?: string;
  inspectorTab: 'selection' | 'assets' | 'map' | 'layers' | 'links' | 'notes' | 'help';
  panelLayout: PanelLayoutState;
  saveState: 'idle' | 'saving' | 'saved' | 'error';
}

export interface PersistedUiState {
  editorMode: EditorMode;
  activeTool: ToolType;
  toolSettings: ToolSettings;
  showLeftSidebar: boolean;
  showRightSidebar: boolean;
  showBottomPanel: boolean;
  bottomPanelTab: UiState['bottomPanelTab'];
  inspectorTab: UiState['inspectorTab'];
  panelLayout: PanelLayoutState;
}

export interface StoredWorkspace {
  workspace: WorkspaceState;
  theme: AppTheme;
  onboarding: OnboardingState;
  ui?: PersistedUiState;
}
