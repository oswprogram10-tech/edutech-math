import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

/**
 * E17 분류기 샌드박스 E2E. 아이패드(WebKit)·크롬북·전자칠판 뷰포트에서 모두 돈다.
 *
 * - venn: 키보드로 카드를 놓고 "맞는지 보기" 뒤에만 맞음 표시가 나온다.
 * - venn: 불가능한 칸 표시 두 칸.
 * - secret-rule(seed 1): 질문 1번, 카드 하나 지우기, 고정한 비밀 카드(q11) 맞히기.
 * - 역할 바꾸기: q12를 고르고 첫 질문에 틀린 답 → 근거 문장, 나머지는 맞게 → done.
 * - hierarchy: 토글 Space, 이름 카드 Enter + 빈칸 Enter.
 * - 힌트 ② `upright-card`가 본 캔버스와 2px 안에 겹친다.
 */

interface ObservationRecord {
  readonly mode?: string;
  readonly placements?: Readonly<Record<string, string | null>>;
  readonly impossibleMarked?: string[];
  readonly questionCount?: number;
  readonly eliminated?: string[];
  readonly solved?: boolean;
  readonly swapPicked?: boolean;
  readonly swapErrors?: number;
  readonly swapAnswers?: number;
  readonly swapDone?: boolean;
  readonly toggles?: string[];
  readonly currentNode?: string;
  readonly blanks?: Readonly<Record<string, string | null>>;
  readonly [key: string]: unknown;
}

async function openEngine(page: Page, config?: unknown) {
  const query = config === undefined ? '' : `?config=${encodeURIComponent(JSON.stringify(config))}`;
  await page.goto(`/${query}#/sandbox/E17`);
  await expect(page.getByRole('heading', { name: '분류기' })).toBeVisible();
  const canvas = page.getByTestId('sorter-canvas');
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

async function setMode(page: Page, mode: 'venn' | 'secret-rule' | 'hierarchy'): Promise<void> {
  await page.getByLabel('모드').selectOption(mode);
  await pollObservation(page, (observation) => observation.mode === mode);
}

/** 검수용 스크린샷. 뷰포트마다 다른 파일로 남긴다(test-results/는 git 제외). */
async function capture(page: Page, name: string): Promise<void> {
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: `test-results/${name}-${test.info().project.name}.png`,
    fullPage: true,
  });
}

async function press(locator: Locator, key = 'Enter'): Promise<void> {
  await locator.focus();
  await expect(locator).toBeFocused();
  await locator.page().keyboard.press(key);
}

test('키보드로 카드를 칸에 놓고 맞는지 보기 뒤에만 맞음 표시가 나온다', async ({ page }) => {
  const { canvas } = await openEngine(page);

  await press(page.locator('[data-card="t04"]'));
  await press(page.locator('[data-cell="acute|equilateral"]'));
  await pollObservation(
    page,
    (observation) => observation.placements?.['t04'] === 'acute|equilateral',
  );

  await expect(page.locator('[data-fit="true"]')).toHaveCount(0);
  await page.getByRole('button', { name: '맞는지 보기' }).click();
  await expect(page.locator('[data-card="t04"][data-fit="true"]')).toHaveCount(1);

  // 기본 설정에서는 카드에 도형 이름을 쓰지 않는다.
  await expect(canvas).not.toContainText('정삼각형');
  await capture(page, 'T108-venn');
});

test('불가능한 칸 표시를 켜고 두 칸을 표시한다', async ({ page }) => {
  await openEngine(page);
  await page.getByRole('button', { name: '불가능한 칸 표시' }).click();
  await press(page.locator('[data-cell="right|equilateral"]'));
  await press(page.locator('[data-cell="obtuse|equilateral"]'));

  await pollObservation(page, (observation) => {
    const marked = observation.impossibleMarked ?? [];
    return (
      marked.length === 2 &&
      marked.includes('right|equilateral') &&
      marked.includes('obtuse|equilateral')
    );
  });
  await expect(page.locator('[data-cell="right|equilateral"][data-impossible="true"]')).toHaveCount(
    1,
  );
});

test('스무고개 seed 1: 질문 한 번, 카드 하나 지우기, 고정한 비밀 카드 맞히기', async ({ page }) => {
  await openEngine(page, { seed: 1 });
  await setMode(page, 'secret-rule');
  // 비밀 카드는 맞히기 전 DOM에 드러나지 않는다.
  await expect(page.locator('body')).not.toContainText('비밀 카드');

  await page.locator('button[data-question="parallel-pairs>=1"]').click();
  await pollObservation(page, (observation) => observation.questionCount === 1);

  await press(page.locator('[data-card="q04"]'));
  await pollObservation(page, (observation) => (observation.eliminated ?? []).includes('q04'));

  await page.getByRole('button', { name: '이 카드예요' }).click();
  await press(page.locator('[data-card="q11"]'));
  await pollObservation(page, (observation) => observation.solved === true);
  await expect(page.locator('body')).toContainText('비밀 카드');
  await capture(page, 'T108-secret');
});

test('역할 바꾸기: q12 첫 질문에 틀리면 근거 문장이 나오고, 나머지는 맞게 답한다', async ({
  page,
}) => {
  await openEngine(page, { seed: 1, roleSwap: true, startRole: 'answerer' });
  await setMode(page, 'secret-rule');
  await pollObservation(page, (observation) => observation.swapPicked === false);

  await press(page.locator('[data-card="q12"]'));
  await pollObservation(page, (observation) => observation.swapPicked === true);
  await expect(page.getByTestId('computer-question')).toHaveAttribute(
    'data-question',
    'parallel-pairs==2',
  );

  await page.getByRole('button', { name: '아니요', exact: true }).click();
  await pollObservation(page, (observation) => observation.swapErrors === 1);
  await expect(page.getByTestId('swap-evidence')).not.toBeEmpty();

  for (let step = 0; step < 8; step += 1) {
    const observation = await readObservation(page);
    if (observation.swapDone === true) break;
    const before = observation.swapAnswers ?? 0;
    await page.getByRole('button', { name: '예', exact: true }).click();
    await expect
      .poll(async () => {
        const next = await readObservation(page);
        return next.swapDone === true || (next.swapAnswers ?? 0) > before;
      })
      .toBe(true);
  }
  await pollObservation(page, (observation) => observation.swapDone === true);
  expect((await readObservation(page)).swapErrors).toBe(1);
});

test('hierarchy: 토글 Space와 이름 카드 Enter + 빈칸 Enter', async ({ page }) => {
  await openEngine(page);
  await setMode(page, 'hierarchy');

  await press(page.getByRole('switch', { name: '평행한 변 두 쌍' }), 'Space');
  await pollObservation(page, (observation) => {
    const toggles = observation.toggles ?? [];
    return toggles.length === 1 && toggles[0] === 'two-parallel-pairs';
  });
  expect((await readObservation(page)).currentNode).toBe('parallelogram');

  await press(page.getByRole('button', { name: '사다리꼴', exact: true }));
  await press(page.locator('[data-blank="trapezoid"]'));
  await pollObservation(page, (observation) => observation.blanks?.['trapezoid'] === 'trapezoid');
  await capture(page, 'T108-hierarchy');
});

test('힌트 겹쳐 보기의 upright-card가 본 캔버스와 2px 안에 겹친다', async ({ page }) => {
  const { canvas } = await openEngine(page);
  await press(page.locator('[data-card="t04"]'));
  await press(page.locator('[data-cell="acute|equilateral"]'));
  await pollObservation(
    page,
    (observation) => observation.placements?.['t04'] === 'acute|equilateral',
  );

  await page.getByRole('button', { name: '힌트 겹쳐 보기' }).click();
  const overlay = page.locator('[data-overlay="upright-card"] svg');
  await expect(overlay).toBeVisible();

  const canvasBox = await canvas.boundingBox();
  const overlayBox = await overlay.boundingBox();
  expect(canvasBox).not.toBeNull();
  expect(overlayBox).not.toBeNull();
  if (!canvasBox || !overlayBox) return;
  expect(Math.abs(overlayBox.x - canvasBox.x)).toBeLessThanOrEqual(2);
  expect(Math.abs(overlayBox.y - canvasBox.y)).toBeLessThanOrEqual(2);
  expect(Math.abs(overlayBox.width - canvasBox.width)).toBeLessThanOrEqual(2);
  expect(Math.abs(overlayBox.height - canvasBox.height)).toBeLessThanOrEqual(2);
});
