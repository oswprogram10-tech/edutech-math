/** predict 설정 정규화. 기준이 guessOptions 밖이거나 값이 묶음에 없으면 `error`를 단다. */
import { attributeValues, deckAttributes } from '../decks';
import { predictStrings as S } from './strings.ko';
import { PREDICT_DEFAULT_OPTIONS, PREDICT_DEFAULT_RULE } from './types';
import type { PredictSettings, RuleSpec } from './types';

function recordOf(value: unknown): Readonly<Record<string, unknown>> | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Readonly<Record<string, unknown>>;
}

function specOf(value: unknown): RuleSpec | null {
  const record = recordOf(value);
  if (record === null) return null;
  const attribute = record['attribute'];
  const raw = record['value'];
  if (typeof attribute !== 'string') return null;
  if (typeof raw !== 'string' && typeof raw !== 'number') return null;
  if (!deckAttributes('buttons-12').includes(attribute)) return null;
  const text = String(raw);
  if (!attributeValues('buttons-12', attribute).includes(text)) return null;
  return { attribute, value: text };
}

const FALLBACK: PredictSettings = {
  rule: PREDICT_DEFAULT_RULE,
  shownExamples: 4,
  predictionsToGuess: 3,
  guessOptions: PREDICT_DEFAULT_OPTIONS,
  seed: 1,
  error: S.configError,
};

export function predictSettings(config: unknown): PredictSettings {
  const record = recordOf(config) ?? {};
  if (record['deck'] !== undefined && record['deck'] !== 'buttons-12') return FALLBACK;

  let rule: RuleSpec = PREDICT_DEFAULT_RULE;
  let guessOptions: readonly RuleSpec[] = PREDICT_DEFAULT_OPTIONS;
  // 샌드박스처럼 기준을 안 준 설정은 기본 예(빨강)를 쓴다. 기준을 주었는데 고르기 목록이 없으면 오류다.
  if (record['rule'] !== undefined || record['guessOptions'] !== undefined) {
    const parsedRule = specOf(record['rule']);
    const rawOptions = record['guessOptions'];
    if (parsedRule === null || !Array.isArray(rawOptions)) return FALLBACK;
    const options: RuleSpec[] = [];
    for (const item of rawOptions) {
      const spec = specOf(item);
      if (spec === null) return FALLBACK;
      if (!options.some((o) => o.attribute === spec.attribute && o.value === spec.value)) {
        options.push(spec);
      }
    }
    if (options.length < 2 || options.length > 6) return FALLBACK;
    if (
      !options.some((o) => o.attribute === parsedRule.attribute && o.value === parsedRule.value)
    ) {
      return FALLBACK;
    }
    rule = parsedRule;
    guessOptions = options;
  }

  const shown = record['shownExamples'];
  const needed = record['predictionsToGuess'];
  const seed = record['seed'];
  let shownExamples = 4;
  if (shown !== undefined) {
    if (typeof shown !== 'number' || !Number.isInteger(shown) || shown < 2 || shown > 8) {
      return FALLBACK;
    }
    shownExamples = shown;
  }
  let predictionsToGuess = 3;
  if (needed !== undefined) {
    if (typeof needed !== 'number' || !Number.isInteger(needed) || needed < 1 || needed > 12) {
      return FALLBACK;
    }
    predictionsToGuess = needed;
  }
  return {
    rule,
    shownExamples,
    predictionsToGuess,
    guessOptions,
    seed: typeof seed === 'number' && Number.isSafeInteger(seed) ? seed : 1,
    error: null,
  };
}
