/** @vitest-environment jsdom */
/** T161: 자료 묶음 고르기(datasets) 단위·화면 테스트. */
import { cleanup, fireEvent, render } from '@testing-library/react';
import { useReducer } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { assertSerializable } from '../../../core/engine-sdk';
import { predicates } from '../events';
import { observe } from '../observe';
import { createInitialState, reduce } from '../reduce';
import type { GraphAction, GraphConfig, GraphState } from '../types';
import { GraphView } from '../View';

afterEach(cleanup);

const CONFIG: GraphConfig = {
  graph: 'student',
  graphType: 'bar',
  table: 'given',
  scale: 1,
  valueLabel: '명',
  datasets: [
    { id: 'food', title: '좋아하는 음식', data: { 피자: 7, 떡볶이: 5 }, source: '우리 반 조사' },
    {
      id: 'pet',
      title: '키우고 싶은 동물',
      data: { 강아지: 9, 고양이: 4, 토끼: 2 },
      valueLabel: '마리',
      categoryAxisTitle: '동물',
    },
    { id: 7, title: '잘못된 id', data: { a: 1 } },
  ],
};

function recordOf(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

describe('E18 datasets', () => {
  it('고르기 전에는 범주가 없고 datasetId가 null이다', () => {
    const state = createInitialState(CONFIG);
    expect(state.settings.categories).toEqual([]);
    expect(state.datasetId).toBeNull();
    const observation = observe(state);
    expect(observation['datasetId']).toBeNull();
    expect(observation['graphValues']).toEqual({});
    expect(observation['graphMatchesData']).toBe(false);
    expect(predicates['datasetPicked']?.(observation, undefined)).toBe(false);
  });

  it('잘못된 묶음(id가 문자열이 아님)은 목록에서 빠진다', () => {
    expect(createInitialState(CONFIG).settings.datasets.map((d) => d.id)).toEqual(['food', 'pet']);
  });

  it('고르면 그 묶음의 data·축 제목·valueLabel이 쓰인다', () => {
    const state = reduce(createInitialState(CONFIG), { type: 'pick-dataset', id: 'pet' });
    expect(state.datasetId).toBe('pet');
    expect(state.settings.categories).toEqual(['강아지', '고양이', '토끼']);
    expect(state.settings.valueLabel).toBe('마리');
    expect(state.settings.categoryAxisTitle).toBe('동물');
    const observation = observe(state);
    expect(observation['datasetId']).toBe('pet');
    expect(recordOf(observation['table'])).toEqual({ 강아지: 9, 고양이: 4, 토끼: 2 });
    expect(predicates['datasetPicked']?.(observation, undefined)).toBe(true);
  });

  it('묶음에 없는 글은 맨 위 키로 채운다', () => {
    const state = reduce(createInitialState(CONFIG), { type: 'pick-dataset', id: 'food' });
    expect(state.settings.valueLabel).toBe('명');
    expect(state.settings.source).toBe('우리 반 조사');
  });

  it('막대를 그린 뒤 다른 묶음을 고르면 학생 그래프가 비워진다', () => {
    let state = reduce(createInitialState(CONFIG), { type: 'pick-dataset', id: 'food' });
    state = reduce(state, { type: 'set-bar', cat: '피자', cells: 7 });
    state = reduce(state, { type: 'set-bar', cat: '떡볶이', cells: 5 });
    expect(observe(state)['graphMatchesData']).toBe(true);
    state = reduce(state, { type: 'pick-dataset', id: 'pet' });
    expect(Object.values(state.bars)).toEqual([0, 0, 0]);
    expect(observe(state)['graphMatchesData']).toBe(false);
    expect(state.settings.source).toBe('');
  });

  it('같은 묶음을 다시 고르면 그림을 지우지 않는다', () => {
    let state = reduce(createInitialState(CONFIG), { type: 'pick-dataset', id: 'food' });
    state = reduce(state, { type: 'set-bar', cat: '피자', cells: 3 });
    expect(reduce(state, { type: 'pick-dataset', id: 'food' })).toBe(state);
  });

  it('학생이 채우는 표도 묶음을 바꾸면 비워진다', () => {
    const config: GraphConfig = { ...CONFIG, table: 'student' };
    let state = reduce(createInitialState(config), { type: 'pick-dataset', id: 'food' });
    state = reduce(state, { type: 'set-table', cat: '피자', value: 7 });
    state = reduce(state, { type: 'pick-dataset', id: 'pet' });
    expect(Object.values(state.table)).toEqual([null, null, null]);
  });

  it('목록에 없는 id는 무시한다', () => {
    const state = createInitialState(CONFIG);
    expect(reduce(state, { type: 'pick-dataset', id: 'nope' })).toBe(state);
    expect(reduce(state, { type: 'pick-dataset', id: '' })).toBe(state);
  });

  it('datasets가 없으면 기존 설정 그대로이고 observation에 datasetId가 없다', () => {
    const state = createInitialState({ data: { a: 1 } });
    expect(state.settings.categories).toEqual(['a']);
    expect('datasetId' in observe(state)).toBe(false);
    expect(reduce(state, { type: 'pick-dataset', id: 'x' })).toBe(state);
  });

  it('상태와 관찰 결과가 직렬화된다', () => {
    const state = reduce(createInitialState(CONFIG), { type: 'pick-dataset', id: 'pet' });
    assertSerializable(state);
    assertSerializable(observe(state));
    expect(JSON.parse(JSON.stringify(state))).toEqual(state);
  });
});

function Live({ config }: { readonly config: GraphConfig }) {
  const [state, dispatch] = useReducer(
    (current: GraphState, action: GraphAction) => reduce(current, action),
    config,
    createInitialState,
  );
  return (
    <GraphView
      config={config}
      state={state}
      dispatch={dispatch}
      cpa="C"
      mode={state.mode}
      targetSize={48}
    />
  );
}

describe('E18 datasets 화면', () => {
  it('고르기 전: 단추 줄과 안내만 보이고 표·그래프는 없다', () => {
    const { container, getByRole, getByTestId } = render(<Live config={CONFIG} />);
    const group = getByRole('radiogroup', { name: '자료 묶음' });
    expect(group.querySelectorAll('[role="radio"]')).toHaveLength(2);
    expect(getByTestId('graph-dataset-hint').textContent).toBe('자료를 하나 골라요');
    expect(container.querySelector('table')).toBeNull();
    expect(container.querySelector('svg')).toBeNull();
  });

  it('고르면 표·그래프가 나오고 source 글이 보인다', () => {
    const { container, getByRole, queryByTestId } = render(<Live config={CONFIG} />);
    fireEvent.click(getByRole('radio', { name: '좋아하는 음식' }));
    expect(queryByTestId('graph-dataset-hint')).toBeNull();
    expect(container.querySelector('table')).not.toBeNull();
    expect(queryByTestId('graph-dataset-source')?.textContent).toBe('자료: 우리 반 조사');
    expect(getByRole('radio', { name: '좋아하는 음식' }).getAttribute('aria-checked')).toBe('true');
    fireEvent.click(getByRole('radio', { name: '키우고 싶은 동물' }));
    expect(queryByTestId('graph-dataset-source')).toBeNull();
  });
});
