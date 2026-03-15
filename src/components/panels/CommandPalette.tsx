import type { ProjectRecord } from '../../models/types';
import { getHotkeyLabel } from '../../lib/hotkeys';
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
  const setViewMode = useAppStore((state) => state.setViewMode);

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
              <CommandItem onSelect={run(() => setActiveTool('floorRoom'))}>Equip Room Tool [{getHotkeyLabel('tool_room')}]</CommandItem>
              <CommandItem onSelect={run(() => setActiveTool('corridor'))}>Equip Corridor Tool [{getHotkeyLabel('tool_corridor')}]</CommandItem>
              <CommandItem onSelect={run(() => setActiveTool('doorway'))}>Equip Door Tool [{getHotkeyLabel('tool_door')}]</CommandItem>
              <CommandItem onSelect={run(() => setActiveTool('prop'))}>Equip Prop Tool [{getHotkeyLabel('tool_prop')}]</CommandItem>
              <CommandItem onSelect={run(() => setActiveTool('marker'))}>Equip Marker Tool [{getHotkeyLabel('tool_marker')}]</CommandItem>
              <CommandItem onSelect={run(() => setActiveTool('note'))}>Equip Note Tool [{getHotkeyLabel('tool_note')}]</CommandItem>
              <CommandItem onSelect={run(() => setActiveTool('anchor'))}>Equip Anchor Tool [{getHotkeyLabel('tool_anchor')}]</CommandItem>
              <CommandItem onSelect={run(() => setActiveTool('wall'))}>Equip Wall Tool [{getHotkeyLabel('tool_wall')}]</CommandItem>
              <CommandItem onSelect={run(() => setActiveTool('route'))}>Equip Route Tool [{getHotkeyLabel('tool_route')}]</CommandItem>
              <CommandItem onSelect={run(() => setActiveTool('sketch'))}>Equip Sketch Tool [{getHotkeyLabel('tool_sketch')}]</CommandItem>
              <CommandItem onSelect={run(() => setActiveTool('erase'))}>Equip Erase Tool [{getHotkeyLabel('tool_erase')}]</CommandItem>
              <CommandItem onSelect={run(() => setActiveTool('measure'))}>Equip Measure Tool [{getHotkeyLabel('tool_measure')}]</CommandItem>
            </CommandGroup>

            <CommandGroup heading="Views">
              <CommandItem onSelect={run(() => setViewMode('plan_2d'))}>Switch to Plan (2D) [{getHotkeyLabel('view_plan')}]</CommandItem>
              <CommandItem onSelect={run(() => setViewMode('second_follow'))}>Switch to Second (Follow) [{getHotkeyLabel('view_second')}]</CommandItem>
              <CommandItem onSelect={run(() => setViewMode('third_orbit'))}>Switch to Third (Orbit) [{getHotkeyLabel('view_third')}]</CommandItem>
              <CommandItem onSelect={run(() => setViewMode('first_walk'))}>Switch to First (Walk) [{getHotkeyLabel('view_first')}]</CommandItem>
            </CommandGroup>

            <CommandGroup heading="Actions">
              <CommandItem onSelect={run(() => createSnapshot('Quick snapshot'))}>Capture snapshot</CommandItem>
              <CommandItem onSelect={run(() => {
                if (typeof window !== 'undefined' && !window.confirm('Clear the current map content?')) return;
                clearActiveMap();
              })}>Clear current map</CommandItem>
              <CommandItem onSelect={run(generateDungeon)}>Generate Dungeon</CommandItem>
              <CommandItem onSelect={run(() => toggleSidebar('left'))}>Toggle Explorer [{getHotkeyLabel('toggle_explorer')}]</CommandItem>
              <CommandItem onSelect={run(() => toggleSidebar('right'))}>Toggle Inspector [{getHotkeyLabel('toggle_inspector')}]</CommandItem>
              <CommandItem onSelect={run(() => toggleSidebar('bottom'))}>Toggle Drawer [{getHotkeyLabel('toggle_drawer')}]</CommandItem>
              <CommandItem onSelect={run(restartOnboarding)}>Restart guided tutorial</CommandItem>
            </CommandGroup>

            <CommandGroup heading="Inspector">
              <CommandItem onSelect={run(() => setInspectorTab('selection'))}>Open inspector: Selection</CommandItem>
              <CommandItem onSelect={run(() => setInspectorTab('assets'))}>Open inspector: Assets</CommandItem>
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
