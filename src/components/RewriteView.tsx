import { diffWords } from 'diff';
import { Children, useId, useMemo, useState, type ReactNode } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { PlatformsResult, RewriteResult, RubricResult } from '../../shared/types';
import type { NewFactFlag } from '../../shared/verify';
import type { ApiFailure } from '../lib/api';
import { cx, signed } from '../lib/format';
import { ScoreRing } from './ScoreRing';
import { AddText, Button, Card, CopyButton, InlineError, LostChip, Segmented, SectionLabel, Skeleton } from './ui';

type Loadable<T> = { data: T | null; error: ApiFailure | null };

export function RewriteView({
  original,
  before,
  beforePlatforms,
  rewrite,
  after,
  afterPlatforms,
  onRetryRescore,
  onUse,
}: {
  original: string;
  before: RubricResult;
  beforePlatforms: PlatformsResult | null;
  rewrite: RewriteResult;
  after: Loadable<RubricResult>;
  afterPlatforms: Loadable<PlatformsResult>;
  onRetryRescore: () => void;
  onUse: () => void;
}) {
  return (
    <>
      <div className="flex flex-wrap gap-5 items-start">
        <div className="[flex:1_1_360px] min-w-0 flex flex-col gap-5">
          <BeforeAfter
            before={before}
            beforePlatforms={beforePlatforms}
            after={after}
            afterPlatforms={afterPlatforms}
            onRetry={onRetryRescore}
          />
          <Actions rewrite={rewrite} onUse={onUse} />
        </div>
        <div className="[flex:999_1_600px] min-w-0 flex flex-col gap-5">
          <NewFacts flags={rewrite.flags} />
          <Placeholders placeholders={rewrite.placeholders} />
          {rewrite.changes.length > 0 && <Changes rewrite={rewrite} />}
        </div>
      </div>
      <RewrittenArticle original={original} markdown={rewrite.markdown} />
    </>
  );
}

// ---------------------------------------------------------------------------

function Delta({ before, after }: { before: number; after: number }) {
  const d = after - before;
  return <span className={cx('font-mono font-semibold', d < 0 ? 'text-lost' : 'text-ink')}>{signed(d)}</span>;
}

function BeforeAfter({
  before,
  beforePlatforms,
  after,
  afterPlatforms,
  onRetry,
}: {
  before: RubricResult;
  beforePlatforms: PlatformsResult | null;
  after: Loadable<RubricResult>;
  afterPlatforms: Loadable<PlatformsResult>;
  onRetry: () => void;
}) {
  const id = useId();
  const error = after.error ?? afterPlatforms.error;
  const pending = <Skeleton className="w-14 h-3 ml-auto" />;

  return (
    <Card padding="lg" elevated aria-labelledby={id} aria-busy={!after.data && !after.error} className="flex flex-col gap-[18px]">
      <SectionLabel id={id}>Before → after</SectionLabel>

      <div className="flex items-center justify-center gap-5">
        <figure className="m-0 flex flex-col items-center gap-2">
          <ScoreRing score={before.total} band={before.band} size={96} />
          <figcaption className="text-[13px] text-muted">Before</figcaption>
        </figure>
        <span className="text-[18px] min-w-10 text-center" aria-label="Change">
          {after.data ? <Delta before={before.total} after={after.data.total} /> : <span className="text-subtle">→</span>}
        </span>
        <figure className="m-0 flex flex-col items-center gap-2">
          <ScoreRing score={after.data?.total ?? null} band={after.data?.band} size={96} />
          <figcaption className="text-[13px] text-muted">After</figcaption>
        </figure>
      </div>

      {error && <InlineError message={`The rewrite couldn’t be re-scored. ${error.message}`} onRetry={error.retryable ? onRetry : undefined} />}

      <dl className="m-0 bg-surface-3 border border-line-soft rounded-box text-[14px]">
        {before.criteria.map((c, i) => {
          const a = after.data?.criteria.find((x) => x.id === c.id);
          return (
            <div key={c.id} className={cx('flex items-center justify-between gap-3 px-4 py-3', i > 0 && 'border-t border-line-soft')}>
              <dt className="text-muted">{c.label}</dt>
              <dd className="m-0 font-mono text-[13px] text-right">
                {a ? (
                  <>
                    {c.score} → <strong className={cx('font-semibold', a.score < c.score && 'text-lost')}>{a.score}</strong>
                  </>
                ) : after.error ? (
                  `${c.score} → –`
                ) : (
                  pending
                )}
              </dd>
            </div>
          );
        })}
        {beforePlatforms?.platforms.map((p) => {
          const a = afterPlatforms.data?.platforms.find((x) => x.id === p.id);
          return (
            <div key={p.id} className="flex items-center justify-between gap-3 px-4 py-3 border-t border-line-soft">
              <dt className="text-muted">{p.label} fit</dt>
              <dd className="m-0 font-mono text-[13px] text-right">
                {a ? (
                  <>
                    {p.score} → <strong className={cx('font-semibold', a.score < p.score && 'text-lost')}>{a.score}</strong>
                  </>
                ) : afterPlatforms.error ? (
                  `${p.score} → –`
                ) : (
                  pending
                )}
              </dd>
            </div>
          );
        })}
      </dl>
      <p className="m-0 text-[13px] leading-[1.5] text-muted">Criteria are scored out of 10, platforms out of 100.</p>
    </Card>
  );
}

function Actions({ rewrite, onUse }: { rewrite: RewriteResult; onUse: () => void }) {
  const [confirming, setConfirming] = useState(false);
  const left = rewrite.placeholders.length;

  return (
    <Card className="flex flex-col gap-3">
      {confirming ? (
        <>
          <p className="m-0 text-[14px] font-semibold text-lost">
            {left} {left === 1 ? 'placeholder still needs' : 'placeholders still need'} filling. Use this version anyway?
          </p>
          <div className="flex gap-2 flex-wrap">
            <Button onClick={() => setConfirming(false)}>Cancel</Button>
            <Button variant="primary" onClick={onUse} className="flex-1">
              Use it anyway
            </Button>
          </div>
        </>
      ) : (
        <div className="flex gap-2 flex-wrap">
          <CopyButton text={rewrite.markdown} label="Copy Markdown" variant="secondary" />
          <Button variant="primary" onClick={() => (left > 0 ? setConfirming(true) : onUse())} className="flex-1">
            Use this version
          </Button>
        </div>
      )}
      <p className="m-0 text-[13px] leading-[1.5] text-muted">“Use this version” replaces the text in your editor with the rewrite.</p>
    </Card>
  );
}

const KIND_LABEL: Record<NewFactFlag['kind'], string> = { number: 'Number', url: 'Link', quote: 'Quote', name: 'Name' };

function NewFacts({ flags }: { flags: NewFactFlag[] }) {
  const id = useId();
  return (
    <Card aria-labelledby={id} className="flex flex-col gap-3">
      <div className="flex items-center gap-2.5">
        <SectionLabel id={id}>Check before publishing</SectionLabel>
        {flags.length > 0 && <LostChip>{flags.length}</LostChip>}
      </div>
      {flags.length === 0 ? (
        <p className="m-0 text-[15px] leading-[1.55] text-ink-2">No new facts detected: every number, link, quote and name in the rewrite was already in your article.</p>
      ) : (
        <>
          <p className="m-0 text-[15px] leading-[1.55] text-ink-2">These weren’t in your original. Check before publishing.</p>
          <ul className="m-0 p-0 list-none flex flex-col gap-2">
            {flags.map((f, i) => (
              <li key={i} className="bg-surface-2 border border-divider rounded-control px-3.5 py-3 flex flex-col gap-1">
                <span className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-[11px] text-muted bg-track px-2 py-1 rounded-tag">
                    {KIND_LABEL[f.kind]}
                    {f.level === 'possible' ? ' · possible' : ''}
                  </span>
                  <span className="text-[14px] font-semibold [overflow-wrap:anywhere]">{f.value}</span>
                </span>
                <span className="text-[13px] leading-[1.45] text-muted [overflow-wrap:anywhere]">{f.context}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </Card>
  );
}

function Placeholders({ placeholders }: { placeholders: string[] }) {
  const id = useId();
  return (
    <Card aria-labelledby={id} className="flex flex-col gap-3">
      <div className="flex items-center gap-2.5">
        <SectionLabel id={id}>Placeholders to fill</SectionLabel>
        <span className="font-mono text-[12px] font-semibold text-accent-strong bg-accent-soft px-2 py-1 rounded-full">{placeholders.length}</span>
      </div>
      {placeholders.length === 0 ? (
        <p className="m-0 text-[15px] leading-[1.55] text-ink-2">Nothing to fill in.</p>
      ) : (
        <>
          <p className="m-0 text-[15px] leading-[1.55] text-ink-2">
            The rewrite needs information only you have. Replace each placeholder, or remove the sentence.
          </p>
          <div className="flex flex-wrap gap-1.5 text-[15px] leading-[1.8]">
            {placeholders.map((p, i) => (
              <AddText key={i} text={p} />
            ))}
          </div>
        </>
      )}
    </Card>
  );
}

function Changes({ rewrite }: { rewrite: RewriteResult }) {
  const id = useId();
  const groups = new Map<string, string[]>();
  for (const c of rewrite.changes) groups.set(c.label, [...(groups.get(c.label) ?? []), c.change]);

  return (
    <Card aria-labelledby={id} className="flex flex-col gap-3">
      <SectionLabel id={id}>What changed</SectionLabel>
      {[...groups].map(([label, changes]) => (
        <div key={label} className="flex flex-col gap-1">
          <h3 className="m-0 text-[14px] font-semibold">{label}</h3>
          <ul className="m-0 pl-5 list-disc text-[14px] leading-[1.55] text-ink-2">
            {changes.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
        </div>
      ))}
    </Card>
  );
}

// ---------------------------------------------------------------------------

type ArticleView = 'rendered' | 'markdown' | 'changes';

/** Renders string children with [[ADD: …]] chips; elements pass through. */
function chips(children: ReactNode): ReactNode {
  return Children.map(children, (child) => (typeof child === 'string' ? <AddText text={child} /> : child));
}

// The article's headings sit inside a card, so they render one level below the card label (h2).
const MARKDOWN_COMPONENTS: Components = {
  p: ({ children }) => <p>{chips(children)}</p>,
  li: ({ children }) => <li>{chips(children)}</li>,
  h1: ({ children }) => <h3 className="md-h1">{chips(children)}</h3>,
  h2: ({ children }) => <h4 className="md-h2">{chips(children)}</h4>,
  h3: ({ children }) => <h5 className="md-h3">{chips(children)}</h5>,
  h4: ({ children }) => <h6 className="md-h3">{chips(children)}</h6>,
  h5: ({ children }) => <h6 className="md-h3">{chips(children)}</h6>,
  h6: ({ children }) => <h6 className="md-h3">{chips(children)}</h6>,
  td: ({ children }) => <td>{chips(children)}</td>,
  th: ({ children }) => <th>{chips(children)}</th>,
  strong: ({ children }) => <strong>{chips(children)}</strong>,
  em: ({ children }) => <em>{chips(children)}</em>,
  a: ({ children, href }) => (
    <a href={href} target="_blank" rel="noopener noreferrer nofollow">
      {children}
    </a>
  ),
};

function RewrittenArticle({ original, markdown }: { original: string; markdown: string }) {
  const id = useId();
  const [view, setView] = useState<ArticleView>('rendered');

  return (
    <Card padding="lg" aria-labelledby={id} className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <SectionLabel id={id}>Rewritten article</SectionLabel>
        <Segmented<ArticleView>
          label="View"
          value={view}
          onChange={setView}
          options={[
            { value: 'rendered', label: 'Rendered' },
            { value: 'markdown', label: 'Markdown' },
            { value: 'changes', label: 'Changes' },
          ]}
        />
      </div>
      <div className="w-full max-w-[760px] mx-auto">
        {view === 'rendered' && (
          <div className="prose-rewrite">
            <ReactMarkdown remarkPlugins={[remarkGfm]} skipHtml components={MARKDOWN_COMPONENTS}>
              {markdown}
            </ReactMarkdown>
          </div>
        )}
        {view === 'markdown' && (
          <div className="flex flex-col gap-3">
            <div className="flex justify-end">
              <CopyButton text={markdown} label="Copy Markdown" />
            </div>
            <pre className="m-0 bg-surface-2 border border-divider rounded-control p-4 font-mono text-[13px] leading-[1.7] whitespace-pre-wrap [overflow-wrap:anywhere]">
              <AddText text={markdown} />
            </pre>
          </div>
        )}
        {view === 'changes' && <WordDiff original={original} markdown={markdown} />}
      </div>
    </Card>
  );
}

function WordDiff({ original, markdown }: { original: string; markdown: string }) {
  // A word diff of two long, heavily edited texts can take a while: give up after 1.5 s.
  const parts = useMemo(() => diffWords(original, markdown, { timeout: 1500 }), [original, markdown]);

  if (!parts) {
    return <p className="m-0 text-[15px] text-muted">Too many changes to highlight word by word. Use the Rendered or Markdown view.</p>;
  }

  return (
    <div className="text-[15px] leading-[1.8] whitespace-pre-wrap [overflow-wrap:anywhere]">
      <p className="m-0 mb-3 flex gap-4 flex-wrap text-[13px] text-muted">
        <span>
          <ins className="no-underline bg-accent-soft text-accent-strong rounded-mark px-1">Added</ins>
        </span>
        <span>
          <del className="bg-lost-soft text-lost rounded-mark px-1">Removed</del>
        </span>
      </p>
      {parts.map((part, i) =>
        part.added ? (
          <ins key={i} className="no-underline bg-accent-soft text-accent-strong rounded-mark">
            {part.value}
          </ins>
        ) : part.removed ? (
          <del key={i} className="bg-lost-soft text-lost rounded-mark">
            {part.value}
          </del>
        ) : (
          <span key={i}>{part.value}</span>
        ),
      )}
    </div>
  );
}
