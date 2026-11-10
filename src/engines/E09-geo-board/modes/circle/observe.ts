/**
 * circle 모드의 관찰 결과(T102).
 *
 * - 반지름 길이²는 `dist2`로 정확히 계산해 문자열로 남긴다.
 * - 현이 중심을 지나는지는 `pointOnSegment`로 정확히 판정한다.
 * - 컴퍼스·그린 원·무늬는 반 칸 단위 정수를 0.5 단위 `Rational` 문자열로 바꿔 남긴다.
 * - `chord.throughCenter`와 `patternMatched`는 Observation에만 두고 화면 글자로 쓰지 않는다
 *   (단, `snapDiameter`일 때 "지름" 이름표는 학생 조작의 결과로 그린다).
 */
import type { Observation } from '../../../../core/engine-sdk';
import { dist2, gp, pointOnSegment, Rational } from '../../../../core/math';
import type { GPoint } from '../../../../core/math';
import { circlePoint } from '../../rational-turns';
import type { CirclePattern, CircleSettings, CircleState } from './types';

export function mainRadius(settings: CircleSettings): number {
  return settings.radius ?? settings.ropeLength;
}

export function circleCenter(settings: CircleSettings): GPoint {
  return gp(settings.stake[0], settings.stake[1]);
}

export function circleRadiusVector(settings: CircleSettings): GPoint {
  return gp(mainRadius(settings), 0);
}

/** 원 위의 `pos`(0~47). 정확한 유리 좌표. */
export function pointAt(settings: CircleSettings, pos: number): GPoint {
  return circlePoint(circleCenter(settings), circleRadiusVector(settings), pos);
}

/** 반지름 길이². 정확히 r²다. */
export function radiusLength2(settings: CircleSettings, pos: number): string {
  return dist2(circleCenter(settings), pointAt(settings, pos)).toString();
}

export function chordThroughCenter(state: CircleState): boolean {
  if (!state.chord) return false;
  const [first, second] = state.chord;
  return pointOnSegment(
    circleCenter(state.settings),
    pointAt(state.settings, first),
    pointAt(state.settings, second),
  );
}

export function chordLength2(state: CircleState): string | null {
  if (!state.chord) return null;
  const [first, second] = state.chord;
  return dist2(pointAt(state.settings, first), pointAt(state.settings, second)).toString();
}

function coverageOf(list: readonly number[]): number {
  return Math.floor((list.length * 100) / 72);
}

function coverageRecord(state: CircleState): Record<string, number> {
  const result: Record<string, number> = {};
  for (const length of state.settings.ropeLengths) {
    result[String(length)] = coverageOf(state.traces[String(length)] ?? []);
  }
  const current = String(state.ropeLength);
  if (result[current] === undefined) result[current] = 0;
  return result;
}

export function halfString(value: number): string {
  return Rational.of(value, 2).toString();
}

export function circleMatches(
  circle: { readonly center: readonly [number, number]; readonly radius: number },
  pattern: CirclePattern,
): boolean {
  return (
    circle.center[0] === pattern.center[0] &&
    circle.center[1] === pattern.center[1] &&
    circle.radius === pattern.radius
  );
}

export function patternMatched(state: CircleState): number[] {
  const result: number[] = [];
  state.settings.targetPattern.forEach((pattern, index) => {
    if (state.circles.some((circle) => circleMatches(circle, pattern))) result.push(index + 1);
  });
  return result;
}

export function observeCircle(state: CircleState): Observation {
  const radii = state.radii.map((pos) => ({
    pos,
    length2: radiusLength2(state.settings, pos),
  }));
  const chord = state.chord
    ? { length2: chordLength2(state) ?? '0', throughCenter: chordThroughCenter(state) }
    : null;
  return {
    mode: state.mode,
    tool: state.tool,
    ropeLength: state.ropeLength,
    traces: Object.fromEntries(
      Object.entries(state.traces).map(([key, value]) => [key, [...value]]),
    ),
    coverage: coverageRecord(state),
    radii,
    distinctRadii: radii.length,
    measuredCount: state.measured.length,
    chord,
    compassWidth: halfString(state.compass.width),
    circles: state.circles.map((circle) => ({
      id: circle.id,
      center: [halfString(circle.center[0]), halfString(circle.center[1])],
      radius: halfString(circle.radius),
    })),
    patternTotal: state.settings.targetPattern.length,
    patternMatched: patternMatched(state),
  };
}
