import { formatDuration } from '../lib/format';

export function Footer({ model, durationMs }: { model?: string; durationMs?: number }) {
  return (
    <footer className="flex flex-wrap justify-between gap-x-6 gap-y-2 px-1 py-0.5 font-mono text-[12px] text-muted">
      <span>{model ? `${model}${durationMs ? ` · scored in ${formatDuration(durationMs)}` : ''}` : 'CiteCheck'}</span>
      <span>Scores are estimates, not guarantees of citation.</span>
    </footer>
  );
}
