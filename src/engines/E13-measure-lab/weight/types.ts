/**
 * E13 `weight`(무게)의 설정·상태·Action 타입. 무게는 g 정수 Rational 문자열이다.
 * - 윗접시저울: 물건 둘을 접시에 놓아 비교하거나, 클립 몇 개와 같은지 센다.
 * - 용수철저울: 물건을 고리에 걸어 눈금을 읽는다(0~springMaxG).
 * 물건의 g는 Observation에만 있고 화면 글·DOM·aria·data-에는 두지 않는다
 * (예외: 용수철저울 눈금 숫자와 학생이 쌓은 클립 수).
 */

export type WeightTool = 'pan-balance' | 'spring-scale';
export type ObjectKind = 'beachball' | 'iron-ball' | 'book' | 'apple' | 'pencil-case' | 'bag';
export type VisualSize = 'small' | 'medium' | 'large';
export type Pan = 'left' | 'right' | 'shelf';

export interface WeightObjectConfig {
  id: string;
  kind: ObjectKind;
  /** g 정수. */
  g: number | string;
  /** 그림 크기. 기본 medium(무게와 무관하다). */
  visualSize?: VisualSize;
}

export interface WeightConfig {
  mode?: 'weight';
  tools?: WeightTool[];
  objects?: WeightObjectConfig[];
  /** 용수철저울 눈금 끝(g, 100의 배수). 기본 1000. */
  springMaxG?: number | string;
  /** 클립 하나의 무게(g). 있으면 윗접시저울 오른쪽 접시에 클립을 쌓을 수 있다. */
  unitObjects?: { clip: number | string };
  /** true면 저울을 쓰기 전에 어느 물건이 더 무거울지 예측해야 한다. */
  predict?: boolean;
}

export interface WeightObject {
  readonly id: string;
  readonly kind: ObjectKind;
  /** g 정수 Rational 문자열. */
  readonly g: string;
  readonly visualSize: VisualSize;
  /** 학생 화면 이름(같은 종류가 여럿이면 가·나…가 붙는다). */
  readonly name: string;
}

export interface WeightState {
  readonly mode: 'weight';
  /** null이 아니면 설정 오류. 화면은 오류 문구만 보인다. */
  readonly error: string | null;
  readonly tools: readonly WeightTool[];
  readonly objects: readonly WeightObject[];
  readonly springMaxG: string;
  /** 클립 하나의 g. 클립을 쓰지 않으면 null. */
  readonly clipG: string | null;
  readonly predict: boolean;
  /** 왼쪽 접시의 물건 id. */
  readonly left: string | null;
  /** 오른쪽 접시의 물건 id. */
  readonly right: string | null;
  /** 오른쪽 접시에 쌓은 클립 수. */
  readonly clips: number;
  /** 용수철저울에 건 물건 id. */
  readonly hung: string | null;
  readonly prediction: string | null;
  readonly predictionLocked: boolean;
  /** 서로 반대 접시에 하나씩 올려 본 물건 쌍(`a|b`, 정렬). reset해도 남는다. */
  readonly pairs: readonly string[];
  readonly moves: number;
}

export type WeightAction =
  | { readonly type: 'place'; readonly id: string; readonly pan: Pan }
  | { readonly type: 'clip'; readonly delta: 1 | -1 }
  | { readonly type: 'hang'; readonly id: string | null }
  | { readonly type: 'predict'; readonly id: string }
  | { readonly type: 'reset' };

export const WEIGHT_CANVAS_SELECTOR = 'svg[data-testid="weight-canvas"]';
