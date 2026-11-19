import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

/**
 * E08 단계 풀이 샌드박스 E2E.
 * 아이패드(WebKit)·크롬북(Chromium)·전자칠판 뷰포트에서 모두 돈다.
 */

interface ObservationRecord {
  readonly mode?: string;
  readonly firstBrokenLine?: number | null;
  readonly allEquivalent?: boolean;
  readonly finalValue?: string | null;
  readonly finalRaw?: string | null;
  readonly selectedLine?: number | null;
  readonly fixedValue?: string | null;
  readonly misconceptions?: ReadonlyArray<{ readonly line?: number; readonly code?: string }>;
  readonly [key: string]: unknown;
}

async function openStepSolver(page: Page, config: Record<string, unknown>) {
  const query = `?config=${encodeURIComponent(JSON.stringify(config))}`;
  await page.goto(`${query}#/sandbox/E08`);
  await expect(page.getByRole('heading', { name: '단계 풀이' })).toBeVisible();
  await expect(page.getByTestId('step-solver')).toBeVisible();
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

async function selectMode(page: Page, mode: string): Promise<void> {
  await page.getByLabel('모드').selectOption(mode);
  await pollObservation(page, (observation) => observation.mode === mode);
}

async function typeFraction(
  page: Page,
  lineIndex: number,
  tokenIndex: number,
  num: string,
  den: string,
): Promise<void> {
  await page.getByTestId('key-fraction').click();
  for (const digit of num) await page.getByTestId(`key-${digit}`).click();
  await page.getByTestId(`token-${lineIndex}-${tokenIndex}-den`).click();
  for (const digit of den) await page.getByTestId(`key-${digit}`).click();
}

test('키패드로 3/8 + 4/8 다음 줄에 7/8을 쓰면 모두 ✓다', async ({ page }) => {
  await openStepSolver(page, { start: '3/8 + 4/8' });

  await typeFraction(page, 1, 0, '7', '8');
  await pollObservation(page, (observation) => observation.finalValue === '7/8');

  const observation = await readObservation(page);
  expect(observation.firstBrokenLine).toBeNull();
  expect(observation.allEquivalent).toBe(true);
  expect(observation.misconceptions).toEqual([]);
  await expect(page.getByTestId('check-1')).toHaveText('✓');
});

test('1/2 + 1/3 다음에 2/5를 쓰면 ✗와 반례 상자가 뜨고 5/6은 없다', async ({ page }) => {
  await openStepSolver(page, { start: '1/2 + 1/3' });

  await typeFraction(page, 1, 0, '2', '5');
  await pollObservation(page, (observation) => observation.firstBrokenLine === 1);

  const observation = await readObservation(page);
  expect(observation.allEquivalent).toBe(false);
  expect(observation.misconceptions).toEqual([{ line: 1, code: 'MC-FRAC-ADD-DENOM' }]);
  await expect(page.getByTestId('check-1')).toHaveText('✗');

  const box = page.getByTestId('counterexample');
  await expect(box).toBeVisible();
  await expect(box).toContainText('2/5');
  await expect(box).not.toContainText('5/6');
  await expect(page.getByTestId('counterexample-bars')).toBeVisible();
});

test('debug에서 친구의 틀린 줄을 고르고 5/6으로 고친다', async ({ page }) => {
  await openStepSolver(page, {
    start: '1/2 + 1/3',
    debugSamples: [{ lines: ['1/2 + 1/3', '2/5'] }],
  });
  await selectMode(page, 'debug');

  await expect(page.getByTestId('sample-line-1')).toBeVisible();
  await page.getByTestId('sample-line-1').click();
  await pollObservation(page, (observation) => observation.selectedLine === 1);

  await typeFraction(page, 2, 0, '5', '6');
  await pollObservation(page, (observation) => observation.fixedValue === '5/6');

  const observation = await readObservation(page);
  expect(observation.selectedLine).toBe(1);
  expect(observation.fixedValue).toBe('5/6');
  expect(observation.misconceptions).toEqual([]);
  await expect(page.getByTestId('check-2')).toHaveText('✓');
});

// ───────────────────────── order-tree ─────────────────────────

async function openOrderTree(page: Page, expr: string, query = ''): Promise<void> {
  const config = encodeURIComponent(JSON.stringify({ expr }));
  await page.goto(`?config=${config}${query}#/sandbox/E08`);
  await expect(page.getByRole('heading', { name: '단계 풀이' })).toBeVisible();
  await selectMode(page, 'order-tree');
  await expect(page.getByTestId('order-expr')).toBeVisible();
}

function op(page: Page, opIndex: number) {
  return page.locator(`[data-op="${opIndex}"]`);
}

async function boxOf(page: Page, selector: string) {
  const box = await page.locator(selector).boundingBox();
  if (!box) throw new Error(`${selector} 상자를 찾지 못했습니다.`);
  return box;
}

/** 오버레이 svg 상자가 식 줄 svg 상자와 1px 이내로 같을 때까지 기다린다. */
async function expectOverlayOnExpr(page: Page, overlayName: string): Promise<void> {
  const overlay = page.locator(`[data-overlay="${overlayName}"] svg`);
  await expect(overlay).toHaveCount(1);
  await expect
    .poll(async () => {
      const canvas = await boxOf(page, '[data-testid="order-expr"]');
      const box = await overlay.boundingBox();
      if (!box) return Number.POSITIVE_INFINITY;
      return Math.max(
        Math.abs(box.x - canvas.x),
        Math.abs(box.y - canvas.y),
        Math.abs(box.width - canvas.width),
        Math.abs(box.height - canvas.height),
      );
    })
    .toBeLessThanOrEqual(1);
}

test.describe('order-tree', () => {
  test('36 − 4 × 5: −를 누르면 LEFT-TO-RIGHT와 흔들림, ×를 누르면 줄어든다', async ({ page }) => {
    await openOrderTree(page, '36 − 4 × 5');
    await expect(page.getByTestId('order-wrong-message')).toHaveText('');
    expect((await readObservation(page)).finalValue).toBeNull();

    await op(page, 0).click();
    await expect(page.getByTestId('order-wrong-message')).toContainText('다시 살펴봐요');
    await expect(op(page, 0).locator('[data-shaking="true"]')).toHaveCount(1);
    let observation = await readObservation(page);
    expect(observation.current).toBe('36 − 4 × 5');
    expect(observation.misconceptions).toEqual(['MC-ORDER-LEFT-TO-RIGHT']);
    expect(observation.wrongTapCount).toBe(1);

    await op(page, 1).click();
    await pollObservation(page, (value) => value.current === '36 − 20');
    await expect(page.getByTestId('order-wrong-message')).toHaveText('');
    await expect(page.getByTestId('tree-row-1')).toBeVisible();
    // ✓ ✕ 표시를 그리지 않는다.
    await expect(page.getByTestId('step-solver')).not.toContainText(/[✓✕✗]/);

    await op(page, 0).click();
    await pollObservation(page, (value) => value.done === true);
    observation = await readObservation(page);
    expect(observation.finalValue).toBe('16');
    expect(observation.misconceptions).toEqual(['MC-ORDER-LEFT-TO-RIGHT']);
    await expect(page.getByTestId('order-tree-canvas')).toBeVisible();
    await expect(page.locator('[data-testid^="tree-row-"]')).toHaveCount(3);
    await expect(page.locator('[data-testid^="tree-branch-"]')).toHaveCount(2);

    await page.getByTestId('order-undo').click();
    await pollObservation(page, (value) => value.current === '36 − 20');
    await page.getByTestId('order-reset').click();
    await pollObservation(page, (value) => value.current === '36 − 4 × 5');
    expect((await readObservation(page)).wrongTapCount).toBe(1);
  });

  test('48 ÷ 6 × 2: MUL-BEFORE-DIV와 two-ways 오버레이 정렬', async ({ page }) => {
    await openOrderTree(page, '48 ÷ 6 × 2', '&overlay=two-ways');
    await op(page, 1).click();
    await pollObservation(page, (value) => value.wrongTapCount === 1);
    expect((await readObservation(page)).misconceptions).toEqual(['MC-ORDER-MUL-BEFORE-DIV']);

    await page.getByRole('button', { name: '힌트 겹쳐 보기' }).click();
    await expectOverlayOnExpr(page, 'two-ways');
    await expect(page.getByTestId('two-ways-pressed')).toContainText('4');
    await expect(page.getByTestId('two-ways-rule')).toContainText('16');
    await expect(page.locator('[data-overlay="two-ways"] svg')).toContainText(
      '어느 쪽이 약속일까요?',
    );
  });

  test('(15 + 9) ÷ 4 − 2: PAREN-IGNORED와 group-box 오버레이 정렬', async ({ page }) => {
    await openOrderTree(page, '(15 + 9) ÷ 4 − 2', '&overlay=group-box');
    await op(page, 2).click();
    await pollObservation(page, (value) => value.wrongTapCount === 1);
    expect((await readObservation(page)).misconceptions).toEqual(['MC-ORDER-PAREN-IGNORED']);

    await page.getByRole('button', { name: '힌트 겹쳐 보기' }).click();
    await expectOverlayOnExpr(page, 'group-box');

    // 상자는 식 줄 안에 있다.
    const canvas = await boxOf(page, '[data-testid="order-expr"]');
    const rect = await boxOf(page, '[data-overlay="group-box"] rect');
    expect(rect.x).toBeGreaterThanOrEqual(canvas.x - 1);
    expect(rect.x + rect.width).toBeLessThanOrEqual(canvas.x + canvas.width + 1);
    expect(rect.y).toBeGreaterThanOrEqual(canvas.y - 1);
    expect(rect.y + rect.height).toBeLessThanOrEqual(canvas.y + canvas.height + 1);
  });

  test('7 + 3 × (12 − 8) ÷ 2를 끝까지 계산하면 finalValue가 13이다', async ({ page }) => {
    await openOrderTree(page, '7 + 3 × (12 − 8) ÷ 2');
    await expect(page.getByTestId('step-solver')).not.toContainText('13');
    await op(page, 2).click();
    await pollObservation(page, (value) => value.current === '7 + 3 × 4 ÷ 2');
    await op(page, 1).click();
    await op(page, 3).click();
    await op(page, 0).click();
    await pollObservation(page, (value) => value.done === true);
    const observation = await readObservation(page);
    expect(observation.finalValue).toBe('13');
    expect(observation.reductionOrder).toEqual([2, 1, 3, 0]);
    expect(observation.wrongTapCount).toBe(0);
  });

  test('키보드만으로 같은 흐름을 끝낸다', async ({ page }) => {
    await openOrderTree(page, '36 − 4 × 5');
    await op(page, 0).focus();
    await page.keyboard.press('Enter');
    await pollObservation(page, (value) => value.wrongTapCount === 1);
    await page.keyboard.press('ArrowRight');
    await expect(op(page, 1)).toBeFocused();
    await page.keyboard.press('Space');
    await pollObservation(page, (value) => value.current === '36 − 20');
    await expect(op(page, 0)).toBeFocused();
    await page.keyboard.press('Backspace');
    await pollObservation(page, (value) => value.current === '36 − 4 × 5');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Enter');
    await pollObservation(page, (value) => value.done === true);
    expect((await readObservation(page)).finalValue).toBe('16');
  });

  test('연산 기호 단추는 터치 크기(48px) 이상이다', async ({ page }) => {
    await openOrderTree(page, '24 − 6 × 3 + 8 ÷ 2');
    for (const index of [0, 1, 2, 3]) {
      const box = await boxOf(page, `[data-op="${index}"] rect`);
      expect(box.width).toBeGreaterThanOrEqual(48);
      expect(box.height).toBeGreaterThanOrEqual(48);
    }
  });
});

test.describe('order-tree 화면 기준 이미지', () => {
  test.beforeEach(() => {
    test.skip(test.info().project.name === 'board', '크롬북·아이패드만 찍는다.');
  });

  async function stageShot(page: Page, name: string): Promise<void> {
    await page.evaluate(async () => {
      await document.fonts.ready;
    });
    await expect(page.locator('main > div[class*="stage"]')).toHaveScreenshot(`${name}.png`);
  }

  test('첫 화면과 계산 두 번 뒤', async ({ page }) => {
    await openOrderTree(page, '7 + 3 × (12 − 8) ÷ 2', '&stage=fit');
    await stageShot(page, 'order-tree-start');
    await op(page, 2).click();
    await op(page, 1).click();
    await pollObservation(page, (value) => value.current === '7 + 12 ÷ 2');
    await stageShot(page, 'order-tree-two-steps');
  });
});
