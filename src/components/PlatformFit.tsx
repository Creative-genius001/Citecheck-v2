import { useId, useRef, useState, type KeyboardEvent } from 'react';
import { PLATFORMS, type PlatformId } from '../../shared/rubric';
import type { PlatformView, PlatformsResult } from '../../shared/types';
import type { ApiFailure } from '../lib/api';
import { cx } from '../lib/format';
import { BAND_UI } from '../ui/band';
import { Check } from '../ui/icons';
import { BandPill, Card, InlineError, SectionLabel, Skeleton } from './ui';

export function PlatformFit({
  result,
  error,
  onRetry,
}: {
  result: PlatformsResult | null;
  error: ApiFailure | null;
  onRetry: () => void;
}) {
  const id = useId();
  const [selected, setSelected] = useState<PlatformId>('x');
  const tabs = useRef<Partial<Record<PlatformId, HTMLButtonElement | null>>>({});
  const platform = result?.platforms.find((p) => p.id === selected);

  function onKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
    const index = PLATFORMS.findIndex((p) => p.id === selected);
    const last = PLATFORMS.length - 1;
    const next =
      e.key === 'ArrowRight' ? (index === last ? 0 : index + 1)
      : e.key === 'ArrowLeft' ? (index === 0 ? last : index - 1)
      : e.key === 'Home' ? 0
      : e.key === 'End' ? last
      : null;
    if (next === null) return;
    e.preventDefault();
    const nextId = PLATFORMS[next].id;
    setSelected(nextId);
    tabs.current[nextId]?.focus();
  }

  return (
    <Card aria-labelledby={id} aria-busy={!result && !error} className="flex flex-col gap-[18px]">
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <SectionLabel id={id}>Platform fit</SectionLabel>
        <span className="text-[13px] text-muted">Each platform is scored on 4 factors</span>
      </div>

      {error ? (
        <InlineError message={error.message} onRetry={error.retryable ? onRetry : undefined} />
      ) : !result || !platform ? (
        <>
          <div className="flex gap-1 p-1 bg-track rounded-button overflow-hidden">
            {PLATFORMS.map((p) => (
              <Skeleton key={p.id} className="flex-[1_0_auto] min-w-32 h-12 rounded-input" />
            ))}
          </div>
          <div className="flex flex-col gap-3 px-1">
            <Skeleton className="w-16 h-9" />
            <Skeleton className="h-3.5 w-[90%]" />
            <Skeleton className="h-3.5 w-[75%]" />
            <Skeleton className="h-3.5 w-[60%]" />
          </div>
        </>
      ) : (
        <>
          <div role="tablist" aria-label="Platforms" className="flex gap-1 p-1 bg-track rounded-button overflow-x-auto">
            {result.platforms.map((p) => {
              const isSelected = p.id === selected;
              return (
                <button
                  key={p.id}
                  ref={(el) => {
                    tabs.current[p.id] = el;
                  }}
                  type="button"
                  role="tab"
                  id={`${id}-tab-${p.id}`}
                  aria-selected={isSelected}
                  aria-controls={`${id}-panel`}
                  tabIndex={isSelected ? 0 : -1}
                  onClick={() => setSelected(p.id)}
                  onKeyDown={onKeyDown}
                  className={cx(
                    'flex-[1_0_auto] min-w-32 h-12 px-3.5 rounded-input flex items-center justify-between gap-3 text-ink transition-colors duration-[120ms]',
                    isSelected ? 'bg-surface shadow-selected' : 'hover:bg-surface/60',
                  )}
                >
                  <span className={cx('text-[14px]', isSelected ? 'font-semibold' : 'font-medium')}>{p.label}</span>
                  <span className="font-mono text-[14px] font-semibold">{p.score}</span>
                </button>
              );
            })}
          </div>
          <PlatformPanel id={`${id}-panel`} labelledBy={`${id}-tab-${platform.id}`} platform={platform} />
        </>
      )}
    </Card>
  );
}

function PlatformPanel({ id, labelledBy, platform: p }: { id: string; labelledBy: string; platform: PlatformView }) {
  return (
    <div role="tabpanel" id={id} aria-labelledby={labelledBy} className="flex flex-wrap gap-x-10 gap-y-5 px-1 pt-1 pb-0.5">
      <div className="[flex:1_1_380px] min-w-0 flex flex-col gap-4">
        <div className="flex items-center gap-3.5 flex-wrap">
          <span className="flex items-baseline gap-1">
            <span className="text-[44px] leading-none font-medium tracking-[-0.04em]">{p.score}</span>
            <span className="font-mono text-[14px] text-muted">/100</span>
          </span>
          <BandPill band={p.band} size="sm">
            {BAND_UI[p.band].label}
          </BandPill>
        </div>
        {p.verdict && <p className="m-0 text-[16px] leading-[1.55]">{p.verdict}</p>}
        <div className="flex flex-col">
          {p.factors.map((f) => (
            <div key={f.id} className="grid grid-cols-[minmax(0,1fr)_72px_40px] gap-3.5 items-center py-3 border-t border-divider">
              <span className="flex flex-col gap-0.5 min-w-0">
                <span className="text-[14px] font-semibold">{f.label}</span>
                {f.reason && <span className="text-[13px] leading-[1.45] text-muted">{f.reason}</span>}
              </span>
              <span className="h-1.5 rounded-full bg-skeleton overflow-hidden" aria-hidden="true">
                <span className="block h-full rounded-full bg-ink" style={{ width: `${f.score * 10}%` }} />
              </span>
              <span className="font-mono text-[13px] text-right">{f.score}/10</span>
            </div>
          ))}
        </div>
      </div>

      <div className="[flex:1_1_380px] min-w-0 flex flex-col gap-[18px]">
        {p.whatWorks.length > 0 && (
          <div className="flex flex-col gap-2">
            <SectionLabel as="h3">What works</SectionLabel>
            {p.whatWorks.map((w, i) => (
              <p key={i} className="m-0 flex gap-2 text-[14px] leading-[1.5]">
                <span className="text-accent mt-0.5">
                  <Check size={16} />
                </span>
                {w}
              </p>
            ))}
          </div>
        )}

        {p.issues.length > 0 && (
          <div className="flex flex-col gap-2">
            <SectionLabel as="h3">Holding it back</SectionLabel>
            {p.issues.map((issue, i) => (
              <div key={i} className="bg-surface-2 border border-divider rounded-control px-3.5 py-3 flex flex-col gap-1.5 text-[14px] leading-[1.5]">
                {issue.quote && <span className="italic">“{issue.quote}”</span>}
                <span className="text-ink-2">
                  {issue.problem}
                  {issue.fix && (
                    <>
                      {' '}
                      <strong className="font-semibold text-ink">Fix:</strong> {issue.fix}
                    </>
                  )}
                </span>
              </div>
            ))}
          </div>
        )}

        {p.id === 'chatgpt' && (
          <div className="flex flex-col gap-1">
            <h3 className="label-s mb-1">Questions it could be cited for</h3>
            {p.likelyQuestions.length === 0 ? (
              <p className="m-0 text-[14px] text-muted">No convincing questions found for this article.</p>
            ) : (
              p.likelyQuestions.map((q, i) => (
                <div key={i} className="flex items-baseline gap-3 py-[9px] border-b border-divider">
                  <span className="font-mono text-[12px] text-muted">{String(i + 1).padStart(2, '0')}</span>
                  <span className="text-[14px] leading-[1.45]">{q}</span>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
