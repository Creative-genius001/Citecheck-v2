import { useId, useState } from 'react';
import { CRITERIA, PLATFORMS } from '../../shared/rubric';
import { LIMITS } from '../../shared/text';
import { ChevronDown, ChevronUp, Shield } from '../ui/icons';
import { Card, SectionLabel } from './ui';

function Field({
  label,
  value,
  max,
  placeholder,
  helper,
  onChange,
}: {
  label: string;
  value: string;
  max: number;
  placeholder: string;
  helper: string;
  onChange: (value: string) => void;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-2">
      <div className="flex justify-between items-baseline gap-3">
        <label htmlFor={id} className="text-[14px] font-semibold">
          {label}
        </label>
        <span className="font-mono text-[11px] text-muted" aria-hidden="true">
          {value.length}/{max}
        </span>
      </div>
      <input
        id={id}
        value={value}
        maxLength={max}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        aria-describedby={`${id}-help`}
        className="h-[46px] w-full border border-line rounded-input bg-surface-2 px-3.5 text-[14px] text-ink focus:border-accent focus:outline-none focus-visible:outline-2 focus-visible:outline-accent"
      />
      <span id={`${id}-help`} className="text-[12px] leading-[1.45] text-muted">
        {helper}
      </span>
    </div>
  );
}

export function OptionalContext({
  author,
  topic,
  onAuthorChange,
  onTopicChange,
}: {
  author: string;
  topic: string;
  onAuthorChange: (v: string) => void;
  onTopicChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(true);
  const id = useId();
  return (
    <Card padding="none" className="px-[22px] pt-3.5 pb-[22px] max-sm:px-[18px] flex flex-col gap-4">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={`${id}-body`}
        onClick={() => setOpen((o) => !o)}
        className="h-11 flex items-center justify-between gap-2.5 text-ink"
      >
        <span className="label">Optional context</span>
        {open ? <ChevronUp /> : <ChevronDown />}
      </button>
      <div id={`${id}-body`} className={open ? 'flex flex-col gap-[18px]' : 'hidden'}>
        <Field
          label="About the author"
          value={author}
          max={LIMITS.maxAuthor}
          placeholder="Who you are and why you can speak to this"
          helper="Bylines rarely survive a paste. Helps score Trust signals."
          onChange={onAuthorChange}
        />
        <Field
          label="Target question or topic"
          value={topic}
          max={LIMITS.maxTopic}
          placeholder="The question this article should answer"
          helper="Helps judge Answer-first and ChatGPT’s likely questions."
          onChange={onTopicChange}
        />
      </div>
    </Card>
  );
}

export function PlatformChip({ label, monogram }: { label: string; monogram: string }) {
  return (
    <span className="inline-flex items-center gap-[7px] h-8 pl-1 pr-3 border border-line rounded-full text-[13px]">
      <span className="min-w-6 h-6 px-1 rounded-full bg-track flex items-center justify-center font-mono text-[10px] font-semibold">
        {monogram}
      </span>
      {label}
    </span>
  );
}

export function HowItsScored() {
  const id = useId();
  const byWeight = [...CRITERIA].sort((a, b) => b.weight - a.weight);
  return (
    <Card aria-labelledby={id} className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-2.5">
        <SectionLabel id={id}>How it’s scored</SectionLabel>
        <span className="font-mono text-[11px] text-muted">100 pts</span>
      </div>
      <ul className="m-0 p-0 list-none grid grid-cols-2 gap-1.5">
        {byWeight.map((c) => (
          <li key={c.id} className="flex items-center justify-between gap-2 px-3 py-2.5 bg-surface-3 rounded-input text-[13px]">
            <span>{c.short}</span>
            <span className="font-mono text-muted">{c.weight}</span>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-1.5 pt-1" aria-label="Platforms checked">
        {PLATFORMS.map((p) => (
          <PlatformChip key={p.id} label={p.label} monogram={p.monogram} />
        ))}
      </div>
      <p className="m-0 mt-1 pt-3 border-t border-divider flex gap-2 text-[12px] leading-[1.5] text-muted">
        <Shield className="mt-px" />
        Your article is sent to Google Gemini to be scored. CiteCheck doesn’t store it, and your draft stays in this tab.
      </p>
    </Card>
  );
}
