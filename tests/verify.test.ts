import { describe, expect, it } from 'vitest';
import { findNewFacts } from '../shared/verify';

const original = `# Scaling Postgres

Range partitioning reduced p99 latency from 840ms to 32ms across 500 million rows. It takes three steps.
See https://www.postgresql.org/docs/ for details.`;

const values = (flags: ReturnType<typeof findNewFacts>) => flags.map((f) => `${f.level}:${f.kind}:${f.value}`);

describe('findNewFacts', () => {
  it('passes a rewrite that only restructures', () => {
    const rewrite = `# Scaling Postgres

Range partitioning cuts p99 latency from 840 ms to 32 ms across 500 million rows.

1. Define the parent table.
2. Create partitions.
3. Verify pruning.

It takes 3 steps. See https://www.postgresql.org/docs/ for details.`;
    expect(findNewFacts(original, rewrite)).toEqual([]);
  });

  it('flags new numbers, years, links, quotes and names', () => {
    const rewrite = `Range partitioning cut latency by 96% in 2025, according to Gartner Research.
Read more at https://example.com/study. As one engineer put it, "partitioning saved our entire quarter".`;
    expect(values(findNewFacts(original, rewrite))).toEqual([
      'definite:number:96%',
      'definite:number:2025',
      'definite:url:https://example.com/study',
      'definite:quote:partitioning saved our entire quarter',
      'possible:name:Gartner Research',
    ]);
  });

  it('ignores placeholders and treats small plain integers as possible', () => {
    const rewrite = 'In [[ADD: month and 2024]], partitioning took 4 steps on [[ADD: hardware]].';
    expect(values(findNewFacts(original, rewrite))).toEqual(['possible:number:4']);
  });

  it('reads clock times as one number, so "9:30" doesn’t hide an invented "30%"', () => {
    const flags = findNewFacts('The 9:30 a.m. call ran long.', 'The 9:30 a.m. call ran long. Meeting time fell by about 30%.');
    expect(values(flags)).toEqual(['definite:number:30%']);
  });

  it('matches percentages and money only to the same kind of number', () => {
    const before = 'Costs rose 40 percent to $1,200. We had 30 people.';
    expect(findNewFacts(before, 'Costs rose 40% to $1200. We had 30 people.')).toEqual([]);
    expect(values(findNewFacts(before, 'About 30% of people left.'))).toEqual(['definite:number:30%']);
  });

  it('gives each flag the sentence it appears in', () => {
    const [flag] = findNewFacts(original, 'Partitioning helps. Latency fell 40% last year.');
    expect(flag.context).toBe('Latency fell 40% last year.');
  });
});
