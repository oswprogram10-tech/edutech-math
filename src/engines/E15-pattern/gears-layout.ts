/**
 * E15 gears 판의 논리 좌표(화면 좌표라 number). GearsView와 meet-trail 오버레이가 같이 쓴다.
 *
 * 톱니 하나의 크기(피치)가 같아서 바퀴 반지름이 톱니 수에 비례한다.
 * 두 바퀴는 피치 원이 맞닿게 놓이고, 맞닿는 점은 왼쪽 바퀴의 오른쪽(3시 방향)이다.
 * 위에는 글자 줄(예측·다시 만남), 아래에는 오버레이용 두 줄 눈금 띠를 비워 둔다.
 */
import type { GearsSettings } from './types';

/** 톱니 하나가 차지하는 피치 원 위의 길이(논리). 화면 24px 기준 최소 배율은 24/PITCH. */
export const PITCH = 60;
export const TIP = 0.22 * PITCH;
export const ROOT = 0.26 * PITCH;
export const PAD = 16;
export const TOP_H = 44;
export const BAND_H = 76;
const MIN_WIDTH = 320;

export interface GearGeometry {
  readonly cx: number;
  readonly cy: number;
  /** 피치 원 반지름. */
  readonly r: number;
  readonly teeth: number;
  /** 톱니 한 칸의 각도(도). */
  readonly theta: number;
}

export interface GearsLayout {
  readonly width: number;
  readonly height: number;
  readonly a: GearGeometry;
  readonly b: GearGeometry;
  readonly contact: { readonly x: number; readonly y: number };
  /** 다시 만났을 때 별을 그리는 높이(바퀴 위, 글자 줄 아래). */
  readonly starY: number;
  readonly bandTop: number;
  readonly bandX0: number;
  readonly bandX1: number;
  readonly rowAY: number;
  readonly rowBY: number;
}

function pitchRadius(teeth: number): number {
  return (teeth * PITCH) / (2 * Math.PI);
}

export function gearsLayout(settings: GearsSettings): GearsLayout {
  const rA = pitchRadius(settings.teethA);
  const rB = pitchRadius(settings.teethB);
  const outerA = rA + TIP;
  const outerB = rB + TIP;
  const bodyW = outerA + rA + rB + outerB;
  const width = Math.max(MIN_WIDTH, bodyW + 2 * PAD);
  const left = (width - bodyW) / 2;
  const cy = TOP_H + PAD + Math.max(outerA, outerB);
  const cxA = left + outerA;
  const cxB = cxA + rA + rB;
  const bandTop = cy + Math.max(outerA, outerB) + PAD;
  return {
    width,
    height: bandTop + BAND_H,
    a: { cx: cxA, cy, r: rA, teeth: settings.teethA, theta: 360 / settings.teethA },
    b: { cx: cxB, cy, r: rB, teeth: settings.teethB, theta: 360 / settings.teethB },
    contact: { x: cxA + rA, y: cy },
    starY: TOP_H - 4,
    bandTop,
    bandX0: PAD + 28,
    bandX1: width - PAD,
    rowAY: bandTop + 20,
    rowBY: bandTop + 46,
  };
}

/** 가운데 (cx, cy), 반지름 r, 각도(도, 시계 방향)의 점. */
export function polar(cx: number, cy: number, r: number, degrees: number): [number, number] {
  const rad = (degrees * Math.PI) / 180;
  return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
}

/** 톱니 하나의 다각형 점. 중심 각도 center(도), 한 칸 각도 theta(도). */
export function toothPoints(g: GearGeometry, center: number): string {
  const pts = [
    polar(g.cx, g.cy, g.r - ROOT, center - 0.27 * g.theta),
    polar(g.cx, g.cy, g.r + TIP, center - 0.15 * g.theta),
    polar(g.cx, g.cy, g.r + TIP, center + 0.15 * g.theta),
    polar(g.cx, g.cy, g.r - ROOT, center + 0.27 * g.theta),
  ];
  return pts.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(' ');
}

/**
 * 톱니 k의 처음 중심 각도. 왼쪽 바퀴는 맞닿는 곳(0도)에 톱니가 있고,
 * 오른쪽 바퀴는 맞닿는 곳(180도)에 홈이 있어 톱니가 반 칸씩 비껴 있다.
 */
export function toothAngle(side: 'a' | 'b', k: number, theta: number): number {
  return side === 'a' ? k * theta : 180 + (k + 0.5) * theta;
}

/** 오른쪽 바퀴는 왼쪽 바퀴와 반대로 돈다. steps칸 돌았을 때 회전각(도). */
export function rotationOf(side: 'a' | 'b', steps: number, theta: number): number {
  return side === 'a' ? steps * theta : -steps * theta;
}

/** 별 모양(5각) 점. */
export function starPoints(cx: number, cy: number, outer: number, inner: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 10; i += 1) {
    const [x, y] = polar(cx, cy, i % 2 === 0 ? outer : inner, -90 + i * 36);
    pts.push(`${x.toFixed(2)},${y.toFixed(2)}`);
  }
  return pts.join(' ');
}
