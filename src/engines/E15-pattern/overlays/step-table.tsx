/**
 * 힌트 ② step-table (MC-PATTERN-RECURSIVE-ONLY).
 *
 * 판 아래 띠에 "단계 | 1 2 3 …", "블록 수 | 1 4 9 …" 표를 그린다. 보여 준 단계(stepsShown)까지만
 * 쓰고 학생이 쌓을 단계(workStep)의 값은 쓰지 않는다(정답 노출 금지).
 * 블록 수가 앞 단계 값에 더해지는 모양이 아니라 단계 번호와 어떤 관계인지 눈으로 찾게 한다.
 */
import { CanvasAlignedOverlay } from '../../../core/engine-sdk';
import type { OverlayProps } from '../../../core/engine-sdk';
import { stepTotal } from '../calc';
import { TABLE_CELL_W, TABLE_LABEL_W, TABLE_ROW_H, calcLayout } from '../calc-layout';
import { patternStrings as S } from '../strings.ko';
import type { PatternConfig, PatternState } from '../types';
import { CALC_CANVAS, calcOf } from './helpers';

const ROW_H = TABLE_ROW_H;

export function StepTableOverlay({ state }: OverlayProps<PatternConfig, PatternState>) {
  const calc = calcOf(state);
  if (!calc || calc.settings.error !== null) return null;
  const layout = calcLayout(calc.settings);
  const band = layout.band;
  if (band === null) return null;
  const steps = Array.from({ length: calc.settings.stepsShown }, (_, index) => index + 1);
  const width = TABLE_LABEL_W + steps.length * TABLE_CELL_W;
  const top = band.y;

  return (
    <CanvasAlignedOverlay
      testId="step-table"
      canvasSelector={CALC_CANVAS}
      logicalWidth={layout.width}
      logicalHeight={layout.height}
    >
      <g data-testid="step-table-grid">
        <rect
          x={band.x}
          y={top}
          width={width}
          height={ROW_H * 2}
          rx={8}
          fill="#ffffff"
          fillOpacity={0.96}
          stroke="#2f6fde"
          strokeWidth={3}
        />
        <path
          d={`M${band.x} ${top + ROW_H} H${band.x + width} M${band.x + TABLE_LABEL_W} ${top} V${top + ROW_H * 2}`}
          stroke="#2f6fde"
          strokeWidth={2}
          fill="none"
        />
        <text
          x={band.x + 10}
          y={top + ROW_H / 2}
          fontSize={16}
          fontWeight={800}
          fill="#1d2330"
          dominantBaseline="central"
        >
          {S.overlay.stepTableSteps}
        </text>
        <text
          x={band.x + 10}
          y={top + ROW_H * 1.5}
          fontSize={16}
          fontWeight={800}
          fill="#1d2330"
          dominantBaseline="central"
        >
          {S.overlay.stepTableBlocks}
        </text>
        {steps.map((step, index) => {
          const cx = band.x + TABLE_LABEL_W + index * TABLE_CELL_W + TABLE_CELL_W / 2;
          return (
            <g key={step} data-testid="step-table-col" data-step={step}>
              <text
                x={cx}
                y={top + ROW_H / 2}
                fontSize={18}
                fontWeight={700}
                textAnchor="middle"
                dominantBaseline="central"
                fill="#1d2330"
              >
                {step}
              </text>
              <text
                x={cx}
                y={top + ROW_H * 1.5}
                fontSize={18}
                fontWeight={700}
                textAnchor="middle"
                dominantBaseline="central"
                fill="#1d2330"
              >
                {stepTotal(calc.settings.pattern, step).toString()}
              </text>
            </g>
          );
        })}
      </g>
    </CanvasAlignedOverlay>
  );
}
