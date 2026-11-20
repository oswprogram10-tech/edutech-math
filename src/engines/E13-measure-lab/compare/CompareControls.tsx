/** E13 compare-direct 조작 칸(SVG 밖). 끌기를 못 쓰는 학생을 위해 펴기·붓기는 단추로도 한다. */
import { Btn } from '../Btn';
import { E13_STRINGS as S } from '../strings.ko';
import styles from '../View.module.css';
import type { CompareState } from './types';
import type { CompareUi } from './useCompareUi';

export interface CompareControlsProps {
  readonly state: CompareState;
  readonly ui: CompareUi;
  readonly readOnly: boolean;
}

function instructions(state: CompareState): string {
  if (state.attribute === 'area') return S.compare.instructionsArea;
  if (state.attribute === 'capacity') return S.compare.instructionsCapacity;
  return S.compare.instructionsLength;
}

export function CompareControls({ state, ui, readOnly }: CompareControlsProps) {
  return (
    <div className={styles.sideStack} data-testid="measure-controls">
      <p className={styles.instructions}>{instructions(state)}</p>
      <p className={styles.status} role="status" data-testid="measure-message">
        {ui.message ?? ''}
      </p>
      <div className={styles.row} role="group" aria-label={S.controlsLabel}>
        {state.attribute === 'length' && state.straighten
          ? state.items
              .filter((item) => item.shape === 'curvy')
              .map((item) => (
                <Btn
                  key={item.id}
                  label={S.compare.straighten(item.label)}
                  action={`straighten:${item.id}`}
                  disabled={readOnly || state.straightened.includes(item.id)}
                  onClick={() => ui.send({ type: 'straighten', id: item.id })}
                />
              ))
          : null}
        {state.attribute === 'capacity' && state.pour
          ? state.items.map((item) => (
              <Btn
                key={item.id}
                label={S.compare.pour(item.label)}
                action={`pour:${item.id}`}
                disabled={readOnly || state.poured.includes(item.id)}
                onClick={() => ui.send({ type: 'pour', id: item.id })}
              />
            ))
          : null}
        <Btn
          label={S.reset}
          action="reset"
          disabled={readOnly}
          onClick={() => ui.send({ type: 'reset' })}
        />
      </div>
    </div>
  );
}
