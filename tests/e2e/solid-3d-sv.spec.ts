import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

/**
 * E12 `surface-volume` 모드 샌드박스 E2E(아이패드·크롬북·전자칠판).
 * 넓이·부피·개수 결과는 관찰(JSON)에만 있고 화면에는 없다.
 */

interface SvObservation {
  readonly mode?: string;
  readonly variant?: string;
  readonly step?: string;
  readonly unfolded?: boolean;
  readonly painted?: readonly string[];
  readonly paintedCount?: number;
  readonly paintedArea?: number;
  readonly allPainted?: boolean;
  readonly surfaceArea?: number;
  readonly cubeCount?: number;
  readonly fullLayers?: number;
  readonly complete?: boolean;
  readonly volume?: number;
  readonly dims?: readonly number[];
  readonly logRows?: readonly { w: number; d: number; h: number; surface: number | null }[];
  readonly logDistinct?: number;
  readonly logCorrect?: readonly boolean[];
  readonly minSurfaceLogged?: boolean;
  readonly [key: string]: unknown;
}

async function openSv(page: Page, config?: Record<string, unknown>, stageFit = false) {
  const query = `${stageFit ? '?stage=fit&' : '?'}config=${encodeURIComponent(JSON.stringify({ mode: 'surface-volume', ...config }))}`;
  await page.goto(`/${query}#/sandbox/E12`);
  await expect(page.getByRole('heading', { name: '3D 입체' })).toBeVisible();
  await page.getByLabel('모드').selectOption('surface-volume');
  await expect(page.getByTestId('sv-view')).toBeVisible();
}

async function readObservation(page: Page): Promise<SvObservation> {
  const text = await page.getByTestId('observation').textContent();
  return JSON.parse(text ?? '{}') as SvObservation;
}

async function pollObservation(page: Page, check: (obs: SvObservation) => boolean): Promise<void> {
  await expect.poll(async () => check(await readObservation(page))).toBe(true);
}

const FACES = ['front', 'back', 'left', 'right', 'top', 'bottom'] as const;

async function paintAllFaces(page: Page) {
  await page.getByTestId('sv-step-unfold').click();
  await page.getByTestId('sv-unfold').click();
  await expect(page.getByTestId('sv-net-stage')).toBeVisible();
  await page.getByTestId('sv-step-paint').click();
  for (const face of FACES) await page.getByTestId(`sv-face-${face}`).click();
}

async function settle(page: Page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
}

test('4×3×2: 펼치기 → 6면 칠하기 → allPainted, 칠한 넓이는 관찰에만 있다', async ({ page }) => {
  await openSv(page);
  await expect(page.getByTestId('sv-box-stage')).toBeVisible();
  await expect(page.getByTestId('sv-box-length-w')).toHaveText('4cm');
  await page.getByTestId('sv-step-unfold').click();
  await expect(page.getByTestId('sv-net-stage')).toHaveCount(0);
  await page.getByTestId('sv-unfold').click();
  await pollObservation(page, (o) => o.unfolded === true && o.step === 'unfold');
  await page.getByTestId('sv-step-paint').click();
  for (const face of FACES) {
    await page.getByTestId(`sv-face-${face}`).click();
  }
  await pollObservation(page, (o) => o.allPainted === true);
  const obs = await readObservation(page);
  expect(obs.paintedArea).toBe(52);
  expect(obs.paintedCount).toBe(6);
  expect(obs.surfaceArea).toBe(52);
  for (const face of FACES) {
    await expect(page.getByTestId(`sv-face-${face}`)).toHaveAttribute('data-painted', 'true');
  }
  // 화면에는 넓이 결과가 없다
  const viewText = (await page.getByTestId('sv-view').textContent()) ?? '';
  expect(viewText).not.toMatch(/(^|\D)(52|26|24)(\D|$)/);
  await page.getByTestId('sv-clear-paint').click();
  await pollObservation(page, (o) => o.paintedCount === 0 && o.paintedArea === 0);
});

test('채우기 단계: 한 층 채우기 두 번 → complete, fullLayers 2', async ({ page }) => {
  await openSv(page);
  await page.getByTestId('sv-step-fill-voxels').click();
  await expect(page.getByTestId('sv-fill-stage')).toBeVisible();
  await page.getByTestId('sv-fill-layer').click();
  await pollObservation(page, (o) => o.fullLayers === 1 && o.complete === false);
  await page.getByTestId('sv-fill-layer').click();
  await pollObservation(page, (o) => o.fullLayers === 2 && o.complete === true);
  const obs = await readObservation(page);
  expect(obs.cubeCount).toBe(24);
  expect(obs.volume).toBe(24);
  const viewText = (await page.getByTestId('sv-view').textContent()) ?? '';
  expect(viewText).not.toMatch(/(^|\D)(24|12)(\D|$)/);
  await page.getByTestId('sv-clear-cubes').click();
  await pollObservation(page, (o) => o.cubeCount === 0);
});

test('키보드만으로 단계 이동·칸 놓기·층 채우기를 한다', async ({ page }) => {
  await openSv(page);
  await page.getByTestId('sv-step-rotate').focus();
  await page.keyboard.press('4');
  await expect(page.getByTestId('sv-fill-stage')).toBeVisible();
  await page.getByTestId('sv-cell-2-1').focus();
  await page.keyboard.press('Enter');
  await pollObservation(page, (o) => o.cubeCount === 1 && o.fullLayers === 0);
  await page.keyboard.press('l');
  await pollObservation(page, (o) => o.fullLayers === 1);
  await page.keyboard.press('PageDown');
  await pollObservation(page, (o) => o.layer === 0);
  await page.keyboard.press('3');
  await page.keyboard.press('u');
  await pollObservation(page, (o) => o.step === 'paint' && o.unfolded === true);
  await page.getByTestId('sv-face-top').focus();
  await page.keyboard.press('Enter');
  await pollObservation(page, (o) => o.paintedCount === 1);
});

test('돌리기 단추로 시점이 바뀐다', async ({ page }) => {
  await openSv(page);
  await expect(page.getByTestId('sv-box-stage')).toHaveAttribute('data-yaw', '30');
  await page.getByTestId('sv-turn-right').click();
  await expect(page.getByTestId('sv-box-stage')).toHaveAttribute('data-yaw', '75');
  await pollObservation(page, (o) => (o['view'] as { yaw: number } | undefined)?.yaw === 75);
});

test('fixed-volume 24: 1×1×24, 2×3×4 기록 → logDistinct 2, minSurfaceLogged', async ({ page }) => {
  await openSv(page, { variant: 'fixed-volume', volume: 24 });
  await expect(page.getByTestId('sv-box-stage')).toBeVisible();
  await expect(page.getByTestId('sv-height')).toHaveText('높이 24cm');
  await page.getByTestId('sv-log-add').click();
  await page.getByTestId('sv-w-2').click();
  await page.getByTestId('sv-d-3').click();
  await expect(page.getByTestId('sv-height')).toHaveText('높이 4cm');
  await page.getByTestId('sv-log-add').click();
  await pollObservation(page, (o) => o.logDistinct === 2);
  await page.getByTestId('sv-log-cell-0').fill('98');
  await page.getByTestId('sv-log-cell-1').fill('26');
  await pollObservation(page, (o) => o.logCorrect?.[0] === true && o.logCorrect?.[1] === false);
  expect((await readObservation(page)).minSurfaceLogged).toBe(false);
  await page.getByTestId('sv-log-cell-1').fill('52');
  await pollObservation(page, (o) => o.minSurfaceLogged === true);
  // 맞아도 화면에 알리지 않는다
  await expect(page.getByTestId('sv-log')).not.toContainText(/맞|정답|틀/);
  // 같은 상자는 다시 더할 수 없다
  await expect(page.getByTestId('sv-log-add')).toBeDisabled();
});

test('1×1×24 상자 그림이 판 안에 들어온다', async ({ page }) => {
  await openSv(page, { variant: 'fixed-volume', volume: 24 });
  const view = await page.getByTestId('sv-view').boundingBox();
  const stage = await page.getByTestId('sv-box-stage').boundingBox();
  expect(view).not.toBeNull();
  expect(stage).not.toBeNull();
  if (!view || !stage) return;
  expect(stage.x).toBeGreaterThanOrEqual(view.x - 0.5);
  expect(stage.y).toBeGreaterThanOrEqual(view.y - 0.5);
  expect(stage.x + stage.width).toBeLessThanOrEqual(view.x + view.width + 0.5);
  expect(stage.y + stage.height).toBeLessThanOrEqual(view.y + view.height + 0.5);
  expect(stage.height).toBeGreaterThan(stage.width);
  await expect(page.getByTestId('sv-box-stage')).toBeInViewport({ ratio: 1 });
});

test('샌드박스 스냅샷(칠한 전개도, 반쯤 채운 상자, fixed-volume 기록표)', async ({ page }) => {
  await openSv(page);
  await paintAllFaces(page);
  await pollObservation(page, (o) => o.allPainted === true);
  await settle(page);
  await expect(page.getByTestId('sv-view')).toHaveScreenshot('sv-painted-net.png', {
    maxDiffPixelRatio: 0.02,
    animations: 'disabled',
  });

  await openSv(page);
  await page.getByTestId('sv-step-fill-voxels').click();
  await page.getByTestId('sv-fill-layer').click();
  await page.getByTestId('sv-cell-0-0').click();
  await page.getByTestId('sv-cell-1-0').click();
  await pollObservation(page, (o) => o.fullLayers === 1 && o.cubeCount === 14);
  await settle(page);
  await expect(page.getByTestId('sv-view')).toHaveScreenshot('sv-half-filled.png', {
    maxDiffPixelRatio: 0.02,
    animations: 'disabled',
  });

  await openSv(page, { variant: 'fixed-volume', volume: 24 });
  await page.getByTestId('sv-log-add').click();
  await page.getByTestId('sv-w-2').click();
  await page.getByTestId('sv-d-3').click();
  await page.getByTestId('sv-log-add').click();
  await page.getByTestId('sv-log-cell-0').fill('98');
  await page.getByTestId('sv-log-cell-1').fill('52');
  await pollObservation(page, (o) => o.minSurfaceLogged === true);
  await page.getByTestId('sv-log-cell-1').blur();
  await settle(page);
  await expect(page.getByTestId('sv-view')).toHaveScreenshot('sv-fixed-log.png', {
    maxDiffPixelRatio: 0.02,
    animations: 'disabled',
  });
});

test('크롬북 ?stage=fit: 각 단계의 무대·주요 단추·표 첫 줄이 첫 화면에 다 들어온다', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'chromebook', '크롬북 전용 측정');

  await openSv(page, {}, true);
  const expectFit = async (ids: readonly string[]) => {
    for (const id of ids) {
      await expect(page.getByTestId(id), id).toBeInViewport({ ratio: 1 });
    }
  };
  const steps = [
    'sv-step-rotate',
    'sv-step-unfold',
    'sv-step-paint',
    'sv-step-fill-voxels',
  ] as const;

  // 1 돌려 보기
  await expectFit([
    ...steps,
    'sv-box-stage',
    'sv-turn-left',
    'sv-turn-right',
    'sv-tilt-up',
    'sv-tilt-down',
  ]);
  const fitView = await page.getByTestId('sv-view').boundingBox();
  const fitStage = await page.getByTestId('sv-box-stage').boundingBox();
  const fitSide = await page.locator('[class*="sideStack"]').boundingBox();

  // 2 펼치기
  await page.getByTestId('sv-step-unfold').click();
  await expectFit([...steps, 'sv-box-stage', 'sv-unfold']);
  await page.getByTestId('sv-unfold').click();
  await expectFit(['sv-net-stage', 'sv-unfold']);

  // 3 칠하기
  await page.getByTestId('sv-step-paint').click();
  await expectFit([
    'sv-net-stage',
    'sv-unfold',
    'sv-clear-paint',
    ...FACES.map((f) => `sv-face-${f}`),
  ]);
  await page.getByTestId('sv-face-front').click();
  await expectFit(['sv-clear-paint', 'sv-legend']);

  // 4 쌓기나무 채우기
  await page.getByTestId('sv-step-fill-voxels').click();
  await expectFit([
    'sv-fill-stage',
    'sv-layer-up',
    'sv-layer-down',
    'sv-layer-1',
    'sv-layer-2',
    'sv-fill-layer',
    'sv-clear-cubes',
    'sv-cell-0-0',
    'sv-cell-3-2',
  ]);

  // fixed-volume
  await openSv(page, { variant: 'fixed-volume', volume: 24 }, true);
  await expectFit(['sv-box-stage', 'sv-w-1', 'sv-w-24', 'sv-d-1', 'sv-log-add']);
  await page.getByTestId('sv-log-add').click();
  await expectFit(['sv-log-row-0', 'sv-log-cell-0', 'sv-log-remove-0']);
  await page.getByTestId('sv-w-2').click();
  await page.getByTestId('sv-d-3').click();
  await page.getByTestId('sv-log-add').click();
  await expectFit(['sv-log-row-1', 'sv-log-cell-1', 'sv-log-remove-1']);
  const fixedView = await page.getByTestId('sv-view').boundingBox();
  const fixedStage = await page.getByTestId('sv-box-stage').boundingBox();
  const fixedSide = await page.locator('[class*="sideStack"]').boundingBox();
  console.log(
    `[E12 sv measure] fit(1366x768): view=${JSON.stringify(fitView)} stage=${JSON.stringify(fitStage)} side=${JSON.stringify(fitSide)} | fixed: view=${JSON.stringify(fixedView)} stage=${JSON.stringify(fixedStage)} side=${JSON.stringify(fixedSide)}`,
  );
});

test('전체 기기 ?stage=fit: 단계 표시줄과 무대가 판 안에 있다', async ({ page }) => {
  await openSv(page, {}, true);
  for (const id of ['sv-step-rotate', 'sv-step-fill-voxels', 'sv-box-stage']) {
    await expect(page.getByTestId(id), id).toBeInViewport({ ratio: 0.99 });
  }
  const view = await page.getByTestId('sv-view').boundingBox();
  for (const id of ['sv-step-paint', 'sv-box-stage', 'sv-turn-left']) {
    const box = await page.getByTestId(id).boundingBox();
    expect(box).not.toBeNull();
    if (!box || !view) continue;
    expect(box.x + box.width).toBeLessThanOrEqual(view.x + view.width + 0.5);
  }
});
