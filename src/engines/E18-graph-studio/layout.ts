/**
 * E18 그래프 그림의 논리 좌표(1000×700). 화면 좌표만 실수다.
 *
 * 세로 그래프: 범주는 x축 아래, 값 눈금은 y축 왼쪽(0이 아래).
 * 가로 그래프: 범주는 y축 왼쪽(처음 범주가 위), 값 눈금은 x축 아래(0이 왼쪽).
 * View와 오버레이가 같은 계산을 쓴다.
 */
import type { GraphSettings, Orientation } from './types';
import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from './types';

export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface Frame {
  readonly orientation: Orientation;
  /** 그림의 논리 크기(viewBox). 누르는 ○ 그래프는 범주·칸 수에 맞춰 정하고, 나머지는 1000×700이다. */
  readonly width: number;
  readonly height: number;
  readonly plot: Rect;
  /** 범주 수(0이면 1로 본다). */
  readonly count: number;
  /** 값 축의 칸 수. */
  readonly cells: number;
}

const VERTICAL_PLOT: Rect = { x: 150, y: 80, width: 810, height: 490 };
const HORIZONTAL_PLOT: Rect = { x: 220, y: 80, width: 740, height: 500 };

/** 누르는 ○ 그래프의 논리 치수: 칸 간격, 범주 띠 폭(칸 한 변 + 여백), 가장자리 여백. */
const TOUCH_CELL = 70;
const TOUCH_BAND = 106;
const TOUCH_TOP = 60;

export function frameOf(
  orientation: Orientation,
  count: number,
  cells: number,
  /** 누르는 ○ 그래프(`isTouchOMark`)면 true. */
  touch = false,
): Frame {
  const n = Math.max(1, count);
  const c = Math.max(1, cells);
  if (!touch) {
    return {
      orientation,
      width: LOGICAL_WIDTH,
      height: LOGICAL_HEIGHT,
      plot: orientation === 'vertical' ? VERTICAL_PLOT : HORIZONTAL_PLOT,
      count: n,
      cells: c,
    };
  }
  if (orientation === 'vertical') {
    const plot: Rect = { x: 110, y: TOUCH_TOP, width: n * TOUCH_BAND, height: c * TOUCH_CELL };
    return {
      orientation,
      plot,
      width: plot.x + plot.width + 30,
      height: plot.y + plot.height + 110,
      count: n,
      cells: c,
    };
  }
  const plot: Rect = { x: 170, y: TOUCH_TOP, width: c * TOUCH_CELL, height: n * TOUCH_BAND };
  return {
    orientation,
    plot,
    width: plot.x + plot.width + 40,
    height: plot.y + plot.height + 90,
    count: n,
    cells: c,
  };
}

/** 값 축 한 칸의 길이. */
export function cellLength(frame: Frame): number {
  const length = frame.orientation === 'vertical' ? frame.plot.height : frame.plot.width;
  return length / frame.cells;
}

/** 범주 하나가 차지하는 띠의 길이. */
export function bandLength(frame: Frame): number {
  const length = frame.orientation === 'vertical' ? frame.plot.width : frame.plot.height;
  return length / frame.count;
}

/** 범주 띠의 시작(범주 축 방향 좌표). */
export function bandStart(frame: Frame, index: number): number {
  const origin = frame.orientation === 'vertical' ? frame.plot.x : frame.plot.y;
  return origin + index * bandLength(frame);
}

/** 범주 띠의 가운데(범주 축 방향 좌표). */
export function bandCenter(frame: Frame, index: number): number {
  return bandStart(frame, index) + bandLength(frame) / 2;
}

/** 값 축에서 `cells`칸 위치의 좌표. 칸 0은 축에 붙은 선이다. */
export function valuePosition(frame: Frame, cells: number): number {
  const step = cellLength(frame);
  return frame.orientation === 'vertical'
    ? frame.plot.y + frame.plot.height - cells * step
    : frame.plot.x + cells * step;
}

/** 값 축 방향 좌표를 칸 수(실수)로 바꾼다. */
export function positionToCells(frame: Frame, position: number): number {
  const step = cellLength(frame);
  return frame.orientation === 'vertical'
    ? (frame.plot.y + frame.plot.height - position) / step
    : (position - frame.plot.x) / step;
}

/** 범주 축 방향 좌표가 속한 범주 번호. 그림 밖이면 null. */
export function bandIndexAt(frame: Frame, position: number): number | null {
  const origin = frame.orientation === 'vertical' ? frame.plot.x : frame.plot.y;
  const length = frame.orientation === 'vertical' ? frame.plot.width : frame.plot.height;
  if (position < origin || position > origin + length) return null;
  const index = Math.floor((position - origin) / bandLength(frame));
  return Math.min(frame.count - 1, Math.max(0, index));
}

/** 막대 굵기(모든 막대가 같다). */
export function barThickness(frame: Frame): number {
  return Math.min(bandLength(frame) * 0.55, 120);
}

/** 막대가 `cells`칸(실수)만큼 자란 상자. 축에서 시작한다. */
export function barRect(frame: Frame, index: number, cells: number): Rect {
  const thickness = barThickness(frame);
  const center = bandCenter(frame, index);
  const end = valuePosition(frame, cells);
  const base = valuePosition(frame, 0);
  if (frame.orientation === 'vertical') {
    return { x: center - thickness / 2, y: end, width: thickness, height: base - end };
  }
  return { x: base, y: center - thickness / 2, width: end - base, height: thickness };
}

/** ○ 칸 한 변. 값 축 한 칸·범주 띠의 80% 중 작은 쪽이다(정사각형). */
export function markSide(frame: Frame): number {
  return Math.min(cellLength(frame), bandLength(frame) * 0.8) - 4;
}

/** ○ 그래프 칸 번호(0은 축에 붙은 칸)의 정사각형 상자. */
export function markRect(frame: Frame, index: number, cell: number): Rect {
  const side = markSide(frame);
  const center = bandCenter(frame, index);
  const step = cellLength(frame);
  if (frame.orientation === 'vertical') {
    const slotTop = valuePosition(frame, cell + 1);
    return { x: center - side / 2, y: slotTop + (step - side) / 2, width: side, height: side };
  }
  const slotLeft = valuePosition(frame, cell);
  return { x: slotLeft + (step - side) / 2, y: center - side / 2, width: side, height: side };
}

/** 값 축 눈금 글자를 쓸 칸 번호들. 칸이 20개를 넘으면 5칸마다. */
export function tickCells(cells: number): number[] {
  const every = cells > 20 ? 5 : 1;
  const ticks: number[] = [];
  for (let cell = 0; cell <= cells; cell += every) ticks.push(cell);
  return ticks;
}

export { LOGICAL_HEIGHT, LOGICAL_WIDTH };

/** 학생이 누르는 ○ 그래프(칸마다 눌러 채움)인가. 이 그래프는 칸이 targetSize 이상이 되도록 스크롤한다. */
export function isTouchOMark(settings: GraphSettings): boolean {
  return settings.graph === 'student' && settings.graphType === 'o-mark';
}

/**
 * ○ 칸 한 변이 화면에서 `targetSize`px 이상이 되는 그림 배율(화면 px / 논리 좌표).
 * 칸 간격(값 축 방향)과 범주 띠 폭(범주 축 방향) 둘 다 본다.
 */
export function minTouchScale(frame: Frame, targetSize: number): number {
  // markSide = min(칸 간격, 띠 폭 × 0.8) − 4 이므로 둘을 각각 targetSize로 맞춘다.
  const along = Math.max(1, cellLength(frame) - 4);
  const across = Math.max(1, bandLength(frame) * 0.8 - 4);
  return Math.max(targetSize / along, targetSize / across);
}

/** 위 배율에서 SVG가 가져야 할 최소 화면 크기. */
export function minPictureSize(
  frame: Frame,
  targetSize: number,
): { readonly width: number; readonly height: number } {
  const scale = minTouchScale(frame, targetSize);
  return { width: Math.ceil(frame.width * scale), height: Math.ceil(frame.height * scale) };
}
