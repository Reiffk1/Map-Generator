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
        <div className="project-card__header">
          <div>
            <span className="section-eyebrow">Atlas</span>
            <h2>{project.name}</h2>
            <p>{project.gameTitle}</p>
          </div>
          <Badge>{project.maps.length} maps</Badge>
        </div>
        <p className="project-card__notes">{project.playthroughNotes}</p>
        <div className="project-card__actions">
          <Button data-testid="new-map-button" onClick={onCreateMap}>New Map</Button>
          <GhostButton onClick={onCreateSnapshot}>Snapshot</GhostButton>
          <GhostButton data-testid="restart-tutorial-button" onClick={restartOnboarding}>Tutorial</GhostButton>
        </div>
        <div className="stat-grid">
          <StatChip label="Completion" value={`${stats.completionAverage}%`} accent="#b99556" />
          <StatChip label="Rooms" value={stats.roomCount} accent="#d9d1c4" />
          <StatChip label="Open Links" value={stats.unlinkedTransitionCount} accent="#c47656" />
          <StatChip label="Revisit" value={reviewItems.filter((item) => item.category === 'revisit_queue').length} accent="#a3927a" />
        </div>
        <div className="project-card__focus">
          <div>
            <span className="section-eyebrow">Review Queue</span>
            <strong>
              {highPriorityCount > 0
                ? `${highPriorityCount} priority items need a pass`
                : 'No urgent review issues are blocking this atlas'}
            </strong>
          </div>
          <GhostButton onClick={openReview}>Open Review</GhostButton>
        </div>
      </Panel>

      <Panel>
        <SectionTitle eyebrow="Explorer" title="Maps" />
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
