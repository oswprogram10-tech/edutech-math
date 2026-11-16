/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { bfsPathToFace, foldTransformsWith } from '../net/geometry';
import { computeFoldPathLayout, isPointInPolygon2D } from '../net/visuals';
import { FoldCollisionOverlay } from '../overlays/fold-collision';
import { FoldPathOverlay } from '../overlays/fold-path';
import { createInitialState, reduce } from '../reduce';
import type { NetFoldConfig, NetFoldState, SolidAction } from '../types';
import { SolidView } from '../View';

afterEach(() => {
  cleanup();
});

function NetHarness({
  config,
  initialActions = [],
}: {
  readonly config: NetFoldConfig;
  readonly initialActions?: readonly SolidAction[];
}) {
  const [state, setState] = useState<NetFoldState>(() => {
    let s: NetFoldState = createInitialState(config);
    for (const act of initialActions) {
      s = reduce(s, act);
    }
    return s;
  });

  return (
    <div style={{ position: 'relative', width: 960, height: 640 }}>
      <SolidView
        config={config}
        state={state}
        dispatch={(action) => setState((prev) => reduce(prev, action))}
        cpa="C"
        mode="net-fold"
        targetSize={48}
      />
      <FoldCollisionOverlay config={config} state={state} />
      <FoldPathOverlay config={config} state={state} />
    </div>
  );
}

const CROSS_GIVEN = [
  { at: [1, 0] as const, w: 1, h: 1, label: '★' },
  { at: [0, 1] as const, w: 1, h: 1, label: 'ㄱ' },
  { at: [1, 1] as const, w: 1, h: 1, label: 'ㄴ' },
  { at: [2, 1] as const, w: 1, h: 1, label: 'ㄷ' },
  { at: [3, 1] as const, w: 1, h: 1, label: 'ㄹ' },
  { at: [1, 2] as const, w: 1, h: 1, label: 'ㅁ' },
];

describe('E12 net-fold View & Overlays', () => {
  it('도구 막대와 키보드(방향키·Enter·R·F·[·])로 면 놓고 접고 돌린다', () => {
    render(
      <NetHarness
        config={{
          mode: 'net-fold',
          target: 'cuboid',
          dims: [4, 3, 2],
          grid: [8, 10],
          animate: false,
        }}
      />,
    );

    const grid = screen.getByTestId('net-grid');
    expect(screen.getByTestId('net-shape-4x3').getAttribute('aria-pressed')).toBe('true');
    // 가로·세로 쌍마다 단추 하나씩만 둔다(3x4·2x4·2x3 중복 없음).
    expect(screen.queryByTestId('net-shape-3x4')).toBeNull();
    expect(screen.queryByTestId('net-shape-2x4')).toBeNull();
    expect(screen.queryByTestId('net-shape-2x3')).toBeNull();
    expect(screen.queryByTestId('net-turn-left')).toBeNull();

    // R 키로 모양 회전 (4x3 -> 3x4)
    fireEvent.keyDown(grid, { key: 'r' });
    expect(screen.getByTestId('net-shape-3x4').getAttribute('aria-pressed')).toBe('true');

    // 방향키 + Enter로 면 놓기
    fireEvent.keyDown(grid, { key: 'ArrowRight' });
    fireEvent.keyDown(grid, { key: 'Enter' });
    expect(screen.getByTestId('net-face-1-0')).toBeTruthy();

    // 같은 칸에서 Enter로 빼기
    fireEvent.keyDown(grid, { key: 'Enter' });
    expect(screen.queryByTestId('net-face-1-0')).toBeNull();

    // F 키로 접기 -> 회전 단추 등장 -> ] 키·단추 동작
    fireEvent.keyDown(grid, { key: 'f' });
    expect(screen.getByTestId('net-turn-left')).toBeTruthy();
    expect(screen.getByTestId('net-turn-right')).toBeTruthy();
    expect(screen.getByTestId('net-fold-toggle').textContent).toContain('펼치기');
  });

  it('!foldable이면 접기 단추를 숨기고 !editable이면 지우기 단추를 숨긴다', () => {
    render(
      <NetHarness
        config={{
          mode: 'net-fold',
          editable: false,
          foldable: false,
          netCards: [
            {
              id: 'ga',
              label: '가',
              faces: [
                { at: [1, 0], w: 1, h: 1 },
                { at: [0, 1], w: 1, h: 1 },
                { at: [1, 1], w: 1, h: 1 },
                { at: [2, 1], w: 1, h: 1 },
                { at: [3, 1], w: 1, h: 1 },
                { at: [1, 2], w: 1, h: 1 },
              ],
            },
            {
              id: 'na',
              label: '나',
              faces: [
                { at: [0, 0], w: 1, h: 1 },
                { at: [1, 0], w: 1, h: 1 },
              ],
            },
            {
              id: 'da',
              label: '다',
              faces: [
                { at: [0, 0], w: 1, h: 1 },
                { at: [0, 1], w: 1, h: 1 },
              ],
            },
          ],
        }}
      />,
    );

    expect(screen.queryByTestId('net-fold-toggle')).toBeNull();
    expect(screen.queryByTestId('net-clear')).toBeNull();
    expect(screen.getByTestId('net-cards').getAttribute('data-card-count')).toBe('3');
    expect(screen.getByTestId('net-card-ga')).toBeTruthy();
  });

  it('예측 전에는 접기 단추가 비활성이고 "먼저 골라 보세요"를 보인다', () => {
    render(
      <NetHarness
        config={{
          mode: 'net-fold',
          editable: false,
          animate: false,
          predict: { of: '★' },
          given: CROSS_GIVEN,
        }}
      />,
    );

    expect(screen.getByTestId('net-predict-prompt').textContent).toContain(
      '접기 전에 ★면과 마주 보는 면을 골라 보세요',
    );
    const foldBtn = screen.getByTestId('net-fold-toggle') as HTMLButtonElement;
    expect(foldBtn.disabled).toBe(true);
    expect(screen.getByTestId('net-pick-first').textContent).toContain('먼저 골라 보세요');

    // ★ 자체에는 예측 버튼이 없고, 이웃 면(ㄱ)에 예측 버튼 있음
    expect(screen.queryByTestId('net-predict-★')).toBeNull();
    const adjBtn = screen.getByTestId('net-predict-ㄱ');
    fireEvent.keyDown(adjBtn, { key: 'Enter' });

    // 예측 후 접기 활성화 및 fold-path 오버레이 표시(이웃 면 예측이므로)
    expect(foldBtn.disabled).toBe(false);
    expect(screen.queryByTestId('net-pick-first')).toBeNull();
    expect(screen.getByTestId('fold-path')).toBeTruthy();
    expect(screen.getByTestId('fold-path-title').textContent).toContain(
      '고른 면을 세워 보면 ★면과 어떻게 만나나요?',
    );
  });

  it('접힌 결과 문구가 사실만 표시한다 (바른 전개도 / 겹침 / 부족 / 떨어짐 / 7면)', () => {
    // 1. 바른 십자
    const r1 = render(
      <NetHarness
        config={{ mode: 'net-fold', animate: false, given: CROSS_GIVEN }}
        initialActions={[{ type: 'fold' }]}
      />,
    );
    expect(screen.getByTestId('net-status').textContent).toContain(
      '접혔어요! 마주 보는 면은 같은 무늬예요.',
    );
    // valid면 fold-collision 오버레이는 그리지 않는다
    expect(screen.queryByTestId('fold-collision')).toBeNull();
    r1.unmount();

    // 2. 일렬 6 -> 겹친 면 2쌍 + 빈 곳 2군데 + fold-collision 오버레이 그림
    const r2 = render(
      <NetHarness
        config={{
          mode: 'net-fold',
          animate: false,
          given: [0, 1, 2, 3, 4, 5].map((x) => ({ at: [x, 0] as const, w: 1, h: 1 })),
        }}
        initialActions={[{ type: 'fold' }]}
      />,
    );
    expect(screen.getByTestId('net-status').textContent).toContain('겹친 면이 2쌍 있어요');
    expect(screen.getByTestId('net-status').textContent).toContain('빈 곳이 2군데 있어요');
    expect(screen.getByTestId('fold-collision')).toBeTruthy();
    expect(screen.getByTestId('fold-collision-title').textContent).toContain(
      '접으면 어디가 겹치는지 보세요',
    );
    r2.unmount();

    // 3. 7면 + 떨어진 면
    render(
      <NetHarness
        config={{
          mode: 'net-fold',
          animate: false,
          given: [
            { at: [0, 0], w: 1, h: 1 },
            { at: [1, 0], w: 1, h: 1 },
            { at: [2, 0], w: 1, h: 1 },
            { at: [3, 0], w: 1, h: 1 },
            { at: [0, 1], w: 1, h: 1 },
            { at: [1, 1], w: 1, h: 1 },
            { at: [5, 5], w: 1, h: 1 },
          ],
        }}
        initialActions={[{ type: 'fold' }]}
      />,
    );
    expect(screen.getByTestId('net-status').textContent).toContain('떨어진 면이 있어요');
    expect(screen.getByTestId('net-status').textContent).toContain('면이 6개가 아니에요(지금 7개)');
  });

  it('오버레이 조건: fold-collision은 접지 않아도 invalid면 그리고, fold-path는 마주 보는 면이면 안 그린다', () => {
    // unfolded invalid -> fold-collision 표시됨
    const r1 = render(
      <NetHarness
        config={{
          mode: 'net-fold',
          given: [0, 1, 2, 3, 4, 5].map((x) => ({ at: [x, 0] as const, w: 1, h: 1 })),
        }}
      />,
    );
    expect(screen.getByTestId('fold-collision')).toBeTruthy();
    r1.unmount();

    // 예측 없음 -> fold-path 안 그림
    const r2 = render(
      <NetHarness
        config={{ mode: 'net-fold', editable: false, predict: { of: '★' }, given: CROSS_GIVEN }}
      />,
    );
    expect(screen.queryByTestId('fold-path')).toBeNull();

    // 마주 보는 면(ㅁ) 예측 -> fold-path 안 그림 (십자에서 (1,0) ★의 맞은편은 (1,2) ㅁ)
    fireEvent.click(screen.getByTestId('net-predict-ㅁ'));
    expect(screen.queryByTestId('fold-path')).toBeNull();
    r2.unmount();
  });

  it('포인터 누름→뗌으로 면을 놓고, 이미 면이 있는 칸 위 그림자는 "놓을 수 없어요"를 보인다', () => {
    render(
      <NetHarness
        config={{
          mode: 'net-fold',
          given: [{ at: [0, 0], w: 1, h: 1, locked: true }],
        }}
      />,
    );

    // 빈 칸 (1,0)에 포인터 누름 -> 놓일 자리 그림자 -> 뗌으로 면 놓기
    const emptyCell = screen.getByTestId('net-cell-1-0');
    fireEvent.pointerDown(emptyCell, { pointerId: 1, button: 0, pointerType: 'mouse' });
    expect(screen.getByTestId('net-place-preview')).toBeTruthy();
    fireEvent.pointerUp(emptyCell, { pointerId: 1, button: 0, pointerType: 'mouse' });
    expect(screen.getByTestId('net-face-1-0')).toBeTruthy();

    // 빈 칸 (2,0) 눌러 드래그해 잠긴 면 (0,0) 위로 이동 -> "놓을 수 없어요" 표시, 떼어도 놓지 않음
    fireEvent.pointerDown(screen.getByTestId('net-cell-2-0'), {
      pointerId: 2,
      button: 0,
      pointerType: 'mouse',
    });
    fireEvent.pointerMove(screen.getByTestId('net-cell-0-0'), {
      pointerId: 2,
      pointerType: 'mouse',
    });
    expect(screen.getByTestId('net-place-preview').textContent).toContain('놓을 수 없어요');
    fireEvent.pointerUp(screen.getByTestId('net-cell-0-0'), {
      pointerId: 2,
      button: 0,
      pointerType: 'mouse',
    });
    expect(screen.queryByTestId('net-face-2-0')).toBeNull();
  });

  it('가장 짧은 면 변 기준으로 minCell을 계산한다(정육면체 48px, 2칸 변 직육면체 32px)', () => {
    const rCube1 = render(<NetHarness config={{ mode: 'net-fold', faceSize: 1 }} />);
    expect(screen.getByTestId('net-grid').getAttribute('data-min-cell')).toBe('48');
    expect(
      Number(screen.getByTestId('net-grid').getAttribute('data-cell-size')),
    ).toBeGreaterThanOrEqual(48);
    rCube1.unmount();

    const rCube2 = render(
      <NetHarness config={{ mode: 'net-fold', faceSize: 2, grid: [12, 12] }} />,
    );
    expect(screen.getByTestId('net-grid').getAttribute('data-min-cell')).toBe('32');
    rCube2.unmount();

    render(
      <NetHarness
        config={{ mode: 'net-fold', target: 'cuboid', dims: [4, 3, 2], grid: [8, 10] }}
      />,
    );
    expect(screen.getByTestId('net-grid').getAttribute('data-min-cell')).toBe('32');
    expect(
      Number(screen.getByTestId('net-grid').getAttribute('data-cell-size')),
    ).toBeGreaterThanOrEqual(32);
  });

  it('접힌 상태 투영 범위가 무대 가운데에 있고 짧은 변의 60% 이상을 차지한다', () => {
    const cases = [
      { name: 'cross', given: CROSS_GIVEN },
      {
        name: 'strip6',
        given: [0, 1, 2, 3, 4, 5].map((x) => ({ at: [x, 0] as const, w: 1, h: 1 })),
      },
    ];

    for (const c of cases) {
      const view = render(
        <NetHarness
          config={{ mode: 'net-fold', animate: false, given: c.given }}
          initialActions={[{ type: 'fold' }]}
        />,
      );
      const stage = screen.getByTestId('net-fold-stage');
      const [, , wStr, hStr] = (stage.getAttribute('viewBox') ?? '0 0 216 168').split(' ');
      const sw = Number(wStr);
      const sh = Number(hStr);
      const shortSide = Math.min(sw, sh);

      const polys = [...stage.querySelectorAll('polygon')];
      expect(polys.length).toBeGreaterThanOrEqual(6);

      let minX = Infinity;
      let maxX = -Infinity;
      let minY = Infinity;
      let maxY = -Infinity;
      for (const poly of polys) {
        const ptsAttr = poly.getAttribute('points') ?? '';
        for (const pair of ptsAttr.trim().split(/\s+/)) {
          const [px, py] = pair.split(',').map(Number);
          if (px !== undefined && py !== undefined) {
            if (px < minX) minX = px;
            if (px > maxX) maxX = px;
            if (py < minY) minY = py;
            if (py > maxY) maxY = py;
          }
        }
      }

      const bboxW = maxX - minX;
      const bboxH = maxY - minY;
      const cx = (minX + maxX) / 2;
      const cy = (minY + maxY) / 2;

      expect(minX).toBeGreaterThanOrEqual(0);
      expect(maxX).toBeLessThanOrEqual(sw);
      expect(minY).toBeGreaterThanOrEqual(0);
      expect(maxY).toBeLessThanOrEqual(sh);
      expect(Math.abs(cx - sw / 2)).toBeLessThanOrEqual(6);
      expect(Math.abs(cy - sh / 2)).toBeLessThanOrEqual(6);
      expect(Math.max(bboxW, bboxH)).toBeGreaterThanOrEqual(shortSide * 0.6);
      view.unmount();
    }
  });

  it('fold-path 오버레이는 ★ 바닥 면이 가리지 않고 고른 면도 보이는 시점을 고르며 ★ 테두리를 맨 위에 그린다', () => {
    const sampleGiven = [
      { at: [0, 0] as const, w: 1, h: 1, label: '★' },
      { at: [0, 1] as const, w: 1, h: 1, label: 'ㄱ' },
      { at: [1, 1] as const, w: 1, h: 1, label: 'ㄴ' },
      { at: [2, 1] as const, w: 1, h: 1, label: 'ㄷ' },
      { at: [3, 1] as const, w: 1, h: 1, label: 'ㄹ' },
      { at: [2, 2] as const, w: 1, h: 1, label: 'ㅁ' },
    ];

    render(
      <NetHarness
        config={{
          mode: 'net-fold',
          editable: false,
          animate: false,
          predict: { of: '★' },
          given: sampleGiven,
        }}
      />,
    );

    fireEvent.click(screen.getByTestId('net-predict-ㄴ'));

    const scene = screen.getByTestId('fold-path-scene');
    const chosenTurn = Number(scene.getAttribute('data-view-turn')) as 0 | 1 | 2 | 3;

    // 렌더링된 SVG 다각형 순서에서 ★(index 0)보다 뒤에 그려진 면(더 앞쪽 면)이 ★ 중심을 가리지 않아야 한다.
    const faceGroups = [...scene.querySelectorAll('g[data-face-idx]')];
    const starPos = faceGroups.findIndex((g) => g.getAttribute('data-face-idx') === '0');
    expect(starPos).toBeGreaterThanOrEqual(0);

    const parsePoly = (el: Element | null | undefined) =>
      (el?.getAttribute('points') ?? '')
        .trim()
        .split(/\s+/)
        .map((pair) => {
          const [x, y] = pair.split(',').map(Number);
          return { x: x ?? 0, y: y ?? 0 };
        });

    const starPoly = parsePoly(faceGroups[starPos]?.querySelector('polygon'));
    const starCx = starPoly.reduce((acc, p) => acc + p.x, 0) / starPoly.length;
    const starCy = starPoly.reduce((acc, p) => acc + p.y, 0) / starPoly.length;

    const frontGroups = faceGroups.slice(starPos + 1);
    const starDepth = Number(faceGroups[starPos]?.getAttribute('data-depth'));
    for (const fg of frontGroups) {
      if (Number(fg.getAttribute('data-depth')) <= starDepth + 1e-4) continue;
      const frontPoly = parsePoly(fg.querySelector('polygon'));
      expect(isPointInPolygon2D(starCx, starCy, frontPoly)).toBe(false);
    }

    // ★ 테두리가 맨 마지막 요소로 굵은 파란 점선으로 그려진다.
    const outline = screen.getByTestId('fold-path-target-outline');
    expect(outline).toBe(scene.lastElementChild);
    expect(outline.getAttribute('stroke')).toBe('#1d4ed8');
    expect(outline.getAttribute('stroke-dasharray')).toBe('5 3');

    // 수학 레이아웃 함수도 같은 시점을 고르고 ★ 중심 가림 없음 · 예측 면 가시성을 만족한다.
    const facesInput = sampleGiven.map((g) => ({
      x: g.at[0],
      y: g.at[1],
      w: g.w,
      h: g.h,
      label: g.label,
    }));
    const pathSet = bfsPathToFace(facesInput, 0, 2);
    const transforms = foldTransformsWith(facesInput, 0, (idx) =>
      pathSet.has(idx) ? Math.PI / 2 : 0,
    );
    const layout = computeFoldPathLayout(transforms, 0, 2, 0, 240, 176);
    expect(layout.viewTurn).toBe(chosenTurn);
    expect(layout.starCenterVisible).toBe(true);
    expect(layout.predVisibleRatio).toBeGreaterThan(0.15);
  });
});
