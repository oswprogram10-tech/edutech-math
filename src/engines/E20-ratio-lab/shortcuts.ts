/**
 * E20 단축키 표. 단추마다 하나씩이다. 화면 글(<kbd>)과 키보드 처리가 같은 표를 쓴다.
 * 자판 배열(한글 입력 포함)과 상관없이 `event.code`로 구분한다.
 */
import type { RatioAction, RatioState } from './types';

export interface Shortcut {
  readonly id: string;
  /** KeyboardEvent.code */
  readonly code: string;
  /** 화면에 보이는 키 이름 */
  readonly label: string;
  readonly action: RatioAction;
}

function digit(k: number): { code: string; label: string } | null {
  return k >= 2 && k <= 9 ? { code: `Digit${k}`, label: String(k) } : null;
}

export function shortcutsOf(state: RatioState): readonly Shortcut[] {
  const list: Shortcut[] = [];
  if (state.mode === 'rate') {
    state.racers.forEach((racer, i) => {
      list.push({
        id: `predict-${racer.id}`,
        code: `Digit${i + 1}`,
        label: String(i + 1),
        action: { type: 'predict', value: racer.id },
      });
    });
    list.push(
      {
        id: 'predict-same',
        code: 'Digit3',
        label: '3',
        action: { type: 'predict', value: 'same' },
      },
      { id: 'run', code: 'KeyG', label: 'G', action: { type: 'run' } },
      { id: 'reset', code: 'KeyR', label: 'R', action: { type: 'reset' } },
    );
    return list;
  }
  if (state.mode === 'bar-model') {
    return [
      { id: 'tool-total', code: 'KeyT', label: 'T', action: { type: 'set-tool', tool: 'total' } },
      { id: 'tool-ratio', code: 'KeyB', label: 'B', action: { type: 'set-tool', tool: 'ratio' } },
      { id: 'tool-erase', code: 'KeyE', label: 'E', action: { type: 'set-tool', tool: 'erase' } },
      { id: 'reset', code: 'KeyR', label: 'R', action: { type: 'reset' } },
    ];
  }
  if (state.mode === 'percent') {
    return [
      { id: 'clear', code: 'KeyC', label: 'C', action: { type: 'clear' } },
      { id: 'reset', code: 'KeyR', label: 'R', action: { type: 'reset' } },
    ];
  }
  const factors = state.settings.scaleFactors;
  if (state.mode === 'mix') {
    list.push(
      {
        id: 'milk-add',
        code: 'KeyM',
        label: 'M',
        action: { type: 'add', ingredient: 'milk', n: 1 },
      },
      {
        id: 'milk-remove',
        code: 'KeyN',
        label: 'N',
        action: { type: 'remove', ingredient: 'milk', n: 1 },
      },
      {
        id: 'syrup-add',
        code: 'KeyS',
        label: 'S',
        action: { type: 'add', ingredient: 'syrup', n: 1 },
      },
      {
        id: 'syrup-remove',
        code: 'KeyD',
        label: 'D',
        action: { type: 'remove', ingredient: 'syrup', n: 1 },
      },
    );
  } else {
    list.push(
      {
        id: 'w-minus',
        code: 'ArrowLeft',
        label: '←',
        action: { type: 'step', dim: 'w', delta: -1 },
      },
      {
        id: 'w-plus',
        code: 'ArrowRight',
        label: '→',
        action: { type: 'step', dim: 'w', delta: 1 },
      },
      {
        id: 'h-minus',
        code: 'ArrowDown',
        label: '↓',
        action: { type: 'step', dim: 'h', delta: -1 },
      },
      { id: 'h-plus', code: 'ArrowUp', label: '↑', action: { type: 'step', dim: 'h', delta: 1 } },
      {
        id: 'add-both',
        code: 'KeyB',
        label: 'B',
        action: { type: 'add-both', n: state.settings.addStep },
      },
      { id: 'save', code: 'KeyS', label: 'S', action: { type: 'save' } },
    );
  }
  for (const k of factors) {
    const key = digit(k);
    if (key !== null) list.push({ id: `scale-${k}`, ...key, action: { type: 'scale', k } });
  }
  list.push({ id: 'reset', code: 'KeyR', label: 'R', action: { type: 'reset' } });
  return list;
}
