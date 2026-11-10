/**
 * `congruence` 화면: 움직이는 도형을 밀고·뒤집고·돌려 고정 도형에 포갠다.
 *
 * 대응점·변·각 표시는 실제로 겹친 뒤에만 만든다. 색만으로 구분하지 않고
 * 번호·눈금·호를 함께 쓴다.
 */
import { useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import type { EngineViewProps } from '../../../core/engine-sdk';
import { boardRect, ptXY } from '../layout';
import type { BoardRect } from '../layout';
import { currentMoving } from '../modes/congruence';
import { transformStrings as S } from '../strings.ko';
import type {
  CongruenceState,
  Pt,
  Side,
  TransformAction,
  TransformConfig,
  TurnDirection,
} from '../types';
import { LOGICAL_HEIGHT, LOGICAL_WIDTH, SIDES } from '../types';
import styles from '../View.module.css';
import { moveText } from './parts/move-text';

const PAPER = '#fbfaf6';
const INK = '#1d2330';
const GRID = '#c9d2e2';
const BLUE = '#2f6fde';
const GREEN = '#2f9e6b';
const CORR_COLORS = ['#b42318', '#1d4fa8', '#1f7a4d', '#7c3aed', '#b45309', '#0e7490'] as const;

type Props = EngineViewProps<TransformConfig, CongruenceState, TransformAction>;

function pointsString(rect: BoardRect, points: readonly Pt[]): string {
  return points
    .map((point) => {
      const xy = ptXY(rect, point);
      return `${xy.x.toFixed(2)},${xy.y.toFixed(2)}`;
    })
    .join(' ');
}

function midpoint(a: Pt, b: Pt): Pt {
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
}

function sideTicks(rect: BoardRect, a: Pt, b: Pt, count: number) {
  const from = ptXY(rect, a);
  const to = ptXY(rect, b);
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy) || 1;
  const nx = -dy / length;
  const ny = dx / length;
  const ticks = [];
  for (let index = 0; index < count; index += 1) {
    const t = 0.3 + index * 0.13;
    const cx = from.x + dx * t;
    const cy = from.y + dy * t;
    ticks.push(
      <line
        key={`tick-${index}`}
        x1={cx - nx * 12}
        y1={cy - ny * 12}
        x2={cx + nx * 12}
        y2={cy + ny * 12}
        stroke={INK}
        strokeWidth={3}
      />,
    );
  }
  return ticks;
}

export function CongruenceView({ state, dispatch, cpa, readOnly = false, targetSize }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const rect = boardRect(state.settings.grid);
  const moving = currentMoving(state);
  const centerIndex = Math.min(state.center, Math.max(0, moving.outline.length - 1));
  const centerPoint = moving.outline[centerIndex] ?? [0, 0];
  const [movingSide, setMovingSide] = useState(0);
  const [fixedSide, setFixedSide] = useState(0);
  const [turnDirection, setTurnDirection] = useState<TurnDirection>('cw');

  const dispatchTurn = (direction: TurnDirection) => {
    dispatch({ type: 'turn', direction, angle: 90, center: centerPoint });
  };

  const onKeyDown = (event: ReactKeyboardEvent<SVGSVGElement>) => {
    if (readOnly) return;
    const key = event.key;
    if (key.startsWith('Arrow')) {
      event.preventDefault();
      const side: Side =
        key === 'ArrowUp'
          ? 'up'
          : key === 'ArrowDown'
            ? 'down'
            : key === 'ArrowLeft'
              ? 'left'
              : 'right';
      if (event.shiftKey) {
        dispatch({ type: 'flip', side });
        return;
      }
      const dx = side === 'left' ? -1 : side === 'right' ? 1 : 0;
      const dy = side === 'up' ? -1 : side === 'down' ? 1 : 0;
      dispatch({ type: 'slide', dx, dy });
      return;
    }
    if (key.toLowerCase() === 'r') {
      event.preventDefault();
      dispatchTurn(event.shiftKey ? 'ccw' : 'cw');
      return;
    }
    if (key.toLowerCase() === 'c') {
      event.preventDefault();
      const length = moving.outline.length;
      if (length === 0) return;
      dispatch({ type: 'select-center', index: (state.center + 1) % length });
      return;
    }
    if (key === 'Backspace') {
      event.preventDefault();
      dispatch({ type: 'undo-move' });
      return;
    }
    if (key === 'Escape') {
      event.preventDefault();
      dispatch({ type: 'reset-moving' });
    }
  };

  const correspondence =
    state.settings.showCorrespondence === 'after-overlap' ? state.correspondence : null;
  const corrVisible = correspondence !== null && state.everOverlapped;

  return (
    <div className={styles.wrap} data-target-size={targetSize}>
      <div className={styles.toolbar}>
        <span className={styles.group}>
          <span className={styles.groupLabel}>{S.panel.gridLabel}</span>
          <span data-testid="transform-grid">{S.panel.gridValue(state.settings.grid)}</span>
        </span>
        <span className={styles.hint}>{S.keyboard.congruence}</span>
      </div>
      <p className={styles.instructions}>{S.instructions.congruence}</p>
      <p className={styles.status} role="status" data-testid="congruence-status">
        {state.everOverlapped && correspondence ? S.status.targetDone : ''}
      </p>

      <div className={styles.canvasArea}>
        <svg
          ref={svgRef}
          className={styles.canvas}
          viewBox={`0 0 ${LOGICAL_WIDTH} ${LOGICAL_HEIGHT}`}
          role="group"
          aria-label={S.canvasLabel.congruence}
          tabIndex={readOnly ? -1 : 0}
          data-testid="transform-canvas"
          data-motion="full"
          data-cpa={cpa}
          onKeyDown={onKeyDown}
        >
          <defs>
            <pattern
              id="e10-cong-fixed"
              width="18"
              height="18"
              patternUnits="userSpaceOnUse"
              patternTransform="rotate(35)"
            >
              <rect width="18" height="18" fill="#d9f2e6" />
              <line x1="0" y1="0" x2="0" y2="18" stroke={GREEN} strokeWidth="4" />
            </pattern>
            <pattern
              id="e10-cong-moving"
              width="18"
              height="18"
              patternUnits="userSpaceOnUse"
              patternTransform="rotate(-35)"
            >
              <rect width="18" height="18" fill="#dbe7ff" />
              <line x1="0" y1="0" x2="0" y2="18" stroke={BLUE} strokeWidth="4" />
            </pattern>
          </defs>
          <rect width={LOGICAL_WIDTH} height={LOGICAL_HEIGHT} fill={PAPER} />
          <g stroke={GRID} strokeWidth={1.3} strokeOpacity={0.75} pointerEvents="none">
            {Array.from({ length: state.settings.grid + 1 }, (_, index) => (
              <line
                key={`v-${index}`}
                x1={rect.x + index * rect.cell}
                y1={rect.y}
                x2={rect.x + index * rect.cell}
                y2={rect.y + rect.height}
              />
            ))}
            {Array.from({ length: state.settings.grid + 1 }, (_, index) => (
              <line
                key={`h-${index}`}
                x1={rect.x}
                y1={rect.y + index * rect.cell}
                x2={rect.x + rect.width}
                y2={rect.y + index * rect.cell}
              />
            ))}
          </g>

          <polygon
            data-fixed-shape
            points={pointsString(rect, state.fixed)}
            fill="url(#e10-cong-fixed)"
            stroke={GREEN}
            strokeWidth={4}
            strokeLinejoin="round"
          />
          <polygon
            data-moving-shape
            points={pointsString(rect, moving.outline)}
            fill="url(#e10-cong-moving)"
            stroke={INK}
            strokeWidth={4}
            strokeLinejoin="round"
          />

          <g pointerEvents="none">
            {state.fixed.map((point, index) => {
              const xy = ptXY(rect, point);
              return (
                <g key={`fixed-label-${index}`}>
                  <circle
                    cx={xy.x}
                    cy={xy.y}
                    r={7}
                    fill="#ffffff"
                    stroke={GREEN}
                    strokeWidth={2.5}
                  />
                  <text
                    x={xy.x + 20}
                    y={xy.y - 12}
                    fontSize={24}
                    fontWeight={800}
                    fill={GREEN}
                    stroke="#ffffff"
                    strokeWidth={4}
                    paintOrder="stroke"
                  >
                    {S.vertexLabels[index] ?? ''}
                  </text>
                </g>
              );
            })}
            {moving.outline.map((point, index) => {
              const xy = ptXY(rect, point);
              return (
                <g key={`moving-label-${index}`}>
                  <circle
                    cx={xy.x}
                    cy={xy.y}
                    r={7}
                    fill={index === centerIndex ? '#fff2d8' : '#ffffff'}
                    stroke={index === centerIndex ? '#e8872e' : INK}
                    strokeWidth={2.5}
                  />
                  <text
                    x={xy.x + 18}
                    y={xy.y - 12}
                    fontSize={24}
                    fontWeight={800}
                    fill={INK}
                    stroke="#ffffff"
                    strokeWidth={4}
                    paintOrder="stroke"
                  >
                    {S.movingLabels[index] ?? ''}
                  </text>
                </g>
              );
            })}
          </g>

          {corrVisible && correspondence
            ? correspondence.map((fixedIndex, index) => {
                const movingPoint = moving.outline[index];
                const fixedPoint = state.fixed[fixedIndex];
                if (!movingPoint || !fixedPoint) return null;
                const from = ptXY(rect, movingPoint);
                const to = ptXY(rect, fixedPoint);
                const color = CORR_COLORS[index % CORR_COLORS.length] ?? BLUE;
                const marker = S.congruence.pointMark[index] ?? '';
                return (
                  <g key={`corr-point-${index}`} data-corr="point">
                    <circle
                      cx={from.x}
                      cy={from.y}
                      r={13}
                      fill="#ffffff"
                      fillOpacity={0.85}
                      stroke={color}
                      strokeWidth={3}
                    />
                    <text
                      x={from.x}
                      y={from.y + 7}
                      textAnchor="middle"
                      fontSize={19}
                      fontWeight={800}
                      fill={color}
                    >
                      {marker}
                    </text>
                    {Math.hypot(from.x - to.x, from.y - to.y) > 1 ? (
                      <line
                        x1={from.x}
                        y1={from.y}
                        x2={to.x}
                        y2={to.y}
                        stroke={color}
                        strokeWidth={2.5}
                        strokeDasharray="7 6"
                      />
                    ) : null}
                  </g>
                );
              })
            : null}

          {corrVisible && correspondence
            ? correspondence.map((fixedIndex, index) => {
                const count = correspondence.length;
                const movingA = moving.outline[index];
                const movingB = moving.outline[(index + 1) % count];
                const fixedA = state.fixed[fixedIndex];
                const fixedB = state.fixed[(fixedIndex + 1) % count];
                if (!movingA || !movingB || !fixedA || !fixedB) return null;
                const color = CORR_COLORS[index % CORR_COLORS.length] ?? BLUE;
                return (
                  <g key={`corr-side-${index}`} data-corr="side">
                    {sideTicks(rect, movingA, movingB, (index % 4) + 1)}
                    {sideTicks(rect, fixedA, fixedB, (index % 4) + 1)}
                    <circle
                      cx={ptXY(rect, midpoint(movingA, movingB)).x}
                      cy={ptXY(rect, midpoint(movingA, movingB)).y}
                      r={5}
                      fill={color}
                    />
                    <circle
                      cx={ptXY(rect, midpoint(fixedA, fixedB)).x}
                      cy={ptXY(rect, midpoint(fixedA, fixedB)).y}
                      r={5}
                      fill={color}
                    />
                  </g>
                );
              })
            : null}

          {corrVisible && correspondence
            ? correspondence.map((fixedIndex, index) => {
                const movingPoint = moving.outline[index];
                const fixedPoint = state.fixed[fixedIndex];
                if (!movingPoint || !fixedPoint) return null;
                const count = correspondence.length;
                const prevMoving = moving.outline[(index - 1 + count) % count];
                const prevFixed = state.fixed[(fixedIndex - 1 + count) % count];
                if (!prevMoving || !prevFixed) return null;
                const color = CORR_COLORS[index % CORR_COLORS.length] ?? BLUE;
                const movingXY = ptXY(rect, movingPoint);
                const fixedXY = ptXY(rect, fixedPoint);
                const arcs = [];
                for (let ring = 0; ring < (index % 4) + 1; ring += 1) {
                  arcs.push(
                    <path
                      key={`ring-${ring}`}
                      d={`M ${movingXY.x - 24 - ring * 5} ${movingXY.y} A ${24 + ring * 5} ${24 + ring * 5} 0 0 1 ${movingXY.x + 24 + ring * 5} ${movingXY.y}`}
                      fill="none"
                      stroke={color}
                      strokeWidth={2.5}
                    />,
                    <path
                      key={`fixed-ring-${ring}`}
                      d={`M ${fixedXY.x - 24 - ring * 5} ${fixedXY.y} A ${24 + ring * 5} ${24 + ring * 5} 0 0 1 ${fixedXY.x + 24 + ring * 5} ${fixedXY.y}`}
                      fill="none"
                      stroke={color}
                      strokeWidth={2.5}
                    />,
                  );
                }
                return (
                  <g key={`corr-angle-${index}`} data-corr="angle">
                    {arcs}
                  </g>
                );
              })
            : null}
        </svg>
      </div>

      <div className={styles.panel} role="group" aria-label={S.name}>
        <section className={styles.panelGroup}>
          <span className={styles.panelLabel}>{S.panel.slideGroup}</span>
          <div className={styles.directionRow}>
            {SIDES.map((side) => (
              <button
                key={side}
                type="button"
                className={styles.button}
                disabled={readOnly}
                onClick={() => {
                  const dx = side === 'left' ? -1 : side === 'right' ? 1 : 0;
                  const dy = side === 'up' ? -1 : side === 'down' ? 1 : 0;
                  dispatch({ type: 'slide', dx, dy });
                }}
              >
                {S.sides[side]}
              </button>
            ))}
          </div>
        </section>
        <section className={styles.panelGroup}>
          <span className={styles.panelLabel}>{S.panel.flipGroup}</span>
          <div className={styles.directionRow}>
            {SIDES.map((side) => (
              <button
                key={side}
                type="button"
                className={styles.button}
                disabled={readOnly}
                onClick={() => dispatch({ type: 'flip', side })}
              >
                {S.sides[side]}
              </button>
            ))}
          </div>
        </section>
        <section className={styles.panelGroup}>
          <span className={styles.panelLabel}>{S.panel.turnGroup}</span>
          <div className={styles.directionRow}>
            <button
              type="button"
              className={styles.button}
              aria-pressed={turnDirection === 'cw'}
              disabled={readOnly}
              onClick={() => setTurnDirection('cw')}
            >
              {S.turnDirections.cw}
            </button>
            <button
              type="button"
              className={styles.button}
              aria-pressed={turnDirection === 'ccw'}
              disabled={readOnly}
              onClick={() => setTurnDirection('ccw')}
            >
              {S.turnDirections.ccw}
            </button>
            <button
              type="button"
              className={styles.button}
              disabled={readOnly}
              onClick={() => dispatchTurn(turnDirection)}
            >
              {S.panel.turnAction}
            </button>
          </div>
          <label className={styles.field}>
            <span>{S.panel.turnCenter}</span>
            <select
              className={styles.input}
              value={centerIndex}
              disabled={readOnly}
              onChange={(event) => {
                const index = Number(event.target.value);
                if (!Number.isInteger(index)) return;
                dispatch({ type: 'select-center', index });
              }}
            >
              {moving.outline.map((_, index) => (
                <option key={`center-${index}`} value={index}>
                  {S.centerOption(S.movingLabels[index] ?? '')}
                </option>
              ))}
            </select>
          </label>
        </section>
        <section className={styles.panelGroup}>
          <span className={styles.panelLabel}>{S.panel.moveListTitle}</span>
          <div className={styles.directionRow}>
            <button
              type="button"
              className={styles.button}
              disabled={readOnly || state.moves.length === 0}
              onClick={() => dispatch({ type: 'undo-move' })}
            >
              {S.panel.undo}
            </button>
            <button
              type="button"
              className={styles.button}
              disabled={readOnly || state.moves.length === 0}
              onClick={() => dispatch({ type: 'reset-moving' })}
            >
              {S.congruence.resetMoving}
            </button>
          </div>
        </section>
      </div>

      {state.settings.pairSides ? (
        <section className={styles.operationPanel} aria-label={S.congruence.pairTitle}>
          <h3 className={styles.panelLabel}>{S.congruence.pairTitle}</h3>
          <div className={styles.directionRow}>
            <label className={styles.field}>
              <span>{S.congruence.movingSide}</span>
              <select
                className={styles.input}
                value={movingSide}
                disabled={readOnly}
                onChange={(event) => setMovingSide(Number(event.target.value))}
              >
                {moving.outline.map((_, index) => (
                  <option key={`moving-side-${index}`} value={index}>
                    {S.congruence.sideName(
                      S.movingLabels[index] ?? '',
                      S.movingLabels[(index + 1) % moving.outline.length] ?? '',
                    )}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.field}>
              <span>{S.congruence.fixedSide}</span>
              <select
                className={styles.input}
                value={fixedSide}
                disabled={readOnly}
                onChange={(event) => setFixedSide(Number(event.target.value))}
              >
                {state.fixed.map((_, index) => (
                  <option key={`fixed-side-${index}`} value={index}>
                    {S.congruence.sideName(
                      S.vertexLabels[index] ?? '',
                      S.vertexLabels[(index + 1) % state.fixed.length] ?? '',
                    )}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className={styles.button}
              disabled={readOnly}
              onClick={() => dispatch({ type: 'pair-sides', moving: movingSide, fixed: fixedSide })}
            >
              {S.congruence.pair}
            </button>
          </div>
          {state.sidePairs.length === 0 ? (
            <p style={{ margin: 0, color: '#5b6577' }}>{S.congruence.noPairs}</p>
          ) : (
            <ul className={styles.moveList}>
              {state.sidePairs.map(([movingIndex, fixedIndex]) => (
                <li key={`pair-${movingIndex}-${fixedIndex}`} className={styles.moveItem}>
                  {S.congruence.sideName(
                    S.movingLabels[movingIndex] ?? '',
                    S.movingLabels[(movingIndex + 1) % moving.outline.length] ?? '',
                  )}
                  {' ↔ '}
                  {S.congruence.sideName(
                    S.vertexLabels[fixedIndex] ?? '',
                    S.vertexLabels[(fixedIndex + 1) % state.fixed.length] ?? '',
                  )}
                  <button
                    type="button"
                    className={styles.button}
                    disabled={readOnly}
                    onClick={() => dispatch({ type: 'unpair', moving: movingIndex })}
                  >
                    {S.congruence.unpair}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      <section className={styles.operationPanel} aria-label={S.panel.moveListTitle}>
        <h3 className={styles.panelLabel}>{S.panel.moveListTitle}</h3>
        {state.moves.length === 0 ? (
          <p style={{ margin: 0, color: '#5b6577' }}>{S.panel.noMoves}</p>
        ) : (
          <ol className={styles.moveList}>
            {state.moves.map((move, index) => (
              <li key={`move-${index}`} className={styles.moveItem}>
                {moveText(move, { outline: state.movingStart, cells: [] })}
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
