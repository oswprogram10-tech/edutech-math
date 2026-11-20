/**
 * E13 compare-direct 판 좌표(논리 1000×600)와 곡선 계산. 본 판과 힌트 ② 오버레이가 같은 식을 써서
 * 1px 안에 겹친다. 화면 좌표·곡선 길이만 number다(수학 값은 Rational 문자열).
 */
import type { Attribute } from './types';

/** 논리 너비와 최대 논리 높이(포인터 좌표 한계). 판이 그리는 높이는 `boardHeight()`다. */
export const BOARD = { width: 1000, height: 600 } as const;

/** length 판: 한 칸 60px, 출발선 x=BASE_X, 한 줄(행) 60px. */
export const LENGTH_CELL = 60;
export const BASE_X = 60;
export const LENGTH_MAX_X = 15;
export const LENGTH_MAX_Y = 9;

/** area 판: 한 칸 50px. */
export const AREA_CELL = 50;
export const AREA_COLS = 20;
export const AREA_ROWS = 12;

/** capacity 판. 컵 한 칸의 넓이(2차원)와 수조 크기. 물 높이 = 컵 넓이 ÷ 수조 너비. */
export const CAPACITY_AREA_PER_UNIT = 2600;
export const TANK = { width: 150, height: 200, bottom: 540 } as const;
export const CUP_BASE_Y = 270;
export const CUP_CENTERS: readonly number[] = [250, 750];
const CUP_RATIO = { tall: 2.2, wide: 0.7 } as const;

export interface Pt {
  readonly x: number;
  readonly y: number;
}

/** 곡선 밧줄의 모양: 물결 수와 진폭(길이에 맞춰 줄여 호 길이가 길이에 닿게 한다). */
function shapeOf(lengthCells: number): { readonly waves: number; readonly amplitude: number } {
  const total = lengthCells * LENGTH_CELL;
  const waves = Math.max(1, Math.round(lengthCells * 0.5));
  return { waves, amplitude: Math.min(18, (0.1 * total) / waves) };
}

/** y = A·sin(2πx/λ), x∈[0,W]의 호 길이(심프슨 공식). */
function arcLength(width: number, waves: number, amplitude: number): number {
  const steps = 1200;
  const h = width / steps;
  const k = (2 * Math.PI * waves) / width;
  const f = (x: number) => Math.sqrt(1 + (amplitude * k * Math.cos(k * x)) ** 2);
  let sum = f(0) + f(width);
  for (let i = 1; i < steps; i += 1) sum += f(i * h) * (i % 2 === 0 ? 2 : 4);
  return (sum * h) / 3;
}

/** 호 길이가 lengthCells×60px가 되는 가로 폭(이분법). */
export function curveWidth(lengthCells: number): number {
  const total = lengthCells * LENGTH_CELL;
  const { waves, amplitude } = shapeOf(lengthCells);
  let lo = total * 0.2;
  let hi = total;
  for (let i = 0; i < 60; i += 1) {
    const mid = (lo + hi) / 2;
    if (arcLength(mid, waves, amplitude) < total) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/** 곡선 밧줄의 점들(왼쪽 끝이 (0,0)). 호 길이는 lengthCells×60px와 1% 안에서 같다. */
export function curvePoints(lengthCells: number, samples = 240): Pt[] {
  const width = curveWidth(lengthCells);
  const { waves, amplitude } = shapeOf(lengthCells);
  const k = (2 * Math.PI * waves) / width;
  return Array.from({ length: samples + 1 }, (_, i) => {
    const x = (width * i) / samples;
    return { x, y: amplitude * Math.sin(k * x) };
  });
}

/** 점들을 이은 선의 길이. */
export function polylineLength(points: readonly Pt[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1];
    const b = points[i];
    if (a && b) total += Math.hypot(b.x - a.x, b.y - a.y);
  }
  return total;
}

export function pathOf(points: readonly Pt[], dx = 0, dy = 0): string {
  return points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${(p.x + dx).toFixed(2)} ${(p.y + dy).toFixed(2)}`)
    .join(' ');
}

/** 앞쪽 절반(호 길이 기준)을 곧게 편 미리보기 점들: 곧은 반 + 나머지 곡선 반. 왼쪽 끝이 (0,0). */
export function halfStraightPoints(lengthCells: number, samples = 240): Pt[] {
  const points = curvePoints(lengthCells, samples);
  const total = polylineLength(points);
  const half = total / 2;
  let run = 0;
  let cut = points.length - 1;
  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1];
    const b = points[i];
    if (!a || !b) continue;
    const step = Math.hypot(b.x - a.x, b.y - a.y);
    if (run + step >= half) {
      cut = i;
      break;
    }
    run += step;
  }
  const origin = points[cut];
  if (!origin) return points;
  const rest = points.slice(cut).map((p) => ({ x: p.x - origin.x + half, y: p.y - origin.y }));
  return [{ x: 0, y: 0 }, ...rest];
}

/** 컵 그림 크기: 2차원 넓이가 들이에 비례한다(그림이 곧 측정 대상). */
export function cupSize(
  shape: 'tall' | 'wide',
  capacity: number,
): { readonly width: number; readonly height: number } {
  const ratio = CUP_RATIO[shape];
  const width = Math.sqrt((capacity * CAPACITY_AREA_PER_UNIT) / ratio);
  return { width, height: width * ratio };
}

/** 같은 수조에 부었을 때 물 높이(px). */
export function waterHeight(capacity: number): number {
  return (capacity * CAPACITY_AREA_PER_UNIT) / TANK.width;
}

export function lengthX(cells: number): number {
  return BASE_X + cells * LENGTH_CELL;
}

export function lengthY(row: number): number {
  return row * LENGTH_CELL;
}

/** 판 아래 여백(논리 px). */
const BOTTOM_PAD = 30;

/**
 * compare-direct 판의 논리 높이(T223). 끌어 놓을 수 있는 범위(길이는 9줄, 넓이는 12줄)가 판 안에
 * 모두 들어가야 해서 길이·넓이는 최대 높이를 쓴다. 들이는 물건을 옮기지 않으므로 수조 아래 끝
 * (붓기가 있으면 이름표까지) + 여백이다(힌트 same-tank 오버레이가 수조를 그려서 수조 자리는 늘 포함).
 */
export function boardHeight(state: {
  readonly attribute: Attribute;
  readonly pour: boolean;
}): number {
  if (state.attribute === 'capacity') {
    const bottom = state.pour ? TANK.bottom + 28 : TANK.bottom;
    return Math.min(BOARD.height, bottom + BOTTOM_PAD);
  }
  return BOARD.height;
}
