/**
 * E15 calc-pattern 표 변형 화면: 덧셈표·곱셈표(대부분 가려짐), 도구 막대(수 쓰기·돋보기·화살표),
 * 숫자 패드, 규칙 화살표.
 *
 * 가린 칸의 값은 DOM에 없다(돋보기로 연 칸만 보인다). 맞고 틀림은 표시하지 않는다(✓/✕ 없음).
 * 칸이 targetSize보다 작아지면 줄이지 않고 판 안에서 스크롤한다.
 */
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent } from 'react';
import { useRenderedSize } from '../../core/engine-sdk';
import type { EngineViewProps } from '../../core/engine-sdk';
import {
  TABLE_DIRS,
  TABLE_MAX_ARROWS,
  allBodyKeys,
  candidateKeys,
  dirDelta,
  headValue,
  isVisibleBody,
  magnifierLeft,
  parseCell,
  stepFrom,
  valueAt,
  writableKeys,
} from './calc-table';
import {
  CELL,
  bodyRect,
  centerOf,
  colHeadRect,
  cornerRect,
  rowHeadRect,
  tableLayout,
} from './calc-table-layout';
import { patternStrings as S } from './strings.ko';
import type {
  CalcTableState,
  PatternAction,
  PatternConfig,
  TableArrow,
  TableDir,
  TableTool,
} from './types';
import styles from './View.module.css';

type CalcTableViewProps = Omit<
  EngineViewProps<PatternConfig, CalcTableState, PatternAction>,
  'state'
> & {
  readonly state: CalcTableState;
};

const MAX_FIT = 1.25;
const INK = '#1d2330';
const HEAD_FILL = '#2c3a57';
const ARROW = '#b34700';
const DIGITS: readonly string[] = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];

interface Drawn {
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
  readonly ux: number;
  readonly uy: number;
}

/** 칸 `from`에서 `dir`로 두 칸(몸통 끝이면 한 칸) 길이로 그린 화살표 선. */
function arrowLine(
  grid: CalcTableState['settings'],
  from: string,
  dir: TableDir,
): { line: Drawn; steps: number } | null {
  const parsed = parseCell(from, grid.rows, grid.cols);
  if (parsed === null || stepFrom(grid, from, dir) === null) return null;
  const steps = stepFrom(grid, from, dir, 2) === null ? 1 : 2;
  const [dr, dc] = dirDelta(dir);
  const start = centerOf(bodyRect(parsed[0], parsed[1]));
  const len = Math.hypot(dc, dr);
  const ux = dc / len;
  const uy = dr / len;
  const endX = start.x + dc * steps * CELL;
  const endY = start.y + dr * steps * CELL;
  return {
    steps,
    line: {
      x1: start.x + ux * 24,
      y1: start.y + uy * 24,
      x2: endX - ux * 26,
      y2: endY - uy * 26,
      ux,
      uy,
    },
  };
}

export function CalcTableView({
  state,
  dispatch,
  targetSize,
  readOnly = false,
}: CalcTableViewProps) {
  const { settings } = state;
  const layout = useMemo(() => tableLayout(settings), [settings]);
  const boardRef = useRef<HTMLDivElement>(null);
  const board = useRenderedSize(boardRef);
  const svgRef = useRef<SVGSVGElement>(null);
  const [live, setLive] = useState('');
  const patternId = `table-hatch-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;

  const candidates = useMemo(() => candidateKeys(state), [state]);
  const bodyKeys = useMemo(() => allBodyKeys(settings), [settings]);
  const tabStop =
    state.active !== null && bodyKeys.includes(state.active)
      ? state.active
      : (candidates[0] ?? bodyKeys[0]);

  // 활성 칸이 키보드로 바뀌면 그 칸으로 초점을 옮긴다(판 안에 초점이 있을 때만).
  useEffect(() => {
    const root = svgRef.current;
    if (!root || state.active === null) return;
    if (!root.contains(document.activeElement)) return;
    const target = root.querySelector<SVGElement>(`[data-cell="${state.active}"]`);
    if (target && target !== document.activeElement) target.focus();
  }, [state.active]);

  if (settings.error !== null) {
    return (
      <div className={styles.wrap} data-target-size={targetSize} data-mode="calc-pattern">
        <div className={styles.errorBoard} role="alert" data-testid="calc-table-error">
          <p>{S.table.configError}</p>
          <p>{S.table.configErrorBody}</p>
        </div>
      </div>
    );
  }

  // 판 크기. 판에 맞추되 칸이 targetSize보다 작아지면 그 크기로 두고 판 안에서 스크롤한다.
  const minScale = targetSize / CELL;
  let sizeStyle: { width: string; height: string } | undefined;
  let scroll = false;
  if (board.width > 0 && board.height > 0) {
    const fit = Math.min(board.width / layout.width, board.height / layout.height, MAX_FIT);
    const scale = fit >= minScale - 0.005 ? fit : minScale;
    scroll = fit < minScale - 0.005;
    sizeStyle = { width: `${layout.width * scale}px`, height: `${layout.height * scale}px` };
  }
  const boardStyle = {
    '--table-min-h': `${Math.ceil(layout.height * minScale)}px`,
  } as CSSProperties;

  const tool = state.tool;
  const left = magnifierLeft(state);
  const draft = state.draftArrow;
  const writable = writableKeys(state);
  const pos = (key: string): string => {
    const parsed = parseCell(key, settings.rows, settings.cols);
    return parsed === null ? key : S.table.cellPos(parsed[0], parsed[1]);
  };

  const setTool = (next: TableTool) => {
    if (readOnly || next === tool) return;
    dispatch({ type: 'set-tool', tool: next });
    const name =
      next === 'write'
        ? S.table.toolWrite
        : next === 'magnifier'
          ? S.table.toolMagnifier(left)
          : S.table.toolArrow;
    setLive(S.table.live.tool(name));
  };

  const peek = (key: string) => {
    if (!writable.includes(key)) return;
    if (left <= 0) {
      setLive(S.table.live.noMagnifier);
      return;
    }
    const parsed = parseCell(key, settings.rows, settings.cols);
    if (parsed === null) return;
    dispatch({ type: 'peek', cell: key });
    setLive(S.table.live.peeked(pos(key), valueAt(settings, parsed[0], parsed[1]), left - 1));
  };

  const startArrow = (key: string) => {
    dispatch({ type: 'arrow-start', cell: key });
    setLive(S.table.live.arrowStart(pos(key)));
  };

  const pickDir = (dir: TableDir) => {
    dispatch({ type: 'arrow-dir', dir });
    setLive(S.table.live.arrowDir(S.table.dirLabel[dir] ?? dir));
  };

  const commitArrow = () => {
    dispatch({ type: 'arrow-commit' });
    setLive(S.table.live.arrowPlaced);
  };

  const onCell = (key: string) => {
    if (readOnly) return;
    if (tool === 'write') {
      if (!writable.includes(key)) return;
      dispatch({ type: 'activate', cell: key });
      setLive(S.table.live.picked(pos(key)));
    } else if (tool === 'magnifier') {
      if (!writable.includes(key)) return;
      dispatch({ type: 'activate', cell: key });
      peek(key);
    } else {
      startArrow(key);
    }
  };

  const typeDigit = (key: string) => {
    dispatch(tool === 'arrow' ? { type: 'arrow-type', key } : { type: 'type', key });
  };

  const onKey = (event: ReactKeyboardEvent<SVGSVGElement>) => {
    if (readOnly || event.ctrlKey || event.metaKey || event.altKey) return;
    const key = event.key;
    const act = (action: PatternAction) => {
      event.preventDefault();
      dispatch(action);
    };
    if (key === 'ArrowLeft') return act({ type: 'move', dir: 'left' });
    if (key === 'ArrowRight') return act({ type: 'move', dir: 'right' });
    if (key === 'ArrowUp') return act({ type: 'move', dir: 'up' });
    if (key === 'ArrowDown') return act({ type: 'move', dir: 'down' });
    if (key === 'm' || key === 'M') {
      if (settings.magnifierUses > 0) {
        event.preventDefault();
        setTool('magnifier');
      }
      return;
    }
    if (key === 'w' || key === 'W') {
      event.preventDefault();
      setTool('write');
      return;
    }
    if ((key === 'a' || key === 'A') && settings.drawArrows) {
      event.preventDefault();
      setTool('arrow');
      return;
    }
    const enter = key === 'Enter' || key === ' ';
    if (tool === 'write') {
      if (/^[0-9]$/.test(key)) return act({ type: 'type', key });
      if (key === 'Backspace') return act({ type: 'backspace' });
      if (key === 'Delete' || key === 'Escape') return act({ type: 'clear' });
    } else if (tool === 'magnifier') {
      if (enter && state.active !== null) {
        event.preventDefault();
        peek(state.active);
      }
    } else if (draft === null) {
      if (enter && state.active !== null) {
        event.preventDefault();
        startArrow(state.active);
      }
    } else if (draft.dir === null) {
      const index = ['1', '2', '3', '4'].indexOf(key);
      const dir = TABLE_DIRS[index];
      if (dir !== undefined) {
        event.preventDefault();
        pickDir(dir);
      } else if (key === 'Escape') {
        event.preventDefault();
        startArrow(draft.from);
      }
    } else if (/^[0-9]$/.test(key)) {
      act({ type: 'arrow-type', key });
    } else if (key === 'Backspace') {
      act({ type: 'arrow-backspace' });
    } else if (enter) {
      event.preventDefault();
      commitArrow();
    } else if (key === 'Escape') {
      event.preventDefault();
      startArrow(draft.from);
    }
  };

  const renderArrow = (arrow: { from: string; dir: TableDir; amount: string }, key: string) => {
    const drawn = arrowLine(settings, arrow.from, arrow.dir);
    if (drawn === null) return null;
    const { x1, y1, x2, y2, ux, uy } = drawn.line;
    const head = 11;
    const px = -uy;
    const py = ux;
    const tip = `${x2},${y2}`;
    const baseX = x2 - ux * head;
    const baseY = y2 - uy * head;
    const wing1 = `${baseX + px * 6},${baseY + py * 6}`;
    const wing2 = `${baseX - px * 6},${baseY - py * 6}`;
    return (
      <g key={key} data-arrow={arrow.from} data-dir={arrow.dir} data-amount={arrow.amount}>
        <line
          x1={x1}
          y1={y1}
          x2={baseX}
          y2={baseY}
          stroke={ARROW}
          strokeWidth={4}
          strokeLinecap="round"
        />
        <polygon points={`${tip} ${wing1} ${wing2}`} fill={ARROW} />
        {arrow.amount === '' ? null : (
          <text
            x={x2 + px * 18}
            y={y2 + py * 18}
            fontSize={19}
            fontWeight={800}
            textAnchor="middle"
            dominantBaseline="central"
            fill={ARROW}
            stroke="#ffffff"
            strokeWidth={5}
            paintOrder="stroke"
          >
            {`+${arrow.amount}`}
          </text>
        )}
      </g>
    );
  };

  const draftLine =
    draft !== null && draft.dir !== null ? arrowLine(settings, draft.from, draft.dir) : null;

  const rowsIdx = Array.from({ length: settings.rows }, (_, index) => index);
  const colsIdx = Array.from({ length: settings.cols }, (_, index) => index);
  const instruction =
    tool === 'write'
      ? S.table.instructions.write
      : tool === 'magnifier'
        ? S.table.instructions.magnifier
        : S.table.instructions.arrow;
  const padDisabled = readOnly || tool === 'magnifier' || (tool === 'arrow' && draft === null);

  return (
    <div className={styles.wrap} data-target-size={targetSize} data-mode="calc-pattern">
      <div className={styles.stageRow}>
        <div
          ref={boardRef}
          className={styles.boardArea}
          data-scroll={scroll ? 'true' : 'false'}
          data-table="true"
          style={boardStyle}
          data-testid="calc-table-board"
        >
          <svg
            ref={svgRef}
            data-testid="calc-table-canvas"
            className={styles.calcSvg}
            style={sizeStyle ?? { aspectRatio: `${layout.width} / ${layout.height}` }}
            viewBox={`0 0 ${layout.width} ${layout.height}`}
            role="group"
            aria-label={S.table.tableLabel}
            onKeyDown={onKey}
          >
            <title>{S.table.canvasLabel}</title>
            <defs>
              <pattern
                id={patternId}
                patternUnits="userSpaceOnUse"
                width={10}
                height={10}
                patternTransform="rotate(45)"
              >
                <line x1={0} y1={0} x2={0} y2={10} stroke="#7a8497" strokeWidth={3} />
              </pattern>
            </defs>

            {/* 1층: 칸 상자(누르는 칸). 값 글자는 3층에 따로 그린다. */}
            <g>
              {rowsIdx.map((r) =>
                colsIdx.map((c) => {
                  const key = `${r}.${c}`;
                  const rect = bodyRect(r, c);
                  const hidden = !isVisibleBody(settings, state.revealed, key);
                  const entry = state.entries[key];
                  const peeked = state.revealed.includes(key);
                  const isActive = state.active === key;
                  const inScope = candidates.includes(key);
                  const value = valueAt(settings, r, c);
                  const label = hidden
                    ? entry === undefined
                      ? S.table.cellHidden(pos(key))
                      : S.table.cellEntry(pos(key), entry)
                    : peeked
                      ? S.table.cellPeeked(pos(key), value)
                      : S.table.cellVisible(pos(key), value);
                  return (
                    <g
                      key={key}
                      className={styles.tableCell}
                      data-cell={key}
                      data-state={hidden ? 'hidden' : peeked ? 'peeked' : 'given'}
                      data-active={isActive ? 'true' : undefined}
                      data-filled={entry === undefined ? undefined : 'true'}
                      role="button"
                      aria-label={label}
                      aria-disabled={inScope && !readOnly ? undefined : 'true'}
                      tabIndex={key === tabStop ? 0 : -1}
                      onClick={() => onCell(key)}
                      onFocus={() => {
                        if (!readOnly && state.active !== key) {
                          dispatch({ type: 'activate', cell: key });
                        }
                      }}
                    >
                      <rect
                        x={rect.x}
                        y={rect.y}
                        width={rect.w}
                        height={rect.h}
                        fill={hidden ? '#ffffff' : peeked ? '#fff8e1' : '#f4f7fd'}
                        stroke="#5b6577"
                        strokeWidth={1.5}
                      />
                      {hidden ? (
                        <rect
                          x={rect.x}
                          y={rect.y}
                          width={rect.w}
                          height={rect.h}
                          fill={`url(#${patternId})`}
                          opacity={0.5}
                          pointerEvents="none"
                        />
                      ) : null}
                      {isActive ? (
                        <rect
                          className={styles.tableRing}
                          x={rect.x + 2}
                          y={rect.y + 2}
                          width={rect.w - 4}
                          height={rect.h - 4}
                          fill="none"
                          stroke={INK}
                          strokeWidth={4}
                          pointerEvents="none"
                        />
                      ) : null}
                    </g>
                  );
                }),
              )}
            </g>

            {/* 2층: 규칙 화살표. */}
            <g data-testid="calc-table-arrows" pointerEvents="none">
              {state.arrows.map((arrow, index) => renderArrow(arrow, `a${index}`))}
              {draftLine !== null && draft !== null && draft.dir !== null ? (
                <g data-draft="true" opacity={0.7}>
                  {renderArrow({ from: draft.from, dir: draft.dir, amount: draft.amount }, 'draft')}
                </g>
              ) : null}
            </g>

            {/* 3층: 머리 칸과 값 글자. 가린 칸은 "?"이거나 학생이 쓴 수만 그린다. */}
            <g pointerEvents="none" fontFamily="inherit">
              <rect
                x={cornerRect().x}
                y={cornerRect().y}
                width={CELL}
                height={CELL}
                fill={HEAD_FILL}
                stroke="#ffffff"
                strokeWidth={1.5}
              />
              <text
                x={centerOf(cornerRect()).x}
                y={centerOf(cornerRect()).y}
                fontSize={32}
                fontWeight={800}
                fill="#ffffff"
                textAnchor="middle"
                dominantBaseline="central"
                data-testid="calc-table-corner"
              >
                {S.table.corner(settings.table)}
              </text>
              {colsIdx.map((c) => {
                const rect = colHeadRect(c);
                const center = centerOf(rect);
                return (
                  <g key={`ch${c}`} data-col-head={c}>
                    <rect
                      x={rect.x}
                      y={rect.y}
                      width={rect.w}
                      height={rect.h}
                      fill={HEAD_FILL}
                      stroke="#ffffff"
                      strokeWidth={1.5}
                    />
                    <text
                      x={center.x}
                      y={center.y}
                      fontSize={26}
                      fontWeight={800}
                      fill="#ffffff"
                      textAnchor="middle"
                      dominantBaseline="central"
                    >
                      {headValue(settings, c)}
                    </text>
                  </g>
                );
              })}
              {rowsIdx.map((r) => {
                const rect = rowHeadRect(r);
                const center = centerOf(rect);
                return (
                  <g key={`rh${r}`} data-row-head={r}>
                    <rect
                      x={rect.x}
                      y={rect.y}
                      width={rect.w}
                      height={rect.h}
                      fill={HEAD_FILL}
                      stroke="#ffffff"
                      strokeWidth={1.5}
                    />
                    <text
                      x={center.x}
                      y={center.y}
                      fontSize={26}
                      fontWeight={800}
                      fill="#ffffff"
                      textAnchor="middle"
                      dominantBaseline="central"
                    >
                      {headValue(settings, r)}
                    </text>
                  </g>
                );
              })}
              {rowsIdx.map((r) =>
                colsIdx.map((c) => {
                  const key = `${r}.${c}`;
                  const rect = bodyRect(r, c);
                  const center = centerOf(rect);
                  const hidden = !isVisibleBody(settings, state.revealed, key);
                  const entry = state.entries[key];
                  if (hidden) {
                    const text = entry ?? '?';
                    return (
                      <text
                        key={key}
                        data-cell-text={key}
                        x={center.x}
                        y={center.y}
                        fontSize={entry === undefined ? 28 : 26}
                        fontWeight={entry === undefined ? 700 : 900}
                        fill={entry === undefined ? '#3d485c' : '#1d4fa8'}
                        textAnchor="middle"
                        dominantBaseline="central"
                        stroke="#ffffff"
                        strokeWidth={entry === undefined ? 5 : 0}
                        paintOrder="stroke"
                      >
                        {text}
                      </text>
                    );
                  }
                  const peeked = state.revealed.includes(key);
                  return (
                    <g key={key} data-cell-text={key}>
                      <text
                        x={center.x}
                        y={center.y}
                        fontSize={26}
                        fontWeight={500}
                        fill={INK}
                        textAnchor="middle"
                        dominantBaseline="central"
                        stroke="#ffffff"
                        strokeWidth={5}
                        paintOrder="stroke"
                      >
                        {valueAt(settings, r, c)}
                      </text>
                      {peeked ? (
                        <g data-peeked-icon={key}>
                          <title>{S.table.peekIcon}</title>
                          <circle
                            cx={rect.x + rect.w - 17}
                            cy={rect.y + 15}
                            r={6}
                            fill="none"
                            stroke={INK}
                            strokeWidth={2.5}
                          />
                          <line
                            x1={rect.x + rect.w - 12.5}
                            y1={rect.y + 19.5}
                            x2={rect.x + rect.w - 7}
                            y2={rect.y + 25}
                            stroke={INK}
                            strokeWidth={3}
                            strokeLinecap="round"
                          />
                        </g>
                      ) : null}
                    </g>
                  );
                }),
              )}
            </g>
          </svg>
        </div>

        <div className={styles.sideStack} data-table="true">
          <section className={styles.calcSection}>
            <p className={styles.instructions}>{instruction}</p>
            <div
              className={styles.toolbar}
              role="group"
              aria-label={S.table.toolbar}
              data-testid="table-tools"
            >
              <button
                type="button"
                className={styles.button}
                aria-pressed={tool === 'write'}
                disabled={readOnly}
                onClick={() => setTool('write')}
              >
                {S.table.toolWrite}
              </button>
              {settings.magnifierUses > 0 ? (
                <button
                  type="button"
                  className={styles.button}
                  aria-pressed={tool === 'magnifier'}
                  disabled={readOnly}
                  onClick={() => setTool('magnifier')}
                  data-testid="table-tool-magnifier"
                >
                  {S.table.toolMagnifier(left)}
                </button>
              ) : null}
              {settings.drawArrows ? (
                <button
                  type="button"
                  className={styles.button}
                  aria-pressed={tool === 'arrow'}
                  disabled={readOnly}
                  onClick={() => setTool('arrow')}
                  data-testid="table-tool-arrow"
                >
                  {S.table.toolArrow}
                </button>
              ) : null}
            </div>

            {tool === 'arrow' ? (
              <div className={styles.tableArrowPanel} data-testid="table-arrow-panel">
                <p className={styles.instructions} data-testid="table-draft">
                  {draft === null ? S.table.draftNone : S.table.draftStart(pos(draft.from))}
                </p>
                <div
                  className={styles.toolbar}
                  role="group"
                  aria-label={S.table.dirs}
                  data-testid="table-dirs"
                >
                  {TABLE_DIRS.map((dir) => (
                    <button
                      key={dir}
                      type="button"
                      className={styles.button}
                      aria-pressed={draft !== null && draft.dir === dir}
                      disabled={
                        readOnly || draft === null || stepFrom(settings, draft.from, dir) === null
                      }
                      onClick={() => pickDir(dir)}
                    >
                      {S.table.dirLabel[dir]}
                    </button>
                  ))}
                </div>
                <p className={styles.tableAmount} data-testid="table-amount">
                  <span>{S.table.amountLabel}</span>{' '}
                  <strong>
                    {draft === null || draft.amount === '' ? '＿' : `+${draft.amount}`}
                  </strong>
                </p>
                <button
                  type="button"
                  className={styles.button}
                  disabled={
                    readOnly ||
                    draft === null ||
                    draft.dir === null ||
                    draft.amount === '' ||
                    (state.arrows.length >= TABLE_MAX_ARROWS &&
                      !state.arrows.some((a) => a.from === draft.from && a.dir === draft.dir))
                  }
                  onClick={commitArrow}
                  data-testid="table-arrow-commit"
                >
                  {S.table.place}
                </button>
              </div>
            ) : null}

            <div
              className={styles.calcPad}
              role="group"
              aria-label={S.table.pad}
              data-testid="table-pad"
            >
              {DIGITS.map((digit) => (
                <button
                  key={digit}
                  type="button"
                  className={styles.calcPadButton}
                  disabled={padDisabled}
                  onClick={() => typeDigit(digit)}
                >
                  {digit}
                </button>
              ))}
              <button
                type="button"
                className={`${styles.calcPadButton} ${styles.calcPadWide}`}
                disabled={padDisabled}
                onClick={() =>
                  dispatch(tool === 'arrow' ? { type: 'arrow-backspace' } : { type: 'backspace' })
                }
              >
                {S.table.erase}
              </button>
              {tool === 'write' ? (
                <button
                  type="button"
                  className={`${styles.calcPadButton} ${styles.calcPadWide}`}
                  disabled={padDisabled}
                  onClick={() => dispatch({ type: 'clear' })}
                >
                  {S.table.clearAll}
                </button>
              ) : null}
            </div>

            {state.arrows.length > 0 ? (
              <div
                className={styles.toolbar}
                role="group"
                aria-label={S.table.arrowList}
                data-testid="table-arrow-list"
              >
                {state.arrows.map((arrow: TableArrow, index) => {
                  const glyph = S.table.dirGlyph[arrow.dir] ?? '';
                  return (
                    <button
                      key={`${arrow.from}-${arrow.dir}`}
                      type="button"
                      className={styles.button}
                      disabled={readOnly}
                      aria-label={S.table.arrowChip(glyph, arrow.amount, pos(arrow.from))}
                      onClick={() => {
                        dispatch({ type: 'arrow-remove', index });
                        setLive(S.table.live.arrowRemoved);
                      }}
                    >
                      {S.table.arrowChipText(glyph, arrow.amount)}
                    </button>
                  );
                })}
              </div>
            ) : null}
          </section>
        </div>
      </div>
      <p className={styles.srOnly} aria-live="polite" data-testid="calc-table-live">
        {live}
      </p>
    </div>
  );
}
