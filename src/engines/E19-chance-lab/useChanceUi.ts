/**
 * E19 조작 칸의 지역 상태(안내 글·기둥 고르기·예측 칸)와 키보드 처리.
 * 거절된 조작은 이유를 글로 알린다. 끌기 도중 좌표는 판 컴포넌트의 지역 상태에만 둔다.
 */
import { useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import { Rational } from '../../core/math';
import { wordsSlotName } from './layout';
import { reduce } from './reduce';
import { parseRational } from './settings';
import { E19_STRINGS as S } from './strings.ko';
import type { ChanceAction, ChanceState } from './types';

export const DRAFT_MAX = 14;

/** View가 시행마다 새 seed를 만든다(reduce는 순수라 난수를 쓰지 않는다). */
export function newSeed(): number {
  const cryptoApi = typeof globalThis.crypto === 'object' ? globalThis.crypto : undefined;
  if (cryptoApi !== undefined && typeof cryptoApi.getRandomValues === 'function') {
    return cryptoApi.getRandomValues(new Uint32Array(1))[0] ?? 0;
  }
  return Math.floor(Math.random() * 2 ** 32);
}

export interface ChanceUi {
  readonly message: string | null;
  readonly send: (action: ChanceAction) => boolean;
  /** leveling: 키보드로 고른 기둥, 집은 기둥. */
  readonly cursor: number;
  readonly holding: number | null;
  readonly moveCursor: (delta: -1 | 1) => void;
  readonly pickOrPlace: () => void;
  readonly cancelHold: () => void;
  /** seesaw·outlier: 한 칸씩 움직이기. */
  readonly nudgeFulcrum: (delta: -1 | 1) => void;
  readonly nudgeValue: (delta: -1 | 1) => void;
  /** outlier: 예측 칸. */
  readonly draft: string;
  readonly typeDraft: (text: string) => void;
  readonly backspaceDraft: () => void;
  readonly submitPrediction: () => void;
  /** words: 키보드·단추로 고른 카드와 칸. */
  readonly wordsCard: number;
  readonly wordsSlot: number;
  readonly selectWordsCard: (index: number) => void;
  readonly moveWordsCard: (delta: -1 | 1) => void;
  readonly moveWordsSlot: (delta: -1 | 1) => void;
  readonly placeWords: () => void;
  readonly unplaceWords: () => void;
  /** spinner·simulate: 고른 회전판 칸. */
  readonly selectedSector: number;
  readonly selectSector: (index: number) => void;
  readonly moveSector: (delta: -1 | 1) => void;
  readonly spin: () => void;
  readonly run: (batch: number) => void;
  readonly tell: (text: string | null) => void;
  readonly onWrapKeyDown: (event: ReactKeyboardEvent<HTMLElement>) => void;
}

function rejection(state: ChanceState, action: ChanceAction): string {
  if (state.mode === 'words' || state.mode === 'spinner' || state.mode === 'simulate') {
    return rejectionOther(state, action);
  }
  if (state.mode === 'leveling') {
    if (action.type !== 'move') return '';
    if (action.from === action.to) return S.leveling.rejected.same;
    return (state.heights[action.from] ?? 0) <= 0
      ? S.leveling.rejected.empty
      : S.leveling.rejected.full;
  }
  if (state.mode === 'seesaw') {
    return action.type === 'set-fulcrum' ? S.seesaw.rejected.edge : '';
  }
  if (action.type === 'set-value') {
    return state.requirePrediction && state.prediction === null
      ? S.outlier.rejected.locked
      : S.outlier.rejected.range;
  }
  if (action.type === 'predict') return S.outlier.rejected.outOfRange;
  return '';
}

function rejectionOther(state: ChanceState, action: ChanceAction): string {
  if (state.mode === 'words') {
    if (action.type === 'place') return S.words.rejected.same;
    if (action.type === 'unplace') return S.words.rejected.none;
    return '';
  }
  if (state.mode !== 'spinner' && state.mode !== 'simulate') return '';
  if (!state.editable) {
    return action.type.startsWith('sector-') || action.type === 'marble-set'
      ? S.device.rejected.locked
      : '';
  }
  if (action.type === 'sector-size') return S.device.rejected.size;
  if (action.type === 'sector-add' || action.type === 'sector-remove') {
    return S.device.rejected.sectors;
  }
  if (action.type === 'marble-set') return S.device.rejected.marbles;
  return '';
}

function waitingForPrediction(state: ChanceState): boolean {
  return state.mode === 'outlier' && state.requirePrediction && state.prediction === null;
}

export function useChanceUi(
  state: ChanceState,
  dispatch: (action: ChanceAction) => void,
  readOnly: boolean,
): ChanceUi {
  const [message, setMessage] = useState<string | null>(null);
  const [cursorRaw, setCursor] = useState(0);
  const [holding, setHolding] = useState<number | null>(null);
  const [draft, setDraft] = useState('');
  const [wordsCardRaw, setWordsCard] = useState(0);
  const [wordsSlotRaw, setWordsSlot] = useState<number | null>(null);
  const [selectedRaw, setSelected] = useState(0);

  const count = state.mode === 'leveling' ? state.heights.length : 1;
  const cursor = Math.min(cursorRaw, count - 1);
  const wordsCount = state.mode === 'words' ? state.cards.length : 1;
  const slotCount = state.mode === 'words' ? state.slotValues.length : 1;
  const wordsCard = Math.min(wordsCardRaw, wordsCount - 1);
  const wordsSlot = Math.min(wordsSlotRaw ?? Math.floor(slotCount / 2), slotCount - 1);
  const sectorCount =
    state.mode !== 'words' && 'device' in state && state.device.type === 'spinner'
      ? state.device.sectors.length
      : 1;
  const selectedSector = Math.min(selectedRaw, sectorCount - 1);

  const send = (action: ChanceAction): boolean => {
    if (readOnly || state.error !== null) return false;
    if (reduce(state, action) === state) {
      const text = rejection(state, action);
      setMessage(text === '' ? null : text);
      return false;
    }
    setMessage(null);
    dispatch(action);
    return true;
  };

  const moveCursor = (delta: -1 | 1) => {
    if (state.mode !== 'leveling') return;
    const next = Math.max(0, Math.min(count - 1, cursor + delta));
    setCursor(next);
    const name = state.names[next] ?? '';
    setMessage(holding === null ? S.leveling.cursorText(name) : S.leveling.holdingText(name));
  };

  const cancelHold = () => {
    setHolding(null);
    setMessage(null);
  };

  const pickOrPlace = () => {
    if (state.mode !== 'leveling' || readOnly) return;
    if (holding === null) {
      if ((state.heights[cursor] ?? 0) <= 0) {
        setMessage(S.leveling.rejected.empty);
        return;
      }
      setHolding(cursor);
      setMessage(S.leveling.holdingText(state.names[cursor] ?? ''));
      return;
    }
    if (send({ type: 'move', from: holding, to: cursor })) setHolding(null);
  };

  const wordsMessage = (card: number, slot: number) => {
    if (state.mode !== 'words') return;
    const text = state.cards[card]?.text;
    setMessage(text === undefined ? null : S.words.cursorText(text, wordsSlotName(state, slot)));
  };
  const selectWordsCard = (index: number) => {
    if (state.mode !== 'words') return;
    const next = Math.max(0, Math.min(wordsCount - 1, index));
    setWordsCard(next);
    wordsMessage(next, wordsSlot);
  };
  const moveWordsCard = (delta: -1 | 1) => selectWordsCard(wordsCard + delta);
  const moveWordsSlot = (delta: -1 | 1) => {
    const next = Math.max(0, Math.min(slotCount - 1, wordsSlot + delta));
    setWordsSlot(next);
    wordsMessage(wordsCard, next);
  };
  const placeWords = () => {
    if (state.mode !== 'words') return;
    const card = state.cards[wordsCard];
    const slot = state.slotValues[wordsSlot];
    if (card === undefined || slot === undefined) return;
    send({ type: 'place', cardId: card.id, slot });
  };
  const unplaceWords = () => {
    if (state.mode !== 'words') return;
    const card = state.cards[wordsCard];
    if (card !== undefined) send({ type: 'unplace', cardId: card.id });
  };
  const selectSector = (index: number) => {
    setSelected(Math.max(0, Math.min(sectorCount - 1, index)));
    setMessage(S.device.selectedText(Math.max(0, Math.min(sectorCount - 1, index)) + 1));
  };
  const moveSector = (delta: -1 | 1) => selectSector(selectedSector + delta);
  const spin = () => {
    send({ type: 'spin', seed: newSeed() });
  };
  const run = (batch: number) => {
    send({ type: 'run', batch, seed: newSeed() });
  };

  const nudgeFulcrum = (delta: -1 | 1) => {
    if (state.mode !== 'seesaw') return;
    const step = Rational.parse(state.step);
    const next = Rational.parse(state.fulcrum).add(delta === 1 ? step : step.neg());
    send({ type: 'set-fulcrum', value: next.toString() });
  };

  const nudgeValue = (delta: -1 | 1) => {
    if (state.mode !== 'outlier') return;
    send({ type: 'set-value', value: (state.values[state.dragIndex] ?? 0) + delta });
  };

  const typeDraft = (text: string) => {
    if (readOnly) return;
    setMessage(null);
    setDraft((current) => (current.length >= DRAFT_MAX ? current : current + text));
  };
  const backspaceDraft = () => {
    setMessage(null);
    setDraft((current) => current.slice(0, -1));
  };

  const submitPrediction = () => {
    if (state.mode !== 'outlier' || readOnly) return;
    const value = parseRational(draft);
    if (value === null) {
      setMessage(S.outlier.rejected.bad);
      return;
    }
    if (send({ type: 'predict', value: draft.trim() })) setDraft('');
  };

  const onWrapKeyDown = (event: ReactKeyboardEvent<HTMLElement>) => {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (!waitingForPrediction(state)) return;
    const onButton = event.target instanceof HTMLElement && event.target.tagName === 'BUTTON';
    if (/^[0-9./]$/.test(event.key)) {
      event.preventDefault();
      typeDraft(event.key);
    } else if (event.key === ' ' && !onButton) {
      event.preventDefault();
      typeDraft(' ');
    } else if (event.key === 'Backspace') {
      event.preventDefault();
      backspaceDraft();
    } else if (event.key === 'Enter' && !onButton) {
      event.preventDefault();
      submitPrediction();
    }
  };

  return {
    message,
    send,
    cursor,
    holding,
    moveCursor,
    pickOrPlace,
    cancelHold,
    nudgeFulcrum,
    nudgeValue,
    draft,
    typeDraft,
    backspaceDraft,
    submitPrediction,
    wordsCard,
    wordsSlot,
    selectWordsCard,
    moveWordsCard,
    moveWordsSlot,
    placeWords,
    unplaceWords,
    selectedSector,
    selectSector,
    moveSector,
    spin,
    run,
    tell: setMessage,
    onWrapKeyDown,
  };
}
