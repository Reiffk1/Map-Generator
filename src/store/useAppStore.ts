import { create } from 'zustand';

import { createBlankProject, createDefaultLayers, createDefaultView, createWorkspaceFromProject, sampleProject } from '../data/sampleProject';
import { defaultToolSettings, describeRoomPlacement, getMarkerPresetDefinition, getRoomTypeDefinition, getTransitionDefinition } from '../lib/editorPresets';
import { attachCorridorToFloorplan, buildRoomWalls, rebuildGeneratedWalls } from '../lib/floorplan';
import { loadStoredWorkspace, saveStoredWorkspace } from '../lib/persistence';
import { tutorialSteps, type TutorialTrigger } from '../lib/tutorial';
import { deepClone, makeId } from '../lib/utils';
import type {
  AnchorRecord,
  Bounds,
  CorridorSegment,
  DoorwayOrientation,
  DoorwayRecord,
  EditorMode,
  EntityState,
  FloorRoom,
  LayerRecord,
  MapRecord,
  MarkerRecord,
  NoteRecord,
  PathConnection,
  Point,
  ProjectRecord,
  ProjectTemplate,
  RouteOverlay,
  SelectionState,
  StoredWorkspace,
  ToolSettings,
  ToolType,
  TransitionRecord,
  UiState,
  WallSegment,
  WorkspaceState,
} from '../models/types';

const HISTORY_LIMIT = 40;
const DEFAULT_WORKSPACE = createWorkspaceFromProject(sampleProject);
const now = () => new Date().toISOString();

const entityStateCycle: EntityState[] = [
  'unknown',
  'seen',
  'visited',
  'cleared',
  'completed',
  'suspected',
  'inaccessible',
  'locked',
  'opened',
  'collected',
  'missed',
  'optional',
  'urgent_revisit',
];

const initialUiState: UiState = {
  theme: 'ember',
  editorMode: 'floorplan',
  activeTool: 'select',
  toolSettings: defaultToolSettings,
  search: { query: '', scope: 'everything' },
  filters: {
    states: [],
    markerTypes: [],
    transitionStates: [],
    tags: [],
    iconCategories: [],
  },
  selection: { kind: 'none', ids: [] },
  commandPaletteOpen: false,
  iconPickerOpen: false,
  onboarding: { show: true, step: 0, completed: false, dismissed: false },
  showLeftSidebar: true,
  showRightSidebar: true,
  showBottomPanel: false,
  bottomPanelTab: 'review',
  routePlannerStart: undefined,
  routePlannerEnd: undefined,
  focusAnchorId: undefined,
  highlightedTransitionId: undefined,
  canvasHint: undefined,
  inspectorTab: 'selection',
  saveState: 'idle',
};

const shouldSuppressOnboarding = () => {
  if (typeof window === 'undefined') return false;
  const params = new URLSearchParams(window.location.search);
  const tutorialParam = params.get('tutorial');
  if (tutorialParam === 'on') return false;
  if (tutorialParam === 'off') return true;
  return false;
};

const tutorialTriggerOrder = tutorialSteps.map((step) => step.expectedTrigger);

const getActiveProject = (workspace: WorkspaceState) =>
  workspace.projects.find((project) => project.id === workspace.activeProjectId) ?? workspace.projects[0]!;

const getActiveMap = (workspace: WorkspaceState) => {
  const project = getActiveProject(workspace);
  return project.maps.find((map) => map.id === workspace.activeMapId) ?? project.maps[0]!;
};

const getLayerId = (map: MapRecord, type: LayerRecord['type']) =>
  map.layers.find((layer) => layer.type === type)?.id ?? map.layers[0]?.id ?? '';

const toLegacyRoom = (room: FloorRoom): MapRecord['rooms'][number] => ({
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

const toLegacyPath = (corridor: CorridorSegment): PathConnection => ({
  id: `${corridor.id}_legacy`,
  layerId: corridor.layerId,
  points: corridor.points,
  color: corridor.color,
  width: Math.max(3, Math.round(corridor.width / 10)),
  arrows: corridor.state === 'one_way' ? 'forward' : 'none',
  state: corridor.state,
  label: corridor.label,
  requirement: corridor.requirement,
  tags: [...corridor.tags],
  noteIds: [...corridor.noteIds],
  createdAt: corridor.createdAt,
  updatedAt: corridor.updatedAt,
});

const orientationFromAngle = (angle = 0): DoorwayOrientation => {
  const normalized = ((angle % 360) + 360) % 360;
  if (normalized >= 45 && normalized < 135) return 'south';
  if (normalized >= 135 && normalized < 225) return 'west';
  if (normalized >= 225 && normalized < 315) return 'north';
  return 'east';
};

const transitionToDoorway = (map: MapRecord, transition: TransitionRecord): DoorwayRecord => ({
  id: transition.doorwayId ?? makeId('doorway'),
  layerId: getLayerId(map, 'transitions'),
  label: transition.label,
  color: transition.color,
  position: transition.position,
  orientation: orientationFromAngle(transition.angle),
  doorwayState:
    transition.transitionState === 'locked'
      ? 'locked'
      : transition.transitionState === 'hidden'
        ? 'hidden'
        : transition.certainty !== 'confirmed'
          ? 'suspected'
          : 'open',
  transitionType: transition.transitionType,
  width: Math.max(28, transition.size.width),
  transitionId: transition.id,
  tags: [...transition.tags],
  noteIds: [...transition.noteIds],
  createdAt: transition.createdAt,
  updatedAt: transition.updatedAt,
});

const bumpOnboarding = (state: AppStore, trigger: TutorialTrigger): Partial<AppStore> | null => {
  if (state.onboarding.completed || state.onboarding.dismissed) return null;

  const expectedTrigger = tutorialTriggerOrder[state.onboarding.step];
  if (!expectedTrigger || expectedTrigger !== trigger) return null;

  const nextStep = state.onboarding.step + 1;
  const completed = nextStep >= tutorialSteps.length;

  return {
    onboarding: {
      show: !completed,
      step: completed ? tutorialSteps.length - 1 : nextStep,
      completed,
      dismissed: completed,
    },
  };
};

const roomFromLegacy = (map: MapRecord, room: MapRecord['rooms'][number]): FloorRoom => ({
  kind: 'floor_room',
  id: room.id.replace(/_legacy$/, ''),
  layerId: getLayerId(map, 'rooms'),
  label: room.label,
  subtitle: room.subtitle,
  color: '#efe5d4',
  tags: [...room.tags],
  state: room.state,
  noteIds: [...room.noteIds],
  createdAt: room.createdAt,
  updatedAt: room.updatedAt,
  bounds: { x: room.position.x, y: room.position.y, width: room.size.width, height: room.size.height },
  roomShape: room.shape === 'circle' ? 'circle' : 'rectangle',
  roomType: room.template === 'loot_room' ? 'loot' : room.template === 'safe_room' ? 'safe' : room.template === 'puzzle_room' ? 'puzzle' : room.template === 'hidden_room' ? 'secret' : 'hall',
  fillPattern: 'ash',
  dangerLevel: room.dangerLevel,
  lootCount: room.lootCount,
  checklist: [...room.checklist],
});

const corridorFromLegacy = (map: MapRecord, path: PathConnection): CorridorSegment => ({
  id: path.id.replace(/_legacy$/, ''),
  layerId: getLayerId(map, 'paths'),
  label: path.label,
  points: path.points,
  width: Math.max(56, path.width * 16),
  color: '#efe5d4',
  state: path.state,
  connectedRoomIds: [path.fromRoomId, path.toRoomId].filter(Boolean) as string[],
  requirement: path.requirement,
  tags: [...path.tags],
  noteIds: [...path.noteIds],
  createdAt: path.createdAt,
  updatedAt: path.updatedAt,
});

const syncMap = (map: MapRecord) => {
  map.corridors = map.corridors.map((corridor) => {
    const attached = attachCorridorToFloorplan(map, corridor.points);
    return {
      ...corridor,
      points: attached.points,
      connectedRoomIds: attached.connectedRoomIds.length ? attached.connectedRoomIds : corridor.connectedRoomIds,
    };
  });
  map.rooms = map.floorRooms.map(toLegacyRoom);
  map.paths = map.corridors.map(toLegacyPath);
  map.wallSegments = rebuildGeneratedWalls(map.floorRooms, map.wallSegments, getLayerId(map, 'rooms'));
  for (const entry of map.transitions) {
    if (!entry.doorwayId) {
      const door = transitionToDoorway(map, entry);
      map.doorways.push(door);
      entry.doorwayId = door.id;
    }
  }
  map.doorways = map.doorways.map((doorway) => {
    const transition = doorway.transitionId ? map.transitions.find((entry) => entry.id === doorway.transitionId) : undefined;
    return transition
      ? {
          ...doorway,
          label: transition.label,
          color: transition.color,
          position: transition.position,
          transitionType: transition.transitionType,
          updatedAt: transition.updatedAt,
        }
      : doorway;
  });
  map.doorways = map.doorways.filter(
    (doorway, index, values) => values.findIndex((candidate) => candidate.id === doorway.id) === index,
  );
};

const normalizeMap = (source: MapRecord): MapRecord => {
  const map = deepClone(source);
  map.layers = map.layers?.length ? map.layers : createDefaultLayers(map.id);
  map.view = { ...createDefaultView(), ...map.view };
  map.style = map.style === 'graph' || map.style === 'hybrid' || map.style === 'floorplan' ? map.style : 'floorplan';
  map.floorRooms = map.floorRooms?.length ? map.floorRooms : (map.rooms ?? []).map((room) => roomFromLegacy(map, room));
  map.corridors = map.corridors?.length ? map.corridors : (map.paths ?? []).map((path) => corridorFromLegacy(map, path));
  map.wallSegments = map.wallSegments ?? [];
  map.doorways = map.doorways ?? [];
  map.routeOverlays = map.routeOverlays ?? [];
  map.transitions = map.transitions ?? [];
  map.anchors = map.anchors ?? [];
  map.markers = map.markers ?? [];
  map.notesBoard = map.notesBoard ?? [];
  map.zones = map.zones ?? [];
  map.sketches = map.sketches ?? [];
  syncMap(map);
  return map;
};

const normalizeWorkspace = (workspace: WorkspaceState) => {
  const next = deepClone(workspace);
  if (!next.projects?.length) return createWorkspaceFromProject(sampleProject);
  next.projects = next.projects.map((project) => ({
    ...project,
    settings: {
      ...project.settings,
      defaultMapStyle:
        project.settings?.defaultMapStyle === 'graph' ||
        project.settings?.defaultMapStyle === 'hybrid' ||
        project.settings?.defaultMapStyle === 'floorplan'
          ? project.settings.defaultMapStyle
          : 'floorplan',
      defaultMode:
        project.settings?.defaultMode === 'floorplan' ||
        project.settings?.defaultMode === 'graph' ||
        project.settings?.defaultMode === 'ink' ||
        project.settings?.defaultMode === 'portal' ||
        project.settings?.defaultMode === 'navigate' ||
        project.settings?.defaultMode === 'review'
          ? project.settings.defaultMode
          : 'floorplan',
    },
    maps: project.maps.map(normalizeMap),
  }));
  if (!next.projects.find((project) => project.id === next.activeProjectId)) {
    next.activeProjectId = next.projects[0].id;
  }
  const activeProject = getActiveProject(next);
  if (!activeProject.maps.find((map) => map.id === next.activeMapId)) {
    next.activeMapId = activeProject.maps[0].id;
  }
  next.openMapIds = next.openMapIds.filter((mapId) => activeProject.maps.some((map) => map.id === mapId));
  if (!next.openMapIds.includes(next.activeMapId)) next.openMapIds.unshift(next.activeMapId);
  return next;
};

const cloneMap = (source: MapRecord): MapRecord => {
  const cloned = deepClone(source);
  cloned.id = makeId('map');
  cloned.name = `${source.name} Copy`;
  cloned.favorite = false;
  cloned.layers = createDefaultLayers(cloned.id);
  return normalizeMap(cloned);
};

interface OpenMapOptions {
  anchorId?: string;
  highlightedTransitionId?: string;
  pushHistory?: boolean;
}

interface AppStore extends UiState {
  workspace: WorkspaceState;
  loaded: boolean;
  historyPast: WorkspaceState[];
  historyFuture: WorkspaceState[];
  boot: () => Promise<void>;
  persistNow: () => Promise<void>;
  undo: () => void;
  redo: () => void;
  setEditorMode: (mode: EditorMode) => void;
  setActiveTool: (tool: ToolType) => void;
  setToolSettings: (patch: Partial<ToolSettings>) => void;
  setCommandPaletteOpen: (open: boolean) => void;
  setIconPickerOpen: (open: boolean) => void;
  setInspectorTab: (tab: UiState['inspectorTab']) => void;
  toggleSidebar: (side: 'left' | 'right' | 'bottom') => void;
  setBottomPanelTab: (tab: UiState['bottomPanelTab']) => void;
  setSearchQuery: (query: string) => void;
  setSelection: (selection: SelectionState, additive?: boolean) => void;
  clearSelection: () => void;
  setRoutePlannerPoint: (kind: 'start' | 'end', mapId?: string) => void;
  openMap: (mapId: string, options?: OpenMapOptions) => void;
  closeMap: (mapId: string) => void;
  navigateBack: () => void;
  navigateForward: () => void;
  updateProjectMeta: (patch: Partial<ProjectRecord>) => void;
  updateActiveMapMeta: (patch: Partial<MapRecord>) => void;
  updateMapView: (patch: Partial<MapRecord['view']>) => void;
  createProject: (template?: ProjectTemplate) => void;
  importProject: (project: ProjectRecord) => void;
  createMap: () => void;
  cloneActiveMap: () => void;
  toggleMapFavorite: (mapId: string) => void;
  markActiveMapReviewed: () => void;
  createSnapshot: (label?: string) => void;
  restoreSnapshot: (snapshotId: string) => void;
  addFloorRoom: (bounds: Bounds) => void;
  addCorridor: (points: Point[]) => void;
  addWall: (points: Point[]) => void;
  addDoorwayAt: (position: Point, orientation?: DoorwayOrientation) => void;
  addMarkerAt: (position: Point, iconId?: string) => void;
  addNoteAt: (position: Point) => void;
  addAnchorAt: (position: Point) => void;
  addRouteOverlay: (points: Point[]) => void;
  addSketchStroke: (points: Point[]) => void;
  updateEntity: (kind: SelectionState['kind'], id: string, patch: Record<string, unknown>) => void;
  moveEntity: (kind: SelectionState['kind'], id: string, position: Point) => void;
  deleteEntity: (kind: Exclude<SelectionState['kind'], 'none'>, id: string) => void;
  duplicateSelection: () => void;
  deleteSelection: () => void;
  pairTransitions: (sourceTransitionId: string, destinationTransitionId: string) => void;
  seedTutorialLinkTarget: () => void;
  cycleSelectionState: () => void;
  toggleLayer: (layerId: string, key: 'visible' | 'locked', value?: boolean) => void;
  restartOnboarding: () => void;
  nextOnboardingStep: () => void;
  dismissOnboarding: (completed?: boolean) => void;
}

type StoreSetter = (partial: Partial<AppStore> | ((state: AppStore) => Partial<AppStore>)) => void;

const applyWorkspaceChange = (
  set: StoreSetter,
  get: () => AppStore,
  mutator: (workspace: WorkspaceState, project: ProjectRecord, map: MapRecord) => void,
) => {
  const previous = get().workspace;
  const next = normalizeWorkspace(deepClone(previous));
  const project = getActiveProject(next);
  const map = getActiveMap(next);
  mutator(next, project, map);
  project.updatedAt = now();
  next.lastSessionAt = now();
  project.maps = project.maps.map(normalizeMap);
  set((state) => ({
    workspace: normalizeWorkspace(next),
    historyPast: [...state.historyPast.slice(-(HISTORY_LIMIT - 1)), previous],
    historyFuture: [],
    saveState: 'idle',
  }));
};

const applyWorkspaceViewChange = (
  set: StoreSetter,
  get: () => AppStore,
  mutator: (workspace: WorkspaceState, project: ProjectRecord, map: MapRecord) => void,
) => {
  const next = normalizeWorkspace(deepClone(get().workspace));
  const project = getActiveProject(next);
  const map = getActiveMap(next);
  mutator(next, project, map);
  set({ workspace: next, saveState: 'idle' });
};

export const useAppStore = create<AppStore>((set, get) => ({
  ...initialUiState,
  workspace: DEFAULT_WORKSPACE,
  loaded: false,
  historyPast: [],
  historyFuture: [],
  boot: async () => {
    const suppressOnboarding = shouldSuppressOnboarding();
    const stored = await loadStoredWorkspace();
    if (stored) {
      set({
        workspace: normalizeWorkspace(stored.workspace),
        theme: 'ember',
        onboarding: suppressOnboarding
          ? {
              ...(stored.onboarding ?? { step: 0, completed: false, dismissed: false }),
              show: false,
            }
          : stored.onboarding ?? { show: false, step: 0, completed: true, dismissed: true },
        loaded: true,
      });
      return;
    }
    set({
      workspace: normalizeWorkspace(DEFAULT_WORKSPACE),
      loaded: true,
      onboarding: suppressOnboarding
        ? { show: false, step: 0, completed: false, dismissed: false }
        : { show: true, step: 0, completed: false, dismissed: false },
    });
  },
  persistNow: async () => {
    const store = get();
    const payload: StoredWorkspace = {
      workspace: store.workspace,
      theme: 'ember',
      onboarding: store.onboarding,
    };
    set({ saveState: 'saving' });
    try {
      await saveStoredWorkspace(payload);
      set({ saveState: 'saved' });
      window.setTimeout(() => {
        if (get().saveState === 'saved') set({ saveState: 'idle' });
      }, 1200);
    } catch (error) {
      console.error(error);
      set({ saveState: 'error' });
    }
  },
  undo: () => {
    const { historyPast, historyFuture, workspace } = get();
    const previous = historyPast[historyPast.length - 1];
    if (!previous) return;
    set({
      workspace: previous,
      historyPast: historyPast.slice(0, -1),
      historyFuture: [workspace, ...historyFuture].slice(0, HISTORY_LIMIT),
      saveState: 'idle',
    });
  },
  redo: () => {
    const { historyPast, historyFuture, workspace } = get();
    const next = historyFuture[0];
    if (!next) return;
    set({
      workspace: next,
      historyPast: [...historyPast.slice(-(HISTORY_LIMIT - 1)), workspace],
      historyFuture: historyFuture.slice(1),
      saveState: 'idle',
    });
  },
  setEditorMode: (mode) =>
    set((state) => ({
      editorMode: mode,
      ...(mode === 'navigate' ? bumpOnboarding(state, 'navigate-mode') ?? {} : {}),
    })),
  setActiveTool: (tool) => set({ activeTool: tool }),
  setToolSettings: (patch) => set((state) => ({ toolSettings: { ...state.toolSettings, ...patch } })),
  setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),
  setIconPickerOpen: (open) => set({ iconPickerOpen: open }),
  setInspectorTab: (tab) => set({ inspectorTab: tab }),
  toggleSidebar: (side) =>
    set((state) => ({
      showLeftSidebar: side === 'left' ? !state.showLeftSidebar : state.showLeftSidebar,
      showRightSidebar: side === 'right' ? !state.showRightSidebar : state.showRightSidebar,
      showBottomPanel: side === 'bottom' ? !state.showBottomPanel : state.showBottomPanel,
    })),
  setBottomPanelTab: (tab) =>
    set((state) => ({
      bottomPanelTab: tab,
      ...((tab === 'review' || tab === 'revisit') ? bumpOnboarding(state, 'review-opened') ?? {} : {}),
    })),
  setSearchQuery: (query) =>
    set((state) => ({
      search: { ...state.search, query },
      bottomPanelTab: query ? 'search' : state.bottomPanelTab,
      showBottomPanel: query ? true : state.showBottomPanel,
    })),
  setSelection: (selection, additive = false) =>
    set((state) => {
      if (!additive || selection.kind === 'none' || selection.kind !== state.selection.kind) {
        return { selection, inspectorTab: selection.kind === 'none' ? state.inspectorTab : 'selection' };
      }
      return {
        selection: {
          kind: selection.kind,
          ids: [...new Set([...state.selection.ids, ...selection.ids])],
        },
        inspectorTab: 'selection',
      };
    }),
  clearSelection: () => set({ selection: { kind: 'none', ids: [] } }),
  setRoutePlannerPoint: (kind, mapId) =>
    set({
      routePlannerStart: kind === 'start' ? mapId : get().routePlannerStart,
      routePlannerEnd: kind === 'end' ? mapId : get().routePlannerEnd,
      bottomPanelTab: 'route_planner',
    }),
  openMap: (mapId, options) => {
    const { workspace, focusAnchorId, highlightedTransitionId, editorMode } = get();
    const activeMapId = workspace.activeMapId;
    applyWorkspaceChange(set, get, (nextWorkspace) => {
      if (options?.pushHistory !== false && activeMapId !== mapId) {
        nextWorkspace.navigationBackstack.push({
          mapId: activeMapId,
          timestamp: now(),
          anchorId: focusAnchorId,
          highlightedTransitionId,
        });
        nextWorkspace.navigationForwardStack = [];
      }
      nextWorkspace.activeMapId = mapId;
      if (!nextWorkspace.openMapIds.includes(mapId)) nextWorkspace.openMapIds.unshift(mapId);
    });
    set({
      focusAnchorId: options?.anchorId,
      highlightedTransitionId: options?.highlightedTransitionId,
      selection: { kind: 'none', ids: [] },
    });
    if (editorMode === 'navigate' && activeMapId !== mapId) {
      set((state) => bumpOnboarding(state, 'map-travelled') ?? {});
    }
  },
  closeMap: (mapId) =>
    applyWorkspaceViewChange(set, get, (workspace, project) => {
      if (workspace.openMapIds.length <= 1) return;
      workspace.openMapIds = workspace.openMapIds.filter((entry) => entry !== mapId);
      if (workspace.activeMapId === mapId) {
        workspace.activeMapId = workspace.openMapIds[0] ?? project.maps[0]?.id ?? workspace.activeMapId;
      }
    }),
  navigateBack: () => {
    const { workspace, focusAnchorId, highlightedTransitionId } = get();
    const previous = workspace.navigationBackstack[workspace.navigationBackstack.length - 1];
    if (!previous) return;
    applyWorkspaceChange(set, get, (nextWorkspace) => {
      nextWorkspace.navigationBackstack.pop();
      nextWorkspace.navigationForwardStack.unshift({
        mapId: nextWorkspace.activeMapId,
        anchorId: focusAnchorId,
        highlightedTransitionId,
        timestamp: now(),
      });
      nextWorkspace.activeMapId = previous.mapId;
      if (!nextWorkspace.openMapIds.includes(previous.mapId)) nextWorkspace.openMapIds.unshift(previous.mapId);
    });
    set({ focusAnchorId: previous.anchorId, highlightedTransitionId: previous.highlightedTransitionId });
  },
  navigateForward: () => {
    const { workspace, focusAnchorId, highlightedTransitionId } = get();
    const nextEntry = workspace.navigationForwardStack[0];
    if (!nextEntry) return;
    applyWorkspaceChange(set, get, (nextWorkspace) => {
      nextWorkspace.navigationForwardStack.shift();
      nextWorkspace.navigationBackstack.push({
        mapId: nextWorkspace.activeMapId,
        anchorId: focusAnchorId,
        highlightedTransitionId,
        timestamp: now(),
      });
      nextWorkspace.activeMapId = nextEntry.mapId;
      if (!nextWorkspace.openMapIds.includes(nextEntry.mapId)) nextWorkspace.openMapIds.unshift(nextEntry.mapId);
    });
    set({ focusAnchorId: nextEntry.anchorId, highlightedTransitionId: nextEntry.highlightedTransitionId });
  },
  updateProjectMeta: (patch) => applyWorkspaceChange(set, get, (_workspace, project) => Object.assign(project, patch, { updatedAt: now() })),
  updateActiveMapMeta: (patch) => applyWorkspaceChange(set, get, (_workspace, _project, map) => Object.assign(map, patch)),
  updateMapView: (patch) => applyWorkspaceViewChange(set, get, (_workspace, _project, map) => {
    map.view = { ...map.view, ...patch };
  }),
  createProject: (template = 'blank') =>
    applyWorkspaceChange(set, get, (workspace) => {
      const project = createBlankProject(template);
      project.id = makeId('project');
      workspace.projects.unshift(project);
      workspace.activeProjectId = project.id;
      workspace.activeMapId = project.maps[0].id;
      workspace.openMapIds = [project.maps[0].id];
      workspace.navigationBackstack = [];
      workspace.navigationForwardStack = [];
    }),
  importProject: (project) =>
    applyWorkspaceChange(set, get, (workspace) => {
      const cloned = normalizeWorkspace(createWorkspaceFromProject(deepClone(project))).projects[0];
      cloned.id = makeId('project');
      workspace.projects.unshift(cloned);
      workspace.activeProjectId = cloned.id;
      workspace.activeMapId = cloned.maps[0].id;
      workspace.openMapIds = [cloned.maps[0].id];
      workspace.navigationBackstack = [];
      workspace.navigationForwardStack = [];
    }),
  createMap: () => {
    applyWorkspaceChange(set, get, (workspace, project) => {
      const mapId = makeId('map');
      const map: MapRecord = normalizeMap({
        id: mapId,
        name: `Map ${project.maps.length + 1}`,
        subtitle: 'Untitled region',
        region: project.gameTitle || 'Unknown',
        floor: 'Area',
        accent: '#9f3038',
        style: 'floorplan',
        notes: '',
        completion: 0,
        favorite: false,
        background: undefined,
        layers: createDefaultLayers(mapId),
        rooms: [],
        paths: [],
        floorRooms: [],
        corridors: [],
        wallSegments: [],
        doorways: [],
        routeOverlays: [],
        transitions: [],
        anchors: [],
        markers: [],
        notesBoard: [],
        zones: [],
        sketches: [],
        view: createDefaultView(),
      });
      project.maps.unshift(map);
      workspace.activeMapId = map.id;
      workspace.openMapIds.unshift(map.id);
    });
    set((state) => bumpOnboarding(state, 'map-created') ?? {});
  },
  cloneActiveMap: () =>
    applyWorkspaceChange(set, get, (workspace, project, map) => {
      const cloned = cloneMap(map);
      project.maps.splice(project.maps.indexOf(map) + 1, 0, cloned);
      workspace.activeMapId = cloned.id;
      workspace.openMapIds.unshift(cloned.id);
    }),
  toggleMapFavorite: (mapId) =>
    applyWorkspaceChange(set, get, (_workspace, project) => {
      const map = project.maps.find((entry) => entry.id === mapId);
      if (map) map.favorite = !map.favorite;
    }),
  markActiveMapReviewed: () =>
    applyWorkspaceChange(set, get, (_workspace, project, map) => {
      map.notesBoard = map.notesBoard.map((entry) => ({
        ...entry,
        state: entry.completed ? 'resolved' : entry.state,
      }));
      project.sessionLog.unshift({
        id: makeId('activity'),
        timestamp: now(),
        kind: 'reviewed',
        mapId: map.id,
        title: `Reviewed ${map.name}`,
        summary: 'Marked current map items as reviewed for this play session.',
      });
    }),
  createSnapshot: (label = 'Snapshot') =>
    applyWorkspaceChange(set, get, (_workspace, project) => {
      project.snapshots.unshift({
        id: makeId('snapshot'),
        label,
        createdAt: now(),
        projectId: project.id,
        payload: deepClone({ ...project, snapshots: [] }),
      });
    }),
  restoreSnapshot: (snapshotId) =>
    applyWorkspaceChange(set, get, (workspace, project) => {
      const snapshot = project.snapshots.find((entry) => entry.id === snapshotId);
      if (!snapshot) return;
      const restored = deepClone(snapshot.payload);
      restored.snapshots = project.snapshots;
      const index = workspace.projects.findIndex((entry) => entry.id === project.id);
      workspace.projects[index] = normalizeWorkspace(createWorkspaceFromProject(restored)).projects[0];
      workspace.activeProjectId = restored.id;
      workspace.activeMapId = restored.maps[0]?.id ?? workspace.activeMapId;
      workspace.openMapIds = [workspace.activeMapId];
    }),
  addFloorRoom: (bounds) => {
    const { roomPlacement, roomType } = get().toolSettings;
    const roomDefinition = getRoomTypeDefinition(roomType);
    applyWorkspaceChange(set, get, (_workspace, _project, map) => {
      const room: FloorRoom = {
        kind: 'floor_room',
        id: makeId('floor_room'),
        layerId: getLayerId(map, 'rooms'),
        label: `${roomDefinition.label} ${map.floorRooms.length + 1}`,
        subtitle: describeRoomPlacement(roomPlacement),
        color: roomDefinition.color,
        tags: [],
        state: 'seen',
        noteIds: [],
        createdAt: now(),
        updatedAt: now(),
        bounds,
        roomShape: roomPlacement === 'stamp' ? 'octagon' : 'rectangle',
        roomType,
        fillPattern: roomType === 'boss' ? 'bloodline' : roomType === 'secret' ? 'ruin' : 'ash',
        dangerLevel: roomType === 'boss' ? 4 : roomType === 'secret' ? 2 : 1,
        lootCount: roomType === 'loot' ? 1 : 0,
        checklist: [],
      };
      map.floorRooms.push(room);
      syncMap(map);
      set({ selection: { kind: 'floor_room', ids: [room.id] } });
    });
    set((state) => bumpOnboarding(state, 'room-drawn') ?? {});
  },
  addCorridor: (points) => {
    const { corridorWidth } = get().toolSettings;
    applyWorkspaceChange(set, get, (_workspace, _project, map) => {
      const attached = attachCorridorToFloorplan(map, points);
      const entry: CorridorSegment = {
        id: makeId('corridor'),
        layerId: getLayerId(map, 'paths'),
        label: corridorWidth >= 96 ? 'Grand Hallway' : corridorWidth <= 56 ? 'Tight Passage' : 'Hallway',
        points: attached.points,
        width: corridorWidth,
        color: '#efe5d4',
        state: 'confirmed',
        connectedRoomIds: attached.connectedRoomIds,
        tags: [],
        noteIds: [],
        createdAt: now(),
        updatedAt: now(),
      };
      map.corridors.push(entry);
      syncMap(map);
      set({ selection: { kind: 'corridor', ids: [entry.id] } });
    });
    set((state) => bumpOnboarding(state, 'corridor-drawn') ?? {});
  },
  addWall: (points) =>
    applyWorkspaceChange(set, get, (_workspace, _project, map) => {
      const wall: WallSegment = {
        id: makeId('wall'),
        layerId: getLayerId(map, 'rooms'),
        points,
        thickness: 18,
        color: '#1e1213',
        state: 'open',
        tags: [],
        noteIds: [],
        createdAt: now(),
        updatedAt: now(),
      };
      map.wallSegments.push(wall);
      set({ selection: { kind: 'wall', ids: [wall.id] } });
    }),
  addDoorwayAt: (position, orientation = 'south') => {
    const transitionPreset = getTransitionDefinition(get().toolSettings.transitionType);
    applyWorkspaceChange(set, get, (_workspace, _project, map) => {
      const doorwayId = makeId('doorway');
      const transitionId = makeId('transition');
      map.doorways.push({
        id: doorwayId,
        layerId: getLayerId(map, 'transitions'),
        label: transitionPreset.label,
        color: transitionPreset.color,
        position,
        orientation,
        doorwayState: 'open',
        transitionType: transitionPreset.value,
        width: 34,
        tags: [],
        noteIds: [],
        transitionId,
        createdAt: now(),
        updatedAt: now(),
      });
      map.transitions.push({
        kind: 'transition',
        id: transitionId,
        layerId: getLayerId(map, 'transitions'),
        label: transitionPreset.label,
        color: transitionPreset.color,
        tags: [],
        state: 'unknown',
        noteIds: [],
        createdAt: now(),
        updatedAt: now(),
        position,
        size: { width: 28, height: 28 },
        angle: 0,
        transitionType: transitionPreset.value,
        markerState: 'default',
        certainty: 'unknown',
        transitionState: 'unknown',
        doorwayId,
        oneWay: false,
        hidden: false,
        disabled: false,
        intentionallyUnpaired: false,
      });
      set({ selection: { kind: 'doorway', ids: [doorwayId] }, inspectorTab: 'links' });
    });
    set((state) => bumpOnboarding(state, 'door-placed') ?? {});
  },
  addMarkerAt: (position, iconId) => {
    const preset = getMarkerPresetDefinition(get().toolSettings.markerPreset);
    applyWorkspaceChange(set, get, (_workspace, project, map) => {
      const entry: MarkerRecord = {
        kind: 'marker',
        id: makeId('marker'),
        layerId: getLayerId(map, 'icons'),
        label: preset.label,
        color: preset.color,
        position,
        iconId: iconId ?? preset.iconId ?? project.iconFavorites[0] ?? 'note-pin',
        markerType: preset.markerType,
        markerState: preset.markerState,
        state: preset.state,
        tags: [...preset.tags],
        noteIds: [],
        createdAt: now(),
        updatedAt: now(),
        size: 22,
        opacity: 1,
        labelVisible: true,
        badges: preset.markerState === 'secret' ? ['secret'] : [],
      };
      map.markers.push(entry);
      set({ selection: { kind: 'marker', ids: [entry.id] } });
    });
    set((state) => bumpOnboarding(state, 'annotation-added') ?? {});
  },
  addNoteAt: (position) => {
    applyWorkspaceChange(set, get, (_workspace, _project, map) => {
      const entry: NoteRecord = {
        id: makeId('note'),
        layerId: getLayerId(map, 'notes'),
        title: 'Field Note',
        body: 'Type details here.',
        position,
        color: '#e5b56d',
        tags: [],
        priority: 'normal',
        category: 'general',
        state: 'open',
        spoiler: false,
        pinned: false,
        collapsed: false,
        completed: false,
        linkedMapIds: [map.id],
        createdAt: now(),
        updatedAt: now(),
      };
      map.notesBoard.push(entry);
      set({ selection: { kind: 'note', ids: [entry.id] } });
    });
    set((state) => bumpOnboarding(state, 'annotation-added') ?? {});
  },
  addAnchorAt: (position) =>
    applyWorkspaceChange(set, get, (_workspace, _project, map) => {
      const entry: AnchorRecord = {
        id: makeId('anchor'),
        layerId: getLayerId(map, 'labels'),
        name: `Anchor ${map.anchors.length + 1}`,
        position,
        color: '#e8b59b',
        mapId: map.id,
      };
      map.anchors.push(entry);
      set({ selection: { kind: 'anchor', ids: [entry.id] } });
    }),
  addRouteOverlay: (points) =>
    applyWorkspaceChange(set, get, (_workspace, _project, map) => {
      const entry: RouteOverlay = {
        id: makeId('route'),
        layerId: getLayerId(map, 'overlay'),
        label: 'Marked Route',
        points,
        width: 10,
        color: '#cf313f',
        opacity: 0.85,
        state: 'confirmed',
        tags: [],
        noteIds: [],
        createdAt: now(),
        updatedAt: now(),
      };
      map.routeOverlays.push(entry);
      set({ selection: { kind: 'route', ids: [entry.id] } });
    }),
  addSketchStroke: (points) =>
    applyWorkspaceChange(set, get, (_workspace, _project, map) => {
      map.sketches.push({
        id: makeId('sketch'),
        layerId: getLayerId(map, 'terrain'),
        color: '#b92031',
        width: 5,
        opacity: 0.75,
        points,
      });
    }),
  updateEntity: (kind, id, patch) =>
    applyWorkspaceChange(set, get, (_workspace, _project, map) => {
      const stamp = now();
      if (kind === 'floor_room') map.floorRooms = map.floorRooms.map((entry) => entry.id === id ? { ...entry, ...patch, updatedAt: stamp } : entry);
      else if (kind === 'corridor') map.corridors = map.corridors.map((entry) => entry.id === id ? { ...entry, ...patch, updatedAt: stamp } : entry);
      else if (kind === 'wall') map.wallSegments = map.wallSegments.map((entry) => entry.id === id ? { ...entry, ...patch, updatedAt: stamp } : entry);
      else if (kind === 'doorway') {
        map.doorways = map.doorways.map((entry) => entry.id === id ? { ...entry, ...patch, updatedAt: stamp } : entry);
        const doorway = map.doorways.find((entry) => entry.id === id);
        if (doorway?.transitionId) {
          map.transitions = map.transitions.map((entry) =>
            entry.id === doorway.transitionId
              ? {
                  ...entry,
                  label: typeof patch.label === 'string' ? patch.label : entry.label,
                  color: typeof patch.color === 'string' ? patch.color : entry.color,
                  transitionType: patch.transitionType ? (patch.transitionType as TransitionRecord['transitionType']) : entry.transitionType,
                  position: patch.position ? (patch.position as Point) : entry.position,
                  updatedAt: stamp,
                }
              : entry,
          );
        }
      }
      else if (kind === 'marker') map.markers = map.markers.map((entry) => entry.id === id ? { ...entry, ...patch, updatedAt: stamp } : entry);
      else if (kind === 'transition') {
        map.transitions = map.transitions.map((entry) => entry.id === id ? { ...entry, ...patch, updatedAt: stamp } : entry);
        const transition = map.transitions.find((entry) => entry.id === id);
        if (transition?.doorwayId) {
          map.doorways = map.doorways.map((entry) =>
            entry.id === transition.doorwayId
              ? {
                  ...entry,
                  label: typeof patch.label === 'string' ? patch.label : entry.label,
                  color: typeof patch.color === 'string' ? patch.color : entry.color,
                  transitionType: patch.transitionType ? (patch.transitionType as DoorwayRecord['transitionType']) : entry.transitionType,
                  position: patch.position ? (patch.position as Point) : entry.position,
                  updatedAt: stamp,
                }
              : entry,
          );
        }
      }
      else if (kind === 'note') map.notesBoard = map.notesBoard.map((entry) => entry.id === id ? { ...entry, ...patch, updatedAt: stamp } : entry);
      else if (kind === 'anchor') map.anchors = map.anchors.map((entry) => entry.id === id ? { ...entry, ...patch } : entry);
      else if (kind === 'route') map.routeOverlays = map.routeOverlays.map((entry) => entry.id === id ? { ...entry, ...patch, updatedAt: stamp } : entry);
      else if (kind === 'zone') map.zones = map.zones.map((entry) => entry.id === id ? { ...entry, ...patch } : entry);
      syncMap(map);
    }),
  moveEntity: (kind, id, position) =>
    applyWorkspaceChange(set, get, (_workspace, _project, map) => {
      if (kind === 'floor_room') {
        map.floorRooms = map.floorRooms.map((entry) => entry.id === id ? { ...entry, bounds: { ...entry.bounds, x: position.x, y: position.y }, updatedAt: now() } : entry);
      } else if (kind === 'marker') {
        map.markers = map.markers.map((entry) => entry.id === id ? { ...entry, position, updatedAt: now() } : entry);
      } else if (kind === 'note') {
        map.notesBoard = map.notesBoard.map((entry) => entry.id === id ? { ...entry, position, updatedAt: now() } : entry);
      } else if (kind === 'anchor') {
        map.anchors = map.anchors.map((entry) => entry.id === id ? { ...entry, position } : entry);
      } else if (kind === 'transition') {
        map.transitions = map.transitions.map((entry) => entry.id === id ? { ...entry, position, updatedAt: now() } : entry);
      } else if (kind === 'doorway') {
        map.doorways = map.doorways.map((entry) => entry.id === id ? { ...entry, position, updatedAt: now() } : entry);
        const transitionId = map.doorways.find((entry) => entry.id === id)?.transitionId;
        if (transitionId) {
          map.transitions = map.transitions.map((entry) => entry.id === transitionId ? { ...entry, position, updatedAt: now() } : entry);
        }
      }
      syncMap(map);
    }),
  deleteEntity: (kind, id) =>
    applyWorkspaceChange(set, get, (_workspace, _project, map) => {
      const ids = new Set([id]);
      if (kind === 'floor_room') map.floorRooms = map.floorRooms.filter((entry) => !ids.has(entry.id));
      else if (kind === 'corridor') map.corridors = map.corridors.filter((entry) => !ids.has(entry.id));
      else if (kind === 'wall') map.wallSegments = map.wallSegments.filter((entry) => !ids.has(entry.id));
      else if (kind === 'doorway') {
        const linkedTransitions = map.doorways.filter((entry) => ids.has(entry.id)).map((entry) => entry.transitionId).filter(Boolean);
        map.doorways = map.doorways.filter((entry) => !ids.has(entry.id));
        map.transitions = map.transitions.filter((entry) => !linkedTransitions.includes(entry.id));
      } else if (kind === 'marker') map.markers = map.markers.filter((entry) => !ids.has(entry.id));
      else if (kind === 'transition') map.transitions = map.transitions.filter((entry) => !ids.has(entry.id));
      else if (kind === 'note') map.notesBoard = map.notesBoard.filter((entry) => !ids.has(entry.id));
      else if (kind === 'anchor') map.anchors = map.anchors.filter((entry) => !ids.has(entry.id));
      else if (kind === 'route') map.routeOverlays = map.routeOverlays.filter((entry) => !ids.has(entry.id));
      else if (kind === 'zone') map.zones = map.zones.filter((entry) => !ids.has(entry.id));
      syncMap(map);
      if (get().selection.ids.includes(id)) set({ selection: { kind: 'none', ids: [] } });
    }),
  duplicateSelection: () =>
    applyWorkspaceChange(set, get, (_workspace, _project, map) => {
      const selection = get().selection;
      if (selection.ids.length !== 1) return;
      const id = selection.ids[0];
      if (selection.kind === 'floor_room') {
        const item = map.floorRooms.find((entry) => entry.id === id);
        if (!item) return;
        const clone = { ...deepClone(item), id: makeId('floor_room'), label: `${item.label} Copy`, bounds: { ...item.bounds, x: item.bounds.x + 72, y: item.bounds.y + 72 }, createdAt: now(), updatedAt: now() };
        map.floorRooms.push(clone);
        set({ selection: { kind: 'floor_room', ids: [clone.id] } });
      } else if (selection.kind === 'marker') {
        const item = map.markers.find((entry) => entry.id === id);
        if (!item) return;
        const clone = { ...deepClone(item), id: makeId('marker'), label: `${item.label} Copy`, position: { x: item.position.x + 36, y: item.position.y + 36 }, createdAt: now(), updatedAt: now() };
        map.markers.push(clone);
        set({ selection: { kind: 'marker', ids: [clone.id] } });
      } else if (selection.kind === 'note') {
        const item = map.notesBoard.find((entry) => entry.id === id);
        if (!item) return;
        const clone = { ...deepClone(item), id: makeId('note'), title: `${item.title} Copy`, position: { x: item.position.x + 36, y: item.position.y + 36 }, createdAt: now(), updatedAt: now() };
        map.notesBoard.push(clone);
        set({ selection: { kind: 'note', ids: [clone.id] } });
      }
      syncMap(map);
    }),
  deleteSelection: () =>
    applyWorkspaceChange(set, get, (_workspace, _project, map) => {
      const selection = get().selection;
      if (selection.kind === 'none') return;
      const ids = new Set(selection.ids);
      if (selection.kind === 'floor_room') map.floorRooms = map.floorRooms.filter((entry) => !ids.has(entry.id));
      else if (selection.kind === 'corridor') map.corridors = map.corridors.filter((entry) => !ids.has(entry.id));
      else if (selection.kind === 'wall') map.wallSegments = map.wallSegments.filter((entry) => !ids.has(entry.id));
      else if (selection.kind === 'doorway') {
        const linkedTransitions = map.doorways.filter((entry) => ids.has(entry.id)).map((entry) => entry.transitionId).filter(Boolean);
        map.doorways = map.doorways.filter((entry) => !ids.has(entry.id));
        map.transitions = map.transitions.filter((entry) => !linkedTransitions.includes(entry.id));
      } else if (selection.kind === 'marker') map.markers = map.markers.filter((entry) => !ids.has(entry.id));
      else if (selection.kind === 'transition') map.transitions = map.transitions.filter((entry) => !ids.has(entry.id));
      else if (selection.kind === 'note') map.notesBoard = map.notesBoard.filter((entry) => !ids.has(entry.id));
      else if (selection.kind === 'anchor') map.anchors = map.anchors.filter((entry) => !ids.has(entry.id));
      else if (selection.kind === 'route') map.routeOverlays = map.routeOverlays.filter((entry) => !ids.has(entry.id));
      else if (selection.kind === 'zone') map.zones = map.zones.filter((entry) => !ids.has(entry.id));
      syncMap(map);
      set({ selection: { kind: 'none', ids: [] } });
    }),
  pairTransitions: (sourceTransitionId, destinationTransitionId) => {
    applyWorkspaceChange(set, get, (_workspace, project) => {
      let sourceMap: MapRecord | undefined;
      let sourceTransition: TransitionRecord | undefined;
      let destinationMap: MapRecord | undefined;
      let destinationTransition: TransitionRecord | undefined;
      for (const map of project.maps) {
        for (const entry of map.transitions) {
          if (entry.id === sourceTransitionId) {
            sourceMap = map;
            sourceTransition = entry;
          }
          if (entry.id === destinationTransitionId) {
            destinationMap = map;
            destinationTransition = entry;
          }
        }
      }
      if (!sourceMap || !destinationMap || !sourceTransition || !destinationTransition) return;
      const destinationAnchor = destinationMap.anchors[0] ?? { id: makeId('anchor'), layerId: getLayerId(destinationMap, 'labels'), name: destinationTransition.label, position: destinationTransition.position, color: destinationTransition.color, mapId: destinationMap.id };
      if (!destinationMap.anchors.find((entry) => entry.id === destinationAnchor.id)) destinationMap.anchors.push(destinationAnchor);
      sourceTransition.destinationMapId = destinationMap.id;
      sourceTransition.destinationAnchorId = destinationAnchor.id;
      sourceTransition.certainty = 'confirmed';
      sourceTransition.transitionState = 'opened';
      sourceTransition.pairedLabel = destinationTransition.label;
      sourceTransition.returnTransitionId = destinationTransition.id;
      if (!sourceTransition.oneWay) {
        const sourceAnchor = sourceMap.anchors[0] ?? { id: makeId('anchor'), layerId: getLayerId(sourceMap, 'labels'), name: sourceTransition.label, position: sourceTransition.position, color: sourceTransition.color, mapId: sourceMap.id };
        if (!sourceMap.anchors.find((entry) => entry.id === sourceAnchor.id)) sourceMap.anchors.push(sourceAnchor);
        destinationTransition.destinationMapId = sourceMap.id;
        destinationTransition.destinationAnchorId = sourceAnchor.id;
        destinationTransition.certainty = 'confirmed';
        destinationTransition.transitionState = 'opened';
        destinationTransition.pairedLabel = sourceTransition.label;
        destinationTransition.returnTransitionId = sourceTransition.id;
      }
    });
    set((state) => bumpOnboarding(state, 'transition-linked') ?? {});
  },
  seedTutorialLinkTarget: () => {
    applyWorkspaceChange(set, get, (workspace, project, map) => {
      const selection = get().selection;
      const selectedDoorway =
        selection.kind === 'doorway' ? map.doorways.find((entry) => entry.id === selection.ids[0]) : undefined;
      const selectedTransition =
        selection.kind === 'transition'
          ? map.transitions.find((entry) => entry.id === selection.ids[0])
          : selectedDoorway?.transitionId
            ? map.transitions.find((entry) => entry.id === selectedDoorway.transitionId)
            : undefined;

      if (!selectedTransition) return;

      let tutorialMap = project.maps.find((entry) => entry.subtitle === 'Tutorial destination');
      if (!tutorialMap) {
        const mapId = makeId('map');
        const roomId = makeId('floor_room');
        const anchorId = makeId('anchor');
        const doorwayId = makeId('doorway');
        const transitionId = makeId('transition');
        const room: FloorRoom = {
          kind: 'floor_room',
          id: roomId,
          layerId: `${mapId}_layer_rooms`,
          label: 'Tutorial Annex',
          subtitle: 'Tutorial destination',
          color: '#efe4d2',
          tags: ['tutorial'],
          state: 'seen',
          noteIds: [],
          createdAt: now(),
          updatedAt: now(),
          bounds: { x: 720, y: 520, width: 420, height: 280 },
          roomShape: 'rectangle',
          roomType: 'junction',
          fillPattern: 'ash',
          dangerLevel: 0,
          lootCount: 0,
          checklist: [],
        };
        tutorialMap = normalizeMap({
          id: mapId,
          name: 'Tutorial Annex',
          subtitle: 'Tutorial destination',
          region: project.gameTitle || 'Practice',
          floor: 'Link Target',
          accent: '#a6353f',
          style: 'floorplan',
          notes: 'Seeded by the guided tutorial to demonstrate door pairing.',
          completion: 0,
          favorite: false,
          layers: createDefaultLayers(mapId),
          background: undefined,
          rooms: [],
          paths: [],
          floorRooms: [room],
          corridors: [],
          wallSegments: buildRoomWalls(`${mapId}_layer_rooms`, room),
          doorways: [{
            id: doorwayId,
            layerId: `${mapId}_layer_transitions`,
            label: selectedTransition.label,
            color: selectedTransition.color,
            position: { x: room.bounds.x + room.bounds.width, y: room.bounds.y + room.bounds.height / 2 },
            orientation: 'east',
            doorwayState: 'open',
            transitionType: selectedTransition.transitionType,
            width: 34,
            tags: ['tutorial'],
            noteIds: [],
            transitionId,
            createdAt: now(),
            updatedAt: now(),
          }],
          routeOverlays: [],
          transitions: [{
            kind: 'transition',
            id: transitionId,
            layerId: `${mapId}_layer_transitions`,
            label: selectedTransition.label,
            color: selectedTransition.color,
            tags: ['tutorial'],
            state: 'seen',
            noteIds: [],
            createdAt: now(),
            updatedAt: now(),
            position: { x: room.bounds.x + room.bounds.width, y: room.bounds.y + room.bounds.height / 2 },
            size: { width: 28, height: 28 },
            angle: 0,
            transitionType: selectedTransition.transitionType,
            markerState: 'default',
            certainty: 'unknown',
            transitionState: 'unknown',
            doorwayId,
            oneWay: false,
            hidden: false,
            disabled: false,
            intentionallyUnpaired: false,
          }],
          anchors: [{
            id: anchorId,
            layerId: `${mapId}_layer_labels`,
            name: 'Annex Entry',
            position: { x: room.bounds.x + room.bounds.width / 2, y: room.bounds.y + room.bounds.height / 2 },
            color: selectedTransition.color,
            mapId,
          }],
          markers: [],
          notesBoard: [],
          zones: [],
          sketches: [],
          view: createDefaultView(),
        });
        project.maps.push(tutorialMap);
      }

      tutorialMap.transitions = tutorialMap.transitions.map((entry) => ({
        ...entry,
        label: selectedTransition.label,
        color: selectedTransition.color,
        transitionType: selectedTransition.transitionType,
        destinationMapId: undefined,
        destinationAnchorId: undefined,
        pairedLabel: undefined,
        returnTransitionId: undefined,
        certainty: 'unknown',
        transitionState: 'unknown',
        updatedAt: now(),
      }));
      tutorialMap.doorways = tutorialMap.doorways.map((entry) => ({
        ...entry,
        label: selectedTransition.label,
        color: selectedTransition.color,
        transitionType: selectedTransition.transitionType,
        updatedAt: now(),
      }));

      if (!workspace.openMapIds.includes(tutorialMap.id)) workspace.openMapIds.push(tutorialMap.id);
      syncMap(tutorialMap);
    });
    set({ inspectorTab: 'links' });
  },
  cycleSelectionState: () =>
    applyWorkspaceChange(set, get, (_workspace, _project, map) => {
      const selection = get().selection;
      if (selection.ids.length !== 1) return;
      const id = selection.ids[0];
      const nextState = (current: EntityState) => entityStateCycle[(entityStateCycle.indexOf(current) + 1) % entityStateCycle.length];
      if (selection.kind === 'floor_room') map.floorRooms = map.floorRooms.map((entry) => entry.id === id ? { ...entry, state: nextState(entry.state), updatedAt: now() } : entry);
      else if (selection.kind === 'marker') map.markers = map.markers.map((entry) => entry.id === id ? { ...entry, state: nextState(entry.state), updatedAt: now() } : entry);
      else if (selection.kind === 'transition') map.transitions = map.transitions.map((entry) => entry.id === id ? { ...entry, state: nextState(entry.state), updatedAt: now() } : entry);
      syncMap(map);
    }),
  toggleLayer: (layerId, key, value) =>
    applyWorkspaceChange(set, get, (_workspace, _project, map) => {
      map.layers = map.layers.map((layer) => layer.id === layerId ? { ...layer, [key]: value ?? !layer[key] } : layer);
    }),
  restartOnboarding: () => set({ onboarding: { show: true, step: 0, completed: false, dismissed: false } }),
  nextOnboardingStep: () =>
    set((state) => {
      const nextStep = Math.min(state.onboarding.step + 1, tutorialSteps.length - 1);
      const completed = nextStep >= tutorialSteps.length - 1 && !tutorialSteps[nextStep].expectedTrigger;
      return {
        onboarding: {
          ...state.onboarding,
          show: true,
          step: nextStep,
          completed: completed || state.onboarding.completed,
        },
      };
    }),
  dismissOnboarding: (completed = false) => set((state) => ({ onboarding: { show: false, step: state.onboarding.step, completed: completed || state.onboarding.completed, dismissed: true } })),
}));

export const selectActiveProject = (state: AppStore) => getActiveProject(state.workspace);
export const selectActiveMap = (state: AppStore) => getActiveMap(state.workspace);
