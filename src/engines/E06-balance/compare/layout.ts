/**
 * compare 화면 배치(논리 좌표 1000×600). Board·View·오버레이가 같은 계산을 쓴다.
 * 저울 뼈대(가로대·접시)와 기울기는 equation과 같은 layout.ts 상수·함수를 쓴다.
 */
import type { Rational } from '../../../core/math';
import { PAN_CENTER, PAN_SURFACE_Y, panOffsets, tiltDegreesOf } from '../layout';
import type { PanOffset } from '../layout';
import { placeOf } from './reduce';
import type { CompareState, CompareTilt, VisualSize } from './types';

export const RESULT_Y = 32;
/** 이 높이(논리) 아래에서 놓으면 선반으로 돌아간다. 위쪽은 x로 왼쪽·오른쪽 접시를 가른다. */
export const SHELF_TOP = 476;
export const SHELF_BOTTOM = 596;
export const SHELF_ITEM_BASE_Y = 568;
export const SHELF_LABEL_Y = 590;
export const STAND_BASE_Y = 430;

/** 물건 그림 한 변(논리). */
export const SIZE_PX: Readonly<Record<VisualSize, number>> = { small: 52, medium: 74, large: 96 };
/** 크기 막대 비교용 상대값. */
export const SIZE_RANK: Readonly<Record<VisualSize, number>> = { small: 1, medium: 2, large: 3 };
/** 눌러 잡는 영역의 최소 변(논리). 0.6배로 줄어도 48px 안팎이 되게 한다. */
export const MIN_HIT = 80;

const PAN_SPAN = 280;
const SHELF_GAP = 200;
const SHELF_CENTER_X = 500;

/** 한 접시에 여러 개 올릴 때 물건 그림을 줄이는 비율(1 이하). */
export function panScale(maxPerPan: number): number {
  return Math.min(1, (PAN_SPAN / maxPerPan - 10) / SIZE_PX.large);
}

export interface Placement {
  readonly x: number;
  /** 그림 아래 가운데 y. */
  readonly y: number;
  readonly scale: number;
}

export function tiltOffsets(
  left: Rational,
  right: Rational,
  tilt: CompareTilt,
): { readonly left: PanOffset; readonly right: PanOffset } {
  return panOffsets(tilt, tiltDegreesOf(left, right));
}

/** 물건 하나의 지금 자리(접시에 있으면 접시의 기울어짐을 함께 계산한다). */
export function placementOf(
  state: CompareState,
  id: string,
  offsets: { readonly left: PanOffset; readonly right: PanOffset },
): Placement {
  const place = placeOf(state, id);
  if (place === 'shelf') {
    const index = state.items.findIndex((item) => item.id === id);
    const count = state.items.length;
    return {
      x: SHELF_CENTER_X + (index - (count - 1) / 2) * SHELF_GAP,
      y: SHELF_ITEM_BASE_Y,
      scale: 1,
    };
  }
  const list = place === 'left' ? state.left : state.right;
  const slot = list.indexOf(id);
  const count = state.maxPerPan;
  const offset = offsets[place];
  return {
    x: PAN_CENTER[place] + (slot - (count - 1) / 2) * (PAN_SPAN / count) + offset.dx,
    y: PAN_SURFACE_Y - 2 + offset.dy,
    scale: panScale(count),
  };
}

/** 놓은 자리(논리 좌표)가 어느 쪽인지. */
export function targetAt(x: number, y: number): 'left' | 'right' | 'shelf' {
  if (y >= SHELF_TOP) return 'shelf';
  return x < 500 ? 'left' : 'right';
}
