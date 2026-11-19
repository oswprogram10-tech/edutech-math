/**
 * E15 calc-pattern 모드 화면: 블록 피라미드와 계산식의 1:1 보기, 블록 쌓기 칸, 식 쓰기 칸.
 *
 * 맞고 틀림은 표시하지 않는다(✓/✕ 없음). 쌓기 칸 크기는 `2n+1`열 × `n+1`행이라
 * 정답 모양이 칸 수로 드러나지 않는다. `readExpression`·`isPyramid` 결과는 읽지 않는다.
 */
import { useMemo, useRef, useState } from 'react';
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent } from 'react';
import { useRenderedSize } from '../../core/engine-sdk';
import type { EngineViewProps } from '../../core/engine-sdk';
import { CalcKeypad } from './CalcKeypad';
import { exprParts, readExpression, totalOf } from './calc';
import { BLOCK, DIGIT_W, FONT, OP_FONT, calcLayout } from './calc-layout';
import { patternStrings as S } from './strings.ko';
import type { CalcState, PatternAction, PatternConfig } from './types';
import styles from './View.module.css';

type CalcViewProps = Omit<EngineViewProps<PatternConfig, CalcState, PatternAction>, 'state'> & {
  readonly state: CalcState;
};

/** 쌓기 칸 한 칸의 논리 크기. */
const CELL = 32;
/** 보기 판 블록의 최소 화면 크기(px). 이보다 작아지면 줄이지 않고 판 안에서 스크롤한다. */
const MIN_BLOCK_PX = 25;
const MAX_FIT = 1.5;
const MAX_BUILD_CELL_PX = 64;
const MONO = 'ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace';

const BLOCK_FILL = '#9dbcff';
const BLOCK_STROKE = '#1d4fa8';
const MARK = '#e8872e';
const INK = '#1d2330';

export function CalcView({ state, dispatch, targetSize, readOnly = false }: CalcViewProps) {
  const { settings } = state;
  const layout = useMemo(() => calcLayout(settings), [settings]);
  const reading = useMemo(() => readExpression(state.exprText), [state.exprText]);
  const parts = useMemo(
    () => exprParts(state.exprText, reading.errorAt, reading.valid),
    [state.exprText, reading],
  );
  const boardRef = useRef<HTMLDivElement>(null);
  const board = useRenderedSize(boardRef);
  const buildRef = useRef<HTMLDivElement>(null);
  const buildBox = useRenderedSize(buildRef);
  const [live, setLive] = useState('');

  if (settings.error !== null) {
    return (
      <div className={styles.wrap} data-target-size={targetSize} data-mode="calc-pattern">
        <div className={styles.errorBoard} role="alert" data-testid="calc-error">
          <p>{S.calc.configError}</p>
          <p>{S.calc.configErrorBody}</p>
        </div>
      </div>
    );
  }

  // 보기 판 크기. 판에 맞추되 블록이 MIN_BLOCK_PX보다 작아지면 그 크기로 두고 판 안에서 스크롤한다.
  let sizeStyle: { width: string; height: string } | undefined;
  let scroll = false;
  if (board.width > 0 && board.height > 0) {
    const fit = Math.min(board.width / layout.width, board.height / layout.height, MAX_FIT);
    const minScale = MIN_BLOCK_PX / BLOCK;
    const scale = fit >= minScale - 0.005 ? fit : minScale;
    scroll = fit < minScale - 0.005;
    sizeStyle = { width: `${layout.width * scale}px`, height: `${layout.height * scale}px` };
  }

  // 세로 화면에서 판이 조작 묶음에 눌려 블록이 최소 크기보다 작아지지 않도록 판의 최소 높이를 준다(CSS).
  const boardStyle = {
    '--calc-min-h': `${Math.ceil((layout.height * MIN_BLOCK_PX) / BLOCK)}px`,
  } as CSSProperties;

  const link = state.link;
  const linkable = settings.linkHighlight && !readOnly;
  const toggleLink = (step: number, col: number) => {
    if (!linkable) return;
    if (link !== null && link.step === step && link.col === col) {
      dispatch({ type: 'link', step: null });
      setLive(S.calc.unlinked);
    } else {
      dispatch({ type: 'link', step, col });
      setLive(S.calc.linked(step, col));
    }
  };
  const onLinkKey = (event: ReactKeyboardEvent<SVGGElement>, step: number, col: number) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      toggleLink(step, col);
    }
  };

  // 쌓기 칸
  const rows = settings.workStep + 1;
  const cols = state.heights.length;
  const buildCell = Math.max(
    targetSize,
    Math.min(MAX_BUILD_CELL_PX, buildBox.width > 0 ? Math.floor(buildBox.width / cols) : 0),
  );
  const built = totalOf(state.heights);

  const stack = (col: number, h: number) => {
    if (readOnly) return;
    const now = state.heights[col] ?? 0;
    const next = now === h ? h - 1 : h;
    dispatch({ type: 'tap-cell', col, h });
    setLive(next === 0 ? S.calc.emptied(col) : S.calc.stacked(col, next));
  };

  const onBuildKey = (event: ReactKeyboardEvent<SVGSVGElement>) => {
    if (readOnly || event.ctrlKey || event.metaKey || event.altKey) return;
    const key = event.key;
    if (key === 'ArrowRight') {
      event.preventDefault();
      dispatch({ type: 'move-cursor', dx: 1, dy: 0 });
    } else if (key === 'ArrowLeft') {
      event.preventDefault();
      dispatch({ type: 'move-cursor', dx: -1, dy: 0 });
    } else if (key === 'ArrowUp') {
      event.preventDefault();
      dispatch({ type: 'move-cursor', dx: 0, dy: 1 });
    } else if (key === 'ArrowDown') {
      event.preventDefault();
      dispatch({ type: 'move-cursor', dx: 0, dy: -1 });
    } else if (key === 'Enter' || key === ' ') {
      event.preventDefault();
      stack(state.cursor.col, state.cursor.h);
    } else if (/^[1-9]$/.test(key) && Number(key) <= rows) {
      // 숫자 키: 커서가 있는 열을 그 높이로 쌓는다.
      event.preventDefault();
      stack(state.cursor.col, Number(key));
    }
  };

  const onExprKey = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (readOnly || event.ctrlKey || event.metaKey || event.altKey) return;
    const key = event.key;
    if (/^[0-9]$/.test(key) || key === '+' || key === '=') {
      event.preventDefault();
      dispatch({ type: 'type', key });
    } else if (key === '*' || key === 'x' || key === 'X' || key === '×') {
      event.preventDefault();
      dispatch({ type: 'type', key: '×' });
    } else if (key === 'Backspace') {
      event.preventDefault();
      dispatch({ type: 'backspace' });
    } else if (key === 'Delete' || key === 'Escape') {
      event.preventDefault();
      dispatch({ type: 'clear-expr' });
    } else if (key.length === 1) {
      // 글자는 읽기 전용 칸에 들어가지 않는다. 다른 단축키로도 번지지 않게 막는다.
      event.preventDefault();
    }
  };

  const showExpr = settings.expression;
  const showSide = settings.build || showExpr;

  return (
    <div className={styles.wrap} data-target-size={targetSize} data-mode="calc-pattern">
      <div className={styles.stageRow}>
        <div
          ref={boardRef}
          className={styles.boardArea}
          data-scroll={scroll ? 'true' : 'false'}
          data-calc="true"
          style={boardStyle}
          data-testid="calc-board"
        >
          <svg
            data-testid="calc-canvas"
            className={styles.calcSvg}
            style={sizeStyle ?? { aspectRatio: `${layout.width} / ${layout.height}` }}
            viewBox={`0 0 ${layout.width} ${layout.height}`}
            role="group"
            aria-label={S.calc.canvasLabel}
          >
            <title>{S.calc.canvasLabel}</title>
            {layout.rows.map((row) => (
              <g key={row.step} data-step={row.step}>
                <text
                  x={row.label.x}
                  y={row.label.y}
                  fontSize={17}
                  fontWeight={700}
                  fill="#3d485c"
                  dominantBaseline="central"
                >
                  {S.calc.stepLabel(row.step)}
                </text>
                {row.cols.map((col) => {
                  const active = link !== null && link.step === row.step && link.col === col.col;
                  return (
                    <g
                      key={col.col}
                      data-step={row.step}
                      data-col={col.col}
                      data-linked={active ? 'true' : undefined}
                      role={linkable ? 'button' : undefined}
                      tabIndex={linkable ? 0 : undefined}
                      aria-label={S.calc.columnLabel(row.step, col.col, col.height)}
                      aria-pressed={linkable ? active : undefined}
                      className={styles.calcLinkable}
                      style={{ cursor: linkable ? 'pointer' : 'default' }}
                      onClick={() => toggleLink(row.step, col.col)}
                      onKeyDown={(event) => onLinkKey(event, row.step, col.col)}
                    >
                      {Array.from({ length: col.height }, (_, r) => (
                        <rect
                          key={r}
                          x={col.x + 0.5}
                          y={col.y + r * BLOCK + 0.5}
                          width={BLOCK - 1}
                          height={BLOCK - 1}
                          fill={BLOCK_FILL}
                          stroke={BLOCK_STROKE}
                          strokeWidth={1.5}
                        />
                      ))}
                      {active ? (
                        <rect
                          x={col.x - 1}
                          y={col.y - 1}
                          width={col.w + 2}
                          height={col.h + 2}
                          fill="none"
                          stroke={MARK}
                          strokeWidth={4}
                          data-testid="calc-col-mark"
                        />
                      ) : null}
                      <rect
                        x={col.x}
                        y={col.y}
                        width={col.w}
                        height={col.h}
                        fill="transparent"
                        stroke="none"
                      />
                    </g>
                  );
                })}
                {row.terms.map((term) => {
                  const active = link !== null && link.step === row.step && link.col === term.index;
                  const interactive = linkable && settings.pattern === 'symmetric-sum-square';
                  const half = term.w / 2;
                  return (
                    <g
                      key={term.index}
                      data-step={row.step}
                      data-term={term.index}
                      data-linked={active ? 'true' : undefined}
                      role={interactive ? 'button' : undefined}
                      tabIndex={interactive ? 0 : undefined}
                      aria-label={S.calc.termLabel(row.step, term.index, term.text)}
                      aria-pressed={interactive ? active : undefined}
                      className={styles.calcLinkable}
                      style={{ cursor: interactive ? 'pointer' : 'default' }}
                      onClick={() => toggleLink(row.step, term.index)}
                      onKeyDown={(event) => onLinkKey(event, row.step, term.index)}
                    >
                      <rect
                        x={term.cx - half}
                        y={term.cy - 15}
                        width={term.w}
                        height={30}
                        fill="transparent"
                      />
                      <text
                        x={term.cx}
                        y={term.cy}
                        fontSize={FONT}
                        fontWeight={active ? 900 : 600}
                        fontFamily={MONO}
                        textAnchor="middle"
                        dominantBaseline="central"
                        fill={INK}
                      >
                        {term.text}
                      </text>
                      {active ? (
                        <rect
                          x={term.cx - Math.max(DIGIT_W * term.text.length, 20) / 2}
                          y={term.cy + 12}
                          width={Math.max(DIGIT_W * term.text.length, 20)}
                          height={3}
                          fill={INK}
                          data-testid="calc-term-mark"
                        />
                      ) : null}
                    </g>
                  );
                })}
                {row.ops.map((op, index) => (
                  <text
                    key={index}
                    x={op.cx}
                    y={op.cy}
                    fontSize={OP_FONT}
                    fontWeight={700}
                    fontFamily={MONO}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fill="#3d485c"
                  >
                    {op.text}
                  </text>
                ))}
                {row.tail.text === '' ? null : (
                  <text
                    x={row.tail.x}
                    y={row.tail.cy}
                    fontSize={FONT}
                    fontWeight={700}
                    fontFamily={MONO}
                    dominantBaseline="central"
                    fill={INK}
                    data-tail={row.step}
                  >
                    {row.tail.text}
                  </text>
                )}
              </g>
            ))}
          </svg>
        </div>

        {showSide ? (
          <div className={styles.sideStack}>
            {settings.build ? (
              <section
                className={styles.calcSection}
                data-focus={state.focus === 'build' ? 'true' : 'false'}
              >
                <p className={styles.instructions}>{S.calc.buildInstructions}</p>
                <div ref={buildRef} className={styles.calcBuildScroll}>
                  <svg
                    data-testid="calc-build"
                    className={styles.calcBuildSvg}
                    width={cols * buildCell}
                    height={rows * buildCell}
                    viewBox={`0 0 ${cols * CELL} ${rows * CELL}`}
                    role="application"
                    aria-label={S.calc.buildLabel}
                    tabIndex={0}
                    onKeyDown={onBuildKey}
                    onFocus={() => dispatch({ type: 'set-focus', focus: 'build' })}
                  >
                    {Array.from({ length: rows }, (_, r) => {
                      const h = rows - r;
                      return Array.from({ length: cols }, (_, col) => {
                        const filled = (state.heights[col] ?? 0) >= h;
                        const cursor =
                          state.focus === 'build' &&
                          state.cursor.col === col &&
                          state.cursor.h === h;
                        return (
                          <g key={`${col}-${h}`}>
                            <rect
                              data-col={col}
                              data-h={h}
                              data-filled={filled ? 'true' : undefined}
                              aria-label={S.calc.cellLabel(col, h)}
                              x={col * CELL}
                              y={r * CELL}
                              width={CELL}
                              height={CELL}
                              fill={filled ? BLOCK_FILL : '#ffffff'}
                              stroke={filled ? BLOCK_STROKE : '#aab4c6'}
                              strokeWidth={filled ? 2 : 1}
                              strokeDasharray={filled ? undefined : '3 3'}
                              style={{ cursor: readOnly ? 'default' : 'pointer' }}
                              onClick={() => {
                                if (readOnly) return;
                                stack(col, h);
                              }}
                            />
                            {cursor ? (
                              <rect
                                x={col * CELL + 3}
                                y={r * CELL + 3}
                                width={CELL - 6}
                                height={CELL - 6}
                                fill="none"
                                stroke={INK}
                                strokeWidth={3}
                                pointerEvents="none"
                                data-cursor="true"
                              />
                            ) : null}
                          </g>
                        );
                      });
                    })}
                  </svg>
                </div>
                <div className={styles.toolbar}>
                  <span className={styles.calcCount} data-testid="calc-built-count">
                    {S.calc.blockCount(built)}
                  </span>
                  <button
                    type="button"
                    className={styles.button}
                    disabled={readOnly || built === 0}
                    onClick={() => {
                      dispatch({ type: 'clear-build' });
                      setLive(S.calc.buildCleared);
                    }}
                  >
                    {S.calc.clearBuild}
                  </button>
                </div>
              </section>
            ) : null}
            {showExpr ? (
              <section
                className={styles.calcSection}
                data-focus={state.focus === 'expr' ? 'true' : 'false'}
              >
                <p className={styles.instructions}>{S.calc.exprInstructions}</p>
                <div
                  className={styles.calcExpr}
                  data-testid="calc-expr"
                  data-readable={reading.valid ? 'true' : 'false'}
                >
                  <input
                    className={styles.calcExprInput}
                    type="text"
                    readOnly
                    inputMode="none"
                    autoComplete="off"
                    aria-label={S.calc.exprLabel}
                    value={parts.map((part) => part.text).join('')}
                    onKeyDown={onExprKey}
                    onFocus={() => dispatch({ type: 'set-focus', focus: 'expr' })}
                    data-testid="calc-expr-input"
                  />
                  <div className={styles.calcExprText} aria-hidden="true">
                    {parts.length === 0 ? (
                      <span className={styles.calcPlaceholder}>{S.calc.exprPlaceholder}</span>
                    ) : (
                      parts.map((part, index) =>
                        part.error ? (
                          <span
                            key={index}
                            className={styles.calcExprError}
                            data-testid="calc-expr-error"
                          >
                            {part.text}
                          </span>
                        ) : (
                          <span key={index}>{part.text}</span>
                        ),
                      )
                    )}
                  </div>
                </div>
                <CalcKeypad
                  disabled={readOnly}
                  onKey={(key) => dispatch({ type: 'type', key })}
                  onBackspace={() => dispatch({ type: 'backspace' })}
                  onClear={() => dispatch({ type: 'clear-expr' })}
                />
              </section>
            ) : null}
          </div>
        ) : null}
      </div>
      <p className={styles.srOnly} aria-live="polite" data-testid="calc-live">
        {live}
      </p>
    </div>
  );
}
