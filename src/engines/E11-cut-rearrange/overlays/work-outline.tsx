/**
 * 힌트 ② `work-outline`: 학생이 지금 만든 것(조각·모은 각 조각)의 테두리만
 * 굵은 점선으로 다시 그린다. 실루엣 정답 자리·완성 직사각형은 그리지 않는다.
 */
import { CanvasAlignedOverlay } from '../../../core/engine-sdk';
import type { OverlayProps, Point } from '../../../core/engine-sdk';
import { cornerSector, cornerTriangle } from '../angle-gather/fan';
import { currentDivisions, isManual } from '../circle-sectors/reduce';
import { rowScale, SLOT_BASELINE, SLOT_X0, slotSectorPath } from '../circle-sectors/layout';
import {
  boardPoint,
  boardPoints,
  gatherCenterPoint,
  pegScreen,
  pointsAttribute,
  sectorTriangle,
} from '../layout';
import { cutStrings as S } from '../strings.ko';
import { TANGRAM_CELL, TANGRAM_ORIGIN } from '../tangram/pieces';
import { tangramPiecePolygons } from '../tangram/observe';
import { sToNumber } from '../tangram/surd';
import type { SPoint } from '../tangram/surd-geometry';
import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../types';
import type { CutConfig, CutState } from '../types';

const ORANGE = '#e8872e';
const GATHER_PIECE_RADIUS = 112;

function tangramScreen(point: SPoint): Point {
  return {
    x: TANGRAM_ORIGIN.x + sToNumber(point.x) * TANGRAM_CELL,
    y: TANGRAM_ORIGIN.y + sToNumber(point.y) * TANGRAM_CELL,
  };
}

export function WorkOutlineOverlay({ state }: OverlayProps<CutConfig, CutState>) {
  const shapes: string[] = [];
  let rowPaths: string[] = [];
  let rowTransform: string | undefined;
  let rowDivisions = 8;

  if (state.mode === 'angle-gather') {
    if (state.phase === 'shape') {
      shapes.push(pointsAttribute(state.vertices.map(pegScreen)));
    } else {
      for (const corner of state.corners) {
        const sector = cornerSector(state.vertices, corner.index, corner.turned);
        if (!sector) continue;
        const points = corner.gathered
          ? sectorTriangle(gatherCenterPoint(), sector.s, sector.e, GATHER_PIECE_RADIUS)
          : cornerTriangle(state.vertices, corner.index).map(boardPoint);
        shapes.push(pointsAttribute(points));
      }
    }
  } else if (state.mode === 'tangram') {
    for (const polygon of tangramPiecePolygons(state).values()) {
      if (polygon.length < 3) continue;
      shapes.push(pointsAttribute(polygon.map(tangramScreen)));
    }
  } else if (state.mode === 'circle-sectors') {
    const n = currentDivisions(state);
    const manual = isManual(state);
    rowDivisions = n;
    const scale = rowScale(n);
    rowTransform = `translate(${SLOT_X0} ${SLOT_BASELINE}) scale(${scale.toFixed(4)}) translate(${-SLOT_X0} ${-SLOT_BASELINE})`;
    if (manual) {
      state.slots.forEach((slot, index) => {
        if (slot) rowPaths.push(slotSectorPath(index, n, slot.arcUp));
      });
    } else if (state.autoArranged) {
      rowPaths = Array.from({ length: n }, (_, slot) => slotSectorPath(slot, n, slot % 2 === 0));
    }
  } else {
    for (const piece of state.pieces) {
      shapes.push(pointsAttribute(boardPoints(piece.vertices)));
    }
  }

  return (
    <CanvasAlignedOverlay
      testId="work-outline"
      canvasSelector={'svg[data-testid="cut-canvas"]'}
      logicalWidth={LOGICAL_WIDTH}
      logicalHeight={LOGICAL_HEIGHT}
    >
      <rect width={LOGICAL_WIDTH} height={LOGICAL_HEIGHT} fill="none" stroke="none" />
      {shapes.map((points, index) => (
        <polygon
          key={`work-outline-${index}`}
          points={points}
          fill="none"
          stroke={ORANGE}
          strokeWidth={7}
          strokeOpacity={0.75}
          strokeDasharray="14 8"
          strokeLinejoin="round"
          data-outline-piece={index}
        />
      ))}
      {rowPaths.length > 0 && rowTransform ? (
        <g transform={rowTransform}>
          {rowPaths.map((path, index) => (
            <path
              key={`work-outline-row-${index}`}
              d={path}
              fill="none"
              stroke={ORANGE}
              strokeWidth={7 / Math.max(rowScale(rowDivisions), 0.2)}
              strokeOpacity={0.75}
              strokeDasharray="14 8"
              strokeLinejoin="round"
              data-outline-piece={shapes.length + index}
            />
          ))}
        </g>
      ) : null}
      <title>{S.overlays.workOutline}</title>
    </CanvasAlignedOverlay>
  );
}
