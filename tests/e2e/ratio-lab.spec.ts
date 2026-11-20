import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

/**
 * E20 비·비율 실험실(mix·resize) 샌드박스 E2E. 아이패드(WebKit)·크롬북·전자칠판 뷰포트에서 모두 돈다.
 *
 * - mix: ×2는 같은 띠 위치, 우유만 더하면 달라짐 / resize: +2 찌그러짐, ×2 유지, 담기
 * - 키보드만으로 각 모드 한 번, 힌트 ② 오버레이 넷이 본 캔버스와 1px 안에 겹침
 * - 모드·look별 첫 화면 기준 이미지, 좁은 판에서 최소 배율 0.6 + 판 안 스크롤, 터치 타깃 48/64px
 */

test.describe.configure({ timeout: 120_000 });

interface Observation {
  readonly mode?: string;
  readonly cup?: { milk: number; syrup: number; value: string | null };
  readonly sameAsReference?: boolean;
  readonly addOps?: number;
  readonly scaleOps?: number;
  readonly size?: { w: number; h: number };
  readonly distorted?: boolean;
  readonly saved?: { w: number; h: number; equivalent: boolean }[];
  readonly savedEquivalentCount?: number;
  readonly misconceptions?: string[];
}

async function readObservation(page: Page): Promise<Observation> {
  const text = await page.getByTestId('observation').textContent();
  return JSON.parse(text ?? '{}') as Observation;
}

async function pollObservation(page: Page, check: (o: Observation) => boolean): Promise<void> {
  await expect.poll(async () => check(await readObservation(page))).toBe(true);
}

async function open(
  page: Page,
  mode: 'mix' | 'resize',
  config: Record<string, unknown> = {},
  query = 'stage=fit',
): Promise<void> {
  const params = new URLSearchParams({ config: JSON.stringify(config) });
  for (const [key, value] of new URLSearchParams(query)) params.set(key, value);
  await page.goto(`/?${params.toString()}#/sandbox/E20`);
  await expect(page.getByRole('heading', { name: '비·비율 실험실' })).toBeVisible();
  await page.getByLabel('모드').selectOption(mode);
  await pollObservation(page, (o) => o.mode === mode);
}

function button(page: Page, name: string): Locator {
  return page.getByRole('button', { name, exact: true });
}

function canvas(page: Page): Locator {
  return page.getByTestId('ratio-canvas');
}

async function click(page: Page, name: string, times = 1): Promise<void> {
  for (let i = 0; i < times; i += 1) await button(page, name).click();
}

/** 띠 위 표시의 가로 위치(논리 좌표). */
async function markerX(page: Page, role: 'reference' | 'cup'): Promise<string | null> {
  return canvas(page).locator(`[data-marker="${role}"]`).getAttribute('data-x');
}

test('mix: ×2로 만든 컵은 기준 컵과 같은 띠 위치, 우유만 더하면 달라진다', async ({ page }) => {
  await open(page, 'mix');
  await expect(canvas(page).locator('[data-marker="cup"]')).toHaveCount(0);
  await click(page, '우유 넣기', 4);
  await click(page, '시럽 넣기');
  await pollObservation(page, (o) => o.cup?.milk === 4 && o.cup.syrup === 1);
  await click(page, '모두 ×2');
  await pollObservation(
    page,
    (o) => o.cup?.milk === 8 && o.cup.syrup === 2 && o.sameAsReference === true && o.scaleOps === 1,
  );
  expect(await markerX(page, 'cup')).toBe(await markerX(page, 'reference'));
  await expect(page.getByText('우유 8, 시럽 2')).toBeVisible();

  await click(page, '우유 넣기');
  await pollObservation(page, (o) => o.cup?.milk === 9 && o.sameAsReference === false);
  expect(await markerX(page, 'cup')).not.toBe(await markerX(page, 'reference'));
});

test('mix: 기준 컵에 같은 수를 더하면 MC-RATIO-ADDITIVE가 기록된다', async ({ page }) => {
  await open(page, 'mix');
  await click(page, '우유 넣기', 5);
  await click(page, '시럽 넣기', 2);
  await pollObservation(page, (o) => (o.misconceptions ?? []).includes('MC-RATIO-ADDITIVE'));
});

test('mix: 컵이 가득 차면 거절하고 이유를 글로 알린다', async ({ page }) => {
  await open(page, 'mix', { make: { milk: 2, syrup: 1, maxEach: 2 } });
  await click(page, '우유 넣기');
  await expect(page.getByTestId('ratio-message')).toHaveText('컵이 가득 찼어요.');
  await pollObservation(page, (o) => o.cup?.milk === 2 && o.addOps === 0);
});

test('resize: +2는 찌그러지고 ×2는 모양이 유지되고 담을 수 있다', async ({ page }) => {
  await open(page, 'resize');
  await expect(canvas(page)).toHaveAttribute('data-size', '4x3');
  await click(page, '가로·세로 둘 다 +2');
  await expect(canvas(page)).toHaveAttribute('data-size', '6x5');
  await expect(canvas(page)).toHaveAttribute('data-distorted', 'true');
  await expect(page.getByTestId('ratio-verdict')).toHaveText('처음 모양과 달라요');
  await pollObservation(page, (o) => o.distorted === true && o.size?.w === 6);
  await click(page, '이 크기 담기');
  await pollObservation(page, (o) => (o.misconceptions ?? []).includes('MC-RATIO-ADDITIVE'));

  await click(page, '처음으로');
  await click(page, '가로·세로 둘 다 ×2');
  await expect(canvas(page)).toHaveAttribute('data-size', '8x6');
  await expect(canvas(page)).toHaveAttribute('data-distorted', 'false');
  await expect(page.getByTestId('ratio-verdict')).toHaveText('처음 모양과 같아요');
  await click(page, '이 크기 담기');
  await click(page, '이 크기 담기');
  await pollObservation(
    page,
    (o) => o.saved?.length === 2 && o.savedEquivalentCount === 1 && o.size?.w === 8,
  );
  await expect(canvas(page).locator('[data-saved]')).toHaveCount(2);
});

test('mix 키보드만으로: 단축키로 4:1을 만들고 ×2, Tab·Enter로 처음으로', async ({ page }) => {
  await open(page, 'mix');
  await button(page, '우유 넣기').focus();
  for (const code of ['KeyM', 'KeyM', 'KeyM', 'KeyM', 'KeyS', 'Digit2']) {
    await page.keyboard.press(code);
  }
  await pollObservation(
    page,
    (o) => o.cup?.milk === 8 && o.cup.syrup === 2 && o.sameAsReference === true,
  );
  await page.keyboard.press('KeyN');
  await pollObservation(page, (o) => o.cup?.milk === 7);

  await page.getByRole('button', { name: '우유 넣기' }).focus();
  let reached = false;
  for (let i = 0; i < 12; i += 1) {
    const name = await page.evaluate(() => document.activeElement?.getAttribute('aria-label'));
    if (name === '처음으로') {
      reached = true;
      break;
    }
    await page.keyboard.press('Tab');
  }
  expect(reached, 'Tab으로 [처음으로]에 닿아야 합니다.').toBe(true);
  await page.keyboard.press('Enter');
  await pollObservation(page, (o) => o.cup?.milk === 0 && o.cup.syrup === 0);
});

test('resize 키보드만으로: 방향키로 크기를 바꾸고 B·S·R', async ({ page }) => {
  await open(page, 'resize');
  await button(page, '가로 늘리기').focus();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowUp');
  await pollObservation(page, (o) => o.size?.w === 5 && o.size.h === 4);
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Digit2');
  await pollObservation(page, (o) => o.size?.w === 8 && o.size.h === 6 && o.distorted === false);
  await page.keyboard.press('KeyS');
  await pollObservation(page, (o) => o.saved?.length === 1);
  await page.keyboard.press('KeyR');
  await page.keyboard.press('KeyB');
  await pollObservation(page, (o) => o.size?.w === 6 && o.size.h === 5);

  await button(page, '가로 늘리기').focus();
  let reached = false;
  for (let i = 0; i < 12; i += 1) {
    const name = await page.evaluate(() => document.activeElement?.getAttribute('aria-label'));
    if (name === '이 크기 담기') {
      reached = true;
      break;
    }
    await page.keyboard.press('Tab');
  }
  expect(reached, 'Tab으로 [이 크기 담기]에 닿아야 합니다.').toBe(true);
  await page.keyboard.press('Enter');
  await pollObservation(page, (o) => o.saved?.length === 2);
});

/** 화면 기준 이미지: 샌드박스 `?stage=fit` 판 전체(페이지 화면). 크롬북·아이패드만 찍는다. */
async function expectPageSnapshot(page: Page, name: string): Promise<void> {
  test.skip(test.info().project.name === 'board', '기준 이미지는 크롬북·아이패드만 둔다.');
  await page.waitForTimeout(600);
  await page.evaluate(() => window.scrollTo(0, 0));
  // 조작 칸은 좁은 판에서 안쪽 스크롤이 생기므로 단추를 누르며 내려간 위치를 맨 위로 돌린다.
  await page.getByTestId('ratio-controls').evaluate((element) => element.scrollTo(0, 0));
  await expect(page).toHaveScreenshot(name, { fullPage: true, animations: 'disabled' });
}

const FIXED = [
  { id: 'a', label: '가 컵', milk: 5, syrup: 2 },
  { id: 'b', label: '나 컵', milk: 8, syrup: 3 },
];

for (const look of ['blocks', 'strip', 'ratio'] as const) {
  test(`화면 기준: mix ${look} 첫 화면`, async ({ page }) => {
    await open(page, 'mix', { look, fixedCups: FIXED, make: { milk: 6, syrup: 2 } });
    await expect(canvas(page)).toHaveAttribute('data-look', look);
    await expectPageSnapshot(page, `ratio-mix-${look}.png`);
  });
}

for (const look of ['picture', 'table'] as const) {
  test(`화면 기준: resize ${look} 첫 화면`, async ({ page }) => {
    await open(page, 'resize', { look });
    await click(page, '가로·세로 둘 다 ×2');
    await click(page, '이 크기 담기');
    await click(page, '처음으로');
    await click(page, '가로·세로 둘 다 +2');
    await expect(canvas(page)).toHaveAttribute('data-look', look);
    await expectPageSnapshot(page, `ratio-resize-${look}.png`);
  });
}

/** 오버레이 svg 상자가 ratio-canvas 상자와 1px 이내로 같다(overlay-alignment 방식). */
async function expectAligned(page: Page, overlay: string): Promise<Locator> {
  const layer = page.locator(`[data-overlay="${overlay}"]`);
  await expect(layer).toBeVisible();
  await expect
    .poll(async () => {
      const a = await canvas(page).boundingBox();
      const b = await layer.locator('svg').first().boundingBox();
      if (!a || !b) return Number.POSITIVE_INFINITY;
      return Math.max(
        Math.abs(a.x - b.x),
        Math.abs(a.y - b.y),
        Math.abs(a.width - b.width),
        Math.abs(a.height - b.height),
      );
    })
    .toBeLessThanOrEqual(1);
  return layer;
}

async function toggleOverlay(page: Page): Promise<void> {
  await page.getByRole('button', { name: '힌트 겹쳐 보기' }).click();
}

test('힌트 ② side-by-side: 다르면 화살표와 ≠, 같으면 없다', async ({ page }) => {
  await open(page, 'mix', {}, 'stage=fit&overlay=side-by-side');
  await click(page, '우유 넣기', 5);
  await click(page, '시럽 넣기', 2);
  await toggleOverlay(page);
  const layer = await expectAligned(page, 'side-by-side');
  await expect(layer.locator('[data-part="gap-arrow"]')).toHaveCount(1);
  await expect(layer.locator('[data-part="not-equal"]')).toHaveText('≠');
  // 두 표시가 본 캔버스 띠 위의 같은 가로 위치에 선다.
  const refMark = await layer.locator('[data-part="mark-reference"]').getAttribute('data-x');
  expect(refMark).toBe(await markerX(page, 'reference'));
  const cupMark = await layer.locator('[data-part="mark-cup"]').getAttribute('data-x');
  expect(cupMark).toBe(await markerX(page, 'cup'));

  await click(page, '처음으로');
  await click(page, '우유 넣기', 4);
  await click(page, '시럽 넣기');
  await click(page, '모두 ×2');
  await expect(layer.locator('[data-part="mark-cup"]')).toHaveCount(1);
  await expect(layer.locator('[data-part="gap-arrow"]')).toHaveCount(0);
  await expect(layer.locator('[data-part="not-equal"]')).toHaveCount(0);
});

test('힌트 ② unit-groups: 기준 묶음마다 점선 고리, 남는 블록은 빗금, 묶음 수 글은 없다', async ({
  page,
}) => {
  await open(page, 'mix', { make: { milk: 9, syrup: 2 } }, 'stage=fit&overlay=unit-groups');
  await toggleOverlay(page);
  const layer = await expectAligned(page, 'unit-groups');
  // 4:1 묶음 둘 → 우유 고리 2 + 시럽 고리 2, 남는 우유 블록 1
  await expect(layer.locator('[data-part="group-ring"]')).toHaveCount(4);
  await expect(layer.locator('[data-part="leftover"]')).toHaveCount(1);
  await expect(layer.locator('text')).toHaveCount(0);
});

test('힌트 ② unit-groups: ratio look에서는 그리지 않는다', async ({ page }) => {
  await open(page, 'mix', { look: 'ratio' }, 'stage=fit&overlay=unit-groups');
  await toggleOverlay(page);
  await expect(page.locator('[data-overlay="unit-groups"] svg')).toHaveCount(0);
});

test('힌트 ② ratio-grid: 8×6은 빈틈없이, 6×5는 빗금이 남는다', async ({ page }) => {
  await open(page, 'resize', {}, 'stage=fit&overlay=ratio-grid');
  await click(page, '가로·세로 둘 다 ×2');
  await toggleOverlay(page);
  const layer = await expectAligned(page, 'ratio-grid');
  await expect(layer.locator('[data-part="tile"]')).toHaveCount(4);
  await expect(layer.locator('[data-part="leftover"]')).toHaveCount(0);

  await click(page, '처음으로');
  await click(page, '가로·세로 둘 다 +2');
  await expect(layer.locator('[data-part="tile"]')).toHaveCount(1);
  await expect(layer.locator('[data-part="leftover"]')).toHaveCount(2);
});

test('힌트 ② growth-arrows: +2 화살표와 길이가 다른 막대 둘, 값 글은 없다', async ({ page }) => {
  await open(page, 'resize', {}, 'stage=fit&overlay=growth-arrows');
  await click(page, '가로·세로 둘 다 +2');
  await toggleOverlay(page);
  const layer = await expectAligned(page, 'growth-arrows');
  await expect(layer.locator('[data-part="arrow-w"]')).toHaveText('+2');
  await expect(layer.locator('[data-part="arrow-h"]')).toHaveText('+2');
  const w = Number(await layer.locator('[data-part="bar-w"]').getAttribute('data-length'));
  const h = Number(await layer.locator('[data-part="bar-h"]').getAttribute('data-length'));
  // 같은 +2라도 처음 길이가 가로 4, 세로 3이라 세로 막대가 더 길다.
  expect(h).toBeGreaterThan(w);
  expect(await layer.textContent()).not.toMatch(/\d\/\d/);
});

test('넓은 판은 줄여서 맞추고, 좁은 판은 최소 배율 0.6에서 멈추고 판 안에서 스크롤한다', async ({
  page,
}) => {
  test.skip(test.info().project.name !== 'chromebook', '크롬북 뷰포트에서만 판 크기를 바꿔 본다.');
  for (const mode of ['mix', 'resize'] as const) {
    await open(page, mode);
    const wide = await canvas(page).boundingBox();
    if (!wide) throw new Error('캔버스를 찾지 못했습니다.');
    expect(wide.width / 1000).toBeGreaterThanOrEqual(0.6);
    await expect(page.getByTestId('ratio-board')).toHaveAttribute('data-scroll', 'false');

    await page.setViewportSize({ width: 520, height: 700 });
    await expect(page.getByTestId('ratio-board')).toHaveAttribute('data-scroll', 'true');
    const narrow = await canvas(page).boundingBox();
    if (!narrow) throw new Error('캔버스를 찾지 못했습니다.');
    expect(narrow.width).toBeGreaterThanOrEqual(599);
    expect(narrow.width).toBeLessThanOrEqual(601);
    expect(narrow.height).toBeGreaterThanOrEqual(359);
    const scrolls = await page
      .getByTestId('ratio-board')
      .evaluate((element) => element.scrollWidth > element.clientWidth);
    expect(scrolls).toBe(true);
    // 조작 칸은 스크롤 상자 밖이라 단추가 그대로 보인다.
    const first = mode === 'mix' ? '우유 넣기' : '가로 늘리기';
    await expect(button(page, first)).toBeVisible();
    const outside = await button(page, first).evaluate(
      (el) => !document.querySelector('[data-testid="ratio-board"]')?.contains(el),
    );
    expect(outside).toBe(true);
    await page.setViewportSize({ width: 1366, height: 768 });
  }
});

async function expectMin(locator: Locator, min: number, label: string): Promise<void> {
  const box = await locator.boundingBox();
  if (!box) throw new Error(`${label}: 상자를 찾지 못했습니다.`);
  expect(Math.min(box.width, box.height), label).toBeGreaterThanOrEqual(min - 0.5);
}

for (const size of [48, 64] as const) {
  test(`터치 타깃 ${size}: 모든 단추가 ${size}px 이상`, async ({ page }) => {
    for (const mode of ['mix', 'resize'] as const) {
      await open(page, mode);
      // 설정은 저장되므로 아직 48px일 때만 눌러 64px로 바꾼다.
      const toggle = page.getByRole('button', { name: '터치 48px' });
      if (size === 64 && (await toggle.count()) > 0) await toggle.click();
      const controls = page.getByTestId('ratio-controls').getByRole('button');
      const count = await controls.count();
      expect(count).toBeGreaterThan(4);
      for (let i = 0; i < count; i += 1) {
        await controls.nth(i).scrollIntoViewIfNeeded();
        await expectMin(controls.nth(i), size, `${mode} 단추 ${i}`);
      }
    }
  });
}
