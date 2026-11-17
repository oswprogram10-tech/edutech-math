/**
 * E12 `prism-pyramid` 모드 Observation 생성(순수 함수).
 *
 * `trueCount`·`tableCorrect`는 판정용 엔진 계산값이다. 학생 화면에는 쓰지 않는다.
 */
import type { JsonValue, Observation } from '../../../core/engine-sdk';
import type { PrismState } from '../types';
import { buildPrismModel, prismKind, trueCounts, visiblePrismFaces } from './geometry';

export function observePrism(state: PrismState): Observation {
  const kind = prismKind({ n: state.sides, height: state.height, top: state.top });
  const model = buildPrismModel(
    { n: state.sides, height: state.height, top: state.top },
    state.settings.orientation,
  );
  const counts = trueCounts(kind, state.sides);
  const trueCount: JsonValue = counts
    ? { face: counts.faces, edge: counts.edges, vertex: counts.vertices }
    : null;

  return {
    mode: state.mode,
    sides: state.sides,
    height: state.height,
    top: state.top,
    kind,
    orientation: state.settings.orientation,
    view: { yaw: state.view.yaw, pitch: state.view.pitch },
    xray: state.xray,
    xrayUsed: state.xrayUsed,
    apexPlayed: state.apexPlayed,
    visibleFaces: [...visiblePrismFaces(model, state.view)],
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
    trueCount,
    table: state.table.map((r) => ({
      kind: r.kind,
      n: r.n,
      faces: r.faces,
      edges: r.edges,
      vertices: r.vertices,
    })),
    tableCorrect: state.table.map((r) => {
      const rowCounts = trueCounts(r.kind, r.n);
      return (
        rowCounts !== null &&
        r.faces === rowCounts.faces &&
        r.edges === rowCounts.edges &&
        r.vertices === rowCounts.vertices
      );
    }),
  };
}
