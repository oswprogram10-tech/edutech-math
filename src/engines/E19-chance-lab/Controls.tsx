/**
 * E19 조작 칸(SVG 밖). 끌기를 못 쓰는 학생을 위해 모든 조작에 단추가 있다(키보드·화면 읽기 도구 공통).
 * leveling: 기둥 고르기·집기/놓기·취소·처음으로 / seesaw: 받침점 한 칸씩 / outlier: 예측 키패드·한 칸씩.
 */
import { observe } from './observe';
import { E19_STRINGS as S } from './strings.ko';
import type { ChanceState } from './types';
import type { ChanceUi } from './useChanceUi';
import styles from './View.module.css';

interface ButtonProps {
  readonly label: string;
  readonly onClick: () => void;
  readonly disabled?: boolean;
  readonly primary?: boolean;
  readonly action: string;
}

function Btn({ label, onClick, disabled = false, primary = false, action }: ButtonProps) {
  return (
    <button
      type="button"
      className={primary ? `${styles.button} ${styles.primary}` : styles.button}
      aria-label={label}
      data-action={action}
      disabled={disabled}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

export interface ControlsProps {
  readonly state: ChanceState;
  readonly ui: ChanceUi;
  readonly readOnly: boolean;
}

const KEYPAD: readonly (readonly string[])[] = [
  ['7', '8', '9', '/'],
  ['4', '5', '6', '.'],
  ['1', '2', '3', ' '],
  ['0'],
];

export function Controls({ state, ui, readOnly }: ControlsProps) {
  const status = (
    <p className={styles.status} role="status" data-testid="chance-message">
      {ui.message ?? ''}
    </p>
  );
  const reset = (
    <Btn
      label={S.reset}
      action="reset"
      disabled={readOnly}
      onClick={() => {
        ui.cancelHold();
        ui.send({ type: 'reset' });
      }}
    />
  );

  if (state.mode === 'leveling') {
    return (
      <div className={styles.sideStack} data-testid="chance-controls">
        <p className={styles.instructions}>{S.leveling.instructions}</p>
        <p className={styles.made} data-testid="chance-moves">
          {S.leveling.movesText(state.moves)}
        </p>
        <div className={styles.row} role="group" aria-label={S.controlsLabel}>
          <Btn
            label={S.leveling.buttons.prev}
            action="prev"
            disabled={readOnly}
            onClick={() => ui.moveCursor(-1)}
          />
          <Btn
            label={S.leveling.buttons.next}
            action="next"
            disabled={readOnly}
            onClick={() => ui.moveCursor(1)}
          />
          <Btn
            label={ui.holding === null ? S.leveling.buttons.pick : S.leveling.buttons.place}
            action="pick-place"
            primary
            disabled={readOnly}
            onClick={ui.pickOrPlace}
          />
          {ui.holding !== null ? (
            <Btn label={S.leveling.buttons.cancel} action="cancel" onClick={ui.cancelHold} />
          ) : null}
          {reset}
        </div>
        {status}
      </div>
    );
  }

  if (state.mode === 'seesaw') {
    const tilt = observe(state)['tilt'];
    const text = tilt === 'left' || tilt === 'right' || tilt === 'level' ? S.seesaw.tilt[tilt] : '';
    return (
      <div className={styles.sideStack} data-testid="chance-controls">
        <p className={styles.instructions}>{S.seesaw.instructions}</p>
        <p
          className={styles.verdict}
          role="status"
          data-testid="chance-tilt"
          data-tilt={String(tilt)}
        >
          {text}
        </p>
        <p className={styles.made} data-testid="chance-moves">
          {S.seesaw.movesText(state.moves)}
        </p>
        <div className={styles.row} role="group" aria-label={S.controlsLabel}>
          <Btn
            label={S.seesaw.buttons.left}
            action="fulcrum-left"
            disabled={readOnly}
            onClick={() => ui.nudgeFulcrum(-1)}
          />
          <Btn
            label={S.seesaw.buttons.right}
            action="fulcrum-right"
            disabled={readOnly}
            onClick={() => ui.nudgeFulcrum(1)}
          />
          {reset}
        </div>
        {status}
      </div>
    );
  }

  const waiting = state.requirePrediction && state.prediction === null;
  return (
    <div className={styles.sideStack} data-testid="chance-controls">
      <p className={styles.instructions}>
        {waiting ? S.outlier.instructionsPredict : S.outlier.instructions}
      </p>
      {waiting ? (
        <div className={styles.predict} role="group" aria-label={S.outlier.keypadLabel}>
          <p className={styles.made}>{S.outlier.predictTitle}</p>
          <output className={styles.draft} data-testid="chance-draft" aria-live="polite">
            {ui.draft === '' ? S.outlier.predictPlaceholder : ui.draft}
          </output>
          <div className={styles.keypad}>
            {KEYPAD.map((row) => (
              <div key={row.join('')} className={styles.row}>
                {row.map((key) => (
                  <Btn
                    key={key}
                    label={key === ' ' ? S.outlier.keys.space : key}
                    action={`key-${key === ' ' ? 'space' : key}`}
                    disabled={readOnly}
                    onClick={() => ui.typeDraft(key)}
                  />
                ))}
                {row.includes('0') ? (
                  <Btn
                    label={S.outlier.keys.backspace}
                    action="key-backspace"
                    disabled={readOnly}
                    onClick={ui.backspaceDraft}
                  />
                ) : null}
              </div>
            ))}
          </div>
          <Btn
            label={S.outlier.predictButton}
            action="predict"
            primary
            disabled={readOnly}
            onClick={ui.submitPrediction}
          />
        </div>
      ) : null}
      <div className={styles.row} role="group" aria-label={S.controlsLabel}>
        <Btn
          label={S.outlier.buttons.less}
          action="value-less"
          disabled={readOnly}
          onClick={() => ui.nudgeValue(-1)}
        />
        <Btn
          label={S.outlier.buttons.more}
          action="value-more"
          disabled={readOnly}
          onClick={() => ui.nudgeValue(1)}
        />
        {reset}
      </div>
      {status}
    </div>
  );
}
