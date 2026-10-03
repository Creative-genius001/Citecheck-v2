import { useId } from 'react';
import type { ApiFailure } from '../lib/api';
import { signed } from '../lib/format';
import { ArrowRight } from '../ui/icons';
import { Button, Card, InlineError, ProgressChip, SectionLabel } from './ui';

export type RewritePhase =
  | { kind: 'idle' }
  | { kind: 'rewriting' }
  | { kind: 'rescoring' }
  | { kind: 'ready'; before: number; after: number | null }
  | { kind: 'error'; error: ApiFailure };

export function RewriteCard({
  phase,
  blocked,
  onRewrite,
  onCancel,
  onView,
}: {
  phase: RewritePhase;
  /** Why rewriting isn't possible right now, if it isn't. */
  blocked: 'stale' | 'loading' | null;
  onRewrite: () => void;
  onCancel: () => void;
  onView: () => void;
}) {
  const id = useId();
  const busy = phase.kind === 'rewriting' || phase.kind === 'rescoring';

  return (
    <Card aria-labelledby={id} className="flex flex-col gap-3">
      <SectionLabel id={id}>Rewrite</SectionLabel>

      {busy ? (
        <>
          <div>
            <ProgressChip>{phase.kind === 'rewriting' ? 'Rewriting…' : 'Re-scoring the rewrite…'}</ProgressChip>
          </div>
          <Button onClick={onCancel} className="w-full">
            Cancel
          </Button>
        </>
      ) : phase.kind === 'ready' ? (
        <>
          <p className="m-0 text-[15px] leading-[1.55] text-ink-2">
            Your rewrite is ready.{' '}
            {phase.after !== null && (
              <>
                It scores <strong className="font-semibold text-ink">{phase.after}</strong> (
                <span className="font-mono">{signed(phase.after - phase.before)}</span>).
              </>
            )}
          </p>
          <Button variant="primary" onClick={onView} className="w-full">
            View rewrite
            <ArrowRight />
          </Button>
        </>
      ) : (
        <>
          <p className="m-0 text-[15px] leading-[1.55] text-ink-2">
            Fixes your biggest losses first and keeps your facts and voice. The result is re-scored, so you see a real before and after.
          </p>
          {phase.kind === 'error' && <InlineError message={phase.error.message} />}
          <Button variant="primary" onClick={onRewrite} disabled={blocked !== null} className="w-full">
            {phase.kind === 'error' ? 'Try the rewrite again' : 'Rewrite and re-score'}
          </Button>
          {blocked === 'stale' && <p className="m-0 text-[13px] text-muted">Re-analyze first: your article changed.</p>}
        </>
      )}
    </Card>
  );
}
