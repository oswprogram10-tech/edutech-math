/**
 * geoboard의 `fixed-perimeter` 제약(T103).
 *
 * - 둘레 `value`는 짝수 정수 4 이상이고, 격자 안에 들어가는 직사각형이 있어야 켜진다.
 * - 직사각형은 왼쪽 위 꼭짓점을 못 `[0, 0]`에 고정한다. 가로 w, 세로 h = 반둘레 − w.
 * - 기록표는 학생이 `log-rect`로 남긴 (가로, 세로)만 담는다(최대 12줄).
 */
import { clamp } from '../../../../core/engine-sdk';
import type {
  FixedPerimeterConstraint,
  GeoAction,
  GeoboardConfig,
  GeoboardState,
  GeoBand,
  Peg,
  RectLogEntry,
} from '../../types';

export const MAX_PERIMETER_LOG = 12;

export interface RectRange {
  readonly half: number;
  readonly minWidth: number;
  readonly maxWidth: number;
}

/** 격자 안에서 가능한 가로 범위. 가능한 직사각형이 없으면 null. */
export function rectRange(
  constraint: FixedPerimeterConstraint,
  cols: number,
  rows: number,
): RectRange | null {
  const half = constraint.value / 2;
  const minWidth = Math.max(1, half - (rows - 1));
  const maxWidth = Math.min(half - 1, cols - 1);
  if (minWidth > maxWidth) return null;
  return { half, minWidth, maxWidth };
}

/** 설정의 제약을 검사한다. 조건이 맞지 않으면 null(일반 geoboard). */
export function readConstraint(
  config: GeoboardConfig,
  cols: number,
  rows: number,
): FixedPerimeterConstraint | null {
  const raw = config.constraint;
  if (raw === null || typeof raw !== 'object') return null;
  const candidate = raw as {
    readonly type?: unknown;
    readonly value?: unknown;
    readonly shape?: unknown;
  };
  if (candidate.type !== 'fixed-perimeter' || candidate.shape !== 'rectangle') return null;
  if (typeof candidate.value !== 'number' || !Number.isFinite(candidate.value)) return null;
  const value = Math.round(candidate.value);
  if (value !== candidate.value) return null;
  if (value < 4 || value % 2 !== 0) return null;
  const constraint: FixedPerimeterConstraint = {
    type: 'fixed-perimeter',
    value,
    shape: 'rectangle',
  };
  return rectRange(constraint, cols, rows) === null ? null : constraint;
}

/** 처음 직사각형. 20이면 3×7(과제 답 5×5·1×9로 시작하지 않는다). */
export function initialRect(
  constraint: FixedPerimeterConstraint,
  cols: number,
  rows: number,
): { readonly width: number; readonly height: number } | null {
  const range = rectRange(constraint, cols, rows);
  if (!range) return null;
  const width = clamp(
    Math.max(range.minWidth, Math.floor(range.half / 3)),
    range.minWidth,
    range.maxWidth,
  );
  return { width, height: range.half - width };
}

export function rectPegs(width: number, height: number): readonly Peg[] {
  return [
    [0, 0],
    [width, 0],
    [width, height],
    [0, height],
  ];
}

export function rectBand(width: number, height: number): GeoBand {
  return { id: 'b1', pegs: rectPegs(width, height), closed: true };
}

/** 지금 고무줄에서 가로·세로를 읽는다. 없으면 null. */
export function currentRect(
  state: GeoboardState,
): { readonly width: number; readonly height: number } | null {
  const band = state.bands[0];
  if (!band || !band.closed || band.pegs.length < 3) return null;
  const xs = band.pegs.map((peg) => peg[0]);
  const ys = band.pegs.map((peg) => peg[1]);
  const width = Math.max(...xs) - Math.min(...xs);
  const height = Math.max(...ys) - Math.min(...ys);
  if (width <= 0 || height <= 0) return null;
  return { width, height };
}

function sameEntry(entry: RectLogEntry, width: number, height: number): boolean {
  return entry.width === width && entry.height === height;
}

export function reducePerimeter(state: GeoboardState, action: GeoAction): GeoboardState {
  const constraint = state.settings.constraint;
  if (!constraint) return state;
  const [cols, rows] = state.settings.grid;
  const range = rectRange(constraint, cols, rows);
  if (!range) return state;

  switch (action.type) {
    case 'resize-rect': {
      const { width, height } = action;
      if (!Number.isInteger(width) || !Number.isInteger(height)) return state;
      if (width + height !== range.half) return state;
      if (width < range.minWidth || width > range.maxWidth) return state;
      if (height < 1 || height > rows - 1) return state;
      const band = state.bands[0];
      const current = currentRect(state);
      if (current && current.width === width && current.height === height) return state;
      const nextBand = rectBand(width, height);
      return {
        ...state,
        bands: band
          ? state.bands.map((item) => (item.id === band.id ? nextBand : item))
          : [nextBand],
        activeBand: null,
      };
    }

    case 'log-rect': {
      if (!state.settings.log) return state;
      const rect = currentRect(state);
      if (!rect) return state;
      if (state.log.length >= MAX_PERIMETER_LOG) return state;
      if (state.log.some((entry) => sameEntry(entry, rect.width, rect.height))) return state;
      return { ...state, log: [...state.log, { width: rect.width, height: rect.height }] };
    }

    default:
      // 둘레가 깨지므로 고무줄 편집 Action은 모두 무시한다.
      return state;
  }
}
