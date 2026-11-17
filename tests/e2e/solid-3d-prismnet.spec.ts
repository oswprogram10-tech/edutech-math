import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

/**
 * E12 `net-fold` `target:'prism'`(각기둥 전개도) 샌드박스 E2E(아이패드·크롬북·전자칠판).
 * 샌드박스 모드 선택은 `net-fold`이고 설정 `target:'prism'`으로 각기둥 전개도가 열린다.
 */

interface PrismNetObservation {
  readonly mode?: string;
  readonly n?: number;
  readonly pieceCount?: { readonly base: number; readonly rect: number };
  readonly remaining?: { readonly base: number; readonly rect: number };
  readonly folded?: boolean;
  readonly evaluation?: {
    readonly valid: boolean;
    readonly missing: number;
    readonly duplicates: number;
    readonly mismatch: number;
    readonly paperOverlap: number;
    readonly bothBasesSameEnd: boolean;
  };
  readonly cards?: readonly { readonly id: string; readonly valid: boolean }[];
  readonly [key: string]: unknown;
}

async function openPrismNet(page: Page, config: Record<string, unknown> = {}, stageFit = false) {
  const full = { target: 'prism', ...config };
  const query = `${stageFit ? '?stage=fit&' : '?'}config=${encodeURIComponent(JSON.stringify(full))}`;
  await page.goto(`/${query}#/sandbox/E12`);
  await expect(page.getByRole('heading', { name: '3D 입체' })).toBeVisible();
  await page.getByLabel('모드').selectOption('net-fold');
  await expect(page.getByTestId('prismnet-view')).toBeVisible();
}

async function readObservation(page: Page): Promise<PrismNetObservation> {
  const text = await page.getByTestId('observation').textContent();
  return JSON.parse(text ?? '{}') as PrismNetObservation;
}

async function pollObservation(
  page: Page,
  check: (obs: PrismNetObservation) => boolean,
): Promise<void> {
  await expect.poll(async () => check(await readObservation(page))).toBe(true);
}

/** 삼각기둥: 옆면 띠 3장 → 아래 밑면(옆면 0의 아래) → 위 밑면(옆면 2의 위, `topOn` 기본 2). */
async function buildTriPrism(
  page: Page,
  topEdgeOn: { piece: number; edge: number } = { piece: 2, edge: 2 },
) {
  await page.getByTestId('prismnet-type-rect').click();
  await page.getByTestId('prismnet-root-handle').click();
  await page.getByTestId('prismnet-handle-0-1').click();
  await page.getByTestId('prismnet-handle-1-1').click();
  await page.getByTestId('prismnet-type-base').click();
  await page.getByTestId('prismnet-handle-0-0').click();
  await page.getByTestId(`prismnet-handle-${topEdgeOn.piece}-${topEdgeOn.edge}`).click();
}

test('삼각기둥: 옆면 띠 3장과 밑면 2장(위·아래)을 붙여 접으면 접힌 무대가 나온다', async ({
  page,
}) => {
  await openPrismNet(page);
  await buildTriPrism(page);
  await pollObservation(
    page,
    (o) => o.pieceCount?.base === 2 && o.pieceCount?.rect === 3 && o.evaluation?.valid === true,
  );
  await expect(page.getByTestId('prismnet-folded-stage')).toHaveCount(0);
  await page.getByTestId('prismnet-fold').click();
  await expect(page.getByTestId('prismnet-folded-stage')).toBeVisible();
  await expect(page.getByTestId('prismnet-fold-status')).toHaveText('각기둥으로 접혔어요!');
  await pollObservation(page, (o) => o.folded === true && o.evaluation?.valid === true);
  // 돌려 볼 수 있다
  await page.getByTestId('prismnet-turn-right').click();
  await expect(page.getByTestId('prismnet-folded-stage')).toBeVisible();
  // 펼치면 무대가 사라진다
  await page.getByTestId('prismnet-fold').click();
  await expect(page.getByTestId('prismnet-folded-stage')).toHaveCount(0);
});

test('밑면 둘을 위에만 붙이면 "접히지 않아요"가 나오고 문제 조각에 무늬가 있다', async ({
  page,
}) => {
  await openPrismNet(page);
  await page.getByTestId('prismnet-type-rect').click();
  await page.getByTestId('prismnet-root-handle').click();
  await page.getByTestId('prismnet-handle-0-1').click();
  await page.getByTestId('prismnet-handle-1-1').click();
  await page.getByTestId('prismnet-type-base').click();
  await page.getByTestId('prismnet-handle-0-2').click();
  await page.getByTestId('prismnet-handle-2-2').click();
  await pollObservation(page, (o) => o.evaluation?.bothBasesSameEnd === true);
  await page.getByTestId('prismnet-fold').click();
  await expect(page.getByTestId('prismnet-fold-status')).toHaveText('접히지 않아요');
  await expect(page.getByTestId('prismnet-folded-stage')).toHaveCount(0);
  await expect(page.getByTestId('prismnet-hatch-3')).toBeVisible();
  await expect(page.getByTestId('prismnet-hatch-4')).toBeVisible();
  await expect(page.getByTestId('prismnet-hatch-0')).toHaveCount(0);
  // 화면에는 자리 이름이 없다
  await expect(page.locator('[data-slot]')).toHaveCount(0);
  await pollObservation(page, (o) => o.evaluation?.valid === false && o.evaluation?.missing === 1);
});

test('키보드만으로 삼각기둥을 만든다', async ({ page }) => {
  await openPrismNet(page);
  const press = async (testId: string, key: string) => {
    await page.getByTestId(testId).focus();
    await page.keyboard.press(key);
  };
  await press('prismnet-type-rect', 'Enter');
  await press('prismnet-root-handle', 'Enter');
  await press('prismnet-handle-0-1', ' ');
  await press('prismnet-handle-1-1', 'Enter');
  // 붙인 조각으로 초점이 옮겨 가 있으니 B 키로 밑면을 고른다
  await page.keyboard.press('b');
  await expect(page.getByTestId('prismnet-type-base')).toHaveAttribute('aria-pressed', 'true');
  await press('prismnet-handle-0-0', 'Enter');
  await press('prismnet-handle-2-2', 'Enter');
  await pollObservation(page, (o) => o.evaluation?.valid === true);
  await page.keyboard.press('f');
  await expect(page.getByTestId('prismnet-folded-stage')).toBeVisible();
  await page.keyboard.press('f');
  await expect(page.getByTestId('prismnet-folded-stage')).toHaveCount(0);
  // 조각을 Enter로 고르고 Delete로 뺀다(잎 조각)
  await press('prismnet-piece-4', 'Enter');
  await page.keyboard.press('Delete');
  await pollObservation(page, (o) => o.pieceCount?.base === 1);
});

test('오각기둥 둘레형 전개도: 밑면 하나 둘레에 옆면 5개와 윗밑면', async ({ page }) => {
  await openPrismNet(page, { baseSides: 5 });
  await page.getByTestId('prismnet-type-base').click();
  await page.getByTestId('prismnet-root-handle').click();
  await page.getByTestId('prismnet-type-rect').click();
  for (let k = 0; k < 5; k += 1) {
    await page.getByTestId(`prismnet-handle-0-${k}`).click();
  }
  await page.getByTestId('prismnet-type-base').click();
  await page.getByTestId('prismnet-handle-1-2').click();
  await pollObservation(
    page,
    (o) => o.pieceCount?.base === 2 && o.pieceCount?.rect === 5 && o.evaluation?.valid === true,
  );
  // 7조각이 모두 판 안에 들어온다
  const board = await page.getByTestId('prismnet-board').boundingBox();
  expect(board).not.toBeNull();
  for (let id = 0; id < 7; id += 1) {
    const box = await page.getByTestId(`prismnet-piece-${id}`).boundingBox();
    expect(box, `조각 ${id}`).not.toBeNull();
    if (!board || !box) continue;
    expect(box.x).toBeGreaterThanOrEqual(board.x - 0.5);
    expect(box.y).toBeGreaterThanOrEqual(board.y - 0.5);
    expect(box.x + box.width).toBeLessThanOrEqual(board.x + board.width + 0.5);
    expect(box.y + box.height).toBeLessThanOrEqual(board.y + board.height + 0.5);
  }
  await page.getByTestId('prismnet-fold').click();
  await expect(page.getByTestId('prismnet-folded-stage')).toBeVisible();
});

test('카드만 보기: 카드 3장이 한 화면에 다 보이고 접히는지는 관찰에만 있다', async ({ page }) => {
  const cards = [
    {
      id: 'a',
      label: '가',
      root: 'rect',
      steps: [
        { parent: 0, parentEdge: 1, type: 'rect' },
        { parent: 1, parentEdge: 1, type: 'rect' },
        { parent: 0, parentEdge: 0, type: 'base' },
        { parent: 2, parentEdge: 2, type: 'base' },
      ],
    },
    {
      id: 'b',
      label: '나',
      root: 'rect',
      steps: [
        { parent: 0, parentEdge: 1, type: 'rect' },
        { parent: 1, parentEdge: 1, type: 'rect' },
        { parent: 0, parentEdge: 2, type: 'base' },
        { parent: 2, parentEdge: 2, type: 'base' },
      ],
    },
    {
      id: 'c',
      label: '다',
      root: 'base',
      steps: [
        { parent: 0, parentEdge: 0, type: 'rect' },
        { parent: 0, parentEdge: 1, type: 'rect' },
        { parent: 0, parentEdge: 2, type: 'rect' },
        { parent: 1, parentEdge: 2, type: 'base' },
      ],
    },
  ];
  await openPrismNet(page, { editable: false, foldable: false, netCards: cards }, true);
  await expect(page.getByTestId('prismnet-board')).toHaveCount(0);
  await expect(page.getByTestId('prismnet-fold')).toHaveCount(0);
  for (const id of ['a', 'b', 'c']) {
    await expect(page.getByTestId(`prismnet-card-${id}`)).toBeInViewport({ ratio: 1 });
  }
  await expect(page.getByTestId('prismnet-view').getByText('접히지 않아요')).toHaveCount(0);
  await pollObservation(
    page,
    (o) =>
      JSON.stringify(o.cards) ===
      JSON.stringify([
        { id: 'a', valid: true },
        { id: 'b', valid: false },
        { id: 'c', valid: true },
      ]),
  );
});

test('기준 이미지: 조립한 삼각기둥 전개도와 접힌 무대', async ({ page }) => {
  await openPrismNet(page);
  await buildTriPrism(page);
  await pollObservation(page, (o) => o.evaluation?.valid === true);
  // 손잡이와 선택 표시 없이 조각만 찍는다
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
  await expect(page.getByTestId('prismnet-view')).toHaveScreenshot('prismnet-assembled.png', {
    maxDiffPixelRatio: 0.02,
    animations: 'disabled',
  });
  await page.getByTestId('prismnet-fold').click();
  await expect(page.getByTestId('prismnet-folded-stage')).toBeVisible();
  await expect(page.getByTestId('prismnet-folded')).toHaveScreenshot('prismnet-folded.png', {
    maxDiffPixelRatio: 0.02,
    animations: 'disabled',
  });
});

test('크롬북 ?stage=fit: 판·조각 고르기·접기 단추가 첫 화면에 다 들어온다', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'chromebook', '크롬북 전용 측정');
  await openPrismNet(page, { baseSides: 5 }, true);
  await expect(page.getByTestId('prismnet-board')).toBeInViewport({ ratio: 1 });
  for (const id of [
    'prismnet-type-base',
    'prismnet-type-rect',
    'prismnet-fold',
    'prismnet-clear',
  ]) {
    await expect(page.getByTestId(id)).toBeInViewport({ ratio: 1 });
  }
  await page.getByTestId('prismnet-type-base').click();
  await page.getByTestId('prismnet-root-handle').click();
  await page.getByTestId('prismnet-type-rect').click();
  for (let k = 0; k < 5; k += 1) {
    await page.getByTestId(`prismnet-handle-0-${k}`).click();
  }
  await page.getByTestId('prismnet-type-base').click();
  await page.getByTestId('prismnet-handle-1-2').click();
  await pollObservation(page, (o) => o.evaluation?.valid === true);
  await expect(page.getByTestId('prismnet-board')).toBeInViewport({ ratio: 1 });
  const board = await page.getByTestId('prismnet-board').boundingBox();
  for (let id = 0; id < 7; id += 1) {
    const box = await page.getByTestId(`prismnet-piece-${id}`).boundingBox();
    expect(box, `조각 ${id}`).not.toBeNull();
    if (!board || !box) continue;
    expect(box.x).toBeGreaterThanOrEqual(board.x - 0.5);
    expect(box.y).toBeGreaterThanOrEqual(board.y - 0.5);
    expect(box.x + box.width).toBeLessThanOrEqual(board.x + board.width + 0.5);
    expect(box.y + box.height).toBeLessThanOrEqual(board.y + board.height + 0.5);
  }
  for (const id of [
    'prismnet-type-base',
    'prismnet-type-rect',
    'prismnet-fold',
    'prismnet-clear',
  ]) {
    await expect(page.getByTestId(id)).toBeInViewport({ ratio: 1 });
  }
  await page.getByTestId('prismnet-fold').click();
  await expect(page.getByTestId('prismnet-folded-stage')).toBeVisible();
  await expect(page.getByTestId('prismnet-fold')).toBeInViewport({ ratio: 1 });
  const fitView = await page.getByTestId('prismnet-view').boundingBox();
  const fitBoard = await page.getByTestId('prismnet-board').boundingBox();
  const fitSide = await page.locator('[class*="sideStack"]').boundingBox();
  const fitStage = await page.getByTestId('prismnet-folded-stage').boundingBox();
  console.log(
    `[E12 prismnet measure] fit(1366x768): view=${JSON.stringify(fitView)} board=${JSON.stringify(fitBoard)} side=${JSON.stringify(fitSide)} foldedStage=${JSON.stringify(fitStage)}`,
  );
});
