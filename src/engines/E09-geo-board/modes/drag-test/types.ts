/**
 * drag-test 모드의 설정·상태·Action(T101).
 * 범용 동적기하 엔진이 아니라, 자유점·선분·컴퍼스 원·원 위의 점·교점·수선·평행선만
 * 담는 작은 의존 그래프다. 상태에는 정수·인덱스만 넣고(Rational·Surd는 넣지 않는다)
 * 좌표 계산은 `graph.ts`·`observe.ts`가 매번 정확히 다시 한다.
 */
import type { GeoBand } from '../../types';

export type DragTool =
  | 'move'
  | 'free-point'
  | 'segment'
  | 'compass'
  | 'intersection'
  | 'point-on-circle'
  | 'perpendicular'
  | 'parallel';

export type DragConstruction = 'free' | 'from-diagonals' | 'quad-conditions';

export type DiagonalToggle = 'bisect-each-other' | 'equal-length' | 'perpendicular';

export type QuadToggle = 'one-parallel-pair' | 'two-parallel-pairs' | 'equal-sides' | 'right-angle';

export type MeasureKind = 'sideLengths' | 'angles';

export type QuadParamName = 'p' | 't' | 'beta' | 'gamma' | 'delta' | 'u' | 's' | 'kappa' | 'c';

export interface DiagonalQuadParams {
  readonly kind: 'from-diagonals';
  /** A − O. 정수 격자 벡터. */
  readonly p: readonly [number, number];
  /** T_HALF 인덱스(1~23). */
  readonly t: number;
  /** S_TABLE 인덱스(0~11). */
  readonly beta: number;
  readonly gamma: number;
  readonly delta: number;
}

export interface ConditionQuadParams {
  readonly kind: 'quad-conditions';
  /** B − A. 정수 격자 벡터. */
  readonly u: readonly [number, number];
  /** T_HALF 인덱스(2~22). */
  readonly t: number;
  /** |AD|/|AB|. S_TABLE 인덱스(0~11). */
  readonly s: number;
  /** D에서 C로 가는 κ. S_TABLE 인덱스(0~11). */
  readonly kappa: number;
  /** 조건이 없을 때 C − A. 정수 격자 벡터. */
  readonly c: readonly [number, number];
}

export type QuadParams = DiagonalQuadParams | ConditionQuadParams;

export interface DragTestConfig {
  readonly mode: 'drag-test';
  readonly construction?: DragConstruction;
  /** 자유점 격자 칸 수. 12~36, 기본 24. */
  readonly lattice?: number;
  /** `move`는 항상 맨 앞에 붙는다. */
  readonly tools?: readonly DragTool[];
  readonly measure?: readonly MeasureKind[];
  readonly shakeButton?: boolean;
  /** uint32, 기본 1. */
  readonly seed?: number;
  /** 1~6, 기본 3. */
  readonly shakeRadius?: number;
  readonly diagonalToggles?: readonly DiagonalToggle[];
  readonly quadToggles?: readonly QuadToggle[];
  readonly classifyLive?: boolean;
  /** 받기만 하고 무시한다. 판정은 GoalSpec 몫이다. */
  readonly goal?: string;
}

export interface DragTestSettings {
  readonly lattice: number;
  readonly tools: readonly DragTool[];
  readonly measure: readonly MeasureKind[];
  readonly shakeButton: boolean;
  readonly construction: DragConstruction;
  readonly seed: number;
  readonly shakeRadius: number;
  readonly diagonalToggles: readonly DiagonalToggle[];
  readonly quadToggles: readonly QuadToggle[];
  readonly classifyLive: boolean;
}

export interface FreeNode {
  readonly id: string;
  readonly kind: 'free';
  readonly label: string;
  /** 정수 격자 좌표. 7번 구성에서는 화면 표시용으로 반올림한 값이다. */
  readonly at: readonly [number, number];
  /** 7번 구성의 정확한 유리 좌표(분자/분모 문자열). 있으면 `at`보다 우선한다. */
  readonly exact?: readonly [string, string];
}

export interface OnCircleNode {
  readonly id: string;
  readonly kind: 'on-circle';
  readonly label: string;
  readonly circle: string;
  readonly pos: number;
}

export interface IntersectionNode {
  readonly id: string;
  readonly kind: 'intersection';
  readonly label: string;
  readonly of: readonly [string, string];
  readonly which: 0 | 1;
}

export interface SegmentNode {
  readonly id: string;
  readonly kind: 'segment';
  readonly a: string;
  readonly b: string;
}

/** 실제 컴퍼스처럼 두 점으로 벌리고 중심에 침을 꽂는다. */
export interface CircleNode {
  readonly id: string;
  readonly kind: 'circle';
  readonly center: string;
  readonly from: string;
  readonly to: string;
}

export interface LineNode {
  readonly id: string;
  readonly kind: 'perpendicular' | 'parallel';
  readonly base: string;
  readonly through: string;
}

export type DragPointNode = FreeNode | OnCircleNode | IntersectionNode;

export type DragNode = DragPointNode | SegmentNode | CircleNode | LineNode;

export interface PreShake {
  readonly nodes: readonly DragNode[];
  readonly quad: QuadParams | null;
}

export interface DragTestState {
  readonly mode: 'drag-test';
  readonly tool: DragTool;
  readonly nodes: readonly DragNode[];
  readonly quad: QuadParams | null;
  readonly toggles: readonly (DiagonalToggle | QuadToggle)[];
  readonly shakeCount: number;
  readonly lastShakeMoved: boolean;
  readonly preShake: PreShake | null;
  readonly pickedAngles: readonly string[];
  readonly nextId: number;
  readonly settings: DragTestSettings;
}

export type DragTestAction =
  | { readonly type: 'select-drag-tool'; readonly tool: DragTool }
  | { readonly type: 'add-point'; readonly at: readonly [number, number] }
  | { readonly type: 'add-segment'; readonly a: string; readonly b: string }
  | {
      readonly type: 'add-circle';
      readonly center: string;
      readonly from: string;
      readonly to: string;
    }
  | { readonly type: 'add-on-circle'; readonly circle: string; readonly pos: number }
  | {
      readonly type: 'add-intersection';
      readonly of: readonly [string, string];
      readonly which: 0 | 1;
    }
  | {
      readonly type: 'add-line';
      readonly kind: 'perpendicular' | 'parallel';
      readonly base: string;
      readonly through: string;
    }
  | { readonly type: 'move-point'; readonly id: string; readonly at: readonly [number, number] }
  | { readonly type: 'move-point'; readonly id: string; readonly pos: number }
  | { readonly type: 'remove-node'; readonly id: string }
  | { readonly type: 'shake' }
  | { readonly type: 'toggle-angle-pick'; readonly point: string }
  | {
      readonly type: 'set-quad-param';
      readonly param: QuadParamName;
      readonly value: number | readonly [number, number];
    }
  | {
      readonly type: 'toggle-condition';
      readonly condition: DiagonalToggle | QuadToggle;
    };

/** T101에서는 classify가 고무줄 구조를 그대로 쓴다. */
export type DragBand = GeoBand;

export type DragObservation = Readonly<Record<string, unknown>>;
