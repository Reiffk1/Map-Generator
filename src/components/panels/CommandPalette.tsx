import type { ProjectRecord } from '../../models/types';
import { useAppStore } from '../../store/useAppStore';
import { Dialog, DialogContent, DialogTitle } from '../ui/dialog';
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from '../ui/command';

export function CommandPalette({ project }: { project: ProjectRecord }) {
  const open = useAppStore((state) => state.commandPaletteOpen);
  const setOpen = useAppStore((state) => state.setCommandPaletteOpen);
  const createMap = useAppStore((state) => state.createMap);
  const cloneActiveMap = useAppStore((state) => state.cloneActiveMap);
  const createSnapshot = useAppStore((state) => state.createSnapshot);
  const clearActiveMap = useAppStore((state) => state.clearActiveMap);
  const setEditorMode = useAppStore((state) => state.setEditorMode);
  const setActiveTool = useAppStore((state) => state.setActiveTool);
  const openMap = useAppStore((state) => state.openMap);
  const restartOnboarding = useAppStore((state) => state.restartOnboarding);
  const generateDungeon = useAppStore((state) => state.generateDungeon);
  const toggleSidebar = useAppStore((state) => state.toggleSidebar);
  const setInspectorTab = useAppStore((state) => state.setInspectorTab);
  const updateMapView = useAppStore((state) => state.updateMapView);

  const run = (fn: () => void) => () => {
    fn();
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-[760px] overflow-hidden p-0 shadow-2xl">
        <DialogTitle className="sr-only">Command Palette</DialogTitle>
        <Command>
          <CommandInput placeholder="Type a command or jump to a map..." />
          <CommandList>
            <CommandEmpty>No matching commands.</CommandEmpty>

            <CommandGroup heading="Maps">
              {project.maps.map((m) => (
                <CommandItem key={m.id} onSelect={run(() => openMap(m.id))}>
                  Open map: {m.name}
                </CommandItem>
              ))}
              <CommandItem onSelect={run(createMap)}>Create new map</CommandItem>
              <CommandItem onSelect={run(cloneActiveMap)}>Clone current map</CommandItem>
            </CommandGroup>

            <CommandGroup heading="Modes">
              <CommandItem onSelect={run(() => setEditorMode('floorplan'))}>Switch to Floorplan Mode</CommandItem>
              <CommandItem onSelect={run(() => setEditorMode('graph'))}>Switch to Graph Mode</CommandItem>
              <CommandItem onSelect={run(() => setEditorMode('ink'))}>Switch to Ink Mode</CommandItem>
              <CommandItem onSelect={run(() => setEditorMode('portal'))}>Switch to Links Mode</CommandItem>
              <CommandItem onSelect={run(() => setEditorMode('navigate'))}>Switch to Navigate Mode</CommandItem>
              <CommandItem onSelect={run(() => setEditorMode('review'))}>Switch to Review Mode</CommandItem>
            </CommandGroup>

            <CommandGroup heading="Tools">
              <CommandItem onSelect={run(() => setActiveTool('floorRoom'))}>Equip room tool</CommandItem>
              <CommandItem onSelect={run(() => setActiveTool('corridor'))}>Equip corridor tool</CommandItem>
              <CommandItem onSelect={run(() => setActiveTool('doorway'))}>Equip doorway tool</CommandItem>
              <CommandItem onSelect={run(() => setActiveTool('marker'))}>Equip marker tool</CommandItem>
              <CommandItem onSelect={run(() => setActiveTool('note'))}>Equip note tool</CommandItem>
              <CommandItem onSelect={run(() => setActiveTool('wall'))}>Equip wall tool</CommandItem>
              <CommandItem onSelect={run(() => setActiveTool('route'))}>Equip route tool</CommandItem>
              <CommandItem onSelect={run(() => setActiveTool('sketch'))}>Equip sketch tool</CommandItem>
              <CommandItem onSelect={run(() => setActiveTool('erase'))}>Equip erase tool</CommandItem>
            </CommandGroup>

            <CommandGroup heading="Actions">
              <CommandItem onSelect={run(() => createSnapshot('Quick snapshot'))}>Capture snapshot</CommandItem>
              <CommandItem onSelect={run(() => {
                if (typeof window !== 'undefined' && !window.confirm('Clear the current map content?')) return;
                clearActiveMap();
              })}>Clear current map</CommandItem>
              <CommandItem onSelect={run(generateDungeon)}>Generate Dungeon</CommandItem>
              <CommandItem onSelect={run(() => {
                const s = useAppStore.getState();
                const m = s.workspace.projects
                  .find((p) => p.id === s.workspace.activeProjectId)
                  ?.maps.find((e) => e.id === s.workspace.activeMapId);
                updateMapView({ renderMode: m?.view.renderMode === 'preview_3d' ? 'editor_2d' : 'preview_3d' });
              })}>Toggle 3D preview mode</CommandItem>
              <CommandItem onSelect={run(() => toggleSidebar('left'))}>Toggle explorer sidebar</CommandItem>
              <CommandItem onSelect={run(() => toggleSidebar('right'))}>Toggle inspector sidebar</CommandItem>
              <CommandItem onSelect={run(() => toggleSidebar('bottom'))}>Toggle bottom drawer</CommandItem>
              <CommandItem onSelect={run(restartOnboarding)}>Restart guided tutorial</CommandItem>
            </CommandGroup>

            <CommandGroup heading="Inspector">
              <CommandItem onSelect={run(() => setInspectorTab('selection'))}>Open inspector: Selection</CommandItem>
              <CommandItem onSelect={run(() => setInspectorTab('map'))}>Open inspector: Map</CommandItem>
              <CommandItem onSelect={run(() => setInspectorTab('layers'))}>Open inspector: Layers</CommandItem>
              <CommandItem onSelect={run(() => setInspectorTab('links'))}>Open inspector: Links</CommandItem>
              <CommandItem onSelect={run(() => setInspectorTab('notes'))}>Open inspector: Notes</CommandItem>
              <CommandItem onSelect={run(() => setInspectorTab('help'))}>Open inspector: Help</CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
