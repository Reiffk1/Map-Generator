export type TutorialTrigger =
  | 'map-created'
  | 'room-drawn'
  | 'corridor-drawn'
  | 'door-placed'
  | 'transition-linked'
  | 'annotation-added'
  | 'navigate-mode'
  | 'map-travelled'
  | 'review-opened';

export type TutorialActionId =
  | 'create-map'
  | 'equip-room'
  | 'equip-corridor'
  | 'equip-door'
  | 'seed-link-target'
  | 'equip-note'
  | 'switch-navigate'
  | 'open-review';

export interface TutorialStepDefinition {
  id: string;
  selector: string;
  title: string;
  body: string;
  cardPlacement?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  actionId?: TutorialActionId;
  actionLabel?: string;
  expectedTrigger?: TutorialTrigger;
}

export const tutorialSteps: TutorialStepDefinition[] = [
  {
    id: 'create-map',
    selector: '[data-testid="new-map-button"]',
    title: 'Create or open a map',
    body: 'The explorer is your launch point. Start a tutorial practice map here so the rest of the walkthrough happens on a clean floorplan.',
    actionId: 'create-map',
    actionLabel: 'Create Practice Map',
    expectedTrigger: 'map-created',
  },
  {
    id: 'draw-room',
    selector: '[data-testid="tool-floorRoom"]',
    title: 'Draw a room first',
    body: 'Floorplan mode starts with literal geometry. Equip the room tool, then click-drag inside the canvas to block out a chamber.',
    actionId: 'equip-room',
    actionLabel: 'Equip Room Tool',
    expectedTrigger: 'room-drawn',
  },
  {
    id: 'draw-corridor',
    selector: '[data-testid="tool-corridor"]',
    title: 'Connect it with a corridor',
    body: 'Corridors are now first-class layout primitives. Drag a hallway path and it will auto-join against nearby room edges.',
    actionId: 'equip-corridor',
    actionLabel: 'Equip Corridor Tool',
    expectedTrigger: 'corridor-drawn',
  },
  {
    id: 'place-door',
    selector: '[data-testid="tool-doorway"]',
    title: 'Place a doorway or transition',
    body: 'Doorways snap against room or corridor edges. Use them for doors, stairs, ladders, or warps depending on the active preset.',
    actionId: 'equip-door',
    actionLabel: 'Equip Door Tool',
    expectedTrigger: 'door-placed',
  },
  {
    id: 'link-door',
    selector: '[data-testid="inspector-tab-links"]',
    title: 'Link that doorway to another map',
    body: 'The links inspector can pair transitions across maps. Create a tutorial destination map, then use the pairing suggestion to complete the link.',
    cardPlacement: 'bottom-left',
    actionId: 'seed-link-target',
    actionLabel: 'Create Destination Map',
    expectedTrigger: 'transition-linked',
  },
  {
    id: 'add-note',
    selector: '[data-testid="tool-note"]',
    title: 'Layer notes and overlays',
    body: 'Add notes, loot markers, secrets, and hazards after the floorplan is in place. This keeps the geometry readable while you annotate your discoveries.',
    actionId: 'equip-note',
    actionLabel: 'Equip Note Tool',
    expectedTrigger: 'annotation-added',
  },
  {
    id: 'navigate-mode',
    selector: '[data-testid="mode-navigate"]',
    title: 'Switch into Navigate mode',
    body: 'Navigate mode turns linked exits into travel controls so you can move between maps without accidentally editing the drawing.',
    actionId: 'switch-navigate',
    actionLabel: 'Switch To Navigate',
    expectedTrigger: 'navigate-mode',
  },
  {
    id: 'travel',
    selector: '[data-testid="map-canvas"]',
    title: 'Travel through the linked transition',
    body: 'Use the linked doorway hotspot on the canvas to jump into the destination map you just paired.',
    expectedTrigger: 'map-travelled',
  },
  {
    id: 'review',
    selector: '[data-testid="drawer-tab-review"]',
    title: 'Use review and revisit tools',
    body: 'The bottom drawer keeps outstanding link gaps, revisit tasks, route planning, and search results visible while you work.',
    cardPlacement: 'top-right',
    actionId: 'open-review',
    actionLabel: 'Open Review Drawer',
    expectedTrigger: 'review-opened',
  },
];
