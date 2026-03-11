import { useMemo, useRef, useState, type ChangeEvent, type PropsWithChildren } from 'react';

import { SvgMapIcon, builtInIconLibrary } from '../../data/iconLibrary';
import { findDoorPairSuggestions } from '../../lib/pathfinding';
import { makeId } from '../../lib/utils';
import type {
  DoorwayRecord,
  FloorRoom,
  MapRecord,
  MarkerRecord,
  NoteRecord,
  ProjectRecord,
  TransitionRecord,
} from '../../models/types';
import { DEFAULT_GENERATOR_PARAMS, type GeneratorParams } from '../../models/tilemap';
import { useAppStore } from '../../store/useAppStore';
import {
  Badge,
  Button,
  EmptyState,
  GhostButton,
  Panel,
  SectionTitle,
  SelectField,
  TextField,
  TextareaField,
} from '../ui/primitives';

const readFileAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

function InspectorGroup({ title, children, defaultOpen = true }: PropsWithChildren<{ title: string; defaultOpen?: boolean }>) {
  return (
    <details className="inspector-group" open={defaultOpen}>
      <summary>{title}</summary>
      <div className="inspector-group__body">{children}</div>
    </details>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="toggle-row">
      <span>{label}</span>
      <input checked={checked} onChange={(event) => onChange(event.target.checked)} type="checkbox" />
    </label>
  );
}

export function RightSidebar({
  project,
  map,
}: {
  project: ProjectRecord;
  map: MapRecord;
}) {
  const selection = useAppStore((state) => state.selection);
  const inspectorTab = useAppStore((state) => state.inspectorTab);
  const setInspectorTab = useAppStore((state) => state.setInspectorTab);
  const updateEntity = useAppStore((state) => state.updateEntity);
  const updateProjectMeta = useAppStore((state) => state.updateProjectMeta);
  const updateActiveMapMeta = useAppStore((state) => state.updateActiveMapMeta);
  const updateMapView = useAppStore((state) => state.updateMapView);
  const pairTransitions = useAppStore((state) => state.pairTransitions);
  const toggleLayer = useAppStore((state) => state.toggleLayer);
  const setIconPickerOpen = useAppStore((state) => state.setIconPickerOpen);
  const restartOnboarding = useAppStore((state) => state.restartOnboarding);
  const seedTutorialLinkTarget = useAppStore((state) => state.seedTutorialLinkTarget);
  const generateDungeon = useAppStore((state) => state.generateDungeon);
  const backgroundInputRef = useRef<HTMLInputElement | null>(null);
  const [genParams, setGenParams] = useState<Partial<GeneratorParams>>({
    seed: DEFAULT_GENERATOR_PARAMS.seed,
    algorithm: DEFAULT_GENERATOR_PARAMS.algorithm,
    roomCountMin: DEFAULT_GENERATOR_PARAMS.roomCountMin,
    roomCountMax: DEFAULT_GENERATOR_PARAMS.roomCountMax,
    corridorWidth: DEFAULT_GENERATOR_PARAMS.corridorWidth,
  });

  const selectedId = selection.ids[0];
  const selectedRoom: FloorRoom | undefined =
    selection.kind === 'floor_room' ? map.floorRooms.find((entry) => entry.id === selectedId) : undefined;
  const selectedCorridor =
    selection.kind === 'corridor' ? map.corridors.find((entry) => entry.id === selectedId) : undefined;
  const selectedMarker: MarkerRecord | undefined =
    selection.kind === 'marker' ? map.markers.find((entry) => entry.id === selectedId) : undefined;
  const selectedTransition: TransitionRecord | undefined =
    selection.kind === 'transition' ? map.transitions.find((entry) => entry.id === selectedId) : undefined;
  const selectedDoorway: DoorwayRecord | undefined =
    selection.kind === 'doorway' ? map.doorways.find((entry) => entry.id === selectedId) : undefined;
  const selectedRoute =
    selection.kind === 'route' ? map.routeOverlays.find((entry) => entry.id === selectedId) : undefined;
  const selectedNote: NoteRecord | undefined =
    selection.kind === 'note' ? map.notesBoard.find((entry) => entry.id === selectedId) : undefined;
  const linkedDoorTransition =
    selectedDoorway?.transitionId ? map.transitions.find((entry) => entry.id === selectedDoorway.transitionId) : undefined;
  const activeTransition = selectedTransition ?? linkedDoorTransition;
  const pairSuggestions = activeTransition ? findDoorPairSuggestions(project, activeTransition) : [];

  const matchingIcons = useMemo(() => builtInIconLibrary.slice(0, 18), []);

  const onUploadBackground = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const src = await readFileAsDataUrl(file);
    updateActiveMapMeta({
      background: {
        id: makeId('bg'),
        name: file.name,
        src,
        opacity: 0.44,
        locked: false,
      },
    });
    event.target.value = '';
  };

  return (
    <aside className="right-sidebar" data-hotkey-scope="editor-form" data-testid="inspector-sidebar">
      <Panel>
        <div className="inspector-tabs" role="tablist" aria-label="Inspector tabs">
          {[
            ['selection', 'Selection'],
            ['map', 'Map'],
          ].map(([value, label]) => (
            <button
              key={value}
              className={inspectorTab === value ? 'is-active' : ''}
              data-testid={`inspector-tab-${value}`}
              onClick={() => setInspectorTab(value as typeof inspectorTab)}
              type="button"
            >
              {label}
            </button>
          ))}
          <details className={`menu-dropdown inspector-tabs__advanced ${
            ['layers', 'links', 'notes', 'help'].includes(inspectorTab) ? 'is-active' : ''
          }`}>
            <summary className="menu-dropdown__trigger">
              <span>Advanced</span>
            </summary>
            <div className="menu-dropdown__panel">
              {[
                ['layers', 'Layers'],
                ['links', 'Links'],
                ['notes', 'Notes'],
                ['help', 'Help'],
              ].map(([value, label]) => (
                <button
                  key={value}
                  className="menu-dropdown__item"
                  onClick={(event) => {
                    setInspectorTab(value as typeof inspectorTab);
                    const details = event.currentTarget.closest('details');
                    if (details instanceof HTMLDetailsElement) details.open = false;
                  }}
                  type="button"
                >
                  <span>{label}</span>
                </button>
              ))}
            </div>
          </details>
        </div>
      </Panel>

      {inspectorTab === 'selection' ? (
        <>
          {selectedRoom ? (
            <Panel>
              <SectionTitle eyebrow="Selection" title={selectedRoom.label} />
              <InspectorGroup title="Identity">
                <TextField
                  data-testid="selection-room-label"
                  label="Room Name"
                  value={selectedRoom.label}
                  onChange={(event) => updateEntity('floor_room', selectedRoom.id, { label: event.target.value })}
                />
                <TextField
                  label="Subtitle"
                  value={selectedRoom.subtitle ?? ''}
                  onChange={(event) => updateEntity('floor_room', selectedRoom.id, { subtitle: event.target.value })}
                />
                <SelectField
                  label="Room Type"
                  value={selectedRoom.roomType}
                  onChange={(event) => updateEntity('floor_room', selectedRoom.id, { roomType: event.target.value })}
                >
                  {['hall', 'chamber', 'junction', 'loot', 'secret', 'safe', 'stairs', 'boss'].map((value) => (
                    <option key={value} value={value}>{value}</option>
                  ))}
                </SelectField>
              </InspectorGroup>
              <InspectorGroup title="Geometry">
                <div className="field-row">
                  <TextField
                    label="Width"
                    type="number"
                    value={String(selectedRoom.bounds.width)}
                    onChange={(event) =>
                      updateEntity('floor_room', selectedRoom.id, {
                        bounds: { ...selectedRoom.bounds, width: Number(event.target.value) || selectedRoom.bounds.width },
                      })
                    }
                  />
                  <TextField
                    label="Height"
                    type="number"
                    value={String(selectedRoom.bounds.height)}
                    onChange={(event) =>
                      updateEntity('floor_room', selectedRoom.id, {
                        bounds: { ...selectedRoom.bounds, height: Number(event.target.value) || selectedRoom.bounds.height },
                      })
                    }
                  />
                </div>
              </InspectorGroup>
              <InspectorGroup title="State">
                <div className="field-row">
                  <TextField
                    label="Danger"
                    type="number"
                    value={String(selectedRoom.dangerLevel)}
                    onChange={(event) => updateEntity('floor_room', selectedRoom.id, { dangerLevel: Number(event.target.value) || 0 })}
                  />
                  <TextField
                    label="Loot"
                    type="number"
                    value={String(selectedRoom.lootCount)}
                    onChange={(event) => updateEntity('floor_room', selectedRoom.id, { lootCount: Number(event.target.value) || 0 })}
                  />
                </div>
              </InspectorGroup>
            </Panel>
          ) : null}

          {selectedCorridor ? (
            <Panel>
              <SectionTitle eyebrow="Selection" title={selectedCorridor.label || 'Corridor'} />
              <InspectorGroup title="Corridor">
                <TextField
                  label="Label"
                  value={selectedCorridor.label ?? ''}
                  onChange={(event) => updateEntity('corridor', selectedCorridor.id, { label: event.target.value })}
                />
                <div className="field-row">
                  <TextField
                    label="Width"
                    type="number"
                    value={String(selectedCorridor.width)}
                    onChange={(event) => updateEntity('corridor', selectedCorridor.id, { width: Number(event.target.value) || 72 })}
                  />
                  <TextField
                    label="State"
                    value={selectedCorridor.state}
                    onChange={(event) => updateEntity('corridor', selectedCorridor.id, { state: event.target.value })}
                  />
                </div>
              </InspectorGroup>
            </Panel>
          ) : null}

          {selectedDoorway || activeTransition ? (
            <Panel>
              <SectionTitle eyebrow="Selection" title={(selectedDoorway ?? activeTransition)?.label ?? 'Transition'} />
              {selectedDoorway ? (
                <InspectorGroup title="Doorway">
                  <TextField
                    label="Label"
                    value={selectedDoorway.label}
                    onChange={(event) => updateEntity('doorway', selectedDoorway.id, { label: event.target.value })}
                  />
                  <div className="field-row">
                    <TextField
                      label="Orientation"
                      value={selectedDoorway.orientation}
                      onChange={(event) => updateEntity('doorway', selectedDoorway.id, { orientation: event.target.value })}
                    />
                    <TextField
                      label="State"
                      value={selectedDoorway.doorwayState}
                      onChange={(event) => updateEntity('doorway', selectedDoorway.id, { doorwayState: event.target.value })}
                    />
                  </div>
                </InspectorGroup>
              ) : null}
              {activeTransition ? (
                <InspectorGroup title="Transition">
                  <TextField
                    label="Transition"
                    value={activeTransition.label}
                    onChange={(event) => updateEntity('transition', activeTransition.id, { label: event.target.value })}
                  />
                  <div className="field-row">
                    <TextField
                      label="Type"
                      value={activeTransition.transitionType}
                      onChange={(event) => updateEntity('transition', activeTransition.id, { transitionType: event.target.value })}
                    />
                    <TextField
                      label="State"
                      value={activeTransition.transitionState}
                      onChange={(event) => updateEntity('transition', activeTransition.id, { transitionState: event.target.value })}
                    />
                  </div>
                </InspectorGroup>
              ) : null}
            </Panel>
          ) : null}

          {selectedMarker ? (
            <>
              <Panel>
                <SectionTitle eyebrow="Selection" title={selectedMarker.label} />
                <InspectorGroup title="Marker">
                  <TextField
                    label="Label"
                    value={selectedMarker.label}
                    onChange={(event) => updateEntity('marker', selectedMarker.id, { label: event.target.value })}
                  />
                  <div className="field-row">
                    <TextField
                      label="Color"
                      value={selectedMarker.color}
                      onChange={(event) => updateEntity('marker', selectedMarker.id, { color: event.target.value })}
                    />
                    <TextField
                      label="Size"
                      type="number"
                      value={String(selectedMarker.size)}
                      onChange={(event) => updateEntity('marker', selectedMarker.id, { size: Number(event.target.value) || 22 })}
                    />
                  </div>
                  <TextField
                    label="Marker Type"
                    value={selectedMarker.markerType}
                    onChange={(event) => updateEntity('marker', selectedMarker.id, { markerType: event.target.value })}
                  />
                  <GhostButton onClick={() => setIconPickerOpen(true)}>Open Library</GhostButton>
                </InspectorGroup>
              </Panel>
              <Panel>
                <SectionTitle eyebrow="Quick Icons" title="Swap Symbol" />
                <div className="icon-grid">
                  {matchingIcons.map((icon) => (
                    <button
                      key={icon.id}
                      className={`icon-grid__item ${selectedMarker.iconId === icon.id ? 'is-active' : ''}`}
                      onClick={() => updateEntity('marker', selectedMarker.id, { iconId: icon.id })}
                      type="button"
                    >
                      <SvgMapIcon iconId={icon.id} size={20} />
                      <span>{icon.label}</span>
                    </button>
                  ))}
                </div>
              </Panel>
            </>
          ) : null}

          {selectedRoute ? (
            <Panel>
              <SectionTitle eyebrow="Selection" title={selectedRoute.label ?? 'Route Overlay'} />
              <InspectorGroup title="Route">
                <TextField
                  label="Label"
                  value={selectedRoute.label ?? ''}
                  onChange={(event) => updateEntity('route', selectedRoute.id, { label: event.target.value })}
                />
                <div className="field-row">
                  <TextField
                    label="State"
                    value={selectedRoute.state}
                    onChange={(event) => updateEntity('route', selectedRoute.id, { state: event.target.value })}
                  />
                  <TextField
                    label="Opacity"
                    type="number"
                    value={String(selectedRoute.opacity)}
                    onChange={(event) => updateEntity('route', selectedRoute.id, { opacity: Number(event.target.value) || 0.85 })}
                  />
                </div>
              </InspectorGroup>
            </Panel>
          ) : null}

          {selectedNote ? (
            <Panel>
              <SectionTitle eyebrow="Selection" title={selectedNote.title} />
              <InspectorGroup title="Sticky Note">
                <TextField
                  label="Title"
                  value={selectedNote.title}
                  onChange={(event) => updateEntity('note', selectedNote.id, { title: event.target.value })}
                />
                <TextareaField
                  label="Body"
                  rows={6}
                  value={selectedNote.body}
                  onChange={(event) => updateEntity('note', selectedNote.id, { body: event.target.value })}
                />
                <TextField
                  label="Priority"
                  value={selectedNote.priority}
                  onChange={(event) => updateEntity('note', selectedNote.id, { priority: event.target.value })}
                />
              </InspectorGroup>
            </Panel>
          ) : null}

          {!selectedRoom && !selectedCorridor && !selectedDoorway && !selectedMarker && !selectedNote && !activeTransition && !selectedRoute ? (
            <Panel>
              <EmptyState title="Nothing selected" subtitle="Pick a room, corridor, doorway, route, note, or marker to inspect it here." />
            </Panel>
          ) : null}
        </>
      ) : null}

      {inspectorTab === 'map' ? (
        <>
          <Panel>
            <SectionTitle eyebrow="Map" title="Map Settings" />
            <InspectorGroup title="Metadata">
              <TextField data-testid="map-name-field" label="Map Name" value={map.name} onChange={(event) => updateActiveMapMeta({ name: event.target.value })} />
              <TextField label="Subtitle" value={map.subtitle ?? ''} onChange={(event) => updateActiveMapMeta({ subtitle: event.target.value })} />
              <TextField label="Region" value={map.region} onChange={(event) => updateActiveMapMeta({ region: event.target.value })} />
              <div className="field-row">
                <TextField label="Floor" value={map.floor} onChange={(event) => updateActiveMapMeta({ floor: event.target.value })} />
                <TextField label="Accent" value={map.accent} onChange={(event) => updateActiveMapMeta({ accent: event.target.value })} />
              </div>
            </InspectorGroup>
            <InspectorGroup title="View Defaults">
              <SelectField label="Render Mode" value={map.view.renderMode} onChange={(event) => updateMapView({ renderMode: event.target.value as typeof map.view.renderMode })}>
                <option value="editor_2d">2D Editor</option>
                <option value="preview_3d">3D Preview</option>
              </SelectField>
              <div className="field-row">
                <TextField
                  data-testid="map-grid-size-field"
                  label="Grid Size"
                  type="number"
                  value={String(map.view.gridSize)}
                  onChange={(event) => updateMapView({ gridSize: Number(event.target.value) || 48 })}
                />
                <SelectField label="Surface" value={map.view.floorSurfaceStyle} onChange={(event) => updateMapView({ floorSurfaceStyle: event.target.value as typeof map.view.floorSurfaceStyle })}>
                  <option value="stonekeep">Stonekeep</option>
                  <option value="parchment_blueprint">Parchment Blueprint</option>
                  <option value="pixel_dungeon">Pixel Dungeon</option>
                </SelectField>
              </div>
              <div className="field-row">
                <SelectField label="Wall Style" value={map.view.wallStyle} onChange={(event) => updateMapView({ wallStyle: event.target.value as typeof map.view.wallStyle })}>
                  <option value="stone">Stone</option>
                  <option value="brick">Brick</option>
                  <option value="ruin">Ruin</option>
                </SelectField>
                <SelectField label="Lighting" value={map.view.lightPreset} onChange={(event) => updateMapView({ lightPreset: event.target.value as typeof map.view.lightPreset })}>
                  <option value="torch">Torch</option>
                  <option value="moonlit">Moonlit</option>
                  <option value="neutral">Neutral</option>
                </SelectField>
              </div>
              <div className="field-row">
                <SelectField label="Overlay Preset" value={map.view.overlayPreset} onChange={(event) => updateMapView({ overlayPreset: event.target.value as typeof map.view.overlayPreset })}>
                  <option value="all">All</option>
                  <option value="exploration">Exploration</option>
                  <option value="links">Links</option>
                </SelectField>
              </div>
              <ToggleRow label="Snap to grid" checked={map.view.snapToGrid} onChange={(checked) => updateMapView({ snapToGrid: checked })} />
              <ToggleRow label="Show grid" checked={map.view.showGrid} onChange={(checked) => updateMapView({ showGrid: checked })} />
              <ToggleRow label="Show minimap" checked={map.view.showMinimap} onChange={(checked) => updateMapView({ showMinimap: checked })} />
              <ToggleRow label="Show tool hints" checked={map.view.showToolHints} onChange={(checked) => updateMapView({ showToolHints: checked })} />
              <ToggleRow label="Show door labels" checked={map.view.showDoorLabels} onChange={(checked) => updateMapView({ showDoorLabels: checked })} />
            </InspectorGroup>
            <InspectorGroup title="Tracing Surface">
              <TextareaField label="Map Notes" rows={5} value={map.notes ?? ''} onChange={(event) => updateActiveMapMeta({ notes: event.target.value })} />
              <div className="project-card__actions">
                <GhostButton onClick={() => backgroundInputRef.current?.click()}>
                  {map.background ? 'Replace Background' : 'Import Background'}
                </GhostButton>
                {map.background ? <Button onClick={() => updateActiveMapMeta({ background: undefined })}>Clear</Button> : null}
              </div>
              <input ref={backgroundInputRef} accept="image/*" hidden type="file" onChange={onUploadBackground} />
            </InspectorGroup>
          </Panel>

          <Panel>
            <SectionTitle eyebrow="Project" title="Atlas Settings" />
            <InspectorGroup title="Project Metadata">
              <TextField label="Project Name" value={project.name} onChange={(event) => updateProjectMeta({ name: event.target.value })} />
              <TextField label="Game Title" value={project.gameTitle ?? ''} onChange={(event) => updateProjectMeta({ gameTitle: event.target.value })} />
              <TextareaField label="Playthrough Notes" rows={4} value={project.playthroughNotes ?? ''} onChange={(event) => updateProjectMeta({ playthroughNotes: event.target.value })} />
            </InspectorGroup>
          </Panel>

          <Panel>
            <SectionTitle eyebrow="Generator" title="Dungeon Generator" />
            <InspectorGroup title="Parameters">
              <TextField
                label="Seed"
                placeholder="Leave blank for random"
                value={genParams.seed ?? ''}
                onChange={(event) => setGenParams((prev) => ({ ...prev, seed: event.target.value }))}
              />
              <SelectField
                label="Algorithm"
                value={genParams.algorithm ?? 'feature_growth'}
                onChange={(event) => setGenParams((prev) => ({ ...prev, algorithm: event.target.value as GeneratorParams['algorithm'] }))}
              >
                <option value="feature_growth">Feature Growth</option>
                <option value="grid_rooms">Grid Rooms</option>
                <option value="bsp">BSP</option>
              </SelectField>
              <div className="field-row">
                <TextField
                  label="Room Min"
                  type="number"
                  value={String(genParams.roomCountMin ?? DEFAULT_GENERATOR_PARAMS.roomCountMin)}
                  onChange={(event) => setGenParams((prev) => ({ ...prev, roomCountMin: Number(event.target.value) || 1 }))}
                />
                <TextField
                  label="Room Max"
                  type="number"
                  value={String(genParams.roomCountMax ?? DEFAULT_GENERATOR_PARAMS.roomCountMax)}
                  onChange={(event) => setGenParams((prev) => ({ ...prev, roomCountMax: Number(event.target.value) || 1 }))}
                />
              </div>
              <TextField
                label="Corridor Width"
                type="number"
                value={String(genParams.corridorWidth ?? DEFAULT_GENERATOR_PARAMS.corridorWidth)}
                onChange={(event) => setGenParams((prev) => ({ ...prev, corridorWidth: Number(event.target.value) || 1 }))}
              />
            </InspectorGroup>
            <Button
              data-testid="generate-dungeon-sidebar"
              onClick={() => generateDungeon(genParams)}
              style={{ width: '100%', background: 'var(--crimson)', color: 'var(--bone)', marginTop: 8 }}
            >
              Generate
            </Button>
          </Panel>
        </>
      ) : null}

      {inspectorTab === 'layers' ? (
        <Panel>
          <SectionTitle eyebrow="Layers" title="Visibility and Locking" />
          <div className="layer-list">
            {map.layers.map((layer) => (
              <div className="layer-row" key={layer.id}>
                <div>
                  <strong>{layer.name}</strong>
                  <small>{layer.type}</small>
                </div>
                <div className="layer-row__actions">
                  <button onClick={() => toggleLayer(layer.id, 'visible')} type="button">
                    {layer.visible ? 'Hide' : 'Show'}
                  </button>
                  <button onClick={() => toggleLayer(layer.id, 'locked')} type="button">
                    {layer.locked ? 'Unlock' : 'Lock'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      ) : null}

      {inspectorTab === 'links' ? (
        <Panel>
          <SectionTitle eyebrow="Links" title={activeTransition ? activeTransition.label : 'Transition Linking'} />
          {activeTransition ? (
            <>
              <InspectorGroup title="Selected Transition">
                <TextField
                  label="Transition Label"
                  value={activeTransition.label}
                  onChange={(event) => updateEntity('transition', activeTransition.id, { label: event.target.value })}
                />
                <TextField
                  label="Destination Map Id"
                  value={activeTransition.destinationMapId ?? ''}
                  onChange={(event) => updateEntity('transition', activeTransition.id, { destinationMapId: event.target.value || undefined })}
                />
                <ToggleRow label="One-way" checked={activeTransition.oneWay} onChange={(checked) => updateEntity('transition', activeTransition.id, { oneWay: checked })} />
              </InspectorGroup>

              <InspectorGroup title="Pair Suggestions">
                <div className="project-card__actions">
                  <GhostButton data-testid="seed-tutorial-link-button" onClick={seedTutorialLinkTarget}>Create Tutorial Destination</GhostButton>
                </div>
                {pairSuggestions.length ? (
                  <div className="suggestion-list">
                    {pairSuggestions.map((candidate) => (
                      <button
                        key={candidate.transition.id}
                        className="suggestion-item"
                        data-testid={`pair-transition-${candidate.transition.id}`}
                        onClick={() => pairTransitions(activeTransition.id, candidate.transition.id)}
                        type="button"
                      >
                        <span>{candidate.transition.label}</span>
                        <small>{candidate.mapName}</small>
                      </button>
                    ))}
                  </div>
                ) : (
                  <EmptyState title="No strong matches yet" subtitle="Seed a tutorial destination or add another doorway on a different map to pair this exit." />
                )}
              </InspectorGroup>
            </>
          ) : (
            <EmptyState title="Pick a doorway" subtitle="Select a linked doorway or transition to pair it with another map exit." />
          )}
        </Panel>
      ) : null}

      {inspectorTab === 'notes' ? (
        <Panel>
          <SectionTitle eyebrow="Notes" title="Pinned Notes" />
          <div className="activity-list">
            {map.notesBoard.length ? (
              map.notesBoard.map((entry) => (
                <article className="activity-row" key={entry.id}>
                  <div>
                    <strong>{entry.title}</strong>
                    <p>{entry.body}</p>
                  </div>
                  <Badge>{entry.priority}</Badge>
                </article>
              ))
            ) : (
              <EmptyState title="No notes yet" subtitle="Drop sticky notes on the canvas to build a route journal." />
            )}
          </div>
        </Panel>
      ) : null}

      {inspectorTab === 'help' ? (
        <Panel>
          <SectionTitle eyebrow="Help" title="Guided Tutorial and Shortcuts" />
          <div className="help-list">
            <div><strong>1.</strong><p>`R` room, `C` corridor, `D` doorway, `N` note, `M` overlay, `P` route, `K` sketch, `Delete` erase selected.</p></div>
            <div><strong>2.</strong><p>`1-6` swap modes, `Ctrl/Cmd+K` opens the command palette, `Ctrl/Cmd+D` duplicates the current selection.</p></div>
            <div><strong>3.</strong><p>`G` toggles the grid, `F` resets the view, and the canvas controls provide persistent fit/zoom buttons.</p></div>
            <div><strong>4.</strong><p>Use the Links tab to pair doors across maps, then switch to Navigate mode to travel through them safely.</p></div>
          </div>
          <div className="project-card__actions">
            <Button data-testid="restart-tutorial-button-sidebar" onClick={restartOnboarding}>Restart Tutorial</Button>
          </div>
        </Panel>
      ) : null}
    </aside>
  );
}
