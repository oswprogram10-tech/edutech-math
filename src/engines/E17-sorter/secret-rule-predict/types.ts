/**
 * E17 `secret-rule` 의 `predict` 변형 타입.
 *
 * 컴퓨터의 비밀 기준(`rule`)으로 나뉜 예시를 보고, 새 카드가 어느 상자로 갈지 예측한 뒤 기준을 맞힌다.
 * 상태는 reduce가 순수 함수로 쓰이도록 기준을 담지만, 화면·Observation에는 맞히기 전에 내보내지 않는다.
 * 상태의 `mode`는 'predict'이고 Observation의 `mode`는 'secret-rule', `variant`는 'predict'다.
 */

export type PredictBin = 'yes' | 'no';

export interface RuleSpec {
  readonly attribute: string;
  /** 값은 문자열로 맞춘다(구멍 수 4 → "4"). */
  readonly value: string;
}

export interface PredictConfig {
  readonly mode?: 'secret-rule' | 'predict';
  readonly variant?: 'predict';
  readonly deck?: 'buttons-12';
  readonly rule?: { readonly attribute: string; readonly value: string | number };
  readonly shownExamples?: number;
  readonly predictionsToGuess?: number;
  readonly guessOptions?: readonly {
    readonly attribute: string;
    readonly value: string | number;
  }[];
  readonly seed?: number;
}

export interface PredictSettings {
  readonly rule: RuleSpec;
  readonly shownExamples: number;
  readonly predictionsToGuess: number;
  readonly guessOptions: readonly RuleSpec[];
  readonly seed: number;
  readonly error: string | null;
}

export interface PredictState {
  readonly mode: 'predict';
  readonly variant: 'predict';
  readonly deck: 'buttons-12';
  readonly settings: PredictSettings;
  /** 처음 보이는 예시 카드(seed 순서). */
  readonly examples: readonly string[];
  /** 예시가 아닌 카드의 순서(seed 순서). 다 쓰면 처음부터 다시 낸다. */
  readonly queue: readonly string[];
  readonly cursor: number;
  /** 지금 상자에 든 카드 → 상자. */
  readonly binOf: Readonly<Record<string, PredictBin>>;
  readonly streak: number;
  readonly predictions: number;
  readonly correctPredictions: number;
  readonly unlocked: boolean;
  readonly guesses: number;
  readonly guessedRight: boolean;
  /** 마지막 예측이 맞았는지(화면 문구용). */
  readonly lastResult: 'right' | 'wrong' | null;
  /** 마지막 기준 맞히기가 틀렸는지(화면 문구용). */
  readonly lastGuessWrong: boolean;
}

export type PredictAction =
  | { readonly type: 'predict'; readonly bin: PredictBin }
  | { readonly type: 'guess'; readonly attribute: string; readonly value: string | number }
  | { readonly type: 'reset' };

export const PREDICT_DEFAULT_RULE: RuleSpec = { attribute: 'color', value: 'red' };
export const PREDICT_DEFAULT_OPTIONS: readonly RuleSpec[] = [
  { attribute: 'color', value: 'red' },
  { attribute: 'color', value: 'blue' },
  { attribute: 'color', value: 'yellow' },
  { attribute: 'shape', value: 'circle' },
  { attribute: 'shape', value: 'square' },
  { attribute: 'shape', value: 'triangle' },
];
