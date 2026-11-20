/**
 * E13 roll-circle 판 좌표(논리 너비 1000). 본 판과 힌트 ② 오버레이가 같은 식을 써서 1px 안에 겹친다.
 * 위에서 아래로: 굴리기 구역(굴렁쇠 + 바닥 자) → 지름 막대 줄 → 기록표. 논리 높이는 설정만으로 정한다(T223):
 * 가장 큰 지름의 굴렁쇠가 들어가는 높이 + 막대 줄(도구가 있으면) + 기록표(기록이 있으면, 줄 수는 지름 수).
 * 화면 그림용 값만 number다(수학 값은 Rational 문자열).
 */
import { num } from '../../rat';
import { MAX_LOG } from './types';

export const BOARD = { width: 1000, maxHeight: 600 } as const;
/** 1cm = 20px. 지름 막대 4개(10cm × 4)가 판 오른쪽 끝 안에 들어오는 크기다. */
export const PX_CM = 20;
/** 자의 0 눈금 x(가장 큰 굴렁쇠가 왼쪽에 걸쳐도 판 안에 있다). */
export const X0 = 125;
export const RULER_CM = 35;
export const RULER_H = 44;
export const TOP_PAD = 24;
export const MARK_R = 8;
export const STICK_H = 30;
export const STICK_GAP = 16;

const TABLE_LABEL_SPACE = 36;
const HEAD_H = 34;
const ROW_H = 26;
const BOTTOM_PAD = 24;
const TABLE_X = 60;
const COL_W = [150, 170, 220] as const;
/** pi-precision 오버레이가 표 오른쪽에 덧그리는 칸. */
const EXTRA_GAP = 12;
const EXTRA_W = 240;

export interface RollBase {
  readonly diameters: readonly string[];
  readonly diameterStickTool: boolean;
  readonly logEnabled: boolean;
}

export interface TableGeo {
  readonly x: number;
  readonly top: number;
  readonly headH: number;
  readonly rowH: number;
  /** 기록표 줄 수(= 지름 개수, 최대 6). */
  readonly rows: number;
  readonly colX: readonly [number, number, number];
  readonly colW: readonly [number, number, number];
  readonly width: number;
  readonly height: number;
  readonly extraX: number;
  readonly extraW: number;
}

export interface RollGeo {
  /** 바닥 자 윗면 y(굴렁쇠가 서는 선). */
  readonly ground: number;
  readonly rulerBottom: number;
  /** 지름 막대 줄 윗면(도구가 없으면 null). */
  readonly sticksTop: number | null;
  readonly table: TableGeo | null;
  readonly height: number;
}

export function maxDiameter(state: Pick<RollBase, 'diameters'>): number {
  return state.diameters.reduce((best, d) => Math.max(best, num(d)), 1);
}

export function geoOf(state: RollBase): RollGeo {
  const ground = TOP_PAD + maxDiameter(state) * PX_CM;
  const rulerBottom = ground + RULER_H;
  const sticksTop = state.diameterStickTool ? rulerBottom + STICK_GAP : null;
  const contentBottom = sticksTop === null ? rulerBottom : sticksTop + STICK_H;
  if (!state.logEnabled) {
    return { ground, rulerBottom, sticksTop, table: null, height: contentBottom + BOTTOM_PAD };
  }
  const rows = Math.min(MAX_LOG, Math.max(1, state.diameters.length));
  const top = contentBottom + TABLE_LABEL_SPACE;
  const colX: [number, number, number] = [
    TABLE_X,
    TABLE_X + COL_W[0],
    TABLE_X + COL_W[0] + COL_W[1],
  ];
  const width = COL_W[0] + COL_W[1] + COL_W[2];
  const height = HEAD_H + rows * ROW_H;
  const table: TableGeo = {
    x: TABLE_X,
    top,
    headH: HEAD_H,
    rowH: ROW_H,
    rows,
    colX,
    colW: COL_W,
    width,
    height,
    extraX: TABLE_X + width + EXTRA_GAP,
    extraW: EXTRA_W,
  };
  return { ground, rulerBottom, sticksTop, table, height: top + height + BOTTOM_PAD };
}

/** roll-circle 판의 논리 높이(600 이하). 본 판과 오버레이가 같은 함수를 쓴다. */
export function boardHeight(state: RollBase): number {
  return Math.min(BOARD.maxHeight, geoOf(state).height);
}

/** 굴렁쇠 반지름(논리 px). */
export function radiusOf(diameter: string): number {
  return (num(diameter) * PX_CM) / 2;
}

export function r2(value: number): number {
  return Math.round(value * 100) / 100;
}
