import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

/**
 * E12 `net-fold` 모드 샌드박스 E2E(아이패드·크롬북·전자칠판).
 */

interface NetObservationRecord {
  readonly mode?: string;
  readonly faceCount?: number;
  readonly folded?: boolean;
  readonly valid?: boolean;
  readonly overlapPairs?: number;
  readonly missingCount?: number;
  readonly foundCount?: number;
  readonly prediction?: string | null;
  readonly predictedBeforeFold?: boolean;
  readonly [key: string]: unknown;
}

async function openNet(page: Page, config?: Record<string, unknown>, stageFit = false) {
  const merged = { animate: false, ...config };
  const query = `${stageFit ? '?stage=fit&' : '?'}config=${encodeURIComponent(JSON.stringify(merged))}`;
  await page.goto(`/${query}#/sandbox/E12`);
  await expect(page.getByRole('heading', { name: '3D 입체' })).toBeVisible();
  await page.getByLabel('모드').selectOption('net-fold');
  const grid = page.getByTestId('net-grid');
  await expect(grid).toBeVisible();
  return { grid, observation: page.getByTestId('observation') };
}

async function readObservation(page: Page): Promise<NetObservationRecord> {
  const text = await page.getByTestId('observation').textContent();
  return JSON.parse(text ?? '{}') as NetObservationRecord;
}

async function pollObservation(
  page: Page,
  check: (obs: NetObservationRecord) => boolean,
): Promise<void> {
  await expect.poll(async () => check(await readObservation(page))).toBe(true);
}

async function placeCells(
  page: Page,
  coords: readonly (readonly [number, number])[],
): Promise<void> {
  for (const [x, y] of coords) {
    await page.getByTestId(`net-cell-${x}-${y}`).click();
  }
}

const CROSS_COORDS: readonly (readonly [number, number])[] = [
  [1, 0],
  [0, 1],
  [1, 1],
  [2, 1],
  [3, 1],
  [1, 2],
];

const ROTATED_CROSS_COORDS: readonly (readonly [number, number])[] = [
  [1, 0],
  [0, 1],
  [1, 1],
  [2, 1],
  [1, 2],
  [1, 3],
];

test('십자를 눌러 그리고 접기 → valid:true, 쌍 무늬가 보인다', async ({ page }) => {
  await openNet(page);
  await placeCells(page, CROSS_COORDS);
  await pollObservation(page, (o) => o.faceCount === 6 && o.valid === true);

  await page.getByTestId('net-fold-toggle').click();
  await pollObservation(page, (o) => o.folded === true && o.valid === true);

  await expect(page.getByTestId('net-status')).toHaveText(
    '접혔어요! 마주 보는 면은 같은 무늬예요.',
  );
  await expect(page.locator('[data-testid="net-grid"] [data-pair-shape="circle"]')).toHaveCount(2);
  await expect(page.locator('[data-testid="net-grid"] [data-pair-shape="triangle"]')).toHaveCount(
    2,
  );
  await expect(page.locator('[data-testid="net-grid"] [data-pair-shape="square"]')).toHaveCount(2);
});

test('일렬 6 → 겹침 표시와 overlapPairs:2를 보인다', async ({ page }) => {
  await openNet(page);
  await placeCells(page, [
    [0, 0],
    [1, 0],
    [2, 0],
    [3, 0],
    [4, 0],
    [5, 0],
  ]);

  await page.getByTestId('net-fold-toggle').click();
  await pollObservation(page, (o) => o.folded === true && o.overlapPairs === 2);

  await expect(page.getByTestId('net-status')).toContainText('겹친 면이 2쌍 있어요');
  await expect(page.getByTestId('net-status')).toContainText('빈 곳이 2군데 있어요');
  await expect(page.getByTestId('net-fold-stage')).toContainText('겹침');
  await expect(page.getByTestId('net-fold-stage')).toContainText('빈 곳');
});

test('예측 흐름: 고르기 전 접기 비활성 → 고르고 접기 → predictedBeforeFold:true', async ({
  page,
}) => {
  await openNet(page, {
    editable: false,
    predict: { of: '★' },
    given: [
      { at: [1, 0], w: 1, h: 1, label: '★' },
      { at: [0, 1], w: 1, h: 1, label: 'ㄱ' },
      { at: [1, 1], w: 1, h: 1, label: 'ㄴ' },
      { at: [2, 1], w: 1, h: 1, label: 'ㄷ' },
      { at: [3, 1], w: 1, h: 1, label: 'ㄹ' },
      { at: [1, 2], w: 1, h: 1, label: 'ㅁ' },
    ],
  });

  await expect(page.getByTestId('net-predict-prompt')).toContainText(
    '접기 전에 ★면과 마주 보는 면을 골라 보세요',
  );
  const foldBtn = page.getByTestId('net-fold-toggle');
  await expect(foldBtn).toBeDisabled();
  await expect(page.getByTestId('net-pick-first')).toHaveText('먼저 골라 보세요');

  await page.getByTestId('net-predict-ㅁ').click();
  await expect(foldBtn).toBeEnabled();
  await foldBtn.click();

  await pollObservation(
    page,
    (o) => o.folded === true && o.prediction === 'ㅁ' && o.predictedBeforeFold === true,
  );
  await expect(page.getByTestId('net-grid')).toContainText('예측');
});

test('netLog: 회전판 같은 전개도는 개수가 늘지 않고 안내를 보인다', async ({ page }) => {
  await openNet(page, { netLog: true });
  await placeCells(page, CROSS_COORDS);
  await page.getByTestId('net-fold-toggle').click();
  await pollObservation(page, (o) => o.folded === true && o.foundCount === 1);
  await expect(page.getByTestId('net-log-panel')).toContainText('찾은 전개도 1가지');

  await page.getByTestId('net-clear').click();
  await placeCells(page, ROTATED_CROSS_COORDS);
  await page.getByTestId('net-fold-toggle').click();
  await pollObservation(page, (o) => o.folded === true && o.foundCount === 1);
  await expect(page.getByTestId('net-log-duplicate')).toContainText('이미 찾은 전개도와 같아요');
});

test('직육면체 4×3×2를 모양 고르기로 그려 접으면 valid다', async ({ page }, testInfo) => {
  await openNet(
    page,
    {
      target: 'cuboid',
      dims: [4, 3, 2],
      grid: [8, 10],
    },
    testInfo.project.name === 'chromebook',
  );

  // 가로·세로 중복 단추 없이 쌍당 하나(4x3, 4x2, 3x2) + 돌리기만 보인다.
  await expect(page.getByTestId('net-shape-3x4')).toHaveCount(0);
  await expect(page.getByTestId('net-shape-2x4')).toHaveCount(0);
  await expect(page.getByTestId('net-shape-2x3')).toHaveCount(0);

  // 기본 4x3: 바닥(2,2), 위(2,7)
  await page.getByTestId('net-cell-2-2').click();
  await page.getByTestId('net-cell-2-7').click();

  // 4x2: 뒤(2,0), 앞(2,5)
  await page.getByTestId('net-shape-4x2').click();
  await page.getByTestId('net-cell-2-0').click();
  await page.getByTestId('net-cell-2-5').click();

  // 2x3: 왼(0,2), 오른(6,2)
  await page.getByTestId('net-shape-3x2').click();
  await page.getByTestId('net-rotate-shape').click();
  await expect(page.getByTestId('net-shape-2x3')).toHaveAttribute('aria-pressed', 'true');
  await page.getByTestId('net-cell-0-2').click();
  await page.getByTestId('net-cell-6-2').click();

  await page.getByTestId('net-fold-toggle').click();
  await pollObservation(page, (o) => o.folded === true && o.valid === true);

  if (testInfo.project.name === 'chromebook') {
    await expect(page.getByTestId('net-fold-stage')).toBeInViewport({ ratio: 1 });
    await expect(page.getByTestId('net-fold-toggle')).toBeInViewport({ ratio: 1 });
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
  }
});

test('키보드만으로 십자를 그려 접는다', async ({ page }) => {
  const { grid } = await openNet(page);
  await grid.focus();
  await expect(grid).toBeFocused();

  // (0,0) -> (1,0)
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  // -> (0,1)
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('Enter');
  // -> (1,1) -> (2,1) -> (3,1)
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  // -> (1,2)
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');

  await page.keyboard.press('f');
  await pollObservation(page, (o) => o.folded === true && o.valid === true);
});

test('샌드박스 스냅샷(펼침 1장·접힘 1장)과 크기 기준', async ({ page }, testInfo) => {
  const { grid } = await openNet(page, {
    given: [
      { at: [1, 0], w: 1, h: 1, label: '★' },
      { at: [0, 1], w: 1, h: 1, label: 'ㄱ' },
      { at: [1, 1], w: 1, h: 1, label: 'ㄴ' },
      { at: [2, 1], w: 1, h: 1, label: 'ㄷ' },
      { at: [3, 1], w: 1, h: 1, label: 'ㄹ' },
      { at: [1, 2], w: 1, h: 1, label: 'ㅁ' },
    ],
  });

  const foldBtn = page.getByTestId('net-fold-toggle');
  const cellSizeAttr = Number(await grid.getAttribute('data-cell-size'));
  expect(cellSizeAttr).toBeGreaterThanOrEqual(48);

  if (testInfo.project.name === 'chromebook') {
    await expect(grid).toBeInViewport({ ratio: 1 });
    await expect(foldBtn).toBeInViewport({ ratio: 1 });
  }

  await page.evaluate(async () => {
    await document.fonts.ready;
  });
  const stagePanel = page.getByTestId('net-view');
  await expect(stagePanel).toHaveScreenshot('net-unfolded.png', {
    maxDiffPixelRatio: 0.02,
    animations: 'disabled',
  });

  await foldBtn.click();
  await pollObservation(page, (o) => o.folded === true && o.valid === true);

  await expect(stagePanel).toHaveScreenshot('net-folded.png', {
    maxDiffPixelRatio: 0.02,
    animations: 'disabled',
  });
});

test('크롬북 [8,10] 모눈 크기·넘침 측정', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromebook', '크롬북 전용 측정');
  const { grid }: { grid: Locator } = await openNet(
    page,
    { target: 'cuboid', dims: [4, 3, 2], grid: [8, 10] },
    true,
  );
  const foldBtn = page.getByTestId('net-fold-toggle');
  const viewBox = await page.getByTestId('net-view').boundingBox();
  const boardBox = await page.locator('[class*="netBoardArea"]').boundingBox();
  const gridBox = await grid.boundingBox();
  const cellSize = Number(await grid.getAttribute('data-cell-size'));

  await expect(grid).toBeInViewport({ ratio: 1 });
  await expect(foldBtn).toBeInViewport({ ratio: 1 });
  expect(cellSize).toBeGreaterThanOrEqual(32);
  expect(cellSize * 2).toBeGreaterThanOrEqual(48);

  // 크롬북 두 칸 배치 폭(약 660px)에서도 containerQuery 레이아웃 측정
  await page.setViewportSize({ width: 660, height: 680 });
  await page.waitForTimeout(150);
  const twoColView = await page.getByTestId('net-view').boundingBox();
  const twoColBoard = await page.locator('[class*="netBoardArea"]').boundingBox();
  const twoColGrid = await grid.boundingBox();
  const twoColCell = Number(await grid.getAttribute('data-cell-size'));

  console.log(
    `[E12 net 8x10 measure] sandboxFit: view=${JSON.stringify(viewBox)} board=${JSON.stringify(boardBox)} grid=${JSON.stringify(gridBox)} cell=${cellSize}px | twoCol(660x680): view=${JSON.stringify(twoColView)} board=${JSON.stringify(twoColBoard)} grid=${JSON.stringify(twoColGrid)} cell=${twoColCell}px`,
  );
  expect(twoColCell).toBeGreaterThanOrEqual(32);
  expect(twoColCell * 2).toBeGreaterThanOrEqual(48);
  await expect(grid).toBeInViewport({ ratio: 1 });
  if (twoColBoard && twoColGrid) {
    expect(twoColGrid.x).toBeGreaterThanOrEqual(twoColBoard.x - 1);
    expect(twoColGrid.y).toBeGreaterThanOrEqual(twoColBoard.y - 1);
    expect(twoColGrid.x + twoColGrid.width).toBeLessThanOrEqual(
      twoColBoard.x + twoColBoard.width + 1,
    );
    expect(twoColGrid.y + twoColGrid.height).toBeLessThanOrEqual(
      twoColBoard.y + twoColBoard.height + 1,
    );
  }
});

// ---------------------------------------------------------------- T141 카드만 보기

function faceAt(x: number, y: number) {
  return { at: [x, y], w: 1, h: 1 };
}

const CARDS_ONLY_CONFIG = {
  target: 'cube',
  grid: [3, 3],
  editable: false,
  foldable: false,
  netCards: [
    {
      id: 'ga',
      label: '가',
      faces: [faceAt(1, 0), faceAt(0, 1), faceAt(1, 1), faceAt(2, 1), faceAt(1, 2), faceAt(1, 3)],
    },
    {
      id: 'na',
      label: '나',
      faces: [faceAt(0, 1), faceAt(1, 1), faceAt(2, 1), faceAt(3, 1), faceAt(4, 1), faceAt(1, 0)],
    },
    {
      id: 'da',
      label: '다',
      faces: [faceAt(0, 0), faceAt(1, 0), faceAt(1, 1), faceAt(2, 1), faceAt(2, 2), faceAt(3, 2)],
    },
  ],
};

async function openNetNoGrid(page: Page, config: Record<string, unknown>) {
  const merged = { animate: false, ...config };
  await page.goto(`/?config=${encodeURIComponent(JSON.stringify(merged))}#/sandbox/E12`);
  await expect(page.getByRole('heading', { name: '3D 입체' })).toBeVisible();
  await page.getByLabel('모드').selectOption('net-fold');
  await expect(page.getByTestId('net-view')).toBeVisible();
}

test('카드만 보기: 모눈·접기 단추 없이 카드 3장이 잘리지 않고 보인다', async ({ page }) => {
  await openNetNoGrid(page, CARDS_ONLY_CONFIG);
  const view = page.getByTestId('net-view');
  await expect(view).toHaveAttribute('data-net-cards-only', 'true');
  await expect(page.getByTestId('net-grid')).toHaveCount(0);
  await expect(page.getByTestId('net-fold-stage')).toHaveCount(0);
  await expect(page.getByTestId('net-fold-toggle')).toHaveCount(0);
  await expect(page.getByTestId('net-clear')).toHaveCount(0);
  for (const id of ['ga', 'na', 'da']) {
    await expect(page.getByTestId(`net-card-${id}`)).toBeInViewport({ ratio: 1 });
  }
  await expect(page.getByLabel('전개도 카드 가')).toBeVisible();

  // 한 줄: 세 카드의 위쪽 좌표가 같다.
  const tops = await Promise.all(
    ['ga', 'na', 'da'].map(
      async (id) => (await page.getByTestId(`net-card-${id}`).boundingBox())?.y,
    ),
  );
  expect(new Set(tops.map((t) => Math.round(t ?? -1))).size).toBe(1);

  // 조작할 것이 없다: F 키가 아무 일도 하지 않는다.
  await page.keyboard.press('f');
  await expect(page.getByTestId('net-fold-stage')).toHaveCount(0);
  await expect(view).toHaveAttribute('data-net-cards-only', 'true');

  await page.evaluate(async () => {
    await document.fonts.ready;
  });
  await expect(view).toHaveScreenshot('solid-3d-net-cards-only.png', {
    maxDiffPixelRatio: 0.02,
    animations: 'disabled',
  });
});

test('카드만 보기 회귀: foldable만 켜면 모눈과 접기 단추가 있다', async ({ page }) => {
  await openNet(page, { ...CARDS_ONLY_CONFIG, foldable: true });
  await expect(page.getByTestId('net-view')).not.toHaveAttribute('data-net-cards-only', 'true');
  await expect(page.getByTestId('net-grid')).toBeVisible();
  await expect(page.getByTestId('net-fold-toggle')).toBeVisible();
});
