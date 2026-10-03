import { useEffect, useId, useState } from 'react';
import type { Band } from '../../shared/scoring';
import { BAND_UI } from '../ui/band';

const R = 68;
const C = 2 * Math.PI * R; // 427.26
const R_HI = 77;
const C_HI = 2 * Math.PI * R_HI; // 483.8

/**
 * Donut ring in the band's gradient. The arc starts at 12 o'clock, runs clockwise,
 * and draws in when the score first appears or changes. `score` null = loading.
 */
export function ScoreRing({ score, band, size = 176 }: { score: number | null; band?: Band; size?: number }) {
  const gradientId = `ring-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const [drawn, setDrawn] = useState(0);

  useEffect(() => {
    if (score === null) return;
    setDrawn(0);
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => setDrawn(score));
    });
    return () => cancelAnimationFrame(frame);
  }, [score]);

  const style = band ? BAND_UI[band] : null;
  const scale = size / 176;
  const disc = 104 * scale;
  const big = size >= 140;
  const transition = 'stroke-dasharray 600ms cubic-bezier(.2,.8,.2,1)';

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 176 176"
        aria-hidden="true"
        className="absolute inset-0"
        style={style && score !== null ? { filter: `drop-shadow(0 ${6 * scale}px ${14 * scale}px ${style.glow})` } : undefined}
      >
        {style && (
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor={style.from} />
              <stop offset="1" stopColor={style.to} />
            </linearGradient>
          </defs>
        )}
        <circle cx="88" cy="88" r={R} fill="none" stroke="var(--color-ring-track)" strokeWidth="24" />
        {style && score !== null && (
          <>
            <circle
              cx="88"
              cy="88"
              r={R}
              fill="none"
              stroke={`url(#${gradientId})`}
              strokeWidth="24"
              strokeDasharray={`${(C * drawn) / 100} ${C}`}
              transform="rotate(-90 88 88)"
              style={{ transition }}
            />
            <circle
              cx="88"
              cy="88"
              r={R_HI}
              fill="none"
              stroke="var(--ring-highlight)"
              strokeWidth="3"
              strokeDasharray={`${(C_HI * drawn) / 100} ${C_HI}`}
              transform="rotate(-90 88 88)"
              style={{ transition }}
            />
          </>
        )}
      </svg>
      <div
        className="absolute flex flex-col items-center justify-center rounded-full bg-surface border border-line-soft"
        style={{ left: 36 * scale, top: 36 * scale, width: disc, height: disc, gap: 3 * scale, boxShadow: 'var(--ring-disc-shadow)' }}
      >
        <span
          className={score === null ? 'text-subtle' : 'text-ink'}
          style={{ fontSize: big ? 38 : Math.round(38 * scale * 1.15), fontWeight: 500, letterSpacing: '-0.03em', lineHeight: 1 }}
        >
          {score === null ? '–' : score}
        </span>
        {big && <span className="font-mono text-[10px] leading-none tracking-[0.08em] uppercase text-muted">out of 100</span>}
      </div>
    </div>
  );
}
