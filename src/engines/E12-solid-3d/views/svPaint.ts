/**
 * E12 `surface-volume` 화면 공용 도우미(컴포넌트 아님): 칠하기 색·무늬 이름, 1cm 칸 격자 선.
 *
 * 칠한 면은 색과 무늬(점·줄·격자)를 함께 써서 색만으로 구분하지 않는다.
 */
import { useId } from 'react';
import type { XrayFaceId } from '../xray/geometry';
import { pairOf, type SvPairId } from '../sv/geometry';

export type SvPaintKey = SvPairId | 'one';

interface PaintStyle {
  readonly bg: string;
  readonly fg: string;
}

export const SV_PAINT_STYLES: Readonly<Record<SvPaintKey, PaintStyle>> = {
  fb: { bg: '#cfe0ff', fg: '#2f6fde' },
  lr: { bg: '#ffe3c2', fg: '#d9730d' },
  tb: { bg: '#cdeed9', fg: '#1f8a4c' },
  one: { bg: '#e6dcf7', fg: '#6d3fb8' },
};

export function paintKeyOf(face: XrayFaceId, pairColors: boolean): SvPaintKey {
  return pairColors ? pairOf(face) : 'one';
}

/** SVG 안에서 쓸 고유 접두어(`useId`의 `:`를 뺀다). */
export function useSvUid(): string {
  return `sv${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
}

export function paintFill(uid: string, key: SvPaintKey): string {
  return `url(#${uid}-${key})`;
}

export interface SvPt {
  readonly x: number;
  readonly y: number;
}

export interface SvLine {
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
}

function lerp(a: SvPt, b: SvPt, t: number): SvPt {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

/**
 * 평행사변형 `p0 p1 p2 p3`(차례로 이어진 꼭짓점)을 `p0→p1` 방향 nU칸, `p0→p3` 방향 nV칸으로 나누는
 * 안쪽 격자 선. 직교 투영은 평행사변형을 평행사변형으로 보내므로 2D에서 나눠도 정확하다.
 */
export function gridLines(
  p: readonly [SvPt, SvPt, SvPt, SvPt],
  nU: number,
  nV: number,
): readonly SvLine[] {
  const [p0, p1, p2, p3] = p;
  const out: SvLine[] = [];
  for (let i = 1; i < nU; i += 1) {
    const a = lerp(p0, p1, i / nU);
    const b = lerp(p3, p2, i / nU);
    out.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y });
  }
  for (let j = 1; j < nV; j += 1) {
    const a = lerp(p0, p3, j / nV);
    const b = lerp(p1, p2, j / nV);
    out.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y });
  }
  return out;
}

export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return true;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
