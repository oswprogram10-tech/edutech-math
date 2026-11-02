/**
 * 수 입력 위젯.
 *
 * - 자연수·분수·대분수·소수 틀을 버튼으로 바꾼다.
 * - 분수는 분자·분모 칸이 따로 있는 틀에 입력한다(문자열 파싱에 기대지 않는다).
 * - 화면 키패드 버튼 한 번 = Action 한 번. 실제 키보드도 받는다.
 * - 처음에는 빈칸이다. 예시 값이나 자리 표시 숫자를 넣지 않는다.
 */
import { useRef } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import type { EngineId, LoadedEngine, TargetSize } from '../../../engine-sdk';
import type {
  NumberField,
  NumberFieldState,
  NumberForm,
  NumberPart,
  ResponseAction,
} from '../types';
import { partsOf } from '../types';
import { responseStrings as S } from '../strings.ko';
import styles from '../ResponseView.module.css';

interface NumberWidgetProps {
  readonly field: NumberField;
  readonly state: NumberFieldState;
  readonly dispatch: (action: ResponseAction) => void;
  readonly readOnly: boolean;
  readonly targetSize: TargetSize;
  readonly definitions?: ReadonlyMap<EngineId, LoadedEngine>;
}

const PART_LABEL: Record<NumberPart, string> = {
  whole: S.whole,
  numerator: S.numerator,
  denominator: S.denominator,
  decimal: S.decimal,
};

const KEYPAD = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0'] as const;

export function NumberWidget({ field, state, dispatch, readOnly, targetSize }: NumberWidgetProps) {
  const rootRef = useRef<HTMLDivElement>(null);

  const focusPart = (part: NumberPart) => {
    dispatch({ type: 'number-focus', field: field.id, part });
  };

  const stepPart = (direction: -1 | 1) => {
    const parts = partsOf(state.form);
    const index = parts.indexOf(state.activePart);
    const next = parts[Math.min(parts.length - 1, Math.max(0, index + direction))];
    if (next) focusPart(next);
  };

  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (readOnly) return;
    const key = event.key;
    if (/^\d$/.test(key)) {
      event.preventDefault();
      dispatch({ type: 'number-key', field: field.id, key });
      return;
    }
    if (key === 'Backspace' || key === 'Delete') {
      event.preventDefault();
      dispatch({ type: 'number-key', field: field.id, key: 'backspace' });
      return;
    }
    if (key === '.' || key === ',') {
      event.preventDefault();
      if (state.form === 'decimal') {
        dispatch({ type: 'number-key', field: field.id, key: '.' });
      }
      return;
    }
    if (key === '/') {
      event.preventDefault();
      if (state.form === 'fraction' || state.form === 'mixed') focusPart('denominator');
      return;
    }
    if (key === ' ') {
      if (state.form === 'mixed') {
        event.preventDefault();
        stepPart(1);
      }
    }
  };

  const partBox = (part: NumberPart, extraClass?: string) => {
    const value = state[part];
    const active = state.activePart === part;
    return (
      <button
        type="button"
        className={`${styles.partBox} ${extraClass ?? ''} ${active ? styles.partActive : ''}`}
        style={{ minWidth: targetSize, minHeight: targetSize }}
        data-part={part}
        data-active={active ? 'true' : undefined}
        aria-label={`${PART_LABEL[part]}: ${value.length > 0 ? value : S.emptyPart}`}
        onClick={() => focusPart(part)}
        onFocus={() => focusPart(part)}
        disabled={readOnly}
      >
        {value.length > 0 ? value : '\u00a0'}
      </button>
    );
  };

  const frame = () => {
    if (state.form === 'integer') return partBox('whole', styles.widePart);
    if (state.form === 'decimal') return partBox('decimal', styles.widePart);
    if (state.form === 'fraction') {
      return (
        <span className={styles.fractionFrame}>
          {partBox('numerator')}
          <span className={styles.fractionBar} aria-hidden="true" />
          {partBox('denominator')}
        </span>
      );
    }
    return (
      <span className={styles.mixedFrame}>
        {partBox('whole')}
        <span className={styles.fractionFrame}>
          {partBox('numerator')}
          <span className={styles.fractionBar} aria-hidden="true" />
          {partBox('denominator')}
        </span>
      </span>
    );
  };

  return (
    <div
      ref={rootRef}
      className={styles.number}
      data-response-kind="number"
      data-response-field={field.id}
      role="group"
      aria-label={S.numberInput}
      tabIndex={readOnly ? -1 : 0}
      onClick={() => rootRef.current?.focus()}
      onKeyDown={onKeyDown}
    >
      {field.forms.length > 1 ? (
        <div className={styles.formRow} role="group" aria-label={S.formSwitch}>
          {field.forms.map((form: NumberForm) => (
            <button
              key={form}
              type="button"
              className={styles.formButton}
              aria-pressed={state.form === form}
              disabled={readOnly}
              onClick={() => dispatch({ type: 'number-form', field: field.id, form })}
            >
              {S.forms[form]}
            </button>
          ))}
        </div>
      ) : null}

      <div className={styles.frameRow}>
        <div className={styles.frame} aria-label={S.panelLabel} role="group">
          {frame()}
        </div>
      </div>

      <div className={styles.keypad} role="group" aria-label={S.keypad}>
        {KEYPAD.map((key) => (
          <button
            key={key}
            type="button"
            className={styles.key}
            style={{ minWidth: targetSize, minHeight: targetSize }}
            disabled={readOnly}
            onClick={() => dispatch({ type: 'number-key', field: field.id, key })}
          >
            {key}
          </button>
        ))}
        <button
          type="button"
          className={styles.key}
          style={{ minWidth: targetSize, minHeight: targetSize }}
          aria-label={S.backspace}
          disabled={readOnly}
          onClick={() => dispatch({ type: 'number-key', field: field.id, key: 'backspace' })}
        >
          <span aria-hidden="true">⌫</span>
        </button>
        <button
          type="button"
          className={`${styles.key} ${styles.clearKey}`}
          style={{ minHeight: targetSize }}
          disabled={readOnly}
          onClick={() => dispatch({ type: 'number-clear', field: field.id })}
        >
          {S.clear}
        </button>
      </div>
      <p className={styles.hint}>{S.keyboardHint}</p>
    </div>
  );
}
