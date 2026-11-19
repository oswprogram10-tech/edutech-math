/** T166: band-circle 모핑 기하(순수 함수) 단위 테스트. */
import { describe, expect, it } from 'vitest';
import {
  bandCirclePath,
  bandFrameOf,
  bandMapper,
  chordLength,
  clampCurl,
  curlFromDistance,
  pointAt,
  regionPath,
  ringRadius,
} from '../band-circle';

const FRAME = bandFrameOf(false, false);
const SEGMENTS = [
  { cat: '사과', cells: 45 },
  { cat: '포도', cells: 30 },
  { cat: '딸기', cells: 15 },
  { cat: '기타', cells: 10 },
];

function numbers(d: string): number[] {
  return (d.match(/-?\d+(\.\d+)?/g) ?? []).map(Number);
}

function bounds(d: string) {
  const values = numbers(d);
  const xs = values.filter((_, i) => i % 2 === 0);
  const ys = values.filter((_, i) => i % 2 === 1);
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
  };
}

/** 12시 기준 시계 방향 각도(°)로 바꾼다. */
function degrees(x: number, y: number, cx: number, cy: number): number {
  const angle = (Math.atan2(x - cx, cy - y) * 180) / Math.PI;
  return (angle + 360) % 360;
}

describe('bandCirclePath: curl 0 곧은 띠', () => {
  const path = bandCirclePath(SEGMENTS, 0, FRAME);

  it('조각은 범주 순서대로 왼쪽부터 이어 놓은 직사각형이다', () => {
    const { x, y, length, thickness } = FRAME.band;
    const cell = length / 100;
    let used = 0;
    path.slices.forEach((slice, index) => {
      const segment = SEGMENTS[index];
      expect(slice.cat).toBe(segment?.cat);
      const box = bounds(slice.d);
      expect(box.minX).toBeCloseTo(x + used * cell, 1);
      expect(box.maxX).toBeCloseTo(x + (used + (segment?.cells ?? 0)) * cell, 1);
      expect(box.minY).toBeCloseTo(y - thickness / 2, 1);
      expect(box.maxY).toBeCloseTo(y + thickness / 2, 1);
      used += segment?.cells ?? 0;
    });
  });

  it('틀은 100칸 직사각형이고 오른쪽 끝(가운데 선)이 손잡이 자리다', () => {
    const box = bounds(path.frameD);
    expect(box.minX).toBeCloseTo(FRAME.band.x, 1);
    expect(box.maxX).toBeCloseTo(FRAME.band.x + FRAME.band.length, 1);
    expect(path.end.x).toBeCloseTo(FRAME.band.x + FRAME.band.length, 1);
    expect(path.end.y).toBeCloseTo(FRAME.band.y, 1);
  });
});

describe('bandCirclePath: curl 80 닫힌 고리', () => {
  const ring = ringRadius(FRAME);
  const { cx, cy } = FRAME.pie;

  it('왼쪽 끝이 고리의 12시 방향이고 가운데 선 반지름이 L/2π이다', () => {
    const start = pointAt(FRAME, 80, 0, 0.5);
    expect(start.x).toBeCloseTo(cx, 1);
    expect(start.y).toBeCloseTo(cy - ring, 1);
    // 오른쪽 끝이 왼쪽 끝과 겹쳐 닫힌다.
    const end = pointAt(FRAME, 80, 1, 0.5);
    expect(end.x).toBeCloseTo(start.x, 1);
    expect(end.y).toBeCloseTo(start.y, 1);
  });

  it('안쪽·바깥 반지름은 가운데 선 ± 두께/2이다', () => {
    const outer = pointAt(FRAME, 80, 0.25, 0);
    const inner = pointAt(FRAME, 80, 0.25, 1);
    expect(Math.hypot(outer.x - cx, outer.y - cy)).toBeCloseTo(ring + FRAME.band.thickness / 2, 1);
    expect(Math.hypot(inner.x - cx, inner.y - cy)).toBeCloseTo(ring - FRAME.band.thickness / 2, 1);
  });
});

describe('bandCirclePath: curl 100 원그래프', () => {
  const path = bandCirclePath(SEGMENTS, 100, FRAME);
  const { cx, cy, r } = FRAME.pie;

  it('조각 각도는 칸 수 × 3.6°이고 12시에서 시계 방향으로 이어 놓는다', () => {
    let used = 0;
    path.slices.forEach((slice, index) => {
      const cells = SEGMENTS[index]?.cells ?? 0;
      const start = degrees(...xy(pointAt(FRAME, 100, used / 100, 0)), cx, cy);
      const stop = degrees(...xy(pointAt(FRAME, 100, (used + cells) / 100, 0)), cx, cy);
      expect(start).toBeCloseTo((used * 3.6) % 360, 1);
      expect(stop).toBeCloseTo(((used + cells) * 3.6) % 360, 1);
      expect(slice.midDegrees).toBeCloseTo((used + cells / 2) * 3.6, 6);
      used += cells;
    });
  });

  it('바깥 반지름은 원그래프 반지름이고 안쪽 반지름은 0이다', () => {
    const outer = pointAt(FRAME, 100, 0.3, 0);
    const inner = pointAt(FRAME, 100, 0.3, 1);
    expect(Math.hypot(outer.x - cx, outer.y - cy)).toBeCloseTo(r, 1);
    expect(Math.hypot(inner.x - cx, inner.y - cy)).toBeCloseTo(0, 1);
  });

  it('틀은 원이다(지름 = 2r)', () => {
    const box = bounds(path.frameD);
    expect(box.maxX - box.minX).toBeCloseTo(2 * r, 0);
    expect(box.maxY - box.minY).toBeCloseTo(2 * r, 0);
  });
});

describe('bandCirclePath: 합이 100이 아니어도 그 칸 수 그대로', () => {
  it('모자라면 남은 구간이 비고(마지막 조각 끝 < 1), 넘치면 u가 1을 넘는다', () => {
    const under = bandCirclePath(
      [
        { cat: 'a', cells: 20 },
        { cat: 'b', cells: 30 },
      ],
      0,
      FRAME,
    );
    expect(under.slices[1]?.u1).toBeCloseTo(0.5, 9);
    const over = bandCirclePath(
      [
        { cat: 'a', cells: 70 },
        { cat: 'b', cells: 60 },
      ],
      0,
      FRAME,
    );
    expect(over.slices[1]?.u1).toBeCloseTo(1.3, 9);
    // 곧은 띠에서는 틀(오른쪽 끝) 밖으로 삐져나온다.
    const box = bounds(over.slices[1]?.d ?? '');
    expect(box.maxX).toBeGreaterThan(FRAME.band.x + FRAME.band.length);
    expect(box.maxX).toBeCloseTo(FRAME.band.x + 1.3 * FRAME.band.length, 1);
  });

  it('원그래프에서 넘치면 한 바퀴를 넘고 모자라면 각도가 그만큼 비어 있다', () => {
    const { cx, cy } = FRAME.pie;
    const over = bandCirclePath(
      [
        { cat: 'a', cells: 70 },
        { cat: 'b', cells: 60 },
      ],
      100,
      FRAME,
    );
    expect(over.slices[1]?.midDegrees).toBeCloseTo(100 * 3.6, 6);
    const edge = pointAt(FRAME, 100, 1.3, 0);
    expect(degrees(edge.x, edge.y, cx, cy)).toBeCloseTo(0.3 * 360, 1);
    const under = bandCirclePath(
      [
        { cat: 'a', cells: 20 },
        { cat: 'b', cells: 30 },
      ],
      100,
      FRAME,
    );
    expect((under.slices[1]?.u1 ?? 0) * 360).toBeCloseTo(180, 6);
  });

  it('칸이 0인 조각은 path가 비어 있다', () => {
    const path = bandCirclePath(
      [
        { cat: 'a', cells: 0 },
        { cat: 'b', cells: 10 },
      ],
      50,
      FRAME,
    );
    expect(path.slices[0]?.d).toBe('');
    expect(path.slices[1]?.d).not.toBe('');
  });
});

describe('모핑 중간(curl 40)', () => {
  it('조각 순서가 뒤집히지 않는다: 띠를 따라 앞 조각이 뒤 조각보다 앞선다', () => {
    const mapper = bandMapper(FRAME, 40);
    // 가운데 선 위 점들의 호 길이는 u에 비례하므로, 이웃한 점 사이 거리가 늘 양수이고
    // 진행 방향(접선)이 연속이다.
    let turn = 0;
    let previous = mapper.at(0, 0.5);
    let last = Math.atan2(mapper.at(0.01, 0.5).y - previous.y, mapper.at(0.01, 0.5).x - previous.x);
    for (let i = 1; i <= 100; i += 1) {
      const point = mapper.at(i / 100, 0.5);
      const heading = Math.atan2(point.y - previous.y, point.x - previous.x);
      let delta = heading - last;
      while (delta > Math.PI) delta -= 2 * Math.PI;
      while (delta < -Math.PI) delta += 2 * Math.PI;
      turn += delta;
      // 늘 같은 쪽(시계 방향)으로만 굽는다 = 접는 일이 없다.
      expect(delta).toBeGreaterThanOrEqual(-1e-9);
      last = heading;
      previous = point;
    }
    // 곡률은 curl에 비례한다: curl 40은 80의 절반이라 전체 꺾임이 π(반 바퀴)다.
    expect(turn).toBeCloseTo(Math.PI, 1);
  });

  it('조각이 서로 겹치지 않고 한 번만 이어진다(끊기지 않는다)', () => {
    const path = bandCirclePath(SEGMENTS, 40, FRAME);
    const mapper = bandMapper(FRAME, 40);
    path.slices.forEach((slice, index) => {
      const next = path.slices[index + 1];
      if (!next) return;
      const a = mapper.at(slice.u1, 0.5);
      const b = mapper.at(next.u0, 0.5);
      expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeLessThan(1e-6);
    });
  });
});

describe('모핑 모양이 캔버스 안에 있다', () => {
  it('curl 0~100 모든 정수에서 틀 가장자리가 논리 틀(0~1000, 0~높이)을 벗어나지 않는다', () => {
    for (const compare of [false, true]) {
      for (const stacked of [false, true]) {
        const frame = bandFrameOf(compare, stacked);
        for (let curl = 0; curl <= 100; curl += 1) {
          const box = bounds(bandCirclePath([], curl, frame).frameD);
          const label = `compare=${compare} stacked=${stacked} curl=${curl}`;
          expect(box.minX, label).toBeGreaterThanOrEqual(-0.5);
          expect(box.minY, label).toBeGreaterThanOrEqual(-0.5);
          expect(box.maxX, label).toBeLessThanOrEqual(frame.width + 0.5);
          expect(box.maxY, label).toBeLessThanOrEqual(frame.height + 0.5);
        }
      }
    }
  });

  it('왼쪽 끝은 curl에 따라 연속으로 움직인다(한 번에 25px보다 크게 뛰지 않는다)', () => {
    let previous = pointAt(FRAME, 0, 0, 0.5);
    for (let curl = 1; curl <= 100; curl += 1) {
      const point = pointAt(FRAME, curl, 0, 0.5);
      expect(Math.hypot(point.x - previous.x, point.y - previous.y), `curl=${curl}`).toBeLessThan(
        25,
      );
      previous = point;
    }
  });
});

describe('끌어 말기: curlFromDistance', () => {
  it('곧은 띠 끝점 거리 L은 0, 0은 80이고 그 사이는 단조 감소한다', () => {
    const length = FRAME.band.length;
    expect(curlFromDistance(FRAME, length)).toBe(0);
    expect(curlFromDistance(FRAME, length + 100)).toBe(0);
    expect(curlFromDistance(FRAME, 0)).toBe(80);
    expect(curlFromDistance(FRAME, -5)).toBe(80);
    expect(curlFromDistance(FRAME, Number.NaN)).toBe(0);
    let previous = 0;
    for (let d = length; d >= 0; d -= 20) {
      const curl = curlFromDistance(FRAME, d);
      expect(curl).toBeGreaterThanOrEqual(previous);
      previous = curl;
    }
  });

  it('거리에서 구한 curl의 현 길이가 그 거리로 되돌아온다(역함수)', () => {
    for (const d of [700, 500, 300, 120]) {
      expect(chordLength(FRAME, curlFromDistance(FRAME, d))).toBeCloseTo(d, 0);
    }
  });
});

describe('도우미', () => {
  it('clampCurl은 0~100 정수로 자른다', () => {
    expect(clampCurl(-5)).toBe(0);
    expect(clampCurl(120)).toBe(100);
    expect(clampCurl(49.6)).toBe(50);
    expect(clampCurl(Number.NaN)).toBe(0);
  });

  it('regionPath는 빈 구간이면 빈 문자열이다', () => {
    expect(regionPath(FRAME, 0, 0.5, 0.5)).toBe('');
    expect(regionPath(FRAME, 0, 0.5, 0.4)).toBe('');
    expect(regionPath(FRAME, 0, 0.4, 0.5)).not.toBe('');
  });

  it('compare가 있으면 두 원이 나란히(또는 위아래로) 놓인다', () => {
    const side = bandFrameOf(true, false);
    expect(side.compare?.cy).toBe(side.pie.cy);
    expect(side.compare?.cx).toBeGreaterThan(side.pie.cx + 2 * side.pie.r - 1);
    const stack = bandFrameOf(true, true);
    expect(stack.compare?.cx).toBe(stack.pie.cx);
    expect(stack.compare?.cy).toBeGreaterThan(stack.pie.cy + 2 * stack.pie.r);
    expect(stack.height).toBeGreaterThan(stack.width);
  });
});

function xy(point: { readonly x: number; readonly y: number }): [number, number] {
  return [point.x, point.y];
}
