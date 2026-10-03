import { useEffect, useId, useState } from 'react';
import { CRITERIA } from '../../shared/rubric';
import type { CriterionView, RubricResult } from '../../shared/types';
import { cx, minus } from '../lib/format';
import { Check, ChevronDown, ChevronUp, Info } from '../ui/icons';
import { AddText, Card, CopyButton, LostChip, Segmented, SectionLabel, Skeleton } from './ui';

type View = 'lost' | 'all';

function sortByLost(criteria: CriterionView[]): CriterionView[] {
  const order = new Map(CRITERIA.map((c, i) => [c.id, i]));
  return criteria.filter((c) => c.lost > 0).sort((a, b) => b.lost - a.lost || order.get(a.id)! - order.get(b.id)!);
}

/** "Why not 100": every lost point, biggest first, each with the quote, the fix and an example. */
export function WhyNot100({ result }: { result: RubricResult | null }) {
  const id = useId();
  const [view, setView] = useState<View>('lost');
  const rows = result ? (view === 'lost' ? sortByLost(result.criteria) : result.criteria) : [];
  const [openId, setOpenId] = useState<string | null>(null);

  // When results arrive, open the first row; when the view changes, keep the open row if it's still listed.
  const rowIds = rows.map((r) => r.id).join(',');
  useEffect(() => {
    const ids = rowIds ? rowIds.split(',') : [];
    setOpenId((current) => (current && ids.includes(current) ? current : ids[0] ?? null));
  }, [rowIds, result]);

  return (
    <Card
      padding="none"
      aria-labelledby={id}
      aria-busy={!result}
      className="[flex:999_1_600px] px-[22px] pt-[22px] pb-2 max-sm:px-[18px] max-sm:pt-[18px] flex flex-col gap-3"
    >
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2.5">
          <SectionLabel id={id}>Why not 100</SectionLabel>
          {result && result.total < 100 && <LostChip>{minus(100 - result.total)} pts</LostChip>}
        </div>
        {result && (
          <Segmented<View>
            label="Show"
            value={view}
            onChange={setView}
            options={[
              { value: 'lost', label: 'Points lost' },
              { value: 'all', label: `All ${CRITERIA.length} criteria` },
            ]}
          />
        )}
      </div>

      {!result ? (
        <div className="flex flex-col">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className={cx('grid grid-cols-[52px_minmax(0,1fr)] gap-3 p-4', i < 3 && 'border-b border-divider')}>
              <Skeleton className="w-9 h-3.5" />
              <div className="flex flex-col gap-2">
                <Skeleton className="h-3.5 w-[60%]" />
                <Skeleton className="h-3.5 w-[85%]" />
              </div>
            </div>
          ))}
        </div>
      ) : rows.length === 0 ? (
        <p className="m-0 pb-4 text-[15px] leading-[1.55] text-muted">Nothing lost: this article earns every point.</p>
      ) : (
        <div className="flex flex-col">
          {rows.map((c, i) => (
            <CriterionRow
              key={c.id}
              criterion={c}
              open={openId === c.id}
              last={i === rows.length - 1}
              onToggle={() => setOpenId((cur) => (cur === c.id ? null : c.id))}
            />
          ))}
        </div>
      )}
    </Card>
  );
}

function CriterionRow({ criterion: c, open, last, onToggle }: { criterion: CriterionView; open: boolean; last: boolean; onToggle: () => void }) {
  const id = useId();
  const full = c.score === 10;

  const button = (
    <button
      type="button"
      aria-expanded={open}
      aria-controls={`${id}-detail`}
      onClick={onToggle}
      className={cx(
        'w-full grid grid-cols-[52px_minmax(0,1fr)_20px] gap-3 items-start p-4 text-left text-ink transition-colors duration-[120ms]',
        !open && 'hover:bg-surface-2',
        !open && !last && 'border-b border-divider',
      )}
    >
      <span className={cx('font-mono text-[15px] font-semibold pt-px', full ? 'text-ink' : 'text-lost')}>
        {full ? '10/10' : minus(c.lost)}
      </span>
      <span className="flex flex-col gap-[3px] min-w-0">
        <span className="text-[15px] font-semibold">{c.label}</span>
        {full ? (
          <span className="flex gap-1.5 text-[14px] leading-[1.5] text-muted">
            <span className="text-accent mt-[3px]">
              <Check />
            </span>
            {c.strength}
          </span>
        ) : (
          <span className="text-[14px] leading-[1.5] text-muted">{c.issue}</span>
        )}
      </span>
      <span className={cx('mt-0.5', open ? 'text-ink' : 'text-subtle')}>{open ? <ChevronUp /> : <ChevronDown />}</span>
    </button>
  );

  if (!open) return button;

  return (
    <div className="bg-surface-2 border border-divider rounded-box mb-1">
      {button}
      <div id={`${id}-detail`} className="pl-20 pr-4 pb-[18px] max-sm:pl-4 flex flex-col gap-3.5">
        <span className="font-mono text-[12px] text-muted">
          {c.score}/10 · weight {c.weight}
        </span>

        {full ? null : (
          <>
            {c.quote && (
              <figure className="m-0 flex flex-col gap-1.5">
                <figcaption className="text-[12px] font-medium text-muted">From your article</figcaption>
                <blockquote className="m-0 self-start px-3.5 py-2.5 bg-surface border border-line rounded-input text-[15px] leading-[1.5]">
                  “{c.quote}”
                </blockquote>
              </figure>
            )}
            {c.quoteUnverified && (
              <p className="m-0 flex items-center gap-2 text-[13px] text-muted">
                <Info />
                Supporting quote couldn’t be matched to your article
              </p>
            )}
            {c.fix && (
              <p className="m-0 text-[14px] leading-[1.6] text-ink-2">
                <strong className="font-semibold text-ink">Fix:</strong> {c.fix}
              </p>
            )}
            {c.exampleRewrite && (
              <div className="bg-surface border border-line rounded-control px-4 py-3.5 flex flex-col gap-2.5">
                <div className="flex items-center justify-between gap-2.5">
                  <SectionLabel as="h3">Example rewrite</SectionLabel>
                  <CopyButton text={c.exampleRewrite} />
                </div>
                <p className="m-0 text-[15px] leading-[1.8] [overflow-wrap:anywhere]">
                  <AddText text={c.exampleRewrite} />
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
