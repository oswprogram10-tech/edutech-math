import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { logicalToScreen } from './canvas-point';
import { expectSandboxCanvasVisible } from './panel-layout';
import { bandCenter, frameOf, valuePosition } from '../../src/engines/E18-graph-studio/layout';

/**
 * E18 그래프 스튜디오 샌드박스 E2E. 아이패드(WebKit)·크롬북·전자칠판 뷰포트에서 모두 돈다.
 *
 * - 두 모드(table-to-graph, scale)
 * - ○ 칸 누르기·키보드, 막대 끌기·키보드
 * - 눈금 단추 → data-cells, 가로·세로 바꾸기 → data-orientation
 * - 오버레이 5개가 실제로 그려지고 본 캔버스(tally-check는 자료 카드 줄)와 1px 안에서 맞는다
 * - 크롬북 두 칸 폭(660×420) ?stage=fit에서 그래프 높이 ≥ 200px
 * - 기준 스크린샷 3장
 */

const LOGICAL_W = 1000;
const LOGICAL_H = 700;

const SPORTS = { 축구: 12, 피구: 8, 줄넘기: 5, 수영: 10 };
const FRUITS = { '🍎': 3, '🍌': 5, '🍇': 2 };

interface ObservationRecord {
  readonly mode?: string;
  readonly scale?: number;
  readonly orientation?: string;
  readonly flipped?: boolean;
  readonly graphCells?: Readonly<Record<string, number>>;
  readonly graphValues?: Readonly<Record<string, number>>;
  readonly table?: Readonly<Record<string, number | null>>;
  readonly tableTotal?: number;
  readonly talliedCount?: number;
  readonly gapCategories?: string[];
  readonly offGridCategories?: string[];
  readonly misconceptions?: string[];
  readonly graphMatchesData?: boolean;
  readonly [key: string]: unknown;
}

interface OpenOptions {
  readonly stageFit?: boolean;
  readonly overlay?: string;
  readonly overlayArgs?: unknown;
  readonly mode?: 'table-to-graph' | 'scale';
}

async function openEngine(page: Page, config: unknown, options: OpenOptions = {}) {
  const params = new URLSearchParams();
  if (options.stageFit) params.set('stage', 'fit');
  params.set('config', JSON.stringify(config));
  if (options.overlay) params.set('overlay', options.overlay);
  if (options.overlayArgs !== undefined) {
    params.set('overlayArgs', JSON.stringify(options.overlayArgs));
  }
  await page.goto(`/?${params.toString()}#/sandbox/E18`);
  await expect(page.getByRole('heading', { name: '그래프 스튜디오' })).toBeVisible();
  if (options.mode) {
    await page.getByLabel('모드').selectOption(options.mode);
    await expect(page.getByTestId('observation')).toContainText(`"mode":"${options.mode}"`);
  }
  return page.getByTestId('graph-canvas');
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

async function press(locator: Locator, key = 'Enter'): Promise<void> {
  await locator.focus();
  await expect(locator).toBeFocused();
  await locator.page().keyboard.press(key);
}

function bar(page: Page, cat: string): Locator {
  return page.locator(`[data-testid="graph-canvas"] g[data-cat="${cat}"][data-cells]`);
}

function cell(page: Page, cat: string, index: number): Locator {
  return page.locator(`[data-testid="graph-canvas"] g[data-cat="${cat}"][data-cell="${index}"]`);
}

async function showOverlay(page: Page): Promise<void> {
  await page.getByRole('button', { name: '힌트 겹쳐 보기' }).click();
}

/** 오버레이 svg 상자가 본 캔버스 svg 상자와 1px 이내로 같은지. */
async function expectOverlayAligned(page: Page, name: string): Promise<Locator> {
  const overlay = page.locator(`[data-overlay="${name}"]`);
  await expect(overlay).toBeVisible();
  await expect(overlay.locator('svg')).toHaveCount(1);
  const canvas = page.getByTestId('graph-canvas');
  await expect
    .poll(async () => {
      const canvasBox = await canvas.boundingBox();
      const overlayBox = await overlay.locator('svg').boundingBox();
      if (!canvasBox || !overlayBox) return Number.POSITIVE_INFINITY;
      return Math.max(
        Math.abs(overlayBox.x - canvasBox.x),
        Math.abs(overlayBox.y - canvasBox.y),
        Math.abs(overlayBox.width - canvasBox.width),
        Math.abs(overlayBox.height - canvasBox.height),
      );
    })
    .toBeLessThanOrEqual(1);
  return overlay;
}

/** 논리 좌표 → 화면 좌표. */
async function screenPoint(canvas: Locator, x: number, y: number) {
  await canvas.scrollIntoViewIfNeeded();
  const box = await canvas.boundingBox();
  if (!box) throw new Error('캔버스 크기를 알 수 없습니다.');
  return logicalToScreen(box, x, y, LOGICAL_W, LOGICAL_H);
}

async function stageShot(page: Page, name: string): Promise<void> {
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
  await expect(page.locator('main > div[class*="stage"]')).toHaveScreenshot(`${name}.png`, {
    maxDiffPixelRatio: 0.02,
    animations: 'disabled',
  });
}

test.describe('table-to-graph', () => {
  const config = {
    mode: 'table-to-graph',
    data: FRUITS,
    table: 'given',
    graph: 'student',
    graphType: 'o-mark',
    orientationFlip: true,
    valueLabel: '명',
  };

  test('○ 칸을 누르면 채우고 다시 누르면 비운다', async ({ page }) => {
    await openEngine(page, config);
    // ○ 그래프 눈금 숫자는 칸 가운데에 1부터 쓰고 0은 쓰지 않는다.
    const numbers = page.locator('[data-testid="graph-canvas"] text[data-cell-number]');
    await expect(numbers.first()).toHaveText('1');
    await expect(numbers).toHaveText(['1', '2', '3', '4', '5', '6']);
    await cell(page, '🍎', 0).click();
    await expect(cell(page, '🍎', 0)).toHaveAttribute('data-filled', 'true');
    await pollObservation(page, (o) => o.graphCells?.['🍎'] === 1);
    await cell(page, '🍎', 0).click();
    await expect(cell(page, '🍎', 0)).toHaveAttribute('data-filled', 'false');
    await pollObservation(page, (o) => o.graphCells?.['🍎'] === 0);
  });

  test('키보드로 ○ 칸을 채우고, 0번을 건너뛰면 빈틈으로 읽힌다', async ({ page }) => {
    await openEngine(page, config);
    await press(cell(page, '🍎', 1));
    await expect(cell(page, '🍎', 1)).toHaveAttribute('data-filled', 'true');
    await pollObservation(
      page,
      (o) =>
        o.gapCategories?.includes('🍎') === true &&
        o.misconceptions?.includes('MC-GRAPH-GAP-ORDER') === true,
    );
    await press(cell(page, '🍎', 0), ' ');
    await pollObservation(page, (o) => (o.gapCategories ?? []).length === 0);
  });

  test('학생 그래프에는 말풍선도 맞음 표시도 없다', async ({ page }) => {
    await openEngine(page, config);
    for (const index of [0, 1, 2]) await cell(page, '🍎', index).click();
    await cell(page, '🍎', 0).click();
    await expect(page.getByTestId('graph-tooltip')).toHaveCount(0);
    await expect(
      page.locator('[data-correct], [data-match], [data-fit], [aria-invalid]'),
    ).toHaveCount(0);
  });

  test('가로·세로 바꾸기 뒤에도 칸과 값이 같다', async ({ page }) => {
    const canvas = await openEngine(page, config);
    for (const index of [0, 1, 2]) await cell(page, '🍎', index).click();
    await expect(canvas).toHaveAttribute('data-orientation', 'vertical');
    await page.getByTestId('graph-flip').click();
    await expect(canvas).toHaveAttribute('data-orientation', 'horizontal');
    await pollObservation(page, (o) => o.orientation === 'horizontal' && o.flipped === true);
    await expect(cell(page, '🍎', 2)).toHaveAttribute('data-filled', 'true');
    expect((await readObservation(page)).graphCells?.['🍎']).toBe(3);
    await page.getByTestId('graph-flip').click();
    await expect(canvas).toHaveAttribute('data-orientation', 'vertical');
  });

  test('표를 student로 두면 −/+ 단추로 수를 넣는다', async ({ page }) => {
    await openEngine(page, { ...config, table: 'student', graph: 'none' });
    const plus = page.getByRole('button', { name: '🍎 늘리기' });
    await plus.click();
    await plus.click();
    await plus.click();
    await pollObservation(page, (o) => o.table?.['🍎'] === 3 && o.tableTotal === 3);
    await page.getByRole('button', { name: '🍎 줄이기' }).click();
    await pollObservation(page, (o) => o.table?.['🍎'] === 2);
    await expect(page.locator('td[data-cat="🍎"]')).toContainText('2');
  });

  test('자료 카드를 누르면 센 것으로 표시된다', async ({ page }) => {
    await openEngine(page, {
      categories: ['🍎', '🍌'],
      rawItems: ['🍎', '🍌', '🍎'],
      table: 'student',
      graph: 'none',
    });
    await page.locator('[data-tally-index="0"]').click();
    await page.locator('[data-tally-index="2"]').click();
    await pollObservation(page, (o) => o.talliedCount === 2);
    await expect(page.locator('[data-tally-index="0"]')).toContainText('✓');
    await expect(page.locator('[data-tally-index="1"]')).not.toContainText('✓');
  });
});

test.describe('scale', () => {
  const config = {
    mode: 'scale',
    data: SPORTS,
    graph: 'student',
    scale: 1,
    scaleOptions: [1, 2, 5, 10],
    orientationFlip: true,
    valueLabel: '명',
    categoryAxisTitle: '운동',
    valueAxisTitle: '학생 수',
  };

  test('막대 끝을 끌면 칸에 붙고, 키보드 ↑로 한 칸씩 늘인다', async ({ page }) => {
    const canvas = await openEngine(page, config, { mode: 'scale' });
    const frame = frameOf('vertical', 4, 13);
    const x = bandCenter(frame, 0);
    const start = await screenPoint(canvas, x, valuePosition(frame, 0) - 6);
    // 6칸 위치(칸 경계에서 살짝 벗어나게)로 끌면 가까운 칸 경계로 붙는다.
    const end = await screenPoint(canvas, x, valuePosition(frame, 6.2));
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move((start.x + end.x) / 2, (start.y + end.y) / 2, { steps: 4 });
    await page.mouse.move(end.x, end.y, { steps: 4 });
    await page.mouse.up();
    await expect(bar(page, '축구')).toHaveAttribute('data-cells', '6');
    await pollObservation(
      page,
      (o) => o.graphCells?.['축구'] === 6 && o.graphValues?.['축구'] === 6,
    );

    await press(bar(page, '축구'), 'ArrowUp');
    await press(bar(page, '축구'), 'ArrowUp');
    await expect(bar(page, '축구')).toHaveAttribute('data-cells', '8');
    await press(bar(page, '축구'), 'ArrowDown');
    await expect(bar(page, '축구')).toHaveAttribute('data-cells', '7');
  });

  test('눈금 단추를 누르면 학생 막대의 칸 수가 값을 지키며 바뀐다', async ({ page }) => {
    await openEngine(page, config, { mode: 'scale' });
    const target = bar(page, '축구');
    await target.focus();
    for (let step = 0; step < 12; step += 1) await page.keyboard.press('ArrowUp');
    await expect(target).toHaveAttribute('data-cells', '12');
    await page.locator('[data-scale="2"]').click();
    await expect(target).toHaveAttribute('data-cells', '6');
    await pollObservation(page, (o) => o.scale === 2 && o.graphValues?.['축구'] === 12);
    await page.locator('[data-scale="5"]').click();
    await expect(target).toHaveAttribute('data-cells', '2');
    await pollObservation(
      page,
      (o) =>
        o.graphValues?.['축구'] === 10 &&
        o.offGridCategories?.includes('피구') === true &&
        o.offGridCategories?.includes('축구') === true,
    );
    await expect(page.locator('[data-scale="5"]')).toHaveAttribute('aria-checked', 'true');
  });

  test('주어진 그래프에서 눈금 단추로 data-cells가 바뀌고, 가로로 뒤집어도 값이 같다', async ({
    page,
  }) => {
    const canvas = await openEngine(page, { ...config, graph: 'given' }, { mode: 'scale' });
    await expect(bar(page, '축구')).toHaveAttribute('data-cells', '12');
    await page.locator('[data-scale="2"]').click();
    await expect(bar(page, '축구')).toHaveAttribute('data-cells', '6');
    await page.locator('[data-scale="5"]').click();
    await expect(bar(page, '축구')).toHaveAttribute('data-cells', '2');
    await page.getByTestId('graph-flip').click();
    await expect(canvas).toHaveAttribute('data-orientation', 'horizontal');
    await expect(bar(page, '축구')).toHaveAttribute('data-cells', '2');
    expect((await readObservation(page)).graphValues).toEqual(SPORTS);
  });

  test('막대를 눌러 말풍선을 보이고(주어진 그래프), 학생 그래프에서는 보이지 않는다', async ({
    page,
  }) => {
    await openEngine(page, { ...config, graph: 'given' }, { mode: 'scale' });
    await bar(page, '피구').click();
    await expect(page.getByTestId('graph-tooltip')).toContainText('피구: 8명');
    await openEngine(page, config, { mode: 'scale' });
    await bar(page, '피구').click();
    await expect(page.getByTestId('graph-tooltip')).toHaveCount(0);
  });
});

test.describe('오버레이 5개', () => {
  test('gap-compare: 빈틈 없이 쌓은 반투명 열과 ↕가 본 캔버스 위에 겹친다', async ({ page }) => {
    await openEngine(
      page,
      { data: FRUITS, graph: 'student', graphType: 'o-mark', orientationFlip: true },
      { overlay: 'gap-compare' },
    );
    await cell(page, '🍎', 1).click();
    await cell(page, '🍎', 3).click();
    await showOverlay(page);
    const overlay = await expectOverlayAligned(page, 'gap-compare');
    // 채운 ○ 두 개 → 반투명 열 두 칸.
    await expect(overlay.locator('[data-ghost-cell]')).toHaveCount(2);
    await expect(overlay.getByTestId('gap-arrow')).toHaveText('↕');
    const ghost = await overlay.locator('[data-ghost-cell="0"]').boundingBox();
    const real = await cell(page, '🍎', 0).boundingBox();
    const canvas = await page.getByTestId('graph-canvas').boundingBox();
    if (!ghost || !real || !canvas) throw new Error('상자를 찾지 못했습니다.');
    expect(ghost.x).toBeGreaterThan(canvas.x);
    expect(ghost.x + ghost.width).toBeLessThan(canvas.x + canvas.width);
    // 반투명 열의 맨 아래 칸은 축에 붙은 0번 칸과 같은 높이다.
    expect(Math.abs(ghost.y + ghost.height / 2 - (real.y + real.height / 2))).toBeLessThanOrEqual(
      1.5,
    );
    // 가로 그래프에서는 ↔로 바뀐다.
    await page.getByTestId('graph-flip').click();
    await expectOverlayAligned(page, 'gap-compare');
    await expect(overlay.getByTestId('gap-arrow')).toHaveText('↔');
  });

  test('table-link: 표 값 글과 칸 번호가 그려진다', async ({ page }) => {
    await openEngine(
      page,
      { data: FRUITS, graph: 'student', graphType: 'o-mark' },
      { overlay: 'table-link' },
    );
    for (const cat of ['🍎', '🍌', '🍇']) await cell(page, cat, 0).click();
    await cell(page, '🍎', 1).click();
    await pollObservation(
      page,
      (o) => o.misconceptions?.includes('MC-GRAPH-TABLE-MISMATCH') === true,
    );
    await showOverlay(page);
    const overlay = await expectOverlayAligned(page, 'table-link');
    // 첫 번째로 표와 다른 범주는 🍎(표 3, 그림 2).
    await expect(overlay.getByTestId('table-link-value')).toContainText('표: 3');
    await expect(overlay.locator('[data-number]')).toHaveCount(2);
    const first = await overlay.locator('[data-number="1"]').boundingBox();
    const filled = await cell(page, '🍎', 0).boundingBox();
    if (!first || !filled) throw new Error('상자를 찾지 못했습니다.');
    expect(Math.abs(first.x + first.width / 2 - (filled.x + filled.width / 2))).toBeLessThanOrEqual(
      2,
    );
  });

  test('scale-count: 두 칸까지만 누적 값을 쓰고 그 위는 …로 둔다', async ({ page }) => {
    await openEngine(
      page,
      {
        mode: 'scale',
        data: SPORTS,
        graph: 'student',
        scaleOptions: [1, 2, 5, 10],
        orientationFlip: true,
      },
      { overlay: 'scale-count', mode: 'scale' },
    );
    await page.locator('[data-scale="2"]').click();
    await showOverlay(page);
    const overlay = await expectOverlayAligned(page, 'scale-count');
    await expect(overlay.locator('[data-scale-count]')).toHaveCount(2);
    await expect(overlay.locator('[data-scale-count="2"]')).toBeVisible();
    await expect(overlay.locator('[data-scale-count="4"]')).toBeVisible();
    await expect(overlay.getByTestId('scale-count-more')).toContainText('…');
    await expect(overlay.locator('[data-scale-count="6"]')).toHaveCount(0);
    // 첫 막대(축구) 옆에 있다. WebKit은 SVG 글자의 화면 상자를 정확히 주지 않아 논리 좌표(속성)로 본다.
    const textX = Number(await overlay.locator('[data-scale-count="2"]').getAttribute('x'));
    const firstBand = frameOf('vertical', 4, 7);
    expect(textX).toBeGreaterThan(bandCenter(firstBand, 0));
    expect(textX).toBeLessThan(bandCenter(firstBand, 1));
  });

  test('length-only: 모든 막대를 같은 회색·같은 굵기로 덮고 값 글자는 없다', async ({ page }) => {
    await openEngine(
      page,
      { data: SPORTS, graph: 'given', orientationFlip: true },
      { overlay: 'length-only' },
    );
    await showOverlay(page);
    const overlay = await expectOverlayAligned(page, 'length-only');
    const groups = overlay.locator('[data-length-cat]');
    await expect(groups).toHaveCount(4);
    const widths: number[] = [];
    for (let index = 0; index < 4; index += 1) {
      const box = await groups.nth(index).locator('rect').boundingBox();
      if (!box) throw new Error('막대 상자를 찾지 못했습니다.');
      widths.push(Math.round(box.width));
    }
    expect(new Set(widths).size).toBe(1);
    await expect(overlay.locator('text')).toHaveCount(0);
    await page.getByTestId('graph-flip').click();
    await expectOverlayAligned(page, 'length-only');
    await expect(overlay.locator('[data-length-cat]')).toHaveCount(4);
  });

  test('tally-check: 아직 ✓가 없는 자료 카드를 점선 테두리로 강조한다(카드 줄 기준 1px)', async ({
    page,
  }) => {
    await openEngine(
      page,
      {
        categories: ['🍎', '🍌'],
        rawItems: ['🍎', '🍌', '🍎', '🍎', '🍌'],
        table: 'student',
        graph: 'none',
      },
      { overlay: 'tally-check' },
    );
    await page.locator('[data-tally-index="1"]').click();
    await showOverlay(page);
    const boxes = page.getByTestId('tally-check-box');
    await expect(boxes).toHaveCount(4);
    await expect(page.locator('[data-testid="tally-check-box"][data-index="1"]')).toHaveCount(0);
    for (const index of [0, 2, 3, 4]) {
      const card = page.locator(`[data-tally-index="${index}"]`);
      const mark = page.locator(`[data-testid="tally-check-box"][data-index="${index}"]`);
      await expect
        .poll(async () => {
          const cardBox = await card.boundingBox();
          const markBox = await mark.boundingBox();
          if (!cardBox || !markBox) return Number.POSITIVE_INFINITY;
          return Math.max(
            Math.abs(cardBox.x - markBox.x),
            Math.abs(cardBox.y - markBox.y),
            Math.abs(cardBox.width - markBox.width),
            Math.abs(cardBox.height - markBox.height),
          );
        })
        .toBeLessThanOrEqual(1);
    }
    // 하나를 더 표시하면 강조가 하나 줄어든다.
    await page.locator('[data-tally-index="0"]').click();
    await expect(boxes).toHaveCount(3);
  });
});

test.describe('기준 스크린샷', () => {
  test('주어진 세로 막대그래프와 표', async ({ page }) => {
    await openEngine(
      page,
      {
        mode: 'scale',
        data: SPORTS,
        scale: 2,
        scaleOptions: [1, 2, 5, 10],
        orientationFlip: true,
        valueLabel: '명',
        title: '좋아하는 운동',
        categoryAxisTitle: '운동',
        valueAxisTitle: '학생 수',
      },
      { mode: 'scale' },
    );
    await stageShot(page, 'bar-vertical-given');
  });

  test('학생이 그린 ○ 그래프(아래부터)', async ({ page }) => {
    await openEngine(page, {
      data: FRUITS,
      graph: 'student',
      graphType: 'o-mark',
      orientationFlip: true,
    });
    for (const index of [0, 1, 2]) await cell(page, '🍎', index).click();
    for (const index of [0, 1, 2, 3, 4]) await cell(page, '🍌', index).click();
    await cell(page, '🍇', 0).click();
    await stageShot(page, 'omark-student');
  });

  test('가로로 바꾼 학생 막대그래프', async ({ page }) => {
    await openEngine(
      page,
      {
        mode: 'scale',
        data: SPORTS,
        graph: 'student',
        scaleOptions: [1, 2, 5, 10],
        orientationFlip: true,
        valueLabel: '명',
      },
      { mode: 'scale' },
    );
    for (const [cat, cells] of [
      ['축구', 12],
      ['피구', 8],
      ['줄넘기', 5],
    ] as const) {
      await bar(page, cat).focus();
      for (let step = 0; step < cells; step += 1) await page.keyboard.press('ArrowUp');
    }
    await page.getByTestId('graph-flip').click();
    await expect(page.getByTestId('graph-canvas')).toHaveAttribute(
      'data-orientation',
      'horizontal',
    );
    await stageShot(page, 'bar-horizontal-student');
  });
});

test.describe('크롬북 두 칸 폭(660×420) ?stage=fit', () => {
  const variants: readonly { readonly name: string; readonly config: Record<string, unknown> }[] = [
    {
      name: 'scale·학생 막대·눈금 줄·바꾸기',
      config: {
        mode: 'scale',
        data: SPORTS,
        graph: 'student',
        scaleOptions: [1, 2, 5, 10],
        orientationFlip: true,
        valueLabel: '명',
        title: '좋아하는 운동',
        categoryAxisTitle: '운동',
        valueAxisTitle: '학생 수',
      },
    },
    {
      name: 'table-to-graph·학생 ○·학생 표·자료 카드',
      config: {
        mode: 'table-to-graph',
        data: FRUITS,
        rawItems: ['🍎', '🍌', '🍎', '🍇', '🍌', '🍎'],
        table: 'student',
        graph: 'student',
        graphType: 'o-mark',
        orientationFlip: true,
      },
    },
  ];

  for (const variant of variants) {
    test(`그래프 높이 ≥ 200px이고 단추가 잘리지 않는다 — ${variant.name}`, async ({
      page,
    }, testInfo) => {
      test.skip(testInfo.project.name !== 'chromebook', '크롬북 전용 측정');
      await page.setViewportSize({ width: 660, height: 420 });
      const mode = variant.config['mode'] as 'table-to-graph' | 'scale';
      await openEngine(page, variant.config, { stageFit: true, mode });
      await page.waitForTimeout(200);
      const measured = await expectSandboxCanvasVisible(page);
      const svg = await page.getByTestId('graph-canvas').boundingBox();
      if (!svg) throw new Error('캔버스 크기를 알 수 없습니다.');
      // 상자 안에 그림이 가로·세로 중 작은 쪽 배율로 앉으므로 실제 그림 높이를 따로 잰다.
      const picture = Math.min(svg.height, (svg.width * LOGICAL_H) / LOGICAL_W);
      console.log('T155 two-column', {
        variant: variant.name,
        box: `${Math.round(svg.width)}x${Math.round(svg.height)}`,
        picture: Math.round(picture),
        sandbox: `${Math.round(measured.width)}x${Math.round(measured.height)}`,
      });
      expect(svg.height).toBeGreaterThanOrEqual(200);
      expect(picture).toBeGreaterThanOrEqual(200);
      // 모든 조작 단추가 보이는 칸 안에 완전히 들어온다.
      const buttons = page.locator('main > div[class*="stage"] button');
      const stage = await page.locator('main > div[class*="stage"]').boundingBox();
      if (!stage) throw new Error('판 크기를 알 수 없습니다.');
      const count = await buttons.count();
      for (let index = 0; index < count; index += 1) {
        const box = await buttons.nth(index).boundingBox();
        if (!box) continue;
        expect(box.x).toBeGreaterThanOrEqual(stage.x - 1);
        expect(box.x + box.width).toBeLessThanOrEqual(stage.x + stage.width + 1);
        expect(box.y).toBeGreaterThanOrEqual(stage.y - 1);
        expect(box.y + box.height).toBeLessThanOrEqual(stage.y + stage.height + 1);
      }
    });
  }
});

test('모든 모드의 캔버스가 판 안에 들어온다(기본 ?stage=fit)', async ({ page }, testInfo) => {
  for (const mode of ['table-to-graph', 'scale'] as const) {
    await openEngine(page, { data: SPORTS, orientationFlip: true }, { stageFit: true, mode });
    const box = await expectSandboxCanvasVisible(page, {
      buttons: testInfo.project.name !== 'ipad',
    });
    console.log('T155 fit', {
      project: testInfo.project.name,
      mode,
      width: Math.round(box.width),
      height: Math.round(box.height),
    });
  }
});
