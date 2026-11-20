import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

/**
 * E19 평균·가능성 실험실(leveling·seesaw·outlier·words·spinner·simulate) 샌드박스 E2E. 아이패드(WebKit)·크롬북·전자칠판 뷰포트.
 *
 * - leveling: 끌기·키보드로 고르게 / seesaw: 받침점 끌기·키보드로 수평 / outlier: 예측 → 끌기 → 평균선 이동
 * - words: 카드 끌어 놓기·키보드 / spinner: 장치 편집 → 돌리기(reduced-motion) / simulate: 세 칸 돌리기·10,000회 1초 안
 * - 힌트 ② 오버레이 여섯이 본 캔버스와 1px 안에 겹침
 * - 모드별 첫 화면 기준 이미지, 좁은 판에서 최소 배율 0.6 + 판 안 스크롤, 터치 타깃 48/64px
 */

test.describe.configure({ timeout: 120_000 });

interface Observation {
  readonly mode?: string;
  readonly heights?: number[];
  readonly moves?: number;
  readonly leveled?: boolean;
  readonly level?: string | null;
  readonly fulcrum?: string;
  readonly balanced?: boolean;
  readonly tilt?: string;
  readonly mean?: string;
  readonly initialMean?: string;
  readonly meanShift?: string;
  readonly values?: number[];
  readonly dragged?: boolean;
  readonly prediction?: string | null;
  readonly predictionLocked?: boolean;
  readonly placements?: Record<string, string | null>;
  readonly allPlaced?: boolean;
  readonly probabilities?: Record<string, string>;
  readonly trials?: number;
  readonly counts?: Record<string, number>;
  readonly last?: string[];
  readonly edits?: number;
  readonly runs?: number;
  readonly results?: {
    batch: number;
    counts: Record<string, number>;
    rel: Record<string, string>;
  }[];
  readonly allBatchesRun?: boolean;
}

async function readObservation(page: Page): Promise<Observation> {
  const text = await page.getByTestId('observation').textContent();
  return JSON.parse(text ?? '{}') as Observation;
}

async function pollObservation(page: Page, check: (o: Observation) => boolean): Promise<void> {
  await expect.poll(async () => check(await readObservation(page))).toBe(true);
}

type Mode = 'leveling' | 'seesaw' | 'outlier' | 'words' | 'spinner' | 'simulate';

async function open(
  page: Page,
  mode: Mode,
  config: Record<string, unknown> = {},
  query = 'stage=fit',
): Promise<void> {
  const params = new URLSearchParams({ config: JSON.stringify(config) });
  for (const [key, value] of new URLSearchParams(query)) params.set(key, value);
  await page.goto(`/?${params.toString()}#/sandbox/E19`);
  await expect(page.getByRole('heading', { name: '평균·가능성 실험실' })).toBeVisible();
  await page.getByLabel('모드').selectOption(mode);
  await pollObservation(page, (o) => o.mode === mode);
}

function button(page: Page, name: string): Locator {
  return page.getByRole('button', { name, exact: true });
}

function canvas(page: Page): Locator {
  return page.getByTestId('chance-canvas');
}

/** 논리 좌표(1000×600)를 화면 좌표로 바꾼다. */
async function screenPoint(page: Page, lx: number, ly: number): Promise<{ x: number; y: number }> {
  const box = await canvas(page).boundingBox();
  if (!box) throw new Error('캔버스를 찾지 못했습니다.');
  return { x: box.x + (lx / 1000) * box.width, y: box.y + (ly / 600) * box.height };
}

async function dragLogical(
  page: Page,
  from: { x: number; y: number },
  to: { x: number; y: number },
): Promise<void> {
  const a = await screenPoint(page, from.x, from.y);
  const b = await screenPoint(page, to.x, to.y);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move((a.x + b.x) / 2, (a.y + b.y) / 2, { steps: 4 });
  await page.mouse.move(b.x, b.y, { steps: 4 });
  await page.mouse.up();
}

async function columnCx(page: Page, index: number): Promise<number> {
  const cx = await canvas(page).locator(`[data-column="${index}"]`).getAttribute('data-cx');
  return Number(cx);
}

// ── leveling ─────────────────────────────────────────────

const LEVEL_PLAN: readonly (readonly [number, number])[] = [
  [2, 1],
  [2, 1],
  [2, 3],
  [0, 3],
  [4, 3],
];

test('leveling: 맨 위 블록을 끌어 옮겨 5번 만에 고르게 한다', async ({ page }) => {
  await open(page, 'leveling');
  await expect(canvas(page).locator('[data-block]')).toHaveCount(30);
  for (const [from, to] of LEVEL_PLAN) {
    const fromX = await columnCx(page, from);
    const toX = await columnCx(page, to);
    await dragLogical(page, { x: fromX, y: 470 }, { x: toX, y: 300 });
  }
  await pollObservation(
    page,
    (o) => o.leveled === true && o.level === '6' && o.moves === 5 && o.heights?.[0] === 6,
  );
  await expect(canvas(page).locator('[data-block]')).toHaveCount(30);
});

test('leveling: 빈 기둥 쪽으로 끌거나 기둥 밖에 놓으면 아무것도 바뀌지 않는다', async ({
  page,
}) => {
  await open(page, 'leveling', { data: [0, 4], maxHeight: 4 });
  const first = await columnCx(page, 0);
  const second = await columnCx(page, 1);
  await dragLogical(page, { x: first, y: 470 }, { x: second, y: 300 });
  await pollObservation(page, (o) => o.moves === 0);
  await dragLogical(page, { x: second, y: 470 }, { x: 900, y: 300 });
  await pollObservation(page, (o) => o.moves === 0);
  await dragLogical(page, { x: second, y: 470 }, { x: first, y: 300 });
  await pollObservation(page, (o) => o.moves === 1 && o.heights?.[0] === 1);
});

test('leveling 키보드만으로: ←→ Enter로 5번 옮겨 고르게 하고 Esc로 취소한다', async ({ page }) => {
  await open(page, 'leveling');
  await canvas(page).focus();
  const key = async (name: string, times = 1) => {
    for (let i = 0; i < times; i += 1) await page.keyboard.press(name);
  };
  // 집었다가 Esc로 취소하면 아무것도 바뀌지 않는다.
  await key('Enter');
  await expect(canvas(page)).toHaveAttribute('data-holding', '0');
  await key('Escape');
  await expect(canvas(page)).not.toHaveAttribute('data-holding', /.*/);
  await pollObservation(page, (o) => o.moves === 0);

  let cursor = 0;
  for (const [from, to] of LEVEL_PLAN) {
    await key(from > cursor ? 'ArrowRight' : 'ArrowLeft', Math.abs(from - cursor));
    await key('Enter');
    await key(to > from ? 'ArrowRight' : 'ArrowLeft', Math.abs(to - from));
    await key('Space');
    cursor = to;
  }
  await pollObservation(page, (o) => o.leveled === true && o.level === '6' && o.moves === 5);
});

test('leveling 단추만으로: 기둥 고르기·집기·놓기·처음으로', async ({ page }) => {
  await open(page, 'leveling');
  await button(page, '맨 위 블록 집기').click();
  await button(page, '오른쪽 기둥 고르기').click();
  await button(page, '여기에 놓기').click();
  await pollObservation(page, (o) => o.moves === 1 && o.heights?.[0] === 6 && o.heights[1] === 5);
  await button(page, '처음으로').click();
  await pollObservation(page, (o) => o.moves === 0 && o.heights?.[0] === 7);
});

// ── seesaw ───────────────────────────────────────────────

/** 샌드박스 기본 자료 7,4,9,3,7은 수직선 2~10. 받침점 x(논리 좌표). */
const seesawX = (value: number) => 80 + ((value - 2) / 8) * 840;
const HANDLE_Y = 380;

test('seesaw: 받침점을 끌어 수평이 되는 6을 찾는다', async ({ page }) => {
  await open(page, 'seesaw');
  await expect(page.getByTestId('chance-tilt')).toHaveText('오른쪽으로 기울어요');
  await dragLogical(page, { x: seesawX(2), y: HANDLE_Y }, { x: seesawX(5), y: HANDLE_Y });
  await pollObservation(page, (o) => o.fulcrum === '5' && o.tilt === 'right');
  await dragLogical(page, { x: seesawX(5), y: HANDLE_Y }, { x: seesawX(7) + 4, y: HANDLE_Y });
  await pollObservation(page, (o) => o.fulcrum === '7' && o.tilt === 'left');
  await expect(page.getByTestId('chance-tilt')).toHaveText('왼쪽으로 기울어요');
  await dragLogical(page, { x: seesawX(7), y: HANDLE_Y }, { x: seesawX(6) - 5, y: HANDLE_Y });
  await pollObservation(page, (o) => o.fulcrum === '6' && o.balanced === true && o.moves === 3);
  await expect(page.getByTestId('chance-tilt')).toHaveText('수평이에요');
  await expect(canvas(page)).toHaveAttribute('data-tilt', 'level');
  await expect(canvas(page).locator('[data-part="plank-group"]')).toHaveAttribute(
    'data-angle',
    '0.00',
  );
});

test('seesaw: step 1/2는 격자에 붙고 끌어도 5.5로 기운다', async ({ page }) => {
  await open(page, 'seesaw', { step: '1/2' });
  await dragLogical(page, { x: seesawX(2), y: HANDLE_Y }, { x: seesawX(5.5) + 3, y: HANDLE_Y });
  await pollObservation(page, (o) => o.fulcrum === '11/2' && o.tilt === 'right');
  await expect(canvas(page).locator('[data-part="fulcrum-value"]')).toHaveText('받침점 5.5');
});

test('seesaw 키보드만으로: 받침점에 초점을 두고 →를 4번 누르면 수평', async ({ page }) => {
  await open(page, 'seesaw');
  await canvas(page).getByRole('slider').focus();
  for (let i = 0; i < 4; i += 1) await page.keyboard.press('ArrowRight');
  await pollObservation(page, (o) => o.fulcrum === '6' && o.balanced === true);
  await page.keyboard.press('ArrowRight');
  await pollObservation(page, (o) => o.fulcrum === '7' && o.tilt === 'left');
  await button(page, '받침점 왼쪽으로').click();
  await pollObservation(page, (o) => o.fulcrum === '6');
  await button(page, '처음으로').click();
  await pollObservation(page, (o) => o.fulcrum === '2' && o.moves === 0);
});

// ── outlier ──────────────────────────────────────────────

const outlierX = (value: number) => 80 + (value / 36) * 840;

async function dragHandleCenter(page: Page): Promise<{ x: number; y: number }> {
  const box = await canvas(page).locator('[data-part="drag-hit"]').boundingBox();
  if (!box) throw new Error('끌 점을 찾지 못했습니다.');
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

async function dragPointTo(page: Page, value: number): Promise<void> {
  const from = await dragHandleCenter(page);
  const to = await screenPoint(page, outlierX(value), 270);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move((from.x + to.x) / 2, from.y, { steps: 4 });
  await page.mouse.move(to.x, to.y, { steps: 4 });
  await page.mouse.up();
}

test('outlier: 예측하기 전에는 평균선이 없고 끌 수도 없다', async ({ page }) => {
  await open(page, 'outlier');
  await expect(canvas(page).locator('[data-part="mean-line"]')).toHaveCount(0);
  await expect(canvas(page).locator('[data-part="initial-mean"]')).toHaveCount(0);
  await expect(canvas(page)).toHaveAttribute('data-locked', 'true');
  await dragPointTo(page, 30);
  await expect(page.getByTestId('chance-message')).toHaveText('먼저 예측해 보세요.');
  await pollObservation(page, (o) => o.values?.[4] === 7 && o.dragged === false);
});

test('outlier: 예측 → 끌기 → 평균선이 오른쪽으로 움직인다', async ({ page }) => {
  await open(page, 'outlier');
  for (const key of ['1', '0', '.', '6']) await button(page, key).click();
  await expect(page.getByTestId('chance-draft')).toHaveText('10.6');
  await button(page, '예측하기').click();
  await pollObservation(page, (o) => o.predictionLocked === true && o.prediction === '53/5');
  const line = canvas(page).locator('[data-part="mean-line"]');
  await expect(line).toHaveCount(1);
  const before = Number(await line.getAttribute('data-x'));
  await expect(canvas(page).locator('[data-part="mean-label"]')).toHaveText('평균 6');
  await expect(canvas(page).locator('[data-part="prediction"]')).toContainText('내 예측');

  await dragPointTo(page, 30);
  await pollObservation(
    page,
    (o) =>
      o.values?.[4] === 30 && o.mean === '53/5' && o.meanShift === '23/5' && o.dragged === true,
  );
  const after = Number(await line.getAttribute('data-x'));
  expect(after).toBeGreaterThan(before + 100);
  await expect(canvas(page).locator('[data-part="mean-label"]')).toHaveText('평균 10과 3/5 (10.6)');
  // 처음 평균 자리는 흐린 점선으로 남는다.
  const initial = Number(
    await canvas(page).locator('[data-part="initial-mean"]').getAttribute('data-x'),
  );
  expect(initial).toBeCloseTo(before, 0);
});

test('outlier 키보드만으로: 숫자·/·Enter로 예측하고 ◆에서 →로 값을 바꾼다', async ({ page }) => {
  await open(page, 'outlier');
  await page.getByRole('button', { name: '1', exact: true }).focus();
  for (const key of ['5', '3', '/', '5']) await page.keyboard.press(key);
  await expect(page.getByTestId('chance-draft')).toHaveText('53/5');
  await page.keyboard.press('Backspace');
  await page.keyboard.press('5');
  await button(page, '예측하기').focus();
  await page.keyboard.press('Enter');
  await pollObservation(page, (o) => o.prediction === '53/5');
  await canvas(page).getByRole('slider').focus();
  for (let i = 0; i < 3; i += 1) await page.keyboard.press('ArrowRight');
  await pollObservation(page, (o) => o.values?.[4] === 10 && o.mean === '33/5');
  await page.keyboard.press('ArrowLeft');
  await pollObservation(page, (o) => o.values?.[4] === 9);
  await button(page, '1 늘리기').click();
  await pollObservation(page, (o) => o.values?.[4] === 10);
  await button(page, '처음으로').click();
  await pollObservation(page, (o) => o.values?.[4] === 7 && o.dragged === false);
  // 예측은 남고 평균선이 그대로 있다.
  await expect(canvas(page).locator('[data-part="mean-line"]')).toHaveCount(1);
});

// ── 화면 기준 이미지 ─────────────────────────────────────

/** 화면 기준 이미지: 샌드박스 `?stage=fit` 판 전체(페이지 화면). 크롬북·아이패드만 찍는다. */
async function expectPageSnapshot(page: Page, name: string): Promise<void> {
  test.skip(test.info().project.name === 'board', '기준 이미지는 크롬북·아이패드만 둔다.');
  await page.waitForTimeout(600);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.getByTestId('chance-controls').evaluate((element) => {
    element.scrollTo(0, 0);
    // T199: 좁은 판에서는 엔진 바깥 상자(.wrap)가 세로로 스크롤한다.
    element.closest('[class*="wrap"]')?.scrollTo(0, 0);
  });
  await expect(page).toHaveScreenshot(name, { fullPage: true, animations: 'disabled' });
}

test('화면 기준: leveling 첫 화면', async ({ page }) => {
  await open(page, 'leveling', { label: '줄넘기(번)' });
  await page.getByRole('heading', { name: '평균·가능성 실험실' }).focus();
  await expectPageSnapshot(page, 'chance-leveling.png');
});

test('화면 기준: seesaw 기울어진 첫 화면', async ({ page }) => {
  await open(page, 'seesaw', { step: '1/2', label: '줄넘기(번)' });
  await canvas(page).getByRole('slider').focus();
  for (let i = 0; i < 7; i += 1) await page.keyboard.press('ArrowRight');
  await pollObservation(page, (o) => o.fulcrum === '11/2');
  await page.getByRole('heading', { name: '평균·가능성 실험실' }).focus();
  await expectPageSnapshot(page, 'chance-seesaw.png');
});

test('화면 기준: outlier 예측 전·예측하고 끈 뒤', async ({ page }) => {
  await open(page, 'outlier', { label: '줄넘기(번)' });
  await expectPageSnapshot(page, 'chance-outlier-predict.png');
  for (const key of ['5', '3', '/', '5']) await button(page, key).click();
  await button(page, '예측하기').click();
  await dragPointTo(page, 30);
  await pollObservation(page, (o) => o.values?.[4] === 30);
  await page.mouse.move(0, 0);
  await expectPageSnapshot(page, 'chance-outlier-dragged.png');
});

// ── 오버레이 정렬 ────────────────────────────────────────

/** 오버레이 svg 상자가 chance-canvas 상자와 1px 이내로 같다(overlay-alignment 방식). */
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

test('힌트 ② level-try: 높이 5 점선, 남는 블록 8·모자란 칸 3', async ({ page }) => {
  await open(
    page,
    'leveling',
    {},
    `stage=fit&overlay=level-try&overlayArgs=${encodeURIComponent('{"value":5}')}`,
  );
  await toggleOverlay(page);
  const layer = await expectAligned(page, 'level-try');
  await expect(layer.locator('[data-part="extra"]')).toHaveCount(8);
  await expect(layer.locator('[data-part="lack"]')).toHaveCount(3);
  await expect(layer.locator('[data-part="counts"]')).toHaveText('남는 블록 8개 / 모자란 칸 3개');
  // 점선은 본 판 기둥 아래 선(500)에서 5칸 위(블록 높이 32 기준)에 놓인다.
  const y = Number(await layer.locator('[data-part="level-line"]').getAttribute('y1'));
  expect(y).toBeCloseTo(500 - 5 * 32, 0);
});

test('힌트 ② sum-tower: 합친 기둥과 빈 자리 5개, 높이 숫자는 없다', async ({ page }) => {
  await open(page, 'leveling', {}, 'stage=fit&overlay=sum-tower');
  await toggleOverlay(page);
  const layer = await expectAligned(page, 'sum-tower');
  await expect(layer.locator('[data-part="tower-block"]')).toHaveCount(30);
  await expect(layer.locator('[data-part="empty-slot"]')).toHaveCount(5);
  await expect(layer.locator('[data-part="tower-label"]')).toHaveText('모두 합친 기둥');
  expect(await layer.textContent()).toBe('모두 합친 기둥');
});

test('힌트 ② arms: 평균 위치에서는 두 합 막대의 길이가 같다', async ({ page }) => {
  await open(page, 'seesaw', {}, 'stage=fit&overlay=arms');
  await canvas(page).getByRole('slider').focus();
  for (let i = 0; i < 4; i += 1) await page.keyboard.press('ArrowRight');
  await pollObservation(page, (o) => o.balanced === true);
  await toggleOverlay(page);
  const layer = await expectAligned(page, 'arms');
  await expect(layer.locator('[data-part="arm-left"]')).toHaveCount(2);
  await expect(layer.locator('[data-part="arm-right"]')).toHaveCount(3);
  const left = Number(await layer.locator('[data-part="sum-left"]').getAttribute('data-length'));
  const right = Number(await layer.locator('[data-part="sum-right"]').getAttribute('data-length'));
  expect(left).toBeGreaterThan(0);
  expect(left).toBeCloseTo(right, 3);
  expect(await layer.textContent()).toBe('왼쪽 합오른쪽 합');
  await canvas(page).getByRole('slider').focus();
  await page.keyboard.press('ArrowRight');
  await expect(layer.locator('[data-part="arm-right"]')).toHaveCount(1);
  const left2 = Number(await layer.locator('[data-part="sum-left"]').getAttribute('data-length'));
  const right2 = Number(await layer.locator('[data-part="sum-right"]').getAttribute('data-length'));
  expect(left2).toBeGreaterThan(right2);
});

test('힌트 ② mean-pull: 끈 점과 평균의 화살표, 값 글은 없다', async ({ page }) => {
  await open(page, 'outlier', { predict: false, dragIndex: 4 }, 'stage=fit&overlay=mean-pull');
  await canvas(page).getByRole('slider').focus();
  for (let i = 0; i < 5; i += 1) await page.keyboard.press('ArrowRight');
  await pollObservation(page, (o) => o.values?.[4] === 12);
  await toggleOverlay(page);
  const layer = await expectAligned(page, 'mean-pull');
  await expect(layer.locator('[data-part="point-arrow"]')).toHaveCount(1);
  await expect(layer.locator('[data-part="mean-arrow"]')).toHaveCount(1);
  expect(await layer.textContent()).toBe('점이 움직인 거리평균이 움직인 거리');
  const mean = layer.locator('[data-part="mean-arrow"]');
  const from = Number(await mean.getAttribute('data-from'));
  const to = Number(await mean.getAttribute('data-to'));
  // 평균은 6 → 7로 1만큼, 점은 12 → 7로 5만큼(×840/36) 움직였다.
  expect((to - from) / (840 / 36)).toBeCloseTo(1, 1);
});

// ── words ────────────────────────────────────────────────

/** words 판: 칸 5개(0, 1/4, 1/2, 3/4, 1). 칸 가운데 논리 x. */
const wordsSlotX = (i: number) => 40 + (920 / 5) * (i + 0.5);

async function cardCenter(page: Page, id: string): Promise<{ x: number; y: number }> {
  const box = canvas(page).locator(`[data-card="${id}"]`);
  const x = Number(await box.getAttribute('data-x'));
  const y = Number(await box.locator('[data-part="card-box"]').getAttribute('y'));
  return { x: x + 75, y: y + 35 };
}

test('words: 카드를 끌어 칸에 놓고, 다른 칸으로 옮기고, 아래 칸으로 빼낸다', async ({ page }) => {
  await open(page, 'words');
  await expect(canvas(page).locator('[data-part="card"]')).toHaveCount(5);
  await dragLogical(page, await cardCenter(page, 'c1'), { x: wordsSlotX(4), y: 250 });
  await pollObservation(page, (o) => o.placements?.['c1'] === '1');
  await dragLogical(page, await cardCenter(page, 'c2'), { x: wordsSlotX(2), y: 250 });
  await pollObservation(page, (o) => o.placements?.['c2'] === '1/2');
  // 같은 칸에 여러 장
  await dragLogical(page, await cardCenter(page, 'c3'), { x: wordsSlotX(2) + 20, y: 250 });
  await pollObservation(page, (o) => o.placements?.['c3'] === '1/2');
  const y2 = Number(
    await canvas(page).locator('[data-card="c2"] [data-part="card-box"]').getAttribute('y'),
  );
  const y3 = Number(
    await canvas(page).locator('[data-card="c3"] [data-part="card-box"]').getAttribute('y'),
  );
  expect(y3).toBeLessThan(y2);
  // 다른 칸으로 옮기기
  await dragLogical(page, await cardCenter(page, 'c1'), { x: wordsSlotX(0), y: 250 });
  await pollObservation(page, (o) => o.placements?.['c1'] === '0');
  // 칸 밖(칸 구역 위)에 놓으면 아무 일도 없다
  await dragLogical(page, await cardCenter(page, 'c1'), { x: 500, y: 40 });
  await pollObservation(page, (o) => o.placements?.['c1'] === '0');
  // 아래 칸으로 끌어 빼기
  await dragLogical(page, await cardCenter(page, 'c1'), { x: 500, y: 520 });
  await pollObservation(page, (o) => o.placements?.['c1'] === null);
  await expect(page.getByTestId('chance-placed')).toHaveText('놓은 카드 2 / 5장');
});

test('words 키보드만으로: 카드에서 ←→ Enter로 놓고 Delete로 뺀다', async ({ page }) => {
  await open(page, 'words');
  const card = canvas(page).locator('[data-card="c2"]');
  await card.focus();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await pollObservation(page, (o) => o.placements?.['c2'] === '3/4');
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('Space');
  await pollObservation(page, (o) => o.placements?.['c2'] === '1/4');
  await page.keyboard.press('Delete');
  await pollObservation(page, (o) => o.placements?.['c2'] === null);
});

test('words 단추만으로: 카드·칸 고르기와 놓기·빼기·처음으로', async ({ page }) => {
  await open(page, 'words', { slots: 'three', slotLabels: 'numbers' });
  await expect(canvas(page).locator('[data-part="slot"]')).toHaveCount(3);
  await button(page, '다음 카드 고르기').click();
  await button(page, '오른쪽 칸 고르기').click();
  await button(page, '고른 칸에 놓기').click();
  await pollObservation(page, (o) => o.placements?.['c2'] === '1');
  await button(page, '카드 빼기').click();
  await pollObservation(page, (o) => o.placements?.['c2'] === null);
  await button(page, '고른 칸에 놓기').click();
  await button(page, '처음으로').click();
  await pollObservation(page, (o) => o.allPlaced === false && o.placements?.['c2'] === null);
});

// ── spinner ──────────────────────────────────────────────

test('spinner: 칸을 더하고 크기를 바꾼 뒤 돌린다(reduced-motion이면 바로 결과)', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await open(page, 'spinner');
  await expect(canvas(page).locator('[data-part="sector"]')).toHaveCount(2);
  await pollObservation(page, (o) => o.probabilities?.['red'] === '1/2');
  await button(page, '칸 더하기').click();
  await expect(canvas(page).locator('[data-part="sector"]')).toHaveCount(3);
  await pollObservation(
    page,
    (o) => o.probabilities?.['yellow'] === '1/3' && o.edits === 1 && o.trials === 0,
  );
  // 칸을 눌러 고르고 크게
  const third = canvas(page).locator('[data-part="sector"][data-index="2"]');
  const label = third.locator('text');
  const at = await screenPoint(
    page,
    Number(await label.getAttribute('x')),
    Number(await label.getAttribute('y')) - 8,
  );
  await page.mouse.click(at.x, at.y);
  await expect(page.getByTestId('sector-selected')).toContainText('3번 칸');
  await button(page, '칸 키우기').click();
  await pollObservation(page, (o) => o.probabilities?.['yellow'] === '1/2');
  await button(page, '칸 색 바꾸기').click();
  await pollObservation(page, (o) => o.probabilities?.['green'] === '1/2');
  // 돌리기
  for (let i = 0; i < 3; i += 1) await button(page, '돌리기').click();
  await pollObservation(page, (o) => o.trials === 3 && (o.last?.length ?? 0) === 3);
  const o = await readObservation(page);
  expect(Object.values(o.counts ?? {}).reduce((a, b) => a + b, 0)).toBe(3);
  await expect(page.getByTestId('chance-trials')).toHaveText('돌린 횟수 3번');
  // 화살표는 바로 자리에 있다(연출 없음)
  await expect(canvas(page).locator('[data-part="arrow"]')).toHaveAttribute(
    'style',
    /transition: none/,
  );
  // 장치를 바꾸면 결과가 지워지고 edits는 남는다
  await button(page, '칸 빼기').click();
  await pollObservation(page, (x) => x.trials === 0 && x.edits === 4);
  await button(page, '처음으로').click();
  await pollObservation(page, (x) => x.edits === 0 && x.probabilities?.['red'] === '1/2');
});

test('spinner: 한계(칸 8개·크기 4)에서 막히고 안내 글이 나온다', async ({ page }) => {
  await open(page, 'spinner');
  for (let i = 0; i < 8; i += 1) await button(page, '칸 더하기').click();
  await expect(canvas(page).locator('[data-part="sector"]')).toHaveCount(8);
  await expect(page.getByTestId('chance-message')).toHaveText('칸은 1개부터 8개까지예요.');
  await pollObservation(page, (o) => o.edits === 6);
  for (let i = 0; i < 4; i += 1) await button(page, '칸 키우기').click();
  await expect(page.getByTestId('chance-message')).toHaveText('칸 크기는 1부터 4까지예요.');
});

test('spinner 주머니: 구슬을 더하고 빼고 꺼낸다', async ({ page }) => {
  await open(page, 'spinner', {
    device: {
      type: 'bag',
      marbles: [
        { color: 'red', count: 2 },
        { color: 'blue', count: 1 },
      ],
    },
  });
  await expect(canvas(page).locator('[data-part="marble"]')).toHaveCount(3);
  await pollObservation(page, (o) => o.probabilities?.['red'] === '2/3');
  await button(page, '노랑 구슬 더하기').click();
  await pollObservation(page, (o) => o.probabilities?.['yellow'] === '1/4');
  await button(page, '파랑 구슬 빼기').click();
  await pollObservation(page, (o) => o.probabilities?.['blue'] === '0');
  await button(page, '꺼내기').click();
  await pollObservation(page, (o) => o.trials === 1);
  await expect(canvas(page).locator('[data-part="picked"]')).toHaveCount(1);
});

// ── simulate ─────────────────────────────────────────────

function columnBars(page: Page, batch: number): Locator {
  return canvas(page).locator(`[data-part="column"][data-batch="${batch}"] [data-part="bar"]`);
}

test('simulate: 세 칸을 차례로 돌려 상대도수 막대를 나란히 비교한다', async ({ page }) => {
  await open(page, 'simulate');
  await expect(canvas(page).locator('[data-part="column"]')).toHaveCount(3);
  await expect(canvas(page).locator('[data-part="bar"]')).toHaveCount(0);
  await expect(canvas(page).locator('[data-part="expected"]')).toHaveCount(12);
  for (const n of [10, 1000, 10000]) {
    await button(page, `${n}회 돌리기`).click();
    await expect(columnBars(page, n)).toHaveCount(4);
  }
  await pollObservation(page, (o) => o.allBatchesRun === true && o.runs === 3);
  const o = await readObservation(page);
  const big = o.results?.find((r) => r.batch === 10000);
  expect(big).toBeTruthy();
  const red = (big?.counts['red'] ?? 0) / 10000;
  expect(red).toBeGreaterThan(0.45);
  expect(red).toBeLessThan(0.55);
  expect(Object.values(big?.counts ?? {}).reduce((a, b) => a + b, 0)).toBe(10000);
  await expect(canvas(page).locator('[data-part="column"][data-batch="10000"]')).toContainText(
    '10000번 중',
  );
  // 같은 축척: 10000회 칸의 빨강 막대 높이 = 상대도수 × 280
  const h = Number(await columnBars(page, 10000).first().getAttribute('height'));
  expect(h).toBeCloseTo(red * 280, 0);
  // 같은 칸을 다시 돌리면 그 칸만 새로
  const before = await columnBars(page, 10).first().getAttribute('data-count');
  await button(page, '1000회 돌리기').click();
  await pollObservation(page, (x) => x.runs === 4);
  expect(await columnBars(page, 10).first().getAttribute('data-count')).toBe(before);
  await button(page, '결과 지우기').click();
  await expect(canvas(page).locator('[data-part="bar"]')).toHaveCount(0);
});

test('simulate: 10,000회 단추를 누르면 막대가 1초 안에 나온다', async ({ page }) => {
  await open(page, 'simulate');
  await button(page, '10000회 돌리기').click();
  await expect(columnBars(page, 10000)).toHaveCount(4, { timeout: 1000 });
});

test('simulate: 장치를 편집하면 결과가 지워지고 점선이 따라 움직인다', async ({ page }) => {
  await open(page, 'simulate', { batches: [10, 100] });
  await expect(canvas(page).locator('[data-part="column"]')).toHaveCount(2);
  await button(page, '10회 돌리기').click();
  await expect(columnBars(page, 10)).toHaveCount(4);
  const redLine = canvas(page).locator('[data-part="expected"][data-outcome="red"]').first();
  const before = Number(await redLine.getAttribute('data-y'));
  await button(page, '칸 키우기').click();
  await expect(canvas(page).locator('[data-part="bar"]')).toHaveCount(0);
  await pollObservation(page, (o) => o.runs === 0 && o.probabilities?.['red'] === '2/3');
  const after = Number(await redLine.getAttribute('data-y'));
  expect(after).toBeLessThan(before);
});

// ── 화면 기준 이미지(가능성 모드) ─────────────────────────

test('화면 기준: words 첫 화면', async ({ page }) => {
  await open(page, 'words');
  await page.getByRole('heading', { name: '평균·가능성 실험실' }).focus();
  await expectPageSnapshot(page, 'chance-words.png');
});

test('화면 기준: spinner 첫 화면', async ({ page }) => {
  await open(page, 'spinner');
  await page.getByRole('heading', { name: '평균·가능성 실험실' }).focus();
  await expectPageSnapshot(page, 'chance-spinner.png');
});

test('화면 기준: simulate 첫 화면', async ({ page }) => {
  await open(page, 'simulate');
  await page.getByRole('heading', { name: '평균·가능성 실험실' }).focus();
  await expectPageSnapshot(page, 'chance-simulate.png');
});

// ── 힌트 ② 오버레이(가능성) ──────────────────────────────

test('힌트 ② small-batches: 10번씩 5묶음 막대, 판 아래 줄에 정렬', async ({ page }) => {
  await open(page, 'spinner', {}, 'stage=fit&overlay=small-batches');
  await toggleOverlay(page);
  const layer = await expectAligned(page, 'small-batches');
  await expect(layer.locator('[data-part="batch"]')).toHaveCount(5);
  await expect(layer.locator('[data-part="bar"]')).toHaveCount(20);
  await expect(layer.locator('[data-part="title"]')).toHaveText('10번씩 5묶음');
  // 돌리기와 상관없이 같은 그림(고정 seed)
  const first = await layer
    .locator('[data-part="bar"]')
    .evaluateAll((els) => els.map((e) => e.getAttribute('data-count')).join(','));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await button(page, '돌리기').click();
  await pollObservation(page, (o) => o.trials === 1);
  const second = await layer
    .locator('[data-part="bar"]')
    .evaluateAll((els) => els.map((e) => e.getAttribute('data-count')).join(','));
  expect(second).toBe(first);
});

test('힌트 ② after-streak: 5번 이어진 다음 막대와 전체 막대, 빨강이 없으면 그리지 않는다', async ({
  page,
}) => {
  await open(page, 'simulate', {}, 'stage=fit&overlay=after-streak');
  await toggleOverlay(page);
  const layer = await expectAligned(page, 'after-streak');
  await expect(layer.locator('[data-part="after"] [data-part="bar"]')).toHaveCount(4);
  await expect(layer.locator('[data-part="whole"] [data-part="bar"]')).toHaveCount(4);
  await expect(layer.locator('[data-part="after-title"]')).toHaveText(
    '빨강이 5번 이어진 바로 다음',
  );
  const redAfter = Number(
    await layer.locator('[data-part="after"] [data-outcome="red"]').getAttribute('data-rel'),
  );
  expect(redAfter).toBeGreaterThan(0.35);
  expect(redAfter).toBeLessThan(0.65);
  // 빨강 칸을 파랑으로 바꾸면 빨강이 없는 장치라 그리지 않는다
  await button(page, '칸 색 바꾸기').click();
  await expect(layer.locator('svg')).toHaveCount(0);
});

// ── 판 크기·터치 타깃 ────────────────────────────────────

test('넓은 판은 줄여서 맞추고, 좁은 판은 최소 배율 0.6에서 멈추고 판 안에서 스크롤한다', async ({
  page,
}) => {
  test.skip(test.info().project.name !== 'chromebook', '크롬북 뷰포트에서만 판 크기를 바꿔 본다.');
  const first: Record<Mode, string> = {
    leveling: '왼쪽 기둥 고르기',
    seesaw: '받침점 왼쪽으로',
    outlier: '1 줄이기',
    words: '이전 카드 고르기',
    spinner: '돌리기',
    simulate: '10회 돌리기',
  };
  for (const mode of ['leveling', 'seesaw', 'outlier', 'words', 'spinner', 'simulate'] as const) {
    await open(page, mode);
    const wide = await canvas(page).boundingBox();
    if (!wide) throw new Error('캔버스를 찾지 못했습니다.');
    expect(wide.width / 1000).toBeGreaterThanOrEqual(0.6);
    await expect(page.getByTestId('chance-board')).toHaveAttribute('data-scroll', 'false');

    await page.setViewportSize({ width: 520, height: 700 });
    await expect(page.getByTestId('chance-board')).toHaveAttribute('data-scroll', 'true');
    const narrow = await canvas(page).boundingBox();
    if (!narrow) throw new Error('캔버스를 찾지 못했습니다.');
    expect(narrow.width).toBeGreaterThanOrEqual(599);
    expect(narrow.width).toBeLessThanOrEqual(601);
    expect(narrow.height).toBeGreaterThanOrEqual(359);
    const scrolls = await page
      .getByTestId('chance-board')
      .evaluate((element) => element.scrollWidth > element.clientWidth);
    expect(scrolls).toBe(true);
    // 조작 칸은 스크롤 상자 밖이라 단추가 그대로 보인다.
    await expect(button(page, first[mode])).toBeVisible();
    const outside = await button(page, first[mode]).evaluate(
      (el) => !document.querySelector('[data-testid="chance-board"]')?.contains(el),
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
    for (const mode of ['leveling', 'seesaw', 'outlier', 'words', 'spinner', 'simulate'] as const) {
      await open(page, mode);
      // 설정은 저장되므로 아직 48px일 때만 눌러 64px로 바꾼다.
      const toggle = page.getByRole('button', { name: '터치 48px' });
      if (size === 64 && (await toggle.count()) > 0) await toggle.click();
      const controls = page.getByTestId('chance-controls').getByRole('button');
      const count = await controls.count();
      expect(count).toBeGreaterThan(2);
      for (let i = 0; i < count; i += 1) {
        await controls.nth(i).scrollIntoViewIfNeeded();
        await expectMin(controls.nth(i), size, `${mode} 단추 ${i}`);
      }
    }
  });
}
