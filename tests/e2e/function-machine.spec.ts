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
  // 시험한 뒤에는 formatRelation 모양으로 보인다.
  await expect(page.getByTestId('rule-input')).toHaveText('□ = ○ × 3');
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
async function captureStage(page: Page, name: string, canvasId = 'relation-canvas'): Promise<void> {
  await page.getByTestId(canvasId).scrollIntoViewIfNeeded();
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

/** 화면 기준 이미지: 샌드박스 `?stage=fit` 판 전체(페이지 화면). 크롬북·아이패드만 찍는다. */
async function expectPageSnapshot(page: Page, name: string): Promise<void> {
  test.skip(test.info().project.name === 'board', '기준 이미지는 크롬북·아이패드만 둔다.');
  await page.waitForTimeout(900); // 출구 숫자가 나타나는 짧은 애니메이션이 끝나도록
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(page).toHaveScreenshot(name, { fullPage: true, animations: 'disabled' });
}

test('화면 기준: black-box 3쌍을 넣은 뒤(식 시험 전)', async ({ page }) => {
  await threePairs(page);
  await expectPageSnapshot(page, 'function-machine-black-box.png');
});

test('화면 기준: covary 첫 화면', async ({ page }) => {
  await open(page, 'covary', CHAIRS, 'stage=fit');
  await expectPageSnapshot(page, 'function-machine-covary.png');
});

test('화면 기준: table 첫 화면', async ({ page }) => {
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
  await expectPageSnapshot(page, 'function-machine-table.png');
});

test('키패드 맨 아래 단추가 스크롤로 닿아 눌린다(세 모드)', async ({ page }) => {
  // black-box 수 키패드: 맨 아래 단추는 "지우기"
  await open(page, 'black-box', HIDDEN_X3, 'stage=fit');
  await pad(page, '7').click();
  await expect(page.getByTestId('input-draft')).toContainText('7');
  await pad(page, '지우기').click();
  await expect(page.getByTestId('input-draft')).not.toContainText('7');
  // black-box 식 키패드: 맨 아래 단추는 "규칙 시험하기"
  await page.getByTestId('rule-input').click();
  await pad(page, '○').click();
  const test = pad(page, '규칙 시험하기');
  await test.scrollIntoViewIfNeeded();
  await expect(test).toBeInViewport();
  await test.click();
  await pollObservation(page, (o) => o.testedText === '○');

  // table 수 키패드: 맨 아래 단추는 "다 썼어요"
  await open(page, 'table', HIDDEN_X3, 'stage=fit');
  const done = pad(page, '다 썼어요');
  await done.scrollIntoViewIfNeeded();
  await expect(done).toBeInViewport();
  await done.click();
  await expect(page.getByTestId('rule-input')).toHaveAttribute('data-active', 'true');
  const test2 = pad(page, '규칙 시험하기');
  await test2.scrollIntoViewIfNeeded();
  await expect(test2).toBeInViewport();
  await pad(page, '=').click();
  await test2.click();
  await pollObservation(page, (o) => o.testedText === '=');

  // covary
  await open(page, 'covary', CHAIRS, 'stage=fit');
  const done2 = pad(page, '다 썼어요');
  await done2.scrollIntoViewIfNeeded();
  await expect(done2).toBeInViewport();
  await done2.click();
  await expect(page.getByTestId('rule-input')).toHaveAttribute('data-active', 'true');
});

// ─────────────────────────────────────────────────────────────
// T174 rule-shooter: 관계식 레이저로 보석 맞히기
// ─────────────────────────────────────────────────────────────

const SHOOTER = {
  gems: [
    [1, 3],
    [2, 6],
    [4, 12],
  ],
  rule: '□ = ○ × 3',
};

/** 식 키패드로 식을 쓰고 "발사"를 누른다(발사 모드는 처음부터 식 키패드가 열려 있다). */
async function shootByPad(page: Page, text: string, fire = true): Promise<void> {
  await pad(page, '모두 지우기').click();
  for (const ch of text) {
    if (ch === ' ') continue;
    await pad(page, ch).click();
  }
  if (fire) await pad(page, '발사').click();
}

async function openShooter(page: Page, config: unknown = SHOOTER, query = 'stage=fit') {
  await open(page, 'rule-shooter', config, query);
  await expect(page.locator('[data-gem]')).toHaveCount(3);
}

test('rule-shooter: □ = ○ + 2는 ✓ 1개·✕ 2개·패널 2줄·ONE-PAIR, 이어서 □ = ○ × 3은 allHit', async ({
  page,
}) => {
  await openShooter(page);
  await expect(page.locator('[data-badge]')).toHaveCount(0);
  await expect(page.getByTestId('miss-panel')).toHaveCount(0);

  await shootByPad(page, '□ = ○ + 2');
  await pollObservation(
    page,
    (o) =>
      (o.misconceptions ?? []).includes('MC-PATTERN-ONE-PAIR') &&
      o.hitCount === 1 &&
      o.allHit === false,
  );
  await expect(page.locator('[data-badge="hit"]')).toHaveCount(1);
  await expect(page.locator('[data-badge="miss"]')).toHaveCount(2);
  await expect(page.locator('[data-testid="miss-panel"] [data-miss]')).toHaveCount(2);
  await expect(page.locator('[data-testid="miss-panel"] [data-miss] span').first()).toHaveText(
    '이 보석의 ○는 2인데, 내 식에 넣으면 □는 4이에요.',
  );
  // 숨은 규칙(× 3)이 판 화면에 없다.
  const html = await page.getByTestId('function-board').innerHTML();
  expect(html).not.toContain('× 3');
  await capture(page, 'T174-shooter-miss');

  await shootByPad(page, '□ = ○ × 3');
  await pollObservation(page, (o) => o.allHit === true && o.shotCount === 2);
  await expect(page.locator('[data-badge="hit"]')).toHaveCount(3);
  await expect(page.getByTestId('miss-panel')).toHaveCount(0);
  // 식을 고치면 표시가 사라진다.
  await pad(page, '지우기').click();
  await expect(page.locator('[data-badge]')).toHaveCount(0);
});

test('rule-shooter 키보드만: b=o+2 Enter, 이어서 b=o*3 Enter', async ({ page }) => {
  await openShooter(page);
  await page.getByTestId('rule-input').focus();
  await page.keyboard.type('b=o+2');
  await page.keyboard.press('Enter');
  await pollObservation(page, (o) => o.hitCount === 1 && o.allHit === false);
  await expect(page.locator('[data-badge="miss"]')).toHaveCount(2);
  for (let i = 0; i < 5; i += 1) await page.keyboard.press('Backspace');
  await page.keyboard.type('b=o*3');
  await page.keyboard.press('Enter');
  await pollObservation(page, (o) => o.allHit === true);
  await expect(page.locator('[data-badge="hit"]')).toHaveCount(3);
});

test('rule-shooter 레이저 점은 원과 십자다', async ({ page }) => {
  await openShooter(page);
  await shootByPad(page, '□ = ○ × 3');
  await pollObservation(page, (o) => o.allHit === true);
  // 격자 ○ 0..7, □ 0..15 안: □ = ○ × 3은 ○ = 0..5
  await expect(page.locator('[data-laser]')).toHaveCount(6);
  await expect(page.locator('[data-laser="1"] circle')).toHaveCount(1);
  await expect(page.locator('[data-laser="1"] path')).toHaveCount(1);
});

test('rule-shooter look: table은 격자 없이 보석 표와 ✓/✕만 그린다', async ({ page }) => {
  await open(page, 'rule-shooter', { ...SHOOTER, look: 'table' }, 'stage=fit');
  await expect(page.getByTestId('shooter-canvas')).toHaveCount(0);
  await expect(page.getByTestId('relation-canvas')).toBeVisible();
  await expect(page.locator('[data-col]')).toHaveCount(3);
  await shootByPad(page, '□ = ○ + 2');
  await pollObservation(page, (o) => o.hitCount === 1);
  await expect(page.locator('[data-mark="ok"]')).toHaveCount(1);
  await expect(page.locator('[data-mark="bad"]')).toHaveCount(2);
  await expect(page.locator('[data-laser]')).toHaveCount(0);
  await capture(page, 'T174-shooter-table');
});

test('오버레이 laser-miss: shooter-canvas와 1px 안, 빗나간 보석 둘에 점선', async ({ page }) => {
  await openShooter(page, SHOOTER, 'stage=fit&overlay=laser-miss');
  await shootByPad(page, '□ = ○ + 2');
  await pollObservation(page, (o) => o.hitCount === 1);
  await toggleOverlay(page);
  const canvas = page.getByTestId('shooter-canvas');
  const layer = page.locator('[data-overlay="laser-miss"]');
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
  await expect(page.locator('[data-testid="laser-miss-gap"]')).toHaveCount(2);
  await expect(page.locator('[data-testid="laser-miss-hit"]')).toHaveCount(1);
  await expect(page.locator('[data-testid="laser-miss-text"]').first()).toHaveText(
    '보석 □ = 6, 내 식 □ = 4',
  );
  await captureStage(page, 'T174-overlay-laser-miss', 'shooter-canvas');
});

test('오버레이 swap-check: 격자에서는 shooter-canvas 위에 그린다', async ({ page }) => {
  await openShooter(page, SHOOTER, 'stage=fit&overlay=swap-check');
  await shootByPad(page, '○ = □ × 3');
  await pollObservation(page, (o) => (o.misconceptions ?? []).includes('MC-CORR-SWAP-VARS'));
  await toggleOverlay(page);
  const layer = page.locator('[data-overlay="swap-check"]');
  await expect(layer).toBeVisible();
  await expect
    .poll(async () => {
      const a = await page.getByTestId('shooter-canvas').boundingBox();
      const b = await layer.locator('svg').first().boundingBox();
      if (!a || !b) return Number.POSITIVE_INFINITY;
      return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y), Math.abs(a.width - b.width));
    })
    .toBeLessThanOrEqual(1);
  await expect(page.locator('[data-testid="swap-check-mine"]')).toHaveText(
    '○ = 1일 때 내 식의 □ = 1/3',
  );
});

test('rule-shooter 터치 타깃: 보석 24px 이상, 발사·키패드 단추 48px 이상(64 설정은 64)', async ({
  page,
}) => {
  await openShooter(page);
  const gem = await page.locator('[data-gem="0"] polygon').boundingBox();
  if (!gem) throw new Error('보석을 찾지 못했습니다.');
  expect(Math.min(gem.width, gem.height)).toBeGreaterThanOrEqual(24);
  await expectMin(pad(page, '발사'), 48, '발사');
  await expectMin(pad(page, '○'), 48, '식 키패드 ○');
  await page.getByRole('button', { name: '터치 48px' }).click();
  await expectMin(pad(page, '발사'), 64, '발사(64)');
  await expectMin(pad(page, '5'), 64, '키패드 5(64)');
});

test('화면 기준: rule-shooter □ = ○ + 2를 발사한 뒤', async ({ page }) => {
  await openShooter(page);
  await shootByPad(page, '□ = ○ + 2');
  await pollObservation(page, (o) => o.hitCount === 1);
  // 발사 단추를 누르며 조작 묶음이 아래로 스크롤됐으므로 맨 위(빗나간 보석 패널)로 되돌려 찍는다.
  await page
    .locator('[class*="sideStack"]')
    .first()
    .evaluate((element) => {
      element.scrollTop = 0;
    });
  await expectPageSnapshot(page, 'function-machine-rule-shooter.png');
});

test('rule-shooter: 키패드 맨 아래 단추(발사)가 스크롤로 닿아 눌린다', async ({ page }) => {
  await openShooter(page);
  await pad(page, '○').click();
  const fire = pad(page, '발사');
  await fire.scrollIntoViewIfNeeded();
  await expect(fire).toBeInViewport();
  await fire.click();
  await pollObservation(page, (o) => o.testedText === '○');
});
