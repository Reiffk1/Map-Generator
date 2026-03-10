import type { ProjectStats } from '../../lib/projectDerived';
import type { ProjectRecord, ReviewItem, RoutePlan, SearchResult } from '../../models/types';
import { useAppStore } from '../../store/useAppStore';
import { Badge, EmptyState, Panel, SectionTitle } from '../ui/primitives';
import { SvgMapIcon } from '../../data/iconLibrary';
import { formatRelativeTime } from '../../lib/utils';

export function BottomPanel({
  project,
  reviewItems,
  legend,
  stats,
  routePlan,
  searchResults,
}: {
  project: ProjectRecord;
  reviewItems: ReviewItem[];
  legend: ReturnType<typeof import('../../lib/projectDerived').getLegendForMap>;
  stats: ProjectStats;
  routePlan: RoutePlan | null;
  searchResults: SearchResult[];
}) {
  const bottomPanelTab = useAppStore((state) => state.bottomPanelTab);
  const setBottomPanelTab = useAppStore((state) => state.setBottomPanelTab);
  const search = useAppStore((state) => state.search);
  const openMap = useAppStore((state) => state.openMap);

  const tabs: Array<[typeof bottomPanelTab, string]> = [
    ['review', 'Review'],
    ['revisit', 'Revisit'],
    ['route_planner', 'Route'],
    ['search', 'Search'],
    ['legend', 'Legend'],
    ['stats', 'Stats'],
    ['session', 'Session'],
  ];

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
                <button key={item.id} className={`review-card is-${item.severity}`} onClick={() => openMap(item.mapId)} type="button">
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
                    <button key={item.id} className={`review-card is-${item.severity}`} onClick={() => openMap(item.mapId)} type="button">
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
                <p>{routePlan.summary}</p>
                {routePlan.steps.map((step, index) => (
                  <div className="route-step" key={`${step.mapId}_${index}`}>
                    <span>{index + 1}</span>
                    <div>
                      <strong>{step.mapName}</strong>
                      <small>{step.label}</small>
                    </div>
                  </div>
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
              <div className="activity-list">
                {searchResults.map((result) => (
                  <button
                    key={`${result.kind}_${result.id}`}
                    className="search-result"
                    data-testid={`search-result-${result.kind}`}
                    onClick={() => result.mapId && openMap(result.mapId)}
                    type="button"
                  >
                    <div>
                      <strong>{result.title}</strong>
                      <small>{result.mapName ?? result.subtitle}</small>
                    </div>
                    <Badge>{result.kind.replace('_', ' ')}</Badge>
                  </button>
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
