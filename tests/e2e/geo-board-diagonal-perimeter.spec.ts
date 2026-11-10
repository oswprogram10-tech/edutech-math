import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

/**
 * E09 diagonal·fixed-perimeter E2E(T103).
 *
 * - diagonal: 키보드만으로 오각형 대각선 5개를 긋고 개수 표의 그은 수를 확인한다.
 * - diagonal: 이웃한 꼭짓점을 그으면 "이건 변이에요"가 보인다.
 * - geoboard fixed-perimeter: 둘레 20을 유지한 채 넓이가 바뀌고 기록표에 두 줄이 남는다.
 * - side-glow 오버레이가 본 캔버스와 2px 안에 겹친다(크롬북).
 */

interface DiagonalPolygon {
  readonly n?: number;
  readonly drawn?: number;
  readonly complete?: boolean;
}

interface DiagonalObservation {
  readonly mode?: string;
  readonly current?: number;
  readonly polygons?: DiagonalPolygon[];
  readonly pairs?: Record<string, number[][]>;
  readonly adjacentAttempts?: number;
  readonly duplicateAttempts?: number;
  readonly sidesDrawn?: number;
  readonly [key: string]: unknown;
}

interface RectObservation {
  readonly width?: number;
  readonly height?: number;
  readonly perimeter?: number;
  readonly area?: number;
}

interface LogRow {
  readonly width?: number;
  readonly height?: number;
  readonly area?: number;
}

interface PerimeterObservation {
  readonly mode?: string;
  readonly constraint?: { readonly type?: string; readonly value?: number } | null;
  readonly rect?: RectObservation | null;
  readonly log?: LogRow[];
  readonly [key: string]: unknown;
}

async function openEngine(page: Page, config?: unknown, extra?: Record<string, string>) {
  const params = new URLSearchParams(extra ?? {});
  if (config !== undefined) params.set('config', JSON.stringify(config));
  const query = params.toString();
  await page.goto(`/${query ? `?${query}` : ''}#/sandbox/E09`);
  await expect(page.getByRole('heading', { name: '기하판' })).toBeVisible();
  const canvas = page.getByTestId('geo-canvas');
  await expect(canvas).toBeVisible();
  return { canvas, observation: page.getByTestId('observation') };
}

async function readObservation<T>(page: Page): Promise<T> {
  const text = await page.getByTestId('observation').textContent();
  return JSON.parse(text ?? '{}') as T;
}

async function pollObservation<T>(page: Page, check: (observation: T) => boolean): Promise<void> {
  await expect.poll(async () => check(await readObservation<T>(page))).toBe(true);
}

async function chooseMode(page: Page, mode: string): Promise<void> {
  await page.getByLabel('모드').selectOption(mode);
  await pollObservation<{ readonly mode?: string }>(page, (current) => current.mode === mode);
}

async function focusCanvas(canvas: Locator): Promise<void> {
  await canvas.focus();
  await expect(canvas).toBeFocused();
}

async function pressKeys(page: Page, keys: readonly string[]): Promise<void> {
  for (const key of keys) await page.keyboard.press(key);
}

async function capture(page: Page, name: string): Promise<void> {
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: `test-results/T103-${name}-${test.info().project.name}.png`,
    fullPage: true,
  });
}

/** 오각형 대각선 (0,2)·(2,4)·(1,4)·(1,3)·(0,3)를 키보드만으로 긋는다. */
const PENTAGON_KEYS: readonly string[] = [
  'Enter',
  'ArrowRight',
  'ArrowRight',
  'Enter',
  'Enter',
  'ArrowRight',
  'ArrowRight',
  'Enter',
  'ArrowLeft',
  'ArrowLeft',
  'ArrowLeft',
  'Enter',
  'ArrowRight',
  'ArrowRight',
  'ArrowRight',
  'Enter',
  'ArrowLeft',
  'ArrowLeft',
  'ArrowLeft',
  'Enter',
  'ArrowRight',
  'ArrowRight',
  'Enter',
  'ArrowLeft',
  'ArrowLeft',
  'ArrowLeft',
  'Enter',
  'ArrowRight',
  'ArrowRight',
  'ArrowRight',
  'Enter',
];

test('diagonal 키보드로 오각형 대각선 5개를 긋고 표에 5가 남는다', async ({ page }) => {
  const { canvas } = await openEngine(page, { mode: 'diagonal', polygons: [5], countTable: true });
  await chooseMode(page, 'diagonal');
  await focusCanvas(canvas);
  await pressKeys(page, PENTAGON_KEYS);

  await pollObservation<DiagonalObservation>(
    page,
    (current) => current.polygons?.[0]?.drawn === 5 && current.polygons?.[0]?.complete === true,
  );
  const observation = await readObservation<DiagonalObservation>(page);
  expect(observation.polygons?.[0]).toMatchObject({ n: 5, drawn: 5, complete: true });
  expect(observation.pairs?.['5']).toHaveLength(5);
  expect(observation.adjacentAttempts).toBe(0);
  expect(observation.duplicateAttempts).toBe(0);
  await expect(page.getByTestId('diagonal-count-5')).toHaveText('5');
  await capture(page, 'diagonal-count');
});

test('diagonal 이웃한 꼭짓점을 그으면 "이건 변이에요"가 보인다', async ({ page }) => {
  const { canvas } = await openEngine(page, { mode: 'diagonal', polygons: [5] });
  await chooseMode(page, 'diagonal');
  await focusCanvas(canvas);
  await pressKeys(page, ['Enter', 'ArrowRight', 'Enter']);

  await pollObservation<DiagonalObservation>(page, (current) => current.adjacentAttempts === 1);
  const observation = await readObservation<DiagonalObservation>(page);
  expect(observation.adjacentAttempts).toBe(1);
  expect(observation.pairs?.['5']).toEqual([]);
  await expect(page.getByTestId('diagonal-status')).toContainText('이건 변이에요');
  await capture(page, 'diagonal-adjacent');
});

test('geoboard 둘레 20을 유지하며 넓이가 바뀌고 기록표에 두 줄이 남는다', async ({ page }) => {
  const { canvas } = await openEngine(page, {
    mode: 'geoboard',
    grid: [12, 12],
    constraint: { type: 'fixed-perimeter', value: 20, shape: 'rectangle' },
    log: true,
  });
  await chooseMode(page, 'geoboard');
  await focusCanvas(canvas);

  const areaText = page.getByTestId('perimeter-area');
  const initialArea = await areaText.textContent();
  expect(initialArea).toBe('넓이 21');

  await pressKeys(page, ['ArrowRight', 'ArrowRight', 'Enter']);
  await expect(areaText).toHaveText('넓이 25');

  await pressKeys(page, ['ArrowRight', 'ArrowRight', 'Enter']);
  await expect(areaText).toHaveText('넓이 21');

  await pollObservation<PerimeterObservation>(page, (current) => (current.log?.length ?? 0) === 2);
  const observation = await readObservation<PerimeterObservation>(page);
  expect(observation.constraint?.value).toBe(20);
  expect(observation.rect).toMatchObject({ width: 7, height: 3, perimeter: 20, area: 21 });
  expect(observation.log).toEqual([
    { width: 5, height: 5, area: 25 },
    { width: 7, height: 3, area: 21 },
  ]);

  const rows = page.getByTestId('perimeter-log-row');
  await expect(rows).toHaveCount(2);
  for (const row of await rows.all()) {
    const cells = row.locator('td');
    const width = Number(await cells.nth(0).textContent());
    const height = Number(await cells.nth(1).textContent());
    expect(width + height).toBe(10);
  }
  await expect(page.getByTestId('perimeter-value')).toContainText('둘레 20');
  await capture(page, 'perimeter-log');
});

test('side-glow 오버레이가 본 캔버스와 2px 안에 겹친다', async ({ page }) => {
  test.skip(test.info().project.name !== 'chromebook', '크롬북 뷰포트에서만 확인한다.');

  const { canvas } = await openEngine(
    page,
    { mode: 'diagonal', polygons: [5] },
    {
      overlay: 'side-glow',
    },
  );
  await chooseMode(page, 'diagonal');
  await focusCanvas(canvas);
  await pressKeys(page, ['Enter', 'ArrowRight', 'Enter']);
  await pollObservation<DiagonalObservation>(page, (current) => current.adjacentAttempts === 1);
  await page.getByRole('button', { name: '힌트 겹쳐 보기', exact: true }).click();

  const overlay = page.locator('[data-overlay="side-glow"]');
  await expect(overlay).toBeVisible();
  await expect(overlay.locator('svg')).toHaveCount(1);

  await expect
    .poll(
      async () => {
        const canvasBox = await canvas.boundingBox();
        const overlayBox = await overlay.locator('svg').boundingBox();
        if (!canvasBox || !overlayBox) return Number.POSITIVE_INFINITY;
        return Math.max(
          Math.abs(overlayBox.x - canvasBox.x),
          Math.abs(overlayBox.y - canvasBox.y),
          Math.abs(overlayBox.width - canvasBox.width),
          Math.abs(overlayBox.height - canvasBox.height),
        );
      },
      { message: 'side-glow 오버레이가 본 캔버스와 어긋납니다.' },
    )
    .toBeLessThanOrEqual(2);
  await capture(page, 'overlay');
});
