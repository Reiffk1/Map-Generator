import { useEffect, useMemo, useRef, useState, type ChangeEvent, type PropsWithChildren } from 'react';

import { SvgMapIcon, builtInIconLibrary } from '../../data/iconLibrary';
import { getBestTileForRoleOrFallback, loadAssetPack } from '../../lib/assets/assetPacks';
import { assetCatalog, findAsset, getTileRoleForAsset, searchAssets } from '../../lib/assets/catalog';
import { getRoomBounds, roomHasIrregularFootprint } from '../../lib/floorplan';
import { formatHotkeyHelp } from '../../lib/hotkeys';
import { findDoorPairSuggestions } from '../../lib/pathfinding';
import { makeId } from '../../lib/utils';
import type {
  DoorwayRecord,
  FloorRoom,
  MapRecord,
  MarkerRecord,
  NoteRecord,
  PropRecord,
  ProjectRecord,
  TransitionRecord,
} from '../../models/types';
import { DEFAULT_GENERATOR_PARAMS, type GeneratorParams, type LoadedAssetPack } from '../../models/tilemap';
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
  const toolSettings = useAppStore((state) => state.toolSettings);
  const inspectorTab = useAppStore((state) => state.inspectorTab);
  const setInspectorTab = useAppStore((state) => state.setInspectorTab);
  const updateEntity = useAppStore((state) => state.updateEntity);
  const updateProjectMeta = useAppStore((state) => state.updateProjectMeta);
  const updateActiveMapMeta = useAppStore((state) => state.updateActiveMapMeta);
  const updateMapView = useAppStore((state) => state.updateMapView);
  const pairTransitions = useAppStore((state) => state.pairTransitions);
  const toggleLayer = useAppStore((state) => state.toggleLayer);
  const toggleAssetFavorite = useAppStore((state) => state.toggleAssetFavorite);
  const setIconPickerOpen = useAppStore((state) => state.setIconPickerOpen);
  const setActiveTool = useAppStore((state) => state.setActiveTool);
  const setToolSettings = useAppStore((state) => state.setToolSettings);
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
  const [assetFamilyFilter, setAssetFamilyFilter] = useState<'all' | (typeof assetCatalog)[number]['family']>('all');
  const [assetSearch, setAssetSearch] = useState('');
  const [assetPack, setAssetPack] = useState<LoadedAssetPack | null>(null);

  const selectedId = selection.ids[0];
  const selectedRoom: FloorRoom | undefined =
    selection.kind === 'floor_room' ? map.floorRooms.find((entry) => entry.id === selectedId) : undefined;
  const selectedCorridor =
    selection.kind === 'corridor' ? map.corridors.find((entry) => entry.id === selectedId) : undefined;
  const selectedMarker: MarkerRecord | undefined =
    selection.kind === 'marker' ? map.markers.find((entry) => entry.id === selectedId) : undefined;
  const selectedProp: PropRecord | undefined =
    selection.kind === 'prop' ? map.props.find((entry) => entry.id === selectedId) : undefined;
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
  const assetFamilies = ['all', ...new Set(assetCatalog.map((asset) => asset.family))] as const;
  const assetResults = useMemo(() => {
    const results = searchAssets(assetSearch, assetFamilyFilter === 'all' ? undefined : assetFamilyFilter);
    return [...results].sort((a, b) => {
      const aFav = project.assetFavorites.includes(a.id) ? 1 : 0;
      const bFav = project.assetFavorites.includes(b.id) ? 1 : 0;
      if (aFav !== bFav) return bFav - aFav;
      return a.label.localeCompare(b.label);
    });
  }, [assetFamilyFilter, assetSearch, project.assetFavorites]);
  const selectedAssetId =
    selection.kind === 'prop'
      ? selectedProp?.assetId
      : selection.kind === 'doorway'
        ? selectedDoorway?.doorStyleId
        : undefined;

  const matchingIcons = useMemo(() => builtInIconLibrary.slice(0, 18), []);

  useEffect(() => {
    let cancelled = false;
    loadAssetPack(map.view.assetPackId)
      .then((pack) => {
        if (!cancelled) setAssetPack(pack);
      })
      .catch(() => {
        if (!cancelled) setAssetPack(null);
      });
    return () => {
      cancelled = true;
    };
  }, [map.view.assetPackId]);

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

  const armAssetPlacement = (assetId: string) => {
    const asset = findAsset(assetId);
    if (!asset) return;
    if (asset.family === 'door' || asset.family === 'gate') {
      setActiveTool('doorway');
      setToolSettings({ doorStyleId: asset.id });
      setInspectorTab('links');
      return;
    }
    setActiveTool('prop');
    setToolSettings({ propAssetId: asset.id });
    setInspectorTab('assets');
  };

  const getAssetCompatibility = (assetId: string) => {
    const asset = findAsset(assetId);
    if (!asset) return { tileOk: false, threeOk: false };
    const tileRole = getTileRoleForAsset(assetId, asset.states[0]?.state);
    const tileOk = Boolean(assetPack && tileRole && getBestTileForRoleOrFallback(assetPack, tileRole));
    const threeOk = Boolean(asset.prefab3d || asset.states.some((entry) => entry.prefab3d));
    return { tileOk, threeOk };
  };

  return (
    <aside className="right-sidebar" data-hotkey-scope="editor-form" data-testid="inspector-sidebar">
      <Panel>
        <div className="inspector-tabs" role="tablist" aria-label="Inspector tabs">
          {[
            ['selection', 'Selection'],
            ['assets', 'Assets'],
            ['map', 'Map'],
            ['layers', 'Layers'],
            ['links', 'Links'],
            ['notes', 'Notes'],
            ['help', 'Help'],
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
        </div>
      </Panel>

      {inspectorTab === 'selection' ? (
        <>
          {selectedRoom ? (
            (() => {
              const roomBounds = getRoomBounds(selectedRoom);
              const irregularRoom = roomHasIrregularFootprint(selectedRoom);
              return (
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
                    {irregularRoom ? (
                      <>
                        <TextField label="Bounding Width" type="number" value={String(roomBounds.width)} disabled />
                        <TextField label="Bounding Height" type="number" value={String(roomBounds.height)} disabled />
                        <p className="inspector-note">
                          This room uses a compound footprint. Resize it from the canvas by extending or reshaping the room rather than editing a single box.
                        </p>
                      </>
                    ) : (
                      <div className="field-row">
                        <TextField
                          label="Width"
                          type="number"
                          value={String(roomBounds.width)}
                          onChange={(event) =>
                            updateEntity('floor_room', selectedRoom.id, {
                              bounds: { ...roomBounds, width: Number(event.target.value) || roomBounds.width },
                            })
                          }
                        />
                        <TextField
                          label="Height"
                          type="number"
                          value={String(roomBounds.height)}
                          onChange={(event) =>
                            updateEntity('floor_room', selectedRoom.id, {
                              bounds: { ...roomBounds, height: Number(event.target.value) || roomBounds.height },
                            })
                          }
                        />
                      </div>
                    )}
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
              );
            })()
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
                  <SelectField
                    label="Door Style"
                    value={selectedDoorway.doorStyleId ?? ''}
                    onChange={(event) => updateEntity('doorway', selectedDoorway.id, { doorStyleId: event.target.value })}
                  >
                    {assetCatalog
                      .filter((asset) => asset.family === 'door' || asset.family === 'gate' || asset.family === 'stairs' || asset.family === 'ladder')
                      .map((asset) => (
                        <option key={asset.id} value={asset.id}>{asset.label}</option>
                      ))}
                  </SelectField>
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

          {selectedProp ? (
            <Panel>
              <SectionTitle eyebrow="Selection" title={selectedProp.label || 'Prop'} />
              <InspectorGroup title="Identity">
                <TextField
                  label="Label"
                  value={selectedProp.label}
                  onChange={(event) => updateEntity('prop', selectedProp.id, { label: event.target.value })}
                />
                <SelectField
                  label="Asset"
                  value={selectedProp.assetId}
                  onChange={(event) => updateEntity('prop', selectedProp.id, { assetId: event.target.value })}
                >
                  {assetCatalog.map((asset) => (
                    <option key={asset.id} value={asset.id}>{asset.label}</option>
                  ))}
                </SelectField>
              </InspectorGroup>
              <InspectorGroup title="Transform">
                <div className="field-row">
                  <SelectField
                    label="Orientation"
                    value={selectedProp.orientation ?? 'north'}
                    onChange={(event) => updateEntity('prop', selectedProp.id, { orientation: event.target.value })}
                  >
                    <option value="north">North</option>
                    <option value="east">East</option>
                    <option value="south">South</option>
                    <option value="west">West</option>
                  </SelectField>
                  <TextField
                    label="Scale"
                    type="number"
                    value={String(selectedProp.scale)}
                    onChange={(event) => updateEntity('prop', selectedProp.id, { scale: Number(event.target.value) || 1 })}
                  />
                  <TextField
                    label="Rotation"
                    type="number"
                    value={String(selectedProp.rotationDeg)}
                    onChange={(event) => updateEntity('prop', selectedProp.id, { rotationDeg: Number(event.target.value) || 0 })}
                  />
                </div>
              </InspectorGroup>
            </Panel>
          ) : null}

          {!selectedRoom && !selectedCorridor && !selectedDoorway && !selectedProp && !selectedMarker && !selectedNote && !activeTransition && !selectedRoute ? (
            <Panel>
              <EmptyState title="Nothing selected" subtitle="Pick a room, corridor, doorway, route, note, or marker to inspect it here." />
            </Panel>
          ) : null}
        </>
      ) : null}

      {inspectorTab === 'assets' ? (
        <Panel>
          <SectionTitle eyebrow="Assets" title="Asset Catalog" />
          <div className="assets-panel">
            <div className="assets-panel__sidebar">
              {assetFamilies.map((family) => (
                <button
                  key={family}
                  className={assetFamilyFilter === family ? 'is-active' : ''}
                  onClick={() => setAssetFamilyFilter(family)}
                  type="button"
                >
                  <span>{family === 'all' ? 'All Assets' : family.replace(/_/g, ' ')}</span>
                  {family !== 'all' ? <small>{assetCatalog.filter((asset) => asset.family === family).length}</small> : null}
                </button>
              ))}
            </div>
            <div className="assets-panel__content">
              <div className="field-row">
                <TextField
                  label="Search"
                  value={assetSearch}
                  onChange={(event) => setAssetSearch(event.target.value)}
                />
              </div>
              <div className="assets-panel__summary">
                <span>{assetResults.length} results</span>
                <span>Favorites {project.assetFavorites.length}</span>
                <span>Pack {map.view.assetPackId}</span>
              </div>
              <div className="suggestion-list assets-list">
                {assetResults.map((asset) => {
                  const favorite = project.assetFavorites.includes(asset.id);
                  const compatibility = getAssetCompatibility(asset.id);
                  const selected = selectedAssetId === asset.id || toolSettings.propAssetId === asset.id || toolSettings.doorStyleId === asset.id;
                  return (
                    <div
                      key={asset.id}
                      className={`suggestion-item assets-list__item ${selected ? 'is-active' : ''}`}
                      onClick={() => armAssetPlacement(asset.id)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          armAssetPlacement(asset.id);
                        }
                      }}
                      role="button"
                      tabIndex={0}
                    >
                      <div className="assets-list__item-main">
                        <span className="assets-list__icon">
                          <SvgMapIcon iconId={asset.defaultIconId} size={18} />
                        </span>
                        <div>
                          <strong>{asset.label}</strong>
                          <small>{asset.id}</small>
                        </div>
                      </div>
                      <div className="assets-list__meta">
                        <span className={`assets-compat ${compatibility.tileOk ? 'is-ok' : 'is-missing'}`}>tile</span>
                        <span className={`assets-compat ${compatibility.threeOk ? 'is-ok' : 'is-missing'}`}>3d</span>
                        <button
                          aria-label={favorite ? `Remove ${asset.label} from favorites` : `Favorite ${asset.label}`}
                          className={`assets-favorite ${favorite ? 'is-active' : ''}`}
                          onClick={(event) => {
                            event.stopPropagation();
                            toggleAssetFavorite(asset.id);
                          }}
                          type="button"
                        >
                          ★
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </Panel>
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
              <SelectField label="View Mode" value={map.view.viewMode} onChange={(event) => updateMapView({ viewMode: event.target.value as typeof map.view.viewMode })}>
                <option value="plan_2d">Plan</option>
                <option value="second_follow">Second</option>
                <option value="third_orbit">Third</option>
                <option value="first_walk">First</option>
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
                <SelectField label="Style Pack" value={map.view.stylePackId} onChange={(event) => updateMapView({ stylePackId: event.target.value as typeof map.view.stylePackId })}>
                  <option value="stonekeep">Stonekeep</option>
                  <option value="parchment">Parchment</option>
                  <option value="pixel">Pixel</option>
                  <option value="ink">Ink</option>
                  <option value="battlemap">Battlemap</option>
                </SelectField>
                <SelectField label="Wall Style" value={map.view.wallStyle} onChange={(event) => updateMapView({ wallStyle: event.target.value as typeof map.view.wallStyle })}>
                  <option value="stone">Stone</option>
                  <option value="brick">Brick</option>
                  <option value="ruin">Ruin</option>
                </SelectField>
              </div>
              <div className="field-row">
                <SelectField label="3D Fog" value={map.view.fogMode3d} onChange={(event) => updateMapView({ fogMode3d: event.target.value as typeof map.view.fogMode3d })}>
                  <option value="cone">Cone</option>
                  <option value="radius">Radius</option>
                </SelectField>
                <SelectField label="Quality" value={map.view.quality3d ?? 'medium'} onChange={(event) => updateMapView({ quality3d: event.target.value as typeof map.view.quality3d })}>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </SelectField>
              </div>
              <div className="field-row">
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
              <ToggleRow label="Show fog of knowledge" checked={map.view.showFogOfKnowledge} onChange={(checked) => updateMapView({ showFogOfKnowledge: checked })} />
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
            {formatHotkeyHelp().map((group) => (
              <div key={group.category}>
                <strong>{group.category}</strong>
                <p>{group.entries.map((entry) => `${entry.keys}: ${entry.action}`).join(' | ')}</p>
              </div>
            ))}
          </div>
          <div className="project-card__actions">
            <Button data-testid="restart-tutorial-button-sidebar" onClick={restartOnboarding}>Restart Tutorial</Button>
          </div>
        </Panel>
      ) : null}
    </aside>
  );
}
