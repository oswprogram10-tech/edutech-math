/** 셈돌을 새로 놓을 때 쓰는 논리 좌표. 화면과 이벤트 수신이 같은 규칙을 쓴다. */
import { clamp } from '../../core/engine-sdk';
import type { Point } from '../../core/engine-sdk';
import { DEFAULT_GRID_SIZE, DEMO_ORIGIN, LOGICAL_HEIGHT, LOGICAL_WIDTH } from './types';
import type { DemoConfig, DemoState } from './types';

export function gridSizeOf(config: DemoConfig): number {
  const size = config.gridSize;
  return size !== undefined && size > 0 ? size : DEFAULT_GRID_SIZE;
}

export function nextCounterPoint(state: DemoState, config: DemoConfig): Point {
  const gridSize = gridSizeOf(config);
  const offset = (state.counters.length % 5) * gridSize;
  return {
    x: clamp(DEMO_ORIGIN.x + offset, 0, LOGICAL_WIDTH),
    y: clamp(DEMO_ORIGIN.y, 0, LOGICAL_HEIGHT),
  };
}
