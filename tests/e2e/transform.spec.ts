import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

/**
 * E10 도형 이동 샌드박스 E2E. 아이패드(WebKit)·크롬북·전자칠판 뷰포트에서 모두 돈다.
 *
 * - slide-flip-turn은 키보드만으로 R·방향키·Backspace를 쓴다.
 * - predict는 결과 칸을 먼저 칠하고 Tab으로 확인 버튼에 간다.
 * - 두 번 이동 목표를 방향키와 R로 만든다.
 * - 줄인 움직임이면 애니메이션 표시가 없다.
 * - 힌트 ② pin-arcs가 본 캔버스와 2px 안에 겹친다.
 */

interface ObservationRecord {
  readonly mode?: string;
  readonly orientation?: string;
  readonly moveCount?: number;
  readonly moveCounts?: number;
  readonly atTarget?: boolean;
  readonly hasTarget?: boolean;
  readonly blockedCount?: number;
  readonly matches?: boolean;
  readonly confirmed?: boolean;
  readonly paintedCount?: number;
  readonly [key: string]: unknown;
}

async function openEngine(page: Page, config?: unknown) {
  const query = config === undefined ? '' : `?config=${encodeURIComponent(JSON.stringify(config))}`;
  await page.goto(`/${query}#/sandbox/E10`);
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

async function focusCanvas(canvas: Locator): Promise<void> {
  await canvas.focus();
  await expect(canvas).toBeFocused();
}

/** 검수용 스크린샷. 뷰포트마다 다른 파일로 남긴다(test-results/는 git 제외). */
async function capture(page: Page, name: string): Promise<void> {
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: `test-results/T104-${name}-${test.info().project.name}.png`,
    fullPage: true,
  });
}

test('키보드만으로 R·방향키·Backspace를 쓴다', async ({ page }) => {
  const { canvas } = await openEngine(page);
  await focusCanvas(canvas);

  await page.keyboard.press('r');
  await pollObservation(page, (current) => current.orientation === 'cw90');

  for (let count = 0; count < 3; count += 1) await page.keyboard.press('ArrowRight');
  await pollObservation(page, (current) => current.moveCount === 2);

  await page.keyboard.press('Backspace');
  await pollObservation(page, (current) => current.moveCount === 1);
  await expect(canvas.locator('[data-figure]')).toHaveCount(1);
  await capture(page, 'slide');
});

test('키보드로 결과 칸 7개를 칠하고 확인하면 결과가 겹친다', async ({ page }) => {
  const { canvas } = await openEngine(page, {
    at: [1, 1],
    operation: { type: 'slide', direction: 'right', cells: 5 },
  });
  await page.getByLabel('모드').selectOption('predict');
  await pollObservation(page, (current) => current.mode === 'predict');
  await focusCanvas(canvas);

  // 시작 커서는 시작 도형 상자의 왼쪽 위 칸 (1,1)이다.
  const keys = [
    'ArrowRight',
    'ArrowRight',
    'ArrowRight',
    'ArrowRight',
    'ArrowRight',
    'Enter',
    'ArrowRight',
    'Enter',
    'ArrowRight',
    'Enter',
    'ArrowLeft',
    'ArrowLeft',
    'ArrowDown',
    'Enter',
    'ArrowRight',
    'Enter',
    'ArrowLeft',
    'ArrowDown',
    'Enter',
    'ArrowDown',
    'Enter',
  ];
  for (const key of keys) await page.keyboard.press(key);

  await pollObservation(page, (current) => current.paintedCount === 7 && current.matches === true);
  await expect(canvas.locator('[data-painted]')).toHaveCount(7);
  await expect(canvas.locator('[data-result]')).toHaveCount(0);
  await expect(canvas.locator('[data-arc]')).toHaveCount(0);

  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: '확인', exact: true })).toBeFocused();
  await page.keyboard.press('Enter');

  await pollObservation(page, (current) => current.confirmed === true && current.matches === true);
  await expect(canvas.locator('[data-result]')).toHaveCount(1);
  await capture(page, 'predict');
});

test('predict는 첫 움직임이 돌리기일 때만 확인 전 중심을 보여 준다', async ({ page }) => {
  const turn = { type: 'turn', direction: 'cw', angle: 90, center: 'vertex-A' };
  const slide = { type: 'slide', direction: 'right', cells: 1 };

  const firstSlide = await openEngine(page, { at: [1, 1], operation: [slide, turn] });
  await page.getByLabel('모드').selectOption('predict');
  await pollObservation(page, (current) => current.mode === 'predict');
  await expect(firstSlide.canvas.locator('[data-pin]')).toHaveCount(0);

  const firstTurn = await openEngine(page, { at: [1, 1], operation: [turn, slide] });
  await page.getByLabel('모드').selectOption('predict');
  await pollObservation(page, (current) => current.mode === 'predict');
  await expect(firstTurn.canvas.locator('[data-pin]')).toHaveCount(1);
});

test('두 번 이동 목표를 방향키와 R로 만든다', async ({ page }) => {
  const { canvas } = await openEngine(page, {
    at: [1, 1],
    target: { orientation: 'cw90', at: [2, 3] },
  });
  await focusCanvas(canvas);

  for (let count = 0; count < 5; count += 1) await page.keyboard.press('ArrowRight');
  for (let count = 0; count < 2; count += 1) await page.keyboard.press('ArrowDown');
  await expect(canvas.locator('[data-target]')).toHaveCount(1);
  await page.keyboard.press('r');

  await pollObservation(page, (current) => current.atTarget === true && current.moveCount === 2);
  await expect(page.getByTestId('transform-status')).toContainText('딱 맞아요');
  await capture(page, 'target');
});

test('줄인 움직임이면 이동 직후 애니메이션 표시가 없다', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const { canvas } = await openEngine(page);
  await focusCanvas(canvas);
  await page.keyboard.press('r');
  await pollObservation(page, (current) => current.orientation === 'cw90');
  await expect(canvas).toHaveAttribute('data-motion', 'reduced');
  await expect(canvas.locator('[data-animating="true"]')).toHaveCount(0);
});

test('힌트 겹쳐 보기의 pin-arcs svg가 본 캔버스와 2px 안에 겹친다', async ({ page }) => {
  const { canvas } = await openEngine(page);
  await focusCanvas(canvas);
  await page.keyboard.press('r');
  await pollObservation(page, (current) => current.orientation === 'cw90');

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
  await capture(page, 'overlay');
});
