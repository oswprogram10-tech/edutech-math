/**
 * 트레이 단추(단위·숫자 카드). 눌러도(Enter 포함) 되고 끌어서 판 위에 놓아도 된다.
 * 끄는 동안은 판 위에 반투명 그림(ghost)이 따라온다. 손을 뗄 때 놓은 점을 부모에게 알린다.
 */
import { useRef } from 'react';
import type { ReactNode, RefObject } from 'react';
import { distance, pointerToLogical, useDrag } from '../../../core/engine-sdk';
import type { Point } from '../../../core/engine-sdk';
import styles from '../View.module.css';
import { BOARD } from './layout';

/** 이 거리(논리 px)보다 적게 움직이면 끌기가 아니라 누름으로 본다. */
const TAP_DISTANCE = 8;

export interface TrayButtonProps {
  readonly svgRef: RefObject<SVGSVGElement>;
  readonly label: string;
  readonly action: string;
  readonly disabled?: boolean;
  readonly pressed?: boolean;
  readonly children: ReactNode;
  readonly onTap: () => void;
  readonly onDrop: (point: Point) => void;
  /** 끄는 동안 점을 알린다(끝나면 null). */
  readonly onGhost: (point: Point | null) => void;
}

export function TrayButton({
  svgRef,
  label,
  action,
  disabled = false,
  pressed,
  children,
  onTap,
  onDrop,
  onGhost,
}: TrayButtonProps) {
  const dragged = useRef(false);
  const drag = useDrag({
    disabled,
    getPoint: (event) => pointerToLogical(event, svgRef.current, BOARD),
    onStart: () => {
      dragged.current = false;
    },
    onMove: (info) => {
      if (distance(info.start, info.current) < TAP_DISTANCE) return;
      dragged.current = true;
      onGhost(info.current);
    },
    onEnd: (info) => {
      onGhost(null);
      if (dragged.current) onDrop(info.current);
    },
    onCancel: () => {
      dragged.current = false;
      onGhost(null);
    },
  });

  return (
    <button
      type="button"
      className={styles.trayButton}
      aria-label={label}
      aria-pressed={pressed}
      data-action={action}
      disabled={disabled}
      onClick={() => {
        // 끌어 놓은 뒤에 따라오는 click은 무시한다(누름·Enter만 단추 동작).
        if (dragged.current) {
          dragged.current = false;
          return;
        }
        onTap();
      }}
      {...drag.handlers}
    >
      {children}
    </button>
  );
}
