/**
 * E11 자르고 붙이기의 설정·상태·Action 유니온.
 *
 * 공통 파일은 모드 폴더의 타입을 그대로 유니온에 넣기만 한다. T107이
 * `tangram/`·`circle-sectors/`를 더할 때 이 파일의 유니온 항목만 늘리면 된다.
 */
import type { AngleGatherAction, AngleGatherConfig, AngleGatherState } from './angle-gather/types';
import type { FormulaDeriveConfig, PiecesAction, PiecesState, SliceConfig } from './pieces/types';

export type CutMode = 'slice' | 'formula-derive' | 'angle-gather';

export type CutConfig = SliceConfig | FormulaDeriveConfig | AngleGatherConfig;

export type CutState = PiecesState | AngleGatherState;

export type CutAction = PiecesAction | AngleGatherAction;

export const LOGICAL_WIDTH = 1200;
export const LOGICAL_HEIGHT = 800;

/** 조각 판: 22×14칸, 한 칸 50, 원점 화면 (50, 50). */
export const BOARD_COLS = 22;
export const BOARD_ROWS = 14;
export const CELL = 50;
export const BOARD_ORIGIN = { x: 50, y: 50 } as const;

/** angle-gather 못판: 13×13못(0~12), 한 칸 50, 원점 화면 (50, 100). */
export const PEG_MAX = 12;
export const PEG_ORIGIN = { x: 50, y: 100 } as const;

/** 모으는 점과 판. */
export const GATHER_CENTER = { x: 925, y: 400 } as const;
export const GATHER_RADIUS = CELL * 1.5;
export const GATHER_PAD = { x: 700, y: 150, width: 450, height: 500 } as const;

export function xOfGrid(value: number): number {
  return BOARD_ORIGIN.x + value * CELL;
}

export function yOfGrid(value: number): number {
  return BOARD_ORIGIN.y + value * CELL;
}

export function pegX(value: number): number {
  return PEG_ORIGIN.x + value * CELL;
}

export function pegY(value: number): number {
  return PEG_ORIGIN.y + value * CELL;
}
