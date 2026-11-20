/**
 * E20 percent 조작 칸(SVG 밖). 안내 글, 키보드 도움말, 모두 지우기·처음으로.
 * 칸을 칠하는 조작은 판(PercentBoard)에서 한다.
 */
import { ActionButton } from './ActionButton';
import { shortcutsOf } from './shortcuts';
import { E20_STRINGS as S } from './strings.ko';
import type { PercentState } from './types';
import type { RatioUi } from './useRatioUi';
import styles from './View.module.css';

export interface PercentControlsProps {
  readonly state: PercentState;
  readonly ui: RatioUi;
  readonly readOnly: boolean;
}

export function PercentControls({ state, ui, readOnly }: PercentControlsProps) {
  const shortcuts = shortcutsOf(state);
  const common = { shortcuts, ui, readOnly };
  return (
    <div className={styles.sideStack} data-testid="ratio-controls">
      <p className={styles.instructions}>{S.percent.instructions}</p>
      {state.settings.editable ? (
        <>
          <p className={styles.instructions}>{S.percent.keyHelp}</p>
          <div className={styles.row} role="group" aria-label={S.controlsLabel}>
            <ActionButton id="clear" label={S.percent.buttons.clear} {...common} />
            <ActionButton id="reset" label={S.percent.buttons.reset} {...common} />
          </div>
        </>
      ) : null}
      <p className={styles.status} role="status" data-testid="ratio-message">
        {ui.message ?? ''}
      </p>
    </div>
  );
}
