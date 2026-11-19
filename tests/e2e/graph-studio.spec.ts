import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { logicalToScreen } from './canvas-point';
import { expectSandboxCanvasVisible } from './panel-layout';
import { bandCenter, frameOf, valuePosition } from '../../src/engines/E18-graph-studio/layout';
import { Rational } from '../../src/core/math';
import {
  laneCenter,
  lineGeometry,
  normalizeLine,
  yOfValue,
} from '../../src/engines/E18-graph-studio/line';

/**
 * E18 그래프 스튜디오 샌드박스 E2E. 아이패드(WebKit)·크롬북·전자칠판 뷰포트에서 모두 돈다.
 *
 * - 두 모드(table-to-graph, scale)
 * - ○ 칸 누르기·키보드, 막대 끌기·키보드
 * - 눈금 단추 → data-cells, 가로·세로 바꾸기 → data-orientation
 * - 오버레이 5개가 실제로 그려지고 본 캔버스(tally-check는 자료 카드 줄)와 1px 안에서 맞는다
 * - 크롬북 두 칸 폭(660×420) ?stage=fit에서 그래프 높이 ≥ 200px
 * - 기준 스크린샷 3장
 * - T156: pictograph(올가미·키보드 묶기·펼치기·범례), class-vote(스탬프·하나 지우기),
 *   오버레이 2개(expand-icons·expand-compare), 두 칸 폭, 기준 스크린샷 2장
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
  readonly mode?:
    'table-to-graph' | 'scale' | 'pictograph' | 'class-vote' | 'line-graph' | 'band-circle';
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

test.describe('○ 칸 터치 크기(판 전체 폭, axisMax 7)', () => {
  const config = {
    data: { 가: 3, 나: 5, 다: 2 },
    graph: 'student',
    graphType: 'o-mark',
    axisMax: 7,
    orientationFlip: true,
  };

  for (const orientation of ['vertical', 'horizontal'] as const) {
    for (const target of [48, 64] as const) {
      test(`${orientation} · targetSize ${target}: ○ 칸 한 변이 ${target}px 이상이고 맨 위 칸도 눌러 채운다`, async ({
        page,
      }) => {
        await openEngine(page, { ...config, orientation }, { stageFit: true });
        if (target === 64) await page.getByRole('button', { name: '터치 48px' }).click();
        await expect(page.getByTestId('graph-canvas')).toHaveAttribute('data-scroll', 'true');
        for (const index of [0, 3, 6]) {
          const box = await cell(page, '가', index).locator('rect').first().boundingBox();
          if (!box) throw new Error('칸 크기를 알 수 없습니다.');
          expect(box.width).toBeGreaterThanOrEqual(target - 0.5);
          expect(box.height).toBeGreaterThanOrEqual(target - 0.5);
        }
        // 처음에는 축(0번 칸)이 보이는 쪽이다.
        const area = await page.locator('[data-scroll="true"]').first().boundingBox();
        const first = await cell(page, '가', 0).boundingBox();
        if (!area || !first) throw new Error('상자를 찾지 못했습니다.');
        expect(first.x).toBeGreaterThanOrEqual(area.x - 1);
        expect(first.y + first.height).toBeLessThanOrEqual(area.y + area.height + 1);
        // 맨 위(6번) 칸까지 스크롤해 누를 수 있다.
        const top = cell(page, '가', 6);
        await top.scrollIntoViewIfNeeded();
        await top.click();
        await expect(top).toHaveAttribute('data-filled', 'true');
      });
    }
  }
});

test.describe('○ 학생 그리기: 가로 스크롤 없음·스크롤 중 오버레이 정렬', () => {
  const config = {
    data: { 가: 3, 나: 5, 다: 2, 라: 4 },
    graph: 'student',
    graphType: 'o-mark',
    axisMax: 7,
    orientationFlip: true,
  };

  test('범주 4개·7칸·targetSize 64: 가로 스크롤이 없다', async ({ page }) => {
    await openEngine(page, config, { stageFit: true });
    await page.getByRole('button', { name: '터치 48px' }).click();
    const area = page.locator('div[data-scroll="true"]');
    await expect(area).toBeVisible();
    const sizes = await area.evaluate((element) => ({
      scrollWidth: element.scrollWidth,
      clientWidth: element.clientWidth,
      scrollHeight: element.scrollHeight,
      clientHeight: element.clientHeight,
    }));
    console.log('T155 scroll', test.info().project.name, JSON.stringify(sizes));
    expect(sizes.scrollWidth).toBeLessThanOrEqual(sizes.clientWidth);
  });

  test('gap-compare가 스크롤해도 칸과 1px 안에서 맞는다', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === 'board', '스크롤이 생기는 아이패드·크롬북에서 확인');
    await openEngine(page, config, { stageFit: true, overlay: 'gap-compare' });
    await page.getByRole('button', { name: '터치 48px' }).click();
    for (const index of [1, 3]) {
      await cell(page, '가', index).scrollIntoViewIfNeeded();
      await cell(page, '가', index).click();
    }
    await showOverlay(page);
    await expectOverlayAligned(page, 'gap-compare');
    const area = page.locator('div[data-scroll="true"]');
    for (const top of [true, false]) {
      await area.evaluate((element, toTop) => {
        element.scrollTo({ top: toTop ? 0 : element.scrollHeight, left: 0 });
      }, top);
      await expectOverlayAligned(page, 'gap-compare');
      // 선 굵기를 뺀 도형 자체의 상자로 잰다(Playwright boundingBox는 선 굵기를 포함한다).
      await expect
        .poll(async () =>
          page.evaluate(() => {
            const rectOf = (element: Element | null) => {
              if (!element) return null;
              const box = element.getBoundingClientRect();
              return { x: box.x, y: box.y, width: box.width, height: box.height };
            };
            const ghost = rectOf(document.querySelector('[data-ghost-cell="1"]'));
            const real = rectOf(document.querySelector('g[data-cat="가"][data-cell="1"] rect'));
            if (!ghost || !real) return Number.POSITIVE_INFINITY;
            const unit = real.width / 66; // 논리 좌표 1이 화면에서 몇 px인지
            return Math.max(
              Math.abs(ghost.y - real.y),
              Math.abs(ghost.height - real.height),
              Math.abs(ghost.x - (real.x + real.width + unit * 4)),
              Math.abs(ghost.width - real.width / 2),
            );
          }),
        )
        .toBeLessThanOrEqual(1);
    }
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
      // 누르는 ○ 그래프는 칸 크기를 지키려고 그래프 영역 안에서 스크롤할 수 있다(캔버스가 판보다 클 수 있음).
      const scrolls = variant.config['graphType'] === 'o-mark';
      const measured = scrolls ? { width: 0, height: 0 } : await expectSandboxCanvasVisible(page);
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
      if (!scrolls) expect(picture).toBeGreaterThanOrEqual(200);
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

// ─────────────────────────────────────────────────────────────
// T156: 그림그래프(pictograph)와 학급 투표(class-vote)
// ─────────────────────────────────────────────────────────────

const APPLES = { 가: 32, 나: 25, 다: 41, 라: 18 };

const PICTO = {
  mode: 'pictograph',
  data: APPLES,
  icon: 'apple',
  compressGroup: 10,
  legendEditable: true,
  valueLabel: '상자',
};

const VOTE = {
  mode: 'class-vote',
  question: '좋아하는 과일',
  options: ['🍎', '🍌', '🍇', '🍓'],
  transport: 'local-device',
  graphType: 'o-mark',
  stackFrom: 'bottom',
  showTable: 'sync',
};

function smalls(page: Page, cat: string): Locator {
  return page.locator(`[data-testid="graph-canvas"] g[data-cat="${cat}"][data-kind="small"]`);
}

function bigs(page: Page, cat: string): Locator {
  return page.locator(`[data-testid="graph-canvas"] g[data-cat="${cat}"][data-kind="big"]`);
}

async function addSmall(page: Page, cat: string, count: number): Promise<void> {
  const button = page.getByRole('button', { name: `${cat} 작은 그림 놓기` });
  for (let index = 0; index < count; index += 1) await button.click();
}

/** 행의 작은 그림 [from, to)번을 둘러싸는 올가미를 마우스로 그린다. */
async function lassoSmalls(page: Page, cat: string, from: number, to: number): Promise<void> {
  const icons = smalls(page, cat);
  await icons.first().scrollIntoViewIfNeeded();
  const boxes = [];
  for (let index = from; index < to; index += 1) {
    const box = await icons.nth(index).locator('[data-art-box]').boundingBox();
    if (!box) throw new Error('그림 상자를 찾지 못했습니다.');
    boxes.push(box);
  }
  const margin = 5;
  const x0 = Math.min(...boxes.map((box) => box.x)) - margin;
  const x1 = Math.max(...boxes.map((box) => box.x + box.width)) + margin;
  const y0 = Math.min(...boxes.map((box) => box.y)) - margin;
  const y1 = Math.max(...boxes.map((box) => box.y + box.height)) + margin;
  await page.mouse.move(x0, y0);
  await page.mouse.down();
  await page.mouse.move(x1, y0, { steps: 6 });
  await page.mouse.move(x1, y1, { steps: 6 });
  await page.mouse.move(x0, y1, { steps: 6 });
  await page.mouse.move(x0, y0 + 2, { steps: 4 });
  await page.mouse.up();
}

test.describe('pictograph (학생이 만드는 그림그래프)', () => {
  test('올가미로 작은 그림 10개를 묶으면 큰 그림 1개가 되고, 개수가 다르면 아무 일도 없다', async ({
    page,
  }) => {
    await openEngine(page, PICTO, { mode: 'pictograph' });
    await page.getByTestId('pictograph-lasso-toggle').click();
    await expect(page.getByTestId('pictograph-lasso-toggle')).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await addSmall(page, '가', 10);
    await expect(smalls(page, '가')).toHaveCount(10);
    await expect(page.getByTestId('pictograph-hint')).toContainText(
      '작은 그림 10개를 한 줄에서 묶어요',
    );
    // 10개가 아닌 개수(앞의 4개, 한 줄 안)만 둘러싸면 묶이지 않고 안내 글이 그대로 남는다.
    await lassoSmalls(page, '가', 0, 4);
    await expect(smalls(page, '가')).toHaveCount(10);
    await expect(bigs(page, '가')).toHaveCount(0);
    await expect(page.getByTestId('pictograph-hint')).toHaveAttribute('data-miss', 'count');
    // 10개를 둘러싸면 큰 그림 1개로 바뀐다.
    await lassoSmalls(page, '가', 0, 10);
    await expect(bigs(page, '가')).toHaveCount(1);
    await expect(smalls(page, '가')).toHaveCount(0);
    await pollObservation(
      page,
      (o) =>
        o['compressions'] === 1 &&
        (o['rowValues'] as Record<string, number>)['가'] === 10 &&
        o['legendBig'] === 10,
    );
    // 두 행에 걸친 올가미는 아무 일도 하지 않는다.
    await addSmall(page, '가', 10);
    await addSmall(page, '나', 10);
    const first = await smalls(page, '가').first().locator('[data-art-box]').boundingBox();
    const last = await smalls(page, '나').last().locator('[data-art-box]').boundingBox();
    if (!first || !last) throw new Error('그림 상자를 찾지 못했습니다.');
    await page.mouse.move(first.x - 5, first.y - 5);
    await page.mouse.down();
    await page.mouse.move(last.x + last.width + 5, first.y - 5, { steps: 6 });
    await page.mouse.move(last.x + last.width + 5, last.y + last.height + 5, { steps: 6 });
    await page.mouse.move(first.x - 5, last.y + last.height + 5, { steps: 6 });
    await page.mouse.up();
    await expect(smalls(page, '가')).toHaveCount(10);
    await expect(page.getByTestId('pictograph-hint')).toHaveAttribute('data-miss', 'rows');
  });

  test('놓인 작은 그림을 누르면 하나 빠지고, 말풍선·맞음 표시는 없다', async ({ page }) => {
    await openEngine(page, { ...PICTO, tooltips: 'show' }, { mode: 'pictograph' });
    await addSmall(page, '가', 3);
    await smalls(page, '가').nth(1).click();
    await expect(smalls(page, '가')).toHaveCount(2);
    await expect(page.getByTestId('graph-tooltip')).toHaveCount(0);
    await expect(
      page.locator('[data-correct], [data-match], [data-fit], [aria-invalid]'),
    ).toHaveCount(0);
  });

  test('키보드: 묶기 단추, 큰 그림에서 Enter로 펼치기, 9개일 때 묶기 단추는 비활성', async ({
    page,
  }) => {
    await openEngine(page, PICTO, { mode: 'pictograph' });
    const compress = page.getByRole('button', { name: '가 작은 그림 10개를 큰 그림 1개로 묶기' });
    await addSmall(page, '가', 9);
    await expect(compress).toBeDisabled();
    await addSmall(page, '가', 1);
    await expect(compress).toBeEnabled();
    await compress.focus();
    await page.keyboard.press('Enter');
    await expect(bigs(page, '가')).toHaveCount(1);
    await expect(smalls(page, '가')).toHaveCount(0);
    await expect(compress).toBeDisabled();
    await press(bigs(page, '가').first(), 'Enter');
    await expect(bigs(page, '가')).toHaveCount(0);
    await expect(smalls(page, '가')).toHaveCount(10);
    await pollObservation(page, (o) => o['compressions'] === 1 && o['expansions'] === 1);
  });

  test('범례를 큰 그림 = 5로 바꾸면 놓인 그림은 그대로이고 값 해석이 바뀐다', async ({ page }) => {
    await openEngine(page, PICTO, { mode: 'pictograph' });
    await addSmall(page, '가', 10);
    await page.getByRole('button', { name: '가 작은 그림 10개를 큰 그림 1개로 묶기' }).click();
    await expect(page.getByRole('radio', { name: '큰 그림 = 10상자' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await page.getByRole('radio', { name: '큰 그림 = 5상자' }).click();
    await expect(page.getByRole('radio', { name: '큰 그림 = 5상자' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await expect(bigs(page, '가')).toHaveCount(1);
    await pollObservation(
      page,
      (o) =>
        o['legendBig'] === 5 &&
        (o['rowValues'] as Record<string, number>)['가'] === 5 &&
        o['rowsMatchData'] === false,
    );
    // 범례 5 아래에서는 작은 그림 5개가 모이면 다시 묶을 수 있다.
    await addSmall(page, '가', 5);
    await page.getByRole('button', { name: '가 작은 그림 5개를 큰 그림 1개로 묶기' }).click();
    await pollObservation(page, (o) => (o['rowValues'] as Record<string, number>)['가'] === 10);
  });

  test('그림 크기: 작은 그림은 targetSize 이상이고 큰 그림은 1.6배, 가로 스크롤이 없다', async ({
    page,
  }) => {
    for (const target of [48, 64] as const) {
      await openEngine(page, PICTO, { mode: 'pictograph', stageFit: true });
      if (target === 64) await page.getByRole('button', { name: '터치 48px' }).click();
      await addSmall(page, '가', 11);
      await page.getByRole('button', { name: '가 작은 그림 10개를 큰 그림 1개로 묶기' }).click();
      const small = await smalls(page, '가').first().locator('[data-art-box]').boundingBox();
      const big = await bigs(page, '가').first().locator('[data-art-box]').boundingBox();
      const hit = await smalls(page, '가').first().locator('rect[data-hit]').boundingBox();
      if (!small || !big || !hit) throw new Error('그림 상자를 찾지 못했습니다.');
      expect(small.width).toBeGreaterThanOrEqual(target - 0.5);
      expect(small.height).toBeGreaterThanOrEqual(target - 0.5);
      expect(hit.width).toBeGreaterThanOrEqual(target);
      expect(big.width / small.width).toBeGreaterThan(1.55);
      expect(big.width / small.width).toBeLessThan(1.65);
      const scroll = await page
        .locator('[data-picto="true"]')
        .evaluate((element) => ({ sw: element.scrollWidth, cw: element.clientWidth }));
      expect(scroll.sw).toBeLessThanOrEqual(scroll.cw);
    }
  });
});

test.describe('올가미 토글(태블릿 스크롤)', () => {
  const touchAction = (page: Page) =>
    page.getByTestId('graph-canvas').evaluate((element) => getComputedStyle(element).touchAction);

  test('꺼져 있으면 SVG는 pan-y이고 끌어도 묶이지 않으며, 켜면 none이고 묶은 뒤에도 켜져 있다', async ({
    page,
  }) => {
    await openEngine(page, PICTO, { mode: 'pictograph' });
    const toggle = page.getByTestId('pictograph-lasso-toggle');
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
    expect(await touchAction(page)).toBe('pan-y');
    await addSmall(page, '가', 10);
    // 꺼진 상태에서 10개를 둘러싸는 경로로 끌어도 compress가 일어나지 않는다.
    await lassoSmalls(page, '가', 0, 10);
    await expect(smalls(page, '가')).toHaveCount(10);
    await expect(bigs(page, '가')).toHaveCount(0);
    await pollObservation(page, (o) => o['compressions'] === 0);
    // 꺼진 상태에서도 그림을 누르면(탭) 하나 빠진다.
    await smalls(page, '가').nth(3).click();
    await expect(smalls(page, '가')).toHaveCount(9);
    await addSmall(page, '가', 1);
    await toggle.click();
    expect(await touchAction(page)).toBe('none');
    await lassoSmalls(page, '가', 0, 10);
    await expect(bigs(page, '가')).toHaveCount(1);
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    expect(await touchAction(page)).toBe('none');
    // 켜 둔 채로 탭하면 하나 빠진다(올가미 탭 경로).
    await addSmall(page, '가', 2);
    await smalls(page, '가').first().click();
    await expect(smalls(page, '가')).toHaveCount(1);
  });
});

test.describe('table-to-graph 그림그래프 보기', () => {
  const config = {
    mode: 'table-to-graph',
    data: APPLES,
    views: ['table', 'pictograph'],
    legend: { big: 10, small: 1 },
    valueLabel: '상자',
  };

  test('자료를 큰 그림·작은 그림으로 그리고, 그림을 누르면 그 행 값이 나온다', async ({ page }) => {
    await openEngine(page, config);
    await expect(bigs(page, '다')).toHaveCount(4);
    await expect(smalls(page, '다')).toHaveCount(1);
    await expect(bigs(page, '라')).toHaveCount(1);
    await expect(smalls(page, '라')).toHaveCount(8);
    await bigs(page, '다').first().click();
    await expect(page.getByTestId('graph-tooltip')).toContainText('다: 41상자');
  });
});

test.describe('class-vote (교사 기기)', () => {
  test('스탬프 5번과 하나 지우기: ○가 아래부터 쌓이고 표가 함께 바뀐다', async ({ page }) => {
    await openEngine(page, VOTE, { mode: 'class-vote' });
    await expect(page.getByTestId('vote-question')).toHaveText('좋아하는 과일');
    const stamp = (option: string) => page.locator(`button[data-option="${option}"]`);
    for (const option of ['🍎', '🍎', '🍌', '🍎', '🍇']) await stamp(option).click();
    await pollObservation(
      page,
      (o) =>
        o['voteTotal'] === 5 &&
        JSON.stringify(o['voteCounts']) === JSON.stringify({ '🍎': 3, '🍌': 1, '🍇': 1, '🍓': 0 }),
    );
    for (const index of [0, 1, 2]) {
      await expect(cell(page, '🍎', index)).toHaveAttribute('data-filled', 'true');
    }
    await expect(cell(page, '🍎', 3)).toHaveAttribute('data-filled', 'false');
    await expect(page.locator('td[data-cat="🍎"]')).toHaveText('3');
    await expect(page.locator('td[data-cat="🍓"]')).toHaveText('0');
    await page.getByTestId('vote-undo').click();
    await pollObservation(page, (o) => o['voteTotal'] === 4);
    await expect(cell(page, '🍇', 0)).toHaveAttribute('data-filled', 'false');
    await expect(page.locator('td[data-cat="🍇"]')).toHaveText('0');
    // 학생이 ○ 칸을 눌러도 바뀌지 않는다(스탬프만 쌓는다).
    await cell(page, '🍓', 0).click({ force: true });
    await expect(cell(page, '🍓', 0)).toHaveAttribute('data-filled', 'false');
  });

  test('스탬프 단추는 높이 ≥ 96px이다', async ({ page }) => {
    await openEngine(page, VOTE, { mode: 'class-vote' });
    const box = await page.locator('button[data-option="🍎"]').boundingBox();
    if (!box) throw new Error('스탬프를 찾지 못했습니다.');
    expect(box.height).toBeGreaterThanOrEqual(96);
    expect(box.width).toBeGreaterThanOrEqual(64);
  });

  test('열이 axisMax에 이르면 그 스탬프는 비활성이다', async ({ page }) => {
    await openEngine(page, { ...VOTE, axisMax: 3 }, { mode: 'class-vote' });
    const stamp = page.locator('button[data-option="🍎"]');
    for (let index = 0; index < 3; index += 1) await stamp.click();
    await expect(stamp).toBeDisabled();
    await pollObservation(page, (o) => o['voteTotal'] === 3);
  });
});

test.describe('오버레이 2개(그림그래프)', () => {
  const read = {
    mode: 'table-to-graph',
    data: APPLES,
    views: ['table', 'pictograph'],
    legend: { big: 10, small: 1 },
  };

  test('expand-icons: 큰 그림 옆에 작은 그림 10개를 반투명 줄로 펼쳐 보이고 값 글자는 없다', async ({
    page,
  }) => {
    await openEngine(page, read, { overlay: 'expand-icons', overlayArgs: { cat: '다' } });
    await showOverlay(page);
    const overlay = await expectOverlayAligned(page, 'expand-icons');
    await expect(overlay.locator('[data-ghost-icon]')).toHaveCount(10);
    // 큰 그림 하나(첫 번째)와 같은 높이에서 오른쪽으로 놓인다.
    const ghost = await overlay.locator('[data-ghost-icon="0"] [data-art-box]').boundingBox();
    const big = await bigs(page, '다').first().locator('[data-art-box]').boundingBox();
    if (!ghost || !big) throw new Error('상자를 찾지 못했습니다.');
    expect(ghost.x).toBeGreaterThan(big.x + big.width);
    expect(Math.abs(ghost.y + ghost.height / 2 - (big.y + big.height / 2))).toBeLessThanOrEqual(
      1.5,
    );
    // 숫자는 쓰지 않는다(행 값 41도, 범례 값 10도).
    const texts = await overlay.locator('text').allTextContents();
    for (const text of texts) expect(text).not.toMatch(/\d/);
  });

  test('expand-compare: 개수가 가장 많은 행과 값이 가장 큰 행을 같은 크기 줄 두 개로 펼친다', async ({
    page,
  }) => {
    await openEngine(page, read, { overlay: 'expand-compare' });
    await showOverlay(page);
    const overlay = await expectOverlayAligned(page, 'expand-compare');
    // 그림 개수 최대 = 라(큰 1 + 작은 8 = 9개), 값 최대 = 다(41).
    await expect(overlay.locator('[data-compare-row]')).toHaveCount(2);
    await expect(overlay.locator('[data-compare-row="라"] [data-compare-cell]')).toHaveCount(18);
    await expect(overlay.locator('[data-compare-row="다"] [data-compare-cell]')).toHaveCount(41);
    const a = await overlay
      .locator('[data-compare-row="라"] [data-compare-cell="0"]')
      .boundingBox();
    const b = await overlay
      .locator('[data-compare-row="다"] [data-compare-cell="0"]')
      .boundingBox();
    if (!a || !b) throw new Error('상자를 찾지 못했습니다.');
    expect(Math.abs(a.width - b.width)).toBeLessThanOrEqual(0.5);
    expect(Math.abs(a.height - b.height)).toBeLessThanOrEqual(0.5);
    for (const text of await overlay.locator('text').allTextContents()) {
      expect(text).not.toMatch(/\d/);
    }
    await expect(overlay.locator('[data-compare-bracket]')).toHaveCount(2);
  });

  test('expand-compare: args.cats로 대상 행을 바꾼다', async ({ page }) => {
    await openEngine(page, read, {
      overlay: 'expand-compare',
      overlayArgs: { cats: ['가', '나'] },
    });
    await showOverlay(page);
    const overlay = await expectOverlayAligned(page, 'expand-compare');
    await expect(overlay.locator('[data-compare-row="가"] [data-compare-cell]')).toHaveCount(32);
    await expect(overlay.locator('[data-compare-row="나"] [data-compare-cell]')).toHaveCount(25);
  });
});

test.describe('크롬북 두 칸 폭(660×420) ?stage=fit — 그림그래프·투표', () => {
  test('그림그래프: 그림 ≥ 48px, 가로 스크롤 없음, 스크롤해도 오버레이가 1px 안에서 맞는다', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromebook', '크롬북 전용 측정');
    await page.setViewportSize({ width: 660, height: 420 });
    await openEngine(
      page,
      {
        mode: 'table-to-graph',
        data: { 가: 41, 나: 36, 다: 50, 라: 47 },
        views: ['table', 'pictograph'],
        legend: { big: 5, small: 1 },
      },
      { stageFit: true, overlay: 'expand-icons', overlayArgs: { cat: '라' } },
    );
    // 범례 5: 라 47 → 큰 그림 9 + 작은 그림 2.
    const small = await smalls(page, '라').first().locator('[data-art-box]').boundingBox();
    if (!small) throw new Error('그림 상자를 찾지 못했습니다.');
    console.log('T156 two-column picto', { small: Math.round(small.width) });
    // T160: 읽기용 그림그래프는 판에 맞춰 줄어든다(하한 20px). 판에 안 들어가면 지금처럼 스크롤한다.
    expect(small.width).toBeGreaterThanOrEqual(20 - 0.5);
    const scroller = page.locator('[data-picto="true"]');
    const sizes = await scroller.evaluate((element) => ({
      sw: element.scrollWidth,
      cw: element.clientWidth,
      sh: element.scrollHeight,
      ch: element.clientHeight,
    }));
    console.log('T156 two-column scroll', sizes);
    expect(sizes.sw).toBeLessThanOrEqual(sizes.cw);
    await showOverlay(page);
    for (const top of [true, false]) {
      await scroller.evaluate((element, toTop) => {
        element.scrollTo({ top: toTop ? 0 : element.scrollHeight });
      }, top);
      const overlay = await expectOverlayAligned(page, 'expand-icons');
      // 큰 그림 옆의 펼친 줄은 스크롤 중에도 그 큰 그림과 같은 높이에 있다.
      await expect
        .poll(async () =>
          page.evaluate(() => {
            const center = (element: Element | null) => {
              if (!element) return null;
              const box = element.getBoundingClientRect();
              return box.y + box.height / 2;
            };
            const ghost = center(document.querySelector('[data-ghost-icon="0"] [data-art-box]'));
            const big = center(
              document.querySelector(
                'g[data-cat="라"][data-kind="big"][data-index="0"] [data-art-box]',
              ),
            );
            return ghost === null || big === null
              ? Number.POSITIVE_INFINITY
              : Math.abs(ghost - big);
          }),
        )
        .toBeLessThanOrEqual(1.5);
      await expect(overlay.locator('[data-ghost-icon]')).toHaveCount(5);
    }
  });

  test('학급 투표: 스탬프 높이 ≥ 64px이고 판 안에 들어온다', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromebook', '크롬북 전용 측정');
    await page.setViewportSize({ width: 660, height: 420 });
    await openEngine(page, VOTE, { stageFit: true, mode: 'class-vote' });
    const box = await page.locator('button[data-option="🍎"]').boundingBox();
    const stage = await page.locator('main > div[class*="stage"]').boundingBox();
    if (!box || !stage) throw new Error('상자를 찾지 못했습니다.');
    console.log('T156 two-column vote', {
      stampH: Math.round(box.height),
      stampW: Math.round(box.width),
    });
    expect(box.height).toBeGreaterThanOrEqual(64);
    expect(box.x).toBeGreaterThanOrEqual(stage.x - 1);
    expect(box.x + box.width).toBeLessThanOrEqual(stage.x + stage.width + 1);
    const scroll = await page
      .locator('[data-mode="class-vote"]')
      .first()
      .evaluate((element) => ({ sw: element.scrollWidth, cw: element.clientWidth }));
    expect(scroll.sw).toBeLessThanOrEqual(scroll.cw);
  });
});

test.describe('기준 스크린샷(그림그래프·투표)', () => {
  test('그림그래프 만들기(큰 그림 1개 + 작은 그림 놓기)', async ({ page }) => {
    await openEngine(page, PICTO, { mode: 'pictograph' });
    await addSmall(page, '가', 10);
    await page.getByRole('button', { name: '가 작은 그림 10개를 큰 그림 1개로 묶기' }).click();
    await addSmall(page, '가', 3);
    await addSmall(page, '나', 7);
    await page.mouse.move(0, 0);
    await stageShot(page, 'pictograph-student');
  });

  test('학급 투표 스탬프 그래프', async ({ page }) => {
    await openEngine(page, VOTE, { mode: 'class-vote' });
    for (const option of ['🍎', '🍎', '🍌', '🍎', '🍇', '🍌']) {
      await page.locator(`button[data-option="${option}"]`).click();
    }
    await page.mouse.move(0, 0);
    await stageShot(page, 'class-vote');
  });
});

// ---------------------------------------------------------------- T158

/** 그래프 영역(스크롤 칸)과 SVG의 화면 크기. */
async function omarkSizes(page: Page) {
  return page.evaluate(() => {
    const svg = document.querySelector('[data-testid="graph-canvas"]');
    const area = svg?.parentElement;
    if (!svg || !area) throw new Error('그래프를 찾지 못했습니다.');
    const box = svg.getBoundingClientRect();
    return {
      svgWidth: box.width,
      svgHeight: box.height,
      areaWidth: area.clientWidth,
      areaHeight: area.clientHeight,
      scrollTop: area.scrollTop,
      scrollLeft: area.scrollLeft,
      scrollHeight: area.scrollHeight,
      scrollWidth: area.scrollWidth,
    };
  });
}

/** SVG 안 모든 `text`의 화면 글꼴 크기(px) 중 가장 작은 값. */
async function smallestText(page: Page): Promise<number> {
  const result = await page.evaluate(() => {
    const svg = document.querySelector('[data-testid="graph-canvas"]');
    if (!svg) throw new Error('그래프를 찾지 못했습니다.');
    const box = svg.getBoundingClientRect();
    const viewBox = (svg as SVGSVGElement).viewBox.baseVal;
    const scale = Math.min(box.width / viewBox.width, box.height / viewBox.height);
    let smallest = Number.POSITIVE_INFINITY;
    svg.querySelectorAll('text').forEach((text) => {
      // ○ 글자(칸 안)는 칸 크기에서 정해지므로 제외한다.
      if (text.textContent === '○') return;
      const size = Number.parseFloat(window.getComputedStyle(text).fontSize) * scale;
      if (size < smallest) {
        smallest = size;
        (window as unknown as { __small?: string }).__small =
          `${text.textContent} fs=${window.getComputedStyle(text).fontSize} scale=${scale}`;
      }
    });
    return { smallest, info: (window as unknown as { __small?: string }).__small };
  });

  return result.smallest;
}

test.describe('T158: ○ 그리기 크기·스크롤 안내·글자 크기', () => {
  const omark = {
    data: { 가: 4, 나: 3, 다: 5, 라: 2 },
    graph: 'student',
    graphType: 'o-mark',
    axisMax: 6,
    orientationFlip: true,
  };

  test('판이 넉넉하면 그림이 영역보다 커지지 않고 스크롤·안내 띠가 없다', async ({ page }) => {
    // 크게 열어 영역이 그림 전체보다 넓고 높게 한다.
    await page.setViewportSize({ width: 1600, height: 1200 });
    await openEngine(page, omark, { stageFit: true });
    const sizes = await omarkSizes(page);
    expect(sizes.svgWidth).toBeLessThanOrEqual(sizes.areaWidth + 1);
    expect(sizes.svgHeight).toBeLessThanOrEqual(sizes.areaHeight + 1);
    expect(sizes.scrollHeight).toBeLessThanOrEqual(sizes.areaHeight + 1);
    await expect(page.getByTestId('graph-scroll-cue')).toHaveCount(0);
    // 칸 한 변은 targetSize(48) 이상이다.
    const box = await cell(page, '가', 0).locator('rect').first().boundingBox();
    expect(box?.width ?? 0).toBeGreaterThanOrEqual(47.5);
  });

  for (const orientation of ['vertical', 'horizontal'] as const) {
    test(`${orientation}: 작은 판에서는 스크롤하고 안내 띠가 보이다가 끝에 닿으면 사라진다`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: 700, height: 420 });
      await openEngine(page, { ...omark, orientation, axisMax: 9 }, { stageFit: true });
      await page.getByRole('button', { name: '터치 48px' }).click();
      const area = page.locator('div[data-scroll="true"]');
      const sizes = await omarkSizes(page);
      const scrolls =
        orientation === 'vertical'
          ? sizes.scrollHeight > sizes.areaHeight + 1
          : sizes.scrollWidth > sizes.areaWidth + 1;
      expect(scrolls).toBe(true);
      const cue = page.getByTestId('graph-scroll-cue');
      if (orientation === 'vertical') {
        // 처음에는 맨 아래(축)라 위에 칸이 더 있다.
        await expect(cue).toBeVisible();
        await expect(cue).toContainText('위에 칸이 더 있어요');
        // 띠는 칸 누르기를 막지 않는다: 맨 위 칸까지 올라가 누른다.
        await area.evaluate((element) => element.scrollTo({ top: 0 }));
        await expect(cue).toBeHidden();
      } else {
        await expect(cue).toBeVisible();
        await expect(cue).toContainText('옆에 칸이 더 있어요');
        await area.evaluate((element) => element.scrollTo({ left: element.scrollWidth }));
        await expect(cue).toBeHidden();
      }
    });
  }

  for (const orientation of ['vertical', 'horizontal'] as const) {
    test(`${orientation}: 안내 띠는 스크롤 칸 밖에 있어 SVG와 겹치지 않고 안 보일 때도 자리를 지킨다`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: 700, height: 420 });
      await openEngine(page, { ...omark, orientation, axisMax: 9 }, { stageFit: true });
      await page.getByRole('button', { name: '터치 48px' }).click();
      const cue = page.getByTestId('graph-scroll-cue');
      await expect(cue).toBeVisible();
      await expect(cue).toHaveCSS('pointer-events', 'none');
      const canvasBox = async () => {
        // 스크롤된 SVG는 영역 밖으로 나가므로, 눈에 보이는 부분(SVG ∩ 스크롤 칸)으로 잰다.
        const svg = await page.getByTestId('graph-canvas').boundingBox();
        const host = await page.locator('div[data-scroll="true"]').boundingBox();
        if (!svg || !host) throw new Error('그래프를 찾지 못했습니다.');
        const x = Math.max(svg.x, host.x);
        const y = Math.max(svg.y, host.y);
        return {
          x,
          y,
          width: Math.min(svg.x + svg.width, host.x + host.width) - x,
          height: Math.min(svg.y + svg.height, host.y + host.height) - y,
        };
      };
      const apart = async () => {
        const c = await cue.boundingBox();
        const g = await canvasBox();
        if (!c) throw new Error('안내를 찾지 못했습니다.');
        // 상자가 서로 겹치지 않는다(가로·세로 어느 한 축에서 떨어져 있다).
        return (
          c.y + c.height <= g.y + 1 ||
          g.y + g.height <= c.y + 1 ||
          c.x + c.width <= g.x + 1 ||
          g.x + g.width <= c.x + 1
        );
      };
      expect(await apart()).toBe(true);
      // 세로 그래프는 SVG 바로 위, 가로 그래프는 바로 오른쪽에 있고 SVG와 같은 폭(높이)이다.
      const c1 = await cue.boundingBox();
      const g1 = await canvasBox();
      if (!c1) throw new Error('안내를 찾지 못했습니다.');
      if (orientation === 'vertical') {
        expect(c1.y + c1.height).toBeLessThanOrEqual(g1.y + 1);
        expect(Math.abs(c1.width - g1.width)).toBeLessThanOrEqual(1);
      } else {
        expect(c1.x).toBeGreaterThanOrEqual(g1.x + g1.width - 1);
        expect(Math.abs(c1.height - g1.height)).toBeLessThanOrEqual(1);
      }
      // 끝까지 스크롤해 안내가 안 보여도 같은 자리에 상자가 남는다(화면이 들썩이지 않는다).
      await page.locator('div[data-scroll="true"]').evaluate((element, vertical) => {
        element.scrollTo(vertical ? { top: 0 } : { left: element.scrollWidth });
      }, orientation === 'vertical');
      await expect(cue).toBeHidden();
      const c2 = await cue.boundingBox();
      expect(c2?.x).toBeCloseTo(c1.x, 0);
      expect(c2?.y).toBeCloseTo(c1.y, 0);
      expect(await apart()).toBe(true);
    });
  }

  for (const target of [48, 64] as const) {
    test(`글자는 화면에서 ${target === 64 ? 16 : 14}px 이상이다(눈금·범주·제목, 두 칸 폭 포함)`, async ({
      page,
    }) => {
      const floor = target === 64 ? 16 : 14;
      const bar = {
        data: FRUITS,
        graph: 'given',
        graphType: 'o-mark',
        axisMax: 7,
        title: '좋아하는 과일',
        categoryAxisTitle: '과일',
        valueAxisTitle: '명',
      };
      for (const viewport of [null, { width: 660, height: 420 }]) {
        if (viewport) await page.setViewportSize(viewport);
        for (const orientation of ['vertical', 'horizontal'] as const) {
          await openEngine(page, { ...bar, orientation }, { stageFit: true });
          if (target === 64) await page.getByRole('button', { name: '터치 48px' }).click();
          await expect.poll(() => smallestText(page)).toBeGreaterThanOrEqual(floor - 0.5);
          await openEngine(
            page,
            { ...bar, graphType: 'bar', orientation, scale: 1 },
            { stageFit: true },
          );
          if (target === 64) await page.getByRole('button', { name: '터치 48px' }).click();
          await expect.poll(() => smallestText(page)).toBeGreaterThanOrEqual(floor - 0.5);
        }
      }
    });
  }
});

// ---------------------------------------------------------------- T160

test.describe('T160: 그림그래프 배치(읽기용 맞춤, 행 조작은 그 행 옆)', () => {
  const read = {
    mode: 'table-to-graph',
    data: { 가: 32, 나: 25, 다: 41, 라: 18 },
    views: ['pictograph'],
    legend: { big: 10, small: 1 },
    icon: 'apple',
    tooltips: 'hide',
    valueLabel: '상자',
    title: '마을별 사과 수확량',
  };

  for (const viewport of [null, { width: 660, height: 420 }] as const) {
    test(`읽기용 그림그래프 4행이 판 안에 다 들어간다${viewport ? '(두 칸 폭 660x420)' : ''}`, async ({
      page,
    }) => {
      if (viewport) await page.setViewportSize(viewport);
      await openEngine(page, read, { stageFit: true });
      const wrap = page.locator('[data-picto="true"]');
      await expect
        .poll(async () =>
          wrap.evaluate((element) => {
            const svg = element.querySelector('[data-testid="graph-canvas"]');
            const svgBox = svg?.getBoundingClientRect();
            const wrapBox = element.getBoundingClientRect();
            if (!svgBox) return Number.POSITIVE_INFINITY;
            return Math.max(
              element.scrollHeight - element.clientHeight,
              svgBox.bottom - wrapBox.bottom - 1,
            );
          }),
        )
        .toBeLessThanOrEqual(1);
      // 네 줄 이름이 모두 보이고, 작은 그림은 20px 이상이다.
      const side = Number(await page.getByTestId('graph-canvas').getAttribute('data-icon-side'));
      console.log('T160 given icon', test.info().project.name, viewport ? '660x420' : 'full', side);
      expect(side).toBeGreaterThanOrEqual(20);
      const wrapBox = await wrap.boundingBox();
      if (!wrapBox) throw new Error('판을 찾지 못했습니다.');
      for (const cat of ['가', '나', '다', '라']) {
        const label = await page
          .locator(`[data-testid="graph-canvas"] g[data-row="${cat}"] text`)
          .boundingBox();
        if (!label) throw new Error('행 이름을 찾지 못했습니다.');
        expect(label.y).toBeGreaterThanOrEqual(wrapBox.y - 1);
        expect(label.y + label.height).toBeLessThanOrEqual(wrapBox.y + wrapBox.height + 1);
      }
    });
  }

  for (const viewport of [null, { width: 660, height: 420 }] as const) {
    test(`학생 만들기: 각 행의 단추가 그 행 안(좁으면 바로 아래)에 있다${viewport ? '(두 칸 폭)' : ''}`, async ({
      page,
    }) => {
      if (viewport) await page.setViewportSize(viewport);
      await openEngine(
        page,
        { ...PICTO, legend: { big: 10, small: 1 }, table: 'given' },
        { mode: 'pictograph', stageFit: true },
      );
      const svg = page.getByTestId('graph-canvas');
      const mode = await page.locator('[data-controls]').first().getAttribute('data-controls');
      const svgBox = await svg.boundingBox();
      if (!svgBox) throw new Error('그림그래프를 찾지 못했습니다.');
      for (const cat of ['가', '나', '다', '라']) {
        const row = page.locator(`[data-testid="graph-canvas"] g[data-row="${cat}"]`);
        const top = Number(await row.getAttribute('data-row-top'));
        const height = Number(await row.getAttribute('data-row-height'));
        const area = Number(await row.getAttribute('data-row-area'));
        const button = page.getByRole('button', { name: `${cat} 작은 그림 놓기` });
        const box = await button.boundingBox();
        if (!box) throw new Error('단추를 찾지 못했습니다.');
        // SVG 논리 좌표는 화면 px와 같다. 스크롤해도 SVG 상자 기준 상대 위치로 잰다.
        const center = box.y + box.height / 2 - svgBox.y;
        const lo = mode === 'below' ? top + area : top;
        const hi = top + height;
        console.log(
          'T160 controls',
          test.info().project.name,
          mode,
          cat,
          Math.round(center),
          lo,
          hi,
        );
        expect(center).toBeGreaterThanOrEqual(lo - 1);
        expect(center).toBeLessThanOrEqual(hi + 1);
        // 단추는 targetSize(48) 이상이다.
        expect(box.height).toBeGreaterThanOrEqual(47.5);
        expect(box.width).toBeGreaterThanOrEqual(47.5);
      }
      // 판 아래에 따로 떨어진 단추 줄은 없다.
      await expect(page.getByTestId('pictograph-controls')).toHaveCount(0);
      // 동작은 그대로다: 놓기 → 묶기.
      await addSmall(page, '가', 10);
      await page.getByRole('button', { name: '가 작은 그림 10개를 큰 그림 1개로 묶기' }).click();
      await expect(bigs(page, '가')).toHaveCount(1);
    });
  }
});

test.describe('T161: 자료 묶음 고르기(datasets)', () => {
  const picker = {
    mode: 'table-to-graph',
    graph: 'student',
    graphType: 'bar',
    table: 'given',
    scale: 1,
    valueLabel: '명',
    datasets: [
      { id: 'food', title: '좋아하는 음식', data: { 피자: 3, 떡볶이: 2 }, source: '우리 반 조사' },
      {
        id: 'pet',
        title: '키우고 싶은 동물',
        data: { 강아지: 4, 고양이: 1, 토끼: 2 },
        valueLabel: '마리',
      },
      { id: 'game', title: '하고 싶은 놀이 이름이 아주 긴 묶음', data: { 술래잡기: 5, 피구: 3 } },
    ],
  };

  async function drawBars(page: Page, values: Readonly<Record<string, number>>) {
    for (const [cat, cells] of Object.entries(values)) {
      for (let i = 0; i < cells; i += 1) await press(bar(page, cat), 'ArrowUp');
      await expect(bar(page, cat)).toHaveAttribute('data-cells', String(cells));
    }
  }

  test('고르기 전에는 안내만 있고, 고른 뒤 막대를 그리면 graphMatches가 맞는다', async ({
    page,
  }) => {
    await openEngine(page, picker, { stageFit: true });
    await expect(page.getByTestId('graph-dataset-hint')).toHaveText('자료를 하나 골라요');
    await expect(page.getByTestId('graph-canvas')).toHaveCount(0);
    await page.getByRole('radio', { name: '키우고 싶은 동물' }).click();
    await expect(page.getByTestId('graph-dataset-hint')).toHaveCount(0);
    await pollObservation(page, (o) => o['datasetId'] === 'pet');
    await drawBars(page, { 강아지: 4, 고양이: 1, 토끼: 2 });
    await pollObservation(page, (o) => o['graphMatchesData'] === true);
    // 다른 묶음을 고르면 그래프가 비워진다.
    await page.getByRole('radio', { name: '좋아하는 음식' }).click();
    await pollObservation(
      page,
      (o) => o['datasetId'] === 'food' && o['graphMatchesData'] === false,
    );
    await expect(bar(page, '피자')).toHaveAttribute('data-cells', '0');
    await expect(page.getByTestId('graph-dataset-source')).toHaveText('자료: 우리 반 조사');
    const sourceSize = await page
      .getByTestId('graph-dataset-source')
      .evaluate((element) => Number.parseFloat(window.getComputedStyle(element).fontSize));
    expect(sourceSize).toBeGreaterThanOrEqual(14);
  });

  for (const viewport of [null, { width: 660, height: 420 }] as const) {
    test(`단추 줄이 잘리지 않고 단추는 targetSize 이상이다${viewport ? '(두 칸 폭 660x420)' : ''}`, async ({
      page,
    }) => {
      if (viewport) await page.setViewportSize(viewport);
      await openEngine(page, picker, { stageFit: true });
      const row = page.getByTestId('graph-dataset-row');
      const wrap = page.locator('[data-mode="table-to-graph"]').first();
      const rowBox = await row.boundingBox();
      const wrapBox = await wrap.boundingBox();
      if (!rowBox || !wrapBox) throw new Error('단추 줄을 찾지 못했습니다.');
      const buttons = row.getByRole('radio');
      await expect(buttons).toHaveCount(3);
      for (let i = 0; i < 3; i += 1) {
        const box = await buttons.nth(i).boundingBox();
        if (!box) throw new Error('단추를 찾지 못했습니다.');
        expect(box.height).toBeGreaterThanOrEqual(47.5);
        expect(box.x).toBeGreaterThanOrEqual(wrapBox.x - 1);
        expect(box.x + box.width).toBeLessThanOrEqual(wrapBox.x + wrapBox.width + 1);
      }
      expect(rowBox.width).toBeLessThanOrEqual(wrapBox.width + 1);
      expect(
        await row.evaluate((element) => element.scrollWidth - element.clientWidth),
      ).toBeLessThanOrEqual(1);
    });
  }

  test('기준 스크린샷(묶음을 고른 뒤)', async ({ page }) => {
    await openEngine(page, picker, { stageFit: true });
    await page.getByRole('radio', { name: '좋아하는 음식' }).click();
    await drawBars(page, { 피자: 3 });
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await page.mouse.move(0, 0);
    if (test.info().project.name.toLowerCase().includes('chromebook')) {
      await stageShot(page, 'dataset-picked');
    }
  });
});

test.describe('T161: 고른 묶음 표시와 그래프 영역 크기', () => {
  const picker = {
    mode: 'table-to-graph',
    graph: 'student',
    graphType: 'bar',
    table: 'given',
    scale: 1,
    datasets: [
      { id: 'food', title: '좋아하는 음식', data: { 피자: 3, 떡볶이: 2 } },
      { id: 'pet', title: '키우고 싶은 동물', data: { 강아지: 4, 고양이: 1, 토끼: 2 } },
    ],
  };

  test('고른 단추에는 색 말고 ✓ 글자도 있다', async ({ page }) => {
    await openEngine(page, picker, { stageFit: true });
    const food = page.getByRole('radio', { name: '좋아하는 음식' });
    await expect(food).not.toContainText('✓');
    await food.click();
    await expect(food).toContainText('✓');
    await expect(food).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByRole('radio', { name: '키우고 싶은 동물' })).not.toContainText('✓');
  });

  for (const viewport of [null, { width: 660, height: 420 }] as const) {
    test(`고른 뒤 막대 그래프 영역은 높이 200px 이상이다${viewport ? '(두 칸 폭 660x420)' : ''}`, async ({
      page,
    }, testInfo) => {
      if (viewport) await page.setViewportSize(viewport);
      await openEngine(page, picker, { stageFit: true });
      await page.getByRole('radio', { name: '좋아하는 음식' }).click();
      const box = await page.locator('[data-testid="graph-canvas"]').boundingBox();
      const area = await page.locator('[data-testid="graph-canvas"]').evaluate((element) => {
        const parent = element.parentElement?.getBoundingClientRect();
        return parent ? `${Math.round(parent.width)}x${Math.round(parent.height)}` : '?';
      });
      if (!box) throw new Error('그래프를 찾지 못했습니다.');
      console.log(
        'T161 graph',
        testInfo.project.name,
        viewport ? '660x420' : 'full',
        `svg ${Math.round(box.width)}x${Math.round(box.height)}`,
        `area ${area}`,
      );
      expect(box.height).toBeGreaterThanOrEqual(200);
    });
  }
});

test.describe('T163: line-graph(꺾은선그래프)', () => {
  const POINTS = [
    { x: '1일', y: '36.5' },
    { x: '2일', y: '36.8' },
    { x: '3일', y: '37.2' },
    { x: '4일', y: '36.6' },
    { x: '5일', y: '36.9' },
  ];
  const base = {
    mode: 'line-graph',
    points: POINTS,
    title: '체온 변화',
    categoryAxisTitle: '날짜',
    valueAxisTitle: '체온(℃)',
    valueLabel: '℃',
    yStep: '0.5',
    plotStep: '0.1',
    yFromOptions: ['0', '36'],
  };
  // 시작값 36부터: 세로 36~38이 판을 채워 plotStep 0.1(눈금 한 칸의 1/5)을 아이패드에서도 정확히 누를 수 있다.
  const student = { ...base, graph: 'student', yFrom: '36' };

  function lane(page: Page, x: string): Locator {
    return page.locator(`[data-testid="line-lane"][data-x="${x}"]`);
  }

  function pointOf(page: Page, x: string, kind = 'actual'): Locator {
    return page.locator(`[data-testid="line-point"][data-x="${x}"][data-kind="${kind}"]`);
  }

  /** 레인 번호와 값(문자열)의 화면 좌표. 그림이 화면 밖이면 스크롤해서 가져온다. */
  async function screenOf(page: Page, config: Record<string, unknown>, index: number, y: string) {
    const canvas = page.getByTestId('graph-canvas');
    await canvas.scrollIntoViewIfNeeded();
    const box = await canvas.boundingBox();
    if (!box) throw new Error('그래프를 찾지 못했습니다.');
    const width = Number(await canvas.getAttribute('data-logical-width'));
    const from = (await canvas.getAttribute('data-y-from')) ?? '0';
    const g = lineGeometry(normalizeLine(config), from, width);
    return {
      x: box.x + (laneCenter(g, index) * box.width) / width,
      y: box.y + (yOfValue(g, Rational.parse(y)) * box.height) / LOGICAL_H,
    };
  }

  test('레인을 누르면 plotStep에 붙은 점이 찍히고 이웃 점과 이어진다(connect: auto)', async ({
    page,
  }) => {
    await openEngine(page, student, { stageFit: true, mode: 'line-graph' });
    const first = await screenOf(page, student, 0, '36.5');
    await page.mouse.click(first.x, first.y);
    await expect(pointOf(page, '1일')).toHaveAttribute('data-y', '36.5');
    const second = await screenOf(page, student, 1, '36.8');
    await page.mouse.click(second.x, second.y);
    await expect(pointOf(page, '2일')).toHaveAttribute('data-y', '36.8');
    await expect(page.locator('[data-testid="line-segment"][data-a="0"][data-b="1"]')).toHaveCount(
      1,
    );
    await pollObservation(
      page,
      (o) => (o['linePoints'] as Record<string, string | null>)['1일'] === '73/2',
    );
    // 정오 표시·말풍선이 없다.
    await expect(page.getByTestId('graph-tooltip')).toHaveCount(0);
  });

  test('레인에서 끌면 손을 뗀 높이에 점이 찍힌다', async ({ page }) => {
    await openEngine(page, student, { stageFit: true, mode: 'line-graph' });
    const from = await screenOf(page, student, 2, '36.2');
    const to = await screenOf(page, student, 2, '37.2');
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(from.x + 4, (from.y + to.y) / 2, { steps: 4 });
    await page.mouse.move(to.x, to.y, { steps: 4 });
    await expect(page.getByTestId('line-preview')).toHaveCount(1);
    await page.mouse.up();
    await expect(pointOf(page, '3일')).toHaveAttribute('data-y', '37.2');
    await expect(page.getByTestId('line-preview')).toHaveCount(0);
  });

  test('키보드: ↑↓로 plotStep씩 움직이고 Delete로 지운다', async ({ page }) => {
    await openEngine(page, student, { stageFit: true, mode: 'line-graph' });
    const target = lane(page, '2일');
    await press(target, 'ArrowUp'); // 처음에는 시작값(36)
    await expect(pointOf(page, '2일')).toHaveAttribute('data-y', '36');
    await press(target, 'ArrowUp');
    await press(target, 'ArrowUp');
    await expect(pointOf(page, '2일')).toHaveAttribute('data-y', '36.2');
    await press(target, 'ArrowDown');
    await expect(pointOf(page, '2일')).toHaveAttribute('data-y', '36.1');
    await press(target, 'Delete');
    await expect(pointOf(page, '2일')).toHaveCount(0);
  });

  test('connect: student — 끌어서 잇고, 선분을 누르면 끊고, 점 둘에서 Enter로도 잇는다', async ({
    page,
  }) => {
    const config = { ...student, connect: 'student' };
    await openEngine(page, config, { stageFit: true, mode: 'line-graph' });
    for (const [index, point] of POINTS.entries()) {
      const at = await screenOf(page, config, index, point.y);
      await page.mouse.click(at.x, at.y);
    }
    await expect(page.locator('[data-testid="line-segment"]')).toHaveCount(0);
    const a = await screenOf(page, config, 0, '36.5');
    const b = await screenOf(page, config, 1, '36.8');
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.mouse.move(b.x, b.y, { steps: 6 });
    await page.mouse.up();
    const segment = page.locator('[data-testid="line-segment"][data-a="0"][data-b="1"]');
    await expect(segment).toHaveCount(1);
    await pollObservation(page, (o) => JSON.stringify(o['segments']) === '[[0,1]]');
    // 건너뛴 쌍도 이을 수 있고 순서 판정은 거짓이다.
    const c = await screenOf(page, config, 3, '36.6');
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.mouse.move(c.x, c.y, { steps: 6 });
    await page.mouse.up();
    await expect(page.locator('[data-testid="line-segment"][data-a="0"][data-b="3"]')).toHaveCount(
      1,
    );
    await pollObservation(page, (o) => o['segmentsInOrder'] === false);
    // 선분을 누르면 끊어진다(나중에 이은 건너뛴 선분의 가운데).
    const skip = page.locator('[data-testid="line-segment"][data-a="0"][data-b="3"]');
    const mid = await skip.locator('line').nth(1).boundingBox();
    if (!mid) throw new Error('선분을 찾지 못했습니다.');
    await page.mouse.click(mid.x + mid.width / 2, mid.y + mid.height / 2);
    await expect(skip).toHaveCount(0);
    await press(segment, 'Delete');
    await expect(page.locator('[data-testid="line-segment"]')).toHaveCount(0);
    // 점 둘을 차례로 눌러 잇는다.
    await page.mouse.click(a.x, a.y);
    await page.mouse.click(b.x, b.y);
    await expect(segment).toHaveCount(1);
    // 키보드: 점에서 Enter → 다른 점에서 Enter.
    await press(lane(page, '2일'), 'Enter');
    await press(lane(page, '3일'), 'Enter');
    await expect(page.locator('[data-testid="line-segment"][data-a="1"][data-b="2"]')).toHaveCount(
      1,
    );
  });

  test('이웃한 쌍을 모두 이으면 segmentsInOrder가 참이다', async ({ page }) => {
    const config = { ...student, connect: 'student' };
    await openEngine(page, config, { stageFit: true, mode: 'line-graph' });
    for (const [index, point] of POINTS.entries()) {
      const at = await screenOf(page, config, index, point.y);
      await page.mouse.click(at.x, at.y);
    }
    for (let index = 0; index < 4; index += 1) {
      await press(lane(page, POINTS[index]?.x ?? ''), 'Enter');
      await press(lane(page, POINTS[index + 1]?.x ?? ''), 'Enter');
    }
    await pollObservation(
      page,
      (o) => o['segmentsInOrder'] === true && o['pointsMatchData'] === true,
    );
  });

  test('물결선 단추로 data-y-from·data-wavy가 바뀌고 낮은 점은 지워진다', async ({ page }) => {
    // 0부터 보이는 판은 36~38의 0.1을 정확히 누르기 어렵다(물결선을 쓰는 까닭). 여기서는 낮은 점만 만든다.
    await openEngine(
      page,
      { ...student, yFrom: '0', plotStep: '1' },
      { stageFit: true, mode: 'line-graph' },
    );
    const canvas = page.getByTestId('graph-canvas');
    await expect(canvas).toHaveAttribute('data-y-from', '0');
    await expect(canvas).toHaveAttribute('data-wavy', 'false');
    await expect(page.getByTestId('line-wavy')).toHaveCount(0);
    const low = await screenOf(page, student, 0, '30');
    await page.mouse.click(low.x, low.y);
    const lowY = Number(await pointOf(page, '1일').getAttribute('data-y'));
    expect(lowY).toBeGreaterThan(20);
    expect(lowY).toBeLessThan(36);
    await page.getByRole('radio', { name: '36부터' }).click();
    await expect(canvas).toHaveAttribute('data-y-from', '36');
    await expect(canvas).toHaveAttribute('data-wavy', 'true');
    await expect(page.getByTestId('line-wavy')).toBeVisible();
    await expect(pointOf(page, '1일')).toHaveCount(0);
    await pollObservation(page, (o) => o['wavyShown'] === true && o['yFrom'] === '36');
    // 바뀐 축에서는 36 이상만 찍힌다.
    const at = await screenOf(page, student, 0, '37');
    await page.mouse.click(at.x, at.y);
    await expect(pointOf(page, '1일')).toHaveAttribute('data-y', '37');
    await page.getByRole('radio', { name: '0부터' }).click();
    await expect(canvas).toHaveAttribute('data-wavy', 'false');
  });

  test('예측 → 실제 자료 보기: 점선·빈 원과 실선·채운 원을 범례 글로도 구별한다', async ({
    page,
  }) => {
    const config = { ...base, graph: 'given', predict: true, yFromOptions: undefined };
    await openEngine(page, config, { stageFit: true, mode: 'line-graph' });
    await expect(page.getByTestId('graph-table')).toHaveCount(0);
    await expect(pointOf(page, '1일', 'actual')).toHaveCount(0);
    const legend = page.getByTestId('line-legend');
    await expect(legend).toContainText('예측');
    await expect(legend).toContainText('실제');
    const finish = page.getByTestId('line-finish-predict');
    await expect(finish).toBeDisabled();
    for (const [index, y] of ['36.4', '36.9', '37.5'].entries()) {
      const at = await screenOf(page, config, index, y);
      await page.mouse.click(at.x, at.y);
    }
    await expect(pointOf(page, '3일', 'prediction')).toHaveCount(1);
    await expect(page.locator('[data-testid="line-segment"][data-kind="prediction"]')).toHaveCount(
      2,
    );
    const dash = await page
      .locator('[data-testid="line-segment"][data-kind="prediction"] line')
      .first()
      .getAttribute('stroke-dasharray');
    expect(dash).toBeTruthy();
    await expect(pointOf(page, '3일', 'prediction').locator('circle').first()).toHaveAttribute(
      'fill',
      '#fbfaf6',
    );
    await pollObservation(page, (o) => o['phase'] === 'predict' && o['predictionCount'] === 3);
    await finish.click();
    await pollObservation(page, (o) => o['phase'] === 'actual' && o['predictionDone'] === true);
    await expect(pointOf(page, '3일', 'actual')).toHaveAttribute('data-y', '37.2');
    await expect(page.locator('[data-testid="line-segment"][data-kind="actual"]')).toHaveCount(4);
    await expect(pointOf(page, '3일', 'prediction')).toHaveCount(1);
    await expect(page.getByTestId('graph-table')).toBeVisible();
    const solid = await page
      .locator('[data-testid="line-segment"][data-kind="actual"] line')
      .first()
      .getAttribute('stroke-dasharray');
    expect(solid).toBeNull();
    // 예측은 더 바꿀 수 없다.
    await expect(page.getByTestId('line-finish-predict')).toHaveCount(0);
  });

  test('given + tooltips: show는 점을 눌러 값을 본다', async ({ page }) => {
    await openEngine(
      page,
      { ...base, graph: 'given', tooltips: 'show' },
      { stageFit: true, mode: 'line-graph' },
    );
    await pointOf(page, '3일').locator('circle').nth(1).click({ force: true });
    await expect(page.getByTestId('graph-tooltip')).toContainText('3일: 37.2℃');
  });

  test('글자는 화면에서 14px 이상이다', async ({ page }) => {
    await openEngine(page, { ...base, graph: 'given' }, { stageFit: true, mode: 'line-graph' });
    const canvas = page.getByTestId('graph-canvas');
    const box = await canvas.boundingBox();
    if (!box) throw new Error('그래프를 찾지 못했습니다.');
    const width = Number(await canvas.getAttribute('data-logical-width'));
    const scale = Math.min(box.width / width, box.height / LOGICAL_H);
    // WebKit은 SVG 글자의 화면 상자를 주지 않아, 글꼴 크기 속성(논리)에 화면 배율을 곱해 본다.
    const sizes = await canvas.locator('text').evaluateAll((nodes) =>
      nodes.map((node) => ({
        text: node.textContent ?? '',
        font: Number.parseFloat(node.closest('[font-size]')?.getAttribute('font-size') ?? '0'),
      })),
    );
    expect(sizes.length).toBeGreaterThan(5);
    expect(sizes.filter((item) => item.font * scale < 13.9)).toEqual([]);
  });

  test('레인이 좁으면 targetSize까지 폭을 늘려 가로 스크롤하고 안내 띠를 보인다', async ({
    page,
  }) => {
    const many = {
      ...student,
      points: Array.from({ length: 14 }, (_, index) => ({
        x: `${index + 1}일`,
        y: `${36 + (index % 5) / 10}`,
      })),
    };
    await page.setViewportSize({ width: 700, height: 520 });
    await openEngine(page, many, { stageFit: true, mode: 'line-graph' });
    await page.getByRole('button', { name: '터치 48px' }).click();
    const cue = page.getByTestId('graph-scroll-cue');
    await expect(cue).toBeVisible();
    const widths = await page
      .locator('[data-testid="line-lane"] rect')
      .evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect().width));
    expect(Math.min(...widths)).toBeGreaterThanOrEqual(63);
    const area = page.locator('div[data-scroll="true"]');
    expect(await area.evaluate((element) => element.scrollWidth > element.clientWidth + 1)).toBe(
      true,
    );
    await area.evaluate((element) => element.scrollTo({ left: element.scrollWidth }));
    await expect(cue).toBeHidden();
    // 맨 오른쪽 레인도 눌린다.
    const at = await screenOf(page, many, 13, '36.4');
    await page.mouse.click(at.x, at.y);
    await expect(pointOf(page, '14일')).toHaveAttribute('data-y', '36.4');
  });
});

test.describe('T165: line-graph 판 채우기·눈금 건너뛰기', () => {
  const POINTS = [
    { x: '1일', y: '0.5' },
    { x: '3일', y: '2' },
    { x: '5일', y: '5.5' },
    { x: '7일', y: '9.5' },
    { x: '9일', y: '11' },
  ];
  const config = {
    mode: 'line-graph',
    points: POINTS,
    title: '강낭콩 키',
    categoryAxisTitle: '날짜',
    valueAxisTitle: '키(cm)',
    valueLabel: 'cm',
    yStep: '1',
    plotStep: '0.5',
    yMax: '12',
    graph: 'student',
  };

  for (const viewport of [null, { width: 660, height: 420 }] as const) {
    test(`학생 그리기 그래프가 판의 남는 높이를 쓰고 0.5 한 칸이 8px 이상이다${viewport ? '(660x420)' : ''}`, async ({
      page,
    }) => {
      if (viewport) await page.setViewportSize(viewport);
      await openEngine(page, config, { stageFit: true, mode: 'line-graph' });
      const canvas = page.getByTestId('graph-canvas');
      await expect(canvas).toBeVisible();
      const box = await canvas.boundingBox();
      const area = await page.locator('div[data-scroll="true"]').boundingBox();
      if (!box || !area) throw new Error('그래프를 찾지 못했습니다.');
      const width = Number(await canvas.getAttribute('data-logical-width'));
      const g = lineGeometry(normalizeLine(config), '0', width);
      const scale = box.height / LOGICAL_H;
      const px = g.unit * 0.5 * scale;
      console.log(
        `[T165 ${test.info().project.name}${viewport ? ' 660x420' : ''}] 그래프 ${Math.round(box.width)}x${Math.round(box.height)}, 영역 ${Math.round(area.width)}x${Math.round(area.height)}, 0.5 한 칸 ${px.toFixed(1)}px`,
      );
      expect(box.height).toBeGreaterThanOrEqual(area.height * 0.9);
      // 660x420 두 칸 폭은 판이 낮아 그래프 높이 기준(8px)을 완화한다.
      expect(px).toBeGreaterThanOrEqual(viewport ? 6 : 8);
    });
  }

  test('yStep 0.2, 0부터 넓은 범위: 눈금 글자가 5 단위(0, 5, 10, …)로 찍힌다', async ({ page }) => {
    const wide = {
      ...config,
      points: [
        { x: '9시', y: '36.5' },
        { x: '10시', y: '37.2' },
      ],
      yStep: '0.2',
      plotStep: '0.1',
      yMax: '37.6',
      graph: 'given',
    };
    await openEngine(page, wide, { stageFit: true, mode: 'line-graph' });
    const canvas = page.getByTestId('graph-canvas');
    await expect(canvas).toBeVisible();
    const labels = await canvas
      .locator('g > text[text-anchor="end"]')
      .evaluateAll((nodes) => nodes.map((node) => node.textContent ?? ''));
    expect(labels.length).toBeGreaterThan(2);
    for (const label of labels) expect(Number(label) % 5, label).toBe(0);
    expect(labels[0]).toBe('0');
    expect(labels[1]).toBe('5');
  });
});

test.describe('T163: line-graph 오버레이 4개', () => {
  const config = {
    mode: 'line-graph',
    graph: 'given',
    points: [
      { x: '1일', y: '36.5' },
      { x: '2일', y: '36.8' },
      { x: '3일', y: '37.2' },
      { x: '4일', y: '36.6' },
    ],
    yStep: '0.5',
    plotStep: '0.1',
    yFrom: '36',
    yFromOptions: ['0', '36'],
    valueLabel: '℃',
  };

  async function numbers(element: Locator, attributes: readonly string[]) {
    return Promise.all(attributes.map(async (name) => Number(await element.getAttribute(name))));
  }

  test('change-bars: 구간마다 늘면 위, 줄면 아래 막대이고 글자가 없다', async ({ page }) => {
    await openEngine(page, config, { stageFit: true, mode: 'line-graph', overlay: 'change-bars' });
    await showOverlay(page);
    const overlay = await expectOverlayAligned(page, 'change-bars');
    const bars = overlay.locator('[data-change-index]');
    await expect(bars).toHaveCount(3);
    await expect(bars.nth(0)).toHaveAttribute('data-change-dir', 'up');
    await expect(bars.nth(1)).toHaveAttribute('data-change-dir', 'up');
    await expect(bars.nth(2)).toHaveAttribute('data-change-dir', 'down');
    const [h0] = await numbers(bars.nth(0), ['height']);
    const [h1] = await numbers(bars.nth(1), ['height']);
    expect(h1).toBeGreaterThan(h0 ?? 0); // 0.4 > 0.3
    await expect(overlay.locator('text')).toHaveCount(0);
  });

  test('unfold-axis: 펼친 작은 그림과 물결선 자리 괄호를 그리고 글자가 없다', async ({ page }) => {
    await openEngine(page, config, { stageFit: true, mode: 'line-graph', overlay: 'unfold-axis' });
    await showOverlay(page);
    const overlay = await expectOverlayAligned(page, 'unfold-axis');
    await expect(overlay.getByTestId('unfold-axis-box')).toBeVisible();
    await expect(overlay.getByTestId('unfold-axis-bracket')).toHaveCount(1);
    await expect(overlay.getByTestId('unfold-axis-bracket-main')).toHaveCount(1);
    await expect(overlay.locator('text')).toHaveCount(0);
  });

  test('scale-count: 시작값부터 두 칸까지만 값을 쓰고 그 위는 …이다', async ({ page }) => {
    await openEngine(page, config, {
      stageFit: true,
      mode: 'line-graph',
      overlay: 'scale-count',
      overlayArgs: { x: '2일' },
    });
    await showOverlay(page);
    const overlay = await expectOverlayAligned(page, 'scale-count');
    await expect(overlay.locator('[data-scale-count]')).toHaveCount(2);
    await expect(overlay.locator('[data-scale-count="36.5"]')).toHaveCount(1);
    await expect(overlay.locator('[data-scale-count="37"]')).toHaveCount(1);
    await expect(overlay.getByTestId('scale-count-more')).toContainText('…');
    // 글자는 2일 레인 오른쪽에 있다(논리 좌표 속성으로 본다).
    const [x] = await numbers(overlay.locator('[data-scale-count="36.5"]'), ['x']);
    const canvas = page.getByTestId('graph-canvas');
    const width = Number(await canvas.getAttribute('data-logical-width'));
    const g = lineGeometry(normalizeLine(config), '36', width);
    expect(x).toBeGreaterThan(laneCenter(g, 1));
    expect(x).toBeLessThan(laneCenter(g, 2));
  });

  test('interp-guide: a와 a+1 사이 t 자리에 점선과 깜빡이는 표시를 그린다', async ({ page }) => {
    await openEngine(page, config, {
      stageFit: true,
      mode: 'line-graph',
      overlay: 'interp-guide',
      overlayArgs: { a: 1, t: 0.5 },
    });
    await showOverlay(page);
    const overlay = await expectOverlayAligned(page, 'interp-guide');
    const canvas = page.getByTestId('graph-canvas');
    const width = Number(await canvas.getAttribute('data-logical-width'));
    const g = lineGeometry(normalizeLine(config), '36', width);
    const [x1] = await numbers(overlay.getByTestId('interp-guide-line'), ['x1']);
    expect(x1).toBeCloseTo((laneCenter(g, 1) + laneCenter(g, 2)) / 2, 1);
    const mark = overlay.getByTestId('interp-guide-mark');
    await expect(mark).toHaveAttribute('data-blink', 'on');
    const [cy] = await numbers(mark.locator('circle'), ['cy']);
    const expectedY =
      (yOfValue(g, Rational.parse('36.8')) + yOfValue(g, Rational.parse('37.2'))) / 2;
    expect(cy).toBeCloseTo(expectedY, 1);
    await expect(overlay.locator('text')).toHaveCount(0);
  });

  test('interp-guide: 동작 줄이기 설정이면 깜빡이지 않는다', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openEngine(page, config, {
      stageFit: true,
      mode: 'line-graph',
      overlay: 'interp-guide',
      overlayArgs: { a: 0, t: 0.25 },
    });
    await showOverlay(page);
    const overlay = await expectOverlayAligned(page, 'interp-guide');
    await expect(overlay.getByTestId('interp-guide-mark')).toHaveAttribute('data-blink', 'off');
    await expect(overlay.locator('animate')).toHaveCount(0);
  });

  test('학생 그래프에 점을 찍은 뒤에도 오버레이가 1px 안에서 맞는다', async ({ page }) => {
    const student = { ...config, graph: 'student', yFrom: '0' };
    await openEngine(page, student, { stageFit: true, mode: 'line-graph', overlay: 'change-bars' });
    await press(page.locator('[data-testid="line-lane"][data-x="1일"]'), 'ArrowUp');
    await press(page.locator('[data-testid="line-lane"][data-x="2일"]'), 'ArrowUp');
    await press(page.locator('[data-testid="line-lane"][data-x="2일"]'), 'ArrowUp');
    await showOverlay(page);
    const overlay = await expectOverlayAligned(page, 'change-bars');
    await expect(overlay.locator('[data-change-index]')).toHaveCount(1);
  });
});

test.describe('T163: line-graph 크롬북 두 칸 폭(660×420) ?stage=fit', () => {
  const variants: readonly { readonly name: string; readonly config: Record<string, unknown> }[] = [
    {
      name: '학생 그리기·물결선·잇기',
      config: {
        mode: 'line-graph',
        graph: 'student',
        connect: 'student',
        title: '체온',
        categoryAxisTitle: '날짜',
        valueAxisTitle: '체온(℃)',
        yStep: '0.5',
        plotStep: '0.1',
        yFromOptions: ['0', '36'],
        points: [
          { x: '1일', y: '36.5' },
          { x: '2일', y: '36.8' },
          { x: '3일', y: '37.2' },
          { x: '4일', y: '36.6' },
          { x: '5일', y: '36.9' },
        ],
      },
    },
    {
      name: '주어진 그래프·예측 단계',
      config: {
        mode: 'line-graph',
        graph: 'given',
        predict: true,
        yStep: '1',
        yFromOptions: ['0', '35'],
        valueAxisTitle: '키(cm)',
        categoryAxisTitle: '날짜',
        points: [
          { x: '1일', y: '0.5' },
          { x: '3일', y: '2' },
          { x: '5일', y: '5.5' },
          { x: '7일', y: '9.5' },
          { x: '9일', y: '11' },
        ],
      },
    },
  ];

  for (const variant of variants) {
    test(`그래프 SVG 높이 ≥ 200px이고 단추가 잘리지 않는다 — ${variant.name}`, async ({
      page,
    }, testInfo) => {
      test.skip(testInfo.project.name !== 'chromebook', '크롬북 전용 측정');
      await page.setViewportSize({ width: 660, height: 420 });
      await openEngine(page, variant.config, { stageFit: true, mode: 'line-graph' });
      await page.waitForTimeout(300);
      const svg = await page.getByTestId('graph-canvas').boundingBox();
      if (!svg) throw new Error('캔버스 크기를 알 수 없습니다.');
      console.log(
        'T163 two-column',
        variant.name,
        `${Math.round(svg.width)}x${Math.round(svg.height)}`,
      );
      expect(svg.height).toBeGreaterThanOrEqual(200);
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

test.describe('T163: line-graph 기준 스크린샷', () => {
  const config = {
    mode: 'line-graph',
    graph: 'student',
    connect: 'auto',
    title: '체온 변화',
    categoryAxisTitle: '날짜',
    valueAxisTitle: '체온(℃)',
    valueLabel: '℃',
    yStep: '0.5',
    plotStep: '0.1',
    yFromOptions: ['0', '36'],
    points: [
      { x: '1일', y: '36.5' },
      { x: '2일', y: '36.8' },
      { x: '3일', y: '37.2' },
      { x: '4일', y: '36.6' },
      { x: '5일', y: '36.9' },
    ],
  };

  async function plotAll(page: Page, wavy: boolean) {
    const canvas = page.getByTestId('graph-canvas');
    if (wavy) await page.getByRole('radio', { name: '36부터' }).click();
    const box = await canvas.boundingBox();
    if (!box) throw new Error('그래프를 찾지 못했습니다.');
    const width = Number(await canvas.getAttribute('data-logical-width'));
    const g = lineGeometry(normalizeLine(config), wavy ? '36' : '0', width);
    for (const [index, point] of config.points.entries()) {
      await page.mouse.click(
        box.x + (laneCenter(g, index) * box.width) / width,
        box.y + (yOfValue(g, Rational.parse(point.y)) * box.height) / LOGICAL_H,
      );
    }
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await page.mouse.move(0, 0);
  }

  test('학생이 찍은 꺾은선그래프(0부터)', async ({ page }) => {
    await openEngine(page, config, { stageFit: true, mode: 'line-graph' });
    await plotAll(page, false);
    if (test.info().project.name.toLowerCase().includes('chromebook')) {
      await stageShot(page, 'line-graph-student');
    }
  });

  test('물결선(36부터)으로 그린 꺾은선그래프', async ({ page }) => {
    await openEngine(page, config, { stageFit: true, mode: 'line-graph' });
    await plotAll(page, true);
    if (test.info().project.name.toLowerCase().includes('chromebook')) {
      await stageShot(page, 'line-graph-wavy');
    }
  });
});

test.describe('T166: band-circle 띠·원그래프', () => {
  const BAND_H = 760;
  const FRUIT_DATA = [
    ['사과', 9],
    ['포도', 6],
    ['딸기', 3],
    ['기타', 2],
  ];
  const config = {
    mode: 'band-circle',
    title: '좋아하는 과일',
    data: FRUIT_DATA,
    requirePercentEntry: true,
    morph: 'drag',
  };
  const compareConfig = {
    ...config,
    band: 'given',
    percentEntry: 'given',
    startAs: 'circle',
    compare: { title: '2반', data: { 사과: 20, 포도: 10, 딸기: 10, 기타: 10 } },
  };
  // 논리 좌표: 띠는 x 50~950(한 칸 9), 가운데 선 y 140, 손잡이 y 228.
  const BAND_X = 50;
  const CELL = 9;
  const HANDLE_Y = 228;

  function handle(page: Page, cat: string): Locator {
    return page.locator(`[data-testid="band-handle"][data-cat="${cat}"]`);
  }

  async function center(locator: Locator) {
    const box = await locator.boundingBox();
    if (!box) throw new Error('요소 크기를 알 수 없습니다.');
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  }

  async function bandPoint(page: Page, x: number, y: number) {
    const box = await page.getByTestId('graph-canvas').boundingBox();
    if (!box) throw new Error('캔버스 크기를 알 수 없습니다.');
    return logicalToScreen(box, x, y, LOGICAL_W, BAND_H);
  }

  async function dragTo(page: Page, from: { x: number; y: number }, to: { x: number; y: number }) {
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move((from.x + to.x) / 2, (from.y + to.y) / 2, { steps: 4 });
    await page.mouse.move(to.x, to.y, { steps: 4 });
    await page.mouse.up();
  }

  async function pressTimes(page: Page, cat: string, key: string, times: number) {
    await handle(page, cat).focus();
    for (let i = 0; i < times; i += 1) await page.keyboard.press(key);
  }

  async function waitCurl(page: Page, curl: number) {
    await expect(page.getByTestId('graph-canvas')).toHaveAttribute('data-curl', String(curl));
  }

  test('백분율 칸에 쓰면 띠(auto)가 그 칸 수로 채워지고, 다 쓰면 합이 100이다', async ({
    page,
  }) => {
    await openEngine(page, config, { mode: 'band-circle' });
    const inputs = page.getByTestId('band-percent-input');
    await expect(inputs).toHaveCount(4);
    await inputs.nth(0).fill('45');
    await inputs.nth(1).fill('30');
    const slices = page.locator('[data-testid="band-slice"]');
    await expect(slices).toHaveCount(2);
    await expect(slices.nth(0)).toHaveAttribute('data-cells', '45');
    await expect(slices.nth(1)).toHaveAttribute('data-cells', '30');
    await pollObservation(page, (o) => o['percentSum'] === null && o['bandCellSum'] === 75);
    await inputs.nth(2).fill('15');
    await inputs.nth(3).fill('10');
    await pollObservation(
      page,
      (o) =>
        o['percentSum'] === 100 &&
        o['percentsMatchData'] === true &&
        o['bandMatchesData'] === true &&
        (o.misconceptions ?? []).length === 0,
    );
  });

  test('손잡이를 끌면 칸 수가 바뀌고 뒤 조각이 밀린다. 키보드 ←/→/PageUp도 된다', async ({
    page,
  }) => {
    await openEngine(page, { ...config, band: 'student' }, { mode: 'band-circle' });
    const apple = handle(page, '사과');
    await expect(apple).toHaveAttribute('role', 'slider');
    const hit = apple.getByTestId('band-handle-hit');
    const from = await center(hit);
    await dragTo(page, from, await bandPoint(page, BAND_X + 45 * CELL, HANDLE_Y));
    await pollObservation(page, (o) => (o['bandCells'] as Record<string, number>)['사과'] === 45);
    await expect(apple).toHaveAttribute('aria-valuenow', '45');
    // 포도 손잡이는 사과 끝(45칸)에서 시작해 30칸 더 간다.
    const grape = handle(page, '포도').getByTestId('band-handle-hit');
    await dragTo(page, await center(grape), await bandPoint(page, BAND_X + 75 * CELL, HANDLE_Y));
    await pollObservation(page, (o) => (o['bandCells'] as Record<string, number>)['포도'] === 30);
    // 사과를 줄이면 포도 조각이 앞으로 당겨진다(칸 수는 그대로).
    await press(apple, 'ArrowLeft');
    await expect(apple).toHaveAttribute('aria-valuenow', '44');
    await press(apple, 'ArrowRight');
    await press(apple, 'ArrowRight');
    await expect(apple).toHaveAttribute('aria-valuenow', '46');
    await press(apple, 'PageUp');
    await expect(apple).toHaveAttribute('aria-valuenow', '56');
    await press(apple, 'PageDown');
    await press(apple, 'Delete');
    await expect(apple).toHaveAttribute('aria-valuenow', '0');
    await pollObservation(
      page,
      (o) => (o['bandCells'] as Record<string, number>)['포도'] === 30 && o['bandCellSum'] === 30,
    );
  });

  test('끌어 말기와 단추 말기로 원그래프가 되고, 펴면 다시 띠다', async ({ page }) => {
    await openEngine(page, { ...config, band: 'given' }, { mode: 'band-circle' });
    await waitCurl(page, 0);
    const canvas = page.getByTestId('graph-canvas');
    // 조금만 끌면 놓았을 때 띠로 붙는다.
    const start = await center(page.getByTestId('band-morph-hit'));
    await dragTo(page, start, await bandPoint(page, BAND_X + 700, 140));
    await waitCurl(page, 0);
    await pollObservation(page, (o) => o['circleShown'] === false && o['curl'] === 0);
    // 끌어 돌려 말면(왼쪽 끝 가까이로) 원그래프로 붙는다.
    await dragTo(
      page,
      await center(page.getByTestId('band-morph-hit')),
      await bandPoint(page, BAND_X + 130, 140),
    );
    await waitCurl(page, 100);
    await pollObservation(page, (o) => o['circleShown'] === true && o['curl'] === 100);
    await expect(canvas.locator('[data-testid="band-slice"]')).toHaveCount(4);
    const toggle = page.getByTestId('band-morph-toggle');
    await expect(toggle).toHaveText('띠그래프로 펴기');
    await toggle.click();
    await waitCurl(page, 0);
    await pollObservation(page, (o) => o['circleShown'] === false);
    await expect(toggle).toHaveText('원그래프로 말기');
    // 키보드로 누르는 단추로도 만다.
    await press(toggle, 'Enter');
    await waitCurl(page, 100);
    await pollObservation(page, (o) => o['circleShown'] === true);
  });

  test('모핑 중간(curl 40)에도 조각이 순서대로 이어져 있다', async ({ page }) => {
    await openEngine(page, { ...config, band: 'given' }, { mode: 'band-circle' });
    const start = await center(page.getByTestId('band-morph-hit'));
    // 현 길이 약 573(curl 40)가 되도록 끈 채 멈춘다.
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    const target = await bandPoint(page, BAND_X + 573, 140);
    await page.mouse.move(target.x, target.y, { steps: 6 });
    // 끄는 값은 다음 프레임에 그려지므로 범위에 들어올 때까지 기다린다.
    await expect
      .poll(async () => Number(await page.getByTestId('graph-canvas').getAttribute('data-curl')))
      .toBeGreaterThan(35);
    const shown = Number(await page.getByTestId('graph-canvas').getAttribute('data-curl'));
    expect(shown).toBeLessThan(45);
    const order = await page
      .locator('[data-testid="band-slice"]')
      .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-cat')));
    expect(order).toEqual(['사과', '포도', '딸기', '기타']);
    await page.mouse.up();
  });

  test('합이 100을 넘는 띠는 틀 밖으로 삐져나온다', async ({ page }) => {
    await openEngine(page, { ...config, band: 'student' }, { mode: 'band-circle' });
    await pressTimes(page, '사과', 'PageUp', 9);
    await pressTimes(page, '포도', 'PageUp', 3);
    await expect(page.getByTestId('graph-canvas')).toHaveAttribute('data-cell-sum', '120');
    const frameBox = await page.getByTestId('band-frame-line').boundingBox();
    const overflow = page.getByTestId('band-overflow');
    await expect(overflow).toBeVisible();
    const overBox = await overflow.boundingBox();
    if (!frameBox || !overBox) throw new Error('띠를 찾지 못했습니다.');
    // 두 상자 모두 테두리 두께를 포함하므로 8px 안에서 틀 오른쪽 끝에서 시작한다.
    expect(overBox.x).toBeGreaterThanOrEqual(frameBox.x + frameBox.width - 8);
    expect(overBox.width).toBeGreaterThan(0);
    // 칸이 모자라거나 넘쳐도 정오 표시는 없다.
    await pressTimes(page, '딸기', 'PageUp', 1);
    await pressTimes(page, '기타', 'PageUp', 1);
    await pollObservation(
      page,
      (o) =>
        (o.misconceptions ?? []).includes('MC-GRAPH-PERCENT-AS-COUNT') && o['bandCellSum'] === 140,
    );
    await expect(page.getByText(/정답|오답|틀렸|맞았/)).toHaveCount(0);
  });

  test('손잡이를 누르는 영역은 48px 이상이고 띠 한 칸은 6px 이상이다', async ({ page }) => {
    await openEngine(page, { ...config, band: 'student' }, { mode: 'band-circle' });
    const hits = [
      page.locator('[data-testid="band-handle"] [data-testid="band-handle-hit"]').first(),
      page.getByTestId('band-morph-hit'),
    ];
    for (const hit of hits) {
      const box = await hit.boundingBox();
      if (!box) throw new Error('손잡이를 찾지 못했습니다.');
      console.log(
        `[T166 ${test.info().project.name}] 손잡이 누르는 영역 ${box.width.toFixed(1)}x${box.height.toFixed(1)}`,
      );
      expect(box.width).toBeGreaterThanOrEqual(47.5);
      expect(box.height).toBeGreaterThanOrEqual(47.5);
    }
    const frame = await page.getByTestId('band-frame-line').boundingBox();
    if (!frame) throw new Error('띠를 찾지 못했습니다.');
    const cell = frame.width / 100;
    console.log(`[T166 ${test.info().project.name}] 띠 한 칸 ${cell.toFixed(2)}px`);
    expect(cell).toBeGreaterThanOrEqual(6);
  });

  test('원그래프 지름이 크다(아이패드 300px 이상)', async ({ page }) => {
    await openEngine(page, compareConfig, { mode: 'band-circle' });
    await waitCurl(page, 100);
    const circle = await page.getByTestId('band-frame-line').boundingBox();
    if (!circle) throw new Error('원그래프를 찾지 못했습니다.');
    const diameter = Math.min(circle.width, circle.height);
    console.log(`[T166 ${test.info().project.name}] 원그래프 지름 ${diameter.toFixed(1)}px`);
    const compare = await page
      .getByTestId('compare-circle')
      .locator('path[fill="none"]')
      .boundingBox();
    expect(compare?.width ?? 0).toBeCloseTo(circle.width, 0);
    if (test.info().project.name === 'ipad') expect(diameter).toBeGreaterThanOrEqual(300);
  });

  test('원그래프에서 10칸 눈금은 원둘레 바깥의 짧은 선이고 반지름 선은 조각 경계뿐이다', async ({
    page,
  }) => {
    await openEngine(
      page,
      { ...config, band: 'given', startAs: 'circle' },
      { mode: 'band-circle' },
    );
    await waitCurl(page, 100);
    const ticks = await page
      .locator('[data-testid="band-tick"]')
      .evaluateAll((nodes) =>
        nodes.map((node) =>
          ['x1', 'y1', 'x2', 'y2'].map((name) => Number(node.getAttribute(name))),
        ),
      );
    expect(ticks).toHaveLength(11);
    for (const [x1, y1, x2, y2] of ticks as [number, number, number, number][]) {
      // 주 원: 중심 (500, 460), 반지름 225. 눈금은 둘레에서 바깥으로 반지름의 8%(18)만 뻗는다.
      expect(Math.hypot((x1 ?? 0) - 500, (y1 ?? 0) - 460)).toBeCloseTo(225, 0);
      expect(Math.hypot((x2 ?? 0) - 500, (y2 ?? 0) - 460)).toBeCloseTo(243, 0);
    }
  });

  test('compare가 있으면 주 원 위에도 이름이 있고(circleTitle, 없으면 title) 전체 제목은 가운데에 있다', async ({
    page,
  }) => {
    await openEngine(page, compareConfig, { mode: 'band-circle' });
    await waitCurl(page, 100);
    await expect(page.getByTestId('band-circle-title')).toHaveText('좋아하는 과일');
    await expect(page.getByTestId('band-title')).toHaveAttribute('text-anchor', 'middle');
    await openEngine(page, { ...compareConfig, circleTitle: '1반' }, { mode: 'band-circle' });
    await waitCurl(page, 100);
    await expect(page.getByTestId('band-circle-title')).toHaveText('1반');
  });

  test('좁은 판(660x420)에서는 두 원이 위아래로 쌓인다', async ({ page }) => {
    await page.setViewportSize({ width: 660, height: 420 });
    await openEngine(page, compareConfig, { stageFit: true, mode: 'band-circle' });
    await waitCurl(page, 100);
    await expect(page.getByTestId('graph-canvas')).toHaveAttribute('data-stacked', 'true');
    const first = await page.getByTestId('band-slice').first().boundingBox();
    const second = await page.getByTestId('compare-slice').first().boundingBox();
    if (!first || !second) throw new Error('두 원을 찾지 못했습니다.');
    expect(second.y).toBeGreaterThan(first.y + first.height);
  });

  test('오버레이 band-frame: 틀을 강조하고 넘친 칸을 빗금·✕로 보이며 SVG와 맞는다', async ({
    page,
  }) => {
    await openEngine(
      page,
      { ...config, band: 'student' },
      { mode: 'band-circle', overlay: 'band-frame' },
    );
    await pressTimes(page, '사과', 'PageUp', 9);
    await pressTimes(page, '포도', 'PageUp', 3);
    await showOverlay(page);
    const overlay = await expectOverlayAligned(page, 'band-frame');
    await expect(overlay.getByTestId('band-frame-line')).toHaveCount(1);
    await expect(overlay.getByTestId('band-frame-over')).toHaveCount(1);
    await expect(overlay.getByTestId('band-frame-cross')).toHaveCount(1);
    await expect(overlay.getByTestId('band-frame-missing')).toHaveCount(0);
    await expect(overlay.locator('text')).toHaveCount(0);
    // 틀 선은 본 그래프의 틀 선과 1px 안에서 같다.
    const mine = await overlay.getByTestId('band-frame-line').boundingBox();
    const theirs = await page
      .locator('[data-testid="graph-canvas"] [data-testid="band-frame-line"]')
      .boundingBox();
    if (!mine || !theirs) throw new Error('틀 선을 찾지 못했습니다.');
    expect(Math.abs(mine.x + mine.width / 2 - (theirs.x + theirs.width / 2))).toBeLessThanOrEqual(
      1,
    );
    expect(Math.abs(mine.y + mine.height / 2 - (theirs.y + theirs.height / 2))).toBeLessThanOrEqual(
      1,
    );
  });

  test('오버레이 band-frame: 칸이 모자라면 점선 빈칸이 있고 넘침 표시는 없다', async ({ page }) => {
    await openEngine(
      page,
      { ...config, band: 'student' },
      { mode: 'band-circle', overlay: 'band-frame' },
    );
    await pressTimes(page, '사과', 'PageUp', 2);
    await showOverlay(page);
    const overlay = await expectOverlayAligned(page, 'band-frame');
    await expect(overlay.getByTestId('band-frame-missing')).toHaveCount(1);
    await expect(overlay.getByTestId('band-frame-over')).toHaveCount(0);
    await expect(overlay.getByTestId('band-frame-cross')).toHaveCount(0);
  });

  test('오버레이 total-bars: 두 원 아래 전체 수에 비례하는 막대, 숫자는 없다', async ({ page }) => {
    await openEngine(page, compareConfig, { mode: 'band-circle', overlay: 'total-bars' });
    await waitCurl(page, 100);
    await showOverlay(page);
    const overlay = await expectOverlayAligned(page, 'total-bars');
    const bars = overlay.getByTestId('total-bar');
    await expect(bars).toHaveCount(2);
    const main = await bars.nth(0).boundingBox();
    const other = await bars.nth(1).boundingBox();
    if (!main || !other) throw new Error('막대를 찾지 못했습니다.');
    // 전체 20 : 50 = 2 : 5
    expect(main.width / other.width).toBeCloseTo(0.4, 1);
    await expect(overlay.locator('text')).toHaveCount(0);
    // 막대는 각 원 아래에 있다.
    const circle = await page.getByTestId('band-frame-line').boundingBox();
    if (!circle) throw new Error('원을 찾지 못했습니다.');
    expect(main.y).toBeGreaterThan(circle.y + circle.height);
  });

  test('오버레이 total-bars: 원그래프가 아니면 그리지 않는다', async ({ page }) => {
    await openEngine(
      page,
      { ...compareConfig, startAs: 'band' },
      { mode: 'band-circle', overlay: 'total-bars' },
    );
    await showOverlay(page);
    await expect(page.locator('[data-overlay="total-bars"] [data-testid="total-bar"]')).toHaveCount(
      0,
    );
  });

  test('기준 스크린샷: 학생 띠(반쯤)와 원그래프(compare)', async ({ page }) => {
    test.skip(
      !test.info().project.name.toLowerCase().includes('chromebook'),
      '크롬북에서만 기준 이미지를 비교한다.',
    );
    await openEngine(page, { ...config, band: 'student' }, { mode: 'band-circle' });
    await page.getByTestId('band-percent-input').nth(0).fill('45');
    await page.getByTestId('band-percent-input').nth(1).fill('30');
    await pressTimes(page, '사과', 'PageUp', 4);
    await pressTimes(page, '사과', 'ArrowRight', 5);
    await pressTimes(page, '포도', 'PageUp', 3);
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await page.mouse.move(0, 0);
    await stageShot(page, 'band-student');
    await openEngine(page, compareConfig, { mode: 'band-circle' });
    await waitCurl(page, 100);
    await stageShot(page, 'circle-compare');
  });
});
