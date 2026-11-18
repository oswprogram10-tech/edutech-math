import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { PREVIEW_URL } from '../../../playwright.config';
import { expectContentPanelsReachable, expectNoPanelInnerScroll } from '../panel-layout';

/**
 * T152 g6s2u6 「원기둥, 원뿔, 구」 12과제 단원 E2E.
 * - A1(E12 `lathe` 7과제)·A2(E12 `net-fold` `target:"cylinder"` 5과제) 흐름과 오개념 3코드 감지(3뷰포트)
 * - `axis-compare`(A1.T2)·`n-grow`(A1.T7)·`roll-match`(A2.T1·T2 굴리기 무대, A2.T3 전개도 판) 오버레이
 * - 첫 화면 검사 + 활동별 스냅샷 + 오프라인
 * - 학생 화면에는 입체·단면 이름과 원주 값(12.56·18.84)이 보이지 않는다.
 * 굴리기·돌리기 연출은 움직임 줄이기를 켜면 바로 끝 위치로 간다(측정·스냅샷은 그 상태에서).
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
  readFileSync(new URL('../../../data/content/g6s2u6.json', import.meta.url), 'utf-8'),
) as UnitContent;

function cfg(id: string): Record<string, unknown> {
  for (const activity of content.activities) {
    const found = activity.tasks.find((t) => t.id === id);
    if (found) return found.config;
  }
  throw new Error(`과제 ${id}를 찾지 못했다.`);
}

test('콘텐츠 설정이 명세의 치수·단면 조건을 따른다', () => {
  expect(content.activities.map((a) => a.tasks.length)).toEqual([7, 5]);
  expect(cfg('g6s2u6.A1.T4')['preset']).toEqual({
    profile: 'right-triangle',
    edge: 'leg-vertical',
  });
  expect(cfg('g6s2u6.A1.T5')['preset']).toEqual({ profile: 'rectangle', edge: 'long' });
  expect(cfg('g6s2u6.A1.T6')['showSection']).toBe(false);
  expect(cfg('g6s2u6.A2.T2')).toMatchObject({ radius: 2, height: 5, pi: '3.14' });
  expect(cfg('g6s2u6.A2.T5')).toMatchObject({ radius: 3, height: 7, pi: '3.14', steps: [] });
});

// 첫 화면 기준(뷰포트별): 판이 '확인하기'까지 한 화면에 다 들어오면 'fit', 아니면 'reachable'.
// 과제마다 따로 적는다(없으면 'fit').
type Criterion = 'fit' | 'reachable';
const FIRST_SCREEN: Record<string, Record<string, Criterion>> = {
  'A1.T4': { ipad: 'reachable', chromebook: 'reachable' },
  'A1.T5': { ipad: 'reachable', chromebook: 'reachable' },
  'A1.T6': { ipad: 'reachable', chromebook: 'reachable' },
  'A2.T1': { chromebook: 'reachable', board: 'reachable' },
  'A2.T2': { ipad: 'reachable', chromebook: 'reachable', board: 'reachable' },
  'A2.T4': { ipad: 'reachable', chromebook: 'reachable' },
  'A2.T5': { ipad: 'reachable' },
};

function slot(page: Page, name: string): Locator {
  return page.getByTestId(`runner-slot-${name}`);
}

function field(page: Page, id: string): Locator {
  return slot(page, 'response').locator(`[data-response-field="${id}"]`);
}

async function openActivity(page: Page, activityId: string, heading: string): Promise<void> {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.getByRole('button', { name: '1번', exact: true }).click();
  await page.getByRole('button', { name: '건너뛰기' }).click();
  await expect(page).toHaveURL(/#\/map$/);
  await page.goto(`/#/activity/${activityId}`);
  await expect(page.getByRole('heading', { name: heading })).toBeVisible();
  await expect(page.getByRole('button', { name: '확인하기' })).toBeVisible();
}

const openA1 = (page: Page) => openActivity(page, 'g6s2u6.A1', '회전 물레와 레이저 단면');
const openA2 = (page: Page) => openActivity(page, 'g6s2u6.A2', '원기둥 굴려 옆면 펼치기');

async function choose(page: Page, id: string, label: string): Promise<void> {
  await field(page, id).getByRole('button', { name: label, exact: true }).click();
}

/**
 * 수 칸에 값을 넣는다. 소수점이 있으면 소수 틀, 없으면 자연수 틀로 바꿔서 넣는다
 * (소수 틀은 `4`처럼 소수점이 없는 값을 받지 않는다).
 */
async function typeNumber(page: Page, id: string, value: string): Promise<void> {
  const box = field(page, id);
  const decimal = value.includes('.');
  await box.getByRole('button', { name: decimal ? '소수' : '자연수', exact: true }).click();
  const part = box.locator(`[data-part="${decimal ? 'decimal' : 'whole'}"]`);
  await part.click();
  for (let i = 0; i < 9; i += 1) await page.keyboard.press('Backspace');
  for (const key of value) await page.keyboard.press(key);
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

async function maxDiff(overlay: Locator, canvas: Locator): Promise<number> {
  const overlayBox = await overlay.locator('svg').first().boundingBox();
  const canvasBox = await canvas.boundingBox();
  if (!overlayBox || !canvasBox) return Number.POSITIVE_INFINITY;
  return Math.max(
    Math.abs(overlayBox.x - canvasBox.x),
    Math.abs(overlayBox.y - canvasBox.y),
    Math.abs(overlayBox.width - canvasBox.width),
    Math.abs(overlayBox.height - canvasBox.height),
  );
}

/** 오버레이 svg 상자가 엔진 본 그림 svg 상자와 1px 이내로 겹치는지 본다. */
async function expectOverlayAligned(
  panel: Locator,
  overlayName: string,
  canvasTestId: string,
): Promise<void> {
  const overlay = panel.locator(`[data-overlay="${overlayName}"]`);
  await expect(overlay).toBeVisible();
  const canvas = panel.getByTestId(canvasTestId);
  await expect.poll(() => maxDiff(overlay, canvas)).toBeLessThanOrEqual(1);
  await expect(overlay.locator('svg')).toHaveCount(1);
}

async function expectFirstScreen(
  page: Page,
  mode: Criterion,
  fitLocators: readonly Locator[] = [],
  reachableLocators: readonly Locator[] = fitLocators,
): Promise<void> {
  // 앞 과제에서 내려간 스크롤을 처음으로 돌려 놓고 잰다.
  await page.evaluate(() => {
    window.scrollTo(0, 0);
    document.querySelector('main')?.scrollTo(0, 0);
  });
  await expectNoPanelInnerScroll(page);
  if (mode === 'fit') {
    for (const loc of fitLocators) {
      // 0.1px 안팎의 서브픽셀 오차(IntersectionObserver)를 허용한다. 잘림은 0.99 미만으로 드러난다.
      await expect(loc).toBeInViewport({ ratio: 0.99 });
    }
    await expect(page.getByRole('button', { name: '확인하기' })).toBeInViewport({ ratio: 1 });
    return;
  }
  await expectContentPanelsReachable(page);
  for (const loc of reachableLocators) {
    await loc.scrollIntoViewIfNeeded();
    await expect(loc).toBeInViewport({ ratio: 0.99 });
  }
}

/** 학생 화면(교구 판)에 입체·단면 이름이 보이지 않는지 확인한다. */
async function expectNoSolidNames(page: Page): Promise<void> {
  const text = (await slot(page, 'main').textContent()) ?? '';
  expect(text).not.toMatch(/원기둥|원뿔|팽이|이등변|직사각형|삼각형|반원/);
}

/** 학생 화면(판 전체)에 원주 값이 보이지 않는지 확인한다. */
async function expectNoResultValues(page: Page, values: readonly string[]): Promise<void> {
  const text = (await slot(page, 'main').textContent()) ?? '';
  for (const v of values) {
    expect(text, `판 글자에 ${v}가 없어야 한다`).not.toMatch(
      new RegExp(`(^|\\D)${v.replace('.', '\\.')}(\\D|$)`),
    );
  }
}

async function press(page: Page, key: string, times = 1): Promise<void> {
  for (let i = 0; i < times; i += 1) await page.keyboard.press(key);
}

// ---------------------------------------------------------------- A1(lathe) 도우미

function lt(page: Page, id: string): Locator {
  return slot(page, 'main').getByTestId(id);
}

/** 도형 카드를 고르고 변을 붙인 뒤(선택) 한 바퀴 돌린다. */
async function build(page: Page, profile: string, edge: string, spin = true): Promise<void> {
  await lt(page, `lt-profile-${profile}`).click();
  await lt(page, `lt-edge-${edge}`).click();
  if (spin) {
    await lt(page, 'lt-spin').click();
    await expect(lt(page, 'lt-stage')).toHaveAttribute('data-complete', 'true');
  }
}

async function passA1T1(page: Page): Promise<void> {
  await build(page, 'rectangle', 'long');
  await submit(page);
  await expectPassed(page);
}
async function passA1T2(page: Page): Promise<void> {
  await build(page, 'right-triangle', 'leg-vertical');
  await submit(page);
  await expectPassed(page);
}
async function passA1T3(page: Page): Promise<void> {
  await build(page, 'semicircle', 'diameter');
  await submit(page);
  await expectPassed(page);
}
async function passA1T4(page: Page, chosen = false): Promise<void> {
  await lt(page, 'lt-laser-h').click();
  // 고르기 칸은 같은 보기를 다시 누르면 선택이 풀린다.
  if (!chosen) await choose(page, 'sec', '원');
  await submit(page);
  await expectPassed(page);
}
async function passA1T5(page: Page): Promise<void> {
  await lt(page, 'lt-laser-v').click();
  await choose(page, 'sec', '직사각형');
  await submit(page);
  await expectPassed(page);
}
async function passA1T6(page: Page): Promise<void> {
  await choose(page, 'sec', '원');
  await submit(page);
  await expectPassed(page);
}

// ---------------------------------------------------------------- A1

test('g6s2u6.A1 — 회전 물레와 레이저 단면 7과제 흐름·오개념·axis-compare·n-grow', async ({
  page,
}, testInfo) => {
  test.slow();
  await openA1(page);
  const main = slot(page, 'main');
  const vp = testInfo.project.name;

  // T1 첫 화면 + 스냅샷
  await expect(lt(page, 'lt-stage')).toBeVisible();
  await expectFirstScreen(page, FIRST_SCREEN['A1.T1']?.[vp] ?? 'fit', [
    lt(page, 'lt-stage'),
    lt(page, 'lt-profile-rectangle'),
    lt(page, 'lt-profile-semicircle'),
  ]);
  await expectNoSolidNames(page);
  await screenshot(page, 'g6s2u6-a1.png');

  // T1: 반원을 돌림 → 상태 ① → 직사각형을 돌림 통과
  await build(page, 'semicircle', 'diameter');
  await submit(page);
  await expectFailedWithHint(
    page,
    '만든 입체의 옆면은 어떤 모양인가요? 다른 도형으로도 돌려 볼까요?',
    1,
  );
  await build(page, 'rectangle', 'long');
  await submit(page);
  await expectPassed(page);

  // T2: 빗변 → MC-REVOLVE-AXIS-WRONG ① → 다시 → ② axis-compare(그려짐·정렬 1px) → 높이 변 통과
  await build(page, 'right-triangle', 'hypotenuse');
  await submit(page);
  await expectFailedWithHint(page, '축은 어느 변에 붙여야 꼭짓점이 하나로 모일까요?', 1);
  await submit(page);
  await expectFailedWithHint(page, '붙인 변에 따라 돌린 모습이 어떻게 다른지 비교해 봐요.', 2);
  await expectOverlayAligned(main, 'axis-compare', 'lt-stage');
  const ac = main.locator('[data-overlay="axis-compare"]');
  await expect(ac.getByTestId('axis-compare-hypotenuse')).toBeVisible();
  await expect(ac.getByTestId('axis-compare-leg')).toBeVisible();
  await build(page, 'right-triangle', 'leg-vertical');
  await submit(page);
  await expectPassed(page);

  // T3: 반원 통과
  await build(page, 'semicircle', 'diameter');
  await submit(page);
  await expectPassed(page);

  await expectFirstScreen(
    page,
    FIRST_SCREEN['A1.T4']?.[vp] ?? 'fit',
    [
      lt(page, 'lt-stage'),
      lt(page, 'lt-laser-h'),
      lt(page, 'lt-laser-v'),
      lt(page, 'lt-laser-t'),
      lt(page, 'lt-section'),
      field(page, 'sec').getByRole('button', { name: '원', exact: true }),
      field(page, 'sec').getByRole('button', { name: '점', exact: true }),
    ],
    [
      lt(page, 'lt-stage'),
      field(page, 'sec').getByRole('button', { name: '원', exact: true }),
      field(page, 'sec').getByRole('button', { name: '점', exact: true }),
    ],
  );
  // T4: 가로로 자르고 원 통과
  await expect(lt(page, 'lt-section')).toBeVisible();
  await passA1T4(page);

  await expectFirstScreen(
    page,
    FIRST_SCREEN['A1.T5']?.[vp] ?? 'fit',
    [
      lt(page, 'lt-stage'),
      lt(page, 'lt-laser-h'),
      lt(page, 'lt-laser-v'),
      lt(page, 'lt-laser-t'),
      lt(page, 'lt-section'),
      field(page, 'sec').getByRole('button', { name: '원', exact: true }),
      field(page, 'sec').getByRole('button', { name: '점', exact: true }),
    ],
    [
      lt(page, 'lt-stage'),
      field(page, 'sec').getByRole('button', { name: '원', exact: true }),
      field(page, 'sec').getByRole('button', { name: '점', exact: true }),
    ],
  );
  // T5: 세로로 자르고 직사각형 통과
  await passA1T5(page);

  await expectFirstScreen(
    page,
    FIRST_SCREEN['A1.T6']?.[vp] ?? 'fit',
    [
      lt(page, 'lt-stage'),
      lt(page, 'lt-laser-h'),
      lt(page, 'lt-laser-v'),
      lt(page, 'lt-laser-t'),
      lt(page, 'lt-section'),
      field(page, 'sec').getByRole('button', { name: '원', exact: true }),
      field(page, 'sec').getByRole('button', { name: '점', exact: true }),
    ],
    [
      lt(page, 'lt-stage'),
      field(page, 'sec').getByRole('button', { name: '원', exact: true }),
      field(page, 'sec').getByRole('button', { name: '점', exact: true }),
    ],
  );
  // T6: 단면 칸이 ?, 원 통과
  await expect(lt(page, 'lt-section')).toHaveAttribute('data-state', 'hidden');
  await expect(lt(page, 'lt-section-unknown')).toHaveText('?');
  await passA1T6(page);

  await expectFirstScreen(page, FIRST_SCREEN['A1.T7']?.[vp] ?? 'fit', [
    lt(page, 'lt-stage'),
    field(page, 'pyr').getByRole('button', { name: '각뿔이라고 할 수 있어요', exact: true }),
    field(page, 'pyr').getByRole('button', { name: '각뿔이라고 할 수 없어요', exact: true }),
  ]);
  // T7: 예 → MC-CONE-AS-PYRAMID ① → 다시 → ② n-grow(그려짐·정렬 1px) → 아니요 통과
  await choose(page, 'pyr', '각뿔이라고 할 수 있어요');
  await submit(page);
  await expectFailedWithHint(page, '원뿔의 밑면은 다각형일까요?', 1);
  await submit(page);
  await expectFailedWithHint(page, '각뿔의 밑면 변을 늘려 가며 원뿔과 비교해 봐요.', 2);
  await expectOverlayAligned(main, 'n-grow', 'lt-stage');
  const ng = main.locator('[data-overlay="n-grow"]');
  for (let i = 0; i < 4; i += 1) {
    await expect(ng.getByTestId(`n-grow-pyramid-${i}`)).toBeVisible();
  }
  await expect(ng.getByTestId('n-grow-cone')).toBeVisible();
  await choose(page, 'pyr', '각뿔이라고 할 수 없어요');
  await submit(page);
  await expectPassed(page, true);
});

test('g6s2u6.A1 — 과제마다 대표 오답은 일반 힌트 ①이 뜬다', async ({ page }) => {
  test.slow();
  await openA1(page);

  // T1: 붙이기만 함 → 일반 ①
  await build(page, 'rectangle', 'long', false);
  await submit(page);
  await expectFailedWithHint(page, '도형을 고르고 축에 붙일 변을 정했나요?', 1);
  await passA1T1(page);

  // T2: 아직 붙이지 않음 → 일반 ①
  await submit(page);
  await expectFailedWithHint(page, '직각을 낀 변 가운데 하나를 축에 붙여 볼까요?', 1);
  await passA1T2(page);

  // T3: 직사각형 → 일반 ①
  await build(page, 'rectangle', 'long');
  await submit(page);
  await expectFailedWithHint(
    page,
    '어느 쪽에서 보아도 둥근 입체가 되려면 어떤 도형이 좋을까요?',
    1,
  );
  await passA1T3(page);

  // T4: 세로로 자르고 원 → 일반 ①
  await lt(page, 'lt-laser-v').click();
  await choose(page, 'sec', '원');
  await submit(page);
  await expectFailedWithHint(page, "'가로로 자르기'를 누르고 레이저를 위아래로 움직여 볼까요?", 1);
  await passA1T4(page, true);

  // T5: 세로로 자르고 원 → 일반 ①
  await lt(page, 'lt-laser-v').click();
  await choose(page, 'sec', '원');
  await submit(page);
  await expectFailedWithHint(page, "'세로로 자르기'를 눌러 볼까요?", 1);
  await passA1T5(page);

  // T6: 직사각형 → 일반 ①
  await choose(page, 'sec', '직사각형');
  await submit(page);
  await expectFailedWithHint(page, '구의 어느 쪽에서 보아도 테두리는 어떤 모양인가요?', 1);
  await passA1T6(page);

  // T7: 응답을 고르지 않고 확인 → 일반 ①
  await submit(page);
  await expectFailedWithHint(page, '각뿔의 밑면과 옆면은 어떤 모양이었나요?', 1);
  await choose(page, 'pyr', '각뿔이라고 할 수 없어요');
  await submit(page);
  await expectPassed(page, true);
});

test('g6s2u6.A1 — 키보드만으로 구를 만든다(3 + 변 + Space)', async ({ page }) => {
  test.slow();
  await openA1(page);
  await passA1T1(page);
  await passA1T2(page);
  await expect(lt(page, 'lt-stage')).toBeVisible();
  await lt(page, 'lt-profile-rectangle').focus();
  await page.keyboard.press('3');
  await expect(lt(page, 'lt-profile-semicircle')).toHaveAttribute('aria-pressed', 'true');
  await lt(page, 'lt-edge-diameter').focus();
  await page.keyboard.press('Enter');
  await page.keyboard.press('Space');
  await expect(lt(page, 'lt-stage')).toHaveAttribute('data-complete', 'true');
  await page.getByRole('button', { name: '확인하기' }).focus();
  await page.keyboard.press('Enter');
  await expectPassed(page);
});

// ---------------------------------------------------------------- A2(원기둥 전개도) 도우미

function cn(page: Page, id: string): Locator {
  return slot(page, 'main').getByTestId(id);
}

async function rollTimes(page: Page, times: number): Promise<void> {
  await cn(page, 'cn-roll-stage').focus();
  await press(page, 'ArrowRight', times);
}

/** 한 바퀴를 굴린다(이미 굴렸으면 그대로 둔다). */
async function rollFull(page: Page): Promise<void> {
  const full = cn(page, 'cn-roll-full');
  if (await full.isEnabled()) await full.click();
  await expect(full).toBeDisabled();
}

async function passA2T1(page: Page): Promise<void> {
  await rollFull(page);
  await choose(page, 'cmp', '밑면의 둘레와 같아요');
  await submit(page);
  await expectPassed(page);
}
async function passA2T2(page: Page): Promise<void> {
  await typeNumber(page, 'width', '12.56');
  await submit(page);
  await expectPassed(page);
}

/** 전개도 판을 반지름 2·세로 5·가로 `widthKeys`로 맞춘다(시작 6·1·3). 키는 가로만. */
async function setNet(page: Page, widthKeys: readonly [string, number][]): Promise<void> {
  await cn(page, 'cn-board').focus();
  await press(page, 'r', 2);
  await press(page, 'w', 4);
  for (const [key, times] of widthKeys) await press(page, key, times);
}

async function passA2T3(page: Page): Promise<void> {
  await setNet(page, [
    ['Shift+D', 6],
    ['d', 6],
  ]);
  await press(page, 'Enter');
  await expect(cn(page, 'cn-seam-closed')).toBeVisible();
  await submit(page);
  await expectPassed(page);
}
async function passA2T4(page: Page): Promise<void> {
  await choose(page, 'cylBase', '원');
  await choose(page, 'prismBase', '다각형');
  await choose(page, 'cylSide', '굽은 면');
  await choose(page, 'prismSide', '평평한 면');
  await choose(page, 'cylVertex', '없어요');
  await choose(page, 'prismVertex', '있어요');
  await submit(page);
  await expectPassed(page);
}

// ---------------------------------------------------------------- A2

test('g6s2u6.A2 — 원기둥 굴려 옆면 펼치기 5과제 흐름·오개념·roll-match 정렬', async ({
  page,
}, testInfo) => {
  test.slow();
  await openA2(page);
  const main = slot(page, 'main');
  const vp = testInfo.project.name;

  // T1 첫 화면 + 스냅샷
  await expect(cn(page, 'cn-roll-stage')).toBeVisible();
  await expectFirstScreen(page, FIRST_SCREEN['A2.T1']?.[vp] ?? 'fit', [
    cn(page, 'cn-roll-stage'),
    cn(page, 'cn-roll-full'),
    field(page, 'cmp').getByRole('button', { name: '밑면의 둘레와 같아요', exact: true }),
  ]);
  await expectNoResultValues(page, ['12.56', '18.84', '6.28', '62.8']);
  await screenshot(page, 'g6s2u6-a2.png');

  // T1: 4/8만 굴리고 같다 → 상태 ① → 한 바퀴 굴리고 길다 → 일반 ②(roll-match 정렬 1px) → 같다 통과
  await rollTimes(page, 4);
  await choose(page, 'cmp', '밑면의 둘레와 같아요');
  await submit(page);
  await expectFailedWithHint(page, '한 바퀴를 끝까지 굴려 보았나요?', 1);
  await rollFull(page);
  await choose(page, 'cmp', '밑면의 둘레보다 길어요');
  await submit(page);
  await expectFailedWithHint(page, '밑면이 한 바퀴 구르며 남긴 선을 자국과 나란히 놓아 봐요.', 2);
  await expectOverlayAligned(main, 'roll-match', 'cn-roll-stage');
  await choose(page, 'cmp', '밑면의 둘레와 같아요');
  await submit(page);
  await expectPassed(page);

  await expectFirstScreen(page, FIRST_SCREEN['A2.T2']?.[vp] ?? 'fit', [
    cn(page, 'cn-roll-stage'),
    field(page, 'width'),
  ]);
  // T2: 4 → MC-CYL-NET-WIDTH-DIAMETER ① → 다시 → ② roll-match(굴리기 무대 정렬 1px) → 12.56 통과
  await typeNumber(page, 'width', '4');
  await submit(page);
  await expectFailedWithHint(
    page,
    '옆면을 굴렸을 때 바닥에 찍힌 길이는 밑면의 어디와 맞닿았나요?',
    1,
  );
  await submit(page);
  await expectFailedWithHint(page, '밑면이 한 바퀴 구른 길이와 지름을 나란히 비교해 봐요.', 2);
  await expectOverlayAligned(main, 'roll-match', 'cn-roll-stage');
  await typeNumber(page, 'width', '12.56');
  await submit(page);
  await expectPassed(page);

  await expectFirstScreen(page, FIRST_SCREEN['A2.T3']?.[vp] ?? 'fit', [
    cn(page, 'cn-board'),
    cn(page, 'cn-width-m1'),
    cn(page, 'cn-width-p1'),
    cn(page, 'cn-height-p'),
    cn(page, 'cn-radius-p'),
    cn(page, 'cn-fold'),
  ]);
  // T3: 가로 4로 맞추고 접기 → MC ① → 펴고 다시 → ② roll-match(전개도 판 정렬 1px) → 12.6으로 접어 통과
  await setNet(page, [['Shift+A', 2]]);
  await press(page, 'Enter');
  await expect(cn(page, 'cn-seam-gap')).toBeVisible();
  await submit(page);
  await expectFailedWithHint(page, '옆면의 가로는 밑면 원의 어느 길이와 같아야 할까요?', 1);
  await cn(page, 'cn-board').focus();
  await press(page, 'Enter');
  await submit(page);
  await expectFailedWithHint(page, '밑면이 한 바퀴 구른 길이를 옆면 가로 아래에 대어 봐요.', 2);
  await expectOverlayAligned(main, 'roll-match', 'cn-board');
  await cn(page, 'cn-board').focus();
  await press(page, 'Shift+D', 8);
  await press(page, 'd', 6);
  await press(page, 'Enter');
  await expect(cn(page, 'cn-seam-closed')).toBeVisible();
  await submit(page);
  await expectPassed(page);

  await expectFirstScreen(
    page,
    FIRST_SCREEN['A2.T4']?.[vp] ?? 'fit',
    [
      cn(page, 'cn-view'),
      field(page, 'cylBase'),
      field(page, 'prismBase'),
      field(page, 'cylSide'),
      field(page, 'prismSide'),
      field(page, 'cylVertex'),
      field(page, 'prismVertex'),
    ],
    [
      field(page, 'cylBase'),
      field(page, 'prismBase'),
      field(page, 'cylSide'),
      field(page, 'prismSide'),
      field(page, 'cylVertex'),
      field(page, 'prismVertex'),
    ],
  );
  // T4: 한 칸 틀리면 일반 ①, 모두 맞으면 통과(응답 칸 6개)
  await choose(page, 'cylBase', '원');
  await choose(page, 'prismBase', '다각형');
  await choose(page, 'cylSide', '굽은 면');
  await choose(page, 'prismSide', '평평한 면');
  await choose(page, 'cylVertex', '없어요');
  await choose(page, 'prismVertex', '없어요');
  await submit(page);
  await expectFailedWithHint(page, '원기둥의 밑면과 옆면을 하나씩 짚어 볼까요?', 1);
  await choose(page, 'prismVertex', '있어요');
  await submit(page);
  await expectPassed(page);

  await expectFirstScreen(page, FIRST_SCREEN['A2.T5']?.[vp] ?? 'fit', [
    cn(page, 'cn-view'),
    field(page, 'width'),
  ]);
  // T5: 6 → MC ① → 18.84 통과(steps가 비어 ②는 문구만)
  await typeNumber(page, 'width', '6');
  await submit(page);
  await expectFailedWithHint(
    page,
    '옆면을 굴렸을 때 바닥에 찍힌 길이는 밑면의 어디와 맞닿았나요?',
    1,
  );
  await submit(page);
  await expectFailedWithHint(page, '밑면이 한 바퀴 구를 때 가는 거리를 떠올려 봐요.', 2);
  await expect(main.locator('[data-overlay="roll-match"]')).toHaveCount(0);
  await typeNumber(page, 'width', '18.84');
  await submit(page);
  await expectPassed(page, true);
});

test('g6s2u6.A2 — 과제마다 대표 오답은 일반 힌트 ①이 뜬다', async ({ page }) => {
  test.slow();
  await openA2(page);

  // T1: 한 바퀴 굴리고 길다 → 일반 ①
  await rollFull(page);
  await choose(page, 'cmp', '밑면의 둘레보다 길어요');
  await submit(page);
  await expectFailedWithHint(
    page,
    '밑면의 표시점이 다시 바닥에 닿을 때까지 굴러간 거리는 어디와 맞닿았나요?',
    1,
  );
  await passA2T1(page);

  // T2: 6.28 → 일반 ①
  await typeNumber(page, 'width', '6.28');
  await submit(page);
  await expectFailedWithHint(page, '밑면 원의 둘레는 어떻게 구했나요?', 1);
  await passA2T2(page);

  // T3: 반지름 2·세로 5·가로 10으로 접기 → 일반 ①
  await setNet(page, [['Shift+D', 4]]);
  await press(page, 'Enter');
  await expect(cn(page, 'cn-seam-gap')).toBeVisible();
  await submit(page);
  await expectFailedWithHint(page, '접어 보았을 때 옆면이 밑면을 빈틈없이 감쌌나요?', 1);
  await cn(page, 'cn-board').focus();
  await press(page, 'Enter');
  await press(page, 'Shift+D', 2);
  await press(page, 'd', 6);
  await press(page, 'Enter');
  await expect(cn(page, 'cn-seam-closed')).toBeVisible();
  await submit(page);
  await expectPassed(page);

  // T4: 원기둥의 밑면만 틀림 → 일반 ①
  await choose(page, 'cylBase', '다각형');
  await choose(page, 'prismBase', '다각형');
  await choose(page, 'cylSide', '굽은 면');
  await choose(page, 'prismSide', '평평한 면');
  await choose(page, 'cylVertex', '없어요');
  await choose(page, 'prismVertex', '있어요');
  await submit(page);
  await expectFailedWithHint(page, '원기둥의 밑면과 옆면을 하나씩 짚어 볼까요?', 1);
  await choose(page, 'cylBase', '원');
  await submit(page);
  await expectPassed(page);

  // T5: 9.42 → 일반 ①
  await typeNumber(page, 'width', '9.42');
  await submit(page);
  await expectFailedWithHint(page, '밑면 원의 둘레를 구하는 식을 떠올려 볼까요?', 1);
  await typeNumber(page, 'width', '18.84');
  await submit(page);
  await expectPassed(page, true);
});

test('g6s2u6.A2 — 5과제 정답을 차례로 푼다(전개도 가로 12.6은 허용 오차 안)', async ({ page }) => {
  test.slow();
  await openA2(page);
  await passA2T1(page);
  await passA2T2(page);
  await passA2T3(page);
  await passA2T4(page);
  await typeNumber(page, 'width', '18.84');
  await submit(page);
  await expectPassed(page, true);
});

// ---------------------------------------------------------------- 오프라인

test('오프라인에서도 g6s2u6.A1 활동이 열린다', async ({ page, context }) => {
  await page.goto(PREVIEW_URL);
  await page.getByRole('button', { name: '1번', exact: true }).click();
  await page.getByRole('button', { name: '건너뛰기' }).click();
  await expect(page).toHaveURL(/#\/map$/);
  await page.goto(`${PREVIEW_URL}/#/activity/g6s2u6.A1`);
  await expect(page.getByRole('heading', { name: '회전 물레와 레이저 단면' })).toBeVisible();

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
  await expect(page.getByRole('heading', { name: '회전 물레와 레이저 단면' })).toBeVisible();
  await expect(page.getByRole('button', { name: '확인하기' })).toBeVisible();
});
