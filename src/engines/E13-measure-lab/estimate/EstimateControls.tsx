/**
 * E13 estimate 조작 칸(SVG 밖). 어림 먼저이면 0~9 키패드와 [어림 넣기]가 있다.
 * 모든 조작에 단추나 키보드 대체가 있다. 물건의 길이를 글로 알려 주지 않는다.
 */
import { Btn } from '../Btn';
import { E13_STRINGS as S } from '../strings.ko';
import styles from '../View.module.css';
import type { EstimateState } from './types';
import type { EstimateUi } from './useEstimateUi';

export interface EstimateControlsProps {
  readonly state: EstimateState;
  readonly ui: EstimateUi;
  readonly readOnly: boolean;
}

export function EstimateControls({ state, ui, readOnly }: EstimateControlsProps) {
  const instructions = state.estimateFirst
    ? state.estimateLocked
      ? state.draggable
        ? S.estimate.instructions
        : S.estimate.instructionsFixed
      : S.estimate.instructionsFirst
    : state.draggable
      ? S.estimate.instructions
      : S.estimate.instructionsFixed;
  const keypad = state.estimateFirst ? (
    <div className={styles.group}>
      <div className={styles.keyHead}>
        <p className={styles.caption} data-testid="estimate-draft">
          {state.estimateLocked && state.estimate !== null
            ? S.estimate.lockedLabel(state.estimate)
            : S.estimate.draftLabel(ui.draft)}
        </p>
        <Btn
          label={S.estimate.erase}
          action="erase"
          disabled={readOnly || state.estimateLocked}
          onClick={ui.eraseDigit}
        />
        <Btn
          label={S.estimate.submit}
          action="submit"
          primary
          disabled={readOnly || state.estimateLocked}
          onClick={ui.submit}
        />
      </div>
      <div
        className={styles.keyGrid}
        role="group"
        aria-label={S.estimate.keypadCaption}
        data-part="keypad"
      >
        {Array.from({ length: 10 }, (_, digit) => (
          <Btn
            key={digit}
            label={S.estimate.keyButton(digit)}
            action={`key:${digit}`}
            disabled={readOnly || state.estimateLocked}
            onClick={() => ui.addDigit(digit)}
          />
        ))}
      </div>
    </div>
  ) : null;
  // 어림을 넣기 전에는 키패드가 조작 칸 맨 위에 와서 첫 화면에 보인다(T223).
  const keypadFirst = state.estimateFirst && !state.estimateLocked;
  return (
    <div className={styles.sideStack} data-testid="measure-controls">
      {keypadFirst ? keypad : null}
      <p className={styles.instructions}>{instructions}</p>
      <p className={styles.status} role="status" data-testid="measure-message">
        {ui.message ?? ''}
      </p>
      {keypadFirst ? null : keypad}
      <div className={styles.row} role="group" aria-label={S.controlsLabel}>
        <Btn
          label={S.estimate.reset}
          action="reset"
          disabled={readOnly}
          onClick={() => ui.send({ type: 'reset' })}
        />
      </div>
    </div>
  );
}
