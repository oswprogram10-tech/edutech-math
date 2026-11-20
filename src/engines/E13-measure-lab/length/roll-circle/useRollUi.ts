/**
 * E13 roll-circle 조작 칸의 지역 상태(안내 글)와 조작 함수.
 * 조건이 안 맞는 조작은 이유를 글로 알리고 Action을 보내지 않는다.
 */
import { useState } from 'react';
import { E13_STRINGS as S } from '../../strings.ko';
import { rejectReason } from './reduce';
import type { RollReject } from './reduce';
import type { RollAction, RollState } from './types';

export interface RollUi {
  readonly message: string | null;
  readonly send: (action: RollAction) => boolean;
}

function wording(reason: RollReject): string {
  const text = S.roll.rejected;
  switch (reason) {
    case 'bad-diameter':
      return text.badDiameter;
    case 'already-rolled':
      return text.alreadyRolled;
    case 'not-rolled':
      return text.notRolled;
    case 'no-stick-tool':
      return text.noStickTool;
    case 'stick-max':
      return text.stickMax;
    case 'stick-min':
      return text.stickMin;
    case 'no-log':
      return text.noLog;
    case 'logged':
      return text.logged;
    case 'log-full':
      return text.logFull;
    case 'nothing':
      return text.nothing;
    default:
      return text.readOnly;
  }
}

export function useRollUi(
  state: RollState,
  dispatch: (action: RollAction) => void,
  readOnly: boolean,
): RollUi {
  const [message, setMessage] = useState<string | null>(null);
  const send = (action: RollAction): boolean => {
    if (readOnly) return false;
    const reason = rejectReason(state, action);
    if (reason === 'same') return false;
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
