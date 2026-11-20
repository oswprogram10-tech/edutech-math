/**
 * E13 roll-circle 화면과 조작 칸. 지름 단추로 굴렁쇠를 고르고 [굴리기]·[지름 막대 잇기]·[막대 하나 빼기]·
 * [기록하기]·[처음으로]를 누른다. 단추는 Tab으로 고르고 Enter/Space로 누른다.
 */
import { useRef } from 'react';
import { Btn } from '../../Btn';
import { Frame } from '../../Frame';
import { E13_STRINGS as S } from '../../strings.ko';
import styles from '../../View.module.css';
import { boardHeight } from './layout';
import { RollBoard } from './RollBoard';
import type { RollAction, RollState } from './types';
import { useRollUi } from './useRollUi';

export interface RollViewProps {
  readonly state: RollState;
  readonly dispatch: (action: RollAction) => void;
  readonly targetSize: number;
  readonly readOnly?: boolean;
}

export function RollView({ state, dispatch, targetSize, readOnly = false }: RollViewProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const ui = useRollUi(state, dispatch, readOnly);
  const text = S.roll;
  return (
    <Frame
      mode="length"
      error={state.error}
      targetSize={targetSize}
      logicalHeight={boardHeight(state)}
      renderBoard={(svgStyle, className) => (
        <RollBoard
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
          <div className={styles.row} role="group" aria-label={text.diameterGroup}>
            {state.diameters.map((d) => (
              <Btn
                key={d}
                label={text.diameterButton(d)}
                action={`choose:${d}`}
                pressed={state.diameter === d}
                primary={state.diameter === d}
                disabled={readOnly}
                onClick={() => ui.send({ type: 'choose', d })}
              />
            ))}
          </div>
          <div className={styles.row} role="group" aria-label={S.controlsLabel}>
            <Btn
              label={text.roll}
              action="roll"
              primary
              disabled={readOnly}
              onClick={() => ui.send({ type: 'roll' })}
            />
            {state.diameterStickTool ? (
              <>
                <Btn
                  label={text.stickPlus}
                  action="stick-plus"
                  disabled={readOnly}
                  onClick={() => ui.send({ type: 'stick', delta: 1 })}
                />
                <Btn
                  label={text.stickMinus}
                  action="stick-minus"
                  disabled={readOnly}
                  onClick={() => ui.send({ type: 'stick', delta: -1 })}
                />
              </>
            ) : null}
            {state.logEnabled ? (
              <Btn
                label={text.record}
                action="record"
                disabled={readOnly}
                onClick={() => ui.send({ type: 'record' })}
              />
            ) : null}
            <Btn
              label={text.reset}
              action="reset"
              disabled={readOnly}
              onClick={() => ui.send({ type: 'reset' })}
            />
          </div>
          <p className={styles.status} role="status" data-testid="measure-message">
            {ui.message ?? ''}
          </p>
          <p className={styles.instructions}>{text.instructions}</p>
        </div>
      }
    />
  );
}
