/** E13 compare-direct 설정 검사·정리. 잘못된 설정은 error 문구와 함께 안전한 기본 상태로 돌려준다. */
import { num } from '../rat';
import { E13_STRINGS as S } from '../strings.ko';
import { AREA_COLS, AREA_ROWS, LENGTH_MAX_X, LENGTH_MAX_Y } from './geometry';
import type {
  AreaItem,
  Attribute,
  CapacityItem,
  CompareConfig,
  CompareState,
  LengthItem,
} from './types';

function isInt(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

const ATTRIBUTES: readonly Attribute[] = ['length', 'area', 'capacity'];

/** 설정이 `mode`뿐이면 샌드박스 기본(곡선 7·곧은 6 밧줄, 출발선·펴기)을 쓴다. */
export function sandboxDefault(): CompareConfig {
  const rope = S.objectNames['rope'] ?? '';
  return {
    mode: 'compare-direct',
    attribute: 'length',
    items: [
      { id: 'rope-a', label: `${rope} 가`, kind: 'rope', shape: 'curvy', length: 7 },
      { id: 'rope-b', label: `${rope} 나`, kind: 'rope', shape: 'straight', length: 6, offset: 2 },
    ],
    baseline: true,
    straighten: true,
  };
}

function failure(): CompareState {
  return {
    mode: 'compare-direct',
    error: S.configError,
    attribute: 'length',
    baseline: false,
    straighten: false,
    pour: false,
    moves: 0,
    items: [],
    straightened: [],
  };
}

/** 길이 물건의 처음 자리: 왼쪽 끝은 offset칸, 줄(행)은 2·4·6. */
export function homeOf(index: number, offset: string): { x: string; y: string } {
  return { x: offset, y: String(2 + 2 * index) };
}

/** 넓이 물건의 처음 자리: 왼쪽 물건이 1칸에서 시작하고 다음 물건은 2칸 띄운다. */
export function areaHome(
  items: readonly { readonly w: string }[],
  index: number,
): { x: string; y: string } {
  let x = 1;
  for (let i = 0; i < index; i += 1) x += Math.round(num(items[i]?.w ?? '0')) + 2;
  return { x: String(x), y: '3' };
}

function parseLength(items: readonly unknown[]): LengthItem[] | null {
  if (items.length < 2 || items.length > 3) return null;
  const out: LengthItem[] = [];
  for (const [index, raw] of items.entries()) {
    if (!isRecord(raw)) return null;
    const id = text(raw['id']);
    const label = text(raw['label']);
    const kind = raw['kind'];
    const shape = raw['shape'];
    const length = raw['length'];
    const offset = raw['offset'] === undefined ? 0 : raw['offset'];
    if (id === null || label === null) return null;
    if (kind !== 'rope' && kind !== 'pencil' && kind !== 'ribbon') return null;
    if (shape !== 'curvy' && shape !== 'straight') return null;
    if (shape === 'curvy' && kind === 'pencil') return null;
    if (!isInt(length, 1, 12) || !isInt(offset, 0, 3)) return null;
    const home = homeOf(index, String(offset));
    out.push({ id, label, kind, shape, length: String(length), offset: String(offset), ...home });
  }
  return out;
}

function parseArea(items: readonly unknown[]): AreaItem[] | null {
  if (items.length !== 2) return null;
  const base: { id: string; label: string; kind: AreaItem['kind']; w: string; h: string }[] = [];
  for (const raw of items) {
    if (!isRecord(raw)) return null;
    const id = text(raw['id']);
    const label = text(raw['label']);
    const kind = raw['kind'];
    const w = raw['w'];
    const h = raw['h'];
    if (id === null || label === null) return null;
    if (kind !== 'handkerchief' && kind !== 'book' && kind !== 'paper') return null;
    if (!isInt(w, 1, 8) || !isInt(h, 1, 8)) return null;
    base.push({ id, label, kind, w: String(w), h: String(h) });
  }
  return base.map((item, index) => ({ ...item, ...areaHome(base, index) }));
}

function parseCapacity(items: readonly unknown[]): CapacityItem[] | null {
  if (items.length !== 2) return null;
  const out: CapacityItem[] = [];
  for (const raw of items) {
    if (!isRecord(raw)) return null;
    const id = text(raw['id']);
    const label = text(raw['label']);
    const kind = raw['kind'];
    const shape = raw['shape'];
    const capacity = raw['capacity'];
    if (id === null || label === null || kind !== 'cup') return null;
    if (shape !== 'tall' && shape !== 'wide') return null;
    if (!isInt(capacity, 1, 10)) return null;
    out.push({ id, label, kind, shape, capacity: String(capacity) });
  }
  return out;
}

export function normalizeCompare(config: CompareConfig): CompareState {
  const source: unknown =
    isRecord(config) && Object.keys(config).every((key) => key === 'mode')
      ? sandboxDefault()
      : config;
  if (!isRecord(source)) return failure();
  const attribute = source['attribute'];
  if (!ATTRIBUTES.includes(attribute as Attribute)) return failure();
  const rawItems = source['items'];
  if (!Array.isArray(rawItems)) return failure();
  const items: readonly unknown[] = rawItems;
  const ids = items.map((item) => (isRecord(item) ? item['id'] : undefined));
  if (new Set(ids).size !== ids.length) return failure();

  const base = {
    mode: 'compare-direct' as const,
    error: null,
    moves: 0,
    baseline: source['baseline'] === true,
    straighten: source['straighten'] === true,
    pour: source['pour'] === true,
  };
  if (attribute === 'length') {
    const parsed = parseLength(items);
    return parsed === null
      ? failure()
      : { ...base, attribute: 'length', items: parsed, straightened: [] };
  }
  if (attribute === 'area') {
    const parsed = parseArea(items);
    return parsed === null ? failure() : { ...base, attribute: 'area', items: parsed, last: null };
  }
  const parsed = parseCapacity(items);
  return parsed === null
    ? failure()
    : { ...base, attribute: 'capacity', items: parsed, poured: [] };
}

/** 이 물건이 놓일 수 있는 칸 범위(left·top 칸). 들이 물건은 옮기지 않는다. */
export function boundsOf(
  state: CompareState,
  id: string,
): { readonly maxX: number; readonly maxY: number } | null {
  if (state.attribute === 'length') {
    const item = state.items.find((candidate) => candidate.id === id);
    if (!item) return null;
    return { maxX: LENGTH_MAX_X - Math.ceil(num(item.length)), maxY: LENGTH_MAX_Y };
  }
  if (state.attribute === 'area') {
    const item = state.items.find((candidate) => candidate.id === id);
    if (!item) return null;
    return { maxX: AREA_COLS - Math.round(num(item.w)), maxY: AREA_ROWS - Math.round(num(item.h)) };
  }
  return null;
}

/** 끌어 놓을 때 쓰는 자석: 출발선(1칸 안 → 0), 겹치기(왼쪽 위 모서리가 1칸 안 → 모서리 맞춤). */
export function snapPlacement(
  state: CompareState,
  id: string,
  x: number,
  y: number,
): { readonly x: number; readonly y: number } {
  const bounds = boundsOf(state, id);
  const rx = Math.round(x);
  const ry = Math.round(y);
  if (!bounds) return { x: rx, y: ry };
  const cx = Math.min(Math.max(rx, 0), bounds.maxX);
  const cy = Math.min(Math.max(ry, 0), bounds.maxY);
  if (state.attribute === 'length' && state.baseline && cx <= 1) return { x: 0, y: cy };
  if (state.attribute === 'area') {
    const other = state.items.find((item) => item.id !== id);
    if (other) {
      const ox = num(other.x);
      const oy = num(other.y);
      if (Math.abs(cx - ox) <= 1 && Math.abs(cy - oy) <= 1) {
        return {
          x: Math.min(Math.max(ox, 0), bounds.maxX),
          y: Math.min(Math.max(oy, 0), bounds.maxY),
        };
      }
    }
  }
  return { x: cx, y: cy };
}
