/**
 * E12 `net-fold` `target:'prism'`(상태 모드 `prism-net`) 순수 reducer와 초기 상태.
 *
 * - 조각은 이미 놓인 조각의 변에 하나씩 붙인다(조각 나무). 부모는 늘 자식보다 앞에 있다.
 * - 새 조각의 맞댄 변은 엔진이 정한다(`attachEdgeFor`).
 * - 붙이거나 빼면 펼친 상태가 된다.
 */
import { clamp } from '../../../core/engine-sdk';
import type {
  PrismNetAction,
  PrismNetCardConfig,
  PrismNetCardSettings,
  PrismNetConfig,
  PrismNetSettings,
  PrismNetState,
  SolidAction,
} from '../types';
import {
  attachEdgeFor,
  canAttachToLen,
  countPieces,
  hasChildren,
  isEdgeOccupied,
  pieceEdgeCount,
  pieceEdgeLen,
  type PrismPiece,
} from './model';

export const PRISM_NET_MIN_SIDES = 3;
export const PRISM_NET_MAX_SIDES = 6;
export const PRISM_NET_MAX_PIECES = 8;

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function intIn(value: unknown, fallback: number, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return clamp(Math.round(value), min, max);
}

const BASE_WORDS = new Set(['base', 'triangle', 'square', 'pentagon', 'hexagon', 'polygon']);
const RECT_WORDS = new Set(['rect', 'rectangle']);

function sanitizeTotal(
  value: PrismNetConfig['pieces'],
  n: number,
): { readonly base: number; readonly rect: number } {
  if (Array.isArray(value)) {
    let base = 0;
    let rect = 0;
    for (const item of value as readonly unknown[]) {
      if (typeof item !== 'string') continue;
      if (BASE_WORDS.has(item)) base += 1;
      else if (RECT_WORDS.has(item)) rect += 1;
    }
    return {
      base: clamp(base, 0, PRISM_NET_MAX_PIECES),
      rect: clamp(rect, 0, PRISM_NET_MAX_PIECES),
    };
  }
  if (isRecord(value)) {
    return {
      base: intIn(value['base'], 2, 0, PRISM_NET_MAX_PIECES),
      rect: intIn(value['rect'], n, 0, PRISM_NET_MAX_PIECES),
    };
  }
  return { base: 2, rect: clamp(n, 0, PRISM_NET_MAX_PIECES) };
}

function sanitizeCards(
  value: readonly PrismNetCardConfig[] | undefined,
  fallbackN: number,
): readonly PrismNetCardSettings[] {
  if (!Array.isArray(value)) return [];
  const cards: PrismNetCardSettings[] = [];
  for (const raw of value as readonly unknown[]) {
    if (!isRecord(raw)) continue;
    const id = raw['id'];
    const label = raw['label'];
    const root = raw['root'];
    if (typeof id !== 'string' || typeof label !== 'string') continue;
    if (root !== 'base' && root !== 'rect') continue;
    const stepsRaw = raw['steps'];
    const steps: PrismNetCardSettings['steps'][number][] = [];
    if (Array.isArray(stepsRaw)) {
      for (const step of stepsRaw as readonly unknown[]) {
        if (!isRecord(step)) continue;
        const type = step['type'];
        const parent = step['parent'];
        const parentEdge = step['parentEdge'];
        if (
          (type !== 'base' && type !== 'rect') ||
          typeof parent !== 'number' ||
          typeof parentEdge !== 'number'
        ) {
          continue;
        }
        steps.push({ parent, parentEdge, type });
      }
    }
    cards.push({
      id,
      label,
      n: intIn(raw['n'], fallbackN, PRISM_NET_MIN_SIDES, PRISM_NET_MAX_SIDES),
      root,
      steps,
    });
  }
  return cards;
}

export function buildPrismNetSettings(config: PrismNetConfig): PrismNetSettings {
  const n = intIn(config.baseSides, 3, PRISM_NET_MIN_SIDES, PRISM_NET_MAX_SIDES);
  const sideLen = intIn(config.sideLen, 2, 1, 4);
  let height = intIn(config.height, 3, 1, 6);
  if (height === sideLen) {
    // 붙일 변이 모호해지지 않게 높이를 하나 키운다.
    height += 1;
    console.warn('E12 prism-net: sideLen과 height가 같아 height를 하나 키웠습니다.');
  }
  return {
    n,
    sideLen,
    height,
    total: sanitizeTotal(config.pieces, n),
    editable: config.editable !== false,
    foldable: config.foldable !== false,
    showLengths: config.showLengths === true,
    collisionHighlight: config.collisionHighlight !== false,
    netCards: sanitizeCards(config.netCards, n),
  };
}

/** 잘못된 항목을 만나면 그 항목부터 버린다. */
function sanitizeGiven(
  raw: PrismNetConfig['given'],
  settings: PrismNetSettings,
): readonly PrismPiece[] {
  if (!Array.isArray(raw) || raw.length === 0) return [];
  const pieces: PrismPiece[] = [];
  const items: readonly unknown[] = raw;
  for (let i = 0; i < items.length; i += 1) {
    const item = items[i];
    const reject = (why: string): readonly PrismPiece[] => {
      console.warn(`E12 prism-net: 잘못된 given(${why})부터 버립니다.`, item);
      return pieces;
    };
    if (!isRecord(item)) return reject('모양');
    const type = item['type'];
    if (type !== 'base' && type !== 'rect') return reject('종류');
    const locked = item['locked'] === true;
    if (i === 0) {
      if (item['parent'] !== null && item['parent'] !== undefined) return reject('뿌리');
      pieces.push({ id: 0, type, parent: null, parentEdge: 0, edge: 0, locked });
      continue;
    }
    const parentIdx = item['parent'];
    const parentEdge = item['parentEdge'];
    if (typeof parentIdx !== 'number' || !Number.isInteger(parentIdx)) return reject('부모');
    const parent = pieces[parentIdx];
    if (!parent) return reject('없는 부모');
    if (typeof parentEdge !== 'number' || !Number.isInteger(parentEdge)) return reject('변 번호');
    if (parentEdge < 0 || parentEdge >= pieceEdgeCount(parent.type, settings.n)) {
      return reject('없는 변');
    }
    const len = pieceEdgeLen(parent.type, parentEdge);
    if (!canAttachToLen(type, len)) return reject('변 길이');
    if (isEdgeOccupied(pieces, parent.id, parentEdge)) return reject('이미 붙은 변');
    pieces.push({
      id: i,
      type,
      parent: parent.id,
      parentEdge,
      edge: attachEdgeFor(type, len),
      locked,
    });
  }
  return pieces;
}

export function createPrismNetState(config: PrismNetConfig): PrismNetState {
  const settings = buildPrismNetSettings(config);
  return {
    mode: 'prism-net',
    settings,
    pieces: sanitizeGiven(config.given, settings),
    selectedType: null,
    folded: false,
    foldCount: 0,
  };
}

/** 그 종류의 남은 조각 수(처음 놓인 조각도 센다). */
export function remainingCounts(state: PrismNetState): {
  readonly base: number;
  readonly rect: number;
} {
  const used = countPieces(state.pieces);
  return {
    base: Math.max(0, state.settings.total.base - used.base),
    rect: Math.max(0, state.settings.total.rect - used.rect),
  };
}

/** 고른 종류의 조각을 그 조각의 그 변에 붙일 수 있는가(남은 수 포함). 뿌리는 `parentId`가 null. */
export function canAttach(
  state: PrismNetState,
  parentId: number | null,
  parentEdge: number,
): boolean {
  const { settings, pieces, selectedType, folded } = state;
  if (!settings.editable || folded || selectedType === null) return false;
  if (remainingCounts(state)[selectedType] <= 0) return false;
  if (parentId === null) return pieces.length === 0;
  if (pieces.length === 0) return false;
  const parent = pieces.find((p) => p.id === parentId);
  if (!parent) return false;
  if (!Number.isInteger(parentEdge)) return false;
  if (parentEdge < 0 || parentEdge >= pieceEdgeCount(parent.type, settings.n)) return false;
  if (isEdgeOccupied(pieces, parent.id, parentEdge)) return false;
  return canAttachToLen(selectedType, pieceEdgeLen(parent.type, parentEdge));
}

export function canRemovePiece(state: PrismNetState, id: number): boolean {
  if (!state.settings.editable) return false;
  const piece = state.pieces.find((p) => p.id === id);
  if (!piece || piece.locked) return false;
  return !hasChildren(state.pieces, id);
}

function nextId(pieces: readonly PrismPiece[]): number {
  return pieces.reduce((max, p) => Math.max(max, p.id), -1) + 1;
}

export function reducePrismNet(state: PrismNetState, action: SolidAction): PrismNetState {
  const act = action as PrismNetAction;
  switch (act.type) {
    case 'select-piece-type': {
      if (!state.settings.editable) return state;
      if (act.pieceType === null) {
        return state.selectedType === null ? state : { ...state, selectedType: null };
      }
      if (act.pieceType !== 'base' && act.pieceType !== 'rect') return state;
      if (remainingCounts(state)[act.pieceType] <= 0) return state;
      if (state.selectedType === act.pieceType) return state;
      return { ...state, selectedType: act.pieceType };
    }

    case 'attach': {
      const { selectedType } = state;
      if (selectedType === null) return state;
      const parentId = act.parent;
      if (parentId !== null && !Number.isInteger(parentId)) return state;
      if (!canAttach(state, parentId, act.parentEdge)) return state;
      const parent = parentId === null ? null : state.pieces.find((p) => p.id === parentId);
      const len = parent ? pieceEdgeLen(parent.type, act.parentEdge) : 's';
      const piece: PrismPiece = {
        id: nextId(state.pieces),
        type: selectedType,
        parent: parentId,
        parentEdge: parentId === null ? 0 : act.parentEdge,
        edge: parentId === null ? 0 : attachEdgeFor(selectedType, len),
        locked: false,
      };
      const next: PrismNetState = { ...state, pieces: [...state.pieces, piece], folded: false };
      // 그 종류를 다 쓰면 고른 종류를 푼다.
      return remainingCounts(next)[selectedType] <= 0 ? { ...next, selectedType: null } : next;
    }

    case 'remove-piece': {
      if (!Number.isInteger(act.id) || !canRemovePiece(state, act.id)) return state;
      return { ...state, pieces: state.pieces.filter((p) => p.id !== act.id), folded: false };
    }

    case 'clear': {
      if (!state.settings.editable) return state;
      // 잠기지 않은 조각을 모두 뺀다. 잠긴 조각의 부모가 사라지지 않게 부모가 남은 조각만 남긴다.
      const ids = new Set<number>();
      const pieces = state.pieces.filter((p) => {
        if (!p.locked) return false;
        if (p.parent !== null && !ids.has(p.parent)) return false;
        ids.add(p.id);
        return true;
      });
      if (pieces.length === state.pieces.length && !state.folded) return state;
      return { ...state, pieces, folded: false };
    }

    case 'toggle-fold': {
      if (!state.settings.foldable || state.pieces.length === 0) return state;
      if (state.folded) return { ...state, folded: false };
      return { ...state, folded: true, foldCount: state.foldCount + 1 };
    }

    default:
      return state;
  }
}
