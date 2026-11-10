/**
 * E11 slice·formula-derive 단위 테스트.
 *
 * 카드 T106 결정 6·9·17의 자르기·옮기기·경첩·복제·겹침·스냅을 고정한다.
 * 넓이는 모두 Rational 문자열이고, 상태는 늘 JSON 직렬화 가능해야 한다.
 */
import { describe, expect, it } from 'vitest';
import { assertSerializable } from '../../../core/engine-sdk';
import type { JsonValue, Observation } from '../../../core/engine-sdk';
import { Rational } from '../../../core/math';
import { observe } from '../observe';
import { createInitialState, reduce } from '../reduce';
import type { CutAction, CutConfig, CutState } from '../types';
import { rp, rpointOf, toG } from '../rpoint';
import { averageOfRPoints } from '../rpoint';
import type { Piece, PiecesState } from '../pieces/types';
import { createPiecesState } from '../pieces/reduce';
import { cutCandidates } from '../pieces/candidates';
import { snapTranslation } from '../pieces/snap';
import { predicates } from '../events';

function isRecord(value: JsonValue | undefined): value is Readonly<Record<string, JsonValue>> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function record(value: JsonValue | undefined): Readonly<Record<string, JsonValue>> | null {
  return isRecord(value) ? value : null;
}

function piecesState(state: CutState): PiecesState {
  if (state.mode === 'angle-gather') throw new Error('angle-gather 상태가 나왔습니다.');
  return state;
}

function apply(config: CutConfig, actions: readonly CutAction[]): PiecesState {
  let state = createInitialState(config);
  assertSerializable(state);
  for (const action of actions) {
    state = reduce(state, action);
    assertSerializable(state);
  }
  return piecesState(state);
}

function pieceObservations(observation: Observation): Readonly<Record<string, JsonValue>>[] {
  const value = observation['pieces'];
  if (!Array.isArray(value)) return [];
  return value.filter(isRecord);
}

function centerOf(piece: Piece): { readonly x: number; readonly y: number } {
  const center = averageOfRPoints(piece.vertices);
  return {
    x: Number(center.x.n) / Number(center.x.d),
    y: Number(center.y.n) / Number(center.y.d),
  };
}

function cutDefault(state: PiecesState): PiecesState {
  return reduce(state, {
    type: 'cut',
    piece: 'p1',
    from: rp(4, 2),
    to: rp(4, 6),
  }) as PiecesState;
}

describe('E11 formula-derive 기본 평행사변형', () => {
  it('기본 도형은 판 (4,2)(10,2)(8,6)(2,6)이고 넓이는 24다', () => {
    const state = apply({ mode: 'formula-derive' }, []);
    expect(state.pieces).toHaveLength(1);
    expect(state.pieces[0]?.vertices).toEqual([
      ['4', '2'],
      ['10', '2'],
      ['8', '6'],
      ['2', '6'],
    ]);
    const observation = observe(state);
    expect(observation['originalArea']).toBe('24');
    expect(observation['totalArea']).toBe('24');
    expect(observation['areaConserved']).toBe(true);
    expect(record(observation['outline'])?.['kind']).toBe('parallelogram');
  });

  it('현 (4,2)-(4,6)으로 자르면 넓이 4·20 조각 두 개가 되고 첫 조각이 삼각형이다', () => {
    const state = apply({ mode: 'formula-derive' }, [
      { type: 'cut', piece: 'p1', from: rp(4, 2), to: rp(4, 6) },
    ]);
    expect(state.cuts).toBe(1);
    expect(state.pieces).toHaveLength(2);
    const observation = observe(state);
    const pieces = pieceObservations(observation);
    expect(pieces).toHaveLength(2);
    expect(pieces[0]?.['area']).toBe('4');
    expect(pieces[0]?.['vertices']).toBe(3);
    expect(pieces[1]?.['area']).toBe('20');
    expect(observation['totalArea']).toBe('24');
    expect(observation['areaConserved']).toBe(true);
    expect(observation['overlap']).toBe(false);
  });

  it('삼각형 조각을 (6,0) 옮기면 외곽이 6×4 직사각형이고 도구 기록이 남는다', () => {
    let state = apply({ mode: 'formula-derive' }, [
      { type: 'cut', piece: 'p1', from: rp(4, 2), to: rp(4, 6) },
    ]);
    const triangle = state.pieces[0];
    expect(triangle?.vertices).toHaveLength(3);
    if (!triangle) return;
    state = reduce(state, {
      type: 'move-piece',
      piece: triangle.id,
      by: rp(6, 0),
    }) as PiecesState;
    const observation = observe(state);
    expect(predicates['outlineIs']?.(observation, { kind: 'rectangle' })).toBe(true);
    expect(
      predicates['outlineIs']?.(observation, {
        kind: 'rectangle',
        width: '6',
        height: '4',
      }),
    ).toBe(true);
    expect(observation['outline'] && record(observation['outline'])?.['kind']).toBe('rectangle');
    expect(observation['totalArea']).toBe('24');
    expect(observation['areaRatio']).toBe('1');
    expect(observation['toolsUsed']).toEqual(['move', 'scissors']);
    expect(predicates['areaPreserved']?.(observation, undefined)).toBe(true);
  });

  it('겹치게 옮기면 overlap이 true이고 외곽이 null이다', () => {
    let state = apply({ mode: 'formula-derive' }, [
      { type: 'cut', piece: 'p1', from: rp(4, 2), to: rp(4, 6) },
    ]);
    const triangle = state.pieces[0];
    expect(triangle?.vertices).toHaveLength(3);
    if (!triangle) return;
    state = reduce(state, {
      type: 'move-piece',
      piece: triangle.id,
      by: rp(4, 0),
    }) as PiecesState;
    const observation = observe(state);
    expect(observation['overlap']).toBe(true);
    expect(observation['outline']).toBeNull();
    expect(observation['areaConserved']).toBe(true);
    expect(predicates['areaPreserved']?.(observation, undefined)).toBe(false);
  });
});

describe('E11 formula-derive 삼각형 복제·경첩', () => {
  it('복제 → 사본 m12 (14,4) 경첩 → (-8,0) 이동이 평행사변형을 만든다', () => {
    const state = apply(
      { mode: 'formula-derive', shape: { type: 'triangle', base: 6, height: 4, apex: 2 } },
      [
        { type: 'duplicate', piece: 'p1' },
        { type: 'hinge', piece: 'p2', at: rp(14, 4) },
        { type: 'move-piece', piece: 'p2', by: rp(-8, 0) },
      ],
    );
    const observation = observe(state);
    expect(state.copies).toBe(1);
    expect(predicates['outlineIs']?.(observation, { kind: 'parallelogram', base: '6' })).toBe(true);
    expect(record(observation['outline'])?.['kind']).toBe('parallelogram');
    expect(observation['areaRatio']).toBe('2');
    expect(observation['totalArea']).toBe('24');
    expect(predicates['usedTools']?.(observation, { tools: ['duplicate', 'hinge180'] })).toBe(true);
    expect(observation['toolsUsed']).toEqual(['duplicate', 'hinge180', 'move']);
  });
});

describe('E11 formula-derive 사다리꼴 복제·경첩', () => {
  it('복제 → 사본 m12 (27/2,4) 경첩 → (-7,0) 이동이 밑변 8 평행사변형을 만든다', () => {
    const state = apply(
      {
        mode: 'formula-derive',
        shape: { type: 'trapezoid', top: 3, bottom: 5, height: 4, offset: 1 },
      },
      [
        { type: 'duplicate', piece: 'p1' },
        {
          type: 'hinge',
          piece: 'p2',
          at: rpointOf(Rational.of(27, 2), Rational.of(4)),
        },
        { type: 'move-piece', piece: 'p2', by: rp(-7, 0) },
      ],
    );
    const observation = observe(state);
    expect(predicates['outlineIs']?.(observation, { kind: 'parallelogram', base: '8' })).toBe(true);
    expect(predicates['outlineIs']?.(observation, { kind: 'trapezoid' })).toBe(true);
    expect(record(observation['outline'])?.['kind']).toBe('parallelogram');
    expect(observation['areaConserved']).toBe(true);
    expect(observation['totalArea']).toBe('32');
  });
});

describe('E11 formula-derive 마름모 재배열', () => {
  it('대각선과 반쪽 대각선으로 자른 뒤 두 조각을 옮기면 6×4 직사각형이다', () => {
    let state = apply({ mode: 'formula-derive', shape: { type: 'rhombus', diagonals: [6, 8] } }, [
      { type: 'cut', piece: 'p1', from: rp(2, 6), to: rp(8, 6) },
    ]);
    expect(state.pieces).toHaveLength(2);

    const bottom = state.pieces[1];
    expect(bottom).toBeDefined();
    if (!bottom) return;
    state = reduce(state, {
      type: 'cut',
      piece: bottom.id,
      from: rp(5, 6),
      to: rp(5, 10),
    }) as PiecesState;
    expect(state.pieces).toHaveLength(3);

    const halves = state.pieces
      .filter((piece) => piece.id !== state.pieces[0]?.id)
      .map((piece) => ({ piece, center: centerOf(piece) }))
      .sort((first, second) => first.center.x - second.center.x);
    const [left, right] = halves;
    expect(left).toBeDefined();
    expect(right).toBeDefined();
    if (!left || !right) return;

    state = reduce(state, {
      type: 'move-piece',
      piece: left.piece.id,
      by: rp(3, -4),
    }) as PiecesState;
    state = reduce(state, {
      type: 'move-piece',
      piece: right.piece.id,
      by: rp(-3, -4),
    }) as PiecesState;

    const observation = observe(state);
    expect(predicates['outlineIs']?.(observation, { kind: 'rectangle', width: '6' })).toBe(true);
    expect(
      predicates['outlineIs']?.(observation, { kind: 'rectangle', width: '6', height: '4' }),
    ).toBe(true);
    expect(observation['areaConserved']).toBe(true);
    expect(observation['totalArea']).toBe('24');
  });
});

describe('E11 조각 Action 무시 규칙', () => {
  it('변을 따라가는 자르기는 무시한다', () => {
    const state = apply({ mode: 'formula-derive' }, []);
    const next = reduce(state, {
      type: 'cut',
      piece: 'p1',
      from: rp(4, 2),
      to: rp(10, 2),
    });
    expect(next).toBe(state);
  });

  it('판 밖으로 나가는 이동은 무시한다', () => {
    const state = apply({ mode: 'formula-derive' }, []);
    const next = reduce(state, {
      type: 'move-piece',
      piece: 'p1',
      by: rp(20, 0),
    });
    expect(next).toBe(state);
  });

  it('설정에 없는 도구의 Action은 무시한다', () => {
    const state = apply({ mode: 'formula-derive', tools: ['scissors'] }, []);
    expect(reduce(state, { type: 'rotate-piece', piece: 'p1', turns: 1 })).toBe(state);
    expect(reduce(state, { type: 'hinge', piece: 'p1', at: rp(4, 2) })).toBe(state);
    expect(reduce(state, { type: 'duplicate', piece: 'p1' })).toBe(state);
  });

  it('maxCopies를 넘는 복제는 무시한다', () => {
    let state = apply(
      {
        mode: 'formula-derive',
        shape: { type: 'triangle', base: 6, height: 4, apex: 2 },
        maxCopies: 1,
      },
      [],
    );
    state = reduce(state, { type: 'duplicate', piece: 'p1' }) as PiecesState;
    expect(state.copies).toBe(1);
    expect(state.pieces).toHaveLength(2);
    const second = reduce(state, { type: 'duplicate', piece: 'p1' });
    expect(second).toBe(state);
    expect(state.copies).toBe(1);
  });

  it('자를 점 후보는 꼭짓점·변의 중점·격자선 교점만 쓴다', () => {
    const state = createPiecesState('formula-derive', { mode: 'formula-derive' });
    const piece = state.pieces[0];
    expect(piece).toBeDefined();
    if (!piece) return;
    const candidates = cutCandidates(piece).map((point) => {
      const g = toG(point);
      return [g.x.toString(), g.y.toString()].join(',');
    });
    expect(candidates[0]).toBe('4,2');
    expect(candidates).toContain('4,6');
    expect(candidates).toContain('3,4');
    expect(candidates).toContain('7,2');
  });
});

describe('E11 자석 스냅', () => {
  it('맞는 꼭짓점이 없으면 raw를 정수로 반올림한다', () => {
    const state = createPiecesState('formula-derive', { mode: 'formula-derive' });
    expect(snapTranslation(state, 'p1', { x: 5.8, y: 0.1 })).toEqual(['6', '0']);
    expect(snapTranslation(state, 'p1', { x: 2.3, y: 0 })).toEqual(['2', '0']);
  });

  it('다른 조각의 꼭짓점 차이를 tolerance 안에서 고른다', () => {
    const state = cutDefault(createPiecesState('formula-derive', { mode: 'formula-derive' }));
    expect(state.pieces).toHaveLength(2);
    // 삼각형 꼭짓점 (2,6)을 사각형 꼭짓점 (8,6)에 맞추는 이동량 (6,0).
    expect(snapTranslation(state, 'p2', { x: 6.1, y: -0.05 })).toEqual(['6', '0']);
  });
});

describe('E11 직렬화', () => {
  it('자르기·이동·회전·경첩·복제 뒤 상태가 모두 JSON 직렬화 가능하다', () => {
    const initial = createPiecesState('formula-derive', { mode: 'formula-derive' });
    assertSerializable(initial);
    let state = initial;
    for (const action of [
      { type: 'duplicate', piece: 'p1' },
      { type: 'rotate-piece', piece: 'p2', turns: 1 },
      { type: 'hinge', piece: 'p2', at: rp(14, 4) },
      { type: 'move-piece', piece: 'p2', by: rp(1, 0) },
      { type: 'cut', piece: 'p1', from: rp(4, 2), to: rp(4, 6) },
    ] as const) {
      state = reduce(state, action) as PiecesState;
      assertSerializable(state);
    }
  });
});
