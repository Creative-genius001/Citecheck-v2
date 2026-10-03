/** "1,842" */
export function formatInt(n: number): string {
  return n.toLocaleString('en-US');
}

/** Lost points use the minus sign U+2212: "−12". */
export function minus(n: number): string {
  return `−${n}`;
}

/** "+14", "−3", "±0" */
export function signed(n: number): string {
  if (n > 0) return `+${n}`;
  if (n < 0) return minus(-n);
  return '±0';
}

/** "23 s", "1 min 5 s" */
export function formatDuration(ms: number): string {
  const s = Math.max(1, Math.round(ms / 1000));
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60);
  return s % 60 ? `${m} min ${s % 60} s` : `${m} min`;
}

/** Joins class names, skipping falsy values. */
export function cx(...names: (string | false | null | undefined)[]): string {
  return names.filter(Boolean).join(' ');
}
