import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

/**
 * T105 E10 확장 모드 E2E. 아이패드(WebKit)·크롬북·전자칠판 뷰포트에서 모두 돈다.
 *
 * - tessellation: 정사각 타일 9개로 18×18 틀을 정확히 채운다(키보드).
 * - tessellation: 정오각형 세 개를 한 꼭짓점 둘레에 놓으면 36° 빈틈이 보인다.
 * - line-symmetry: 접는 축이 맞으면 마지막 접기가 참, 어긋나면 빈틈 무늬가 보인다.
 * - point-symmetry: 압정을 꽂고 180° 돌려 중심을 찾으면 중심 표시가 보인다.
 * - congruence: C·R·방향키만으로 고정 도형에 포개면 대응 표시가 보인다.
 * - 힌트 ② pin-arcs가 본 캔버스와 2px 안에 겹친다.
 */

interface ObservationRecord {
  readonly mode?: string;
  readonly tile?: string;
  readonly coverage?: string;
  readonly gapCells?: number;
  readonly pentagon?: { readonly gapDegrees?: number };
  readonly lastFold?: { readonly ok?: boolean } | null;
  readonly centerFound?: readonly string[];
  readonly overlaps?: boolean;
  readonly overlapped?: boolean;
  readonly [key: string]: unknown;
}

async function openEngine(page: Page) {
  await page.goto('/#/sandbox/E10');
  await expect(page.getByRole('heading', { name: '도형 이동' })).toBeVisible();
  const canvas = page.getByTestId('transform-canvas');
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

async function chooseMode(page: Page, mode: string): Promise<void> {
  await page.getByLabel('모드').selectOption(mode);
  await pollObservation(page, (current) => current.mode === mode);
}

async function focusCanvas(canvas: Locator): Promise<void> {
  await canvas.focus();
  await expect(canvas).toBeFocused();
}

async function pressKeys(page: Page, keys: readonly string[]): Promise<void> {
  for (const key of keys) await page.keyboard.press(key);
}

/** 검수용 스크린샷. 뷰포트마다 다른 파일로 남긴다(test-results/는 git 제외). */
async function capture(page: Page, name: string): Promise<void> {
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: `test-results/T105-${name}-${test.info().project.name}.png`,
    fullPage: true,
  });
}

test('쪽매맞춤 키보드: 정사각 타일 9개로 틀을 정확히 채운다', async ({ page }) => {
  const { canvas } = await openEngine(page);
  await chooseMode(page, 'tessellation');
  await focusCanvas(canvas);

  await pressKeys(page, [
    'Enter',
    'ArrowRight',
    'Enter',
    'ArrowRight',
    'Enter',
    'ArrowDown',
    'Enter',
    'ArrowLeft',
    'Enter',
    'ArrowLeft',
    'Enter',
    'ArrowDown',
    'Enter',
    'ArrowRight',
    'Enter',
    'ArrowRight',
    'Enter',
  ]);

  await pollObservation(page, (current) => current.coverage === '1' && current.gapCells === 0);
  await expect(canvas.locator('[data-placed-tile]')).toHaveCount(9 * 36);
  await expect(canvas.locator('[data-gap-cell]')).toHaveCount(0);
  await capture(page, 'tessellation-square');
});

test('쪽매맞춤 정오각형: 세 개를 놓으면 36° 빈틈이 드러난다', async ({ page }) => {
  const { canvas } = await openEngine(page);
  await chooseMode(page, 'tessellation');
  await page.getByRole('button', { name: '정오각형', exact: true }).click();
  await pollObservation(page, (current) => current.tile === 'pentagon-regular');
  await focusCanvas(canvas);

  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');

  await pollObservation(page, (current) => (current.pentagon?.gapDegrees ?? 0) === 36);
  await expect(canvas.locator('[data-gap-cell]')).toHaveCount(1);
  await capture(page, 'tessellation-pentagon');
});

test('선대칭: 축이 맞으면 접기가 참, 어긋나면 빈틈이 보인다', async ({ page }) => {
  const { canvas } = await openEngine(page);
  await chooseMode(page, 'line-symmetry');
  await focusCanvas(canvas);

  // 시작 커서는 (4,0)이다. (4,8)까지 내려 축을 긋고 접는다.
  await page.keyboard.press('Enter');
  await pressKeys(
    page,
    Array.from({ length: 8 }, () => 'ArrowDown'),
  );
  await page.keyboard.press('Enter');
  await page.keyboard.press('f');

  await pollObservation(page, (current) => current.lastFold?.ok === true);
  await expect(canvas.locator('[data-axis-found]')).toHaveCount(1);
  await expect(canvas.locator('[data-fold-gap]')).toHaveCount(0);
  await capture(page, 'line-axis');

  // 어긋나는 축 (2,3)-(6,5)를 그어 접으면 빈틈 무늬가 나타난다.
  await pressKeys(page, ['ArrowLeft', 'ArrowLeft']);
  await pressKeys(
    page,
    Array.from({ length: 5 }, () => 'ArrowUp'),
  );
  await page.keyboard.press('Enter');
  await pressKeys(
    page,
    Array.from({ length: 4 }, () => 'ArrowRight'),
  );
  await pressKeys(page, ['ArrowDown', 'ArrowDown']);
  await page.keyboard.press('Enter');
  await page.keyboard.press('f');

  await pollObservation(page, (current) => current.lastFold?.ok === false);
  await expect(canvas.locator('[data-fold-gap]')).toHaveCount(1);
  await capture(page, 'line-gap');
});

test('점대칭: 압정을 꽂고 180° 돌리면 대칭의 중심이 보인다', async ({ page }) => {
  const { canvas } = await openEngine(page);
  await chooseMode(page, 'point-symmetry');
  await focusCanvas(canvas);

  // 시작 커서는 두 배 좌표 (9,9)이다. 왼쪽 한 번이면 평행사변형 중심 (8,9)이다.
  await pressKeys(page, ['ArrowLeft', 'Enter', 't']);

  await pollObservation(
    page,
    (current) =>
      current.overlaps === true &&
      Array.isArray(current.centerFound) &&
      current.centerFound.includes('parallelogram'),
  );
  await expect(canvas.locator('[data-center-mark]')).toHaveCount(1);
  await expect(canvas.locator('[data-bisect]')).not.toHaveCount(0);
  await capture(page, 'point-center');
});

test('합동: C·R·방향키만으로 고정 도형에 포갠다', async ({ page }) => {
  const { canvas } = await openEngine(page);
  await chooseMode(page, 'congruence');
  await focusCanvas(canvas);

  await pressKeys(page, ['c', 'c', 'r', 'ArrowRight', 'ArrowUp', 'ArrowUp']);

  await pollObservation(page, (current) => current.overlapped === true);
  await expect(canvas.locator('[data-corr]')).not.toHaveCount(0);
  await capture(page, 'congruence');
});

test('힌트 겹쳐 보기의 pin-arcs svg가 본 캔버스와 2px 안에 겹친다', async ({ page }) => {
  const { canvas } = await openEngine(page);
  await chooseMode(page, 'point-symmetry');
  await focusCanvas(canvas);
  await pressKeys(page, ['ArrowLeft', 'Enter', 't']);
  await pollObservation(page, (current) => current.overlaps === true);

  await page.getByRole('button', { name: '힌트 겹쳐 보기' }).click();
  const overlay = page.locator('[data-overlay="pin-arcs"]');
  await expect(overlay).toBeVisible();
  await expect(overlay.locator('svg')).toHaveCount(1);
  await expect(overlay.locator('path')).not.toHaveCount(0);

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
      { message: 'pin-arcs 오버레이가 본 캔버스와 어긋납니다.' },
    )
    .toBeLessThanOrEqual(2);
  await capture(page, 'point-overlay');
});
