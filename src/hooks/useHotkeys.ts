import { useEffect, useRef } from 'react';

import { useAppStore, selectActiveMap } from '../store/useAppStore';

const PAN_SPEED = 12;
const ZOOM_KEY_STEP = 0.06;
const SMOOTH_FACTOR = 0.25;

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

export const useHotkeys = () => {
  const undo = useAppStore((state) => state.undo);
  const redo = useAppStore((state) => state.redo);
  const setEditorMode = useAppStore((state) => state.setEditorMode);
  const setActiveTool = useAppStore((state) => state.setActiveTool);
  const setCommandPaletteOpen = useAppStore((state) => state.setCommandPaletteOpen);
  const duplicateSelection = useAppStore((state) => state.duplicateSelection);
  const deleteSelection = useAppStore((state) => state.deleteSelection);
  const cycleSelectionState = useAppStore((state) => state.cycleSelectionState);
  const updateMapView = useAppStore((state) => state.updateMapView);

  const pressedKeys = useRef(new Set<string>());
  const rafRef = useRef(0);
  const targetPan = useRef({ x: 0, y: 0 });
  const currentPan = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const tick = () => {
      const keys = pressedKeys.current;
      if (keys.size === 0) {
        rafRef.current = 0;
        return;
      }

      const map = selectActiveMap(useAppStore.getState());
      let dx = 0;
      let dy = 0;
      const speed = PAN_SPEED / map.view.zoom;

      if (keys.has('arrowleft') || keys.has('a')) dx += speed;
      if (keys.has('arrowright') || keys.has('d')) dx -= speed;
      if (keys.has('arrowup') || keys.has('w')) dy += speed;
      if (keys.has('arrowdown') || keys.has('s')) dy -= speed;

      if (dx !== 0 || dy !== 0) {
        targetPan.current = {
          x: map.view.pan.x + dx,
          y: map.view.pan.y + dy,
        };
        currentPan.current = {
          x: currentPan.current.x + (targetPan.current.x - currentPan.current.x) * SMOOTH_FACTOR,
          y: currentPan.current.y + (targetPan.current.y - currentPan.current.y) * SMOOTH_FACTOR,
        };
        updateMapView({ pan: { x: currentPan.current.x, y: currentPan.current.y } });
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      const isPanKey = ['arrowleft', 'arrowright', 'arrowup', 'arrowdown'].includes(key) ||
        (!isTypingTarget(event) && ['w', 'a', 's', 'd'].includes(key));

      if (isPanKey && !isTypingTarget(event)) {
        event.preventDefault();
        pressedKeys.current.add(key);
        const map = selectActiveMap(useAppStore.getState());
        currentPan.current = { x: map.view.pan.x, y: map.view.pan.y };
        targetPan.current = { ...currentPan.current };
        if (!rafRef.current) rafRef.current = requestAnimationFrame(tick);
        return;
      }

      if (isTypingTarget(event)) {
        if (!(event.metaKey || event.ctrlKey) || key !== 'k') return;
      }

      const modifier = event.metaKey || event.ctrlKey;

      if (modifier && key === 'k') {
        event.preventDefault();
        setCommandPaletteOpen(true);
        return;
      }

      if (modifier && !event.shiftKey && key === 'z') {
        event.preventDefault();
        undo();
        return;
      }

      if ((modifier && event.shiftKey && key === 'z') || (modifier && key === 'y')) {
        event.preventDefault();
        redo();
        return;
      }

      if (modifier && key === 'd') {
        event.preventDefault();
        duplicateSelection();
        return;
      }

      if (key === 'delete' || key === 'backspace') {
        event.preventDefault();
        deleteSelection();
        return;
      }

      if (key === 'q') {
        event.preventDefault();
        cycleSelectionState();
        return;
      }

      if (key === '=' || key === '+') {
        event.preventDefault();
        const map = selectActiveMap(useAppStore.getState());
        const next = Math.min(3, map.view.zoom * (1 + ZOOM_KEY_STEP));
        updateMapView({ zoom: next });
        return;
      }

      if (key === '-' || key === '_') {
        event.preventDefault();
        const map = selectActiveMap(useAppStore.getState());
        const next = Math.max(0.32, map.view.zoom * (1 - ZOOM_KEY_STEP));
        updateMapView({ zoom: next });
        return;
      }

      if (key === '1') setEditorMode('floorplan');
      if (key === '2') setEditorMode('graph');
      if (key === '3') setEditorMode('ink');
      if (key === '4') setEditorMode('portal');
      if (key === '5') setEditorMode('navigate');
      if (key === '6') setEditorMode('review');

      if (key === 'v') setActiveTool('select');
      if (key === 'r') setActiveTool('floorRoom');
      if (key === 'c') setActiveTool('corridor');
      if (key === 'm') setActiveTool('marker');
      if (key === 'n') setActiveTool('note');
      if (key === 'p') setActiveTool('route');
      if (key === 'x') setActiveTool('erase');

      if (key === 'f') {
        updateMapView({ zoom: 1, pan: { x: 0, y: 0 } });
      }

      if (key === 'g') {
        const current = useAppStore.getState();
        updateMapView({
          showGrid: !current.workspace.projects
            .find((project) => project.id === current.workspace.activeProjectId)
            ?.maps.find((map) => map.id === current.workspace.activeMapId)?.view.showGrid,
        });
      }
    };

    const onKeyUp = (event: KeyboardEvent) => {
      pressedKeys.current.delete(event.key.toLowerCase());
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [
    cycleSelectionState,
    deleteSelection,
    duplicateSelection,
    redo,
    setActiveTool,
    setCommandPaletteOpen,
    setEditorMode,
    undo,
    updateMapView,
  ]);
};
