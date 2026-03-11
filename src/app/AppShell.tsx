import { lazy, Suspense, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { toast } from 'sonner';
import { Group as PanelGroup, Panel as ResizablePanel, Separator as PanelResizeHandle } from 'react-resizable-panels';

import { SvgMapIcon } from '../data/iconLibrary';
import { corridorWidthOptions, markerPresetOptions, roomPlacementOptions, roomTypeOptions, transitionOptions } from '../lib/editorPresets';
import { buildRoutePlan } from '../lib/pathfinding';
import { getLegendForMap, getProjectStats, getReviewItems, getSearchResults } from '../lib/projectDerived';
import { runAccessibilityAudit } from '../lib/accessibility';
import { downloadDataUrl, downloadTextFile } from '../lib/utils';
import { MapCanvas, type MapCanvasHandle } from '../components/canvas/MapCanvas';
import { BottomPanel } from '../components/panels/BottomPanel';
import { CommandPalette } from '../components/panels/CommandPalette';
import { IconPickerModal } from '../components/panels/IconPickerModal';
import { LeftSidebar } from '../components/panels/LeftSidebar';
import { OnboardingModal } from '../components/panels/OnboardingModal';
import { RightSidebar } from '../components/panels/RightSidebar';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '../components/ui/dropdown-menu';
import { Button, GhostButton, Panel } from '../components/ui/primitives';
import { useHotkeys } from '../hooks/useHotkeys';
import { selectActiveMap, selectActiveProject, useAppStore } from '../store/useAppStore';

const readJsonFile = (file: File) =>
  new Promise<unknown>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        resolve(JSON.parse(reader.result as string));
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });

const modes = [
  { value: 'floorplan', label: 'Draft', shortLabel: 'Draft', icon: 'floorplan' },
  { value: 'graph', label: 'Route Graph', shortLabel: 'Graph', icon: 'graph' },
  { value: 'ink', label: 'Annotate', shortLabel: 'Annotate', icon: 'annotate' },
  { value: 'portal', label: 'Links', shortLabel: 'Links', icon: 'links' },
  { value: 'navigate', label: 'Navigate', shortLabel: 'Travel', icon: 'navigate' },
  { value: 'review', label: 'Review', shortLabel: 'Review', icon: 'review' },
] as const;

const tools = [
  { value: 'select', label: 'Select', shortLabel: 'Select', icon: 'select' },
  { value: 'floorRoom', label: 'Room', shortLabel: 'Room', icon: 'room' },
  { value: 'corridor', label: 'Corridor', shortLabel: 'Corridor', icon: 'corridor' },
  { value: 'wall', label: 'Wall', shortLabel: 'Wall', icon: 'wall' },
  { value: 'doorway', label: 'Door', shortLabel: 'Door', icon: 'door' },
  { value: 'route', label: 'Path', shortLabel: 'Path', icon: 'route' },
  { value: 'marker', label: 'Overlay', shortLabel: 'Overlay', icon: 'marker' },
  { value: 'note', label: 'Note', shortLabel: 'Note', icon: 'note' },
  { value: 'sketch', label: 'Markup', shortLabel: 'Markup', icon: 'sketch' },
  { value: 'erase', label: 'Erase', shortLabel: 'Erase', icon: 'erase' },
] as const;

const MapThreePreview = lazy(async () => {
  const module = await import('../components/canvas/MapThreePreview');
  return { default: module.MapThreePreview };
});

export function AppShell() {
  useHotkeys();

  const canvasRef = useRef<MapCanvasHandle | null>(null);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const [isCompactLayout, setIsCompactLayout] = useState(
    typeof window !== 'undefined' ? window.innerWidth <= 1120 : false,
  );

  const boot = useAppStore((state) => state.boot);
  const persistNow = useAppStore((state) => state.persistNow);
  const loaded = useAppStore((state) => state.loaded);
  const saveState = useAppStore((state) => state.saveState);
  const editorMode = useAppStore((state) => state.editorMode);
  const activeTool = useAppStore((state) => state.activeTool);
  const toolSettings = useAppStore((state) => state.toolSettings);
  const search = useAppStore((state) => state.search);
  const workspace = useAppStore((state) => state.workspace);
  const project = useAppStore(selectActiveProject);
  const map = useAppStore(selectActiveMap);
  const setEditorMode = useAppStore((state) => state.setEditorMode);
  const setActiveTool = useAppStore((state) => state.setActiveTool);
  const setToolSettings = useAppStore((state) => state.setToolSettings);
  const updateMapView = useAppStore((state) => state.updateMapView);
  const setSearchQuery = useAppStore((state) => state.setSearchQuery);
  const navigateBack = useAppStore((state) => state.navigateBack);
  const navigateForward = useAppStore((state) => state.navigateForward);
  const undo = useAppStore((state) => state.undo);
  const redo = useAppStore((state) => state.redo);
  const openMap = useAppStore((state) => state.openMap);
  const closeMap = useAppStore((state) => state.closeMap);
  const createMap = useAppStore((state) => state.createMap);
  const createSnapshot = useAppStore((state) => state.createSnapshot);
  const importProject = useAppStore((state) => state.importProject);
  const markActiveMapReviewed = useAppStore((state) => state.markActiveMapReviewed);
  const clearActiveMap = useAppStore((state) => state.clearActiveMap);
  const showLeftSidebar = useAppStore((state) => state.showLeftSidebar);
  const showRightSidebar = useAppStore((state) => state.showRightSidebar);
  const showBottomPanel = useAppStore((state) => state.showBottomPanel);
  const toggleSidebar = useAppStore((state) => state.toggleSidebar);
  const setCommandPaletteOpen = useAppStore((state) => state.setCommandPaletteOpen);
  const generateDungeon = useAppStore((state) => state.generateDungeon);
  const routePlannerStart = useAppStore((state) => state.routePlannerStart);
  const routePlannerEnd = useAppStore((state) => state.routePlannerEnd);

  const stats = getProjectStats(project);
  const reviewItems = getReviewItems(project);
  const searchResults = getSearchResults(project, search.query);
  const legend = getLegendForMap(map);
  const routePlan = buildRoutePlan(project, routePlannerStart, routePlannerEnd);
  const hasLeftSidebar = showLeftSidebar && !isCompactLayout;
  const hasRightSidebar = showRightSidebar && !isCompactLayout;
  const centerPanelDefaultSize = hasLeftSidebar && hasRightSidebar ? 62 : hasLeftSidebar ? 82 : hasRightSidebar ? 80 : 100;
  // (All modes/tools are rendered in the vertical rail, no primary/secondary split needed)

  useEffect(() => {
    boot();
  }, [boot]);

  useEffect(() => {
    document.documentElement.dataset.theme = 'ember';
    if (import.meta.env.DEV) runAccessibilityAudit();
  }, []);

  useEffect(() => {
    const handleResize = () => setIsCompactLayout(window.innerWidth <= 1120);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    const handle = window.setTimeout(() => {
      void persistNow();
    }, 900);
    return () => window.clearTimeout(handle);
  }, [loaded, persistNow, workspace]);

  const exportProjectJson = () => {
    downloadTextFile(`${project.name.replace(/\s+/g, '-').toLowerCase()}.json`, JSON.stringify(project, null, 2), 'application/json');
    toast('Project JSON exported.');
  };

  const exportMapPng = () => {
    const dataUrl = canvasRef.current?.toDataUrl();
    if (!dataUrl) return;
    downloadDataUrl(`${map.name.replace(/\s+/g, '-').toLowerCase()}.png`, dataUrl);
    toast('Map PNG exported.');
  };

  const exportMapPdf = async () => {
    const dataUrl = canvasRef.current?.toDataUrl();
    if (!dataUrl) return;
    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF({ orientation: 'landscape', unit: 'px', format: [1600, 1000] });
    doc.addImage(dataUrl, 'PNG', 24, 24, 1552, 952);
    doc.save(`${map.name.replace(/\s+/g, '-').toLowerCase()}.pdf`);
    toast('Map PDF exported.');
  };

  const handleImportProject = async (file: File) => {
    try {
      const payload = await readJsonFile(file);
      importProject(payload as typeof project);
      toast('Project imported into a new workspace slot.');
    } catch (error) {
      console.error(error);
      toast('Import failed. Make sure the file is a valid project JSON export.');
    }
  };

  const handleClearMap = () => {
    const confirmed =
      typeof window === 'undefined'
        ? true
        : window.confirm(`Clear all rooms, corridors, doors, notes, and overlays from "${map.name}"? Map details and background will stay in place.`);
    if (!confirmed) return;
    clearActiveMap();
    toast(`Cleared ${map.name}.`);
  };

  const toolContext = useMemo(() => {
    if (activeTool === 'floorRoom') {
      return (
        <Panel className="tool-context-card tool-context-card--inline">
          <span className="section-eyebrow">Room Tool</span>
          <h3>Floorplan rooms</h3>
          <div className="tool-preset-grid">
            {roomPlacementOptions.map((option) => (
              <button
                key={option.value}
                className={toolSettings.roomPlacement === option.value ? 'is-active' : ''}
                data-testid={`room-placement-${option.value}`}
                onClick={() => setToolSettings({ roomPlacement: option.value })}
                type="button"
              >
                <strong>{option.label}</strong>
                <small>{option.detail}</small>
              </button>
            ))}
          </div>
          <div className="tool-chip-grid">
            {roomTypeOptions.map((option) => (
              <button
                key={option.value}
                className={toolSettings.roomType === option.value ? 'is-active' : ''}
                onClick={() => setToolSettings({ roomType: option.value })}
                style={{ ['--chip-accent' as string]: option.color } as CSSProperties}
                type="button"
              >
                {option.label}
              </button>
            ))}
          </div>
        </Panel>
      );
    }

    if (activeTool === 'corridor') {
      return (
        <Panel className="tool-context-card tool-context-card--inline">
          <span className="section-eyebrow">Corridor Tool</span>
          <h3>Hallway brush</h3>
          <div className="tool-preset-grid">
            {corridorWidthOptions.map((option) => (
              <button
                key={option.value}
                className={toolSettings.corridorWidth === option.value ? 'is-active' : ''}
                data-testid={`corridor-width-${option.value}`}
                onClick={() => setToolSettings({ corridorWidth: option.value })}
                type="button"
              >
                <strong>{option.label}</strong>
                <small>{option.detail}</small>
              </button>
            ))}
          </div>
        </Panel>
      );
    }

    if (activeTool === 'doorway') {
      return (
        <Panel className="tool-context-card tool-context-card--inline">
          <span className="section-eyebrow">Door Tool</span>
          <h3>Transitions</h3>
          <div className="tool-icon-grid">
            {transitionOptions.map((option) => (
              <button
                key={option.value}
                className={toolSettings.transitionType === option.value ? 'is-active' : ''}
                data-testid={`transition-preset-${option.value}`}
                onClick={() => setToolSettings({ transitionType: option.value })}
                type="button"
              >
                <SvgMapIcon iconId={option.iconId} size={22} />
                <span>{option.label}</span>
              </button>
            ))}
          </div>
        </Panel>
      );
    }

    if (activeTool === 'marker') {
      return (
        <Panel className="tool-context-card tool-context-card--inline">
          <span className="section-eyebrow">Overlay Tool</span>
          <h3>Map overlays</h3>
          <div className="tool-icon-grid">
            {markerPresetOptions.map((option) => (
              <button
                key={option.value}
                className={toolSettings.markerPreset === option.value ? 'is-active' : ''}
                data-testid={`marker-preset-${option.value}`}
                onClick={() => setToolSettings({ markerPreset: option.value })}
                type="button"
              >
                <SvgMapIcon iconId={option.iconId} size={22} />
                <span>{option.label}</span>
              </button>
            ))}
          </div>
        </Panel>
      );
    }

    if (activeTool === 'erase') {
      return (
        <Panel className="tool-context-card tool-context-card--inline">
          <span className="section-eyebrow">Erase Tool</span>
          <h3>Deletion behavior</h3>
          <div className="tool-preset-grid">
            <button
              className={toolSettings.eraseMode === 'entity' ? 'is-active' : ''}
              onClick={() => setToolSettings({ eraseMode: 'entity' })}
              type="button"
            >
              <strong>Smart erase</strong>
              <small>Delete whole room/corridor/door/marker objects.</small>
            </button>
            <button
              className={toolSettings.eraseMode === 'segment' ? 'is-active' : ''}
              onClick={() => setToolSettings({ eraseMode: 'segment' })}
              type="button"
            >
              <strong>Erase segments</strong>
              <small>Delete only individual wall segments and primitives.</small>
            </button>
          </div>
        </Panel>
      );
    }

    return null;
  }, [
    activeTool,
    setToolSettings,
    toolSettings.corridorWidth,
    toolSettings.eraseMode,
    toolSettings.markerPreset,
    toolSettings.roomPlacement,
    toolSettings.roomType,
    toolSettings.transitionType,
  ]);

  if (!loaded) {
    return (
      <div className="loading-shell">
        <div className="loading-card">
          <span className="section-eyebrow">Wayfinder Atelier</span>
          <h1>Preparing the cartographer desk...</h1>
          <p>Loading your local atlas, linked doors, and route notes.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <header className="command-bar">
        <div className="command-bar__workspace-switcher">
          <div className="command-bar__logo">WA</div>
          <div className="command-bar__workspace-meta">
            <strong>{project.name}</strong>
            <label>
              <span className="sr-only">Switch map</span>
              <select
                aria-label="Active map switcher"
                value={map.id}
                onChange={(event) => openMap(event.target.value)}
              >
                {project.maps.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
        <label className="command-bar__search">
          <span>Search</span>
          <input
            data-testid="top-search"
            placeholder="Search maps, notes, rooms, and doors"
            value={search.query}
            onChange={(event) => setSearchQuery(event.target.value)}
          />
        </label>
        <div className="command-bar__actions">
          <GhostButton aria-label="Undo" onClick={undo}>Undo</GhostButton>
          <GhostButton aria-label="Redo" onClick={redo}>Redo</GhostButton>
          <Button
            aria-label="Generate dungeon"
            data-testid="generate-dungeon-button"
            onClick={() => generateDungeon()}
            style={{ background: 'var(--crimson)', color: 'var(--bone)' }}
          >
            Generate
          </Button>
          <GhostButton
            aria-label="Clear current map"
            className="is-danger"
            data-testid="clear-map-button"
            onClick={handleClearMap}
          >
            Clear Map
          </GhostButton>
          <Button aria-label="Export map PNG" onClick={exportMapPng}>Export</Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="inline-flex items-center gap-2 px-3 py-2.5 text-[var(--text-muted)] rounded-xl border border-[rgba(255,200,200,0.06)] bg-[#1e1818] cursor-pointer hover:bg-[#2c2424] hover:border-[var(--line-strong)] transition-colors"
                data-testid="topbar-more-menu"
                type="button"
              >
                <RailIcon kind="more" />
                <span>More</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                data-testid="toggle-3d-preview"
                onSelect={() => updateMapView({ renderMode: map.view.renderMode === 'preview_3d' ? 'editor_2d' : 'preview_3d' })}
              >
                {map.view.renderMode === 'preview_3d' ? 'Switch To 2D Editor' : 'Open 3D Preview'}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setCommandPaletteOpen(true)}>Open Command Palette</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => toggleSidebar('bottom')}>Toggle Drawer</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={markActiveMapReviewed}>Mark Map Reviewed</DropdownMenuItem>
              <DropdownMenuItem onSelect={navigateBack}>Back</DropdownMenuItem>
              <DropdownMenuItem onSelect={navigateForward}>Forward</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => toggleSidebar('left')}>{showLeftSidebar ? 'Hide Explorer' : 'Show Explorer'}</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => toggleSidebar('right')}>{showRightSidebar ? 'Hide Inspector' : 'Show Inspector'}</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => importInputRef.current?.click()}>Import Project</DropdownMenuItem>
              <DropdownMenuItem onSelect={exportProjectJson}>Export Project JSON</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => void exportMapPdf()}>Export Map PDF</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <BadgeState saveState={saveState} />
        </div>
      </header>

      <PanelGroup orientation="horizontal" className="flex-1 min-h-0 min-w-0 gap-1">
        {hasLeftSidebar ? (
          <>
            <ResizablePanel defaultSize={18} minSize={14} maxSize={30} className="min-h-0 h-full">
              <LeftSidebar
                onCreateMap={createMap}
                onCreateSnapshot={() => createSnapshot('Manual snapshot')}
                project={project}
                reviewItems={reviewItems}
                stats={stats}
              />
            </ResizablePanel>
            <PanelResizeHandle className="w-2 rounded-lg bg-gradient-to-b from-[rgba(196,60,76,0.18)] to-[rgba(196,60,76,0.04)] border border-[rgba(196,60,76,0.24)] hover:from-[rgba(196,60,76,0.32)] hover:to-[rgba(196,60,76,0.08)] hover:border-[rgba(196,60,76,0.42)] transition-colors cursor-col-resize" />
          </>
        ) : null}

        <ResizablePanel defaultSize={centerPanelDefaultSize} minSize={40} className="min-h-0">
          <div className="center-panel-shell">
            <div className="tool-rail-vertical" data-testid="tool-rail">
              <div className="tool-rail-vertical__group">
                <span className="tool-rail-vertical__label">Mode</span>
                {modes.map((mode) => (
                  <button
                    key={mode.value}
                    className={`tool-rail-vertical__btn ${editorMode === mode.value ? 'is-active' : ''}`}
                    data-testid={`mode-${mode.value}`}
                    onClick={() => setEditorMode(mode.value)}
                    title={mode.label}
                    type="button"
                  >
                    <RailIcon kind={mode.icon} />
                    <span>{mode.shortLabel}</span>
                  </button>
                ))}
              </div>
              <div className="tool-rail-vertical__divider" />
              <div className="tool-rail-vertical__group">
                <span className="tool-rail-vertical__label">Tools</span>
                {tools.map((tool) => (
                  <button
                    key={tool.value}
                    className={`tool-rail-vertical__btn ${activeTool === tool.value ? 'is-active' : ''}`}
                    data-testid={`tool-${tool.value}`}
                    onClick={() => setActiveTool(tool.value)}
                    title={tool.label}
                    type="button"
                  >
                    <RailIcon kind={tool.icon} />
                    <span>{tool.shortLabel}</span>
                  </button>
                ))}
              </div>
            </div>
            <section className="center-stage">
            <div className="center-stage__bar">
              <div className="map-tabs" data-testid="map-tabs">
                {workspace.openMapIds.map((mapId) => {
                  const tabMap = project.maps.find((entry) => entry.id === mapId);
                  if (!tabMap) return null;
                  return (
                    <div className={`map-tab ${map.id === mapId ? 'is-active' : ''}`} key={mapId}>
                      <button
                        aria-label={`Open ${tabMap.name}`}
                        className="map-tab__open"
                        onClick={() => openMap(mapId, { pushHistory: false })}
                        type="button"
                      >
                        <span className="map-tab__accent" style={{ background: tabMap.accent }} />
                        <strong>{tabMap.name}</strong>
                        <small>{tabMap.style === 'graph' ? 'Route Graph' : 'Floorplan'}</small>
                      </button>
                      {workspace.openMapIds.length > 1 ? (
                        <button
                          aria-label={`Close ${tabMap.name}`}
                          className="map-tab__close"
                          data-testid={`close-map-tab-${mapId}`}
                          onClick={() => closeMap(mapId)}
                          type="button"
                        >
                          ×
                        </button>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>

            {toolContext ? <div className="editor-strip">{toolContext}</div> : null}

            <div className="canvas-meta-strip">
              <div>
                <strong>{map.name}</strong>
                <span>{map.region} / {map.floor} / {map.style === 'graph' ? 'Route Graph' : map.style}</span>
              </div>
              <div className="canvas-chip-strip">
                <span data-testid="map-room-count">{map.floorRooms.length} rooms</span>
                <span data-testid="map-corridor-count">{map.corridors.length} corridors</span>
                <span data-testid="map-door-count">{map.doorways.length} links</span>
                <span>{Math.round(map.view.zoom * 100)}%</span>
              </div>
            </div>

            {map.view.renderMode === 'preview_3d' ? (
              <Suspense fallback={<div className="canvas-loading-state">Loading cinematic preview...</div>}>
                <MapThreePreview map={map} />
              </Suspense>
            ) : (
              <MapCanvas ref={canvasRef} map={map} project={project} />
            )}

            {showBottomPanel ? (
              <BottomPanel
                legend={legend}
                project={project}
                reviewItems={reviewItems}
                routePlan={routePlan}
                searchResults={searchResults}
                stats={stats}
              />
            ) : null}

            <input
              ref={importInputRef}
              accept="application/json,.json"
              hidden
              type="file"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void handleImportProject(file);
                event.target.value = '';
              }}
            />
          </section>
          </div>
        </ResizablePanel>

        {hasRightSidebar ? (
          <>
            <PanelResizeHandle className="w-2 rounded-lg bg-gradient-to-b from-[rgba(196,60,76,0.18)] to-[rgba(196,60,76,0.04)] border border-[rgba(196,60,76,0.24)] hover:from-[rgba(196,60,76,0.32)] hover:to-[rgba(196,60,76,0.08)] hover:border-[rgba(196,60,76,0.42)] transition-colors cursor-col-resize" />
            <ResizablePanel defaultSize={20} minSize={16} maxSize={32} className="min-h-0 h-full">
              <RightSidebar map={map} project={project} />
            </ResizablePanel>
          </>
        ) : null}
      </PanelGroup>

      <CommandPalette project={project} />
      <IconPickerModal map={map} project={project} />
      <OnboardingModal />
    </div>
  );
}

function BadgeState({ saveState }: { saveState: string }) {
  return (
    <div className={`save-state is-${saveState}`}>
      {saveState === 'saving' ? 'Saving' : saveState === 'saved' ? 'Saved' : 'Local-first'}
    </div>
  );
}

function RailIcon({ kind }: { kind: string }) {
  return (
    <svg aria-hidden="true" fill="none" height="18" viewBox="0 0 24 24" width="18">
      {kind === 'floorplan' ? (
        <>
          <rect x="4" y="5" width="7" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.7" />
          <path d="M11 8h4v4h5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" />
          <rect x="15" y="12" width="5" height="5" rx="1.5" stroke="currentColor" strokeWidth="1.7" />
        </>
      ) : null}
      {kind === 'graph' ? (
        <>
          <circle cx="6" cy="8" r="2.2" stroke="currentColor" strokeWidth="1.7" />
          <circle cx="18" cy="7" r="2.2" stroke="currentColor" strokeWidth="1.7" />
          <circle cx="12" cy="17" r="2.2" stroke="currentColor" strokeWidth="1.7" />
          <path d="M7.8 9.1 10.2 14.7M13.9 15.2l2.4-6.3M8.1 8h7.7" stroke="currentColor" strokeLinecap="round" strokeWidth="1.7" />
        </>
      ) : null}
      {kind === 'annotate' ? (
        <>
          <path d="M6 18.5h12" stroke="currentColor" strokeLinecap="round" strokeWidth="1.7" />
          <path d="M8 15.8 16.4 7.4l1.9 1.9-8.4 8.4L7 18Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.7" />
        </>
      ) : null}
      {kind === 'links' ? (
        <>
          <path d="M8.5 15.5H7a3 3 0 0 1 0-6h3" stroke="currentColor" strokeLinecap="round" strokeWidth="1.7" />
          <path d="M15.5 8.5H17a3 3 0 0 1 0 6h-3" stroke="currentColor" strokeLinecap="round" strokeWidth="1.7" />
          <path d="M9.5 12h5" stroke="currentColor" strokeLinecap="round" strokeWidth="1.7" />
        </>
      ) : null}
      {kind === 'navigate' ? (
        <>
          <path d="M12 4.5 18.5 10 12 19.5 5.5 10 12 4.5Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.7" />
          <path d="M12 9v6" stroke="currentColor" strokeLinecap="round" strokeWidth="1.7" />
        </>
      ) : null}
      {kind === 'review' ? (
        <>
          <rect x="5" y="5" width="14" height="14" rx="2" stroke="currentColor" strokeWidth="1.7" />
          <path d="m8.5 11.8 1.8 1.8 5-5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" />
        </>
      ) : null}
      {kind === 'select' ? (
        <path d="m6 4 10 8-4 1 2 5-2.2 1L9.8 14.2 7 17 6 4Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.7" />
      ) : null}
      {kind === 'room' ? (
        <rect x="5" y="6" width="14" height="12" rx="2.5" stroke="currentColor" strokeWidth="1.7" />
      ) : null}
      {kind === 'corridor' ? (
        <path d="M5 8h8v4h6v4" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.4" />
      ) : null}
      {kind === 'more' ? (
        <>
          <circle cx="6.5" cy="12" r="1.5" fill="currentColor" />
          <circle cx="12" cy="12" r="1.5" fill="currentColor" />
          <circle cx="17.5" cy="12" r="1.5" fill="currentColor" />
        </>
      ) : null}
      {kind === 'wall' ? (
        <>
          <path d="M6 8h12" stroke="currentColor" strokeLinecap="round" strokeWidth="3" />
          <path d="M6 15h12" stroke="currentColor" strokeDasharray="2 3" strokeLinecap="round" strokeWidth="1.4" />
        </>
      ) : null}
      {kind === 'door' ? (
        <>
          <path d="M7 18V6h8" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" />
          <path d="M15 6a7 7 0 0 1 0 12" stroke="currentColor" strokeLinecap="round" strokeWidth="1.7" />
        </>
      ) : null}
      {kind === 'route' ? (
        <path d="M5.5 16.5c2.2-6.2 5-9 8-9 1.7 0 3.2.8 5 2.5M15.5 7.5h3v3" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" />
      ) : null}
      {kind === 'marker' ? (
        <>
          <path d="M12 19s4.5-4.8 4.5-8.4A4.5 4.5 0 0 0 7.5 10.6C7.5 14.2 12 19 12 19Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.7" />
          <circle cx="12" cy="10.5" r="1.7" fill="currentColor" />
        </>
      ) : null}
      {kind === 'note' ? (
        <>
          <path d="M7 5.5h10v13H7Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.7" />
          <path d="M9 10h6M9 13h6M9 16h4" stroke="currentColor" strokeLinecap="round" strokeWidth="1.7" />
        </>
      ) : null}
      {kind === 'sketch' ? (
        <path d="M5.5 15.5c1.8-4 3.7-6 5.8-6 1.3 0 2.3.8 3.2 2 .8 1.1 1.7 1.8 3.5 1.8" stroke="currentColor" strokeLinecap="round" strokeWidth="1.9" />
      ) : null}
      {kind === 'erase' ? (
        <>
          <path d="m8 16.5 5.8-8 4.7 3.4-5.8 8H8Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.7" />
          <path d="M6 19.2h12" stroke="currentColor" strokeLinecap="round" strokeWidth="1.7" />
        </>
      ) : null}
    </svg>
  );
}
