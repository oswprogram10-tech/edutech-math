/**
 * 힌트 ② after-streak (MC-CHANCE-GAMBLER). 지금 장치로 10,000번(고정 seed)을 돌려서
 * "빨강이 5번 이어진 바로 다음" 결과만 모은 상대도수 막대와, 옆에 전체 상대도수 막대를 그린다.
 * 장치에 빨강이 없으면 그리지 않는다. 계산은 순수 함수 `afterStreakStats`다. spinner·simulate에서 쓴다.
 */
import { CanvasAlignedOverlay } from '../../../core/engine-sdk';
import type { OverlayProps } from '../../../core/engine-sdk';
import { OUTCOME_INK, fillOf, usePatternPrefix } from '../outcome';
import { PatternDefs } from '../PatternDefs';
import { E19_STRINGS as S } from '../strings.ko';
import { CANVAS_SELECTOR, LOGICAL_HEIGHT, LOGICAL_WIDTH, OUTCOMES } from '../types';
import type { ChanceConfig, ChanceState, OutcomeCounts } from '../types';
import { afterStreakStats } from './compute';

const BASE_Y = 586;
const MAX_H = 62;
const BAR_W = 34;
const GAP = 12;

export function AfterStreakOverlay({ state }: OverlayProps<ChanceConfig, ChanceState>) {
  const prefix = usePatternPrefix('ov-as');
  if ((state.mode !== 'spinner' && state.mode !== 'simulate') || state.error !== null) return null;
  const stats = afterStreakStats(state.device);
  if (stats === null) return null;

  const group = (key: string, x0: number, title: string, counts: OutcomeCounts, total: number) => (
    <g data-part={key}>
      <text
        data-part={`${key}-title`}
        x={x0}
        y={498}
        fontSize={16}
        fontWeight={800}
        fill={OUTCOME_INK}
      >
        {title}
      </text>
      {OUTCOMES.map((outcome, i) => {
        const rel = total === 0 ? 0 : counts[outcome] / total;
        return (
          <rect
            key={outcome}
            data-part="bar"
            data-outcome={outcome}
            data-rel={rel.toFixed(4)}
            x={x0 + i * (BAR_W + GAP)}
            y={BASE_Y - rel * MAX_H}
            width={BAR_W}
            height={rel * MAX_H}
            fill={fillOf(prefix, outcome)}
            stroke={OUTCOME_INK}
            strokeWidth={1.5}
          />
        );
      })}
      <line
        x1={x0 - 6}
        y1={BASE_Y}
        x2={x0 + 4 * (BAR_W + GAP)}
        y2={BASE_Y}
        stroke={OUTCOME_INK}
        strokeWidth={2}
      />
    </g>
  );

  return (
    <CanvasAlignedOverlay
      testId="overlay-after-streak"
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
      {stats.samples > 0 ? (
        <>
          {group('after', 60, S.overlay.afterStreak, stats.after, stats.samples)}
          <text data-part="samples" x={60} y={518} fontSize={15} fontWeight={700} fill="#3d485c">
            {S.overlay.samples(stats.samples)}
          </text>
        </>
      ) : (
        <text data-part="no-streak" x={60} y={540} fontSize={17} fontWeight={700} fill="#3d485c">
          {S.overlay.noStreak}
        </text>
      )}
      {group('whole', 560, S.overlay.whole, stats.whole, stats.trials)}
    </CanvasAlignedOverlay>
  );
}
