/** E06 조작 칸의 지역 상태(고른 수 칸·쓰는 중인 수·안내 글)와 키보드 처리. */
import { useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import { canRemove, canRemoveBoth, hasBox, isLocked, parseAmount } from './reduce';
import { balanceStrings as S } from './strings.ko';
import type { BalanceAction, BalanceSideName, BalanceState } from './types';

export type Field = 'try' | 'amount';

export interface BalanceUi {
  readonly tryAvailable: boolean;
  readonly amountAvailable: boolean;
  readonly active: Field;
  readonly tryText: string;
  readonly amountText: string;
  readonly message: string | null;
  readonly disabled: boolean;
  readonly select: (field: Field) => void;
  readonly typeDigit: (digit: string) => void;
  readonly backspace: () => void;
  readonly submitTry: () => void;
  readonly both: (op: 'add' | 'remove') => void;
  readonly one: (op: 'add' | 'remove', side: BalanceSideName) => void;
  readonly reset: () => void;
  readonly onKeyDown: (event: ReactKeyboardEvent<HTMLElement>) => void;
}

function append(text: string, digit: string): string {
  if (text.length >= 3) return text;
  return text === '0' ? digit : text + digit;
}

export function useBalanceUi(
  state: BalanceState,
  dispatch: (action: BalanceAction) => void,
  readOnly: boolean,
): BalanceUi {
  const [picked, setPicked] = useState<Field>('try');
  const [tryText, setTryText] = useState('');
  const [amountText, setAmountText] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  const locked = isLocked(state);
  const disabled = readOnly || locked;
  const tryAvailable = state.settings.allowTryValue && hasBox(state);
  const amountAvailable = state.settings.allowBothSides || state.settings.allowOneSide;
  const active: Field = picked === 'try' && !tryAvailable ? 'amount' : picked;

  const typeDigit = (digit: string) => {
    if (disabled) return;
    setMessage(null);
    if (active === 'try') setTryText((text) => append(text, digit));
    else setAmountText((text) => append(text, digit));
  };
  const backspace = () => {
    if (disabled) return;
    setMessage(null);
    if (active === 'try') setTryText((text) => text.slice(0, -1));
    else setAmountText((text) => text.slice(0, -1));
  };

  const submitTry = () => {
    if (disabled || !tryAvailable) return;
    if (tryText === '') {
      setMessage(S.tryBlock.empty);
      return;
    }
    setMessage(null);
    dispatch({ type: 'try', value: tryText });
  };

  const both = (op: 'add' | 'remove') => {
    if (disabled) return;
    const n = parseAmount(amountText);
    if (n === null) {
      setMessage(S.amount.invalid);
      return;
    }
    if (op === 'remove' && !canRemoveBoth(state, n)) {
      setMessage(S.cannotRemove);
      return;
    }
    setMessage(null);
    dispatch({ type: 'both', op, n: String(n) });
  };

  const one = (op: 'add' | 'remove', side: BalanceSideName) => {
    if (disabled) return;
    const n = parseAmount(amountText);
    if (n === null) {
      setMessage(S.amount.invalid);
      return;
    }
    if (op === 'remove' && !canRemove(state[side], n)) {
      setMessage(S.cannotRemove);
      return;
    }
    setMessage(null);
    dispatch({ type: 'one', op, side, n: String(n) });
  };

  const reset = () => {
    if (readOnly) return;
    setMessage(null);
    dispatch({ type: 'reset' });
  };

  const onKeyDown = (event: ReactKeyboardEvent<HTMLElement>) => {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (/^[0-9]$/.test(event.key)) {
      event.preventDefault();
      typeDigit(event.key);
    } else if (event.key === 'Backspace') {
      event.preventDefault();
      backspace();
    } else if (event.key === 'Enter') {
      // 단추에서는 Enter가 그 단추를 누르는 것이다.
      if (event.target instanceof HTMLButtonElement) return;
      event.preventDefault();
      submitTry();
    }
  };

  return {
    tryAvailable,
    amountAvailable,
    active,
    tryText,
    amountText,
    message,
    disabled,
    select: setPicked,
    typeDigit,
    backspace,
    submitTry,
    both,
    one,
    reset,
    onKeyDown,
  };
}
