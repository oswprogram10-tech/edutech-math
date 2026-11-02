import { describe, expect, it } from 'vitest';
import type { GoalSpec, JsonValue, Observation } from '../../engine-sdk';
import { evaluateGoal, jsonEqual, resolveObservationPath } from '../goal';

const observation: Observation = {
  count: 5,
  groups: [3, 2],
  nested: { answer: '4:6', list: [1, { label: 'ok' }] },
  empty: null,
};

describe('resolveObservationPath', () => {
  it('점 표기와 배열 인덱스를 따라간다', () => {
    expect(resolveObservationPath(observation, 'count')).toEqual({ found: true, value: 5 });
    expect(resolveObservationPath(observation, 'groups.0')).toEqual({ found: true, value: 3 });
    expect(resolveObservationPath(observation, 'nested.list.1.label')).toEqual({
      found: true,
      value: 'ok',
    });
  });

  it('없는 경로와 이상한 인덱스는 found=false', () => {
    expect(resolveObservationPath(observation, 'missing')).toEqual({
      found: false,
      value: undefined,
    });
    expect(resolveObservationPath(observation, 'groups.9').found).toBe(false);
    expect(resolveObservationPath(observation, 'groups.x').found).toBe(false);
    expect(resolveObservationPath(observation, 'count.0').found).toBe(false);
    expect(resolveObservationPath(observation, 'nested..answer').found).toBe(false);
  });
});

describe('jsonEqual', () => {
  it('객체 키 순서와 상관없이 깊은 비교를 한다', () => {
    expect(jsonEqual({ a: 1, b: [2, { c: null }] }, { b: [2, { c: null }], a: 1 })).toBe(true);
    expect(jsonEqual([1, 2], [1, 2, 3])).toBe(false);
    expect(jsonEqual('1', 1)).toBe(false);
    expect(jsonEqual(null, null)).toBe(true);
  });
});

describe('evaluateGoal', () => {
  it('equals는 경로 값과 JSON 깊은 비교를 한다', () => {
    expect(evaluateGoal({ kind: 'equals', path: 'count', value: 5 }, observation)).toBe(true);
    expect(evaluateGoal({ kind: 'equals', path: 'groups.0', value: 3 }, observation)).toBe(true);
    expect(
      evaluateGoal({ kind: 'equals', path: 'nested.list.1', value: { label: 'ok' } }, observation),
    ).toBe(true);
    expect(evaluateGoal({ kind: 'equals', path: 'count', value: 4 }, observation)).toBe(false);
    expect(evaluateGoal({ kind: 'equals', path: 'missing', value: null }, observation)).toBe(false);
  });

  it('equivalent-expr은 값 문자열을 수식 동치로 비교한다', () => {
    const goal: GoalSpec = {
      kind: 'equivalent-expr',
      path: 'nested.answer',
      expr: '2:3',
    };
    expect(evaluateGoal(goal, observation)).toBe(true);
    expect(evaluateGoal({ ...goal, expr: '3:4' }, observation)).toBe(false);
    expect(evaluateGoal({ ...goal, expr: '1 ÷ 0' }, observation)).toBe(false);
    expect(evaluateGoal({ ...goal, path: 'count' }, observation)).toBe(false);
    expect(evaluateGoal({ ...goal, path: 'missing' }, observation)).toBe(false);
  });

  it('predicate는 엔진이 등록한 이름만 찾고, 없으면 false다', () => {
    const engine = {
      predicates: {
        'has-groups': (value: Observation, args: JsonValue | undefined) => {
          const groups = value['groups'];
          return Array.isArray(groups) && args === 3;
        },
      },
    };
    expect(
      evaluateGoal({ kind: 'predicate', name: 'has-groups', args: 3 }, observation, engine),
    ).toBe(true);
    expect(evaluateGoal({ kind: 'predicate', name: 'has-groups' }, observation, engine)).toBe(
      false,
    );
    expect(evaluateGoal({ kind: 'predicate', name: 'missing' }, observation, engine)).toBe(false);
  });

  it('all·any는 자식 조건을 모두/하나라도 만족해야 한다', () => {
    const yes: GoalSpec = { kind: 'equals', path: 'count', value: 5 };
    const no: GoalSpec = { kind: 'equals', path: 'count', value: 4 };
    expect(evaluateGoal({ kind: 'all', of: [yes, yes] }, observation)).toBe(true);
    expect(evaluateGoal({ kind: 'all', of: [yes, no] }, observation)).toBe(false);
    expect(evaluateGoal({ kind: 'any', of: [no, yes] }, observation)).toBe(true);
    expect(evaluateGoal({ kind: 'any', of: [no] }, observation)).toBe(false);
  });
});
