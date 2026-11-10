/** E10 밀기·뒤집기·돌리기 버튼 패널. 끌기 제스처를 쓸 수 없는 P·A 단계에서도 모두 조작한다. */
import { useState } from 'react';
import { transformStrings as S } from '../../strings.ko';
import type {
  Side,
  SlideFlipTurnState,
  SquareFigure,
  TransformAction,
  TurnAngle,
  TurnDirection,
} from '../../types';
import { SIDES, TURN_ANGLES } from '../../types';
import styles from '../../View.module.css';

interface MovePanelProps {
  readonly state: SlideFlipTurnState;
  readonly figure: SquareFigure;
  readonly dispatch: (action: TransformAction) => void;
  readonly readOnly: boolean;
}

export function MovePanel({ state, figure, dispatch, readOnly }: MovePanelProps) {
  const [side, setSide] = useState<Side>('right');
  const [cells, setCells] = useState(1);
  const [turnDirection, setTurnDirection] = useState<TurnDirection>('cw');
  const [turnAngle, setTurnAngle] = useState<TurnAngle>(() => state.settings.turnAngles[0] ?? 90);

  const allowed = state.settings.allowed;
  const maxCells = Math.max(1, state.settings.grid - 1);
  const effectiveAngle = state.settings.turnAngles.includes(turnAngle)
    ? turnAngle
    : (state.settings.turnAngles[0] ?? 90);
  const centerIndex = Math.min(state.center, Math.max(0, figure.outline.length - 1));
  const label = S.vertexLabels[centerIndex] ?? S.vertexLabels[0];

  return (
    <div className={styles.panel} role="group" aria-label={S.name}>
      <section className={styles.panelGroup} aria-label={S.panel.slideGroup}>
        <span className={styles.panelLabel}>{S.panel.slideGroup}</span>
        <div className={styles.directionRow}>
          {SIDES.map((candidate) => (
            <button
              key={candidate}
              type="button"
              className={styles.button}
              aria-pressed={side === candidate}
              disabled={readOnly || !allowed.includes('slide')}
              onClick={() => setSide(candidate)}
            >
              {S.sides[candidate]}
            </button>
          ))}
        </div>
        <label className={styles.field}>
          <span>{S.panel.cells}</span>
          <input
            className={styles.input}
            type="number"
            min={1}
            max={maxCells}
            value={cells}
            disabled={readOnly || !allowed.includes('slide')}
            onChange={(event) => {
              const next = Number(event.target.value);
              if (!Number.isFinite(next)) return;
              setCells(Math.min(maxCells, Math.max(1, Math.round(next))));
            }}
          />
        </label>
        <button
          type="button"
          className={styles.button}
          disabled={readOnly || !allowed.includes('slide')}
          onClick={() => {
            const count = Math.min(maxCells, Math.max(1, cells));
            if (side === 'up') dispatch({ type: 'slide', dx: 0, dy: -count });
            if (side === 'down') dispatch({ type: 'slide', dx: 0, dy: count });
            if (side === 'left') dispatch({ type: 'slide', dx: -count, dy: 0 });
            if (side === 'right') dispatch({ type: 'slide', dx: count, dy: 0 });
          }}
        >
          {S.panel.slideAction}
        </button>
      </section>

      <section className={styles.panelGroup} aria-label={S.panel.flipGroup}>
        <span className={styles.panelLabel}>{S.panel.flipGroup}</span>
        <div className={styles.directionRow}>
          {SIDES.map((candidate) => (
            <button
              key={candidate}
              type="button"
              className={styles.button}
              disabled={readOnly || !allowed.includes('flip')}
              onClick={() => dispatch({ type: 'flip', side: candidate })}
            >
              {S.sides[candidate]}
            </button>
          ))}
        </div>
      </section>

      <section className={styles.panelGroup} aria-label={S.panel.turnGroup}>
        <span className={styles.panelLabel}>{S.panel.turnGroup}</span>
        <div className={styles.directionRow}>
          <button
            type="button"
            className={styles.button}
            aria-pressed={turnDirection === 'cw'}
            disabled={readOnly || !allowed.includes('turn')}
            onClick={() => setTurnDirection('cw')}
          >
            {S.turnDirections.cw}
          </button>
          <button
            type="button"
            className={styles.button}
            aria-pressed={turnDirection === 'ccw'}
            disabled={readOnly || !allowed.includes('turn')}
            onClick={() => setTurnDirection('ccw')}
          >
            {S.turnDirections.ccw}
          </button>
        </div>
        <div className={styles.directionRow}>
          {TURN_ANGLES.filter((angle) => state.settings.turnAngles.includes(angle)).map((angle) => (
            <button
              key={angle}
              type="button"
              className={styles.button}
              aria-pressed={effectiveAngle === angle}
              disabled={readOnly || !allowed.includes('turn')}
              onClick={() => setTurnAngle(angle)}
            >
              {S.panel.angle(angle)}
            </button>
          ))}
        </div>
        <label className={styles.field}>
          <span>{S.panel.turnCenter}</span>
          <select
            className={styles.input}
            value={centerIndex}
            disabled={readOnly || !allowed.includes('turn')}
            onChange={(event) => {
              const index = Number(event.target.value);
              if (!Number.isInteger(index)) return;
              dispatch({ type: 'select-center', index });
            }}
          >
            {figure.outline.map((_, index) => (
              <option key={`center-${index}`} value={index}>
                {S.centerOption(S.vertexLabels[index] ?? '')}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className={styles.button}
          disabled={readOnly || !allowed.includes('turn')}
          onClick={() => {
            const point = figure.outline[centerIndex];
            if (!point) return;
            dispatch({
              type: 'turn',
              direction: turnDirection,
              angle: effectiveAngle,
              center: point,
            });
          }}
        >
          {S.panel.turnAction}
        </button>
      </section>

      <section className={styles.panelGroup} aria-label={S.panel.historyLabel}>
        <span className={styles.panelLabel}>{S.panel.moveListTitle}</span>
        <span className={styles.badge} data-testid="center-label">
          {S.centerAnnounce(label)}
        </span>
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
            disabled={readOnly || (state.moves.length === 0 && state.blockedCount === 0)}
            onClick={() => dispatch({ type: 'reset' })}
          >
            {S.panel.reset}
          </button>
        </div>
      </section>
    </div>
  );
}
