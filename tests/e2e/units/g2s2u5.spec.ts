import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { PREVIEW_URL } from '../../../playwright.config';
import { expectContentPanelsReachable, expectNoPanelInnerScroll } from '../panel-layout';

/**
 * T157 g2s2u5 「표와 그래프」 A1(학급 투표 스탬프 그래프)·A2(표와 그래프 비교) 단원 E2E.
 * - 8과제 정답 통과, 과제마다 대표 오답 → 일반 힌트 ①
 * - 오개념 3코드(MC-COUNT-ONE-TO-ONE, MC-GRAPH-GAP-ORDER, MC-GRAPH-TABLE-MISMATCH) ①·②와
 *   오버레이(tally-check, gap-compare, table-link)가 실제로 그려지고 본 화면에 정렬 1px
 * - 저학년 모드 ○ 칸 한 변 ≥ 64px(실행기 안), 키보드만으로 가로 ○ 그래프 그리기
 * - 첫 화면, 크롬북 두 칸 배치 그래프 높이, 오프라인, 스냅샷
 * - 학생 화면에 결론 글과 학년 표시가 없다.
 * 움직임 줄이기를 켜서 연출이 바로 끝 위치로 가게 한다.
 */

test.describe.configure({ timeout: 300_000 });
test.use({ actionTimeout: 20_000 });

interface UnitTask {
  readonly id: string;
  readonly prompt: string;
  readonly config: Record<string, unknown>;
  readonly response?: unknown;
}
interface UnitContent {
  readonly activities: readonly { readonly id: string; readonly tasks: readonly UnitTask[] }[];
}

const content = JSON.parse(
  readFileSync(new URL('../../../data/content/g2s2u5.json', import.meta.url), 'utf-8'),
) as UnitContent;

test('콘텐츠 설정이 명세를 따른다(A1 4과제, A2 4과제, ○ 그리기는 응답 칸 없음)', () => {
  expect(content.activities.map((a) => a.id)).toEqual(['g2s2u5.A1', 'g2s2u5.A2']);
  const a1 = content.activities[0]?.tasks ?? [];
  const a2 = content.activities[1]?.tasks ?? [];
  expect(a1.map((t) => t.id)).toEqual([
    'g2s2u5.A1.T1',
    'g2s2u5.A1.T2',
    'g2s2u5.A1.T3',
    'g2s2u5.A1.T4',
  ]);
  expect(a2.map((t) => t.id)).toEqual([
    'g2s2u5.A2.T1',
    'g2s2u5.A2.T2',
    'g2s2u5.A2.T3',
    'g2s2u5.A2.T4',
  ]);
  expect(a1[0]?.config['mode']).toBe('class-vote');
  for (const index of [1, 2, 3]) {
    expect(a1[index]?.config['mode']).toBe('table-to-graph');
  }
  // ○ 그리기 과제(T3·T4)는 응답 칸이 없고 axisMax가 6이다.
  for (const index of [2, 3]) {
    expect(a1[index]?.response).toBeUndefined();
    expect(a1[index]?.config['axisMax']).toBe(6);
    expect(a1[index]?.config['graph']).toBe('student');
  }
  expect(a1[2]?.config['orientation']).toBe('vertical');
  expect(a1[3]?.config['orientation']).toBe('horizontal');
  for (const task of a2) {
    expect(task.response).toBeDefined();
    expect(task.config['tooltips']).toBe('hide');
  }
  expect(a2[2]?.config['views']).toEqual(['table']);
  // 학생 화면에 학년 표시가 없다.
  for (const task of [...a1, ...a2]) expect(task.prompt).not.toMatch(/[1-6]학년/);
});

// 첫 화면 기준(뷰포트별): 판이 '확인하기'까지 한 화면에 다 들어오면 'fit', 아니면 'reachable'.
type Mode = 'fit' | 'reachable';
const FIRST_SCREEN: Record<string, Record<string, Mode>> = {
  'A1.T1': { ipad: 'reachable' },
  'A1.T2': {},
  'A1.T3': { chromebook: 'reachable' },
  'A2.T1': {},
  'A2.T2': { ipad: 'reachable' },
  'A2.T3': { ipad: 'reachable' },
  'A2.T4': { ipad: 'reachable' },
};

const FRUITS = ['🍎', '🍌', '🍇', '🍓'] as const;
const DRAW_DATA: Record<string, number> = { '🍎': 4, '🍌': 3, '🍇': 5, '🍓': 2 };

function slot(page: Page, name: string): Locator {
  return page.getByTestId(`runner-slot-${name}`);
}

function main(page: Page): Locator {
  return slot(page, 'main');
}

function field(page: Page, id: string): Locator {
  return slot(page, 'response').locator(`[data-response-field="${id}"]`);
}

async function openActivity(page: Page, activity: 'A1' | 'A2'): Promise<void> {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.getByRole('button', { name: '1번', exact: true }).click();
  await page.getByRole('button', { name: '건너뛰기' }).click();
  await expect(page).toHaveURL(/#\/map$/);
  await page.goto(`/#/activity/g2s2u5.${activity}`);
  await expect(
    page.getByRole('heading', {
      name: activity === 'A1' ? '학급 투표 스탬프 그래프' : '표와 그래프 비교',
    }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: '확인하기' })).toBeVisible();
}

async function submit(page: Page): Promise<void> {
  await page.getByRole('button', { name: '확인하기' }).click();
}

async function expectFailedWithHint(
  page: Page,
  text: string | null,
  level: 1 | 2 | 3 = 1,
): Promise<void> {
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByTestId('hint')).toHaveAttribute('data-hint-level', String(level));
  if (text !== null) {
    await expect(page.getByTestId('hint-text')).toContainText(text);
  }
}

async function expectPassed(page: Page, last = false): Promise<void> {
  await expect(page.getByText('좋아요, 통과했어요!')).toBeVisible();
  if (last) {
    await expect(page.getByText('모든 과제를 마쳤어요.')).toBeVisible();
    return;
  }
  await page.getByRole('button', { name: '다음 과제' }).click();
}

async function screenshot(page: Page, name: string): Promise<void> {
  await page.evaluate(() => {
    window.scrollTo(0, 0);
    document.querySelector('main')?.scrollTo(0, 0);
  });
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
  await expect(page).toHaveScreenshot(name, {
    maxDiffPixelRatio: 0.02,
    animations: 'disabled',
    fullPage: true,
  });
}

async function expectFirstScreen(
  page: Page,
  mode: Mode,
  locators: readonly Locator[] = [],
): Promise<void> {
  await page.evaluate(() => {
    window.scrollTo(0, 0);
    document.querySelector('main')?.scrollTo(0, 0);
  });
  await expectNoPanelInnerScroll(page);
  if (mode === 'fit') {
    for (const loc of locators) {
      await expect(loc).toBeInViewport({ ratio: 0.99 });
    }
    await expect(page.getByRole('button', { name: '확인하기' })).toBeInViewport({ ratio: 1 });
    return;
  }
  await expectContentPanelsReachable(page);
  for (const loc of locators) {
    await loc.scrollIntoViewIfNeeded();
    await expect(loc).toBeInViewport({ ratio: 0.99 });
  }
}

/** 학생 화면에 결론 글·학년 표시가 없는지 확인한다. */
async function expectNoConclusionText(page: Page): Promise<void> {
  const text = (await page.locator('body').textContent()) ?? '';
  expect(text).not.toMatch(
    /강아지가 가장|가장 많아요|가장 적어요|가장 높아요|가장 낮아요|모두 \d+표|[1-6]학년/,
  );
}

// ---------------------------------------------------------------- 도우미

function canvas(page: Page): Locator {
  return main(page).getByTestId('graph-canvas');
}

function cell(page: Page, cat: string, index: number): Locator {
  return canvas(page).locator(`g[data-cat="${cat}"][data-cell="${index}"]`);
}

async function vote(page: Page, option: string, times = 1): Promise<void> {
  for (let i = 0; i < times; i += 1) {
    await main(page).locator(`button[data-option="${option}"]`).click();
  }
}

async function setNumber(page: Page, id: string, digits: string): Promise<void> {
  await field(page, id).locator('[data-part="whole"]').click();
  for (let i = 0; i < 4; i += 1) await page.keyboard.press('Backspace');
  for (const digit of digits) await page.keyboard.press(digit);
}

async function choose(page: Page, id: string, label: string): Promise<void> {
  await field(page, id).getByRole('button', { name: label, exact: true }).click();
}

/** 학생 표 칸을 n으로 만든다(처음 칸은 비어 있다: 0은 − 한 번). */
async function setTable(page: Page, cat: string, value: number): Promise<void> {
  const box = main(page);
  const output = box.locator(`[data-cat-value="${cat}"]`);
  const current = (await output.textContent())?.trim() ?? '–';
  if (current === '–') {
    if (value === 0) {
      await box.getByRole('button', { name: `${cat} 줄이기` }).click();
      return;
    }
    await box.getByRole('button', { name: `${cat} 늘리기` }).click();
  }
  const now = Number((await output.textContent())?.trim());
  const diff = value - now;
  const label = diff > 0 ? `${cat} 늘리기` : `${cat} 줄이기`;
  for (let i = 0; i < Math.abs(diff); i += 1) {
    await box.getByRole('button', { name: label }).click();
  }
  await expect(output).toHaveText(String(value));
}

/** ○ 칸을 누른다. 마우스(기본) 또는 키보드(Enter). */
async function fillCell(
  page: Page,
  cat: string,
  index: number,
  how: 'mouse' | 'keyboard' = 'mouse',
): Promise<void> {
  const target = cell(page, cat, index);
  if (how === 'keyboard') {
    await target.focus();
    await expect(target).toBeFocused();
    await page.keyboard.press('Enter');
  } else {
    await target.scrollIntoViewIfNeeded();
    await target.click();
  }
  await expect(target).toHaveAttribute('data-filled', 'true');
}

/** 범주마다 0번 칸부터 n칸을 채운다. */
async function draw(
  page: Page,
  counts: Readonly<Record<string, number>>,
  how: 'mouse' | 'keyboard' = 'mouse',
): Promise<void> {
  for (const [cat, count] of Object.entries(counts)) {
    for (let i = 0; i < count; i += 1) await fillCell(page, cat, i, how);
  }
}

async function passA1T1(page: Page): Promise<void> {
  await vote(page, '🍎', 3);
  await vote(page, '🍇', 2);
  await setNumber(page, 'total', '5');
  await submit(page);
  await expectPassed(page);
}

async function passA1T2(page: Page): Promise<void> {
  await setTable(page, '🍎', 4);
  await setTable(page, '🍌', 3);
  await setTable(page, '🍇', 2);
  await setTable(page, '🍓', 3);
  await submit(page);
  await expectPassed(page);
}

async function passA1T3(page: Page): Promise<void> {
  await draw(page, DRAW_DATA);
  await submit(page);
  await expectPassed(page);
}

/** 오버레이 svg 상자가 본 캔버스 svg 상자와 1px 이내로 같은지. */
async function expectOverlayAligned(page: Page, overlayName: string): Promise<Locator> {
  const overlay = main(page).locator(`[data-overlay="${overlayName}"]`);
  await expect(overlay).toBeVisible();
  await expect(overlay.locator('svg')).toHaveCount(1);
  await expect
    .poll(async () => {
      const overlayBox = await overlay.locator('svg').boundingBox();
      const canvasBox = await canvas(page).boundingBox();
      if (!overlayBox || !canvasBox) return Number.POSITIVE_INFINITY;
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

// ---------------------------------------------------------------- A1 흐름

test('g2s2u5.A1 — 투표·표·○ 그래프 4과제 흐름과 오개념 ①②·오버레이 정렬', async ({
  page,
}, testInfo) => {
  test.slow();
  await openActivity(page, 'A1');
  const vp = testInfo.project.name;
  const m = main(page);

  // T1: 투표하지 않고 0 → ① → 5번 투표 뒤 4 → ② → 5 통과
  await expect(m.getByTestId('vote-view')).toBeVisible();
  await expectFirstScreen(page, FIRST_SCREEN['A1.T1']?.[vp] ?? 'fit', [
    m.locator('button[data-option="🍎"]'),
    m.locator('button[data-option="🍓"]'),
    m.getByTestId('graph-table'),
    field(page, 'total'),
  ]);
  const graphBox = await canvas(page).boundingBox();
  console.log(
    `[T157 ${vp}] A1.T1 그래프 ${Math.round(graphBox?.width ?? 0)}x${Math.round(graphBox?.height ?? 0)}`,
  );
  expect(graphBox?.height ?? 0).toBeGreaterThanOrEqual(200);
  await expectNoConclusionText(page);
  await setNumber(page, 'total', '0');
  await submit(page);
  await expectFailedWithHint(page, '표에 있는 수를 모두 더해 볼까요?', 1);
  await vote(page, '🍎', 2);
  await vote(page, '🍌');
  await vote(page, '🍇');
  await vote(page, '🍓');
  await expect(m.locator('td[data-cat="🍎"]')).toHaveText('2');
  await setNumber(page, 'total', '4');
  await submit(page);
  await expectFailedWithHint(page, '과일마다 몇 표인지 하나씩 짚으며 세어 봐요.', 2);
  await setNumber(page, 'total', '5');
  await submit(page);
  await expectPassed(page);

  // T2: 사과만 4, 나머지 0 → 상태 ① → 다시 → ② tally-check(정렬) → 정답 통과
  await expect(m.getByTestId('graph-tally-row')).toBeVisible();
  await expectNoConclusionText(page);
  await expectFirstScreen(page, FIRST_SCREEN['A1.T2']?.[vp] ?? 'fit', [
    m.getByTestId('graph-tally-row'),
    m.getByTestId('graph-table'),
  ]);
  await expect(m.getByTestId('graph-canvas')).toHaveCount(0);
  await setTable(page, '🍎', 4);
  await setTable(page, '🍌', 0);
  await setTable(page, '🍇', 0);
  await setTable(page, '🍓', 0);
  for (const index of [0, 1, 2, 3]) {
    await m.locator(`[data-tally-index="${index}"]`).click();
  }
  await submit(page);
  await expectFailedWithHint(page, '센 것에 표시해 볼까요?', 1);
  await submit(page);
  await expectFailedWithHint(page, '아직 표시하지 않은 스티커가 있는지 봐요.', 2);
  const boxes = m.getByTestId('tally-check-box');
  await expect(boxes).toHaveCount(8);
  for (const index of [4, 11]) {
    const card = m.locator(`[data-tally-index="${index}"]`);
    const mark = m.locator(`[data-testid="tally-check-box"][data-index="${index}"]`);
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
  await setTable(page, '🍌', 3);
  await setTable(page, '🍇', 2);
  await setTable(page, '🍓', 3);
  await submit(page);
  await expectPassed(page);

  // T3: 사과 열 0·2번만 → 상태 1 ① → 다시 → ② gap-compare(정렬) → 지우고 정답 통과
  await expect(canvas(page)).toBeVisible();
  await expect(canvas(page)).toHaveAttribute('data-orientation', 'vertical');
  await expectNoConclusionText(page);
  await fillCell(page, '🍎', 0);
  await fillCell(page, '🍎', 2);
  await submit(page);
  await expectFailedWithHint(page, '아래부터 빈칸 없이 채웠어?', 1);
  await submit(page);
  await expectFailedWithHint(page, '빈칸이 있으면 높이를 비교하기 어려워요.', 2);
  const gap = await expectOverlayAligned(page, 'gap-compare');
  await expect(gap.locator('[data-ghost-cell]')).toHaveCount(2);
  await main(page).getByTestId('graph-reset').click();
  await draw(page, DRAW_DATA);
  await submit(page);
  await expectPassed(page);

  // T4: 가로 그래프. 빈틈 → 상태 1 ① → 지우고 정답 통과
  await expect(canvas(page)).toHaveAttribute('data-orientation', 'horizontal');
  await fillCell(page, '🍎', 0);
  await fillCell(page, '🍎', 2);
  await submit(page);
  await expectFailedWithHint(page, '왼쪽부터 빈칸 없이 채웠어?', 1);
  await main(page).getByTestId('graph-reset').click();
  await draw(page, DRAW_DATA);
  await submit(page);
  await expectPassed(page, true);
});

test('g2s2u5.A1.T3 — 표와 값이 다르면 MC-GRAPH-TABLE-MISMATCH ①②와 table-link 정렬', async ({
  page,
}) => {
  test.slow();
  await openActivity(page, 'A1');
  const m = main(page);
  await passA1T1(page);
  await passA1T2(page);

  // 모든 열을 아래부터 그리되 바나나를 4개
  await draw(page, { '🍎': 4, '🍌': 4, '🍇': 5, '🍓': 2 });
  await submit(page);
  await expectFailedWithHint(page, '표에는 몇이라고 되어 있어?', 1);
  await submit(page);
  await expectFailedWithHint(page, '표의 수와 ○의 수를 하나씩 맞춰 봐요.', 2);
  const overlay = await expectOverlayAligned(page, 'table-link');
  await expect(overlay.locator('[data-number]')).toHaveCount(4);
  await expect(overlay.getByTestId('table-link-value').first()).toContainText('표: 3');
  // 바나나 4번째 칸을 비우면 통과한다.
  await cell(page, '🍌', 3).scrollIntoViewIfNeeded();
  await cell(page, '🍌', 3).click();
  await expect(cell(page, '🍌', 3)).toHaveAttribute('data-filled', 'false');
  await submit(page);
  await expectPassed(page);
  await expect(m.getByTestId('graph-canvas')).toHaveAttribute('data-orientation', 'horizontal');
});

test('g2s2u5.A1 — 과제마다 대표 오답은 일반 힌트 ①이 뜬다', async ({ page }) => {
  test.slow();
  await openActivity(page, 'A1');

  // T1: 투표하지 않고 0 → 일반 ①
  await setNumber(page, 'total', '0');
  await submit(page);
  await expectFailedWithHint(page, '표에 있는 수를 모두 더해 볼까요?', 1);
  await vote(page, '🍌', 5);
  await setNumber(page, 'total', '5');
  await submit(page);
  await expectPassed(page);

  // T2: 합계는 12지만 값이 틀림 → 일반 ①
  await setTable(page, '🍎', 3);
  await setTable(page, '🍌', 4);
  await setTable(page, '🍇', 2);
  await setTable(page, '🍓', 3);
  await submit(page);
  await expectFailedWithHint(page, '종류마다 스티커를 다시 세어 볼까요?', 1);
  await setTable(page, '🍎', 4);
  await setTable(page, '🍌', 3);
  await submit(page);
  await expectPassed(page);

  // T3: 사과 한 칸만 그림(빈틈 없음, 다 그리기 전이라 표와 다름도 아직 안 나옴) → 일반 ①
  await fillCell(page, '🍎', 0);
  await submit(page);
  await expectFailedWithHint(page, '과일마다 표의 수만큼 ○를 그렸나요?', 1);
  for (const index of [1, 2, 3]) await fillCell(page, '🍎', index);
  await draw(page, { '🍌': 3, '🍇': 5, '🍓': 2 });
  await submit(page);
  await expectPassed(page);

  // T4: 같은 오답 → 일반 ①
  await fillCell(page, '🍎', 0);
  await submit(page);
  await expectFailedWithHint(page, '과일마다 표의 수만큼 ○를 그렸나요?', 1);
  for (const index of [1, 2, 3]) await fillCell(page, '🍎', index);
  await draw(page, { '🍌': 3, '🍇': 5, '🍓': 2 });
  await submit(page);
  await expectPassed(page, true);
});

test('g2s2u5.A1.T4 — 키보드만으로 가로 ○ 그래프를 그린다', async ({ page }) => {
  test.slow();
  await openActivity(page, 'A1');
  await passA1T1(page);
  await passA1T2(page);
  await passA1T3(page);
  await expect(canvas(page)).toHaveAttribute('data-orientation', 'horizontal');
  await draw(page, DRAW_DATA, 'keyboard');
  await page.getByRole('button', { name: '확인하기' }).focus();
  await page.keyboard.press('Enter');
  await expectPassed(page, true);
});

test('g2s2u5.A1 — ○ 칸 한 변이 64px 이상이다(저학년 모드, 실행기 안)', async ({ page }) => {
  test.slow();
  await openActivity(page, 'A1');
  await passA1T1(page);
  await passA1T2(page);
  for (const orientation of ['vertical', 'horizontal'] as const) {
    await expect(canvas(page)).toHaveAttribute('data-orientation', orientation);
    for (const index of [0, 3, 5]) {
      for (const cat of ['🍎', '🍓']) {
        const target = cell(page, cat, index);
        await target.scrollIntoViewIfNeeded();
        const box = await target.locator('rect').first().boundingBox();
        expect(box, `${orientation} ${cat} ${index}`).not.toBeNull();
        if (!box) continue;
        expect(box.width, `${orientation} ${cat} ${index} 너비`).toBeGreaterThanOrEqual(63.5);
        expect(box.height, `${orientation} ${cat} ${index} 높이`).toBeGreaterThanOrEqual(63.5);
      }
    }
    if (orientation === 'vertical') await passA1T3(page);
  }
  // 스탬프(T1)와 표 −/+ 단추(T2)도 64px 이상인지는 아래 별도 테스트에서 본다.
});

test('g2s2u5.A1 — 스탬프와 표 단추는 64px 이상이다', async ({ page }) => {
  await openActivity(page, 'A1');
  const m = main(page);
  for (const option of FRUITS) {
    const box = await m.locator(`button[data-option="${option}"]`).boundingBox();
    expect(box?.width ?? 0, `${option} 너비`).toBeGreaterThanOrEqual(63.5);
    expect(box?.height ?? 0, `${option} 높이`).toBeGreaterThanOrEqual(63.5);
  }
  await passA1T1(page);
  for (const cat of FRUITS) {
    for (const verb of ['늘리기', '줄이기']) {
      const box = await m.getByRole('button', { name: `${cat} ${verb}` }).boundingBox();
      expect(box?.width ?? 0, `${cat} ${verb} 너비`).toBeGreaterThanOrEqual(63.5);
      expect(box?.height ?? 0, `${cat} ${verb} 높이`).toBeGreaterThanOrEqual(63.5);
    }
  }
});

// ---------------------------------------------------------------- A2

test('g2s2u5.A2 — 표와 그래프 비교 4과제 흐름과 대표 오답 일반 ①', async ({ page }, testInfo) => {
  test.slow();
  await openActivity(page, 'A2');
  const vp = testInfo.project.name;
  const m = main(page);

  // T1: 표와 그래프가 함께 보이고(말풍선 없음) 첫 화면·스냅샷 → 고양이 → ① → ② → 강아지 통과
  await expect(m.getByTestId('graph-table')).toBeVisible();
  await expect(canvas(page)).toBeVisible();
  await expect(canvas(page)).toHaveAttribute('data-orientation', 'vertical');
  await expectFirstScreen(page, FIRST_SCREEN['A2.T1']?.[vp] ?? 'fit', [
    m.getByTestId('graph-table'),
    canvas(page),
    field(page, 'most'),
  ]);
  const graphBox = await canvas(page).boundingBox();
  const mainBox = await m.boundingBox();
  const respBox = await slot(page, 'response').boundingBox();
  console.log(
    `[T157 ${vp}] A2.T1 그래프 ${Math.round(graphBox?.width ?? 0)}x${Math.round(graphBox?.height ?? 0)}, 교구 판 ${Math.round(mainBox?.width ?? 0)}x${Math.round(mainBox?.height ?? 0)}, 응답 판 ${Math.round(respBox?.width ?? 0)}x${Math.round(respBox?.height ?? 0)}`,
  );
  expect(graphBox?.height ?? 0).toBeGreaterThanOrEqual(200);
  await expectNoConclusionText(page);
  await screenshot(page, 'g2s2u5-a2.png');
  // 열을 눌러도 값 말풍선이 뜨지 않는다(tooltips: hide).
  await cell(page, '강아지', 0).click();
  await expect(page.getByText('강아지: 6명')).toHaveCount(0);
  await choose(page, 'most', '고양이');
  await submit(page);
  await expectFailedWithHint(page, '○가 가장 높이 쌓인 동물은 무엇일까요?', 1);
  await submit(page);
  await expectFailedWithHint(page, '그래프의 열 높이를 나란히 비교해 봐요.', 2);
  await choose(page, 'most', '강아지');
  await submit(page);
  await expectPassed(page);

  // T2: 5 → ① → 6 통과
  await expect(canvas(page)).toBeVisible();
  await expectFirstScreen(page, FIRST_SCREEN['A2.T2']?.[vp] ?? 'fit', [
    canvas(page),
    field(page, 'count'),
  ]);
  await setNumber(page, 'count', '5');
  await submit(page);
  await expectFailedWithHint(page, '강아지 줄의 ○를 하나씩 세어 볼까요?', 1);
  await setNumber(page, 'count', '6');
  await submit(page);
  await expectPassed(page);

  // T3: 표만 보인다(A). 3 → ① → 2 통과
  await expect(m.getByTestId('graph-table')).toBeVisible();
  await expect(m.getByTestId('graph-canvas')).toHaveCount(0);
  await expectFirstScreen(page, FIRST_SCREEN['A2.T3']?.[vp] ?? 'fit', [
    m.getByTestId('graph-table'),
    field(page, 'diff'),
  ]);
  await setNumber(page, 'diff', '3');
  await submit(page);
  await expectFailedWithHint(page, '표에서 두 수를 찾아 비교해 볼까요?', 1);
  await setNumber(page, 'diff', '2');
  await submit(page);
  await expectPassed(page);

  // T4: 하나만 고름 → ① → 둘 다 고르면 통과(정오 없음)
  await expectFirstScreen(page, FIRST_SCREEN['A2.T4']?.[vp] ?? 'fit', [
    canvas(page),
    field(page, 'easier'),
    field(page, 'reason'),
  ]);
  await choose(page, 'easier', '그래프');
  await submit(page);
  await expectFailedWithHint(page, '두 가지를 모두 골랐나요?', 1);
  await choose(page, 'reason', '높이로 한눈에 비교돼서');
  await submit(page);
  await expectPassed(page, true);
});

test('g2s2u5.A2.T4 — 어느 쪽·어느 까닭을 골라도 통과한다', async ({ page }) => {
  test.slow();
  await openActivity(page, 'A2');
  await choose(page, 'most', '강아지');
  await submit(page);
  await expectPassed(page);
  await setNumber(page, 'count', '6');
  await submit(page);
  await expectPassed(page);
  await setNumber(page, 'diff', '2');
  await submit(page);
  await expectPassed(page);
  await choose(page, 'easier', '표');
  await choose(page, 'reason', '다른 까닭');
  await submit(page);
  await expectPassed(page, true);
});

// ---------------------------------------------------------------- 오프라인

test('오프라인에서도 g2s2u5.A1 활동이 열린다', async ({ page, context }) => {
  await page.goto(PREVIEW_URL);
  await page.getByRole('button', { name: '1번', exact: true }).click();
  await page.getByRole('button', { name: '건너뛰기' }).click();
  await expect(page).toHaveURL(/#\/map$/);
  await page.goto(`${PREVIEW_URL}/#/activity/g2s2u5.A1`);
  await expect(page.getByRole('heading', { name: '학급 투표 스탬프 그래프' })).toBeVisible();

  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) {
      await new Promise<void>((resolve) =>
        navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), {
          once: true,
        }),
      );
    }
  });

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: '학급 투표 스탬프 그래프' })).toBeVisible();
  await expect(page.getByRole('button', { name: '확인하기' })).toBeVisible();
});

// A1.T3 첫 화면 스냅샷(○ 그리기 판)
test('g2s2u5.A1.T3 — 첫 화면 스냅샷(결론·값 노출 없음)', async ({ page }, testInfo) => {
  test.slow();
  await openActivity(page, 'A1');
  const vp = testInfo.project.name;
  await passA1T1(page);
  await passA1T2(page);
  await expect(canvas(page)).toBeVisible();
  // ○ 그리기 그래프는 칸이 64px 아래로 줄지 않아 판 안(boardArea)에서 스크롤한다: 상자(영역)만 본다.
  await expectFirstScreen(page, FIRST_SCREEN['A1.T3']?.[vp] ?? 'fit', [
    main(page).getByTestId('graph-table'),
    canvas(page).locator('xpath=..'),
  ]);
  // T158: 그림은 필요 이상으로 커지지 않는다(배율 = max(minTouchScale, fitScale)).
  // 보이는 ○ 줄 수를 재고(최소 3줄), 스크롤이 있으면 안내 띠가 보이다가 맨 위에서 사라진다.
  const area = canvas(page).locator('xpath=..');
  const measured = await page.evaluate(() => {
    const svg = document.querySelector('[data-testid="graph-canvas"]');
    const host = svg?.parentElement;
    if (!svg || !host) throw new Error('그래프를 찾지 못했습니다.');
    const hostBox = host.getBoundingClientRect();
    const svgBox = svg.getBoundingClientRect();
    let rows = 0;
    let side = 0;
    svg.querySelectorAll('g[data-cat="🍎"][data-cell]').forEach((element) => {
      const rect = (element.querySelector('rect') as Element).getBoundingClientRect();
      side = rect.width;
      if (rect.top >= hostBox.top - 1 && rect.bottom <= hostBox.bottom + 1) rows += 1;
    });
    return {
      svgWidth: svgBox.width,
      svgHeight: svgBox.height,
      areaWidth: host.clientWidth,
      areaHeight: host.clientHeight,
      rows,
      side,
    };
  });
  console.log(`[T158 ${vp}] A1.T3 ${JSON.stringify(measured)}`);
  expect(measured.side).toBeGreaterThanOrEqual(63.5);
  expect(measured.rows).toBeGreaterThanOrEqual(3);
  expect(measured.svgWidth).toBeLessThanOrEqual(measured.areaWidth + 1);
  const cue = main(page).getByTestId('graph-scroll-cue');
  if (measured.svgHeight > measured.areaHeight + 1) {
    await expect(cue).toBeVisible();
    await expect(cue).toContainText('위에 칸이 더 있어요');
    // 띠는 스크롤 칸 바로 위 별도 줄이라 그래프 칸과 겹치지 않는다.
    const cueBox = await cue.boundingBox();
    const svgBox = await area.boundingBox();
    expect((cueBox?.y ?? 0) + (cueBox?.height ?? 0)).toBeLessThanOrEqual((svgBox?.y ?? 0) + 1);
    await area.evaluate((element) => element.scrollTo({ top: 0 }));
    await expect(cue).toBeHidden();
    await area.evaluate((element) => element.scrollTo({ top: element.scrollHeight }));
  } else {
    expect(measured.rows).toBe(6);
    await expect(cue).toHaveCount(0);
  }
  await expectNoConclusionText(page);
  await screenshot(page, 'g2s2u5-a1-t3.png');
});
