/**
 * 힌트 ② sum-tower (MC-MEAN-SUM-ONLY). 모든 블록을 한 기둥으로 쌓은 탑을 판 오른쪽에 그리고
 * "모두 합친 기둥" 이름표를 단다. 그 옆에 기둥 수만큼 빈 자리 테두리를 그린다(높이도 숫자도 없다).
 */
import { CanvasAlignedOverlay } from '../../../core/engine-sdk';
import type { OverlayProps } from '../../../core/engine-sdk';
import { LEVEL, levelGeometry } from '../layout';
import { E19_STRINGS as S } from '../strings.ko';
import { CANVAS_SELECTOR, LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../types';
import type { ChanceConfig, ChanceState } from '../types';

const INK = '#1d2330';
const SLOT = { x: 848, w: 14, h: 56, gap: 4 } as const;

export function SumTowerOverlay({ state }: OverlayProps<ChanceConfig, ChanceState>) {
  if (state.mode !== 'leveling' || state.error !== null) return null;
  const total = state.heights.reduce((a, b) => a + b, 0);
  const { blockH } = levelGeometry(state);
  const unit = Math.min(blockH, (LEVEL.baseY - 150) / Math.max(1, total));
  return (
    <CanvasAlignedOverlay
      testId="overlay-sum-tower"
      canvasSelector={CANVAS_SELECTOR}
      logicalWidth={LOGICAL_WIDTH}
      logicalHeight={LOGICAL_HEIGHT}
    >
      <g data-part="tower" data-blocks={total}>
        {Array.from({ length: total }, (_, k) => (
          <rect
            key={k}
            data-part="tower-block"
            x={LEVEL.towerX}
            y={LEVEL.baseY - (k + 1) * unit}
            width={LEVEL.towerW}
            height={unit}
            fill="#9cc3ff"
            stroke="#2f6fde"
            strokeWidth={unit >= 5 ? 2 : 0.5}
          />
        ))}
      </g>
      <line
        x1={LEVEL.towerX - 10}
        y1={LEVEL.baseY}
        x2={SLOT.x + state.heights.length * (SLOT.w + SLOT.gap) + 6}
        y2={LEVEL.baseY}
        stroke={INK}
        strokeWidth={4}
      />
      <text
        data-part="tower-label"
        x={LEVEL.towerX}
        y={104}
        fontSize={22}
        fontWeight={800}
        fill={INK}
        stroke="#fffdf6"
        strokeWidth={5}
        paintOrder="stroke"
      >
        {S.leveling.overlay.sumTower}
      </text>
      {state.heights.map((_, i) => (
        <rect
          key={i}
          data-part="empty-slot"
          x={SLOT.x + i * (SLOT.w + SLOT.gap)}
          y={LEVEL.baseY - SLOT.h}
          width={SLOT.w}
          height={SLOT.h}
          rx={3}
          fill="none"
          stroke={INK}
          strokeWidth={2}
          strokeDasharray="5 4"
        />
      ))}
    </CanvasAlignedOverlay>
  );
}
