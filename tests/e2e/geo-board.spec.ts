import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

/**
 * E09 기하판 샌드박스 E2E. 아이패드(WebKit)·크롬북·전자칠판 뷰포트에서 모두 돈다.
 *
 * - geoboard는 키보드만으로 삼각형을 닫는다.
 * - construct는 반직선 하나로 별 두 개를 맞힌다.
 * - 기울어진 직각에 직각삼각자를 대면 스냅 표시가 나온다.
 * - 힌트 ② `straight-run` 오버레이가 본 캔버스와 2px 안에 겹친다.
 */

interface ShapeRecord {
  readonly id?: string;
  readonly closed?: boolean;
  readonly simple?: boolean;
  readonly vertices?: number;
  readonly sides?: number;
  readonly pegs?: unknown;
}

interface ObservationRecord {
  readonly mode?: string;
  readonly shapes?: ShapeRecord[];
  readonly targetsHit?: number[];
  readonly allTargetsHit?: number[];
  readonly squareOn?: string | null;
  readonly marked?: string[];
  readonly rightAngles?: string[];
  readonly [key: string]: unknown;
}

async function openEngine(page: Page, config?: unknown) {
  const query = config === undefined ? '' : `?config=${encodeURIComponent(JSON.stringify(config))}`;
  await page.goto(`/${query}#/sandbox/E09`);
  await expect(page.getByRole('heading', { name: '기하판' })).toBeVisible();
  const canvas = page.getByTestId('geo-canvas');
  await expect(canvas).toBeVisible();
  return { canvas, observation: page.getByTestId('observation') };
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

async function focusCanvas(canvas: Locator): Promise<void> {
  await canvas.focus();
  await expect(canvas).toBeFocused();
}

/** 검수용 스크린샷. 뷰포트마다 다른 파일로 남긴다(test-results/는 git 제외). */
async function capture(page: Page, name: string): Promise<void> {
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: `test-results/${name}-${test.info().project.name}.png`,
    fullPage: true,
  });
}

test('키보드만으로 못판에서 삼각형을 닫으면 꼭짓점 3개다', async ({ page }) => {
  const { canvas } = await openEngine(page);

  await focusCanvas(canvas);
  // (0,0) → (2,0) → (2,2) → 다시 (0,0)으로 닫는다.
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('Enter');

  await pollObservation(
    page,
    (current) => current.shapes?.[0]?.closed === true && current.shapes?.[0]?.vertices === 3,
  );
  const shape = (await readObservation(page)).shapes?.[0];
  expect(shape?.simple).toBe(true);
  expect(shape?.sides).toBe(3);
  // 기본 설정에서는 도형 이름을 쓰지 않는다.
  await expect(canvas).not.toContainText('삼각형');
  await capture(page, 'T100-geoboard');
});

test('꼭짓점을 눌러 다른 고무줄과 못을 공유하는 삼각형을 닫는다', async ({ page }) => {
  const { canvas } = await openEngine(page, {
    mode: 'geoboard',
    shapes: [
      [
        [0, 0],
        [2, 0],
        [0, 2],
      ],
    ],
  });

  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  if (!box) return;
  // 기본 5×5 판: 못 (i,j)는 논리 좌표 (100+200i, 100+200j) / 1000.
  const tap = async (i: number, j: number) => {
    await page.mouse.click(
      box.x + (box.width * (100 + 200 * i)) / 1000,
      box.y + (box.height * (100 + 200 * j)) / 1000,
    );
  };

  // (4,0) → (3,1) → (2,0)[이미 닫힌 삼각형의 꼭짓점] → (4,0)으로 닫는다.
  await tap(4, 0);
  await tap(3, 1);
  await tap(2, 0);
  await tap(4, 0);

  await pollObservation(
    page,
    (current) =>
      current.shapes?.length === 2 &&
      current.shapes[1]?.closed === true &&
      current.shapes[1]?.vertices === 3,
  );
  const shapes = (await readObservation(page)).shapes ?? [];
  expect(shapes[0]?.closed).toBe(true);
  expect(shapes[1]?.closed).toBe(true);
  expect(shapes[1]?.simple).toBe(true);
  expect(shapes[1]?.vertices).toBe(3);
});

test('construct에서 반직선 하나로 별 두 개를 맞힌다', async ({ page }) => {
  const { canvas } = await openEngine(page, {
    grid: 9,
    targets: [
      [0, 0],
      [1, 0],
      [4, 4],
    ],
  });
  await page.getByLabel('모드').selectOption('construct');
  await page.getByRole('button', { name: '반직선', exact: true }).click();
  await pollObservation(page, (current) => current.mode === 'construct');

  await focusCanvas(canvas);
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');

  await pollObservation(page, (current) => current.targetsHit?.length === 2);
  const observation = await readObservation(page);
  expect(observation.targetsHit).toEqual([1, 2]);
  expect(observation.allTargetsHit).toEqual([1, 2]);
  await expect(canvas.locator('[data-hit="true"]')).toHaveCount(2);
});

test('기울어진 직각에 직각삼각자를 대면 꼭 맞는다고 표시한다', async ({ page }) => {
  const { canvas } = await openEngine(page, {
    grid: 9,
    tools: ['segment', 'ray', 'line', 'set-square'],
    angles: [{ id: 'tilt', vertex: [4, 4], a: [6, 5], b: [3, 6] }],
  });
  await page.getByLabel('모드').selectOption('construct');
  await page.getByRole('button', { name: '직각삼각자', exact: true }).click();
  await pollObservation(page, (current) => current.mode === 'construct');

  const status = page.getByTestId('geo-square-status');
  await expect(status).not.toContainText('꼭 맞아요');

  const angle = page.getByRole('button', { name: '각 1', exact: true });
  await angle.focus();
  await expect(angle).toBeFocused();
  await page.keyboard.press('Enter');

  await pollObservation(page, (current) => current.squareOn === 'tilt');
  await expect(status).toContainText('꼭 맞아요');
  const observation = await readObservation(page);
  expect(observation.rightAngles).toEqual(['tilt']);
  // 삼각자는 학생이 댄 각에만 결과를 보인다.
  await expect(canvas.locator('[data-square="tilt"]')).toHaveCount(1);
  await capture(page, 'T100-construct');
});

test('힌트 겹쳐 보기의 straight-run svg가 본 캔버스와 2px 안에 겹친다', async ({ page }) => {
  const { canvas } = await openEngine(page);
  await focusCanvas(canvas);
  // 일직선 위에 못이 하나 섞인 오각형을 만든다.
  const keys = [
    'Enter',
    'ArrowRight',
    'Enter',
    'ArrowRight',
    'Enter',
    'ArrowDown',
    'ArrowDown',
    'Enter',
    'ArrowLeft',
    'ArrowLeft',
    'Enter',
    'ArrowUp',
    'ArrowUp',
    'Enter',
  ];
  for (const key of keys) await page.keyboard.press(key);
  await pollObservation(page, (current) => current.shapes?.[0]?.closed === true);

  await page.getByRole('button', { name: '힌트 겹쳐 보기' }).click();
  const overlay = page.locator('[data-overlay="straight-run"]');
  await expect(overlay).toBeVisible();
  await expect(overlay.locator('svg')).toHaveCount(1);
  await expect(overlay.locator('line')).not.toHaveCount(0);

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
      { message: 'straight-run 오버레이가 본 캔버스와 어긋납니다.' },
    )
    .toBeLessThanOrEqual(2);
});
