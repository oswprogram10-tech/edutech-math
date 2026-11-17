import { describe, expect, it } from 'vitest';
import {
  assignSlots,
  buildPiecesFromSteps,
  evaluatePrismNet,
  slotNeighbors,
  type PrismPiece,
  type PrismPieceType,
} from '../prismnet/model';

const SIZES = { sideLen: 2, height: 3 };

interface Step {
  readonly parent: number;
  readonly parentEdge: number;
  readonly type: PrismPieceType;
}

function build(root: PrismPieceType, steps: readonly Step[], n: number): readonly PrismPiece[] {
  const pieces = buildPiecesFromSteps(root, steps, n);
  if (!pieces) throw new Error('잘못된 단계');
  return pieces;
}

/** 밑면 하나(뿌리) + 옆면 n개를 밑면 변마다 + 마지막 밑면을 옆면 `topOn`의 위 변에. */
function ringNet(n: number, topOn: number): readonly PrismPiece[] {
  const steps: Step[] = [];
  for (let k = 0; k < n; k += 1) steps.push({ parent: 0, parentEdge: k, type: 'rect' });
  steps.push({ parent: 1 + topOn, parentEdge: 2, type: 'base' });
  return build('base', steps, n);
}

/** 옆면 n개 띠(오른쪽 변으로 이음). */
function stripSteps(n: number): Step[] {
  return Array.from({ length: n - 1 }, (_, i) => ({
    parent: i,
    parentEdge: 1,
    type: 'rect' as const,
  }));
}

describe('slotNeighbors 방향 규칙', () => {
  it('B와 T는 변 순서가 반대다', () => {
    expect(slotNeighbors('T', 4)).toEqual(['S0', 'S1', 'S2', 'S3']);
    expect(slotNeighbors('B', 4)).toEqual(['S0', 'S3', 'S2', 'S1']);
    expect(slotNeighbors('S1', 4)).toEqual(['B', 'S2', 'T', 'S0']);
    expect(slotNeighbors('S0', 3)).toEqual(['B', 'S1', 'T', 'S2']);
  });
});

describe('각기둥 전개도 판정(정수 계산)', () => {
  for (const n of [3, 4, 5, 6]) {
    it(`n=${n}: 밑면 둘레에 옆면 ${n}개 + 윗밑면을 옆면 위 변에 붙이면 valid`, () => {
      for (let topOn = 0; topOn < n; topOn += 1) {
        const ev = evaluatePrismNet(ringNet(n, topOn), n, SIZES);
        expect(ev.missing).toBe(0);
        expect(ev.duplicates).toEqual([]);
        expect(ev.mismatch).toEqual([]);
        expect(ev.valid).toBe(true);
        expect(ev.slotOf[0]).toBe('B');
        expect(ev.slotOf[n + 1]).toBe('T');
      }
    });

    it(`n=${n}: 옆면 띠 + 밑면 위·아래 한 장씩이면 valid, 둘 다 위면 bothBasesSameEnd`, () => {
      for (let down = 0; down < n; down += 1) {
        for (let up = 0; up < n; up += 1) {
          const steps = [
            ...stripSteps(n),
            { parent: down, parentEdge: 0, type: 'base' as const },
            { parent: up, parentEdge: 2, type: 'base' as const },
          ];
          const ev = evaluatePrismNet(build('rect', steps, n), n, SIZES);
          // 밑면이 서로 겹쳐 오려지지 않는 위치도 있으므로 자리 계산만 확인한다.
          expect(ev.missing).toBe(0);
          expect(ev.duplicates).toEqual([]);
          expect(ev.mismatch).toEqual([]);
          expect(ev.bothBasesSameEnd).toBe(false);
        }
      }
      const valid = evaluatePrismNet(
        build(
          'rect',
          [
            ...stripSteps(n),
            { parent: 0, parentEdge: 0, type: 'base' },
            { parent: n - 1, parentEdge: 2, type: 'base' },
          ],
          n,
        ),
        n,
        SIZES,
      );
      expect(valid.valid).toBe(true);

      const bothTop = evaluatePrismNet(
        build(
          'rect',
          [
            ...stripSteps(n),
            { parent: 0, parentEdge: 2, type: 'base' },
            { parent: n - 1, parentEdge: 2, type: 'base' },
          ],
          n,
        ),
        n,
        SIZES,
      );
      expect(bothTop.bothBasesSameEnd).toBe(true);
      expect(bothTop.duplicates.length).toBeGreaterThan(0);
      expect(bothTop.valid).toBe(false);
      expect(bothTop.missing).toBe(1);
    });

    it(`n=${n}: 띠의 첫 옆면 아래와 마지막 옆면 아래 밑면은 같은 B 자리로 간다(방향 규칙)`, () => {
      const steps = [
        ...stripSteps(n),
        { parent: 0, parentEdge: 0, type: 'base' as const },
        { parent: n - 1, parentEdge: 0, type: 'base' as const },
      ];
      const ev = evaluatePrismNet(build('rect', steps, n), n, SIZES);
      expect(ev.slotOf[n]).toBe('B');
      expect(ev.slotOf[n + 1]).toBe('B');
      expect(ev.bothBasesSameEnd).toBe(true);
      expect(ev.valid).toBe(false);
    });

    it(`n=${n}: 띠 i번째 옆면은 S${'i'} 자리다`, () => {
      const { slotOf } = assignSlots(build('rect', stripSteps(n), n), n);
      expect(slotOf).toEqual(Array.from({ length: n }, (_, i) => `S${i}`));
    });
  }

  it('옆면을 다른 옆면의 위 변(s)에 붙이면 mismatch이고 자손은 자리가 없다', () => {
    const n = 4;
    const pieces = build(
      'rect',
      [
        { parent: 0, parentEdge: 2, type: 'rect' },
        { parent: 1, parentEdge: 1, type: 'rect' },
      ],
      n,
    );
    const ev = evaluatePrismNet(pieces, n, SIZES);
    expect(ev.mismatch).toEqual([1]);
    expect(ev.slotOf).toEqual(['S0', null, null]);
    expect(ev.valid).toBe(false);
  });

  it('밑면을 옆면의 h 변에 붙이는 단계는 만들 수 없다', () => {
    expect(
      buildPiecesFromSteps('rect', [{ parent: 0, parentEdge: 1, type: 'base' }], 3),
    ).toBeNull();
  });

  it('밑면을 밑면 변에 붙이면 옆면 자리로 가서 mismatch', () => {
    const ev = evaluatePrismNet(
      build('base', [{ parent: 0, parentEdge: 0, type: 'base' }], 3),
      3,
      SIZES,
    );
    expect(ev.mismatch).toEqual([1]);
  });

  it('옆면이 n−1개면 missing 1', () => {
    for (const n of [3, 4, 5, 6]) {
      const steps = [
        ...stripSteps(n - 1),
        { parent: 0, parentEdge: 0, type: 'base' as const },
        { parent: 0, parentEdge: 2, type: 'base' as const },
      ];
      const ev = evaluatePrismNet(build('rect', steps, n), n, SIZES);
      expect(ev.missing).toBe(1);
      expect(ev.valid).toBe(false);
    }
  });

  it('빈 전개도는 valid가 아니고 자리가 모두 비어 있다', () => {
    const ev = evaluatePrismNet([], 5, SIZES);
    expect(ev.valid).toBe(false);
    expect(ev.missing).toBe(7);
  });

  it('밑면 둘레 방향이 옆면 띠와 서로 맞물린다(같은 자리로 가는 두 길)', () => {
    // 아래 밑면에서 변 n-1 쪽으로 간 옆면은, 변 0의 옆면에서 오른쪽 변(1)으로 간 옆면과 같은 S1이다.
    const n = 5;
    const ev = evaluatePrismNet(
      build(
        'base',
        [
          { parent: 0, parentEdge: 0, type: 'rect' },
          { parent: 0, parentEdge: n - 1, type: 'rect' },
          { parent: 1, parentEdge: 1, type: 'rect' },
        ],
        n,
      ),
      n,
      SIZES,
    );
    expect(ev.slotOf[1]).toBe('S0');
    expect(ev.slotOf[2]).toBe('S1');
    expect(ev.slotOf[3]).toBe('S1');
    expect(ev.duplicates).toEqual([2, 3]);
    expect(ev.duplicateGroups).toEqual([[2, 3]]);
  });

  it('밑면 변 k의 옆면은 S{(n-k) mod n}', () => {
    const n = 6;
    const pieces = build(
      'base',
      Array.from({ length: n }, (_, k) => ({ parent: 0, parentEdge: k, type: 'rect' as const })),
      n,
    );
    const { slotOf } = assignSlots(pieces, n);
    for (let k = 0; k < n; k += 1) expect(slotOf[1 + k]).toBe(`S${(n - k) % n}`);
  });

  it('윗밑면에서 반시계로 다음 변은 오른쪽 옆면, 아랫밑면에서는 왼쪽 옆면으로 이어진다', () => {
    const n = 5;
    // 종이에서 옆면 S0 위에 밑면을 붙이면 그 밑면의 변 1은 종이 오른쪽에 온다 -> S1.
    const up = evaluatePrismNet(
      build(
        'rect',
        [
          { parent: 0, parentEdge: 2, type: 'base' },
          { parent: 1, parentEdge: 1, type: 'rect' },
        ],
        n,
      ),
      n,
      SIZES,
    );
    expect(up.slotOf).toEqual(['S0', 'T', 'S1']);
    // 옆면 S0 아래에 붙인 밑면은 뒤집혀 있어서 변 1이 종이 왼쪽에 온다 -> S{n-1}.
    const down = evaluatePrismNet(
      build(
        'rect',
        [
          { parent: 0, parentEdge: 0, type: 'base' },
          { parent: 1, parentEdge: 1, type: 'rect' },
        ],
        n,
      ),
      n,
      SIZES,
    );
    expect(down.slotOf).toEqual(['S0', 'B', `S${n - 1}`]);
  });
});
