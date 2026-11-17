/** E12 `lathe` 모드 Observation 생성(순수 함수). */
import type { JsonValue, Observation } from '../../../core/engine-sdk';
import type { LatheState } from '../types';
import { sectionOf } from './profiles';
import { isComplete, solidOfState } from './reduce';

export function observeLathe(state: LatheState): Observation {
  const solid = solidOfState(state);
  const complete = isComplete(state);
  const laser = state.laser && complete ? { plane: state.laser.plane, t: state.laser.t } : null;
  const section = solid && laser ? sectionOf(solid, laser.plane, laser.t) : null;
  const obs: Record<string, JsonValue> = {
    mode: state.mode,
    profile: state.profile,
    edge: state.edge,
    angle: state.angle,
    complete,
    solid,
    laser,
    section,
  };
  return obs;
}
