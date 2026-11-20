/**
 * E13 length 조작 칸의 지역 상태(안내 글·끌고 있는 그림·고른 숫자 카드)와 조작 함수.
 * 거절된 조작은 이유를 글로 알린다. 끌기 도중 좌표는 지역 상태에만 두고 Action에는 최종 위치만 싣는다.
 */
import { useState } from 'react';
import type { Point } from '../../../core/engine-sdk';
import { Rational } from '../../../core/math';
import { E13_STRINGS as S } from '../strings.ko';
import { unitLength } from '../units';
import { toNumber } from '../rat';
import { BAND_H, cmOfX, geoOf, tickOfX } from './layout';
import { reduceLength } from './reduce';
import { endStart, pieceStart, snapStart } from './settings';
import type { LengthAction, MeasureState } from './types';

/** 트레이에서 끌고 있는 그림(판 위에 반투명으로 따라온다). */
export type Ghost =
  | { readonly kind: 'unit'; readonly unit: string; readonly x: number; readonly y: number }
  | { readonly kind: 'card'; readonly value: number; readonly x: number; readonly y: number };

export interface LengthUi {
  readonly message: string | null;
  readonly ghost: Ghost | null;
  readonly setGhost: (ghost: Ghost | null) => void;
  readonly card: number | null;
  readonly selectCard: (value: number) => void;
  readonly send: (action: LengthAction) => boolean;
  /** 단추·Enter: 마지막 조각 끝에 붙여 놓는다. */
  readonly addAtEnd: (unit: string) => void;
  /** 트레이에서 끌어 띠 위에 놓았을 때(점은 논리 좌표). 띠 밖이면 아무것도 하지 않는다. */
  readonly dropUnit: (unit: string, point: Point) => void;
  /** 놓은 조각을 끌어 옮겼을 때. 띠 밖에 놓으면 지운다. */
  readonly dropPiece: (index: number, rawStartCm: number, pointY: number) => void;
  readonly nudge: (index: number, deltaCm: number) => void;
  readonly removeLast: () => void;
  readonly removeAt: (index: number) => void;
  /** 숫자 카드를 끌어 놓았을 때(가장 가까운 눈금). */
  readonly dropCard: (value: number, point: Point) => void;
  readonly placeLabel: (tick: number, value: number) => void;
  /** 선택한 카드를 눈금에 놓는다. */
  readonly placeSelected: (tick: number) => void;
}

function rejection(state: MeasureState, action: LengthAction): string {
  const text = S.length.rejected;
  if (state.rulerMade && action.type !== 'label') return text.ruler;
  if (action.type === 'add' && state.pieces.length >= 40) return text.full;
  if (action.type === 'make-ruler') return text.notReady;
  if (action.type === 'add') return text.out;
  if (action.type === 'move') return text.out;
  return text.same;
}

/** 띠 안(위아래 여유 포함)에 놓았는가. */
function inBand(state: MeasureState, y: number): boolean {
  const geo = geoOf(state);
  return y >= geo.bandTop - 50 && y <= geo.bandTop + BAND_H + 50;
}

export function useLengthUi(
  state: MeasureState,
  dispatch: (action: LengthAction) => void,
  readOnly: boolean,
): LengthUi {
  const [message, setMessage] = useState<string | null>(null);
  const [ghost, setGhost] = useState<Ghost | null>(null);
  const [card, setCard] = useState<number | null>(null);

  const send = (action: LengthAction): boolean => {
    if (readOnly) return false;
    if (reduceLength(state, action) === state) {
      setMessage(rejection(state, action));
      return false;
    }
    setMessage(null);
    dispatch(action);
    return true;
  };

  const addAtEnd = (unit: string) => {
    const start = endStart(state, unit);
    if (start === null) {
      if (!readOnly) setMessage(state.rulerMade ? S.length.rejected.ruler : S.length.rejected.out);
      return;
    }
    send({ type: 'add', unit, start: start.toString() });
  };

  const dropUnit = (unit: string, point: Point) => {
    if (!inBand(state, point.y)) return;
    const length = unitLength(unit);
    if (length === null) return;
    const raw = cmOfX(geoOf(state), point.x) - toNumber(length) / 2;
    send({ type: 'add', unit, start: snapStart(state, unit, raw).toString() });
  };

  const dropPiece = (index: number, rawStartCm: number, pointY: number) => {
    const piece = state.pieces[index];
    if (!piece) return;
    if (!inBand(state, pointY)) {
      send({ type: 'remove', index });
      return;
    }
    const start = snapStart(state, piece.unit, rawStartCm, index);
    if (start.toString() !== piece.start) send({ type: 'move', index, start: start.toString() });
  };

  const nudge = (index: number, deltaCm: number) => {
    const piece = state.pieces[index];
    if (!piece) return;
    const start = pieceStart(piece).add(toRational(deltaCm));
    send({ type: 'move', index, start: start.toString() });
  };

  const removeAt = (index: number) => {
    send({ type: 'remove', index });
  };

  const removeLast = () => {
    if (state.pieces.length === 0) return;
    removeAt(state.pieces.length - 1);
  };

  const placeLabel = (tick: number, value: number) => {
    send({ type: 'label', tick, value });
  };

  const dropCard = (value: number, point: Point) => {
    const geo = geoOf(state);
    if (point.y < geo.slotTop - 50 || point.y > geo.slotBottom + 50) return;
    placeLabel(tickOfX(point.x), value);
  };

  const placeSelected = (tick: number) => {
    if (card === null) return;
    placeLabel(tick, card);
  };

  return {
    message,
    ghost,
    setGhost,
    card,
    selectCard: (value) => setCard((current) => (current === value ? null : value)),
    send,
    addAtEnd,
    dropUnit,
    dropPiece,
    nudge,
    removeLast,
    removeAt,
    dropCard,
    placeLabel,
    placeSelected,
  };
}

function toRational(deltaCm: number) {
  return Rational.of(Math.round(deltaCm * 2), 2);
}
