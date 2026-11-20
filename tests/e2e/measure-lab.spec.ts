import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { expectControlsAboveFold } from './controls-fold';
import { expectChromeBookCanvasSize, expectSandboxCanvasVisible } from './panel-layout';

/**
 * E13 측정 실험실(compare-direct·length·estimate·map-route·capacity·weight) 샌드박스 E2E. 아이패드(WebKit)·크롬북·전자칠판 뷰포트.
 *
 * - compare-direct: 펴기 단추·끌어 펴기, 출발선 자석, 넓이 겹치기, 들이 붓기
 * - length: 클립 4개 자석 이어 붙이기 → exact, 일부러 만든 틈 표시, 키보드로 1cm 블록 10개 → 자 만들기 → 숫자 놓기
 * - estimate(T208): 어림 먼저 → 자 끌어 영점 맞추기(자석·키보드), length mergeRule: 10cm 막대 10개 → 합체,
 *   length unit-train: 키보드로 승격·풀기·빼기
 * - estimate zoomLevels(T211): [확대]로 1cm가 mm 눈금 10칸으로 보임, map-route(T211): 길을 눌러·키보드로 경로 만들기
 * - capacity·weight(T213): 컵으로 붓기, 눈금 없는 비커 퍼즐(단추·끌어서 붓기), 예측 → 윗접시저울, 용수철저울 걸기, 키보드
 * - roll-circle(T215): 지름 고르기 → 굴리기(단추·끌기·키보드) → 지름 막대 → 기록표, 오버레이 둘
 * - 힌트 ② 오버레이 열셋이 본 판과 1px 안에 겹침
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

type ModeName = 'compare-direct' | 'length' | 'estimate' | 'map-route' | 'capacity' | 'weight';

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
  // length 모드의 unit-train 변형(variant)은 따로 기차 판을 그린다.
  const canvasId =
    mode === 'estimate'
      ? 'estimate-canvas'
      : mode === 'map-route'
        ? 'route-canvas'
        : mode === 'capacity'
          ? 'capacity-canvas'
          : mode === 'weight'
            ? 'weight-canvas'
            : mode === 'length'
              ? config['variant'] === undefined
                ? 'length-canvas'
                : config['variant'] === 'roll-circle'
                  ? 'roll-canvas'
                  : 'train-canvas'
              : 'compare-canvas';
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
  ppc = PPC_PENCIL,
): Promise<void> {
  const from = await centerOf(button(page, name));
  const to = await toScreen(page, 'length-canvas', cmX(centerCm, ppc), bandY);
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

// ══ T208: estimate · mergeRule · unit-train ═══════════════════════════

/** 판 좌표(논리 1000 기준)에서 from → to로 끈다. 배율은 상자 너비로만 구한다. */
async function dragOnBoard(
  page: Page,
  id: string,
  from: { x: number; y: number },
  to: { x: number; y: number },
): Promise<void> {
  await canvasOf(page, id).scrollIntoViewIfNeeded();
  const start = await toScreen(page, id, from.x, from.y);
  const end = await toScreen(page, id, to.x, to.y);
  await dragBetween(page, start, end);
}

/** estimate 자 위(논리 좌표): 눈금 3에서 시작하는 자는 왼쪽 끝 110, 몸통 y 262~354. */
const RULER_GRAB = { x: 485, y: 308 };
const PPC_ESTIMATE = 30;

const ESTIMATE_PLAIN = {
  object: { name: 'crayon', lengthCm: '6.7' },
  ruler: { offsetCm: 3, draggable: true },
};

test('estimate: 어림을 먼저 넣기 전에는 자가 없고, 넣은 뒤 자를 끌어 영점을 맞춘다', async ({
  page,
}) => {
  const id = await open(page, 'estimate');
  const canvas = canvasOf(page, id);
  await expect(canvas.locator('[data-part="ruler"]')).toHaveCount(0);
  await expect(canvas).toContainText('먼저 어림해 보세요');
  expect(await readObservation(page)).toMatchObject({ estimateLocked: false, estimate: null });
  await button(page, '숫자 7').click();
  await expect(page.getByTestId('estimate-draft')).toHaveText('어림: 7cm');
  await button(page, '어림 넣기').click();
  await pollObservation(page, (o) => o['estimateLocked'] === true && o['estimate'] === 7);
  await expect(canvas.locator('[data-part="estimate-bar"]')).toHaveCount(1);
  await expect(canvas.locator('[data-part="ruler"]')).toHaveCount(1);
  expect(await readObservation(page)).toMatchObject({ zeroAligned: false, rulerOffset: '3' });
  // 어림은 한 번만: 키패드가 꺼진다.
  await expect(button(page, '숫자 5')).toBeDisabled();
  // 자를 오른쪽으로 3cm 끌면 물건 왼쪽 끝이 영점에 놓인다.
  await dragOnBoard(page, id, RULER_GRAB, {
    x: RULER_GRAB.x + 3 * PPC_ESTIMATE,
    y: RULER_GRAB.y,
  });
  await pollObservation(page, (o) => o['zeroAligned'] === true);
  expect(await readObservation(page)).toMatchObject({
    rulerOffset: '0',
    endTick: '67/10',
    nearestCm: 7,
    rulerMoved: true,
  });
});

test('estimate: 자 끌기는 0.5cm 격자에 붙고 영점 1cm 안이면 0에 붙는다', async ({ page }) => {
  const id = await open(page, 'estimate', { ...ESTIMATE_PLAIN, estimateFirst: false });
  // 0.6cm 오른쪽: 눈금 2.4 → 0.5 격자 2.5
  await dragOnBoard(page, id, RULER_GRAB, { x: RULER_GRAB.x + 18, y: RULER_GRAB.y });
  await pollObservation(page, (o) => o['rulerOffset'] === '5/2');
  // 1.8cm 더 오른쪽: 눈금 0.7 → 영점 1cm 안이라 0
  await dragOnBoard(page, id, RULER_GRAB, { x: RULER_GRAB.x + 54, y: RULER_GRAB.y });
  await pollObservation(page, (o) => o['zeroAligned'] === true);
  // 자 제자리로: 자만 눈금 3으로 돌아온다.
  await button(page, '자 제자리로').click();
  await pollObservation(page, (o) => o['rulerOffset'] === '3' && o['rulerMoved'] === false);
});

test('estimate: 키보드 ←→로 자를 0.5cm씩 옮긴다(영점 너머는 막힌다)', async ({ page }) => {
  const id = await open(page, 'estimate', { ...ESTIMATE_PLAIN, estimateFirst: false });
  const ruler = page.getByRole('button', { name: '자. ←→로 옮겨요' });
  await ruler.focus();
  for (let i = 0; i < 6; i += 1) await page.keyboard.press('ArrowRight');
  await pollObservation(page, (o) => o['zeroAligned'] === true);
  await page.keyboard.press('ArrowRight');
  await expect(page.getByTestId('measure-message')).toContainText('옮길 수 없어요');
  await page.keyboard.press('ArrowLeft');
  await pollObservation(page, (o) => o['rulerOffset'] === '1/2');
  // 정답(길이)은 화면 글에 없다.
  await expect(canvasOf(page, id)).not.toContainText('6.7');
});

test('estimate: draggable이 false이면 자를 끌어도 움직이지 않는다', async ({ page }) => {
  const id = await open(page, 'estimate', {
    object: { name: 'crayon', lengthCm: '6.7' },
    ruler: { offsetCm: 3, draggable: false },
  });
  await dragOnBoard(page, id, RULER_GRAB, { x: RULER_GRAB.x + 90, y: RULER_GRAB.y });
  expect(await readObservation(page)).toMatchObject({ rulerOffset: '3', rulerMoved: false });
});

// ── mergeRule ────────────────────────────────────────────

const MERGE_CONFIG = {
  mergeRule: { from: 'cm-10-rod', count: 10, to: 'm-tape' },
  object: { name: 'blackboard', lengthCm: 320 },
  units: ['cm-10-rod'],
};
/** 칠판 320cm: 배율 880/335, 위 120px을 1m 줄자 자리로 비워 띠 위쪽이 200, 가운데 226. */
const PPC_BOARD = 880 / (320 + 15);
const MERGE_BAND_Y = 226;

test('mergeRule: 10cm 막대 10개를 끌어 이으면 1m 줄자 하나로 합체한다', async ({ page }) => {
  const id = await open(page, 'length', MERGE_CONFIG);
  expect((await readObservation(page))['merges']).toBe(0);
  // 조각 가운데를 목표(5, 15, …)에서 2cm씩 어긋나게 놓아도 10cm 격자에 붙는다.
  for (let i = 0; i < 10; i += 1) {
    await dragUnit(page, '10cm 막대 놓기', 5 + 10 * i + 2, MERGE_BAND_Y, PPC_BOARD);
    await pollObservation(page, (o) => o['count'] === i + 1 || o['merges'] === 1);
    if (i < 9) expect((await readObservation(page))['merges']).toBe(0);
  }
  await pollObservation(page, (o) => o['merges'] === 1 && o['meters'] === 1 && o['count'] === 1);
  const canvas = canvasOf(page, id);
  await expect(canvas.locator('[data-part="piece"][data-unit="m-tape"]')).toHaveCount(1);
  await expect(canvas.locator('[data-part="piece"][data-unit="cm-10-rod"]')).toHaveCount(0);
  await expect(canvas.locator('[data-part="piece"] [data-part="unit-ticks"]')).toHaveCount(1);
  // 칠판 길이(320)는 화면 글에 없다.
  await expect(canvas).not.toContainText('320');
});

test('mergeRule: 키보드로 막대를 이어 붙이면 3m 20cm에서 exact, 합체는 세 번', async ({ page }) => {
  await open(page, 'length', MERGE_CONFIG);
  await button(page, '10cm 막대 놓기').focus();
  for (let i = 0; i < 32; i += 1) await page.keyboard.press('Enter');
  await pollObservation(page, (o) => o['merges'] === 3 && o['count'] === 5);
  expect(await readObservation(page)).toMatchObject({
    meters: 3,
    restCm: '20',
    exact: true,
    gaps: 0,
    overlaps: 0,
  });
});

test('mergeRule: 틈이 있으면 합체하지 않고, 방향키로 틈을 메우면 합체한다', async ({ page }) => {
  const id = await open(page, 'length', MERGE_CONFIG);
  const rod = button(page, '10cm 막대 놓기');
  await rod.focus();
  for (let i = 0; i < 9; i += 1) await page.keyboard.press('Enter');
  await pollObservation(page, (o) => o['count'] === 9);
  // 열 번째 막대를 한 칸(10cm) 띄워 놓는다.
  await dragUnit(page, '10cm 막대 놓기', 105, MERGE_BAND_Y, PPC_BOARD);
  await pollObservation(page, (o) => o['count'] === 10 && o['gaps'] === 1);
  expect((await readObservation(page))['merges']).toBe(0);
  await canvasOf(page, id).getByRole('button', { name: '10번째 조각, 10cm 막대' }).focus();
  await page.keyboard.press('ArrowLeft'); // 10cm 격자로 한 칸
  await pollObservation(page, (o) => o['merges'] === 1 && o['count'] === 1);
});

// ── unit-train ───────────────────────────────────────────

const TRAIN_ADD = { variant: 'unit-train', op: 'add', a: '1m 70cm', b: '2m 50cm' };
const TRAIN_SUB = { variant: 'unit-train', op: 'sub', a: '5m 20cm', b: '2m 60cm' };

test('unit-train 덧셈: 키보드로 [1m로 바꾸기]·[10cm 막대로 풀기]를 누른다(3m 120cm → 4m 20cm → 3m 120cm)', async ({
  page,
}) => {
  const id = await open(page, 'length', TRAIN_ADD);
  expect(await readObservation(page)).toMatchObject({
    variant: 'unit-train',
    m: 3,
    cm: 120,
    normalized: false,
    misconceptions: ['MC-LENGTH-NO-PROMOTE'],
  });
  const canvas = canvasOf(page, id);
  await expect(canvas.locator('[data-part="m-cell"]')).toHaveCount(3);
  await expect(canvas.locator('[data-part="rod"]')).toHaveCount(12);
  await button(page, '1m로 바꾸기').focus();
  await page.keyboard.press('Enter');
  await pollObservation(page, (o) => o['m'] === 4 && o['cm'] === 20 && o['normalized'] === true);
  expect(await readObservation(page)).toMatchObject({ promotes: 1, misconceptions: [] });
  await expect(canvas.locator('[data-part="m-cell"]')).toHaveCount(4);
  await expect(canvas.locator('[data-part="rod"]')).toHaveCount(2);
  // 막대가 10개 모자라 한 번 더 승격하면 거절된다.
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('measure-message')).toContainText('10개');
  await button(page, '10cm 막대로 풀기').focus();
  await page.keyboard.press('Space');
  await pollObservation(page, (o) => o['m'] === 3 && o['cm'] === 120);
  expect((await readObservation(page))['unpacks']).toBe(1);
});

test('unit-train 뺄셈: 칸이 모자라면 거절 → [풀기] → [빼기]로 2m 60cm', async ({ page }) => {
  const id = await open(page, 'length', TRAIN_SUB);
  await expect(canvasOf(page, id).locator('[data-part="subtrahend"]')).toContainText(
    '뺄 길이 2m 60cm',
  );
  await button(page, '빼기').focus();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('measure-message')).toHaveText('칸이 모자라요.');
  expect((await readObservation(page))['tookAway']).toBe(false);
  await button(page, '10cm 막대로 풀기').focus();
  await page.keyboard.press('Enter');
  await pollObservation(page, (o) => o['m'] === 4 && o['cm'] === 120);
  await button(page, '빼기').focus();
  await page.keyboard.press('Enter');
  await pollObservation(page, (o) => o['tookAway'] === true);
  expect(await readObservation(page)).toMatchObject({ m: 2, cm: 60, totalCm: 260, unpacks: 1 });
  await button(page, '처음으로').click();
  await pollObservation(page, (o) => o['m'] === 5 && o['cm'] === 20 && o['tookAway'] === false);
});

test('unit-train: 단추가 모두 48px 이상이다', async ({ page }) => {
  await open(page, 'length', TRAIN_SUB);
  const buttons = page.getByTestId('measure-controls').getByRole('button');
  expect(await buttons.count()).toBe(5);
  for (let i = 0; i < 5; i += 1) {
    await buttons.nth(i).scrollIntoViewIfNeeded();
    await expectMin(buttons.nth(i), 48, `단추 ${i}`);
  }
});

// ── T208 오버레이 정렬 ───────────────────────────────────

test('힌트 ② count-cells: 물건이 시작한 눈금부터 1cm 칸을 칠하고, 자의 눈금과 같은 자리다', async ({
  page,
}) => {
  await open(
    page,
    'estimate',
    { ...ESTIMATE_PLAIN, estimateFirst: false },
    'stage=fit&overlay=count-cells',
  );
  await toggleOverlay(page);
  const layer = await expectAligned(page, 'estimate-canvas', 'count-cells');
  const cells = layer.locator('[data-part="cell"]');
  await expect(cells).toHaveCount(6);
  await expect(layer.locator('[data-part="cell-part"]')).toHaveCount(1);
  expect(((await layer.textContent()) ?? '').trim()).toBe('');
  // 첫 칸의 왼쪽 끝은 물건의 왼쪽 끝과 같고, 둘째 칸의 왼쪽 끝은 자의 눈금 4와 같은 x다.
  const board = canvasOf(page, 'estimate-canvas');
  const object = await board.locator('[data-part="object"] rect').first().boundingBox();
  const first = await cells.nth(0).boundingBox();
  const second = await cells.nth(1).boundingBox();
  const tick4 = await board.locator('[data-part="ruler-tick"] line').nth(4).boundingBox();
  const tick5 = await board.locator('[data-part="ruler-tick"] line').nth(5).boundingBox();
  if (!object || !first || !second || !tick4 || !tick5) throw new Error('상자를 찾지 못했습니다.');
  expect(Math.abs(object.x - first.x)).toBeLessThanOrEqual(1.5);
  expect(Math.abs(second.x - (tick4.x + tick4.width / 2))).toBeLessThanOrEqual(2);
  // 칸 너비는 자의 1cm 눈금 간격과 같다.
  expect(Math.abs(second.width - (tick5.x - tick4.x))).toBeLessThanOrEqual(2.5);
});

test('힌트 ② meter-100: 1m 줄자를 100칸으로 펼친 그림이 띠의 폭과 같은 자리에 놓인다', async ({
  page,
}) => {
  await open(page, 'length', MERGE_CONFIG, 'stage=fit&overlay=meter-100');
  await toggleOverlay(page);
  const layer = await expectAligned(page, 'length-canvas', 'meter-100');
  await expect(layer.locator('[data-part="tick-10"]')).toHaveCount(9);
  await expect(layer.locator('[data-part="tick-number"]')).toHaveCount(10);
  await expect(layer.locator('[data-part="label"]')).toHaveText('1m');
  const bar = await layer.locator('[data-part="meter-bar"]').boundingBox();
  const band = await canvasOf(page, 'length-canvas').locator('[data-part="band"]').boundingBox();
  if (!bar || !band) throw new Error('상자를 찾지 못했습니다.');
  expect(Math.abs(bar.x - band.x)).toBeLessThanOrEqual(2);
  expect(Math.abs(bar.x + bar.width - (band.x + band.width))).toBeLessThanOrEqual(2);
  // 판 위쪽에 있어 띠 위로 겹치지 않는다.
  expect(bar.y + bar.height).toBeLessThan(band.y);
});

test('힌트 ② meter-100: unit-train 판에서도 같은 위쪽 자리에 겹친다', async ({ page }) => {
  await open(page, 'length', TRAIN_ADD, 'stage=fit&overlay=meter-100');
  await toggleOverlay(page);
  await expectAligned(page, 'train-canvas', 'meter-100');
});

test('힌트 ② meter-outline: 처음 10cm 막대 10개 둘레에 1m 칸 크기의 점선 상자와 "1m"', async ({
  page,
}) => {
  await open(page, 'length', TRAIN_ADD, 'stage=fit&overlay=meter-outline');
  await toggleOverlay(page);
  const layer = await expectAligned(page, 'train-canvas', 'meter-outline');
  await expect(layer.locator('[data-part="label"]')).toHaveText('1m');
  const outline = await layer.locator('[data-part="outline"]').boundingBox();
  const train = canvasOf(page, 'train-canvas');
  const group = await train.locator('[data-part="rod-group"]').first().boundingBox();
  const meter = await train.locator('[data-part="m-cell"]').first().boundingBox();
  if (!outline || !group || !meter) throw new Error('상자를 찾지 못했습니다.');
  // 상자 중심이 막대 열 개 묶음의 중심과 같고, 1m 칸과 같은 크기(여유 몇 px)다.
  expect(Math.abs(outline.x + outline.width / 2 - (group.x + group.width / 2))).toBeLessThanOrEqual(
    1.5,
  );
  expect(
    Math.abs(outline.y + outline.height / 2 - (group.y + group.height / 2)),
  ).toBeLessThanOrEqual(1.5);
  expect(Math.abs(outline.width - meter.width)).toBeLessThanOrEqual(0.2 * meter.width);
  // 승격하면 상자가 사라진다.
  await button(page, '1m로 바꾸기').click();
  await pollObservation(page, (o) => o['normalized'] === true);
  await expect(page.locator('[data-overlay="meter-outline"] svg')).toHaveCount(0);
});

// ── T208 기준 이미지 ─────────────────────────────────────

test('화면 기준: estimate 첫 화면(어림 먼저)', async ({ page }) => {
  await open(page, 'estimate');
  await page.getByRole('heading', { name: '측정 실험실' }).focus();
  await expectPageSnapshot(page, 'measure-estimate.png');
});

test('화면 기준: estimate 어림을 넣은 뒤(자와 내 어림 막대)', async ({ page }) => {
  await open(page, 'estimate');
  await button(page, '숫자 9').click();
  await button(page, '어림 넣기').click();
  await pollObservation(page, (o) => o['estimateLocked'] === true);
  await page.getByRole('heading', { name: '측정 실험실' }).focus();
  await expectPageSnapshot(page, 'measure-estimate-ruler.png');
});

test('화면 기준: length 합체 규칙(1m 줄자 하나와 막대 셋)', async ({ page }) => {
  await open(page, 'length', MERGE_CONFIG);
  await button(page, '10cm 막대 놓기').focus();
  for (let i = 0; i < 13; i += 1) await page.keyboard.press('Enter');
  await pollObservation(page, (o) => o['merges'] === 1 && o['count'] === 4);
  await page.getByRole('heading', { name: '측정 실험실' }).focus();
  await expectPageSnapshot(page, 'measure-merge.png');
});

test('화면 기준: length unit-train 첫 화면(1m 70cm + 2m 50cm)', async ({ page }) => {
  await open(page, 'length', TRAIN_ADD);
  await page.getByRole('heading', { name: '측정 실험실' }).focus();
  await expectPageSnapshot(page, 'measure-train.png');
});

// ══ T211: estimate 확대(zoomLevels) · map-route ═══════════════════════

const ZOOM_CONFIG = {
  object: { name: 'pencil', lengthCm: '3.7' },
  ruler: { offsetCm: 0, draggable: true },
  zoomLevels: ['cm', 'mm'],
};

/** 두 요소의 가로 중심 간격(화면 px). */
async function gapX(a: Locator, b: Locator): Promise<number> {
  const [boxA, boxB] = [await a.boundingBox(), await b.boundingBox()];
  if (!boxA || !boxB) throw new Error('상자를 찾지 못했습니다.');
  return boxB.x + boxB.width / 2 - (boxA.x + boxA.width / 2);
}

test('estimate 확대: [눈금 크게]를 누르면 1cm가 mm 눈금 10칸으로 나뉘어 8배로 보이고 [눈금 작게]로 돌아온다', async ({
  page,
}) => {
  const id = await open(page, 'estimate', ZOOM_CONFIG);
  const canvas = canvasOf(page, id);
  expect(await readObservation(page)).toMatchObject({ zoomed: false, lengthMm: '37' });
  await expect(canvas.locator('[data-part="zoom-tick"]')).toHaveCount(0);
  await button(page, '눈금 크게').click();
  await pollObservation(page, (o) => o['zoomed'] === true);
  const ticks = canvas.locator('[data-part="zoom-tick"]');
  await expect(ticks).toHaveCount(21);
  await expect(canvas.locator('[data-part="zoom-tick"][data-kind="cm"]')).toHaveCount(2);
  // 확대 눈금 한 칸(1mm)의 간격은 자의 1cm 간격의 0.8배(= 8배 확대 ÷ 10칸)다.
  const zoomStep = await gapX(ticks.nth(0).locator('line'), ticks.nth(1).locator('line'));
  const rulerStep = await gapX(
    canvas.locator('[data-part="ruler-tick"] line').nth(4),
    canvas.locator('[data-part="ruler-tick"] line').nth(5),
  );
  expect(zoomStep / rulerStep).toBeGreaterThan(0.78);
  expect(zoomStep / rulerStep).toBeLessThan(0.82);
  // 5mm 눈금은 mm 눈금보다 길고 cm 눈금은 더 길다.
  const heightOf = async (kind: string) =>
    (
      await canvas
        .locator(`[data-part="zoom-tick"][data-kind="${kind}"] line`)
        .first()
        .boundingBox()
    )?.height ?? 0;
  const [mmH, halfH, cmH] = [await heightOf('mm'), await heightOf('half'), await heightOf('cm')];
  expect(halfH).toBeGreaterThan(mmH + 1);
  expect(cmH).toBeGreaterThan(halfH + 1);
  // 물건 끝은 확대 그림의 가운데 선이고, 확대한 물건의 오른쪽 끝과 같은 자리다.
  const end = await canvas.locator('[data-part="zoom-end"]').boundingBox();
  const object = await canvas.locator('[data-part="zoom-object"]').boundingBox();
  const strip = await canvas.locator('[data-part="zoom-strip"]').boundingBox();
  if (!end || !object || !strip) throw new Error('상자를 찾지 못했습니다.');
  expect(Math.abs(end.x + end.width / 2 - (object.x + object.width))).toBeLessThanOrEqual(2);
  expect(Math.abs(end.x + end.width / 2 - (strip.x + strip.width / 2))).toBeLessThanOrEqual(2);
  // 3.7cm 끝의 확대 구간에는 cm 숫자 3과 4만 있고 판 글에 mm 값(37)은 없다.
  expect(await canvas.locator('[data-part="zoom-tick"] text').allTextContents()).toEqual([
    '3',
    '4',
  ]);
  expect((await page.getByTestId('measure-board').textContent()) ?? '').not.toContain('37');
  await button(page, '눈금 작게').click();
  await pollObservation(page, (o) => o['zoomed'] === false);
  await expect(ticks).toHaveCount(0);
});

test('estimate 확대: 키보드(Enter)로 [눈금 크게]를 누르고, 자를 옮기면 확대 숫자가 따라간다', async ({
  page,
}) => {
  const id = await open(page, 'estimate', {
    ...ZOOM_CONFIG,
    ruler: { offsetCm: 3, draggable: true },
  });
  const numerals = () =>
    canvasOf(page, id).locator('[data-part="zoom-tick"] text').allTextContents();
  await button(page, '눈금 크게').focus();
  await page.keyboard.press('Enter');
  await pollObservation(page, (o) => o['zoomed'] === true);
  // 끝이 6.7cm: 숫자 6과 7
  expect(await numerals()).toEqual(['6', '7']);
  // 자를 0.5cm 옮기면(끝 7.2) 숫자가 7과 8로 바뀐다. (방향키: 자 왼쪽 이동 = 눈금 +0.5)
  await canvasOf(page, id).locator('[data-part="ruler"]').focus();
  await page.keyboard.press('ArrowLeft');
  await pollObservation(page, (o) => o['rulerOffset'] === '7/2');
  expect(await numerals()).toEqual(['7', '8']);
});

const TOWN = {
  map: 'sample-town-01',
  segmentsM: { 'school-library': 450, 'library-park': 620, 'school-park': 980 },
  targetM: 1000,
};
/** 지도 위 길 한가운데·노드의 논리 좌표(maps.ts의 고정 좌표). 배율은 상자 너비로만 구한다. */
const ROAD_MID = {
  'school-library': { x: 310, y: 110 },
  'library-park': { x: 635, y: 115 },
} as const;
const NODE_AT = { school: { x: 150, y: 150 } } as const;

async function tapOnBoard(page: Page, id: string, at: { x: number; y: number }): Promise<void> {
  await canvasOf(page, id).scrollIntoViewIfNeeded();
  const point = await toScreen(page, id, at.x, at.y);
  await page.mouse.click(point.x, point.y);
}

test('map-route: 출발 노드와 길을 눌러 경로를 만들고, 1km 막대가 합만큼 채워진다(숫자 합계는 없다)', async ({
  page,
}) => {
  const id = await open(page, 'map-route', TOWN);
  const canvas = canvasOf(page, id);
  expect(await readObservation(page)).toMatchObject({ path: [], totalM: 0, reachedTo: false });
  await expect(canvas.locator('[data-part="goal-fill"]')).toHaveCount(0);
  // 출발을 정하기 전에는 길을 눌러도 이어지지 않는다.
  await tapOnBoard(page, id, ROAD_MID['school-library']);
  await expect(page.getByTestId('measure-message')).toContainText('출발');
  expect((await readObservation(page))['path']).toEqual([]);
  await tapOnBoard(page, id, NODE_AT.school);
  await pollObservation(page, (o) => Array.isArray(o['path']) && o['path'].length === 1);
  await tapOnBoard(page, id, ROAD_MID['school-library']);
  await tapOnBoard(page, id, ROAD_MID['library-park']);
  await pollObservation(page, (o) => o['totalM'] === 1070);
  expect(await readObservation(page)).toMatchObject({
    path: ['school', 'library', 'park'],
    diffFromTarget: 70,
    bestDiff: 20,
  });
  // 막대: 칠한 길이 / 전체 = 1070/1200, 목표 눈금은 전체의 1000/1200 자리.
  const track = await canvas.locator('[data-part="goal-track"]').boundingBox();
  const fill = await canvas.locator('[data-part="goal-fill"]').boundingBox();
  const mark = await canvas.locator('[data-part="goal-mark"]').boundingBox();
  if (!track || !fill || !mark) throw new Error('상자를 찾지 못했습니다.');
  expect(Math.abs(fill.width / track.width - 1070 / 1200)).toBeLessThan(0.01);
  expect(Math.abs((mark.x + mark.width / 2 - track.x) / track.width - 1000 / 1200)).toBeLessThan(
    0.01,
  );
  await expect(canvas.locator('[data-part="goal-label"]')).toHaveText('1km');
  // 판에 합계 숫자가 없다(구간 길이 글만).
  expect((await page.getByTestId('measure-board').textContent()) ?? '').not.toMatch(/1070|1,070/);
  // 같은 구간을 다시 누르면 거절된다.
  await tapOnBoard(page, id, ROAD_MID['school-library']);
  await expect(page.getByTestId('measure-message')).toContainText('이미 지나온');
  expect((await readObservation(page))['totalM']).toBe(1070);
});

test('map-route: 키보드로 출발·구간 단추(Enter)를 눌러 경로를 만들고 하나 지우기·처음으로', async ({
  page,
}) => {
  await open(page, 'map-route', TOWN);
  await button(page, '학교에서 출발').focus();
  await page.keyboard.press('Enter');
  await pollObservation(page, (o) => Array.isArray(o['path']) && o['path'].length === 1);
  // 출발하면 길 단추 목록으로 바뀐다.
  await expect(button(page, '학교–공원')).toBeVisible();
  await button(page, '도서관–공원').focus();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('measure-message')).toContainText('이어진 길이 아니에요');
  await button(page, '학교–공원').focus();
  await page.keyboard.press('Enter');
  await pollObservation(page, (o) => o['totalM'] === 980);
  expect(await readObservation(page)).toMatchObject({
    path: ['school', 'park'],
    diffFromTarget: 20,
    bestDiff: 20,
  });
  await button(page, '하나 지우기').focus();
  await page.keyboard.press('Space');
  await pollObservation(page, (o) => o['totalM'] === 0);
  await button(page, '학교–도서관').focus();
  await page.keyboard.press('Enter');
  await button(page, '도서관–공원').focus();
  await page.keyboard.press('Enter');
  await pollObservation(page, (o) => o['totalM'] === 1070);
  await button(page, '처음으로').focus();
  await page.keyboard.press('Enter');
  await pollObservation(
    page,
    (o) => o['totalM'] === 0 && Array.isArray(o['path']) && o['path'].length === 0,
  );
});

test('map-route: from·to가 있으면 처음부터 그 노드에서 시작하고 reachedTo를 판정한다', async ({
  page,
}) => {
  await open(page, 'map-route', { ...TOWN, from: 'school', to: 'park' });
  expect(await readObservation(page)).toMatchObject({ path: ['school'], reachedTo: false });
  await expect(button(page, '학교에서 출발')).toHaveCount(0);
  await button(page, '학교–도서관').click();
  await expect(page.getByTestId('measure-message')).toHaveText('');
  expect((await readObservation(page))['reachedTo']).toBe(false);
  await button(page, '도서관–공원').click();
  await pollObservation(page, (o) => o['reachedTo'] === true);
  const done = await readObservation(page);
  expect(done).toMatchObject({ totalM: 1070, diffFromTarget: 70, bestDiff: 20 });
});

test('map-route: 단추가 모두 48px 이상이다', async ({ page }) => {
  await open(page, 'map-route', { ...TOWN, from: 'school' });
  const buttons = page.getByTestId('measure-controls').getByRole('button');
  const count = await buttons.count();
  // 구간 3개 + 하나 지우기 + 처음으로
  expect(count).toBe(5);
  for (let i = 0; i < count; i += 1) {
    await buttons.nth(i).scrollIntoViewIfNeeded();
    await expectMin(buttons.nth(i), 48, `단추 ${i}`);
  }
});

test('T211 조작 칸 첫 단추 줄이 첫 화면에 보인다(map-route·확대)', async ({ page }) => {
  await open(page, 'map-route', { ...TOWN, from: 'school' });
  await expectControlsAboveFold(page, 'map-route', 0, 'measure-controls', 'page');
  await open(page, 'estimate', { ...ZOOM_CONFIG, estimateFirst: false });
  await expectControlsAboveFold(page, 'estimate zoom', 0, 'measure-controls', 'page');
});

test('힌트 ② mm-count: 확대 구간과 같은 크기의 1cm에 mm 칸 10개를 1~10으로 번호 붙인다', async ({
  page,
}) => {
  await open(page, 'estimate', ZOOM_CONFIG, 'stage=fit&overlay=mm-count');
  await toggleOverlay(page);
  const layer = await expectAligned(page, 'estimate-canvas', 'mm-count');
  await expect(layer.locator('[data-part="mm-cell"]')).toHaveCount(10);
  expect(await layer.locator('[data-part="mm-cell"] text').allTextContents()).toEqual(
    Array.from({ length: 10 }, (_, i) => String(i + 1)),
  );
  await expect(layer.locator('[data-part="label"]')).toHaveText('1cm');
  // 확대하면 확대 구간의 cm 눈금 사이(1cm)가 이 막대 길이와 같다.
  await button(page, '눈금 크게').click();
  await pollObservation(page, (o) => o['zoomed'] === true);
  const cells = layer.locator('[data-part="mm-cell"] rect');
  const first = await cells.first().boundingBox();
  const last = await cells.last().boundingBox();
  const board = canvasOf(page, 'estimate-canvas');
  const cmTicks = board.locator('[data-part="zoom-tick"][data-kind="cm"] line');
  const t0 = await cmTicks.nth(0).boundingBox();
  const t1 = await cmTicks.nth(1).boundingBox();
  const strip = await board.locator('[data-part="zoom-strip"]').boundingBox();
  if (!first || !last || !t0 || !t1 || !strip) throw new Error('상자를 찾지 못했습니다.');
  expect(Math.abs(last.x + last.width - first.x - (t1.x - t0.x))).toBeLessThanOrEqual(3);
  // 확대 그림을 가리지 않는다: 막대 오른쪽 끝이 확대 칸 왼쪽 끝보다 왼쪽이다.
  expect(last.x + last.width).toBeLessThan(strip.x);
});

test('화면 기준: estimate 확대(1cm가 mm 눈금 10칸으로)', async ({ page }) => {
  await open(page, 'estimate', ZOOM_CONFIG);
  await button(page, '눈금 크게').click();
  await pollObservation(page, (o) => o['zoomed'] === true);
  await page.getByRole('heading', { name: '측정 실험실' }).focus();
  await expectPageSnapshot(page, 'measure-zoom.png');
});

test('화면 기준: map-route 경로를 만든 화면(학교→도서관)', async ({ page }) => {
  await open(page, 'map-route', { ...TOWN, from: 'school' });
  await button(page, '학교–도서관').click();
  await pollObservation(page, (o) => o['totalM'] === 450);
  await page.getByRole('heading', { name: '측정 실험실' }).focus();
  await expectPageSnapshot(page, 'measure-route.png');
});

// ══ T213: capacity(컵으로 세기·눈금 없는 비커 퍼즐) · weight(윗접시저울·용수철저울) ═══════════════

const CUPS = {
  variant: 'cup-count',
  containers: [
    { id: 'bottle', kind: 'bottle', shape: 'tall', capacityMl: 600 },
    { id: 'bowl', kind: 'bowl', shape: 'wide', capacityMl: 500 },
  ],
  cupMl: 100,
};
const PUZZLE = {
  variant: 'puzzle',
  containers: [
    { id: 'beaker-a', capacityMl: 300, marks: false },
    { id: 'beaker-b', capacityMl: 500, marks: false },
  ],
  source: 'infinite',
  targetMl: 100,
};
const OBJECTS = [
  { id: 'beachball', kind: 'beachball', g: 200, visualSize: 'large' },
  { id: 'iron-ball', kind: 'iron-ball', g: 700, visualSize: 'small' },
  { id: 'book', kind: 'book', g: 450 },
];
const PAN_ONLY = { tools: ['pan-balance'], objects: OBJECTS, unitObjects: { clip: 50 } };
const SPRING_ONLY = {
  tools: ['spring-scale'],
  objects: [
    { id: 'beachball', kind: 'beachball', g: 200, visualSize: 'large' },
    { id: 'iron-ball', kind: 'iron-ball', g: 480, visualSize: 'small' },
    { id: 'book', kind: 'book', g: 450 },
  ],
  springMaxG: 500,
};

/** 윗접시저울만 있는 판에서 두 접시 가운데의 논리 좌표(1000 기준, 접시 윗면 근처). */
const PAN_LEFT_AT = { x: 200, y: 280 };
const PAN_RIGHT_AT = { x: 800, y: 280 };

/** 판 안 요소의 가운데(화면 좌표). */
async function partCenter(page: Page, id: string, selector: string) {
  return centerOf(canvasOf(page, id).locator(selector).first());
}

test('capacity cup-count: [컵으로 붓기]로 컵 횟수를 세고 물 높이가 차오르며, 들이 숫자는 없다', async ({
  page,
}) => {
  const id = await open(page, 'capacity', CUPS);
  const canvas = canvasOf(page, id);
  const board = page.getByTestId('measure-board');
  await expect(canvas.locator('[data-part="cup-count"]').first()).toHaveText('컵 0번');
  await button(page, '병 컵으로 붓기').click();
  await button(page, '병 컵으로 붓기').click();
  await button(page, '병 컵으로 붓기').click();
  await pollObservation(page, (o) => (o['cups'] as Json | undefined)?.['bottle'] === 3);
  await expect(canvas.locator('[data-part="cup-count"]').first()).toHaveText('컵 3번');
  // 6컵짜리 병에 3컵이면 물 높이가 병 높이의 절반이다(숫자 없이 그림으로만 본다).
  await page.waitForTimeout(500);
  const water = await canvas
    .locator('[data-id="bottle"] [data-part="water"]')
    .evaluate((el) => el.getBoundingClientRect().height);
  const art = await canvas
    .locator('[data-id="bottle"] [data-part="art"] > path')
    .first()
    .evaluate((el) => el.getBoundingClientRect().height);
  expect(Math.abs(water / art - 0.5)).toBeLessThan(0.06);
  expect((await board.textContent()) ?? '').not.toMatch(/600|500|\b100\b|mL/);
  // 그릇을 직접 눌러도 컵 하나가 부어진다(병은 판 위 가운데쯤).
  const at = await toScreen(page, id, 240, 150);
  await page.mouse.click(at.x, at.y);
  await pollObservation(page, (o) => (o['cups'] as Json | undefined)?.['bottle'] === 4);
  // 가득 찰 때까지(6번) 붓고 나면 더 붓기를 거절한다.
  await button(page, '병 컵으로 붓기').click();
  await button(page, '병 컵으로 붓기').click();
  await pollObservation(page, (o) => (o['full'] as Json | undefined)?.['bottle'] === true);
  await button(page, '병 컵으로 붓기').click();
  await expect(page.getByTestId('measure-message')).toContainText('가득');
  expect((await readObservation(page))['cups']).toMatchObject({ bottle: 6, bowl: 0 });
  await button(page, '병 비우기').click();
  await pollObservation(page, (o) => (o['cups'] as Json | undefined)?.['bottle'] === 0);
});

test('capacity puzzle: 단추로 100mL 만들기(300 채움 → 500에 부음 → 300 채움 → 500에 부음)', async ({
  page,
}) => {
  const id = await open(page, 'capacity', PUZZLE);
  expect(await readObservation(page)).toMatchObject({ reached: false, steps: 0 });
  await button(page, '비커 가 채우기').click();
  await button(page, '비커 가의 물을 비커 나에 붓기').click();
  await button(page, '비커 가 채우기').click();
  await button(page, '비커 가의 물을 비커 나에 붓기').click();
  await pollObservation(page, (o) => o['reached'] === true);
  expect(await readObservation(page)).toMatchObject({
    reachedIn: 'beaker-a',
    steps: 4,
    amounts: { 'beaker-a': '100', 'beaker-b': '500' },
  });
  // 물의 양·목표 숫자는 화면 어디에도 없다.
  const board = (await page.getByTestId('measure-board').textContent()) ?? '';
  expect(board).not.toMatch(/\d/);
  expect(await canvasOf(page, id).locator('[data-part="water"]').count()).toBe(2);
  // 받는 비커가 가득 찼으면 거절한다.
  await button(page, '비커 가의 물을 비커 나에 붓기').click();
  await expect(page.getByTestId('measure-message')).toContainText('가득');
  expect((await readObservation(page))['steps']).toBe(4);
});

test('capacity puzzle: 비커를 다른 비커 위로 끌어 놓으면 붓는다', async ({ page }) => {
  const id = await open(page, 'capacity', PUZZLE);
  await button(page, '비커 가 채우기').click();
  await pollObservation(page, (o) => (o['amounts'] as Json | undefined)?.['beaker-a'] === '300');
  const hitA = '[data-part="beaker"][data-id="beaker-a"] [data-part="hit"]';
  const hitB = '[data-part="beaker"][data-id="beaker-b"] [data-part="hit"]';
  await dragBetween(page, await partCenter(page, id, hitA), await partCenter(page, id, hitB));
  await pollObservation(
    page,
    (o) =>
      (o['amounts'] as Json | undefined)?.['beaker-a'] === '0' &&
      (o['amounts'] as Json | undefined)?.['beaker-b'] === '300',
  );
  // 다른 비커가 아닌 빈 자리에 놓으면 아무 일도 없다.
  await button(page, '비커 가 채우기').click();
  const nowA = await partCenter(page, id, hitA);
  await dragBetween(page, nowA, await toScreen(page, id, 500, 60));
  expect((await readObservation(page))['steps']).toBe(3);
});

test('capacity puzzle: 키보드(Tab 초점 + Enter)로 채우기·붓기·비우기', async ({ page }) => {
  await open(page, 'capacity', PUZZLE);
  await button(page, '비커 나 채우기').focus();
  await page.keyboard.press('Enter');
  await button(page, '비커 나의 물을 비커 가에 붓기').focus();
  await page.keyboard.press('Enter');
  await pollObservation(
    page,
    (o) =>
      (o['amounts'] as Json | undefined)?.['beaker-a'] === '300' &&
      (o['amounts'] as Json | undefined)?.['beaker-b'] === '200',
  );
  await button(page, '비커 가 비우기').focus();
  await page.keyboard.press('Space');
  await pollObservation(page, (o) => (o['amounts'] as Json | undefined)?.['beaker-a'] === '0');
});

test('capacity: 단추가 모두 48px 이상이고 이름에 숫자가 없다', async ({ page }) => {
  for (const config of [CUPS, PUZZLE]) {
    await open(page, 'capacity', config);
    const buttons = page.getByTestId('measure-controls').getByRole('button');
    const count = await buttons.count();
    expect(count).toBeGreaterThanOrEqual(5);
    for (let i = 0; i < count; i += 1) {
      await buttons.nth(i).scrollIntoViewIfNeeded();
      await expectMin(buttons.nth(i), 48, `단추 ${i}`);
      expect((await buttons.nth(i).textContent()) ?? '').not.toMatch(/\d/);
    }
  }
});

test('weight: 예측 → 놓기 → 기울기(저울 쓰기 전에 예측해야 하고, 끌어서 접시에 놓는다)', async ({
  page,
}) => {
  const id = await open(page, 'weight', { ...PAN_ONLY, predict: true });
  // 예측 전에는 놓을 곳 단추가 없다.
  await expect(button(page, '왼쪽 접시에 놓기')).toHaveCount(0);
  await button(page, '쇠구슬').click();
  await button(page, '예측하기').click();
  await pollObservation(
    page,
    (o) => o['predictionLocked'] === true && o['prediction'] === 'iron-ball',
  );
  await expect(page.getByTestId('weight-prediction')).toHaveText('내 예측: 쇠구슬');
  // 끌어서 놓기: 비치볼 → 왼쪽 접시, 쇠구슬 → 오른쪽 접시.
  const ballHit = '[data-part="item"][data-id="beachball"] [data-part="hit"]';
  const ironHit = '[data-part="item"][data-id="iron-ball"] [data-part="hit"]';
  const ball = await partCenter(page, id, ballHit);
  await dragBetween(page, ball, await toScreen(page, id, PAN_LEFT_AT.x, PAN_LEFT_AT.y));
  await pollObservation(page, (o) => o['left'] === 'beachball');
  const iron = await partCenter(page, id, ironHit);
  await dragBetween(page, iron, await toScreen(page, id, PAN_RIGHT_AT.x, PAN_RIGHT_AT.y));
  await pollObservation(page, (o) => o['right'] === 'iron-ball' && o['tilt'] === 'right');
  await expect(page.getByTestId('weight-result')).toHaveText('오른쪽이 더 무거워요');
  await expect(canvasOf(page, id)).toHaveAttribute('data-tilt', 'right');
  // 오른쪽 접시가 내려갔다(접시 그룹의 y가 왼쪽보다 크다).
  await page.waitForTimeout(600);
  const [leftPan, rightPan] = await Promise.all([
    canvasOf(page, id).locator('[data-pan="left"]').boundingBox(),
    canvasOf(page, id).locator('[data-pan="right"]').boundingBox(),
  ]);
  if (!leftPan || !rightPan) throw new Error('접시를 찾지 못했습니다.');
  expect(rightPan.y).toBeGreaterThan(leftPan.y + 5);
  // 무게(g) 숫자가 물건 글·aria에 없다.
  const board = (await page.getByTestId('measure-board').textContent()) ?? '';
  expect(board).not.toMatch(/200|700|450/);
  expect(await readObservation(page)).toMatchObject({ pairsCompared: ['beachball|iron-ball'] });
});

test('weight: 클립을 쌓아 무게를 센다(450g 책 = 클립 9개에서 수평)', async ({ page }) => {
  const id = await open(page, 'weight', PAN_ONLY);
  await button(page, '책').click();
  await button(page, '왼쪽 접시에 놓기').click();
  for (let i = 0; i < 9; i += 1) await button(page, '클립 하나 더').click();
  await pollObservation(page, (o) => o['clips'] === 9 && o['balanced'] === true);
  await expect(canvasOf(page, id).locator('[data-part="clip-count"]')).toHaveText('클립 9개');
  await expect(canvasOf(page, id).locator('[data-part="clip"]')).toHaveCount(9);
  await expect(page.getByTestId('weight-result')).toHaveText('무게가 같아요');
  await button(page, '클립 하나 더').click();
  await pollObservation(page, (o) => o['clips'] === 10 && o['tilt'] === 'right');
  await button(page, '클립 하나 빼기').click();
  await pollObservation(page, (o) => o['clips'] === 9);
});

test('weight 용수철저울: 걸면 바늘이 g에 맞는 눈금을 가리킨다(숫자 글은 없다)', async ({
  page,
}) => {
  const id = await open(page, 'weight', SPRING_ONLY);
  const canvas = canvasOf(page, id);
  await button(page, '책').click();
  await button(page, '용수철저울에 걸기').click();
  await pollObservation(page, (o) => o['hung'] === 'book' && o['springG'] === '450');
  await page.waitForTimeout(600);
  // 바늘 높이 = 눈금 450g(0g 눈금에서 45번째) 높이.
  const pointer = await canvas.locator('[data-part="pointer"] line').boundingBox();
  const tick = await canvas.locator('[data-part="tick"] line').nth(45).boundingBox();
  if (!pointer || !tick) throw new Error('상자를 찾지 못했습니다.');
  expect(Math.abs(pointer.y + pointer.height / 2 - (tick.y + tick.height / 2))).toBeLessThanOrEqual(
    1.5,
  );
  // 눈금 숫자는 100g마다만 있고 물건 쪽에는 g 숫자가 없다.
  expect(await canvas.locator('[data-part="spring-ticks"] text').allTextContents()).toEqual([
    ...Array.from({ length: 6 }, (_, i) => String(i * 100)),
    'g',
  ]);
  const itemText = await canvas
    .locator('[data-part="item"]')
    .evaluateAll((els) => els.map((el) => el.textContent ?? '').join(' '));
  expect(itemText).not.toMatch(/\d/);
  // 더 무거운 물건을 걸면 바늘이 더 내려간다.
  await button(page, '쇠구슬').click();
  await button(page, '용수철저울에 걸기').click();
  await pollObservation(page, (o) => o['springG'] === '480');
  await page.waitForTimeout(600);
  const lower = await canvas.locator('[data-part="pointer"] line').boundingBox();
  if (!lower) throw new Error('바늘을 찾지 못했습니다.');
  expect(lower.y).toBeGreaterThan(pointer.y + 5);
});

test('weight 두 저울(샌드박스 기본): 물건을 끌어 용수철저울 고리에 걸고 윗접시저울에도 놓는다', async ({
  page,
}) => {
  const id = await open(page, 'weight');
  expect(await readObservation(page)).toMatchObject({ hung: null, left: null, right: null });
  const ironHit = '[data-part="item"][data-id="iron-ball"] [data-part="hit"]';
  const ballHit = '[data-part="item"][data-id="beachball"] [data-part="hit"]';
  // 용수철저울은 판 오른쪽(논리 x≈770) 위쪽에 있다.
  await dragBetween(page, await partCenter(page, id, ironHit), await toScreen(page, id, 770, 200));
  await pollObservation(page, (o) => o['hung'] === 'iron-ball' && o['springG'] === '700');
  await dragBetween(page, await partCenter(page, id, ballHit), await toScreen(page, id, 110, 260));
  await pollObservation(page, (o) => o['left'] === 'beachball');
  // 선반으로 끌어 내리면 고리가 빈다.
  await page.waitForTimeout(600);
  await dragBetween(page, await partCenter(page, id, ironHit), await toScreen(page, id, 500, 555));
  await pollObservation(page, (o) => o['hung'] === null);
});

test('weight: 키보드로 물건을 고르고(Enter) 놓을 곳 단추(Enter)로 접시·고리에 놓는다', async ({
  page,
}) => {
  await open(page, 'weight');
  const item = page.getByRole('button', { name: /^책\. Enter로/ });
  await item.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: '책', pressed: true, exact: true })).toHaveCount(1);
  await button(page, '왼쪽 접시에 놓기').focus();
  await page.keyboard.press('Enter');
  await pollObservation(page, (o) => o['left'] === 'book');
  await button(page, '용수철저울에 걸기').focus();
  await page.keyboard.press('Enter');
  await pollObservation(page, (o) => o['hung'] === 'book' && o['left'] === null);
  await button(page, '클립 하나 더').focus();
  await page.keyboard.press('Enter');
  await pollObservation(page, (o) => o['clips'] === 1);
  await button(page, '처음으로').focus();
  await page.keyboard.press('Enter');
  await pollObservation(page, (o) => o['hung'] === null && o['clips'] === 0);
});

test('weight: 단추가 모두 48px 이상이다', async ({ page }) => {
  await open(page, 'weight');
  const buttons = page.getByTestId('measure-controls').getByRole('button');
  const count = await buttons.count();
  expect(count).toBeGreaterThanOrEqual(10);
  for (let i = 0; i < count; i += 1) {
    await buttons.nth(i).scrollIntoViewIfNeeded();
    await expectMin(buttons.nth(i), 48, `단추 ${i}`);
  }
});

test('T213 조작 칸 첫 단추 줄이 첫 화면에 보인다(capacity 둘·weight 여럿)', async ({ page }) => {
  const cases: [ModeName, Json, string][] = [
    ['capacity', CUPS, 'capacity cup-count'],
    ['capacity', PUZZLE, 'capacity puzzle'],
    ['weight', {}, 'weight 두 저울'],
    ['weight', PAN_ONLY, 'weight 윗접시저울'],
    ['weight', SPRING_ONLY, 'weight 용수철저울'],
    ['weight', { ...PAN_ONLY, predict: true }, 'weight 예측'],
  ];
  for (const [mode, config, label] of cases) {
    await open(page, mode, config);
    await expectControlsAboveFold(page, label, 0, 'measure-controls', 'page');
  }
});

test('힌트 ② same-beaker: 두 그릇 아래 같은 모양 점선 비커 둘과 화살표, 수위는 없다', async ({
  page,
}) => {
  for (const config of [CUPS, PUZZLE]) {
    await open(page, 'capacity', config, 'stage=fit&overlay=same-beaker');
    await toggleOverlay(page);
    const layer = await expectAligned(page, 'capacity-canvas', 'same-beaker');
    await expect(layer).toContainText('같은 모양 비커에');
    await expect(layer).toContainText('옮겨 담으면?');
    await expect(layer.locator('[data-part="beaker-outline"]')).toHaveCount(2);
    await expect(layer.locator('[data-part="arrow"]')).toHaveCount(2);
    await expect(layer.locator('[data-part="water"]')).toHaveCount(0);
    // 점선 윤곽은 각 그릇 바로 아래(같은 가로 중심)에 놓인다.
    const hits =
      config === CUPS
        ? '[data-part="container"] [data-part="hit"]'
        : '[data-part="beaker"] [data-part="hit"]';
    await expectCentersClose(
      layer.locator('[data-part="beaker-outline"]').first(),
      canvasOf(page, 'capacity-canvas').locator(hits).first(),
      1.5,
      'x',
    );
    // 점선 비커는 본 그릇보다 아래(판 안)에 있다.
    const outline = await layer.locator('[data-part="beaker-outline"]').first().boundingBox();
    const bowl = await canvasOf(page, 'capacity-canvas').locator(hits).first().boundingBox();
    const board = await canvasOf(page, 'capacity-canvas').boundingBox();
    if (!outline || !bowl || !board) throw new Error('상자를 찾지 못했습니다.');
    expect(outline.y).toBeGreaterThan(bowl.y + bowl.height - 2);
    expect(outline.y + outline.height).toBeLessThanOrEqual(board.y + board.height + 1);
  }
});

test('힌트 ② liter-cups: 1L 병 하나와 100mL 컵 10개와 고정 글', async ({ page }) => {
  await open(page, 'capacity', CUPS, 'stage=fit&overlay=liter-cups');
  await toggleOverlay(page);
  const layer = await expectAligned(page, 'capacity-canvas', 'liter-cups');
  await expect(layer.locator('[data-part="cup"]')).toHaveCount(10);
  await expect(layer.locator('[data-part="liter-bottle"]')).toHaveCount(1);
  await expect(layer).toContainText('1L = 100mL 컵 10번 = 1000mL');
  // 그림은 본 판 안에 있다.
  const panel = await layer.locator('[data-part="panel"]').boundingBox();
  const board = await canvasOf(page, 'capacity-canvas').boundingBox();
  if (!panel || !board) throw new Error('상자를 찾지 못했습니다.');
  expect(panel.x).toBeGreaterThanOrEqual(board.x - 1);
  expect(panel.y + panel.height).toBeLessThanOrEqual(board.y + board.height + 1);
});

test('힌트 ② ml-merge: 1000칸 막대(100칸 묶음 10개)가 화살표 하나로 1L 병이 된다', async ({
  page,
}) => {
  await open(page, 'capacity', PUZZLE, 'stage=fit&overlay=ml-merge');
  await toggleOverlay(page);
  const layer = await expectAligned(page, 'capacity-canvas', 'ml-merge');
  await expect(layer.locator('[data-part="ml-group"]')).toHaveCount(10);
  await expect(layer.locator('[data-part="arrow"]')).toHaveCount(1);
  await expect(layer.locator('[data-part="liter-bottle"]')).toHaveCount(1);
  await expect(layer).toContainText('1L = 1000mL');
  // 막대는 병보다 왼쪽에 있고 화살표가 둘 사이에 있다.
  const bar = await layer.locator('[data-part="ml-bar"]').boundingBox();
  const arrow = await layer.locator('[data-part="arrow"]').boundingBox();
  const bottle = await layer.locator('[data-part="liter-bottle"]').boundingBox();
  if (!bar || !arrow || !bottle) throw new Error('상자를 찾지 못했습니다.');
  expect(arrow.x).toBeGreaterThanOrEqual(bar.x + bar.width - 1);
  expect(arrow.x + arrow.width).toBeLessThanOrEqual(bottle.x + 1);
});

test('힌트 ② size-weight-bars: 두 접시에 물건이 하나씩 있을 때 크기 막대와 무게 방향 막대(숫자 없음)', async ({
  page,
}) => {
  const id = await open(page, 'weight', PAN_ONLY, 'stage=fit&overlay=size-weight-bars');
  await toggleOverlay(page);
  // 접시가 비어 있으면 그리지 않는다.
  await expect(page.locator('[data-overlay="size-weight-bars"] svg')).toHaveCount(0);
  await button(page, '비치볼').click();
  await button(page, '왼쪽 접시에 놓기').click();
  await button(page, '쇠구슬').click();
  await button(page, '오른쪽 접시에 놓기').click();
  await pollObservation(page, (o) => o['left'] === 'beachball' && o['right'] === 'iron-ball');
  const layer = await expectAligned(page, id, 'size-weight-bars');
  await expect(layer.locator('[data-bar^="size-"]')).toHaveCount(2);
  await expect(layer.locator('[data-bar^="weight-"]')).toHaveCount(2);
  expect((await layer.textContent()) ?? '').not.toMatch(/\d/);
  const width = async (name: string) =>
    (await layer.locator(`[data-bar="${name}"]`).boundingBox())?.width ?? 0;
  // 비치볼이 더 크고(크기 막대), 쇠구슬이 더 무겁다(무게 막대).
  expect(await width('size-left')).toBeGreaterThan(await width('size-right'));
  expect(await width('weight-right')).toBeGreaterThan(await width('weight-left'));
  // 막대 상자는 두 접시 사이 빈 자리에 있다(왼쪽·오른쪽 접시와 겹치지 않는다).
  const panel = await layer.locator('[data-part="panel"]').boundingBox();
  const left = await canvasOf(page, id).locator('[data-pan="left"]').boundingBox();
  const right = await canvasOf(page, id).locator('[data-pan="right"]').boundingBox();
  if (!panel || !left || !right) throw new Error('상자를 찾지 못했습니다.');
  expect(panel.x).toBeGreaterThanOrEqual(left.x + left.width - 1);
  expect(panel.x + panel.width).toBeLessThanOrEqual(right.x + 1);
});

test('화면 기준: capacity cup-count(병에 컵 둘)', async ({ page }) => {
  await open(page, 'capacity');
  await button(page, '병 컵으로 붓기').click();
  await button(page, '병 컵으로 붓기').click();
  await pollObservation(page, (o) => (o['cups'] as Json | undefined)?.['bottle'] === 2);
  await page.getByRole('heading', { name: '측정 실험실' }).focus();
  await expectPageSnapshot(page, 'measure-capacity.png');
});

test('화면 기준: capacity puzzle(비커 가에 물을 채워 비커 나에 부은 뒤)', async ({ page }) => {
  await open(page, 'capacity', PUZZLE);
  await button(page, '비커 가 채우기').click();
  await button(page, '비커 가의 물을 비커 나에 붓기').click();
  await button(page, '비커 가 채우기').click();
  await pollObservation(page, (o) => (o['amounts'] as Json | undefined)?.['beaker-a'] === '300');
  await page.getByRole('heading', { name: '측정 실험실' }).focus();
  await expectPageSnapshot(page, 'measure-puzzle.png');
});

test('화면 기준: weight 두 저울(비치볼·쇠구슬을 접시에, 책을 용수철저울에)', async ({ page }) => {
  await open(page, 'weight', {
    tools: ['pan-balance', 'spring-scale'],
    objects: [
      { id: 'beachball', kind: 'beachball', g: 200, visualSize: 'large' },
      { id: 'iron-ball', kind: 'iron-ball', g: 480, visualSize: 'small' },
      { id: 'book', kind: 'book', g: 450 },
    ],
    springMaxG: 500,
    unitObjects: { clip: 50 },
  });
  for (const [name, where] of [
    ['비치볼', '왼쪽 접시에 놓기'],
    ['쇠구슬', '오른쪽 접시에 놓기'],
    ['책', '용수철저울에 걸기'],
  ] as const) {
    await button(page, name).click();
    await button(page, where).click();
  }
  await pollObservation(page, (o) => o['hung'] === 'book' && o['tilt'] === 'right');
  await page.getByRole('heading', { name: '측정 실험실' }).focus();
  await expectPageSnapshot(page, 'measure-weight.png');
});

// ══ T215: length roll-circle(굴렁쇠 굴리기·지름 막대·기록표) ═══════════════════════════

const ROLL = {
  variant: 'roll-circle',
  diameters: ['2', '3', '5', '8', '10'],
  unit: 'cm',
  precision: '0.01',
};
const ROLL_ID = 'roll-canvas';
/** 바닥 자 1cm = 논리 20px(layout.ts의 PX_CM). */
const ROLL_PX_CM = 20;

/** 판 안 요소의 가운데 x를 논리 좌표(1000 기준)로. 배율은 상자 너비로만 구한다. */
async function logicalCenterX(page: Page, id: string, locator: Locator): Promise<number> {
  const board = await canvasOf(page, id).boundingBox();
  const box = await locator.boundingBox();
  if (!board || !box) throw new Error('상자를 찾지 못했습니다.');
  return ((box.x + box.width / 2 - board.x) * 1000) / board.width;
}

/** 글·aria·data- 속성값을 모두 모은 글(좌표 속성은 제외). */
async function exposedText(page: Page, id: string): Promise<string> {
  return canvasOf(page, id).evaluate((root) => {
    const parts: string[] = [root.textContent ?? ''];
    for (const element of root.querySelectorAll('*')) {
      for (const attribute of element.attributes) {
        if (attribute.name.startsWith('data-') || attribute.name.startsWith('aria-')) {
          parts.push(attribute.value);
        }
      }
    }
    return parts.join('\n');
  });
}

const ROLL_SECRET = /6\.3|9\.4|15\.7|25\.1|31\.4|3\.14|3\.15|3\.13/;

test('roll-circle: 지름을 고르고 [굴리기] → 물감 자국 둘 사이가 측정 원주, 굴리기 전 DOM에는 원주·비가 없다', async ({
  page,
}) => {
  const id = await open(page, 'length', ROLL);
  expect(await exposedText(page, id)).not.toMatch(ROLL_SECRET);
  await expect(canvasOf(page, id).locator('[data-part="mark"]')).toHaveCount(0);
  await button(page, '지름 5cm').click();
  await pollObservation(page, (o) => o['diameter'] === '5' && o['measuredCm'] === null);
  await button(page, '굴리기').click();
  await pollObservation(page, (o) => o['rolled'] === true && o['measuredCm'] === '15.7');
  // 굴리고 기록하기 전에도 원주 숫자는 글·aria·data-에 없다.
  expect(await exposedText(page, id)).not.toMatch(ROLL_SECRET);
  const marks = canvasOf(page, id).locator('[data-part="mark"]');
  await expect(marks).toHaveCount(2);
  const a = await logicalCenterX(page, id, marks.nth(0));
  const b = await logicalCenterX(page, id, marks.nth(1));
  // 자국 사이는 15.7cm(= 논리 314px)다. 굴렁쇠는 한 바퀴 돌아 둘째 자국 위에 선다.
  expect(Math.abs(b - a - 15.7 * ROLL_PX_CM)).toBeLessThanOrEqual(1.5);
  const ring = canvasOf(page, id).locator('[data-part="ring"] [data-part="hit"]');
  await expect
    .poll(async () => Math.abs((await logicalCenterX(page, id, ring)) - b))
    .toBeLessThanOrEqual(1.5);
  // 굴린 뒤 다시 굴리기는 거절하고 안내한다.
  await button(page, '굴리기').click();
  await expect(page.getByTestId('measure-message')).toContainText('이미 굴렸어요');
});

test('roll-circle: 지름 막대를 네 개까지 잇고(네 번째는 넘는 부분이 빗금) 기록하면 표에 한 줄이 쌓인다', async ({
  page,
}) => {
  const id = await open(page, 'length', ROLL);
  await button(page, '지름 막대 잇기').click();
  await expect(page.getByTestId('measure-message')).toContainText('먼저');
  await button(page, '지름 3cm').click();
  await button(page, '굴리기').click();
  await pollObservation(page, (o) => o['rolled'] === true);
  const sticks = canvasOf(page, id).locator('[data-part="stick"]');
  for (let i = 1; i <= 4; i += 1) {
    await button(page, '지름 막대 잇기').click();
    await pollObservation(page, (o) => o['sticks'] === i);
    await expect(sticks).toHaveCount(i);
  }
  await expect(canvasOf(page, id).locator('[data-part="overflow"]')).toHaveCount(1);
  await pollObservation(page, (o) => o['sticksFit'] === 3);
  // 막대 하나 길이는 지름(3cm = 논리 60px). 셋째 막대의 오른쪽 끝(9cm)은 자국 끝(9.4cm)보다 왼쪽,
  // 넷째 막대(12cm)는 자국을 넘는다.
  const marks = canvasOf(page, id).locator('[data-part="mark"]');
  const end = await logicalCenterX(page, id, marks.nth(1));
  const board = await canvasOf(page, id).boundingBox();
  const first = await sticks.nth(0).boundingBox();
  const third = await sticks.nth(2).boundingBox();
  const fourth = await sticks.nth(3).boundingBox();
  if (!board || !first || !third || !fourth) throw new Error('상자를 찾지 못했습니다.');
  const logical = (px: number) => (px * 1000) / board.width;
  // 막대 테두리(2.5px)가 상자에 더해진다.
  expect(Math.abs(logical(first.width) - 3 * ROLL_PX_CM)).toBeLessThanOrEqual(3.5);
  expect(logical(third.x + third.width - board.x)).toBeLessThan(end);
  expect(logical(fourth.x + fourth.width - board.x)).toBeGreaterThan(end + 1);
  await button(page, '지름 막대 잇기').click();
  await expect(page.getByTestId('measure-message')).toContainText('네 개까지');
  await button(page, '막대 하나 빼기').click();
  await pollObservation(page, (o) => o['sticks'] === 3);
  // 기록하면 표에 한 줄(지름 3, 원주 9.4, 비 3.13)이 쌓이고, 같은 지름은 한 번만 기록된다.
  await button(page, '기록하기').click();
  await pollObservation(page, (o) => o['logCount'] === 1);
  const cells = canvasOf(page, id).locator('[data-part="cell"]');
  await expect(cells).toHaveText(['3', '9.4', '3.13']);
  await button(page, '기록하기').click();
  await expect(page.getByTestId('measure-message')).toContainText('이미 기록했어요');
  await pollObservation(page, (o) => o['logCount'] === 1);
  // 지름을 다시 고르면 굴리기·막대는 처음으로, 기록표는 남는다.
  await button(page, '지름 5cm').click();
  await pollObservation(
    page,
    (o) => o['rolled'] === false && o['sticks'] === 0 && o['logCount'] === 1,
  );
  await expect(cells).toHaveCount(3);
  await expect(canvasOf(page, id).locator('[data-part="mark"]')).toHaveCount(0);
});

test('roll-circle: 굴렁쇠를 지름의 절반 넘게 오른쪽으로 끌면 굴러가고, 조금만 끌면 안 굴러간다', async ({
  page,
}) => {
  const id = await open(page, 'length', ROLL);
  await button(page, '지름 10cm').click();
  await pollObservation(page, (o) => o['diameter'] === '10');
  const ring = canvasOf(page, id).locator('[data-part="ring"] [data-part="hit"]');
  const board = await canvasOf(page, id).boundingBox();
  if (!board) throw new Error('캔버스를 찾지 못했습니다.');
  const scale = board.width / 1000;
  const from = await centerOf(ring);
  // 지름 10cm의 반지름은 논리 100px. 60px만 끌면 안 굴러간다.
  await dragBetween(page, from, { x: from.x + 60 * scale, y: from.y });
  await pollObservation(page, (o) => o['rolled'] === false);
  await dragBetween(page, from, { x: from.x + 130 * scale, y: from.y });
  await pollObservation(page, (o) => o['rolled'] === true && o['measuredCm'] === '31.4');
  await expect(canvasOf(page, id).locator('[data-part="mark"]')).toHaveCount(2);
});

test('roll-circle: 움직임 줄이기를 켜면 굴린 바로 뒤에 물감 자국이 보인다', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const id = await open(page, 'length', ROLL);
  await button(page, '굴리기').click();
  await pollObservation(page, (o) => o['rolled'] === true);
  const marks = canvasOf(page, id).locator('[data-part="marks"]');
  await expect.poll(() => marks.evaluate((node) => getComputedStyle(node).opacity)).toBe('1');
});

test('roll-circle: 키보드(Tab 초점 + Enter·Space)로 지름 고르기·굴리기·막대·기록·처음으로', async ({
  page,
}) => {
  const id = await open(page, 'length', ROLL);
  await button(page, '지름 8cm').focus();
  await page.keyboard.press('Enter');
  await pollObservation(page, (o) => o['diameter'] === '8');
  await button(page, '굴리기').focus();
  await page.keyboard.press('Space');
  await pollObservation(page, (o) => o['rolled'] === true && o['measuredCm'] === '25.1');
  await button(page, '지름 막대 잇기').focus();
  await page.keyboard.press('Enter');
  await page.keyboard.press('Space');
  await pollObservation(page, (o) => o['sticks'] === 2);
  await button(page, '막대 하나 빼기').focus();
  await page.keyboard.press('Enter');
  await pollObservation(page, (o) => o['sticks'] === 1);
  await button(page, '기록하기').focus();
  await page.keyboard.press('Enter');
  await pollObservation(page, (o) => o['logCount'] === 1);
  await expect(canvasOf(page, id).locator('[data-part="cell"]')).toHaveText(['8', '25.1', '3.14']);
  await button(page, '처음으로').focus();
  await page.keyboard.press('Enter');
  await pollObservation(
    page,
    (o) => o['rolled'] === false && o['sticks'] === 0 && o['logCount'] === 1,
  );
  // 굴렁쇠 자체도 초점을 받아 Enter로 굴린다.
  await canvasOf(page, id).locator('[data-part="ring"]').focus();
  await page.keyboard.press('Enter');
  await pollObservation(page, (o) => o['rolled'] === true);
});

test('roll-circle: precision 0.001이면 기록표 비가 세 자리다', async ({ page }) => {
  const id = await open(page, 'length', { ...ROLL, precision: '0.001' });
  await button(page, '지름 8cm').click();
  await button(page, '굴리기').click();
  await button(page, '기록하기').click();
  await pollObservation(page, (o) => o['logCount'] === 1);
  await expect(canvasOf(page, id).locator('[data-part="cell"]')).toHaveText(['8', '25.1', '3.138']);
});

test('roll-circle: 단추가 모두 48px 이상이다', async ({ page }) => {
  await open(page, 'length', ROLL);
  const buttons = page.getByTestId('measure-controls').getByRole('button');
  const count = await buttons.count();
  // 지름 다섯 + 굴리기·지름 막대 잇기·막대 하나 빼기·기록하기·처음으로
  expect(count).toBe(10);
  for (let i = 0; i < count; i += 1) {
    await buttons.nth(i).scrollIntoViewIfNeeded();
    await expectMin(buttons.nth(i), 48, `단추 ${i}`);
  }
});

test('roll-circle 판이 판 안에 다 보이고, 조작 칸 첫 단추 줄이 첫 화면에 보인다', async ({
  page,
}, testInfo) => {
  for (const config of [
    ROLL,
    { ...ROLL, diameters: ['1', '2', '3', '5', '8', '10'] },
    { ...ROLL, diameters: ['2', '3'], log: false },
  ]) {
    await open(page, 'length', config);
    const box = await expectSandboxCanvasVisible(page, {
      buttons: testInfo.project.name !== 'ipad',
      outerScrollY: true,
    });
    console.log('T215 판', testInfo.project.name, Math.round(box.width), Math.round(box.height));
    // 도구·기록표가 없는 낮은 판(셋째)은 원래 납작해서 크롬북 최소 크기 검사를 하지 않는다.
    if (testInfo.project.name === 'chromebook' && (config as Json)['log'] !== false) {
      expectChromeBookCanvasSize([box]);
    }
    await expectControlsAboveFold(page, 'roll-circle', 0, 'measure-controls', 'page');
  }
});

// ── roll-circle 오버레이 ─────────────────────────────────

/** 지름 5·8을 굴려 기록한다. */
async function logTwo(page: Page): Promise<void> {
  for (const d of ['5', '8']) {
    await button(page, `지름 ${d}cm`).click();
    await button(page, '굴리기').click();
    await button(page, '기록하기').click();
  }
  await pollObservation(page, (o) => o['logCount'] === 2);
}

test('힌트 ② diameter-column: 기록이 없어도 지름 칸 전체(머리칸+모든 줄)를 점선으로 두르고 "지름" 꼬리표', async ({
  page,
}) => {
  await open(page, 'length', ROLL, 'stage=fit&overlay=diameter-column');
  await toggleOverlay(page);
  const layer = await expectAligned(page, ROLL_ID, 'diameter-column');
  await expect(layer.locator('[data-part="label"]')).toHaveText('지름');
  const column = layer.locator('[data-part="column"]');
  // 두른 상자는 표의 첫 칸(지름 칸 150px)의 머리칸에서 맨 아래 줄까지를 사방 4px 여유로 두른다.
  const box = await column.boundingBox();
  const board = await canvasOf(page, ROLL_ID).boundingBox();
  const table = await canvasOf(page, ROLL_ID)
    .locator('[data-part="log-table"] > rect')
    .first()
    .boundingBox();
  if (!box || !table || !board) throw new Error('상자를 찾지 못했습니다.');
  const s = board.width / 1000;
  // 선 굵기가 상자에 더해질 수 있어 중심과 크기 범위로 본다. 지름 칸은 표 왼쪽 끝에서 150px 폭이다.
  expect(Math.abs(box.x + box.width / 2 - (table.x + 76 * s))).toBeLessThanOrEqual(1.5);
  expect(box.width).toBeGreaterThanOrEqual(150 * s);
  expect(box.width).toBeLessThanOrEqual(170 * s);
  expect(Math.abs(box.y + box.height / 2 - (table.y + table.height / 2))).toBeLessThanOrEqual(1.5);
  expect(box.height).toBeGreaterThanOrEqual(table.height);
  expect(box.height).toBeLessThanOrEqual(table.height + 14 * s);
  // 두른 칸의 머리칸은 "지름(cm)"이다.
  await expect(canvasOf(page, ROLL_ID).locator('[data-part="head"]').first()).toHaveText(
    '지름(cm)',
  );
  // 기록을 쌓아도 같은 자리다.
  await logTwo(page);
  const after = await column.boundingBox();
  if (!after) throw new Error('상자를 찾지 못했습니다.');
  expect(Math.abs(after.x - box.x)).toBeLessThanOrEqual(1);
  expect(Math.abs(after.height - box.height)).toBeLessThanOrEqual(1);
});

test('힌트 ② pi-precision: 기록이 2줄이 되면 표 오른쪽에 "더 자세히(0.001)" 칸이 줄마다 정렬해 나타난다', async ({
  page,
}) => {
  await open(page, 'length', ROLL, 'stage=fit&overlay=pi-precision');
  await toggleOverlay(page);
  await expect(page.locator('[data-overlay="pi-precision"] svg')).toHaveCount(0);
  await button(page, '지름 5cm').click();
  await button(page, '굴리기').click();
  await button(page, '기록하기').click();
  await pollObservation(page, (o) => o['logCount'] === 1);
  await expect(page.locator('[data-overlay="pi-precision"] svg')).toHaveCount(0);
  await button(page, '지름 8cm').click();
  await button(page, '굴리기').click();
  await button(page, '기록하기').click();
  await pollObservation(page, (o) => o['logCount'] === 2);
  const layer = await expectAligned(page, ROLL_ID, 'pi-precision');
  await expect(layer.locator('[data-part="head"]')).toContainText('0.001');
  await expect(layer.locator('[data-part="cell"]')).toHaveText(['3.140', '3.138']);
  // 줄 구분선이 본 표의 같은 줄 구분선과 같은 높이이고, 덧그린 칸은 표 오른쪽에서 표와 같은 높이다.
  const ownLines = canvasOf(page, ROLL_ID).locator('[data-part="row-line"]');
  const lines = layer.locator('[data-part="row-line"]');
  const count = await lines.count();
  expect(count).toBe(await ownLines.count());
  for (let i = 0; i < count; i += 1) {
    const a = await lines.nth(i).boundingBox();
    const b = await ownLines.nth(i).boundingBox();
    if (!a || !b) throw new Error('상자를 찾지 못했습니다.');
    expect(Math.abs(a.y - b.y)).toBeLessThanOrEqual(1.5);
  }
  const panel = await layer.locator('[data-part="panel"]').boundingBox();
  const table = await canvasOf(page, ROLL_ID)
    .locator('[data-part="log-table"] > rect')
    .first()
    .boundingBox();
  if (!panel || !table) throw new Error('상자를 찾지 못했습니다.');
  expect(panel.x).toBeGreaterThan(table.x + table.width);
  expect(Math.abs(panel.y - table.y)).toBeLessThanOrEqual(1.5);
  expect(Math.abs(panel.height - table.height)).toBeLessThanOrEqual(1.5);
});

// ── roll-circle 기준 이미지 ──────────────────────────────

test('화면 기준: roll-circle(굴린 뒤 + 기록 2줄 + 지름 막대 4개)', async ({ page }) => {
  await open(page, 'length', ROLL);
  await button(page, '지름 2cm').click();
  await button(page, '굴리기').click();
  await button(page, '기록하기').click();
  await button(page, '지름 3cm').click();
  await button(page, '굴리기').click();
  for (let i = 0; i < 4; i += 1) await button(page, '지름 막대 잇기').click();
  await button(page, '기록하기').click();
  await pollObservation(page, (o) => o['logCount'] === 2 && o['sticks'] === 4);
  await page.waitForTimeout(1200);
  await page.getByRole('heading', { name: '측정 실험실' }).focus();
  await expectPageSnapshot(page, 'measure-roll.png');
});
