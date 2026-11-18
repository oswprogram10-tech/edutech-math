/**
 * E18 T156: 그림그래프(pictograph)와 학급 투표(class-vote) reduce·observe·predicates·배치 단위 테스트.
 */
import { describe, expect, it } from 'vitest';
import { assertSerializable } from '../../../core/engine-sdk';
import type { JsonValue, Observation } from '../../../core/engine-sdk';
import { emit, predicates } from '../events';
import { observe } from '../observe';
import { ICON_GAP, iconAt, lassoOutcome, pictoLayout } from '../picto-layout';
import { createInitialState, normalizeSettings, reduce, splitValue } from '../reduce';
import type { GraphAction, GraphConfig, GraphState } from '../types';
import { voteCounts, voteViewState } from '../vote';

function call(name: string, observation: Observation, args?: JsonValue): boolean | undefined {
  return predicates[name]?.(observation, args);
}

const APPLES = { 가: 32, 나: 25, 다: 41, 라: 18 } as const;

function apply(config: GraphConfig, actions: readonly GraphAction[]): GraphState {
  return actions.reduce<GraphState>(
    (state, action) => reduce(state, action),
    createInitialState(config),
  );
}

function times(count: number, action: GraphAction): GraphAction[] {
  return Array.from({ length: count }, () => action);
}

function rowOf(state: GraphState, cat: string): { big: number; small: number } {
  if (state.mode !== 'pictograph') throw new Error('pictograph 상태가 아닙니다.');
  const row = state.rows[cat];
  if (!row) throw new Error('행이 없습니다.');
  return { big: row.big, small: row.small };
}

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

describe('pictograph 설정', () => {
  it('기본값: 범례 10, 후보 [10, 5], 아이콘 apple, 학생이 만들기, keep-icons', () => {
    const settings = normalizeSettings({ data: APPLES }, 'pictograph');
    expect(settings).toMatchObject({
      legendBig: 10,
      legendOptions: [10, 5],
      icon: 'apple',
      build: 'student',
      legendChange: 'keep-icons',
      legendEditable: false,
      graph: 'student',
      showTable: true,
      showPictograph: true,
      showGraph: false,
    });
  });

  it('compressGroup은 legend.big과 같고, 둘 다 오면 legend가 이긴다', () => {
    expect(normalizeSettings({ compressGroup: 5 }, 'pictograph').legendBig).toBe(5);
    expect(
      normalizeSettings({ compressGroup: 5, legend: { big: 10, small: 1 } }, 'pictograph')
        .legendBig,
    ).toBe(10);
    expect(
      normalizeSettings({ compressGroup: 5, legend: { big: 4 } }, 'pictograph').legendBig,
    ).toBe(4);
  });

  it('범례 값은 2 이상의 정수만 받는다(아니면 기본 10)', () => {
    expect(normalizeSettings({ legend: { big: 1 } }, 'pictograph').legendBig).toBe(10);
    expect(normalizeSettings({ legend: { big: 2.5 } }, 'pictograph').legendBig).toBe(10);
    expect(normalizeSettings({ legend: { big: 0 } }, 'pictograph').legendBig).toBe(10);
    expect(normalizeSettings({ legend: { big: 2 } }, 'pictograph').legendBig).toBe(2);
  });

  it('table-to-graph의 views에 pictograph가 있으면 그림그래프를 보이고 막대는 숨긴다', () => {
    const settings = normalizeSettings(
      { data: APPLES, views: ['table', 'pictograph'], legend: { big: 10, small: 1 } },
      'table-to-graph',
    );
    expect(settings.showPictograph).toBe(true);
    expect(settings.showGraph).toBe(false);
    expect(normalizeSettings({ data: APPLES }, 'table-to-graph').showPictograph).toBe(false);
  });
});

describe('pictograph reduce: 묶기·펼치기 경계', () => {
  const config: GraphConfig = { mode: 'pictograph', data: APPLES };

  it('작은 그림이 정확히 legendBig개면 묶인다(big +1, small −10)', () => {
    const state = apply(config, times(10, { type: 'add-small', cat: '가' }));
    expect(rowOf(state, '가')).toEqual({ big: 0, small: 10 });
    const next = reduce(state, { type: 'compress', cat: '가' });
    expect(rowOf(next, '가')).toEqual({ big: 1, small: 0 });
    expect(next.mode === 'pictograph' && next.compressions).toBe(1);
  });

  it('작은 그림이 legendBig개 미만이면 묶기는 상태를 그대로 둔다', () => {
    const state = apply(config, times(9, { type: 'add-small', cat: '가' }));
    expect(reduce(state, { type: 'compress', cat: '가' })).toBe(state);
  });

  it('11개면 묶고 1개가 남는다', () => {
    const state = apply(config, [
      ...times(11, { type: 'add-small', cat: '가' }),
      { type: 'compress', cat: '가' },
    ]);
    expect(rowOf(state, '가')).toEqual({ big: 1, small: 1 });
  });

  it('펼치기는 big ≥ 1일 때만, 값은 그대로다', () => {
    const empty = createInitialState(config);
    expect(reduce(empty, { type: 'expand', cat: '가' })).toBe(empty);
    const compressed = apply(config, [
      ...times(10, { type: 'add-small', cat: '가' }),
      { type: 'compress', cat: '가' },
    ]);
    const expanded = reduce(compressed, { type: 'expand', cat: '가' });
    expect(rowOf(expanded, '가')).toEqual({ big: 0, small: 10 });
    expect(expanded.mode === 'pictograph' && expanded.expansions).toBe(1);
    expect(observe(expanded)['rowValues']).toEqual(observe(compressed)['rowValues']);
  });

  it('작은·큰 그림 빼기는 0 아래로 내려가지 않는다', () => {
    const empty = createInitialState(config);
    expect(reduce(empty, { type: 'remove-small', cat: '가' })).toBe(empty);
    expect(reduce(empty, { type: 'remove-big', cat: '가' })).toBe(empty);
    const state = apply(config, [
      ...times(10, { type: 'add-small', cat: '가' }),
      { type: 'compress', cat: '가' },
      { type: 'remove-big', cat: '가' },
    ]);
    expect(rowOf(state, '가')).toEqual({ big: 0, small: 0 });
  });

  it('알 수 없는 행과 주어진(given) 그림그래프는 놓기·묶기를 무시한다', () => {
    const state = createInitialState(config);
    expect(reduce(state, { type: 'add-small', cat: '없음' })).toBe(state);
    const given = createInitialState({ ...config, build: 'given' });
    expect(reduce(given, { type: 'add-small', cat: '가' })).toBe(given);
    expect(reduce(given, { type: 'compress', cat: '가' })).toBe(given);
  });

  it('한 행의 값은 100을 넘기지 않는다', () => {
    const state = apply(config, times(120, { type: 'add-small', cat: '가' }));
    expect(rowOf(state, '가').small).toBe(100);
  });

  it('다른 모드에서는 그림 Action을 무시한다', () => {
    const state = createInitialState({ data: APPLES });
    expect(reduce(state, { type: 'add-small', cat: '가' })).toBe(state);
    expect(reduce(state, { type: 'vote', option: '가' })).toBe(state);
  });
});

describe('pictograph set-legend', () => {
  const config: GraphConfig = { mode: 'pictograph', data: APPLES, legendEditable: true };

  it('keep-icons(기본)는 놓인 그림을 그대로 두고 값 해석만 새 범례로 바뀐다', () => {
    const state = apply(config, [
      ...times(10, { type: 'add-small', cat: '가' }),
      { type: 'compress', cat: '가' },
      ...times(2, { type: 'add-small', cat: '가' }),
      { type: 'set-legend', big: 5 },
    ]);
    expect(rowOf(state, '가')).toEqual({ big: 1, small: 2 });
    const observation = observe(state);
    expect(observation['legendBig']).toBe(5);
    expect(record(observation['rowValues'])['가']).toBe(7);
    expect(observation['rowsMatchData']).toBe(false);
  });

  it('recalculate는 자료 값으로 다시 채운다(32 → 큰 6 + 작은 2)', () => {
    const state = apply({ ...config, legendChange: 'recalculate' }, [
      ...times(3, { type: 'add-small', cat: '가' }),
      { type: 'set-legend', big: 5 },
    ]);
    expect(rowOf(state, '가')).toEqual({ big: 6, small: 2 });
    expect(rowOf(state, '다')).toEqual({ big: 8, small: 1 });
    expect(observe(state)['rowsMatchData']).toBe(true);
  });

  it('legendOptions 밖의 값과 같은 값은 무시한다', () => {
    const state = createInitialState(config);
    expect(reduce(state, { type: 'set-legend', big: 7 })).toBe(state);
    expect(reduce(state, { type: 'set-legend', big: 10 })).toBe(state);
  });

  it('주어진 그림그래프는 범례를 바꾸면 늘 자료 값으로 다시 그린다', () => {
    const state = apply({ ...config, build: 'given' }, [{ type: 'set-legend', big: 5 }]);
    expect(rowOf(state, '가')).toEqual({ big: 6, small: 2 });
  });

  it('legendOptions를 설정으로 바꿀 수 있다', () => {
    const state = apply({ ...config, legendOptions: [10, 2] }, [{ type: 'set-legend', big: 2 }]);
    expect(observe(state)['legendBig']).toBe(2);
    const same = createInitialState({ ...config, legendOptions: [10, 2] });
    expect(reduce(same, { type: 'set-legend', big: 5 })).toBe(same);
  });
});

describe('pictograph observe·predicates', () => {
  const config: GraphConfig = { mode: 'pictograph', data: { 가: 12, 나: 3 } };

  function drawn(): GraphState {
    return apply(config, [
      ...times(12, { type: 'add-small', cat: '가' }),
      ...times(3, { type: 'add-small', cat: '나' }),
    ]);
  }

  it('rowValues = big × legendBig + small, iconTotal은 큰+작은 그림 수', () => {
    const state = reduce(drawn(), { type: 'compress', cat: '가' });
    const observation = observe(state);
    expect(observation['rowValues']).toEqual({ 가: 12, 나: 3 });
    expect(observation['rows']).toEqual({ 가: { big: 1, small: 2 }, 나: { big: 0, small: 3 } });
    expect(observation['iconTotal']).toBe(6);
    expect(observation['compressions']).toBe(1);
    expect(observation['rowsMatchData']).toBe(true);
    expect(observation['mode']).toBe('pictograph');
    expect(observation['misconceptions']).toEqual([]);
  });

  it('rowsMatchData·rowValueIs·legendIs', () => {
    const state = drawn();
    const observation = observe(state);
    expect(call('rowsMatchData', observation)).toBe(true);
    expect(call('rowValueIs', observation, { cat: '가', value: 12 })).toBe(true);
    expect(call('rowValueIs', observation, { cat: '가', value: 11 })).toBe(false);
    expect(call('legendIs', observation, { big: 10 })).toBe(true);
    expect(call('legendIs', observation, { big: 5 })).toBe(false);
    const short = reduce(state, { type: 'remove-small', cat: '나' });
    expect(call('rowsMatchData', observe(short))).toBe(false);
  });

  it('allRowsCompressed: 작은 그림이 legendBig개 이상 남은 행이 있으면 거짓', () => {
    const state = drawn();
    expect(call('allRowsCompressed', observe(state))).toBe(false);
    const compressed = reduce(state, { type: 'compress', cat: '가' });
    expect(call('allRowsCompressed', observe(compressed))).toBe(true);
    // 아무것도 놓지 않은 처음 상태는 "다 묶었다"가 참이므로, 콘텐츠는 rowsMatchData와 함께 쓴다.
    expect(call('allRowsCompressed', observe(createInitialState(config)))).toBe(true);
  });

  it('g3s2u6.A1 과제 1: rowsMatchData + allRowsCompressed는 다 묶고 값이 맞을 때만 참', () => {
    const full = apply({ mode: 'pictograph', data: APPLES }, [
      ...times(32, { type: 'add-small', cat: '가' }),
      ...times(25, { type: 'add-small', cat: '나' }),
      ...times(41, { type: 'add-small', cat: '다' }),
      ...times(18, { type: 'add-small', cat: '라' }),
    ]);
    const check = (state: GraphState) =>
      call('rowsMatchData', observe(state)) === true &&
      call('allRowsCompressed', observe(state)) === true;
    expect(check(full)).toBe(false);
    let done = full;
    for (const cat of Object.keys(APPLES)) {
      for (let i = 0; i < 4; i += 1) done = reduce(done, { type: 'compress', cat });
    }
    expect(check(done)).toBe(true);
    expect(rowOf(done, '다')).toEqual({ big: 4, small: 1 });
  });

  it('g3s2u6.A1 과제 3: 범례 5로 바꿔 다시 나타내면 legendIs {big:5}도 참이다', () => {
    const base: GraphConfig = { mode: 'pictograph', data: { 가: 12 }, legendEditable: true };
    // keep-icons: 학생이 놓은 그림을 펼치고 새 범례로 다시 묶는다.
    let state = apply(base, [
      ...times(12, { type: 'add-small', cat: '가' }),
      { type: 'compress', cat: '가' },
      { type: 'set-legend', big: 5 },
    ]);
    expect(call('rowsMatchData', observe(state))).toBe(false);
    // 범례 5 아래에서는 큰 그림 1개가 5이므로 작은 그림을 5개 더 놓고 묶는다.
    for (let i = 0; i < 5; i += 1) state = reduce(state, { type: 'add-small', cat: '가' });
    state = reduce(state, { type: 'compress', cat: '가' });
    const observation = observe(state);
    expect(rowOf(state, '가')).toEqual({ big: 2, small: 2 });
    expect(call('legendIs', observation, { big: 5 })).toBe(true);
    expect(call('rowsMatchData', observation)).toBe(true);
    expect(call('allRowsCompressed', observation)).toBe(true);
  });

  it('table-to-graph 그림그래프 보기(주어진 그림)는 자료를 큰·작은 그림으로 가른다', () => {
    expect(splitValue(41, 10)).toEqual({ big: 4, small: 1 });
    expect(splitValue(0, 10)).toEqual({ big: 0, small: 0 });
    expect(splitValue(10, 10)).toEqual({ big: 1, small: 0 });
    expect(splitValue(9, 10)).toEqual({ big: 0, small: 9 });
  });

  it('이벤트: 묶기·펼치기·범례·행 변화', () => {
    const state = createInitialState({ ...config, legendEditable: true });
    const added = reduce(state, { type: 'add-small', cat: '가' });
    expect(emit(state, added, { type: 'add-small', cat: '가' })).toEqual([
      { name: 'rows-changed', payload: { cat: '가' } },
    ]);
    const full = apply(
      { ...config, legendEditable: true },
      times(10, { type: 'add-small', cat: '가' }),
    );
    const compressed = reduce(full, { type: 'compress', cat: '가' });
    const names = emit(full, compressed, { type: 'compress', cat: '가' }).map((e) => e.name);
    expect(names).toEqual(['compressed', 'rows-changed']);
    const legend = reduce(compressed, { type: 'set-legend', big: 5 });
    expect(emit(compressed, legend, { type: 'set-legend', big: 5 })).toEqual([
      { name: 'legend-changed', payload: { big: 5 } },
    ]);
    expect(emit(state, state, { type: 'expand', cat: '가' })).toEqual([]);
  });

  it('모든 상태가 직렬화된다', () => {
    const states = [
      createInitialState(config),
      drawn(),
      apply({ ...config, legendEditable: true }, [{ type: 'set-legend', big: 5 }]),
      createInitialState({ mode: 'class-vote', options: ['🍎', '🍌'] }),
    ];
    for (const state of states) {
      assertSerializable(state);
      assertSerializable(observe(state));
    }
  });
});

describe('그림 배치와 올가미 판정', () => {
  const cats = ['가', '나'];

  it('작은 그림 한 변은 icon px이고 누르는 자리(그림 + 간격)는 targetSize 이상이다', () => {
    for (const target of [48, 64]) {
      const layout = pictoLayout(
        cats,
        { 가: { big: 1, small: 4 }, 나: { big: 0, small: 3 } },
        600,
        target,
      );
      const small = layout.rows[0]?.items.find((item) => item.kind === 'small');
      const big = layout.rows[0]?.items.find((item) => item.kind === 'big');
      expect(small?.side).toBe(target);
      expect((small?.side ?? 0) + ICON_GAP).toBeGreaterThanOrEqual(target);
      expect(big?.side).toBe(Math.round(target * 1.6));
      expect(big?.side).toBeGreaterThan(small?.side ?? 0);
    }
  });

  it('그림은 겹치지 않고 가로폭을 넘지 않으며, 좁으면 줄을 접는다', () => {
    const rows = { 가: { big: 2, small: 13 }, 나: { big: 0, small: 5 } };
    const wide = pictoLayout(cats, rows, 900, 48);
    const narrow = pictoLayout(cats, rows, 330, 64);
    expect(narrow.height).toBeGreaterThan(wide.height);
    for (const layout of [wide, narrow]) {
      for (const row of layout.rows) {
        for (const item of row.items) {
          expect(item.x).toBeGreaterThanOrEqual(layout.labelWidth);
          expect(item.x + item.side).toBeLessThanOrEqual(layout.width);
          expect(item.y).toBeGreaterThanOrEqual(row.top);
          expect(item.y + item.side).toBeLessThanOrEqual(row.top + row.height);
        }
        for (let a = 0; a < row.items.length; a += 1) {
          for (let b = a + 1; b < row.items.length; b += 1) {
            const p = row.items[a];
            const q = row.items[b];
            if (!p || !q) continue;
            const apart =
              p.x + p.side <= q.x ||
              q.x + q.side <= p.x ||
              p.y + p.side <= q.y ||
              q.y + q.side <= p.y;
            expect(apart).toBe(true);
          }
        }
      }
    }
  });

  it('빈 행도 한 줄 높이를 가지고, 그림이 없으면 iconAt은 null이다', () => {
    const layout = pictoLayout(cats, {}, 500, 48);
    expect(layout.rows).toHaveLength(2);
    expect(layout.rows[0]?.height).toBeGreaterThan(48);
    expect(iconAt(layout, { x: 300, y: 20 })).toBeNull();
  });

  it('iconAt은 그림 위의 점에서 그 그림을 돌려준다', () => {
    const layout = pictoLayout(
      cats,
      { 가: { big: 1, small: 2 }, 나: { big: 0, small: 1 } },
      600,
      48,
    );
    const first = layout.rows[0]?.items[0];
    const second = layout.rows[0]?.items[1];
    if (!first || !second) throw new Error('그림이 없습니다.');
    expect(iconAt(layout, { x: first.x + 5, y: first.y + 5 })).toEqual({
      cat: '가',
      kind: 'big',
      index: 0,
    });
    expect(iconAt(layout, { x: second.x + 5, y: second.y + 5 })).toEqual({
      cat: '가',
      kind: 'small',
      index: 0,
    });
  });

  function around(
    layout: ReturnType<typeof pictoLayout>,
    rowIndex: number,
    from: number,
    to: number,
  ) {
    const items = (layout.rows[rowIndex]?.items ?? [])
      .filter((item) => item.kind === 'small')
      .slice(from, to);
    const xs = items.flatMap((item) => [item.x - 4, item.x + item.side + 4]);
    const ys = items.flatMap((item) => [item.y - 4, item.y + item.side + 4]);
    const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    return [
      { x: x0, y: y0 },
      { x: x1, y: y0 },
      { x: x1, y: y1 },
      { x: x0, y: y1 },
    ];
  }

  it('같은 행의 작은 그림 10개를 둘러싸면 묶음이다', () => {
    const layout = pictoLayout(
      cats,
      { 가: { big: 0, small: 10 }, 나: { big: 0, small: 4 } },
      700,
      48,
    );
    expect(lassoOutcome(layout, around(layout, 0, 0, 10), 10)).toEqual({
      type: 'compress',
      cat: '가',
    });
  });

  it('9개만 둘러싸면 묶지 않고(count), 11개 행에서 10개만 둘러싸도 묶음이다', () => {
    const layout = pictoLayout(
      cats,
      { 가: { big: 0, small: 11 }, 나: { big: 0, small: 4 } },
      1000,
      48,
    );
    expect(lassoOutcome(layout, around(layout, 0, 0, 9), 10)).toEqual({
      type: 'miss',
      reason: 'count',
    });
    expect(lassoOutcome(layout, around(layout, 0, 0, 10), 10)).toEqual({
      type: 'compress',
      cat: '가',
    });
    expect(lassoOutcome(layout, around(layout, 0, 0, 11), 10)).toEqual({
      type: 'miss',
      reason: 'count',
    });
  });

  it('두 행에 걸치면 묶지 않고(rows), 아무것도 안 둘러싸면 empty다', () => {
    const layout = pictoLayout(
      cats,
      { 가: { big: 0, small: 6 }, 나: { big: 0, small: 6 } },
      700,
      48,
    );
    const top = layout.rows[0];
    const bottom = layout.rows[1];
    if (!top || !bottom) throw new Error('행이 없습니다.');
    const both = [
      { x: 0, y: top.top },
      { x: 700, y: top.top },
      { x: 700, y: bottom.top + bottom.height },
      { x: 0, y: bottom.top + bottom.height },
    ];
    expect(lassoOutcome(layout, both, 6)).toEqual({ type: 'miss', reason: 'rows' });
    const nothing = [
      { x: 1, y: 1 },
      { x: 5, y: 1 },
      { x: 5, y: 5 },
    ];
    expect(lassoOutcome(layout, nothing, 6)).toEqual({ type: 'miss', reason: 'empty' });
  });

  it('큰 그림은 올가미 개수에 세지 않는다', () => {
    const layout = pictoLayout(
      cats,
      { 가: { big: 1, small: 10 }, 나: { big: 0, small: 0 } },
      800,
      48,
    );
    const row = layout.rows[0];
    if (!row) throw new Error('행이 없습니다.');
    const whole = [
      { x: 0, y: row.top },
      { x: 800, y: row.top },
      { x: 800, y: row.top + row.height },
      { x: 0, y: row.top + row.height },
    ];
    expect(lassoOutcome(layout, whole, 10)).toEqual({ type: 'compress', cat: '가' });
  });
});

describe('class-vote', () => {
  const config: GraphConfig = {
    mode: 'class-vote',
    question: '좋아하는 과일',
    options: ['🍎', '🍌', '🍇', '🍓'],
    transport: 'local-device',
    graphType: 'o-mark',
    stackFrom: 'bottom',
    showTable: 'sync',
  };

  it('설정: 범주는 options, ○ 그래프·표 동기, axisMax 기본 10', () => {
    const settings = normalizeSettings(config, 'class-vote');
    expect(settings).toMatchObject({
      categories: ['🍎', '🍌', '🍇', '🍓'],
      graphType: 'o-mark',
      graph: 'given',
      table: 'given',
      axisMax: 10,
      scale: 1,
      question: '좋아하는 과일',
    });
  });

  it('투표는 누른 순서대로 쌓이고, 표 값과 ○ 수가 투표 수와 같다', () => {
    const state = apply(config, [
      { type: 'vote', option: '🍎' },
      { type: 'vote', option: '🍌' },
      { type: 'vote', option: '🍎' },
    ]);
    expect(state.mode === 'class-vote' && state.votes).toEqual(['🍎', '🍌', '🍎']);
    const observation = observe(state);
    expect(observation['voteTotal']).toBe(3);
    expect(observation['voteCounts']).toEqual({ '🍎': 2, '🍌': 1, '🍇': 0, '🍓': 0 });
    expect(observation['table']).toEqual({ '🍎': 2, '🍌': 1, '🍇': 0, '🍓': 0 });
    expect(observation['graphCells']).toEqual({ '🍎': 2, '🍌': 1, '🍇': 0, '🍓': 0 });
    expect(observation['mode']).toBe('class-vote');
    expect(observation['tableTotal']).toBe(3);
    expect(observation).not.toHaveProperty('graphMatchesData');
  });

  it('하나 지우기는 마지막 투표를 취소하고, 빈 상태에서는 아무 일도 없다', () => {
    const empty = createInitialState(config);
    expect(reduce(empty, { type: 'undo-vote' })).toBe(empty);
    const state = apply(config, [
      { type: 'vote', option: '🍎' },
      { type: 'vote', option: '🍌' },
      { type: 'undo-vote' },
    ]);
    expect(state.mode === 'class-vote' && state.votes).toEqual(['🍎']);
    const reset = reduce(state, { type: 'reset-votes' });
    expect(reset.mode === 'class-vote' && reset.votes).toEqual([]);
  });

  it('axisMax에 이른 열의 투표는 무시한다(경계: 10번째까지, 11번째는 무시)', () => {
    const ten = apply(config, times(10, { type: 'vote', option: '🍎' }));
    expect(observe(ten)['voteTotal']).toBe(10);
    expect(reduce(ten, { type: 'vote', option: '🍎' })).toBe(ten);
    // 다른 열은 계속 받는다.
    expect(observe(reduce(ten, { type: 'vote', option: '🍌' }))['voteTotal']).toBe(11);
    const small = apply({ ...config, axisMax: 3 }, times(5, { type: 'vote', option: '🍇' }));
    expect(observe(small)['voteTotal']).toBe(3);
  });

  it('없는 선택지는 무시하고, transport의 다른 값도 local로 본다', () => {
    const state = createInitialState({ ...config, transport: 'websocket' });
    expect(reduce(state, { type: 'vote', option: '없음' })).toBe(state);
    expect(reduce(state, { type: 'vote', option: '🍎' })).not.toBe(state);
  });

  it('투표 상태에는 이름·기기 정보가 없다(선택지 문자열만)', () => {
    const state = apply(config, [{ type: 'vote', option: '🍎' }]);
    expect(Object.keys(state).sort()).toEqual(
      [
        'bars',
        'marks',
        'mode',
        'orientation',
        'scale',
        'settings',
        'table',
        'tallied',
        'votes',
      ].sort(),
    );
    assertSerializable(state);
    assertSerializable(observe(state));
  });

  it('투표 수를 자료로 바꾼 파생 상태는 ○가 아래부터 쌓이는 주어진 ○ 그래프다', () => {
    const state = apply(config, times(3, { type: 'vote', option: '🍌' }));
    if (state.mode !== 'class-vote') throw new Error('class-vote 상태가 아닙니다.');
    expect(voteCounts(state)['🍌']).toBe(3);
    const view = voteViewState(state);
    expect(view.settings.graph).toBe('given');
    expect(view.settings.graphType).toBe('o-mark');
    expect(view.settings.data).toEqual(voteCounts(state));
  });

  it('이벤트: vote-changed는 투표 수가 바뀔 때만', () => {
    const state = createInitialState(config);
    const next = reduce(state, { type: 'vote', option: '🍎' });
    expect(emit(state, next, { type: 'vote', option: '🍎' })).toEqual([
      { name: 'vote-changed', payload: { total: 1 } },
    ]);
    expect(emit(next, next, { type: 'vote', option: '없음' })).toEqual([]);
  });
});

describe('class-vote predicates', () => {
  function withResponse(voteTotal: number, value: unknown): Observation {
    return {
      voteTotal,
      voteCounts: {},
      response: { total: { raw: String(value), value, form: 'integer', valid: true } },
    } as Observation;
  }

  it('voteTotalAtLeast {n}', () => {
    const state = apply(
      { mode: 'class-vote', options: ['가', '나'] },
      times(3, { type: 'vote', option: '가' }),
    );
    const observation = observe(state);
    expect(call('voteTotalAtLeast', observation, { n: 3 })).toBe(true);
    expect(call('voteTotalAtLeast', observation, { n: 4 })).toBe(false);
    expect(call('voteTotalAtLeast', { mode: 'scale' }, { n: 0 })).toBe(false);
  });

  it('responseEqualsVoteTotal: 응답 정수 값(Rational.toJSON 문자열)이 voteTotal과 같을 때만 참', () => {
    const check = (observation: Observation) =>
      call('responseEqualsVoteTotal', observation, { field: 'total' });
    expect(check(withResponse(12, '12'))).toBe(true);
    expect(check(withResponse(12, '13'))).toBe(false);
    // 분수·소수 모양은 정수가 아니다.
    expect(check(withResponse(12, '24/2'))).toBe(false);
    expect(check(withResponse(12, '12/5'))).toBe(false);
    expect(check(withResponse(12, null))).toBe(false);
    // 숫자 그대로 오는 값도 정수면 받는다.
    expect(check(withResponse(12, 12))).toBe(true);
    expect(check(withResponse(12, 12.5))).toBe(false);
  });

  it('responseEqualsVoteTotal: 투표가 0표면 거짓이고, 다른 칸 id나 응답이 없어도 거짓이다', () => {
    expect(call('responseEqualsVoteTotal', withResponse(0, '0'), { field: 'total' })).toBe(false);
    expect(call('responseEqualsVoteTotal', withResponse(5, '5'), { field: 'other' })).toBe(false);
    expect(call('responseEqualsVoteTotal', { voteTotal: 5 }, { field: 'total' })).toBe(false);
    expect(call('responseEqualsVoteTotal', withResponse(5, '5'), {})).toBe(false);
  });

  it('실제 observe 결과와 응답을 합친 Observation으로 판정한다', () => {
    const state = apply({ mode: 'class-vote', options: ['가', '나'] }, [
      { type: 'vote', option: '가' },
      { type: 'vote', option: '나' },
      { type: 'vote', option: '나' },
    ]);
    const merged: Observation = {
      ...observe(state),
      response: {
        total: { raw: '3', value: '3', form: 'integer', valid: true, irreducible: true },
      },
    };
    expect(call('responseEqualsVoteTotal', merged, { field: 'total' })).toBe(true);
  });
});
