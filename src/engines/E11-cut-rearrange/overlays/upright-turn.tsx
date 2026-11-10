/**
 * 힌트 ② `upright-turn`: 돌아간 조각마다 같은 중심에 기준 자세(rot 0)의
 * 점선 그림과 굽은 화살표를 그린다. 실루엣 정답 자리는 그리지 않는다.
 */
import { CanvasAlignedOverlay } from '../../../core/engine-sdk';
import type { OverlayProps, Point } from '../../../core/engine-sdk';
import { kindDefinition, orientedBase, TANGRAM_CELL, TANGRAM_ORIGIN } from '../tangram/pieces';
import { tangramPiecePolygons } from '../tangram/observe';
import { sAdd, sToNumber } from '../tangram/surd';
import type { SPoint } from '../tangram/surd-geometry';
import { sAverage } from '../tangram/surd-geometry';
import { cutStrings as S } from '../strings.ko';
import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../types';
import type { CutConfig, CutState } from '../types';

const ORANGE = '#e8872e';

function screenOf(point: SPoint): Point {
  return {
    x: TANGRAM_ORIGIN.x + sToNumber(point.x) * TANGRAM_CELL,
    y: TANGRAM_ORIGIN.y + sToNumber(point.y) * TANGRAM_CELL,
  };
}

function pointsAttribute(points: readonly Point[]): string {
  return points.map((point) => `${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(' ');
}

export function UprightTurnOverlay({ state }: OverlayProps<CutConfig, CutState>) {
  if (state.mode !== 'tangram') {
    return (
      <CanvasAlignedOverlay
        testId="upright-turn"
        canvasSelector={'svg[data-testid="cut-canvas"]'}
        logicalWidth={LOGICAL_WIDTH}
        logicalHeight={LOGICAL_HEIGHT}
      >
        <title>{S.overlays.uprightTurn}</title>
      </CanvasAlignedOverlay>
    );
  }

  const polygons = tangramPiecePolygons(state);
  const step = state.settings.rotationStep;
  const ghosts: { readonly points: string; readonly arrow: string }[] = [];

  for (const piece of state.pieces) {
    if (piece.rot === 0 && !piece.flip) continue;
    const polygon = polygons.get(piece.id);
    const definition = kindDefinition(state.settings.pieceSet, piece.kind);
    if (!polygon || polygon.length < 3 || !definition) continue;
    const center = sAverage(polygon);
    const base = orientedBase(definition, 0, piece.flip, step).map((point) => {
      const moved = { x: sAdd(point.x, center.x), y: sAdd(point.y, center.y) };
      return screenOf(moved);
    });
    if (base.length < 3) continue;
    const centerPoint = screenOf(center);
    const size =
      Math.max(
        ...base.map((point) => Math.hypot(point.x - centerPoint.x, point.y - centerPoint.y)),
      ) + 10;
    const start = { x: centerPoint.x + size * 0.7, y: centerPoint.y - size * 0.7 };
    const end = { x: centerPoint.x - size * 0.75, y: centerPoint.y + size * 0.55 };
    const arrow = `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${size.toFixed(2)} ${size.toFixed(2)} 0 1 1 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`;
    ghosts.push({ points: pointsAttribute(base), arrow });
  }

  return (
    <CanvasAlignedOverlay
      testId="upright-turn"
      canvasSelector={'svg[data-testid="cut-canvas"]'}
      logicalWidth={LOGICAL_WIDTH}
      logicalHeight={LOGICAL_HEIGHT}
    >
      <rect width={LOGICAL_WIDTH} height={LOGICAL_HEIGHT} fill="none" stroke="none" />
      {ghosts.map((ghost, index) => (
        <g key={`upright-${index}`} data-upright-piece={index}>
          <polygon
            points={ghost.points}
            fill="none"
            stroke={ORANGE}
            strokeWidth={4}
            strokeDasharray="11 7"
            strokeLinejoin="round"
          />
          <path
            d={ghost.arrow}
            fill="none"
            stroke={ORANGE}
            strokeWidth={3.5}
            strokeLinecap="round"
            markerEnd="url(#upright-arrow-head)"
          />
        </g>
      ))}
      <defs>
        <marker
          id="upright-arrow-head"
          markerWidth="8"
          markerHeight="8"
          refX="6"
          refY="4"
          orient="auto"
        >
          <path d="M 0 0 L 8 4 L 0 8 Z" fill={ORANGE} />
        </marker>
      </defs>
      <title>{S.overlays.uprightTurn}</title>
    </CanvasAlignedOverlay>
  );
}
