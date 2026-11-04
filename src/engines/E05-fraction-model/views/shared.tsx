/**
 * T049 새 화면이 함께 쓰는 작은 조각들.
 *
 * 기존 View.tsx의 내부 부품은 건드리지 않기 위해(카드 결정 1) 새 화면용으로만 둔다.
 * 색은 E04 `FractionAreaView.tsx`의 곱셈 넓이 색을 그대로 쓴다.
 */
import type { ReactNode, RefObject } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../types';
import type { FractionModelAction, FractionModelConfig } from '../types';
import styles from '../View.module.css';

export const INK = '#1d2330';
export const BLUE = '#2f6fde';
export const YELLOW = '#b45309';
export const GREEN = '#215c2a';
export const PAPER = '#fbfaf6';
export const MUTED = '#5b6577';

export interface ModeProps<State> {
  readonly config: FractionModelConfig;
  readonly state: State;
  readonly dispatch: (action: FractionModelAction) => void;
  readonly cpa: 'C' | 'P' | 'A';
  readonly readOnly: boolean;
  readonly targetSize: 48 | 64;
}

export function ToolbarButton({
  children,
  onClick,
  pressed,
  disabled,
}: {
  children: ReactNode;
  onClick: () => void;
  pressed?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      className={styles.button}
      onClick={onClick}
      aria-pressed={pressed}
      disabled={disabled}
    >
      {children}
    </button>
  );
}

export function CanvasFrame({
  svgRef,
  label,
  children,
  tabIndex,
  onKeyDown,
}: {
  svgRef?: RefObject<SVGSVGElement>;
  label: string;
  children: ReactNode;
  tabIndex?: number;
  onKeyDown?: (event: ReactKeyboardEvent<SVGSVGElement>) => void;
}) {
  return (
    <svg
      ref={svgRef}
      className={styles.canvas}
      viewBox={`0 0 ${LOGICAL_WIDTH} ${LOGICAL_HEIGHT}`}
      preserveAspectRatio="xMidYMid meet"
      data-testid="fraction-canvas"
      role="img"
      aria-label={label}
      tabIndex={tabIndex}
      onKeyDown={onKeyDown}
    >
      <rect x={0} y={0} width={LOGICAL_WIDTH} height={LOGICAL_HEIGHT} fill={PAPER} />
      {children}
    </svg>
  );
}
