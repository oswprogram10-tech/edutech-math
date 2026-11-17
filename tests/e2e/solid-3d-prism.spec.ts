import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

/**
 * E12 `prism-pyramid` 모드 샌드박스 E2E(아이패드·크롬북·전자칠판).
 */

interface PrismObservationRecord {
  readonly mode?: string;
  readonly sides?: number;
  readonly height?: number;
  readonly top?: string;
  readonly kind?: string;
  readonly orientation?: string;
  readonly xray?: boolean;
  readonly apexPlayed?: boolean;
  readonly trueCount?: {
    readonly face: number;
    readonly edge: number;
    readonly vertex: number;
  } | null;
  readonly marked?: {
    readonly faces: readonly string[];
    readonly edges: readonly string[];
    readonly vertices: readonly string[];
  };
  readonly table?: readonly {
    readonly kind: string;
    readonly n: number;
    readonly faces: number | null;
    readonly edges: number | null;
    readonly vertices: number | null;
  }[];
  readonly tableCorrect?: readonly boolean[];
  readonly [key: string]: unknown;
}

async function openPrism(page: Page, config?: Record<string, unknown>, stageFit = false) {
  const query = `${stageFit ? '?stage=fit&' : '?'}config=${encodeURIComponent(JSON.stringify({ ...config }))}`;
  await page.goto(`/${query}#/sandbox/E12`);
  await expect(page.getByRole('heading', { name: '3D 입체' })).toBeVisible();
  await page.getByLabel('모드').selectOption('prism-pyramid');
  await expect(page.getByTestId('prism-stage')).toBeVisible();
}

async function readObservation(page: Page): Promise<PrismObservationRecord> {
  const text = await page.getByTestId('observation').textContent();
  return JSON.parse(text ?? '{}') as PrismObservationRecord;
}

async function pollObservation(
  page: Page,
  check: (obs: PrismObservationRecord) => boolean,
): Promise<void> {
  await expect.poll(async () => check(await readObservation(page))).toBe(true);
}

/** 밀어 올리기 손잡이를 트랙 위에서 끌어 높이 단계 h에 맞춘다. */
async function dragExtrudeTo(page: Page, step: number) {
  const track = await page.getByTestId('prism-extrude-track').boundingBox();
  const handle = await page.getByTestId('prism-extrude').boundingBox();
  expect(track).not.toBeNull();
  expect(handle).not.toBeNull();
  if (!track || !handle) return;
  const startX = handle.x + handle.width / 2;
  const startY = handle.y + handle.height / 2;
  // 트랙 안에서 손잡이 중심이 움직이는 범위: 위 끝(높이 4) ~ 아래 끝(높이 0)
  const topY = track.y + 24;
  const bottomY = track.y + track.height - 24;
  const targetY = bottomY - ((bottomY - topY) * step) / 4;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX, (startY + targetY) / 2, { steps: 4 });
  await page.mouse.move(startX, targetY, { steps: 4 });
  await page.mouse.up();
}

test('n=5로 바꾸고 밀어 올리기를 끌면 오각기둥이고 참 개수가 관찰에 있다', async ({ page }) => {
  await openPrism(page);
  await page.getByTestId('prism-sides-inc').click();
  await page.getByTestId('prism-sides-inc').click();
  await expect(page.getByTestId('prism-name')).toHaveText('오각형');

  await dragExtrudeTo(page, 2);
  await expect(page.getByTestId('prism-name')).toHaveText('오각기둥');
  await pollObservation(page, (o) => o.kind === 'prism' && o.sides === 5 && o.height === 2);
  const obs = await readObservation(page);
  expect(obs.trueCount).toEqual({ face: 7, edge: 15, vertex: 10 });

  // 화면에는 개수 문구가 없다(관찰 영역 밖)
  const viewText = (await page.getByTestId('prism-view').textContent()) ?? '';
  expect(viewText).not.toMatch(/면 7|모서리 15|꼭짓점 10/);
});

test('한 점으로 모으기를 켜면 오각뿔이 된다', async ({ page }) => {
  await openPrism(page, { initial: { sides: 5, height: 2 } });
  await expect(page.getByTestId('prism-name')).toHaveText('오각기둥');
  await page.getByTestId('prism-apex').click();
  await expect(page.getByTestId('prism-name')).toHaveText('오각뿔');
  await expect(page.getByTestId('prism-vertex-apex')).toHaveAttribute('data-hidden', 'false');
  await pollObservation(page, (o) => o.kind === 'pyramid' && o.apexPlayed === true);
  expect((await readObservation(page)).trueCount).toEqual({ face: 6, edge: 10, vertex: 6 });
});

test('엑스레이를 켜면 data-hidden="true" 모서리가 보인다', async ({ page }) => {
  await openPrism(page, { initial: { sides: 4, height: 2 } });
  await expect(page.locator('[data-testid^="prism-edge-"][data-hidden="true"]')).toHaveCount(0);
  await page.getByTestId('prism-toggle-xray').click();
  await pollObservation(page, (o) => o.xray === true);
  expect(
    await page.locator('[data-testid^="prism-edge-"][data-hidden="true"]').count(),
  ).toBeGreaterThanOrEqual(1);
});

test('표에 적기 → 칸에 7·15·10을 쓰면 tableCorrect[0]이 true다', async ({ page }) => {
  await openPrism(page, { counterTable: true, initial: { sides: 5, height: 2 } });
  await page.getByTestId('prism-table-add').click();
  await expect(page.getByTestId('prism-row-0')).toBeVisible();

  await page.getByTestId('prism-cell-0-faces').fill('7');
  await page.getByTestId('prism-cell-0-edges').fill('15');
  await pollObservation(page, (o) => o.tableCorrect?.[0] === false);
  await page.getByTestId('prism-cell-0-vertices').fill('10');
  await pollObservation(page, (o) => o.tableCorrect?.[0] === true);
  expect((await readObservation(page)).table?.[0]).toEqual({
    kind: 'prism',
    n: 5,
    faces: 7,
    edges: 15,
    vertices: 10,
  });
  // 맞아도 화면에 알리지 않는다
  await expect(page.getByTestId('prism-table')).not.toContainText(/맞|정답|틀/);
});

test('키보드만으로 육각뿔을 만들고 표에 적는다', async ({ page }) => {
  await openPrism(page, { counterTable: true });
  await page.getByTestId('prism-extrude').focus();
  for (let i = 0; i < 3; i += 1) await page.keyboard.press(']');
  await page.keyboard.press('PageUp');
  await page.keyboard.press('PageUp');
  await page.keyboard.press('a');
  await expect(page.getByTestId('prism-name')).toHaveText('육각뿔');

  await page.getByTestId('prism-table-add').focus();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('prism-row-0')).toBeVisible();
  await page.getByTestId('prism-cell-0-faces').focus();
  await page.keyboard.type('7');
  await page.keyboard.press('Tab');
  await page.keyboard.type('12');
  await page.keyboard.press('Tab');
  await page.keyboard.type('7');
  await pollObservation(
    page,
    (o) => o.kind === 'pyramid' && o.sides === 6 && o.tableCorrect?.[0] === true,
  );
});

test('눕힌 각기둥(orientation:lying)이 그려진다', async ({ page }) => {
  await openPrism(page, { orientation: 'lying', initial: { sides: 3, height: 3 } });
  await expect(page.getByTestId('prism-stage')).toHaveAttribute('data-orientation', 'lying');
  await expect(page.getByTestId('prism-name')).toHaveText('삼각기둥');
  await expect(page.getByTestId('prism-face-bottom')).toHaveAttribute('data-hidden', 'false');
  const obs = await readObservation(page);
  expect(obs.orientation).toBe('lying');
});

test('샌드박스 스냅샷(오각기둥+표 한 줄, 눕힌 삼각기둥)', async ({ page }) => {
  await openPrism(page, { counterTable: true, initial: { sides: 5, height: 2 } });
  await page.getByTestId('prism-face-top').click();
  await page.getByTestId('prism-tool-edge').click();
  await page.getByTestId('prism-edge-eb0').click();
  await pollObservation(
    page,
    (o) => o.marked?.faces.includes('top') === true && o.marked?.edges.includes('eb0') === true,
  );
  await page.getByTestId('prism-table-add').click();
  await page.getByTestId('prism-cell-0-faces').fill('7');
  await pollObservation(page, (o) => o.table?.[0]?.faces === 7);
  await page.getByTestId('prism-cell-0-faces').blur();
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
  await expect(page.getByTestId('prism-view')).toHaveScreenshot('prism-table.png', {
    maxDiffPixelRatio: 0.02,
    animations: 'disabled',
  });

  await openPrism(page, { orientation: 'lying', initial: { sides: 3, height: 3 } });
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
  await expect(page.getByTestId('prism-view')).toHaveScreenshot('prism-lying.png', {
    maxDiffPixelRatio: 0.02,
    animations: 'disabled',
  });
});

test('크롬북 ?stage=fit 크기 기준과 두 칸 배치 측정', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromebook', '크롬북 전용 측정');

  const config = { counterTable: true, initial: { sides: 5, height: 2 } };
  await openPrism(page, config, true);
  await expect(page.getByTestId('prism-stage')).toBeInViewport({ ratio: 1 });
  await expect(page.getByTestId('prism-extrude')).toBeInViewport({ ratio: 1 });
  await expect(page.getByTestId('prism-apex')).toBeInViewport({ ratio: 1 });
  await expect(page.getByTestId('prism-sides-dec')).toBeInViewport({ ratio: 1 });
  await expect(page.getByTestId('prism-sides-inc')).toBeInViewport({ ratio: 1 });
  await expect(page.getByTestId('prism-table-add')).toBeInViewport({ ratio: 1 });
  await page.getByTestId('prism-table-add').click();
  const rowBox = await page.getByTestId('prism-row-0').boundingBox();
  const fitView = await page.getByTestId('prism-view').boundingBox();
  const fitStage = await page.getByTestId('prism-stage').boundingBox();
  const fitSide = await page.locator('[class*="sideStack"]').boundingBox();

  // 크롬북 두 칸 배치 폭(약 660px)
  await page.setViewportSize({ width: 660, height: 680 });
  await openPrism(page, config, true);
  await page.waitForTimeout(200);
  const twoView = await page.getByTestId('prism-view').boundingBox();
  const twoStage = await page.getByTestId('prism-stage').boundingBox();
  const twoSide = await page.locator('[class*="sideStack"]').boundingBox();
  const inView = async (id: string) => {
    const box = await page.getByTestId(id).boundingBox();
    return (
      !!box &&
      !!twoView &&
      box.x >= twoView.x - 0.5 &&
      box.x + box.width <= twoView.x + twoView.width + 0.5
    );
  };
  console.log(
    `[E12 prism measure] fit(1366x768): view=${JSON.stringify(fitView)} stage=${JSON.stringify(fitStage)} side=${JSON.stringify(fitSide)} row0=${JSON.stringify(rowBox)} | twoCol(660x680 fit): view=${JSON.stringify(twoView)} stage=${JSON.stringify(twoStage)} side=${JSON.stringify(twoSide)}`,
  );
  await expect(page.getByTestId('prism-stage')).toBeInViewport({ ratio: 1 });
  await expect(page.getByTestId('prism-extrude')).toBeInViewport({ ratio: 1 });
  await expect(page.getByTestId('prism-apex')).toBeInViewport({ ratio: 1 });
  expect(await inView('prism-stage')).toBe(true);
  expect(await inView('prism-extrude')).toBe(true);
  expect(await inView('prism-apex')).toBe(true);
  expect(await inView('prism-sides-inc')).toBe(true);
});
