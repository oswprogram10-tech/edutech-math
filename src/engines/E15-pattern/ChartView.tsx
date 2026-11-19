/**
 * E15 hundred-chart 모드 화면: 백 수 배열표의 가린 칸 채우기·칸 고르기·칠하기.
 *
 * 가린 칸은 DOM에 칸 수가 없다(`data-cell`·`aria-label` 포함). 입력이 맞는지 틀린지는
 * 표시하지 않는다(`revealOnAnswer`는 받기만 하고 무시). `entriesCorrect`를 읽지 않는다.
 */
import { useId, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import { useRenderedSize } from '../../core/engine-sdk';
import type { EngineViewProps } from '../../core/engine-sdk';
import { CHART_CELL, chartLayout } from './layout';
import { patternStrings as S } from './strings.ko';
import { chartRangeOf } from './types';
import type { ChartState, PatternAction, PatternConfig } from './types';
import { inRange } from './chart';
import styles from './View.module.css';

type ChartViewProps = Omit<EngineViewProps<PatternConfig, ChartState, PatternAction>, 'state'> & {
  readonly state: ChartState;
};

/** 칸이 판에 맞춘 크기가 targetSize의 이 비율보다 작아지면 판 안에서 세로 스크롤한다. */
const SCROLL_BELOW = 0.85;

const DIGITS: readonly string[] = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];

export function ChartView({ state, dispatch, targetSize, readOnly = false }: ChartViewProps) {
  const { settings } = state;
  const range = chartRangeOf(settings);
  const layout = useMemo(() => chartLayout(settings), [settings]);
  const patternId = useId();
  const boardRef = useRef<HTMLDivElement>(null);
  const board = useRenderedSize(boardRef);
  const [cursorRaw, setCursor] = useState<number>(settings.center);
  // 그리지 않는 칸에 커서가 남지 않게 한다.
  const cursor = layout.cells.includes(cursorRaw)
    ? cursorRaw
    : layout.cells.includes(settings.center)
      ? settings.center
      : (layout.cells[0] ?? settings.from);
  const [live, setLive] = useState('');
  const hasHidden = state.hidden.length > 0;

  // 칸 크기. 판에 맞추되 targetSize의 85%보다 작아지면 칸을 targetSize로 두고 판 안에서 스크롤한다.
  let sizeStyle: { width: string; height: string } | undefined;
  let scroll = false;
  if (board.width > 0 && board.height > 0) {
    const fit = Math.min(board.width / layout.width, board.height / layout.height);
    const cellPx = fit * CHART_CELL;
    if (cellPx >= targetSize * SCROLL_BELOW) {
      sizeStyle = { width: `${layout.width * fit}px`, height: `${layout.height * fit}px` };
    } else {
      const scale = targetSize / CHART_CELL;
      sizeStyle = { width: `${layout.width * scale}px`, height: `${layout.height * scale}px` };
      scroll = true;
    }
  }

  const hiddenIndex = (cell: number) => state.hidden.indexOf(cell);
  const isHidden = (cell: number) => state.hidden.includes(cell);

  const act = (cell: number) => {
    if (readOnly) return;
    if (isHidden(cell)) {
      dispatch({ type: 'activate', cell });
    } else if (settings.select) {
      dispatch({ type: 'select-cell', cell });
    } else if (settings.paint) {
      dispatch({ type: 'toggle-paint', cell });
      setLive(state.painted.includes(cell) ? S.chart.unpainted : S.chart.painted);
    }
  };

  const describe = (cell: number): string =>
    isHidden(cell) ? S.chart.hiddenLabel : S.chart.cellLabel(cell);

  const moveCursor = (delta: number) => {
    const next = cursor + delta;
    if (!inRange(range, next) || !layout.cells.includes(next)) return;
    // 왼쪽·오른쪽 끝에서 줄을 넘어가지 않는다.
    if (
      Math.abs(delta) === 1 &&
      Math.floor((next - range.from) / 10) !== Math.floor((cursor - range.from) / 10)
    ) {
      return;
    }
    setCursor(next);
    setLive(describe(next));
  };

  const onKeyDown = (event: ReactKeyboardEvent<SVGSVGElement>) => {
    if (readOnly) return;
    const key = event.key;
    if (key === 'ArrowRight') {
      event.preventDefault();
      moveCursor(1);
    } else if (key === 'ArrowLeft') {
      event.preventDefault();
      moveCursor(-1);
    } else if (key === 'ArrowDown') {
      event.preventDefault();
      moveCursor(10);
    } else if (key === 'ArrowUp') {
      event.preventDefault();
      moveCursor(-10);
    } else if (key === 'Enter' || key === ' ') {
      event.preventDefault();
      act(cursor);
    } else if (/^[0-9]$/.test(key) && state.active !== null) {
      event.preventDefault();
      dispatch({ type: 'type-digit', digit: key });
    } else if (key === 'Backspace' && state.active !== null) {
      event.preventDefault();
      dispatch({ type: 'backspace' });
    } else if (key === 'Delete' && state.active !== null) {
      event.preventDefault();
      dispatch({ type: 'clear-entry' });
    } else if (key === 'Escape' && state.active !== null) {
      event.preventDefault();
      dispatch({ type: 'deactivate' });
    }
  };

  const instruction = hasHidden
    ? S.chart.instructions
    : settings.select
      ? S.chart.selectInstructions
      : settings.paint
        ? S.chart.paintInstructions
        : '';

  return (
    <div className={styles.wrap} data-target-size={targetSize} data-mode="hundred-chart">
      <div className={styles.stageRow}>
        <div
          ref={boardRef}
          className={styles.boardArea}
          data-scroll={scroll ? 'true' : 'false'}
          data-testid="chart-board"
        >
          <svg
            data-testid="chart-canvas"
            className={styles.chartSvg}
            style={sizeStyle ?? { aspectRatio: `${layout.width} / ${layout.height}` }}
            viewBox={`0 0 ${layout.width} ${layout.height}`}
            role="application"
            aria-label={S.chart.gridLabel}
            tabIndex={0}
            onKeyDown={onKeyDown}
          >
            <title>{S.chart.canvasLabel}</title>
            <defs>
              <pattern
                id={`${patternId}-dots`}
                width={12}
                height={12}
                patternUnits="userSpaceOnUse"
              >
                <rect width={12} height={12} fill="#cfe0ff" />
                <circle cx={6} cy={6} r={2.4} fill="#1d4fa8" />
              </pattern>
            </defs>
            {layout.cells.map((cell) => {
              const box = layout.boxes.get(cell);
              if (!box) return null;
              const hidden = isHidden(cell);
              const painted = state.painted.includes(cell);
              const selected = state.selected === cell;
              const active = state.active === cell;
              const entry = hidden ? state.entries[String(cell)] : undefined;
              const focused = cell === cursor;
              const common = {
                role: 'button' as const,
                style: { cursor: readOnly ? 'default' : 'pointer' },
                onClick: () => {
                  setCursor(cell);
                  act(cell);
                },
              };
              const stroke = active ? '#e8872e' : selected ? '#1d4fa8' : '#8b96ab';
              const strokeWidth = active || selected ? 6 : 2;
              const inner = (
                <>
                  <rect
                    x={box.x}
                    y={box.y}
                    width={box.size}
                    height={box.size}
                    fill={painted ? `url(#${patternId}-dots)` : hidden ? '#eaf6ec' : '#ffffff'}
                    stroke={stroke}
                    strokeWidth={strokeWidth}
                  />
                  {focused ? (
                    <rect
                      x={box.x + 4}
                      y={box.y + 4}
                      width={box.size - 8}
                      height={box.size - 8}
                      fill="none"
                      stroke="#e8872e"
                      strokeWidth={2}
                      strokeDasharray="5 4"
                      data-cursor="true"
                    />
                  ) : null}
                  {selected ? (
                    <circle cx={box.x + box.size - 9} cy={box.y + 9} r={5} fill="#1d4fa8" />
                  ) : null}
                </>
              );
              if (hidden) {
                return (
                  <g
                    key={`hidden-${cell}`}
                    data-hidden={hiddenIndex(cell)}
                    data-active={active ? 'true' : undefined}
                    aria-label={entry !== undefined ? S.chart.hiddenWithEntry : S.chart.hiddenLabel}
                    {...common}
                  >
                    {inner}
                    <path
                      d={`M${box.x + 30} ${box.y + 8} C${box.x + 50} ${box.y + 12} ${box.x + 52} ${box.y + 34} ${box.x + 30} ${box.y + 54} C${box.x + 8} ${box.y + 34} ${box.x + 10} ${box.y + 12} ${box.x + 30} ${box.y + 8} Z`}
                      fill="#7ccf8f"
                      stroke="#2e7d46"
                      strokeWidth={2}
                    />
                    <path
                      d={`M${box.x + 30} ${box.y + 14} L${box.x + 30} ${box.y + 50}`}
                      stroke="#2e7d46"
                      strokeWidth={2}
                      fill="none"
                    />
                    <text
                      x={box.x + box.size / 2}
                      y={box.y + box.size / 2}
                      fontSize={entry !== undefined ? (entry.length >= 3 ? 22 : 26) : 28}
                      fontWeight={800}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fill="#1d2330"
                      stroke="#ffffff"
                      strokeWidth={4}
                      paintOrder="stroke"
                    >
                      {entry ?? '?'}
                    </text>
                  </g>
                );
              }
              return (
                <g
                  key={`cell-${cell}`}
                  data-cell={cell}
                  data-painted={painted ? 'true' : undefined}
                  data-selected={selected ? 'true' : undefined}
                  aria-label={S.chart.cellLabel(cell)}
                  {...common}
                >
                  {inner}
                  <text
                    x={box.x + box.size / 2}
                    y={box.y + box.size / 2}
                    fontSize={cell >= 100 ? 21 : 24}
                    fontWeight={700}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fill="#1d2330"
                    stroke={painted ? '#ffffff' : 'none'}
                    strokeWidth={painted ? 4 : 0}
                    paintOrder="stroke"
                  >
                    {cell}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        <div className={styles.sideStack}>
          {instruction !== '' ? <p className={styles.instructions}>{instruction}</p> : null}
          {hasHidden ? (
            <div
              className={styles.pad}
              role="group"
              aria-label={S.chart.pad}
              data-testid="chart-pad"
            >
              {DIGITS.map((digit) => (
                <button
                  key={digit}
                  type="button"
                  className={styles.padButton}
                  disabled={readOnly || state.active === null}
                  onClick={() => dispatch({ type: 'type-digit', digit })}
                >
                  {S.chart.digit(digit)}
                </button>
              ))}
              <button
                type="button"
                className={styles.padButton}
                disabled={readOnly || state.active === null}
                onClick={() => dispatch({ type: 'backspace' })}
              >
                {S.chart.erase}
              </button>
              <button
                type="button"
                className={styles.padButton}
                disabled={readOnly || state.active === null}
                onClick={() => dispatch({ type: 'deactivate' })}
              >
                {S.chart.done}
              </button>
            </div>
          ) : null}
        </div>
      </div>
      <p className={styles.srOnly} aria-live="polite" data-testid="chart-live">
        {live}
      </p>
    </div>
  );
}
