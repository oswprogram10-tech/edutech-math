/** 힌트 ②: 돌리기 중심 압정과 꼭짓점 궤적 호. 결과 자리·정답 도형은 그리지 않는다. */
import { CanvasAlignedOverlay } from '../../../core/engine-sdk';
import type { OverlayProps } from '../../../core/engine-sdk';
import { arcPath, boardRect, ptXY } from '../layout';
import { applyMovesUpTo } from '../moves';
import { currentFigure } from '../modes/slide-flip-turn';
import { currentPointShape, pinCenter } from '../modes/point-symmetry';
import { POLYGONS } from '../polygons';
import type { Move, Pt, TransformConfig, TransformState } from '../types';
import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../types';

function toNumber(value: { readonly n: bigint; readonly d: bigint }): number {
  return Number(value.n) / Number(value.d);
}

function screenPoint(rect: ReturnType<typeof boardRect>, x: number, y: number) {
  return { x: rect.x + x * rect.cell, y: rect.y + y * rect.cell };
}

function pin(cx: number, cy: number) {
  return (
    <g data-pin>
      <circle cx={cx} cy={cy} r={9} fill="#e8872e" stroke="#ffffff" strokeWidth={2} />
      <circle
        cx={cx}
        cy={cy}
        r={17}
        fill="none"
        stroke="#e8872e"
        strokeWidth={2}
        strokeOpacity={0.6}
      />
    </g>
  );
}

export function PinArcsOverlay({ state }: OverlayProps<TransformConfig, TransformState>) {
  if (state.mode === 'point-symmetry') {
    if (!state.pin || !state.turned) return null;
    const rect = boardRect(9);
    const center = pinCenter(state.pin);
    const centerXY = screenPoint(rect, toNumber(center.x), toNumber(center.y));
    const points = POLYGONS[currentPointShape(state)].points;
    return (
      <CanvasAlignedOverlay
        testId="pin-arcs"
        canvasSelector={'svg[data-testid="transform-canvas"]'}
        logicalWidth={LOGICAL_WIDTH}
        logicalHeight={LOGICAL_HEIGHT}
      >
        {points.map((point: Pt, index: number) => {
          const from = ptXY(rect, point);
          const to = screenPoint(
            rect,
            toNumber(center.x) * 2 - point[0],
            toNumber(center.y) * 2 - point[1],
          );
          const path = arcPath(centerXY, from, to, 180, 'cw');
          return path ? (
            <path
              key={`point-arc-${index}`}
              d={path}
              fill="none"
              stroke="#e8872e"
              strokeWidth={4}
              strokeLinecap="round"
            />
          ) : null;
        })}
        {pin(centerXY.x, centerXY.y)}
      </CanvasAlignedOverlay>
    );
  }

  if (state.mode === 'slide-flip-turn') {
    const last = state.moves[state.moves.length - 1];
    if (!last || last.kind !== 'turn' || state.settings.grid <= 0) return null;
    const rect = boardRect(state.settings.grid);
    const before = applyMovesUpTo(state.start, state.moves, state.moves.length - 1);
    const after = currentFigure(state);
    const center = ptXY(rect, last.center);
    return (
      <CanvasAlignedOverlay
        testId="pin-arcs"
        canvasSelector={'svg[data-testid="transform-canvas"]'}
        logicalWidth={LOGICAL_WIDTH}
        logicalHeight={LOGICAL_HEIGHT}
      >
        {before.outline.map((point, index) => {
          const next = after.outline[index];
          if (!next) return null;
          const path = arcPath(
            center,
            ptXY(rect, point),
            ptXY(rect, next),
            last.angle,
            last.direction,
          );
          return path ? (
            <path
              key={`arc-${index}`}
              d={path}
              fill="none"
              stroke="#e8872e"
              strokeWidth={4}
              strokeLinecap="round"
            />
          ) : null;
        })}
        {pin(center.x, center.y)}
      </CanvasAlignedOverlay>
    );
  }

  if (state.mode !== 'predict') return null;
  const turns: { readonly move: Extract<Move, { kind: 'turn' }>; readonly index: number }[] = [];
  state.operations.forEach((move, index) => {
    if (move.kind === 'turn') turns.push({ move, index });
  });
  const rect = boardRect(state.settings.grid);

  if (!state.confirmed) {
    // 확인 전에는 첫 움직임이 돌리기일 때만 중심과 궤도를 미리 보여 준다.
    const first = state.operations[0];
    if (!first || first.kind !== 'turn') return null;
    const center = ptXY(rect, first.center);
    const radii = new Set<string>();
    for (const point of state.start.outline) {
      const xy = ptXY(rect, point);
      radii.add(Math.hypot(xy.x - center.x, xy.y - center.y).toFixed(2));
    }
    return (
      <CanvasAlignedOverlay
        testId="pin-arcs"
        canvasSelector={'svg[data-testid="transform-canvas"]'}
        logicalWidth={LOGICAL_WIDTH}
        logicalHeight={LOGICAL_HEIGHT}
      >
        {[...radii].map((radius) => (
          <circle
            key={`orbit-${radius}`}
            data-orbit
            cx={center.x}
            cy={center.y}
            r={Number(radius)}
            fill="none"
            stroke="#e8872e"
            strokeWidth={3}
            strokeDasharray="10 8"
            strokeOpacity={0.85}
          />
        ))}
        {pin(center.x, center.y)}
      </CanvasAlignedOverlay>
    );
  }

  if (turns.length === 0) return null;

  return (
    <CanvasAlignedOverlay
      testId="pin-arcs"
      canvasSelector={'svg[data-testid="transform-canvas"]'}
      logicalWidth={LOGICAL_WIDTH}
      logicalHeight={LOGICAL_HEIGHT}
    >
      {turns.map(({ move, index }) => {
        const before = applyMovesUpTo(state.start, state.operations, index);
        const after = applyMovesUpTo(state.start, state.operations, index + 1);
        const turnCenter = ptXY(rect, move.center);
        return (
          <g key={`turn-${index}`}>
            {before.outline.map((point, vertex) => {
              const next = after.outline[vertex];
              if (!next) return null;
              const path = arcPath(
                turnCenter,
                ptXY(rect, point),
                ptXY(rect, next),
                move.angle,
                move.direction,
              );
              return path ? (
                <path
                  key={`arc-${index}-${vertex}`}
                  d={path}
                  fill="none"
                  stroke="#e8872e"
                  strokeWidth={4}
                  strokeLinecap="round"
                />
              ) : null;
            })}
            {pin(turnCenter.x, turnCenter.y)}
          </g>
        );
      })}
    </CanvasAlignedOverlay>
  );
}
