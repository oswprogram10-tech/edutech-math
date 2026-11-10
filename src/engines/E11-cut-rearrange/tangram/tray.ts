/** 조각 쟁반 위치. 칠교 조각은 판 안 오른쪽(x 18~28)에 놓는다. */
import { Rational } from '../../../core/math';
import type { PieceKind, PieceSet } from './pieces';
import { defaultKinds } from './pieces';
import type { SurdD } from './surd';
import { sOf } from './surd';
import type { SPoint } from './surd-geometry';

export interface TraySlot {
  readonly kind: string;
  readonly at: SPoint;
}

function p(d: SurdD, x: number, y: number): SPoint {
  return { x: sOf(Rational.of(x), Rational.of(0), d), y: sOf(Rational.of(y), Rational.of(0), d) };
}

const TANGRAM_TRAY: readonly TraySlot[] = [
  { kind: 'large-triangle', at: p(2, 18, 1) },
  { kind: 'large-triangle', at: p(2, 18, 5) },
  { kind: 'medium-triangle', at: p(2, 23, 0) },
  { kind: 'small-triangle', at: p(2, 23, 3) },
  { kind: 'small-triangle', at: p(2, 23, 5) },
  { kind: 'square', at: p(2, 24, 8) },
  { kind: 'parallelogram', at: p(2, 24, 12) },
];

const PATTERN_TRAY: readonly TraySlot[] = [
  { kind: 'triangle', at: p(3, 19, 3) },
  { kind: 'square', at: p(3, 21, 4) },
  { kind: 'rhombus', at: p(3, 19, 7) },
  { kind: 'thin-rhombus', at: p(3, 23, 8) },
  { kind: 'trapezoid', at: p(3, 19, 11) },
  { kind: 'hexagon', at: p(3, 23, 13) },
];

export function traySlots(set: PieceSet): readonly TraySlot[] {
  return set === 'tangram' ? TANGRAM_TRAY : PATTERN_TRAY;
}

/** 설정에 적힌 조각 종류를 쟁반의 빈 자리에 차례로 배정한다. */
export function assignTraySlots(set: PieceSet, kinds: readonly string[]): TraySlot[] {
  const slots = traySlots(set);
  const used = new Set<number>();
  const result: TraySlot[] = [];
  for (const kind of kinds) {
    let index = slots.findIndex((slot, candidate) => !used.has(candidate) && slot.kind === kind);
    if (index < 0) index = slots.findIndex((_, candidate) => !used.has(candidate));
    const slot = slots[index];
    if (!slot) break;
    used.add(index);
    result.push({ kind, at: slot.at });
  }
  return result;
}

export function tangramKindsForConfig(
  pieces: readonly (string | { readonly kind: string })[],
): string[] {
  if (pieces.length === 0) return [...defaultKinds('tangram')];
  const result: string[] = [];
  for (const item of pieces) {
    const kind = typeof item === 'string' ? item : item.kind;
    if (
      kind === 'large-triangle' ||
      kind === 'medium-triangle' ||
      kind === 'small-triangle' ||
      kind === 'square' ||
      kind === 'parallelogram'
    ) {
      result.push(kind);
    }
  }
  return result.length > 0 ? result : [...defaultKinds('tangram')];
}

/** 패턴 블록 더미에서 꺼낸 조각을 놓을 실루엣 원점 근처 자리. */
export function patternSpawnPoint(): SPoint {
  return p(3, 6, 7);
}

export function isTrayKind(set: PieceSet, kind: string): kind is PieceKind {
  return traySlots(set).some((slot) => slot.kind === kind);
}
