/** E20 bar-model: 토큰 나누기, 형광펜, 막대 값 판정, 오개념, 설정 오류, JSON 왕복. */
import { describe, expect, it } from 'vitest';
import { splitChunks, splitTokens } from '../bar';
import { observe } from '../observe';
import { createInitialState, reduce } from '../reduce';
import { predicates } from '../events';
import type { Observation } from '../../../core/engine-sdk';
import type { BarModelConfig, BarState, RatioAction, RatioState } from '../types';

const MC = 'MC-PROPORTION-DIVIDE-BY-RATIO-TERM';

function play(config: BarModelConfig, actions: readonly RatioAction[] = []): BarState {
  const state = actions.reduce<RatioState>(reduce, createInitialState(config));
  if (state.mode !== 'bar-model') throw new Error('bar-model 상태가 아닙니다.');
  return state;
}

function obs(state: BarState): Observation {
  return observe(state, { mode: 'bar-model' });
}

const setUnit = (value: string): RatioAction => ({ type: 'set-unit', value });
const setPart = (index: number, value: string): RatioAction => ({
  type: 'set-part',
  index,
  value,
});

/** 기본 장면(사탕 35개, 3 : 4)에서 글자가 같은 첫 토큰의 번호. */
function indexOf(state: BarState, text: string): number {
  const i = state.settings.tokens.indexOf(text);
  if (i < 0) throw new Error(`토큰 ${text} 없음`);
  return i;
}

function highlightAll(state: BarState): RatioAction[] {
  return [
    { type: 'set-tool', tool: 'total' },
    { type: 'mark', index: indexOf(state, '35') },
    { type: 'set-tool', tool: 'ratio' },
    { type: 'mark', index: indexOf(state, '3') },
    { type: 'mark', index: indexOf(state, '4') },
  ];
}

describe('토큰 나누기', () => {
  it('수와 붙은 조사·단위를 나눈다', () => {
    expect(splitChunks('35개를 3 : 4로')).toEqual([['35', '개를'], ['3'], [':'], ['4', '로']]);
    expect(splitTokens('사탕 35개를')).toEqual(['사탕', '35', '개를']);
    expect(splitTokens('3:4')).toEqual(['3', ':', '4']);
    expect(splitTokens('  ')).toEqual([]);
  });

  it('기본 장면: 사탕 35개 3 : 4, 형광펜 단계 있음', () => {
    const state = play({ mode: 'bar-model' });
    expect(state.error).toBeNull();
    expect(state.settings.ratio).toEqual([3, 4]);
    expect(state.settings.total).toBe(35);
    expect(state.settings.highlight).not.toBeNull();
    expect(state.settings.tokens.slice(0, 3)).toEqual(['사탕', '35', '개를']);
  });
});

describe('형광펜', () => {
  it('전체와 비를 모두 맞게 칠하면 highlightCorrect', () => {
    const start = play({ mode: 'bar-model' });
    expect(obs(start)['highlightCorrect']).toBe(false);
    const done = play({ mode: 'bar-model' }, highlightAll(start));
    expect(obs(done)['highlightCorrect']).toBe(true);
    expect(obs(done)['marks']).toEqual({
      total: [indexOf(start, '35')],
      ratio: [indexOf(start, '3'), indexOf(start, '4')],
    });
    expect(predicates['highlightCorrect']?.(obs(done), undefined)).toBe(true);
  });

  it('전체를 비 도구로 칠하거나 모자라거나 남으면 틀림', () => {
    const start = play({ mode: 'bar-model' });
    const t35 = indexOf(start, '35');
    const t3 = indexOf(start, '3');
    const t4 = indexOf(start, '4');
    const wrongKind = play({ mode: 'bar-model' }, [
      { type: 'set-tool', tool: 'ratio' },
      { type: 'mark', index: t35 },
      { type: 'mark', index: t3 },
      { type: 'mark', index: t4 },
    ]);
    expect(obs(wrongKind)['highlightCorrect']).toBe(false);
    const missing = play({ mode: 'bar-model' }, highlightAll(start).slice(0, 4));
    expect(obs(missing)['highlightCorrect']).toBe(false);
    const extra = play({ mode: 'bar-model' }, [
      ...highlightAll(start),
      { type: 'mark', index: indexOf(start, '사탕') },
    ]);
    expect(obs(extra)['highlightCorrect']).toBe(false);
  });

  it('같은 도구로 다시 누르거나 지우개로 누르면 지워진다', () => {
    const start = play({ mode: 'bar-model' });
    const i = indexOf(start, '35');
    const on = play({ mode: 'bar-model' }, [{ type: 'mark', index: i }]);
    expect(on.marks[i]).toBe('total');
    const off = reduce(on, { type: 'mark', index: i });
    expect((off as BarState).marks[i]).toBeUndefined();
    const erased = play({ mode: 'bar-model' }, [
      { type: 'mark', index: i },
      { type: 'set-tool', tool: 'ratio' },
      { type: 'mark', index: i },
      { type: 'set-tool', tool: 'erase' },
      { type: 'mark', index: i },
    ]);
    expect(erased.marks).toEqual({});
  });

  it('범위 밖 번호·모르는 도구는 거절(상태 그대로)', () => {
    const state = play({ mode: 'bar-model' });
    expect(reduce(state, { type: 'mark', index: -1 })).toBe(state);
    expect(reduce(state, { type: 'mark', index: 999 })).toBe(state);
    expect(reduce(state, { type: 'set-tool', tool: 'pen' as never })).toBe(state);
    expect(reduce(state, { type: 'mark', index: 0.5 })).toBe(state);
  });

  it('형광펜 단계가 없으면 highlightCorrect는 null', () => {
    const state = play({
      mode: 'bar-model',
      problem: '구슬 35개를 3 : 4로 나눕니다.',
      parts: ['가', '나'],
      ratio: [3, 4],
      total: 35,
    });
    expect(obs(state)['highlightCorrect']).toBeNull();
  });
});

describe('한 칸 크기·몫·전체', () => {
  it('unit 5 → unitCorrect, 몫 15·20 → allPartsCorrect', () => {
    const state = play({ mode: 'bar-model' }, [setUnit('5'), setPart(0, '15'), setPart(1, '20')]);
    const o = obs(state);
    expect(o['unit']).toBe('5');
    expect(o['unitCorrect']).toBe(true);
    expect(o['partsCorrect']).toEqual([true, true]);
    expect(o['partsSumMatches']).toBe(true);
    expect(o['totalCorrect']).toBeNull();
    expect(o['misconceptions']).toEqual([]);
    expect(predicates['unitCorrect']?.(o, undefined)).toBe(true);
    expect(predicates['allPartsCorrect']?.(o, undefined)).toBe(true);
    expect(predicates['partCorrect']?.(o, { index: 1 })).toBe(true);
  });

  it('값이 없으면 맞다고 하지 않는다', () => {
    const o = obs(play({ mode: 'bar-model' }));
    expect(o['unitCorrect']).toBe(false);
    expect(o['partsCorrect']).toEqual([false, false]);
    expect(o['partsSumMatches']).toBeNull();
    expect(predicates['allPartsCorrect']?.(o, undefined)).toBe(false);
  });

  it('unit 11(35 ÷ 3의 정수 부분)은 MC, 8(35 ÷ 4의 정수 부분)도 MC', () => {
    expect(obs(play({ mode: 'bar-model' }, [setUnit('11')]))['misconceptions']).toEqual([MC]);
    expect(obs(play({ mode: 'bar-model' }, [setUnit('8')]))['misconceptions']).toEqual([MC]);
    const o = obs(play({ mode: 'bar-model' }, [setUnit('11')]));
    expect(o['unitCorrect']).toBe(false);
    expect(predicates['hasMisconception']?.(o, { code: MC })).toBe(true);
  });

  it('그냥 틀린 unit(예: 6)은 MC가 아니다', () => {
    expect(obs(play({ mode: 'bar-model' }, [setUnit('6')]))['misconceptions']).toEqual([]);
  });

  it('몫 합이 전체와 다르면 MC', () => {
    const o = obs(play({ mode: 'bar-model' }, [setPart(0, '10'), setPart(1, '20')]));
    expect(o['partsSumMatches']).toBe(false);
    expect(o['misconceptions']).toEqual([MC]);
    // 하나만 썼을 때는 아직 합을 판단하지 않는다.
    expect(obs(play({ mode: 'bar-model' }, [setPart(0, '10')]))['misconceptions']).toEqual([]);
  });

  it('거꾸로(known 형 24, 3 : 5): unit 8, total 64가 맞고 알려 준 몫은 고정', () => {
    const config: BarModelConfig = {
      mode: 'bar-model',
      problem: '형과 동생이 3 : 5로 나누었더니 형이 24개입니다. 전체는 몇 개일까요?',
      parts: ['형', '동생'],
      ratio: [3, 5],
      known: { part: 0, value: 24 },
    };
    const start = play(config);
    expect(start.partValues).toEqual(['24', null]);
    expect(reduce(start, setPart(0, '30'))).toBe(start);
    const done = play(config, [setUnit('8'), setPart(1, '40'), { type: 'set-total', value: '64' }]);
    const o = obs(done);
    expect(o['unitCorrect']).toBe(true);
    expect(o['partsCorrect']).toEqual([true, true]);
    expect(o['totalCorrect']).toBe(true);
    expect(o['partsSumMatches']).toBe(true);
    expect(predicates['totalCorrect']?.(o, undefined)).toBe(true);
    expect(obs(play(config, [{ type: 'set-total', value: '48' }]))['totalCorrect']).toBe(false);
  });

  it('total이 알려졌으면 전체 칸은 받지 않는다', () => {
    const state = play({ mode: 'bar-model' });
    expect(reduce(state, { type: 'set-total', value: '35' })).toBe(state);
  });

  it('정수 칸은 숫자 6자리까지만 받는다(경계값 0·빈 글자·소수·큰 수)', () => {
    const state = play({ mode: 'bar-model' });
    expect((reduce(state, setUnit('0')) as BarState).unit).toBe('0');
    expect(reduce(state, setUnit('1.5'))).toBe(state);
    expect(reduce(state, setUnit('-3'))).toBe(state);
    expect(reduce(state, setUnit('1234567'))).toBe(state);
    expect((reduce(state, setUnit('999999')) as BarState).unit).toBe('999999');
    const filled = reduce(state, setUnit('5'));
    expect((reduce(filled, setUnit('')) as BarState).unit).toBeNull();
    expect(reduce(state, setPart(5, '3'))).toBe(state);
  });
});

describe('식 칸(symbols)', () => {
  const symbols: BarModelConfig = { mode: 'bar-model', look: 'symbols' };

  it('35 × 3/7 → 값 15, 첫 사람 몫과 같다', () => {
    const o = obs(play(symbols, [{ type: 'set-expr', value: '35 × 3/7' }]));
    expect(o['exprValue']).toBe('15');
    expect(o['exprMatchesPart']).toBe(0);
    expect(o['unitCorrect']).toBeNull();
    expect(o['misconceptions']).toEqual([]);
    expect(predicates['exprMatchesPart']?.(o, { index: 0 })).toBe(true);
    expect(predicates['exprMatchesPart']?.(o, { index: 1 })).toBe(false);
  });

  it('35 × 4/7 → 둘째 사람, 괄호·÷도 계산한다', () => {
    expect(obs(play(symbols, [{ type: 'set-expr', value: '35 × 4/7' }]))['exprMatchesPart']).toBe(
      1,
    );
    expect(
      obs(play(symbols, [{ type: 'set-expr', value: '(35 ÷ 7) × 4' }]))['exprMatchesPart'],
    ).toBe(1);
  });

  it('35 ÷ 3(전체 ÷ 한 항)은 MC, 값이 분수여도 Rational으로 센다', () => {
    const o = obs(play(symbols, [{ type: 'set-expr', value: '35 ÷ 3' }]));
    expect(o['exprValue']).toBe('35/3');
    expect(o['exprMatchesPart']).toBeNull();
    expect(o['misconceptions']).toEqual([MC]);
  });

  it('문법이 틀리거나 0으로 나누면 값 없음, 허용 밖 글자는 거절', () => {
    expect(obs(play(symbols, [{ type: 'set-expr', value: '35 ×' }]))['exprValue']).toBeNull();
    expect(obs(play(symbols, [{ type: 'set-expr', value: '35 ÷ 0' }]))['exprValue']).toBeNull();
    const state = play(symbols);
    expect(reduce(state, { type: 'set-expr', value: '35 x 3' })).toBe(state);
    expect(reduce(state, { type: 'set-expr', value: '35 : 7' })).toBe(state);
    expect(reduce(state, { type: 'set-expr', value: '1'.repeat(41) })).toBe(state);
  });

  it('symbols에서는 한 칸 크기 칸을, bars에서는 식 칸을 받지 않는다', () => {
    const sym = play(symbols);
    expect(reduce(sym, setUnit('5'))).toBe(sym);
    const bars = play({ mode: 'bar-model' });
    expect(reduce(bars, { type: 'set-expr', value: '35 × 3/7' })).toBe(bars);
  });
});

describe('설정 오류와 JSON 왕복', () => {
  const base: BarModelConfig = {
    mode: 'bar-model',
    problem: '구슬 35개를 3 : 4로 나눕니다.',
    parts: ['가', '나'],
    ratio: [3, 4],
    total: 35,
  };
  const bad = (patch: Partial<BarModelConfig>) =>
    createInitialState({ ...base, ...patch }).error !== null;

  it('유효한 설정은 오류가 없다', () => {
    expect(bad({})).toBe(false);
    expect(bad({ parts: ['가', '나', '다'], ratio: [1, 2, 3], total: 12 })).toBe(false);
    expect(bad({ ratio: [1, 12], total: 13 })).toBe(false);
  });

  it('나누어떨어지지 않거나 범위 밖이면 설정 오류', () => {
    expect(bad({ total: 36 })).toBe(true);
    expect(bad({ total: 0 })).toBe(true);
    expect(bad({ total: undefined, known: undefined })).toBe(true);
    expect(bad({ known: { part: 0, value: 21 } })).toBe(true);
    expect(bad({ total: undefined, known: { part: 0, value: 20 } })).toBe(true);
    expect(bad({ total: undefined, known: { part: 2, value: 21 } })).toBe(true);
    expect(bad({ total: undefined, known: { part: 0, value: 21 } })).toBe(false);
    expect(bad({ parts: ['가'], ratio: [7] })).toBe(true);
    expect(bad({ parts: ['가', '나', '다', '라'], ratio: [1, 1, 1, 1], total: 4 })).toBe(true);
    expect(bad({ ratio: [3] })).toBe(true);
    expect(bad({ ratio: [0, 7] })).toBe(true);
    expect(bad({ ratio: [13, 22] })).toBe(true);
    expect(bad({ ratio: [1.5, 5.5] })).toBe(true);
    expect(bad({ problem: '   ' })).toBe(true);
    expect(bad({ look: 'table' as never })).toBe(true);
  });

  it('형광펜 목표가 문장에 없으면 설정 오류', () => {
    expect(bad({ highlight: { total: '99', ratio: ['3'] } })).toBe(true);
    expect(bad({ highlight: { total: '35', ratio: ['3', '4'] } })).toBe(false);
    expect(bad({ highlight: null })).toBe(false);
  });

  it('설정 오류면 reduce는 아무것도 바꾸지 않는다', () => {
    const state = createInitialState({ ...base, total: 36 });
    expect(reduce(state, { type: 'mark', index: 0 })).toBe(state);
  });

  it('상태는 JSON을 거쳐도 같고, 이어서 조작할 수 있다', () => {
    const state = play({ mode: 'bar-model' }, [
      ...highlightAll(play({ mode: 'bar-model' })),
      setUnit('5'),
      setPart(0, '15'),
    ]);
    const copy = JSON.parse(JSON.stringify(state)) as BarState;
    expect(copy).toEqual(state);
    expect(obs(copy)).toEqual(obs(state));
    const next = reduce(copy, setPart(1, '20')) as BarState;
    expect(obs(next)['partsCorrect']).toEqual([true, true]);
  });

  it('reset은 칠한 것과 쓴 값을 지우고 알려 준 몫은 남긴다', () => {
    const config: BarModelConfig = {
      mode: 'bar-model',
      problem: '형 동생 3 : 5 형 24',
      parts: ['형', '동생'],
      ratio: [3, 5],
      known: { part: 0, value: 24 },
    };
    const dirty = play(config, [
      { type: 'mark', index: 0 },
      setUnit('8'),
      setPart(1, '40'),
      { type: 'set-total', value: '64' },
    ]);
    const clean = reduce(dirty, { type: 'reset' }) as BarState;
    expect(clean.marks).toEqual({});
    expect(clean.unit).toBeNull();
    expect(clean.partValues).toEqual(['24', null]);
    expect(clean.totalValue).toBeNull();
    expect(reduce(clean, { type: 'reset' })).toBe(clean);
  });
});
