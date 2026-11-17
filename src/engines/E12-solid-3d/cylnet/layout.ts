/**
 * E12 `cylinder-net` 화면 배치(화면 좌표 number는 여기서만 만든다).
 *
 * 무대·판·오버레이가 같은 계산을 쓰므로 한곳에 둔다. 모든 길이는 같은 배율(scale)로 줄여
 * 실제 비율을 지킨다. `Rational`을 화면 좌표로 바꾸는 `toPx`도 여기에만 있다.
 */
import type { Rational } from '../../../core/math';
import { circumference } from './model';

/** 화면용 변환. 판정에는 쓰지 않는다. */
export function toPx(value: Rational): number {
  return Number(value.n) / Number(value.d);
}

/* ------------------------------ 굴리기 무대 ------------------------------ */

export const ROLL_W = 640;
export const ROLL_H = 360;
const ROLL_MARGIN = 20;
const ROLL_TOP = 34;
/** 바닥 아래에 오버레이 막대(한 바퀴 선·지름 막대)를 둘 자리. */
export const ROLL_BOTTOM = 92;
/** 높이 1cm가 화면에서 비스듬히 가는 방향(원기둥 길이 방향). */
const OBLIQUE_X = 0.4;
const OBLIQUE_Y = 0.25;

export interface RollGeometry {
  /** 1cm가 화면에서 몇 px인가. */
  readonly scale: number;
  /** 밑면 원 반지름(px). */
  readonly r: number;
  /** 원기둥 높이만큼 비스듬히 간 길이(px, 화면 오른쪽·위쪽이 양수). */
  readonly depthX: number;
  readonly depthY: number;
  /** 바닥선의 y. */
  readonly ground: number;
  /** 굴리기 시작 때 밑면 원 중심의 x(= 자국 시작 x). */
  readonly startX: number;
  /** 한 바퀴 굴렀을 때 원 중심의 x(= 자국 끝 x). */
  readonly endX: number;
  /** 한 바퀴 거리(px). */
  readonly travel: number;
}

export function rollGeometry(radius: Rational, height: Rational, pi: Rational): RollGeometry {
  const r = toPx(radius);
  const h = toPx(height);
  const circ = toPx(circumference(radius, pi));
  const widthCm = circ + 2 * r + h * OBLIQUE_X;
  const heightCm = 2 * r + h * OBLIQUE_Y;
  const availW = ROLL_W - 2 * ROLL_MARGIN;
  const availH = ROLL_H - ROLL_TOP - ROLL_BOTTOM;
  const scale = Math.min(availW / widthCm, availH / heightCm);
  const left = ROLL_MARGIN + (availW - widthCm * scale) / 2;
  const ground = ROLL_TOP + (availH - heightCm * scale) / 2 + heightCm * scale;
  return {
    scale,
    r: r * scale,
    depthX: h * OBLIQUE_X * scale,
    depthY: h * OBLIQUE_Y * scale,
    ground,
    startX: left + r * scale,
    endX: left + (r + circ) * scale,
    travel: circ * scale,
  };
}

/* ------------------------------ 전개도 판 ------------------------------ */

export const BOARD_W = 560;
export const BOARD_H = 420;
const BOARD_PAD = 16;
/** 판 아래에 오버레이 막대를 둘 자리. */
export const BOARD_BOTTOM = 76;
const BOARD_TOP = 14;
/** 접은 그림에서 밑면 타원의 세로 반지름 / 가로 반지름. */
export const ELLIPSE_RATIO = 0.32;

export interface BoardRect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

export interface BoardGeometry {
  readonly scale: number;
  readonly rect: BoardRect;
  /** 위·아래 원의 중심과 반지름(px). */
  readonly topCircle: { readonly cx: number; readonly cy: number; readonly r: number };
  readonly bottomCircle: { readonly cx: number; readonly cy: number; readonly r: number };
}

/** 학생이 정한 조각(cm)으로 전개도 배치를 만든다. 옆면 직사각형 위·아래 변 가운데에 원이 붙는다. */
export function boardGeometry(width: Rational, radius: Rational, height: Rational): BoardGeometry {
  const w = toPx(width);
  const r = toPx(radius);
  const h = toPx(height);
  const widthCm = Math.max(w, 2 * r);
  const heightCm = h + 4 * r;
  const availW = BOARD_W - 2 * BOARD_PAD;
  const availH = BOARD_H - BOARD_TOP - BOARD_BOTTOM;
  const scale = Math.min(availW / widthCm, availH / heightCm);
  const cx = BOARD_W / 2;
  const top = BOARD_TOP + (availH - heightCm * scale) / 2;
  const rectY = top + 2 * r * scale;
  return {
    scale,
    rect: { x: cx - (w * scale) / 2, y: rectY, w: w * scale, h: h * scale },
    topCircle: { cx, cy: top + r * scale, r: r * scale },
    bottomCircle: { cx, cy: rectY + h * scale + r * scale, r: r * scale },
  };
}

/** 오버레이 막대(옆면 가로 아래)의 시작 x. 판 밖으로 나가지 않게 한다. */
export function barStartX(rectX: number, lengthPx: number): number {
  return Math.max(BOARD_PAD, Math.min(rectX, BOARD_W - BOARD_PAD - lengthPx));
}

export interface FoldedGeometry {
  readonly scale: number;
  readonly cx: number;
  /** 아래 밑면 중심의 y. */
  readonly baseY: number;
  readonly rx: number;
  readonly ry: number;
  /** 학생 조각으로 만든 원기둥의 옆면 높이(px). */
  readonly wallH: number;
  /** 주어진 원기둥(점선 기준 그림)의 반지름·높이(px). */
  readonly refRx: number;
  readonly refRy: number;
  readonly refH: number;
}

/** 접은 그림 배치: 학생 조각과 주어진 원기둥을 같은 배율로 같은 바닥 중심에 놓는다. */
export function foldedGeometry(
  radius: Rational,
  height: Rational,
  refRadius: Rational,
  refHeight: Rational,
): FoldedGeometry {
  const r = toPx(radius);
  const h = toPx(height);
  const r0 = toPx(refRadius);
  const h0 = toPx(refHeight);
  const rMax = Math.max(r, r0);
  const hMax = Math.max(h, h0);
  const widthCm = 2 * rMax;
  const heightCm = hMax + 2 * rMax * ELLIPSE_RATIO;
  const availW = BOARD_W - 2 * BOARD_PAD;
  const availH = BOARD_H - BOARD_TOP - BOARD_BOTTOM;
  const scale = Math.min(availW / widthCm, availH / heightCm);
  const top = BOARD_TOP + (availH - heightCm * scale) / 2;
  return {
    scale,
    cx: BOARD_W / 2,
    baseY: top + heightCm * scale - rMax * ELLIPSE_RATIO * scale,
    rx: r * scale,
    ry: r * scale * ELLIPSE_RATIO,
    wallH: h * scale,
    refRx: r0 * scale,
    refRy: r0 * scale * ELLIPSE_RATIO,
    refH: h0 * scale,
  };
}
