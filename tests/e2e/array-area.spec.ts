import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { logicalToScreen } from './canvas-point';

/**
 * E04 배열판 샌드박스 E2E.
 * 아이패드(WebKit)·크롬북·전자칠판 뷰포트에서 모두 돈다.
 * 좌표는 화면 픽셀이 아니라 SVG 논리 좌표(1000×600)로 적는다.
 */

interface ObservationRecord {
  readonly mode?: string;
  readonly rows?: number;
  readonly cols?: number;
  readonly total?: number;
  readonly distinctArrangements?: number;
  readonly splits?: { orientation: string; at: number }[];
  readonly partials?: { rows: number; cols: number; product: number; sign: number }[];
  readonly partialSum?: number;
  readonly a?: number;
  readonly b?: number;
  readonly splitsA?: number[];
  readonly splitsB?: number[];
  readonly [key: string]: unknown;
}

async function openArrayArea(page: Page, config?: unknown) {
  const query = config === undefined ? '' : `?config=${encodeURIComponent(JSON.stringify(config))}`;
  await page.goto(`/${query}#/sandbox/E04`);
  await expect(page.getByRole('heading', { name: '배열판' })).toBeVisible();
  const canvas = page.getByTestId('array-canvas');
  await expect(canvas).toBeVisible();
  return {
    canvas,
    observation: page.getByTestId('observation'),
  };
}

/** 캔버스가 뷰포트보다 길면 아래까지 보이도록 스크롤하고 스크롤 뒤 상자를 돌려준다. */
async function visibleCanvasBox(page: Page, canvas: Locator) {
  await canvas.scrollIntoViewIfNeeded();
  const viewport = page.viewportSize();
  const box = await canvas.boundingBox();
  if (!viewport || !box) throw new Error('배열판 캔버스 크기를 알 수 없습니다.');
  const overflow = box.y + box.height - viewport.height;
  if (overflow > 0) {
    await page.evaluate((delta) => window.scrollBy(0, delta), overflow + 8);
  }
  const fitted = await canvas.boundingBox();
  if (!fitted) throw new Error('배열판 캔버스 크기를 알 수 없습니다.');
  return fitted;
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

test('키보드로 3×4 배열을 만들고 돌리면 4×3이 되며 곱은 화면에 없다', async ({ page }) => {
  const { canvas } = await openArrayArea(page, { mode: 'dot-array', rotate: true });

  const handle = page.getByRole('button', { name: '행·열 손잡이' });
  await handle.focus();
  await expect(handle).toBeFocused();
  for (let index = 0; index < 3; index += 1) await page.keyboard.press('ArrowUp');
  for (let index = 0; index < 4; index += 1) await page.keyboard.press('ArrowRight');

  await pollObservation(page, (current) => current.rows === 3 && current.cols === 4);
  expect((await readObservation(page)).total).toBe(12);

  // 기록한 뒤 돌려도 같은 배열로 센다.
  await page.getByRole('button', { name: '배열 기록하기' }).click();
  await page.getByRole('button', { name: '돌리기', exact: true }).click();
  await pollObservation(page, (current) => current.rows === 4 && current.cols === 3);

  await page.getByRole('button', { name: '배열 기록하기' }).click();
  const record = await readObservation(page);
  expect(record.distinctArrangements).toBe(1);
  expect(record.total).toBe(12);

  // 기본 설정에서는 전체 곱을 캔버스에 쓰지 않는다.
  await expect(canvas).not.toContainText('12');
});

test('7×8 배열의 세로 분할선을 키보드로 5에 옮기면 부분곱 35·21이 보인다', async ({ page }) => {
  const { canvas } = await openArrayArea(page, { mode: 'split', rows: 7, cols: 8 });
  await page.getByLabel('모드').selectOption('split');
  await pollObservation(page, (current) => current.rows === 7 && current.cols === 8);

  await page.getByRole('button', { name: '세로 분할선 놓기' }).click();
  await pollObservation(page, (current) => current.splits?.[0]?.at === 4);

  const line = page.getByRole('button', { name: '세로 분할선 4번째 자리' });
  await line.focus();
  await expect(line).toBeFocused();
  await page.keyboard.press('ArrowRight');

  await pollObservation(page, (current) => current.splits?.[0]?.at === 5);
  const record = await readObservation(page);
  const products = (record.partials ?? []).map((piece) => piece.product).sort((a, b) => a - b);
  expect(products).toEqual([21, 35]);
  expect(record.partialSum).toBe(56);

  await expect(canvas).toContainText('35');
  await expect(canvas).toContainText('21');
  await expect(canvas).not.toContainText('56');
});

test('23×4 넓이 모델의 가로 분할선을 20으로 끌면 20×4와 3×4 조각이 된다', async ({ page }) => {
  const { canvas } = await openArrayArea(page, { mode: 'area-model', a: 23, b: 4 });
  await page.getByLabel('모드').selectOption('area-model');
  await pollObservation(page, (current) => current.a === 23 && current.b === 4);

  await page.getByRole('button', { name: '가로를 나누는 선 놓기' }).click();
  await pollObservation(page, (current) => current.splitsA?.length === 1);

  const box = await visibleCanvasBox(page, canvas);
  const at = (x: number, y: number) => logicalToScreen(box, x, y);
  // areaRect(23, 4): x=125, width=690, y=140, height=240.
  const from = at(125 + (690 * 11) / 23, 260);
  const to = at(125 + (690 * 20) / 23, 260);

  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 12 });
  await page.mouse.up();

  await pollObservation(page, (current) => current.splitsA?.[0] === 20);
  const record = await readObservation(page);
  const products = (record.partials ?? []).map((piece) => piece.product).sort((a, b) => a - b);
  expect(products).toEqual([12, 80]);
  expect(record.partialSum).toBe(92);

  await expect(canvas).not.toContainText('92');
  await expect(canvas).toContainText('20×4');
  await expect(canvas).toContainText('3×4');
});

test('12×18 방에 타일 한 변 6을 고르면 남는 자리 없이 덮이고 타일 수는 화면에 없다', async ({
  page,
}) => {
  const { canvas } = await openArrayArea(page, { mode: 'tiling', width: 12, height: 18 });
  await page.getByLabel('모드').selectOption('tiling');
  await pollObservation(page, (current) => current.width === 12 && current.height === 18);

  const bigger = page.getByRole('button', { name: '타일 크게' });
  for (let index = 0; index < 6; index += 1) await bigger.click();

  await pollObservation(page, (current) => current.tileSize === 6 && current.fitsAll === true);
  const record = await readObservation(page);
  expect(record.leftoverCells).toEqual([0]);
  expect(record.tilesUsed).toEqual([6]);
  expect(record.recordedSizes).toEqual([]);

  await page.getByRole('button', { name: '기록하기', exact: true }).click();
  await pollObservation(
    page,
    (current) =>
      Array.isArray(current.recordedSizes) && (current.recordedSizes as number[]).includes(6),
  );

  // 남는 칸 수·타일 수는 화면에 쓰지 않는다.
  await expect(canvas).not.toContainText('216');
  await expect(canvas).not.toContainText('남는');
});

test('0.6×0.3 소수 넓이는 겹친 칸 18이고 곱은 화면에 없다', async ({ page }) => {
  const { canvas } = await openArrayArea(page, {
    mode: 'decimal-area',
    a: '0.6',
    b: '0.3',
  });
  await page.getByLabel('모드').selectOption('decimal-area');
  await pollObservation(page, (current) => current.overlapCells === 18);
  expect((await readObservation(page)).product).toBe('0.18');

  await page.getByRole('button', { name: '가로 늘리기' }).click();
  await pollObservation(page, (current) => current.overlapCells === 21);
  expect((await readObservation(page)).product).toBe('0.21');

  for (let index = 0; index < 4; index += 1) {
    await page.getByRole('button', { name: '가로 줄이기' }).click();
  }
  await pollObservation(page, (current) => current.overlapCells === 9);
  expect((await readObservation(page)).product).toBe('0.09');

  await expect(canvas).not.toContainText('0.18');
  await expect(canvas).not.toContainText('0.09');
});

test('리본 12m에 3/4을 곱하면 예측 뒤 길이 9가 된다', async ({ page }) => {
  const { canvas } = await openArrayArea(page, {
    mode: 'fraction-area',
    variant: 'scaler',
    base: 12,
    multipliers: ['3/4'],
    showResult: true,
  });
  await page.getByLabel('모드').selectOption('fraction-area');
  await pollObservation(page, (current) => current.prediction === null);

  // 예측 전에는 곱하는 수를 고를 수 없다.
  await expect(page.getByRole('button', { name: '뒤 눈금' })).toBeDisabled();
  await page.getByRole('button', { name: '짧아질까' }).click();
  await pollObservation(page, (current) => current.prediction === 'smaller');

  await page.getByRole('button', { name: '뒤 눈금' }).click();
  await pollObservation(page, (current) => current.result === '9');
  const record = await readObservation(page);
  expect(record.multiplier).toBe('3/4');
  expect(record.predictionFits).toBe(true);
  expect(record.tried).toEqual(['3/4']);

  await expect(canvas).toContainText('리본 길이 9');
});

test('32×23 퍼즐 조각 네 개를 슬롯에 놓으면 조립되고 전체 곱은 화면에 없다', async ({ page }) => {
  const { canvas } = await openArrayArea(page, {
    mode: 'area-model',
    a: 32,
    b: 23,
    puzzle: { splitsA: [30], splitsB: [20], seed: 1 },
  });
  await page.getByLabel('모드').selectOption('area-model');
  await pollObservation(page, (current) => current.placedPieces === 0);

  const pieces = await page.locator('[data-piece]').evaluateAll((elements) =>
    elements.map((element) => ({
      id: element.getAttribute('data-piece') ?? '',
      label: element.getAttribute('aria-label') ?? '',
    })),
  );
  expect(pieces).toHaveLength(4);

  for (const piece of pieces) {
    const area = Number(piece.label.split(' ').pop());
    const col = area === 600 || area === 90 ? 0 : 1;
    const row = area === 600 || area === 40 ? 0 : 1;
    await page.locator(`[data-piece="${piece.id}"]`).click();
    await page.locator(`[data-slot="${col},${row}"]`).click();
  }

  await pollObservation(page, (current) => current.puzzleAssembled === true);
  const record = await readObservation(page);
  expect(record.assembledDims).toEqual({ a: 32, b: 23 });
  expect(record.placedPieces).toBe(4);

  await expect(canvas).not.toContainText('736');
});
