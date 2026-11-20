/**
 * E19 simulate 판(논리 1000×600 SVG). 시행 횟수 칸을 나란히 두고 칸마다 색별 상대도수 막대를 같은 축척(0~1)으로 그린다.
 * 막대 위에 "n번 중 k번"을 쓰고, showExpected이면 장치 가능성 위치에 가로 점선을 긋는다(학생이 만든 장치라 정답 노출이 아니다).
 * 아래 줄(y 480~)은 힌트 ② 오버레이 자리라 비워 둔다. 돌리기 단추는 48px 터치 타깃을 지키려고 조작 칸(HTML)에 있다.
 */
import type { CSSProperties } from 'react';
import { probabilitiesOf } from './device';
import { SIM, toNumber } from './layout';
import { Rational } from '../../core/math';
import { OUTCOME_INK, fillOf, outcomeName, usePatternPrefix } from './outcome';
import { PatternDefs } from './PatternDefs';
import { E19_STRINGS as S } from './strings.ko';
import { LOGICAL_HEIGHT, LOGICAL_WIDTH, OUTCOMES } from './types';
import type { SimulateState } from './types';

const INK = OUTCOME_INK;
interface Props {
  readonly state: SimulateState;
  readonly svgStyle: CSSProperties | undefined;
  readonly className: string | undefined;
}

export function SimulateBoard({ state, svgStyle, className }: Props) {
  const prefix = usePatternPrefix('si');
  const probabilities = probabilitiesOf(state.device);
  const n = state.batches.length;
  const colW = (SIM.right - SIM.left) / n;
  const slotW = colW / OUTCOMES.length;
  const chartH = SIM.baseY - SIM.topY;
  const fs = Math.max(11, Math.min(15, slotW / 5));

  return (
    <svg
      className={className}
      style={{ ...svgStyle, touchAction: 'manipulation' }}
      viewBox={`0 0 ${LOGICAL_WIDTH} ${LOGICAL_HEIGHT}`}
      role="group"
      aria-label={S.simulate.boardLabel}
      data-testid="chance-canvas"
      data-mode="simulate"
      data-runs={state.runs}
    >
      <PatternDefs prefix={prefix} />
      <rect width={LOGICAL_WIDTH} height={LOGICAL_HEIGHT} fill="#fbfcff" />
      {[0, 1, 2].map((k) => {
        const y = SIM.baseY - (chartH * k) / 2;
        return (
          <g key={k} data-part="axis" data-tick={k === 0 ? '0' : k === 1 ? '1/2' : '1'}>
            <line
              x1={SIM.left - 6}
              y1={y}
              x2={SIM.right}
              y2={y}
              stroke={k === 0 ? INK : '#d7deea'}
              strokeWidth={k === 0 ? 3 : 1.5}
            />
            <text
              x={SIM.left - 12}
              y={y + 6}
              textAnchor="end"
              fontSize={17}
              fontWeight={700}
              fill={INK}
            >
              {k === 0 ? '0' : k === 1 ? '1/2' : '1'}
            </text>
          </g>
        );
      })}
      <text x={12} y={SIM.topY - 28} fontSize={15} fontWeight={700} fill="#3d485c">
        {S.simulate.axisLabel}
      </text>
      {state.batches.map((batch, c) => {
        const x0 = SIM.left + colW * c;
        const result = state.results.find((r) => r.batch === batch);
        return (
          <g key={batch} data-part="column" data-batch={batch} data-run={result ? 'true' : 'false'}>
            {c > 0 ? (
              <line
                x1={x0}
                y1={SIM.topY - 20}
                x2={x0}
                y2={SIM.baseY + 50}
                stroke="#d7deea"
                strokeWidth={2}
              />
            ) : null}
            <text
              data-part="column-title"
              x={x0 + colW / 2}
              y={SIM.titleY}
              textAnchor="middle"
              fontSize={26}
              fontWeight={800}
              fill={INK}
            >
              {S.simulate.columnTitle(batch)}
            </text>
            {state.showExpected ? (
              <g data-part="legend">
                <line
                  x1={x0 + colW / 2 - 70}
                  y1={SIM.legendY}
                  x2={x0 + colW / 2 - 30}
                  y2={SIM.legendY}
                  stroke={INK}
                  strokeWidth={3}
                  strokeDasharray="2 5"
                  strokeLinecap="round"
                />
                <text
                  x={x0 + colW / 2 - 24}
                  y={SIM.legendY + 6}
                  fontSize={16}
                  fontWeight={700}
                  fill={INK}
                >
                  {S.simulate.expectedLabel}
                </text>
              </g>
            ) : null}
            {OUTCOMES.map((outcome, i) => {
              const sx = x0 + slotW * i;
              const cx = sx + slotW / 2;
              const barW = Math.min(44, slotW - 8);
              const count = result?.counts[outcome] ?? 0;
              const rel = result === undefined ? 0 : count / batch;
              const h = rel * chartH;
              const p = toNumber(Rational.parse(probabilities[outcome]));
              const py = SIM.baseY - p * chartH;
              return (
                <g key={outcome} data-part="bar-slot" data-outcome={outcome}>
                  {result !== undefined ? (
                    <>
                      <rect
                        data-part="bar"
                        data-count={count}
                        data-rel={rel.toFixed(4)}
                        x={cx - barW / 2}
                        y={SIM.baseY - h}
                        width={barW}
                        height={h}
                        fill={fillOf(prefix, outcome)}
                        stroke={INK}
                        strokeWidth={2}
                      />
                      <text
                        data-part="bar-count"
                        x={cx}
                        y={SIM.baseY - h - 22}
                        textAnchor="middle"
                        fontSize={fs}
                        fontWeight={700}
                        fill={INK}
                      >
                        {`${batch}번 중`}
                      </text>
                      <text
                        x={cx}
                        y={SIM.baseY - h - 6}
                        textAnchor="middle"
                        fontSize={fs}
                        fontWeight={800}
                        fill={INK}
                      >
                        {`${count}번`}
                      </text>
                    </>
                  ) : null}
                  {state.showExpected ? (
                    <line
                      data-part="expected"
                      data-outcome={outcome}
                      data-y={py.toFixed(2)}
                      x1={cx - barW / 2 - 6}
                      y1={py}
                      x2={cx + barW / 2 + 6}
                      y2={py}
                      stroke={INK}
                      strokeWidth={3}
                      strokeDasharray="2 5"
                      strokeLinecap="round"
                    />
                  ) : null}
                  <rect
                    x={cx - 9}
                    y={SIM.baseY + 8}
                    width={18}
                    height={18}
                    rx={4}
                    fill={fillOf(prefix, outcome)}
                    stroke={INK}
                    strokeWidth={1.5}
                  />
                  <text
                    x={cx}
                    y={SIM.baseY + 46}
                    textAnchor="middle"
                    fontSize={Math.min(16, slotW / 3)}
                    fontWeight={700}
                    fill={INK}
                  >
                    {outcomeName(outcome)}
                  </text>
                </g>
              );
            })}
            {result === undefined ? (
              <text
                data-part="not-run"
                x={x0 + colW / 2}
                y={SIM.topY + 40}
                textAnchor="middle"
                fontSize={20}
                fontWeight={700}
                fill="#7a8497"
              >
                {S.simulate.notRun}
              </text>
            ) : null}
          </g>
        );
      })}
    </svg>
  );
}
