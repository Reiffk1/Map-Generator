import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';

import type { ProjectStats } from '../../lib/projectDerived';
import type {
  ProjectRecord,
  ReviewItem,
  RoutePlan,
  SearchResult,
  SelectionState,
  UiState,
} from '../../models/types';
import { useAppStore } from '../../store/useAppStore';
import { Badge, Button, EmptyState, Panel, SectionTitle } from '../ui/primitives';
import { SvgMapIcon } from '../../data/iconLibrary';
import { formatRelativeTime } from '../../lib/utils';

const SEARCH_KIND_LABELS: Record<SearchResult['kind'], string> = {
  map: 'Maps',
  room: 'Rooms',
  marker: 'Markers',
  note: 'Notes',
  transition: 'Transitions',
  floor_room: 'Rooms',
  doorway: 'Doorways',
};

export function BottomPanel({
  project,
  reviewItems,
  legend,
  stats,
  routePlan,
  searchResults,
  bottomPanelTab: controlledBottomPanelTab,
}: {
  project: ProjectRecord;
  reviewItems: ReviewItem[];
  legend: ReturnType<typeof import('../../lib/projectDerived').getLegendForMap>;
  stats: ProjectStats;
  routePlan: RoutePlan | null;
  searchResults: SearchResult[];
  bottomPanelTab?: UiState['bottomPanelTab'];
}) {
  const storeBottomPanelTab = useAppStore((state) => state.bottomPanelTab);
  const setBottomPanelTab = useAppStore((state) => state.setBottomPanelTab);
  const search = useAppStore((state) => state.search);
  const openMap = useAppStore((state) => state.openMap);
  const setSelection = useAppStore((state) => state.setSelection);
  const setInspectorTab = useAppStore((state) => state.setInspectorTab);
  const bottomPanelTab = controlledBottomPanelTab ?? storeBottomPanelTab;
  const [activeSearchIndex, setActiveSearchIndex] = useState(0);
  const searchButtonsRef = useRef<Array<HTMLButtonElement | null>>([]);

  const tabs: Array<[UiState['bottomPanelTab'], string]> = [
    ['review', 'Review'],
    ['revisit', 'Revisit'],
    ['route_planner', 'Route'],
    ['search', 'Search'],
    ['legend', 'Legend'],
    ['stats', 'Stats'],
    ['session', 'Session'],
  ];

  const groupedSearchResults = useMemo(() => {
    const groups = new Map<string, SearchResult[]>();
    for (const result of searchResults) {
      const label = SEARCH_KIND_LABELS[result.kind];
      const existing = groups.get(label);
      if (existing) existing.push(result);
      else groups.set(label, [result]);
    }
    return Array.from(groups.entries());
  }, [searchResults]);

  const openMapAndSelect = (mapId?: string, selection?: SelectionState) => {
    if (!mapId) return;
    openMap(mapId);
    if (selection && selection.kind !== 'none') {
      setSelection(selection);
      setInspectorTab('selection');
    }
  };

  const findSelectionForEntity = (mapId: string, entityId?: string): SelectionState | undefined => {
    if (!entityId) return undefined;
    const map = project.maps.find((entry) => entry.id === mapId);
    if (!map) return undefined;

    if (map.floorRooms.some((entry) => entry.id === entityId)) return { kind: 'floor_room', ids: [entityId] };
    if (map.doorways.some((entry) => entry.id === entityId)) return { kind: 'doorway', ids: [entityId] };
    if (map.transitions.some((entry) => entry.id === entityId)) return { kind: 'transition', ids: [entityId] };
    if (map.notesBoard.some((entry) => entry.id === entityId)) return { kind: 'note', ids: [entityId] };
    if (map.routeOverlays.some((entry) => entry.id === entityId)) return { kind: 'route', ids: [entityId] };
    if (map.markers.some((entry) => entry.id === entityId)) return { kind: 'marker', ids: [entityId] };
    if (map.props.some((entry) => entry.id === entityId)) return { kind: 'prop', ids: [entityId] };
    if (map.anchors.some((entry) => entry.id === entityId)) return { kind: 'anchor', ids: [entityId] };
    return undefined;
  };

  const selectionFromSearch = (result: SearchResult): SelectionState | undefined => {
    if (!result.mapId) return undefined;
    if (result.kind === 'floor_room') return { kind: 'floor_room', ids: [result.id] };
    if (result.kind === 'doorway') return { kind: 'doorway', ids: [result.id] };
    if (result.kind === 'transition') return { kind: 'transition', ids: [result.id] };
    if (result.kind === 'note') return { kind: 'note', ids: [result.id] };
    if (result.kind === 'marker') return { kind: 'marker', ids: [result.id] };
    return undefined;
  };

  const flatSearchResults = groupedSearchResults.flatMap(([, results]) => results);
  const clampedSearchIndex = flatSearchResults.length
    ? Math.max(0, Math.min(activeSearchIndex, flatSearchResults.length - 1))
    : 0;

  const handleSearchKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!flatSearchResults.length) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveSearchIndex((current) => Math.min(flatSearchResults.length - 1, current + 1));
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveSearchIndex((current) => Math.max(0, current - 1));
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      searchButtonsRef.current[clampedSearchIndex]?.click();
    }
  };

  useEffect(() => {
    if (bottomPanelTab !== 'search') return;
    searchButtonsRef.current[clampedSearchIndex]?.scrollIntoView({ block: 'nearest' });
  }, [bottomPanelTab, clampedSearchIndex]);

  const handleCopyRoute = async () => {
    if (!routePlan) return;
    const text = [routePlan.summary, ...routePlan.steps.map((step, index) => `${index + 1}. ${step.mapName}: ${step.label}`)].join('\n');
    try {
      await navigator.clipboard.writeText(text);
      toast('Route copied to clipboard.');
    } catch (error) {
      console.error(error);
      toast('Clipboard copy failed.');
    }
  };

  return (
    <div className="bottom-panel" data-testid="bottom-drawer">
      <div className="bottom-panel__tabs" role="tablist" aria-label="Bottom drawer sections">
        {tabs.map(([value, label]) => (
          <button
            key={value}
            className={bottomPanelTab === value ? 'is-active' : ''}
            data-testid={`drawer-tab-${value}`}
            onClick={() => setBottomPanelTab(value)}
            type="button"
          >
            {label}
          </button>
        ))}
      </div>

      <Panel className="bottom-panel__content">
        {bottomPanelTab === 'review' ? (
          <>
            <SectionTitle eyebrow="Review" title="Outstanding Mapping Issues" />
            <div className="review-grid">
              {reviewItems.slice(0, 10).map((item) => (
                <button
                  key={item.id}
                  className={`review-card is-${item.severity}`}
                  onClick={() => openMapAndSelect(item.mapId, findSelectionForEntity(item.mapId, item.entityId))}
                  type="button"
                >
                  <span>{item.category.replace(/_/g, ' ')}</span>
                  <strong>{item.title}</strong>
                  <small>{item.mapName}</small>
                  <p>{item.subtitle}</p>
                </button>
              ))}
            </div>
          </>
        ) : null}

        {bottomPanelTab === 'revisit' ? (
          <>
            <SectionTitle eyebrow="Queue" title="Revisit Planner" />
            {reviewItems.filter((item) => item.category === 'revisit_queue').length ? (
              <div className="review-grid">
                {reviewItems
                  .filter((item) => item.category === 'revisit_queue')
                  .map((item) => (
                    <button
                      key={item.id}
                      className={`review-card is-${item.severity}`}
                      onClick={() => openMapAndSelect(item.mapId, findSelectionForEntity(item.mapId, item.entityId))}
                      type="button"
                    >
                      <span>{item.mapName}</span>
                      <strong>{item.title}</strong>
                      <p>{item.subtitle}</p>
                    </button>
                  ))}
              </div>
            ) : (
              <EmptyState title="Queue is clear" subtitle="Nothing is currently flagged for a later revisit." />
            )}
          </>
        ) : null}

        {bottomPanelTab === 'route_planner' ? (
          <>
            <SectionTitle eyebrow="Traversal" title="Route Planner" />
            {routePlan ? (
              <div className="route-steps">
                <div className="route-actions">
                  <p>{routePlan.summary}</p>
                  <Button onClick={() => void handleCopyRoute()}>Copy route to clipboard</Button>
                </div>
                {routePlan.steps.map((step, index) => (
                  <button
                    className="route-step route-step--button"
                    key={`${step.mapId}_${index}`}
                    onClick={() => openMap(step.mapId)}
                    type="button"
                  >
                    <span>{index + 1}</span>
                    <div>
                      <strong>{step.mapName}</strong>
                      <small>{step.label}</small>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <EmptyState title="Choose start and end maps" subtitle="Set both points in the explorer to calculate a route." />
            )}
          </>
        ) : null}

        {bottomPanelTab === 'search' ? (
          <>
            <SectionTitle eyebrow="Search" title={search.query ? `Results for "${search.query}"` : 'Project Search'} />
            {search.query && searchResults.length ? (
              <div
                className="search-groups"
                onKeyDown={handleSearchKeyDown}
                tabIndex={0}
              >
                {groupedSearchResults.map(([groupLabel, results]) => (
                  <div className="search-group" key={groupLabel}>
                    <div className="search-group__label">{groupLabel}</div>
                    <div className="activity-list">
                      {results.map((result) => {
                        const searchIndex = flatSearchResults.findIndex((entry) => entry.id === result.id && entry.kind === result.kind);
                        return (
                          <button
                            key={`${result.kind}_${result.id}`}
                            className={`search-result ${searchIndex === clampedSearchIndex ? 'is-active' : ''}`}
                            data-testid={`search-result-${result.kind}`}
                            onClick={() => openMapAndSelect(result.mapId, selectionFromSearch(result))}
                            ref={(node) => {
                              searchButtonsRef.current[searchIndex] = node;
                            }}
                            type="button"
                          >
                            <div>
                              <strong>{result.title}</strong>
                              <small>{result.mapName ?? result.subtitle}</small>
                            </div>
                            <Badge>{result.kind.replace('_', ' ')}</Badge>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState title="Search everything" subtitle="Use the top search field to jump to maps, rooms, notes, and linked doors." />
            )}
          </>
        ) : null}

        {bottomPanelTab === 'legend' ? (
          <>
            <SectionTitle eyebrow="Legend" title="Symbols Used On This Map" />
            <div className="legend-grid">
              {legend.map((icon) => (
                <div className="legend-item" key={icon.id}>
                  <SvgMapIcon iconId={icon.id} size={20} />
                  <div>
                    <strong>{icon.label}</strong>
                    <small>{icon.category}</small>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : null}

        {bottomPanelTab === 'stats' ? (
          <>
            <SectionTitle eyebrow="Analytics" title="Project Dashboard" />
            <div className="dashboard-grid">
              <div><span>Maps</span><strong>{stats.mapCount}</strong></div>
              <div><span>Rooms</span><strong>{stats.roomCount}</strong></div>
              <div><span>Transitions</span><strong>{stats.transitionCount}</strong></div>
              <div><span>Unresolved Notes</span><strong>{stats.unresolvedNoteCount}</strong></div>
              <div><span>Uncertain Routes</span><strong>{stats.uncertainRouteCount}</strong></div>
              <div><span>Average Completion</span><strong>{stats.completionAverage}%</strong></div>
            </div>
          </>
        ) : null}

        {bottomPanelTab === 'session' ? (
          <>
            <SectionTitle eyebrow="Journal" title="Session Timeline" />
            <div className="activity-list">
              {project.sessionLog.map((entry) => (
                <article key={entry.id} className="activity-row">
                  <div>
                    <strong>{entry.title}</strong>
                    <p>{entry.summary}</p>
                  </div>
                  <Badge>{formatRelativeTime(entry.timestamp)}</Badge>
                </article>
              ))}
            </div>
          </>
        ) : null}
      </Panel>
    </div>
  );
}
