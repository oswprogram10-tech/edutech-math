/**
 * E18 띠·원그래프(band-circle) 화면: 도구줄(말기 단추·띠 지우기) · 그래프(SVG) · 표(HTML, 그래프 아래).
 *
 * 표의 셋째 칸 "백분율(%)"은 `percentEntry: 'student'`이면 학생이 쓴다(칸 + 늘리기·줄이기 단추).
 * 학생 값이 맞는지는 화면에 나타내지 않는다.
 */
import { useRef } from 'react';
import type { ChangeEvent } from 'react';
import type { EngineViewProps } from '../../core/engine-sdk';
import { useRenderedSize } from '../../core/engine-sdk';
import { BandCanvas } from './BandCanvas';
import { sliceColor } from './band-palette';
import { graphStrings as S } from './strings.ko';
import type { BandCircleState, GraphAction, GraphConfig, GraphState } from './types';
import styles from './View.module.css';

type BandCircleViewProps = Omit<EngineViewProps<GraphConfig, GraphState, GraphAction>, 'state'> & {
  readonly state: BandCircleState;
};

/** 두 원을 나란히 두기에는 좁은 판 폭(px). 이보다 좁으면 위아래로 쌓는다. */
const STACK_BELOW = 680;

export function BandCircleView({
  state,
  dispatch,
  readOnly = false,
  targetSize,
}: BandCircleViewProps) {
  const { settings } = state;
  const band = settings.bandCircle;
  const areaRef = useRef<HTMLDivElement>(null);
  const area = useRenderedSize(areaRef);
  if (band === null) return null;

  const stacked = band.compare !== null && area.width > 0 && area.width < STACK_BELOW;
  const counts = settings.data ?? {};
  const showCounts = settings.showTable;
  const percentColumn = band.percentEntry !== 'hidden';
  const showTable = showCounts || percentColumn;
  const toggleLabel = state.curl >= 100 ? S.band.toBand : S.band.toCircle;

  const onPercentChange = (cat: string, event: ChangeEvent<HTMLInputElement>) => {
    const digits = event.target.value.replace(/[^0-9]/g, '');
    dispatch({
      type: 'set-percent',
      cat,
      value: digits === '' ? null : Math.min(100, Number(digits)),
    });
  };

  return (
    <div
      className={styles.wrap}
      data-target-size={targetSize}
      data-mode="band-circle"
      data-curl={state.curl}
    >
      <div className={styles.toolbar}>
        {band.morph !== 'none' ? (
          <button
            type="button"
            className={styles.button}
            data-testid="band-morph-toggle"
            disabled={readOnly}
            onClick={() => dispatch({ type: 'set-curl', value: state.curl >= 100 ? 0 : 100 })}
          >
            {toggleLabel}
          </button>
        ) : null}
        {band.band === 'student' ? (
          <button
            type="button"
            className={styles.button}
            data-testid="graph-reset"
            disabled={readOnly}
            onClick={() => dispatch({ type: 'reset-graph' })}
          >
            {S.band.reset}
          </button>
        ) : null}
      </div>

      <div className={styles.views} data-band="true">
        <div
          ref={areaRef}
          className={styles.boardArea}
          data-scroll={stacked ? 'true' : undefined}
          data-band-area="true"
        >
          <BandCanvas
            state={state}
            dispatch={dispatch}
            readOnly={readOnly}
            targetSize={targetSize}
            stacked={stacked}
          />
        </div>

        {showTable ? (
          <div className={styles.tableBox}>
            <table className={styles.table} data-testid="graph-table">
              <caption>{S.band.tableLabel}</caption>
              <thead>
                <tr>
                  <th scope="col">{S.band.categoryHeader}</th>
                  {showCounts ? <th scope="col">{S.band.countHeader}</th> : null}
                  {percentColumn ? <th scope="col">{S.band.percentHeader}</th> : null}
                </tr>
              </thead>
              <tbody>
                {settings.categories.map((cat, index) => {
                  const percent = state.percents[cat] ?? null;
                  return (
                    <tr key={cat}>
                      <th scope="row">
                        <span
                          className={styles.swatch}
                          style={{ background: sliceColor(index) }}
                          aria-hidden="true"
                        />
                        {cat}
                      </th>
                      {showCounts ? (
                        <td data-cat={cat} data-testid="band-count">
                          <span className={styles.number}>{counts[cat] ?? S.band.empty}</span>
                        </td>
                      ) : null}
                      {percentColumn ? (
                        <td data-cat={cat}>
                          {band.percentEntry === 'student' ? (
                            <span className={styles.stepper}>
                              <button
                                type="button"
                                className={styles.stepButton}
                                aria-label={S.band.percentDecrease(cat)}
                                disabled={readOnly}
                                onClick={() =>
                                  dispatch({
                                    type: 'set-percent',
                                    cat,
                                    value: Math.max(0, (percent ?? 0) - 1),
                                  })
                                }
                              >
                                {S.table.minus}
                              </button>
                              <input
                                type="text"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                maxLength={3}
                                className={styles.percentInput}
                                aria-label={S.band.percentInput(cat)}
                                data-testid="band-percent-input"
                                data-cat={cat}
                                placeholder={S.band.empty}
                                disabled={readOnly}
                                value={percent === null ? '' : String(percent)}
                                onChange={(event) => onPercentChange(cat, event)}
                              />
                              <button
                                type="button"
                                className={styles.stepButton}
                                aria-label={S.band.percentIncrease(cat)}
                                disabled={readOnly}
                                onClick={() =>
                                  dispatch({
                                    type: 'set-percent',
                                    cat,
                                    value: Math.min(100, (percent ?? 0) + 1),
                                  })
                                }
                              >
                                {S.table.plus}
                              </button>
                            </span>
                          ) : (
                            <span className={styles.number}>{percent ?? S.band.empty}</span>
                          )}
                        </td>
                      ) : null}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </div>
  );
}
