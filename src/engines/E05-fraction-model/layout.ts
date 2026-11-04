/**
 * T049 새 모드의 화면 배치.
 *
 * 화면 좌표만 number로 계산한다(AGENTS 절대 규칙 2). 수학 값은 부르는 쪽에서
 * `Rational`로 다루고, 여기서는 이미 정해진 칸 수·전체 수만 받는다.
 */
import { Rational } from '../../core/math';
import { screenLength, wholeUnits } from './fractions';

/** 정사각형 여러 개를 그릴 때의 최대 개수(T049 결정 2). */
export const MAX_SQUARES = 4;

export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface WholeBoard {
  /** 그려야 하는 전체(정사각형) 수. */
  readonly squares: number;
  readonly originX: number;
  readonly originY: number;
  /** 정사각형 한 변. */
  readonly size: number;
  readonly cellWidth: number;
  readonly cellHeight: number;
}

export const WHOLE_GAP = 14;
const GAP = WHOLE_GAP;
const AREA = { x: 60, y: 70, width: 880, height: 360 };

function wholeBoard(squares: number, partsX: number, partsY: number): WholeBoard {
  const safeSquares = Math.max(1, Math.min(MAX_SQUARES, squares));
  const size = Math.min(340, (AREA.width - (safeSquares - 1) * GAP) / safeSquares, AREA.height);
  const originX = 500 - (safeSquares * size + (safeSquares - 1) * GAP) / 2;
  const originY = AREA.y + (AREA.height - size) / 2;
  return {
    squares: safeSquares,
    originX,
    originY,
    size,
    cellWidth: size / Math.max(1, partsX),
    cellHeight: size / Math.max(1, partsY),
  };
}

/** `aShaded/aParts`가 차지하는 전체 수(올림, 최대 4)만큼 정사각형을 그린다. */
export function multiplyBoard(aParts: number, aShaded: number, bParts: number): WholeBoard {
  const squares = aParts > 0 ? Math.ceil(aShaded / aParts) : 1;
  return wholeBoard(squares, aParts, bParts);
}

/** `divide-whole`의 정사각형 배치. 가로 칸(rows)은 부르는 쪽이 곱해 그린다. */
export function divideWholeBoard(dividendParts: number, dividendShaded: number): WholeBoard {
  const squares = dividendParts > 0 ? Math.ceil(dividendShaded / dividendParts) : 1;
  return wholeBoard(squares, dividendParts, 1);
}

export interface MeasureBoard {
  readonly originX: number;
  /** 1 전체의 화면 길이(논리 좌표). */
  readonly unit: number;
  /** 가로로 그리는 전체 수(0…units 눈금). */
  readonly units: number;
  readonly dividendBar: Rect;
  readonly rulerBar: Rect;
  /** 놓은 자를 그리는 줄. */
  readonly rulersY: number;
  readonly rulersHeight: number;
}

const MEASURE_X = 66;
const MEASURE_WIDTH = 868;
const BAR_HEIGHT = 84;

/**
 * 나뉨수 막대와 자 막대의 배치.
 * 화면 단위 길이는 `max(나뉨수, (온전한 자 수 + 1) × 나누는 수)`의 올림 전체가
 * 들어가게 정한다. 부분 자의 점선 윤곽까지 캔버스 안에 들어온다.
 */
export function measureBoard(dividend: Rational, divisor: Rational, rulersLaid = 0): MeasureBoard {
  const rulers = Number.isSafeInteger(rulersLaid) && rulersLaid > 0 ? rulersLaid : 0;
  const capacity = divisor.mul(Rational.of(rulers + 1));
  const largest = dividend.compareTo(capacity) >= 0 ? dividend : capacity;
  const units = Math.max(1, wholeUnits(largest));
  const unit = MEASURE_WIDTH / units;
  return {
    originX: MEASURE_X,
    unit,
    units,
    dividendBar: {
      x: MEASURE_X,
      y: 232,
      width: Math.max(unit * screenLength(dividend), 1),
      height: BAR_HEIGHT,
    },
    rulerBar: {
      x: MEASURE_X,
      y: 386,
      width: Math.max(unit * screenLength(divisor), 1),
      height: BAR_HEIGHT,
    },
    rulersY: 96,
    rulersHeight: 84,
  };
}

/** 접시·전체 배치에 쓰는 격자 칸 크기. */
export function gridCell(
  count: number,
  area: Rect,
  columns: number,
  gap: number,
): { width: number; height: number; rows: number } {
  const safeColumns = Math.max(1, Math.min(columns, count));
  const rows = Math.max(1, Math.ceil(count / safeColumns));
  return {
    width: (area.width - (safeColumns - 1) * gap) / safeColumns,
    height: (area.height - (rows - 1) * gap) / rows,
    rows,
  };
}
