/**
 * E12 `cylinder-net` predicate · 이벤트 생성(순수 함수).
 *
 * 모든 predicate는 `cylinder-net` 관찰에서만 참이 될 수 있다. 잘못된 인자는 false다.
 * `netValid`는 net-fold에도 있다. `events.ts`가 관찰의 `mode`로 나눠 부른다.
 */
import type {
  EngineEvent,
  EnginePredicate,
  JsonValue,
  Observation,
} from '../../../core/engine-sdk';
import { Rational } from '../../../core/math';
import type { CylinderNetState } from '../types';

function isRecord(value: JsonValue | undefined): value is Readonly<Record<string, JsonValue>> {
  return (
    value !== null && value !== undefined && typeof value === 'object' && !Array.isArray(value)
  );
}

function isCylinderNet(observation: Observation): boolean {
  return observation['mode'] === 'cylinder-net';
}

function readDecimal(value: JsonValue | undefined): Rational | null {
  if (typeof value !== 'string') return null;
  try {
    return Rational.parse(value);
  } catch {
    return null;
  }
}

/** `netValid`의 cylinder-net 판. */
export const cylinderNetValid: EnginePredicate = (observation) =>
  isCylinderNet(observation) && observation['valid'] === true;

export const cylinderNetPredicates: Readonly<Record<string, EnginePredicate>> = {
  rollComplete: (observation) => isCylinderNet(observation) && observation['rolledFull'] === true,

  netFoldedClosed: (observation) =>
    isCylinderNet(observation) && observation['folded'] === true && observation['valid'] === true,

  /** 옆면 가로가 `value`(소수 문자열)와 같은가. 오개념 감지용(예: 지름 4). */
  netWidthIs: (observation, args) => {
    if (!isCylinderNet(observation) || !isRecord(args)) return false;
    const want = readDecimal(args['value']);
    const net = observation['net'];
    if (want === null || !isRecord(net)) return false;
    const have = readDecimal(net['width']);
    return have !== null && have.equals(want);
  },
};

export function emitCylinderNet(prev: CylinderNetState, next: CylinderNetState): EngineEvent[] {
  if (prev === next) return [];
  const events: EngineEvent[] = [];

  if (next.rollEighths !== prev.rollEighths) {
    events.push({
      name: 'cyl-rolled',
      payload: { rollEighths: next.rollEighths, full: next.rollEighths === 8 },
    });
  }
  if (
    next.widthTenths !== prev.widthTenths ||
    next.pieceRadiusHalves !== prev.pieceRadiusHalves ||
    next.pieceHeightHalves !== prev.pieceHeightHalves
  ) {
    events.push({
      name: 'cyl-net-resized',
      payload: {
        widthTenths: next.widthTenths,
        radiusHalves: next.pieceRadiusHalves,
        heightHalves: next.pieceHeightHalves,
      },
    });
  }
  if (next.folded !== prev.folded) {
    events.push({ name: next.folded ? 'cyl-net-folded' : 'cyl-net-unfolded', payload: {} });
  }
  return events;
}
