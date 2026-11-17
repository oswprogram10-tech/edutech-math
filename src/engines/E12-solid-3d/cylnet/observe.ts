/** E12 `cylinder-net` Observation 생성(순수 함수). 수는 `Rational`의 소수 문자열이다. */
import type { JsonValue, Observation } from '../../../core/engine-sdk';
import type { CylinderNetState } from '../types';
import { halves, measureNet, parsePi, ROLL_FULL, tenths, type NetMeasure } from './model';

export function measureState(state: CylinderNetState): NetMeasure {
  const { settings } = state;
  return measureNet(
    {
      width: tenths(state.widthTenths),
      radius: halves(state.pieceRadiusHalves),
      height: halves(state.pieceHeightHalves),
    },
    {
      radius: halves(settings.radiusHalves),
      height: halves(settings.heightHalves),
      pi: parsePi(settings.pi),
    },
  );
}

export function observeCylinderNet(state: CylinderNetState): Observation {
  const { settings } = state;
  const measure = measureState(state);
  const obs: Record<string, JsonValue> = {
    mode: state.mode,
    radius: halves(settings.radiusHalves).toDecimalString(),
    height: halves(settings.heightHalves).toDecimalString(),
    pi: settings.pi,
    step: state.step,
    rollEighths: state.rollEighths,
    rolledFull: state.rollEighths === ROLL_FULL,
    net: {
      width: measure.width.toDecimalString(),
      radius: measure.radius.toDecimalString(),
      height: measure.height.toDecimalString(),
    },
    widthFits: measure.widthFits,
    radiusMatches: measure.radiusMatches,
    heightMatches: measure.heightMatches,
    valid: measure.valid,
    folded: state.folded,
    seam: measure.seam,
  };
  return obs;
}
