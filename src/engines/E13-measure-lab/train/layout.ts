/**
 * E13 unit-train 판 좌표(논리 1000×600). 본 판과 힌트 ② 오버레이가 같은 식을 써서 1px 안에 겹친다.
 * 1m 칸은 한 변이 `cell`인 정사각형이고, 10cm 막대 열 개는 같은 크기의 정사각형 안에 세로 띠로 모인다
 * (10cm 막대 10개 = 1m 칸이 눈으로 보인다). 칸이 많으면 작은 크기로 줄여 줄 바꿈한다.
 */
import type { TrainState } from './types';

/** 논리 너비와 포인터 좌표 한계(높이 600). 판이 그리는 높이는 `boardHeight()`다. */
export const BOARD = { width: 1000, height: 600 } as const;
export const LEFT = 150;
/** 위쪽 100px은 1m 줄자 오버레이(meter-100) 자리다. */
export const SUBTRAHEND = { x: LEFT, y: 104, height: 42 } as const;
export const M_TOP = 190;

export interface TrainGeo {
  readonly big: boolean;
  /** 1m 칸(정사각형) 한 변. */
  readonly cell: number;
  readonly gap: number;
  readonly perRow: number;
  readonly groups: number;
  readonly mRows: number;
  readonly gRows: number;
  readonly cmTop: number;
  readonly blockTop: number;
  readonly block: number;
  readonly blockPerRow: number;
}

export function geoOf(state: Pick<TrainState, 'm' | 'rods' | 'blocks'>): TrainGeo {
  const groups = Math.ceil(state.rods / 10);
  const big = Math.max(state.m, groups) <= 10;
  const cell = big ? 72 : 34;
  const gap = big ? 8 : 4;
  const perRow = big ? 10 : 21;
  const rowH = cell + gap;
  const mRows = Math.max(1, Math.ceil(state.m / perRow));
  const gRows = Math.max(1, Math.ceil(groups / perRow));
  const cmTop = M_TOP + mRows * rowH + 50;
  const block = big ? 24 : 14;
  return {
    big,
    cell,
    gap,
    perRow,
    groups,
    mRows,
    gRows,
    cmTop,
    blockTop: cmTop + gRows * rowH + 20,
    block,
    blockPerRow: Math.floor(820 / (block + 4)),
  };
}

/** 판 아래 여백(논리 px). */
const BOTTOM_PAD = 30;

/**
 * unit-train 판의 논리 높이(T223): 1cm 블록 줄(블록이 없어도 한 줄 자리) 아래 끝 + 여백.
 * 블록을 풀 때마다 판이 늘었다 줄지 않게 처음부터 한 줄을 비워 둔다. 600을 넘지 않는다.
 */
export function boardHeight(state: Pick<TrainState, 'm' | 'rods' | 'blocks'>): number {
  const geo = geoOf(state);
  const blockRows = Math.max(1, Math.ceil(state.blocks / geo.blockPerRow));
  const bottom = geo.blockTop + blockRows * (geo.block + 4);
  return Math.min(BOARD.height, bottom + BOTTOM_PAD);
}

/** m 칸 i번(0부터)의 왼쪽 위. */
export function mCellAt(geo: TrainGeo, index: number): { x: number; y: number } {
  return {
    x: LEFT + (index % geo.perRow) * (geo.cell + geo.gap),
    y: M_TOP + Math.floor(index / geo.perRow) * (geo.cell + geo.gap),
  };
}

/** cm 줄의 막대 묶음(10개) g번(0부터)의 왼쪽 위. */
export function groupAt(geo: TrainGeo, group: number): { x: number; y: number } {
  return {
    x: LEFT + (group % geo.perRow) * (geo.cell + geo.gap),
    y: geo.cmTop + Math.floor(group / geo.perRow) * (geo.cell + geo.gap),
  };
}

/** 1cm 블록 i번(0부터)의 왼쪽 위. */
export function blockAt(geo: TrainGeo, index: number): { x: number; y: number } {
  return {
    x: LEFT + (index % geo.blockPerRow) * (geo.block + 4),
    y: geo.blockTop + Math.floor(index / geo.blockPerRow) * (geo.block + 4),
  };
}

/** 10cm 막대 하나의 너비(묶음 한 칸의 1/10). */
export function rodWidth(geo: TrainGeo): number {
  return geo.cell / 10;
}
