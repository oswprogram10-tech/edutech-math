import { describe, expect, it } from 'vitest';
import { assertSerializable } from '../../../core/engine-sdk';
import { Rational } from '../../../core/math';
import { analyzeState, firstDiagnosis } from '../analyze';
import { emit, predicates } from '../events';
import { analyzeLine, exprOfTokens, tokensFromText } from '../expression';
import { observe } from '../observe';
import { createInitialState, reduce } from '../reduce';
import type { StepSolverAction, StepSolverConfig, StepSolverState } from '../types';

function apply(state: StepSolverState, action: StepSolverAction): StepSolverState {
  const next = reduce(state, action);
  assertSerializable(next);
  return next;
}

function withTokens(
  state: StepSolverState,
  index: number,
  tokens: StepSolverState['lines'][number]['tokens'],
): StepSolverState {
  const lines = state.lines.map((line, position) =>
    position === index ? { ...line, tokens } : line,
  );
  return { ...state, lines };
}

function withLineText(state: StepSolverState, index: number, text: string): StepSolverState {
  return withTokens(state, index, tokensFromText(text));
}

function lineState(config: Partial<StepSolverConfig> = {}): StepSolverState {
  return createInitialState({ mode: 'lines', start: '1/2 + 1/3', ...config });
}

function observationLines(state: StepSolverState): ReadonlyArray<Record<string, unknown>> {
  const observation = observe(state);
  const lines = observation['lines'];
  if (!Array.isArray(lines)) return [];
  return lines.map((line) =>
    line !== null && typeof line === 'object' && !Array.isArray(line)
      ? (line as Record<string, unknown>)
      : {},
  );
}

function typeFraction(
  state: StepSolverState,
  lineId: string,
  num: string,
  den: string,
): StepSolverState {
  let next = state;
  const line = next.lines.find((candidate) => candidate.id === lineId);
  const tokenIndex = line?.tokens.length ?? 0;
  next = apply(next, {
    type: 'insert-token',
    token: { kind: 'fraction', num: '', den: '' },
  });
  for (const digit of num) next = apply(next, { type: 'enter-digit', digit });
  next = apply(next, {
    type: 'select-token',
    lineId,
    token: tokenIndex,
    field: 'den',
  });
  for (const digit of den) next = apply(next, { type: 'enter-digit', digit });
  return next;
}

describe('E08 토큰과 식', () => {
  it('분수·대분수·괄호를 식 문자열로 바꾸고 값을 계산한다', () => {
    const mixed = tokensFromText('3 1/4 - 1 3/4');
    expect(exprOfTokens(mixed)).toBe('3 1/4 − 1 3/4');
    const mixedLine = analyzeLine(mixed);
    expect(mixedLine.valid).toBe(true);
    expect(mixedLine.value?.equals(Rational.parse('3/2'))).toBe(true);

    const grouped = tokensFromText('(1/2 + 1/3) × 2');
    expect(exprOfTokens(grouped)).toBe('( 1/2 + 1/3 ) × 2');
    const groupedLine = analyzeLine(grouped);
    expect(groupedLine.valid).toBe(true);
    expect(groupedLine.value?.equals(Rational.parse('5/3'))).toBe(true);
  });

  it('미완성 칸과 □는 값이 없고 판정하지 않는다', () => {
    const incomplete = analyzeLine([
      { kind: 'fraction', num: '1', den: '2' },
      { kind: 'op', op: 'add' },
    ]);
    expect(incomplete.valid).toBe(false);
    expect(incomplete.value).toBeNull();

    const box = analyzeLine(tokensFromText('□'));
    expect(box.valid).toBe(false);
    expect(box.reason).toBe('box');
  });
});

describe('E08 줄 판정', () => {
  it('3/8 + 4/8 다음에 7/8을 쓰면 모든 줄이 동치다', () => {
    let state = createInitialState({ mode: 'lines', start: '3/8 + 4/8' });
    state = withLineText(state, 1, '7/8');
    const analysis = analyzeState(state);
    expect(analysis.allEquivalent).toBe(true);
    expect(analysis.firstBrokenLine).toBeNull();
    expect(analysis.finalValue).toBe('7/8');
    expect(analysis.finalIrreducible).toBe(true);
    expect(analysis.finalIsMixed).toBe(false);
  });

  it('1/2 + 1/3 = 2/5를 첫 오류 줄로 표시하고 MC-FRAC-ADD-DENOM을 찾는다', () => {
    let state = lineState();
    state = withLineText(state, 1, '2/5');
    const observation = observe(state);
    expect(observation['firstBrokenLine']).toBe(1);
    expect(observation['allEquivalent']).toBe(false);
    expect(observation['misconceptions']).toEqual([{ line: 1, code: 'MC-FRAC-ADD-DENOM' }]);
    expect(observation['finalValue']).toBe('2/5');

    const diagnosis = firstDiagnosis(state);
    expect(diagnosis).not.toBeNull();
    expect(diagnosis?.previousValue).toBe('5/6');
    expect(diagnosis?.studentValue).toBe('2/5');
    expect(diagnosis?.studentExpr).toBe('2/5');
    expect(diagnosis?.leftText).toBe('1/2');
  });

  it('3 1/4 − 1 3/4 = 2 2/4는 첫 오류 줄이고 MC-SUB-SMALLER-FROM-LARGER를 찾는다', () => {
    let state = createInitialState({ mode: 'lines', start: '3 1/4 - 1 3/4' });
    state = withLineText(state, 1, '2 2/4');
    const observation = observe(state);
    expect(observation['firstBrokenLine']).toBe(1);
    expect(observation['allEquivalent']).toBe(false);
    expect(observation['misconceptions']).toEqual([
      { line: 1, code: 'MC-SUB-SMALLER-FROM-LARGER' },
    ]);
  });

  it('미완성 줄은 중립이고 첫 오류 줄로 세지 않는다', () => {
    let state = lineState();
    state = withTokens(state, 1, [
      { kind: 'fraction', num: '1', den: '2' },
      { kind: 'op', op: 'add' },
    ]);
    const analysis = analyzeState(state);
    expect(analysis.lines[1]?.valid).toBe(false);
    expect(analysis.lines[1]?.equivalentToPrev).toBeNull();
    expect(analysis.firstBrokenLine).toBeNull();
    expect(analysis.allEquivalent).toBe(false);
  });

  it('빈 줄과 □ 줄도 중립이다', () => {
    let state = lineState();
    expect(analyzeState(state).lines[1]?.equivalentToPrev).toBeNull();
    state = withLineText(state, 1, '□');
    expect(analyzeState(state).lines[1]?.equivalentToPrev).toBeNull();
    expect(analyzeState(state).firstBrokenLine).toBeNull();
  });

  it('약분 전 표기는 값이 같아도 기약이 아니다', () => {
    let state = createInitialState({ mode: 'lines', start: '1/4 + 1/4' });
    state = withLineText(state, 1, '2/4');
    const observation = observe(state);
    expect(observation['allEquivalent']).toBe(true);
    expect(observation['finalValue']).toBe('1/2');
    expect(observation['finalIrreducible']).toBe(false);
    expect(observation['finalRaw']).toBe('2/4');
  });

  it('대분수 표기를 그대로 남긴다', () => {
    let state = createInitialState({ mode: 'lines', start: '2 1/2' });
    state = withLineText(state, 1, '2 2/4');
    const observation = observe(state);
    expect(observation['allEquivalent']).toBe(true);
    expect(observation['finalIsMixed']).toBe(true);
    expect(observation['finalRaw']).toBe('2 2/4');
  });
});

describe('E08 키 입력과 줄 편집', () => {
  it('키패드 Action으로 7/8을 쓰고 지운다', () => {
    let state = lineState();
    state = typeFraction(state, 'line-1', '7', '8');
    expect(state.lines[1]?.tokens).toEqual([{ kind: 'fraction', num: '7', den: '8' }]);
    expect(observe(state)['finalValue']).toBe('7/8');

    state = apply(state, { type: 'backspace' });
    expect(state.lines[1]?.tokens).toEqual([{ kind: 'fraction', num: '7', den: '' }]);
    state = apply(state, { type: 'backspace' });
    expect(state.lines[1]?.tokens).toEqual([{ kind: 'fraction', num: '7', den: '' }]);
    state = apply(state, { type: 'backspace' });
    expect(state.lines[1]?.tokens).toEqual([]);
  });

  it('줄 추가·삭제와 커서 이동을 Action으로 기록한다', () => {
    let state = lineState();
    state = apply(state, { type: 'add-line' });
    expect(state.lines).toHaveLength(3);
    expect(state.lines[2]?.id).toBe('line-2');
    expect(state.cursor?.lineId).toBe('line-2');

    state = apply(state, { type: 'remove-line', lineId: 'line-2' });
    expect(state.lines).toHaveLength(2);

    // 마지막 학생 줄은 지워도 빈 줄로 남는다.
    state = apply(state, { type: 'remove-line', lineId: 'line-1' });
    expect(state.lines).toHaveLength(2);
    expect(state.lines[1]?.tokens).toEqual([]);
  });

  it('고정된 첫 줄은 고칠 수 없다', () => {
    let state = lineState();
    const before = state;
    state = apply(state, {
      type: 'select-token',
      lineId: 'line-0',
      token: 0,
      field: 'value',
    });
    expect(state).toBe(before);
    state = apply(state, { type: 'remove-line', lineId: 'line-0' });
    expect(state).toBe(before);
  });

  it('소수점과 연산·괄호·□를 넣을 수 있다', () => {
    let state = createInitialState({ mode: 'lines', start: '1 + 1' });
    state = apply(state, { type: 'enter-digit', digit: '2' });
    state = apply(state, { type: 'decimal-point' });
    state = apply(state, { type: 'enter-digit', digit: '5' });
    expect(state.lines[1]?.tokens).toEqual([{ kind: 'decimal', value: '2.5' }]);
  });

  it('모든 Action 뒤 상태가 JSON 직렬화 가능하다', () => {
    let state = createInitialState({
      mode: 'fraction-steps',
      start: '1/2 + 1/3',
      stepLabels: ['통분', '계산', '약분'],
    });
    const actions: StepSolverAction[] = [
      { type: 'insert-token', token: { kind: 'fraction', num: '', den: '' } },
      { type: 'enter-digit', digit: '5' },
      { type: 'move-field', delta: 1 },
      { type: 'enter-digit', digit: '6' },
      { type: 'add-line' },
      { type: 'set-label', lineId: 'line-2', label: '계산' },
      { type: 'insert-token', token: { kind: 'op', op: 'mul' } },
      { type: 'insert-token', token: { kind: 'integer', value: '2' } },
      { type: 'move-token', delta: -1 },
      { type: 'backspace' },
      { type: 'remove-line', lineId: 'line-2' },
    ];
    for (const action of actions) {
      state = apply(state, action);
    }
  });
});

describe('E08 단계 이름표', () => {
  it('이름표는 Observation에만 남고 판정에 쓰이지 않는다', () => {
    let state = createInitialState({
      mode: 'fraction-steps',
      start: '1/2 + 1/3',
      stepLabels: ['통분', '계산', '약분'],
    });
    state = apply(state, { type: 'set-label', lineId: 'line-1', label: '통분' });
    const lines = observationLines(state);
    expect(lines[1]?.['label']).toBe('통분');
    expect(observe(state)['firstBrokenLine']).toBeNull();
  });

  it('allowFreeOrder가 false면 이름표 순서를 지킨다', () => {
    let state = createInitialState({
      mode: 'fraction-steps',
      start: '1/2 + 1/3',
      stepLabels: ['통분', '계산', '약분'],
      allowFreeOrder: false,
    });
    state = apply(state, { type: 'add-line' });
    state = apply(state, { type: 'set-label', lineId: 'line-2', label: '통분' });
    state = apply(state, { type: 'set-label', lineId: 'line-1', label: '계산' });
    expect(state.lines[1]?.label).toBeNull();
    state = apply(state, { type: 'set-label', lineId: 'line-1', label: '통분' });
    expect(state.lines[1]?.label).toBe('통분');
  });
});

describe('E08 debug', () => {
  it('친구 풀이 줄을 고르고 고친 줄을 쓴다', () => {
    let state = createInitialState({
      mode: 'debug',
      debugSamples: [{ lines: ['1/2 + 1/3', '2/5'] }],
    });
    expect(observe(state)['selectedLine']).toBeNull();

    state = apply(state, { type: 'select-line', line: 1 });
    expect(observe(state)['selectedLine']).toBe(1);
    expect(state.lines[0]?.tokens).toEqual([]);

    state = typeFraction(state, 'fix-0', '5', '6');
    const observation = observe(state);
    expect(observation['selectedLine']).toBe(1);
    expect(observation['fixedValue']).toBe('5/6');
    expect(observation['firstBrokenLine']).toBe(1);
    expect(observation['misconceptions']).toEqual([]);

    const analysis = analyzeState(state);
    expect(analysis.lines[analysis.lines.length - 1]?.equivalentToPrev).toBe(true);
  });

  it('다른 줄을 고르면 고친 줄을 비운다', () => {
    let state = createInitialState({
      mode: 'debug',
      debugSamples: [{ lines: ['1/2 + 1/3', '2/5'] }],
    });
    state = apply(state, { type: 'select-line', line: 1 });
    state = typeFraction(state, 'fix-0', '5', '6');
    state = apply(state, { type: 'select-line', line: 0 });
    expect(observe(state)['selectedLine']).toBe(0);
    expect(state.lines[0]?.tokens).toEqual([]);
    expect(observe(state)['fixedValue']).toBeNull();
  });
});

describe('E08 이벤트와 판정', () => {
  it('줄이 깨지면 line-checked와 misconception-found를 낸다', () => {
    const state = lineState();
    const before = withTokens(state, 1, [{ kind: 'fraction', num: '2', den: '' }]);
    const after = withLineText(state, 1, '2/5');
    const events = emit(before, after, { type: 'enter-digit', digit: '5' });
    const names = events.map((event) => event.name);
    expect(names).toContain('line-checked');
    expect(names).toContain('misconception-found');
    expect(names).toContain('value-changed');
    expect(events.find((event) => event.name === 'line-checked')?.payload).toEqual({
      line: 1,
      equivalent: false,
    });
    expect(events.find((event) => event.name === 'misconception-found')?.payload).toEqual({
      line: 1,
      code: 'MC-FRAC-ADD-DENOM',
    });
  });

  it('줄 추가 이벤트를 낸다', () => {
    const state = lineState();
    const next = apply(state, { type: 'add-line' });
    const events = emit(state, next, { type: 'add-line' });
    expect(events[0]).toEqual({ name: 'line-added', payload: { line: 2 } });
  });

  it('동치·값·기약·줄 수·오개념·서로 다른 식을 판정한다', () => {
    let state = createInitialState({ mode: 'lines', start: '1/2 + 1/3' });
    state = withLineText(state, 1, '5/6');
    state = apply(state, { type: 'add-line' });
    state = withLineText(state, 2, '10/12');
    const observation = observe(state);

    expect(predicates['allLinesEquivalent']?.(observation, undefined)).toBe(true);
    expect(predicates['finalValueIs']?.(observation, { value: '5/6' })).toBe(true);
    expect(predicates['finalValueIs']?.(observation, { value: '0.8333' })).toBe(false);
    expect(predicates['finalValueIs']?.(observation, { value: '10/12' })).toBe(true);
    expect(predicates['finalIrreducible']?.(observation, undefined)).toBe(false);
    expect(predicates['lineCountAtLeast']?.(observation, { n: 3 })).toBe(true);
    expect(predicates['hasMisconception']?.(observation, { code: 'MC-FRAC-ADD-DENOM' })).toBe(
      false,
    );
    expect(predicates['differentExpressions']?.(observation, { value: '5/6', count: 2 })).toBe(
      true,
    );
  });

  it('오개념 판정과 debug 선택 판정을 한다', () => {
    let state = lineState();
    state = withLineText(state, 1, '2/5');
    expect(predicates['hasMisconception']?.(observe(state), { code: 'MC-FRAC-ADD-DENOM' })).toBe(
      true,
    );

    let debug = createInitialState({
      mode: 'debug',
      debugSamples: [{ lines: ['1/2 + 1/3', '2/5'] }],
    });
    debug = apply(debug, { type: 'select-line', line: 1 });
    expect(predicates['selectedLineIs']?.(observe(debug), { line: 1 })).toBe(true);
    expect(predicates['selectedLineIs']?.(observe(debug), { line: 0 })).toBe(false);
  });
});
