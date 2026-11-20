/**
 * E13 `capacity`(들이)의 설정·상태·Action 타입. 들이는 mL 정수 Rational 문자열이다.
 * - `cup-count`: 같은 컵으로 몇 번 들어가는지 세어 두 그릇의 들이를 비교한다.
 * - `puzzle`: 눈금 없는 비커 둘로 채우기·비우기·옮겨 붓기만 해서 정해진 양을 만든다.
 * 물의 양(mL)은 Observation에만 있고 화면 글·DOM·aria·data-에는 두지 않는다(학생이 센 컵 수는 예외).
 */

export type CapacityVariant = 'cup-count' | 'puzzle';
export type ContainerKind = 'bottle' | 'bowl' | 'beaker';
export type ContainerShape = 'tall' | 'wide';

export interface CapacityContainerConfig {
  id: string;
  /** 없으면 그릇 종류 이름(같은 종류가 둘이면 가·나를 붙인다). */
  label?: string;
  kind?: ContainerKind;
  shape?: ContainerShape;
  /** mL 정수. */
  capacityMl: number | string;
  /** puzzle: 눈금 없음(false)만 허용한다. */
  marks?: false;
}

export interface CapacityConfig {
  mode?: 'capacity';
  variant?: CapacityVariant;
  containers?: CapacityContainerConfig[];
  /** cup-count: 컵 한 번의 들이(mL 정수). 기본 100. */
  cupMl?: number | string;
  source?: 'infinite';
  /** puzzle: 만들 양(mL 정수). */
  targetMl?: number | string;
}

export interface CapacityContainer {
  readonly id: string;
  readonly label: string;
  readonly kind: ContainerKind;
  readonly shape: ContainerShape;
  /** mL 정수 Rational 문자열. */
  readonly capacityMl: string;
}

export interface CapacityState {
  readonly mode: 'capacity';
  /** null이 아니면 설정 오류. 화면은 오류 문구만 보인다. */
  readonly error: string | null;
  readonly variant: CapacityVariant;
  readonly containers: readonly CapacityContainer[];
  /** cup-count: 컵 한 번의 mL. puzzle에서는 "0". */
  readonly cupMl: string;
  /** puzzle: 만들 양(mL). cup-count에서는 "0". */
  readonly targetMl: string;
  /** 그릇 id → 지금 물의 양(mL 문자열). */
  readonly amounts: Readonly<Record<string, string>>;
  /** puzzle: 처음(또는 마지막 reset) 뒤 받아들여진 채우기·비우기·붓기 횟수. */
  readonly steps: number;
  readonly moves: number;
}

export type CapacityAction =
  | { readonly type: 'pour-cup'; readonly id: string }
  | { readonly type: 'fill'; readonly id: string }
  | { readonly type: 'empty'; readonly id: string }
  | { readonly type: 'pour'; readonly from: string; readonly to: string }
  | { readonly type: 'reset' };

export const CAPACITY_CANVAS_SELECTOR = 'svg[data-testid="capacity-canvas"]';
