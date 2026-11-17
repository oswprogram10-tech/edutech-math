/**
 * E12 `lathe` 모드 predicate · 이벤트 생성(순수 함수).
 *
 * 모든 predicate는 `lathe` 관찰에서만 참이 될 수 있다. 잘못된 인자는 false다.
 */
import type {
  EngineEvent,
  EnginePredicate,
  JsonValue,
  Observation,
} from '../../../core/engine-sdk';
import type { LatheState } from '../types';
import {
  isLatheEdge,
  isLathePlane,
  isLatheProfile,
  isLatheSolid,
  type SectionShape,
} from './profiles';

function isRecord(value: JsonValue | undefined): value is Readonly<Record<string, JsonValue>> {
  return (
    value !== null && value !== undefined && typeof value === 'object' && !Array.isArray(value)
  );
}

function isLathe(observation: Observation): boolean {
  return observation['mode'] === 'lathe';
}

const SECTION_SHAPES: readonly SectionShape[] = [
  'circle',
  'rectangle',
  'isosceles-triangle',
  'rhombus',
  'point',
];

/** `solidIs`는 prism-pyramid에도 있다. `events.ts`가 관찰의 `mode`로 나눠 부른다. */
export const latheSolidIs: EnginePredicate = (observation, args) => {
  if (!isLathe(observation) || !isRecord(args)) return false;
  const kind = args['kind'];
  if (!isLatheSolid(kind)) return false;
  return observation['solid'] === kind;
};

export const lathePredicates: Readonly<Record<string, EnginePredicate>> = {
  profileAttached: (observation, args) => {
    if (!isLathe(observation) || !isRecord(args)) return false;
    const { profile, edge } = args;
    if (!isLatheProfile(profile)) return false;
    if (edge !== undefined && !isLatheEdge(edge)) return false;
    if (observation['profile'] !== profile || observation['edge'] === null) return false;
    return edge === undefined || observation['edge'] === edge;
  },

  latheComplete: (observation) => isLathe(observation) && observation['complete'] === true,

  sectionIs: (observation, args) => {
    if (!isLathe(observation) || !isRecord(args)) return false;
    const shape = args['shape'];
    if (typeof shape !== 'string' || !SECTION_SHAPES.some((s) => s === shape)) return false;
    return observation['section'] === shape;
  },

  laserPlaneIs: (observation, args) => {
    if (!isLathe(observation) || !isRecord(args)) return false;
    const plane = args['plane'];
    if (!isLathePlane(plane)) return false;
    const laser = observation['laser'];
    return isRecord(laser) && laser['plane'] === plane;
  },
};

export function emitLathe(prev: LatheState, next: LatheState): EngineEvent[] {
  if (prev === next) return [];
  const events: EngineEvent[] = [];

  if (next.profile !== prev.profile && next.profile !== null) {
    events.push({ name: 'profile-picked', payload: { profile: next.profile } });
  }
  if (next.edge !== prev.edge && next.edge !== null && next.profile !== null) {
    events.push({ name: 'edge-attached', payload: { profile: next.profile, edge: next.edge } });
  }
  // 각도 이벤트는 같은 도형·변에서 손잡이로 돌렸을 때만 낸다(붙이기·비우기에서 0이 되는 것은 제외).
  if (next.angle !== prev.angle && next.profile === prev.profile && next.edge === prev.edge) {
    events.push({
      name: 'angle-changed',
      payload: { angle: next.angle, complete: next.angle === 360 },
    });
  }
  const laser = next.laser;
  if (
    laser !== null &&
    (prev.laser === null || prev.laser.plane !== laser.plane || prev.laser.t !== laser.t)
  ) {
    events.push({ name: 'laser-set', payload: { plane: laser.plane, t: laser.t } });
  }
  return events;
}
