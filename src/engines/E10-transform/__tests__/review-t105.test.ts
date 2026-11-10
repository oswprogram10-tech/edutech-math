/**
 * E10 검수 수정 회귀 테스트(단위).
 *
 * - 뒤집기 애니메이션 축은 결과 도형의 맞은편 변을 쓴다.
 * - 합쳐진 밀기는 합 전체가 아니라 늘어난 만큼만 보간한다.
 * - 정오각형은 허브 꼭짓점을 공유하므로 중심 거리가 외접원 반지름이다.
 * - 정육각형 타일은 꼭짓점 4·5도 돌리기 중심이 된다.
 * - 글자 S·N은 점대칭이지만 선대칭은 아니다.
 * - 모든 다각형 프리셋은 단순 다각형이다.
 */
import { describe, expect, it } from 'vitest';
import {
  gp,
  isSimplePolygon,
  polygonMirrorSymmetric,
  polygonPointSymmetric,
  Rational,
} from '../../../core/math';
import type { GPoint } from '../../../core/math';
import { observe } from '../observe';
import { POLYGONS } from '../polygons';
import { createInitialState, reduce } from '../reduce';
import { boardRect } from '../layout';
import type {
  LineSymmetryConfig,
  LineSymmetryState,
  Pt,
  TessellationConfig,
  TessellationState,
  TransformAction,
  TransformConfig,
  TransformState,
} from '../types';
import { slideAnimationDelta, transformOf } from '../views/parts/useMoveAnimation';

function apply(config: TransformConfig, actions: readonly TransformAction[]): TransformState {
  return actions.reduce<TransformState>(
    (state, action) => reduce(state, action),
    createInitialState(config),
  );
}

function tessellationState(
  config: TessellationConfig,
  actions: readonly TransformAction[],
): TessellationState {
  const state = apply(config, actions);
  if (state.mode !== 'tessellation') throw new Error('tessellation 상태가 아닙니다.');
  return state;
}

function stepTessellation(state: TessellationState, action: TransformAction): TessellationState {
  const next = reduce(state, action);
  if (next.mode !== 'tessellation') throw new Error('tessellation 상태가 아닙니다.');
  return next;
}

function lineState(
  config: LineSymmetryConfig,
  actions: readonly TransformAction[],
): LineSymmetryState {
  const state = apply(config, actions);
  if (state.mode !== 'line-symmetry') throw new Error('line-symmetry 상태가 아닙니다.');
  return state;
}

function numbers(text: string): number[] {
  return (text.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
}

describe('E10 뒤집기 애니메이션 축', () => {
  const start = {
    outline: [
      [0, 0],
      [2, 0],
      [2, 1],
      [0, 1],
    ] as Pt[],
    cells: [],
  };
  const rect = boardRect(8);

  it('오른쪽 뒤집기는 결과 도형의 왼쪽 변(minX)을 축으로 삼는다', () => {
    const text = transformOf(start, [{ kind: 'flip', side: 'right' }], rect, 0);
    expect(text).toBe('matrix(-1.0000 0 0 1 560.00 0)');
  });

  it('왼쪽 뒤집기는 결과 도형의 오른쪽 변(maxX)을 축으로 삼는다', () => {
    const text = transformOf(start, [{ kind: 'flip', side: 'left' }], rect, 0);
    expect(text).toBe('matrix(-1.0000 0 0 1 120.00 0)');
  });

  it('아래·위 뒤집기도 결과 도형의 맞은편 변을 축으로 삼는다', () => {
    const down = transformOf(start, [{ kind: 'flip', side: 'down' }], rect, 0);
    expect(down).toBe('matrix(1 0 0 -1.0000 0 340.00)');
    const up = transformOf(start, [{ kind: 'flip', side: 'up' }], rect, 0);
    expect(up).toBe('matrix(1 0 0 -1.0000 0 120.00)');
  });
});

describe('E10 합쳐진 밀기 애니메이션', () => {
  it('합쳐진 밀기는 직전 기록과의 차이만 보간한다', () => {
    const previous = [{ kind: 'slide', dx: 2, dy: 0 }] as const;
    const merged = [{ kind: 'slide', dx: 5, dy: 1 }] as const;
    expect(slideAnimationDelta(previous, merged)).toEqual({ dx: 3, dy: 1 });
    expect(slideAnimationDelta([], [{ kind: 'slide', dx: 2, dy: -1 }])).toEqual({ dx: 2, dy: -1 });
    expect(slideAnimationDelta(previous, [{ kind: 'flip', side: 'right' }])).toBeNull();

    const rect = boardRect(8);
    const start = {
      outline: [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 1],
      ] as Pt[],
      cells: [],
    };
    const text = transformOf(start, merged, rect, 0, { dx: 3, dy: 1 });
    const values = numbers(text ?? '');
    expect(values[0]).toBeCloseTo(3 * rect.cell, 2);
    expect(values[1]).toBeCloseTo(1 * rect.cell, 2);
  });
});

describe('E10 정오각형 한 꼭짓점 둘레', () => {
  it('허브 3은 36° 빈틈, 허브 4는 72° 겹침이다', () => {
    const three = observe(
      tessellationState({ mode: 'tessellation' }, [
        { type: 'select-tile', tile: 'pentagon-regular' },
        { type: 'hub-add' },
        { type: 'hub-add' },
      ]),
    );
    expect(three['pentagon']).toEqual({
      count: 3,
      angleSum: 324,
      gapDegrees: 36,
      overlapDegrees: 0,
    });

    const four = observe(
      tessellationState({ mode: 'tessellation' }, [
        { type: 'select-tile', tile: 'pentagon-regular' },
        { type: 'hub-add' },
        { type: 'hub-add' },
        { type: 'hub-add' },
      ]),
    );
    expect(four['pentagon']).toEqual({
      count: 4,
      angleSum: 432,
      gapDegrees: 0,
      overlapDegrees: 72,
    });
  });
});

describe('E10 정육각형 돌리기 중심', () => {
  it('꼭짓점 인덱스 4·5도 고를 수 있고 6은 무시한다', () => {
    const base = tessellationState({ mode: 'tessellation' }, [
      { type: 'select-tile', tile: 'hexagon' },
    ]);
    const four = stepTessellation(base, { type: 'select-center', index: 4 });
    const five = stepTessellation(base, { type: 'select-center', index: 5 });
    const six = stepTessellation(base, { type: 'select-center', index: 6 });
    expect(base.center).toBe(0);
    expect(four.center).toBe(4);
    expect(five.center).toBe(5);
    expect(six.center).toBe(0);
  });
});

describe('E10 글자 S·N의 대칭', () => {
  function gpoints(points: readonly Pt[]): GPoint[] {
    return points.map((point) => gp(point[0], point[1]));
  }

  it('글자 S는 중심 (9/2, 9/2)에 점대칭이고 선대칭축이 없다', () => {
    const points = gpoints(POLYGONS['letter-S'].points);
    const center = { x: Rational.of(9, 2), y: Rational.of(9, 2) };
    expect(polygonPointSymmetric(points, center)).toBe(true);
    const midX = Rational.of(9, 2);
    expect(
      polygonMirrorSymmetric(
        points,
        { x: midX, y: Rational.of(0) },
        { x: midX, y: Rational.of(7) },
        'euclid',
      ),
    ).toBe(false);
    expect(
      polygonMirrorSymmetric(
        points,
        { x: Rational.of(3), y: Rational.of(9, 2) },
        { x: Rational.of(6), y: Rational.of(9, 2) },
        'euclid',
      ),
    ).toBe(false);
  });

  it('글자 N은 중심 (10/2, 9/2)에 점대칭이고 선대칭축이 없다', () => {
    const points = gpoints(POLYGONS['letter-N'].points);
    const center = { x: Rational.of(5), y: Rational.of(9, 2) };
    expect(polygonPointSymmetric(points, center)).toBe(true);
    const midX = Rational.of(5);
    expect(
      polygonMirrorSymmetric(
        points,
        { x: midX, y: Rational.of(0) },
        { x: midX, y: Rational.of(7) },
        'euclid',
      ),
    ).toBe(false);
  });
});

describe('E10 다각형 프리셋은 단순 다각형', () => {
  it('점이 3개 이상인 모든 프리셋이 자기 변과 만나지 않는다', () => {
    for (const preset of Object.values(POLYGONS)) {
      if (preset.points.length < 3) continue;
      const points = preset.points.map((point) => gp(point[0], point[1]));
      expect(isSimplePolygon(points), preset.id).toBe(true);
    }
  });
});

describe('E10 선대칭 대각선 축은 직선 전체로 판정한다', () => {
  it('선분 밖에 있는 정사각형 꼭짓점 둘을 지나는 축도 대각선이다', () => {
    const state = lineState({ mode: 'line-symmetry', shapes: ['square'] }, [
      { type: 'pick-point', at: [3, 3] },
      { type: 'pick-point', at: [4, 4] },
      { type: 'fold' },
    ]);
    const result = observe(state);
    expect(result['lastFold']).toEqual({ ok: true, diagonal: true });
  });
});

describe('E10 빈틈 살펴보기 설정', () => {
  it('gapCheck가 false면 check-gaps가 상태를 바꾸지 않는다', () => {
    const state = tessellationState({ mode: 'tessellation', gapCheck: false }, [
      { type: 'check-gaps' },
    ]);
    expect(state.checked).toBe(false);
    const on = tessellationState({ mode: 'tessellation', gapCheck: true }, [
      { type: 'check-gaps' },
    ]);
    expect(on.checked).toBe(true);
  });
});
