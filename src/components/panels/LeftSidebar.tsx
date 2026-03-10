import type { ProjectStats } from '../../lib/projectDerived';
import type { ProjectRecord, ReviewItem } from '../../models/types';
import { selectActiveMap, useAppStore } from '../../store/useAppStore';
import { Badge, Button, GhostButton, Panel, SectionTitle, StatChip } from '../ui/primitives';

export function LeftSidebar({
  project,
  stats,
  reviewItems,
  onCreateMap,
  onCreateSnapshot,
}: {
  project: ProjectRecord;
  stats: ProjectStats;
  reviewItems: ReviewItem[];
  onCreateMap: () => void;
  onCreateSnapshot: () => void;
}) {
  const activeMap = useAppStore(selectActiveMap);
  const openMap = useAppStore((state) => state.openMap);
  const toggleMapFavorite = useAppStore((state) => state.toggleMapFavorite);
  const restartOnboarding = useAppStore((state) => state.restartOnboarding);
  const showBottomPanel = useAppStore((state) => state.showBottomPanel);
  const setBottomPanelTab = useAppStore((state) => state.setBottomPanelTab);
  const toggleSidebar = useAppStore((state) => state.toggleSidebar);

  const highPriorityCount = reviewItems.filter((item) => item.severity !== 'low').length;

  const openReview = () => {
    setBottomPanelTab('review');
    if (!showBottomPanel) toggleSidebar('bottom');
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
        <div className="map-list">
          {project.maps.map((map) => (
            <div className={`map-list__row ${activeMap.id === map.id ? 'is-active' : ''}`} key={map.id}>
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
        <details className="sidebar-accordion">
          <summary>Project Summary</summary>
          <div className="sidebar-accordion__body">
            <div className="stat-grid">
              <StatChip label="Completion" value={`${stats.completionAverage}%`} accent="#b99556" />
              <StatChip label="Rooms" value={stats.roomCount} accent="#d9d1c4" />
              <StatChip label="Open Links" value={stats.unlinkedTransitionCount} accent="#c47656" />
              <StatChip label="Revisit" value={reviewItems.filter((item) => item.category === 'revisit_queue').length} accent="#a3927a" />
            </div>
            <p className="project-card__notes">{project.playthroughNotes}</p>
          </div>
        </details>
        <details className="sidebar-accordion">
          <summary>Review Queue</summary>
          <div className="sidebar-accordion__body">
            <strong>
              {highPriorityCount > 0
                ? `${highPriorityCount} priority items need a pass`
                : 'No urgent review issues are blocking this atlas'}
            </strong>
            <div className="project-card__actions">
              <GhostButton onClick={openReview}>Open Review</GhostButton>
            </div>
          </div>
        </details>
        <details className="sidebar-accordion">
          <summary>Snapshots & Help</summary>
          <div className="sidebar-accordion__body">
            <div className="project-card__actions">
              <GhostButton onClick={onCreateSnapshot}>Snapshot</GhostButton>
              <GhostButton data-testid="restart-tutorial-button" onClick={restartOnboarding}>Tutorial</GhostButton>
            </div>
          </div>
        </details>
      </Panel>
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
