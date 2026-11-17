import { describe, expect, it } from 'vitest';
import {
  XRAY_EDGE_IDS,
  XRAY_FACE_IDS,
  XRAY_VERTEX_IDS,
  buildPrefillVisibleSegments,
  edgeEndpoints,
  edgeFaces,
  gradeSketch,
  hiddenEdges,
  hiddenVertices,
  normalizeView,
  sketchProject,
  sketchProjectionOk,
  visibleFaces,
} from '../xray/geometry';

describe('E12 xray 기하·투영·겨냥도 채점', () => {
  it('요소 개수(6·12·8)와 고정 이름 순서, edgeFaces가 정확하다', () => {
    expect(XRAY_FACE_IDS).toEqual(['front', 'back', 'left', 'right', 'bottom', 'top']);
    expect(XRAY_EDGE_IDS).toEqual([
      'x00',
      'x01',
      'x10',
      'x11',
      'y00',
      'y01',
      'y10',
      'y11',
      'z00',
      'z01',
      'z10',
      'z11',
    ]);
    expect(XRAY_VERTEX_IDS).toEqual([
      'v000',
      'v001',
      'v010',
      'v011',
      'v100',
      'v101',
      'v110',
      'v111',
    ]);

    expect(edgeFaces('x10')).toEqual(['back', 'bottom']);
    expect(edgeFaces('y00')).toEqual(['left', 'bottom']);
    expect(edgeFaces('z01')).toEqual(['left', 'back']);
    expect(edgeFaces('x01')).toEqual(['front', 'top']);
  });

  it('4번 보이는 면 기대값 4가지와 기본 시점 숨은 모서리 3개를 맞춘다', () => {
    expect(visibleFaces({ yaw: 30, pitch: 30 })).toEqual(['front', 'right', 'top']);
    expect(visibleFaces({ yaw: -30, pitch: 30 })).toEqual(['front', 'left', 'top']);
    expect(visibleFaces({ yaw: 30, pitch: -30 })).toEqual(['front', 'right', 'bottom']);
    expect(visibleFaces({ yaw: 180, pitch: 30 })).toEqual(['back', 'top']);

    expect(hiddenEdges({ yaw: 30, pitch: 30 })).toEqual(['x10', 'y00', 'z01']);
    expect(hiddenVertices({ yaw: 30, pitch: 30 })).toEqual(['v010']);
  });

  it('pitch가 0이 아니고 yaw가 90의 배수가 아닌 모든 시점에서 보이는 면 3개, 숨은 모서리 3개, 숨은 꼭짓점 1개다', () => {
    for (let yaw = -165; yaw <= 180; yaw += 15) {
      if (((yaw % 90) + 90) % 90 === 0) continue;
      for (let pitch = -75; pitch <= 75; pitch += 15) {
        if (pitch === 0) continue;
        expect(visibleFaces({ yaw, pitch })).toHaveLength(3);
        expect(hiddenEdges({ yaw, pitch })).toHaveLength(3);
        expect(hiddenVertices({ yaw, pitch })).toHaveLength(1);
      }
    }
  });

  it('시점 정규화(yaw 195 → -165, pitch 90 → 75)를 수행한다', () => {
    expect(normalizeView({ yaw: 195, pitch: 90 })).toEqual({ yaw: -165, pitch: 75 });
    expect(normalizeView({ yaw: -180, pitch: -90 })).toEqual({ yaw: 180, pitch: -75 });
    expect(normalizeView({ yaw: 22, pitch: -8 })).toEqual({ yaw: 15, pitch: -15 });
  });

  it('sketchProjectionOk 기대값(4×3×2·정육면체 1·2·3 true, 1×2×1·4×4×2 false)을 만족한다', () => {
    expect(sketchProjectionOk(4, 3, 2)).toBe(true);
    expect(sketchProjectionOk(1, 1, 1)).toBe(true);
    expect(sketchProjectionOk(2, 2, 2)).toBe(true);
    expect(sketchProjectionOk(3, 3, 3)).toBe(true);
    expect(sketchProjectionOk(1, 2, 1)).toBe(false);
    expect(sketchProjectionOk(4, 4, 2)).toBe(false);
  });

  it('gradeSketch가 prefill+점선3, 숨은 실선1, 두 토막, 여분 선분을 정확히 채점한다', () => {
    const prefill = buildPrefillVisibleSegments(4, 3, 2);
    expect(prefill).toHaveLength(9);

    const hiddenIds = ['x10', 'y00', 'z01'] as const;
    const hiddenDashed = hiddenIds.map((id) => {
      const [p, q] = edgeEndpoints(id, 4, 3, 2);
      return { a: sketchProject(p), b: sketchProject(q), style: 'dashed' as const };
    });

    const [h0, h1, h2] = hiddenDashed;
    if (!h0 || !h1 || !h2) throw new Error('expected 3 hidden edges');

    // 1. prefill + 숨은 3개 점선 -> complete
    expect(gradeSketch([...prefill, h0, h1, h2], 4, 3, 2)).toEqual({
      visibleMissing: 0,
      hiddenMissing: 0,
      hiddenSolid: 0,
      visibleDashed: 0,
      extra: 0,
      complete: true,
    });

    // 2. 숨은 하나(x10)를 실선으로 -> hiddenSolid: 1, complete: false
    const withOneSolid = [...prefill, { ...h0, style: 'solid' as const }, h1, h2];
    expect(gradeSketch(withOneSolid, 4, 3, 2)).toEqual({
      visibleMissing: 0,
      hiddenMissing: 1,
      hiddenSolid: 1,
      visibleDashed: 0,
      extra: 0,
      complete: false,
    });

    // 3. 숨은 모서리 x10([0,4,0]..[4,4,0] -> (3,3)..(11,3))을 두 토막으로 -> extra: 2
    const splitHalf1 = { a: [3, 3] as const, b: [7, 3] as const, style: 'dashed' as const };
    const splitHalf2 = { a: [7, 3] as const, b: [11, 3] as const, style: 'dashed' as const };
    expect(gradeSketch([...prefill, h1, h2, splitHalf1, splitHalf2], 4, 3, 2)).toEqual({
      visibleMissing: 0,
      hiddenMissing: 1,
      hiddenSolid: 0,
      visibleDashed: 0,
      extra: 2,
      complete: false,
    });

    // 4. 아무 선분 하나 더 -> extra: 1
    expect(
      gradeSketch(
        [...prefill, h0, h1, h2, { a: [0, 0] as const, b: [1, 0] as const, style: 'solid' }],
        4,
        3,
        2,
      ),
    ).toEqual({
      visibleMissing: 0,
      hiddenMissing: 0,
      hiddenSolid: 0,
      visibleDashed: 0,
      extra: 1,
      complete: false,
    });
  });
});
