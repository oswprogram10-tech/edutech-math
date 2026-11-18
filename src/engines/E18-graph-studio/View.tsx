/**
 * E18 그래프 스튜디오 화면: 표(HTML) · 그래프(SVG) · 자료 카드 줄 · 눈금 고르기 · 가로·세로 바꾸기.
 *
 * 학생이 그린 그래프가 자료와 맞는지는 화면에 나타내지 않는다(맞음 표시·색 바뀜 없음).
 */
import type { EngineViewProps } from '../../core/engine-sdk';
import { GraphCanvas } from './GraphCanvas';
import { isTouchOMark } from './layout';
import { graphStrings as S } from './strings.ko';
import type { GraphAction, GraphConfig, GraphState } from './types';
import styles from './View.module.css';

type GraphViewProps = EngineViewProps<GraphConfig, GraphState, GraphAction>;

export function GraphView({ state, dispatch, cpa, readOnly = false, targetSize }: GraphViewProps) {
  const { settings } = state;
  const student = settings.graph === 'student';
  const tooltipsOn =
    !student &&
    settings.graph === 'given' &&
    (settings.tooltips === 'show' || (settings.tooltips === 'auto' && cpa !== 'A'));
  const unit = settings.valueLabel;
  const showScaleRow = state.mode === 'scale' && settings.scaleOptions.length > 0;

  return (
    <div className={styles.wrap} data-target-size={targetSize} data-mode={state.mode}>
      <div className={styles.toolbar}>
        {showScaleRow ? (
          <div
            className={styles.scaleRow}
            role="radiogroup"
            aria-label={S.graph.scaleGroup}
            data-testid="graph-scale-row"
          >
            <span className={styles.rowLabel}>{S.graph.scaleGroup}</span>
            {settings.scaleOptions.map((option) => (
              <button
                key={option}
                type="button"
                role="radio"
                aria-checked={state.scale === option}
                className={styles.button}
                data-scale={option}
                disabled={readOnly}
                onClick={() => dispatch({ type: 'set-scale', scale: option })}
              >
                {S.graph.scaleOption(option, unit)}
              </button>
            ))}
          </div>
        ) : null}
        {settings.orientationFlip ? (
          <button
            type="button"
            className={styles.button}
            data-testid="graph-flip"
            disabled={readOnly}
            onClick={() => dispatch({ type: 'flip' })}
          >
            {S.graph.flip}
          </button>
        ) : null}
        {student && settings.showGraph ? (
          <button
            type="button"
            className={styles.button}
            data-testid="graph-reset"
            disabled={readOnly}
            onClick={() => dispatch({ type: 'reset-graph' })}
          >
            {S.graph.reset}
          </button>
        ) : null}
      </div>

      {settings.rawItems.length > 0 ? (
        <div
          className={styles.tally}
          role="group"
          aria-label={S.tally.label}
          data-testid="graph-tally-row"
        >
          {settings.rawItems.map((item, index) => {
            const checked = state.tallied.includes(index);
            return (
              <button
                key={`${index}-${item}`}
                type="button"
                className={styles.tallyCard}
                aria-pressed={checked}
                aria-label={S.tally.item(index + 1, item, checked)}
                data-tally-index={index}
                disabled={readOnly}
                onClick={() => dispatch({ type: 'toggle-tally', index })}
              >
                <span>{item}</span>
                {checked ? <span className={styles.tallyMark}>{S.tally.mark}</span> : null}
              </button>
            );
          })}
        </div>
      ) : null}

      <div className={styles.views}>
        {settings.showTable ? (
          <div className={styles.tableBox}>
            <table className={styles.table} data-testid="graph-table">
              <caption>{S.table.label}</caption>
              <thead>
                <tr>
                  <th scope="col">{S.table.categoryHeader}</th>
                  <th scope="col">{S.table.valueHeader}</th>
                </tr>
              </thead>
              <tbody>
                {settings.categories.map((cat) => {
                  const value = state.table[cat] ?? null;
                  return (
                    <tr key={cat}>
                      <th scope="row">{cat}</th>
                      <td data-cat={cat}>
                        {settings.table === 'student' ? (
                          <span className={styles.stepper}>
                            <button
                              type="button"
                              className={styles.stepButton}
                              aria-label={S.table.decrease(cat)}
                              disabled={readOnly}
                              onClick={() =>
                                dispatch({
                                  type: 'set-table',
                                  cat,
                                  value: Math.max(0, (value ?? 0) - 1),
                                })
                              }
                            >
                              {S.table.minus}
                            </button>
                            <output className={styles.number} data-cat-value={cat}>
                              {value ?? S.table.empty}
                            </output>
                            <button
                              type="button"
                              className={styles.stepButton}
                              aria-label={S.table.increase(cat)}
                              disabled={readOnly}
                              onClick={() =>
                                dispatch({ type: 'set-table', cat, value: (value ?? 0) + 1 })
                              }
                            >
                              {S.table.plus}
                            </button>
                          </span>
                        ) : (
                          <span className={styles.number}>{value ?? S.table.empty}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}

        {settings.showGraph ? (
          <div
            className={styles.boardArea}
            data-scroll={isTouchOMark(settings) ? 'true' : undefined}
          >
            <GraphCanvas
              state={state}
              dispatch={dispatch}
              readOnly={readOnly}
              targetSize={targetSize}
              tooltipsOn={tooltipsOn}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
