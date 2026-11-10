/**
 * E17 분류기의 순수 reducer.
 *
 * - 무작위·시간을 쓰지 않는다. seed 난수는 `random.ts`의 순수 함수로만 쓰고
 *   결과 카드 id를 상태에 저장한다.
 * - reduce는 config를 받지 않으므로 필요한 설정은 `state.settings`에 복사한다.
 * - 수학 값은 저장하지 않는다. 성질·판정은 `observe.ts`가 계산한다.
 */
import { cardById, deckCards, deckIds } from './deck';
import { answerQuestion, quadProps, signature } from './properties';
import { secretFor } from './random';
import type {
  AngleCondition,
  CardId,
  CellKey,
  ConstraintToggle,
  DeckName,
  HierarchySettings,
  HierarchyState,
  QuadName,
  QuadNode,
  QuestionId,
  Role,
  SecretRuleState,
  SecretSettings,
  SideCondition,
  SorterAction,
  SorterConfig,
  SorterMode,
  SorterState,
  SwapEntry,
  SwapState,
  VennSettings,
  VennState,
} from './types';
import {
  ALL_ANGLE_CONDITIONS,
  ALL_QUESTIONS,
  ALL_QUAD_NAMES,
  ALL_SIDE_CONDITIONS,
  ALL_TOGGLES,
  DEFAULT_BLANK_NODES,
} from './types';

function recordOf(value: unknown): Readonly<Record<string, unknown>> | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Readonly<Record<string, unknown>>;
}

export function inferMode(config: SorterConfig | undefined): SorterMode {
  const record = recordOf(config) ?? {};
  if (
    record['mode'] === 'venn' ||
    record['mode'] === 'secret-rule' ||
    record['mode'] === 'hierarchy'
  ) {
    return record['mode'];
  }
  if (
    record['variant'] !== undefined ||
    record['questionBank'] !== undefined ||
    record['roleSwap'] !== undefined ||
    record['startRole'] !== undefined ||
    record['seed'] !== undefined
  ) {
    return 'secret-rule';
  }
  if (
    record['family'] !== undefined ||
    record['constraintToggles'] !== undefined ||
    record['trapezoidDefinition'] !== undefined ||
    record['treeBlanks'] !== undefined ||
    record['showPosition'] !== undefined
  ) {
    return 'hierarchy';
  }
  return 'venn';
}

function marksOf(value: unknown): 'auto' | 'show' | 'hide' {
  return value === 'show' || value === 'hide' ? value : 'auto';
}

function conditionsOf<T extends string>(
  value: unknown,
  allowed: readonly T[],
  fallback: readonly T[],
  max: number,
): T[] {
  if (!Array.isArray(value)) return [...fallback];
  const result: T[] = [];
  for (const item of value) {
    if (typeof item !== 'string') continue;
    const condition = item as T;
    if (!allowed.includes(condition) || result.includes(condition)) continue;
    result.push(condition);
  }
  return result.length > 0 ? result.slice(0, max) : [...fallback];
}

function vennSettings(config: SorterConfig): VennSettings {
  const record = recordOf(config) ?? {};
  const feedback = record['cellFeedback'];
  return {
    rows: conditionsOf<AngleCondition>(
      record['rows'],
      ALL_ANGLE_CONDITIONS,
      ALL_ANGLE_CONDITIONS,
      3,
    ),
    cols: conditionsOf<SideCondition>(
      record['cols'],
      ALL_SIDE_CONDITIONS,
      ['equilateral', 'isosceles-only', 'scalene'],
      3,
    ),
    cellFeedback: feedback === 'immediate' || feedback === 'none' ? feedback : 'on-check',
    marks: marksOf(record['marks']),
  };
}

function questionsOf(value: unknown): QuestionId[] {
  if (!Array.isArray(value)) return [...ALL_QUESTIONS];
  const result: QuestionId[] = [];
  for (const item of value) {
    if (typeof item !== 'string') continue;
    const question = item as QuestionId;
    if (!ALL_QUESTIONS.includes(question) || result.includes(question)) continue;
    result.push(question);
  }
  return result.length > 0 ? result : [...ALL_QUESTIONS];
}

function secretSettings(config: SorterConfig): SecretSettings {
  const record = recordOf(config) ?? {};
  const seed = record['seed'];
  const role = record['startRole'];
  return {
    deck: 'quadrilaterals-16',
    questionBank: questionsOf(record['questionBank']),
    studentEliminates: record['studentEliminates'] !== false,
    roleSwap: record['roleSwap'] === true,
    startRole: role === 'answerer' ? 'answerer' : 'guesser',
    seed: typeof seed === 'number' && Number.isSafeInteger(seed) ? seed : 1,
    marks: marksOf(record['marks']),
  };
}

function treeBlanksOf(value: unknown): QuadNode[] {
  if (value === false) return [];
  if (!Array.isArray(value)) return [...DEFAULT_BLANK_NODES];
  const result: QuadNode[] = [];
  for (const item of value) {
    if (typeof item !== 'string') continue;
    const node = item as QuadNode;
    if (!ALL_QUAD_NAMES.includes(node) || node === 'quadrilateral') continue;
    if (!result.includes(node)) result.push(node);
  }
  return result;
}

function hierarchySettings(config: SorterConfig): HierarchySettings {
  const record = recordOf(config) ?? {};
  const definition = record['trapezoidDefinition'];
  const position = record['showPosition'];
  return {
    constraintToggles: conditionsOf<ConstraintToggle>(
      record['constraintToggles'],
      ALL_TOGGLES,
      ALL_TOGGLES,
      4,
    ),
    trapezoidDefinition: definition === 'exclusive' ? 'exclusive' : 'inclusive',
    treeBlanks: treeBlanksOf(record['treeBlanks']),
    showPosition: position === 'always' || position === 'never' ? position : 'auto',
    marks: marksOf(record['marks']),
  };
}

function emptySwap(): SwapState {
  return { secret: null, candidates: [], log: [], pending: null, done: false };
}

export function createInitialState(config: SorterConfig): SorterState {
  const mode = inferMode(config);
  if (mode === 'secret-rule') {
    const settings = secretSettings(config);
    const ids = deckIds(settings.deck);
    return {
      mode: 'secret-rule',
      variant: 'twenty-questions',
      deck: settings.deck,
      settings,
      role: settings.startRole,
      round: 0,
      secret: secretFor(settings.seed, 0, ids),
      asked: [],
      eliminated: [],
      guesses: [],
      solved: false,
      swap: emptySwap(),
    };
  }
  if (mode === 'hierarchy') {
    const settings = hierarchySettings(config);
    const blanks: Partial<Record<QuadNode, QuadName | null>> = {};
    for (const node of settings.treeBlanks) blanks[node] = null;
    return { mode: 'hierarchy', settings, toggles: [], blanks };
  }

  const settings = vennSettings(config);
  const placements: Record<CardId, CellKey | null> = {};
  for (const id of deckIds('triangles-12')) placements[id] = null;
  return {
    mode: 'venn',
    deck: 'triangles-12',
    settings,
    placements,
    impossible: [],
    checked: {},
    checks: 0,
    lastPlaced: null,
  };
}

function validCell(state: VennState, cell: CellKey): boolean {
  const [row, col] = cell.split('|');
  if (row === undefined || col === undefined) return false;
  return (
    state.settings.rows.includes(row as AngleCondition) &&
    state.settings.cols.includes(col as SideCondition)
  );
}

function reduceVenn(state: VennState, action: SorterAction): VennState {
  switch (action.type) {
    case 'place': {
      if (!deckIds(state.deck).includes(action.card)) return state;
      if (action.cell !== null && !validCell(state, action.cell)) return state;
      if (state.placements[action.card] === action.cell) return state;
      const placements = { ...state.placements, [action.card]: action.cell };
      const checked: Record<CardId, CellKey> = {};
      for (const [card, cell] of Object.entries(state.checked)) {
        if (card !== action.card) checked[card] = cell;
      }
      return {
        ...state,
        placements,
        checked,
        lastPlaced:
          action.cell === null
            ? state.lastPlaced === action.card
              ? null
              : state.lastPlaced
            : action.card,
      };
    }
    case 'toggle-impossible': {
      if (!validCell(state, action.cell)) return state;
      const impossible = state.impossible.includes(action.cell)
        ? state.impossible.filter((cell) => cell !== action.cell)
        : [...state.impossible, action.cell].sort();
      return { ...state, impossible };
    }
    case 'check': {
      const checked: Record<CardId, CellKey> = {};
      for (const [card, cell] of Object.entries(state.placements)) {
        if (cell !== null) checked[card] = cell;
      }
      return { ...state, checked, checks: state.checks + 1 };
    }
    default:
      return state;
  }
}

function propsOf(cardId: CardId) {
  const card = cardById('quadrilaterals-16', cardId);
  return card ? quadProps(card) : null;
}

/** 아직 묻지 않았고 후보를 예·아니요 둘 다 남기는 질문 중 가장 고르게 나누는 것. */
export function chooseQuestion(
  candidates: readonly CardId[],
  asked: readonly QuestionId[],
  bank: readonly QuestionId[],
): QuestionId | null {
  let best: QuestionId | null = null;
  let bestScore = Number.POSITIVE_INFINITY;
  for (const question of bank) {
    if (asked.includes(question)) continue;
    let yes = 0;
    let no = 0;
    for (const card of candidates) {
      const props = propsOf(card);
      if (!props) continue;
      if (answerQuestion(question, props)) yes += 1;
      else no += 1;
    }
    if (yes === 0 || no === 0) continue;
    const score = Math.abs(yes - no);
    if (score < bestScore) {
      best = question;
      bestScore = score;
    }
  }
  return best;
}

function reduceSecret(state: SecretRuleState, action: SorterAction): SecretRuleState {
  switch (action.type) {
    case 'ask': {
      if (state.role !== 'guesser' || state.solved) return state;
      if (!state.settings.questionBank.includes(action.question)) return state;
      if (state.asked.some((entry) => entry.question === action.question)) return state;
      const props = propsOf(state.secret);
      if (!props) return state;
      const answer = answerQuestion(action.question, props);
      let eliminated = state.eliminated;
      if (!state.settings.studentEliminates) {
        const remove = deckIds(state.deck).filter((id) => {
          const candidate = propsOf(id);
          return candidate !== null && answerQuestion(action.question, candidate) !== answer;
        });
        eliminated = [...new Set([...eliminated, ...remove])].sort();
      }
      return {
        ...state,
        asked: [...state.asked, { question: action.question, answer }],
        eliminated,
      };
    }
    case 'eliminate': {
      if (state.role !== 'guesser' || state.solved) return state;
      if (!deckIds(state.deck).includes(action.card)) return state;
      if (state.eliminated.includes(action.card)) return state;
      return { ...state, eliminated: [...state.eliminated, action.card].sort() };
    }
    case 'restore': {
      if (state.role !== 'guesser' || state.solved) return state;
      if (!state.eliminated.includes(action.card)) return state;
      return { ...state, eliminated: state.eliminated.filter((card) => card !== action.card) };
    }
    case 'guess': {
      if (state.role !== 'guesser' || state.solved) return state;
      if (!deckIds(state.deck).includes(action.card)) return state;
      if (state.eliminated.includes(action.card)) return state;
      const secret = cardById(state.deck, state.secret);
      const guessed = cardById(state.deck, action.card);
      if (!secret || !guessed) return state;
      const bank = state.settings.questionBank;
      const solved = signature(secret, bank).join(',') === signature(guessed, bank).join(',');
      return { ...state, guesses: [...state.guesses, action.card], solved };
    }
    case 'new-round': {
      const round = state.round + 1;
      return {
        ...state,
        round,
        secret: secretFor(state.settings.seed, round, deckIds(state.deck)),
        asked: [],
        eliminated: [],
        guesses: [],
        solved: false,
        swap: emptySwap(),
      };
    }
    case 'switch-role': {
      if (!state.settings.roleSwap) return state;
      if (state.role === action.role) return state;
      return { ...state, role: action.role, swap: emptySwap() };
    }
    case 'swap-pick': {
      if (state.role !== 'answerer' || state.swap.secret !== null) return state;
      if (!deckIds(state.deck).includes(action.card)) return state;
      const candidates = deckIds(state.deck);
      const pending = chooseQuestion(candidates, [], state.settings.questionBank);
      return {
        ...state,
        swap: { secret: action.card, candidates, log: [], pending, done: pending === null },
      };
    }
    case 'swap-answer': {
      if (state.role !== 'answerer') return state;
      const pending = state.swap.pending;
      if (pending === null || state.swap.secret === null) return state;
      const props = propsOf(state.swap.secret);
      if (!props) return state;
      const truth = answerQuestion(pending, props);
      const entry: SwapEntry = { question: pending, answer: action.answer, truth };
      const log = [...state.swap.log, entry];
      const asked = log.map((item) => item.question);
      const candidates = state.swap.candidates.filter((card) => {
        const candidate = propsOf(card);
        return candidate !== null && answerQuestion(pending, candidate) === truth;
      });
      const next = chooseQuestion(candidates, asked, state.settings.questionBank);
      return {
        ...state,
        swap: {
          ...state.swap,
          candidates,
          log,
          pending: next,
          done: next === null,
        },
      };
    }
    case 'swap-reset': {
      if (state.role !== 'answerer') return state;
      return { ...state, swap: emptySwap() };
    }
    default:
      return state;
  }
}

function reduceHierarchy(state: HierarchyState, action: SorterAction): HierarchyState {
  switch (action.type) {
    case 'toggle': {
      if (!state.settings.constraintToggles.includes(action.toggle)) return state;
      const next = state.toggles.includes(action.toggle)
        ? state.toggles.filter((toggle) => toggle !== action.toggle)
        : [...state.toggles, action.toggle];
      return { ...state, toggles: ALL_TOGGLES.filter((toggle) => next.includes(toggle)) };
    }
    case 'fill-blank': {
      if (!state.settings.treeBlanks.includes(action.node)) return state;
      if (action.name !== null && !ALL_QUAD_NAMES.includes(action.name)) return state;
      const blanks: Partial<Record<QuadNode, QuadName | null>> = { ...state.blanks };
      if (action.name !== null) {
        for (const node of state.settings.treeBlanks) {
          if (node !== action.node && blanks[node] === action.name) blanks[node] = null;
        }
      }
      blanks[action.node] = action.name;
      return { ...state, blanks };
    }
    default:
      return state;
  }
}

export function reduce(state: SorterState, action: SorterAction): SorterState {
  if (state.mode === 'venn') return reduceVenn(state, action);
  if (state.mode === 'secret-rule') return reduceSecret(state, action);
  return reduceHierarchy(state, action);
}

/** 데크에서 카드 성질을 계산한다. View가 카드 그리기에 쓴다. */
export function cardsOf(deck: DeckName) {
  return deckCards(deck);
}

/** 역할 바꾸기에서 지금까지 물은 질문 목록. */
export function swapAsked(swap: SwapState): QuestionId[] {
  return swap.log.map((entry) => entry.question);
}

export function roleAfter(role: Role): Role {
  return role === 'guesser' ? 'answerer' : 'guesser';
}
