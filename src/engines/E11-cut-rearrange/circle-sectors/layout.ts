/**
 * circle-sectors 화면 계산. 여기서만 number를 쓴다.
 *
 * 원은 왼쪽(중심 230, 400, 반지름 150), 배열 줄은 오른쪽 x0=440이다.
 */
import { Rational } from '../../../core/math';
import type { Point } from '../../../core/engine-sdk';
import { cutStrings as S } from '../strings.ko';

export const CIRCLE_CENTER = { x: 230, y: 400 } as const;
export const CIRCLE_RADIUS = 150;
export const SLOT_X0 = 440;
export const SLOT_BASELINE = 400;

export function thetaOf(divisions: number): number {
  return (Math.PI * 2) / divisions;
}

export function chordOf(divisions: number, radius = CIRCLE_RADIUS): number {
  return 2 * radius * Math.sin(thetaOf(divisions) / 2);
}

export function sectorHeight(divisions: number, radius = CIRCLE_RADIUS): number {
  const half = chordOf(divisions, radius) / 2;
  return Math.sqrt(Math.max(0, radius * radius - half * half));
}

export function slotCenterX(slot: number, divisions: number): number {
  const c = chordOf(divisions);
  return SLOT_X0 + ((slot + 1) * c) / 2;
}

export function rowRight(divisions: number): number {
  const c = chordOf(divisions);
  return SLOT_X0 + ((divisions + 1) * c) / 2;
}

/**
 * 카드의 줄 좌표는 8등분만 해도 오른쪽이 1200을 넘는다. 판정·칸 계산은
 * 카드 값을 그대로 쓰고, 화면에 그릴 때만 줄 그룹을 이 배율로 줄인다.
 */
export const ROW_SCREEN_RIGHT = 1160;

export function rowScale(divisions: number): number {
  // 줄의 실제 너비는 (n+1)·c/2다. n·c로 재면 줄이 약 0.77배로 줄어
  // 줄 높이가 반지름과 달라 보인다.
  const width = ((divisions + 1) * chordOf(divisions)) / 2;
  const available = ROW_SCREEN_RIGHT - SLOT_X0;
  if (width <= 0) return 1;
  return Math.min(1, available / width);
}

/** 줄 그룹을 화면에 그릴 때의 오른쪽 끝. */
export function rowScreenRight(divisions: number): number {
  return SLOT_X0 + (rowRight(divisions) - SLOT_X0) * rowScale(divisions);
}

/** 줄 그룹을 화면에 그릴 때의 위쪽 끝(호의 높이). */
export function rowScreenTop(divisions: number): number {
  return SLOT_BASELINE - sectorHeight(divisions) * rowScale(divisions);
}

/** 화면 좌표를 줄 그룹의 원래 좌표로 되돌린다(포인터 칸 찾기용). */
export function rowUnscale(point: Point, divisions: number): Point {
  const scale = rowScale(divisions);
  if (scale <= 0) return point;
  return {
    x: SLOT_X0 + (point.x - SLOT_X0) / scale,
    y: SLOT_BASELINE + (point.y - SLOT_BASELINE) / scale,
  };
}

/** 칸 하나의 위·아래 호만 그리는 path. */
export function slotArcPath(slot: number, divisions: number, arcUp: boolean): string {
  const c = chordOf(divisions);
  const h = sectorHeight(divisions);
  const cx = slotCenterX(slot, divisions);
  const left = { x: cx - c / 2, y: arcUp ? SLOT_BASELINE - h : SLOT_BASELINE };
  const right = { x: cx + c / 2, y: arcUp ? SLOT_BASELINE - h : SLOT_BASELINE };
  const sweep = arcUp ? 1 : 0;
  return `M ${f(left.x)} ${f(left.y)} A ${CIRCLE_RADIUS} ${CIRCLE_RADIUS} 0 0 ${sweep} ${f(right.x)} ${f(right.y)}`;
}

export function nearestSlot(point: Point, divisions: number): number {
  const c = chordOf(divisions);
  const raw = (point.x - SLOT_X0) / c - 0.5;
  return Math.max(0, Math.min(divisions - 1, Math.round(raw)));
}

function f(value: number): string {
  return value.toFixed(2);
}

/** 칸 하나의 부채꼴 path. arcUp이면 호가 위, 꼭짓점이 아래 기준선에 온다. */
export function slotSectorPath(slot: number, divisions: number, arcUp: boolean): string {
  const c = chordOf(divisions);
  const h = sectorHeight(divisions);
  const cx = slotCenterX(slot, divisions);
  const left = { x: cx - c / 2, y: arcUp ? SLOT_BASELINE - h : SLOT_BASELINE };
  const right = { x: cx + c / 2, y: arcUp ? SLOT_BASELINE - h : SLOT_BASELINE };
  const apex = arcUp ? { x: cx, y: SLOT_BASELINE } : { x: cx, y: SLOT_BASELINE - h };
  const sweep = arcUp ? 1 : 0;
  return `M ${f(left.x)} ${f(left.y)} A ${CIRCLE_RADIUS} ${CIRCLE_RADIUS} 0 0 ${sweep} ${f(right.x)} ${f(right.y)} L ${f(apex.x)} ${f(apex.y)} Z`;
}

/** 자동 배열 연출: 원에서 줄 칸으로 옮겨 갈 때의 시작 오프셋(px). */
export function sectorArrivalOffset(sector: number, slot: number, divisions: number): Point {
  const theta = thetaOf(divisions);
  const angle = -Math.PI / 2 + (sector + 0.5) * theta;
  const fromX = CIRCLE_CENTER.x + CIRCLE_RADIUS * 0.72 * Math.cos(angle);
  const fromY = CIRCLE_CENTER.y + CIRCLE_RADIUS * 0.72 * Math.sin(angle);
  const toX = slotCenterX(slot, divisions);
  const toY = SLOT_BASELINE - sectorHeight(divisions) / 3;
  return { x: fromX - toX, y: fromY - toY };
}

/** 원에서 고를 부채꼴 하나. 12시 방향에서 시계 방향으로 센다. */
export function circleSectorPath(index: number, divisions: number): string {
  const theta = thetaOf(divisions);
  const start = -Math.PI / 2 + index * theta;
  const end = start + theta;
  const center = CIRCLE_CENTER;
  const startPoint = {
    x: center.x + CIRCLE_RADIUS * Math.cos(start),
    y: center.y + CIRCLE_RADIUS * Math.sin(start),
  };
  const endPoint = {
    x: center.x + CIRCLE_RADIUS * Math.cos(end),
    y: center.y + CIRCLE_RADIUS * Math.sin(end),
  };
  return `M ${f(center.x)} ${f(center.y)} L ${f(startPoint.x)} ${f(startPoint.y)} A ${CIRCLE_RADIUS} ${CIRCLE_RADIUS} 0 0 1 ${f(endPoint.x)} ${f(endPoint.y)} Z`;
}

export function sectorAngleHit(point: Point, divisions: number): number | null {
  const dx = point.x - CIRCLE_CENTER.x;
  const dy = point.y - CIRCLE_CENTER.y;
  const distance = Math.hypot(dx, dy);
  if (distance > CIRCLE_RADIUS + 12 || distance < 18) return null;
  let angle = Math.atan2(dy, dx) + Math.PI / 2;
  if (angle < 0) angle += Math.PI * 2;
  const index = Math.floor(angle / thetaOf(divisions)) % divisions;
  return index;
}

export interface DimensionLines {
  readonly horizontal: {
    readonly x1: number;
    readonly y1: number;
    readonly x2: number;
    readonly y2: number;
  };
  readonly vertical: {
    readonly x1: number;
    readonly y1: number;
    readonly x2: number;
    readonly y2: number;
  };
  readonly horizontalLabel: { readonly x: number; readonly y: number };
  readonly verticalLabel: { readonly x: number; readonly y: number };
}

export function dimensionLines(divisions: number): DimensionLines {
  const right = rowRight(divisions);
  return {
    horizontal: {
      x1: SLOT_X0,
      y1: SLOT_BASELINE - CIRCLE_RADIUS - 24,
      x2: right,
      y2: SLOT_BASELINE - CIRCLE_RADIUS - 24,
    },
    vertical: { x1: SLOT_X0, y1: SLOT_BASELINE, x2: SLOT_X0, y2: SLOT_BASELINE - CIRCLE_RADIUS },
    horizontalLabel: { x: (SLOT_X0 + right) / 2, y: SLOT_BASELINE - CIRCLE_RADIUS - 34 },
    verticalLabel: { x: SLOT_X0 + 10, y: SLOT_BASELINE - CIRCLE_RADIUS / 2 },
  };
}

export function dimensionText(named: boolean): {
  readonly horizontal: string;
  readonly vertical: string;
} {
  return named ? S.circle.dimensions.named : S.circle.dimensions.plain;
}

export function radiusUnit(rational: string): number {
  return (CIRCLE_RADIUS / Number(Rational.parse(rational).n)) * Number(Rational.parse(rational).d);
}

export function rimGridLines(rational: string): {
  readonly vertical: number[];
  readonly horizontal: number[];
} {
  const spacing = Math.max(8, radiusUnit(rational));
  const vertical: number[] = [];
  const horizontal: number[] = [];
  for (
    let x = CIRCLE_CENTER.x - CIRCLE_RADIUS + spacing;
    x < CIRCLE_CENTER.x + CIRCLE_RADIUS;
    x += spacing
  ) {
    vertical.push(x);
  }
  for (
    let y = CIRCLE_CENTER.y - CIRCLE_RADIUS + spacing;
    y < CIRCLE_CENTER.y + CIRCLE_RADIUS;
    y += spacing
  ) {
    horizontal.push(y);
  }
  return { vertical, horizontal };
}

export function circleTopHalfPath(): string {
  return `M ${CIRCLE_CENTER.x - CIRCLE_RADIUS} ${CIRCLE_CENTER.y} A ${CIRCLE_RADIUS} ${CIRCLE_RADIUS} 0 0 1 ${CIRCLE_CENTER.x + CIRCLE_RADIUS} ${CIRCLE_CENTER.y}`;
}

export function rowTopArc(divisions: number): string {
  const h = sectorHeight(divisions);
  const y = SLOT_BASELINE - h;
  return `M ${f(SLOT_X0)} ${f(y)} Q ${f((SLOT_X0 + rowRight(divisions)) / 2)} ${f(y - 40)} ${f(rowRight(divisions))} ${f(y)}`;
}

export function rowHeightStart(): { readonly x: number; readonly y: number } {
  return { x: SLOT_X0, y: SLOT_BASELINE };
}

export function rowHeightEnd(divisions: number): { readonly x: number; readonly y: number } {
  return { x: SLOT_X0, y: SLOT_BASELINE - sectorHeight(divisions) };
}
