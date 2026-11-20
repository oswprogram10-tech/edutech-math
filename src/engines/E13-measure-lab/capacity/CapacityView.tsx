/**
 * E13 capacity 화면과 조작 칸.
 * - cup-count: 그릇마다 [컵으로 붓기]·[비우기], [처음으로].
 * - puzzle: 비커마다 [채우기]·[비우기]·[다른 비커로 붓기], [처음으로].
 * 단추는 Tab으로 고르고 Enter/Space로 누른다. 조건이 안 맞으면 이유를 글로 알린다.
 */
import { useRef } from 'react';
import { Btn } from '../Btn';
import { Frame } from '../Frame';
import { E13_STRINGS as S } from '../strings.ko';
import styles from '../View.module.css';
import { CapacityBoard } from './CapacityBoard';
import { boardHeight } from './layout';
import type { CapacityAction, CapacityState } from './types';
import { useCapacityUi } from './useCapacityUi';

export interface CapacityViewProps {
  readonly state: CapacityState;
  readonly dispatch: (action: CapacityAction) => void;
  readonly targetSize: number;
  readonly readOnly?: boolean;
}

export function CapacityView({ state, dispatch, targetSize, readOnly = false }: CapacityViewProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const ui = useCapacityUi(state, dispatch, readOnly);
  const puzzle = state.variant === 'puzzle';
  const text = S.capacity;
  return (
    <Frame
      mode="capacity"
      error={state.error}
      targetSize={targetSize}
      logicalHeight={boardHeight(state)}
      renderBoard={(svgStyle, className) => (
        <CapacityBoard
          svgRef={svgRef}
          state={state}
          ui={ui}
          locked={readOnly}
          svgStyle={svgStyle}
          className={className}
        />
      )}
      controls={
        <div className={styles.sideStack} data-testid="measure-controls">
          <p className={styles.instructions}>
            {puzzle ? text.instructionsPuzzle : text.instructionsCups}
          </p>
          <p className={styles.status} role="status" data-testid="measure-message">
            {ui.message ?? ''}
          </p>
          {puzzle ? (
            <>
              <div className={styles.row} role="group" aria-label={text.groupFill}>
                {state.containers.map((c) => (
                  <Btn
                    key={`fill-${c.id}`}
                    label={text.fill(c.label)}
                    action={`fill:${c.id}`}
                    disabled={readOnly}
                    onClick={() => ui.send({ type: 'fill', id: c.id })}
                  />
                ))}
                {state.containers.map((c) => (
                  <Btn
                    key={`empty-${c.id}`}
                    label={text.empty(c.label)}
                    action={`empty:${c.id}`}
                    disabled={readOnly}
                    onClick={() => ui.send({ type: 'empty', id: c.id })}
                  />
                ))}
              </div>
              <div className={styles.row} role="group" aria-label={text.groupPour}>
                {state.containers.map((from) =>
                  state.containers
                    .filter((to) => to.id !== from.id)
                    .map((to) => (
                      <Btn
                        key={`pour-${from.id}-${to.id}`}
                        label={text.pourTo(from.label, to.label)}
                        action={`pour:${from.id}:${to.id}`}
                        disabled={readOnly}
                        onClick={() => ui.send({ type: 'pour', from: from.id, to: to.id })}
                      />
                    )),
                )}
              </div>
            </>
          ) : (
            <div className={styles.row} role="group" aria-label={text.groupCups}>
              {state.containers.map((c) => (
                <Btn
                  key={`cup-${c.id}`}
                  label={text.pourCup(c.label)}
                  action={`pour-cup:${c.id}`}
                  primary
                  disabled={readOnly}
                  onClick={() => ui.send({ type: 'pour-cup', id: c.id })}
                />
              ))}
              {state.containers.map((c) => (
                <Btn
                  key={`empty-${c.id}`}
                  label={text.empty(c.label)}
                  action={`empty:${c.id}`}
                  disabled={readOnly}
                  onClick={() => ui.send({ type: 'empty', id: c.id })}
                />
              ))}
            </div>
          )}
          <div className={styles.row} role="group" aria-label={S.controlsLabel}>
            <Btn
              label={S.reset}
              action="reset"
              disabled={readOnly}
              onClick={() => ui.send({ type: 'reset' })}
            />
          </div>
        </div>
      }
    />
  );
}
