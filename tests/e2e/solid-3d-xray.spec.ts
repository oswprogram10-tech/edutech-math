import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

/**
 * E12 `xray` 모드 샌드박스 E2E(아이패드·크롬북·전자칠판).
 */

interface XrayObservationRecord {
  readonly mode?: string;
  readonly view?: { readonly yaw: number; readonly pitch: number };
  readonly xray?: boolean;
  readonly xrayUsed?: boolean;
  readonly visibleFaces?: readonly string[];
  readonly marked?: {
    readonly faces: readonly string[];
    readonly edges: readonly string[];
    readonly vertices: readonly string[];
  };
  readonly segments?: readonly string[];
  readonly sketch?: {
    readonly visibleMissing: number;
    readonly hiddenMissing: number;
    readonly hiddenSolid: number;
    readonly visibleDashed: number;
    readonly extra: number;
    readonly complete: boolean;
  } | null;
  readonly [key: string]: unknown;
}

async function openXray(page: Page, config?: Record<string, unknown>, stageFit = false) {
  const merged = { ...config };
  const query = `${stageFit ? '?stage=fit&' : '?'}config=${encodeURIComponent(JSON.stringify(merged))}`;
  await page.goto(`/${query}#/sandbox/E12`);
  await expect(page.getByRole('heading', { name: '3D 입체' })).toBeVisible();
  await page.getByLabel('모드').selectOption('xray');
  const stage = page.getByTestId('xray-stage');
  await expect(stage).toBeVisible();
  return { stage, observation: page.getByTestId('observation') };
}

async function readObservation(page: Page): Promise<XrayObservationRecord> {
  const text = await page.getByTestId('observation').textContent();
  return JSON.parse(text ?? '{}') as XrayObservationRecord;
}

async function pollObservation(
  page: Page,
  check: (obs: XrayObservationRecord) => boolean,
): Promise<void> {
  await expect.poll(async () => check(await readObservation(page))).toBe(true);
}

test('엑스레이를 켜면 data-hidden="true" 모서리 3개가 보인다', async ({ page }) => {
  await openXray(page);
  await expect(page.locator('[data-testid^="xray-edge-"][data-hidden="true"]')).toHaveCount(0);

  await page.getByTestId('xray-toggle').click();
  await pollObservation(page, (o) => o.xray === true && o.xrayUsed === true);

  await expect(page.locator('[data-testid^="xray-edge-"][data-hidden="true"]')).toHaveCount(3);
  await expect(page.getByTestId('xray-edge-x10')).toHaveAttribute('data-hidden', 'true');
  await expect(page.getByTestId('xray-edge-y00')).toHaveAttribute('data-hidden', 'true');
  await expect(page.getByTestId('xray-edge-z01')).toHaveAttribute('data-hidden', 'true');
});

test('↻을 두 번 누르면 visibleFaces가 바뀐다', async ({ page }) => {
  await openXray(page);
  const initial = await readObservation(page);
  expect(initial.visibleFaces).toEqual(['front', 'right', 'top']);

  await page.getByTestId('xray-turn-right').click();
  await page.getByTestId('xray-turn-right').click();

  await pollObservation(page, (o) => o.view?.yaw === 120);
  const rotated = await readObservation(page);
  expect(rotated.visibleFaces).not.toEqual(initial.visibleFaces);
  expect(rotated.visibleFaces).toEqual(['back', 'right', 'top']);
});

test('무대를 끌면 view가 바뀌고, 짧게 누르면 표시만 바뀐다', async ({ page }) => {
  const { stage }: { stage: Locator } = await openXray(page);
  const box = await stage.boundingBox();
  expect(box).not.toBeNull();
  if (!box) return;

  const cx = box.x + box.width * 0.5;
  const cy = box.y + box.height * 0.5;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx + 64, cy, { steps: 6 });
  await page.mouse.up();

  await pollObservation(page, (o) => o.view?.yaw !== 30);
  const afterDrag = await readObservation(page);
  expect(afterDrag.marked?.faces).toEqual([]);

  await page.getByTestId('xray-face-top').click();
  await pollObservation(page, (o) => (o.marked?.faces.length ?? 0) === 1);
  const afterTap = await readObservation(page);
  expect(afterTap.view).toEqual(afterDrag.view);
  expect(afterTap.marked?.faces).toEqual(['top']);
});

test('면 도구로 highlightFace:top의 맞은편(bottom)을 ⤓ 두 번 뒤 눌러 표시한다', async ({
  page,
}) => {
  await openXray(page, { highlightFace: 'top', tools: ['face'] });
  await expect(page.getByTestId('xray-highlight-legend')).toBeVisible();

  await page.getByTestId('xray-tilt-down').click();
  await page.getByTestId('xray-tilt-down').click();
  await pollObservation(page, (o) => Boolean(o.visibleFaces?.includes('bottom')));

  await page.getByTestId('xray-face-bottom').click();
  await pollObservation(page, (o) => o.marked?.faces[0] === 'bottom');
});

test('겨냥도 prefill:visible에서 숨은 모서리 3개를 점선으로 그리면 sketch.complete:true다', async ({
  page,
}) => {
  await openXray(page, {
    solid: { type: 'cuboid', w: 4, d: 3, h: 2 },
    sketch: { prefill: 'visible' },
  });
  await expect(page.getByTestId('xray-sketch')).toBeVisible();

  await page.getByTestId('xray-style-dashed').click();

  // x10: (3,3) - (11,3)
  await page.getByTestId('xray-dot-3-3').click();
  await page.getByTestId('xray-dot-11-3').click();

  // y00: (0,0) - (3,3)
  await page.getByTestId('xray-dot-0-0').click();
  await page.getByTestId('xray-dot-3-3').click();

  // z01: (3,3) - (3,7)
  await page.getByTestId('xray-dot-3-3').click();
  await page.getByTestId('xray-dot-3-7').click();

  await pollObservation(page, (o) => o.sketch?.complete === true);
});

test('키보드만으로 겨냥도에 숨은 모서리 하나를 그린다', async ({ page }) => {
  await openXray(page, {
    solid: { type: 'cuboid', w: 4, d: 3, h: 2 },
    sketch: { prefill: 'visible' },
  });
  const sketch = page.getByTestId('xray-sketch');
  await sketch.focus();
  await expect(sketch).toBeFocused();

  await page.keyboard.press('l');
  await page.keyboard.press('Enter'); // (0,0)
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('Enter'); // (3,3)

  await pollObservation(
    page,
    (o) => Boolean(o.segments?.includes('0,0-3,3:d')) && o.sketch?.hiddenMissing === 2,
  );
});

test('샌드박스 스냅샷(엑스레이 켠 무대 1장, 겨냥도 판 1장)', async ({ page }) => {
  await openXray(page, { xray: true, faceQuery: true });
  await page.getByTestId('xray-face-top').click();
  await page.getByTestId('xray-tool-edge').click();
  await page.getByTestId('xray-edge-x10').click();
  await pollObservation(
    page,
    (o) => o.marked?.faces.includes('top') === true && o.marked?.edges.includes('x10') === true,
  );

  await page.evaluate(async () => {
    await document.fonts.ready;
  });
  const view = page.getByTestId('xray-view');
  await expect(view).toHaveScreenshot('xray-stage-on.png', {
    maxDiffPixelRatio: 0.02,
    animations: 'disabled',
  });

  await openXray(page, {
    solid: { type: 'cuboid', w: 4, d: 3, h: 2 },
    sketch: { prefill: 'visible' },
  });
  await page.getByTestId('xray-style-dashed').click();
  await page.getByTestId('xray-dot-0-0').click();
  await page.getByTestId('xray-dot-3-3').click();
  await pollObservation(page, (o) => o.sketch?.hiddenMissing === 2);

  await page.evaluate(async () => {
    await document.fonts.ready;
  });
  await expect(page.getByTestId('xray-view')).toHaveScreenshot('xray-sketch.png', {
    maxDiffPixelRatio: 0.02,
    animations: 'disabled',
  });
});

test('크롬북 4×3×2 무대·겨냥도 크기 기준과 두 칸 배치 측정', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromebook', '크롬북 전용 측정');

  // 1. 4x3x2 무대 ?stage=fit
  await openXray(page, { solid: { type: 'cuboid', w: 4, d: 3, h: 2 } }, true);
  await expect(page.getByTestId('xray-stage')).toBeInViewport({ ratio: 1 });
  await expect(page.getByTestId('xray-tool-face')).toBeInViewport({ ratio: 1 });
  await expect(page.getByTestId('xray-tool-edge')).toBeInViewport({ ratio: 1 });
  await expect(page.getByTestId('xray-tool-vertex')).toBeInViewport({ ratio: 1 });
  await expect(page.getByTestId('xray-toggle')).toBeInViewport({ ratio: 1 });

  // 2. 4x3x2 겨냥도 ?stage=fit
  await openXray(
    page,
    { solid: { type: 'cuboid', w: 4, d: 3, h: 2 }, sketch: { prefill: 'visible' } },
    true,
  );
  const sketch = page.getByTestId('xray-sketch');
  const dotSpacing = Number(await sketch.getAttribute('data-dot-spacing'));
  expect(dotSpacing).toBeGreaterThanOrEqual(32);
  await expect(sketch).toBeInViewport({ ratio: 1 });
  await expect(page.getByTestId('xray-style-solid')).toBeInViewport({ ratio: 1 });
  await expect(page.getByTestId('xray-style-dashed')).toBeInViewport({ ratio: 1 });

  const fitView = await page.getByTestId('xray-view').boundingBox();
  const fitBoard = await page.locator('[class*="netBoardArea"]').boundingBox();
  const fitSketch = await sketch.boundingBox();

  // 3. 크롬북 두 칸 배치 폭(약 660px, content 판 세로 스크롤 허용) 측정 + 세로 배치 검증
  await page.setViewportSize({ width: 660, height: 680 });
  await openXray(
    page,
    { solid: { type: 'cuboid', w: 4, d: 3, h: 2 }, sketch: { prefill: 'visible' } },
    false,
  );
  await page.waitForTimeout(200);
  const twoColView = await page.getByTestId('xray-view').boundingBox();
  const twoColBoard = await page.locator('[class*="netBoardArea"]').boundingBox();
  const twoColSketch = await sketch.boundingBox();
  const twoColCompactStage = await page.getByTestId('xray-stage').boundingBox();
  const twoColCompactBox = await page.locator('[class*="panelBlock"]').first().boundingBox();
  const twoColSketchToolbar = await page
    .getByTestId('xray-style-solid')
    .locator('..')
    .boundingBox();
  const twoColSideStack = await page.locator('[class*="sideStack"]').boundingBox();
  const twoColSolidBtn = await page.getByTestId('xray-style-solid').boundingBox();
  const twoColStacked = await page.getByTestId('xray-view').getAttribute('data-sketch-stacked');
  const twoColHostMetrics = await page.locator('[class*="netGridHost"]').evaluate((el) => ({
    scrollWidth: el.scrollWidth,
    clientWidth: el.clientWidth,
  }));
  const twoColSpacing = Number(await sketch.getAttribute('data-dot-spacing'));

  console.log(
    `[E12 xray sketch 4x3x2 measure] sandboxFit: view=${JSON.stringify(fitView)} board=${JSON.stringify(fitBoard)} sketch=${JSON.stringify(fitSketch)} spacing=${dotSpacing}px | twoCol(660x680 content): stacked=${twoColStacked} view=${JSON.stringify(twoColView)} board=${JSON.stringify(twoColBoard)} sketch=${JSON.stringify(twoColSketch)} compactStage=${JSON.stringify(twoColCompactStage)} compactBox=${JSON.stringify(twoColCompactBox)} sketchToolbar=${JSON.stringify(twoColSketchToolbar)} sideStack=${JSON.stringify(twoColSideStack)} solidBtn=${JSON.stringify(twoColSolidBtn)} host=${JSON.stringify(twoColHostMetrics)} spacing=${twoColSpacing}px`,
  );

  expect(twoColStacked).toBe('true');
  expect(twoColHostMetrics.scrollWidth).toBeLessThanOrEqual(twoColHostMetrics.clientWidth);
  expect(twoColSpacing).toBeGreaterThanOrEqual(32);
  await expect(sketch).toBeInViewport({ ratio: 1 });
  const stageCompact = page.getByTestId('xray-stage');
  await stageCompact.scrollIntoViewIfNeeded();
  await expect(stageCompact).toBeInViewport({ ratio: 1 });
  for (const id of ['xray-style-solid', 'xray-style-dashed', 'xray-sketch-clear'] as const) {
    const btn = page.getByTestId(id);
    await btn.scrollIntoViewIfNeeded();
    await expect(btn).toBeInViewport({ ratio: 1 });
  }
});
