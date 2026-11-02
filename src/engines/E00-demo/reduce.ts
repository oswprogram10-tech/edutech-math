/**
 * E00-demo 순수 reducer.
 * 모든 조작은 Action 하나로 기록되고, 같은 Action 목록은 같은 상태를 재생한다.
 */
import { clamp } from '../../core/engine-sdk';
import type { DemoAction, DemoConfig, DemoState } from './types';
import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from './types';

function clampX(x: number): number {
  return clamp(Math.round(x), 0, LOGICAL_WIDTH);
}

function clampY(y: number): number {
  return clamp(Math.round(y), 0, LOGICAL_HEIGHT);
}

export function createInitialState(config: DemoConfig): DemoState {
  // 지금은 설정이 격자 크기뿐이라 초기 상태에 영향이 없다. 계약상 config를 받는다.
  void config;
  return {
    counters: [],
    groups: [],
    nextCounterId: 1,
    nextGroupId: 1,
  };
}

export function reduce(state: DemoState, action: DemoAction): DemoState {
  switch (action.type) {
    case 'add': {
      const id = `c${state.nextCounterId}`;
      return {
        ...state,
        counters: [...state.counters, { id, x: clampX(action.x), y: clampY(action.y) }],
        nextCounterId: state.nextCounterId + 1,
      };
    }

    case 'move': {
      if (!state.counters.some((counter) => counter.id === action.id)) return state;
      return {
        ...state,
        counters: state.counters.map((counter) =>
          counter.id === action.id
            ? { ...counter, x: clampX(action.x), y: clampY(action.y) }
            : counter,
        ),
      };
    }

    case 'group': {
      const existing = new Set(state.counters.map((counter) => counter.id));
      const chosen = new Set(action.ids.filter((id) => existing.has(id)));
      // 한 개짜리 '묶음'은 의미가 없으므로 두 개 이상일 때만 만든다.
      if (chosen.size < 2) return state;

      // 이미 묶인 셈돌을 다시 올가미로 감으면 새 묶음으로 옮긴다.
      const remaining = state.groups
        .map((group) => ({
          ...group,
          counterIds: group.counterIds.filter((id) => !chosen.has(id)),
        }))
        .filter((group) => group.counterIds.length >= 2);
      const orderedIds = state.counters.map((counter) => counter.id).filter((id) => chosen.has(id));

      return {
        ...state,
        groups: [...remaining, { id: `g${state.nextGroupId}`, counterIds: orderedIds }],
        nextGroupId: state.nextGroupId + 1,
      };
    }

    case 'ungroup': {
      const groups = state.groups.filter((group) => group.id !== action.groupId);
      return groups.length === state.groups.length ? state : { ...state, groups };
    }
  }
}
