/**
 * E13 `length` 모드(단위 반복·자 만들기)의 설정·상태·Action 타입.
 * 길이·위치는 Rational 문자열(cm, 0.5 격자)이다. 화면 좌표(px)는 상태에 두지 않는다.
 * 설정의 `object.lengthCm`는 재서 나오는 값(정답에 가깝다)이라 화면에 길이 글을 쓰지 않는다.
 */

export interface LengthConfig {
  mode?: 'length';
  object?: { name: string; lengthCm: string | number };
  /** 쓸 수 있는 단위 id 목록(`units.ts`). */
  units?: string[];
  iteration?: 'manual';
  /** 기본 true. 틈·겹침을 화면에 표시한다. */
  showGapOverlap?: boolean;
  buildRuler?: boolean;
  /** 뼘 시연: 같은 물건을 두 친구가 다른 뼘으로 잰 결과를 보여 준다(학생 조작과 상관없음). */
  demoSpans?: { objectName: string; objectCm: string | number };
}

export interface Piece {
  readonly unit: string;
  /** Rational 문자열(cm, 0.5 격자). */
  readonly start: string;
}

export interface MeasureState {
  readonly mode: 'length';
  /** null이 아니면 설정 오류. 화면은 오류 문구만 보인다. */
  readonly error: string | null;
  readonly objectName: string;
  /** Rational 문자열(cm). */
  readonly objectCm: string;
  readonly units: readonly string[];
  readonly showGapOverlap: boolean;
  readonly buildRuler: boolean;
  readonly demo: { readonly objectName: string; readonly objectCm: string } | null;
  /** 놓은 조각(놓은 순서). 시작 위치 순 정렬은 observe가 한다. */
  readonly pieces: readonly Piece[];
  readonly rulerMade: boolean;
  /** 눈금 번호(0~10) → 눈금에 놓은 숫자. */
  readonly labels: Readonly<Record<string, number>>;
  readonly moves: number;
}

export type LengthAction =
  | { readonly type: 'add'; readonly unit: string; readonly start: string }
  | { readonly type: 'move'; readonly index: number; readonly start: string }
  | { readonly type: 'remove'; readonly index: number }
  | { readonly type: 'make-ruler' }
  | { readonly type: 'label'; readonly tick: number; readonly value: number }
  | { readonly type: 'reset' };

export const MAX_PIECES = 40;
/** 띠 범위는 0 ~ (물건 길이 + 15cm). */
export const BAND_EXTRA_CM = 15;
export const LENGTH_CANVAS_SELECTOR = 'svg[data-testid="length-canvas"]';
