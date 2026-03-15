import { useEffect, useMemo, useState } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';

import type { ProjectStats } from '../../lib/projectDerived';
import type { ProjectRecord, ReviewItem } from '../../models/types';
import { selectActiveMap, useAppStore } from '../../store/useAppStore';
import { formatRelativeTime } from '../../lib/utils';
import { Badge, Button, GhostButton, Panel, SectionTitle, StatChip } from '../ui/primitives';

type QuickFilter = 'favorites' | 'incomplete' | 'unlinked' | 'revisit';

export function LeftSidebar({
  project,
  stats,
  reviewItems,
  onCreateMap,
  onCreateSnapshot,
  onDuplicateMap,
  onExportMapPng,
  onExportMapPdf,
  onMarkMapReviewed,
}: {
  project: ProjectRecord;
  stats: ProjectStats;
  reviewItems: ReviewItem[];
  onCreateMap: () => void;
  onCreateSnapshot: () => void;
  onDuplicateMap: (mapId: string) => void;
  onExportMapPng: (mapId: string) => void;
  onExportMapPdf: (mapId: string) => void;
  onMarkMapReviewed: (mapId: string) => void;
}) {
  const activeMap = useAppStore(selectActiveMap);
  const workspace = useAppStore((state) => state.workspace);
  const openMap = useAppStore((state) => state.openMap);
  const closeMap = useAppStore((state) => state.closeMap);
  const toggleMapFavorite = useAppStore((state) => state.toggleMapFavorite);
  const restoreSnapshot = useAppStore((state) => state.restoreSnapshot);
  const restartOnboarding = useAppStore((state) => state.restartOnboarding);
  const showBottomPanel = useAppStore((state) => state.showBottomPanel);
  const setBottomPanelTab = useAppStore((state) => state.setBottomPanelTab);
  const toggleSidebar = useAppStore((state) => state.toggleSidebar);
  const [filters, setFilters] = useState<Set<QuickFilter>>(new Set());
  const [contextMenu, setContextMenu] = useState<{ mapId: string; x: number; y: number } | null>(null);

  const highPriorityCount = reviewItems.filter((item) => item.severity !== 'low').length;
  const openMaps = workspace.openMapIds
    .map((mapId) => project.maps.find((map) => map.id === mapId))
    .filter((map): map is ProjectRecord['maps'][number] => Boolean(map));

  const mapsWithUnlinkedDoors = useMemo(
    () => new Set(reviewItems.filter((item) => item.category === 'unlinked_transitions').map((item) => item.mapId)),
    [reviewItems],
  );
  const mapsWithRevisitItems = useMemo(
    () => new Set(reviewItems.filter((item) => item.category === 'revisit_queue').map((item) => item.mapId)),
    [reviewItems],
  );

  const filteredMaps = useMemo(() => {
    return project.maps.filter((map) => {
      if (filters.has('favorites') && !map.favorite) return false;
      if (filters.has('incomplete') && map.completion >= 100) return false;
      if (filters.has('unlinked') && !mapsWithUnlinkedDoors.has(map.id)) return false;
      if (filters.has('revisit') && !mapsWithRevisitItems.has(map.id)) return false;
      return true;
    });
  }, [filters, mapsWithRevisitItems, mapsWithUnlinkedDoors, project.maps]);

  const openReview = () => {
    setBottomPanelTab('review');
    if (!showBottomPanel) toggleSidebar('bottom');
  };

  const openSession = () => {
    setBottomPanelTab('session');
    if (!showBottomPanel) toggleSidebar('bottom');
  };

  const toggleFilter = (filter: QuickFilter) => {
    setFilters((current) => {
      const next = new Set(current);
      if (next.has(filter)) next.delete(filter);
      else next.add(filter);
      return next;
    });
  };

  useEffect(() => {
    if (!contextMenu) return;

    const close = () => setContextMenu(null);
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };

    window.addEventListener('click', close);
    window.addEventListener('contextmenu', close);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('blur', close);
    return () => {
      window.removeEventListener('click', close);
      window.removeEventListener('contextmenu', close);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('blur', close);
    };
  }, [contextMenu]);

  const openContextMenu = (event: ReactMouseEvent, mapId: string) => {
    event.preventDefault();
    event.stopPropagation();
    setContextMenu({
      mapId,
      x: event.clientX,
      y: event.clientY,
    });
  };

  const contextMap = contextMenu ? project.maps.find((map) => map.id === contextMenu.mapId) : undefined;
  const runContextAction = (action: () => void) => {
    action();
    setContextMenu(null);
  };

  return (
    <aside className="left-sidebar" data-testid="explorer-sidebar">
      <Panel className="project-card">
        <div className="project-card__header project-card__header--compact">
          <SectionTitle eyebrow="Explorer" title="Maps" />
          <Badge>{project.maps.length}</Badge>
        </div>
        <div className="project-card__actions">
          <Button data-testid="new-map-button" onClick={onCreateMap}>New Map</Button>
          <GhostButton onClick={openReview}>Review</GhostButton>
        </div>
        <div className="project-card__focus project-card__focus--slim">
          <div>
            <span className="section-eyebrow">Active Map</span>
            <strong>{activeMap.name}</strong>
            <p>{activeMap.region} / {activeMap.floor} / {activeMap.style}</p>
          </div>
        </div>
      </Panel>

      <Panel>
        <div className="project-card__header project-card__header--compact">
          <SectionTitle eyebrow="Workspace" title="Open" />
          <Badge>{openMaps.length}</Badge>
        </div>
        <div className="map-list">
          {openMaps.map((map) => (
            <div
              className={`map-list__row ${activeMap.id === map.id ? 'is-active' : ''}`}
              key={`open_${map.id}`}
              onContextMenu={(event) => openContextMenu(event, map.id)}
            >
              <button
                className={`map-list__item ${activeMap.id === map.id ? 'is-active' : ''}`}
                onClick={() => openMap(map.id)}
                type="button"
              >
                <span className="map-list__accent" style={{ background: map.accent }} />
                <div>
                  <strong>{map.name}</strong>
                  <small>{map.region} / {map.floor}</small>
                </div>
                <span className="map-list__pct">{map.completion}%</span>
              </button>
              {openMaps.length > 1 ? (
                <button
                  aria-label={`Close ${map.name}`}
                  className="map-favorite"
                  onClick={() => closeMap(map.id)}
                  type="button"
                >
                  ×
                </button>
              ) : (
                <div />
              )}
            </div>
          ))}
        </div>
      </Panel>

      <Panel>
        <div className="project-card__header project-card__header--compact">
          <SectionTitle eyebrow="Maps" title="All Maps" />
          <Badge>{filteredMaps.length}</Badge>
        </div>
        <div className="filter-chip-row">
          <button className={filters.has('favorites') ? 'is-active' : ''} onClick={() => toggleFilter('favorites')} type="button">Favorites</button>
          <button className={filters.has('incomplete') ? 'is-active' : ''} onClick={() => toggleFilter('incomplete')} type="button">Incomplete</button>
          <button className={filters.has('unlinked') ? 'is-active' : ''} onClick={() => toggleFilter('unlinked')} type="button">Unlinked Doors</button>
          <button className={filters.has('revisit') ? 'is-active' : ''} onClick={() => toggleFilter('revisit')} type="button">Revisit</button>
        </div>
        <div className="map-list">
          {filteredMaps.map((map) => (
            <div
              className={`map-list__row ${activeMap.id === map.id ? 'is-active' : ''}`}
              key={map.id}
              onContextMenu={(event) => openContextMenu(event, map.id)}
            >
              <button
                className={`map-list__item ${activeMap.id === map.id ? 'is-active' : ''}`}
                data-testid={`map-item-${map.id}`}
                onClick={() => openMap(map.id)}
                type="button"
              >
                <span className="map-list__accent" style={{ background: map.accent }} />
                <div>
                  <strong>{map.name}</strong>
                  <small>{map.region} / {map.floor} / {map.style}</small>
                </div>
                <span className="map-list__pct">{map.completion}%</span>
              </button>
              <button
                aria-label={map.favorite ? `Unfavorite ${map.name}` : `Favorite ${map.name}`}
                className={`map-favorite ${map.favorite ? 'is-favorite' : ''}`}
                onClick={() => toggleMapFavorite(map.id)}
                type="button"
              >
                <FavoriteGlyph active={map.favorite} />
              </button>
            </div>
          ))}
        </div>
      </Panel>

      <Panel>
        <details className="sidebar-accordion" open>
          <summary>Project</summary>
          <div className="sidebar-accordion__body">
            <div className="stat-grid">
              <StatChip label="Completion" value={`${stats.completionAverage}%`} accent="#b99556" />
              <StatChip label="Rooms" value={stats.roomCount} accent="#d9d1c4" />
              <StatChip label="Open Links" value={stats.unlinkedTransitionCount} accent="#c47656" />
              <StatChip label="Revisit" value={reviewItems.filter((item) => item.category === 'revisit_queue').length} accent="#a3927a" />
            </div>
            <div className="project-summary-block">
              <span className="section-eyebrow">Game</span>
              <strong>{project.gameTitle || 'Untitled Project'}</strong>
            </div>
            <p className="project-card__notes">{project.playthroughNotes || 'No playthrough notes yet.'}</p>
          </div>
        </details>
        <details className="sidebar-accordion" open>
          <summary>Snapshots</summary>
          <div className="sidebar-accordion__body">
            <div className="project-card__actions">
              <GhostButton onClick={onCreateSnapshot}>Create Snapshot</GhostButton>
              <GhostButton onClick={openSession}>Open Session</GhostButton>
            </div>
            {project.snapshots.length ? (
              <div className="snapshot-list">
                {project.snapshots.slice(0, 6).map((snapshot) => (
                  <button className="snapshot-item" key={snapshot.id} onClick={() => restoreSnapshot(snapshot.id)} type="button">
                    <div>
                      <strong>{snapshot.label}</strong>
                      <small>{formatRelativeTime(snapshot.createdAt)}</small>
                    </div>
                    <span>Restore</span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="project-card__notes">No snapshots yet.</p>
            )}
          </div>
        </details>
        <details className="sidebar-accordion" open>
          <summary>Review Queue</summary>
          <div className="sidebar-accordion__body">
            <strong>
              {highPriorityCount > 0
                ? `${highPriorityCount} priority items need a pass`
                : 'No urgent review issues are blocking this atlas'}
            </strong>
            <div className="project-card__actions">
              <GhostButton onClick={openReview}>Open Review</GhostButton>
              <GhostButton data-testid="restart-tutorial-button" onClick={restartOnboarding}>Tutorial</GhostButton>
            </div>
          </div>
        </details>
      </Panel>
      {contextMenu && contextMap ? (
        <div
          className="map-context-menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button onClick={() => runContextAction(() => openMap(contextMap.id))} type="button">Open</button>
          <button onClick={() => runContextAction(() => onDuplicateMap(contextMap.id))} type="button">Duplicate</button>
          <button onClick={() => runContextAction(() => closeMap(contextMap.id))} type="button">Close</button>
          <button onClick={() => runContextAction(() => onExportMapPng(contextMap.id))} type="button">Export PNG</button>
          <button onClick={() => runContextAction(() => onExportMapPdf(contextMap.id))} type="button">Export PDF</button>
          <button onClick={() => runContextAction(() => onMarkMapReviewed(contextMap.id))} type="button">Mark Reviewed</button>
        </div>
      ) : null}
    </aside>
  );
}

function FavoriteGlyph({ active }: { active: boolean }) {
  return (
    <svg aria-hidden="true" fill="none" height="16" viewBox="0 0 16 16" width="16">
      {active ? (
        <path
          d="M8 2.2 9.7 5.7l3.8.6-2.8 2.7.7 3.8L8 11l-3.4 1.8.7-3.8L2.5 6.3l3.8-.6L8 2.2Z"
          fill="currentColor"
          stroke="currentColor"
          strokeLinejoin="round"
          strokeWidth="1.1"
        />
      ) : (
        <path
          d="M4 2.8h8a1 1 0 0 1 1 1v9.2l-5-2.4-5 2.4V3.8a1 1 0 0 1 1-1Z"
          stroke="currentColor"
          strokeLinejoin="round"
          strokeWidth="1.4"
        />
      )}
    </svg>
  );
}
