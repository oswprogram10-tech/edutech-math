/**
 * E12 `lathe` 모드 그림 좌표(순수 함수, 화면 좌표 number).
 *
 * - 도형은 (반지름 r, 축 높이 h) 평면의 열린 꺾은선(`chain`)으로 둔다. 축 위의 아래 끝에서 시작해
 *   위 끝으로 끝나고, 둘을 잇는 닫는 변이 축에 붙인 변이다. 수치는 그림용이며 판정에 쓰지 않는다.
 * - 정사영 투영은 `prism/geometry.ts`의 것을 가져다 쓴다(시선 기저는 xray 것).
 * - 완성 입체의 윤곽은 링(고리) 표본점의 볼록 껍질이다(네 입체 모두 볼록하다).
 */
import {
  projectPrismPoint,
  viewBasis,
  type ProjectedPrismPoint,
  type ViewBasis,
  type XrayViewAngle,
} from '../prism/geometry';
import { solidOf, type LatheEdge, type LatheProfile } from './profiles';

export interface RH {
  /** 축에서 떨어진 거리(그림용). */
  readonly r: number;
  /** 축 방향 높이(그림용). */
  readonly h: number;
}

export type Vec3 = readonly [number, number, number];

export const STAGE_W = 600;
export const STAGE_H = 450;
/** 한 칸의 화면 픽셀. 도형·입체 모양과 상관없이 늘 같다. */
export const STAGE_SCALE = 44;
const ARC_STEPS = 24;
const RING_SAMPLES = 40;
const HEIGHT_SAMPLES = 24;

const HYP = Math.sqrt(20);

function semicircleChain(): readonly RH[] {
  const out: RH[] = [];
  for (let k = 0; k <= ARC_STEPS; k += 1) {
    const phi = (-Math.PI / 2) * (1 - (2 * k) / ARC_STEPS);
    const r = 2 * Math.cos(phi);
    out.push({ r: r < 1e-9 ? 0 : r, h: 2 + 2 * Math.sin(phi) });
  }
  return out;
}

/** 붙인 변이 축 위에 놓인 도형의 꺾은선. 이 도형에 없는 변이면 null. */
export function axisChain(profile: LatheProfile, edge: LatheEdge): readonly RH[] | null {
  if (solidOf(profile, edge) === null) return null;
  if (profile === 'rectangle') {
    return edge === 'long'
      ? [
          { r: 0, h: 0 },
          { r: 2, h: 0 },
          { r: 2, h: 4 },
          { r: 0, h: 4 },
        ]
      : [
          { r: 0, h: 0 },
          { r: 4, h: 0 },
          { r: 4, h: 2 },
          { r: 0, h: 2 },
        ];
  }
  if (profile === 'semicircle') return semicircleChain();
  if (edge === 'leg-vertical') {
    return [
      { r: 0, h: 0 },
      { r: 2, h: 0 },
      { r: 0, h: 4 },
    ];
  }
  if (edge === 'leg-horizontal') {
    return [
      { r: 0, h: 0 },
      { r: 4, h: 0 },
      { r: 0, h: 2 },
    ];
  }
  // 빗변이 축: 직각 꼭짓점은 빗변에서 높이 8/√20, 한쪽 끝에서 4/√20 떨어진 곳이다.
  return [
    { r: 0, h: 0 },
    { r: 8 / HYP, h: 4 / HYP },
    { r: 0, h: HYP },
  ];
}

/** 붙이기 전의 도형 모양(가로 x=r, 세로 y=h, 아래 왼쪽이 원점). */
export function naturalChain(profile: LatheProfile): readonly RH[] {
  if (profile === 'rectangle') {
    return [
      { r: 0, h: 0 },
      { r: 2, h: 0 },
      { r: 2, h: 4 },
      { r: 0, h: 4 },
    ];
  }
  if (profile === 'right-triangle') {
    return [
      { r: 0, h: 0 },
      { r: 2, h: 0 },
      { r: 0, h: 4 },
    ];
  }
  const out: RH[] = [];
  for (let k = 0; k <= ARC_STEPS; k += 1) {
    const phi = Math.PI * (k / ARC_STEPS);
    out.push({ r: 2 + 2 * Math.cos(phi), h: 2 * Math.sin(phi) });
  }
  return out;
}

export function chainHeight(chain: readonly RH[]): number {
  return chain.reduce((m, p) => Math.max(m, p.h), 0);
}

export function chainRadius(chain: readonly RH[]): number {
  return chain.reduce((m, p) => Math.max(m, p.r), 0);
}

/** 높이 h에서의 반지름(그림용). 도형 밖이면 0. */
export function radiusAt(chain: readonly RH[], h: number): number {
  let best = 0;
  const eps = 1e-9;
  for (let i = 0; i + 1 < chain.length; i += 1) {
    const a = chain[i];
    const b = chain[i + 1];
    if (!a || !b) continue;
    const lo = Math.min(a.h, b.h);
    const hi = Math.max(a.h, b.h);
    if (h < lo - eps || h > hi + eps) continue;
    if (hi - lo < eps) {
      best = Math.max(best, a.r, b.r);
    } else {
      best = Math.max(best, a.r + ((h - a.h) / (b.h - a.h)) * (b.r - a.r));
    }
  }
  return Math.max(0, best);
}

/** 축을 포함해 자른 단면의 윤곽(왼쪽 반을 거울로 붙인 닫힌 도형). */
export function mirroredOutline(chain: readonly RH[]): readonly RH[] {
  const left = chain
    .slice(1, -1)
    .reverse()
    .map((p) => ({ r: -p.r, h: p.h }));
  return [...chain, ...left];
}

export interface RimRing {
  readonly r: number;
  readonly h: number;
  readonly cap: 'top' | 'bottom' | null;
}

/** 입체의 가장자리 고리(밑면·윗면·가장 넓은 둘레)의 위치. */
export function rimRings(profile: LatheProfile, edge: LatheEdge): readonly RimRing[] {
  const chain = axisChain(profile, edge);
  if (!chain) return [];
  const top = chainHeight(chain);
  const flat = (h: number) => (h < 1e-9 ? 'bottom' : Math.abs(h - top) < 1e-9 ? 'top' : null);
  if (profile === 'semicircle') return [{ r: 2, h: 2, cap: null }];
  const out: RimRing[] = [];
  for (const p of chain) {
    if (p.r > 1e-9) out.push({ r: p.r, h: p.h, cap: flat(p.h) });
  }
  return out;
}

export interface StageProjector {
  readonly basis: ViewBasis;
  readonly point: (p: Vec3) => ProjectedPrismPoint;
}

export function makeProjector(
  view: XrayViewAngle,
  scale: number = STAGE_SCALE,
  width: number = STAGE_W,
  height: number = STAGE_H,
): StageProjector {
  const basis = viewBasis(view);
  return { basis, point: (p) => projectPrismPoint(p, basis, scale, width, height) };
}

/** 도형 평면을 축 둘레로 alpha(라디안)만큼 돌린 3차원 점(높이는 hMid만큼 내려 가운데에 둔다). */
export function planePoint(p: RH, alpha: number, hMid: number, rOffset = 0): Vec3 {
  const r = p.r + rOffset;
  return [r * Math.cos(alpha), r * Math.sin(alpha), p.h - hMid];
}

export function pointsAttr(points: readonly { readonly x: number; readonly y: number }[]): string {
  return points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
}

interface XY {
  readonly x: number;
  readonly y: number;
}

/** 볼록 껍질(단조 체인). */
export function convexHull(points: readonly XY[]): readonly XY[] {
  const pts = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  if (pts.length < 3) return pts;
  const cross = (o: XY, a: XY, b: XY) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lower: XY[] = [];
  for (const p of pts) {
    while (lower.length >= 2) {
      const a = lower[lower.length - 2];
      const b = lower[lower.length - 1];
      if (a && b && cross(a, b, p) <= 0) lower.pop();
      else break;
    }
    lower.push(p);
  }
  const upper: XY[] = [];
  for (let i = pts.length - 1; i >= 0; i -= 1) {
    const p = pts[i];
    if (!p) continue;
    while (upper.length >= 2) {
      const a = upper[upper.length - 2];
      const b = upper[upper.length - 1];
      if (a && b && cross(a, b, p) <= 0) upper.pop();
      else break;
    }
    upper.push(p);
  }
  lower.pop();
  upper.pop();
  return [...lower, ...upper];
}

/** 높이 h의 고리(반지름 r)를 화면에 투영한 점들. arcFrom~arcTo(라디안)만 쓰면 호가 된다. */
export function ringPoints(
  projector: StageProjector,
  r: number,
  h: number,
  hMid: number,
  from = 0,
  to = Math.PI * 2,
  samples = RING_SAMPLES,
): readonly ProjectedPrismPoint[] {
  const out: ProjectedPrismPoint[] = [];
  for (let k = 0; k <= samples; k += 1) {
    const a = from + ((to - from) * k) / samples;
    out.push(projector.point([r * Math.cos(a), r * Math.sin(a), h - hMid]));
  }
  return out;
}

/** 완성 입체의 윤곽(볼록 껍질). */
export function solidSilhouette(chain: readonly RH[], projector: StageProjector): readonly XY[] {
  const top = chainHeight(chain);
  const hMid = top / 2;
  const heights = new Set<number>();
  for (let k = 0; k <= HEIGHT_SAMPLES; k += 1) heights.add((top * k) / HEIGHT_SAMPLES);
  for (const p of chain) heights.add(p.h);
  const all: XY[] = [];
  for (const h of heights) {
    const r = radiusAt(chain, h);
    if (r < 1e-9) all.push(projector.point([0, 0, h - hMid]));
    else all.push(...ringPoints(projector, r, h, hMid));
  }
  return convexHull(all);
}

/** 시선 기준으로 가까운 쪽 절반 고리(앞쪽 호). */
export function frontArc(
  projector: StageProjector,
  view: XrayViewAngle,
  r: number,
  h: number,
  hMid: number,
): readonly ProjectedPrismPoint[] {
  const phi = (view.yaw * Math.PI) / 180;
  return ringPoints(projector, r, h, hMid, phi - Math.PI, phi, 24);
}

/** 레이저 높이 단계(0~10)를 입체의 축 높이로. */
export function laserHeight(chain: readonly RH[], t: number): number {
  return (chainHeight(chain) * t) / 10;
}
