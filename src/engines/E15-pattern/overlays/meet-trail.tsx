/**
 * 힌트 ② meet-trail (MC-LCM-AS-PRODUCT).
 *
 * 판 아래 띠에 0부터 max(예측, 돌린 칸)까지 두 줄 눈금을 그린다. 윗줄은 왼쪽 바퀴의 톱니 수마다
 * 동그라미, 아랫줄은 오른쪽 바퀴의 톱니 수마다 네모를 찍고, 두 줄이 겹치는 칸에는 굵은 세로선과
 * 마름모를 그린다(색만으로 구분하지 않는다). 겹침 표시는 명세 ②("겹쳐 빛남")가 허용한다.
 * 눈금은 판에 보이도록 최대 칸(maxSteps)까지만 그린다.
 */
import { CanvasAlignedOverlay } from '../../../core/engine-sdk';
import type { OverlayProps } from '../../../core/engine-sdk';
import { isMeeting } from '../gears';
import { gearsLayout } from '../gears-layout';
import { patternStrings as S } from '../strings.ko';
import type { PatternConfig, PatternState } from '../types';
import { GEARS_CANVAS, gearsOf } from './helpers';

const INK = '#1d2330';

export function MeetTrailOverlay({ state }: OverlayProps<PatternConfig, PatternState>) {
  const gears = gearsOf(state);
  if (!gears) return null;
  const { settings } = gears;
  const layout = gearsLayout(settings);
  const predicted = gears.prediction === null ? 0 : Number(gears.prediction);
  const last = Math.min(settings.maxSteps, Math.max(1, predicted, gears.steps));
  const x = (n: number) => layout.bandX0 + (n / last) * (layout.bandX1 - layout.bandX0);
  const top = layout.rowAY - 14;
  const bottom = layout.rowBY + 12;
  const ticks = Array.from({ length: last + 1 }, (_, n) => n);

  return (
    <CanvasAlignedOverlay
      testId="meet-trail"
      canvasSelector={GEARS_CANVAS}
      logicalWidth={layout.width}
      logicalHeight={layout.height}
    >
      <g aria-label={S.overlay.meetTrailLabel}>
        <text
          x={4}
          y={layout.rowAY}
          fontSize={12}
          fontWeight={700}
          fill={INK}
          dominantBaseline="central"
        >
          {S.overlay.meetTrailLeft}
        </text>
        <text
          x={4}
          y={layout.rowBY}
          fontSize={12}
          fontWeight={700}
          fill={INK}
          dominantBaseline="central"
        >
          {S.overlay.meetTrailRight}
        </text>
        <line
          x1={x(0)}
          x2={x(last)}
          y1={layout.rowAY}
          y2={layout.rowAY}
          stroke="#9aa6bd"
          strokeWidth={1}
        />
        <line
          x1={x(0)}
          x2={x(last)}
          y1={layout.rowBY}
          y2={layout.rowBY}
          stroke="#9aa6bd"
          strokeWidth={1}
        />
        {ticks.map((n) => {
          const onA = n % settings.teethA === 0;
          const onB = n % settings.teethB === 0;
          const both = n > 0 && isMeeting(settings, n);
          return (
            <g key={n} data-testid={both ? 'meet-trail-meet' : undefined} data-step={n}>
              {both ? (
                <>
                  <line x1={x(n)} x2={x(n)} y1={top} y2={bottom} stroke={INK} strokeWidth={3} />
                  <polygon
                    points={`${x(n)},${top - 9} ${x(n) + 6},${top - 3} ${x(n)},${top + 3} ${x(n) - 6},${top - 3}`}
                    fill="#ffd23f"
                    stroke={INK}
                    strokeWidth={1.5}
                  />
                </>
              ) : null}
              {onA ? (
                <circle
                  cx={x(n)}
                  cy={layout.rowAY}
                  r={4}
                  fill="#1d4fa8"
                  data-testid="meet-trail-a"
                />
              ) : null}
              {onB ? (
                <rect
                  x={x(n) - 3.5}
                  y={layout.rowBY - 3.5}
                  width={7}
                  height={7}
                  fill="#1f6b3a"
                  data-testid="meet-trail-b"
                />
              ) : null}
            </g>
          );
        })}
        <text
          x={x(0)}
          y={layout.rowBY + 22}
          fontSize={12}
          fontWeight={700}
          fill={INK}
          textAnchor="middle"
        >
          0
        </text>
        <text
          x={x(last)}
          y={layout.rowBY + 22}
          fontSize={12}
          fontWeight={700}
          fill={INK}
          textAnchor="middle"
        >
          {last}
        </text>
      </g>
    </CanvasAlignedOverlay>
  );
}
