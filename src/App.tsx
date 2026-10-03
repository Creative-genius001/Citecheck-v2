/**
 * CiteCheck: paste an article, get an estimated citation score, every point it
 * loses and why, platform fit, and a verified rewrite.
 */

import { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { articleTitle, countWords } from '../shared/text';
import type { HealthResult, LossSummary, PlatformsResult, RewriteResult, RubricResult } from '../shared/types';
import { ArticleStrip, StaleBanner } from './components/ArticleStrip';
import { EditorCard, analyzeBlocker } from './components/EditorCard';
import { Footer } from './components/Footer';
import { Header } from './components/Header';
import { PlatformFit } from './components/PlatformFit';
import { RewriteCard, type RewritePhase } from './components/RewriteCard';
import { ScoreHero } from './components/ScoreHero';
import { HowItsScored, OptionalContext } from './components/SidePanels';
import { Button, Card, InlineError, Notice, ProgressChip, Segmented } from './components/ui';
import { WhyNot100 } from './components/WhyNot100';
import { EXAMPLE_ARTICLE } from './data/example';
import { ApiFailure, api, isAbort } from './lib/api';
import { useDraft, type Draft } from './lib/useDraft';

// The rewrite view pulls in Markdown rendering and diffing; load it only when a rewrite starts.
const loadRewriteView = () => import('./components/RewriteView');
const RewriteView = lazy(() => loadRewriteView().then((m) => ({ default: m.RewriteView })));

type Call<T> = { status: 'loading' } | { status: 'done'; data: T } | { status: 'error'; error: ApiFailure };

interface Run {
  id: number;
  /** Exactly what was analyzed. */
  snapshot: Draft;
  rubric: Call<RubricResult>;
  platforms: Call<PlatformsResult>;
}

interface Rewrite {
  runId: number;
  phase: 'rewriting' | 'ready' | 'error';
  error?: ApiFailure;
  result?: RewriteResult;
  /** Re-score of the rewritten text. */
  rubric?: Call<RubricResult>;
  platforms?: Call<PlatformsResult>;
}

type CallKey = 'rubric' | 'platforms' | 'rewrite' | 'afterRubric' | 'afterPlatforms';
const ALL_CALLS: CallKey[] = ['rubric', 'platforms', 'rewrite', 'afterRubric', 'afterPlatforms'];

const dataOf = <T,>(call: Call<T> | undefined): T | null => (call?.status === 'done' ? call.data : null);
const errorOf = <T,>(call: Call<T> | undefined): ApiFailure | null => (call?.status === 'error' ? call.error : null);
const isLoading = (call: Call<unknown> | undefined) => call?.status === 'loading';

function toFailure(err: unknown): ApiFailure {
  return err instanceof ApiFailure ? err : new ApiFailure('SERVER', 'Something went wrong. Try again.', true);
}

function sameInput(a: Draft, b: Draft): boolean {
  return a.article === b.article && a.author.trim() === b.author.trim() && a.topic.trim() === b.topic.trim();
}

export default function App() {
  const [draft, setDraft] = useDraft();
  const [health, setHealth] = useState<HealthResult | null | undefined>(undefined);
  const [run, setRun] = useState<Run | null>(null);
  const [rewrite, setRewrite] = useState<Rewrite | null>(null);
  const [view, setView] = useState<'analysis' | 'rewrite'>('analysis');
  const [editing, setEditing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const runSeq = useRef(0);
  const controllers = useRef(new Map<CallKey, AbortController>());

  useEffect(() => {
    api.health().then(setHealth);
    const active = controllers.current;
    return () => active.forEach((c) => c.abort());
  }, []);

  // --- call plumbing --------------------------------------------------------

  function abort(...keys: CallKey[]) {
    for (const key of keys) {
      controllers.current.get(key)?.abort();
      controllers.current.delete(key);
    }
  }

  /** Starts a request under `key` (cancelling any previous one) and reports each state change. */
  function track<T>(key: CallKey, request: (signal: AbortSignal) => Promise<T>, settle: (call: Call<T>) => void) {
    abort(key);
    const controller = new AbortController();
    controllers.current.set(key, controller);
    const { signal } = controller;
    settle({ status: 'loading' });
    request(signal).then(
      (data) => {
        if (!signal.aborted) settle({ status: 'done', data });
      },
      (err: unknown) => {
        if (!isAbort(err) && !signal.aborted) settle({ status: 'error', error: toFailure(err) });
      },
    );
  }

  const updateRun = (id: number, patch: Partial<Run>) => setRun((r) => (r && r.id === id ? { ...r, ...patch } : r));
  const updateRewrite = (runId: number, patch: Partial<Rewrite>) =>
    setRewrite((r) => (r && r.runId === runId ? { ...r, ...patch } : r));

  // --- analysis --------------------------------------------------------------

  function analyze(input: Draft = draft) {
    abort(...ALL_CALLS);
    const id = ++runSeq.current;
    const snapshot = { ...input };
    setRun({ id, snapshot, rubric: { status: 'loading' }, platforms: { status: 'loading' } });
    setRewrite(null);
    setView('analysis');
    setEditing(false);
    setNotice(null);
    track('rubric', (s) => api.score(snapshot, s), (rubric) => updateRun(id, { rubric }));
    track('platforms', (s) => api.platforms(snapshot, s), (platforms) => updateRun(id, { platforms }));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function retryRubric() {
    if (!run) return;
    const { id, snapshot } = run;
    track('rubric', (s) => api.score(snapshot, s), (rubric) => updateRun(id, { rubric }));
  }

  function retryPlatforms() {
    if (!run) return;
    const { id, snapshot } = run;
    track('platforms', (s) => api.platforms(snapshot, s), (platforms) => updateRun(id, { platforms }));
  }

  function cancelAnalysis() {
    abort(...ALL_CALLS);
    setRun(null);
    setRewrite(null);
    setEditing(false);
    setNotice('Cancelled.');
  }

  // --- rewrite ----------------------------------------------------------------

  function rescore(runId: number, input: Draft, which: ('rubric' | 'platforms')[] = ['rubric', 'platforms']) {
    if (which.includes('rubric')) track('afterRubric', (s) => api.score(input, s), (rubric) => updateRewrite(runId, { rubric }));
    if (which.includes('platforms')) {
      track('afterPlatforms', (s) => api.platforms(input, s), (platforms) => updateRewrite(runId, { platforms }));
    }
  }

  function startRewrite() {
    const rubric = dataOf(run?.rubric);
    if (!run || !rubric || stale) return;
    const { id, snapshot } = run;
    const losses: LossSummary[] = rubric.criteria
      .filter((c) => c.lost > 0)
      .map((c) => ({ criterion: c.id, lost: c.lost, issue: c.issue, fix: c.fix }));

    abort('rewrite', 'afterRubric', 'afterPlatforms');
    const controller = new AbortController();
    controllers.current.set('rewrite', controller);
    setRewrite({ runId: id, phase: 'rewriting' });
    void loadRewriteView();

    api.rewrite(snapshot, losses, controller.signal).then(
      (result) => {
        if (controller.signal.aborted) return;
        setRewrite({ runId: id, phase: 'ready', result });
        setView('rewrite');
        window.scrollTo({ top: 0, behavior: 'smooth' });
        rescore(id, { ...snapshot, article: result.markdown });
      },
      (err: unknown) => {
        if (isAbort(err) || controller.signal.aborted) return;
        setRewrite({ runId: id, phase: 'error', error: toFailure(err) });
      },
    );
  }

  function retryRescore() {
    if (!run || !rewrite?.result) return;
    const which = [errorOf(rewrite.rubric) && 'rubric', errorOf(rewrite.platforms) && 'platforms'].filter(Boolean) as ('rubric' | 'platforms')[];
    rescore(rewrite.runId, { ...run.snapshot, article: rewrite.result.markdown }, which);
  }

  function cancelRewrite() {
    abort('rewrite', 'afterRubric', 'afterPlatforms');
    setRewrite(null);
    setView('analysis');
  }

  function adoptRewrite() {
    if (!run || !rewrite?.result) return;
    const next: Draft = { ...run.snapshot, article: rewrite.result.markdown };
    setDraft(next);
    const rubric = rewrite.rubric;
    const platforms = rewrite.platforms;
    if (rubric?.status === 'done' && platforms?.status === 'done') {
      // The re-score already is the analysis of this text.
      abort(...ALL_CALLS);
      setRun({ id: ++runSeq.current, snapshot: next, rubric, platforms });
      setRewrite(null);
      setView('analysis');
      setEditing(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      analyze(next);
    }
  }

  // --- derived state ----------------------------------------------------------

  const stale = run !== null && !sameInput(draft, run.snapshot);
  const running = run !== null && (isLoading(run.rubric) || isLoading(run.platforms));
  const rubricData = dataOf(run?.rubric);
  const platformsData = dataOf(run?.platforms);
  const blocker = analyzeBlocker(draft.article);

  const rewritePhase: RewritePhase = !rewrite
    ? { kind: 'idle' }
    : rewrite.phase === 'rewriting'
      ? { kind: 'rewriting' }
      : rewrite.phase === 'error'
        ? { kind: 'error', error: rewrite.error! }
        : isLoading(rewrite.rubric) || isLoading(rewrite.platforms)
          ? { kind: 'rescoring' }
          : { kind: 'ready', before: rubricData?.total ?? 0, after: dataOf(rewrite.rubric)?.total ?? null };

  const showRewrite = view === 'rewrite' && rewrite?.result && rubricData;

  // --- screens ----------------------------------------------------------------

  const editorRow = (
    <div className="flex flex-wrap gap-5 items-stretch">
      <EditorCard
        article={draft.article}
        onArticleChange={(article) => {
          setDraft((d) => ({ ...d, article }));
          setNotice(null);
        }}
        onAnalyze={() => analyze()}
        analyzeLabel={run ? 'Re-analyze' : 'Analyze'}
        notice={notice}
        onDone={run ? () => setEditing(false) : undefined}
        onExample={() => setDraft((d) => ({ ...d, article: EXAMPLE_ARTICLE }))}
      />
      <div className="[flex:1_1_340px] min-w-0 flex flex-col gap-5">
        <OptionalContext
          author={draft.author}
          topic={draft.topic}
          onAuthorChange={(author) => setDraft((d) => ({ ...d, author }))}
          onTopicChange={(topic) => setDraft((d) => ({ ...d, topic }))}
        />
        <HowItsScored />
      </div>
    </div>
  );

  return (
    <div className="min-h-screen px-[clamp(16px,3vw,40px)] pt-6 pb-12">
      <div className="max-w-[1240px] mx-auto flex flex-col gap-5">
        <Header health={health} />
        {health && !health.geminiConfigured && (
          <Notice>Gemini isn’t set up on this server yet. Add GEMINI_API_KEY to the server’s environment (in AI Studio: Secrets), then restart the app.</Notice>
        )}

        <main className="flex flex-col gap-5">
          {!run ? (
            <>
              <div className="pt-2 px-0.5">
                <h1 className="m-0 text-[40px] max-sm:text-[32px] leading-[1.1] font-bold tracking-[-0.03em]">Will AI cite this article?</h1>
                <p className="mt-2.5 mb-0 max-w-[600px] text-[16px] leading-[1.55] text-muted">
                  Paste a draft to get an estimated citation score, every point it loses and why, and how well it fits five platforms.
                </p>
              </div>
              {editorRow}
            </>
          ) : (
            <>
              {editing ? (
                editorRow
              ) : (
                <ArticleStrip
                  title={articleTitle(run.snapshot.article)}
                  words={rubricData?.wordCount ?? countWords(run.snapshot.article)}
                  progress={isLoading(run.rubric) ? 'Scoring citability…' : isLoading(run.platforms) ? 'Checking platform fit…' : null}
                  matches={!stale && (rubricData !== null || platformsData !== null)}
                  viewSwitch={
                    rewrite?.result && rubricData ? (
                      <Segmented<'analysis' | 'rewrite'>
                        label="Show"
                        value={view}
                        onChange={setView}
                        options={[
                          { value: 'analysis', label: 'Analysis' },
                          { value: 'rewrite', label: 'Rewrite' },
                        ]}
                      />
                    ) : undefined
                  }
                  actions={
                    running ? (
                      <Button onClick={cancelAnalysis}>Cancel</Button>
                    ) : (
                      <>
                        <Button
                          onClick={() => {
                            setEditing(true);
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                          }}
                        >
                          Edit article
                        </Button>
                        <Button onClick={() => analyze()} disabled={blocker !== null} title={blocker ?? undefined}>
                          Re-analyze
                        </Button>
                      </>
                    )
                  }
                />
              )}

              {stale && !running && <StaleBanner onReanalyze={() => analyze()} />}

              {showRewrite ? (
                <Suspense
                  fallback={
                    <Card>
                      <ProgressChip>Opening the rewrite…</ProgressChip>
                    </Card>
                  }
                >
                  <RewriteView
                    original={run.snapshot.article}
                    before={rubricData}
                    beforePlatforms={platformsData}
                    rewrite={rewrite.result!}
                    after={{ data: dataOf(rewrite.rubric), error: errorOf(rewrite.rubric) }}
                    afterPlatforms={{ data: dataOf(rewrite.platforms), error: errorOf(rewrite.platforms) }}
                    onRetryRescore={retryRescore}
                    onUse={adoptRewrite}
                  />
                </Suspense>
              ) : (
                <>
                  {run.rubric.status === 'error' ? (
                    <InlineError message={run.rubric.error.message} onRetry={run.rubric.error.retryable ? retryRubric : undefined} />
                  ) : (
                    <div className="flex flex-wrap gap-5 items-start">
                      <div className="[flex:1_1_360px] min-w-0 flex flex-col gap-5">
                        <ScoreHero result={rubricData} />
                        <RewriteCard
                          phase={rewritePhase}
                          blocked={stale ? 'stale' : !rubricData ? 'loading' : null}
                          onRewrite={startRewrite}
                          onCancel={cancelRewrite}
                          onView={() => {
                            setView('rewrite');
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                          }}
                        />
                      </div>
                      <WhyNot100 result={rubricData} />
                    </div>
                  )}
                  <PlatformFit result={platformsData} error={errorOf(run.platforms)} onRetry={retryPlatforms} />
                </>
              )}
            </>
          )}
        </main>

        {run && <Footer model={rubricData?.model ?? platformsData?.model} durationMs={rubricData?.durationMs} />}
      </div>
    </div>
  );
}
