/**
 * E12 3D 입체 Observation 생성(순수 함수).
 *
 * 회전(`viewTurn`)을 해도 상태 좌표·투영 행렬은 변하지 않는다.
 */
import type { Observation } from '../../core/engine-sdk';
import type { SolidState } from './types';
import { frontView, heightMap, isConnected, sideView, topView } from './voxel';

export function observe(state: SolidState): Observation {
  const { grid, maxHeight, maxCubes } = state.settings;
  const cubes = state.cubes.map((c) => [c.x, c.y, c.z]);
  const heights = heightMap(state.cubes, grid);
  const top = topView(state.cubes, grid);
  const front = frontView(state.cubes, grid, maxHeight);
  const side = sideView(state.cubes, grid, maxHeight);

  return {
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
  };
}
