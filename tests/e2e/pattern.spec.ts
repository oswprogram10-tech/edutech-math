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

async function open(page: Page, mode: 'sequence' | 'hundred-chart', config: unknown, query = '') {
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
});
