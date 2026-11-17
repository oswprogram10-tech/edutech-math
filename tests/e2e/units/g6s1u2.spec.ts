import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { PREVIEW_URL } from '../../../playwright.config';
import { expectContentPanelsReachable, expectNoPanelInnerScroll } from '../panel-layout';

/**
 * T144 g6s1u2 「각기둥과 각뿔」 9과제 단원 E2E.
 * - A1(E12 `prism-pyramid`)·A2(E12 `net-fold` `target:'prism'`) 흐름과 오개념 3코드 감지(3뷰포트)
 * - `prism-peek`(A1.T1)·`apex-gather`(A1.T2, 정렬 1px)·`stand-up`(A1.T6)·`prism-net-clash`(A2.T1) 오버레이
 * - A2.T2 given 전개도·A2.T3 카드 세 장의 valid(관찰) 확인
 * - 첫 화면 검사 + 활동별 스냅샷 + 오프라인
 */

test.describe.configure({ timeout: 300_000 });
test.use({ actionTimeout: 20_000 });

interface UnitTask {
  readonly id: string;
  readonly config: Record<string, unknown>;
}
interface UnitContent {
  readonly activities: readonly { readonly id: string; readonly tasks: readonly UnitTask[] }[];
}

const content = JSON.parse(
  readFileSync(new URL('../../../data/content/g6s1u2.json', import.meta.url), 'utf-8'),
) as UnitContent;

function taskConfig(taskId: string): Record<string, unknown> {
  for (const activity of content.activities) {
    const found = activity.tasks.find((t) => t.id === taskId);
    if (found) return found.config;
  }
  throw new Error(`과제 ${taskId}를 찾지 못했다.`);
}

// 첫 화면 기준(뷰포트별): 판이 '확인하기'까지 한 화면에 다 들어오면 'fit', 아니면 'reachable'.
const FIT_A1_T1: Record<string, 'fit' | 'reachable'> = {};
const FIT_A2_T1: Record<string, 'fit' | 'reachable'> = {};
// T145: 카드가 3장 이하이면 판 폭에 맞춰 한 줄에 놓이므로 크롬북도 카드 세 장이 첫 화면에 다 들어온다.
const FIT_A2_T3: Record<string, 'fit' | 'reachable'> = {};

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
      // 0.1px 안팎의 서브픽셀 오차(IntersectionObserver)를 허용한다. 잘림은 0.99 미만으로 드러난다.
      await expect(loc).toBeInViewport({ ratio: 0.99 });
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

/** 밑면의 변 수를 n으로 맞춘다(처음 3, `]` 키). */
async function setSides(page: Page, n: number): Promise<void> {
  const main = slot(page, 'main');
  await main.getByTestId('prism-extrude').focus();
  for (let i = 3; i < n; i += 1) await page.keyboard.press(']');
}

/** 밀어 올리기 손잡이로 높이를 두 칸 올린다(키보드). */
async function liftTwo(page: Page): Promise<void> {
  await slot(page, 'main').getByTestId('prism-extrude').focus();
  await page.keyboard.press('PageUp');
  await page.keyboard.press('PageUp');
}

async function addRow(page: Page, index: number): Promise<void> {
  const main = slot(page, 'main');
  await main.getByTestId('prism-table-add').click();
  await expect(main.getByTestId(`prism-row-${index}`)).toBeVisible();
}

async function fillRow(
  page: Page,
  index: number,
  values: readonly [string, string, string],
): Promise<void> {
  const main = slot(page, 'main');
  await main.getByTestId(`prism-cell-${index}-faces`).fill(values[0]);
  await main.getByTestId(`prism-cell-${index}-edges`).fill(values[1]);
  await main.getByTestId(`prism-cell-${index}-vertices`).fill(values[2]);
}

async function buildPrism(page: Page, n: number): Promise<void> {
  await setSides(page, n);
  await liftTwo(page);
  await expect(slot(page, 'main').getByTestId('prism-name')).not.toHaveText(/각뿔/);
}

async function buildPyramid(page: Page, n: number): Promise<void> {
  await setSides(page, n);
  await liftTwo(page);
  await slot(page, 'main').getByTestId('prism-apex').click();
  await expect(slot(page, 'main').getByTestId('prism-name')).toContainText('각뿔');
}

/**
 * 면이 보일 때까지 무대를 돌리고, 다른 요소에 가려지지 않는 점을 눌러 표시한다.
 * 숨은 면은 눌리지 않으므로 학생도 돌려서 보이게 한 뒤 누른다.
 */
async function markFaceByTurning(page: Page, face: string): Promise<void> {
  const main = slot(page, 'main');
  const el = main.getByTestId(`prism-face-${face}`);
  for (let i = 0; i < 24; i += 1) {
    if ((await el.count()) > 0 && (await el.getAttribute('data-hidden')) === 'false') break;
    await main.getByTestId('prism-turn-right').click();
  }
  await expect(el).toHaveAttribute('data-hidden', 'false');
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
      if (hit && hit.closest(`[data-testid="prism-face-${id}"]`)) return { x: sx, y: sy };
    }
    return null;
  }, face);
  expect(point, `${face} 면에 가려지지 않는 자리가 있어야 한다`).not.toBeNull();
  if (point) await page.mouse.click(point.x, point.y);
  await expect(el).toHaveAttribute('data-marked', 'true');
}

// ---------------------------------------------------------------- A2 도우미

/** 삼각기둥: 옆면 띠 3장 → 아래 밑면(옆면 0의 아래) → 위 밑면(옆면 2의 위). */
async function buildTriPrismNet(
  page: Page,
  topOn: { piece: number; edge: number } = { piece: 2, edge: 2 },
  bottomOn: { piece: number; edge: number } = { piece: 0, edge: 0 },
): Promise<void> {
  const main = slot(page, 'main');
  await main.getByTestId('prismnet-type-rect').click();
  await main.getByTestId('prismnet-root-handle').click();
  await main.getByTestId('prismnet-handle-0-1').click();
  await main.getByTestId('prismnet-handle-1-1').click();
  await main.getByTestId('prismnet-type-base').click();
  await main.getByTestId(`prismnet-handle-${bottomOn.piece}-${bottomOn.edge}`).click();
  await main.getByTestId(`prismnet-handle-${topOn.piece}-${topOn.edge}`).click();
}

async function foldPrismNet(page: Page): Promise<void> {
  await slot(page, 'main').getByTestId('prismnet-fold').click();
  await expect(slot(page, 'main').getByTestId('prismnet-fold-status')).toBeVisible();
}

// ---------------------------------------------------------------- 샌드박스(관찰 확인)

interface NetObservation {
  readonly evaluation?: { readonly valid: boolean };
  readonly cards?: readonly { readonly id: string; readonly valid: boolean }[];
  readonly [key: string]: unknown;
}

async function readNetObservation(page: Page): Promise<NetObservation> {
  const text = await page.getByTestId('observation').textContent();
  return JSON.parse(text ?? '{}') as NetObservation;
}

async function openNetSandbox(page: Page, config: Record<string, unknown>): Promise<void> {
  await page.goto(`/?config=${encodeURIComponent(JSON.stringify(config))}#/sandbox/E12`);
  await expect(page.getByRole('heading', { name: '3D 입체' })).toBeVisible();
  await page.getByLabel('모드').selectOption('net-fold');
  await expect(page.getByTestId('prismnet-view')).toBeVisible();
}

// ---------------------------------------------------------------- A1

test('g6s1u2.A1 — 수직 엘리베이터와 한 점 모으기 6과제 흐름·오개념·apex-gather 정렬', async ({
  page,
}, testInfo) => {
  test.slow();
  await openActivity(page, 'g6s1u2.A1', '수직 엘리베이터와 한 점 모으기');
  const main = slot(page, 'main');
  const vp = testInfo.project.name;

  // T1 첫 화면 + 스냅샷
  await expect(main.getByTestId('prism-stage')).toBeVisible();
  await expectFirstScreen(page, FIT_A1_T1[vp] ?? 'fit', [
    main.getByTestId('prism-stage'),
    main.getByTestId('prism-extrude'),
    main.getByTestId('prism-apex'),
    main.getByTestId('prism-sides-dec'),
    main.getByTestId('prism-sides-inc'),
    main.getByTestId('prism-table-add'),
  ]);
  await screenshot(page, 'g6s1u2-a1.png');

  // T1: 오각기둥 → 표 7·10·10 → MC-3D-HIDDEN-UNCOUNTED ① → 7·15·10 통과
  await buildPrism(page, 5);
  await expect(main.getByTestId('prism-name')).toHaveText('오각기둥');
  await addRow(page, 0);
  await fillRow(page, 0, ['7', '10', '10']);
  await submit(page);
  await expectFailedWithHint(page, '뒤쪽으로 돌려 보면 보이지 않던 모서리와 꼭짓점이 있을까요?', 1);
  await submit(page);
  await expectFailedWithHint(page, '숨어 있는 모서리와 꼭짓점을 비춰 보았어요.', 2);
  await expectOverlayAligned(main, 'prism-peek', 'prism-stage');
  await main.getByTestId('prism-cell-0-edges').fill('15');
  await submit(page);
  await expectPassed(page);

  // T2: 육각뿔 → 7·12·12 → MC-PYRAMID-AS-PRISM-COUNT ① → 다시 → ② + apex-gather 정렬 → 7·12·7 통과
  await buildPyramid(page, 6);
  await expect(main.getByTestId('prism-name')).toHaveText('육각뿔');
  await addRow(page, 0);
  await fillRow(page, 0, ['7', '12', '12']);
  await submit(page);
  await expectFailedWithHint(page, '꼭대기에 꼭짓점이 몇 개 모였을까요?', 1);
  await submit(page);
  await expectFailedWithHint(page, '윗면의 꼭짓점들이 한 점으로 모이는 모습을 그려 보았어요.', 2);
  await expectOverlayAligned(main, 'apex-gather', 'prism-stage');
  await main.getByTestId('prism-cell-0-vertices').fill('7');
  await submit(page);
  await expectPassed(page);

  // T3: 삼각기둥만 적고 2 → 불통과 → 사각기둥도 적고 3 → 불통과 → 2 통과
  await setSides(page, 3);
  await liftTwo(page);
  await addRow(page, 0);
  await fillRow(page, 0, ['5', '9', '6']);
  await typeNumberField(page, 'times', ['2']);
  await submit(page);
  await expectFailedWithHint(
    page,
    '표에서 밑면의 변의 수와 꼭짓점 수를 나란히 보면 어떤 관계가 있을까요?',
    1,
  );
  await main.getByTestId('prism-sides-inc').click();
  await addRow(page, 1);
  await fillRow(page, 1, ['6', '12', '8']);
  await typeNumberField(page, 'times', ['3']);
  await submit(page);
  await expectFailedWithHint(page, '밑면의 변의 수를 하나씩 바꾸며', 2);
  await typeNumberField(page, 'times', ['2']);
  await submit(page);
  await expectPassed(page);

  // T4: 그림 없이 — 20 → 일반 ① → 30 통과
  await expect(main.getByTestId('prism-stage')).toHaveCount(0);
  await typeNumberField(page, 'edges', ['2', '0']);
  await submit(page);
  await expectFailedWithHint(page, '밑면, 윗면, 옆에 있는 모서리를 나누어 생각해 볼까요?', 1);
  await typeNumberField(page, 'edges', ['3', '0']);
  await submit(page);
  await expectPassed(page);

  // T5: 육각뿔 → MC-PYRAMID-AS-PRISM-COUNT ① → 구각뿔 통과
  await choose(page, 'name', '육각뿔');
  await submit(page);
  await expectFailedWithHint(page, '각뿔의 모서리는 밑면에 몇 개, 옆에 몇 개 있을까요?', 1);
  await choose(page, 'name', '구각뿔');
  await submit(page);
  await expectPassed(page);

  // T6: 눕힌 삼각기둥 — 옆면 두 개 → MC-PRISM-BASE-ORIENTATION ① → 다시 → ② + stand-up → 밑면 두 개 통과
  await expect(main.getByTestId('prism-stage')).toHaveAttribute('data-orientation', 'lying');
  await expect(main.getByTestId('prism-table')).toHaveCount(0);
  await expect(main.getByTestId('prism-extrude')).toHaveCount(0);
  await main.getByTestId('prism-face-s0').click();
  await main.getByTestId('prism-face-s1').click();
  await submit(page);
  await expectFailedWithHint(page, '서로 평행하고 모양과 크기가 같은 두 면은 어디일까요?', 1);
  await submit(page);
  await expectFailedWithHint(page, '같은 각기둥을 세워 놓은 모습을 옆에 그려 보았어요.', 2);
  await expectOverlayAligned(main, 'stand-up', 'prism-stage');
  await main.getByTestId('prism-clear-marks').click();
  await markFaceByTurning(page, 'bottom');
  await markFaceByTurning(page, 'top');
  await submit(page);
  await expectPassed(page, true);
});

test('g6s1u2.A1 — 과제마다 대표 오답은 일반 힌트 ①이 뜬다', async ({ page }) => {
  test.slow();
  await openActivity(page, 'g6s1u2.A1', '수직 엘리베이터와 한 점 모으기');
  const main = slot(page, 'main');

  // T1: 면 수만 틀린 표
  await buildPrism(page, 5);
  await addRow(page, 0);
  await fillRow(page, 0, ['6', '15', '10']);
  await submit(page);
  await expectFailedWithHint(page, '표시한 것과 아직 표시하지 않은 것을 나누어 세어 볼까요?', 1);
  await main.getByTestId('prism-cell-0-faces').fill('7');
  await submit(page);
  await expectPassed(page);

  // T2: 모서리 수가 틀린 표(꼭짓점 12는 아님)
  await buildPyramid(page, 6);
  await addRow(page, 0);
  await fillRow(page, 0, ['7', '10', '7']);
  await submit(page);
  await expectFailedWithHint(page, '밑면에 있는 것과 옆에 있는 것을 나누어 세어 볼까요?', 1);
  await main.getByTestId('prism-cell-0-edges').fill('12');
  await submit(page);
  await expectPassed(page);

  // T3: 두 줄을 맞게 적고 3배
  await setSides(page, 3);
  await liftTwo(page);
  await addRow(page, 0);
  await fillRow(page, 0, ['5', '9', '6']);
  await main.getByTestId('prism-sides-inc').click();
  await addRow(page, 1);
  await fillRow(page, 1, ['6', '12', '8']);
  await typeNumberField(page, 'times', ['3']);
  await submit(page);
  await expectFailedWithHint(
    page,
    '표에서 밑면의 변의 수와 꼭짓점 수를 나란히 보면 어떤 관계가 있을까요?',
    1,
  );
  await typeNumberField(page, 'times', ['2']);
  await submit(page);
  await expectPassed(page);

  // T4: 20 → 30
  await typeNumberField(page, 'edges', ['2', '0']);
  await submit(page);
  await expectFailedWithHint(page, '밑면, 윗면, 옆에 있는 모서리를 나누어 생각해 볼까요?', 1);
  await typeNumberField(page, 'edges', ['3', '0']);
  await submit(page);
  await expectPassed(page);

  // T5: 십팔각뿔 → 구각뿔
  await choose(page, 'name', '십팔각뿔');
  await submit(page);
  await expectFailedWithHint(page, '고른 각뿔의 모서리를 세어 18개가 되는지 확인해 볼까요?', 1);
  await choose(page, 'name', '구각뿔');
  await submit(page);
  await expectPassed(page);

  // T6: 아무것도 표시하지 않고 확인 → 일반 ① → 밑면 두 개
  await submit(page);
  await expectFailedWithHint(
    page,
    '두 면을 골라 표시했나요? 고른 두 면이 서로 마주 보는지 볼까요?',
    1,
  );
  await markFaceByTurning(page, 'bottom');
  await markFaceByTurning(page, 'top');
  await submit(page);
  await expectPassed(page, true);
});

test('g6s1u2.A1 — 키보드만으로 오각기둥을 만들어 표에 적는다', async ({ page }) => {
  await openActivity(page, 'g6s1u2.A1', '수직 엘리베이터와 한 점 모으기');
  const main = slot(page, 'main');
  await main.getByTestId('prism-extrude').focus();
  await page.keyboard.press(']');
  await page.keyboard.press(']');
  await page.keyboard.press('PageUp');
  await page.keyboard.press('PageUp');
  await expect(main.getByTestId('prism-name')).toHaveText('오각기둥');
  await main.getByTestId('prism-table-add').focus();
  await page.keyboard.press('Enter');
  await expect(main.getByTestId('prism-row-0')).toBeVisible();
  await main.getByTestId('prism-cell-0-faces').focus();
  await page.keyboard.type('7');
  await page.keyboard.press('Tab');
  await page.keyboard.type('15');
  await page.keyboard.press('Tab');
  await page.keyboard.type('10');
  await page.getByRole('button', { name: '확인하기' }).focus();
  await page.keyboard.press('Enter');
  await expectPassed(page);
});

// ---------------------------------------------------------------- A2

test('g6s1u2.A2 — 각기둥 전개도 3과제 흐름·상태 힌트·prism-net-clash', async ({
  page,
}, testInfo) => {
  test.slow();
  await openActivity(page, 'g6s1u2.A2', '각기둥 전개도');
  const main = slot(page, 'main');
  const vp = testInfo.project.name;

  // T1 첫 화면 + 스냅샷
  await expect(main.getByTestId('prismnet-board')).toBeVisible();
  await expectFirstScreen(page, FIT_A2_T1[vp] ?? 'fit', [
    main.getByTestId('prismnet-board'),
    main.getByTestId('prismnet-type-base'),
    main.getByTestId('prismnet-type-rect'),
    main.getByTestId('prismnet-fold'),
  ]);
  await screenshot(page, 'g6s1u2-a2.png');

  // T1: 두 밑면을 모두 위 변에 붙여 접고 확인 → 상태 ① → 다시 → ② + prism-net-clash → 지우고 아래·위로 붙여 통과
  await buildTriPrismNet(page, { piece: 2, edge: 2 }, { piece: 0, edge: 2 });
  await foldPrismNet(page);
  await expect(main.getByTestId('prismnet-fold-status')).toHaveText('접히지 않아요');
  await submit(page);
  await expectFailedWithHint(page, '접었을 때 두 밑면은 각기둥의 어디에 놓일까요?', 1);
  await submit(page);
  await expectFailedWithHint(page, '접으면 같은 자리로 가는 조각에 같은 무늬를 칠해 보았어요.', 2);
  await expectOverlayAligned(main, 'prism-net-clash', 'prismnet-board');
  await main.getByTestId('prismnet-clear').click();
  await buildTriPrismNet(page);
  await foldPrismNet(page);
  await expect(main.getByTestId('prismnet-folded-stage')).toBeVisible();
  await submit(page);
  await expectPassed(page);

  // T2: 10·짧아요 → 일반 ① → 10·같아요 통과(접어 볼 수 있다)
  await expect(main.getByTestId('prismnet-board')).toBeVisible();
  await expect(main.getByTestId('prismnet-handle-0-1')).toHaveCount(0);
  await foldPrismNet(page);
  await expect(main.getByTestId('prismnet-folded-stage')).toBeVisible();
  await typeNumberField(page, 'width', ['1', '0']);
  await choose(page, 'cmp', '밑면의 둘레보다 짧아요');
  await submit(page);
  await expectFailedWithHint(
    page,
    '옆면 직사각형의 가로 변은 접었을 때 밑면의 어느 변과 맞닿을까요?',
    1,
  );
  await choose(page, 'cmp', '밑면의 둘레와 같아요');
  await submit(page);
  await expectPassed(page);

  // T3: 카드 3장 — 가 → 일반 ① → 나 통과
  await expect(main.getByTestId('prismnet-board')).toHaveCount(0);
  for (const id of ['ga', 'na', 'da']) {
    await expect(main.getByTestId(`prismnet-card-${id}`)).toBeVisible();
  }
  await expectFirstScreen(
    page,
    FIT_A2_T3[vp] ?? 'fit',
    ['ga', 'na', 'da'].map((id) => main.getByTestId(`prismnet-card-${id}`)),
  );
  await choose(page, 'pick', '가');
  await submit(page);
  await expectFailedWithHint(
    page,
    '카드마다 머릿속으로 접어 보며 겹치거나 빈 곳이 생기는지 살펴볼까요?',
    1,
  );
  await choose(page, 'pick', '나');
  await submit(page);
  await expectPassed(page, true);
});

test('g6s1u2.A2 — 과제마다 대표 오답은 일반 힌트 ①이 뜬다', async ({ page }) => {
  test.slow();
  await openActivity(page, 'g6s1u2.A2', '각기둥 전개도');
  const main = slot(page, 'main');

  // T1: 옆면 띠만 만들고 확인(밑면 없음)
  await main.getByTestId('prismnet-type-rect').click();
  await main.getByTestId('prismnet-root-handle').click();
  await main.getByTestId('prismnet-handle-0-1').click();
  await main.getByTestId('prismnet-handle-1-1').click();
  await foldPrismNet(page);
  await submit(page);
  await expectFailedWithHint(
    page,
    '조각이 모두 붙었나요? 접었을 때 빈 곳이나 겹치는 곳이 있는지 볼까요?',
    1,
  );
  await main.getByTestId('prismnet-clear').click();
  await buildTriPrismNet(page);
  await foldPrismNet(page);
  await submit(page);
  await expectPassed(page);

  // T2: 가로의 합은 맞고 비교가 틀림
  await typeNumberField(page, 'width', ['1', '0']);
  await choose(page, 'cmp', '밑면의 둘레보다 길어요');
  await submit(page);
  await expectFailedWithHint(
    page,
    '옆면 직사각형의 가로 변은 접었을 때 밑면의 어느 변과 맞닿을까요?',
    1,
  );
  await typeNumberField(page, 'width', ['1', '0']);
  await choose(page, 'cmp', '밑면의 둘레와 같아요');
  await submit(page);
  await expectPassed(page);

  // T3: 다 → 나
  await choose(page, 'pick', '다');
  await submit(page);
  await expectFailedWithHint(
    page,
    '카드마다 머릿속으로 접어 보며 겹치거나 빈 곳이 생기는지 살펴볼까요?',
    1,
  );
  await choose(page, 'pick', '나');
  await submit(page);
  await expectPassed(page, true);
});

test('g6s1u2.A2 — T2 전개도는 valid이고 T3 카드는 가·다만 valid다(관찰 확인)', async ({ page }) => {
  await openNetSandbox(page, taskConfig('g6s1u2.A2.T2'));
  await expect.poll(async () => (await readNetObservation(page)).evaluation?.valid).toBe(true);

  await openNetSandbox(page, taskConfig('g6s1u2.A2.T3'));
  await expect
    .poll(async () => JSON.stringify((await readNetObservation(page)).cards))
    .toBe(
      JSON.stringify([
        { id: 'ga', valid: true },
        { id: 'na', valid: false },
        { id: 'da', valid: true },
      ]),
    );
});

test('오프라인에서도 g6s1u2.A1 활동이 열린다', async ({ page, context }) => {
  await page.goto(PREVIEW_URL);
  await page.getByRole('button', { name: '1번', exact: true }).click();
  await page.getByRole('button', { name: '건너뛰기' }).click();
  await expect(page).toHaveURL(/#\/map$/);
  await page.goto(`${PREVIEW_URL}/#/activity/g6s1u2.A1`);
  await expect(page.getByRole('heading', { name: '수직 엘리베이터와 한 점 모으기' })).toBeVisible();

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
  await expect(page.getByRole('heading', { name: '수직 엘리베이터와 한 점 모으기' })).toBeVisible();
  await expect(page.getByRole('button', { name: '확인하기' })).toBeVisible();
});
