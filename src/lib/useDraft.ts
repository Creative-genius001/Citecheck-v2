import { useEffect, useState } from 'react';

export interface Draft {
  article: string;
  author: string;
  topic: string;
}

const KEY = 'citecheck:draft';
const EMPTY: Draft = { article: '', author: '', topic: '' };

/** Keeps the draft for this tab only, so a refresh doesn't lose it. Storage may be blocked; that's fine. */
export function useDraft() {
  const [draft, setDraft] = useState<Draft>(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(KEY) ?? 'null') as Partial<Draft> | null;
      if (saved && typeof saved.article === 'string') return { ...EMPTY, ...saved };
    } catch {
      // Storage unavailable or corrupt: start empty.
    }
    return EMPTY;
  });

  useEffect(() => {
    const id = setTimeout(() => {
      try {
        sessionStorage.setItem(KEY, JSON.stringify(draft));
      } catch {
        // Ignore: the draft simply won't survive a refresh.
      }
    }, 300);
    return () => clearTimeout(id);
  }, [draft]);

  return [draft, setDraft] as const;
}
