import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

import type { ProjectRecord } from '../../models/types';
import { useAppStore } from '../../store/useAppStore';

export function CommandPalette({ project }: { project: ProjectRecord }) {
  const open = useAppStore((state) => state.commandPaletteOpen);
  const setOpen = useAppStore((state) => state.setCommandPaletteOpen);
  const createMap = useAppStore((state) => state.createMap);
  const cloneActiveMap = useAppStore((state) => state.cloneActiveMap);
  const createSnapshot = useAppStore((state) => state.createSnapshot);
  const setEditorMode = useAppStore((state) => state.setEditorMode);
  const setActiveTool = useAppStore((state) => state.setActiveTool);
  const openMap = useAppStore((state) => state.openMap);
  const restartOnboarding = useAppStore((state) => state.restartOnboarding);
  const toggleSidebar = useAppStore((state) => state.toggleSidebar);
  const setInspectorTab = useAppStore((state) => state.setInspectorTab);
  const updateMapView = useAppStore((state) => state.updateMapView);
  const [query, setQuery] = useState('');

  const items = useMemo(() => {
    const base = [
      { id: 'new-map', label: 'Create new map', run: () => createMap() },
      { id: 'clone-map', label: 'Clone current map', run: () => cloneActiveMap() },
      { id: 'snapshot', label: 'Capture snapshot', run: () => createSnapshot('Quick snapshot') },
      { id: 'mode-floorplan', label: 'Switch to Floorplan Mode', run: () => setEditorMode('floorplan') },
      { id: 'mode-graph', label: 'Switch to Graph Mode', run: () => setEditorMode('graph') },
      { id: 'mode-ink', label: 'Switch to Ink Mode', run: () => setEditorMode('ink') },
      { id: 'mode-portal', label: 'Switch to Links Mode', run: () => setEditorMode('portal') },
      { id: 'mode-navigate', label: 'Switch to Navigate Mode', run: () => setEditorMode('navigate') },
      { id: 'mode-review', label: 'Switch to Review Mode', run: () => setEditorMode('review') },
      { id: 'tool-room', label: 'Equip room tool', run: () => setActiveTool('floorRoom') },
      { id: 'tool-corridor', label: 'Equip corridor tool', run: () => setActiveTool('corridor') },
      { id: 'tool-doorway', label: 'Equip doorway tool', run: () => setActiveTool('doorway') },
      { id: 'tool-marker', label: 'Equip marker tool', run: () => setActiveTool('marker') },
      { id: 'tool-note', label: 'Equip note tool', run: () => setActiveTool('note') },
      { id: 'tool-wall', label: 'Equip wall tool', run: () => setActiveTool('wall') },
      { id: 'tool-route', label: 'Equip route tool', run: () => setActiveTool('route') },
      { id: 'tool-sketch', label: 'Equip sketch tool', run: () => setActiveTool('sketch') },
      { id: 'tool-erase', label: 'Equip erase tool', run: () => setActiveTool('erase') },
      { id: 'toggle-left', label: 'Toggle explorer sidebar', run: () => toggleSidebar('left') },
      { id: 'toggle-right', label: 'Toggle inspector sidebar', run: () => toggleSidebar('right') },
      { id: 'toggle-bottom', label: 'Toggle bottom drawer', run: () => toggleSidebar('bottom') },
      {
        id: 'toggle-3d-preview',
        label: 'Toggle 3D preview mode',
        run: () => {
          const map = useAppStore.getState().workspace.projects
            .find((project) => project.id === useAppStore.getState().workspace.activeProjectId)
            ?.maps.find((entry) => entry.id === useAppStore.getState().workspace.activeMapId);
          updateMapView({ renderMode: map?.view.renderMode === 'preview_3d' ? 'editor_2d' : 'preview_3d' });
        },
      },
      { id: 'inspector-selection', label: 'Open inspector: Selection', run: () => setInspectorTab('selection') },
      { id: 'inspector-map', label: 'Open inspector: Map', run: () => setInspectorTab('map') },
      { id: 'inspector-layers', label: 'Open inspector: Layers', run: () => setInspectorTab('layers') },
      { id: 'inspector-links', label: 'Open inspector: Links', run: () => setInspectorTab('links') },
      { id: 'inspector-notes', label: 'Open inspector: Notes', run: () => setInspectorTab('notes') },
      { id: 'inspector-help', label: 'Open inspector: Help', run: () => setInspectorTab('help') },
      { id: 'tour', label: 'Restart guided tutorial', run: () => restartOnboarding() },
    ];

    const mapCommands = project.maps.map((map) => ({
      id: `map_${map.id}`,
      label: `Open map: ${map.name}`,
      run: () => openMap(map.id),
    }));

    const combined = [...base, ...mapCommands];
    const normalized = query.trim().toLowerCase();
    return normalized
      ? combined.filter((item) => item.label.toLowerCase().includes(normalized))
      : combined;
  }, [cloneActiveMap, createMap, createSnapshot, openMap, project.maps, query, restartOnboarding, setActiveTool, setEditorMode, setInspectorTab, toggleSidebar, updateMapView]);

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="command-palette-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => {
            setQuery('');
            setOpen(false);
          }}
        >
          <motion.div
            className="command-palette"
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            onClick={(event) => event.stopPropagation()}
          >
            <input
              autoFocus
              className="command-palette__input"
              placeholder="Type a command or jump to a map"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <div className="command-palette__results">
              {items.slice(0, 12).map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    item.run();
                    setQuery('');
                    setOpen(false);
                  }}
                  type="button"
                >
                  {item.label}
                </button>
              ))}
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
