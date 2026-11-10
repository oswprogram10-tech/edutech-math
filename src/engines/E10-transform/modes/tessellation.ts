/**
 * `tessellation` 모드: 타일을 밀고·뒤집고·돌려 틀을 빈틈없이 채운다.
 *
 * 타일은 단위 칸의 정확한 합집합이라 빈틈·겹침을 격자 칸 수로 정확히 센다.
 * 정오각형은 유리수 좌표로 놓을 수 없어 한 꼭짓점 둘레 시험(1~4개)만 한다.
 */
import type { JsonValue, Observation } from '../../../core/engine-sdk';
import {
  applyStampMove,
  tessellationStats,
  tileFamily,
  tileStamp,
  toggleCustomCell,
} from '../tiles';
import type { TessBaseTile, TessTile, TileStamp } from '../tiles';
import { isTessBaseTile, initialCustomCells, isTessTile, TRI_FRAME_ROWS } from '../tiles';
import { decodeTriCell, isTriAngle } from '../tri';
import type {
  Move,
  TessellationConfig,
  TessellationSettings,
  TessellationState,
  TransformAction,
} from '../types';

const DEFAULT_BASE: readonly TessBaseTile[] = ['square', 'triangle', 'hexagon', 'pentagon-regular'];

function readBaseTiles(value: unknown): readonly TessBaseTile[] {
  if (!Array.isArray(value)) return [...DEFAULT_BASE];
  const result: TessBaseTile[] = [];
  for (const item of value) {
    if (typeof item !== 'string' || !isTessBaseTile(item)) continue;
    if (!result.includes(item)) result.push(item);
  }
  return result.length > 0 ? result : [...DEFAULT_BASE];
}

function settingsOf(config: TessellationConfig): TessellationSettings {
  return {
    baseTiles: readBaseTiles(config.baseTiles),
    customize: config.customize === 'edge-translate' ? 'edge-translate' : 'none',
    gapCheck: config.gapCheck !== false,
  };
}

function allowedTile(settings: TessellationSettings, tile: TessTile): boolean {
  if (tile === 'custom') return settings.customize === 'edge-translate';
  return settings.baseTiles.includes(tile);
}

export function createTessellationState(config: TessellationConfig): TessellationState {
  const settings = settingsOf(config);
  const tile = settings.baseTiles[0] ?? 'square';
  const customCells = initialCustomCells();
  return {
    mode: 'tessellation',
    tile,
    stamp: tileStamp(tile, customCells),
    placed: [],
    customCells,
    movesUsed: [],
    checked: false,
    hub: 1,
    center: 0,
    nextId: 1,
    settings,
  };
}

function inExtent(tile: TessTile, stamp: TileStamp): boolean {
  if (tileFamily(tile) === 'square') {
    return stamp.cells.every(
      (cell) => cell[0] >= -6 && cell[1] >= -6 && cell[0] < 24 && cell[1] < 24,
    );
  }
  if (tileFamily(tile) === 'tri') {
    return stamp.cells.every((cell) => {
      const decoded = decodeTriCell(cell as readonly [number, number]);
      if (!decoded) return false;
      if (decoded.b < -2 || decoded.b >= TRI_FRAME_ROWS + 2) return false;
      const a0 = -Math.floor(decoded.b / 2);
      return decoded.a >= a0 - 2 && decoded.a < a0 + 10;
    });
  }
  return true;
}

function validMove(tile: TessTile, move: Move): boolean {
  if (move.kind === 'slide') return Number.isSafeInteger(move.dx) && Number.isSafeInteger(move.dy);
  if (move.kind === 'flip') {
    return (
      move.side === 'up' || move.side === 'down' || move.side === 'left' || move.side === 'right'
    );
  }
  if (move.direction !== 'cw' && move.direction !== 'ccw') return false;
  if (tileFamily(tile) === 'square')
    return move.angle === 90 || move.angle === 180 || move.angle === 270;
  return isTriAngle(move.angle);
}

export function reduceTessellation(
  state: TessellationState,
  action: TransformAction,
): TessellationState {
  switch (action.type) {
    case 'select-tile': {
      if (!isTessTile(action.tile)) return state;
      if (!allowedTile(state.settings, action.tile)) return state;
      if (state.placed.length > 0) {
        const current = state.placed[0]?.tile;
        if (current && tileFamily(current) !== tileFamily(action.tile)) return state;
      }
      return {
        ...state,
        tile: action.tile,
        stamp: tileStamp(action.tile, state.customCells),
        center: 0,
      };
    }
    case 'move': {
      if (tileFamily(state.tile) === 'free') return state;
      if (!validMove(state.tile, action.move)) return state;
      let stamp;
      try {
        stamp = applyStampMove(state.tile, state.stamp, action.move);
      } catch {
        return state;
      }
      if (!inExtent(state.tile, stamp)) return state;
      const kinds =
        action.move.kind === 'slide' ? 'slide' : action.move.kind === 'flip' ? 'flip' : 'turn';
      return { ...state, stamp, movesUsed: [...state.movesUsed, kinds] };
    }
    case 'place': {
      if (state.stamp.cells.length === 0) return state;
      return {
        ...state,
        placed: [
          ...state.placed,
          {
            id: state.nextId,
            tile: state.tile,
            cells: state.stamp.cells.map((cell) => [...cell] as [number, number]),
          },
        ],
        nextId: state.nextId + 1,
        checked: false,
      };
    }
    case 'remove-last': {
      if (state.placed.length === 0) return state;
      return { ...state, placed: state.placed.slice(0, -1), checked: false };
    }
    case 'clear-tiles': {
      if (state.placed.length === 0 && state.movesUsed.length === 0) return state;
      return { ...state, placed: [], movesUsed: [], checked: false };
    }
    case 'check-gaps':
      return state.checked ? state : { ...state, checked: true };
    case 'toggle-notch': {
      if (state.settings.customize !== 'edge-translate') return state;
      const next = toggleCustomCell(state.customCells, action.cell);
      if (!next) return state;
      return {
        ...state,
        customCells: next,
        stamp: state.tile === 'custom' ? tileStamp('custom', next) : state.stamp,
      };
    }
    case 'hub-add':
      return state.hub >= 4 ? state : { ...state, hub: state.hub + 1 };
    case 'hub-remove':
      return state.hub <= 1 ? state : { ...state, hub: state.hub - 1 };
    case 'select-center': {
      if (!Number.isInteger(action.index) || action.index < 0 || action.index > 3) return state;
      return { ...state, center: action.index };
    }
    default:
      return state;
  }
}

function pentagonOf(hub: number): {
  readonly count: number;
  readonly angleSum: number;
  readonly gapDegrees: number;
  readonly overlapDegrees: number;
} {
  return {
    count: hub,
    angleSum: 108 * hub,
    gapDegrees: hub === 3 ? 36 : 0,
    overlapDegrees: hub === 4 ? 72 : 0,
  };
}

export function observeTessellation(state: TessellationState): Observation {
  const stats = tessellationStats(state.placed, state.tile);
  const movesUsed = [...state.movesUsed].sort();
  const result: Record<string, JsonValue> = {
    mode: state.mode,
    tile: state.tile,
    lattice: tileFamily(state.tile),
    placedCount: state.placed.length,
    frameCells: stats.frameCells,
    covered: stats.covered,
    overlapCells: stats.overlapCells,
    gapCells: stats.gapCells,
    coverage: stats.coverage,
    movesUsed,
    customUsed: state.placed.some((tile) => tile.tile === 'custom'),
    gapChecked: state.checked,
    placedTiles: state.placed.map((tile) => tile.tile),
    pentagon: pentagonOf(state.hub),
  };
  return result;
}
