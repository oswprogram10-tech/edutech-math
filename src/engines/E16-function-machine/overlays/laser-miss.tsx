/**
 * 힌트 ② laser-miss (MC-PATTERN-ONE-PAIR, rule-shooter 격자).
 * 빗나간 보석마다 그 ○에서 학생 식의 레이저 점까지 세로 점선을 긋고 두 □ 값을 글자로 쓴다.
 * 맞힌 보석에는 ✓ 고리만 그린다. 보석의 □(과제 자료)와 학생 식의 □만 쓰므로 정답 노출이 아니다.
 */
import { CanvasAlignedOverlay } from '../../../core/engine-sdk';
import type { OverlayProps } from '../../../core/engine-sdk';
import { Rational } from '../../../core/math';
import { gemHits, gemsOf, missInfo, pointX, pointY, shooterLayout } from '../shooter';
import { functionStrings as S } from '../strings.ko';
import type { FunctionConfig, FunctionState } from '../types';
import { SHOOTER_CANVAS, overlayData } from './helpers';

export function LaserMissOverlay({ state }: OverlayProps<FunctionConfig, FunctionState>) {
  if (state.mode !== 'rule-shooter' || state.settings.look !== 'grid') return null;
  const { rel } = overlayData(state);
  if (rel === null) return null;
  const layout = shooterLayout(state.settings.grid);
  const gems = gemsOf(state.settings);
  const hits = gemHits(rel, gems);
  const yTop = Rational.of(state.settings.grid.yMax);

  return (
    <CanvasAlignedOverlay
      testId="laser-miss"
      canvasSelector={SHOOTER_CANVAS}
      logicalWidth={layout.width}
      logicalHeight={layout.height}
    >
      <text
        x={layout.left + 24}
        y={16}
        fontSize={14}
        fontWeight={800}
        fill="#a02820"
        dominantBaseline="central"
      >
        {S.overlay.laserMiss}
      </text>
      {gems.map((gem, index) => {
        const cx = pointX(layout, gem.x);
        const cy = pointY(layout, gem.y);
        if (hits[index]) {
          return (
            <circle
              key={index}
              data-testid="laser-miss-hit"
              data-gem={index}
              cx={cx}
              cy={cy}
              r={21}
              fill="none"
              stroke="#2e7d46"
              strokeWidth={4}
            />
          );
        }
        const info = missInfo(rel, gem);
        const inside =
          info.ruleY !== null && !info.ruleY.isNegative() && info.ruleY.compareTo(yTop) <= 0;
        const my = info.ruleY !== null && inside ? pointY(layout, info.ruleY) : null;
        const text =
          info.ruleY === null
            ? S.overlay.laserMissNone(info.gemY.toString())
            : S.overlay.laserMissGem(info.gemY.toString(), info.ruleY.toString());
        const labelY = my === null ? cy - 22 : (cy + my) / 2;
        const rightSide = cx + 16 + 150 > layout.width;
        return (
          <g key={index} data-testid="laser-miss-gap" data-gem={index}>
            {my === null ? null : (
              <>
                <line
                  x1={cx}
                  y1={cy}
                  x2={cx}
                  y2={my}
                  stroke="#c0392b"
                  strokeWidth={3}
                  strokeDasharray="6 5"
                />
                <circle cx={cx} cy={my} r={7} fill="none" stroke="#c0392b" strokeWidth={3} />
                <path
                  d={`M${cx - 11} ${my} L${cx + 11} ${my} M${cx} ${my - 11} L${cx} ${my + 11}`}
                  stroke="#c0392b"
                  strokeWidth={3}
                  strokeLinecap="round"
                />
              </>
            )}
            <text
              x={rightSide ? cx - 16 : cx + 16}
              y={labelY}
              fontSize={13}
              fontWeight={800}
              textAnchor={rightSide ? 'end' : 'start'}
              dominantBaseline="central"
              fill="#a02820"
              stroke="#fbfaf6"
              strokeWidth={4}
              paintOrder="stroke"
              data-testid="laser-miss-text"
            >
              {text}
            </text>
          </g>
        );
      })}
    </CanvasAlignedOverlay>
  );
}
