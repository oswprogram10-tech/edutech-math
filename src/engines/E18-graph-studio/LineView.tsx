/**
 * E18 꺾은선그래프(line-graph) 화면: 도구줄(물결선·범례·실제 자료 보기·지우기) · 그래프(SVG) · 표(HTML).
 *
 * 학생 점이 맞는지는 화면에 나타내지 않는다. 예측 단계에는 표와 실제 선을 숨긴다.
 */
import type { EngineViewProps } from '../../core/engine-sdk';
import { LineCanvas } from './LineCanvas';
import { ScrollBoard } from './ScrollBoard';
import { formatValue, valueOf } from './line';
import { graphStrings as S } from './strings.ko';
import type { GraphAction, GraphConfig, GraphState, LineGraphState } from './types';
import styles from './View.module.css';

type LineViewProps = Omit<EngineViewProps<GraphConfig, GraphState, GraphAction>, 'state'> & {
  readonly state: LineGraphState;
};

function LegendSample({ prediction }: { readonly prediction: boolean }) {
  return (
    <svg width="44" height="20" viewBox="0 0 44 20" aria-hidden="true">
      <line
        x1="2"
        x2="42"
        y1="10"
        y2="10"
        stroke={prediction ? '#b45309' : '#1d4fa8'}
        strokeWidth={prediction ? 3 : 4}
        strokeDasharray={prediction ? '7 5' : undefined}
      />
      <circle
        cx="22"
        cy="10"
        r="6"
        fill={prediction ? '#fbfaf6' : '#1d4fa8'}
        stroke={prediction ? '#b45309' : '#ffffff'}
        strokeWidth={prediction ? 3 : 2}
      />
    </svg>
  );
}

export function LineView({ state, dispatch, cpa, readOnly = false, targetSize }: LineViewProps) {
  const { settings } = state;
  const line = settings.line;
  if (line === null) return null;
  const student = settings.graph === 'student';
  const predictPhase = state.phase === 'predict';
  const tooltipsOn =
    !student &&
    !predictPhase &&
    (settings.tooltips === 'show' || (settings.tooltips === 'auto' && cpa !== 'A'));
  const predictionCount = line.xs.filter((x) => (state.prediction[x] ?? null) !== null).length;
  const canvas = (
    <LineCanvas
      state={state}
      dispatch={dispatch}
      readOnly={readOnly}
      targetSize={targetSize}
      tooltipsOn={tooltipsOn}
    />
  );

  return (
    <div
      className={styles.wrap}
      data-target-size={targetSize}
      data-mode="line-graph"
      data-phase={state.phase}
    >
      <div className={styles.toolbar}>
        {line.yFromOptions.length > 0 ? (
          <div
            className={styles.scaleRow}
            role="radiogroup"
            aria-label={S.line.wavyGroup}
            data-testid="line-wavy-row"
          >
            <span className={styles.rowLabel}>{S.line.wavyGroup}</span>
            {line.yFromOptions.map((option) => {
              const value = valueOf(option);
              const current = valueOf(state.yFrom);
              const checked = value !== null && current !== null && current.equals(value);
              return (
                <button
                  key={option}
                  type="button"
                  role="radio"
                  aria-checked={checked}
                  className={styles.button}
                  data-y-from={value ? formatValue(value) : option}
                  disabled={readOnly}
                  onClick={() => dispatch({ type: 'set-y-from', value: option })}
                >
                  {S.line.wavyOption(value ? formatValue(value) : option)}
                </button>
              );
            })}
          </div>
        ) : null}
        {line.predict ? (
          <div
            className={styles.legend}
            role="group"
            aria-label={S.line.legendGroup}
            data-testid="line-legend"
          >
            <span className={styles.legendItem}>
              <LegendSample prediction />
              {S.line.legendPrediction}
            </span>
            <span className={styles.legendItem}>
              <LegendSample prediction={false} />
              {S.line.legendActual}
            </span>
          </div>
        ) : null}
        {predictPhase ? (
          <button
            type="button"
            className={styles.button}
            data-testid="line-finish-predict"
            disabled={readOnly || predictionCount === 0}
            onClick={() => dispatch({ type: 'finish-predict' })}
          >
            {S.line.finishPredict}
          </button>
        ) : null}
        {(student || predictPhase) && settings.showGraph ? (
          <button
            type="button"
            className={styles.button}
            data-testid="graph-reset"
            disabled={readOnly}
            onClick={() => dispatch({ type: 'reset-graph' })}
          >
            {S.line.reset}
          </button>
        ) : null}
      </div>

      <div className={styles.views} data-line="true">
        {settings.showGraph ? (
          student || line.predict ? (
            <ScrollBoard vertical={false} targetSize={targetSize}>
              {canvas}
            </ScrollBoard>
          ) : (
            <div className={styles.boardArea}>{canvas}</div>
          )
        ) : null}

        {settings.showTable && !predictPhase ? (
          <div className={styles.lineTableBox}>
            <table className={styles.table} data-testid="graph-table">
              <caption>{S.line.tableLabel}</caption>
              <tbody>
                <tr>
                  <th scope="row">{settings.categoryAxisTitle || S.line.xHeader}</th>
                  {line.xs.map((x) => (
                    <td key={x}>{x}</td>
                  ))}
                </tr>
                <tr>
                  <th scope="row">{settings.valueAxisTitle || S.line.yHeader}</th>
                  {line.values.map((value, index) => {
                    const parsed = valueOf(value);
                    return (
                      <td key={line.xs[index]} data-x={line.xs[index]}>
                        {parsed ? formatValue(parsed) : value}
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </div>
  );
}
