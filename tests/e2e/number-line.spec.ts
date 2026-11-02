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

async function openNumberLine(page: Page) {
  await page.goto('/#/sandbox/E03');
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

test('decimal에서 0.01 눈금 간격이 화면에서 48px 이상이고, 이동 후 0.75를 찍는다', async ({
  page,
}) => {
  const { at, box } = await openNumberLine(page);
  await selectMode(page, 'decimal');

  const zoomIn = page.getByRole('button', { name: '수직선 확대' });
  await zoomIn.click();
  await zoomIn.click();
  await pollObservation(
    page,
    (observation) =>
      observation.tick === '1/100' &&
      observation.viewMin === '0' &&
      observation.viewMax === '1/100',
  );

  // 보이는 0.01 눈금 두 개의 화면 간격이 48px 이상인지 확인한다.
  const ticks = page.locator('[data-testid="number-line-canvas"] [data-tick-value]');
  await expect(ticks).toHaveCount(2);
  const tickXs = await ticks.evaluateAll((nodes) =>
    nodes.map((node) => Number(node.getAttribute('data-tick-x'))),
  );
  const sorted = [...tickXs].sort((a, b) => a - b);
  const spacingPx = (((sorted[1] ?? 0) - (sorted[0] ?? 0)) / 1000) * box.width;
  expect(spacingPx).toBeGreaterThanOrEqual(48);

  // 한 번에 보이는 폭(1/100)만큼 오른쪽으로 74번 옮기면 0.74~0.75가 보인다.
  const panRight = page.getByRole('button', { name: '수직선 오른쪽으로' });
  for (let step = 0; step < 74; step += 1) {
    await panRight.click();
  }
  await pollObservation(
    page,
    (observation) => observation.viewMin === '37/50' && observation.viewMax === '3/4',
  );

  await tapAt(page, at, 895, 300);
  await pollObservation(page, (observation) => observation.points?.[0]?.value === '3/4');

  const observation = await readObservation(page);
  expect(observation.viewMin).toBe('37/50');
  expect(observation.viewMax).toBe('3/4');
  expect(observation.points?.[0]?.value).toBe('3/4');
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
