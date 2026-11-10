import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

/**
 * T107 E11 칠교·원 조각 E2E.
 *
 * 아이패드(WebKit)·크롬북·전자칠판에서 키보드만으로 두 모드를 끝까지 조작하고,
 * 64px 터치 타깃·포인터 두 번 탭·힌트 오버레이 정렬을 확인한다.
 */

interface ObservationRecord {
  readonly mode?: string;
  readonly filled?: boolean;
  readonly overlap?: boolean;
  readonly sticksOut?: boolean;
  readonly fillPercent?: number;
  readonly outline?: { readonly kind?: string } | null;
  readonly alternating?: boolean;
  readonly arranged?: boolean;
  readonly arrangedDivisions?: number[];
  readonly divisions?: number;
  readonly [key: string]: unknown;
}

async function openEngine(page: Page, config?: unknown) {
  const query = config === undefined ? '' : `?config=${encodeURIComponent(JSON.stringify(config))}`;
  await page.goto(`/${query}#/sandbox/E11`);
  await expect(page.getByRole('heading', { name: '자르고 붙이기' })).toBeVisible();
  const canvas = page.getByTestId('cut-canvas');
  await expect(canvas).toBeVisible();
  return { canvas, observation: page.getByTestId('observation') };
}

async function selectMode(
  page: Page,
  mode: 'slice' | 'formula-derive' | 'angle-gather' | 'tangram' | 'circle-sectors',
) {
  await page.getByLabel('모드').selectOption(mode);
  await expect.poll(async () => (await readObservation(page)).mode).toBe(mode);
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

async function nextFrame(page: Page): Promise<void> {
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
}

async function capture(page: Page, name: string): Promise<void> {
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: `test-results/T107-${name}-${test.info().project.name}.png`,
    fullPage: true,
  });
}

/** 조각의 data-ax·data-ay가 목표가 될 때까지 방향키를 누른다. */
async function movePieceTo(page: Page, pieceId: string, ax: number, ay: number): Promise<void> {
  const piece = page.locator(`[data-piece="${pieceId}"]`);
  await piece.focus();
  await expect(piece).toBeFocused();
  for (let count = 0; count < 160; count += 1) {
    const currentX = Number(await piece.getAttribute('data-ax'));
    const currentY = Number(await piece.getAttribute('data-ay'));
    const dx = ax - currentX;
    const dy = ay - currentY;
    if (Math.abs(dx) < 0.001 && Math.abs(dy) < 0.001) return;
    const key =
      Math.abs(dx) >= Math.abs(dy)
        ? dx > 0
          ? 'ArrowRight'
          : 'ArrowLeft'
        : dy > 0
          ? 'ArrowDown'
          : 'ArrowUp';
    await page.keyboard.press(key);
    await nextFrame(page);
  }
  throw new Error(`조각 ${pieceId}를 (${ax}, ${ay})로 옮기지 못했습니다.`);
}

const SQUARE_CONFIG = {
  pieceSet: 'tangram',
  silhouette: 'square',
  pieces: [
    { kind: 'small-triangle', rot: 4 },
    { kind: 'small-triangle', rot: 0 },
  ],
};

test('tangram 64px 키보드: 두 작은 세모로 정사각형을 채운다', async ({ page }) => {
  const { canvas } = await openEngine(page, SQUARE_CONFIG);

  const touchButton = page.getByRole('button', { name: '터치 48px' });
  await touchButton.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: '터치 64px' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.locator('[data-target-size="64"]')).toBeVisible();

  await selectMode(page, 'tangram');

  // 64px 터치 타깃: 조각마다 보이지 않는 원의 지름이 64px 이상이다.
  const hitTarget = page.locator('[data-piece="p1"] circle[data-hit-target]');
  await expect
    .poll(async () => (await hitTarget.boundingBox())?.width ?? 0)
    .toBeGreaterThanOrEqual(63.9);

  await movePieceTo(page, 'p1', 4, 3);
  await movePieceTo(page, 'p2', 2, 3);

  await pollObservation(page, (current) => current.filled === true);
  const observation = await readObservation(page);
  expect(observation.overlap).toBe(false);
  expect(observation.sticksOut).toBe(false);
  expect(observation.fillPercent).toBe(100);
  expect(observation.outline?.kind).toBe('square');
  await expect(page.getByTestId('silhouette-picture')).toBeVisible();
  await expect(canvas).toHaveAttribute('data-filled', 'true');
  await capture(page, 'tangram-keyboard');
});

test('tangram 포인터: 조각을 두 번 탭하면 45° 돈다', async ({ page }) => {
  const { canvas } = await openEngine(page, SQUARE_CONFIG);
  await selectMode(page, 'tangram');

  const piece = page.locator('[data-piece="p1"]');
  await expect(piece).toHaveAttribute('data-rot', '180');
  const target = page.locator('[data-piece="p1"] circle[data-hit-target]');
  const box = await target.boundingBox();
  expect(box).not.toBeNull();
  if (!box) return;
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.dblclick(x, y);
  await expect(piece).toHaveAttribute('data-rot', '225');
  await capture(page, 'tangram-pointer-turn');
  await expect(canvas).toBeVisible();
});

test('circle-sectors 키보드: 8칸을 엇갈려 놓고 16칸을 자동 배열한다', async ({ page }) => {
  const { canvas } = await openEngine(page, {});
  await selectMode(page, 'circle-sectors');

  for (let sector = 0; sector < 8; sector += 1) {
    const slice = page.getByRole('button', { name: `조각 ${sector + 1}`, exact: true });
    await slice.focus();
    await expect(slice).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(canvas).toHaveAttribute('data-held-arc-up', 'true');
    for (let step = 0; step < sector; step += 1) {
      await page.keyboard.press('ArrowRight');
      await nextFrame(page);
    }
    await expect(canvas).toHaveAttribute('data-slot-cursor', String(sector));
    if (sector % 2 === 1) {
      await page.keyboard.press('R');
      await expect(canvas).toHaveAttribute('data-held-arc-up', 'false');
    }
    await page.keyboard.press('Enter');
    await nextFrame(page);
  }

  await pollObservation(
    page,
    (current) => current.alternating === true && current.arranged === true,
  );
  const observation = await readObservation(page);
  expect(observation.arrangedDivisions).toContain(8);
  await capture(page, 'circle-manual');

  const more = page.getByRole('button', { name: '더 잘게 나누기' });
  await more.focus();
  await page.keyboard.press('Enter');
  await expect(canvas).toHaveAttribute('data-divisions', '16');
  await expect(canvas).toHaveAttribute('data-phase', 'auto');

  const auto = page.getByRole('button', { name: '자동으로 붙이기' });
  await auto.focus();
  await page.keyboard.press('Enter');
  await pollObservation(page, (current) => current.arrangedDivisions?.includes(16) === true);
  await expect(canvas).toHaveAttribute('data-arranged', 'true');
  await capture(page, 'circle-auto');
});

test('힌트 겹쳐 보기의 work-outline svg가 본 캔버스와 2px 안에 겹친다', async ({ page }) => {
  test.skip(
    test.info().project.name !== 'chromebook',
    '오버레이 정렬은 크롬북에서 확인한다(카드 T107).',
  );
  const { canvas } = await openEngine(page, {});
  await selectMode(page, 'tangram');

  const hint = page.getByRole('button', { name: '힌트 겹쳐 보기' });
  await hint.focus();
  await page.keyboard.press('Enter');

  const overlay = page.locator('[data-overlay="work-outline"]');
  await expect(overlay).toBeVisible();
  await expect(overlay.locator('svg')).toHaveCount(1);
  await expect(overlay.locator('polygon')).not.toHaveCount(0);

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
      { message: 'work-outline 오버레이가 본 캔버스와 어긋납니다.' },
    )
    .toBeLessThanOrEqual(2);

  await capture(page, 'overlay');
});
