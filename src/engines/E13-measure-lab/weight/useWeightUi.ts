/**
 * E13 weight 조작 칸의 지역 상태(고른 물건·예측 후보·안내 글)와 조작 함수.
 * 조건이 안 맞는 조작은 이유를 글로 알리고 Action을 보내지 않는다.
 */
import { useState } from 'react';
import { E13_STRINGS as S } from '../strings.ko';
import { rejectReason } from './reduce';
import type { WeightReject } from './reduce';
import type { WeightAction, WeightState } from './types';

export interface WeightUi {
  readonly message: string | null;
  /** 조작 칸·판에서 고른 물건(아직 Action이 아니다). */
  readonly selected: string | null;
  /** 예측 후보(아직 [예측하기]를 누르지 않았다). */
  readonly candidate: string | null;
  readonly select: (id: string | null) => void;
  readonly pickCandidate: (id: string) => void;
  readonly send: (action: WeightAction) => boolean;
  /** 고른 물건을 그곳에 놓는다(고른 물건이 없으면 안내 글만). */
  readonly placeSelected: (pan: 'left' | 'right' | 'shelf' | 'spring') => boolean;
  readonly submitPrediction: () => boolean;
  /** 판에서 알려 주는 안내 글. */
  readonly notify: (text: string) => void;
}

function wording(reason: WeightReject): string {
  const text = S.weight.rejected;
  switch (reason) {
    case 'predict-first':
      return text.predictFirst;
    case 'no-tool':
      return text.noTool;
    case 'same':
      return text.same;
    case 'pan-busy':
      return text.panBusy;
    case 'clips-on-right':
      return text.clipsOnRight;
    case 'object-on-right':
      return text.objectOnRight;
    case 'no-clips':
      return text.noClips;
    case 'clip-max':
      return text.clipMax;
    case 'clip-min':
      return text.clipMin;
    case 'locked':
      return text.locked;
    default:
      return text.other;
  }
}

export function useWeightUi(
  state: WeightState,
  dispatch: (action: WeightAction) => void,
  readOnly: boolean,
): WeightUi {
  const [message, setMessage] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [candidate, setCandidate] = useState<string | null>(null);

  const send = (action: WeightAction): boolean => {
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

  const placeSelected = (pan: 'left' | 'right' | 'shelf' | 'spring'): boolean => {
    if (readOnly) return false;
    if (selected === null) {
      setMessage(S.weight.rejected.pickFirst);
      return false;
    }
    return send(
      pan === 'spring' ? { type: 'hang', id: selected } : { type: 'place', id: selected, pan },
    );
  };

  const submitPrediction = (): boolean => {
    if (readOnly) return false;
    if (candidate === null) {
      setMessage(S.weight.rejected.noPrediction);
      return false;
    }
    return send({ type: 'predict', id: candidate });
  };

  return {
    message,
    selected,
    candidate,
    select: setSelected,
    pickCandidate: setCandidate,
    send,
    placeSelected,
    submitPrediction,
    notify: setMessage,
  };
}
