/**
 * 힌트 ②: 점 ㄱ이 간 자리 추적. 학생이 칠한 모양 위에 방향에 따른 ㄱ·ㄴ·ㄷ 자리만
 * 쓰고, 시작 도형의 ㄱ과 학생이 고른 ㄱ을 점선으로 잇는다. 결과 도형은 그리지 않는다.
 */
import { CanvasAlignedOverlay } from '../../../core/engine-sdk';
import type { OverlayProps } from '../../../core/engine-sdk';
import { boardRect, ptXY } from '../layout';
import { applyMovesUpTo } from '../moves';
import { currentFigure } from '../modes/slide-flip-turn';
import { orientationOf, orientPoints } from '../orientation';
import { transformStrings as S } from '../strings.ko';
import type { TransformConfig, TransformState } from '../types';
import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../types';

function minCell(cells: readonly (readonly [number, number])[]): readonly [number, number] {
  let i = Number.POSITIVE_INFINITY;
  let j = Number.POSITIVE_INFINITY;
  for (const cell of cells) {
    if (cell[0] < i) i = cell[0];
    if (cell[1] < j) j = cell[1];
  }
  return [Number.isFinite(i) ? i : 0, Number.isFinite(j) ? j : 0];
}

export function PointTrackOverlay({ state }: OverlayProps<TransformConfig, TransformState>) {
  if (state.mode !== 'slide-flip-turn' && state.mode !== 'predict') return null;
  const rect = boardRect(state.settings.grid);

  if (state.mode === 'slide-flip-turn') {
    if (state.moves.length === 0) return null;
    const before = applyMovesUpTo(state.start, state.moves, state.moves.length - 1);
    const after = currentFigure(state);
    const from = before.outline[0];
    const to = after.outline[0];
    if (!from || !to) return null;
    const a = ptXY(rect, from);
    const b = ptXY(rect, to);
    return (
      <CanvasAlignedOverlay
        testId="point-track"
        canvasSelector={'svg[data-testid="transform-canvas"]'}
        logicalWidth={LOGICAL_WIDTH}
        logicalHeight={LOGICAL_HEIGHT}
      >
        <line
          x1={a.x}
          y1={a.y}
          x2={b.x}
          y2={b.y}
          stroke="#2f9e6b"
          strokeWidth={3}
          strokeDasharray="9 7"
        />
        <circle cx={a.x} cy={a.y} r={16} fill="none" stroke="#2f9e6b" strokeWidth={3} />
        <circle cx={b.x} cy={b.y} r={20} fill="none" stroke="#1f7a4d" strokeWidth={5} />
        <text
          x={a.x + 24}
          y={a.y - 14}
          fontSize={24}
          fontWeight={800}
          fill="#1f7a4d"
          stroke="#ffffff"
          strokeWidth={4}
          paintOrder="stroke"
        >
          {S.vertexLabels[0]}
        </text>
      </CanvasAlignedOverlay>
    );
  }

  const orientation = orientationOf(state.start.cells, state.painted);
  if (orientation === null) return null;
  const at = minCell(state.painted);
  const points = orientPoints(state.start.outline, orientation, at);
  const startA = state.start.outline[0];
  const paintedA = points[0];
  if (!startA || !paintedA) return null;
  const a = ptXY(rect, startA);
  const b = ptXY(rect, paintedA);
  return (
    <CanvasAlignedOverlay
      testId="point-track"
      canvasSelector={'svg[data-testid="transform-canvas"]'}
      logicalWidth={LOGICAL_WIDTH}
      logicalHeight={LOGICAL_HEIGHT}
    >
      <line
        x1={a.x}
        y1={a.y}
        x2={b.x}
        y2={b.y}
        stroke="#2f9e6b"
        strokeWidth={3}
        strokeDasharray="9 7"
      />
      <circle cx={a.x} cy={a.y} r={15} fill="none" stroke="#2f9e6b" strokeWidth={3} />
      {points.map((point, index) => {
        const xy = ptXY(rect, point);
        return (
          <g key={`label-${index}`}>
            <circle cx={xy.x} cy={xy.y} r={index === 0 ? 6 : 4} fill="#1f7a4d" />
            <text
              x={xy.x + 20}
              y={xy.y - 12}
              fontSize={24}
              fontWeight={800}
              fill="#1f7a4d"
              stroke="#ffffff"
              strokeWidth={4}
              paintOrder="stroke"
            >
              {S.vertexLabels[index] ?? ''}
            </text>
          </g>
        );
      })}
    </CanvasAlignedOverlay>
  );
}
