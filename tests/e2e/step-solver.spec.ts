import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

/**
 * E08 단계 풀이 샌드박스 E2E.
 * 아이패드(WebKit)·크롬북(Chromium)·전자칠판 뷰포트에서 모두 돈다.
 */

interface ObservationRecord {
  readonly mode?: string;
  readonly firstBrokenLine?: number | null;
  readonly allEquivalent?: boolean;
  readonly finalValue?: string | null;
  readonly finalRaw?: string | null;
  readonly selectedLine?: number | null;
  readonly fixedValue?: string | null;
  readonly misconceptions?: ReadonlyArray<{ readonly line?: number; readonly code?: string }>;
  readonly [key: string]: unknown;
}

async function openStepSolver(page: Page, config: Record<string, unknown>) {
  const query = `?config=${encodeURIComponent(JSON.stringify(config))}`;
  await page.goto(`${query}#/sandbox/E08`);
  await expect(page.getByRole('heading', { name: '단계 풀이' })).toBeVisible();
  await expect(page.getByTestId('step-solver')).toBeVisible();
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

async function selectMode(page: Page, mode: string): Promise<void> {
  await page.getByLabel('모드').selectOption(mode);
  await pollObservation(page, (observation) => observation.mode === mode);
}

async function typeFraction(
  page: Page,
  lineIndex: number,
  tokenIndex: number,
  num: string,
  den: string,
): Promise<void> {
  await page.getByTestId('key-fraction').click();
  for (const digit of num) await page.getByTestId(`key-${digit}`).click();
  await page.getByTestId(`token-${lineIndex}-${tokenIndex}-den`).click();
  for (const digit of den) await page.getByTestId(`key-${digit}`).click();
}

test('키패드로 3/8 + 4/8 다음 줄에 7/8을 쓰면 모두 ✓다', async ({ page }) => {
  await openStepSolver(page, { start: '3/8 + 4/8' });

  await typeFraction(page, 1, 0, '7', '8');
  await pollObservation(page, (observation) => observation.finalValue === '7/8');

  const observation = await readObservation(page);
  expect(observation.firstBrokenLine).toBeNull();
  expect(observation.allEquivalent).toBe(true);
  expect(observation.misconceptions).toEqual([]);
  await expect(page.getByTestId('check-1')).toHaveText('✓');
});

test('1/2 + 1/3 다음에 2/5를 쓰면 ✗와 반례 상자가 뜨고 5/6은 없다', async ({ page }) => {
  await openStepSolver(page, { start: '1/2 + 1/3' });

  await typeFraction(page, 1, 0, '2', '5');
  await pollObservation(page, (observation) => observation.firstBrokenLine === 1);

  const observation = await readObservation(page);
  expect(observation.allEquivalent).toBe(false);
  expect(observation.misconceptions).toEqual([{ line: 1, code: 'MC-FRAC-ADD-DENOM' }]);
  await expect(page.getByTestId('check-1')).toHaveText('✗');

  const box = page.getByTestId('counterexample');
  await expect(box).toBeVisible();
  await expect(box).toContainText('2/5');
  await expect(box).not.toContainText('5/6');
  await expect(page.getByTestId('counterexample-bars')).toBeVisible();
});

test('debug에서 친구의 틀린 줄을 고르고 5/6으로 고친다', async ({ page }) => {
  await openStepSolver(page, {
    start: '1/2 + 1/3',
    debugSamples: [{ lines: ['1/2 + 1/3', '2/5'] }],
  });
  await selectMode(page, 'debug');

  await expect(page.getByTestId('sample-line-1')).toBeVisible();
  await page.getByTestId('sample-line-1').click();
  await pollObservation(page, (observation) => observation.selectedLine === 1);

  await typeFraction(page, 2, 0, '5', '6');
  await pollObservation(page, (observation) => observation.fixedValue === '5/6');

  const observation = await readObservation(page);
  expect(observation.selectedLine).toBe(1);
  expect(observation.fixedValue).toBe('5/6');
  expect(observation.misconceptions).toEqual([]);
  await expect(page.getByTestId('check-2')).toHaveText('✓');
});
