/**
 * E12 `surface-volume` 모드 Observation 생성(순수 함수).
 *
 * `paintedArea`·`surfaceArea`·`volume`·`logCorrect`·`cubeCount`는 판정용 엔진 계산값이다.
 * 학생 화면에는 쓰지 않는다.
 */
import type { Observation } from '../../../core/engine-sdk';
import type { SvState } from '../types';
import { minSurfaceBox, paintedArea, sameBox, surfaceArea, volume } from './geometry';
import { fullLayerCount } from './reduce';

export function observeSv(state: SvState): Observation {
  const [w, d, h] = state.dims;
  const area = surfaceArea(w, d, h);
  const total = volume(w, d, h);
  const cubeCount = state.filled.length;
  const logCorrect = state.logRows.map((r) => r.surface === surfaceArea(r.w, r.d, r.h));

  const distinct: (readonly [number, number, number])[] = [];
  for (const row of state.logRows) {
    const box = [row.w, row.d, row.h] as const;
    if (!distinct.some((b) => sameBox(b, box))) distinct.push(box);
  }

  const best =
    state.settings.variant === 'fixed-volume' ? minSurfaceBox(state.settings.volume) : null;
  const minSurfaceLogged =
    best !== null &&
    state.logRows.some((r, i) => sameBox([r.w, r.d, r.h], best) && logCorrect[i] === true);

  return {
    mode: state.mode,
    variant: state.settings.variant,
    solid: { w, d, h },
    step: state.step,
    unfolded: state.unfolded,
    view: { yaw: state.view.yaw, pitch: state.view.pitch },
    painted: [...state.painted],
    paintedCount: state.painted.length,
    paintedArea: paintedArea(state.painted, w, d, h),
    allPainted: state.painted.length === 6,
    surfaceArea: area,
    cubeCount,
    layer: state.layer,
    fullLayers: fullLayerCount(state.filled, w, d, h),
    complete: cubeCount === total,
    volume: total,
    dims: [w, d, h],
    logRows: state.logRows.map((r) => ({ w: r.w, d: r.d, h: r.h, surface: r.surface })),
    logDistinct: distinct.length,
    logCorrect,
    minSurfaceLogged,
  };
}
