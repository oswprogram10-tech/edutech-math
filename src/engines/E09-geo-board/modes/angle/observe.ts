/**
 * angle 모드의 관찰 결과와 맞춤 계산(T102).
 *
 * 각 크기·종류는 Observation에만 있고 화면 글자로 쓰지 않는다.
 * 수학 값(각 크기, 읽은 값, 어림값, 발사 각)은 모두 정수 도이고 비교도 정수로 한다.
 */
import type { Observation } from '../../../../core/engine-sdk';
import type { AngleEntry, AngleSetting, AngleState } from './types';

export type AngleKind = 'acute' | 'right' | 'obtuse' | 'straight';

export type ProtractorScale = 'outer' | 'inner';

export interface Alignment {
  readonly aligned: boolean;
  readonly scale: ProtractorScale | null;
}

export function angleKindOf(degrees: number): AngleKind {
  if (degrees < 90) return 'acute';
  if (degrees === 90) return 'right';
  if (degrees < 180) return 'obtuse';
  return 'straight';
}

export function normalizeDegrees(value: number): number {
  const rounded = Math.round(value);
  return ((rounded % 360) + 360) % 360;
}

/** 두 변의 화면 방향(0 = 오른쪽, 반시계). */
export function armDirections(angle: AngleSetting): readonly [number, number] {
  return [normalizeDegrees(angle.base), normalizeDegrees(angle.base + angle.degrees)];
}

function insideHalf(direction: number, rotation: number): boolean {
  return normalizeDegrees(direction - rotation) <= 180;
}

/**
 * 각도기 맞춤. 한 변이 `rotation`(바깥 트랙) 또는 `rotation+180`(안쪽 트랙)과
 * 정확히 같고 다른 변이 판이 덮는 반쪽에 있어야 한다. 정수 비교다.
 *
 * 두 변이 모두 0° 선과 만나는 180° 각에서는 첫 변이 무엇과 맞는지로 트랙을 고른다
 * (카드의 `base` 30·`rotation` 30 → outer, `rotation` 210 → inner).
 */
export function alignmentFor(angle: AngleSetting, rotation: number): Alignment {
  const rot = normalizeDegrees(rotation);
  const innerZero = normalizeDegrees(rot + 180);
  const [first, second] = armDirections(angle);
  if (first === rot && insideHalf(second, rot)) return { aligned: true, scale: 'outer' };
  if (first === innerZero && insideHalf(second, rot)) return { aligned: true, scale: 'inner' };
  if (second === rot && insideHalf(first, rot)) return { aligned: true, scale: 'outer' };
  if (second === innerZero && insideHalf(first, rot)) return { aligned: true, scale: 'inner' };
  return { aligned: false, scale: null };
}

/** 발사대는 첫 변(바닥선)만 있으므로 0° 선과의 관계만 본다. */
export function launcherAlignment(rotation: number): Alignment {
  const rot = normalizeDegrees(rotation);
  if (rot === 0) return { aligned: true, scale: 'outer' };
  if (rot === 180) return { aligned: true, scale: 'inner' };
  return { aligned: false, scale: null };
}

export function currentAngle(state: AngleState): AngleSetting {
  const fallback: AngleSetting = { id: 'a1', degrees: 50, base: 0, arms: [1, 1] };
  return state.settings.angles[state.current] ?? state.settings.angles[0] ?? fallback;
}

export function alignmentOf(state: AngleState): Alignment {
  const on = state.protractor.on;
  if (on === null) return { aligned: false, scale: null };
  if (on === 'launcher') return launcherAlignment(state.protractor.rotation);
  const angle = state.settings.angles.find((candidate) => candidate.id === on);
  if (!angle) return { aligned: false, scale: null };
  return alignmentFor(angle, state.protractor.rotation);
}

function entryOf(state: AngleState, id: string): AngleEntry {
  return state.entries[id] ?? { estimate: null, reading: null, readingAligned: null };
}

function errorOf(value: number | null, degrees: number): number | null {
  return value === null ? null : Math.abs(value - degrees);
}

export function observeAngle(state: AngleState): Observation {
  const alignment = alignmentOf(state);
  return {
    mode: state.mode,
    current: state.current,
    protractorOn: state.protractor.on,
    protractorAligned: alignment.aligned,
    activeScale: alignment.scale,
    angles: state.settings.angles.map((angle) => {
      const entry = entryOf(state, angle.id);
      const flipped =
        entry.reading !== null && angle.degrees !== 90 && entry.reading === 180 - angle.degrees;
      return {
        id: angle.id,
        degrees: angle.degrees,
        kind: angleKindOf(angle.degrees),
        estimate: entry.estimate,
        reading: entry.reading,
        readingError: errorOf(entry.reading, angle.degrees),
        estimateError: errorOf(entry.estimate, angle.degrees),
        readingAligned: entry.readingAligned,
        flipped,
      };
    }),
    puzzle: state.puzzle
      ? {
          targetAngle: state.settings.puzzle?.targetAngle ?? 0,
          estimate: state.puzzle.estimate,
          fired: [...state.puzzle.fired],
          hit:
            state.puzzle.fired.length > 0 &&
            state.puzzle.fired[state.puzzle.fired.length - 1] ===
              (state.settings.puzzle?.targetAngle ?? 0),
        }
      : null,
  };
}
