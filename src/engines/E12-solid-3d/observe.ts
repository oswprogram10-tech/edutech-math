/**
 * E12 3D 입체 Observation 생성(순수 함수).
 *
 * 회전(`viewTurn`)을 해도 상태 좌표·투영 행렬은 변하지 않는다.
 */
import type { JsonValue, Observation } from '../../core/engine-sdk';
import type { PaintedViewsState, SolidState } from './types';
import {
  frontView,
  heightMap,
  isConnected,
  layerMatrices,
  matchesAllReferenceViews,
  sideView,
  topView,
} from './voxel';

function toJsonMatrix(matrix: readonly (readonly number[])[]): number[][] {
  return matrix.map((row) => [...row]);
}

function toJsonPainted(painted: PaintedViewsState): Readonly<Record<string, JsonValue>> {
  const result: Record<string, JsonValue> = {};
  if (painted.top) result['top'] = toJsonMatrix(painted.top);
  if (painted.front) result['front'] = toJsonMatrix(painted.front);
  if (painted.side) result['side'] = toJsonMatrix(painted.side);
  return result;
}

export function observe(state: SolidState): Observation {
  const {
    grid,
    maxHeight,
    maxCubes,
    numberGrid,
    layers,
    paintViews,
    referenceViews,
    viewsMin,
    viewsMax,
  } = state.settings;
  const cubes = state.cubes.map((c) => [c.x, c.y, c.z]);
  const heights = heightMap(state.cubes, grid);
  const top = topView(state.cubes, grid);
  const front = frontView(state.cubes, grid, maxHeight);
  const side = sideView(state.cubes, grid, maxHeight);
  const layerList = layerMatrices(state.cubes, grid, maxHeight);
  const viewsMatch = matchesAllReferenceViews(state.cubes, grid, maxHeight, referenceViews);

  const obs: Record<string, JsonValue> = {
    mode: state.mode,
    cubes,
    count: state.cubes.length,
    heights,
    top,
    front,
    side,
    connected: isConnected(state.cubes),
    viewTurn: state.viewTurn,
    translucent: state.translucent,
    focus: state.focus
      ? { view: state.focus.view, row: state.focus.row, col: state.focus.col }
      : null,
    maxReached: state.cubes.length >= maxCubes,
    layers: layerList,
    layerFocus: state.layerFocus,
    viewsMin,
    viewsMax,
    matchedCounts: [...state.matchedCounts],
    viewsMatch,
  };

  if (numberGrid?.mode === 'input' && state.numbers) {
    obs['numbers'] = toJsonMatrix(state.numbers);
  } else if (numberGrid?.mode === 'drive') {
    obs['numbers'] = heights;
  }

  if (layers.panel === 'paint' && state.layerPaint) {
    obs['layerPaint'] = state.layerPaint.map(toJsonMatrix);
  }

  if (paintViews.length > 0 && state.painted) {
    obs['painted'] = toJsonPainted(state.painted);
  }

  return obs;
}
