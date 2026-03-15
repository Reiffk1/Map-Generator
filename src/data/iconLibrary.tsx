/* eslint-disable react-refresh/only-export-components */
import type { ReactNode } from 'react';

export type IconTone = 'ink' | 'fill' | 'accent' | 'muted' | 'none';

export type IconPrimitive =
  | {
      kind: 'path';
      d: string;
      fill?: IconTone;
      stroke?: IconTone;
      strokeWidth?: number;
      opacity?: number;
    }
  | {
      kind: 'circle';
      cx: number;
      cy: number;
      r: number;
      fill?: IconTone;
      stroke?: IconTone;
      strokeWidth?: number;
      opacity?: number;
    }
  | {
      kind: 'rect';
      x: number;
      y: number;
      width: number;
      height: number;
      rx?: number;
      fill?: IconTone;
      stroke?: IconTone;
      strokeWidth?: number;
      opacity?: number;
    }
  | {
      kind: 'poly';
      points: number[];
      fill?: IconTone;
      stroke?: IconTone;
      strokeWidth?: number;
      closed?: boolean;
      dash?: number[];
      opacity?: number;
    };

export interface IconPalette {
  ink: string;
  fill: string;
  accent: string;
  muted: string;
}

export interface CartographyIconDefinition {
  id: string;
  label: string;
  category:
    | 'Traversal'
    | 'Encounters'
    | 'Resources'
    | 'Story'
    | 'Planning'
    | 'Meta';
  keywords: string[];
  primitives: IconPrimitive[];
}

const baseStroke = 1.75;

const createIcon = (
  id: CartographyIconDefinition['id'],
  label: string,
  category: CartographyIconDefinition['category'],
  keywords: string[],
  primitives: IconPrimitive[],
): CartographyIconDefinition => ({
  id,
  label,
  category,
  keywords,
  primitives,
});

export const builtInIconLibrary: CartographyIconDefinition[] = [
  createIcon('door', 'Door', 'Traversal', ['entry', 'room', 'open'], [
    { kind: 'rect', x: 6, y: 4.5, width: 12, height: 15, rx: 2, fill: 'none', stroke: 'ink', strokeWidth: baseStroke },
    { kind: 'path', d: 'M11 7.5v9', stroke: 'ink', strokeWidth: baseStroke },
    { kind: 'circle', cx: 14.25, cy: 12, r: 0.95, fill: 'accent' },
  ]),
  createIcon('locked-door', 'Locked Door', 'Traversal', ['lock', 'key', 'gate'], [
    { kind: 'rect', x: 5.5, y: 5, width: 11.5, height: 14.5, rx: 2, fill: 'none', stroke: 'ink', strokeWidth: baseStroke },
    { kind: 'rect', x: 13.5, y: 11.5, width: 5, height: 4.5, rx: 1, fill: 'fill', stroke: 'ink', strokeWidth: 1.3 },
    { kind: 'path', d: 'M15 11.5V10a1.75 1.75 0 1 1 3.5 0v1.5', stroke: 'ink', strokeWidth: 1.3 },
  ]),
  createIcon('one-way-door', 'One-Way Door', 'Traversal', ['arrow', 'single'], [
    { kind: 'rect', x: 5.5, y: 5, width: 8.5, height: 14, rx: 2, fill: 'none', stroke: 'ink', strokeWidth: baseStroke },
    { kind: 'poly', points: [13, 12, 19, 12, 16.5, 9.5, 19, 12, 16.5, 14.5], stroke: 'accent', fill: 'none', strokeWidth: 1.8 },
  ]),
  createIcon('secret-door', 'Secret Door', 'Traversal', ['hidden', 'illusion', 'wall'], [
    { kind: 'rect', x: 6, y: 5, width: 12, height: 14, rx: 2, fill: 'none', stroke: 'ink', strokeWidth: baseStroke, opacity: 0.9 },
    { kind: 'poly', points: [5.5, 9, 8.5, 9, 8.5, 11, 11.5, 11, 11.5, 13, 14.5, 13, 14.5, 15, 18.5, 15], stroke: 'muted', fill: 'none', strokeWidth: 1.35, dash: [2, 2] },
    { kind: 'path', d: 'M15.5 4.5 16.3 6.7 18.5 7.5 16.3 8.3 15.5 10.5 14.7 8.3 12.5 7.5 14.7 6.7Z', fill: 'accent', stroke: 'none' },
  ]),
  createIcon('gate', 'Gate', 'Traversal', ['bars', 'fence'], [
    { kind: 'path', d: 'M6 19V8.5C6 6 8.2 4 11 4h2c2.8 0 5 2 5 4.5V19', stroke: 'ink', strokeWidth: baseStroke },
    { kind: 'poly', points: [9, 8, 9, 19, 12, 8, 12, 19, 15, 8, 15, 19], stroke: 'accent', fill: 'none', strokeWidth: 1.5 },
  ]),
  createIcon('portcullis', 'Portcullis', 'Traversal', ['gate', 'bars', 'grate'], [
    { kind: 'path', d: 'M5.5 19V8.5C5.5 6 7.9 4 10.9 4h2.2c3 0 5.4 2 5.4 4.5V19', stroke: 'ink', strokeWidth: baseStroke },
    { kind: 'poly', points: [8.2, 8.2, 8.2, 18.2, 11.2, 8.2, 11.2, 18.2, 14.2, 8.2, 14.2, 18.2, 17.2, 8.2, 17.2, 18.2], stroke: 'accent', fill: 'none', strokeWidth: 1.35 },
    { kind: 'poly', points: [8.2, 18.2, 9.1, 20, 10, 18.2, 11.2, 18.2, 12.1, 20, 13, 18.2, 14.2, 18.2, 15.1, 20, 16, 18.2, 17.2, 18.2], stroke: 'accent', fill: 'none', strokeWidth: 1.1 },
  ]),
  createIcon('stairs-up', 'Stairs Up', 'Traversal', ['ascend', 'floor'], [
    { kind: 'poly', points: [5, 18, 10, 18, 10, 14, 14, 14, 14, 10, 18.5, 10], stroke: 'ink', fill: 'none', strokeWidth: baseStroke },
    { kind: 'poly', points: [12, 6.5, 12, 14, 9.5, 9.5, 12, 6.5, 14.5, 9.5], stroke: 'accent', fill: 'none', strokeWidth: 1.75 },
  ]),
  createIcon('stairs-down', 'Stairs Down', 'Traversal', ['descend', 'floor'], [
    { kind: 'poly', points: [5, 10, 10, 10, 10, 14, 14, 14, 14, 18, 18.5, 18], stroke: 'ink', fill: 'none', strokeWidth: baseStroke },
    { kind: 'poly', points: [12, 17.5, 12, 10, 9.5, 14.5, 12, 17.5, 14.5, 14.5], stroke: 'accent', fill: 'none', strokeWidth: 1.75 },
  ]),
  createIcon('ladder', 'Ladder', 'Traversal', ['climb', 'vertical'], [
    { kind: 'poly', points: [8, 5, 8, 19, 16, 5, 16, 19], stroke: 'ink', fill: 'none', strokeWidth: baseStroke },
    { kind: 'poly', points: [8, 8, 16, 8, 8, 11.5, 16, 11.5, 8, 15, 16, 15], stroke: 'accent', fill: 'none', strokeWidth: 1.35 },
  ]),
  createIcon('warp', 'Warp', 'Traversal', ['portal', 'teleport'], [
    { kind: 'circle', cx: 12, cy: 12, r: 7, fill: 'none', stroke: 'ink', strokeWidth: baseStroke },
    { kind: 'path', d: 'M9 13.5c.7 1.9 3.5 3 5.7 1.9 1.7-.8 2.8-2.8 2.3-4.6-.6-2.2-3.1-3.8-5.8-3.2-2.7.6-4.6 3-4.7 5.7 0 3.4 3.2 5.8 6.6 5.5', stroke: 'accent', strokeWidth: 1.8 },
    { kind: 'circle', cx: 17.6, cy: 7.2, r: 1.2, fill: 'accent' },
  ]),
  createIcon('shortcut', 'Shortcut', 'Traversal', ['branch', 'route', 'fast'], [
    { kind: 'poly', points: [6, 6, 6, 18, 13, 18], stroke: 'ink', fill: 'none', strokeWidth: baseStroke },
    { kind: 'poly', points: [10, 7, 18, 7, 14.8, 4, 18, 7, 14.8, 10], stroke: 'accent', fill: 'none', strokeWidth: 1.7 },
  ]),
  createIcon('breakable-wall', 'Breakable Wall', 'Traversal', ['wall', 'crack'], [
    { kind: 'rect', x: 4.5, y: 6.5, width: 15, height: 11, rx: 1.5, fill: 'none', stroke: 'ink', strokeWidth: baseStroke },
    { kind: 'poly', points: [9, 7, 11, 10.5, 9.8, 10.5, 12.5, 15, 11.3, 15, 14, 18], stroke: 'accent', fill: 'none', strokeWidth: 1.6 },
    { kind: 'poly', points: [8, 10, 16, 10, 8, 14, 16, 14], stroke: 'muted', fill: 'none', strokeWidth: 1.1 },
  ]),
  createIcon('enemy', 'Enemy', 'Encounters', ['fight', 'mob'], [
    { kind: 'poly', points: [12, 4.5, 18.5, 10.5, 16.5, 19, 7.5, 19, 5.5, 10.5], fill: 'fill', stroke: 'ink', strokeWidth: 1.35, closed: true },
    { kind: 'circle', cx: 9.3, cy: 11.3, r: 0.9, fill: 'ink' },
    { kind: 'circle', cx: 14.7, cy: 11.3, r: 0.9, fill: 'ink' },
    { kind: 'path', d: 'M9 15c1 .8 1.9 1.1 3 1.1s2-.3 3-1.1', stroke: 'accent', strokeWidth: 1.4 },
  ]),
  createIcon('boss', 'Boss', 'Encounters', ['danger', 'major', 'crown'], [
    { kind: 'circle', cx: 12, cy: 13, r: 6.5, fill: 'fill', stroke: 'ink', strokeWidth: 1.4 },
    { kind: 'poly', points: [6, 7.5, 8.8, 4.5, 12, 8, 15.2, 4.5, 18, 7.5, 18, 10.5, 6, 10.5], fill: 'accent', stroke: 'ink', strokeWidth: 1.2, closed: true },
    { kind: 'circle', cx: 9.5, cy: 13, r: 0.8, fill: 'ink' },
    { kind: 'circle', cx: 14.5, cy: 13, r: 0.8, fill: 'ink' },
  ]),
  createIcon('hazard', 'Hazard', 'Encounters', ['trap', 'danger'], [
    { kind: 'poly', points: [12, 4.5, 19, 18.5, 5, 18.5], fill: 'fill', stroke: 'ink', strokeWidth: 1.4, closed: true },
    { kind: 'path', d: 'M12 8v5.7', stroke: 'accent', strokeWidth: 1.9 },
    { kind: 'circle', cx: 12, cy: 16.2, r: 1, fill: 'accent' },
  ]),
  createIcon('puzzle', 'Puzzle', 'Encounters', ['switch', 'mystery', 'lever'], [
    { kind: 'path', d: 'M8 6h3a2 2 0 1 1 4 0h3v4a2 2 0 1 1 0 4v4h-4a2 2 0 1 1-4 0H6v-4a2 2 0 1 1 0-4Z', fill: 'fill', stroke: 'ink', strokeWidth: 1.4 },
    { kind: 'path', d: 'M10 10h4v4h-4Z', fill: 'accent', stroke: 'none' },
  ]),
  createIcon('switch', 'Switch', 'Encounters', ['lever', 'trigger', 'plate'], [
    { kind: 'rect', x: 5, y: 15, width: 14, height: 3.5, rx: 1.5, fill: 'fill', stroke: 'ink', strokeWidth: 1.25 },
    { kind: 'path', d: 'M12 15V7', stroke: 'ink', strokeWidth: 1.75 },
    { kind: 'circle', cx: 12, cy: 7, r: 2.4, fill: 'accent', stroke: 'ink', strokeWidth: 1.2 },
  ]),
  createIcon('loot', 'Loot', 'Resources', ['pickup', 'treasure'], [
    { kind: 'poly', points: [12, 4.5, 18, 10, 14.2, 19, 9.8, 19, 6, 10], fill: 'fill', stroke: 'ink', strokeWidth: 1.35, closed: true },
    { kind: 'path', d: 'M12 7.2 13.4 10H17l-2.8 2 1.1 3.2-2.9-1.8-2.8 1.8 1-3.2-2.8-2h3.6Z', fill: 'accent', stroke: 'none' },
  ]),
  createIcon('chest', 'Chest', 'Resources', ['box', 'treasure'], [
    { kind: 'rect', x: 5.5, y: 9, width: 13, height: 9, rx: 2, fill: 'fill', stroke: 'ink', strokeWidth: 1.4 },
    { kind: 'path', d: 'M5.5 11.5c.8-2.4 3.2-4 6.5-4s5.7 1.6 6.5 4', stroke: 'ink', strokeWidth: 1.4 },
    { kind: 'rect', x: 10.7, y: 11.5, width: 2.6, height: 3.4, rx: 0.8, fill: 'accent', stroke: 'ink', strokeWidth: 1.1 },
  ]),
  createIcon('barrel', 'Barrel', 'Resources', ['barrel', 'cask'], [
    { kind: 'path', d: 'M8 6.5c1.7-1 6.3-1 8 0m-8 11c1.7 1 6.3 1 8 0', stroke: 'ink', strokeWidth: 1.35 },
    { kind: 'rect', x: 7.2, y: 6.5, width: 9.6, height: 11, rx: 4.8, fill: 'fill', stroke: 'ink', strokeWidth: 1.35 },
    { kind: 'path', d: 'M8.2 9.2h7.6M8.2 14.8h7.6', stroke: 'accent', strokeWidth: 1.2 },
  ]),
  createIcon('crate', 'Crate', 'Resources', ['crate', 'box'], [
    { kind: 'rect', x: 5.5, y: 5.5, width: 13, height: 13, rx: 1.4, fill: 'fill', stroke: 'ink', strokeWidth: 1.35 },
    { kind: 'path', d: 'M8 8l8 8M16 8l-8 8M6.5 12h11M12 6.5v11', stroke: 'accent', strokeWidth: 1.2 },
  ]),
  createIcon('key-item', 'Key Item', 'Resources', ['key', 'important'], [
    { kind: 'circle', cx: 9, cy: 10, r: 3.4, fill: 'none', stroke: 'ink', strokeWidth: 1.6 },
    { kind: 'path', d: 'M12.2 10h6.2M15.2 10v2.2M17.4 10v3.4', stroke: 'accent', strokeWidth: 1.7 },
  ]),
  createIcon('save-point', 'Save Point', 'Resources', ['heal', 'crystal', 'checkpoint'], [
    { kind: 'poly', points: [12, 4.5, 16.5, 9.5, 15, 17.8, 9, 17.8, 7.5, 9.5], fill: 'fill', stroke: 'ink', strokeWidth: 1.35, closed: true },
    { kind: 'path', d: 'M12 6.5v9.2', stroke: 'accent', strokeWidth: 1.5 },
    { kind: 'path', d: 'M8.8 10.5c1.6-.9 4.8-.9 6.4 0', stroke: 'accent', strokeWidth: 1.5 },
  ]),
  createIcon('shop', 'Shop', 'Resources', ['merchant', 'vendor'], [
    { kind: 'rect', x: 5.5, y: 11, width: 13, height: 7.5, rx: 1.2, fill: 'fill', stroke: 'ink', strokeWidth: 1.35 },
    { kind: 'path', d: 'M4.5 11 6.5 6h11l2 5H4.5Z', fill: 'accent', stroke: 'ink', strokeWidth: 1.2 },
    { kind: 'path', d: 'M10 18.5v-4.6h4v4.6', stroke: 'ink', strokeWidth: 1.25 },
  ]),
  createIcon('npc', 'NPC', 'Story', ['person', 'talk'], [
    { kind: 'circle', cx: 12, cy: 8, r: 3, fill: 'fill', stroke: 'ink', strokeWidth: 1.3 },
    { kind: 'path', d: 'M7.5 18c.9-3.3 3-5 4.5-5s3.6 1.7 4.5 5', stroke: 'ink', strokeWidth: 1.7 },
    { kind: 'path', d: 'M17.8 8.2h2.7v2.1l-1.1-.7-.9.7V8.2Z', fill: 'accent', stroke: 'none' },
  ]),
  createIcon('quest-giver', 'Quest Giver', 'Story', ['ally', 'mission', 'task'], [
    { kind: 'circle', cx: 11, cy: 8, r: 3, fill: 'fill', stroke: 'ink', strokeWidth: 1.3 },
    { kind: 'path', d: 'M6.5 18c1-3.3 3.1-5.2 4.5-5.2s3.5 1.9 4.5 5.2', stroke: 'ink', strokeWidth: 1.7 },
    { kind: 'path', d: 'M18.2 4.8 18.8 6.5 20.5 7.1 18.8 7.7 18.2 9.4 17.6 7.7 15.9 7.1 17.6 6.5Z', fill: 'accent', stroke: 'none' },
  ]),
  createIcon('lore', 'Lore Item', 'Story', ['book', 'scroll', 'clue'], [
    { kind: 'rect', x: 6, y: 5.5, width: 12, height: 13, rx: 2, fill: 'fill', stroke: 'ink', strokeWidth: 1.3 },
    { kind: 'path', d: 'M9 8.5h6M9 11.5h6M9 14.5h4.5', stroke: 'accent', strokeWidth: 1.5 },
    { kind: 'path', d: 'M12 5.5v13', stroke: 'muted', strokeWidth: 1.05 },
  ]),
  createIcon('cutscene', 'Cutscene', 'Story', ['event', 'story'], [
    { kind: 'rect', x: 4.5, y: 6.2, width: 15, height: 11.6, rx: 2, fill: 'fill', stroke: 'ink', strokeWidth: 1.35 },
    { kind: 'poly', points: [10, 9, 15.5, 12, 10, 15], fill: 'accent', stroke: 'none', closed: true },
    { kind: 'poly', points: [6, 4.8, 8, 6.2, 10, 4.8, 12, 6.2, 14, 4.8, 16, 6.2, 18, 4.8], stroke: 'ink', fill: 'none', strokeWidth: 1.05 },
  ]),
  createIcon('return-later', 'Return Later', 'Planning', ['queue', 'revisit', 'clock'], [
    { kind: 'circle', cx: 12, cy: 12, r: 7, fill: 'none', stroke: 'ink', strokeWidth: 1.5 },
    { kind: 'path', d: 'M12 8v4.8l3.2 1.8', stroke: 'accent', strokeWidth: 1.75 },
    { kind: 'poly', points: [7.2, 5.5, 4.8, 5.5, 4.8, 7.9], stroke: 'ink', fill: 'none', strokeWidth: 1.45 },
  ]),
  createIcon('needs-key', 'Needs Key', 'Planning', ['blocked', 'requirement', 'key'], [
    { kind: 'rect', x: 7, y: 10.5, width: 10, height: 7, rx: 1.4, fill: 'fill', stroke: 'ink', strokeWidth: 1.3 },
    { kind: 'path', d: 'M9.3 10.5V9a2.7 2.7 0 1 1 5.4 0v1.5', stroke: 'ink', strokeWidth: 1.3 },
    { kind: 'path', d: 'M6 7.2a2.2 2.2 0 1 1 4.4 0M8.2 7.2h7.4M13.5 7.2v2M15.8 7.2v3', stroke: 'accent', strokeWidth: 1.35 },
  ]),
  createIcon('uncertain-route', 'Uncertain Route', 'Planning', ['unknown', 'speculative'], [
    { kind: 'path', d: 'M5.5 15c2-5.8 5.4-8 8-8 3.1 0 5 2.1 5 4.9 0 3.1-2.7 5.6-5.7 5.6', stroke: 'ink', strokeWidth: 1.7 },
    { kind: 'path', d: 'M12.2 18.4a1.1 1.1 0 1 1 0 2.2 1.1 1.1 0 0 1 0-2.2Zm-1.8-7.9c0-1.7 1.2-3 3-3 1.6 0 2.7.9 2.7 2.4 0 1.1-.7 1.9-1.8 2.6-.9.6-1.2 1-1.2 1.9', stroke: 'accent', strokeWidth: 1.45 },
  ]),
  createIcon('possible-secret', 'Possible Secret', 'Planning', ['hint', 'suspicion'], [
    { kind: 'path', d: 'M4.8 12c1.8-3.5 4.5-5.2 7.2-5.2S17.4 8.5 19.2 12c-1.8 3.5-4.5 5.2-7.2 5.2S6.6 15.5 4.8 12Z', fill: 'fill', stroke: 'ink', strokeWidth: 1.3 },
    { kind: 'circle', cx: 12, cy: 12, r: 2.4, fill: 'accent', stroke: 'ink', strokeWidth: 1.1 },
    { kind: 'path', d: 'M18.5 5.2 19.1 6.6 20.5 7.2 19.1 7.8 18.5 9.2 17.9 7.8 16.5 7.2 17.9 6.6Z', fill: 'accent', stroke: 'none' },
  ]),
  createIcon('dead-end', 'Dead End', 'Planning', ['stop', 'closed'], [
    { kind: 'path', d: 'M5 12h10.5', stroke: 'ink', strokeWidth: 1.9 },
    { kind: 'path', d: 'M16.5 7v10', stroke: 'accent', strokeWidth: 2.2 },
    { kind: 'circle', cx: 6.2, cy: 12, r: 1.2, fill: 'ink' },
  ]),
  createIcon('missable', 'Missable', 'Planning', ['time', 'warning'], [
    { kind: 'path', d: 'M8 4.8h8M8 19.2h8', stroke: 'ink', strokeWidth: 1.5 },
    { kind: 'path', d: 'M8.8 6.2c0 2.6 2.8 3 3.2 5.3.4 2.2-1.5 2.7-1.5 5.3m4.7-10.6c0 2.6-2.8 3-3.2 5.3-.4 2.2 1.5 2.7 1.5 5.3', stroke: 'accent', strokeWidth: 1.5 },
  ]),
  createIcon('completed', 'Completed', 'Meta', ['check', 'done', 'cleared'], [
    { kind: 'circle', cx: 12, cy: 12, r: 7, fill: 'fill', stroke: 'ink', strokeWidth: 1.4 },
    { kind: 'poly', points: [8.1, 12.4, 10.7, 15, 16.4, 9.2], stroke: 'accent', fill: 'none', strokeWidth: 2.05 },
  ]),
  createIcon('revisited', 'Revisited', 'Meta', ['repeat', 'loop'], [
    { kind: 'path', d: 'M17.2 8.3A6.4 6.4 0 0 0 6 11.1M6.8 15.7A6.4 6.4 0 0 0 18 12.9', stroke: 'ink', strokeWidth: 1.65 },
    { kind: 'poly', points: [17.2, 8.3, 19.2, 8.5, 18.4, 10.5], stroke: 'accent', fill: 'none', strokeWidth: 1.55 },
    { kind: 'poly', points: [6.8, 15.7, 4.8, 15.5, 5.6, 13.5], stroke: 'accent', fill: 'none', strokeWidth: 1.55 },
  ]),
  createIcon('note-pin', 'Note Pin', 'Meta', ['annotation', 'memo'], [
    { kind: 'circle', cx: 12, cy: 8, r: 3.4, fill: 'accent', stroke: 'ink', strokeWidth: 1.2 },
    { kind: 'path', d: 'M12 11.4v7.8', stroke: 'ink', strokeWidth: 1.8 },
    { kind: 'poly', points: [10.8, 18.2, 12, 20.5, 13.2, 18.2], fill: 'ink', stroke: 'none', closed: true },
  ]),
  createIcon('question-mark', 'Question', 'Meta', ['unknown', 'mystery'], [
    { kind: 'path', d: 'M9 9.5a3.3 3.3 0 1 1 6.5.8c0 1.6-.7 2.4-2.1 3.3-1.1.7-1.6 1.4-1.6 2.4', stroke: 'ink', strokeWidth: 1.85 },
    { kind: 'circle', cx: 11.9, cy: 18, r: 1.1, fill: 'accent' },
  ]),
  createIcon('exclamation-mark', 'Attention', 'Meta', ['important', 'alert'], [
    { kind: 'path', d: 'M12 5.5v9.2', stroke: 'ink', strokeWidth: 2.15 },
    { kind: 'circle', cx: 12, cy: 18.3, r: 1.25, fill: 'accent' },
  ]),
];

export const iconCategories = [
  'Traversal',
  'Encounters',
  'Resources',
  'Story',
  'Planning',
  'Meta',
] as const;

export const iconPaletteDefaults: IconPalette = {
  ink: '#f4f2ff',
  fill: '#1b2338',
  accent: '#7be0c1',
  muted: '#8b93af',
};

const toneToColor = (tone: IconTone | undefined, palette: IconPalette) => {
  switch (tone) {
    case 'ink':
      return palette.ink;
    case 'fill':
      return palette.fill;
    case 'accent':
      return palette.accent;
    case 'muted':
      return palette.muted;
    case 'none':
      return 'transparent';
    default:
      return undefined;
  }
};

const renderPrimitiveSvg = (
  primitive: IconPrimitive,
  palette: IconPalette,
  key: string,
): ReactNode => {
  if (primitive.kind === 'path') {
    return (
      <path
        key={key}
        d={primitive.d}
        fill={toneToColor(primitive.fill, palette) ?? 'none'}
        opacity={primitive.opacity}
        stroke={toneToColor(primitive.stroke, palette)}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={primitive.strokeWidth}
      />
    );
  }

  if (primitive.kind === 'circle') {
    return (
      <circle
        key={key}
        cx={primitive.cx}
        cy={primitive.cy}
        fill={toneToColor(primitive.fill, palette) ?? 'none'}
        opacity={primitive.opacity}
        r={primitive.r}
        stroke={toneToColor(primitive.stroke, palette)}
        strokeWidth={primitive.strokeWidth}
      />
    );
  }

  if (primitive.kind === 'rect') {
    return (
      <rect
        key={key}
        fill={toneToColor(primitive.fill, palette) ?? 'none'}
        height={primitive.height}
        opacity={primitive.opacity}
        rx={primitive.rx}
        stroke={toneToColor(primitive.stroke, palette)}
        strokeLinejoin="round"
        strokeWidth={primitive.strokeWidth}
        width={primitive.width}
        x={primitive.x}
        y={primitive.y}
      />
    );
  }

  return (
    <polyline
      key={key}
      fill={primitive.closed ? toneToColor(primitive.fill, palette) ?? 'none' : 'none'}
      opacity={primitive.opacity}
      points={primitive.points.join(' ')}
      stroke={toneToColor(primitive.stroke, palette)}
      strokeDasharray={primitive.dash?.join(' ')}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={primitive.strokeWidth}
    />
  );
};

export const findBuiltInIcon = (iconId: string) =>
  builtInIconLibrary.find((icon) => icon.id === iconId) ?? builtInIconLibrary[0];

export interface SvgIconProps {
  iconId: string;
  size?: number;
  className?: string;
  palette?: Partial<IconPalette>;
}

export function SvgMapIcon({
  iconId,
  size = 20,
  className,
  palette,
}: SvgIconProps) {
  const icon = findBuiltInIcon(iconId);
  const resolvedPalette = { ...iconPaletteDefaults, ...palette };

  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      height={size}
      viewBox="0 0 24 24"
      width={size}
      xmlns="http://www.w3.org/2000/svg"
    >
      {icon.primitives.map((primitive, index) =>
        renderPrimitiveSvg(primitive, resolvedPalette, `${icon.id}_${index}`),
      )}
    </svg>
  );
}
