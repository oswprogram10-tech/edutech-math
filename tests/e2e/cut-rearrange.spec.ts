import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

/**
 * T106 E11 자르고 붙이기 샌드박스 E2E.
 *
 * 아이패드(WebKit)·크롬북·전자칠판 뷰포트에서 키보드만으로 세 모드를 끝까지
 * 조작한다. 기본 평행사변형을 잘라 직사각형으로, 삼각형을 복제·경첩해
 * 평행사변형으로, 꼭짓점을 잘라 한 점에 모아 180°를 확인한다.
 * 힌트 ② `work-outline` 오버레이가 본 캔버스와 2px 안에 겹치는지도 본다.
 */

interface ObservationRecord {
  readonly mode?: string;
  readonly phase?: string;
  readonly pieces?: { readonly id?: string; readonly vertices?: number; readonly area?: string }[];
  readonly totalArea?: string;
  readonly areaRatio?: string;
  readonly outline?: {
    readonly kind?: string;
    readonly width?: string;
    readonly height?: string;
  } | null;
  readonly toolsUsed?: string[];
  readonly vertices?: string[];
  readonly fan?: string;
  readonly gatheredSum?: number | null;
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

async function selectMode(page: Page, mode: 'slice' | 'formula-derive' | 'angle-gather') {
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

async function focusCanvas(canvas: Locator): Promise<void> {
  await canvas.focus();
  await expect(canvas).toBeFocused();
}

async function nextFrame(page: Page): Promise<void> {
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
}

/** 목표 속성값이 될 때까지 키를 누른다. 초기 후보 번호를 가정하지 않는다. */
async function pressUntilAttribute(
  page: Page,
  canvas: Locator,
  attribute: string,
  value: string,
  key: string,
  max = 40,
): Promise<void> {
  for (let count = 0; count < max; count += 1) {
    if ((await canvas.getAttribute(attribute)) === value) return;
    await page.keyboard.press(key);
    await nextFrame(page);
  }
  expect(await canvas.getAttribute(attribute)).toBe(value);
}

async function pressTimes(page: Page, key: string, count: number): Promise<void> {
  for (let index = 0; index < count; index += 1) {
    await page.keyboard.press(key);
    await nextFrame(page);
  }
}

async function focusedPiece(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    const active = document.activeElement;
    return active instanceof Element ? active.getAttribute('data-piece') : null;
  });
}

async function capture(page: Page, name: string): Promise<void> {
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: `test-results/${name}-${test.info().project.name}.png`,
    fullPage: true,
  });
}

test('formula-derive 기본: 키보드로 잘라 옮겨 6×4 직사각형을 만든다', async ({ page }) => {
  const { canvas } = await openEngine(page);
  await selectMode(page, 'formula-derive');

  await focusCanvas(canvas);
  await page.keyboard.press('c');
  await expect(canvas).toHaveAttribute('data-cut-cursor', /.*/);
  await pressUntilAttribute(page, canvas, 'data-cut-cursor', '4,2', 'ArrowRight');
  await page.keyboard.press('Enter');
  await pressUntilAttribute(page, canvas, 'data-cut-cursor', '4,6', 'ArrowRight');
  await page.keyboard.press('Enter');

  await pollObservation(page, (current) => current.pieces?.length === 2);
  const cutObservation = await readObservation(page);
  expect(cutObservation.pieces?.[0]?.vertices).toBe(3);
  expect(cutObservation.pieces?.[0]?.area).toBe('4');
  expect(cutObservation.pieces?.[1]?.area).toBe('20');

  // 자르기 효과가 캔버스로 초점을 돌려놓는다. Tab 한 번이면 첫 조각이다.
  await focusCanvas(canvas);
  await page.keyboard.press('Tab');
  await expect.poll(async () => focusedPiece(page)).toBe(cutObservation.pieces?.[0]?.id);

  await pressTimes(page, 'ArrowRight', 6);
  await pollObservation(
    page,
    (current) =>
      current.outline?.kind === 'rectangle' &&
      current.outline.width === '6' &&
      current.outline.height === '4' &&
      current.totalArea === '24',
  );

  const observation = await readObservation(page);
  expect(observation.outline?.kind).toBe('rectangle');
  expect(observation.totalArea).toBe('24');
  expect(observation.toolsUsed).toEqual(expect.arrayContaining(['scissors', 'move']));
  await capture(page, 'T106-formula-cut');
});

test('formula-derive 삼각형: 복제·경첩·이동으로 평행사변형을 만든다', async ({ page }) => {
  const { canvas } = await openEngine(page, { shape: { type: 'triangle' } });
  await selectMode(page, 'formula-derive');

  const first = page.locator('[data-piece="p1"]');
  await first.focus();
  await expect(first).toBeFocused();
  await page.keyboard.press('d');
  const copy = page.locator('[data-piece="p2"]');
  await expect(copy).toHaveAttribute('data-copy', 'true');

  await copy.focus();
  await page.keyboard.press('h');
  await expect(canvas).toHaveAttribute('data-hinge-cursor', /.*/);
  await pressUntilAttribute(page, canvas, 'data-hinge-cursor', '14,4', 'ArrowRight');
  await page.keyboard.press('Enter');

  await pollObservation(page, (current) => current.toolsUsed?.includes('hinge180') === true);
  await copy.focus();
  await pressTimes(page, 'ArrowLeft', 8);
  await pollObservation(
    page,
    (current) => current.outline?.kind === 'parallelogram' && current.areaRatio === '2',
  );

  const observation = await readObservation(page);
  expect(observation.outline?.kind).toBe('parallelogram');
  expect(observation.areaRatio).toBe('2');
  expect(observation.toolsUsed).toEqual(expect.arrayContaining(['duplicate', 'hinge180']));
  await capture(page, 'T106-triangle-hinge');
});

async function runAngleFlow(page: Page, canvas: Locator): Promise<void> {
  const firstVertex = page.getByRole('button', { name: '1번 꼭짓점', exact: true });
  await firstVertex.focus();
  await expect(firstVertex).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await pollObservation(page, (current) => current.vertices?.includes('2,10') === true);

  const cutButton = page.getByRole('button', { name: '꼭짓점 자르기', exact: true });
  await cutButton.focus();
  await page.keyboard.press('Enter');
  await expect(canvas).toHaveAttribute('data-phase', 'cut');

  for (const label of ['1번 각 조각', '2번 각 조각', '3번 각 조각']) {
    const corner = page.getByRole('button', { name: label, exact: true });
    await corner.focus();
    await expect(corner).toBeFocused();
    await page.keyboard.press('Enter');
    await nextFrame(page);
  }

  await pollObservation(
    page,
    (current) => current.fan === 'straight' && current.gatheredSum === 180,
  );
}

test('angle-gather 기본: 꼭짓점을 옮기고 세 각을 모으면 180°다', async ({ page }) => {
  const { canvas } = await openEngine(page, {});
  await selectMode(page, 'angle-gather');
  await runAngleFlow(page, canvas);

  const observation = await readObservation(page);
  expect(observation.fan).toBe('straight');
  expect(observation.gatheredSum).toBe(180);
  // 기본 showSum: never에서는 화면에 각도 숫자가 없다.
  await expect(canvas).not.toContainText('180');
  await expect(canvas).not.toContainText('°');
  await capture(page, 'T106-angle-gather');
});

test('angle-gather showSum: after-gather이면 다 모은 뒤 180°가 보인다', async ({ page }) => {
  const { canvas } = await openEngine(page, { showSum: 'after-gather' });
  await selectMode(page, 'angle-gather');
  await runAngleFlow(page, canvas);
  await expect(page.getByTestId('angle-sum')).toContainText('180°');
  await capture(page, 'T106-angle-sum');
});

test('힌트 겹쳐 보기의 work-outline svg가 본 캔버스와 2px 안에 겹친다', async ({ page }) => {
  test.skip(
    test.info().project.name !== 'chromebook',
    '오버레이 정렬은 크롬북에서 확인한다(카드 T106).',
  );
  const { canvas } = await openEngine(page);
  await selectMode(page, 'formula-derive');

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

  await capture(page, 'T106-overlay');
});
