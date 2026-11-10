import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

/**
 * E09 circle·angle 모드 E2E(T102).
 *
 * - circle: 밧줄을 72칸 돌려 커버리지 100%, 현을 지름 자리로 붙여 "지름" 이름표.
 * - angle: 각도기를 올리고 어림 50 → 읽기 60, 레이저 135 발사.
 * - active-scale 오버레이가 본 캔버스와 2px 안에 겹친다(크롬북).
 */

interface CircleObservation {
  readonly mode?: string;
  readonly coverage?: Record<string, number>;
  readonly chord?: { readonly throughCenter?: boolean } | null;
  readonly [key: string]: unknown;
}

interface AngleRecord {
  readonly reading?: number | null;
  readonly readingError?: number | null;
  readonly readingAligned?: boolean | null;
  readonly estimate?: number | null;
}

interface AngleObservation {
  readonly mode?: string;
  readonly protractorOn?: string | null;
  readonly protractorAligned?: boolean;
  readonly activeScale?: string | null;
  readonly angles?: AngleRecord[];
  readonly puzzle?: {
    readonly targetAngle?: number;
    readonly estimate?: number | null;
    readonly fired?: number[];
    readonly hit?: boolean;
  } | null;
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

async function clickMany(page: Page, name: string, count: number): Promise<void> {
  for (let index = 0; index < count; index += 1) {
    await page.getByRole('button', { name, exact: true }).click();
  }
}

async function capture(page: Page, name: string): Promise<void> {
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: `test-results/T102-${name}-${test.info().project.name}.png`,
    fullPage: true,
  });
}

test('circle 밧줄을 72칸 돌리면 커버리지가 100%다', async ({ page }) => {
  const { canvas } = await openEngine(page, { mode: 'circle', ropeLength: 4 });
  await chooseMode(page, 'circle');
  await focusCanvas(canvas);
  for (let index = 0; index < 72; index += 1) await page.keyboard.press('ArrowRight');

  await pollObservation<CircleObservation>(page, (current) => current.coverage?.['4'] === 100);
  const observation = await readObservation<CircleObservation>(page);
  expect(observation.coverage?.['4']).toBe(100);
  await capture(page, 'circle-rope');
});

test('circle 현을 반대 자리로 붙이면 지름 이름표가 붙는다', async ({ page }) => {
  const { canvas } = await openEngine(page, {
    mode: 'circle',
    radius: 3,
    chordExplorer: true,
    snapDiameter: true,
  });
  await chooseMode(page, 'circle');
  await page.getByRole('button', { name: '현', exact: true }).click();
  await focusCanvas(canvas);
  await page.keyboard.press('2');
  for (let index = 0; index < 6; index += 1) await page.keyboard.press('ArrowRight');

  await pollObservation<CircleObservation>(
    page,
    (current) => current.chord?.throughCenter === true,
  );
  const observation = await readObservation<CircleObservation>(page);
  expect(observation.chord?.throughCenter).toBe(true);
  await expect(canvas).toContainText('지름');
  await capture(page, 'circle-chord');
});

test('angle 각도기를 맞추고 어림 50 → 읽기 60을 한다', async ({ page }) => {
  const { canvas } = await openEngine(page, {
    mode: 'angle',
    angles: [{ degrees: 60, base: 0 }],
    highlightActiveScale: true,
    estimateFirst: true,
  });
  await chooseMode(page, 'angle');
  await focusCanvas(canvas);
  await page.keyboard.press('Enter');
  await pollObservation<AngleObservation>(page, (current) => current.protractorAligned === true);

  await clickMany(page, '어림한 각 10 늘리기', 5);
  await clickMany(page, '잰 각 10 늘리기', 6);

  await pollObservation<AngleObservation>(
    page,
    (current) =>
      current.angles?.[0]?.reading === 60 &&
      (current.angles[0]?.readingError ?? 99) <= 1 &&
      current.angles[0]?.readingAligned === true,
  );
  const observation = await readObservation<AngleObservation>(page);
  expect(observation.protractorAligned).toBe(true);
  expect(observation.activeScale).toBe('outer');
  expect(observation.angles?.[0]?.estimate).toBe(50);
  expect(observation.angles?.[0]?.reading).toBe(60);
  expect(observation.angles?.[0]?.readingError ?? 99).toBeLessThanOrEqual(1);
  await capture(page, 'angle-read');
});

test('angle 레이저를 135도로 쏘면 과녁에 맞는다', async ({ page }) => {
  await openEngine(page, { mode: 'angle', puzzle: { type: 'laser-mirror', targetAngle: 135 } });
  await chooseMode(page, 'angle');
  await clickMany(page, '발사 각 10 늘리기', 13);
  await clickMany(page, '발사 각 1 늘리기', 5);
  await page.getByRole('button', { name: '쏘기', exact: true }).click();

  await pollObservation<AngleObservation>(page, (current) => current.puzzle?.hit === true);
  const observation = await readObservation<AngleObservation>(page);
  expect(observation.puzzle?.targetAngle).toBe(135);
  expect(observation.puzzle?.fired).toContain(135);
  expect(observation.puzzle?.hit).toBe(true);
  await capture(page, 'angle-laser');
});

test('active-scale 오버레이가 본 캔버스와 2px 안에 겹친다', async ({ page }) => {
  test.skip(test.info().project.name !== 'chromebook', '크롬북 뷰포트에서만 확인한다.');

  const { canvas } = await openEngine(
    page,
    {
      mode: 'angle',
      angles: [{ degrees: 60, base: 0 }],
      highlightActiveScale: true,
    },
    { overlay: 'active-scale' },
  );
  await chooseMode(page, 'angle');
  await focusCanvas(canvas);
  await page.keyboard.press('Enter');
  await pollObservation<AngleObservation>(page, (current) => current.protractorOn === 'a1');
  await page.getByRole('button', { name: '힌트 겹쳐 보기', exact: true }).click();

  const overlay = page.locator('[data-overlay="active-scale"]');
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
      { message: 'active-scale 오버레이가 본 캔버스와 어긋납니다.' },
    )
    .toBeLessThanOrEqual(2);
  await capture(page, 'overlay');
});
