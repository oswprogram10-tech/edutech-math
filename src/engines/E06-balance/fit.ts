/** E06 판(SVG)을 남는 칸에 맞추는 계산. equation·proportion 화면이 같이 쓴다. */
import type { CSSProperties } from 'react';
import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from './types';

/** 판의 최소 배율(논리 1 → 화면 0.6px). 이보다 작아지면 줄이지 않고 판 안에서 스크롤한다. */
export const MIN_SCALE = 0.6;
const MAX_FIT = 1.5;

export function fitBoard(board: { readonly width: number; readonly height: number }): {
  readonly svgStyle: CSSProperties | undefined;
  readonly scroll: boolean;
} {
  if (board.width <= 0 || board.height <= 0) return { svgStyle: undefined, scroll: false };
  const fit = Math.min(board.width / LOGICAL_WIDTH, board.height / LOGICAL_HEIGHT, MAX_FIT);
  const scale = Math.max(fit, MIN_SCALE);
  return {
    scroll: fit < MIN_SCALE - 0.005,
    svgStyle: { width: `${LOGICAL_WIDTH * scale}px`, height: `${LOGICAL_HEIGHT * scale}px` },
  };
}
