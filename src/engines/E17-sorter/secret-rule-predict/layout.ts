/**
 * E17 predict 판 배치(논리 1000×500). 본 판·오버레이·E2E가 같은 좌표를 쓴다.
 */
import type { Point } from '../../../core/engine-sdk';
import type { Box } from '../layout';
import type { PredictBin, PredictState } from './types';

export const PREDICT_WIDTH = 1000;
export const PREDICT_HEIGHT = 500;
export const PREDICT_TOP = 150;
export const PREDICT_CARD = 66;
export const NEW_CARD = 100;
const HEADER = 52;

export function predictBoardHeight(): number {
  return PREDICT_HEIGHT;
}

export function newCardCenter(): Point {
  return { x: 500, y: 84 };
}

export function predictBinBox(bin: PredictBin): Box {
  return {
    x: bin === 'yes' ? 30 : 510,
    y: PREDICT_TOP + 10,
    width: 460,
    height: PREDICT_HEIGHT - PREDICT_TOP - 20,
  };
}

export function predictHeaderBox(bin: PredictBin): Box {
  const box = predictBinBox(bin);
  return { x: box.x, y: box.y, width: box.width, height: HEADER };
}

export function predictSlotCenter(bin: PredictBin, index: number): Point {
  const box = predictBinBox(bin);
  const columns = 4;
  const rows = 3;
  const bodyTop = box.y + HEADER + 6;
  const slotWidth = box.width / columns;
  const slotHeight = (box.height - HEADER - 12) / rows;
  return {
    x: box.x + (index % columns) * slotWidth + slotWidth / 2,
    y: bodyTop + Math.floor(index / columns) * slotHeight + slotHeight / 2,
  };
}

export interface PredictSlot {
  readonly id: string;
  readonly center: Point;
}

/** 상자에 든 카드들의 자리(예시 → 예측한 카드 순서). */
export function predictCardSlots(state: PredictState): PredictSlot[] {
  const counters: Record<PredictBin, number> = { yes: 0, no: 0 };
  const slots: PredictSlot[] = [];
  const order = [...state.examples, ...state.queue];
  for (const id of order) {
    const bin = state.binOf[id];
    if (bin === undefined) continue;
    slots.push({ id, center: predictSlotCenter(bin, counters[bin]) });
    counters[bin] += 1;
  }
  return slots;
}

export function predictTargetAt(point: Point): PredictBin | null {
  for (const bin of ['yes', 'no'] as const) {
    const box = predictBinBox(bin);
    if (
      point.x >= box.x &&
      point.x <= box.x + box.width &&
      point.y >= box.y &&
      point.y <= box.y + box.height
    ) {
      return bin;
    }
  }
  return null;
}
