/**
 * E13 unit-train 조작 칸의 지역 상태(안내 글)와 조작 함수.
 * 조건이 안 맞는 조작은 이유를 글로 알리고 Action을 보내지 않는다.
 */
import { useState } from 'react';
import { E13_STRINGS as S } from '../strings.ko';
import { reduceTrain } from './reduce';
import type { TrainAction, TrainState } from './types';

export interface TrainUi {
  readonly message: string | null;
  readonly send: (action: TrainAction) => boolean;
}

function rejection(state: TrainState, action: TrainAction): string {
  const text = S.train.rejected;
  switch (action.type) {
    case 'promote':
      return text.promote;
    case 'unpack':
      return text.unpack;
    case 'unpack-small':
      return text.unpackSmall;
    case 'take-away':
      if (state.op !== 'sub') return text.notSub;
      return state.tookAway ? text.tookAway : text.takeAway;
    default:
      return text.takeAway;
  }
}

export function useTrainUi(
  state: TrainState,
  dispatch: (action: TrainAction) => void,
  readOnly: boolean,
): TrainUi {
  const [message, setMessage] = useState<string | null>(null);
  const send = (action: TrainAction): boolean => {
    if (readOnly) return false;
    if (reduceTrain(state, action) === state) {
      if (action.type !== 'reset') setMessage(rejection(state, action));
      return false;
    }
    setMessage(null);
    dispatch(action);
    return true;
  };
  return { message, send };
}
