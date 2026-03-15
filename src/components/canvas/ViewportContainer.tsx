import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent, ReactNode } from 'react';

import { MiniNavigator } from './MapCanvas';
import type {
  MapRecord,
  ProjectRecord,
  ReviewItem,
  RoutePlan,
  SearchResult,
  UiState,
} from '../../models/types';
import type { ProjectStats } from '../../lib/projectDerived';
import { BottomPanel } from '../panels/BottomPanel';

interface ViewportContainerProps {
  project: ProjectRecord;
  map: MapRecord;
  focusMode: boolean;
  is3dView: boolean;
  viewport: ReactNode;
  modeStrip: ReactNode;
  toolStrip: ReactNode;
  toolContext: ReactNode;
  showBottomPanel: boolean;
  editorModeLabel: string;
  toolLabel: string;
  bottomPanelTab: UiState['bottomPanelTab'];
  legend: ReturnType<typeof import('../../lib/projectDerived').getLegendForMap>;
  reviewItems: ReviewItem[];
  routePlan: RoutePlan | null;
  searchResults: SearchResult[];
  stats: ProjectStats;
  onViewportKeyDown: (event: ReactKeyboardEvent<HTMLDivElement>) => void;
  onViewportPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onToggleFocusMode: () => void;
  onFitView: () => void;
  onReset3dCamera: () => void;
  onToggleGrid: () => void;
  onToggleMinimap: () => void;
  onToggleFog: () => void;
}

export function ViewportContainer({
  project,
  map,
  focusMode,
  is3dView,
  viewport,
  modeStrip,
  toolStrip,
  toolContext,
  showBottomPanel,
  editorModeLabel,
  toolLabel,
  bottomPanelTab,
  legend,
  reviewItems,
  routePlan,
  searchResults,
  stats,
  onViewportKeyDown,
  onViewportPointerDown,
  onToggleFocusMode,
  onFitView,
  onReset3dCamera,
  onToggleGrid,
  onToggleMinimap,
  onToggleFog,
}: ViewportContainerProps) {
  return (
    <section className={`center-stage${focusMode ? ' center-stage--focus' : ''}`} data-testid="viewport-container">
      {!focusMode ? (
        <div className="viewport-toolbar" data-testid="viewport-toolbar">
          <div className="viewport-toolbar__rails">
            <div className="viewport-toolbar__summary">
              <span className="section-eyebrow">Viewport</span>
              <strong>
                Mode: {editorModeLabel} | Tool: {toolLabel}
              </strong>
            </div>
            {modeStrip}
            {toolStrip}
          </div>
          <div className="viewport-toolbar__controls">
            {toolContext ? <div className="viewport-toolbar__options">{toolContext}</div> : null}
            <button className={map.view.showGrid ? 'is-active' : ''} onClick={onToggleGrid} type="button">Grid</button>
            <button className={map.view.showMinimap ? 'is-active' : ''} onClick={onToggleMinimap} type="button">Minimap</button>
            {is3dView ? (
              <button className={map.view.showFogOfKnowledge ? 'is-active' : ''} onClick={onToggleFog} type="button">Fog</button>
            ) : null}
          </div>
        </div>
      ) : null}

      {!focusMode ? (
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
      ) : null}

      <div
        className={`workspace-canvas-region${focusMode ? ' workspace-canvas-region--focus' : ''}`}
        data-canvas-region="true"
        onKeyDown={onViewportKeyDown}
        onPointerDown={onViewportPointerDown}
        tabIndex={0}
      >
        {viewport}

        {map.view.showMinimap ? <MiniNavigator map={map} /> : null}

        {focusMode ? (
          <div className="focus-mode-overlay">
            <button onClick={onToggleFocusMode} type="button">Exit Focus</button>
            <button onClick={onFitView} type="button">{is3dView ? 'Fit Camera' : 'Fit to Map'}</button>
            <button disabled={!is3dView} onClick={onReset3dCamera} type="button">Reset Camera</button>
          </div>
        ) : null}
      </div>

      {!focusMode && showBottomPanel ? (
        <BottomPanel
          bottomPanelTab={bottomPanelTab}
          legend={legend}
          project={project}
          reviewItems={reviewItems}
          routePlan={routePlan}
          searchResults={searchResults}
          stats={stats}
        />
      ) : null}
    </section>
  );
}
