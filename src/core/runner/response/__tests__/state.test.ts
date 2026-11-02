import { describe, expect, it } from 'vitest';
import { assertSerializable } from '../../../engine-sdk';
import type { Observation } from '../../../engine-sdk';
import { createInitialState, observe, reduce } from '..';
import type { NumberField, ResponseAction, ResponseConfig, ResponseState, SortField } from '..';

function config(fields: ResponseConfig['fields']): ResponseConfig {
  return { fields };
}

function run(state: ResponseState, actions: readonly ResponseAction[]): ResponseState {
  return actions.reduce((current, action) => reduce(current, action), state);
}

function numberField(forms: NumberField['forms']): NumberField {
  return { kind: 'number', id: 'ans', forms };
}

function fieldObservation(observation: Observation, id: string): Record<string, unknown> {
  return observation[id] as Record<string, unknown>;
}

function type(state: ResponseState, keys: readonly string[], field = 'ans'): ResponseState {
  return run(
    state,
    keys.map((key) => ({ type: 'number-key', field, key }) as ResponseAction),
  );
}

function focus(state: ResponseState, part: 'whole' | 'numerator' | 'denominator' | 'decimal') {
  return reduce(state, { type: 'number-focus', field: 'ans', part });
}

describe('응답 수 입력', () => {
  it('분수 4/10은 약분 전 표기를 남기고 값은 2/5로 읽는다', () => {
    const definition = config([numberField(['fraction'])]);
    const typed = run(createInitialState(definition), [
      { type: 'number-key', field: 'ans', key: '4' },
      { type: 'number-focus', field: 'ans', part: 'denominator' },
      { type: 'number-key', field: 'ans', key: '1' },
      { type: 'number-key', field: 'ans', key: '0' },
    ]);

    expect(fieldObservation(observe(typed, definition), 'ans')).toEqual({
      raw: '4/10',
      value: '2/5',
      form: 'fraction',
      valid: true,
      irreducible: false,
    });
  });

  it('소수 0.40은 끝 0을 지우지 않고 값은 2/5로 읽는다', () => {
    const definition = config([numberField(['decimal'])]);
    const typed = run(createInitialState(definition), [
      { type: 'number-key', field: 'ans', key: '0' },
      { type: 'number-key', field: 'ans', key: '.' },
      { type: 'number-key', field: 'ans', key: '4' },
      { type: 'number-key', field: 'ans', key: '0' },
    ]);

    expect(fieldObservation(observe(typed, definition), 'ans')).toMatchObject({
      raw: '0.40',
      value: '2/5',
      form: 'decimal',
      valid: true,
    });
  });

  it('대분수 1 2/9는 가분수 11/9로 읽는다', () => {
    const definition = config([numberField(['mixed'])]);
    const typed = run(createInitialState(definition), [
      { type: 'number-focus', field: 'ans', part: 'whole' },
      { type: 'number-key', field: 'ans', key: '1' },
      { type: 'number-focus', field: 'ans', part: 'numerator' },
      { type: 'number-key', field: 'ans', key: '2' },
      { type: 'number-focus', field: 'ans', part: 'denominator' },
      { type: 'number-key', field: 'ans', key: '9' },
    ]);

    expect(fieldObservation(observe(typed, definition), 'ans')).toEqual({
      raw: '1 2/9',
      value: '11/9',
      form: 'mixed',
      valid: true,
      irreducible: true,
    });
  });

  it('분모 0과 빈칸은 무효값이다', () => {
    const definition = config([numberField(['fraction'])]);
    const empty = createInitialState(definition);
    expect(fieldObservation(observe(empty, definition), 'ans')).toMatchObject({
      raw: '',
      value: null,
      valid: false,
    });

    const zero = run(empty, [
      { type: 'number-key', field: 'ans', key: '3' },
      { type: 'number-focus', field: 'ans', part: 'denominator' },
      { type: 'number-key', field: 'ans', key: '0' },
    ]);
    expect(fieldObservation(observe(zero, definition), 'ans')).toMatchObject({
      raw: '3/0',
      value: null,
      valid: false,
      irreducible: false,
    });
  });

  it('입력 틀을 바꾸면 지금 틀의 첫 칸으로 옮긴다', () => {
    const definition = config([numberField(['fraction', 'mixed'])]);
    const mixed = reduce(createInitialState(definition), {
      type: 'number-form',
      field: 'ans',
      form: 'mixed',
    });
    expect(mixed.fields['ans']).toMatchObject({ form: 'mixed', activePart: 'numerator' });

    const integer = reduce(mixed, { type: 'number-form', field: 'ans', form: 'decimal' });
    expect(integer).toBe(mixed);
    expect(integer.fields['ans']).toMatchObject({ form: 'mixed', activePart: 'numerator' });
  });

  it('허용하지 않은 키·틀·필드는 상태를 바꾸지 않는다', () => {
    const definition = config([numberField(['integer'])]);
    const start = createInitialState(definition);
    const same = run(start, [
      { type: 'number-key', field: 'ans', key: 'a' },
      { type: 'number-key', field: 'ans', key: '.' },
      { type: 'number-key', field: 'missing', key: '1' },
      { type: 'number-form', field: 'ans', form: 'fraction' },
      { type: 'number-focus', field: 'ans', part: 'denominator' },
    ]);
    expect(same).toBe(start);
  });

  it('한 칸 지우기·모두 지우기는 고른 칸을 지킨다', () => {
    const definition = config([numberField(['fraction'])]);
    const typed = type(focus(type(createInitialState(definition), ['1', '2']), 'denominator'), [
      '3',
    ]);
    const backspace = reduce(typed, { type: 'number-key', field: 'ans', key: 'backspace' });
    expect(backspace.fields['ans']).toMatchObject({
      numerator: '12',
      denominator: '',
      activePart: 'denominator',
    });

    const cleared = reduce(backspace, { type: 'number-clear', field: 'ans' });
    expect(cleared.fields['ans']).toMatchObject({
      numerator: '',
      denominator: '',
      activePart: 'numerator',
    });
  });

  it('상태는 JSON으로 직렬화되고 reduce는 원래 상태를 바꾸지 않는다', () => {
    const definition = config([numberField(['fraction', 'mixed'])]);
    const start = createInitialState(definition);
    const next = type(start, ['5']);
    assertSerializable(start);
    assertSerializable(next);
    assertSerializable(observe(next, definition));
    expect(start.fields['ans']).toMatchObject({ numerator: '' });
  });
});

describe('응답 고르기·순서·부등호·분류', () => {
  it('고르기는 단일·복수 선택을 구분하고 선택 id를 정렬한다', () => {
    const single = config([
      {
        kind: 'choice',
        id: 'pick',
        multiple: false,
        options: [{ id: 'a' }, { id: 'b' }],
      },
    ]);
    const one = reduce(createInitialState(single), {
      type: 'choice-toggle',
      field: 'pick',
      option: 'b',
    });
    expect(observe(one, single)['pick']).toEqual({ selected: ['b'] });
    const swapped = reduce(one, { type: 'choice-toggle', field: 'pick', option: 'a' });
    expect(observe(swapped, single)['pick']).toEqual({ selected: ['a'] });
    const cleared = reduce(swapped, { type: 'choice-toggle', field: 'pick', option: 'a' });
    expect(observe(cleared, single)['pick']).toEqual({ selected: [] });

    const multiple = config([
      {
        kind: 'choice',
        id: 'pick',
        multiple: true,
        options: [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
      },
    ]);
    const many = run(createInitialState(multiple), [
      { type: 'choice-toggle', field: 'pick', option: 'c' },
      { type: 'choice-toggle', field: 'pick', option: 'a' },
    ]);
    expect(observe(many, multiple)['pick']).toEqual({ selected: ['a', 'c'] });
  });

  it('순서는 콘텐츠 순서에서 시작해 위·아래·끌기로 바뀐다', () => {
    const definition = config([
      {
        kind: 'order',
        id: 'seq',
        items: [{ id: 'b' }, { id: 'c' }, { id: 'a' }],
      },
    ]);
    const start = createInitialState(definition);
    expect(observe(start, definition)['seq']).toEqual({ order: ['b', 'c', 'a'] });

    const up = reduce(start, { type: 'order-up', field: 'seq', item: 'a' });
    expect(observe(up, definition)['seq']).toEqual({ order: ['b', 'a', 'c'] });

    const upAgain = reduce(up, { type: 'order-up', field: 'seq', item: 'a' });
    expect(observe(upAgain, definition)['seq']).toEqual({ order: ['a', 'b', 'c'] });

    const edge = reduce(upAgain, { type: 'order-up', field: 'seq', item: 'a' });
    expect(edge).toBe(upAgain);

    const dragged = reduce(upAgain, {
      type: 'order-reorder',
      field: 'seq',
      item: 'a',
      toIndex: 2,
    });
    expect(observe(dragged, definition)['seq']).toEqual({ order: ['b', 'c', 'a'] });
  });

  it('부등호는 마지막 선택만 남는다', () => {
    const definition = config([{ kind: 'compare', id: 'cmp', left: '3/5', right: '2/3' }]);
    const start = createInitialState(definition);
    expect(observe(start, definition)['cmp']).toEqual({ symbol: null });

    const less = reduce(start, { type: 'compare-set', field: 'cmp', symbol: '<' });
    expect(observe(less, definition)['cmp']).toEqual({ symbol: '<' });
    const greater = reduce(less, { type: 'compare-set', field: 'cmp', symbol: '>' });
    expect(observe(greater, definition)['cmp']).toEqual({ symbol: '>' });
  });

  it('카드 분류는 고른 카드를 상자에 넣고 빼며, 없는 상자는 무시한다', () => {
    const sortField: SortField = {
      kind: 'sort',
      id: 'sort',
      cards: [
        { id: 'a', label: '3/4' },
        { id: 'b', label: '5/4' },
        { id: 'c', label: '0.6' },
        { id: 'd', label: '1.2' },
      ],
      bins: [
        { id: 'small', label: '1보다 작아요' },
        { id: 'large', label: '1보다 커요' },
      ],
    };
    const definition = config([sortField]);
    const start = createInitialState(definition);
    expect(observe(start, definition)['sort']).toEqual({
      bins: { small: [], large: [] },
      unsorted: ['a', 'b', 'c', 'd'],
    });

    const placed = run(start, [
      { type: 'sort-place-card', field: 'sort', card: 'c', bin: 'small' },
      { type: 'sort-place-card', field: 'sort', card: 'b', bin: 'large' },
      { type: 'sort-place-card', field: 'sort', card: 'a', bin: 'small' },
      { type: 'sort-place-card', field: 'sort', card: 'd', bin: 'large' },
    ]);
    expect(observe(placed, definition)['sort']).toEqual({
      bins: { small: ['a', 'c'], large: ['b', 'd'] },
      unsorted: [],
    });

    const moved = reduce(placed, {
      type: 'sort-place-card',
      field: 'sort',
      card: 'a',
      bin: 'large',
    });
    expect(observe(moved, definition)['sort']).toEqual({
      bins: { small: ['c'], large: ['a', 'b', 'd'] },
      unsorted: [],
    });

    const removed = reduce(moved, { type: 'sort-remove', field: 'sort', card: 'c' });
    expect(observe(removed, definition)['sort']).toEqual({
      bins: { small: [], large: ['a', 'b', 'd'] },
      unsorted: ['c'],
    });

    const unknownBin = reduce(removed, {
      type: 'sort-place-card',
      field: 'sort',
      card: 'c',
      bin: 'missing',
    });
    expect(unknownBin).toBe(removed);
  });

  it('분류에서 고르기와 놓기는 picked를 거친다', () => {
    const definition = config([
      {
        kind: 'sort',
        id: 'sort',
        cards: [{ id: 'a', label: '3/4' }],
        bins: [{ id: 'small', label: '작아요' }],
      },
    ]);
    const picked = reduce(createInitialState(definition), {
      type: 'sort-pick',
      field: 'sort',
      card: 'a',
    });
    expect(picked.fields['sort']).toMatchObject({ picked: 'a' });

    const unpicked = reduce(picked, { type: 'sort-pick', field: 'sort', card: 'a' });
    expect(unpicked.fields['sort']).toMatchObject({ picked: null });

    const placeWithoutPick = reduce(unpicked, { type: 'sort-place', field: 'sort', bin: 'small' });
    expect(placeWithoutPick).toBe(unpicked);

    const placed = reduce(picked, { type: 'sort-place', field: 'sort', bin: 'small' });
    expect(placed.fields['sort']).toMatchObject({
      bins: { small: ['a'] },
      unsorted: [],
      picked: null,
    });
  });
});
