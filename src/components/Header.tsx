import type { HealthResult } from '../../shared/types';
import { LogoMark } from '../ui/icons';

export function Header({ health }: { health: HealthResult | null | undefined }) {
  return (
    <header className="flex items-center justify-between gap-4 flex-wrap">
      <div className="flex items-center gap-2.5">
        <div className="size-9 rounded-logo bg-ink text-on-ink flex items-center justify-center">
          <LogoMark />
        </div>
        <span className="text-[20px] leading-[1.2] font-bold tracking-[-0.02em]">CiteCheck</span>
      </div>
      {health && (
        <span className="h-10 inline-flex items-center gap-2 px-3.5 border border-line rounded-full bg-surface text-[14px] text-muted">
          {health.geminiConfigured ? (
            <>
              Scored by
              <span className="font-mono font-semibold text-ink">{health.model}</span>
            </>
          ) : (
            <span className="font-semibold text-error">Gemini isn’t set up</span>
          )}
        </span>
      )}
    </header>
  );
}
