/**
 * E20 조작 칸(SVG 밖). 단추마다 단축키 하나(<kbd>)가 있고 키보드로 모두 닿는다.
 * rate·percent 조작 칸은 RateControls·PercentControls.
 * mix: 우유·시럽 넣기/빼기, 모두 ×k, 처음으로. resize: 가로·세로 한 칸씩, 둘 다 +n/×k, 담기, 처음으로.
 */
import { sameShape } from './observe';
import { ActionButton } from './ActionButton';
import { shortcutsOf } from './shortcuts';
import type { Shortcut } from './shortcuts';
import { E20_STRINGS as S } from './strings.ko';
import { PercentControls } from './PercentControls';
import { RateControls } from './RateControls';
import type { RatioAction, RatioState } from './types';
import type { RatioUi } from './useRatioUi';
import styles from './View.module.css';

export interface ControlsProps {
  readonly state: RatioState;
  readonly dispatch: (action: RatioAction) => void;
  readonly ui: RatioUi;
  readonly readOnly: boolean;
}

export function Controls({ state, ui, readOnly }: ControlsProps) {
  if (state.mode === 'rate') return <RateControls state={state} ui={ui} readOnly={readOnly} />;
  if (state.mode === 'percent')
    return <PercentControls state={state} ui={ui} readOnly={readOnly} />;
  const shortcuts = shortcutsOf(state);
  const common = { shortcuts, ui, readOnly };
  const factors = state.settings.scaleFactors;
  const status = (
    <p className={styles.status} role="status" data-testid="ratio-message">
      {ui.message ?? ''}
    </p>
  );

  if (state.mode === 'mix') {
    return (
      <div className={styles.sideStack} data-testid="ratio-controls">
        <p className={styles.instructions}>{S.mix.instructions}</p>
        {state.settings.hasCup ? (
          <div className={styles.row} role="group" aria-label={S.controlsLabel}>
            <ActionButton id="milk-add" label={S.mix.buttons.milkAdd} {...common} />
            <ActionButton id="milk-remove" label={S.mix.buttons.milkRemove} {...common} />
            <ActionButton id="syrup-add" label={S.mix.buttons.syrupAdd} {...common} />
            <ActionButton id="syrup-remove" label={S.mix.buttons.syrupRemove} {...common} />
            {factors.map((k) => (
              <ScaleButton key={k} k={k} ui={ui} readOnly={readOnly} shortcuts={shortcuts} />
            ))}
            <ActionButton id="reset" label={S.mix.buttons.reset} {...common} />
          </div>
        ) : null}
        {status}
      </div>
    );
  }

  const same = sameShape(state.size, state.base);
  return (
    <div className={styles.sideStack} data-testid="ratio-controls">
      <p className={styles.instructions}>{S.resize.instructions}</p>
      <div className={styles.row}>
        <p className={styles.made} data-testid="ratio-size">
          {S.resize.sizeText(state.size.w, state.size.h)}
        </p>
        {state.settings.showVerdict ? (
          <p className={styles.verdict} role="status" data-testid="ratio-verdict" data-same={same}>
            {same ? S.resize.verdictSame : S.resize.verdictDiffer}
          </p>
        ) : null}
      </div>
      <div className={styles.row} role="group" aria-label={S.controlsLabel}>
        <ActionButton id="w-minus" label={S.resize.buttons.widthMinus} {...common} />
        <ActionButton id="w-plus" label={S.resize.buttons.widthPlus} {...common} />
        <ActionButton id="h-minus" label={S.resize.buttons.heightMinus} {...common} />
        <ActionButton id="h-plus" label={S.resize.buttons.heightPlus} {...common} />
        <ActionButton
          id="add-both"
          label={S.resize.buttons.addBoth(state.settings.addStep)}
          {...common}
        />
        {factors.map((k) => (
          <ScaleButton key={k} k={k} ui={ui} readOnly={readOnly} shortcuts={shortcuts} resize />
        ))}
        <ActionButton id="save" label={S.resize.buttons.save} {...common} primary />
        <ActionButton id="reset" label={S.resize.buttons.reset} {...common} />
      </div>
      {status}
    </div>
  );
}

interface ScaleProps {
  readonly k: number;
  readonly ui: RatioUi;
  readonly readOnly: boolean;
  readonly shortcuts: readonly Shortcut[];
  readonly resize?: boolean;
}

/** ×k 단추. k가 9보다 크면 단축키가 없어 직접 만든다. */
function ScaleButton({ k, ui, readOnly, shortcuts, resize = false }: ScaleProps) {
  const label = resize ? S.resize.buttons.scale(k) : S.mix.buttons.scale(k);
  const shortcut = shortcuts.find((s) => s.id === `scale-${k}`);
  return (
    <button
      type="button"
      className={styles.button}
      aria-label={label}
      aria-keyshortcuts={shortcut?.label}
      data-action={`scale-${k}`}
      disabled={readOnly}
      onClick={() => ui.send({ type: 'scale', k })}
    >
      <span>{label}</span>
      {shortcut ? (
        <kbd className={styles.kbd} aria-hidden="true">
          {shortcut.label}
        </kbd>
      ) : null}
    </button>
  );
}
