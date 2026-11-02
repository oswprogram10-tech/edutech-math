/**
 * E00-demo의 설정·상태·Action·Observation 타입.
 * 엔진 상태에는 화면 픽셀이 아니라 논리 좌표(1000×600)를 저장한다.
 */
import type { Point } from '../../core/engine-sdk';

export interface DemoConfig {
  /** 자석 스냅 격자 크기(논리 좌표). */
  readonly gridSize?: number;
}

export interface DemoCounter {
  readonly id: string;
  readonly x: number;
  readonly y: number;
}

export interface DemoGroup {
  readonly id: string;
  readonly counterIds: readonly string[];
}

export interface DemoState {
  readonly counters: readonly DemoCounter[];
  readonly groups: readonly DemoGroup[];
  readonly nextCounterId: number;
  readonly nextGroupId: number;
}

export type DemoAction =
  | { readonly type: 'add'; readonly x: number; readonly y: number }
  | { readonly type: 'move'; readonly id: string; readonly x: number; readonly y: number }
  | { readonly type: 'group'; readonly ids: readonly string[] }
  | { readonly type: 'ungroup'; readonly groupId: string };

/** observe()가 내놓는 값. 판정·힌트는 이 값만 본다. */
export type DemoObservation = {
  readonly count: number;
  readonly groups: number[];
};

export const LOGICAL_WIDTH = 1000;
export const LOGICAL_HEIGHT = 600;
export const DEFAULT_GRID_SIZE = 100;

export const DEMO_ORIGIN: Point = { x: LOGICAL_WIDTH / 2, y: LOGICAL_HEIGHT / 2 };
