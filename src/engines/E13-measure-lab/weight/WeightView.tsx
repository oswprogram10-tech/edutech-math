/**
 * E13 weight 화면과 조작 칸.
 * 예측이 켜져 있으면 먼저 "어느 쪽이 더 무거울까?"를 물건 단추로 고르고 [예측하기]를 누른다.
 * 그다음 물건을 고르고(또는 끌어서) 놓을 곳 단추를 누른다. 단추는 Tab으로 고르고 Enter/Space로 누른다.
 */
import { useRef } from 'react';
import { Btn } from '../Btn';
import { Frame } from '../Frame';
import { E13_STRINGS as S } from '../strings.ko';
import styles from '../View.module.css';
import { boardHeight } from './layout';
import { objectOf } from './settings';
import type { WeightAction, WeightState } from './types';
import { useWeightUi } from './useWeightUi';
import { WeightBoard } from './WeightBoard';

export interface WeightViewProps {
  readonly state: WeightState;
  readonly dispatch: (action: WeightAction) => void;
  readonly targetSize: number;
  readonly readOnly?: boolean;
}

export function WeightView({ state, dispatch, targetSize, readOnly = false }: WeightViewProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const ui = useWeightUi(state, dispatch, readOnly);
  const text = S.weight;
  const asking = state.predict && !state.predictionLocked;
  const prediction = state.prediction === null ? undefined : objectOf(state, state.prediction);
  return (
    <Frame
      mode="weight"
      error={state.error}
      targetSize={targetSize}
      logicalHeight={boardHeight(state)}
      renderBoard={(svgStyle, className) => (
        <WeightBoard
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
            {asking ? `${text.askFirst} ${text.instructionsPredict}` : text.instructionsUse}
          </p>
          {prediction !== undefined ? (
            <p className={styles.made} data-testid="weight-prediction">
              {text.myPrediction(prediction.name)}
            </p>
          ) : null}
          <p className={styles.status} role="status" data-testid="measure-message">
            {ui.message ?? ''}
          </p>
          {asking ? (
            <>
              <div className={styles.row} role="group" aria-label={text.predictGroup}>
                {state.objects.map((item) => (
                  <Btn
                    key={item.id}
                    label={item.name}
                    action={`candidate:${item.id}`}
                    pressed={ui.candidate === item.id}
                    primary={ui.candidate === item.id}
                    disabled={readOnly}
                    onClick={() => ui.pickCandidate(item.id)}
                  />
                ))}
              </div>
              <div className={styles.row}>
                <Btn
                  label={text.predictSubmit}
                  action="predict"
                  primary
                  disabled={readOnly}
                  onClick={() => ui.submitPrediction()}
                />
              </div>
            </>
          ) : (
            <>
              <div className={styles.row} role="group" aria-label={text.pickGroup}>
                {state.objects.map((item) => (
                  <Btn
                    key={item.id}
                    label={item.name}
                    action={`pick:${item.id}`}
                    pressed={ui.selected === item.id}
                    primary={ui.selected === item.id}
                    disabled={readOnly}
                    onClick={() => ui.select(ui.selected === item.id ? null : item.id)}
                  />
                ))}
              </div>
              <div className={styles.row} role="group" aria-label={text.placeGroup}>
                {state.tools.includes('pan-balance') ? (
                  <>
                    <Btn
                      label={text.toLeft}
                      action="to-left"
                      disabled={readOnly}
                      onClick={() => ui.placeSelected('left')}
                    />
                    <Btn
                      label={text.toRight}
                      action="to-right"
                      disabled={readOnly}
                      onClick={() => ui.placeSelected('right')}
                    />
                  </>
                ) : null}
                {state.tools.includes('spring-scale') ? (
                  <Btn
                    label={text.toSpring}
                    action="to-spring"
                    disabled={readOnly}
                    onClick={() => ui.placeSelected('spring')}
                  />
                ) : null}
                <Btn
                  label={text.toShelf}
                  action="to-shelf"
                  disabled={readOnly}
                  onClick={() => ui.placeSelected('shelf')}
                />
              </div>
              {state.clipG !== null ? (
                <div className={styles.row} role="group" aria-label={text.clipGroup}>
                  <Btn
                    label={text.clipPlus}
                    action="clip-plus"
                    disabled={readOnly}
                    onClick={() => ui.send({ type: 'clip', delta: 1 })}
                  />
                  <Btn
                    label={text.clipMinus}
                    action="clip-minus"
                    disabled={readOnly}
                    onClick={() => ui.send({ type: 'clip', delta: -1 })}
                  />
                </div>
              ) : null}
              <div className={styles.row} role="group" aria-label={S.controlsLabel}>
                <Btn
                  label={S.reset}
                  action="reset"
                  disabled={readOnly}
                  onClick={() => ui.send({ type: 'reset' })}
                />
              </div>
            </>
          )}
        </div>
      }
    />
  );
}
