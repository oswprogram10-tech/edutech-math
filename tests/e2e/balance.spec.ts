import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

/**
 * E06 양팔저울(equation) 샌드박스 E2E. 아이패드(WebKit)·크롬북·전자칠판 뷰포트에서 모두 돈다.
 *
 * - 넣어 보기 → 기울기·수평, 양쪽 빼기로 □ 남기기, 예측 잠금, 키보드만으로 한 과제
 * - look 세 가지 첫 화면 기준 이미지, 힌트 ② 오버레이 둘이 본 캔버스와 1px 안에 겹침
 * - 좁은 판에서 최소 배율 0.6 + 판 안 스크롤, 터치 타깃 48/64px
 */

test.describe.configure({ timeout: 120_000 });

interface ObservationRecord {
  readonly mode?: string;
  readonly balanced?: boolean;
  readonly tilt?: string;
  readonly tryValue?: string | null;
  readonly tries?: string[];
  readonly boxIsolated?: boolean;
  readonly boxValue?: string | null;
  readonly bothSidesOps?: number;
  readonly oneSideOps?: number;
  readonly prediction?: string | null;
  readonly predictionLocked?: boolean;
  readonly misconceptions?: string[];
}

async function readObservation(page: Page): Promise<ObservationRecord> {
  const text = await page.getByTestId('observation').textContent();
  return JSON.parse(text ?? '{}') as ObservationRecord;
}

async function pollObservation(
  page: Page,
  check: (observation: ObservationRecord) => boolean,
): Promise<void> {
  await expect.poll(async () => check(await readObservation(page))).toBe(true);
}

async function open(page: Page, config: unknown = {}, query = 'stage=fit'): Promise<void> {
  const params = new URLSearchParams({ config: JSON.stringify(config) });
  for (const [key, value] of new URLSearchParams(query)) params.set(key, value);
  await page.goto(`/?${params.toString()}#/sandbox/E06`);
  await expect(page.getByRole('heading', { name: '양팔저울' })).toBeVisible();
  await pollObservation(page, (o) => o.mode === 'equation');
}

function pad(page: Page, name: string): Locator {
  return page.getByRole('button', { name, exact: true });
}

function canvas(page: Page): Locator {
  return page.getByTestId('balance-canvas');
}

async function writeDigits(page: Page, digits: string): Promise<void> {
  for (const digit of digits) await pad(page, digit).click();
}

/** □에 넣을 수 칸을 비우고 수를 쓴 뒤 [넣어 보기]. */
async function tryValue(page: Page, digits: string): Promise<void> {
  await page.getByTestId('try-field').click();
  for (let i = 0; i < 4; i += 1) await pad(page, '지우기').click();
  await writeDigits(page, digits);
  await pad(page, '넣어 보기').click();
}

async function amount(page: Page, digits: string): Promise<void> {
  await page.getByTestId('amount-field').click();
  for (let i = 0; i < 4; i += 1) await pad(page, '지우기').click();
  await writeDigits(page, digits);
}

const ADD_BOX = { left: [{ num: 25 }, { box: true }], right: [{ num: 43 }] };
const NO_BOX = { left: [{ num: 20 }, { num: 15 }], right: [{ num: 35 }] };

test('□에 수를 넣어 보면 저울이 기울고, 맞는 수에서 수평이 된다', async ({ page }) => {
  await open(page, ADD_BOX);
  await expect(canvas(page)).toHaveAttribute('data-tilt', 'unknown');
  await expect(page.getByTestId('balance-result')).toHaveText('□에 수를 넣어 보세요');

  await tryValue(page, '17');
  await expect(canvas(page)).toHaveAttribute('data-tilt', 'right');
  await expect(page.getByTestId('balance-result')).toHaveText('오른쪽이 더 무거워요');
  await pollObservation(page, (o) => o.tilt === 'right' && o.balanced === false);

  await tryValue(page, '19');
  await expect(canvas(page)).toHaveAttribute('data-tilt', 'left');
  await expect(page.getByTestId('balance-result')).toHaveText('왼쪽이 더 무거워요');

  await tryValue(page, '18');
  await expect(canvas(page)).toHaveAttribute('data-tilt', 'level');
  await expect(page.getByTestId('balance-result')).toHaveText('수평이에요');
  await pollObservation(
    page,
    (o) => o.balanced === true && o.boxValue === '18' && o.tries?.length === 3,
  );
});

test('틀린 합(68)을 넣으면 MC-EQUAL-ANSWER가 기록된다', async ({ page }) => {
  await open(page, ADD_BOX);
  await tryValue(page, '68');
  await pollObservation(page, (o) => (o.misconceptions ?? []).includes('MC-EQUAL-ANSWER'));
  await expect(canvas(page)).toHaveAttribute('data-tilt', 'left');
});

test('양쪽에서 같은 수를 빼서 □만 남긴다', async ({ page }) => {
  await open(page, ADD_BOX);
  await amount(page, '26');
  await pad(page, '양쪽에서 빼기').click();
  await expect(page.getByTestId('balance-message')).toHaveText('그만큼 뺄 수 있는 막대가 없어요');
  await pollObservation(page, (o) => o.bothSidesOps === 0);

  await amount(page, '25');
  await pad(page, '양쪽에서 빼기').click();
  await pollObservation(page, (o) => o.boxIsolated === true && o.bothSidesOps === 1);
  await expect(page.getByTestId('balance-message')).toHaveText('');
  // 막대 값은 학생이 만든 결과(18)라서 보여도 된다.
  await expect(page.locator('[data-total="right"]')).toHaveText('합 18');

  // 그 수를 넣으면 수평이다.
  await tryValue(page, '18');
  await pollObservation(page, (o) => o.balanced === true && o.boxValue === '18');
  await expect(canvas(page)).toHaveAttribute('data-tilt', 'level');
});

test('한쪽에만 더하면 기울고, 양쪽에 같이 더하면 수평이 유지된다', async ({ page }) => {
  await open(page, { ...NO_BOX, allowOneSide: true });
  await expect(canvas(page)).toHaveAttribute('data-tilt', 'level');
  await amount(page, '5');
  await pad(page, '왼쪽에만 더하기').click();
  await expect(canvas(page)).toHaveAttribute('data-tilt', 'left');
  await pollObservation(page, (o) => o.oneSideOps === 1 && o.balanced === false);
  await pad(page, '처음으로').click();
  await expect(canvas(page)).toHaveAttribute('data-tilt', 'level');
  await pad(page, '양쪽에 더하기').click();
  await expect(canvas(page)).toHaveAttribute('data-tilt', 'level');
  await pollObservation(
    page,
    (o) => o.balanced === true && o.bothSidesOps === 1 && o.oneSideOps === 1,
  );
});

test('예측 잠금: 예/아니요를 고르기 전에는 조작 단추가 막힌다', async ({ page }) => {
  await open(page, { ...ADD_BOX, predict: true });
  await expect(page.getByText('이 저울은 수평일까요?')).toBeVisible();
  for (const name of ['넣어 보기', '양쪽에 더하기', '양쪽에서 빼기', '1']) {
    await expect(pad(page, name)).toBeDisabled();
  }
  await pad(page, '아니요').click();
  await pollObservation(page, (o) => o.prediction === 'no' && o.predictionLocked === true);
  await expect(page.getByText('이 저울은 수평일까요?')).toHaveCount(0);
  await expect(pad(page, '넣어 보기')).toBeEnabled();
  await tryValue(page, '18');
  await pollObservation(page, (o) => o.balanced === true);
});

test('키보드만으로: 숫자와 Enter로 넣어 보고, Tab으로 단추에 닿아 양쪽에서 뺀다', async ({
  page,
}) => {
  await open(page, ADD_BOX);
  await page.getByTestId('try-field').focus();
  await page.keyboard.type('17');
  await page.keyboard.press('Enter');
  await pollObservation(page, (o) => o.tryValue === '17' && o.tilt === 'right');
  await page.keyboard.press('Backspace');
  await page.keyboard.press('Backspace');
  await page.keyboard.type('18');
  await page.keyboard.press('Enter');
  await pollObservation(page, (o) => o.balanced === true);

  // Tab으로 수 칸으로 옮기고 25를 쓴다. 그다음 [양쪽에서 빼기]까지 Tab으로 간다.
  await page.keyboard.press('Tab');
  await expect(page.getByTestId('amount-field')).toBeFocused();
  await page.keyboard.type('25');
  let reached = false;
  for (let i = 0; i < 30; i += 1) {
    await page.keyboard.press('Tab');
    const name = await page.evaluate(() => document.activeElement?.textContent ?? '');
    if (name === '양쪽에서 빼기') {
      reached = true;
      break;
    }
  }
  expect(reached, 'Tab으로 [양쪽에서 빼기]에 닿아야 합니다.').toBe(true);
  await page.keyboard.press('Enter');
  await pollObservation(page, (o) => o.boxIsolated === true && o.bothSidesOps === 1);
});

/** 화면 기준 이미지: 샌드박스 `?stage=fit` 판 전체(페이지 화면). 크롬북·아이패드만 찍는다. */
async function expectPageSnapshot(page: Page, name: string): Promise<void> {
  test.skip(test.info().project.name === 'board', '기준 이미지는 크롬북·아이패드만 둔다.');
  await page.waitForTimeout(600);
  await page.evaluate(() => window.scrollTo(0, 0));
  // T199: 좁은 판에서는 엔진 바깥 상자(.wrap)가 세로로 스크롤한다.
  await page
    .locator('[data-target-size]')
    .first()
    .evaluate((element) => element.scrollTo(0, 0));
  await expect(page).toHaveScreenshot(name, { fullPage: true, animations: 'disabled' });
}

for (const look of ['scale', 'bars', 'symbols'] as const) {
  test(`화면 기준: look ${look} 첫 화면`, async ({ page }) => {
    await open(page, { ...ADD_BOX, look });
    await expect(canvas(page)).toHaveAttribute('data-look', look);
    await expectPageSnapshot(page, `balance-${look}.png`);
  });
}

test('화면 기준: scale 17을 넣어 기울어진 화면', async ({ page }) => {
  await open(page, ADD_BOX);
  await tryValue(page, '17');
  await expect(canvas(page)).toHaveAttribute('data-tilt', 'right');
  await expectPageSnapshot(page, 'balance-scale-tilt.png');
});

/** 오버레이 svg 상자가 balance-canvas 상자와 1px 이내로 같다(overlay-alignment 방식). */
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

test('힌트 ② match-bars가 본 캔버스와 겹치고 값을 쓰지 않는다', async ({ page }) => {
  await open(page, ADD_BOX, 'stage=fit&overlay=match-bars');
  await toggleOverlay(page);
  const layer = await expectAligned(page, 'match-bars');
  await expect(layer.locator('[data-part="match-segment"]')).toHaveCount(1);
  await expect(layer).toContainText('?');
  await expect(layer).not.toContainText('18');
  // 점선 구간이 오른쪽 접시 막대 아래, 본 캔버스 안에 있다.
  const canvasBox = await canvas(page).boundingBox();
  const segment = await layer.locator('[data-part="match-segment"]').boundingBox();
  if (!canvasBox || !segment) throw new Error('상자를 찾지 못했습니다.');
  expect(segment.x).toBeGreaterThanOrEqual(canvasBox.x + canvasBox.width / 2 - 1);
  expect(segment.y + segment.height).toBeLessThanOrEqual(canvasBox.y + canvasBox.height + 1);
});

test('힌트 ② big-tilt가 본 캔버스와 겹치고 두 쪽 합과 ≠를 쓴다', async ({ page }) => {
  await open(page, ADD_BOX, 'stage=fit&overlay=big-tilt');
  await tryValue(page, '68');
  await toggleOverlay(page);
  const layer = await expectAligned(page, 'big-tilt');
  await expect(layer.locator('[data-part="totals"]')).toHaveText('93 ≠ 43');
  await expect(layer.locator('[data-part="ghost-scale"]')).toHaveCount(1);
});

test('힌트 ② 오버레이: look bars에서도 본 캔버스와 겹친다', async ({ page }) => {
  await open(page, { ...ADD_BOX, look: 'bars' }, 'stage=fit&overlay=match-bars');
  await toggleOverlay(page);
  await expectAligned(page, 'match-bars');
});

test('look symbols에서는 오버레이를 그리지 않는다', async ({ page }) => {
  await open(page, { ...ADD_BOX, look: 'symbols' }, 'stage=fit&overlay=match-bars');
  await toggleOverlay(page);
  await expect(page.locator('[data-overlay="match-bars"] svg')).toHaveCount(0);
});

test('넓은 판은 줄여서 맞추고, 좁은 판은 최소 배율 0.6에서 멈추고 판 안에서 스크롤한다', async ({
  page,
}) => {
  test.skip(test.info().project.name !== 'chromebook', '크롬북 뷰포트에서만 판 크기를 바꿔 본다.');
  await open(page, ADD_BOX);
  const wide = await canvas(page).boundingBox();
  if (!wide) throw new Error('캔버스를 찾지 못했습니다.');
  expect(wide.width / 1000).toBeGreaterThanOrEqual(0.6);
  await expect(page.getByTestId('balance-board')).toHaveAttribute('data-scroll', 'false');

  // 크롬북의 좁은 두 판(한 판이 약 520px)처럼 좁게 줄인다.
  await page.setViewportSize({ width: 520, height: 700 });
  await expect(page.getByTestId('balance-board')).toHaveAttribute('data-scroll', 'true');
  const narrow = await canvas(page).boundingBox();
  if (!narrow) throw new Error('캔버스를 찾지 못했습니다.');
  expect(narrow.width).toBeGreaterThanOrEqual(599);
  expect(narrow.width).toBeLessThanOrEqual(601);
  expect(narrow.height).toBeGreaterThanOrEqual(359);
  const scrolls = await page
    .getByTestId('balance-board')
    .evaluate((element) => element.scrollWidth > element.clientWidth);
  expect(scrolls).toBe(true);
  // 조작 칸은 스크롤 상자 밖이라 단추가 그대로 보인다.
  await expect(pad(page, '넣어 보기')).toBeVisible();
  const inside = await pad(page, '넣어 보기').evaluate(
    (button) => !document.querySelector('[data-testid="balance-board"]')?.contains(button),
  );
  expect(inside).toBe(true);
});

async function expectMin(locator: Locator, min: number, label: string): Promise<void> {
  const box = await locator.boundingBox();
  if (!box) throw new Error(`${label}: 상자를 찾지 못했습니다.`);
  expect(Math.min(box.width, box.height), label).toBeGreaterThanOrEqual(min - 0.5);
}

for (const size of [48, 64] as const) {
  test(`터치 타깃 ${size}: 단추와 수 칸이 ${size}px 이상`, async ({ page }) => {
    await open(page, { ...ADD_BOX, allowOneSide: true });
    if (size === 64) await page.getByRole('button', { name: '터치 48px' }).click();
    for (const name of [
      '넣어 보기',
      '양쪽에 더하기',
      '양쪽에서 빼기',
      '왼쪽에만 더하기',
      '처음으로',
      '5',
      '지우기',
    ]) {
      await pad(page, name).scrollIntoViewIfNeeded();
      await expectMin(pad(page, name), size, name);
    }
    await expectMin(page.getByTestId('try-field'), size, '넣을 수 칸');
  });
}
