import { useId } from 'react';
import { CRITERIA } from '../../shared/rubric';
import type { RubricResult } from '../../shared/types';
import { bandPillText } from '../ui/band';
import { ScoreRing } from './ScoreRing';
import { BandPill, Card, KeyValueBox, SectionLabel, Skeleton } from './ui';

const Value = ({ n, of }: { n: number; of: string }) => (
  <>
    <strong className="font-semibold">{n}</strong> <span className="text-muted">{of}</span>
  </>
);

/** Score card. `result` null = loading skeleton. */
export function ScoreHero({ result }: { result: RubricResult | null }) {
  const id = useId();
  const fullMarks = result?.criteria.filter((c) => c.score === 10).length ?? 0;
  const loadingValue = <Skeleton className="w-[60px] h-3 ml-auto" />;

  return (
    <Card padding="lg" elevated aria-labelledby={id} aria-busy={!result} className="flex flex-col gap-[18px]">
      <div>
        <SectionLabel id={id}>Citation score</SectionLabel>
        <p className="mt-2 mb-0 text-[19px] leading-[1.3] font-semibold tracking-[-0.01em]">Estimated citability</p>
      </div>

      <div className="mx-auto mt-1">
        <ScoreRing score={result?.total ?? null} band={result?.band} />
      </div>

      <div className="self-center">
        {result ? (
          <BandPill band={result.band}>{bandPillText(result.band, result.total)}</BandPill>
        ) : (
          <Skeleton className="w-40 h-7 rounded-full" />
        )}
      </div>

      <KeyValueBox
        rows={[
          { key: 'Points lost', value: result ? <Value n={100 - result.total} of="of 100" /> : loadingValue },
          { key: 'Full marks', value: result ? <Value n={fullMarks} of={`of ${CRITERIA.length} criteria`} /> : loadingValue },
          ...(result && result.quotes.supplied > 0
            ? [{ key: 'Quotes matched to your article', value: <Value n={result.quotes.verified} of={`of ${result.quotes.supplied}`} /> }]
            : []),
        ]}
      />

      {result ? (
        result.summary && <p className="m-0 text-[15px] leading-[1.55] text-muted">{result.summary}</p>
      ) : (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-3.5 w-full" />
          <Skeleton className="h-3.5 w-[70%]" />
        </div>
      )}
    </Card>
  );
}
