import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { PREVIEW_URL } from '../../../playwright.config';
import { expectContentPanelsReachable, expectNoPanelInnerScroll } from '../panel-layout';

/**
 * T140 g5s2u5 「직육면체와 정육면체」 14과제 단원 E2E.
 * - A1(E12 `xray`)·A2(E12 `net-fold`) 흐름과 오개념 3코드 감지(3뷰포트)
 * - `xray-peek`(A1.T1·T5)·`fold-collision`(A2.T1)·`fold-path`(A2.T3) 오버레이 표시와 정렬
 * - 과제별 첫 화면 검사 + 활동별 스냅샷 + 오프라인
 */

test.describe.configure({ timeout: 300_000 });
test.use({ actionTimeout: 20_000 });

type Dot = readonly [number, number];

// 첫 화면 기준(뷰포트별): 판이 '확인하기'까지 한 화면에 다 들어오면 'fit', 아니면 'reachable'.
// 아이패드(768×1024)에서 A1.T1(수 응답 세 칸)과 A2.T7(카드 3장+응답 두 칸)은 '확인하기'가 첫 화면 아래다.
const FIT_A1_T1: Record<string, 'fit' | 'reachable'> = { ipad: 'reachable' };
const FIT_A1_T5: Record<string, 'fit' | 'reachable'> = {};
const FIT_A2_T1: Record<string, 'fit' | 'reachable'> = {};
const FIT_A2_T3: Record<string, 'fit' | 'reachable'> = {};
const FIT_A2_T6: Record<string, 'fit' | 'reachable'> = {};
const FIT_A2_T7: Record<string, 'fit' | 'reachable'> = { ipad: 'reachable' };

function slot(page: Page, name: string): Locator {
  return page.getByTestId(`runner-slot-${name}`);
}

function field(page: Page, id: string): Locator {
  return slot(page, 'response').locator(`[data-response-field="${id}"]`);
}

async function openActivity(page: Page, activityId: string, heading: string): Promise<void> {
  await page.goto('/');
  await page.getByRole('button', { name: '1번', exact: true }).click();
  await page.getByRole('button', { name: '건너뛰기' }).click();
  await expect(page).toHaveURL(/#\/map$/);
  await page.goto(`/#/activity/${activityId}`);
  await expect(page.getByRole('heading', { name: heading })).toBeVisible();
  await expect(page.getByRole('button', { name: '확인하기' })).toBeVisible();
}

async function choose(page: Page, id: string, label: string): Promise<void> {
  await field(page, id).getByRole('button', { name: label, exact: true }).click();
}

async function typeNumberField(page: Page, id: string, digits: readonly string[]): Promise<void> {
  await field(page, id)
    .getByRole('button', { name: /^자연수 부분:/ })
    .first()
    .click();
  // 이미 쓴 수가 있으면 키보드로 지운 뒤 다시 쓴다.
  for (let i = 0; i < 4; i += 1) {
    await page.keyboard.press('Backspace');
  }
  for (const key of digits) {
    await page.keyboard.press(key);
  }
}

async function submit(page: Page): Promise<void> {
  await page.getByRole('button', { name: '확인하기' }).click();
}

async function expectFailedWithHint(
  page: Page,
  text: string | null,
  level: 1 | 2 | 3 = 1,
): Promise<void> {
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByTestId('hint')).toHaveAttribute('data-hint-level', String(level));
  if (text !== null) {
    await expect(page.getByTestId('hint-text')).toContainText(text);
  }
}

async function expectPassed(page: Page, last = false): Promise<void> {
  await expect(page.getByText('좋아요, 통과했어요!')).toBeVisible();
  if (last) {
    await expect(page.getByText('모든 과제를 마쳤어요.')).toBeVisible();
    return;
  }
  await page.getByRole('button', { name: '다음 과제' }).click();
}

async function screenshot(page: Page, name: string): Promise<void> {
  await page.evaluate(() => {
    window.scrollTo(0, 0);
    document.querySelector('main')?.scrollTo(0, 0);
  });
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
  await expect(page).toHaveScreenshot(name, {
    maxDiffPixelRatio: 0.02,
    animations: 'disabled',
    fullPage: true,
  });
}

async function expectOverlayAligned(
  panel: Locator,
  overlayName: string,
  canvasTestId: string,
): Promise<void> {
  const overlay = panel.locator(`[data-overlay="${overlayName}"]`);
  await expect(overlay).toBeVisible();
  const canvas = panel.getByTestId(canvasTestId);
  await expect
    .poll(async () => {
      const overlayBox = await overlay.locator('svg').boundingBox();
      const canvasBox = await canvas.boundingBox();
      if (!overlayBox || !canvasBox) return Number.POSITIVE_INFINITY;
      return Math.max(
        Math.abs(overlayBox.x - canvasBox.x),
        Math.abs(overlayBox.y - canvasBox.y),
        Math.abs(overlayBox.width - canvasBox.width),
        Math.abs(overlayBox.height - canvasBox.height),
      );
    })
    .toBeLessThanOrEqual(1);
  await expect(overlay.locator('svg')).toHaveCount(1);
}

async function expectFirstScreen(
  page: Page,
  mode: 'fit' | 'reachable',
  locators: readonly Locator[] = [],
): Promise<void> {
  await expectNoPanelInnerScroll(page);
  if (mode === 'fit') {
    for (const loc of locators) {
      await expect(loc).toBeInViewport({ ratio: 1 });
    }
    await expect(page.getByRole('button', { name: '확인하기' })).toBeInViewport({ ratio: 1 });
    return;
  }
  await expectContentPanelsReachable(page);
  for (const loc of locators) {
    await loc.scrollIntoViewIfNeeded();
    await expect(loc).toBeInViewport({ ratio: 0.99 });
  }
}

// ---------------------------------------------------------------- A1 도우미

const HIDDEN_DOTS: readonly (readonly [Dot, Dot])[] = [
  [
    [3, 3],
    [11, 3],
  ],
  [
    [0, 0],
    [3, 3],
  ],
  [
    [3, 3],
    [3, 7],
  ],
];

/** 한 변 2인 정육면체 겨냥도(사투상 `(2x+y, 2z+y)`)의 보이는 모서리 9개. */
const CUBE_VISIBLE: readonly (readonly [Dot, Dot])[] = [
  [
    [0, 0],
    [4, 0],
  ],
  [
    [0, 4],
    [4, 4],
  ],
  [
    [0, 0],
    [0, 4],
  ],
  [
    [4, 0],
    [4, 4],
  ],
  [
    [2, 6],
    [6, 6],
  ],
  [
    [4, 0],
    [6, 2],
  ],
  [
    [0, 4],
    [2, 6],
  ],
  [
    [4, 4],
    [6, 6],
  ],
  [
    [6, 2],
    [6, 6],
  ],
];

/** 한 변 2인 정육면체 겨냥도의 숨은 모서리 3개. */
const CUBE_HIDDEN: readonly (readonly [Dot, Dot])[] = [
  [
    [2, 2],
    [6, 2],
  ],
  [
    [0, 0],
    [2, 2],
  ],
  [
    [2, 2],
    [2, 6],
  ],
];

async function setLineStyle(page: Page, style: 'solid' | 'dashed'): Promise<void> {
  await page.getByTestId(`xray-style-${style}`).click();
  await expect(page.getByTestId(`xray-style-${style}`)).toHaveAttribute('aria-pressed', 'true');
}

async function drawSegments(page: Page, segments: readonly (readonly [Dot, Dot])[]): Promise<void> {
  for (const [a, b] of segments) {
    await page.getByTestId(`xray-dot-${a[0]}-${a[1]}`).click();
    await page.getByTestId(`xray-dot-${b[0]}-${b[1]}`).click();
  }
}

async function turnRight(page: Page, times: number): Promise<void> {
  for (let i = 0; i < times; i += 1) {
    await page.getByTestId('xray-turn-right').click();
  }
}

/**
 * 면 요소 안에서 다른 요소(엑스레이로 비친 모서리·꼭짓점 누름 범위)에 가려지지 않는 점을 골라 누른다.
 * 학생도 모서리가 지나가지 않는 곳을 누르므로 면 가운데가 막히면 다른 자리를 쓴다.
 */
async function clickFaceFreeSpot(page: Page, face: string): Promise<void> {
  const el = page.getByTestId(`xray-face-${face}`);
  await el.scrollIntoViewIfNeeded();
  const point = await el.evaluate((node, id) => {
    const poly = node.querySelector('polygon');
    const svg = (node as SVGElement).ownerSVGElement;
    if (!poly || !svg) return null;
    const ctm = svg.getScreenCTM();
    if (!ctm) return null;
    const pts = (poly.getAttribute('points') ?? '')
      .trim()
      .split(/\s+/)
      .map((pair) => pair.split(',').map(Number) as [number, number]);
    if (pts.length < 3) return null;
    const cx = pts.reduce((a, p) => a + p[0], 0) / pts.length;
    const cy = pts.reduce((a, p) => a + p[1], 0) / pts.length;
    const candidates: [number, number][] = [[cx, cy]];
    for (const t of [0.25, 0.45, 0.65]) {
      for (const p of pts) candidates.push([cx + (p[0] - cx) * t, cy + (p[1] - cy) * t]);
    }
    for (const [x, y] of candidates) {
      const sx = ctm.a * x + ctm.c * y + ctm.e;
      const sy = ctm.b * x + ctm.d * y + ctm.f;
      const hit = document.elementFromPoint(sx, sy);
      if (hit && hit.closest(`[data-testid="xray-face-${id}"]`)) return { x: sx, y: sy };
    }
    return null;
  }, face);
  expect(point, `${face} 면에 가려지지 않는 자리가 있어야 한다`).not.toBeNull();
  if (point) await page.mouse.click(point.x, point.y);
}

async function markFace(page: Page, face: string): Promise<void> {
  const el = page.getByTestId(`xray-face-${face}`);
  await clickFaceFreeSpot(page, face);
  await expect(el).toHaveAttribute('data-marked', 'true');
}

// ---------------------------------------------------------------- A2 도우미

const CROSS: readonly Dot[] = [
  [1, 0],
  [0, 1],
  [1, 1],
  [2, 1],
  [3, 1],
  [1, 2],
];

const ROW6: readonly Dot[] = [
  [0, 0],
  [1, 0],
  [2, 0],
  [3, 0],
  [4, 0],
  [5, 0],
];

/** 1-4-1에서 위·아래 날개가 가장 바깥에 붙은 Z 모양. */
const Z_NET: readonly Dot[] = [
  [0, 0],
  [0, 1],
  [1, 1],
  [2, 1],
  [3, 1],
  [3, 2],
];

/** 3-3 계단 모양. */
const STAIR_NET: readonly Dot[] = [
  [0, 0],
  [1, 0],
  [2, 0],
  [2, 1],
  [3, 1],
  [4, 1],
];

async function placeCells(page: Page, coords: readonly Dot[]): Promise<void> {
  for (const [x, y] of coords) {
    await page.getByTestId(`net-cell-${x}-${y}`).click();
  }
}

async function foldNet(page: Page): Promise<void> {
  await page.getByTestId('net-fold-toggle').click();
  await expect(page.getByTestId('net-fold-toggle')).toHaveAttribute('aria-pressed', 'true');
}

async function clearNet(page: Page): Promise<void> {
  await page.getByTestId('net-clear').click();
  await expect(page.getByTestId('net-fold-toggle')).not.toHaveAttribute('aria-pressed', 'true');
}

async function drawFoldedNet(page: Page, coords: readonly Dot[]): Promise<void> {
  await placeCells(page, coords);
  await foldNet(page);
}

// ---------------------------------------------------------------- A1

test('g5s2u5.A1 — 엑스레이 겨냥도 7과제 흐름·오개념·xray-peek 정렬', async ({ page }, testInfo) => {
  test.slow();
  await openActivity(page, 'g5s2u5.A1', '엑스레이 겨냥도');
  const main = slot(page, 'main');
  const vp = testInfo.project.name;

  // T1 첫 화면 + 스냅샷
  await expect(main.getByTestId('xray-stage')).toBeVisible();
  await expectFirstScreen(page, FIT_A1_T1[vp] ?? 'fit', [
    main.getByTestId('xray-stage'),
    main.getByTestId('xray-tool-face'),
    main.getByTestId('xray-tool-edge'),
    main.getByTestId('xray-tool-vertex'),
    field(page, 'faces'),
    field(page, 'edges'),
    field(page, 'vertices'),
  ]);
  await expect(main.getByTestId('xray-toggle')).toHaveCount(0); // xrayToggle:false
  await screenshot(page, 'g5s2u5-a1.png');

  // T1: 모서리 도구로 모서리 하나 표시
  await main.getByTestId('xray-tool-edge').click();
  await main.getByTestId('xray-edge-x00').click();
  await expect(main.locator('[data-testid^="xray-edge-"][data-marked="true"]')).toHaveCount(1);

  // T1: 6·9·8 → MC-3D-HIDDEN-UNCOUNTED ① → 다시 → ② + xray-peek 정렬 → 6·12·8 통과
  await typeNumberField(page, 'faces', ['6']);
  await typeNumberField(page, 'edges', ['9']);
  await typeNumberField(page, 'vertices', ['8']);
  await submit(page);
  await expectFailedWithHint(page, '뒤쪽으로 돌려 보면 보이지 않던 모서리가 있을까요?', 1);
  await submit(page);
  await expectFailedWithHint(
    page,
    '숨어 있는 모서리와 꼭짓점을 점선과 빈 동그라미로 비춰 보았어요.',
    2,
  );
  await expectOverlayAligned(main, 'xray-peek', 'xray-stage');
  await expect(
    main.locator('[data-overlay="xray-peek"] [data-testid^="xray-peek-edge-"]'),
  ).toHaveCount(3);
  await expect(
    main.locator('[data-overlay="xray-peek"] [data-testid^="xray-peek-vertex-"]'),
  ).toHaveCount(1);
  await typeNumberField(page, 'edges', ['1', '2']);
  await submit(page);
  await expectPassed(page);

  // T2: 면 관계 보기만 있고 표시 도구는 없다
  await expect(main.getByTestId('xray-tool-query')).toBeVisible();
  await expect(main.getByTestId('xray-tool-face')).toHaveCount(0);
  await expect(main.getByTestId('xray-tool-edge')).toHaveCount(0);
  // tools:[]이면 처음 도구가 없으므로 '면 관계 보기'를 먼저 고른다.
  await main.getByTestId('xray-tool-query').click();
  await main.getByTestId('xray-face-front').click();
  await expect(main.getByTestId('xray-face-front')).toHaveAttribute('aria-pressed', 'true');
  await typeNumberField(page, 'pairs', ['3']);
  await submit(page);
  await expectPassed(page);

  // T3: 아무것도 표시하지 않고 확인 → 상태 ① → 돌려서 back 표시 → 통과
  await submit(page);
  await expectFailedWithHint(page, '색칠된 면의 뒤쪽에는 무엇이 있을까요?', 1);
  await turnRight(page, 2);
  await markFace(page, 'back');
  await submit(page);
  await expectPassed(page);

  // T4: front·right만 → MC ① → 엑스레이 켜고 돌려 back·left까지 → 통과
  await markFace(page, 'front');
  await markFace(page, 'right');
  await submit(page);
  await expectFailedWithHint(page, '뒤쪽으로 돌려 보면 색칠된 면과 만나는 면이 더 있을까요?', 1);
  await submit(page);
  await expectFailedWithHint(page, '숨어 있는 모서리를 점선으로 비춰 보았어요.', 2);
  await expectOverlayAligned(main, 'xray-peek', 'xray-stage');
  await main.getByTestId('xray-toggle').click();
  await turnRight(page, 2);
  await markFace(page, 'back');
  await turnRight(page, 2);
  await markFace(page, 'left');
  await submit(page);
  await expectPassed(page);

  // T5: 숨은 모서리 하나를 실선 → 상태 ① → 다시 → ② xray-peek → 점선 3개 → 통과
  await expectFirstScreen(page, FIT_A1_T5[vp] ?? 'fit', [
    main.getByTestId('xray-sketch'),
    main.getByTestId('xray-style-solid'),
    main.getByTestId('xray-style-dashed'),
  ]);
  await drawSegments(page, [HIDDEN_DOTS[0] as readonly [Dot, Dot]]);
  await submit(page);
  await expectFailedWithHint(page, '보이지 않는 모서리는 어떤 선으로 그릴까요?', 1);
  await submit(page);
  await expectFailedWithHint(page, '엑스레이로 숨은 모서리를 비춰 보았어요.', 2);
  await expectOverlayAligned(main, 'xray-peek', 'xray-sketch');
  await setLineStyle(page, 'dashed');
  await drawSegments(page, HIDDEN_DOTS);
  await submit(page);
  await expectPassed(page);

  // T6: 정육면체 12개를 모두 실선 → 상태 ① → 숨은 3개를 점선으로 → 통과
  await drawSegments(page, [...CUBE_VISIBLE, ...CUBE_HIDDEN]);
  await submit(page);
  await expectFailedWithHint(page, '보이지 않는 모서리는 어떤 선으로 그릴까요?', 1);
  await setLineStyle(page, 'dashed');
  await drawSegments(page, CUBE_HIDDEN);
  await submit(page);
  await expectPassed(page);

  // T7: 9 → MC ① → 3 → 통과
  await expect(main.getByTestId('xray-stage')).toHaveAttribute('data-display', 'sketch');
  await expect(main.getByTestId('xray-toggle')).toHaveCount(0);
  await expect(main.locator('[data-testid^="xray-tool-"]')).toHaveCount(0);
  await typeNumberField(page, 'hidden', ['9']);
  await submit(page);
  await expectFailedWithHint(page, '실선과 점선 중 어느 선이 보이지 않는 모서리일까요?', 1);
  await typeNumberField(page, 'hidden', ['3']);
  await submit(page);
  await expectPassed(page, true);
});

test('g5s2u5.A1 — 과제마다 대표 오답 일반 힌트 ①', async ({ page }) => {
  test.slow();
  await openActivity(page, 'g5s2u5.A1', '엑스레이 겨냥도');
  const main = slot(page, 'main');

  // T1: 6·11·8 (MC 아님) → 일반 ①
  await typeNumberField(page, 'faces', ['6']);
  await typeNumberField(page, 'edges', ['1', '1']);
  await typeNumberField(page, 'vertices', ['8']);
  await submit(page);
  await expectFailedWithHint(page, '표시한 것과 아직 표시하지 않은 것을 나누어 세어 볼까요?', 1);
  await typeNumberField(page, 'edges', ['1', '2']);
  await submit(page);
  await expectPassed(page);

  // T2: 6 → 일반 ① → 3
  await typeNumberField(page, 'pairs', ['6']);
  await submit(page);
  await expectFailedWithHint(page, '한 면을 눌렀을 때 함께 칠해지는 면은 몇 개인가요?', 1);
  await typeNumberField(page, 'pairs', ['3']);
  await submit(page);
  await expectPassed(page);

  // T3: 윗면 표시 → 일반 ① → 지우고 돌려서 back
  await markFace(page, 'top');
  await submit(page);
  await expectFailedWithHint(page, '색칠된 면과 만나지 않는 면은 어디일까요?', 1);
  await main.getByTestId('xray-clear-marks').click();
  await turnRight(page, 2);
  await markFace(page, 'back');
  await submit(page);
  await expectPassed(page);

  // T4: 5면 → 일반 ① → 한 면을 지워 4면 → 통과
  await markFace(page, 'front');
  await markFace(page, 'right');
  await main.getByTestId('xray-toggle').click();
  await turnRight(page, 2);
  await markFace(page, 'back');
  await turnRight(page, 2);
  await markFace(page, 'left');
  await main.getByTestId('xray-tilt-down').click();
  await main.getByTestId('xray-tilt-down').click();
  await markFace(page, 'bottom');
  await submit(page);
  await expectFailedWithHint(page, '색칠된 면과 모서리를 함께 쓰는 면을 하나씩 짚어 볼까요?', 1);
  await clickFaceFreeSpot(page, 'bottom');
  await submit(page);
  await expectPassed(page);

  // T5: 아무 선도 더하지 않고 확인 → 일반 ① → 점선 3개
  await submit(page);
  await expectFailedWithHint(page, '그려진 선이 모이지 않은 꼭짓점 하나를 찾아볼까요?', 1);
  await setLineStyle(page, 'dashed');
  await drawSegments(page, HIDDEN_DOTS);
  await submit(page);
  await expectPassed(page);

  // T6: 앞면 4개만 → 일반 ① → 나머지 8개
  await drawSegments(page, [
    CUBE_VISIBLE[0] as readonly [Dot, Dot],
    CUBE_VISIBLE[1] as readonly [Dot, Dot],
    CUBE_VISIBLE[2] as readonly [Dot, Dot],
    CUBE_VISIBLE[3] as readonly [Dot, Dot],
  ]);
  await submit(page);
  await expectFailedWithHint(page, '앞면부터 그리고, 뒤로 가는 모서리를 이어 볼까요?', 1);
  await drawSegments(page, CUBE_VISIBLE.slice(4));
  await setLineStyle(page, 'dashed');
  await drawSegments(page, CUBE_HIDDEN);
  await submit(page);
  await expectPassed(page);

  // T7: 4 → 일반 ① → 3
  await typeNumberField(page, 'hidden', ['4']);
  await submit(page);
  await expectFailedWithHint(page, '점선은 무엇을 나타낼까요?', 1);
  await typeNumberField(page, 'hidden', ['3']);
  await submit(page);
  await expectPassed(page, true);
});

// ---------------------------------------------------------------- A2

test('g5s2u5.A2 — 전개도 7과제 흐름·오개념·fold-collision·fold-path', async ({
  page,
}, testInfo) => {
  test.slow();
  await openActivity(page, 'g5s2u5.A2', '전개도 그리기와 접기');
  const main = slot(page, 'main');
  const vp = testInfo.project.name;

  // T1 첫 화면 + 스냅샷
  await expectFirstScreen(page, FIT_A2_T1[vp] ?? 'fit', [
    main.getByTestId('net-grid'),
    main.getByTestId('net-fold-toggle'),
    main.getByTestId('net-clear'),
  ]);
  await screenshot(page, 'g5s2u5-a2.png');

  // T1: 한 줄 6칸 → 접기 → MC-NET-ANY-SIX ① → 다시 → ② fold-collision 정렬 → 십자 → 통과
  await drawFoldedNet(page, ROW6);
  await submit(page);
  await expectFailedWithHint(page, '접으면 어디가 겹칠지 먼저 상상해 볼까요?', 1);
  await submit(page);
  await expectFailedWithHint(page, '접었을 때 겹치는 곳과 빈 곳을 표시했어요.', 2);
  await expectOverlayAligned(main, 'fold-collision', 'net-grid');
  await expect(main.locator('[data-overlay="fold-collision"]')).toContainText('겹침');
  await clearNet(page);
  await drawFoldedNet(page, CROSS);
  await submit(page);
  await expectPassed(page);

  // T2: 한 줄 6칸 → MC ① → 십자·Z·계단 3가지 → 통과
  await drawFoldedNet(page, ROW6);
  await submit(page);
  await expectFailedWithHint(page, '접으면 어디가 겹칠지 먼저 상상해 볼까요?', 1);
  await clearNet(page);
  await drawFoldedNet(page, CROSS);
  await clearNet(page);
  await drawFoldedNet(page, Z_NET);
  await clearNet(page);
  await drawFoldedNet(page, STAIR_NET);
  await expect(main.getByTestId('net-log-panel')).toContainText('찾은 전개도 3가지');
  await submit(page);
  await expectPassed(page);

  // T3 첫 화면 + 예측 ㄱ(이웃) → 접기 → MC-NET-ADJACENT-AS-OPPOSITE ① → ② fold-path → ㄴ → 통과
  await expectFirstScreen(page, FIT_A2_T3[vp] ?? 'fit', [
    main.getByTestId('net-grid'),
    main.getByTestId('net-fold-toggle'),
  ]);
  await expect(main.getByTestId('net-fold-toggle')).toBeDisabled();
  await main.getByTestId('net-predict-ㄱ').click();
  await foldNet(page);
  await submit(page);
  await expectFailedWithHint(page, '★면과 붙어 있는 면이 마주 볼 수 있을까요?', 1);
  await submit(page);
  await expectFailedWithHint(page, '고른 면을 세워 보았어요.', 2);
  await expectOverlayAligned(main, 'fold-path', 'net-grid');
  await expect(main.locator('[data-overlay="fold-path"] [data-face-idx]')).toHaveCount(6);
  await main.getByTestId('net-fold-toggle').click(); // 펼치기
  await main.getByTestId('net-predict-ㄴ').click();
  await submit(page);
  await expectPassed(page);

  // T4: ㄴ(이웃) → MC ① → ② fold-path(접기 단추 없는 A 단계) → ㄹ → 통과
  await expect(main.getByTestId('net-fold-toggle')).toHaveCount(0);
  await main.getByTestId('net-predict-ㄴ').click();
  await submit(page);
  await expectFailedWithHint(page, '★면과 붙어 있는 면이 마주 볼 수 있을까요?', 1);
  await submit(page);
  await expectFailedWithHint(page, '고른 면을 세워 보았어요.', 2);
  await expectOverlayAligned(main, 'fold-path', 'net-grid');
  await main.getByTestId('net-predict-ㄹ').click();
  await submit(page);
  await expectPassed(page);

  // T5: ㄱ(이웃) → MC ① → ㄹ → 통과
  await expect(main.getByTestId('net-fold-toggle')).toHaveCount(0);
  await main.getByTestId('net-predict-ㄱ').click();
  await submit(page);
  await expectFailedWithHint(page, '★면과 붙어 있는 면이 마주 볼 수 있을까요?', 1);
  await main.getByTestId('net-predict-ㄹ').click();
  await submit(page);
  await expectPassed(page);

  // T6 첫 화면 + 잘못된 6면(왼쪽 날개 둘) → MC ① → 펼쳐서 옮기고 → 통과
  await expectFirstScreen(page, FIT_A2_T6[vp] ?? 'fit', [
    main.getByTestId('net-grid'),
    main.getByTestId('net-fold-toggle'),
    main.getByTestId('net-shape-4x2'),
  ]);
  await main.getByTestId('net-cell-2-0').click();
  await main.getByTestId('net-cell-2-5').click();
  await main.getByTestId('net-shape-4x2').click();
  await main.getByTestId('net-cell-2-3').click();
  await main.getByTestId('net-cell-2-8').click();
  await main.getByTestId('net-shape-3x2').click();
  await main.getByTestId('net-rotate-shape').click();
  await expect(main.getByTestId('net-shape-2x3')).toHaveAttribute('aria-pressed', 'true');
  await main.getByTestId('net-cell-0-0').click();
  await main.getByTestId('net-cell-0-5').click();
  await foldNet(page);
  await submit(page);
  await expectFailedWithHint(page, '접으면 어디가 겹칠지 먼저 상상해 볼까요?', 1);
  await main.getByTestId('net-fold-toggle').click(); // 펼치기
  await main.getByTestId('net-face-0-5').click(); // 빼기
  await main.getByTestId('net-cell-6-0').click();
  await foldNet(page);
  await submit(page);
  await expectPassed(page);

  // T7 첫 화면 + 가·겹침 → 일반 ① → 나·겹침 → 통과
  await expect(main.getByTestId('net-grid')).toHaveCount(0);
  const t7Cards = [
    main.getByTestId('net-card-ga'),
    main.getByTestId('net-card-na'),
    main.getByTestId('net-card-da'),
  ];
  if (vp === 'chromebook') {
    await expectNoPanelInnerScroll(page);
    for (const card of t7Cards) {
      await expect(card).toBeInViewport({ ratio: 1 });
    }
    await expect(field(page, 'pick')).toBeInViewport({ ratio: 1 });
    await expect(field(page, 'why')).toBeInViewport({ ratio: 1 });
    await expect(page.getByRole('button', { name: '확인하기' })).toBeInViewport({ ratio: 1 });
  } else {
    await expectFirstScreen(page, FIT_A2_T7[vp] ?? 'fit', [
      ...t7Cards,
      field(page, 'pick'),
      field(page, 'why'),
    ]);
  }
  await choose(page, 'pick', '가');
  await choose(page, 'why', '접으면 두 면이 겹쳐요');
  await submit(page);
  await expectFailedWithHint(page, '카드마다 한 면을 바닥으로 정하고 차례로 접어 볼까요?', 1);
  await choose(page, 'pick', '나');
  await submit(page);
  await expectPassed(page, true);
});

test('g5s2u5.A2 — 과제마다 대표 오답 일반 힌트 ①', async ({ page }) => {
  test.slow();
  await openActivity(page, 'g5s2u5.A2', '전개도 그리기와 접기');
  const main = slot(page, 'main');

  // T1: 5면 → 일반 ① → 6번째 면을 더해 십자
  await placeCells(page, CROSS.slice(0, 5));
  await submit(page);
  await expectFailedWithHint(page, '정육면체에는 면이 몇 개 있었나요?', 1);
  await placeCells(page, CROSS.slice(5));
  await foldNet(page);
  await submit(page);
  await expectPassed(page);

  // T2: 2가지만 찾고 확인 → 일반 ① → 계단 추가
  await drawFoldedNet(page, CROSS);
  await clearNet(page);
  await drawFoldedNet(page, Z_NET);
  await submit(page);
  await expectFailedWithHint(page, '찾은 전개도를 돌리거나 뒤집으면 같아지지 않나요?', 1);
  await clearNet(page);
  await drawFoldedNet(page, STAIR_NET);
  await submit(page);
  await expectPassed(page);

  // T3: 예측 없이 확인 → 일반 ① → ㄴ
  await submit(page);
  await expectFailedWithHint(page, '★면을 바닥에 놓으면 어느 면이 뚜껑이 될까요?', 1);
  await main.getByTestId('net-predict-ㄴ').click();
  await foldNet(page);
  await submit(page);
  await expectPassed(page);

  // T4: 예측 없이 확인 → 일반 ① → ㄹ
  await submit(page);
  await expectFailedWithHint(page, '★면 바로 옆 면들은 마주 볼 수 있을까요?', 1);
  await main.getByTestId('net-predict-ㄹ').click();
  await submit(page);
  await expectPassed(page);

  // T5: 예측 없이 확인 → 일반 ① → ㄹ
  await submit(page);
  await expectFailedWithHint(page, '★면 바로 옆 면들은 마주 볼 수 있을까요?', 1);
  await main.getByTestId('net-predict-ㄹ').click();
  await submit(page);
  await expectPassed(page);

  // T6: 4×3 한 장을 뺀 5면 → 일반 ① → 마저 놓고 접기
  await main.getByTestId('net-cell-2-0').click();
  await main.getByTestId('net-shape-4x2').click();
  await main.getByTestId('net-cell-2-3').click();
  await main.getByTestId('net-cell-2-8').click();
  await main.getByTestId('net-shape-3x2').click();
  await main.getByTestId('net-rotate-shape').click();
  await main.getByTestId('net-cell-0-0').click();
  await main.getByTestId('net-cell-6-0').click();
  await submit(page);
  await expectFailedWithHint(page, '마주 보는 두 면은 크기가 어떤가요?', 1);
  await main.getByTestId('net-shape-4x3').click();
  await main.getByTestId('net-cell-2-5').click();
  await foldNet(page);
  await submit(page);
  await expectPassed(page);

  // T7: 다·겹침 → 일반 ① → 나·겹침 대신 나·한 줄 → 일반 ① 계속 → 나·겹침
  await choose(page, 'pick', '다');
  await choose(page, 'why', '접으면 두 면이 겹쳐요');
  await submit(page);
  await expectFailedWithHint(page, '카드마다 한 면을 바닥으로 정하고 차례로 접어 볼까요?', 1);
  await choose(page, 'pick', '나');
  await choose(page, 'why', '면이 6개가 아니에요');
  await submit(page);
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByText('좋아요, 통과했어요!')).toHaveCount(0);
  await choose(page, 'why', '접으면 두 면이 겹쳐요');
  await submit(page);
  await expectPassed(page, true);
});

test('g5s2u5.A2 — 키보드만으로 십자를 그려 접는다', async ({ page }) => {
  await openActivity(page, 'g5s2u5.A2', '전개도 그리기와 접기');
  const grid = slot(page, 'main').getByTestId('net-grid');
  await grid.focus();
  await expect(grid).toBeFocused();

  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter'); // (1,0)
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('Enter'); // (0,1)
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter'); // (1,1)
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter'); // (2,1)
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter'); // (3,1)
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter'); // (1,2)
  await page.keyboard.press('f');
  await submit(page);
  await expectPassed(page);
});

test('오프라인에서도 g5s2u5.A1 활동이 열린다', async ({ page, context }) => {
  await page.goto(PREVIEW_URL);
  await page.getByRole('button', { name: '1번', exact: true }).click();
  await page.getByRole('button', { name: '건너뛰기' }).click();
  await expect(page).toHaveURL(/#\/map$/);
  await page.goto(`${PREVIEW_URL}/#/activity/g5s2u5.A1`);
  await expect(page.getByRole('heading', { name: '엑스레이 겨냥도' })).toBeVisible();

  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) {
      await new Promise<void>((resolve) =>
        navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), {
          once: true,
        }),
      );
    }
  });

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: '엑스레이 겨냥도' })).toBeVisible();
  await expect(page.getByRole('button', { name: '확인하기' })).toBeVisible();
});
