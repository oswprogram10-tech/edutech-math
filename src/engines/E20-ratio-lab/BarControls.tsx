/**
 * E20 bar-model 조작 칸(SVG 밖). 값 칸(한 칸 크기·몫·전체·식)과 숫자 키패드(0–9, ⌫; 식 칸이면 연산 기호도).
 * 칸은 과제에 맞게 보인다: 전체가 알려졌으면 전체 칸을 숨기고, 한 사람 몫이 알려졌으면 그 칸을 고정해 보인다.
 * 칸을 Tab으로 오가며 물리 키보드로도 쓸 수 있다. 화면 키보드는 키패드로 대신하므로 입력 칸은 inputMode none이다.
 */
import { useState } from 'react';
import { ActionButton } from './ActionButton';
import { shortcutsOf } from './shortcuts';
import { E20_STRINGS as S } from './strings.ko';
import type { BarState } from './types';
import type { RatioUi } from './useRatioUi';
import styles from './View.module.css';

export interface BarControlsProps {
  readonly state: BarState;
  readonly ui: RatioUi;
  readonly readOnly: boolean;
}

interface Field {
  readonly key: string;
  readonly label: string;
  readonly value: string;
  readonly fixed: boolean;
  readonly send: (text: string) => void;
}

const OPERATORS = ['×', '÷', '+', '−', '(', ')', '/'] as const;

/** 물리 키보드에서 친 `*`·`x`·`-`를 식 기호로 바꾼다. */
function normalizeExpr(text: string): string {
  return text.replace(/[*xX]/g, '×').replace(/-/g, '−');
}

export function BarControls({ state, ui, readOnly }: BarControlsProps) {
  const { settings } = state;
  const symbols = settings.look === 'symbols';
  const shortcuts = shortcutsOf(state);
  const fields: Field[] = [];
  if (symbols) {
    fields.push({
      key: 'expr',
      label: S.bar.fields.expr,
      value: state.expr ?? '',
      fixed: false,
      send: (value) => ui.send({ type: 'set-expr', value: normalizeExpr(value) }),
    });
  } else {
    fields.push({
      key: 'unit',
      label: S.bar.fields.unit,
      value: state.unit ?? '',
      fixed: false,
      send: (value) => ui.send({ type: 'set-unit', value }),
    });
  }
  settings.parts.forEach((name, index) => {
    fields.push({
      key: `part-${index}`,
      label: S.bar.fields.share(name),
      value: state.partValues[index] ?? '',
      fixed: settings.known?.part === index,
      send: (value) => ui.send({ type: 'set-part', index, value }),
    });
  });
  if (settings.total === null) {
    fields.push({
      key: 'total',
      label: S.bar.fields.total,
      value: state.totalValue ?? '',
      fixed: false,
      send: (value) => ui.send({ type: 'set-total', value }),
    });
  }

  const editable = fields.filter((f) => !f.fixed);
  const [active, setActive] = useState<string | null>(null);
  const current = editable.find((f) => f.key === active) ?? editable[0];

  const append = (char: string) => current?.send(current.value + char);
  const backspace = () => current?.send(current.value.slice(0, -1));
  const pad = (label: string, aria: string, onClick: () => void, key: string) => (
    <button
      key={key}
      type="button"
      className={styles.button}
      aria-label={aria}
      data-key={key}
      disabled={readOnly || current === undefined}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
    >
      {label}
    </button>
  );

  return (
    <div className={styles.sideStack} data-testid="ratio-controls">
      <p className={styles.instructions}>
        {symbols ? S.bar.instructionsSymbols : S.bar.instructions}
      </p>
      <div className={styles.barFields} role="group" aria-label={S.controlsLabel}>
        {fields.map((field) => (
          <label key={field.key} className={styles.field}>
            <span className={styles.fieldName}>{field.label}</span>
            {field.fixed ? (
              <span
                className={styles.fixedValue}
                aria-label={`${field.label}, ${S.bar.fixedHint}`}
                data-field={field.key}
              >
                {field.value}
              </span>
            ) : (
              <input
                type="text"
                inputMode="none"
                autoComplete="off"
                className={
                  field.key === 'expr'
                    ? `${styles.numberInput} ${styles.exprInput}`
                    : styles.numberInput
                }
                aria-label={field.label}
                data-field={field.key}
                data-active={current?.key === field.key ? 'true' : 'false'}
                disabled={readOnly}
                value={field.value}
                onFocus={() => setActive(field.key)}
                onChange={(event) => field.send(event.target.value)}
              />
            )}
          </label>
        ))}
      </div>
      <div className={styles.keypad} role="group" aria-label={S.bar.keypadLabel}>
        {['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'].map((d) =>
          pad(d, d, () => append(d), `digit-${d}`),
        )}
        {pad('⌫', S.bar.backspace, backspace, 'backspace')}
        {symbols ? OPERATORS.map((op) => pad(op, op, () => append(op), `op-${op}`)) : null}
      </div>
      <div className={styles.row}>
        <ActionButton
          id="reset"
          label={S.bar.reset}
          shortcuts={shortcuts}
          ui={ui}
          readOnly={readOnly}
        />
      </div>
      <p className={styles.status} role="status" data-testid="ratio-message">
        {ui.message ?? ''}
      </p>
    </div>
  );
}
