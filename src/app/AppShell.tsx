import { useEffect, useMemo, useRef, type CSSProperties, type ReactNode } from 'react';
import { toast } from 'sonner';

import { SvgMapIcon } from '../data/iconLibrary';
import { corridorWidthOptions, markerPresetOptions, roomPlacementOptions, roomTypeOptions, transitionOptions } from '../lib/editorPresets';
import { buildRoutePlan } from '../lib/pathfinding';
import { getLegendForMap, getProjectStats, getReviewItems, getSearchResults } from '../lib/projectDerived';
import { downloadDataUrl, downloadTextFile } from '../lib/utils';
import { MapCanvas, type MapCanvasHandle } from '../components/canvas/MapCanvas';
import { BottomPanel } from '../components/panels/BottomPanel';
import { CommandPalette } from '../components/panels/CommandPalette';
import { IconPickerModal } from '../components/panels/IconPickerModal';
import { LeftSidebar } from '../components/panels/LeftSidebar';
import { OnboardingModal } from '../components/panels/OnboardingModal';
import { RightSidebar } from '../components/panels/RightSidebar';
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
  { value: 'floorplan', label: 'Draft', icon: 'floorplan' },
  { value: 'graph', label: 'Route Graph', icon: 'graph' },
  { value: 'ink', label: 'Annotate', icon: 'annotate' },
  { value: 'portal', label: 'Links', icon: 'links' },
  { value: 'navigate', label: 'Navigate', icon: 'navigate' },
  { value: 'review', label: 'Review', icon: 'review' },
] as const;

const tools = [
  { value: 'select', label: 'Select', icon: 'select' },
  { value: 'floorRoom', label: 'Room', icon: 'room' },
  { value: 'corridor', label: 'Corridor', icon: 'corridor' },
  { value: 'wall', label: 'Wall', icon: 'wall' },
  { value: 'doorway', label: 'Door', icon: 'door' },
  { value: 'route', label: 'Path', icon: 'route' },
  { value: 'marker', label: 'Overlay', icon: 'marker' },
  { value: 'note', label: 'Note', icon: 'note' },
  { value: 'sketch', label: 'Markup', icon: 'sketch' },
  { value: 'erase', label: 'Erase', icon: 'erase' },
] as const;

const primaryModeValues = new Set(['floorplan', 'navigate', 'review']);
const primaryToolValues = new Set(['select', 'floorRoom', 'corridor', 'doorway', 'note', 'erase']);

export function AppShell() {
  useHotkeys();

  const canvasRef = useRef<MapCanvasHandle | null>(null);
  const importInputRef = useRef<HTMLInputElement | null>(null);

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
  const showLeftSidebar = useAppStore((state) => state.showLeftSidebar);
  const showRightSidebar = useAppStore((state) => state.showRightSidebar);
  const showBottomPanel = useAppStore((state) => state.showBottomPanel);
  const toggleSidebar = useAppStore((state) => state.toggleSidebar);
  const setCommandPaletteOpen = useAppStore((state) => state.setCommandPaletteOpen);
  const routePlannerStart = useAppStore((state) => state.routePlannerStart);
  const routePlannerEnd = useAppStore((state) => state.routePlannerEnd);

  const stats = getProjectStats(project);
  const reviewItems = getReviewItems(project);
  const searchResults = getSearchResults(project, search.query);
  const legend = getLegendForMap(map);
  const routePlan = buildRoutePlan(project, routePlannerStart, routePlannerEnd);
  const primaryModes = modes.filter((mode) => primaryModeValues.has(mode.value));
  const secondaryModes = modes.filter((mode) => !primaryModeValues.has(mode.value));
  const primaryTools = tools.filter((tool) => primaryToolValues.has(tool.value));
  const secondaryTools = tools.filter((tool) => !primaryToolValues.has(tool.value));
  const activeSecondaryMode = secondaryModes.find((mode) => mode.value === editorMode);
  const activeSecondaryTool = secondaryTools.find((tool) => tool.value === activeTool);

  useEffect(() => {
    boot();
  }, [boot]);

  useEffect(() => {
    document.documentElement.dataset.theme = 'ember';
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

    return null;
  }, [activeTool, setToolSettings, toolSettings.corridorWidth, toolSettings.markerPreset, toolSettings.roomPlacement, toolSettings.roomType, toolSettings.transitionType]);

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
        <div className="command-bar__brand">
          <div className="command-bar__logo">WA</div>
          <div>
            <strong>Wayfinder Atelier</strong>
            <small>{project.name}</small>
          </div>
        </div>

        <div className="command-bar__workspace">
          <label className="command-bar__search">
            <span>Search</span>
            <input
              data-testid="top-search"
              placeholder="Search maps, notes, rooms, and doors"
              value={search.query}
              onChange={(event) => setSearchQuery(event.target.value)}
            />
          </label>
          <div className="command-bar__summary">
            <span className="section-eyebrow">Active Map</span>
            <strong>{map.name}</strong>
            <small>{project.maps.length} maps loaded in this atlas</small>
          </div>
        </div>

        <div className="command-bar__actions">
          <div className="command-bar__cluster">
            <GhostButton aria-label="Open command palette" data-testid="open-command-palette" onClick={() => setCommandPaletteOpen(true)}>Command</GhostButton>
            <GhostButton aria-label="Undo" onClick={undo}>Undo</GhostButton>
            <GhostButton aria-label="Redo" onClick={redo}>Redo</GhostButton>
            <GhostButton aria-label="Toggle bottom drawer" onClick={() => toggleSidebar('bottom')}>Drawer</GhostButton>
          </div>
          <div className="command-bar__cluster">
            <ActionMenu label="Workspace">
              <ActionMenuButton label="Back" onClick={navigateBack} />
              <ActionMenuButton label="Forward" onClick={navigateForward} />
              <ActionMenuButton label={showLeftSidebar ? 'Hide Explorer' : 'Show Explorer'} onClick={() => toggleSidebar('left')} />
              <ActionMenuButton label={showRightSidebar ? 'Hide Inspector' : 'Show Inspector'} onClick={() => toggleSidebar('right')} />
            </ActionMenu>
            <ActionMenu label="File">
              <ActionMenuButton label="Import Project" onClick={() => importInputRef.current?.click()} />
              <ActionMenuButton label="Export JSON" onClick={exportProjectJson} />
              <ActionMenuButton label="Export PNG" onClick={exportMapPng} />
              <ActionMenuButton label="Export PDF" onClick={() => void exportMapPdf()} />
            </ActionMenu>
            <Button aria-label="Mark current map reviewed" onClick={markActiveMapReviewed}>Review Done</Button>
          </div>
          <BadgeState saveState={saveState} />
        </div>
      </header>

      <div className={`workspace-shell ${showLeftSidebar ? 'has-left' : ''} ${showRightSidebar ? 'has-right' : ''}`}>
        {showLeftSidebar ? (
          <LeftSidebar
            onCreateMap={createMap}
            onCreateSnapshot={() => createSnapshot('Manual snapshot')}
            project={project}
            reviewItems={reviewItems}
            stats={stats}
          />
        ) : null}

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

          <div className="editor-toolbar" data-testid="tool-rail">
            <div className="editor-toolbar__section">
              <span className="section-eyebrow">Mode</span>
              <div className="editor-toolbar__chips">
                {primaryModes.map((mode) => (
                  <button
                    key={mode.value}
                    className={`editor-toolbar__chip ${editorMode === mode.value ? 'is-active' : ''}`}
                    data-testid={`mode-${mode.value}`}
                    onClick={() => setEditorMode(mode.value)}
                    type="button"
                  >
                    <span className="editor-toolbar__glyph"><RailIcon kind={mode.icon} /></span>
                    <span>{mode.label}</span>
                  </button>
                ))}
                {secondaryModes.length ? (
                  <ActionMenu
                    active={Boolean(activeSecondaryMode)}
                    className="editor-toolbar__menu"
                    iconKind={activeSecondaryMode?.icon ?? 'more'}
                    label={activeSecondaryMode?.label ?? 'More'}
                  >
                    {secondaryModes.map((mode) => (
                      <ActionMenuButton
                        icon={<RailIcon kind={mode.icon} />}
                        key={mode.value}
                        label={mode.label}
                        onClick={() => setEditorMode(mode.value)}
                      />
                    ))}
                  </ActionMenu>
                ) : null}
              </div>
            </div>

            <div className="editor-toolbar__section editor-toolbar__section--tools">
              <span className="section-eyebrow">Tools</span>
              <div className="editor-toolbar__chips">
                {primaryTools.map((tool) => (
                  <button
                    key={tool.value}
                    className={`editor-toolbar__chip ${activeTool === tool.value ? 'is-active' : ''}`}
                    data-testid={`tool-${tool.value}`}
                    onClick={() => setActiveTool(tool.value)}
                    type="button"
                  >
                    <span className="editor-toolbar__glyph"><RailIcon kind={tool.icon} /></span>
                    <span>{tool.label}</span>
                  </button>
                ))}
                {secondaryTools.length ? (
                  <ActionMenu
                    active={Boolean(activeSecondaryTool)}
                    className="editor-toolbar__menu"
                    iconKind={activeSecondaryTool?.icon ?? 'more'}
                    label={activeSecondaryTool?.label ?? 'More'}
                  >
                    {secondaryTools.map((tool) => (
                      <ActionMenuButton
                        icon={<RailIcon kind={tool.icon} />}
                        key={tool.value}
                        label={tool.label}
                        onClick={() => setActiveTool(tool.value)}
                      />
                    ))}
                  </ActionMenu>
                ) : null}
              </div>
            </div>
          </div>

          {toolContext ? <div className="editor-strip">{toolContext}</div> : null}

          <MapCanvas ref={canvasRef} map={map} project={project} />

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

        {showRightSidebar ? <RightSidebar map={map} project={project} /> : null}
      </div>

      <CommandPalette project={project} />
      <IconPickerModal map={map} project={project} />
      <OnboardingModal />
    </div>
  );
}

function ActionMenu({
  label,
  children,
  active = false,
  className = '',
  iconKind,
}: {
  label: string;
  children: ReactNode;
  active?: boolean;
  className?: string;
  iconKind?: string;
}) {
  return (
    <details className={`menu-dropdown ${className} ${active ? 'is-active' : ''}`}>
      <summary className="menu-dropdown__trigger">
        {iconKind ? <span className="editor-toolbar__glyph"><RailIcon kind={iconKind} /></span> : null}
        <span>{label}</span>
      </summary>
      <div className="menu-dropdown__panel">{children}</div>
    </details>
  );
}

function ActionMenuButton({
  label,
  onClick,
  icon,
}: {
  label: string;
  onClick: () => void;
  icon?: ReactNode;
}) {
  return (
    <button
      className="menu-dropdown__item"
      onClick={(event) => {
        onClick();
        const details = event.currentTarget.closest('details');
        if (details instanceof HTMLDetailsElement) details.open = false;
      }}
      type="button"
    >
      {icon ? <span className="menu-dropdown__item-icon">{icon}</span> : null}
      <span>{label}</span>
    </button>
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
