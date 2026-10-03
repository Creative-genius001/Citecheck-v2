import type { ReactNode } from 'react';
import { formatInt } from '../lib/format';
import { DocumentIcon, Warning } from '../ui/icons';
import { Button, ProgressChip, StatusChip } from './ui';

export function ArticleStrip({
  title,
  words,
  progress,
  matches,
  actions,
  viewSwitch,
}: {
  title: string;
  words: number;
  /** Progress text while a call runs, e.g. "Scoring citability…". */
  progress: string | null;
  /** Results match the current draft. */
  matches: boolean;
  actions: ReactNode;
  viewSwitch?: ReactNode;
}) {
  return (
    <section
      aria-label="Analyzed article"
      className="bg-surface border border-line rounded-strip px-4 py-3.5 flex items-center gap-3.5 flex-wrap"
    >
      <div className="size-11 shrink-0 rounded-tile bg-track flex items-center justify-center text-ink">
        <DocumentIcon />
      </div>
      <div className="[flex:999_1_300px] min-w-0">
        <p className="label-s">Analyzed article · {formatInt(words)} words</p>
        <h1 tabIndex={-1} className="mt-[3px] mb-0 text-[18px] leading-[1.35] font-semibold tracking-[-0.01em] max-sm:truncate focus:outline-none">
          {title}
        </h1>
      </div>
      {progress ? <ProgressChip>{progress}</ProgressChip> : matches ? <StatusChip>Matches your draft</StatusChip> : null}
      {viewSwitch}
      <div className="flex gap-2 flex-wrap">{actions}</div>
    </section>
  );
}

export function StaleBanner({ onReanalyze }: { onReanalyze: () => void }) {
  return (
    <div role="status" className="bg-lost-soft rounded-box px-4 py-3 flex items-center gap-3 flex-wrap">
      <span className="text-lost">
        <Warning size={16} />
      </span>
      <p className="m-0 flex-1 min-w-[200px] text-[14px] font-semibold text-lost">Article changed since this analysis. Re-analyze?</p>
      <Button onClick={onReanalyze}>Re-analyze</Button>
    </div>
  );
}
