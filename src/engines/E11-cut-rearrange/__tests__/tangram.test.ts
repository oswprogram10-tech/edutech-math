/**
 * T107 tangram 단위 테스트.
 *
 * 실루엣 정답 배치는 판정에만 쓰고, 채움·겹침·삐져나옴은 모두 Surd 정확 계산이다.
 * 모든 상태는 JSON 직렬화 가능해야 한다.
 */
import { describe, expect, it } from 'vitest';
import { assertSerializable } from '../../../core/engine-sdk';
import { predicates } from '../events';
import { observe } from '../observe';
import { createInitialState, reduce } from '../reduce';
import { analyzeTangram, tangramPiecePolygons } from '../tangram/observe';
import { pieceArea, pieceVertices, setD } from '../tangram/pieces';
import type { PieceSet } from '../tangram/pieces';
import {
  boardPlacement,
  silhouetteDefinitions,
  silhouettePartPolygons,
} from '../tangram/silhouettes';
import type { SilhouetteDef } from '../tangram/silhouettes';
import { snapPiece } from '../tangram/snap';
import { sFromJson, sToJson, sToNumber } from '../tangram/surd';
import { sAverage, sClipConvex, sPolygonArea } from '../tangram/surd-geometry';
import type { SPoint } from '../tangram/surd-geometry';
import { patternSpawnPoint } from '../tangram/tray';
import type { CutAction, CutConfig, CutState } from '../types';

function tangramState(state: CutState): CutState {
  if (state.mode !== 'tangram') throw new Error('tangram 상태가 아닙니다.');
  return state;
}

function apply(config: CutConfig, actions: readonly CutAction[]): CutState {
  let state = createInitialState(config);
  assertSerializable(state);
  for (const action of actions) {
    state = reduce(state, action);
    assertSerializable(state);
  }
  return tangramState(state);
}

function atJson(point: SPoint) {
  return [sToJson(point.x), sToJson(point.y)] as const;
}

function lastPieceId(state: CutState): string {
  if (state.mode !== 'tangram') throw new Error('tangram 상태가 아닙니다.');
  const piece = state.pieces[state.pieces.length - 1];
  if (!piece) throw new Error('조각이 없습니다.');
  return piece.id;
}

/** 실루엣 정답 배치를 실제 Action으로 판에 놓는다. */
function placeSilhouette(set: PieceSet, def: SilhouetteDef): CutState {
  const config: CutConfig =
    set === 'tangram'
      ? {
          mode: 'tangram',
          pieceSet: set,
          silhouette: def.id,
          pieces: def.placements.map((placement) => ({
            kind: placement.kind,
            rot: placement.rot,
            flip: placement.flip,
          })),
        }
      : { mode: 'tangram', pieceSet: set, silhouette: def.id };
  let state = createInitialState(config);
  assertSerializable(state);
  const d = setD(set);
  const spawn = atJson(patternSpawnPoint());
  for (let index = 0; index < def.placements.length; index += 1) {
    const placement = def.placements[index];
    if (!placement) continue;
    const board = boardPlacement(placement, d);
    if (set === 'tangram') {
      state = reduce(state, {
        type: 'place-piece',
        piece: `p${index + 1}`,
        at: atJson(board.at),
      });
    } else {
      state = reduce(state, { type: 'add-piece', kind: placement.kind, at: spawn });
      const id = lastPieceId(state);
      if (placement.flip) state = reduce(state, { type: 'flip-piece', piece: id });
      for (let turn = 0; turn < placement.rot; turn += 1) {
        state = reduce(state, { type: 'turn-piece', piece: id });
      }
      state = reduce(state, { type: 'place-piece', piece: id, at: atJson(board.at) });
    }
    assertSerializable(state);
  }
  return tangramState(state);
}

function centerOf(state: CutState, pieceId: string): SPoint {
  if (state.mode !== 'tangram') throw new Error('tangram 상태가 아닙니다.');
  const piece = state.pieces.find((candidate) => candidate.id === pieceId);
  if (!piece) throw new Error('조각을 찾지 못했습니다.');
  const d = setD(state.settings.pieceSet);
  const at: SPoint = {
    x: sFromJson(piece.at[0], d),
    y: sFromJson(piece.at[1], d),
  };
  const vertices = pieceVertices(
    state.settings.pieceSet,
    piece.kind,
    at,
    piece.rot,
    piece.flip,
    state.settings.rotationStep,
  );
  return sAverage(vertices);
}

describe('T107 tangram 실루엣 채움', () => {
  for (const set of ['tangram', 'pattern-blocks'] as const) {
    for (const def of silhouetteDefinitions(set)) {
      it(`${set}/${def.id}: 정답 배치를 놓으면 filled·100%`, () => {
        const state = placeSilhouette(set, def);
        const observation = observe(state);
        expect(observation['filled']).toBe(true);
        expect(observation['fillPercent']).toBe(100);
        expect(observation['overlap']).toBe(false);
        expect(observation['sticksOut']).toBe(false);
        expect(observation['usedPieces']).toBe(def.placements.length);
      });

      it(`${set}/${def.id}: 정답 배치끼리 겹치지 않는다`, () => {
        const parts = silhouettePartPolygons(set, def.id);
        for (let first = 0; first < parts.length; first += 1) {
          for (let second = first + 1; second < parts.length; second += 1) {
            const a = parts[first];
            const b = parts[second];
            if (!a || !b) continue;
            const clip = sClipConvex(a, b);
            const area = clip.length >= 3 ? sToNumber(sPolygonArea(clip)) : 0;
            expect(area).toBe(0);
          }
        }
      });
    }
  }
});

describe('T107 tangram 부분 채움·겹침·삐져나옴', () => {
  it('조각 하나를 빼면 filled false, fillPercent < 100', () => {
    const state = apply(
      {
        mode: 'tangram',
        silhouette: 'square',
        pieces: [
          { kind: 'small-triangle', rot: 4 },
          { kind: 'small-triangle', rot: 0 },
        ],
      },
      [
        {
          type: 'place-piece',
          piece: 'p1',
          at: [
            ['4', '0'],
            ['3', '0'],
          ],
        },
      ],
    );
    const observation = observe(state);
    expect(observation['filled']).toBe(false);
    expect(Number(observation['fillPercent'])).toBeLessThan(100);
  });

  it('두 조각을 같은 자리에 겹치면 overlap', () => {
    const state = apply(
      {
        mode: 'tangram',
        silhouette: 'square',
        pieces: [
          { kind: 'small-triangle', rot: 4 },
          { kind: 'small-triangle', rot: 4 },
        ],
      },
      [
        {
          type: 'place-piece',
          piece: 'p1',
          at: [
            ['4', '0'],
            ['3', '0'],
          ],
        },
        {
          type: 'place-piece',
          piece: 'p2',
          at: [
            ['4', '0'],
            ['3', '0'],
          ],
        },
      ],
    );
    const observation = observe(state);
    expect(observation['overlap']).toBe(true);
    expect(observation['filled']).toBe(false);
  });

  it('실루엣 밖으로 걸치면 sticksOut', () => {
    const state = apply(
      {
        mode: 'tangram',
        silhouette: 'square',
        pieces: [{ kind: 'large-triangle', rot: 0 }],
      },
      [
        {
          type: 'place-piece',
          piece: 'p1',
          at: [
            ['1', '0'],
            ['2', '0'],
          ],
        },
      ],
    );
    const observation = observe(state);
    expect(observation['sticksOut']).toBe(true);
    expect(observation['filled']).toBe(false);
  });

  it('square 실루엣을 작은 세모 2개로 채우면 outlineIs {kind: square, pieces: 2}', () => {
    const square = silhouetteDefinitions('tangram').find((def) => def.id === 'square');
    expect(square).toBeDefined();
    if (!square) return;
    const state = placeSilhouette('tangram', square);
    const observation = observe(state);
    expect(predicates['outlineIs']?.(observation, { kind: 'square', pieces: 2 })).toBe(true);
    expect(predicates['silhouetteFilled']?.(observation, {})).toBe(true);
  });
});

describe('T107 tangram 돌리기·뒤집기·스냅', () => {
  it('turn-piece는 꼭짓점 평균을 바꾸지 않는다', () => {
    const state = apply({ mode: 'tangram', pieces: [{ kind: 'small-triangle' }] }, []);
    const before = centerOf(state, 'p1');
    const turned = reduce(state, { type: 'turn-piece', piece: 'p1' });
    assertSerializable(turned);
    const after = centerOf(turned, 'p1');
    expect(Math.abs(sToNumber(before.x) - sToNumber(after.x))).toBeLessThan(1e-9);
    expect(Math.abs(sToNumber(before.y) - sToNumber(after.y))).toBeLessThan(1e-9);
    if (turned.mode !== 'tangram') throw new Error('tangram 상태가 아닙니다.');
    expect(turned.pieces[0]?.rot).toBe(1);
  });

  it('flip-piece 두 번은 제자리', () => {
    const state = apply({ mode: 'tangram', pieces: [{ kind: 'parallelogram' }] }, []);
    if (state.mode !== 'tangram') throw new Error('tangram 상태가 아닙니다.');
    const before = state.pieces[0];
    const once = reduce(state, { type: 'flip-piece', piece: 'p1' });
    const twice = reduce(once, { type: 'flip-piece', piece: 'p1' });
    assertSerializable(twice);
    if (twice.mode !== 'tangram') throw new Error('tangram 상태가 아닙니다.');
    const after = twice.pieces[0];
    expect(after?.flip).toBe(before?.flip);
    expect(after?.rot).toBe(before?.rot);
    expect(after?.at).toEqual(before?.at);
  });

  it('패턴 블록 30° 회전 뒤에도 넓이가 같다', () => {
    const state = apply({ mode: 'tangram', pieceSet: 'pattern-blocks' }, [
      { type: 'add-piece', kind: 'square', at: atJson(patternSpawnPoint()) },
    ]);
    if (state.mode !== 'tangram') throw new Error('tangram 상태가 아닙니다.');
    const before = analyzeTangram(state);
    const turned = reduce(state, { type: 'turn-piece', piece: 'p1' });
    if (turned.mode !== 'tangram') throw new Error('tangram 상태가 아닙니다.');
    const after = analyzeTangram(turned);
    const beforePolygon = before.polygons.get('p1');
    const afterPolygon = after.polygons.get('p1');
    expect(beforePolygon).toBeDefined();
    expect(afterPolygon).toBeDefined();
    if (!beforePolygon || !afterPolygon) return;
    expect(sToNumber(sPolygonArea(beforePolygon))).toBeCloseTo(
      sToNumber(sPolygonArea(afterPolygon)),
      12,
    );
    expect(sToNumber(sPolygonArea(afterPolygon))).toBeCloseTo(1, 12);
  });

  it('snapPiece는 0.2칸 어긋난 자리를 정확한 꼭짓점에 붙인다', () => {
    const state = apply(
      {
        mode: 'tangram',
        silhouette: 'square',
        pieces: [
          { kind: 'small-triangle', rot: 4 },
          { kind: 'small-triangle', rot: 0 },
        ],
      },
      [],
    );
    if (state.mode !== 'tangram') throw new Error('tangram 상태가 아닙니다.');
    const snapped = snapPiece(state, 'p1', { x: 4.2, y: 3.2 }, 0.3);
    expect(snapped).toEqual([
      ['4', '0'],
      ['3', '0'],
    ]);
  });
});

describe('T107 tangram 조각 고르기', () => {
  const config: CutConfig = {
    mode: 'tangram',
    selectMode: true,
    pieces: ['small-triangle', 'small-triangle', 'square'],
  };

  it('세모를 모두 고르면 selectedAllWithCorners {corners: 3} true', () => {
    const state = apply(config, [
      { type: 'toggle-select', piece: 'p1' },
      { type: 'toggle-select', piece: 'p2' },
    ]);
    const observation = observe(state);
    expect(predicates['selectedAllWithCorners']?.(observation, { corners: 3 })).toBe(true);
  });

  it('하나가 빠지면 false', () => {
    const state = apply(config, [{ type: 'toggle-select', piece: 'p1' }]);
    const observation = observe(state);
    expect(predicates['selectedAllWithCorners']?.(observation, { corners: 3 })).toBe(false);
  });

  it('네모가 섞이면 false', () => {
    const state = apply(config, [
      { type: 'toggle-select', piece: 'p1' },
      { type: 'toggle-select', piece: 'p2' },
      { type: 'toggle-select', piece: 'p3' },
    ]);
    const observation = observe(state);
    expect(predicates['selectedAllWithCorners']?.(observation, { corners: 3 })).toBe(false);
  });
});

describe('T107 tangram 조각 넓이', () => {
  it('칠교 조각 넓이는 모두 Surd로 닫힌다', () => {
    const values = [
      'large-triangle',
      'medium-triangle',
      'small-triangle',
      'square',
      'parallelogram',
    ].map((kind) => {
      const area = pieceArea('tangram', kind);
      return area ? sToNumber(area) : Number.NaN;
    });
    expect(values).toEqual([4, 2, 1, 2, 2]);
  });

  it('tangramPiecePolygons는 조각 수만큼 다각형을 준다', () => {
    const state = apply({ mode: 'tangram' }, []);
    if (state.mode !== 'tangram') throw new Error('tangram 상태가 아닙니다.');
    expect(tangramPiecePolygons(state).size).toBe(7);
  });
});
