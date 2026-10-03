/**
 * Shared building blocks: cards, buttons, chips, states.
 */

import { useEffect, useRef, useState, type ButtonHTMLAttributes, type CSSProperties, type HTMLAttributes, type ReactNode } from 'react';
import type { Band } from '../../shared/scoring';
import { splitAddTokens } from '../../shared/text';
import { cx } from '../lib/format';
import { BAND_UI } from '../ui/band';
import { Alert, Check, Info, Retry, Warning } from '../ui/icons';

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

export function Card({
  padding = 'md',
  elevated = false,
  className,
  children,
  ...rest
}: HTMLAttributes<HTMLElement> & { padding?: 'md' | 'lg' | 'none'; elevated?: boolean }) {
  return (
    <section
      className={cx(
        'min-w-0 bg-surface border border-line rounded-card max-sm:rounded-[24px]',
        padding === 'md' && 'p-[22px] max-sm:p-[18px]',
        padding === 'lg' && 'p-6 max-sm:p-[18px]',
        elevated && 'shadow-score',
        className,
      )}
      {...rest}
    >
      {children}
    </section>
  );
}

export function SectionLabel({ id, children, as: Tag = 'h2' }: { id?: string; children: ReactNode; as?: 'h2' | 'h3' }) {
  return (
    <Tag id={id} className={Tag === 'h2' ? 'label' : 'label-s'}>
      {children}
    </Tag>
  );
}

// ---------------------------------------------------------------------------
// Buttons
// ---------------------------------------------------------------------------

type Variant = 'primary' | 'secondary' | 'small';

const VARIANTS: Record<Variant, string> = {
  primary:
    'h-[52px] px-6 gap-2.5 rounded-button bg-ink text-on-ink text-[15px] font-semibold hover:bg-primary-hover disabled:bg-disabled disabled:text-muted disabled:cursor-not-allowed',
  secondary:
    'h-11 px-4 gap-2 rounded-control bg-surface border border-line text-ink text-[14px] font-semibold hover:bg-surface-2 hover:border-line-strong disabled:opacity-60 disabled:cursor-not-allowed',
  small:
    'h-8 pointer-coarse:h-11 px-2.5 gap-1.5 rounded-small bg-surface border border-line text-ink text-[12px] font-semibold hover:bg-surface-2',
};

export function Button({
  variant = 'secondary',
  busy = false,
  danger = false,
  className,
  children,
  disabled,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; busy?: boolean; danger?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled || busy}
      className={cx(
        'inline-flex items-center justify-center whitespace-nowrap transition-colors duration-[120ms]',
        VARIANTS[variant],
        danger && 'text-error',
        className,
      )}
      {...rest}
    >
      {busy && <Spinner />}
      {children}
    </button>
  );
}

export function TextButton({ className, ...rest }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={cx(
        'text-accent text-[14px] font-medium underline-offset-2 hover:text-accent-strong hover:underline transition-colors duration-[120ms]',
        className,
      )}
      {...rest}
    />
  );
}

// ---------------------------------------------------------------------------
// Chips, tags, segmented control
// ---------------------------------------------------------------------------

export function Spinner() {
  return <span aria-hidden="true" className="inline-block size-3.5 shrink-0 rounded-full border-2 border-line-strong border-t-ink animate-spin-fast" />;
}

export function Skeleton({ className, style }: { className?: string; style?: CSSProperties }) {
  return <span aria-hidden="true" className={cx('block bg-skeleton rounded-line animate-pulse-soft', className)} style={style} />;
}

export function Tag({ children }: { children: ReactNode }) {
  return <span className="font-mono text-[11px] text-muted bg-track px-2 py-1 rounded-tag">{children}</span>;
}

export function StatusChip({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-accent-strong bg-accent-soft px-[11px] py-[7px] rounded-full">
      <Check size={13} stroke={2.6} />
      {children}
    </span>
  );
}

export function ProgressChip({ children }: { children: ReactNode }) {
  return (
    <span role="status" aria-live="polite" className="inline-flex items-center gap-2 text-[13px] font-medium text-muted bg-track px-[11px] py-[7px] rounded-full">
      <Spinner />
      {children}
    </span>
  );
}

export function LostChip({ children }: { children: ReactNode }) {
  return <span className="font-mono text-[12px] font-semibold text-lost bg-lost-soft px-2 py-1 rounded-full">{children}</span>;
}

export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div role="group" aria-label={label} className="inline-flex gap-0.5 p-[3px] bg-track rounded-input">
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(o.value)}
            className={cx(
              'h-[34px] pointer-coarse:h-11 px-3 rounded-small text-[13px] transition-colors duration-[120ms]',
              selected ? 'bg-surface shadow-segment font-semibold text-ink' : 'font-medium text-muted hover:text-ink',
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function BandPill({ band, children, size = 'md' }: { band: Band; children: ReactNode; size?: 'md' | 'sm' }) {
  const b = BAND_UI[band];
  return (
    <span
      className={cx('inline-flex items-center gap-1.5 rounded-full text-[13px] font-semibold', size === 'md' ? 'px-3 py-1.5' : 'px-2.5 py-[5px]')}
      style={{ background: b.soft, color: b.text }}
    >
      {size === 'md' && (b.icon === 'check' ? <Check size={14} /> : <Warning size={14} />)}
      {children}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Text with [[ADD: …]] placeholders, copy button
// ---------------------------------------------------------------------------

export function AddText({ text }: { text: string }) {
  return (
    <>
      {splitAddTokens(text).map((part, i) =>
        part.kind === 'add' ? (
          <mark key={i} className="bg-accent-soft text-accent-strong font-mono text-[12px] rounded-mark px-[5px] py-px [overflow-wrap:anywhere]">
            {part.value}
          </mark>
        ) : (
          <span key={i}>{part.value}</span>
        ),
      )}
    </>
  );
}

export function CopyButton({ text, label = 'Copy', variant = 'small' }: { text: string; label?: string; variant?: Variant }) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setState('copied');
    } catch {
      setState('failed');
    }
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setState('idle'), 2000);
  }

  return (
    <Button variant={variant} onClick={copy} aria-live="polite">
      {state === 'copied' ? 'Copied' : state === 'failed' ? 'Copy failed' : label}
    </Button>
  );
}

// ---------------------------------------------------------------------------
// Errors and notices
// ---------------------------------------------------------------------------

export function InlineError({
  message,
  detail,
  onRetry,
  className,
}: {
  message: string;
  detail?: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div role="alert" className={cx('flex items-start gap-3 p-4 rounded-box bg-error-soft border border-error-line', className)}>
      <span className="text-error mt-px">
        <Alert />
      </span>
      <div className="flex-1 min-w-0 flex flex-col gap-1">
        <p className="m-0 text-[14px] font-semibold text-error">{message}</p>
        {detail && <p className="m-0 text-[13px] text-ink-2">{detail}</p>}
      </div>
      {onRetry && (
        <Button onClick={onRetry}>
          <Retry />
          Retry
        </Button>
      )}
    </div>
  );
}

export function Notice({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cx('flex items-start gap-3 p-4 rounded-box bg-surface-3 border border-line-soft', className)}>
      <span className="text-muted mt-px">
        <Info />
      </span>
      <p className="m-0 text-[14px] leading-[1.5] text-ink-2">{children}</p>
    </div>
  );
}

/** Key-value box rows. */
export function KeyValueBox({ rows }: { rows: { key: string; value: ReactNode }[] }) {
  return (
    <dl className="m-0 bg-surface-3 border border-line-soft rounded-box">
      {rows.map((r, i) => (
        <div
          key={r.key}
          className={cx('flex items-center justify-between gap-3 px-4 py-3.5 text-[14px]', i > 0 && 'border-t border-line-soft')}
        >
          <dt className="text-muted">{r.key}</dt>
          <dd className="m-0 text-ink text-right">{r.value}</dd>
        </div>
      ))}
    </dl>
  );
}
