/**
 * E13 `length`의 `variant:'unit-train'`(길이 블록 기차 단위 승격기) 설정·상태·Action 타입.
 * 기차는 m 칸 줄(1m 칸)과 cm 칸 줄(10cm 막대 + 1cm 블록) 두 줄이다. 모든 값은 정수 칸 수다.
 * cm 값은 `rods`(10cm 막대 수)와 `blocks`(1cm 블록 수)로 나눠 들고 있다(cm = 10 × rods + blocks).
 */

export interface TrainConfig {
  mode?: 'length';
  variant: 'unit-train';
  op: 'add' | 'sub';
  /** 길이 문자열: "1m 70cm", "205cm", "3m". 0 ≤ 값 < 10m. */
  a: string;
  b: string;
  /** 명세 예시의 `promote`는 참고용이라 읽지 않는다(승격 규칙은 100cm → 1m로 고정). */
  promote?: unknown;
}

/** 파싱한 길이. m과 cm는 문자열에 적힌 그대로(정규화하지 않는다). */
export interface Length {
  readonly m: number;
  readonly cm: number;
}

export interface TrainState {
  readonly mode: 'length';
  readonly variant: 'unit-train';
  /** null이 아니면 설정 오류. 화면은 오류 문구만 보인다. */
  readonly error: string | null;
  readonly op: 'add' | 'sub';
  /** 뺄 길이(sub). add에서는 더한 두 번째 길이다. */
  readonly b: Length;
  /** sub에서 "뺄 길이" 표에 쓰는 글. add에서는 빈 글. */
  readonly bText: string;
  /** 처음 기차(reset이 되돌아가는 자리). */
  readonly initial: { readonly m: number; readonly rods: number; readonly blocks: number };
  readonly m: number;
  readonly rods: number;
  readonly blocks: number;
  readonly promotes: number;
  readonly unpacks: number;
  readonly tookAway: boolean;
  readonly moves: number;
}

export type TrainAction =
  | { readonly type: 'promote' }
  | { readonly type: 'unpack' }
  | { readonly type: 'unpack-small' }
  | { readonly type: 'take-away' }
  | { readonly type: 'reset' };

export const TRAIN_CANVAS_SELECTOR = 'svg[data-testid="train-canvas"]';
