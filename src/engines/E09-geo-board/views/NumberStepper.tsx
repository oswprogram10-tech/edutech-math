/**
 * 어림·읽은 값 입력 부품(T102).
 *
 * −10 · −1 · +1 · +10 단추와 값 칸. 처음 값은 "?"다. 값은 0~360 정수만 다룬다.
 * 단추는 Tab으로 가고 Enter/Space로 누른다.
 */
import { clamp } from '../../../core/engine-sdk';
import { geoBoardStrings as S } from '../strings.ko';

export interface NumberStepperProps {
  readonly label: string;
  readonly value: number | null;
  readonly onChange: (value: number) => void;
  readonly disabled?: boolean;
  readonly testId?: string;
}

const buttonStyle = {
  minWidth: 48,
  minHeight: 48,
  borderWidth: 2,
  borderStyle: 'solid',
  borderColor: '#2f6fde',
  borderRadius: 10,
  background: '#ffffff',
  color: '#1d2330',
  font: 'inherit',
  fontWeight: 700,
  cursor: 'pointer',
} as const;

const disabledStyle = {
  borderColor: '#aab4c6',
  color: '#7a8497',
  cursor: 'not-allowed',
} as const;

function change(value: number | null, amount: number, onChange: (next: number) => void): void {
  onChange(clamp((value ?? 0) + amount, 0, 360));
}

export function NumberStepper({
  label,
  value,
  onChange,
  disabled = false,
  testId,
}: NumberStepperProps) {
  const step = (amount: number, text: string) => (
    <button
      type="button"
      aria-label={amount < 0 ? S.angle.decrease(label, -amount) : S.angle.increase(label, amount)}
      disabled={disabled}
      style={{ ...buttonStyle, ...(disabled ? disabledStyle : null) }}
      onClick={() => change(value, amount, onChange)}
    >
      {text}
    </button>
  );

  return (
    <div
      style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}
      data-testid={testId}
    >
      <span style={{ minWidth: 92, color: '#5b6577', fontWeight: 700 }}>{label}</span>
      {step(-10, '−10')}
      {step(-1, '−1')}
      <output
        aria-label={label}
        style={{
          minWidth: 64,
          minHeight: 48,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: '2px solid #d7deea',
          borderRadius: 10,
          background: '#fbfcff',
          color: value === null ? '#7a8497' : '#1d2330',
          fontWeight: 800,
          fontSize: '1.1rem',
        }}
      >
        {value === null ? S.angle.valueUnknown : value}
      </output>
      {step(1, '+1')}
      {step(10, '+10')}
    </div>
  );
}
