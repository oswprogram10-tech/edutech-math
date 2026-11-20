/**
 * E14 duration 판 좌표(논리 1000×600). 본 판과 오버레이가 같은 식을 써서 1px 안에 겹친다.
 * 한 시간이 한 블록이고, 블록 사이에 작은 틈이 있다. 화면 좌표만 number다.
 */
import type { DurationState } from './types';

export const BAND = {
  left: 60,
  right: 940,
  gap: 14,
  barTop: 250,
  barBottom: 330,
  /** 블록 안 10, 20, … 숫자의 글자 기준선. */
  numY: 358,
  /** 블록 경계 "n시" 이름표의 글자 기준선. */
  nameY: 418,
  /** 표시(▼)의 꼭짓점 y(놓였을 때). */
  markApexY: 244,
} as const;

/** 아직 놓지 않은 표시가 쉬는 자리(꼭짓점). */
export const TRAY = {
  y: 150,
  startX: 130,
  endX: 250,
  left: 60,
  right: 330,
  top: 76,
  bottom: 196,
} as const;

/** 표시를 놓을 수 있는 세로 범위(논리 y). 이 밖에서 놓으면 취소한다. */
export const DROP_ZONE = { top: 120, bottom: 400 } as const;

export interface Block {
  readonly index: number;
  readonly x0: number;
  readonly x1: number;
  /** 이 블록이 시작하는 하루 분. */
  readonly base: number;
}

type Range = Pick<DurationState, 'from' | 'to'>;

export function blockCount(range: Range): number {
  return (range.to - range.from) / 60;
}

export function blocksOf(range: Range): Block[] {
  const n = blockCount(range);
  const width = (BAND.right - BAND.left - BAND.gap * (n - 1)) / n;
  return Array.from({ length: n }, (_, index) => {
    const x0 = BAND.left + index * (width + BAND.gap);
    return { index, x0, x1: x0 + width, base: range.from + index * 60 };
  });
}

/** 하루 분 → 띠 위 x. 정시 경계는 다음 블록의 0분 자리, 맨 끝(to)만 마지막 블록의 60분 자리. */
export function xOfMinutes(range: Range, minutes: number): number {
  const blocks = blocksOf(range);
  const last = blocks[blocks.length - 1];
  if (last === undefined) return BAND.left;
  const k = Math.min(Math.max(Math.floor((minutes - range.from) / 60), 0), blocks.length - 1);
  const block = blocks[k] ?? last;
  return block.x0 + ((minutes - block.base) / 60) * (block.x1 - block.x0);
}

/** 한 블록 안 j분(0~60) 자리의 x. */
export function xInBlock(block: Block, minuteInHour: number): number {
  return block.x0 + (minuteInHour / 60) * (block.x1 - block.x0);
}

/** 논리 x에 가장 가까운 눈금 자리의 하루 분(step에 붙는다). 같은 거리면 앞쪽. */
export function nearestMinutes(range: Range & Pick<DurationState, 'step'>, x: number): number {
  let best = range.from;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const block of blocksOf(range)) {
    for (let j = 0; j <= 60; j += range.step) {
      const d = Math.abs(xInBlock(block, j) - x);
      if (d < bestDistance - 1e-9) {
        bestDistance = d;
        best = block.base + j;
      }
    }
  }
  return best;
}

/** 칠한 구간(start~end)을 블록 경계에서 나눈 조각들(하루 분). 끝이 start와 같으면 빈 목록. */
export function pieces(
  range: Range,
  start: number,
  end: number,
): { readonly lo: number; readonly hi: number; readonly block: number }[] {
  const out: { lo: number; hi: number; block: number }[] = [];
  for (const block of blocksOf(range)) {
    const lo = Math.max(start, block.base);
    const hi = Math.min(end, block.base + 60);
    if (hi > lo) out.push({ lo, hi, block: block.index });
  }
  return out;
}

/** 칠한 구간이 지나는 블록 경계(하루 분). 구간 끝점과 같은 경계는 지나는 것이 아니다. */
export function crossedBoundaries(range: Range, start: number, end: number): number[] {
  const out: number[] = [];
  for (let m = range.from + 60; m < range.to; m += 60) {
    if (start < m && m < end) out.push(m);
  }
  return out;
}

/** 블록 경계 사이 틈의 가운데 x(경계 분이 range 안쪽 정시일 때). */
export function gapCenterX(range: Range, boundaryMinutes: number): number {
  const blocks = blocksOf(range);
  const k = Math.round((boundaryMinutes - range.from) / 60);
  const before = blocks[k - 1];
  const after = blocks[k];
  if (before === undefined || after === undefined) return xOfMinutes(range, boundaryMinutes);
  return (before.x1 + after.x0) / 2;
}
