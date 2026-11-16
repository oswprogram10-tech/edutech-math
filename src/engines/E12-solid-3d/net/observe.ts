/**
 * E12 `net-fold` 모드 Observation 생성(순수 함수).
 */
import type { JsonValue, Observation } from '../../../core/engine-sdk';
import type { NetFoldState } from '../types';
import { evaluateNet } from './geometry';

export function observeNet(state: NetFoldState): Observation {
  const { settings } = state;
  const evaluation = evaluateNet(state.faces, settings);
  const faces = state.faces.map((f) => [f.x, f.y, f.w, f.h, f.label]);
  const opposites: Record<string, JsonValue> = evaluation.valid ? { ...evaluation.opposites } : {};

  return {
    mode: state.mode,
    target: settings.target,
    dims: [settings.dims[0], settings.dims[1], settings.dims[2]],
    faces,
    faceCount: evaluation.faceCount,
    connected: evaluation.connected,
    folded: state.folded,
    overlapPairs: evaluation.overlapPairs,
    tornEdges: evaluation.tornEdges,
    outsideFaces: evaluation.outsideFaces,
    missingCount: evaluation.missingSlots.length,
    valid: evaluation.valid,
    netKey: evaluation.netKey,
    foundNets: [...state.foundNets],
    foundCount: state.foundNets.length,
    prediction: state.prediction,
    predictedBeforeFold: state.predictedBeforeFold,
    opposites,
    viewTurn: state.viewTurn,
  };
}
