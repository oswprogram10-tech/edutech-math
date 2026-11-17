/**
 * E12 `xray` 모드 Observation 생성(순수 함수).
 */
import type { JsonValue, Observation } from '../../../core/engine-sdk';
import type { XrayState } from '../types';
import { gradeSketch, visibleFaces } from './geometry';

export function observeXray(state: XrayState): Observation {
  const { settings } = state;
  const { w, d, h } = settings.solid;
  const visible = visibleFaces(state.view);
  const segments = state.segments.map(
    (s) => `${s.a[0]},${s.a[1]}-${s.b[0]},${s.b[1]}:${s.style === 'solid' ? 's' : 'd'}`,
  );
  const grade = settings.sketch ? gradeSketch(state.segments, w, d, h) : null;
  const sketchObs: JsonValue = grade
    ? {
        visibleMissing: grade.visibleMissing,
        hiddenMissing: grade.hiddenMissing,
        hiddenSolid: grade.hiddenSolid,
        visibleDashed: grade.visibleDashed,
        extra: grade.extra,
        complete: grade.complete,
      }
    : null;

  return {
    mode: state.mode,
    solid: { w, d, h },
    display: settings.display,
    view: { yaw: state.view.yaw, pitch: state.view.pitch },
    xray: state.xray,
    xrayUsed: state.xrayUsed,
    visibleFaces: [...visible],
    marked: {
      faces: [...state.marked.faces],
      edges: [...state.marked.edges],
      vertices: [...state.marked.vertices],
    },
    markedCount: {
      face: state.marked.faces.length,
      edge: state.marked.edges.length,
      vertex: state.marked.vertices.length,
    },
    queryFace: state.queryFace,
    segments,
    sketch: sketchObs,
  };
}
