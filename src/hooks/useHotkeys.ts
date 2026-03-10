import { useEffect } from 'react';

import { useAppStore } from '../store/useAppStore';

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

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (isTypingTarget(event)) {
        if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 'k') return;
      }

      const key = event.key.toLowerCase();
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

      if (key === '1') setEditorMode('floorplan');
      if (key === '2') setEditorMode('graph');
      if (key === '3') setEditorMode('ink');
      if (key === '4') setEditorMode('portal');
      if (key === '5') setEditorMode('navigate');
      if (key === '6') setEditorMode('review');

      if (key === 'v') setActiveTool('select');
      if (key === 'r') setActiveTool('floorRoom');
      if (key === 'c') setActiveTool('corridor');
      if (key === 'w') setActiveTool('wall');
      if (key === 'd' && !modifier) setActiveTool('doorway');
      if (key === 'm') setActiveTool('marker');
      if (key === 'n') setActiveTool('note');
      if (key === 'a') setActiveTool('anchor');
      if (key === 'p') setActiveTool('route');
      if (key === 'k' && !modifier) setActiveTool('sketch');
      if (key === 'x') setActiveTool('erase');

      if (key === 'f') {
        updateMapView({
          zoom: 1,
          pan: { x: 0, y: 0 },
        });
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

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
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
