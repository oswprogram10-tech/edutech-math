import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

/**
 * E15 규칙·패턴 샌드박스 E2E. 아이패드(WebKit)·크롬북·전자칠판 뷰포트에서 모두 돈다.
 *
 * - sequence: 팔레트 탭, 키보드만, 끌어 놓기, ▶ 재생 강조 순서, translate.
 * - hundred-chart: 숫자 패드·키보드 입력, 칠하기, 오개념.
 * - 힌트 ② 오버레이 4개가 본 캔버스와 1px 안에 겹친다.
 * - 저학년 64 설정에서 터치 대상 크기.
 */

test.describe.configure({ timeout: 120_000 });

interface ObservationRecord {
  readonly mode?: string;
  readonly slots?: (string | null)[];
  readonly continuesGiven?: boolean;
  readonly misconceptions?: string[];
  readonly consistent?: boolean;
  readonly sent?: boolean;
  readonly restoredMatches?: boolean;
  readonly entriesCorrect?: boolean;
  readonly entries?: Record<string, number | null>;
  readonly painted?: number[];
  readonly selected?: number | null;
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

async function open(
  page: Page,
  mode: 'sequence' | 'hundred-chart' | 'calc-pattern' | 'growth',
  config: unknown,
  query = '',
) {
  const params = new URLSearchParams({ config: JSON.stringify(config) });
  if (query) for (const [key, value] of new URLSearchParams(query)) params.set(key, value);
  await page.goto(`/?${params.toString()}#/sandbox/E15`);
  await expect(page.getByRole('heading', { name: '규칙·패턴' })).toBeVisible();
  if (mode !== 'sequence') await page.getByLabel('모드').selectOption(mode);
  await pollObservation(page, (observation) => observation.mode === mode);
}

function palette(page: Page, name: string): Locator {
  return page.getByTestId('pattern-palette').getByRole('button', { name, exact: true });
}

async function capture(page: Page, name: string): Promise<void> {
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: `test-results/${name}-${test.info().project.name}.png`,
    fullPage: true,
  });
}

const EXTEND = {
  items: ['circle', 'triangle', 'square'],
  given: ['circle', 'triangle', 'circle', 'triangle', 'circle'],
  blanks: 3,
};

const TRANSLATE = {
  variant: 'translate',
  source: ['apple', 'banana', 'banana'],
  repeat: 2,
  targetAlphabet: ['1', '2', '3'],
};

test('팔레트 탭으로 ○△○△○ 뒤를 채우면 continuesGiven, ○○○이면 LAST-ONLY', async ({ page }) => {
  await open(page, 'sequence', EXTEND);
  await palette(page, '세모').click();
  await palette(page, '동그라미').click();
  await palette(page, '세모').click();
  await pollObservation(
    page,
    (o) => o.continuesGiven === true && (o.misconceptions ?? []).length === 0,
  );
  await capture(page, 'T170-sequence-extend');

  await page.getByRole('button', { name: '모두 지우기' }).click();
  await pollObservation(page, (o) => (o.slots ?? []).every((slot) => slot === null));
  for (let i = 0; i < 3; i += 1) await palette(page, '동그라미').click();
  await pollObservation(
    page,
    (o) => o.continuesGiven === false && (o.misconceptions ?? []).includes('MC-PATTERN-LAST-ONLY'),
  );
});

test('키보드만으로 1·2·1을 놓고 ←·Backspace로 지운다', async ({ page }) => {
  await open(page, 'sequence', EXTEND);
  await page.getByTestId('pattern-canvas').focus();
  await page.keyboard.press('1');
  await page.keyboard.press('2');
  await page.keyboard.press('1');
  await pollObservation(
    page,
    (o) => JSON.stringify(o.slots) === JSON.stringify(['circle', 'triangle', 'circle']),
  );
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('Backspace');
  await pollObservation(
    page,
    (o) => JSON.stringify(o.slots) === JSON.stringify(['circle', null, 'circle']),
  );
  await page.keyboard.press('2');
  await expect(page.getByTestId('pattern-live')).toHaveText('2번째 칸에 세모');
  // 맞고 틀림을 말하지 않는다.
  await expect(page.getByTestId('pattern-live')).not.toContainText(/맞|틀/);
});

test('팔레트 카드를 2번째 빈칸으로 끌어 놓는다', async ({ page }) => {
  await open(page, 'sequence', EXTEND);
  const card = await palette(page, '네모').boundingBox();
  const slot = await page.getByTestId('pattern-slot-1').boundingBox();
  if (!card || !slot) throw new Error('상자를 찾지 못했습니다.');
  await page.mouse.move(card.x + card.width / 2, card.y + card.height / 2);
  await page.mouse.down();
  await page.mouse.move(card.x + card.width / 2 + 20, card.y + card.height / 2 + 20, { steps: 3 });
  await page.mouse.move(slot.x + slot.width / 2, slot.y + slot.height / 2, { steps: 8 });
  await page.mouse.up();
  await pollObservation(
    page,
    (o) => JSON.stringify(o.slots) === JSON.stringify([null, 'square', null]),
  );
});

test('▶ 재생: 강조가 칸 순서대로 옮겨 간다', async ({ page }) => {
  await open(page, 'sequence', {
    items: ['circle', 'triangle'],
    given: ['circle', 'triangle', 'circle'],
    blanks: 3,
  });
  await palette(page, '세모').click();
  await palette(page, '동그라미').click();
  await page.evaluate(() => {
    const seen: string[] = [];
    (window as unknown as { __seen: string[] }).__seen = seen;
    const scan = () => {
      const node = document.querySelector('[data-playing="true"]');
      const id = node?.getAttribute('data-testid');
      if (id && seen[seen.length - 1] !== id) seen.push(id);
    };
    new MutationObserver(scan).observe(document.body, {
      subtree: true,
      attributes: true,
      attributeFilter: ['data-playing'],
    });
  });
  await page.getByRole('button', { name: '▶ 들어 보기' }).click();
  await expect
    .poll(
      async () => page.evaluate(() => (window as unknown as { __seen: string[] }).__seen.length),
      {
        timeout: 10_000,
      },
    )
    .toBeGreaterThanOrEqual(5);
  const seen = await page.evaluate(() => (window as unknown as { __seen: string[] }).__seen);
  // 빈칸(셋째)은 비어 있어서 거기서 멈춘다.
  expect(seen).toEqual([
    'pattern-given-0',
    'pattern-given-1',
    'pattern-given-2',
    'pattern-slot-0',
    'pattern-slot-1',
  ]);
  await expect(page.locator('[data-playing="true"]')).toHaveCount(0, { timeout: 5_000 });
});

test('translate: 1·2·2·1·2·2는 consistent이고 보내기 뒤 되돌린 줄이 같다', async ({ page }) => {
  await open(page, 'sequence', TRANSLATE);
  for (const name of ['1', '2', '2', '1', '2', '2']) await palette(page, name).click();
  await pollObservation(page, (o) => o.consistent === true);
  await page.getByRole('button', { name: '보내기' }).click();
  await pollObservation(page, (o) => o.sent === true && o.restoredMatches === true);
  await expect(page.locator('[data-testid^="pattern-restored-x-"]')).toHaveCount(0);
  await expect(page.getByTestId('pattern-restored-5')).toBeVisible();
  await capture(page, 'T170-translate');
});

test('translate: 1·2·2·1·3·2는 TRANSLATE 오개념, 모두 1이면 되돌린 줄에 ✕', async ({ page }) => {
  await open(page, 'sequence', TRANSLATE);
  for (const name of ['1', '2', '2', '1', '3', '2']) await palette(page, name).click();
  await pollObservation(
    page,
    (o) => o.consistent === false && (o.misconceptions ?? []).includes('MC-PATTERN-TRANSLATE'),
  );
  // 열쇠(사과→1, 바나나→2)에 없는 3을 쓴 5번째 칸만 ✕
  await page.getByRole('button', { name: '보내기' }).click();
  await pollObservation(page, (o) => o.sent === true && o.restoredMatches === false);
  await expect(page.locator('[data-testid^="pattern-restored-x-"]')).toHaveCount(1);
  await expect(page.getByTestId('pattern-restored-x-4')).toBeVisible();

  await page.getByRole('button', { name: '모두 지우기' }).click();
  for (let i = 0; i < 6; i += 1) await palette(page, '1').click();
  await page.getByRole('button', { name: '보내기' }).click();
  await pollObservation(page, (o) => o.sent === true && o.restoredMatches === false);
  await expect(page.locator('[data-testid^="pattern-restored-x-"]')).toHaveCount(6);
});

test('sound-only: 주어진 칸 DOM에 토큰이 없고 ▶로 소리를 낼 수 있다', async ({ page }) => {
  await open(page, 'sequence', { ...EXTEND, givenDisplay: 'sound-only' });
  const given = page.locator('[data-testid^="pattern-given-"]');
  await expect(given).toHaveCount(5);
  await expect(page.locator('[data-testid^="pattern-given-"][data-token]')).toHaveCount(0);
  const html = await page.getByTestId('pattern-track').innerHTML();
  expect(html).not.toMatch(/circle|triangle|동그라미|세모/);
  await page.getByRole('button', { name: '▶ 들어 보기' }).click();
  await expect(page.locator('[data-playing="true"]').first()).toBeVisible();
});

test('hundred-chart: 46 cross의 가린 칸을 숫자 패드로 46 입력하면 entriesCorrect', async ({
  page,
}) => {
  await open(page, 'hundred-chart', { hidden: 'cross', center: 46, view: 'cross-only' });
  await expect(page.locator('[data-cell="46"]')).toHaveCount(0);
  await expect(page.locator('[data-hidden="0"]')).toHaveAttribute('aria-label', '가려진 칸');
  const pad = page.getByTestId('chart-pad');
  await expect(pad.getByRole('button', { name: '4', exact: true })).toBeDisabled();
  await page.locator('[data-hidden="0"]').click();
  await pad.getByRole('button', { name: '4', exact: true }).click();
  await pad.getByRole('button', { name: '6', exact: true }).click();
  await pollObservation(page, (o) => o.entriesCorrect === true);
  await capture(page, 'T170-chart-cross');
  await pad.getByRole('button', { name: '다 썼어요' }).click();
  await expect(page.locator('[data-hidden="0"][data-active="true"]')).toHaveCount(0);

  // 위 칸(36)보다 1 큰 37을 쓰면 MC-CHART-ROW-COL
  await page.locator('[data-hidden="0"]').click();
  await pad.getByRole('button', { name: '지우기' }).click();
  await pad.getByRole('button', { name: '지우기' }).click();
  await pad.getByRole('button', { name: '3', exact: true }).click();
  await pad.getByRole('button', { name: '7', exact: true }).click();
  await pollObservation(
    page,
    (o) => o.entriesCorrect === false && (o.misconceptions ?? []).includes('MC-CHART-ROW-COL'),
  );
});

test('hundred-chart: 키보드만으로 가린 칸 입력과 칠하기', async ({ page }) => {
  await open(page, 'hundred-chart', { hidden: 'cross', center: 46, view: 'cross-only' });
  await page.getByTestId('chart-canvas').focus();
  await page.keyboard.press('Enter');
  await page.keyboard.press('4');
  await page.keyboard.press('6');
  await pollObservation(page, (o) => o.entriesCorrect === true);
  await page.keyboard.press('Escape');
  await page.keyboard.press('ArrowRight');
  await expect(page.getByTestId('chart-live')).toHaveText('47번 칸');
  await page.keyboard.press('ArrowLeft');
  await expect(page.getByTestId('chart-live')).toHaveText('가려진 칸');

  await open(page, 'hundred-chart', { paint: true });
  await page.getByTestId('chart-canvas').focus();
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await pollObservation(page, (o) => JSON.stringify(o.painted) === JSON.stringify([46, 47, 57]));
  await expect(page.getByTestId('chart-live')).toHaveText('칠했어요');
});

test('hundred-chart: 2씩 30까지 칠하기와 칸 고르기', async ({ page }) => {
  await open(page, 'hundred-chart', { paint: true, select: false });
  for (let cell = 2; cell <= 30; cell += 2) {
    await page.locator(`[data-cell="${cell}"]`).click();
  }
  const evens = Array.from({ length: 15 }, (_, index) => (index + 1) * 2);
  await pollObservation(page, (o) => JSON.stringify(o.painted) === JSON.stringify(evens));
  await capture(page, 'T170-chart-paint');

  await open(page, 'hundred-chart', { select: true });
  await page.locator('[data-cell="46"]').click();
  await pollObservation(page, (o) => o.selected === 46);
});

/** 오버레이 svg 상자가 본 캔버스 svg 상자와 1px 이내로 같다. */
async function expectAligned(page: Page, overlay: string, canvasTestId: string): Promise<void> {
  const canvas = page.getByTestId(canvasTestId);
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

async function toggleOverlay(page: Page): Promise<void> {
  await page.getByRole('button', { name: '힌트 겹쳐 보기' }).click();
}

test('오버레이 core-boxes가 본 캔버스와 1px 안에 겹친다', async ({ page }) => {
  await open(
    page,
    'sequence',
    {
      items: ['circle', 'triangle'],
      given: ['circle', 'circle', 'triangle', 'circle', 'circle', 'triangle'],
      blanks: 3,
    },
    'overlay=core-boxes',
  );
  await palette(page, '동그라미').click();
  await palette(page, '세모').click();
  await palette(page, '동그라미').click();
  await pollObservation(page, (o) => (o.misconceptions ?? []).includes('MC-PATTERN-CORE'));
  await toggleOverlay(page);
  await expectAligned(page, 'core-boxes', 'pattern-canvas');
  // ○○△○○△ 뒤 ○△○: 둘째·셋째 칸이 바로 앞 상자의 같은 자리와 달라 ✕ 둘
  await expect(
    page.locator('[data-overlay="core-boxes"] [data-testid="core-boxes-x"]'),
  ).toHaveCount(2);
  await capture(page, 'T170-overlay-core-boxes');
});

test('오버레이 replay-break가 본 캔버스와 1px 안에 겹치고 다시 듣기가 눌린다', async ({ page }) => {
  await open(page, 'sequence', EXTEND, 'overlay=replay-break');
  for (let i = 0; i < 3; i += 1) await palette(page, '동그라미').click();
  await toggleOverlay(page);
  await expectAligned(page, 'replay-break', 'pattern-canvas');
  await expect(page.locator('[data-overlay="replay-break"]')).toContainText(
    '여기서 리듬이 바뀌어요',
  );
  await page.locator('[data-testid="replay-break-play"]').click({ force: true });
  await expect(page.locator('[data-testid="replay-break-lit"]').first()).toBeVisible();
});

test('오버레이 mapping-card가 본 캔버스와 1px 안에 겹친다', async ({ page }) => {
  await open(page, 'sequence', TRANSLATE, 'overlay=mapping-card');
  for (const name of ['1', '2', '2', '1', '3', '2']) await palette(page, name).click();
  await toggleOverlay(page);
  await expectAligned(page, 'mapping-card', 'pattern-canvas');
  await expect(page.locator('[data-testid="mapping-card-item"]')).toHaveCount(2);
  await expect(page.locator('[data-testid="mapping-card-x"]')).toHaveCount(1);
});

test('오버레이 ten-step이 본 캔버스와 1px 안에 겹친다', async ({ page }) => {
  await open(page, 'hundred-chart', { hidden: [46] }, 'overlay=ten-step');
  await page.locator('[data-hidden="0"]').click();
  const pad = page.getByTestId('chart-pad');
  await pad.getByRole('button', { name: '3', exact: true }).click();
  await pad.getByRole('button', { name: '7', exact: true }).click();
  await pollObservation(page, (o) => (o.misconceptions ?? []).includes('MC-CHART-ROW-COL'));
  await toggleOverlay(page);
  await expectAligned(page, 'ten-step', 'chart-canvas');
  await expect(page.locator('[data-testid="ten-step-rod"]')).toHaveCount(3);
  await capture(page, 'T170-overlay-ten-step');
});

async function expectMin(locator: Locator, min: number, label: string): Promise<void> {
  const box = await locator.boundingBox();
  if (!box) throw new Error(`${label}: 상자를 찾지 못했습니다.`);
  console.log('T170', label, Math.round(box.width), Math.round(box.height));
  expect(Math.min(box.width, box.height), label).toBeGreaterThanOrEqual(min - 0.5);
}

test('저학년 64 설정: 빈칸·팔레트·숫자 패드 단추가 64px 이상, 배열표 칸이 48px 이상', async ({
  page,
}) => {
  await open(page, 'sequence', EXTEND, 'stage=fit');
  await page.getByRole('button', { name: '터치 48px' }).click();
  await expectMin(page.getByTestId('pattern-slot-0'), 64, '빈칸');
  await expectMin(palette(page, '세모'), 64, '팔레트');

  await open(page, 'hundred-chart', { hidden: 'cross', center: 46 }, 'stage=fit');
  await page.getByRole('button', { name: '터치 48px' }).click();
  await expectMin(
    page.getByTestId('chart-pad').getByRole('button', { name: '5', exact: true }),
    64,
    '숫자 패드',
  );
  await page.locator('[data-hidden="0"]').click();
  await expectMin(
    page.getByTestId('chart-pad').getByRole('button', { name: '5', exact: true }),
    64,
    '숫자 패드',
  );
  await expectMin(page.locator('[data-cell="45"]'), 48, '배열표 칸(64 설정)');
});

test('배열표 칸은 크롬북 stage=fit에서 48px(64 설정 64px) 이상이고 맨 아래 줄까지 닿는다', async ({
  page,
}, testInfo) => {
  await open(page, 'hundred-chart', { hidden: [46], paint: true }, 'stage=fit');
  await expectMin(page.locator('[data-cell="45"]'), 48, '배열표 칸(48)');
  await page.locator('[data-cell="100"]').click();
  await pollObservation(page, (o) => (o.painted ?? []).includes(100));
  await page.locator('[data-hidden="0"]').click();
  await expect(
    page.getByTestId('chart-pad').getByRole('button', { name: '5', exact: true }),
  ).toBeInViewport();
  await page.getByRole('button', { name: '터치 48px' }).click();
  await expectMin(page.locator('[data-cell="45"]'), 64, '배열표 칸(64)');
  await page.locator('[data-cell="91"]').click();
  await pollObservation(page, (o) => (o.painted ?? []).includes(91));
  await expect(
    page.getByTestId('chart-pad').getByRole('button', { name: '5', exact: true }),
  ).toBeInViewport();
  console.log('T170', testInfo.project.name, 'scroll-check');
});

test('translate: 48 설정에서 빈칸이 48px 이상이고 줄 이름 글자가 14px 이상이다', async ({
  page,
}) => {
  await open(page, 'sequence', TRANSLATE, 'stage=fit');
  await expectMin(page.getByTestId('pattern-slot-0'), 48, 'translate 빈칸');
  await expectMin(page.getByTestId('pattern-slot-5'), 48, 'translate 마지막 빈칸');
  const px = await page.getByTestId('pattern-canvas').evaluate((svg) => {
    const root = svg as unknown as SVGSVGElement;
    const label = root.querySelector('[data-testid="pattern-track"] text');
    if (!label) return 0;
    return (
      Number(label.getAttribute('font-size')) *
      (root.getBoundingClientRect().width / root.viewBox.baseVal.width)
    );
  });
  console.log('T170 translate 줄 이름 글자', Math.round(px * 10) / 10);
  expect(px).toBeGreaterThanOrEqual(14);
});

test('48 설정에서 빈칸·팔레트 48px 이상, 10x10 칸 한 변을 잰다', async ({ page }) => {
  await open(page, 'sequence', EXTEND, 'stage=fit');
  await expectMin(page.getByTestId('pattern-slot-0'), 48, '빈칸(48)');
  await expectMin(palette(page, '세모'), 48, '팔레트(48)');
  await open(page, 'hundred-chart', {}, 'stage=fit');
  await expectMin(page.locator('[data-cell="45"]'), 48, '배열표 칸 10x10(48)');
  await capture(page, 'T170-chart-full');
});

// ───────── calc-pattern (T175) ─────────

const CALC = { pattern: 'symmetric-sum-square', stepsShown: 3, workStep: 4 };
const REPUNIT = { pattern: 'repunit-square', stepsShown: 4, workStep: 5 };
const PYRAMID4 = [1, 2, 3, 4, 3, 2, 1];

function buildCell(page: Page, col: number, h: number): Locator {
  return page.locator(`[data-testid="calc-build"] rect[data-col="${col}"][data-h="${h}"]`);
}

function calcPad(page: Page, name: string): Locator {
  return page.getByTestId('calc-pad').getByRole('button', { name, exact: true });
}

async function tapExpr(page: Page, text: string): Promise<void> {
  for (const key of text) await calcPad(page, key).click();
}

test('calc-pattern: 4단계 블록을 포인터로 쌓으면 builtIsPyramid이고 블록 16개', async ({
  page,
}) => {
  await open(page, 'calc-pattern', CALC, 'stage=fit');
  // 1열부터 쌓아도(앞 열을 비워 두어도) 앞뒤 빈 열은 보지 않는다.
  for (const [index, h] of PYRAMID4.entries()) await buildCell(page, index + 1, h).click();
  await pollObservation(
    page,
    (o) => o.builtIsPyramid === true && o.builtTotal === 16 && o.workStep === 4,
  );
  await expect(page.getByTestId('calc-built-count')).toHaveText('블록 16개');
  // 맞고 틀림을 그리지 않는다.
  await expect(page.getByTestId('calc-build')).not.toContainText(/[✓✕]/);
  await page.getByRole('button', { name: '블록 모두 치우기' }).click();
  await pollObservation(page, (o) => o.builtTotal === 0 && o.builtIsPyramid === false);
});

test('calc-pattern: 한 열만 덧붙이면 RECURSIVE-ONLY, 식 9+7=16도 같은 오개념', async ({ page }) => {
  await open(page, 'calc-pattern', CALC);
  for (const [index, h] of [1, 2, 3, 2, 1, 4].entries()) await buildCell(page, index, h).click();
  await pollObservation(page, (o) =>
    (o.misconceptions ?? []).includes('MC-PATTERN-RECURSIVE-ONLY'),
  );
  await page.getByRole('button', { name: '블록 모두 치우기' }).click();
  await pollObservation(page, (o) => (o.misconceptions ?? []).length === 0);
  await tapExpr(page, '9+7=16');
  await pollObservation(page, (o) =>
    (o.misconceptions ?? []).includes('MC-PATTERN-RECURSIVE-ONLY'),
  );
});

test('calc-pattern: 식 1+2+3+4+3+2+1=4×4를 키패드로 쓰면 exprHolds와 exprAddends', async ({
  page,
}) => {
  await open(page, 'calc-pattern', CALC);
  await tapExpr(page, '1+2+3+4+3+2+1=4×4');
  await pollObservation(
    page,
    (o) =>
      o.exprHolds === true &&
      JSON.stringify(o.exprAddends) === JSON.stringify(['1', '2', '3', '4', '3', '2', '1']) &&
      JSON.stringify(o.exprFactors) === JSON.stringify(['4', '4']),
  );
  await expect(page.getByTestId('calc-expr')).toContainText('1 + 2 + 3 + 4 + 3 + 2 + 1 = 4 × 4');
  await expect(page.getByTestId('calc-expr')).not.toContainText(/[✓✕]/);
  await calcPad(page, '지우기').click();
  await calcPad(page, '6').click();
  await pollObservation(page, (o) => o.exprHolds === false && o.exprValid === true);
  await calcPad(page, '모두 지우기').click();
  await pollObservation(page, (o) => o.exprText === '');
});

test('calc-pattern: 읽을 수 없는 식에는 밑줄 표시가 생긴다', async ({ page }) => {
  await open(page, 'calc-pattern', CALC);
  await tapExpr(page, '1+');
  await expect(page.getByTestId('calc-expr-error')).toBeVisible();
  await pollObservation(page, (o) => o.exprValid === false);
});

test('calc-pattern: 키보드만으로 4단계를 쌓고 식을 쓴다', async ({ page }) => {
  await open(page, 'calc-pattern', CALC);
  await page.getByTestId('calc-build').focus();
  for (const [index, h] of PYRAMID4.entries()) {
    await page.keyboard.press(String(h));
    if (index < PYRAMID4.length - 1) await page.keyboard.press('ArrowRight');
  }
  await pollObservation(page, (o) => o.builtIsPyramid === true && o.builtTotal === 16);
  // 방향키와 Enter로도 쌓는다: 마지막 열(높이 1)에서 한 칸 위를 눌러 높이를 바꿨다가 되돌린다.
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('Enter');
  await pollObservation(page, (o) => o.builtIsPyramid === false);
  await page.keyboard.press('Enter');
  await pollObservation(page, (o) => o.builtIsPyramid === true);

  await page.getByTestId('calc-expr-input').focus();
  await page.keyboard.type('1+2+3+4+3+2+1=4*4');
  await pollObservation(page, (o) => o.exprHolds === true && o.exprText === '1+2+3+4+3+2+1=4×4');
  await page.keyboard.press('Backspace');
  await pollObservation(page, (o) => o.exprText === '1+2+3+4+3+2+1=4×');
  await page.keyboard.press('Delete');
  await pollObservation(page, (o) => o.exprText === '');
});

test('calc-pattern: 열을 누르면 식의 수가, 식의 수를 누르면 열이 강조된다(색만 아님)', async ({
  page,
}) => {
  await open(page, 'calc-pattern', CALC, 'stage=fit');
  const col = page.locator('g[data-step="3"][data-col="2"]');
  const term = page.locator('g[data-step="3"][data-term="2"]');
  await col.click();
  await expect(term).toHaveAttribute('data-linked', 'true');
  await expect(term.locator('[data-testid="calc-term-mark"]')).toBeVisible();
  await expect(term.locator('text')).toHaveAttribute('font-weight', '900');
  await expect(col.locator('[data-testid="calc-col-mark"]')).toBeVisible();

  await page.locator('g[data-step="3"][data-term="4"]').click();
  await expect(
    page.locator('g[data-step="3"][data-col="4"] [data-testid="calc-col-mark"]'),
  ).toBeVisible();
  await expect(col.locator('[data-testid="calc-col-mark"]')).toHaveCount(0);

  // 키보드: 포커스 후 Enter
  await page.locator('g[data-step="2"][data-col="1"]').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('g[data-step="2"][data-term="1"]')).toHaveAttribute(
    'data-linked',
    'true',
  );
  // 강조는 판정(Observation)에 영향이 없다.
  await pollObservation(page, (o) => o.builtTotal === 0 && o.exprText === '');
});

test('calc-pattern: repunit 화면과 식 입력', async ({ page }) => {
  await open(page, 'calc-pattern', REPUNIT, 'stage=fit');
  await expect(page.getByTestId('calc-build')).toHaveCount(0);
  await expect(page.locator('g[data-step="4"][data-term="2"]')).toHaveText('1234321');
  await tapExpr(page, '11111×11111=123454321');
  await pollObservation(
    page,
    (o) => o.exprHolds === true && o.exprLeft === '123454321' && o.pattern === 'repunit-square',
  );
  await capture(page, 'T175-calc-repunit');
});

test('calc-pattern: 오버레이 step-table이 본 캔버스와 1px 안에 겹치고 보여 준 단계까지만 쓴다', async ({
  page,
}) => {
  await open(page, 'calc-pattern', CALC, 'overlay=step-table');
  await toggleOverlay(page);
  await expectAligned(page, 'step-table', 'calc-canvas');
  await expect(page.locator('[data-testid="step-table-col"]')).toHaveCount(3);
  await expect(page.locator('[data-overlay="step-table"]')).not.toContainText('16');
  await capture(page, 'T175-overlay-step-table');
});

test('calc-pattern: 오버레이 column-link가 본 캔버스와 1px 안에 겹친다', async ({ page }) => {
  await open(page, 'calc-pattern', CALC, 'overlay=column-link');
  await toggleOverlay(page);
  await expectAligned(page, 'column-link', 'calc-canvas');
  await expect(page.locator('[data-testid="column-link-item"]')).toHaveCount(5);
  await capture(page, 'T175-overlay-column-link');
});

test('calc-pattern: 쌓기 칸·키패드 단추가 targetSize 이상이고 맨 아래 단추가 스크롤로 닿는다', async ({
  page,
}) => {
  await open(page, 'calc-pattern', CALC, 'stage=fit');
  await expectMin(buildCell(page, 0, 1), 48, '쌓기 칸(48)');
  await expectMin(calcPad(page, '5'), 48, '키패드(48)');
  await page.getByRole('button', { name: '터치 48px' }).click();
  await expectMin(buildCell(page, 0, 1), 64, '쌓기 칸(64)');
  await expectMin(calcPad(page, '5'), 64, '키패드(64)');
  const last = calcPad(page, '모두 지우기');
  await last.scrollIntoViewIfNeeded();
  await expect(last).toBeInViewport();
  await calcPad(page, '7').scrollIntoViewIfNeeded();
  await calcPad(page, '7').click();
  await last.scrollIntoViewIfNeeded();
  await last.click();
  await pollObservation(page, (o) => o.exprText === '');
});

test('calc-pattern: 보기 판 블록은 화면에서 24px 이상이다(많은 단계는 스크롤)', async ({
  page,
}) => {
  await open(page, 'calc-pattern', { ...CALC, stepsShown: 8, workStep: 9 }, 'stage=fit');
  const rect = page.locator('g[data-step="8"][data-col="7"] rect').first();
  await expectMin(rect, 24, '보기 판 블록');
  await expect(page.getByTestId('calc-board')).toHaveAttribute('data-scroll', 'true');
});

// ───────── growth (T178) ─────────

const GROWTH = { stepsShown: 3 };
/** 1·2·3단계 그림과 표 3단계까지: 늘어난 수 빈칸은 2단계·3단계 둘(과제 1 "2, 2"). */
const GROWTH_INC = { stepsShown: 3, table: { upTo: 3 } };

function growthEntries(o: ObservationRecord): Record<string, string> {
  return o.entries as unknown as Record<string, string>;
}

function growthPad(page: Page, name: string): Locator {
  return page.getByTestId('growth-pad').getByRole('button', { name, exact: true });
}

function growthCell(page: Page, key: string): Locator {
  return page.locator(`[data-testid="growth-table"] [data-cell="${key}"]`);
}

test('growth: 늘어난 수 빈칸에 2, 2를 패드로 쓰면 모든 빈칸이 맞다', async ({ page }) => {
  await open(page, 'growth', GROWTH_INC, 'stage=fit');
  await growthCell(page, '2.inc').click();
  await growthPad(page, '2').click();
  await pollObservation(page, (o) => growthEntries(o)['2.inc'] === '2');
  await expect(page.getByTestId('growth-table')).not.toContainText(/[✓✕]/);
  await pollObservation(page, (o) => o.blanksCorrect === false);
  await growthCell(page, '3.inc').click();
  await growthPad(page, '2').click();
  await pollObservation(
    page,
    (o) => o.blanksCorrect === true && (o.misconceptions ?? []).length === 0,
  );
  await capture(page, 'T178-growth-inc');
  // 정답을 알려 주는 값은 Observation에 없다.
  const observation = await readObservation(page);
  expect(Object.keys(observation).sort()).toEqual(
    [
      'blanks',
      'blanksCorrect',
      'entries',
      'misconceptions',
      'mode',
      'shape',
      'stepsShown',
      'upTo',
    ].sort(),
  );
});

test('growth: 4단계 개수 칸에 늘어난 수 2를 쓰면 GROWTH-TOTAL, 7로 고치면 풀린다', async ({
  page,
}) => {
  await open(page, 'growth', GROWTH, 'stage=fit');
  await growthCell(page, '4.count').click();
  await growthPad(page, '2').click();
  await pollObservation(page, (o) => (o.misconceptions ?? []).includes('MC-PATTERN-GROWTH-TOTAL'));
  await growthPad(page, '지우기').click();
  await growthPad(page, '7').click();
  await pollObservation(
    page,
    (o) => (o.misconceptions ?? []).length === 0 && growthEntries(o)['4.count'] === '7',
  );
});

test('growth: 키보드만으로 칸을 옮기고 숫자를 쓰고 지운다', async ({ page }) => {
  await open(page, 'growth', GROWTH_INC, 'stage=fit');
  await growthCell(page, '2.inc').focus();
  await page.keyboard.press('2');
  await page.keyboard.press('ArrowRight');
  await expect(growthCell(page, '3.inc')).toBeFocused();
  await page.keyboard.press('2');
  await page.keyboard.press('1');
  await pollObservation(page, (o) => {
    const entries = growthEntries(o);
    return entries['2.inc'] === '2' && entries['3.inc'] === '21';
  });
  await page.keyboard.press('Backspace');
  await page.keyboard.press('ArrowLeft');
  await expect(growthCell(page, '2.inc')).toBeFocused();
  await page.keyboard.press('Delete');
  await pollObservation(page, (o) => {
    const entries = growthEntries(o);
    return entries['2.inc'] === undefined && entries['3.inc'] === '2';
  });
});

test('growth: 늘어난 쌓기나무는 data-new이고 굵은 윤곽·점 무늬가 있다(색만 아님)', async ({
  page,
}) => {
  await open(page, 'growth', GROWTH, 'stage=fit');
  const canvas = page.getByTestId('growth-canvas');
  await expect(canvas.locator('g[data-stage="3"][data-new="true"]')).toHaveCount(2);
  await expect(canvas.locator('g[data-stage="1"][data-new="true"]')).toHaveCount(0);
  const widths = await page.evaluate(() => {
    const stroke = (selector: string) =>
      Number(document.querySelector(`${selector} polygon`)?.getAttribute('stroke-width') ?? '0');
    return {
      fresh: stroke('g[data-stage="3"][data-new="true"]'),
      plain: stroke('g[data-stage="3"][data-new="false"]'),
    };
  });
  expect(widths.fresh).toBeGreaterThan(widths.plain);
  await expect(canvas).not.toContainText('모두');
});

test('growth: 오버레이 growth-split이 본 캔버스와 1px 안에 겹치고 보여 준 단계까지만 쓴다', async ({
  page,
}) => {
  await open(page, 'growth', GROWTH, 'overlay=growth-split');
  await toggleOverlay(page);
  await expectAligned(page, 'growth-split', 'growth-canvas');
  await expect(page.locator('[data-testid="growth-split-panel"]')).toHaveCount(3);
  await expect(page.locator('[data-overlay="growth-split"]')).toContainText('모두 5개');
  await expect(page.locator('[data-overlay="growth-split"]')).not.toContainText('모두 7개');
  await capture(page, 'T178-overlay-growth-split');
});

test('growth: 쌓기나무 24px 이상, 표 칸·패드 단추 targetSize 이상, 맨 아래 단추까지 닿는다', async ({
  page,
}) => {
  await open(page, 'growth', { stepsShown: 5, shape: 'stairs', table: { upTo: 8 } }, 'stage=fit');
  await expectMin(
    page.locator('[data-testid="growth-canvas"] g[data-stage="5"][data-new="true"]').first(),
    24,
    '쌓기나무',
  );
  await expectMin(growthCell(page, '6.count'), 48, '표 칸(48)');
  await expectMin(growthPad(page, '5'), 48, '패드(48)');
  await page.getByRole('button', { name: '터치 48px' }).click();
  await expectMin(growthCell(page, '6.count'), 64, '표 칸(64)');
  await expectMin(growthPad(page, '5'), 64, '패드(64)');
  const last = growthPad(page, '모두 지우기');
  await last.scrollIntoViewIfNeeded();
  await expect(last).toBeInViewport();
  await growthCell(page, '8.inc').scrollIntoViewIfNeeded();
  await growthCell(page, '8.inc').click();
  await growthPad(page, '4').click();
  await pollObservation(page, (o) => growthEntries(o)['8.inc'] === '4');
});

test('growth: look none은 표만 있고 flat은 색칸 그림이다', async ({ page }) => {
  await open(page, 'growth', { look: 'none' }, 'stage=fit');
  await expect(page.getByTestId('growth-canvas')).toHaveCount(0);
  await expect(page.getByTestId('growth-table')).toBeVisible();
  await growthCell(page, '2.inc').click();
  await growthPad(page, '2').click();
  await pollObservation(page, (o) => growthEntries(o)['2.inc'] === '2');
  await open(page, 'growth', { look: 'flat' }, 'stage=fit');
  await expect(page.locator('[data-testid="growth-canvas"] polygon')).toHaveCount(0);
  await expect(page.locator('[data-testid="growth-canvas"] g[data-stage]')).toHaveCount(9);
});

// ───────── calc-pattern 표 변형 (T179) ─────────

const TABLE_ADD = {
  table: 'addition',
  hidden: [
    [1, 1],
    [2, 2],
    [3, 3],
    [4, 4],
  ],
  magnifierUses: 3,
  drawArrows: true,
};
const TABLE_MUL = { table: 'multiplication', hidden: [[4, 3]], drawArrows: true };

function tableEntries(o: ObservationRecord): Record<string, string> {
  return o.entries as unknown as Record<string, string>;
}

function tableCell(page: Page, key: string): Locator {
  return page.locator(`[data-testid="calc-table-canvas"] [data-cell="${key}"]`);
}

function tablePad(page: Page, name: string): Locator {
  return page.getByTestId('table-pad').getByRole('button', { name, exact: true });
}

test('calc-table: 덧셈표 가린 칸 3개에 4·6·8을 쓰면 모두 쓰이고 ✓/✕는 없다', async ({ page }) => {
  await open(
    page,
    'calc-pattern',
    { ...TABLE_ADD, hidden: TABLE_ADD.hidden.slice(0, 3) },
    'stage=fit',
  );
  const values: [string, string][] = [
    ['1.1', '4'],
    ['2.2', '6'],
    ['3.3', '8'],
  ];
  for (const [cell, value] of values) {
    await tableCell(page, cell).click();
    await tablePad(page, value).click();
  }
  await pollObservation(page, (o) => {
    const entries = tableEntries(o);
    return entries['1.1'] === '4' && entries['2.2'] === '6' && entries['3.3'] === '8';
  });
  await expect(page.getByTestId('calc-table-canvas')).not.toContainText(/[✓✕]/);
  await capture(page, 'T179-calc-table-add');
  // 정답을 알려 주는 값은 Observation에 없다.
  const observation = await readObservation(page);
  expect(Object.keys(observation).sort()).toEqual(
    [
      'arrows',
      'entries',
      'hidden',
      'magnifierLeft',
      'misconceptions',
      'mode',
      'revealed',
      'size',
      'start',
      'table',
      'variant',
    ].sort(),
  );
});

test('calc-table: 가린 칸 값은 DOM에 없고 돋보기로 3번 열면 더 못 연다', async ({ page }) => {
  await open(page, 'calc-pattern', TABLE_ADD, 'stage=fit');
  const canvas = page.getByTestId('calc-table-canvas');
  await expect(tableCell(page, '1.1')).toHaveAttribute('data-state', 'hidden');
  await expect(page.locator('[data-cell-text="1.1"]')).toHaveText('?');
  await page.getByRole('button', { name: '돋보기 (남은 3번)' }).click();
  await tableCell(page, '1.1').click();
  await tableCell(page, '2.2').click();
  await tableCell(page, '3.3').click();
  await pollObservation(
    page,
    (o) => (o.revealed as string[]).length === 3 && o.magnifierLeft === 0,
  );
  await expect(page.locator('[data-cell-text="1.1"]')).toContainText('4');
  await expect(page.locator('[data-peeked-icon]')).toHaveCount(3);
  await expect(page.getByRole('button', { name: '돋보기 (남은 0번)' })).toBeVisible();
  await tableCell(page, '4.4').click();
  await expect(page.locator('[data-cell-text="4.4"]')).toHaveText('?');
  await expect(canvas.locator('[data-state="peeked"]')).toHaveCount(3);
  expect(((await readObservation(page)).revealed as string[]).length).toBe(3);
});

test('calc-table: 오른쪽 아래 방향 +2 화살표를 놓으면 규칙을 찾은 것이다', async ({ page }) => {
  await open(page, 'calc-pattern', TABLE_ADD, 'stage=fit');
  await page.getByRole('button', { name: '화살표', exact: true }).click();
  await tableCell(page, '1.1').click();
  await page.getByRole('button', { name: '↘ 오른쪽 아래' }).click();
  await tablePad(page, '2').click();
  await page.getByTestId('table-arrow-commit').click();
  await pollObservation(page, (o) => {
    const arrows = o.arrows as { dir: string; amount: string; amountCorrect: boolean }[];
    return (
      arrows.length === 1 &&
      arrows[0]?.dir === 'down-right' &&
      arrows[0]?.amount === '2' &&
      arrows[0]?.amountCorrect === true
    );
  });
  await expect(page.locator('[data-arrow="1.1"]')).toContainText('+2');
  await expect(page.getByTestId('table-arrow-list')).not.toContainText(/[✓✕]/);
  await capture(page, 'T179-calc-table-arrow');
  await page.getByTestId('table-arrow-list').getByRole('button').first().click();
  await pollObservation(page, (o) => (o.arrows as unknown[]).length === 0);
});

test('calc-table: 곱셈표 5단 칸에 19를 쓰면 ROW-COL이고 cell-diff가 본 캔버스와 1px 안에 겹친다', async ({
  page,
}) => {
  await open(page, 'calc-pattern', TABLE_MUL, 'overlay=cell-diff');
  await tableCell(page, '4.3').click();
  await tablePad(page, '1').click();
  await tablePad(page, '9').click();
  await pollObservation(page, (o) => (o.misconceptions ?? []).includes('MC-CHART-ROW-COL'));
  await toggleOverlay(page);
  await expectAligned(page, 'cell-diff', 'calc-table-canvas');
  await expect(page.getByTestId('cell-diff-row-label')).toHaveText('→ +5');
  await expect(page.getByTestId('cell-diff-col-label')).toHaveText('↓ +4');
  // 가린 칸의 값(20)과 학생이 쓴 수는 오버레이에 없다.
  await expect(page.locator('[data-overlay="cell-diff"]')).not.toContainText('20');
  await expect(page.locator('[data-overlay="cell-diff"]')).not.toContainText('19');
  await capture(page, 'T179-overlay-cell-diff');
  // 20으로 고치면 오개념이 풀린다.
  await toggleOverlay(page);
  await tablePad(page, '지우기').click();
  await tablePad(page, '지우기').click();
  await tablePad(page, '2').click();
  await tablePad(page, '0').click();
  await pollObservation(
    page,
    (o) => (o.misconceptions ?? []).length === 0 && tableEntries(o)['4.3'] === '20',
  );
});

test('calc-table: 키보드만으로 쓰기·돋보기·화살표를 한다', async ({ page }) => {
  await open(page, 'calc-pattern', TABLE_ADD, 'stage=fit');
  await tableCell(page, '1.1').focus();
  await page.keyboard.press('4');
  await page.keyboard.press('ArrowDown');
  // 1.1 아래 가린 칸은 2.1이 아니라(가리지 않음) 없다. 같은 칸에는 가린 칸이 없어 그대로다.
  await expect(tableCell(page, '1.1')).toBeFocused();
  await page.keyboard.press('ArrowRight');
  // 같은 줄에 다른 가린 칸이 없어 그대로다.
  await expect(tableCell(page, '1.1')).toBeFocused();
  await tableCell(page, '2.2').focus();
  await page.keyboard.press('6');
  await pollObservation(page, (o) => {
    const entries = tableEntries(o);
    return entries['1.1'] === '4' && entries['2.2'] === '6';
  });
  // M: 돋보기 도구, 방향키로 칸을 옮기고 Enter로 연다(쓰기 도구에서 옮긴 칸은 가린 칸뿐이다).
  await page.keyboard.press('m');
  await expect(page.getByRole('button', { name: /^돋보기/ })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await tableCell(page, '3.3').focus();
  await page.keyboard.press('Enter');
  await pollObservation(page, (o) => JSON.stringify(o.revealed) === JSON.stringify(['3.3']));
  // A: 화살표 도구. 1.1에서 Enter로 시작, 3(오른쪽 아래), 2, Enter.
  await page.keyboard.press('a');
  await tableCell(page, '1.1').focus();
  await page.keyboard.press('Enter');
  await page.keyboard.press('3');
  await page.keyboard.press('2');
  await page.keyboard.press('Enter');
  await pollObservation(page, (o) => {
    const arrows = o.arrows as { dir: string; amountCorrect: boolean }[];
    return arrows.length === 1 && arrows[0]?.dir === 'down-right' && arrows[0]?.amountCorrect;
  });
});

test('calc-table: 칸·패드·도구 단추 targetSize 이상, 9×9 표도 맨 아래 칸·단추까지 닿는다', async ({
  page,
}) => {
  await open(
    page,
    'calc-pattern',
    { table: 'multiplication', size: [9, 9], magnifierUses: 5, drawArrows: true },
    'stage=fit',
  );
  await expectMin(tableCell(page, '4.4'), 48, '표 칸(48)');
  await expectMin(tablePad(page, '5'), 48, '패드(48)');
  await expectMin(page.getByTestId('table-tool-magnifier'), 48, '도구(48)');
  await page.getByRole('button', { name: '터치 48px' }).click();
  await expectMin(tableCell(page, '4.4'), 64, '표 칸(64)');
  await expectMin(tablePad(page, '5'), 64, '패드(64)');
  await expectMin(page.getByTestId('table-tool-magnifier'), 64, '도구(64)');
  const last = tableCell(page, '8.8');
  await last.scrollIntoViewIfNeeded();
  await expect(last).toBeInViewport();
  await last.click();
  await tablePad(page, '4').scrollIntoViewIfNeeded();
  await tablePad(page, '4').click();
  await pollObservation(page, (o) => tableEntries(o)['8.8'] === '4');
  const pad = tablePad(page, '모두 지우기');
  await pad.scrollIntoViewIfNeeded();
  await expect(pad).toBeInViewport();
});

/** 화면 기준 이미지: 첫 화면 세 장(extend·translate·chart full). 크롬북·아이패드만 찍는다. */
async function stageShot(page: Page, name: string): Promise<void> {
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
  await expect(page.locator('main > div[class*="stage"]')).toHaveScreenshot(`${name}.png`);
}

test.describe('첫 화면 기준 이미지', () => {
  test.beforeEach(() => {
    test.skip(test.info().project.name === 'board', '크롬북·아이패드만 찍는다.');
  });

  test('sequence extend', async ({ page }) => {
    await open(page, 'sequence', EXTEND, 'stage=fit');
    await stageShot(page, 'pattern-extend');
  });

  test('sequence translate', async ({ page }) => {
    await open(page, 'sequence', TRANSLATE, 'stage=fit');
    await stageShot(page, 'pattern-translate');
  });

  test('chart full', async ({ page }) => {
    await open(page, 'hundred-chart', { hidden: [23, 46, 78] }, 'stage=fit');
    await stageShot(page, 'pattern-chart-full');
  });

  test('calc-pattern symmetric', async ({ page }) => {
    await open(page, 'calc-pattern', CALC, 'stage=fit');
    await stageShot(page, 'pattern-calc-symmetric');
  });

  test('calc-pattern repunit', async ({ page }) => {
    await open(page, 'calc-pattern', REPUNIT, 'stage=fit');
    await stageShot(page, 'pattern-calc-repunit');
  });

  test('growth cubes L', async ({ page }) => {
    await open(page, 'growth', GROWTH, 'stage=fit');
    await stageShot(page, 'pattern-growth-cubes');
  });

  test('calc-table addition', async ({ page }) => {
    await open(page, 'calc-pattern', { table: 'addition', magnifierUses: 3 }, 'stage=fit');
    await stageShot(page, 'pattern-calc-table-add');
  });

  test('calc-table multiplication arrows', async ({ page }) => {
    await open(
      page,
      'calc-pattern',
      { table: 'multiplication', size: [6, 6], magnifierUses: 2, drawArrows: true },
      'stage=fit',
    );
    await page.getByRole('button', { name: '화살표', exact: true }).click();
    await tableCell(page, '1.1').click();
    await page.getByRole('button', { name: '↘ 오른쪽 아래' }).click();
    await tablePad(page, '5').click();
    await page.getByTestId('table-arrow-commit').click();
    // 패드를 누르려고 조작 묶음이 스크롤됐으므로 맨 위로 되돌려 도구 막대가 보이게 찍는다.
    await page.evaluate(() => {
      document.querySelectorAll('[class*="sideStack"]').forEach((el) => (el.scrollTop = 0));
    });
    await stageShot(page, 'pattern-calc-table-mul');
  });

  test('growth flat stairs', async ({ page }) => {
    await open(page, 'growth', { shape: 'stairs', look: 'flat' }, 'stage=fit');
    await stageShot(page, 'pattern-growth-flat');
  });
});
