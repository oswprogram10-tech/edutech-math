import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { canvasScale, logicalToScreen } from './canvas-point';
import { expectControlsAboveFold } from './controls-fold';

/**
 * E03 수직선 샌드박스 E2E.
 * 아이패드(WebKit)·크롬북(Chromium)·전자칠판 뷰포트에서 모두 돈다.
 * 핀치 제스처는 Playwright가 WebKit에서 만들 수 없어 단위 테스트로 확인하고,
 * 여기서는 +/− 버튼과 Ctrl+휠을 확인한다(T011 구현 결정 11).
 */

interface ObservationRecord {
  readonly mode?: string;
  readonly tick?: string;
  readonly zoomLevel?: number;
  readonly viewMin?: string;
  readonly viewMax?: string;
  readonly points?: ReadonlyArray<{ readonly value?: string }>;
  readonly pointValues?: readonly string[];
  readonly cards?: Readonly<Record<string, string | null>>;
  readonly landing?: string | null;
  readonly hopCount?: number | null;
  readonly frogAt?: string | null;
  readonly frogStart?: string | null;
  readonly frogJumps?: readonly string[] | null;
  readonly frogJumpTotal?: string | null;
  readonly level?: number | null;
  readonly pairs?: ReadonlyArray<{ readonly top?: string; readonly bottom?: string }>;
  readonly doubleOps?: readonly string[];
  readonly rounding?: ReadonlyArray<{
    readonly value?: string;
    readonly marker?: string | null;
    readonly method?: string | null;
  }>;
  readonly [key: string]: unknown;
}

async function openNumberLine(page: Page, config?: Record<string, unknown>) {
  const query = config ? `/?config=${encodeURIComponent(JSON.stringify(config))}` : '';
  await page.goto(`${query}#/sandbox/E03`);
  await expect(page.getByRole('heading', { name: '수직선' })).toBeVisible();
  const canvas = page.getByTestId('number-line-canvas');
  await expect(canvas).toBeVisible();
  const box = await canvas.boundingBox();
  if (!box) throw new Error('수직선 캔버스 크기를 알 수 없습니다.');
  return {
    canvas,
    observation: page.getByTestId('observation'),
    at: (x: number, y: number) => logicalToScreen(box, x, y),
    box,
  };
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

async function selectMode(page: Page, mode: string) {
  await page.getByLabel('모드').selectOption(mode);
  await pollObservation(page, (observation) => observation.mode === mode);
}

async function tapAt(
  page: Page,
  at: (x: number, y: number) => { x: number; y: number },
  x: number,
  y: number,
): Promise<void> {
  const point = at(x, y);
  await page.mouse.click(point.x, point.y);
}

test('분수 수직선 3/4 자리를 누르면 3/4 점이 찍힌다', async ({ page }) => {
  const { at } = await openNumberLine(page);
  await selectMode(page, 'fraction');

  await tapAt(page, at, 700, 300);
  await pollObservation(page, (observation) => observation.points?.[0]?.value === '3/4');

  const observation = await readObservation(page);
  expect(observation.points?.[0]?.value).toBe('3/4');
  expect(observation.pointValues).toEqual(['3/4']);
});

test('12등분 분수 수직선에서 1과 11/12 자리를 누르면 그 값이 찍힌다', async ({ page }) => {
  const { at } = await openNumberLine(page, { subdivisions: 12 });
  await selectMode(page, 'fraction');
  await pollObservation(
    page,
    (observation) =>
      observation.tick === '1/12' && observation.viewMin === '0' && observation.viewMax === '1',
  );

  const ticks = page.locator('[data-testid="number-line-canvas"] [data-tick-value]');
  await expect(ticks).toHaveCount(13);

  await tapAt(page, at, 900, 300);
  await pollObservation(
    page,
    (observation) => observation.points?.length === 1 && observation.points[0]?.value === '1',
  );

  await tapAt(page, at, 100 + (11 / 12) * 800, 300);
  await pollObservation(page, (observation) => observation.points?.length === 2);

  const observation = await readObservation(page);
  expect(observation.points?.map((point) => point.value)).toEqual(['11/12', '1']);
});

test('decimal에서 눈금 11개가 보이고, 이동해 0.73과 0.81을 찍는다', async ({ page }) => {
  const { at, box } = await openNumberLine(page);
  await selectMode(page, 'decimal');

  const ticks = page.locator('[data-testid="number-line-canvas"] [data-tick-value]');
  const tickValues = async (): Promise<string[]> =>
    ticks.evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-tick-value') ?? ''));

  // + 한 번: 0.1 단계, 0~1 전체, 눈금 11개(0, 0.1, …, 1).
  const zoomIn = page.getByRole('button', { name: '수직선 확대' });
  await zoomIn.click();
  await pollObservation(
    page,
    (observation) =>
      observation.tick === '1/10' && observation.viewMin === '0' && observation.viewMax === '1',
  );
  await expect(ticks).toHaveCount(11);
  expect(await tickValues()).toEqual([
    '0',
    '1/10',
    '1/5',
    '3/10',
    '2/5',
    '1/2',
    '3/5',
    '7/10',
    '4/5',
    '9/10',
    '1',
  ]);

  // + 두 번: 0.01 단계, 폭 0.1, 눈금 11개. 이웃 눈금 간격이 48px 이상이다.
  await zoomIn.click();
  await pollObservation(
    page,
    (observation) =>
      observation.tick === '1/100' && observation.viewMin === '0' && observation.viewMax === '1/10',
  );
  await expect(ticks).toHaveCount(11);
  const tickXs = await ticks.evaluateAll((nodes) =>
    nodes.map((node) => Number(node.getAttribute('data-tick-x'))),
  );
  const sorted = [...tickXs].sort((a, b) => a - b);
  const spacingPx = ((sorted[1] ?? 0) - (sorted[0] ?? 0)) * canvasScale(box);
  expect(spacingPx).toBeGreaterThanOrEqual(48);

  // 0.70~0.80까지 옮긴 뒤 0.73 자리를 누른다.
  const panRight = page.getByRole('button', { name: '수직선 오른쪽으로' });
  for (let step = 0; step < 7; step += 1) {
    await panRight.click();
  }
  await pollObservation(
    page,
    (observation) => observation.viewMin === '7/10' && observation.viewMax === '4/5',
  );
  await tapAt(page, at, 340, 300);
  await pollObservation(page, (observation) => observation.points?.[0]?.value === '73/100');

  // ◀ ▶로 0.80~0.90까지 옮긴 뒤 0.81 자리를 누른다.
  const panLeft = page.getByRole('button', { name: '수직선 왼쪽으로' });
  await panLeft.click();
  await panRight.click();
  await panRight.click();
  await pollObservation(
    page,
    (observation) => observation.viewMin === '4/5' && observation.viewMax === '9/10',
  );
  await tapAt(page, at, 180, 300);
  await pollObservation(page, (observation) => observation.points?.[1]?.value === '81/100');

  const observation = await readObservation(page);
  expect(observation.viewMin).toBe('4/5');
  expect(observation.viewMax).toBe('9/10');
  expect(observation.points?.map((point) => point.value)).toEqual(['73/100', '81/100']);
});

test('+/− 버튼과 Ctrl+휠로 눈금을 바꾼다', async ({ page }) => {
  const { at, box } = await openNumberLine(page);
  await selectMode(page, 'decimal');

  await pollObservation(page, (observation) => observation.tick === '1');

  const zoomIn = page.getByRole('button', { name: '수직선 확대' });
  const zoomOut = page.getByRole('button', { name: '수직선 축소' });
  await zoomIn.click();
  await pollObservation(page, (observation) => observation.tick === '1/10');
  await zoomIn.click();
  await pollObservation(page, (observation) => observation.tick === '1/100');
  await zoomOut.click();
  await pollObservation(page, (observation) => observation.tick === '1/10');

  const center = at(500, 300);
  // 모바일 WebKit은 Playwright의 mouse.wheel을 지원하지 않아 실제 WheelEvent를 보낸다.
  const syntheticWheel = test.info().project.name === 'ipad';
  const ctrlWheel = async (deltaY: number) => {
    if (syntheticWheel) {
      await page.evaluate((delta) => {
        const canvas = document.querySelector('[data-testid="number-line-canvas"]');
        canvas?.dispatchEvent(
          new WheelEvent('wheel', {
            deltaY: delta,
            ctrlKey: true,
            bubbles: true,
            cancelable: true,
          }),
        );
      }, deltaY);
      return;
    }
    await page.mouse.move(center.x, center.y);
    await page.keyboard.down('Control');
    await page.mouse.wheel(0, deltaY);
    await page.keyboard.up('Control');
  };

  await ctrlWheel(-120);
  await pollObservation(page, (observation) => observation.tick === '1/100');

  await ctrlWheel(120);
  await pollObservation(page, (observation) => observation.tick === '1/10');

  // 캔버스가 화면 밖으로 밀리지 않았는지(휠이 페이지 스크롤을 먹지 않았는지) 확인.
  expect(box.width).toBeGreaterThan(0);
});

test('skip-count에서 5씩 고르고 J로 네 번 뛰면 20에 닿는다', async ({ page }) => {
  await openNumberLine(page, {
    mode: 'skip-count',
    min: 0,
    max: 30,
    stepChoices: [2, 3, 4, 5],
  });
  await selectMode(page, 'skip-count');

  await page.getByRole('button', { name: '5씩' }).click();
  const canvas = page.getByTestId('number-line-canvas');
  await canvas.focus();
  for (let step = 0; step < 4; step += 1) {
    await page.keyboard.press('j');
  }
  await pollObservation(
    page,
    (observation) => observation.hopCount === 4 && observation.landing === '20',
  );

  const observation = await readObservation(page);
  expect(observation.landing).toBe('20');
  expect(observation.hopCount).toBe(4);
});

test('rounding에서 243을 10 자리로 올림하면 marker가 250이다', async ({ page }) => {
  await openNumberLine(page, { mode: 'rounding', value: 243, place: 10 });
  await selectMode(page, 'rounding');

  await page.getByRole('button', { name: '올림', exact: true }).click();
  await pollObservation(page, (observation) => observation.rounding?.[0]?.marker === '250');

  const observation = await readObservation(page);
  expect(observation.rounding?.[0]).toEqual({
    value: '243',
    marker: '250',
    method: 'up',
  });
});

test('log-zoom에서 − 세 번으로 level 3에 간 뒤 카드 2500을 놓는다', async ({ page }) => {
  const { at } = await openNumberLine(page, {
    mode: 'log-zoom',
    levels: [10, 100, 1000, 10000],
    cards: [500, 1000, 2500, 9000],
  });
  await selectMode(page, 'log-zoom');

  const zoomOut = page.getByRole('button', { name: '한 단계 넓게 보기' });
  for (let level = 1; level <= 3; level += 1) {
    await zoomOut.click();
    await pollObservation(page, (observation) => observation.level === level);
  }

  await page.getByTestId('log-card-2500').click();
  await pollObservation(page, (observation) => observation['selectedCard'] === '2500');
  await tapAt(page, at, 300, 380);
  await pollObservation(page, (observation) => observation.cards?.['2500'] === '2500');

  const observation = await readObservation(page);
  expect(observation.level).toBe(3);
  expect(observation.cards?.['2500']).toBe('2500');
});

test('double에서 ÷2 뒤 ×3을 하면 1↔3/2 쌍이 생긴다', async ({ page }) => {
  await openNumberLine(page, {
    mode: 'double',
    top: { label: '양', max: '3/4' },
    bottom: { label: '자 2/3로 잰 횟수' },
    anchors: [['2/3', '1']],
    divisors: [2, 3, 4],
    multipliers: [2, 3],
  });
  await selectMode(page, 'double');

  await page.getByRole('button', { name: '÷ 2' }).click();
  await pollObservation(page, (observation) => observation.pairs?.length === 2);
  await page.getByRole('button', { name: '× 3' }).click();
  await pollObservation(
    page,
    (observation) =>
      observation.pairs?.length === 3 &&
      observation.pairs[2]?.top === '1' &&
      observation.pairs[2]?.bottom === '3/2',
  );

  const observation = await readObservation(page);
  expect(observation.pairs?.[2]).toEqual({ top: '1', bottom: '3/2' });
  expect(observation.doubleOps).toEqual(['divide:2', 'multiply:3']);
});

test('integer 개구리를 키보드로 +10 두 번, +1 세 번 뛰면 위치가 58이다', async ({ page }) => {
  await openNumberLine(page, {
    mode: 'integer',
    min: 0,
    max: 100,
    unit: 1,
    labels: 'partial',
    jumpButtons: [10, 1, -1, -10],
    jumpStart: 35,
  });

  const plusTen = page.getByRole('button', { name: '+10', exact: true });
  const plusOne = page.getByRole('button', { name: '+1', exact: true });
  await expect(plusTen).toBeVisible();
  await expect(plusOne).toBeVisible();

  // 마우스 없이 키보드(Enter·Space)로만 점프한다.
  for (let count = 0; count < 2; count += 1) {
    await plusTen.focus();
    await page.keyboard.press('Enter');
  }
  for (let count = 0; count < 3; count += 1) {
    await plusOne.focus();
    await page.keyboard.press('Space');
  }
  await pollObservation(page, (observation) => observation.frogAt === '58');

  const observation = await readObservation(page);
  expect(observation.frogStart).toBe('35');
  expect(observation.frogJumps).toEqual(['10', '10', '1', '1', '1']);
  expect(observation.frogJumpTotal).toBe('23');
  await expect(page.getByTestId('frog-log')).toHaveText('출발 35 → +10 → +10 → +1 → +1 → +1');
});

test('힌트 ② 오버레이는 본 수직선 svg와 같은 자리·크기에 겹친다', async ({ page }) => {
  const { canvas, at } = await openNumberLine(page, { mode: 'integer', min: 0, max: 100 });
  await tapAt(page, at, 700, 300);
  await pollObservation(page, (observation) => observation.points?.length === 1);

  await page.getByRole('button', { name: '힌트 겹쳐 보기' }).click();
  const overlay = page.getByTestId('overlay-distance-from-zero');
  await expect(overlay).toBeVisible();

  const canvasBox = await canvas.boundingBox();
  const overlayBox = await overlay.boundingBox();
  if (!canvasBox || !overlayBox) throw new Error('오버레이 크기를 알 수 없습니다.');
  // 실행기 칸 전체가 아니라 본 수직선 svg와 같은 상자여야 눈금과 겹친다.
  expect(Math.abs(overlayBox.x - canvasBox.x)).toBeLessThanOrEqual(1);
  expect(Math.abs(overlayBox.y - canvasBox.y)).toBeLessThanOrEqual(1);
  expect(Math.abs(overlayBox.width - canvasBox.width)).toBeLessThanOrEqual(1);
  expect(Math.abs(overlayBox.height - canvasBox.height)).toBeLessThanOrEqual(1);

  // 오버레이가 그린 막대도 수직선 상자 안, 수직선 위쪽에 있다.
  const bar = overlay.locator('[data-distance-value] line').first();
  const barBox = await bar.boundingBox();
  if (!barBox) throw new Error('거리 막대를 찾지 못했습니다.');
  expect(barBox.x).toBeGreaterThanOrEqual(canvasBox.x - 1);
  expect(barBox.x + barBox.width).toBeLessThanOrEqual(canvasBox.x + canvasBox.width + 1);
  expect(barBox.y).toBeGreaterThanOrEqual(canvasBox.y - 1);
  expect(barBox.y).toBeLessThanOrEqual(canvasBox.y + canvasBox.height);
});

// ── T219 range · rounding 상황 장면 ─────────────────────────

const RANGE_CONFIG = {
  mode: 'range',
  min: 100,
  max: 160,
  unit: 1,
  subdivisions: 10,
  story: 'rollercoaster',
  riders: [118, 125, 129, 130, 131, 140, 145, 150, 151, 155],
};
/** range 수직선의 논리 y. 화면 배율은 판 상자 너비 / 1000으로만 정하고 논리 높이는 가정하지 않는다. */
const RANGE_LINE_Y = 490;

async function openRange(page: Page, config: Record<string, unknown> = RANGE_CONFIG) {
  const view = await openNumberLine(page, config);
  await selectMode(page, 'range');
  return view;
}

/** 판이 화면보다 높을 수 있어, 수직선이 보이게 스크롤한 뒤의 판 상자를 돌려준다. */
async function rangeBoxInView(canvas: Locator) {
  await canvas.evaluate((element) => element.scrollIntoView({ block: 'end' }));
  const box = await canvas.boundingBox();
  if (!box) throw new Error('range 판 크기를 알 수 없습니다.');
  return box;
}

/** range 수직선 위 값(100~160)의 화면 좌표. */
function rangeScreenAt(
  box: { readonly x: number; readonly y: number; readonly width: number },
  value: number,
): { x: number; y: number } {
  const scale = box.width / 1000;
  const logicalX = 100 + ((value - 100) / 60) * 800;
  return { x: box.x + logicalX * scale, y: box.y + RANGE_LINE_Y * scale };
}

async function waitGateDone(page: Page): Promise<void> {
  await expect(page.locator('[data-testid="range-story"][data-gate-done="true"]')).toBeVisible({
    timeout: 8000,
  });
}

test('range에서 누르고 끌어 130 이상을 만들고 게이트를 연다', async ({ page }) => {
  const { canvas } = await openRange(page);
  await expectControlsAboveFold(page, 'range', 0, 'range-controls', 'page');
  const box = await rangeBoxInView(canvas);

  // 120을 눌러 경계점을 놓고, 130으로 끌어 옮긴다.
  const from = rangeScreenAt(box, 120);
  await page.mouse.click(from.x, from.y);
  await expect(page.getByTestId('range-bound-0')).toHaveAttribute('data-value', '120');
  const to = rangeScreenAt(box, 130);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move((from.x + to.x) / 2, to.y, { steps: 4 });
  await page.mouse.move(to.x, to.y, { steps: 4 });
  await page.mouse.up();
  await expect(page.getByTestId('range-bound-0')).toHaveAttribute('data-value', '130');
  await expect(page.getByTestId('range-bound-0')).toHaveAttribute('data-closed', 'false');

  // 경계점을 누르면 속 찬 동그라미가 된다.
  await page.mouse.click(to.x, to.y);
  await expect(page.getByTestId('range-bound-0')).toHaveAttribute('data-closed', 'true');

  await page.getByRole('button', { name: '오른쪽으로', exact: true }).click();
  await pollObservation(page, (observation) => observation['complete'] === true);
  let observation = await readObservation(page);
  expect(observation['lower']).toEqual({ value: '130', closed: true });
  expect(observation['upper']).toBeNull();
  expect(observation['passed']).toEqual([]);

  await page.getByRole('button', { name: '게이트 열기', exact: true }).click();
  await waitGateDone(page);
  observation = await readObservation(page);
  expect(observation['gateOpened']).toBe(true);
  expect(observation['passed']).toEqual([130, 131, 140, 145, 150, 151, 155]);
  expect(observation['blocked']).toEqual([118, 125, 129]);

  // 화면 어디에도 이상·이하·초과·미만으로 풀어 쓰지 않는다.
  const text = (await page.getByTestId('number-line-canvas').textContent()) ?? '';
  for (const word of ['이상', '이하', '초과', '미만']) expect(text).not.toContain(word);
});

test('range에서 경계 둘을 놓고 130 이상 150 미만을 만든다', async ({ page }) => {
  const { canvas } = await openRange(page, { ...RANGE_CONFIG, maxBounds: 2 });
  const box = await rangeBoxInView(canvas);
  const first = rangeScreenAt(box, 150);
  const second = rangeScreenAt(box, 130);
  await page.mouse.click(first.x, first.y);
  await page.mouse.click(second.x, second.y);
  await pollObservation(page, (observation) => observation['complete'] === true);
  // 130(왼쪽 경계)만 속 찬 동그라미로 바꾼다.
  await page.mouse.click(second.x, second.y);
  await pollObservation(
    page,
    (observation) =>
      (observation['lower'] as { closed?: boolean } | null)?.closed === true &&
      (observation['upper'] as { closed?: boolean } | null)?.closed === false,
  );
  const observation = await readObservation(page);
  expect(observation['lower']).toEqual({ value: '130', closed: true });
  expect(observation['upper']).toEqual({ value: '150', closed: false });

  await page.getByRole('button', { name: '게이트 열기', exact: true }).click();
  await waitGateDone(page);
  const opened = await readObservation(page);
  expect(opened['passed']).toEqual([130, 131, 140, 145]);
  expect(opened['blocked']).toEqual([118, 125, 129, 150, 151, 155]);
});

test('range를 키보드로만 130 이상으로 만든다', async ({ page }) => {
  const { canvas } = await openRange(page);
  await canvas.focus();
  for (let count = 0; count < 30; count += 1) await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('range-bound-0')).toHaveAttribute('data-value', '130');
  await page.keyboard.press('Space');
  await expect(page.getByTestId('range-bound-0')).toHaveAttribute('data-closed', 'true');
  await page.getByRole('button', { name: '오른쪽으로', exact: true }).focus();
  await page.keyboard.press('Enter');
  await pollObservation(page, (observation) => observation['complete'] === true);
  const observation = await readObservation(page);
  expect(observation['lower']).toEqual({ value: '130', closed: true });
});

test('range 게이트를 연 화면 기준 이미지', async ({ page }) => {
  test.skip(test.info().project.name === 'board', '기준 이미지는 크롬북·아이패드만 둔다.');
  const { canvas } = await openRange(page, {
    ...RANGE_CONFIG,
    preset: { lower: { value: 130, closed: true } },
  });
  await page.getByRole('button', { name: '게이트 열기', exact: true }).click();
  await waitGateDone(page);
  await page.waitForTimeout(500);
  await expect(canvas).toHaveScreenshot('number-line-range-gate.png', { animations: 'disabled' });
});

const BUS = { mode: 'rounding', value: 243, place: 10, scenario: 'bus-seats' };

test('rounding 버스 장면: 올림은 모두 탔고 버림은 못 탄 친구가 있다', async ({ page }) => {
  await openNumberLine(page, BUS);
  await selectMode(page, 'rounding');
  await expectControlsAboveFold(page, 'rounding scenario', 0, 'rounding-controls', 'page');
  await expect(page.getByTestId('rounding-scene')).toHaveCount(0);

  await page.getByRole('button', { name: '올림', exact: true }).click();
  await expect(page.getByTestId('rounding-scene')).toHaveAttribute(
    'data-consequence',
    'all-seated',
  );
  await expect(page.getByTestId('rounding-scene-caption')).toHaveText('모두 탔어요');
  let observation = await readObservation(page);
  expect(observation['scenario']).toBe('bus-seats');
  expect(observation['consequence']).toBe('all-seated');
  expect(observation.rounding?.[0]?.method).toBe('up');

  await page.getByRole('button', { name: '버림', exact: true }).click();
  await expect(page.getByTestId('rounding-scene')).toHaveAttribute(
    'data-consequence',
    'left-behind',
  );
  await expect(page.getByTestId('rounding-scene-caption')).toHaveText('못 탄 친구가 있어요');
  await expect(page.getByTestId('scene-student')).toHaveCount(3);
  observation = await readObservation(page);
  expect(observation['consequence']).toBe('left-behind');
  expect(observation.rounding?.[0]?.method).toBe('down');
  // 전체 버스 수(25·24)는 장면 글에 없다.
  expect((await page.getByTestId('rounding-scene').textContent()) ?? '').not.toMatch(/\d/);
});

test('rounding 버스 장면 기준 이미지', async ({ page }) => {
  test.skip(test.info().project.name === 'board', '기준 이미지는 크롬북·아이패드만 둔다.');
  await openNumberLine(page, BUS);
  await selectMode(page, 'rounding');
  await page.getByRole('button', { name: '버림', exact: true }).click();
  await expect(page.getByTestId('rounding-scene')).toBeVisible();
  await expect(page.getByTestId('number-line-canvas')).toHaveScreenshot(
    'number-line-rounding-bus.png',
    { animations: 'disabled' },
  );
});

async function openWithOverlay(
  page: Page,
  config: Record<string, unknown>,
  overlay: string,
  mode: string,
) {
  const query = `/?config=${encodeURIComponent(JSON.stringify(config))}&overlay=${overlay}`;
  await page.goto(`${query}#/sandbox/E03`);
  await expect(page.getByRole('heading', { name: '수직선' })).toBeVisible();
  await selectMode(page, mode);
}

async function expectOverlayAligned(page: Page, testId: string): Promise<void> {
  await page.getByRole('button', { name: '힌트 겹쳐 보기' }).click();
  const overlay = page.getByTestId(testId);
  await expect(overlay).toBeVisible();
  const canvasBox = await page.getByTestId('number-line-canvas').boundingBox();
  const overlayBox = await overlay.boundingBox();
  if (!canvasBox || !overlayBox) throw new Error('오버레이 크기를 알 수 없습니다.');
  expect(Math.abs(overlayBox.x - canvasBox.x)).toBeLessThanOrEqual(1);
  expect(Math.abs(overlayBox.y - canvasBox.y)).toBeLessThanOrEqual(1);
  expect(Math.abs(overlayBox.width - canvasBox.width)).toBeLessThanOrEqual(1);
  expect(Math.abs(overlayBox.height - canvasBox.height)).toBeLessThanOrEqual(1);
}

test('boundary-rider 오버레이는 range 판과 같은 자리·크기에 겹친다', async ({ page }) => {
  await openWithOverlay(
    page,
    { ...RANGE_CONFIG, preset: { lower: { value: 130, closed: true } } },
    'boundary-rider',
    'range',
  );
  await expectOverlayAligned(page, 'overlay-boundary-rider');
  const rider = page.locator('[data-testid="overlay-boundary-rider"] [data-rider-height]');
  await expect(rider).toHaveCount(1);
  await expect(rider).toHaveAttribute('data-rider-height', '130');
  await expect(rider).toHaveAttribute('data-result', 'passed');
});

test('left-behind 오버레이는 rounding 판과 같은 자리·크기에 겹친다', async ({ page }) => {
  await openWithOverlay(page, BUS, 'left-behind', 'rounding');
  await expectOverlayAligned(page, 'overlay-left-behind');
  await expect(
    page.locator('[data-testid="overlay-left-behind"] [data-testid="scene-student"]'),
  ).toHaveCount(3);
});

/** range 캐릭터 키 글: 화면 12px 이상이고 이웃 글 상자가 겹치지 않는다. */
async function expectRiderLabelsReadable(page: Page): Promise<void> {
  const result = await page.evaluate(() => {
    const svg = document.querySelector('[data-testid="number-line-canvas"]');
    const scale = (svg?.getBoundingClientRect().width ?? 0) / 1000;
    const labels = [...document.querySelectorAll('[data-rider-label]')].map((node) => {
      const rect = node.getBoundingClientRect();
      return {
        left: rect.left,
        right: rect.right,
        top: rect.top,
        bottom: rect.bottom,
        px: Number(node.getAttribute('font-size')) * scale,
      };
    });
    let overlap = 0;
    for (let a = 0; a < labels.length; a += 1) {
      for (let b = a + 1; b < labels.length; b += 1) {
        const p = labels[a];
        const q = labels[b];
        if (!p || !q) continue;
        if (p.left < q.right && q.left < p.right && p.top < q.bottom && q.top < p.bottom) {
          overlap += 1;
        }
      }
    }
    return { count: labels.length, minPx: Math.min(...labels.map((label) => label.px)), overlap };
  });
  expect(result.count).toBe(10);
  expect(result.minPx).toBeGreaterThanOrEqual(12);
  expect(result.overlap).toBe(0);
}

test('range 캐릭터 키 글이 줄 선 때와 게이트를 연 뒤 모두 읽을 수 있다', async ({ page }) => {
  await openRange(page, { ...RANGE_CONFIG, preset: { lower: { value: 130, closed: true } } });
  await expectRiderLabelsReadable(page);
  await page.getByRole('button', { name: '게이트 열기', exact: true }).click();
  await waitGateDone(page);
  await page.waitForTimeout(500);
  await expectRiderLabelsReadable(page);
});
