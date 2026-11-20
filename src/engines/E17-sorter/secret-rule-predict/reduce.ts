/**
 * E17 predict 순수 reducer. seed 난수는 초기 상태를 만들 때만 쓰고, 그 결과(카드 순서)를 상태에 담는다.
 * 기준에 따른 정답 상자는 reduce 안에서만 계산한다(화면은 예측 뒤에야 안다).
 */
import { deckDefinition, valueKey } from '../decks';
import type { SortCard } from '../decks';
import { mulberry32 } from '../random';
import { predictSettings } from './settings';
import type { PredictAction, PredictBin, PredictSettings, PredictState, RuleSpec } from './types';

export function matchesRule(card: SortCard, rule: RuleSpec): boolean {
  return valueKey(card, rule.attribute) === rule.value;
}

function binFor(card: SortCard, rule: RuleSpec): PredictBin {
  return matchesRule(card, rule) ? 'yes' : 'no';
}

function shuffled(ids: readonly string[], seed: number): string[] {
  const random = mulberry32(seed >>> 0);
  const list = [...ids];
  for (let index = list.length - 1; index > 0; index -= 1) {
    const other = Math.floor(random() * (index + 1));
    const a = list[index];
    const b = list[other];
    if (a !== undefined && b !== undefined) {
      list[index] = b;
      list[other] = a;
    }
  }
  return list;
}

/** seed 순서로 섞고, 예시에 예·아니요가 하나 이상씩 들어가게 한다. */
export function orderCards(settings: PredictSettings): {
  readonly examples: string[];
  readonly queue: string[];
} {
  const cards = deckDefinition('buttons-12').cards;
  const byId = new Map(cards.map((card) => [card.id, card]));
  const order = shuffled(
    cards.map((card) => card.id),
    settings.seed,
  );
  const n = settings.shownExamples;
  const truthOf = (id: string): PredictBin => {
    const card = byId.get(id);
    return card ? binFor(card, settings.rule) : 'no';
  };
  const first = truthOf(order[0] ?? '');
  const head = order.slice(0, n);
  if (head.every((id) => truthOf(id) === first)) {
    const swapIndex = order.findIndex((id, index) => index >= n && truthOf(id) !== first);
    if (swapIndex >= 0) {
      const a = order[n - 1];
      const b = order[swapIndex];
      if (a !== undefined && b !== undefined) {
        order[n - 1] = b;
        order[swapIndex] = a;
      }
    }
  }
  return { examples: order.slice(0, n), queue: order.slice(n) };
}

export function initialPredictState(settings: PredictSettings): PredictState {
  const byId = new Map(deckDefinition('buttons-12').cards.map((card) => [card.id, card]));
  const { examples, queue } = orderCards(settings);
  const binOf: Record<string, PredictBin> = {};
  for (const id of examples) {
    const card = byId.get(id);
    if (card) binOf[id] = binFor(card, settings.rule);
  }
  return {
    mode: 'predict',
    variant: 'predict',
    deck: 'buttons-12',
    settings,
    examples,
    queue,
    cursor: 0,
    binOf,
    streak: 0,
    predictions: 0,
    correctPredictions: 0,
    unlocked: false,
    guesses: 0,
    guessedRight: false,
    lastResult: null,
    lastGuessWrong: false,
  };
}

export function createPredictState(config: unknown): PredictState {
  return initialPredictState(predictSettings(config));
}

/** 지금 예측할 새 카드. 예시가 아닌 카드를 seed 순서로 돌아가며 낸다. */
export function currentOf(state: PredictState): string | null {
  if (state.queue.length === 0) return null;
  return state.queue[state.cursor % state.queue.length] ?? null;
}

/** 두 기준이 이 묶음 카드를 똑같이 나누면 같은 기준으로 본다. */
function sameSplit(first: RuleSpec, second: RuleSpec): boolean {
  return deckDefinition('buttons-12').cards.every(
    (card) => matchesRule(card, first) === matchesRule(card, second),
  );
}

export function reducePredict(state: PredictState, action: PredictAction): PredictState {
  if (state.settings.error !== null) return state;
  switch (action.type) {
    case 'predict': {
      const id = currentOf(state);
      if (id === null || state.guessedRight) return state;
      if (action.bin !== 'yes' && action.bin !== 'no') return state;
      const card = deckDefinition('buttons-12').cards.find((candidate) => candidate.id === id);
      if (!card) return state;
      const truth = binFor(card, state.settings.rule);
      const right = action.bin === truth;
      const streak = right ? state.streak + 1 : 0;
      const cursor = state.cursor + 1;
      // 다음 새 카드가 지난 바퀴에 상자로 들어갔던 카드면 상자에서 꺼내 새 카드로 낸다.
      const next = state.queue[cursor % state.queue.length];
      const binOf: Record<string, PredictBin> = {};
      for (const [card, bin] of Object.entries({ ...state.binOf, [id]: truth })) {
        if (card !== next) binOf[card] = bin;
      }
      return {
        ...state,
        cursor,
        binOf,
        streak,
        predictions: state.predictions + 1,
        correctPredictions: state.correctPredictions + (right ? 1 : 0),
        unlocked: state.unlocked || streak >= state.settings.predictionsToGuess,
        lastResult: right ? 'right' : 'wrong',
        lastGuessWrong: false,
      };
    }
    case 'guess': {
      if (!state.unlocked || state.guessedRight) return state;
      const option = state.settings.guessOptions.find(
        (candidate) =>
          candidate.attribute === action.attribute && candidate.value === String(action.value),
      );
      if (!option) return state;
      if (sameSplit(option, state.settings.rule)) {
        return { ...state, guesses: state.guesses + 1, guessedRight: true, lastGuessWrong: false };
      }
      return {
        ...state,
        guesses: state.guesses + 1,
        streak: 0,
        unlocked: false,
        lastGuessWrong: true,
      };
    }
    case 'reset': {
      const fresh = initialPredictState(state.settings);
      return { ...fresh, guesses: state.guesses, guessedRight: state.guessedRight };
    }
    default:
      return state;
  }
}
