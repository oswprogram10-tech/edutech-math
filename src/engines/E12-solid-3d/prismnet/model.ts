/**
 * E12 `net-fold` `target:'prism'` 각기둥 전개도 모델(순수 함수, 정수와 자리 이름만).
 *
 * - 각기둥 면 자리는 `B`(아랫밑면), `T`(윗밑면), `S0..S{n-1}`(옆면)이다.
 * - 조각 나무(붙이기 기록)에서 조각마다 어느 자리로 가는지 계산하고 접기 판정을 한다.
 *   이 계산에는 좌표를 쓰지 않는다. 좌표는 종이 겹침 검사(`paperOverlap`)에만 쓰며
 *   그것은 `layout.ts`가 맡는다.
 *
 * 방향 규칙: 모든 면의 변 목록은 "바깥에서 본" 반시계 방향이다.
 * - 윗면 `T`: 위에서 본 반시계. 변 k는 옆면 `S{k}`와 맞닿는다.
 * - 아랫면 `B`: 아래에서 본 반시계라 변 순서가 `T`와 반대다. 변 j는 `S{(n-j) mod n}`.
 * - 옆면 `Si`: [아래 → `B`, 오른쪽 → `S{i+1}`, 위 → `T`, 왼쪽 → `S{i-1}`].
 * 조각의 변 번호도 종이 위에서 반시계다(직사각형: 0 아래, 1 오른쪽, 2 위, 3 왼쪽).
 */
import { paperOverlaps, type PieceGeometry } from './layout';

export type PrismPieceType = 'base' | 'rect';

export interface PrismPiece {
  readonly id: number;
  readonly type: PrismPieceType;
  /** 부모 조각의 `id`. 뿌리는 null. */
  readonly parent: number | null;
  /** 부모 조각의 변 번호(뿌리는 0). */
  readonly parentEdge: number;
  /** 이 조각에서 맞댄 변 번호(엔진이 정한다). */
  readonly edge: number;
  readonly locked: boolean;
}

export type SlotName = string;

/** `s`: 밑면 변·옆면의 위아래 변, `h`: 옆면의 왼쪽·오른쪽 변. */
export type EdgeLen = 's' | 'h';

export interface PrismNetEvaluation {
  /** 조각 배열과 같은 순서. 계산 못 하면 null. */
  readonly slotOf: readonly (SlotName | null)[];
  /** 같은 자리에 둘 이상 간 조각의 배열 번호(오름차순). */
  readonly duplicates: readonly number[];
  /** 같은 자리에 간 조각 묶음(배열 번호). */
  readonly duplicateGroups: readonly (readonly number[])[];
  /** 비어 있는 자리 수. */
  readonly missing: number;
  /** 종류가 안 맞는 자리로 간 조각의 배열 번호. */
  readonly mismatch: readonly number[];
  /** 종이 위에서 겹치는 조각 쌍(배열 번호). */
  readonly paperOverlap: readonly (readonly [number, number])[];
  readonly valid: boolean;
  readonly bothBasesSameEnd: boolean;
}

export function slotCount(n: number): number {
  return n + 2;
}

export function pieceEdgeCount(type: PrismPieceType, n: number): number {
  return type === 'base' ? n : 4;
}

export function pieceEdgeLen(type: PrismPieceType, edge: number): EdgeLen {
  if (type === 'base') return 's';
  return edge % 2 === 0 ? 's' : 'h';
}

/** 새 조각이 부모 변에 맞대는 자기 변 번호. 부모 변 길이가 `s`면 아래 변(0), `h`면 왼쪽 변(3). 밑면은 늘 0. */
export function attachEdgeFor(type: PrismPieceType, parentEdgeLen: EdgeLen): number {
  if (type === 'base') return 0;
  return parentEdgeLen === 's' ? 0 : 3;
}

/** 그 종류의 조각을 붙일 수 있는 변 길이인가(밑면은 `s` 변만). */
export function canAttachToLen(type: PrismPieceType, parentEdgeLen: EdgeLen): boolean {
  return type === 'rect' || parentEdgeLen === 's';
}

export function sideSlot(i: number): SlotName {
  return `S${i}`;
}

export function isBaseSlot(slot: SlotName): boolean {
  return slot === 'B' || slot === 'T';
}

export function allSlots(n: number): readonly SlotName[] {
  const slots: SlotName[] = ['B', 'T'];
  for (let i = 0; i < n; i += 1) slots.push(sideSlot(i));
  return slots;
}

function mod(a: number, m: number): number {
  return ((a % m) + m) % m;
}

/** 자리의 변 목록(바깥에서 본 반시계). 각 항목은 그 변 너머의 자리다. */
export function slotNeighbors(slot: SlotName, n: number): readonly SlotName[] {
  if (slot === 'T') {
    return Array.from({ length: n }, (_, k) => sideSlot(k));
  }
  if (slot === 'B') {
    return Array.from({ length: n }, (_, j) => sideSlot(mod(n - j, n)));
  }
  const i = Number(slot.slice(1));
  return ['B', sideSlot(mod(i + 1, n)), 'T', sideSlot(mod(i - 1, n))];
}

/** 조각 `id`로 배열 번호를 찾는 표. */
export function indexById(pieces: readonly PrismPiece[]): Map<number, number> {
  const map = new Map<number, number>();
  pieces.forEach((p, i) => map.set(p.id, i));
  return map;
}

export interface SlotAssignment {
  readonly slotOf: readonly (SlotName | null)[];
  readonly mismatch: readonly number[];
}

/**
 * 조각 나무 → 자리 계산. 부모가 늘 자식보다 앞에 있어야 한다.
 * 종류가 안 맞는 자리(밑면이 옆면 자리, 옆면이 밑면 자리)로 가면 `mismatch`이고
 * 그 조각과 자손의 자리는 null이다(자손은 `mismatch`에 넣지 않는다).
 */
export function assignSlots(pieces: readonly PrismPiece[], n: number): SlotAssignment {
  const idx = indexById(pieces);
  const slotOf: (SlotName | null)[] = pieces.map(() => null);
  const offset: number[] = pieces.map(() => 0);
  const mismatch: number[] = [];

  pieces.forEach((piece, i) => {
    if (piece.parent === null) {
      slotOf[i] = piece.type === 'base' ? 'B' : 'S0';
      offset[i] = 0;
      return;
    }
    const pi = idx.get(piece.parent);
    if (pi === undefined || pi >= i) return;
    const parent = pieces[pi];
    const parentSlot = slotOf[pi];
    if (!parent || parentSlot === null || parentSlot === undefined) return;
    const parentEdges = slotNeighbors(parentSlot, n);
    if (piece.parentEdge < 0 || piece.parentEdge >= parentEdges.length) return;
    const parentSlotEdge = mod(piece.parentEdge + (offset[pi] ?? 0), parentEdges.length);
    const childSlot = parentEdges[parentSlotEdge];
    if (childSlot === undefined) return;
    const fits = isBaseSlot(childSlot) ? piece.type === 'base' : piece.type === 'rect';
    if (!fits) {
      mismatch.push(i);
      return;
    }
    const childEdges = slotNeighbors(childSlot, n);
    const facing = childEdges.indexOf(parentSlot);
    if (facing < 0) return;
    slotOf[i] = childSlot;
    offset[i] = mod(facing - piece.edge, childEdges.length);
  });

  return { slotOf, mismatch };
}

export interface PrismNetSizes {
  readonly sideLen: number;
  readonly height: number;
}

/** 조각 나무 전체를 판정한다. 자리 계산은 정수만 쓰고, `paperOverlap`만 2D 좌표를 쓴다. */
export function evaluatePrismNet(
  pieces: readonly PrismPiece[],
  n: number,
  sizes: PrismNetSizes,
): PrismNetEvaluation {
  const { slotOf, mismatch } = assignSlots(pieces, n);

  const bySlot = new Map<SlotName, number[]>();
  slotOf.forEach((slot, i) => {
    if (slot === null) return;
    const list = bySlot.get(slot) ?? [];
    list.push(i);
    bySlot.set(slot, list);
  });
  const duplicateGroups: number[][] = [];
  for (const list of bySlot.values()) {
    if (list.length >= 2) duplicateGroups.push(list);
  }
  duplicateGroups.sort((a, b) => (a[0] ?? 0) - (b[0] ?? 0));
  const duplicates = duplicateGroups.flat().sort((a, b) => a - b);
  const missing = slotCount(n) - bySlot.size;

  const geometry: PieceGeometry[] = pieces.map((p) => ({
    id: p.id,
    type: p.type,
    parent: p.parent,
    parentEdge: p.parentEdge,
    edge: p.edge,
  }));
  const paperOverlap = paperOverlaps(geometry, n, sizes.sideLen, sizes.height);

  const allAssigned = slotOf.every((s) => s !== null);
  const valid =
    pieces.length > 0 &&
    allAssigned &&
    missing === 0 &&
    duplicates.length === 0 &&
    mismatch.length === 0 &&
    paperOverlap.length === 0;

  const baseSlots = slotOf.filter((s, i) => s !== null && pieces[i]?.type === 'base');
  const bothBasesSameEnd =
    baseSlots.filter((s) => s === 'B').length >= 2 ||
    baseSlots.filter((s) => s === 'T').length >= 2;

  return {
    slotOf,
    duplicates,
    duplicateGroups,
    missing,
    mismatch,
    paperOverlap,
    valid,
    bothBasesSameEnd,
  };
}

/** 문제가 있는 조각의 배열 번호(중복·불일치·종이 겹침). 이유는 알려 주지 않고 칠할 곳만 안다. */
export function problemPieceIndices(evaluation: PrismNetEvaluation): readonly number[] {
  const set = new Set<number>([...evaluation.duplicates, ...evaluation.mismatch]);
  for (const [a, b] of evaluation.paperOverlap) {
    set.add(a);
    set.add(b);
  }
  return [...set].sort((a, b) => a - b);
}

export interface PieceCounts {
  readonly base: number;
  readonly rect: number;
}

export function countPieces(pieces: readonly PrismPiece[]): PieceCounts {
  let base = 0;
  let rect = 0;
  for (const p of pieces) {
    if (p.type === 'base') base += 1;
    else rect += 1;
  }
  return { base, rect };
}

/** 부모 변이나 자기 맞댄 변이 이미 쓰였는지. */
export function isEdgeOccupied(pieces: readonly PrismPiece[], id: number, edge: number): boolean {
  const piece = pieces.find((p) => p.id === id);
  if (!piece) return true;
  if (piece.parent !== null && piece.edge === edge) return true;
  return pieces.some((p) => p.parent === id && p.parentEdge === edge);
}

export function hasChildren(pieces: readonly PrismPiece[], id: number): boolean {
  return pieces.some((p) => p.parent === id);
}

/** 카드 단계(뿌리와 붙이기 기록)로 조각 나무를 만든다. 잘못되면 null. */
export function buildPiecesFromSteps(
  root: PrismPieceType,
  steps: readonly {
    readonly parent: number;
    readonly parentEdge: number;
    readonly type: PrismPieceType;
  }[],
  n: number,
): readonly PrismPiece[] | null {
  const pieces: PrismPiece[] = [
    { id: 0, type: root, parent: null, parentEdge: 0, edge: 0, locked: true },
  ];
  for (const step of steps) {
    const parent = pieces.find((p) => p.id === step.parent);
    if (!parent) return null;
    if (!Number.isInteger(step.parentEdge)) return null;
    if (step.parentEdge < 0 || step.parentEdge >= pieceEdgeCount(parent.type, n)) return null;
    const len = pieceEdgeLen(parent.type, step.parentEdge);
    if (!canAttachToLen(step.type, len)) return null;
    if (isEdgeOccupied(pieces, parent.id, step.parentEdge)) return null;
    pieces.push({
      id: pieces.length,
      type: step.type,
      parent: parent.id,
      parentEdge: step.parentEdge,
      edge: attachEdgeFor(step.type, len),
      locked: true,
    });
  }
  return pieces;
}
