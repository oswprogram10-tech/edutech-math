/**
 * E13 capacity 조작 칸의 지역 상태(안내 글)와 조작 함수.
 * 조건이 안 맞는 조작은 이유를 글로 알리고 Action을 보내지 않는다.
 */
import { useState } from 'react';
import { E13_STRINGS as S } from '../strings.ko';
import { rejectReason } from './reduce';
import type { CapacityReject } from './reduce';
import type { CapacityAction, CapacityState } from './types';

export interface CapacityUi {
  readonly message: string | null;
  readonly send: (action: CapacityAction) => boolean;
}

function wording(reason: CapacityReject): string {
  const text = S.capacity.rejected;
  switch (reason) {
    case 'full':
      return text.full;
    case 'empty':
      return text.empty;
    case 'same':
      return text.same;
    case 'source-empty':
      return text.sourceEmpty;
    case 'target-full':
      return text.targetFull;
    default:
      return text.other;
  }
}

export function useCapacityUi(
  state: CapacityState,
  dispatch: (action: CapacityAction) => void,
  readOnly: boolean,
): CapacityUi {
  const [message, setMessage] = useState<string | null>(null);
  const send = (action: CapacityAction): boolean => {
    if (readOnly) return false;
    const reason = rejectReason(state, action);
    if (reason !== 'ok') {
      setMessage(wording(reason));
      return false;
    }
    setMessage(null);
    dispatch(action);
    return true;
  };
  return { message, send };
}
