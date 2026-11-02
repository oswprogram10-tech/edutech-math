/** 부등호 고르기 위젯. 왼쪽 수·오른쪽 수 사이에 넣을 기호를 고른다. */
import type { TargetSize } from '../../../engine-sdk';
import type { CompareField, CompareFieldState, CompareSymbol, ResponseAction } from '../types';
import { responseStrings as S } from '../strings.ko';
import styles from '../ResponseView.module.css';

interface CompareWidgetProps {
  readonly field: CompareField;
  readonly state: CompareFieldState;
  readonly dispatch: (action: ResponseAction) => void;
  readonly readOnly: boolean;
  readonly targetSize: TargetSize;
}

const SYMBOLS: readonly CompareSymbol[] = ['<', '=', '>'];

export function CompareWidget({
  field,
  state,
  dispatch,
  readOnly,
  targetSize,
}: CompareWidgetProps) {
  return (
    <div
      className={styles.compare}
      role="group"
      aria-label={S.compareGroup}
      data-response-kind="compare"
      data-response-field={field.id}
    >
      <div className={styles.compareRow}>
        <span className={styles.compareValue}>{field.left}</span>
        <span className={styles.compareSlot} aria-hidden="true">
          {state.symbol ?? '?'}
        </span>
        <span className={styles.compareValue}>{field.right}</span>
      </div>
      <div className={styles.compareButtons}>
        {SYMBOLS.map((symbol) => (
          <button
            key={symbol}
            type="button"
            className={styles.compareButton}
            style={{ minWidth: targetSize, minHeight: targetSize }}
            aria-label={S.compareSymbols[symbol]}
            aria-pressed={state.symbol === symbol}
            disabled={readOnly}
            onClick={() => dispatch({ type: 'compare-set', field: field.id, symbol })}
          >
            {symbol}
          </button>
        ))}
      </div>
    </div>
  );
}
