/**
 * E13 unit-train 화면과 조작 칸. [1m로 바꾸기]·[10cm 막대로 풀기]·[1cm 블록으로 풀기]·[빼기](sub만)·[처음으로].
 * 단추는 Tab으로 고르고 Enter/Space로 누른다. 조건이 안 맞으면 이유를 글로 알린다.
 */
import { useRef } from 'react';
import { Btn } from '../Btn';
import { Frame } from '../Frame';
import { E13_STRINGS as S } from '../strings.ko';
import styles from '../View.module.css';
import { boardHeight } from './layout';
import { TrainBoard } from './TrainBoard';
import type { TrainAction, TrainState } from './types';
import { useTrainUi } from './useTrainUi';

export interface TrainViewProps {
  readonly state: TrainState;
  readonly dispatch: (action: TrainAction) => void;
  readonly targetSize: number;
  readonly readOnly?: boolean;
}

export function TrainView({ state, dispatch, targetSize, readOnly = false }: TrainViewProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const ui = useTrainUi(state, dispatch, readOnly);
  return (
    <Frame
      mode="length"
      error={state.error}
      targetSize={targetSize}
      logicalHeight={boardHeight(state)}
      renderBoard={(svgStyle, className) => (
        <TrainBoard svgRef={svgRef} state={state} svgStyle={svgStyle} className={className} />
      )}
      controls={
        <div className={styles.sideStack} data-testid="measure-controls">
          <p className={styles.instructions}>{S.train.instructions}</p>
          <p className={styles.status} role="status" data-testid="measure-message">
            {ui.message ?? ''}
          </p>
          <div className={styles.row} role="group" aria-label={S.controlsLabel}>
            <Btn
              label={S.train.promote}
              action="promote"
              primary
              disabled={readOnly}
              onClick={() => ui.send({ type: 'promote' })}
            />
            <Btn
              label={S.train.unpack}
              action="unpack"
              disabled={readOnly}
              onClick={() => ui.send({ type: 'unpack' })}
            />
            <Btn
              label={S.train.unpackSmall}
              action="unpack-small"
              disabled={readOnly}
              onClick={() => ui.send({ type: 'unpack-small' })}
            />
            {state.op === 'sub' ? (
              <Btn
                label={S.train.takeAway}
                action="take-away"
                primary
                disabled={readOnly}
                onClick={() => ui.send({ type: 'take-away' })}
              />
            ) : null}
            <Btn
              label={S.train.reset}
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
