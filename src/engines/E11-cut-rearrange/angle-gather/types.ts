/** angle-gather 모드의 설정·상태·Action. */
import type { RPoint } from '../rpoint';

export type AngleShape = 'triangle' | 'quadrilateral';

/** 정수 못 좌표. `[i, j]` (x 오른쪽, y 아래쪽, 0~12). */
export type Peg = readonly [number, number];

export interface AngleGatherConfig {
  readonly mode?: 'angle-gather';
  readonly shape?: AngleShape;
  readonly vertices?: readonly Peg[];
  readonly deformable?: boolean;
  readonly showSum?: 'never' | 'after-gather';
  /** 시도 기록 칸 수. 기본 1, 1~5. */
  readonly repeatTrials?: number;
}

export interface AngleGatherSettings {
  readonly shape: AngleShape;
  readonly deformable: boolean;
  readonly showSum: 'never' | 'after-gather';
  readonly repeatTrials: number;
}

export interface Corner {
  readonly index: number;
  readonly gathered: boolean;
  readonly turned: boolean;
}

export interface AngleTrial {
  readonly vertices: readonly Peg[];
  readonly sum: 180 | 360;
}

export type AnglePhase = 'shape' | 'cut';

export interface AngleGatherState {
  readonly mode: 'angle-gather';
  readonly vertices: readonly Peg[];
  readonly phase: AnglePhase;
  readonly corners: readonly Corner[];
  readonly recorded: boolean;
  readonly trials: readonly AngleTrial[];
  readonly settings: AngleGatherSettings;
}

export type AngleGatherAction =
  | { readonly type: 'move-vertex'; readonly index: number; readonly to: Peg }
  | { readonly type: 'cut-corners' }
  | { readonly type: 'gather-corner'; readonly index: number; readonly turned: boolean }
  | { readonly type: 'ungather-corner'; readonly index: number }
  | { readonly type: 'turn-corner'; readonly index: number }
  | { readonly type: 'new-trial' };

/** 각 조각을 그릴 때 쓰는 정확한 삼각형과 두 반직선. */
export interface CornerPiece {
  readonly index: number;
  readonly vertex: Peg;
  readonly triangle: readonly RPoint[];
}
