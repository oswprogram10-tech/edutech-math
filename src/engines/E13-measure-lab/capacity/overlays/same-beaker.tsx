/**
 * 힌트 ② same-beaker (들이, MC-MEAS-CAPACITY-SHAPE). 두 그릇 아래에 같은 모양 비커 윤곽 둘을 점선으로 그리고
 * "같은 모양 비커에 옮겨 담으면?" 글을 단다. 수위는 그리지 않는다.
 */
import { CanvasAlignedOverlay } from '../../../../core/engine-sdk';
import type { OverlayProps } from '../../../../core/engine-sdk';
import { E13_STRINGS as S } from '../../strings.ko';
import { BOARD, GUIDE, baseY, boardHeight, containerGeo, labelBottom, r2 } from '../layout';
import { CAPACITY_CANVAS_SELECTOR } from '../types';
import type { CapacityConfig, CapacityState } from '../types';

const INK = '#1d2330';
const ORANGE = '#e8872e';

export function SameBeakerOverlay({ state }: OverlayProps<CapacityConfig, CapacityState>) {
  if (state.error !== null || state.containers.length < 2) return null;
  const height = boardHeight(state);
  const top = baseY(state) + GUIDE.gap;
  const mid =
    state.containers.reduce((sum, _c, i) => sum + containerGeo(state, i).cx, 0) /
    state.containers.length;
  return (
    <CanvasAlignedOverlay
      testId="overlay-same-beaker"
      canvasSelector={CAPACITY_CANVAS_SELECTOR}
      logicalWidth={BOARD.width}
      logicalHeight={height}
    >
      {state.containers.map((container, index) => {
        const { cx } = containerGeo(state, index);
        const y1 = labelBottom(state) + 6;
        const y2 = top - 6;
        return (
          <g key={container.id} data-part="beaker-guide" data-id={container.id}>
            <rect
              data-part="beaker-outline"
              x={r2(cx - GUIDE.size / 2)}
              y={r2(top)}
              width={GUIDE.size}
              height={GUIDE.size}
              fill="none"
              stroke={ORANGE}
              strokeWidth={5}
              strokeDasharray="12 8"
            />
            <line
              data-part="arrow"
              x1={r2(cx)}
              y1={r2(y1)}
              x2={r2(cx)}
              y2={r2(y2 - 10)}
              stroke={ORANGE}
              strokeWidth={6}
            />
            <polygon
              points={`${r2(cx - 12)},${r2(y2 - 14)} ${r2(cx + 12)},${r2(y2 - 14)} ${r2(cx)},${r2(y2)}`}
              fill={ORANGE}
            />
          </g>
        );
      })}
      <text
        data-part="label"
        x={r2(mid)}
        y={r2(top + GUIDE.size / 2)}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={22}
        fontWeight={800}
        fill={INK}
        stroke="#fffdf6"
        strokeWidth={5}
        paintOrder="stroke"
      >
        <tspan x={r2(mid)} dy="-0.7em">
          {S.overlay.sameBeaker[0]}
        </tspan>
        <tspan x={r2(mid)} dy="1.4em">
          {S.overlay.sameBeaker[1]}
        </tspan>
      </text>
    </CanvasAlignedOverlay>
  );
}
