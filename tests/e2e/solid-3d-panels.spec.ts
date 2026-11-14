import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

interface ObservationRecord {
  readonly count?: number;
  readonly heights?: readonly (readonly number[])[];
  readonly numbers?: readonly (readonly number[])[];
  readonly layerFocus?: number | null;
  readonly layerPaint?: readonly (readonly (readonly number[])[])[];
  readonly painted?: {
    readonly top?: readonly (readonly number[])[];
    readonly front?: readonly (readonly number[])[];
    readonly side?: readonly (readonly number[])[];
  };
  readonly [key: string]: unknown;
}

interface FitMeasurement {
  readonly viewportH: number;
  readonly wrapHeight: number;
  readonly wrapOverflowY: number;
  readonly sideStackOverflowY: number;
  readonly sideStackOverflowX: number;
  readonly stageVisible: boolean;
  readonly stageHeight: number;
  readonly keyPanelInViewport: boolean;
}

async function openFitSandbox(page: Page, config: Record<string, unknown>) {
  const merged = { stage: 'isometric', ...config };
  const query = `?stage=fit&config=${encodeURIComponent(JSON.stringify(merged))}`;
  await page.goto(`/${query}#/sandbox/E12`);
  await expect(page.getByRole('heading', { name: '3D 입체' })).toBeVisible();
  await expect(page.locator('div[data-cpa]')).toBeVisible();
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

async function measureFirstScreen(page: Page, panelSelector: string): Promise<FitMeasurement> {
  return page.evaluate((selector) => {
    const wrap = document.querySelector('div[data-cpa]') as HTMLElement | null;
    const hostViewport = wrap?.parentElement;
    const sideStack = wrap?.querySelector('[class*="sideStack"]') as HTMLElement | null;
    const stage = wrap?.querySelector('[data-testid="cubes-stage"]') as HTMLElement | null;
    const keyPanel = wrap?.querySelector(selector) as HTMLElement | null;
    const vh = window.innerHeight;
    const keyRect = keyPanel?.getBoundingClientRect();
    const hostRect = hostViewport?.getBoundingClientRect();
    return {
      viewportH: vh,
      wrapHeight: Math.round(wrap?.getBoundingClientRect().height ?? 0),
      wrapOverflowY: Math.round(
        (hostViewport?.scrollHeight ?? 0) - (hostViewport?.clientHeight ?? 0),
      ),
      sideStackOverflowY: Math.round(
        (sideStack?.scrollHeight ?? 0) - (sideStack?.clientHeight ?? 0),
      ),
      sideStackOverflowX: Math.round((sideStack?.scrollWidth ?? 0) - (sideStack?.clientWidth ?? 0)),
      stageVisible: Boolean(stage),
      stageHeight: Math.round(stage?.getBoundingClientRect().height ?? 0),
      keyPanelInViewport: Boolean(
        keyRect &&
        hostRect &&
        keyRect.top >= hostRect.top - 1 &&
        keyRect.bottom <= Math.min(vh, hostRect.bottom) + 1,
      ),
    };
  }, panelSelector);
}

test('① numberGrid input + 고정 쌓기나무: 첫 화면·48px/18px·키보드 입력', async ({
  page,
}, testInfo) => {
  await openFitSandbox(page, {
    grid: [3, 3],
    maxHeight: 3,
    editable: false,
    numberGrid: { mode: 'input' },
    initial: [
      { at: [0, 0, 0], locked: true },
      { at: [1, 1, 0], locked: true },
      { at: [1, 1, 1], locked: true },
    ],
  });

  const grid = page.getByTestId('cubes-numbers');
  await expect(grid).toBeVisible();
  const m = await measureFirstScreen(page, '[data-testid="cubes-numbers"]');
  console.log(`[T134 #1 input] ${testInfo.project.name}: ${JSON.stringify(m)}`);
  expect(m.sideStackOverflowX).toBeLessThanOrEqual(2);

  // 칸 48px 이상, 글자 18px 이상
  const cell00 = page.locator('[data-num-cell="0,0"]');
  const cellBox = await cell00.boundingBox();
  expect(cellBox?.width ?? 0).toBeGreaterThanOrEqual(48);
  expect(cellBox?.height ?? 0).toBeGreaterThanOrEqual(48);
  const fontSize = await cell00.evaluate((el) => Number.parseFloat(getComputedStyle(el).fontSize));
  expect(fontSize).toBeGreaterThanOrEqual(18);
  expect(await cell00.textContent()).toBe('0');
  expect(await page.locator('[data-num-cell="0,1"]').textContent()).toBe('');

  // 클릭 + 방향키 + 숫자키 + Backspace
  await page.locator('[data-num-cell="1,0"]').click();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('2');
  await pollObservation(page, (obs) => obs.numbers?.[1]?.[1] === 2);
  await expect(page.locator('[data-num-cell="1,1"]')).toHaveText('2');

  await page.keyboard.press('Backspace');
  await pollObservation(page, (obs) => obs.numbers?.[1]?.[1] === 0);
  await expect(page.locator('[data-num-cell="1,1"]')).toHaveText('0');
});

test('② drive 모드: 수 쓰기로 무대 높이 변경', async ({ page }, testInfo) => {
  await openFitSandbox(page, {
    grid: [3, 3],
    maxHeight: 3,
    numberGrid: { mode: 'drive' },
  });

  const grid = page.getByTestId('cubes-numbers');
  await expect(grid).toBeVisible();
  const m = await measureFirstScreen(page, '[data-testid="cubes-numbers"]');
  console.log(`[T134 #2 drive] ${testInfo.project.name}: ${JSON.stringify(m)}`);
  expect(m.sideStackOverflowX).toBeLessThanOrEqual(2);

  await grid.focus();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('3');
  await pollObservation(page, (obs) => obs.count === 3 && obs.numbers?.[2]?.[0] === 3);

  await page.getByRole('button', { name: '1 넣기' }).click();
  await pollObservation(page, (obs) => obs.count === 1 && obs.heights?.[2]?.[0] === 1);
});

test('③ layers slider+paint: 층 선택·불투명·PageUp/Enter 칠하기', async ({ page }, testInfo) => {
  await openFitSandbox(page, {
    grid: [3, 3],
    maxHeight: 3,
    layers: { slider: true, panel: 'paint' },
    initial: [{ at: [0, 0, 0] }, { at: [0, 0, 1] }],
  });

  const layer1 = page.getByTestId('cubes-layer-1');
  await expect(layer1).toBeVisible();
  const m = await measureFirstScreen(page, '[data-testid="cubes-layer-1"]');
  console.log(`[T134 #3 layers] ${testInfo.project.name}: ${JSON.stringify(m)}`);
  expect(m.sideStackOverflowX).toBeLessThanOrEqual(2);

  await page.getByTestId('cubes-layer-btn-2').click();
  await pollObservation(page, (obs) => obs.layerFocus === 2);
  await expect(page.getByTestId('cubes-layer-2')).toHaveAttribute('data-layer-active', 'true');

  // 키보드: 1층 칠하기 → PageUp → 2층 이동 후 칸 이동해 칠하기
  await layer1.focus();
  await page.keyboard.press('Enter');
  await pollObservation(page, (obs) => obs.layerPaint?.[0]?.[0]?.[0] === 1);

  await page.keyboard.press('PageUp');
  await expect(page.getByTestId('cubes-layer-2')).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await pollObservation(page, (obs) => obs.layerPaint?.[1]?.[0]?.[1] === 1);
});

test('④ paintViews ["side"] + rotationLocked: 겹친 실시간 뷰 숨김 및 키보드 칠하기', async ({
  page,
}, testInfo) => {
  await openFitSandbox(page, {
    grid: [3, 3],
    maxHeight: 3,
    views: ['top', 'front', 'side'],
    paintViews: ['side'],
    rotationLocked: true,
    initial: [{ at: [0, 0, 0] }, { at: [0, 0, 1] }],
  });

  const paintSide = page.getByTestId('cubes-paint-side');
  await expect(paintSide).toBeVisible();
  await expect(page.getByTestId('cubes-view-side')).toHaveCount(0);
  await expect(page.getByTestId('cubes-view-top')).toBeVisible();

  const m = await measureFirstScreen(page, '[data-testid="cubes-paint-side"]');
  console.log(`[T134 #4 paintViews] ${testInfo.project.name}: ${JSON.stringify(m)}`);
  expect(m.sideStackOverflowX).toBeLessThanOrEqual(2);

  const paintCell = page.locator('[data-paint-cell="side,0,0"]');
  const box = await paintCell.boundingBox();
  expect(box?.width ?? 0).toBeGreaterThanOrEqual(48);
  expect(box?.height ?? 0).toBeGreaterThanOrEqual(48);

  await paintSide.focus();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await pollObservation(page, (obs) => obs.painted?.side?.[2]?.[0] === 1);
});

test('⑤ stageHidden + numberGrid given: 무대·도구 숨김 및 2D 전용 키보드 조작', async ({
  page,
}, testInfo) => {
  await openFitSandbox(page, {
    grid: [3, 3],
    maxHeight: 3,
    stageHidden: true,
    numberGrid: {
      mode: 'given',
      given: [
        [1, 0, 2],
        [0, 3, 0],
        [1, 1, 0],
      ],
    },
    paintViews: ['top'],
  });

  await expect(page.getByTestId('cubes-stage')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '쌓기' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '왼쪽으로 돌리기' })).toHaveCount(0);
  await expect(page.getByTestId('cubes-numbers')).toBeVisible();
  await expect(page.locator('[data-num-cell="0,0"]')).toHaveText('1');
  await expect(page.locator('[data-num-cell="0,1"]')).toHaveText('');

  const m = await measureFirstScreen(page, '[data-testid="cubes-paint-top"]');
  console.log(`[T134 #5 stageHidden] ${testInfo.project.name}: ${JSON.stringify(m)}`);
  expect(m.stageVisible).toBe(false);
  expect(m.sideStackOverflowX).toBeLessThanOrEqual(2);

  const paintTop = page.getByTestId('cubes-paint-top');
  await paintTop.focus();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await pollObservation(page, (obs) => obs.painted?.top?.[0]?.[1] === 1);
});
