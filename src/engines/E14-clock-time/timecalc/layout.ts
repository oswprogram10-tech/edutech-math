/**
 * E14 time-calc 판 좌표(논리 1000 × `boardHeight`). 본 판과 힌트 ② 오버레이가 같은 식을 써서 1px 안에 겹친다.
 * 왼쪽은 큰 단위(큰 블록 하나가 1), 오른쪽은 작은 단위(10개 막대 + 낱개 칸)다.
 * 큰 블록 하나와 막대 6개(= 60칸)는 같은 크기(96×110)라서 "60칸 = 큰 블록 하나"가 눈에 보인다.
 */
import type { TimeCalcState } from './types';

export const BOARD_WIDTH = 1000;
/** 큰 블록 한 변 크기와 줄 배치(한 줄에 3개). */
export const BIG = { w: 96, h: 110, gap: 14, perRow: 3, left: 60 } as const;
/** 막대 하나는 폭 16, 높이 110이고 막대 6개가 한 묶음(60칸)이다. */
export const ROD = { w: 16, h: 110, perGroup: 6, groupGap: 24 } as const;
export const GROUP_W = ROD.w * ROD.perGroup;
export const SMALL = { left: 500, single: 22, singleGap: 4, singlesPerRow: 12 } as const;
const BOTTOM_PAD = 30;
/** 너무 납작하지 않게 하는 논리 높이 바닥(E13 length와 같다). */
export const MIN_HEIGHT = 390;

export interface TimeCalcGeo {
  /** 뺄 시간 표(sub)의 위 끝. add에서는 없다. */
  readonly tableTop: number | null;
  /** 칸 이름(시간 칸·분 칸) 글의 가운데 y. */
  readonly titleY: number;
  /** 블록이 그려지는 위 끝. */
  readonly contentTop: number;
}

export const TABLE = { x: BIG.left, height: 42, width: 330 } as const;

export function geoOf(state: Pick<TimeCalcState, 'op'>): TimeCalcGeo {
  if (state.op === 'sub') return { tableTop: 16, titleY: 92, contentTop: 136 };
  return { tableTop: null, titleY: 30, contentTop: 74 };
}

export function bigRows(state: Pick<TimeCalcState, 'maxBig'>): number {
  return Math.max(1, Math.ceil(state.maxBig / BIG.perRow));
}

/**
 * time-calc 판의 논리 높이(T222·T223 규칙): 큰 블록 줄과 작은 칸 줄 중 더 긴 쪽의 아래 끝 + 여백.
 * 블록이 늘고 줄어도 높이가 바뀌지 않게 어느 상태에서든 모자라지 않는 값(`maxBig`)으로 정한다.
 * 크롬북에서 판의 짧은 변이 280px 아래로 납작해지지 않게 바닥(`MIN_HEIGHT`)을 둔다(E13 길이·어림 판과 같은 값, T223).
 * 600을 넘지 않는다.
 */
export function boardHeight(state: Pick<TimeCalcState, 'op' | 'maxBig'>): number {
  const geo = geoOf(state);
  const bigBottom = geo.contentTop + bigRows(state) * (BIG.h + BIG.gap) - BIG.gap;
  const smallBottom = geo.contentTop + ROD.h + 16 + SMALL.single;
  return Math.min(600, Math.max(MIN_HEIGHT, bigBottom + BOTTOM_PAD, smallBottom + BOTTOM_PAD));
}

/** 큰 블록 i번(0부터)의 왼쪽 위. */
export function bigAt(geo: TimeCalcGeo, index: number): { x: number; y: number } {
  return {
    x: BIG.left + (index % BIG.perRow) * (BIG.w + BIG.gap),
    y: geo.contentTop + Math.floor(index / BIG.perRow) * (BIG.h + BIG.gap),
  };
}

/** 막대 묶음(60칸) g번의 왼쪽 위. */
export function groupAt(geo: TimeCalcGeo, group: number): { x: number; y: number } {
  return { x: SMALL.left + group * (GROUP_W + ROD.groupGap), y: geo.contentTop };
}

/** 낱개 칸 i번의 왼쪽 위. */
export function singleAt(geo: TimeCalcGeo, index: number): { x: number; y: number } {
  return {
    x: SMALL.left + (index % SMALL.singlesPerRow) * (SMALL.single + SMALL.singleGap),
    y:
      geo.contentTop +
      ROD.h +
      16 +
      Math.floor(index / SMALL.singlesPerRow) * (SMALL.single + SMALL.singleGap),
  };
}
