/**
 * E15의 공개 이벤트·판정. 둘 다 순수 함수다.
 *
 * 이벤트: `token-placed`, `slot-cleared`, `pattern-played`, `code-sent`,
 * `cell-entered`, `cell-selected`, `cell-painted`.
 */
import type { EngineEvent, EnginePredicate, JsonValue, Observation } from '../../core/engine-sdk';
import { coreOf, sameCycle } from './pattern';
import type { PatternAction, PatternState } from './types';

export const EVENT_NAMES = [
  'token-placed',
  'slot-cleared',
  'pattern-played',
  'code-sent',
  'cell-entered',
  'cell-selected',
  'cell-painted',
] as const;

export function emit(prev: PatternState, next: PatternState, action: PatternAction): EngineEvent[] {
  // 재생은 상태를 바꾸지 않으므로 `prev === next`여도 이벤트를 낸다.
  if (action.type === 'play') return [{ name: 'pattern-played', payload: {} }];
  if (prev === next) return [];
  const events: EngineEvent[] = [];

  if (prev.mode === 'sequence' && next.mode === 'sequence') {
    if (action.type === 'place') {
      const token = next.slots[action.slot];
      if (token !== null && token !== undefined) {
        events.push({ name: 'token-placed', payload: { slot: action.slot, token } });
      }
    }
    if (action.type === 'clear-slot' || action.type === 'clear-all') {
      next.slots.forEach((slot, index) => {
        if (slot === null && prev.slots[index] !== null) {
          events.push({ name: 'slot-cleared', payload: { slot: index } });
        }
      });
    }
    if (action.type === 'send' && !prev.sent && next.sent) {
      events.push({ name: 'code-sent', payload: { consistent: isConsistent(next) } });
    }
  }

  if (prev.mode === 'hundred-chart' && next.mode === 'hundred-chart') {
    if (
      (action.type === 'type-digit' ||
        action.type === 'backspace' ||
        action.type === 'clear-entry') &&
      next.active !== null
    ) {
      events.push({ name: 'cell-entered', payload: { cell: next.active } });
    }
    if (action.type === 'select-cell' && next.selected !== null) {
      events.push({ name: 'cell-selected', payload: { cell: next.selected } });
    }
    if (action.type === 'toggle-paint') {
      events.push({
        name: 'cell-painted',
        payload: { cell: action.cell, on: next.painted.includes(action.cell) },
      });
    }
  }
  return events;
}

/** 일대일이고 빈칸이 없다(observe와 같은 규칙을 다시 계산하지 않고 상태에서 직접 본다). */
function isConsistent(state: Extract<PatternState, { mode: 'sequence' }>): boolean {
  const forward = new Map<string, string>();
  const backward = new Map<string, string>();
  for (let i = 0; i < state.settings.given.length; i += 1) {
    const from = state.settings.given[i] ?? '';
    const to = state.slots[i] ?? null;
    if (to === null) return false;
    if ((forward.get(from) ?? to) !== to || (backward.get(to) ?? from) !== from) return false;
    forward.set(from, to);
    backward.set(to, from);
  }
  return true;
}

function recordOf(value: JsonValue | undefined): Readonly<Record<string, JsonValue>> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return {};
  return value;
}

function stringList(value: JsonValue | undefined): string[] | null {
  if (!Array.isArray(value)) return null;
  if (!value.every((item) => typeof item === 'string')) return null;
  return value as string[];
}

function intArg(args: Readonly<Record<string, JsonValue>>, key: string): number | null {
  const value = args[key];
  return typeof value === 'number' && Number.isInteger(value) ? value : null;
}

function obsStrings(observation: Observation, key: string): string[] {
  return stringList(observation[key]) ?? [];
}

function studentSlots(observation: Observation): string[] | null {
  const raw = observation['slots'];
  if (!Array.isArray(raw)) return null;
  if (raw.length === 0 || !raw.every((item) => typeof item === 'string')) return null;
  return raw as string[];
}

export const predicates: Readonly<Record<string, EnginePredicate>> = {
  blanksAre: (observation, args) => {
    const tokens = stringList(recordOf(args)['tokens']);
    const slots = observation['slots'];
    if (tokens === null || !Array.isArray(slots) || slots.length !== tokens.length) return false;
    return tokens.every((token, index) => slots[index] === token);
  },

  continuesGiven: (observation) => observation['continuesGiven'] === true,

  coreIs: (observation, args) => {
    const record = recordOf(args);
    const core = stringList(record['core']);
    const slots = studentSlots(observation);
    if (core === null || core.length === 0 || slots === null) return false;
    const mine = coreOf(slots);
    if (mine === null) return false;
    if (record['rotate'] === true) return sameCycle(mine, core);
    return mine.length === core.length && mine.every((token, index) => token === core[index]);
  },

  hasRepeat: (observation, args) => {
    const record = recordOf(args);
    const minCoreLength = intArg(record, 'minCoreLength') ?? 2;
    const minRepeats = intArg(record, 'minRepeats') ?? 2;
    if (minCoreLength < 1 || minRepeats < 1) return false;
    const slots = studentSlots(observation);
    if (slots === null || observation['complete'] !== true) return false;
    const core = coreOf(slots, minRepeats);
    return core !== null && core.length >= minCoreLength;
  },

  translateConsistent: (observation) => observation['consistent'] === true,

  restoredMatches: (observation) => observation['restoredMatches'] === true,

  entriesCorrect: (observation) => observation['entriesCorrect'] === true,

  entryIs: (observation, args) => {
    const record = recordOf(args);
    const cell = intArg(record, 'cell');
    const value = intArg(record, 'value');
    if (cell === null || value === null) return false;
    const entries = recordOf(observation['entries'] as JsonValue | undefined);
    return entries[String(cell)] === value;
  },

  selectedIs: (observation, args) => {
    const value = intArg(recordOf(args), 'value');
    return value !== null && observation['selected'] === value;
  },

  paintedIs: (observation, args) => {
    const values = recordOf(args)['values'];
    const painted = observation['painted'];
    if (!Array.isArray(values) || !Array.isArray(painted)) return false;
    if (!values.every((item) => typeof item === 'number' && Number.isInteger(item))) return false;
    const want = new Set(values as number[]);
    const have = new Set(painted as number[]);
    return want.size === have.size && [...want].every((cell) => have.has(cell));
  },

  paintedMultiples: (observation, args) => {
    const record = recordOf(args);
    const of = intArg(record, 'of');
    const upTo = intArg(record, 'upTo');
    const from = intArg(record, 'from') ?? of;
    const painted = observation['painted'];
    if (of === null || upTo === null || from === null || of < 1 || !Array.isArray(painted)) {
      return false;
    }
    const want = new Set<number>();
    for (let cell = from; cell <= upTo; cell += of) want.add(cell);
    const have = new Set(painted as number[]);
    return want.size === have.size && [...want].every((cell) => have.has(cell));
  },

  hasMisconception: (observation, args) => {
    const code = recordOf(args)['code'];
    return typeof code === 'string' && obsStrings(observation, 'misconceptions').includes(code);
  },
};
