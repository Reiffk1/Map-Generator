const contrastPairs = [
  { name: 'Primary text on app bg', fg: '#f3eee6', bg: '#0f1216' },
  { name: 'Primary text on surface', fg: '#f3eee6', bg: '#171c24' },
  { name: 'Muted text on surface', fg: '#b7afa2', bg: '#171c24' },
  { name: 'Muted text on panel', fg: '#b7afa2', bg: '#1a2029' },
  { name: 'Eyebrow accent on panel', fg: '#bc9a60', bg: '#1a2029' },
] as const;

const toLinear = (channel: number) => {
  const c = channel / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};

const luminance = (hex: string) => {
  const value = hex.replace('#', '');
  const r = Number.parseInt(value.slice(0, 2), 16);
  const g = Number.parseInt(value.slice(2, 4), 16);
  const b = Number.parseInt(value.slice(4, 6), 16);
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
};

const ratio = (a: string, b: string) => {
  const la = luminance(a);
  const lb = luminance(b);
  const lighter = Math.max(la, lb);
  const darker = Math.min(la, lb);
  return (lighter + 0.05) / (darker + 0.05);
};

export const runAccessibilityAudit = () => {
  const results = contrastPairs.map((pair) => ({
    ...pair,
    ratio: ratio(pair.fg, pair.bg),
  }));
  const failed = results.filter((entry) => entry.ratio < 4.5);
  if (failed.length) {
    for (const entry of failed) {
      console.warn(
        `[a11y] Contrast below 4.5:1 for "${entry.name}" (${entry.ratio.toFixed(2)}:1)`,
      );
    }
  } else {
    console.info('[a11y] Token contrast audit passed (all configured pairs >= 4.5:1).');
  }
  return results;
};
