/**
 * 자석 스냅. 옮길 조각의 꼭짓점과 실루엣 part·다른 조각 꼭짓점의 정확한 차이로
 * 후보 자리를 만들고, 화면 거리만 number로 비교한다. 후보가 없으면 1/8칸으로
 * 반올림한다.
 */
import { Rational } from '../../../core/math';
import { kindDefinition, orientedBase } from './pieces';
import type { PieceSet } from './pieces';
import { silhouettePartPolygons } from './silhouettes';
import { sAdd, sFromJson, sSub, sToJson, sToNumber } from './surd';
import type { SurdD } from './surd';
import type { SPoint } from './surd-geometry';
import type { SPointJson, TangramState } from './types';

function verticesFor(
  set: PieceSet,
  kind: string,
  at: SPoint,
  rot: number,
  flip: boolean,
  step: number,
): SPoint[] {
  const def = kindDefinition(set, kind);
  if (!def) return [];
  return orientedBase(def, rot, flip, step).map((point) => ({
    x: sAdd(point.x, at.x),
    y: sAdd(point.y, at.y),
  }));
}

function distance(a: SPoint, b: SPoint): number {
  const dx = sToNumber(sSub(a.x, b.x));
  const dy = sToNumber(sSub(a.y, b.y));
  return Math.hypot(dx, dy);
}

function rawPoint(rawAt: { readonly x: number; readonly y: number }, d: SurdD): SPoint {
  return {
    x: sFromJson([String(rawAt.x), '0'], d),
    y: sFromJson([String(rawAt.y), '0'], d),
  };
}

function rounded(value: number, d: SurdD) {
  const eighths = Math.round(value * 8);
  return sFromJson([Rational.of(eighths, 8).toString(), '0'], d);
}

export function snapPiece(
  state: TangramState,
  pieceId: string,
  rawAt: { readonly x: number; readonly y: number },
  toleranceUnits: number,
): SPointJson {
  const piece = state.pieces.find((candidate) => candidate.id === pieceId);
  const d = state.settings.d;
  if (!piece) {
    return [sToJson(rounded(rawAt.x, d)), sToJson(rounded(rawAt.y, d))];
  }
  let currentAt: SPoint;
  try {
    currentAt = { x: sFromJson(piece.at[0], d), y: sFromJson(piece.at[1], d) };
  } catch {
    return [sToJson(rounded(rawAt.x, d)), sToJson(rounded(rawAt.y, d))];
  }
  const moving = verticesFor(
    state.settings.pieceSet,
    piece.kind,
    currentAt,
    piece.rot,
    piece.flip,
    state.settings.rotationStep,
  );
  const raw = rawPoint(rawAt, d);

  const targets: SPoint[] = [];
  for (const polygon of silhouettePartPolygons(
    state.settings.pieceSet,
    state.settings.silhouette,
  )) {
    targets.push(...polygon);
  }
  for (const other of state.pieces) {
    if (other.id === pieceId) continue;
    let at: SPoint;
    try {
      at = { x: sFromJson(other.at[0], d), y: sFromJson(other.at[1], d) };
    } catch {
      continue;
    }
    targets.push(
      ...verticesFor(
        state.settings.pieceSet,
        other.kind,
        at,
        other.rot,
        other.flip,
        state.settings.rotationStep,
      ),
    );
  }

  let best: SPoint | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const vertex of moving) {
    for (const target of targets) {
      const candidate = {
        x: sAdd(currentAt.x, sSub(target.x, vertex.x)),
        y: sAdd(currentAt.y, sSub(target.y, vertex.y)),
      };
      const candidateDistance = distance(candidate, raw);
      if (candidateDistance <= toleranceUnits && candidateDistance < bestDistance) {
        best = candidate;
        bestDistance = candidateDistance;
      }
    }
  }

  if (best) return [sToJson(best.x), sToJson(best.y)];
  return [sToJson(rounded(rawAt.x, d)), sToJson(rounded(rawAt.y, d))];
}

/** 화면 px 눈금을 격자 단위로. 포인터는 화면 배율 × 40으로 나눈다. */
export function snapToleranceUnits(snapTolerancePx: number, scale: number): number {
  const cell = 40;
  return snapTolerancePx / Math.max(1, scale * cell);
}

/** 테스트·키보드용 0.3칸. */
export const KEYBOARD_SNAP_TOLERANCE = 0.3;
