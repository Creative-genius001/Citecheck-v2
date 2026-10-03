import { useId, type ClipboardEvent } from 'react';
import { LIMITS, countWords } from '../../shared/text';
import { cx, formatInt } from '../lib/format';
import { htmlToMarkdown } from '../lib/paste';
import { ArrowRight } from '../ui/icons';
import { Button, Card, SectionLabel, Tag, TextButton } from './ui';

export function analyzeBlocker(article: string): string | null {
  const words = countWords(article);
  if (words < LIMITS.minWords) return 'Too short to assess meaningfully';
  if (words > LIMITS.maxWords || article.length > LIMITS.maxChars) {
    return `Split this into parts; CiteCheck analyzes up to ${formatInt(LIMITS.maxWords)} words`;
  }
  return null;
}

export function EditorCard({
  article,
  onArticleChange,
  onAnalyze,
  analyzeLabel,
  notice,
  onDone,
  onExample,
}: {
  article: string;
  onArticleChange: (value: string) => void;
  onAnalyze: () => void;
  analyzeLabel: string;
  /** Shown in place of an empty hint, e.g. "Cancelled." */
  notice?: string | null;
  /** When editing above existing results: collapses the editor again. */
  onDone?: () => void;
  onExample?: () => void;
}) {
  const id = useId();
  const words = countWords(article);
  const blocker = analyzeBlocker(article);
  const over = words > LIMITS.maxWords;
  const fill = over ? 100 : Math.min(words, LIMITS.minWords) / LIMITS.minWords * 100;
  const hint = blocker ?? notice ?? '';

  function handlePaste(e: ClipboardEvent<HTMLTextAreaElement>) {
    const markdown = htmlToMarkdown(e.clipboardData.getData('text/html'));
    if (!markdown) return;
    e.preventDefault();
    const field = e.currentTarget;
    // insertText keeps the browser's undo history; fall back to splicing the value.
    if (!document.execCommand?.('insertText', false, markdown)) {
      const { selectionStart, selectionEnd, value } = field;
      onArticleChange(value.slice(0, selectionStart) + markdown + value.slice(selectionEnd));
    }
  }

  return (
    <Card padding="lg" aria-labelledby={`${id}-label`} className="flex flex-col gap-4 [flex:999_1_640px]">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2.5">
          <SectionLabel id={`${id}-label`}>Your article</SectionLabel>
          <Tag>Markdown</Tag>
        </div>
        <div className="flex items-center gap-3">
          {onExample && !article.trim() && <TextButton onClick={onExample}>Try an example</TextButton>}
          {onDone && <Button onClick={onDone}>Done</Button>}
        </div>
      </div>

      <label htmlFor={`${id}-article`} className="sr-only">
        Article text
      </label>
      <textarea
        id={`${id}-article`}
        value={article}
        onChange={(e) => onArticleChange(e.target.value)}
        onPaste={handlePaste}
        placeholder="Paste your article here. Put the title on the first line or as a # heading. Pasting from Google Docs, Medium or Notion keeps headings and lists."
        spellCheck
        className="flex-1 w-full min-h-[440px] max-sm:min-h-[280px] resize-y rounded-field border-[1.5px] border-dashed border-line-strong bg-surface-2 p-[22px] max-sm:p-4 text-[17px] leading-[1.65] text-ink focus:border-solid focus:border-accent focus:outline-none focus-visible:outline-2 focus-visible:outline-accent transition-colors duration-[120ms]"
      />

      <div className="flex items-center justify-between gap-4 flex-wrap max-sm:flex-col max-sm:items-stretch">
        <div className="flex items-center gap-7 flex-wrap">
          <div className="flex flex-col gap-2 w-[190px]">
            <div className="flex justify-between font-mono text-[12px]">
              <span className="font-semibold">
                {formatInt(words)} {words === 1 ? 'word' : 'words'}
              </span>
              <span className="text-muted">{over ? `max ${formatInt(LIMITS.maxWords)}` : `min ${LIMITS.minWords}`}</span>
            </div>
            <div className="h-1.5 rounded-full bg-skeleton overflow-hidden">
              <div className={cx('h-full rounded-full transition-[width] duration-[120ms]', over ? 'bg-lost' : 'bg-ink')} style={{ width: `${fill}%` }} />
            </div>
          </div>
          {words > 0 && (
            <div className="flex flex-col gap-0.5">
              <span className="text-[12px] text-muted">Reading time</span>
              <span className="font-mono text-[14px] font-semibold">≈ {Math.max(1, Math.round(words / 238))} min</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-3.5 flex-wrap max-sm:flex-col max-sm:items-stretch">
          <span id={`${id}-hint`} aria-live="polite" className="text-[13px] text-muted">
            {hint}
          </span>
          <Button
            variant="primary"
            onClick={onAnalyze}
            disabled={blocker !== null}
            aria-describedby={`${id}-hint`}
            className="pl-6 pr-5 max-sm:w-full"
          >
            {analyzeLabel}
            <ArrowRight />
          </Button>
        </div>
      </div>
    </Card>
  );
}
