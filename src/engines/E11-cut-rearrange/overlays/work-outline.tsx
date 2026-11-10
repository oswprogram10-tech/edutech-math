/**
 * 힌트 ② `work-outline`: 학생이 지금 만든 것(조각 테두리, 모은 각 조각)을
 * 굵은 점선으로 다시 그린다. 상태와 상관없이 항상 svg를 그린다.
 */
import { CanvasAlignedOverlay } from '../../../core/engine-sdk';
import type { OverlayProps } from '../../../core/engine-sdk';
import { cornerSector, cornerTriangle } from '../angle-gather/fan';
import {
  boardPoint,
  boardPoints,
  gatherCenterPoint,
  pegScreen,
  pointsAttribute,
  sectorTriangle,
} from '../layout';
import { cutStrings as S } from '../strings.ko';
import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../types';
import type { CutConfig, CutState } from '../types';

const ORANGE = '#e8872e';
const GATHER_PIECE_RADIUS = 112;

export function WorkOutlineOverlay({ state }: OverlayProps<CutConfig, CutState>) {
  const shapes: string[] = [];
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
      <title>{S.overlays.workOutline}</title>
    </CanvasAlignedOverlay>
  );
}
