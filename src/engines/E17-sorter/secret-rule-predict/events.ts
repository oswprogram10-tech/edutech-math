/** E17 predict의 공개 이벤트·판정. 둘 다 순수 함수다. */
import type { EngineEvent, EnginePredicate, JsonValue } from '../../../core/engine-sdk';
import type { PredictAction, PredictState } from './types';

export const PREDICT_EVENT_NAMES = ['predicted', 'rule-guessed'] as const;

export function predictEmit(
  prev: PredictState,
  next: PredictState,
  action: PredictAction,
): EngineEvent[] {
  if (action.type === 'predict' && next.predictions > prev.predictions) {
    return [{ name: 'predicted', payload: { correct: next.lastResult === 'right' } }];
  }
  if (action.type === 'guess' && next.guesses > prev.guesses) {
    return [{ name: 'rule-guessed', payload: { correct: next.guessedRight } }];
  }
  return [];
}

function numberArg(args: JsonValue | undefined, key: string): number | null {
  if (args === null || args === undefined || typeof args !== 'object' || Array.isArray(args)) {
    return null;
  }
  const value = args[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export const predictPredicates: Readonly<Record<string, EnginePredicate>> = {
  guessedRight: (observation) =>
    observation['variant'] === 'predict' && observation['guessedRight'] === true,

  streakAtLeast: (observation, args) => {
    const n = numberArg(args, 'n');
    const streak = observation['streak'];
    return n !== null && typeof streak === 'number' && streak >= n;
  },
};
