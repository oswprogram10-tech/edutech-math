/** E13 조작 칸 공용 단추(최소 터치 타깃은 View.module.css의 --target). */
import styles from './View.module.css';

export interface ButtonProps {
  readonly label: string;
  readonly onClick: () => void;
  readonly disabled?: boolean;
  readonly primary?: boolean;
  readonly action: string;
  readonly pressed?: boolean;
}

export function Btn({
  label,
  onClick,
  disabled = false,
  primary = false,
  action,
  pressed,
}: ButtonProps) {
  return (
    <button
      type="button"
      className={primary ? `${styles.button} ${styles.primary}` : styles.button}
      aria-label={label}
      aria-pressed={pressed}
      data-action={action}
      disabled={disabled}
      onClick={onClick}
    >
      {label}
    </button>
  );
}
