/**
 * rule-shooter의 순수 계산. 수학 값은 Rational이고, 화면 좌표(number)는 `shooterLayout`에만 있다.
 * 숨은 규칙은 쓰지 않는다. 학생 식과 보석(과제 자료)만 다룬다.
 */
import { Rational, relationHolds } from '../../core/math';
import type { Relation } from '../../core/math';
import { rationalOf, safeSolve } from './relation-check';
import type { ShooterSettings } from './types';

export interface LaserPoint {
  readonly x: Rational;
  readonly y: Rational;
}

export interface Gem {
  readonly x: Rational;
  readonly y: Rational;
}

export interface MissInfo {
  readonly x: Rational;
  readonly gemY: Rational;
  /** 학생 식에 ○를 넣어 푼 □. 하나로 정해지지 않으면 null. */
  readonly ruleY: Rational | null;
}

/** ○ = 0, 1, …, xMax 정수마다 식을 □에 대해 풀고 0 ≤ □ ≤ yMax인 점만 남긴다(분수 □도 남긴다). */
export function laserPoints(
  rel: Relation,
  grid: { readonly xMax: number; readonly yMax: number },
): LaserPoint[] {
  const points: LaserPoint[] = [];
  const top = Rational.of(grid.yMax);
  for (let n = 0; n <= grid.xMax; n += 1) {
    const x = Rational.of(n);
    const y = safeSolve(rel, x);
    if (y === null || y.isNegative() || y.compareTo(top) > 0) continue;
    points.push({ x, y });
  }
  return points;
}

/** 보석마다 식이 성립하는지. */
export function gemHits(rel: Relation, gems: readonly Gem[]): boolean[] {
  return gems.map((gem) => relationHolds(rel, gem.x, gem.y));
}

export function missInfo(rel: Relation, gem: Gem): MissInfo {
  return { x: gem.x, gemY: gem.y, ruleY: safeSolve(rel, gem.x) };
}

export function gemsOf(settings: ShooterSettings): Gem[] {
  const gems: Gem[] = [];
  for (const [a, b] of settings.gems) {
    const x = rationalOf(a);
    const y = rationalOf(b);
    if (x !== null && y !== null) gems.push({ x, y });
  }
  return gems;
}

/** 맞힌 보석 번호(0부터). */
export function hitIndexes(hits: readonly boolean[]): number[] {
  return hits.flatMap((hit, index) => (hit ? [index] : []));
}

/** 화면 좌표로 바꿀 때만 쓴다. */
export function toScreen(value: Rational): number {
  const text = value.toString();
  const slash = text.indexOf('/');
  if (slash < 0) return Number(text);
  return Number(text.slice(0, slash)) / Number(text.slice(slash + 1));
}

// ─────────────────────────────────────────────────────────────
// 격자 논리 좌표(화면 px와 1:1, 배율은 부모가 정한다). 뷰와 오버레이가 같이 쓴다.
// ─────────────────────────────────────────────────────────────

export interface ShooterLayout {
  readonly width: number;
  readonly height: number;
  readonly left: number;
  readonly top: number;
  readonly cellX: number;
  readonly cellY: number;
  readonly xMax: number;
  readonly yMax: number;
  readonly plotW: number;
  readonly plotH: number;
}

const MARGIN_LEFT = 52;
const MARGIN_RIGHT = 24;
const MARGIN_TOP = 26;
const MARGIN_BOTTOM = 46;

export function shooterLayout(grid: {
  readonly xMax: number;
  readonly yMax: number;
}): ShooterLayout {
  const cellX = Math.min(56, Math.max(20, Math.floor(420 / grid.xMax)));
  const cellY = Math.min(44, Math.max(12, Math.floor(228 / grid.yMax)));
  const plotW = cellX * grid.xMax;
  const plotH = cellY * grid.yMax;
  return {
    width: MARGIN_LEFT + plotW + MARGIN_RIGHT,
    height: MARGIN_TOP + plotH + MARGIN_BOTTOM,
    left: MARGIN_LEFT,
    top: MARGIN_TOP,
    cellX,
    cellY,
    xMax: grid.xMax,
    yMax: grid.yMax,
    plotW,
    plotH,
  };
}

export const pointX = (layout: ShooterLayout, x: Rational): number =>
  layout.left + toScreen(x) * layout.cellX;
export const pointY = (layout: ShooterLayout, y: Rational): number =>
  layout.top + (layout.yMax - toScreen(y)) * layout.cellY;

/** 눈금 숫자를 건너뛰는 간격. 칸이 화면에서 14px보다 작아지면 건너뛴다. */
export function tickStep(cellScreenPx: number): number {
  return cellScreenPx >= 14 ? 1 : Math.ceil(14 / Math.max(cellScreenPx, 1));
}

export const GEM_SIZE = 28;
