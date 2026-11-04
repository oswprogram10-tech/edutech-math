/**
 * T049 `divide-measure`: 나누는 수 막대(자)로 나뉨수를 재기.
 *
 * - 위 줄에 놓은 자를 번호 도장과 함께 그린다(학생이 놓은 수를 세는 표시).
 * - 남은 길이가 자보다 짧으면 부분 자를 한 번만 놓는다. 값 글자는 쓰지 않는다.
 * - Space·Enter = 놓기, Backspace = 들기.
 */
import { useMemo } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import { denominatorNumber, lcm, screenLength } from '../fractions';
import { measureBoard } from '../layout';
import { measureSummary } from '../reduce-divide-measure';
import { fractionModelStrings as S } from '../strings.ko';
import type { DivideMeasureState } from '../types';
import { BLUE, CanvasFrame, INK, MUTED, ToolbarButton } from './shared';
import type { ModeProps } from './shared';
import styles from '../View.module.css';

export function DivideMeasureView({
  state,
  dispatch,
  readOnly,
  targetSize,
}: ModeProps<DivideMeasureState>) {
  const summary = useMemo(() => measureSummary(state), [state]);
  const board = useMemo(
    () => measureBoard(summary.dividend, summary.divisor, state.rulersLaid),
    [summary.dividend, summary.divisor, state.rulersLaid],
  );
  const dividendDen = denominatorNumber(summary.dividend) ?? 1;
  const divisorDen = denominatorNumber(summary.divisor) ?? 1;
  const rulerWidth = Math.max(1, board.unit * screenLength(summary.divisor));
  const partial = summary.partial === null ? 0 : screenLength(summary.partial);
  const measuredLength = summary.divisor.mul(summary.measured);
  const unitCount = Math.max(1, Math.ceil(screenLength(summary.dividend)));

  const canLay = !readOnly && state.partial === null && !summary.remaining.isZero();
  const canLift = !readOnly && (state.rulersLaid > 0 || state.partial !== null);
  const commonTicks =
    state.showRemainderFractionOfDivisor && state.partial !== null
      ? Math.min(60, Math.max(divisorDen, lcm(dividendDen, divisorDen)))
      : 0;

  const onKeyDown = (event: ReactKeyboardEvent<SVGSVGElement>) => {
    if (event.key === 'Backspace') {
      if (!canLift) return;
      event.preventDefault();
      dispatch({ type: 'lift-ruler' });
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      if (!canLay) return;
      event.preventDefault();
      dispatch({ type: 'lay-ruler' });
    }
  };

  const dividendTicks: number[] = [];
  for (let unit = 0; unit <= unitCount; unit += 1) {
    for (let step = 0; step < dividendDen; step += 1) {
      const x = board.originX + (unit + step / dividendDen) * board.unit;
      if (x <= board.dividendBar.x + board.dividendBar.width + 0.5) dividendTicks.push(x);
    }
  }
  const rulerTicks: number[] = [];
  // 자는 1/분모 간격으로 나눈다(2/3 → 1/3 칸 2개). 자 폭을 분모 수로 나누지 않는다.
  const rulerEnd = board.rulerBar.x + board.rulerBar.width + 0.5;
  for (let step = 0; ; step += 1) {
    const x = board.rulerBar.x + (step / divisorDen) * board.unit;
    if (x > rulerEnd) break;
    rulerTicks.push(x);
  }

  return (
    <div className={styles.wrap} data-target-size={targetSize}>
      <div className={styles.toolbar} role="toolbar" aria-label={S.canvasLabel}>
        <ToolbarButton onClick={() => dispatch({ type: 'lay-ruler' })} disabled={!canLay}>
          {S.layRuler}
        </ToolbarButton>
        <ToolbarButton onClick={() => dispatch({ type: 'lift-ruler' })} disabled={!canLift}>
          {S.liftRuler}
        </ToolbarButton>
        <ToolbarButton onClick={() => dispatch({ type: 'clear-rulers' })} disabled={!canLift}>
          {S.clearRulers}
        </ToolbarButton>
      </div>

      <CanvasFrame label={S.measureCanvasLabel} tabIndex={0} onKeyDown={onKeyDown}>
        <rect
          x={board.originX}
          y={board.dividendBar.y}
          width={Math.max(1, board.unit * screenLength(measuredLength))}
          height={board.dividendBar.height}
          fill={BLUE}
          opacity={0.12}
        />

        {Array.from({ length: board.units + 1 }, (_, whole) => {
          const x = board.originX + whole * board.unit;
          return (
            <g key={`whole-tick-${whole}`} pointerEvents="none">
              <line
                x1={x}
                y1={board.dividendBar.y - 18}
                x2={x}
                y2={board.dividendBar.y}
                stroke={INK}
                strokeWidth={2}
                opacity={0.75}
              />
              <text
                x={x}
                y={board.dividendBar.y - 26}
                textAnchor="middle"
                fontSize={18}
                fill={INK}
                data-testid="measure-whole-label"
              >
                {whole}
              </text>
            </g>
          );
        })}
        {dividendTicks.map((x, index) => (
          <line
            key={`dividend-tick-${index}`}
            x1={x}
            y1={board.dividendBar.y}
            x2={x}
            y2={board.dividendBar.y + board.dividendBar.height}
            stroke={MUTED}
            strokeWidth={index % dividendDen === 0 ? 2 : 1}
            opacity={index % dividendDen === 0 ? 0.8 : 0.45}
            data-testid="dividend-part-line"
          />
        ))}
        <rect
          x={board.dividendBar.x}
          y={board.dividendBar.y}
          width={board.dividendBar.width}
          height={board.dividendBar.height}
          fill="none"
          stroke={INK}
          strokeWidth={3}
        />
        <text
          x={board.dividendBar.x}
          y={board.dividendBar.y + board.dividendBar.height + 26}
          fontSize={20}
          fill={INK}
        >
          나뉨수
        </text>

        {rulerTicks.map((x, index) => (
          <line
            key={`ruler-tick-${index}`}
            x1={x}
            y1={board.rulerBar.y}
            x2={x}
            y2={board.rulerBar.y + board.rulerBar.height}
            stroke={MUTED}
            strokeWidth={1.5}
            data-testid="ruler-part-line"
          />
        ))}
        <rect
          x={board.rulerBar.x}
          y={board.rulerBar.y}
          width={board.rulerBar.width}
          height={board.rulerBar.height}
          fill="#eef2fa"
          stroke={BLUE}
          strokeWidth={3}
        />
        <text x={board.rulerBar.x} y={board.rulerBar.y - 12} fontSize={20} fill={INK}>
          자
        </text>

        {Array.from({ length: state.rulersLaid }, (_, index) => (
          <g key={`laid-ruler-${index}`}>
            <rect
              x={board.originX + index * rulerWidth}
              y={board.rulersY}
              width={rulerWidth}
              height={board.rulersHeight}
              rx={6}
              fill="#dbe7ff"
              stroke={BLUE}
              strokeWidth={2.5}
              data-testid="measure-ruler"
              data-index={index}
            />
            <text
              x={board.originX + (index + 0.5) * rulerWidth}
              y={board.rulersY + board.rulersHeight / 2 + 7}
              textAnchor="middle"
              fontSize={20}
              fontWeight={700}
              fill={INK}
              aria-hidden="true"
            >
              {index + 1}
            </text>
          </g>
        ))}

        {state.partial !== null ? (
          <g>
            <rect
              x={board.originX + state.rulersLaid * rulerWidth}
              y={board.rulersY}
              width={rulerWidth}
              height={board.rulersHeight}
              rx={6}
              fill="none"
              stroke={BLUE}
              strokeWidth={2.5}
              strokeDasharray="9 7"
              data-testid="measure-partial-ruler"
            />
            <rect
              x={board.originX + state.rulersLaid * rulerWidth}
              y={board.rulersY}
              width={rulerWidth * partial}
              height={board.rulersHeight}
              rx={6}
              fill="#9dc0ff"
              opacity={0.65}
            />
            {commonTicks > 0
              ? Array.from({ length: commonTicks - 1 }, (_, index) => {
                  const x =
                    board.originX +
                    state.rulersLaid * rulerWidth +
                    ((index + 1) / commonTicks) * rulerWidth;
                  if (x > board.originX + state.rulersLaid * rulerWidth + rulerWidth * partial) {
                    return null;
                  }
                  return (
                    <line
                      key={`partial-tick-${index}`}
                      x1={x}
                      y1={board.rulersY}
                      x2={x}
                      y2={board.rulersY + board.rulersHeight}
                      stroke={BLUE}
                      strokeWidth={1}
                      opacity={0.55}
                    />
                  );
                })
              : null}
          </g>
        ) : null}
      </CanvasFrame>

      <p className={styles.instructions}>
        {readOnly ? S.readOnlyHint : S.instructions.divideMeasure} {S.measureHint}{' '}
        {S.measureKeyboardHint}
      </p>
    </div>
  );
}
