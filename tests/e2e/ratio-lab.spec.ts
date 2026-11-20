import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

/**
 * E20 비·비율 실험실(mix·resize·rate·percent·bar-model) 샌드박스 E2E. 아이패드(WebKit)·크롬북·전자칠판 뷰포트에서 모두 돈다.
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
  readonly racers?: { id: string; distance: number | null; time: number | null }[];
  readonly prediction?: string | null;
  readonly predictionLocked?: boolean;
  readonly ran?: boolean;
  readonly runs?: number;
  readonly shaded?: number;
  readonly cells?: number[];
  readonly fraction?: string;
  readonly marks?: { total: number[]; ratio: number[] };
  readonly highlightCorrect?: boolean | null;
  readonly unit?: string | null;
  readonly unitCorrect?: boolean | null;
  readonly partValues?: (string | null)[];
  readonly partsCorrect?: boolean[];
  readonly totalValue?: string | null;
  readonly totalCorrect?: boolean | null;
  readonly expr?: string | null;
  readonly exprValue?: string | null;
  readonly exprMatchesPart?: number | null;
  readonly partsSumMatches?: boolean | null;
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
  mode: 'mix' | 'resize' | 'rate' | 'percent' | 'bar-model',
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
  // T199: 좁은 판에서는 엔진 바깥 상자(.wrap)가 세로로 스크롤하므로 단추를 누르며 내려간 위치를 맨 위로 돌린다.
  await page.getByTestId('ratio-controls').evaluate((element) => {
    element.scrollTo(0, 0);
    element.closest('[class*="wrap"]')?.scrollTo(0, 0);
  });
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
  for (const mode of ['mix', 'resize', 'rate', 'percent', 'bar-model'] as const) {
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
    // bar-model 판은 논리 높이가 500이라 최소 높이가 0.6 × 500 = 300px이다.
    expect(narrow.height).toBeGreaterThanOrEqual(mode === 'bar-model' ? 299 : 359);
    const scrolls = await page
      .getByTestId('ratio-board')
      .evaluate((element) => element.scrollWidth > element.clientWidth);
    expect(scrolls).toBe(true);
    // 조작 칸은 스크롤 상자 밖이라 단추가 그대로 보인다.
    const first = {
      mix: '우유 넣기',
      resize: '가로 늘리기',
      rate: '경주 시작',
      percent: '모두 지우기',
      'bar-model': '전체 칠하기',
    }[mode];
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
    for (const mode of ['mix', 'resize', 'rate', 'percent', 'bar-model'] as const) {
      await open(page, mode);
      // 설정은 저장되므로 아직 48px일 때만 눌러 64px로 바꾼다.
      const toggle = page.getByRole('button', { name: '터치 48px' });
      if (size === 64 && (await toggle.count()) > 0) await toggle.click();
      const controls = page.getByTestId('ratio-controls').getByRole('button');
      const count = await controls.count();
      expect(count).toBeGreaterThan(mode === 'percent' ? 1 : 4);
      for (let i = 0; i < count; i += 1) {
        await controls.nth(i).scrollIntoViewIfNeeded();
        await expectMin(controls.nth(i), size, `${mode} 단추 ${i}`);
      }
      const inputs = page.getByTestId('ratio-controls').locator('input');
      for (let i = 0; i < (await inputs.count()); i += 1) {
        await inputs.nth(i).scrollIntoViewIfNeeded();
        await expectMin(inputs.nth(i), size, `${mode} 입력 ${i}`);
      }
    }
  });
}

// ───────────── rate · percent (T190) ─────────────

const BLANK_RACERS = [
  { id: 'rabbit', name: '토끼', distance: null, time: null },
  { id: 'turtle', name: '거북', distance: null, time: null },
];

/** 캐릭터 가운데 x(논리 좌표). 도착선 `[data-part="finish"]`가 아니라 캐릭터 묶음을 읽는다. */
async function racerX(page: Page, id: string): Promise<number> {
  const value = await canvas(page)
    .locator(`g[data-racer="${id}"][data-at-finish]`)
    .getAttribute('data-x');
  return Number(value);
}

async function finishX(page: Page, id: string): Promise<number> {
  const value = await canvas(page)
    .locator(`[data-part="finish"][data-racer="${id}"]`)
    .getAttribute('data-x');
  return Number(value);
}

async function fillRacers(page: Page): Promise<void> {
  await page.getByLabel('토끼 거리(m)').fill('120');
  await page.getByLabel('토끼 시간(초)').fill('20');
  await page.getByLabel('거북 거리(m)').fill('200');
  await page.getByLabel('거북 시간(초)').fill('40');
}

test('rate: 값 넣기 → 예측 → 경주(재생 뒤 각자 자기 거리에 도착, 결과 글 없음)', async ({
  page,
}) => {
  await open(page, 'rate', { racers: BLANK_RACERS, predictFirst: true });
  await expect(canvas(page)).toHaveAttribute('data-ran', 'false');
  // 값이 없을 때는 경주를 시작할 수 없다.
  await click(page, '경주 시작');
  await expect(page.getByTestId('ratio-message')).toHaveText('거리와 시간을 모두 넣어 주세요.');
  await fillRacers(page);
  await pollObservation(
    page,
    (o) => o.racers?.[0]?.distance === 120 && o.racers[1]?.time === 40 && o.ran === false,
  );
  // 예측 전에는 경주를 시작할 수 없다.
  await click(page, '경주 시작');
  await expect(page.getByTestId('ratio-message')).toHaveText('먼저 누가 더 빠를지 예측해 주세요.');
  await click(page, '거북');
  await expect(page.getByTestId('rate-prediction')).toHaveText('내 예측: 거북');
  await pollObservation(
    page,
    (o) =>
      o.prediction === 'turtle' &&
      o.predictionLocked === true &&
      (o.misconceptions ?? []).includes('MC-RATE-DISTANCE-ONLY'),
  );
  expect(await racerX(page, 'rabbit')).toBe(150);
  await click(page, '경주 시작');
  await expect(canvas(page)).toHaveAttribute('data-ran', 'true');
  await expect(canvas(page)).toHaveAttribute('data-playing', 'false', { timeout: 10_000 });
  expect(await racerX(page, 'rabbit')).toBe(await finishX(page, 'rabbit'));
  expect(await racerX(page, 'turtle')).toBe(await finishX(page, 'turtle'));
  await pollObservation(page, (o) => o.ran === true && o.runs === 1);
  const text = (await page.getByTestId('ratio-board').textContent()) ?? '';
  expect(text).not.toMatch(/1초에|더 빠|더 멀리/);
});

test('rate: prefers-reduced-motion이면 끝 장면이 바로 보이고, 처음으로를 누르면 시작 장면', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await open(page, 'rate');
  await click(page, '토끼');
  await click(page, '경주 시작');
  await expect(canvas(page)).toHaveAttribute('data-playing', 'false');
  await expect(canvas(page)).toHaveAttribute('data-step', '1000');
  expect(await racerX(page, 'rabbit')).toBe(await finishX(page, 'rabbit'));
  expect(await racerX(page, 'turtle')).toBe(await finishX(page, 'turtle'));
  // 처음으로(값은 그대로여도 기록은 남고 장면은 끝 그대로, 값을 바꾸면 시작 장면)
  await page.getByLabel('토끼 시간(초)').fill('30');
  expect(await racerX(page, 'rabbit')).toBe(150);
  await expect(canvas(page)).toHaveAttribute('data-ran', 'true');
});

test('rate 키보드만으로: 입력 칸에 쓰고 Tab, 숫자 단축키로 예측, G로 경주', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await open(page, 'rate', { racers: BLANK_RACERS, predictFirst: true });
  await page.getByLabel('토끼 거리(m)').focus();
  for (const value of ['120', '20', '200', '40']) {
    await page.keyboard.type(value);
    await page.keyboard.press('Tab');
  }
  await pollObservation(
    page,
    (o) => o.racers?.[0]?.distance === 120 && o.racers[0].time === 20 && o.racers[1]?.time === 40,
  );
  // 이제 포커스는 예측 단추에 있다. 입력 칸에서 친 숫자는 단축키로 쓰이지 않았다.
  await expect(page.getByRole('button', { name: '토끼', exact: true })).toBeFocused();
  expect((await readObservation(page)).prediction).toBeNull();
  await page.keyboard.press('Digit1');
  await pollObservation(page, (o) => o.prediction === 'rabbit');
  await page.keyboard.press('KeyG');
  await pollObservation(page, (o) => o.ran === true);
  await expect(canvas(page)).toHaveAttribute('data-playing', 'false');
  await page.keyboard.press('KeyR');
  await pollObservation(page, (o) => o.racers?.[0]?.distance === null && o.ran === true);
});

test('rate: 잠긴 칸은 글자만, 범위 밖·숫자 아닌 입력은 안내하고 값은 그대로', async ({ page }) => {
  await open(page, 'rate', {
    racers: [
      { id: 'a', name: '가', distance: 60, time: null },
      { id: 'b', name: '나', distance: null, time: null },
    ],
  });
  await expect(page.getByLabel('가 거리(m)')).toHaveText('60');
  await page.getByLabel('나 시간(초)').fill('999');
  await expect(page.getByTestId('ratio-message')).toHaveText(
    '시간은 1부터 120까지 정수로 넣어 주세요.',
  );
  await pollObservation(page, (o) => o.racers?.[1]?.time === null);
  await page.getByLabel('나 시간(초)').fill('x');
  await expect(page.getByTestId('ratio-message')).toHaveText('숫자만 넣어 주세요.');
});

/** percent 칸 가운데의 화면 좌표(논리 좌표 → 화면). */
async function cellPoint(
  page: Page,
  layout: 'grid' | 'strip',
  index: number,
): Promise<{ x: number; y: number }> {
  const box = await canvas(page).boundingBox();
  if (!box) throw new Error('캔버스를 찾지 못했습니다.');
  const lx = layout === 'grid' ? 60 + (index % 10) * 46 + 23 : 50 + index * 9 + 4.5;
  const ly = layout === 'grid' ? 70 + Math.floor(index / 10) * 46 + 23 : 315;
  return { x: box.x + (lx * box.width) / 1000, y: box.y + (ly * box.height) / 600 };
}

async function dragCells(
  page: Page,
  layout: 'grid' | 'strip',
  from: number,
  to: number,
): Promise<void> {
  await canvas(page).scrollIntoViewIfNeeded();
  const start = await cellPoint(page, layout, from);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  const step = from <= to ? 1 : -1;
  for (let i = from + step; step > 0 ? i <= to : i >= to; i += step) {
    const point = await cellPoint(page, layout, i);
    await page.mouse.move(point.x, point.y, { steps: 2 });
  }
  await page.mouse.up();
}

test('percent grid: 누르면 한 칸, 끌면 지나간 칸이 처음 칸의 새 상태로 바뀐다', async ({
  page,
}) => {
  await open(page, 'percent');
  await expect(page.getByTestId('percent-count')).toHaveText('칠한 칸 0 / 100');
  await dragCells(page, 'grid', 0, 9);
  await pollObservation(page, (o) => o.shaded === 10 && o.fraction === '1/10');
  await dragCells(page, 'grid', 10, 14);
  await pollObservation(page, (o) => o.shaded === 15);
  // 칠한 칸에서 시작해 끌면 지운다.
  await dragCells(page, 'grid', 9, 5);
  await pollObservation(page, (o) => o.shaded === 10 && !(o.cells ?? []).includes(7));
  // 한 칸 누르기
  const point = await cellPoint(page, 'grid', 99);
  await page.mouse.click(point.x, point.y);
  await pollObservation(page, (o) => (o.cells ?? []).includes(99));
  await expect(page.getByTestId('percent-count')).toHaveText('칠한 칸 11 / 100');
  await click(page, '모두 지우기');
  await pollObservation(page, (o) => o.shaded === 0);
});

test('percent strip: 끌어서 25칸을 칠하면 분수 1/4', async ({ page }) => {
  await open(page, 'percent', { layout: 'strip' });
  await expect(canvas(page)).toHaveAttribute('data-layout', 'strip');
  await dragCells(page, 'strip', 0, 24);
  await pollObservation(page, (o) => o.shaded === 25 && o.fraction === '1/4');
});

test('percent 키보드만으로: 방향키로 옮기고 Space·Enter, C·R', async ({ page }) => {
  await open(page, 'percent', { shaded: 3 });
  const group = page.getByTestId('percent-cells');
  await group.focus();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowRight');
  await expect(group).toHaveAttribute('data-cursor', '11');
  await page.keyboard.press('Space');
  await pollObservation(page, (o) => o.shaded === 4 && (o.cells ?? []).includes(11));
  await page.keyboard.press('Space');
  await pollObservation(page, (o) => o.shaded === 3);
  await page.keyboard.press('Enter');
  await pollObservation(page, (o) => o.shaded === 12);
  await page.keyboard.press('KeyC');
  await pollObservation(page, (o) => o.shaded === 0);
  await page.keyboard.press('KeyR');
  await pollObservation(page, (o) => o.shaded === 3);
});

for (const [config, name] of [
  [{}, 'race'],
  [{ look: 'table' }, 'table'],
] as const) {
  test(`화면 기준: rate ${name} 첫 화면`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await open(page, 'rate', config);
    await click(page, '토끼');
    await click(page, '경주 시작');
    await expect(canvas(page)).toHaveAttribute('data-look', name);
    await expect(canvas(page)).toHaveAttribute('data-step', '1000');
    await expectPageSnapshot(page, `ratio-rate-${name}.png`);
  });
}

for (const layout of ['grid', 'strip'] as const) {
  test(`화면 기준: percent ${layout} 첫 화면`, async ({ page }) => {
    await open(page, 'percent', { layout, shaded: 35 });
    await expect(canvas(page)).toHaveAttribute('data-look', layout);
    await expectPageSnapshot(page, `ratio-percent-${layout}.png`);
  });
}

test('힌트 ② footprints: 처음 3초 발자국이 두 줄에 찍히고 글이 없다', async ({ page }) => {
  await open(page, 'rate', {}, 'stage=fit&overlay=footprints');
  await toggleOverlay(page);
  const layer = await expectAligned(page, 'footprints');
  await expect(layer.locator('[data-racer="rabbit"] [data-part="footprint"]')).toHaveCount(3);
  await expect(layer.locator('[data-racer="turtle"] [data-part="footprint"]')).toHaveCount(3);
  await expect(layer.locator('text')).toHaveCount(0);
  // 1초 발자국은 출발선보다 오른쪽에 찍힌다.
  const x = Number(
    await layer
      .locator('[data-racer="rabbit"] [data-part="footprint"][data-second="1"]')
      .getAttribute('data-x'),
  );
  expect(x).toBeGreaterThan(150);
});

test('힌트 ② same-time: 같은 시간 위치에 점선 둘과 글', async ({ page }) => {
  await open(page, 'rate', {}, 'stage=fit&overlay=same-time');
  await toggleOverlay(page);
  const layer = await expectAligned(page, 'same-time');
  await expect(layer.locator('[data-part="time-line"]')).toHaveCount(2);
  await expect(layer.locator('[data-part="same-time-label"]')).toHaveText('같은 시간');
  const rabbit = Number(
    await layer.locator('[data-part="time-line"][data-racer="rabbit"]').getAttribute('data-x'),
  );
  const turtle = Number(
    await layer.locator('[data-part="time-line"][data-racer="turtle"]').getAttribute('data-x'),
  );
  // 20초: 토끼는 120m(도착), 거북은 100m 지점.
  expect(rabbit).toBeGreaterThan(turtle);
});

test('힌트 ② tens-brackets: 다 찬 10칸마다 괄호와 10, 남은 칸은 점선', async ({ page }) => {
  await open(page, 'percent', { shaded: 25 }, 'stage=fit&overlay=tens-brackets');
  await toggleOverlay(page);
  const layer = await expectAligned(page, 'tens-brackets');
  await expect(layer.locator('[data-part="ten-bracket"]')).toHaveCount(2);
  await expect(layer.locator('[data-part="ten-label"]').first()).toHaveText('10');
  await expect(layer.locator('[data-part="rest-ring"]')).toHaveCount(1);
  await page.getByTestId('percent-cells').focus();
  await page.keyboard.press('KeyC');
  await expect(layer.locator('[data-part="ten-bracket"]')).toHaveCount(0);
});

// ───────────── bar-model (T197) ─────────────

/** 문장 토큰 단추(번호로 찾는다. 꼬리표가 붙어도 번호는 그대로다). */
function tokenButton(page: Page, index: number): Locator {
  return page.locator(`[data-token-index="${index}"]`);
}

/** 기본 장면의 토큰 번호: 사탕0 35(1) 개를2 형과3 동생이4 3(5) :(6) 4(7) 로8 … */
const TOKEN = { total: 1, three: 5, four: 7 } as const;

async function highlightByClick(page: Page): Promise<void> {
  await button(page, '전체 칠하기').click();
  await tokenButton(page, TOKEN.total).click();
  await button(page, '비 칠하기').click();
  await tokenButton(page, TOKEN.three).click();
  await tokenButton(page, TOKEN.four).click();
}

async function expectMinHeight(locator: Locator, min: number, label: string): Promise<void> {
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  if (!box) throw new Error(`${label}: 상자를 찾지 못했습니다.`);
  expect(box.height, label).toBeGreaterThanOrEqual(min - 0.5);
}

test('bar-model: 형광펜 → 막대 열림 → 값 넣기', async ({ page }) => {
  await open(page, 'bar-model');
  await expect(canvas(page)).toHaveAttribute('data-open', 'false');
  await pollObservation(page, (o) => o.highlightCorrect === false);
  await tokenButton(page, TOKEN.total).click();
  await expect(tokenButton(page, TOKEN.total)).toHaveAttribute('data-mark', 'total');
  await expect(tokenButton(page, TOKEN.total)).toContainText('전체');
  // 아직 비를 칠하지 않아 막대는 흐리다.
  await expect(canvas(page)).toHaveAttribute('data-open', 'false');
  await button(page, '비 칠하기').click();
  await tokenButton(page, TOKEN.three).click();
  await tokenButton(page, TOKEN.four).click();
  await expect(tokenButton(page, TOKEN.three)).toContainText('비');
  await expect(canvas(page)).toHaveAttribute('data-open', 'true');
  await pollObservation(
    page,
    (o) => o.highlightCorrect === true && o.marks?.total[0] === 1 && o.marks.ratio.length === 2,
  );

  await page.getByLabel('한 칸 크기').fill('5');
  await expect(canvas(page).locator('[data-part="unit-text"]')).toHaveCount(7);
  await page.getByLabel('형 몫').fill('15');
  await page.getByLabel('동생 몫').fill('20');
  await pollObservation(
    page,
    (o) =>
      o.unitCorrect === true &&
      o.partsCorrect?.every(Boolean) === true &&
      o.partsSumMatches === true &&
      (o.misconceptions ?? []).length === 0,
  );
  // 키패드로도 쓴다.
  await page.getByLabel('한 칸 크기').focus();
  await button(page, '한 글자 지우기').click();
  await button(page, '1').click();
  await button(page, '1').click();
  await pollObservation(
    page,
    (o) =>
      o.unit === '11' && (o.misconceptions ?? []).includes('MC-PROPORTION-DIVIDE-BY-RATIO-TERM'),
  );
  await click(page, '처음으로');
  await pollObservation(page, (o) => o.unit === null && o.marks?.total.length === 0);
});

test('bar-model: 정답(한 칸 크기·몫)이 시작 화면 어디에도 없다', async ({ page }) => {
  await open(page, 'bar-model');
  const board = (await page.getByTestId('ratio-board').innerHTML()).replace(/<[^>]*>/g, ' ');
  const sentence = (await page.getByTestId('bar-sentence').textContent()) ?? '';
  const fields = await page
    .getByTestId('ratio-controls')
    .locator('input')
    .evaluateAll((list) => list.map((el) => (el as HTMLInputElement).value).join(' '));
  for (const text of [board, sentence, fields]) {
    expect(text).not.toMatch(/(^|[^0-9])(5|15|20)([^0-9]|$)/);
  }
});

test('bar-model 키보드만으로: Enter로 칠하고 T·B·E 도구, Tab으로 칸을 오가며 쓴다', async ({
  page,
}) => {
  await open(page, 'bar-model');
  await tokenButton(page, TOKEN.total).focus();
  await page.keyboard.press('Enter'); // 도구 기본은 전체
  await page.keyboard.press('KeyB');
  await expect(button(page, '비 칠하기')).toHaveAttribute('aria-pressed', 'true');
  await tokenButton(page, TOKEN.three).focus();
  await page.keyboard.press('Enter');
  await tokenButton(page, TOKEN.four).focus();
  await page.keyboard.press('Space');
  await pollObservation(page, (o) => o.highlightCorrect === true);
  await page.keyboard.press('KeyE');
  await page.keyboard.press('Enter');
  await pollObservation(page, (o) => o.highlightCorrect === false);
  await page.keyboard.press('KeyB');
  await page.keyboard.press('Enter');
  await pollObservation(page, (o) => o.highlightCorrect === true);

  await page.getByLabel('한 칸 크기').focus();
  for (const value of ['5', '15', '20']) {
    await page.keyboard.type(value);
    await page.keyboard.press('Tab');
  }
  await pollObservation(
    page,
    (o) => o.unitCorrect === true && o.partsCorrect?.every(Boolean) === true,
  );
  // 입력 칸 안에서 친 글자는 단축키로 쓰이지 않았다.
  expect((await readObservation(page)).marks?.ratio).toHaveLength(2);
  await page.getByLabel('동생 몫').blur();
  await tokenButton(page, TOKEN.total).focus();
  await page.keyboard.press('KeyR');
  await pollObservation(page, (o) => o.unit === null);
});

test('bar-model: 거꾸로 문제(형 24, 3 : 5)는 전체 칸이 있고 알려 준 몫은 고정', async ({
  page,
}) => {
  await open(page, 'bar-model', {
    problem: '형과 동생이 3 : 5로 나누었더니 형이 24개입니다. 전체는 몇 개일까요?',
    parts: ['형', '동생'],
    ratio: [3, 5],
    known: { part: 0, value: 24 },
  });
  await expect(canvas(page)).toHaveAttribute('data-open', 'true');
  await expect(page.locator('[data-field="part-0"]')).toContainText('24');
  await page.getByLabel('한 칸 크기').fill('8');
  await page.getByLabel('동생 몫').fill('40');
  await page.getByLabel('전체', { exact: true }).fill('64');
  await pollObservation(
    page,
    (o) =>
      o.unitCorrect === true &&
      o.totalCorrect === true &&
      o.partsCorrect?.every(Boolean) === true &&
      o.partsSumMatches === true,
  );
});

test('bar-model symbols: 막대를 숨기고 식 칸에 35 × 3/7', async ({ page }) => {
  await open(page, 'bar-model', { look: 'symbols' });
  await expect(canvas(page)).toHaveAttribute('data-look', 'symbols');
  await expect(canvas(page).locator('[data-part="cell"]')).toHaveCount(0);
  await expect(page.getByLabel('한 칸 크기')).toHaveCount(0);
  await highlightByClick(page);
  await page.getByLabel('식', { exact: true }).fill('35 * 3/7');
  await expect(page.getByLabel('식', { exact: true })).toHaveValue('35 × 3/7');
  await pollObservation(page, (o) => o.exprValue === '15' && o.exprMatchesPart === 0);
  await page.getByLabel('식', { exact: true }).fill('35 ÷ 3');
  await pollObservation(
    page,
    (o) =>
      o.exprMatchesPart === null &&
      (o.misconceptions ?? []).includes('MC-PROPORTION-DIVIDE-BY-RATIO-TERM'),
  );
  await page.getByLabel('식', { exact: true }).fill('35 × 4/7');
  await pollObservation(page, (o) => o.exprMatchesPart === 1);
  await page.getByLabel('형 몫').fill('15');
  await pollObservation(page, (o) => o.partsCorrect?.[0] === true);
});

test('bar-model: 터치 타깃 — 문장 토큰·형광펜 단추가 48px 높이 이상', async ({ page }) => {
  await open(page, 'bar-model');
  const tokens = page.locator('[data-token-index]');
  expect(await tokens.count()).toBeGreaterThan(8);
  for (let i = 0; i < (await tokens.count()); i += 1) {
    await expectMinHeight(tokens.nth(i), 48, `토큰 ${i}`);
  }
  for (const name of ['전체 칠하기', '비 칠하기', '지우기']) {
    await expectMinHeight(button(page, name), 48, name);
  }
});

for (const look of ['bars', 'symbols'] as const) {
  test(`화면 기준: bar-model ${look} 첫 화면`, async ({ page }) => {
    await open(page, 'bar-model', { look });
    await highlightByClick(page);
    if (look === 'bars') await page.getByLabel('한 칸 크기').fill('5');
    await page.getByLabel('형 몫').fill('15');
    if (look === 'symbols') await page.getByLabel('식', { exact: true }).fill('35 × 4/7');
    await expect(canvas(page)).toHaveAttribute('data-look', look);
    await expectPageSnapshot(page, `ratio-bar-model-${look}.png`);
  });
}

test('힌트 ② unit-count: 모든 칸에 1부터 번호, 전체 괄호 위에 모두 7칸', async ({ page }) => {
  await open(page, 'bar-model', {}, 'stage=fit&overlay=unit-count');
  await toggleOverlay(page);
  const layer = await expectAligned(page, 'unit-count');
  await expect(layer.locator('[data-part="cell-number"]')).toHaveCount(7);
  await expect(layer.locator('[data-part="cell-number"]').last()).toHaveText('7');
  await expect(layer.locator('[data-part="all-cells"]')).toHaveText('모두 7칸');
  // 값(한 칸 크기·몫)은 쓰지 않는다.
  expect(await layer.textContent()).not.toMatch(/(^|[^0-9])(5|15|20)([^0-9]|$)/);
});

test('힌트 ② share-bracket: 한 사람 줄을 묶고 a칸 = 한 칸 × a, 값 글은 없다', async ({ page }) => {
  await open(page, 'bar-model', {}, 'stage=fit&overlay=share-bracket');
  await toggleOverlay(page);
  const layer = await expectAligned(page, 'share-bracket');
  await expect(layer.locator('[data-part="share-bracket"]')).toHaveAttribute('data-row', '0');
  await expect(layer.locator('[data-part="share-label"]')).toHaveText('3칸 = 한 칸 × 3');
  await page.getByLabel('형 몫').fill('15');
  // 형 몫을 썼으니 아직 안 쓴 동생 줄로 옮긴다.
  await expect(layer.locator('[data-part="share-bracket"]')).toHaveAttribute('data-row', '1');
  await expect(layer.locator('[data-part="share-label"]')).toHaveText('4칸 = 한 칸 × 4');
});

test('bar-model symbols: 오버레이는 그리지 않는다', async ({ page }) => {
  await open(page, 'bar-model', { look: 'symbols' }, 'stage=fit&overlay=unit-count');
  await toggleOverlay(page);
  await expect(page.locator('[data-overlay="unit-count"] svg')).toHaveCount(0);
});
