import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

/**
 * E13 측정 실험실(compare-direct·length) 샌드박스 E2E. 아이패드(WebKit)·크롬북·전자칠판 뷰포트.
 *
 * - compare-direct: 펴기 단추·끌어 펴기, 출발선 자석, 넓이 겹치기, 들이 붓기
 * - length: 클립 4개 자석 이어 붙이기 → exact, 일부러 만든 틈 표시, 키보드로 1cm 블록 10개 → 자 만들기 → 숫자 놓기
 * - 힌트 ② 오버레이 다섯이 본 판과 1px 안에 겹침
 * - 첫 화면 기준 이미지(모드별 크롬북·아이패드), 64px 모드의 단추 크기
 *
 * 판 좌표는 논리 1000×600이지만 판 높이를 가정하지 않고 상자 너비로만 배율을 구한다(T222 메모).
 */

test.describe.configure({ timeout: 120_000 });

type Json = Record<string, unknown>;

async function readObservation(page: Page): Promise<Json> {
  const text = await page.getByTestId('observation').textContent();
  return JSON.parse(text ?? '{}') as Json;
}

async function pollObservation(page: Page, check: (o: Json) => boolean): Promise<void> {
  await expect.poll(async () => check(await readObservation(page))).toBe(true);
}

/** 판이 칸에 맞춰 크기를 정할 때까지(상자가 두 번 연속 같아질 때까지) 기다린다. */
async function settleCanvas(page: Page, testId: string): Promise<void> {
  let previous = '';
  await expect
    .poll(async () => {
      const box = await page.getByTestId(testId).boundingBox();
      const now = JSON.stringify(box);
      const same = now === previous;
      previous = now;
      return same;
    })
    .toBe(true);
}

type ModeName = 'compare-direct' | 'length';

async function open(
  page: Page,
  mode: ModeName,
  config: Json = {},
  query = 'stage=fit',
): Promise<string> {
  const params = new URLSearchParams();
  if (Object.keys(config).length > 0) params.set('config', JSON.stringify(config));
  for (const [key, value] of new URLSearchParams(query)) params.set(key, value);
  await page.goto(`/?${params.toString()}#/sandbox/E13`);
  await expect(page.getByRole('heading', { name: '측정 실험실' })).toBeVisible();
  if (mode !== 'compare-direct') await page.getByLabel('모드').selectOption(mode);
  await pollObservation(page, (o) => o['mode'] === mode && o['error'] === undefined);
  const canvasId = mode === 'length' ? 'length-canvas' : 'compare-canvas';
  await settleCanvas(page, canvasId);
  return canvasId;
}

function canvasOf(page: Page, id: string): Locator {
  return page.getByTestId(id);
}

/** 논리 좌표(1000 기준)를 화면 좌표로. 배율은 상자 너비로만 구한다(높이 가정 금지). */
async function toScreen(
  page: Page,
  id: string,
  lx: number,
  ly: number,
): Promise<{ x: number; y: number }> {
  const box = await canvasOf(page, id).boundingBox();
  if (!box) throw new Error('캔버스를 찾지 못했습니다.');
  const scale = box.width / 1000;
  return { x: box.x + lx * scale, y: box.y + ly * scale };
}

async function centerOf(locator: Locator): Promise<{ x: number; y: number }> {
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  if (!box) throw new Error('상자를 찾지 못했습니다.');
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/** from에서 to까지 마우스로 끈다(여러 걸음으로 나눠 pointermove를 보낸다). */
async function dragBetween(
  page: Page,
  from: { x: number; y: number },
  to: { x: number; y: number },
): Promise<void> {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  const steps = 8;
  for (let i = 1; i <= steps; i += 1) {
    await page.mouse.move(
      from.x + ((to.x - from.x) * i) / steps,
      from.y + ((to.y - from.y) * i) / steps,
    );
  }
  await page.mouse.up();
}

function button(page: Page, name: string): Locator {
  return page.getByRole('button', { name, exact: true });
}

// ── compare-direct: 길이 ─────────────────────────────────

test('compare-direct 길이: [펴기] 단추로 곡선 밧줄을 편다', async ({ page }) => {
  await open(page, 'compare-direct');
  const start = await readObservation(page);
  expect(start['allStraight']).toBe(false);
  await button(page, '밧줄 가 펴기').click();
  await pollObservation(page, (o) => o['allStraight'] === true);
  await expect(button(page, '밧줄 가 펴기')).toBeDisabled();
  // 편 뒤에는 끝 손잡이가 사라진다.
  await expect(page.getByLabel('밧줄 가 끝 잡아당기기')).toHaveCount(0);
});

test('compare-direct 길이: 오른쪽 끝을 끌어 당겨도 펴진다(조금만 끌면 안 펴진다)', async ({
  page,
}) => {
  await open(page, 'compare-direct');
  const handle = page.getByLabel('밧줄 가 끝 잡아당기기');
  const at = await centerOf(handle);
  await dragBetween(page, at, { x: at.x + 6, y: at.y });
  expect((await readObservation(page))['allStraight']).toBe(false);
  const again = await centerOf(handle);
  await dragBetween(page, again, { x: again.x + 110, y: again.y });
  await pollObservation(page, (o) => o['allStraight'] === true);
});

test('compare-direct 길이: 물건을 출발선 가까이(1칸 안) 끌어 놓으면 자석처럼 붙는다', async ({
  page,
}) => {
  const id = await open(page, 'compare-direct');
  // 밧줄 나는 처음에 2칸 떨어져 있다(왼쪽 끝 x = 60 + 2*60, 중심선 y = 4*60 + 30).
  expect((await readObservation(page))['aligned']).toEqual(['rope-a']);
  const from = await toScreen(page, id, 60 + 120 + 150, 270);
  const to = await toScreen(page, id, 60 + 120 + 150 - 100, 270); // 1.67칸 왼쪽 → 0.33칸 남음
  await dragBetween(page, from, to);
  await pollObservation(page, (o) => (o['aligned'] as string[]).includes('rope-b'));
  const box = page.locator('[data-part="item"][data-id="rope-b"]');
  await expect(box).toHaveAttribute('data-x', '0');
  // 밧줄 가도 펴면 둘 다 출발선에 맞고 곧다.
  await button(page, '밧줄 가 펴기').click();
  await pollObservation(
    page,
    (o) => o['allAligned'] === true && o['allStraight'] === true && o['longest'] === 'rope-a',
  );
});

test('compare-direct 길이: 출발선에서 멀리 놓으면 붙지 않고, 키보드 방향키로 한 칸씩 옮긴다', async ({
  page,
}) => {
  await open(page, 'compare-direct');
  const item = page.getByRole('button', { name: '밧줄 나. 방향키로 옮겨요' });
  await item.focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('[data-part="item"][data-id="rope-b"]')).toHaveAttribute('data-x', '3');
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowLeft');
  await pollObservation(page, (o) => (o['aligned'] as string[]).includes('rope-b'));
  // 왼쪽 밖으로는 못 간다(이유를 글로 알린다).
  await page.keyboard.press('ArrowLeft');
  await expect(page.getByTestId('measure-message')).toContainText('판 밖');
});

// ── compare-direct: 넓이·들이 ───────────────────────────

const AREA_CONFIG = {
  attribute: 'area',
  items: [
    { id: 'hanky', label: '손수건', kind: 'handkerchief', w: 4, h: 3 },
    { id: 'book', label: '책', kind: 'book', w: 3, h: 5 },
  ],
};

test('compare-direct 넓이: 손수건을 끌어 책 위에 겹치면 모서리를 맞춰 붙는다', async ({ page }) => {
  const id = await open(page, 'compare-direct', AREA_CONFIG);
  expect((await readObservation(page))['overlapped']).toBe(false);
  // 손수건 (1,3)칸 4×3 → 책 (7,3)칸. 손수건 가운데를 잡고 6칸 오른쪽(+300)으로, 0.4칸 어긋나게.
  const from = await toScreen(page, id, 50 + 100, 150 + 75);
  const to = await toScreen(page, id, 50 + 100 + 300 + 20, 150 + 75 - 18);
  await dragBetween(page, from, to);
  await pollObservation(page, (o) => o['overlapped'] === true);
  const hanky = page.locator('[data-part="item"][data-id="hanky"]');
  await expect(hanky).toHaveAttribute('data-x', '7');
  await expect(hanky).toHaveAttribute('data-y', '3');
  // 위에 놓은 손수건은 반투명이라 아래 책의 테두리가 비친다.
  await expect(hanky.locator('[role="button"]')).toHaveAttribute('opacity', '0.62');
});

const CAPACITY_CONFIG = {
  attribute: 'capacity',
  pour: true,
  items: [
    { id: 'tall', label: '키 큰 컵', kind: 'cup', shape: 'tall', capacity: 4 },
    { id: 'wide', label: '넓은 컵', kind: 'cup', shape: 'wide', capacity: 6 },
  ],
};

test('compare-direct 들이: 컵마다 같은 수조에 붓고 물 높이가 차오른다', async ({ page }) => {
  await open(page, 'compare-direct', CAPACITY_CONFIG);
  const canvas = canvasOf(page, 'compare-canvas');
  await expect(canvas.locator('[data-part="tank"]')).toHaveCount(2);
  await expect(canvas.locator('[data-part="tank-water"]')).toHaveCount(0);
  await button(page, '키 큰 컵의 물을 같은 수조에 붓기').click();
  await expect(canvas.locator('[data-part="tank-water"]')).toHaveCount(1);
  await expect(button(page, '키 큰 컵의 물을 같은 수조에 붓기')).toBeDisabled();
  await button(page, '넓은 컵의 물을 같은 수조에 붓기').click();
  await pollObservation(page, (o) => o['pouredAll'] === true);
  // 같은 수조라서 물 높이로 비교할 수 있다(애니메이션이 끝난 뒤 높이 비교).
  await page.waitForTimeout(600);
  const heights = await canvas
    .locator('[data-part="tank-water"]')
    .evaluateAll((els) => els.map((el) => el.getBoundingClientRect().height));
  expect(heights).toHaveLength(2);
  expect(heights[1] ?? 0).toBeGreaterThan(heights[0] ?? 0);
});

// ── length ──────────────────────────────────────────────

/** 연필 12cm 샌드박스 기본 좌표. 뼘 시연이 없으면 판 위쪽 여백 40, 띠 위 120~172. */
const BAND_LEFT = 60;
const PPC_PENCIL = 880 / (12 + 15);
const BAND_CENTER_Y = 146;

function cmX(cm: number, ppc = PPC_PENCIL): number {
  return BAND_LEFT + cm * ppc;
}

/** 트레이 단추를 끌어 띠 위 cm(조각 가운데)에 놓는다. */
async function dragUnit(
  page: Page,
  name: string,
  centerCm: number,
  bandY = BAND_CENTER_Y,
): Promise<void> {
  const from = await centerOf(button(page, name));
  const to = await toScreen(page, 'length-canvas', cmX(centerCm), bandY);
  await dragBetween(page, from, to);
}

test('length: 클립 4개를 자석으로 이어 붙이면 exact(틈·겹침 없음)', async ({ page }) => {
  await open(page, 'length');
  expect((await readObservation(page))['exact']).toBe(false);
  // 조각 가운데를 목표(1.5, 4.5, 7.5, 10.5)에서 0.4cm씩 어긋나게 놓아도 1cm 안이라 붙는다.
  const centers = [1.9, 4.1, 7.9, 10.1];
  for (const [index, center] of centers.entries()) {
    await dragUnit(page, '클립 놓기', center);
    await pollObservation(page, (o) => o['count'] === index + 1);
  }
  await pollObservation(page, (o) => o['exact'] === true);
  const o = await readObservation(page);
  expect(o).toMatchObject({
    count: 4,
    countByUnit: { 'clip-3cm': 4 },
    gaps: 0,
    overlaps: 0,
    startsAtZero: true,
    reachesEnd: true,
    misconceptions: [],
  });
  await expect(page.locator('[data-part="gap"], [data-part="overlap"]')).toHaveCount(0);
});

test('length: 일부러 틈을 만들면 "틈" 글·빗금과 오개념 기록이 생긴다', async ({ page }) => {
  await open(page, 'length');
  await dragUnit(page, '클립 놓기', 1.5);
  await pollObservation(page, (o) => o['count'] === 1);
  // 둘째 조각은 첫 조각 끝(3cm)에서 2cm 띄운다(1cm를 넘으면 붙지 않는다).
  await dragUnit(page, '클립 놓기', 6.5);
  await pollObservation(page, (o) => o['count'] === 2 && o['gaps'] === 1);
  const o = await readObservation(page);
  expect(o['misconceptions']).toEqual(['MC-MEASURE-GAP']);
  expect(o['exact']).toBe(false);
  const gap = page.locator('[data-part="gap"]');
  await expect(gap).toHaveCount(1);
  await expect(gap.locator('text')).toHaveText('틈');
  await expect(gap.locator('rect')).toHaveAttribute('fill', /url\(#e13-gap-hatch\)/);
});

test('length: 조각을 끌어 겹치면 "겹침"이 보이고, 띠 밖으로 끌어내면 지워진다', async ({
  page,
}) => {
  const id = await open(page, 'length');
  await dragUnit(page, '클립 놓기', 1.5);
  await dragUnit(page, '클립 놓기', 4.5);
  await pollObservation(page, (o) => o['count'] === 2 && o['exact'] === false);
  // 둘째 조각(3~6cm)을 왼쪽으로 1.5cm 끌어 겹친다(끌어 옮길 때도 1.5cm는 붙는 범위 밖).
  const second = page.locator('[data-part="piece"][data-index="1"] [data-part="hit"]');
  const from = await centerOf(second);
  await dragBetween(page, from, {
    x: from.x - 1.5 * PPC_PENCIL * (await scaleOf(page, id)),
    y: from.y,
  });
  await pollObservation(page, (o) => o['overlaps'] === 1);
  await expect(page.locator('[data-part="overlap"] text')).toHaveText('겹침');
  // 띠에서 아래로 멀리 끌어 놓으면 조각이 지워진다.
  const piece = page.locator('[data-part="piece"][data-index="1"] [data-part="hit"]');
  const at = await centerOf(piece);
  await dragBetween(page, at, { x: at.x, y: at.y + 220 });
  await pollObservation(page, (o) => o['count'] === 1);
});

async function scaleOf(page: Page, id: string): Promise<number> {
  const box = await canvasOf(page, id).boundingBox();
  if (!box) throw new Error('캔버스를 찾지 못했습니다.');
  return box.width / 1000;
}

test('length: 키보드로 1cm 블록 10개 → 자 만들기 → 숫자 놓기(눈금 키 입력·카드 끌기)', async ({
  page,
}) => {
  await open(page, 'length');
  expect(await button(page, '자 만들기').isDisabled()).toBe(true);
  const block = button(page, '1cm 블록 놓기');
  await block.focus();
  for (let i = 0; i < 10; i += 1) {
    await page.keyboard.press('Enter');
    await pollObservation(page, (o) => o['count'] === i + 1);
  }
  expect(await readObservation(page)).toMatchObject({ gaps: 0, overlaps: 0, startsAtZero: true });
  await expect(button(page, '자 만들기')).toBeEnabled();
  await button(page, '자 만들기').click();
  await pollObservation(page, (o) => o['rulerMade'] === true);
  const canvas = canvasOf(page, 'length-canvas');
  await expect(canvas.locator('[data-part="tick"]')).toHaveCount(11);
  // 자를 만든 뒤에는 단위 단추가 꺼진다.
  await expect(button(page, '1cm 블록 놓기')).toBeDisabled();

  // 숫자 카드를 끌어 눈금 3에 놓는다(가장 가까운 눈금: 눈금 칸은 88px 간격, 가운데 y 264).
  const card = button(page, '숫자 3');
  const from = await centerOf(card);
  const to = await toScreen(page, 'length-canvas', 60 + 3 * 88 + 10, 264);
  await dragBetween(page, from, to);
  await pollObservation(page, (o) => (o['labels'] as Record<string, number>)['3'] === 3);

  // 나머지는 눈금에 초점을 두고 숫자를 누른다(10은 1, 0).
  for (let tick = 0; tick <= 10; tick += 1) {
    if (tick === 3) continue;
    await canvas.locator(`[data-part="tick"][data-tick="${tick}"]`).focus();
    if (tick === 10) {
      await page.keyboard.press('1');
      await page.keyboard.press('0');
    } else {
      await page.keyboard.press(String(tick));
    }
  }
  await pollObservation(page, (o) => o['labelsCorrect'] === true);
  await expect(canvas.locator('[data-part="tick-value"]')).toHaveCount(11);
});

test('length: Backspace는 마지막 조각을 지우고 [처음으로]는 모두 지운다', async ({ page }) => {
  await open(page, 'length');
  const clip = button(page, '클립 놓기');
  await clip.click();
  await clip.click();
  await pollObservation(page, (o) => o['count'] === 2);
  await clip.focus();
  await page.keyboard.press('Backspace');
  await pollObservation(page, (o) => o['count'] === 1);
  await button(page, '처음으로').click();
  await pollObservation(page, (o) => o['count'] === 0);
});

test('length: 뼘 시연은 판 위쪽에 두 친구가 잰 결과를 보여 준다', async ({ page }) => {
  await open(page, 'length', {
    object: { name: 'pencil', lengthCm: 12 },
    units: ['clip-3cm', 'cm-block'],
    demoSpans: { objectName: 'desk', objectCm: 60 },
  });
  const canvas = canvasOf(page, 'length-canvas');
  await expect(canvas.locator('[data-part="demo-row"]')).toHaveCount(2);
  await expect(canvas).toContainText('4번');
  await expect(canvas).toContainText('5번');
  // 시연 뒤에도 띠가 판 안에 보인다(아래로 밀린 좌표).
  const band = await canvas.locator('[data-part="band"]').boundingBox();
  const box = await canvas.boundingBox();
  if (!band || !box) throw new Error('상자를 찾지 못했습니다.');
  expect(band.y + band.height).toBeLessThanOrEqual(box.y + box.height + 1);
});

// ── 오버레이 정렬 ────────────────────────────────────────

async function toggleOverlay(page: Page): Promise<void> {
  await page.getByRole('button', { name: '힌트 겹쳐 보기' }).click();
}

/** 오버레이 svg 상자가 본 판 상자와 1px 이내로 같다(overlay-alignment 방식). */
async function expectAligned(page: Page, canvasId: string, overlay: string): Promise<Locator> {
  const layer = page.locator(`[data-overlay="${overlay}"]`);
  await expect(layer).toBeVisible();
  await expect
    .poll(async () => {
      const a = await canvasOf(page, canvasId).boundingBox();
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

/**
 * 두 요소의 화면 중심이 tolerance(px) 안이다. 선 굵기가 달라도 중심은 같으므로 굵기와 무관하게 본다.
 * 본 판 svg에는 1px 테두리가 있어 가장자리 쪽 요소는 오버레이와 최대 1px 남짓 어긋나 보인다(기존 오버레이도 같다).
 */
async function expectCentersClose(
  a: Locator,
  b: Locator,
  tolerance = 1.5,
  axes: 'x' | 'xy' = 'xy',
): Promise<void> {
  const [boxA, boxB] = [await a.boundingBox(), await b.boundingBox()];
  if (!boxA || !boxB) throw new Error('상자를 찾지 못했습니다.');
  expect(Math.abs(boxA.x + boxA.width / 2 - (boxB.x + boxB.width / 2))).toBeLessThanOrEqual(
    tolerance,
  );
  if (axes === 'xy') {
    expect(Math.abs(boxA.y + boxA.height / 2 - (boxB.y + boxB.height / 2))).toBeLessThanOrEqual(
      tolerance,
    );
  }
}

test('힌트 ② endpoint-lines: 출발선과 어긋난 만큼 괄호와 "어긋남"', async ({ page }) => {
  await open(page, 'compare-direct', {}, 'stage=fit&overlay=endpoint-lines');
  await toggleOverlay(page);
  const layer = await expectAligned(page, 'compare-canvas', 'endpoint-lines');
  await expect(layer).toContainText('어긋남');
  await expect(layer.locator('[data-part="bracket"]')).toHaveCount(1);
  // 기준선은 본 출발선과 같은 x에 겹친다(세로선이라 x만 본다. WebKit은 선 상자의 y를 다르게 돌려준다).
  await expectCentersClose(
    layer.locator('[data-part="reference-line"]'),
    canvasOf(page, 'compare-canvas').locator('[data-part="baseline"] line'),
    1.5,
    'x',
  );
  // 밧줄 나의 왼쪽 끝 점선은 본 물건의 왼쪽 끝 표시(첫 선)와 같은 x에 놓인다.
  const mine = await canvasOf(page, 'compare-canvas')
    .locator('[data-id="rope-b"] line')
    .first()
    .boundingBox();
  const mark = await layer.locator('[data-id="rope-b"] [data-part="end-line"]').boundingBox();
  if (!mine || !mark) throw new Error('상자를 찾지 못했습니다.');
  expect(Math.abs(mine.x - mark.x)).toBeLessThanOrEqual(1.5); // 본 판 테두리 1px 몫
});

test('힌트 ② half-straighten: 곡선 밧줄 앞쪽 절반을 곧게 편 점선 미리보기', async ({ page }) => {
  await open(
    page,
    'compare-direct',
    {},
    `stage=fit&overlay=half-straighten&overlayArgs=${encodeURIComponent('{"id":"rope-a"}')}`,
  );
  await toggleOverlay(page);
  const layer = await expectAligned(page, 'compare-canvas', 'half-straighten');
  const preview = layer.locator('[data-part="half-preview"] path');
  await expect(preview).toHaveCount(1);
  // 미리보기는 본 밧줄과 같은 왼쪽 끝(논리 좌표)에서 시작한다.
  const item = await canvasOf(page, 'compare-canvas')
    .locator('[data-part="item"][data-id="rope-a"]')
    .getAttribute('transform');
  const [ox, oy] = (item?.match(/translate\(([\d.]+) ([\d.]+)\)/) ?? []).slice(1).map(Number);
  const d = (await preview.getAttribute('d')) ?? '';
  const [px, py] = (d.match(/^M([\d.]+) ([\d.]+)/) ?? []).slice(1).map(Number);
  expect(px).toBeCloseTo(ox ?? Number.NaN, 1);
  expect(py).toBeCloseTo(oy ?? Number.NaN, 1);
  // 앞 절반이 곧게 펴져 가로로 더 길어진다(곡선의 가로 폭보다 크다).
  const rope = await canvasOf(page, 'compare-canvas')
    .locator('[data-id="rope-a"] [data-part="rope"] path')
    .first()
    .boundingBox();
  const drawn = await preview.boundingBox();
  if (!rope || !drawn) throw new Error('상자를 찾지 못했습니다.');
  expect(drawn.width).toBeGreaterThan(rope.width);
  // 이미 편 밧줄에서는 그리지 않는다.
  await button(page, '밧줄 가 펴기').click();
  await expect(layer.locator('svg')).toHaveCount(0);
});

test('힌트 ② same-tank: 두 컵 아래 점선 수조와 화살표, 물 높이는 없다', async ({ page }) => {
  await open(page, 'compare-direct', CAPACITY_CONFIG, 'stage=fit&overlay=same-tank');
  await toggleOverlay(page);
  const layer = await expectAligned(page, 'compare-canvas', 'same-tank');
  await expect(layer).toContainText('같은 수조에 부어 봐요');
  await expect(layer.locator('[data-part="tank-outline"]')).toHaveCount(2);
  await expect(layer.locator('[data-part="arrow"]')).toHaveCount(2);
  await expect(layer.locator('[data-part="tank-water"]')).toHaveCount(0);
  // 점선 윤곽은 본 수조와 같은 크기·자리에 겹친다.
  await expectCentersClose(
    layer.locator('[data-part="tank-outline"]').first(),
    canvasOf(page, 'compare-canvas').locator('[data-part="tank"] path').first(),
  );
});

async function makeGapAndOverlap(page: Page): Promise<void> {
  const clip = button(page, '클립 놓기');
  await clip.click();
  await clip.click(); // 0~3, 3~6
  await clip.click(); // 6~9
  await pollObservation(page, (o) => o['count'] === 3);
  // 둘째를 +2cm 옮기면 앞에는 틈(3~5cm), 뒤에는 셋째와 겹침(6~8cm)이 생긴다.
  const second = page.getByRole('button', { name: '2번째 조각, 클립' });
  await second.focus();
  for (let i = 0; i < 4; i += 1) await page.keyboard.press('ArrowRight');
  await pollObservation(page, (o) => o['gaps'] === 1 && o['overlaps'] === 1);
}

test('힌트 ② gap-marks: 틈마다 빨간 띠와 "틈"을 본 표시와 같은 자리에 크게 다시 그린다', async ({
  page,
}) => {
  await open(page, 'length', {}, 'stage=fit&overlay=gap-marks');
  await makeGapAndOverlap(page);
  await toggleOverlay(page);
  const layer = await expectAligned(page, 'length-canvas', 'gap-marks');
  await expect(layer.locator('[data-part="gap-mark"] text')).toHaveText('틈');
  const board = canvasOf(page, 'length-canvas');
  const gapBoard = board.locator('[data-part="gap"] rect').first();
  const gapOverlay = layer.locator('[data-part="gap-mark"] rect').first();
  const a = await gapBoard.boundingBox();
  const b = await gapOverlay.boundingBox();
  if (!a || !b) throw new Error('상자를 찾지 못했습니다.');
  // 선 굵기가 달라 상자 크기는 다르므로 가로 중심으로 같은 자리인지 본다.
  expect(Math.abs(a.x + a.width / 2 - (b.x + b.width / 2))).toBeLessThanOrEqual(1.5);
  // 오버레이 띠가 더 크게(위아래로 길게) 그려진다.
  expect(b.height).toBeGreaterThan(a.height);
});

test('힌트 ② gap-marks: 겹침은 "겹침" 줄무늬, 틈과 겹침이 없으면 그리지 않는다', async ({
  page,
}) => {
  await open(page, 'length', {}, 'stage=fit&overlay=gap-marks');
  const clip = button(page, '클립 놓기');
  await clip.click();
  await clip.click();
  await pollObservation(page, (o) => o['count'] === 2);
  await toggleOverlay(page);
  await expect(page.locator('[data-overlay="gap-marks"] svg')).toHaveCount(0);
  const second = page.getByRole('button', { name: '2번째 조각, 클립' });
  await second.focus();
  await page.keyboard.press('ArrowLeft');
  await pollObservation(page, (o) => o['overlaps'] === 1);
  const layer = await expectAligned(page, 'length-canvas', 'gap-marks');
  await expect(layer.locator('[data-part="overlap-mark"] text')).toHaveText('겹침');
  const a = await canvasOf(page, 'length-canvas')
    .locator('[data-part="overlap"] rect')
    .boundingBox();
  const b = await layer.locator('[data-part="overlap-mark"] rect').boundingBox();
  if (!a || !b) throw new Error('상자를 찾지 못했습니다.');
  expect(Math.abs(a.x + a.width / 2 - (b.x + b.width / 2))).toBeLessThanOrEqual(1.5);
});

test('힌트 ② span-compare: 두 뼘을 왼쪽 끝을 맞춰 겹쳐 그리고 숫자는 없다', async ({ page }) => {
  await open(
    page,
    'length',
    {
      object: { name: 'pencil', lengthCm: 12 },
      units: ['clip-3cm', 'cm-block'],
      demoSpans: { objectName: 'desk', objectCm: 60 },
    },
    'stage=fit&overlay=span-compare',
  );
  await toggleOverlay(page);
  const layer = await expectAligned(page, 'length-canvas', 'span-compare');
  await expect(layer).toContainText('두 뼘의 크기');
  const spans = layer.locator('[data-part="span"]');
  await expect(spans).toHaveCount(2);
  const [first, second] = [await spans.nth(0).boundingBox(), await spans.nth(1).boundingBox()];
  if (!first || !second) throw new Error('상자를 찾지 못했습니다.');
  expect(Math.abs(first.x - second.x)).toBeLessThanOrEqual(1);
  expect(first.width).toBeGreaterThan(second.width);
  expect((await layer.textContent()) ?? '').not.toMatch(/\d/);
  // 시연 쪽 뼘 타일(가 친구)과 비율이 같다: 뼘 가 : 뼘 나 = 15 : 12.
  expect(first.width / second.width).toBeCloseTo(15 / 12, 1);
});

// ── 기준 이미지 ──────────────────────────────────────────

async function expectPageSnapshot(page: Page, name: string): Promise<void> {
  test.skip(test.info().project.name === 'board', '기준 이미지는 크롬북·아이패드만 둔다.');
  await page.waitForTimeout(600);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.getByTestId('measure-controls').evaluate((element) => {
    element.scrollTo(0, 0);
    // T199 원칙: 좁은 판에서는 엔진 바깥 상자(.wrap)가 세로로 스크롤한다.
    element.closest('[class*="wrap"]')?.scrollTo(0, 0);
  });
  await expect(page).toHaveScreenshot(name, { fullPage: true, animations: 'disabled' });
}

test('화면 기준: compare-direct 첫 화면', async ({ page }) => {
  await open(page, 'compare-direct');
  await page.getByRole('heading', { name: '측정 실험실' }).focus();
  await expectPageSnapshot(page, 'measure-compare.png');
});

test('화면 기준: length 첫 화면', async ({ page }) => {
  await open(page, 'length');
  await page.getByRole('heading', { name: '측정 실험실' }).focus();
  await expectPageSnapshot(page, 'measure-length.png');
});

test('화면 기준: length 틈이 있는 화면(뼘 시연 포함)', async ({ page }) => {
  await open(page, 'length', {
    object: { name: 'pencil', lengthCm: 12 },
    units: ['clip-3cm', 'cm-block'],
    demoSpans: { objectName: 'desk', objectCm: 60 },
  });
  // 뼘 시연이 있으면 띠가 아래로 밀려 중심선 y가 316이다.
  await dragUnit(page, '클립 놓기', 1.5, 316);
  await pollObservation(page, (o) => o['count'] === 1);
  const clip = button(page, '클립 놓기');
  await clip.click();
  await pollObservation(page, (o) => o['count'] === 2);
  await page.getByRole('button', { name: '2번째 조각, 클립' }).focus();
  for (let i = 0; i < 4; i += 1) await page.keyboard.press('ArrowRight');
  await pollObservation(page, (o) => o['gaps'] === 1);
  await page.getByRole('heading', { name: '측정 실험실' }).focus();
  await expectPageSnapshot(page, 'measure-length-gap.png');
});

// ── 터치 타깃 ────────────────────────────────────────────

async function expectMin(locator: Locator, min: number, label: string): Promise<void> {
  const box = await locator.boundingBox();
  if (!box) throw new Error(`${label}: 상자를 찾지 못했습니다.`);
  expect(Math.min(box.width, box.height), label).toBeGreaterThanOrEqual(min - 0.5);
}

for (const size of [48, 64] as const) {
  test(`터치 타깃 ${size}: length 트레이·조작 단추가 ${size}px 이상`, async ({ page }) => {
    await open(page, 'length');
    // 설정은 저장되므로 아직 48px일 때만 눌러 64px로 바꾼다.
    const toggle = page.getByRole('button', { name: '터치 48px' });
    if (size === 64 && (await toggle.count()) > 0) await toggle.click();
    const buttons = page.getByTestId('measure-controls').getByRole('button');
    const count = await buttons.count();
    // 클립·1cm 블록, 마지막 조각 지우기, 자 만들기, 처음으로
    expect(count).toBe(5);
    for (let i = 0; i < count; i += 1) {
      await buttons.nth(i).scrollIntoViewIfNeeded();
      await expectMin(buttons.nth(i), size, `단추 ${i}`);
    }
  });
}

test('터치 타깃 64: 자를 만든 뒤 숫자 카드 단추도 64px 이상', async ({ page }) => {
  await open(page, 'length');
  const toggle = page.getByRole('button', { name: '터치 48px' });
  if ((await toggle.count()) > 0) await toggle.click();
  const block = button(page, '1cm 블록 놓기');
  await block.focus();
  for (let i = 0; i < 10; i += 1) await page.keyboard.press('Enter');
  await pollObservation(page, (o) => o['count'] === 10);
  await button(page, '자 만들기').click();
  await pollObservation(page, (o) => o['rulerMade'] === true);
  for (let value = 0; value <= 10; value += 1) {
    const card = button(page, `숫자 ${value}`);
    await card.scrollIntoViewIfNeeded();
    await expectMin(card, 64, `카드 ${value}`);
  }
});
