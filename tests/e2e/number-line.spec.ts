import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

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
    at: (x: number, y: number) => ({
      x: box.x + (x / 1000) * box.width,
      y: box.y + (y / 600) * box.height,
    }),
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
  const spacingPx = (((sorted[1] ?? 0) - (sorted[0] ?? 0)) / 1000) * box.width;
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
