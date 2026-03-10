import { clsx } from 'clsx';
import { customAlphabet } from 'nanoid';

import type { Bounds, Point } from '../models/types';

export const cx = (...inputs: Parameters<typeof clsx>) => clsx(inputs);

const nano = customAlphabet('1234567890abcdefghijklmnopqrstuvwxyz', 10);

export const makeId = (prefix: string) => `${prefix}_${nano()}`;

export const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export const round = (value: number, precision = 1) => {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
};

export const distanceBetween = (a: Point, b: Point) => {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
};

export const pointEquals = (a?: Point, b?: Point) =>
  Boolean(a && b && a.x === b.x && a.y === b.y);

export const toBoundsFromPoints = (points: Point[]): Bounds => {
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const maxX = Math.max(...xs);
  const maxY = Math.max(...ys);

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
};

export const offsetBounds = (bounds: Bounds, offset: Point): Bounds => ({
  x: bounds.x + offset.x,
  y: bounds.y + offset.y,
  width: bounds.width,
  height: bounds.height,
});

export const centerOfBounds = (bounds: Bounds): Point => ({
  x: bounds.x + bounds.width / 2,
  y: bounds.y + bounds.height / 2,
});

export const centerOfRect = (
  x: number,
  y: number,
  width: number,
  height: number,
): Point => ({
  x: x + width / 2,
  y: y + height / 2,
});

export const normalizeText = (value: string) => value.trim().toLowerCase();

export const includesFuzzy = (value: string, query: string) =>
  normalizeText(value).includes(normalizeText(query));

export const formatRelativeTime = (isoString: string) => {
  const value = new Date(isoString).getTime();
  const now = Date.now();
  const deltaMs = now - value;
  const deltaMinutes = Math.floor(deltaMs / 60000);

  if (deltaMinutes < 1) return 'just now';
  if (deltaMinutes < 60) return `${deltaMinutes}m ago`;
  const deltaHours = Math.floor(deltaMinutes / 60);
  if (deltaHours < 24) return `${deltaHours}h ago`;
  const deltaDays = Math.floor(deltaHours / 24);
  if (deltaDays < 7) return `${deltaDays}d ago`;
  return new Date(isoString).toLocaleDateString();
};

export const downloadTextFile = (filename: string, content: string, mime: string) => {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
};

export const downloadDataUrl = (filename: string, dataUrl: string) => {
  const anchor = document.createElement('a');
  anchor.href = dataUrl;
  anchor.download = filename;
  anchor.click();
};

export const deepClone = <T,>(value: T): T => structuredClone(value);

export const toHexWithAlpha = (hex: string, alpha: number) => {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return hex;
  const alphaHex = Math.round(clamp(alpha, 0, 1) * 255)
    .toString(16)
    .padStart(2, '0');
  return `#${clean}${alphaHex}`;
};

export const averagePoint = (points: Point[]): Point => ({
  x: points.reduce((acc, point) => acc + point.x, 0) / points.length,
  y: points.reduce((acc, point) => acc + point.y, 0) / points.length,
});

export const removeAt = <T,>(values: T[], predicate: (value: T) => boolean) =>
  values.filter((value) => !predicate(value));

export const unique = <T,>(values: T[]) => [...new Set(values)];
