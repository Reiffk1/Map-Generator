import { useEffect } from 'react';

import { selectActiveMap, useAppStore } from '../store/useAppStore';
import type { ToolType, TransitionType, ViewMode } from '../models/types';

const isTypingTarget = (event: KeyboardEvent) => {
  const target = event.target as HTMLElement | null;
  if (!target) return false;
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target.isContentEditable ||
    target.closest('[data-hotkey-scope="editor-form"]') !== null
  );
};

const viewOrder: ViewMode[] = ['plan_2d', 'second_follow', 'third_orbit', 'first_walk'];
const toolByKey: Record<string, ToolType> = {
  v: 'select',
  r: 'floorRoom',
  c: 'corridor',
  w: 'wall',
  d: 'doorway',
  p: 'prop',
  m: 'marker',
  n: 'note',
  a: 'anchor',
  t: 'route',
  k: 'sketch',
  e: 'erase',
  i: 'measure',
};
const doorwayStyles = ['door.wood.basic', 'door.iron.band', 'door.secret.panel', 'door.boss.double'];
const transitionCycle: TransitionType[] = ['door', 'gate', 'portcullis', 'stairs_up', 'stairs_down', 'ladder', 'warp'];
const stampShapeCycle = ['rectangle', 'l_shape', 't_shape', 'cross'] as const;

const focusSearchInput = () => {
  const input = document.querySelector<HTMLInputElement>('[data-testid="top-search"]');
  input?.focus();
  input?.select();
};

const clickAction = (selector: string) => {
  const button = document.querySelector<HTMLElement>(selector);
  button?.click();
};

const cycleIndex = <T,>(items: T[], current: T, direction: -1 | 1 = 1) => {
  const index = items.indexOf(current);
  if (index === -1) return items[0];
  return items[(index + direction + items.length) % items.length];
};

export const useHotkeys = () => {
  const undo = useAppStore((state) => state.undo);
  const redo = useAppStore((state) => state.redo);
  const setActiveTool = useAppStore((state) => state.setActiveTool);
  const setViewMode = useAppStore((state) => state.setViewMode);
  const setCommandPaletteOpen = useAppStore((state) => state.setCommandPaletteOpen);
  const duplicateSelection = useAppStore((state) => state.duplicateSelection);
  const deleteSelection = useAppStore((state) => state.deleteSelection);
  const clearSelection = useAppStore((state) => state.clearSelection);
  const cycleSelectionState = useAppStore((state) => state.cycleSelectionState);
  const updateMapView = useAppStore((state) => state.updateMapView);
  const toggleSidebar = useAppStore((state) => state.toggleSidebar);
  const toggleFocusMode = useAppStore((state) => state.toggleFocusMode);
  const openMap = useAppStore((state) => state.openMap);
  const setToolSettings = useAppStore((state) => state.setToolSettings);
  const setBottomPanelTab = useAppStore((state) => state.setBottomPanelTab);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      const modifier = event.metaKey || event.ctrlKey;
      const typing = isTypingTarget(event);
      const state = useAppStore.getState();
      const map = selectActiveMap(state);

      if (typing && !(modifier || key === 'escape')) {
        return;
      }

      if (modifier && key === 'k') {
        event.preventDefault();
        setCommandPaletteOpen(true);
        return;
      }

      if (modifier && key === 'f') {
        event.preventDefault();
        setBottomPanelTab('search');
        if (!state.showBottomPanel) toggleSidebar('bottom');
        focusSearchInput();
        return;
      }

      if (modifier && !event.shiftKey && key === 'z') {
        event.preventDefault();
        undo();
        return;
      }

      if (modifier && event.shiftKey && key === 'z') {
        event.preventDefault();
        redo();
        return;
      }

      if (modifier && key === 'd') {
        event.preventDefault();
        duplicateSelection();
        return;
      }

      if (modifier && key === 'b') {
        event.preventDefault();
        toggleSidebar('left');
        return;
      }

      if (modifier && key === 'i') {
        event.preventDefault();
        toggleSidebar('right');
        return;
      }

      if (modifier && key === 'j') {
        event.preventDefault();
        toggleSidebar('bottom');
        return;
      }

      if (modifier && key === 'pagedown') {
        event.preventDefault();
        const index = state.workspace.openMapIds.indexOf(state.workspace.activeMapId);
        const nextId = state.workspace.openMapIds[(index + 1) % state.workspace.openMapIds.length];
        if (nextId) openMap(nextId, { pushHistory: false });
        return;
      }

      if (modifier && key === 'pageup') {
        event.preventDefault();
        const index = state.workspace.openMapIds.indexOf(state.workspace.activeMapId);
        const nextId = state.workspace.openMapIds[(index - 1 + state.workspace.openMapIds.length) % state.workspace.openMapIds.length];
        if (nextId) openMap(nextId, { pushHistory: false });
        return;
      }

      if (modifier && key === '0') {
        event.preventDefault();
        if (event.altKey) clickAction('[data-testid="fit-selection-button"]');
        else clickAction('[data-testid="fit-map-button"]');
        return;
      }

      if (key === 'delete' || key === 'backspace') {
        event.preventDefault();
        deleteSelection();
        return;
      }

      if (key === 'escape') {
        if (state.commandPaletteOpen) {
          event.preventDefault();
          setCommandPaletteOpen(false);
          return;
        }
        if (map.view.viewMode === 'first_walk') {
          event.preventDefault();
          setViewMode('second_follow');
          return;
        }
        if (map.view.viewMode === 'second_follow') {
          event.preventDefault();
          setViewMode('plan_2d');
          return;
        }
        if (state.footprintEditRoomId) {
          event.preventDefault();
          useAppStore.getState().setFootprintEditRoomId(undefined);
          return;
        }
        if (state.selection.kind !== 'none') {
          event.preventDefault();
          clearSelection();
          return;
        }
        if (state.focusMode) {
          event.preventDefault();
          toggleFocusMode();
        }
        return;
      }

      if (typing) return;

      if (event.altKey && ['1', '2', '3', '4'].includes(key)) {
        event.preventDefault();
        setViewMode(viewOrder[Number(key) - 1] ?? 'plan_2d');
        return;
      }

      if (key === 'f') {
        event.preventDefault();
        toggleFocusMode();
        return;
      }

      if (key === 'g') {
        event.preventDefault();
        if (event.shiftKey) {
          updateMapView({ showMinimap: !map.view.showMinimap });
        } else {
          updateMapView({ showGrid: !map.view.showGrid });
        }
        return;
      }

      if (key === 'q') {
        event.preventDefault();
        cycleSelectionState();
        return;
      }

      if (key === '[' || key === ']') {
        event.preventDefault();
        const delta = key === '[' ? -1 : 1;
        if (state.activeTool === 'floorRoom') {
          if (state.toolSettings.roomPlacement === 'paint') {
            const next = Math.max(1, Math.min(5, state.toolSettings.roomPaintBrush + delta)) as 1 | 2 | 3 | 4 | 5;
            setToolSettings({ roomPaintBrush: next });
            return;
          }
          const stampSizes = [6, 8, 10] as const;
          const next = cycleIndex([...stampSizes], state.toolSettings.roomStampSize, delta === -1 ? -1 : 1);
          setToolSettings({ roomStampSize: next });
          return;
        }
        if (state.activeTool === 'corridor') {
          setToolSettings({ corridorWidth: Math.max(24, Math.min(160, state.toolSettings.corridorWidth + delta * 8)) });
          return;
        }
        if (state.activeTool === 'sketch') {
          setToolSettings({ sketchWidth: Math.max(1, Math.min(24, state.toolSettings.sketchWidth + delta)) });
        }
        return;
      }

      if (key === 'tab' && state.activeTool === 'floorRoom' && state.toolSettings.roomPlacement === 'stamp') {
        event.preventDefault();
        setToolSettings({
          roomStampShape: cycleIndex(
            [...stampShapeCycle],
            state.toolSettings.roomStampShape,
            event.shiftKey ? -1 : 1,
          ),
        });
        return;
      }

      if (key === 'd' && event.shiftKey) {
        event.preventDefault();
        const currentStyle = state.toolSettings.doorStyleId ?? doorwayStyles[0];
        setToolSettings({ doorStyleId: cycleIndex(doorwayStyles, currentStyle) });
        return;
      }

      if (key === 'd' && event.altKey) {
        event.preventDefault();
        setToolSettings({ transitionType: cycleIndex(transitionCycle, state.toolSettings.transitionType) });
        return;
      }

      const tool = toolByKey[key];
      if (tool) {
        event.preventDefault();
        setActiveTool(tool);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [
    clearSelection,
    cycleSelectionState,
    deleteSelection,
    duplicateSelection,
    openMap,
    redo,
    setActiveTool,
    setBottomPanelTab,
    setCommandPaletteOpen,
    setToolSettings,
    setViewMode,
    toggleFocusMode,
    toggleSidebar,
    undo,
    updateMapView,
  ]);
};
