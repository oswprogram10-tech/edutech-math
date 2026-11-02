/**
 * 응답 슬롯의 설정·상태·Action 타입.
 *
 * 응답은 엔진이 아니라 실행기의 특별 슬롯 `response`다. 엔진과 같은 모양의
 * createInitialState·reduce·observe·View를 두어 되돌리기·기록·재생이 기존
 * 구조 그대로 동작하게 한다.
 *
 * 수의 값은 `Rational`로 계산하고 상태·Observation에는 `toJSON()` 문자열로 둔다.
 * 학생이 쓴 표기(raw)는 약분하거나 끝자리 0을 지우지 않는다. 오개념 진단이
 * 표기 자체를 봐야 하기 때문이다.
 */
import type { CPA, EngineId, JsonValue } from '../../engine-sdk';

/** 실행기에서 예약한 슬롯 이름. `views`에는 쓸 수 없다. */
export const RESPONSE_SLOT = 'response';

export type NumberForm = 'integer' | 'fraction' | 'mixed' | 'decimal';

export type NumberPart = 'whole' | 'numerator' | 'denominator' | 'decimal';

export type CompareSymbol = '<' | '=' | '>';

/** 선택지·순서 항목에 붙는 읽기 전용 엔진 그림. */
export interface ResponseFigure {
  readonly engine: EngineId;
  readonly mode: string;
  readonly cpa: CPA;
  readonly config: JsonValue;
}

export interface NumberField {
  readonly kind: 'number';
  readonly id: string;
  readonly label?: string;
  /** 허용하는 입력 틀. 첫 값이 처음 보이는 틀이다. */
  readonly forms: readonly NumberForm[];
}

export interface ChoiceOption {
  readonly id: string;
  readonly label?: string;
  readonly figure?: ResponseFigure;
}

export interface ChoiceField {
  readonly kind: 'choice';
  readonly id: string;
  readonly label?: string;
  readonly options: readonly ChoiceOption[];
  readonly multiple: boolean;
}

export interface OrderItem {
  readonly id: string;
  readonly label?: string;
  readonly figure?: ResponseFigure;
}

export interface OrderField {
  readonly kind: 'order';
  readonly id: string;
  readonly label?: string;
  /** 콘텐츠에 적힌 순서가 처음 순서다. */
  readonly items: readonly OrderItem[];
}

export interface CompareField {
  readonly kind: 'compare';
  readonly id: string;
  readonly label?: string;
  readonly left: string;
  readonly right: string;
}

export interface SortCard {
  readonly id: string;
  readonly label: string;
}

export interface SortBin {
  readonly id: string;
  readonly label: string;
}

export interface SortField {
  readonly kind: 'sort';
  readonly id: string;
  readonly label?: string;
  readonly cards: readonly SortCard[];
  readonly bins: readonly SortBin[];
}

export type ResponseField = NumberField | ChoiceField | OrderField | CompareField | SortField;

export interface ResponseSpec {
  readonly fields: readonly ResponseField[];
}

export interface ResponseConfig {
  readonly fields: readonly ResponseField[];
}

export interface NumberFieldState {
  readonly kind: 'number';
  readonly forms: readonly NumberForm[];
  readonly form: NumberForm;
  readonly activePart: NumberPart;
  readonly whole: string;
  readonly numerator: string;
  readonly denominator: string;
  /** 소수점을 포함한 그대로의 표기. `0.40`의 끝 0을 지우지 않는다. */
  readonly decimal: string;
}

export interface ChoiceFieldState {
  readonly kind: 'choice';
  readonly multiple: boolean;
  readonly selected: readonly string[];
}

export interface OrderFieldState {
  readonly kind: 'order';
  readonly order: readonly string[];
}

export interface CompareFieldState {
  readonly kind: 'compare';
  readonly symbol: CompareSymbol | null;
}

export interface SortFieldState {
  readonly kind: 'sort';
  readonly bins: Readonly<Record<string, readonly string[]>>;
  readonly unsorted: readonly string[];
  /** 지금 옮기려고 고른 카드. Observation에는 넣지 않는다. */
  readonly picked: string | null;
}

export type ResponseFieldState =
  NumberFieldState | ChoiceFieldState | OrderFieldState | CompareFieldState | SortFieldState;

export interface ResponseState {
  readonly fields: Readonly<Record<string, ResponseFieldState>>;
}

export type ResponseAction =
  | { readonly type: 'number-form'; readonly field: string; readonly form: NumberForm }
  | { readonly type: 'number-focus'; readonly field: string; readonly part: NumberPart }
  | { readonly type: 'number-key'; readonly field: string; readonly key: string }
  | { readonly type: 'number-clear'; readonly field: string }
  | { readonly type: 'choice-toggle'; readonly field: string; readonly option: string }
  | { readonly type: 'order-up'; readonly field: string; readonly item: string }
  | { readonly type: 'order-down'; readonly field: string; readonly item: string }
  | {
      readonly type: 'order-reorder';
      readonly field: string;
      readonly item: string;
      readonly toIndex: number;
    }
  | { readonly type: 'compare-set'; readonly field: string; readonly symbol: CompareSymbol }
  | { readonly type: 'sort-pick'; readonly field: string; readonly card: string }
  | { readonly type: 'sort-place'; readonly field: string; readonly bin: string }
  | {
      readonly type: 'sort-place-card';
      readonly field: string;
      readonly card: string;
      readonly bin: string;
    }
  | { readonly type: 'sort-remove'; readonly field: string; readonly card: string };

export function defaultPart(form: NumberForm): NumberPart {
  if (form === 'fraction' || form === 'mixed') return 'numerator';
  if (form === 'decimal') return 'decimal';
  return 'whole';
}

export function partsOf(form: NumberForm): readonly NumberPart[] {
  if (form === 'fraction') return ['numerator', 'denominator'];
  if (form === 'mixed') return ['whole', 'numerator', 'denominator'];
  if (form === 'decimal') return ['decimal'];
  return ['whole'];
}
