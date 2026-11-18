/**
 * E18 그래프 스튜디오 화면: 표(HTML) · 그래프(SVG) · 자료 카드 줄 · 눈금 고르기 · 가로·세로 바꾸기.
 *
 * 학생이 그린 그래프가 자료와 맞는지는 화면에 나타내지 않는다(맞음 표시·색 바뀜 없음).
 */
import { useMemo } from 'react';
import type { EngineViewProps } from '../../core/engine-sdk';
import { BandCircleView } from './BandCircleView';
import { GraphCanvas } from './GraphCanvas';
import { ScrollBoard } from './ScrollBoard';
import { PictoIconSvg } from './icons';
import { isTouchOMark } from './layout';
import { LineView } from './LineView';
import { PictographBoard } from './PictographBoard';
import { splitValue } from './reduce';
import { graphStrings as S } from './strings.ko';
import type { GraphAction, GraphConfig, GraphSettings, GraphState, PictographRow } from './types';
import styles from './View.module.css';
import { VoteView } from './VoteView';

type GraphViewProps = EngineViewProps<GraphConfig, GraphState, GraphAction>;

export function GraphView(props: GraphViewProps) {
  const { state } = props;
  if (state.mode === 'class-vote') {
    return (
      <VoteView
        state={state}
        dispatch={props.dispatch}
        readOnly={props.readOnly}
        targetSize={props.targetSize}
      />
    );
  }
  if (state.mode === 'line-graph') return <LineView {...props} state={state} />;
  if (state.mode === 'band-circle') return <BandCircleView {...props} state={state} />;
  return <StandardView {...props} />;
}

/** 범례: 작은 그림 = 1, 큰 그림 = n. `legendEditable`이면 큰 그림 값을 고르는 단추 줄이 된다. */
function Legend({
  settings,
  legendBig,
  editable,
  readOnly,
  dispatch,
}: {
  readonly settings: GraphSettings;
  readonly legendBig: number;
  readonly editable: boolean;
  readonly readOnly: boolean;
  readonly dispatch: (action: GraphAction) => void;
}) {
  const unit = settings.valueLabel;
  return (
    <div
      className={styles.legend}
      role="group"
      aria-label={S.pictograph.legendLabel}
      data-testid="pictograph-legend"
    >
      <span className={styles.legendItem}>
        <PictoIconSvg kind={settings.icon} side={28} />
        {S.pictograph.legendSmall(unit)}
      </span>
      {editable ? (
        <span className={styles.scaleRow} role="radiogroup" aria-label={S.pictograph.legendGroup}>
          {settings.legendOptions.map((option) => (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={legendBig === option}
              className={styles.button}
              data-legend={option}
              disabled={readOnly}
              onClick={() => dispatch({ type: 'set-legend', big: option })}
            >
              {S.pictograph.legendBig(option, unit)}
            </button>
          ))}
        </span>
      ) : (
        <span className={styles.legendItem}>
          <PictoIconSvg kind={settings.icon} side={45} big />
          {S.pictograph.legendBig(legendBig, unit)}
        </span>
      )}
    </div>
  );
}

function StandardView({ state, dispatch, cpa, readOnly = false, targetSize }: GraphViewProps) {
  const { settings } = state;
  // 그림그래프: `pictograph` 모드는 학생이 놓은 행, `table-to-graph`의 그림그래프 보기는 자료로 그린 행.
  const pictoLegendBig = state.mode === 'pictograph' ? state.legendBig : settings.legendBig;
  const givenRows = useMemo<Record<string, PictographRow>>(
    () =>
      Object.fromEntries(
        settings.categories.map((cat) => [
          cat,
          splitValue(settings.data?.[cat] ?? 0, settings.legendBig),
        ]),
      ),
    [settings.categories, settings.data, settings.legendBig],
  );
  const pictoRows = state.mode === 'pictograph' ? state.rows : givenRows;
  const pictoInteractive = state.mode === 'pictograph' && settings.build === 'student' && !readOnly;
  const student = settings.graph === 'student';
  const tooltipsOn =
    !student &&
    settings.graph === 'given' &&
    (settings.tooltips === 'show' || (settings.tooltips === 'auto' && cpa !== 'A'));
  const unit = settings.valueLabel;
  const awaitingDataset = settings.datasets.length > 0 && state.datasetId === null;
  const showScaleRow = state.mode === 'scale' && settings.scaleOptions.length > 0;

  return (
    <div
      className={styles.wrap}
      data-target-size={targetSize}
      data-mode={state.mode}
      data-picto={settings.showPictograph ? 'true' : undefined}
    >
      {settings.datasets.length > 0 ? (
        <div
          className={styles.datasetRow}
          role="radiogroup"
          aria-label={S.dataset.group}
          data-testid="graph-dataset-row"
        >
          {settings.datasets.map((option) => (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={state.datasetId === option.id}
              className={styles.button}
              data-dataset={option.id}
              disabled={readOnly}
              onClick={() => dispatch({ type: 'pick-dataset', id: option.id })}
            >
              {state.datasetId === option.id ? (
                <span aria-hidden="true">{S.dataset.checked}</span>
              ) : null}
              {option.title}
            </button>
          ))}
        </div>
      ) : null}

      {awaitingDataset ? (
        <p className={styles.datasetHint} data-testid="graph-dataset-hint">
          {S.dataset.pickHint}
        </p>
      ) : (
        <>
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
            {settings.showPictograph ? (
              <Legend
                settings={settings}
                legendBig={pictoLegendBig}
                editable={state.mode === 'pictograph' && settings.legendEditable}
                readOnly={readOnly}
                dispatch={dispatch}
              />
            ) : null}
            {pictoInteractive ? (
              <button
                type="button"
                className={styles.button}
                data-testid="pictograph-reset"
                onClick={() => dispatch({ type: 'reset-rows' })}
              >
                {S.pictograph.resetRows}
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

            {settings.showPictograph ? (
              <PictographBoard
                settings={settings}
                rows={pictoRows}
                legendBig={pictoLegendBig}
                interactive={pictoInteractive}
                dispatch={dispatch}
                targetSize={targetSize}
                tooltipsOn={tooltipsOn}
              />
            ) : null}

            {settings.showGraph ? (
              isTouchOMark(settings) ? (
                <ScrollBoard vertical={state.orientation === 'vertical'} targetSize={targetSize}>
                  <GraphCanvas
                    state={state}
                    dispatch={dispatch}
                    readOnly={readOnly}
                    targetSize={targetSize}
                    tooltipsOn={tooltipsOn}
                  />
                </ScrollBoard>
              ) : (
                <div className={styles.boardArea}>
                  <GraphCanvas
                    state={state}
                    dispatch={dispatch}
                    readOnly={readOnly}
                    targetSize={targetSize}
                    tooltipsOn={tooltipsOn}
                  />
                </div>
              )
            ) : null}
          </div>

          {settings.source !== '' ? (
            <p className={styles.datasetSource} data-testid="graph-dataset-source">
              {S.dataset.source(settings.source)}
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}
