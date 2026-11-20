/** E20 조작 단추 하나: 단축키 표시(<kbd>)와 aria-keyshortcuts를 함께 단다. */
import type { Shortcut } from './shortcuts';
import type { RatioUi } from './useRatioUi';
import styles from './View.module.css';

interface ButtonProps {
  readonly id: string;
  readonly label: string;
  readonly shortcuts: readonly Shortcut[];
  readonly ui: RatioUi;
  readonly readOnly: boolean;
  readonly primary?: boolean;
}

export function ActionButton({ id, label, shortcuts, ui, readOnly, primary }: ButtonProps) {
  const shortcut = shortcuts.find((s) => s.id === id);
  if (!shortcut) return null;
  return (
    <button
      type="button"
      className={primary ? `${styles.button} ${styles.primary}` : styles.button}
      aria-label={label}
      aria-keyshortcuts={shortcut.code.replace('Digit', '')}
      data-action={id}
      disabled={readOnly}
      onClick={() => ui.send(shortcut.action)}
    >
      <span>{label}</span>
      <kbd className={styles.kbd} aria-hidden="true">
        {shortcut.label}
      </kbd>
    </button>
  );
}
