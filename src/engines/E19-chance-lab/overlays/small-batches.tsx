/**
 * 힌트 ② small-batches (MC-CHANCE-SMALL-SAMPLE). 지금 장치로 10번씩 5묶음(고정 seed 5개)을 돌린 결과 막대를 나란히 그린다.
 * 묶음마다 들쭉날쭉한 모습을 보게 한다. 계산은 순수 함수 `smallBatchCounts`다(본 판 상태를 바꾸지 않는다).
 * spinner·simulate에서 쓴다. 막대는 판 아래 줄(y 480~)에 그린다.
 */
import { CanvasAlignedOverlay } from '../../../core/engine-sdk';
import type { OverlayProps } from '../../../core/engine-sdk';
import { OUTCOME_INK, fillOf, usePatternPrefix } from '../outcome';
import { PatternDefs } from '../PatternDefs';
import { E19_STRINGS as S } from '../strings.ko';
import { CANVAS_SELECTOR, LOGICAL_HEIGHT, LOGICAL_WIDTH, OUTCOMES } from '../types';
import type { ChanceConfig, ChanceState } from '../types';
import { SMALL_BATCH_SIZE, smallBatchCounts } from './compute';

const BASE_Y = 586;
const MAX_H = 70;
const GROUP_X0 = 170;
const GROUP_W = 160;
const BAR_W = 28;

export function SmallBatchesOverlay({ state }: OverlayProps<ChanceConfig, ChanceState>) {
  const prefix = usePatternPrefix('ov-sb');
  if ((state.mode !== 'spinner' && state.mode !== 'simulate') || state.error !== null) return null;
  const groups = smallBatchCounts(state.device);
  return (
    <CanvasAlignedOverlay
      testId="overlay-small-batches"
      canvasSelector={CANVAS_SELECTOR}
      logicalWidth={LOGICAL_WIDTH}
      logicalHeight={LOGICAL_HEIGHT}
    >
      <PatternDefs prefix={prefix} />
      <rect
        x={8}
        y={478}
        width={LOGICAL_WIDTH - 16}
        height={LOGICAL_HEIGHT - 484}
        rx={10}
        fill="#ffffff"
        fillOpacity={0.94}
        stroke="#b7c2d8"
        strokeWidth={2}
      />
      <text data-part="title" x={22} y={540} fontSize={17} fontWeight={800} fill={OUTCOME_INK}>
        {S.overlay.smallBatches}
      </text>
      {groups.map((counts, g) => {
        const x0 = GROUP_X0 + g * GROUP_W;
        return (
          <g key={g} data-part="batch" data-index={g}>
            <text
              x={x0 + (BAR_W * 4 + 18) / 2}
              y={498}
              textAnchor="middle"
              fontSize={14}
              fontWeight={700}
              fill={OUTCOME_INK}
            >
              {S.overlay.batchLabel(g + 1)}
            </text>
            {OUTCOMES.map((outcome, i) => {
              const h = (counts[outcome] / SMALL_BATCH_SIZE) * MAX_H;
              return (
                <rect
                  key={outcome}
                  data-part="bar"
                  data-outcome={outcome}
                  data-count={counts[outcome]}
                  x={x0 + i * (BAR_W + 6)}
                  y={BASE_Y - h}
                  width={BAR_W}
                  height={h}
                  fill={fillOf(prefix, outcome)}
                  stroke={OUTCOME_INK}
                  strokeWidth={1.5}
                />
              );
            })}
            <line
              x1={x0 - 4}
              y1={BASE_Y}
              x2={x0 + BAR_W * 4 + 22}
              y2={BASE_Y}
              stroke={OUTCOME_INK}
              strokeWidth={2}
            />
          </g>
        );
      })}
    </CanvasAlignedOverlay>
  );
}
