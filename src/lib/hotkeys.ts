export interface HotkeyDefinition {
  id: string;
  category: 'Global' | 'Layout' | 'View' | 'Tools' | 'Room' | 'Door' | 'Selection' | 'Maps' | '3D';
  action: string;
  keys: string;
}

export const HOTKEYS: HotkeyDefinition[] = [
  { id: 'command_palette', category: 'Global', action: 'Command palette', keys: 'Ctrl/Cmd+K' },
  { id: 'search_focus', category: 'Global', action: 'Search focus', keys: 'Ctrl/Cmd+F' },
  { id: 'undo', category: 'Global', action: 'Undo', keys: 'Ctrl/Cmd+Z' },
  { id: 'redo', category: 'Global', action: 'Redo', keys: 'Ctrl/Cmd+Shift+Z' },
  { id: 'duplicate_selection', category: 'Global', action: 'Duplicate selection', keys: 'Ctrl/Cmd+D' },
  { id: 'delete_selection', category: 'Global', action: 'Delete selection', keys: 'Delete / Backspace' },
  { id: 'deselect', category: 'Global', action: 'Deselect / exit', keys: 'Esc' },
  { id: 'toggle_explorer', category: 'Layout', action: 'Toggle explorer', keys: 'Ctrl/Cmd+B' },
  { id: 'toggle_inspector', category: 'Layout', action: 'Toggle inspector', keys: 'Ctrl/Cmd+I' },
  { id: 'toggle_drawer', category: 'Layout', action: 'Toggle drawer', keys: 'Ctrl/Cmd+J' },
  { id: 'focus_mode', category: 'Layout', action: 'Focus mode', keys: 'F' },
  { id: 'view_plan', category: 'View', action: 'Plan view', keys: 'Alt+1' },
  { id: 'view_second', category: 'View', action: 'Second view', keys: 'Alt+2' },
  { id: 'view_third', category: 'View', action: 'Third view', keys: 'Alt+3' },
  { id: 'view_first', category: 'View', action: 'First view', keys: 'Alt+4' },
  { id: 'fit_view', category: 'View', action: 'Fit view', keys: 'Ctrl/Cmd+0' },
  { id: 'frame_selection', category: 'View', action: 'Frame selection', keys: 'Ctrl/Cmd+Alt+0' },
  { id: 'toggle_grid', category: 'View', action: 'Toggle grid', keys: 'G' },
  { id: 'toggle_minimap', category: 'View', action: 'Toggle minimap', keys: 'Shift+G' },
  { id: 'tool_select', category: 'Tools', action: 'Select tool', keys: 'V' },
  { id: 'tool_room', category: 'Tools', action: 'Room tool', keys: 'R' },
  { id: 'tool_corridor', category: 'Tools', action: 'Corridor tool', keys: 'C' },
  { id: 'tool_wall', category: 'Tools', action: 'Wall tool', keys: 'W' },
  { id: 'tool_door', category: 'Tools', action: 'Door tool', keys: 'D' },
  { id: 'tool_prop', category: 'Tools', action: 'Prop tool', keys: 'P' },
  { id: 'tool_marker', category: 'Tools', action: 'Marker tool', keys: 'M' },
  { id: 'tool_note', category: 'Tools', action: 'Note tool', keys: 'N' },
  { id: 'tool_anchor', category: 'Tools', action: 'Anchor tool', keys: 'A' },
  { id: 'tool_route', category: 'Tools', action: 'Route tool', keys: 'T' },
  { id: 'tool_sketch', category: 'Tools', action: 'Sketch tool', keys: 'K' },
  { id: 'tool_erase', category: 'Tools', action: 'Erase tool', keys: 'E' },
  { id: 'tool_measure', category: 'Tools', action: 'Measure tool', keys: 'I' },
  { id: 'room_edit', category: 'Room', action: 'Toggle footprint edit', keys: 'Enter' },
  { id: 'room_subtract', category: 'Room', action: 'Subtract while painting', keys: 'Alt (hold)' },
  { id: 'brush_size', category: 'Room', action: 'Brush size down / up', keys: '[ / ]' },
  { id: 'door_cycle_style', category: 'Door', action: 'Cycle door style', keys: 'Shift+D' },
  { id: 'door_cycle_transition', category: 'Door', action: 'Cycle transition type', keys: 'Alt+D' },
  { id: 'selection_state', category: 'Selection', action: 'Cycle entity state', keys: 'Q' },
  { id: 'next_map', category: 'Maps', action: 'Next map tab', keys: 'Ctrl/Cmd+PageDown' },
  { id: 'prev_map', category: 'Maps', action: 'Previous map tab', keys: 'Ctrl/Cmd+PageUp' },
  { id: 'move_3d', category: '3D', action: 'Move', keys: 'WASD' },
  { id: 'sprint_3d', category: '3D', action: 'Sprint', keys: 'Shift' },
  { id: 'crouch_3d', category: '3D', action: 'Crouch', keys: 'Ctrl' },
  { id: 'exit_3d', category: '3D', action: 'Exit walk/follow', keys: 'Esc' },
];

export const HOTKEY_BY_ID = Object.fromEntries(HOTKEYS.map((entry) => [entry.id, entry])) as Record<string, HotkeyDefinition>;

export const getHotkeyLabel = (id: string) => HOTKEY_BY_ID[id]?.keys ?? '';

export const formatHotkeyHelp = () => {
  const grouped = new Map<HotkeyDefinition['category'], HotkeyDefinition[]>();
  for (const hotkey of HOTKEYS) {
    const current = grouped.get(hotkey.category) ?? [];
    current.push(hotkey);
    grouped.set(hotkey.category, current);
  }
  return [...grouped.entries()].map(([category, entries]) => ({
    category,
    entries,
  }));
};
