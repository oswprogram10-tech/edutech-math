import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { logicalToScreen } from './canvas-point';

/**
 * E01 수 모형 샌드박스 E2E.
 * 아이패드(WebKit)·크롬북·전자칠판 뷰포트에서 모두 돈다.
 * 좌표는 화면 픽셀이 아니라 SVG 논리 좌표(1000×600)로 적는다.
 */

interface ObservationRecord {
  readonly mode?: string;
  readonly value?: number;
  readonly counts?: { thousands?: number; hundreds?: number; tens?: number; ones?: number };
  readonly groups?: number;
  readonly breaks?: number;
  readonly canonical?: boolean;
  readonly [key: string]: unknown;
}

async function openBaseTen(page: Page, config?: unknown) {
  const query = config === undefined ? '' : `?config=${encodeURIComponent(JSON.stringify(config))}`;
  await page.goto(`/${query}#/sandbox/E01`);
  await expect(page.getByRole('heading', { name: '수 모형' })).toBeVisible();
  const canvas = page.getByTestId('base-ten-canvas');
  await expect(canvas).toBeVisible();
  return {
    canvas,
    observation: page.getByTestId('observation'),
  };
}

/**
 * 캔버스가 뷰포트보다 길면(좁은 화면에서 5:3 비율) 아래쪽까지 보이도록 스크롤하고
 * 스크롤 뒤의 상자를 돌려준다. 화면 좌표는 반드시 이 상자로 계산한다.
 */
async function visibleCanvasBox(page: Page, canvas: Locator) {
  await canvas.scrollIntoViewIfNeeded();
  const viewport = page.viewportSize();
  const box = await canvas.boundingBox();
  if (!viewport || !box) throw new Error('수 모형 캔버스 크기를 알 수 없습니다.');
  const overflow = box.y + box.height - viewport.height;
  if (overflow > 0) {
    await page.evaluate((delta) => window.scrollBy(0, delta), overflow + 8);
  }
  const fitted = await canvas.boundingBox();
  if (!fitted) throw new Error('수 모형 캔버스 크기를 알 수 없습니다.');
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

test('낱개 34개를 "10개 묶기" 버튼으로 묶으면 십 3·일 4가 되고 수는 화면에 없다', async ({
  page,
}) => {
  const { canvas, observation } = await openBaseTen(page);

  const ones = page.getByRole('button', { name: '하나 블록 놓기' });
  for (let index = 0; index < 34; index += 1) await ones.click();
  await pollObservation(page, (current) => current.counts?.ones === 34);

  const group = page.getByRole('button', { name: '10개 묶기' });
  await expect(group).toBeEnabled();
  for (let index = 0; index < 3; index += 1) await group.click();

  await pollObservation(
    page,
    (current) => current.counts?.tens === 3 && current.counts?.ones === 4,
  );
  const record = await readObservation(page);
  expect(record.value).toBe(34);
  expect(record.groups).toBe(3);
  expect(record.canonical).toBe(true);
  expect(record.mode).toBe('count');

  // 기본 설정에서는 나타내는 수를 화면에 쓰지 않는다.
  await expect(canvas).not.toContainText('34');
  await expect(observation).toContainText('"value":34');
});

test('올가미로 낱개 10개를 감싸면 십 블록 하나가 된다', async ({ page }) => {
  const { canvas } = await openBaseTen(page, { mode: 'count', start: { ones: 10 } });
  await pollObservation(page, (current) => current.counts?.ones === 10);

  // 낱개는 오른쪽(일) 띠 위쪽에 줄 맞춰 놓인다. 그 둘레만 감싼다.
  const box = await visibleCanvasBox(page, canvas);
  const at = (x: number, y: number) => logicalToScreen(box, x, y);
  const corners = [at(700, 100), at(996, 100), at(996, 340), at(700, 340), at(700, 100)];
  const first = corners[0];
  if (!first) throw new Error('올가미 시작점이 없습니다.');
  await page.mouse.move(first.x, first.y);
  await page.mouse.down();
  for (const corner of corners.slice(1)) {
    await page.mouse.move(corner.x, corner.y, { steps: 10 });
  }
  await page.mouse.up();

  await pollObservation(
    page,
    (current) => current.counts?.tens === 1 && current.counts?.ones === 0,
  );
  const record = await readObservation(page);
  expect(record.groups).toBe(1);
  expect(record.value).toBe(10);
});

test('키보드만으로 100판 하나를 풀어 십 10개로 나눈다', async ({ page }) => {
  await openBaseTen(page, { mode: 'regroup', start: { hundreds: 1 } });
  await page.getByLabel('모드').selectOption('regroup');
  await pollObservation(page, (current) => current.mode === 'regroup');

  const hundred = page.locator('[data-block-value="100"]').first();
  await hundred.focus();
  await expect(hundred).toBeFocused();
  await page.keyboard.press('Enter');

  await pollObservation(
    page,
    (current) => current.counts?.tens === 10 && current.counts?.hundreds === 0,
  );
  const record = await readObservation(page);
  expect(record.value).toBe(100);
  expect(record.breaks).toBe(1);
});

test('큰 수 52840000을 네 자리씩 잘라 cutsCorrect가 된다', async ({ page }) => {
  await openBaseTen(page, { mode: 'big-number', value: '52840000' });
  await page.getByLabel('모드').selectOption('big-number');
  await pollObservation(page, (current) => current.mode === 'big-number');

  // 8자리 수라 오른쪽에서 4번째 자리 앞 틈 하나만 있다.
  const gap = page.locator('[data-cut-position="4"]');
  await expect(gap).toHaveCount(1);
  await gap.focus();
  await expect(gap).toBeFocused();
  await page.keyboard.press('Enter');

  await pollObservation(page, (current) => current.cutsCorrect === true);
  const record = await readObservation(page);
  expect(record.cuts).toEqual([4]);
  // 자르기 전에는 덩어리를 나눈 표시가 없다가, 자른 뒤에는 표시가 생긴다.
  await expect(page.locator('[data-cut-position="4"]')).toHaveAttribute('aria-pressed', 'true');
});

test('소수 1.2에서 막대 하나를 풀면 0.1이 낱개 10개가 된다', async ({ page }) => {
  await openBaseTen(page, { mode: 'decimal', start: { value: '1.2' } });
  await page.getByLabel('모드').selectOption('decimal');
  await pollObservation(page, (current) => current.mode === 'decimal');

  const bar = page.locator('[data-block-value="10"]').first();
  await bar.focus();
  await page.keyboard.press('Enter');

  await pollObservation(
    page,
    (current) =>
      (current.counts as Record<string, number> | undefined)?.['hundredths'] === 10 &&
      (current.counts as Record<string, number> | undefined)?.['tenths'] === 1,
  );
  const record = await readObservation(page);
  expect(record.value).toBe('1.2');
  expect(record.counts).toEqual({ ones: 1, tenths: 1, hundredths: 10 });
});

test('52÷4를 한 바퀴·풀기·한 바퀴로 나누면 접시가 똑같아진다', async ({ page }) => {
  await openBaseTen(page, { mode: 'divide', dividend: 52, divisor: 4 });
  await page.getByLabel('모드').selectOption('divide');
  await pollObservation(page, (current) => current.mode === 'divide');

  await page.getByRole('button', { name: '십 한 바퀴' }).click();
  await pollObservation(
    page,
    (current) =>
      Array.isArray(current.plateValues) &&
      (current.plateValues as number[]).every((value) => value === 10),
  );

  // 무더기에 남은 십 하나를 풀어 낱개 12개로 만든다.
  const pileTen = page.locator('[data-block-plate="pile"][data-block-value="10"]').first();
  await pileTen.focus();
  await page.keyboard.press('Enter');

  const onesRound = page.getByRole('button', { name: '하나 한 바퀴' });
  for (let index = 0; index < 3; index += 1) await onesRound.click();

  await pollObservation(page, (current) => current.equal === true && current.pileValue === 0);
  const record = await readObservation(page);
  expect(record.plateValues).toEqual([13, 13, 13, 13]);
  expect(record.value).toBe(52);
});
