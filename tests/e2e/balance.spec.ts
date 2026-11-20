import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

/**
 * E06 양팔저울(equation·proportion·compare) 샌드박스 E2E. 아이패드(WebKit)·크롬북·전자칠판 뷰포트에서 모두 돈다.
 *
 * - 넣어 보기 → 기울기·수평, 양쪽 빼기로 □ 남기기, 예측 잠금, 키보드만으로 한 과제
 * - look 세 가지 첫 화면 기준 이미지, 힌트 ② 오버레이 둘이 본 캔버스와 1px 안에 겹침
 * - 좁은 판에서 최소 배율 0.6 + 판 안 스크롤, 터치 타깃 48/64px
 * - proportion(T196): 슬라이더·키보드로 수평, 카드 고르기, 항 짝 고르기, 오버레이 셋, look 셋 기준 이미지
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
  readonly leftArea?: string | null;
  readonly rightArea?: string | null;
  readonly cardIndex?: number | null;
  readonly isProportion?: boolean | null;
  readonly pair?: number[] | null;
  readonly pairing?: string | null;
  readonly left?: string[];
  readonly right?: string[];
  readonly weighings?: number;
  readonly pairsCompared?: string[];
  readonly orderHeavyFirst?: string[];
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

// ───────────────────────── proportion (T196) ─────────────────────────

/** proportion 모드로 연다(샌드박스는 설정의 mode를 덮어쓰므로 모드 상자로 고른다). */
async function openProportion(
  page: Page,
  config: Record<string, unknown> = {},
  query = 'stage=fit',
): Promise<void> {
  const params = new URLSearchParams({ config: JSON.stringify(config) });
  for (const [key, value] of new URLSearchParams(query)) params.set(key, value);
  await page.goto(`/?${params.toString()}#/sandbox/E06`);
  await expect(page.getByRole('heading', { name: '양팔저울' })).toBeVisible();
  await page.getByLabel('모드').selectOption('proportion');
  await pollObservation(page, (o) => o.mode === 'proportion');
}

const RATIO = { equation: '3 : 5 = □ : 20' };

function slider(page: Page): Locator {
  return page.getByTestId('proportion-slider');
}

/** 슬라이더 트랙에서 값(1~20)에 해당하는 자리를 마우스로 누른다. */
async function clickSliderAt(page: Page, value: number): Promise<void> {
  const target = slider(page);
  await target.scrollIntoViewIfNeeded();
  const box = await target.boundingBox();
  if (!box) throw new Error('슬라이더를 찾지 못했습니다.');
  const ratio = (value - 1) / 19;
  await target.click({ position: { x: 14 + ratio * (box.width - 28), y: box.height / 2 } });
}

test('proportion: 슬라이더를 눌러 값을 바꾸면 기울기가 바뀌고 12에서 수평이다', async ({
  page,
}) => {
  await openProportion(page, RATIO);
  await expect(canvas(page)).toHaveAttribute('data-tilt', 'unknown');
  await expect(page.getByTestId('balance-result')).toHaveText('□에 수를 넣어 보세요');
  await pollObservation(page, (o) => o.leftArea === '60' && o.rightArea === null);

  await clickSliderAt(page, 11);
  await pollObservation(page, (o) => o.tryValue === '11' && o.tilt === 'left');
  await expect(page.getByTestId('balance-result')).toHaveText('왼쪽이 더 무거워요');
  await expect(page.locator('[data-total="right"]')).toHaveText('모두 55칸');

  await clickSliderAt(page, 14);
  await pollObservation(page, (o) => o.tryValue === '14' && o.tilt === 'right');

  await clickSliderAt(page, 12);
  await pollObservation(
    page,
    (o) => o.balanced === true && o.boxValue === '12' && o.isProportion === true,
  );
  await expect(canvas(page)).toHaveAttribute('data-tilt', 'level');
  await expect(page.getByTestId('balance-result')).toHaveText('수평이에요');
  await expect(page.locator('[data-total="left"]')).toHaveText('모두 60칸');
  await expect(page.locator('[data-total="right"]')).toHaveText('모두 60칸');
});

test('proportion: 키보드 ←→와 −/+ 단추로 값을 바꾼다', async ({ page }) => {
  await openProportion(page, RATIO);
  await slider(page).focus();
  for (let i = 0; i < 12; i += 1) await page.keyboard.press('ArrowRight');
  await pollObservation(page, (o) => o.tryValue === '12' && o.balanced === true);
  await page.keyboard.press('ArrowLeft');
  await pollObservation(page, (o) => o.tryValue === '11' && o.tilt === 'left');
  await page.keyboard.press('End');
  await pollObservation(page, (o) => o.tryValue === '20' && o.tilt === 'right');
  await page.keyboard.press('Home');
  await pollObservation(page, (o) => o.tryValue === '1');

  await page.getByTestId('slider-plus').scrollIntoViewIfNeeded();
  await page.getByTestId('slider-plus').click();
  await pollObservation(page, (o) => o.tryValue === '2');
  await page.getByTestId('slider-minus').click();
  await page.getByTestId('slider-minus').click();
  await pollObservation(page, (o) => o.tryValue === '1');
  await expect(slider(page)).toHaveAttribute('aria-valuenow', '1');
});

test('proportion: 차를 지킨 값(18)을 넣으면 MC-RATIO-ADDITIVE가 기록된다', async ({ page }) => {
  await openProportion(page, RATIO);
  await clickSliderAt(page, 18);
  await pollObservation(
    page,
    (o) => o.tryValue === '18' && (o.misconceptions ?? []).includes('MC-RATIO-ADDITIVE'),
  );
  await expect(canvas(page)).toHaveAttribute('data-tilt', 'right');
});

test('proportion: 카드를 골라 저울에 올린다', async ({ page }) => {
  await openProportion(page, { cards: ['2 : 3 = 4 : 6', '2 : 3 = 3 : 4', '1 : 2 = 3 : 6'] });
  await expect(page.getByTestId('balance-result')).toHaveText('카드를 골라 저울에 올려 보세요');
  await pollObservation(page, (o) => o.cardIndex === null && o.tilt === 'unknown');
  await expect(page.locator('[data-grid]')).toHaveCount(0);

  await page.getByTestId('card-0').scrollIntoViewIfNeeded();
  await pad(page, '2 : 3 = 4 : 6').click();
  await pollObservation(
    page,
    (o) => o.cardIndex === 0 && o.isProportion === true && o.balanced === true,
  );
  await expect(canvas(page)).toHaveAttribute('data-tilt', 'level');
  await expect(page.locator('[data-grid]')).toHaveCount(2);

  await pad(page, '2 : 3 = 3 : 4').click();
  await pollObservation(
    page,
    (o) => o.cardIndex === 1 && o.isProportion === false && o.balanced === false,
  );
  await expect(canvas(page)).toHaveAttribute('data-tilt', 'right');
  await expect(page.getByTestId('balance-result')).toHaveText('오른쪽이 더 무거워요');
});

test('proportion pairSelect: 항 두 개를 골라 왼쪽 격자를 만든다', async ({ page }) => {
  await openProportion(page, { equation: '3 : 5 = 12 : 20', pairSelect: true });
  await expect(page.getByTestId('balance-result')).toHaveText('항 두 개를 골라 왼쪽에 올려 보세요');
  await page.getByTestId('term-0').scrollIntoViewIfNeeded();

  // 외항 짝(첫째·넷째) → 수평
  await page.getByTestId('term-0').click();
  await page.getByTestId('term-3').click();
  await pollObservation(
    page,
    (o) => o.pairing === 'extremes-means' && o.balanced === true && o.leftArea === '60',
  );
  await expect(page.getByTestId('pair-message')).toHaveText('왼쪽에 올린 항: 첫째, 넷째');

  // 어긋난 짝(첫째·셋째) → MC-PROPORTION-CROSS-WRONG, 기울어짐
  await page.getByTestId('term-0').click();
  await page.getByTestId('term-2').click();
  await pollObservation(
    page,
    (o) =>
      o.pairing === 'other' &&
      o.balanced === false &&
      (o.misconceptions ?? []).includes('MC-PROPORTION-CROSS-WRONG'),
  );
  await expect(canvas(page)).toHaveAttribute('data-tilt', 'right');
});

test('proportion: [처음으로]는 □ 값을 비운다', async ({ page }) => {
  await openProportion(page, RATIO);
  await clickSliderAt(page, 12);
  await pollObservation(page, (o) => o.balanced === true);
  await pad(page, '처음으로').scrollIntoViewIfNeeded();
  await pad(page, '처음으로').click();
  await pollObservation(page, (o) => o.tryValue === null && o.tilt === 'unknown');
});

test('힌트 ② cross-brackets: 바깥쪽 실선·안쪽 점선 괄호가 본 캔버스와 겹친다', async ({ page }) => {
  await openProportion(page, RATIO, 'stage=fit&overlay=cross-brackets');
  await toggleOverlay(page);
  const layer = await expectAligned(page, 'cross-brackets');
  await expect(layer.locator('[data-part="outer"]')).toHaveText('바깥쪽');
  await expect(layer.locator('[data-part="inner"]')).toHaveText('안쪽');
  await expect(layer.locator('[data-part="outer"] path')).not.toHaveAttribute(
    'stroke-dasharray',
    /.+/,
  );
  await expect(layer.locator('[data-part="inner"] path')).toHaveAttribute('stroke-dasharray', /.+/);
  // 바깥쪽 괄호는 식 줄 위, 안쪽 괄호는 식 줄 아래에 있다.
  const line = await canvas(page).locator('[data-testid="proportion-equation"]').boundingBox();
  const outer = await layer.locator('[data-part="outer"] path').boundingBox();
  const inner = await layer.locator('[data-part="inner"] path').boundingBox();
  if (!line || !outer || !inner) throw new Error('상자를 찾지 못했습니다.');
  expect(outer.y + outer.height).toBeLessThanOrEqual(line.y + line.height / 2);
  expect(inner.y).toBeGreaterThanOrEqual(line.y + line.height / 2);
  await expect(layer).not.toContainText(/[0-9]/);
});

test('힌트 ② area-diff: 두 격자를 겹친 그림이 본 캔버스와 겹치고 숫자를 쓰지 않는다', async ({
  page,
}) => {
  await openProportion(page, RATIO, 'stage=fit&overlay=area-diff');
  await clickSliderAt(page, 11);
  await pollObservation(page, (o) => o.tryValue === '11');
  await toggleOverlay(page);
  const layer = await expectAligned(page, 'area-diff');
  await expect(layer.locator('[data-part="left-only"]')).toHaveCount(1);
  await expect(layer.locator('[data-part="right-only"]')).toHaveCount(1);
  await expect(layer.locator('[data-part="overlap"]')).toHaveText('');
  await expect(layer).not.toContainText(/[0-9]/);
});

test('힌트 ② area-diff: □를 넣기 전에는 그리지 않는다', async ({ page }) => {
  await openProportion(page, RATIO, 'stage=fit&overlay=area-diff');
  await toggleOverlay(page);
  await expect(page.locator('[data-overlay="area-diff"] svg')).toHaveCount(0);
});

test('힌트 ② big-tilt(proportion): 두 넓이와 ≠를 쓰고 본 캔버스와 겹친다', async ({ page }) => {
  await openProportion(page, RATIO, 'stage=fit&overlay=big-tilt');
  await clickSliderAt(page, 18);
  await pollObservation(page, (o) => o.tryValue === '18');
  await toggleOverlay(page);
  const layer = await expectAligned(page, 'big-tilt');
  await expect(layer.locator('[data-part="totals"]')).toHaveText('60 ≠ 90');
  await expect(layer.locator('[data-part="ghost-scale"]')).toHaveCount(1);
});

for (const look of ['scale', 'grid', 'symbols'] as const) {
  test(`화면 기준: proportion look ${look} 첫 화면`, async ({ page }) => {
    await openProportion(page, { ...RATIO, look });
    await expect(canvas(page)).toHaveAttribute('data-look', look);
    await expectPageSnapshot(page, `balance-proportion-${look}.png`);
  });
}

test('화면 기준: proportion scale 11을 넣어 기울어진 화면', async ({ page }) => {
  await openProportion(page, RATIO);
  await clickSliderAt(page, 11);
  await expect(canvas(page)).toHaveAttribute('data-tilt', 'left');
  await expectPageSnapshot(page, 'balance-proportion-scale-tilt.png');
});

test('proportion: 좁은 판은 최소 배율 0.6에서 멈추고 조작 칸은 판 밖에 남는다', async ({
  page,
}) => {
  test.skip(test.info().project.name !== 'chromebook', '크롬북 뷰포트에서만 판 크기를 바꿔 본다.');
  await openProportion(page, RATIO);
  const wide = await canvas(page).boundingBox();
  if (!wide) throw new Error('캔버스를 찾지 못했습니다.');
  expect(wide.width / 1000).toBeGreaterThanOrEqual(0.6);
  await expect(page.getByTestId('balance-board')).toHaveAttribute('data-scroll', 'false');

  await page.setViewportSize({ width: 520, height: 700 });
  await expect(page.getByTestId('balance-board')).toHaveAttribute('data-scroll', 'true');
  const narrow = await canvas(page).boundingBox();
  if (!narrow) throw new Error('캔버스를 찾지 못했습니다.');
  expect(narrow.width).toBeGreaterThanOrEqual(599);
  expect(narrow.width).toBeLessThanOrEqual(601);
  expect(narrow.height).toBeGreaterThanOrEqual(359);
  await expect(slider(page)).toBeVisible();
  const outside = await slider(page).evaluate(
    (element) => !document.querySelector('[data-testid="balance-board"]')?.contains(element),
  );
  expect(outside).toBe(true);
});

for (const size of [48, 64] as const) {
  test(`proportion 터치 타깃 ${size}: 카드·항 단추가 ${size}px 이상`, async ({ page }) => {
    await openProportion(page, { cards: ['2 : 3 = 4 : 6', '2 : 3 = 3 : 4'], pairSelect: true });
    if (size === 64) await page.getByRole('button', { name: '터치 48px' }).click();
    for (const name of ['2 : 3 = 4 : 6', '처음으로']) {
      await pad(page, name).scrollIntoViewIfNeeded();
      await expectMin(pad(page, name), size, name);
    }
    await pad(page, '2 : 3 = 4 : 6').click();
    for (const index of [0, 1, 2, 3]) {
      await page.getByTestId(`term-${index}`).scrollIntoViewIfNeeded();
      await expectMin(page.getByTestId(`term-${index}`), size, `항 단추 ${index}`);
    }
  });

  test(`proportion 터치 타깃 ${size}: 슬라이더와 −/+ 단추가 ${size}px 이상`, async ({ page }) => {
    await openProportion(page, RATIO);
    if (size === 64) await page.getByRole('button', { name: '터치 48px' }).click();
    for (const locator of [
      slider(page),
      page.getByTestId('slider-minus'),
      page.getByTestId('slider-plus'),
    ]) {
      await locator.scrollIntoViewIfNeeded();
      await expectMin(locator, size, '슬라이더 조작');
    }
  });
}

// ───────────────────────── compare (T206) ─────────────────────────

/** compare 모드로 연다(샌드박스 기본: 큰 스펀지 2·작은 쇠공 9·사과 3). */
async function openCompare(
  page: Page,
  config: Record<string, unknown> = {},
  query = 'stage=fit',
): Promise<void> {
  const params = new URLSearchParams({ config: JSON.stringify(config) });
  for (const [key, value] of new URLSearchParams(query)) params.set(key, value);
  await page.goto(`/?${params.toString()}#/sandbox/E06`);
  await expect(page.getByRole('heading', { name: '양팔저울' })).toBeVisible();
  await page.getByLabel('모드').selectOption('compare');
  await pollObservation(page, (o) => o.mode === 'compare');
}

function item(page: Page, id: string): Locator {
  return page.locator(`[data-item="${id}"]`);
}

/** 물건을 끌어 접시·선반에 놓는다. 좌표는 판 상자 너비로만 배율을 구한다(논리 높이를 가정하지 않는다). */
async function dragItem(page: Page, id: string, target: 'left' | 'right' | 'shelf'): Promise<void> {
  await canvas(page).scrollIntoViewIfNeeded();
  await page.waitForTimeout(500); // 접시 옮김 애니메이션(400ms)이 끝난 뒤의 자리를 잡는다.
  const board = await canvas(page).boundingBox();
  const from = await item(page, id).boundingBox();
  if (!board || !from) throw new Error('판이나 물건을 찾지 못했습니다.');
  const scale = board.width / 1000;
  const drop = { left: [180, 300], right: [820, 300], shelf: [500, 540] }[target] as [
    number,
    number,
  ];
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(board.x + drop[0] * scale, board.y + drop[1] * scale, { steps: 8 });
  await page.mouse.up();
}

test('compare: 물건을 끌어 접시에 올리면 무거운 쪽으로 기울고 결과 글이 나온다', async ({
  page,
}) => {
  await openCompare(page);
  await expect(page.getByTestId('balance-result')).toHaveText('물건을 접시에 올려 보세요');
  await dragItem(page, 'sponge', 'left');
  await pollObservation(page, (o) => o.left?.join() === 'sponge');
  await expect(canvas(page)).toHaveAttribute('data-tilt', 'left');
  await expect(page.getByTestId('balance-result')).toHaveText('왼쪽이 더 무거워요');
  await dragItem(page, 'iron-ball', 'right');
  await pollObservation(page, (o) => o.right?.join() === 'iron-ball' && o.weighings === 1);
  // 큰 스펀지보다 작은 쇠공이 무겁다.
  await expect(canvas(page)).toHaveAttribute('data-tilt', 'right');
  await expect(page.getByTestId('balance-result')).toHaveText('오른쪽이 더 무거워요');
  // 접시의 물건을 끌어 선반으로 되돌린다.
  await dragItem(page, 'sponge', 'shelf');
  await pollObservation(page, (o) => o.left?.length === 0);
  await expect(item(page, 'sponge')).toHaveAttribute('data-place', 'shelf');
});

test('compare: 가득 찬 접시에는 올라가지 않는다', async ({ page }) => {
  await openCompare(page);
  await dragItem(page, 'sponge', 'left');
  await pollObservation(page, (o) => o.left?.join() === 'sponge');
  await dragItem(page, 'apple', 'left');
  await expect(page.getByTestId('compare-status')).toHaveText('접시가 가득 찼어요');
  expect((await readObservation(page)).left).toEqual(['sponge']);
});

test('compare: 키보드 L·R·Backspace로 물건을 옮긴다', async ({ page }) => {
  await openCompare(page);
  await item(page, 'apple').focus();
  await page.keyboard.press('l');
  await pollObservation(page, (o) => o.left?.join() === 'apple');
  await item(page, 'iron-ball').focus();
  await page.keyboard.press('r');
  await pollObservation(page, (o) => o.right?.join() === 'iron-ball' && o.weighings === 1);
  await expect(canvas(page)).toHaveAttribute('data-tilt', 'right');
  // 옮긴 뒤에도 초점이 물건에 남아 Backspace로 선반에 되돌릴 수 있다.
  await page.keyboard.press('Backspace');
  await pollObservation(page, (o) => o.right?.length === 0);
  await item(page, 'apple').focus();
  await page.keyboard.press('r');
  await pollObservation(page, (o) => o.right?.join() === 'apple' && o.left?.length === 0);
});

test('compare: 조작 칸 단추로도 옮기고 [처음으로]는 접시만 비운다', async ({ page }) => {
  await openCompare(page);
  await item(page, 'sponge').focus();
  await page.getByTestId('compare-left').click();
  await item(page, 'apple').focus();
  await page.getByTestId('compare-right').click();
  await pollObservation(
    page,
    (o) => o.left?.join() === 'sponge' && o.right?.join() === 'apple' && o.weighings === 1,
  );
  await pad(page, '처음으로').scrollIntoViewIfNeeded();
  await pad(page, '처음으로').click();
  await pollObservation(page, (o) => o.left?.length === 0 && o.right?.length === 0);
  expect((await readObservation(page)).weighings).toBe(1);
});

test('compare: 세 물건을 두 번 비교하면 weighings 2, 같은 조합은 다시 세지 않는다', async ({
  page,
}) => {
  await openCompare(page);
  await item(page, 'iron-ball').focus();
  await page.keyboard.press('l');
  await item(page, 'apple').focus();
  await page.keyboard.press('r');
  await pollObservation(page, (o) => o.weighings === 1);
  await page.keyboard.press('Backspace');
  await item(page, 'sponge').focus();
  await page.keyboard.press('r');
  await pollObservation(page, (o) => o.weighings === 2);
  await expect(canvas(page)).toHaveAttribute('data-tilt', 'left');
  // 사과를 다시 올려도 (쇠공 | 사과)는 이미 센 조합이다.
  await page.keyboard.press('Backspace');
  await item(page, 'apple').focus();
  await page.keyboard.press('r');
  await pollObservation(page, (o) => o.right?.join() === 'apple' && o.weighings === 2);
  const observation = await readObservation(page);
  expect(observation.pairsCompared).toEqual(['apple|iron-ball', 'iron-ball|sponge']);
  expect(observation.orderHeavyFirst).toEqual(['iron-ball', 'apple', 'sponge']);
});

test('힌트 ② size-vs-weight: 본 캔버스와 겹치고 숫자를 쓰지 않는다', async ({ page }) => {
  await openCompare(page, {}, 'stage=fit&overlay=size-vs-weight');
  await item(page, 'sponge').focus();
  await page.keyboard.press('l');
  await item(page, 'iron-ball').focus();
  await page.keyboard.press('r');
  await pollObservation(page, (o) => o.weighings === 1);
  await toggleOverlay(page);
  const layer = await expectAligned(page, 'size-vs-weight');
  await expect(layer).toContainText('크기');
  await expect(layer).toContainText('무게');
  await expect(layer).not.toContainText(/\d/);
  // 크기 막대는 큰 스펀지(왼쪽)가 길고, 무게 막대는 쇠공(오른쪽)이 길다.
  const width = async (name: string) =>
    (await layer.locator(`[data-bar="${name}"] rect`).boundingBox())?.width ?? 0;
  expect(await width('size-left')).toBeGreaterThan(await width('size-right'));
  expect(await width('weight-right')).toBeGreaterThan(await width('weight-left'));
});

test('힌트 ② size-vs-weight: 두 접시에 물건이 하나씩 없으면 그리지 않는다', async ({ page }) => {
  await openCompare(page, {}, 'stage=fit&overlay=size-vs-weight');
  await item(page, 'sponge').focus();
  await page.keyboard.press('l');
  await toggleOverlay(page);
  await expect(page.locator('[data-overlay="size-vs-weight"] svg')).toHaveCount(0);
});

test('화면 기준: compare 첫 화면', async ({ page }) => {
  await openCompare(page);
  await expect(item(page, 'sponge')).toBeVisible();
  await expectPageSnapshot(page, 'balance-compare.png');
});

test('화면 기준: compare 큰 스펀지와 작은 쇠공을 올려 기울어진 화면', async ({ page }) => {
  await openCompare(page);
  await item(page, 'sponge').focus();
  await page.keyboard.press('l');
  await item(page, 'iron-ball').focus();
  await page.keyboard.press('r');
  await expect(canvas(page)).toHaveAttribute('data-tilt', 'right');
  await expectPageSnapshot(page, 'balance-compare-tilt.png');
});

for (const size of [48, 64] as const) {
  test(`compare 터치 타깃 ${size}: 옮기기 단추와 [처음으로]가 ${size}px 이상`, async ({ page }) => {
    await openCompare(page);
    if (size === 64) await page.getByRole('button', { name: '터치 48px' }).click();
    await item(page, 'apple').focus();
    for (const testId of ['compare-left', 'compare-right', 'compare-shelf']) {
      await page.getByTestId(testId).scrollIntoViewIfNeeded();
      await expectMin(page.getByTestId(testId), size, testId);
    }
    await pad(page, '처음으로').scrollIntoViewIfNeeded();
    await expectMin(pad(page, '처음으로'), size, '처음으로');
  });
}
