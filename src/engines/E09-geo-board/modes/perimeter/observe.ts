/**
 * geoboard 제약의 관찰 결과(T103).
 *
 * - `rect`·`log`는 모두 정수다(가로·세로·둘레·넓이).
 * - 화면에는 지금 넓이만 실시간으로 쓰고, 최대 넓이·정답 직사각형은 Observation에도 넣지 않는다.
 */
import type { Observation } from '../../../../core/engine-sdk';
import type { GeoboardState, RectLogEntry } from '../../types';
import { currentRect } from './reduce';

export type PerimeterRectObservation = {
  readonly width: number;
  readonly height: number;
  readonly perimeter: number;
  readonly area: number;
};

export type PerimeterLogObservation = {
  readonly width: number;
  readonly height: number;
  readonly area: number;
};

export type PerimeterObservation = {
  readonly constraint: { readonly type: 'fixed-perimeter'; readonly value: number } | null;
  readonly rect: PerimeterRectObservation | null;
  readonly log: PerimeterLogObservation[];
};

function logObservation(entry: RectLogEntry): PerimeterLogObservation {
  return { width: entry.width, height: entry.height, area: entry.width * entry.height };
}

export function perimeterObservation(state: GeoboardState): PerimeterObservation {
  const constraint = state.settings.constraint;
  const rect = constraint ? currentRect(state) : null;
  return {
    constraint: constraint ? { type: 'fixed-perimeter', value: constraint.value } : null,
    rect: rect
      ? {
          width: rect.width,
          height: rect.height,
          perimeter: 2 * (rect.width + rect.height),
          area: rect.width * rect.height,
        }
      : null,
    log: state.log.map(logObservation),
  };
}

export function observePerimeter(state: GeoboardState): Observation {
  return { mode: state.mode, ...perimeterObservation(state) };
}
