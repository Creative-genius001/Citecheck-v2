/**
 * The citability rubric and platform profiles.
 * Single source of truth: the prompts, the scoring math and the UI all read from here.
 */

export type CriterionId =
  | 'answer_first'
  | 'self_contained'
  | 'evidence'
  | 'originality'
  | 'quotability'
  | 'confidence'
  | 'structure'
  | 'trust';

export interface Criterion {
  id: CriterionId;
  label: string;
  /** Short name for the "How it's scored" chips. */
  short: string;
  weight: number;
  /** Score anchors given to the model; it interpolates between them. */
  anchors: { 10: string; 8: string; 5: string; 2: string };
  note?: string;
}

/** Rubric order. Also breaks ties when sorting by points lost. Weights total 100. */
export const CRITERIA: readonly Criterion[] = [
  {
    id: 'answer_first',
    label: 'Answer-first',
    short: 'Answer-first',
    weight: 15,
    anchors: {
      10: "The opening 1–2 sentences directly answer the article's core question; every section opens with its key point.",
      8: 'The main point is stated within the first paragraph; most sections lead with their point.',
      5: 'The main point appears only after a long intro (2+ paragraphs), or sections are inconsistent.',
      2: 'The core point is buried late or never stated plainly; sections open with anecdote or preamble.',
    },
    note: 'For opinion pieces the thesis counts as the answer.',
  },
  {
    id: 'self_contained',
    label: 'Self-contained passages',
    short: 'Self-contained',
    weight: 10,
    anchors: {
      10: 'Any section can be lifted out alone and still make sense; subjects are named explicitly; no backward references.',
      8: 'Mostly standalone; a few "this", "it" or "as mentioned above" references.',
      5: 'Many passages depend on earlier context; frequent vague pronouns.',
      2: 'Reads as one continuous thread; passages are meaningless out of context.',
    },
  },
  {
    id: 'evidence',
    label: 'Evidence and specificity',
    short: 'Evidence',
    weight: 20,
    anchors: {
      10: 'Key claims are backed by concrete numbers, named sources, dates or worked examples; confident claims are supported.',
      8: 'Most key claims are supported; a few general statements.',
      5: 'A mix of specific and vague; several confident claims without support.',
      2: 'Generalities ("many people", "very fast"); claims asserted with no support.',
    },
    note: 'Unsupported confident claims lose points here, so confident wording never rewards overclaiming.',
  },
  {
    id: 'originality',
    label: 'Original contribution',
    short: 'Originality',
    weight: 15,
    anchors: {
      10: 'Clear first-hand data, experience, experiments, or a distinctive framework not found elsewhere.',
      8: 'Some original insight or examples on top of common knowledge.',
      5: 'Competent synthesis of widely available information; little that is new.',
      2: 'Generic content found on dozens of other pages.',
    },
  },
  {
    id: 'quotability',
    label: 'Quotable statements',
    short: 'Quotability',
    weight: 10,
    anchors: {
      10: 'Several crisp, standalone sentences that define, conclude or quantify, and could be lifted word for word.',
      8: 'A few clean quotable lines.',
      5: 'The ideas are there but wrapped in long or hedged sentences.',
      2: 'No sentence works as a standalone answer.',
    },
  },
  {
    id: 'confidence',
    label: 'Confident wording',
    short: 'Confidence',
    weight: 10,
    anchors: {
      10: 'Points the article supports are stated plainly and directly; hedges appear only where real uncertainty exists, and that uncertainty is stated specifically.',
      8: 'Mostly direct, with a few unnecessary hedges or filler qualifiers.',
      5: 'Frequent hedging ("I think", "might", "perhaps", "kind of") weakens points the article actually supports.',
      2: 'Nearly every claim is hedged or apologetic; no sentence commits to an answer.',
    },
    note: 'Judge only how directly supported points are worded. Whether claims are backed up is scored under Evidence.',
  },
  {
    id: 'structure',
    label: 'Structure',
    short: 'Structure',
    weight: 10,
    anchors: {
      10: 'Descriptive or question-style headings that match how people search; lists and tables where the content is list- or table-shaped; short paragraphs.',
      8: 'Good headings and formatting with minor gaps.',
      5: 'Some headings, but generic ("Introduction", "Thoughts") or long walls of text.',
      2: 'No headings; dense, unbroken text.',
    },
  },
  {
    id: 'trust',
    label: 'Trust signals',
    short: 'Trust signals',
    weight: 10,
    anchors: {
      10: "The author's relevant experience is evident; dates or versions are given where the topic is time-sensitive; balanced, non-promotional tone; sources are attributable.",
      8: 'Mostly trustworthy with a minor gap.',
      5: 'Somewhat promotional, or missing context on who is writing or when.',
      2: 'Heavily promotional, unattributed, or outdated without saying so.',
    },
    note: 'Dates count only when the topic is time-sensitive. Timeless content is not penalized for lacking dates.',
  },
] as const;

export const CRITERION_IDS = CRITERIA.map((c) => c.id) as CriterionId[];

export function criterionById(id: CriterionId): Criterion {
  const c = CRITERIA.find((x) => x.id === id);
  if (!c) throw new Error(`Unknown criterion: ${id}`);
  return c;
}

export type PlatformId = 'x' | 'paragraph' | 'medium' | 'substack' | 'chatgpt';

export interface PlatformFactor {
  id: string;
  label: string;
  measures: string;
}

export interface Platform {
  id: PlatformId;
  label: string;
  /** Letter monogram; platforms are never shown as logos. */
  monogram: string;
  factors: readonly [PlatformFactor, PlatformFactor, PlatformFactor, PlatformFactor];
  hasLikelyQuestions: boolean;
}

/** Display and prompt order. */
export const PLATFORMS: readonly Platform[] = [
  {
    id: 'x',
    label: 'X',
    monogram: 'X',
    hasLikelyQuestions: false,
    factors: [
      { id: 'hook', label: 'Hook', measures: 'Does the opening line stop the scroll on its own?' },
      { id: 'threadability', label: 'Thread-ability', measures: 'Can the argument split into standalone posts of 280 characters or fewer?' },
      { id: 'quotable_lines', label: 'Quotable lines', measures: 'Are there punchy lines worth quoting or reposting?' },
      { id: 'conversation', label: 'Conversation potential', measures: 'Is there a clear take people will respond to?' },
    ],
  },
  {
    id: 'paragraph',
    label: 'Paragraph',
    monogram: 'P',
    hasLikelyQuestions: false,
    factors: [
      { id: 'title_opening', label: 'Title and opening', measures: 'Do the title and first paragraph earn the click from a feed or email?' },
      { id: 'reader_payoff', label: 'Reader payoff', measures: 'Does the reader leave with something clear and useful?' },
      {
        id: 'community_fit',
        label: 'Community fit',
        measures:
          "Does it resonate with Paragraph's readership, which leans heavily crypto/web3-native? Judge use of familiar concepts and terminology, relevance to onchain culture, and whether non-crypto topics are framed in a way that audience cares about.",
      },
      { id: 'shareability', label: 'Shareability', measures: 'Would a reader share or collect it?' },
    ],
  },
  {
    id: 'medium',
    label: 'Medium',
    monogram: 'M',
    hasLikelyQuestions: false,
    factors: [
      { id: 'headline_subtitle', label: 'Headline and subtitle', measures: 'Clear, specific, curiosity-earning; works as a Medium title and subtitle.' },
      { id: 'scannability', label: 'Scannability', measures: 'Headings, short paragraphs, emphasis, lists.' },
      { id: 'read_length', label: 'Read length', measures: 'Roughly a 4–10 minute read for the topic; not padded, not thin.' },
      { id: 'discoverability', label: 'Discoverability', measures: 'A clear topic that maps to tags and search; descriptive headings.' },
    ],
  },
  {
    id: 'substack',
    label: 'Substack',
    monogram: 'S',
    hasLikelyQuestions: false,
    factors: [
      { id: 'subject_opening', label: 'Subject line and opening', measures: 'Would the title get the email opened, and the first lines keep it read?' },
      { id: 'voice', label: 'Voice and connection', measures: "A distinct personal voice; feels like it's from a person, not a brand." },
      { id: 'reader_payoff', label: 'Reader payoff', measures: "A clear takeaway worth the reader's inbox space." },
      { id: 'return_pull', label: 'Return pull', measures: 'A reason to subscribe or come back (series, perspective, promise).' },
    ],
  },
  {
    id: 'chatgpt',
    label: 'ChatGPT',
    monogram: 'AI',
    hasLikelyQuestions: true,
    factors: [
      { id: 'extractability', label: 'Answer extractability', measures: 'Clean passages that directly answer specific questions.' },
      { id: 'source_worthiness', label: 'Source-worthiness', measures: 'Evidence and originality that make it worth citing over alternatives.' },
      { id: 'entity_clarity', label: 'Entity clarity', measures: 'People, products, concepts and terms named explicitly and consistently.' },
      { id: 'currency', label: 'Currency and trust', measures: 'Dated where relevant; credible, non-promotional.' },
    ],
  },
] as const;

export const PLATFORM_IDS = PLATFORMS.map((p) => p.id) as PlatformId[];
