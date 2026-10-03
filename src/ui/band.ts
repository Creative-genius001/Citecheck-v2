/**
 * Band presentation only. Thresholds live in shared/scoring.ts; the server sends the band.
 * Band colors are used for score meaning only: never for buttons, links or decoration.
 */

import type { Band } from '../../shared/scoring';

export interface BandStyle {
  label: string;
  next: string | null;
  nextAt: number | null;
  from: string;
  to: string;
  soft: string;
  text: string;
  glow: string;
  icon: 'check' | 'warning';
}

export const BAND_UI: Record<Band, BandStyle> = {
  highly_citable: {
    label: 'Highly citable', next: null, nextAt: null, from: '#5BD48A', to: '#1E9E57',
    soft: 'var(--color-band-high-soft)', text: 'var(--color-band-high-text)', glow: 'rgb(30 158 87 / 0.22)', icon: 'check',
  },
  strong: {
    label: 'Strong', next: 'Highly citable', nextAt: 85, from: '#B39DFF', to: '#6D4AF0',
    soft: 'var(--color-band-strong-soft)', text: 'var(--color-band-strong-text)', glow: 'rgb(109 74 240 / 0.22)', icon: 'check',
  },
  needs_work: {
    label: 'Needs work', next: 'Strong', nextAt: 70, from: '#FFA463', to: '#EE5A0A',
    soft: 'var(--color-band-work-soft)', text: 'var(--color-band-work-text)', glow: 'rgb(238 90 10 / 0.22)', icon: 'warning',
  },
  unlikely: {
    label: 'Unlikely to be cited', next: 'Needs work', nextAt: 50, from: '#FF8A8A', to: '#DC2626',
    soft: 'var(--color-band-low-soft)', text: 'var(--color-band-low-text)', glow: 'rgb(220 38 38 / 0.22)', icon: 'warning',
  },
};

/** "Needs work · 6 pts from Strong", or just "Highly citable". */
export function bandPillText(band: Band, score: number): string {
  const b = BAND_UI[band];
  if (!b.next || b.nextAt === null) return b.label;
  const gap = b.nextAt - score;
  return `${b.label} · ${gap} ${gap === 1 ? 'pt' : 'pts'} from ${b.next}`;
}
