import { fireEvent } from '@testing-library/react';

export interface PointerInit {
  pointerId?: number;
  isPrimary?: boolean;
  button?: number;
  clientX?: number;
  clientY?: number;
}

/**
 * jsdom에는 PointerEvent가 없다. React가 읽는 pointerId·isPrimary만 붙인
 * MouseEvent를 만들어 pointer 이벤트처럼 보낸다.
 */
export function firePointer(
  element: Element,
  type: 'pointerdown' | 'pointermove' | 'pointerup' | 'pointercancel',
  init: PointerInit = {},
): void {
  const event = new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    clientX: init.clientX ?? 0,
    clientY: init.clientY ?? 0,
    button: init.button ?? 0,
  });
  Object.defineProperty(event, 'pointerId', { value: init.pointerId ?? 1 });
  Object.defineProperty(event, 'isPrimary', { value: init.isPrimary ?? true });
  fireEvent(element, event);
}
