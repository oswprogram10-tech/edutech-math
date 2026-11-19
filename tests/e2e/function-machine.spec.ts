import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

/**
 * E16 대응 관계 샌드박스 E2E. 아이패드(WebKit)·크롬북·전자칠판 뷰포트에서 모두 돈다.
 *
 * - black-box: 키패드로 1·2·5를 넣고 식을 시험(ONE-PAIR → holdsAll), 키보드만, SWAP·RECURSIVE·ADD-ONLY.
 * - table: 빈칸 채우기. covary: 슬라이더 키보드, 빈칸 줄에 장면 글자 없음.
 * - 힌트 ② 오버레이 4개가 relation-canvas와 1px 안에 겹친다. 터치 타깃 크기.
 */

test.describe.configure({ timeout: 120_000 });

interface ObservationRecord {
  readonly mode?: string;
  readonly pairs?: [string, string][];
  readonly trialCount?: number;
  readonly holdsAll?: boolean;
  readonly matchesHidden?: boolean;
  readonly misconceptions?: string[];
  readonly cellsCorrect?: boolean;
  readonly cellsComplete?: boolean;
  readonly cells?: Record<string, string>;
  readonly x?: string;
  readonly visited?: string[];
  readonly [key: string]: unknown;
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

async function open(page: Page, mode: string, config: unknown, query = ''): Promise<void> {
  const params = new URLSearchParams({ config: JSON.stringify(config) });
  if (query) for (const [key, value] of new URLSearchParams(query)) params.set(key, value);
  await page.goto(`/?${params.toString()}#/sandbox/E16`);
  await expect(page.getByRole('heading', { name: '대응 관계' })).toBeVisible();
  if (mode !== 'black-box') await page.getByLabel('모드').selectOption(mode);
  await pollObservation(page, (observation) => observation.mode === mode);
}

async function capture(page: Page, name: string): Promise<void> {
  await page.waitForTimeout(900); // 출구 숫자가 나타나는 짧은 애니메이션이 끝나도록
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: `test-results/${name}-${test.info().project.name}.png`,
    fullPage: true,
  });
}

function pad(page: Page, name: string): Locator {
  return page.getByRole('button', { name, exact: true });
}

/** 숫자 키패드로 수를 쓰고 넣기를 누른다. */
async function insertByPad(page: Page, digits: string): Promise<void> {
  for (const digit of digits) await pad(page, digit).click();
  await pad(page, '넣기').click();
}

/** 식 칸을 눌러 식 키패드를 열고, 지운 뒤 기호 단추로 쓴다. */
async function writeRuleByPad(page: Page, text: string, test = true): Promise<void> {
  await page.getByTestId('rule-input').click();
  await pad(page, '모두 지우기').click();
  for (const ch of text) {
    if (ch === ' ') continue;
    await pad(page, ch).click();
  }
  if (test) await pad(page, '규칙 시험하기').click();
}

const HIDDEN_X3 = { rule: '□ = ○ × 3' };

async function threePairs(page: Page, query = 'stage=fit'): Promise<void> {
  await open(page, 'black-box', HIDDEN_X3, query);
  for (const n of ['1', '2', '5']) await insertByPad(page, n);
  await pollObservation(page, (o) => o.trialCount === 3);
}

test('black-box: 1·2·5를 넣어 표 3열, □ = ○ + 2는 ONE-PAIR(✕ 둘), □ = ○ × 3은 holdsAll', async ({
  page,
}) => {
  await threePairs(page);
  const o = await readObservation(page);
  expect(o.pairs).toEqual([
    ['1', '3'],
    ['2', '6'],
    ['5', '15'],
  ]);
  await expect(page.locator('[data-col]')).toHaveCount(3);
  await capture(page, 'T173-black-box-3pairs');

  await writeRuleByPad(page, '□ = ○ + 2');
  await pollObservation(
    page,
    (x) => (x.misconceptions ?? []).includes('MC-PATTERN-ONE-PAIR') && x.holdsAll === false,
  );
  await expect(page.locator('[data-mark="bad"]')).toHaveCount(2);
  await expect(page.locator('[data-mark="ok"]')).toHaveCount(1);

  await writeRuleByPad(page, '□ = ○ × 3');
  await pollObservation(page, (x) => x.holdsAll === true && x.matchesHidden === true);
  await expect(page.locator('[data-mark="ok"]')).toHaveCount(3);
  // 식을 고치면 표시가 사라진다.
  await pad(page, '지우기').click();
  await expect(page.locator('[data-mark]')).toHaveCount(0);
});

test('같은 ○를 다시 넣으면 열을 더하지 않는다', async ({ page }) => {
  await open(page, 'black-box', HIDDEN_X3);
  await insertByPad(page, '4');
  await insertByPad(page, '4');
  await pollObservation(page, (o) => o.trialCount === 1);
  await expect(page.locator('[data-col]')).toHaveCount(1);
  await expect(page.locator('[data-col][data-highlight="true"]')).toHaveCount(1);
});

test('범위 밖 수와 maxTrials는 막고 문구를 보인다', async ({ page }) => {
  await open(page, 'black-box', { ...HIDDEN_X3, maxTrials: 2, inputRange: [0, 20] });
  await insertByPad(page, '99');
  await expect(page.getByTestId('function-notice')).toHaveText('0부터 20까지의 수를 넣어요');
  await pad(page, '지우기').click();
  await pad(page, '지우기').click();
  await insertByPad(page, '1');
  await insertByPad(page, '2');
  await expect(page.getByTestId('trial-count')).toHaveText('넣은 횟수 2 / 2');
  await expect(page.getByTestId('function-notice')).toHaveText('넣을 수 있는 횟수를 다 썼어요');
  await expect(pad(page, '넣기')).toBeDisabled();
});

test('키보드만으로 1·2·5를 넣고 b=o*3을 시험한다', async ({ page }) => {
  await open(page, 'black-box', HIDDEN_X3);
  await page.getByTestId('input-draft').focus();
  for (const n of ['1', '2', '5']) {
    await page.keyboard.press(n);
    await page.keyboard.press('Enter');
  }
  await pollObservation(page, (o) => o.trialCount === 3);
  await page.getByTestId('rule-input').focus();
  await page.keyboard.type('b=o*3');
  await expect(page.getByTestId('rule-input')).toHaveText('□=○×3');
  await page.keyboard.press('Enter');
  await pollObservation(page, (o) => o.holdsAll === true && o.matchesHidden === true);
  await page.keyboard.press('Backspace');
  await expect(page.getByTestId('rule-input')).toHaveText('□=○×');
});

test('SWAP: ○ = □ × 3을 시험하면 MC-CORR-SWAP-VARS', async ({ page }) => {
  await threePairs(page);
  await writeRuleByPad(page, '○ = □ × 3');
  await pollObservation(page, (o) => (o.misconceptions ?? []).includes('MC-CORR-SWAP-VARS'));
});

test('RECURSIVE: +3을 시험하면 MC-PATTERN-RECURSIVE-ONLY, 다시 확인 문구와 밑줄', async ({
  page,
}) => {
  await threePairs(page);
  await writeRuleByPad(page, '+3');
  await pollObservation(page, (o) =>
    (o.misconceptions ?? []).includes('MC-PATTERN-RECURSIVE-ONLY'),
  );
  await expect(page.getByTestId('rule-recheck')).toHaveText('식을 다시 확인해 볼까요?');
  await expect(page.getByTestId('rule-error-mark')).toBeVisible();
});

test('ADD-ONLY: 덧셈식을 두 번 시험하면 MC-FUNC-ADD-ONLY', async ({ page }) => {
  await threePairs(page);
  await writeRuleByPad(page, '□ = ○ + 2');
  await writeRuleByPad(page, '□ = ○ + 3');
  await pollObservation(page, (o) => (o.misconceptions ?? []).includes('MC-FUNC-ADD-ONLY'));
});

test('table: ○ 빈칸과 □ 빈칸을 채우면 cellsCorrect, DOM에 정답이 없다', async ({ page }) => {
  await open(
    page,
    'table',
    {
      ...HIDDEN_X3,
      rows: [
        { x: '1', y: '3' },
        { x: '2', y: null },
        { x: null, y: '12' },
      ],
    },
    'stage=fit',
  );
  await expect(page.locator('[data-col]')).toHaveCount(3);
  const html = await page.getByTestId('relation-canvas').innerHTML();
  expect(html).not.toContain('>6<');
  expect(html).not.toContain('>4<');
  await page.locator('[data-cell="1.y"]').click();
  await pad(page, '6').click();
  await pollObservation(page, (o) => o.cellsCorrect === false && o.cellsComplete === false);
  await page.locator('[data-cell="2.x"]').click();
  await pad(page, '4').click();
  await pollObservation(page, (o) => o.cellsCorrect === true);
  await capture(page, 'T173-table');
});

test('table 키보드만: 빈칸에 Tab·포커스로 들어가 수를 쓰고 식 칸으로 옮겨 시험한다', async ({
  page,
}) => {
  await open(page, 'table', {
    ...HIDDEN_X3,
    rows: [
      { x: '1', y: '3' },
      { x: '2', y: null },
      { x: null, y: '12' },
    ],
  });
  await page.locator('[data-cell="1.y"]').focus();
  await page.keyboard.press('6');
  await page.locator('[data-cell="2.x"]').focus();
  await page.keyboard.press('4');
  await pollObservation(page, (o) => o.cellsCorrect === true);
  await page.keyboard.press('Enter');
  await page.keyboard.type('b=o*3');
  await page.keyboard.press('Enter');
  await pollObservation(page, (o) => o.holdsAll === true && o.matchesHidden === true);
});

const CHAIRS = {
  scene: 'chairs-legs',
  rule: '□ = ○ × 4',
  x: { min: 1, max: 10 },
  blankRows: [5],
};

test('covary chairs-legs: 슬라이더 키보드로 5까지, 빈칸 줄 장면 글자에 □가 없고 20을 쓰면 cellsCorrect', async ({
  page,
}) => {
  await open(page, 'covary', CHAIRS, 'stage=fit');
  await capture(page, 'T173-covary-first');
  await expect(page.getByTestId('scene-readout')).toHaveText('○ = 1, □ = 4');
  await page.getByRole('slider').focus();
  for (let i = 0; i < 4; i += 1) await page.keyboard.press('ArrowRight');
  await pollObservation(page, (o) => o.x === '5');
  await expect(page.locator('[data-col]')).toHaveCount(5);
  await expect(page.getByTestId('scene-readout')).toHaveText('○ = 5');
  await expect(page.locator('[data-cell="5.y"]')).toBeVisible();
  await expect(page.locator('[data-testid="scene-canvas"] [data-chair]')).toHaveCount(5);
  await page.keyboard.press('2');
  await page.keyboard.press('0');
  await pollObservation(page, (o) => o.cellsCorrect === true);
  await page.keyboard.press('End');
  await pollObservation(page, (o) => o.x === '10');
  await page.keyboard.press('Home');
  await pollObservation(page, (o) => o.x === '1');
});

/** 오버레이 svg 상자가 relation-canvas 상자와 1px 이내로 같다. */
async function expectAligned(page: Page, overlay: string): Promise<void> {
  const canvas = page.getByTestId('relation-canvas');
  const layer = page.locator(`[data-overlay="${overlay}"]`);
  await expect(layer).toBeVisible();
  await expect
    .poll(async () => {
      const a = await canvas.boundingBox();
      const b = await layer.locator('svg').first().boundingBox();
      if (!a || !b) return Number.POSITIVE_INFINITY;
      return Math.max(
        Math.abs(a.x - b.x),
        Math.abs(a.y - b.y),
        Math.abs(a.width - b.width),
        Math.abs(a.height - b.height),
      );
    })
    .toBeLessThanOrEqual(1);
}

/** 표가 보이도록 조작 묶음을 스크롤한 뒤 판(stage) 전체를 찍는다. */
async function captureStage(page: Page, name: string): Promise<void> {
  await page.getByTestId('relation-canvas').scrollIntoViewIfNeeded();
  await page
    .locator('main > div[class*="stage"]')
    .first()
    .screenshot({
      path: `test-results/${name}-${test.info().project.name}.png`,
    });
}

async function toggleOverlay(page: Page): Promise<void> {
  await page.getByRole('button', { name: '힌트 겹쳐 보기' }).click();
}

async function threePairsWithOverlay(page: Page, overlay: string, extra = ''): Promise<void> {
  await open(page, 'black-box', HIDDEN_X3, `overlay=${overlay}${extra}`);
  for (const n of ['1', '2', '5']) await insertByPad(page, n);
  await pollObservation(page, (o) => o.trialCount === 3);
}

test('오버레이 fail-cols: 성립하지 않는 열 둘에 빨간 테두리, relation-canvas와 1px 안', async ({
  page,
}) => {
  await threePairsWithOverlay(page, 'fail-cols');
  await writeRuleByPad(page, '□ = ○ + 2');
  await toggleOverlay(page);
  await expectAligned(page, 'fail-cols');
  await expect(page.locator('[data-testid="fail-col"]')).toHaveCount(2);
  await expect(page.locator('[data-overlay="fail-cols"]')).toContainText('이 줄에서는 맞지 않아요');
  await captureStage(page, 'T173-overlay-fail-cols');
});

test('오버레이 diff-arrows: 이웃 열의 +1과 +3', async ({ page }) => {
  await threePairsWithOverlay(page, 'diff-arrows');
  await writeRuleByPad(page, '□ = ○ + 2');
  await writeRuleByPad(page, '□ = ○ + 3');
  await toggleOverlay(page);
  await expectAligned(page, 'diff-arrows');
  await expect(page.locator('[data-testid="diff-arrow"]')).toHaveCount(1);
  await expect(page.locator('[data-testid="diff-arrow-x"]')).toHaveText('+1');
  await expect(page.locator('[data-testid="diff-arrow-y"]')).toHaveText('+3');
  await captureStage(page, 'T173-overlay-diff-arrows');
});

test('오버레이 long-chain: +3 사슬과 97번 더', async ({ page }) => {
  await threePairsWithOverlay(page, 'long-chain', '&overlayArgs={"x":100}');
  await writeRuleByPad(page, '+3');
  await toggleOverlay(page);
  await expectAligned(page, 'long-chain');
  await expect(page.locator('[data-testid="long-chain-step"]')).toHaveCount(3);
  await expect(page.locator('[data-testid="long-chain-more"]')).toContainText('97번 더');
  await captureStage(page, 'T173-overlay-long-chain');
});

test('오버레이 swap-check: 내 식의 □와 표의 □를 나란히', async ({ page }) => {
  await threePairsWithOverlay(page, 'swap-check');
  await writeRuleByPad(page, '○ = □ × 3');
  await toggleOverlay(page);
  await expectAligned(page, 'swap-check');
  await expect(page.locator('[data-testid="swap-check-mine"]')).toHaveText(
    '○ = 1일 때 내 식의 □ = 1/3',
  );
  await expect(page.locator('[data-testid="swap-check-actual"]')).toHaveText(
    '표에서 같은 줄의 □ = 3',
  );
  await captureStage(page, 'T173-overlay-swap-check');
});

async function expectMin(locator: Locator, min: number, label: string): Promise<void> {
  const box = await locator.boundingBox();
  if (!box) throw new Error(`${label}: 상자를 찾지 못했습니다.`);
  console.log('T173', label, Math.round(box.width), Math.round(box.height));
  expect(Math.min(box.width, box.height), label).toBeGreaterThanOrEqual(min - 0.5);
}

for (const size of [48, 64] as const) {
  test(`터치 타깃 ${size}: 키패드 단추·표 칸·슬라이더 손잡이가 ${size}px 이상`, async ({
    page,
  }) => {
    await open(page, 'covary', CHAIRS, 'stage=fit');
    if (size === 64) await page.getByRole('button', { name: '터치 48px' }).click();
    await expectMin(page.getByTestId('covary-knob'), size, '슬라이더 손잡이');
    await expectMin(pad(page, '5'), size, '수 키패드');
    await expectMin(pad(page, '지우기'), size, '지우기');
    await page.getByRole('slider').focus();
    for (let i = 0; i < 4; i += 1) await page.keyboard.press('ArrowRight');
    await expectMin(page.locator('[data-cell="5.y"]'), size, '표 빈칸');
    await expectMin(page.locator('[data-col="0"] rect').first(), size, '표 칸');
    await page.getByTestId('rule-input').click();
    await expectMin(pad(page, '○'), size, '식 키패드 ○');
    await expectMin(pad(page, '규칙 시험하기'), size, '시험 단추');
  });
}

test('table 모드 표 칸이 64 설정에서 64px 이상이다', async ({ page }) => {
  await open(page, 'table', HIDDEN_X3, 'stage=fit');
  await page.getByRole('button', { name: '터치 48px' }).click();
  await expectMin(page.locator('[data-cell="1.y"]'), 64, '표 빈칸(64)');
});

test('black-box 넣기 단추와 입력 칸이 48px 이상이다', async ({ page }) => {
  await open(page, 'black-box', HIDDEN_X3, 'stage=fit');
  await expectMin(pad(page, '넣기'), 48, '넣기');
  await expectMin(page.getByTestId('input-draft'), 48, '입력 칸');
});
