/**
 * angle-gather의 관찰 결과. 각도 숫자는 `showSum`이 켜지고 학생이 다 모았을 때만
 * `gatheredSum`으로 드러난다. 기본은 null이다.
 */
import type { Observation } from '../../../core/engine-sdk';
import { congruentPolygons, gp } from '../../../core/math';
import type { GPoint } from '../../../core/math';
import { fanState, fanTrialSum } from './fan';
import type { AngleGatherState, AngleTrial, Peg } from './types';

function pegText(peg: Peg): string {
  return `${peg[0]},${peg[1]}`;
}

function pointsOf(vertices: readonly Peg[]): GPoint[] {
  return vertices.map((peg) => gp(peg[0], peg[1]));
}

function distinctCount(trials: readonly AngleTrial[]): number {
  const groups: GPoint[][] = [];
  for (const trial of trials) {
    const points = pointsOf(trial.vertices);
    if (!groups.some((existing) => congruentPolygons(existing, points))) groups.push(points);
  }
  return groups.length;
}

export function observeAngleGather(state: AngleGatherState): Observation {
  const fan = fanState(state);
  const cut = state.phase === 'cut';
  return {
    mode: state.mode,
    shape: state.settings.shape,
    phase: state.phase,
    vertices: state.vertices.map(pegText),
    cornerCount: cut ? state.vertices.length : 0,
    gatheredCount: cut ? state.corners.filter((corner) => corner.gathered).length : 0,
    fan,
    gatheredSum: fanTrialSum(state),
    trials: state.trials.map((trial) => ({
      vertices: trial.vertices.map(pegText),
      sum: trial.sum,
    })),
    distinctTrials: distinctCount(state.trials),
  };
}
