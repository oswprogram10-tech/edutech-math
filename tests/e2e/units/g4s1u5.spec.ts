import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { PREVIEW_URL } from '../../../playwright.config';
import { logicalToScreen } from '../canvas-point';
import { expectContentPanelsReachable, expectNoPanelInnerScroll } from '../panel-layout';
import { bandCenter, frameOf, valuePosition } from '../../../src/engines/E18-graph-studio/layout';

/**
 * T162 g4s1u5 「막대그래프」 A1(눈금 슬라이더와 가로·세로 플립)·A2(우리 관심사 자료 그래프) 단원 E2E.
 * - 8과제 정답 통과, 과제마다 대표 오답 → 일반 힌트 ①
 * - 상태 규칙(A1.T4: 가로로 안 바꿈)과 오개념 2코드(MC-GRAPH-BAR-WIDTH, MC-GRAPH-SCALE-ONE) ①·②,
 *   오버레이(length-only, scale-count)가 실제로 그려지고 본 캔버스와 1px 안에서 맞음
 * - 막대 끌기 1개 + 키보드(↑)로 그리기, 첫 화면, 크롬북 두 칸 배치 그래프 높이, 오프라인, 스냅샷
 * - 읽기 과제는 표·말풍선이 없고, 학생 화면에 값·결론·"학년" 표시가 없다.
 * 움직임 줄이기를 켜서 연출이 바로 끝 위치로 가게 한다.
 */

test.describe.configure({ timeout: 300_000 });
test.use({ actionTimeout: 20_000 });

interface UnitTask {
  readonly id: string;
  readonly prompt: string;
  readonly config: Record<string, unknown>;
  readonly response?: unknown;
  readonly hints: readonly { readonly say?: string }[];
}
interface UnitContent {
  readonly activities: readonly { readonly id: string; readonly tasks: readonly UnitTask[] }[];
}

const content = JSON.parse(
  readFileSync(new URL('../../../data/content/g4s1u5.json', import.meta.url), 'utf-8'),
) as UnitContent;

const SPORTS: Readonly<Record<string, number>> = { 축구: 12, 피구: 8, 줄넘기: 5, 수영: 10 };
const GARDEN: Readonly<Record<string, number>> = { 상추: 14, 고추: 8, 토마토: 12, 오이: 6 };
const SNACK: Readonly<Record<string, number>> = {
  떡볶이: 9,
  과자: 6,
  과일: 7,
  아이스크림: 11,
};

test('콘텐츠 설정이 명세를 따른다(A1 5과제, A2 3과제, 읽기 과제는 표·말풍선 숨김)', () => {
  expect(content.activities.map((a) => a.id)).toEqual(['g4s1u5.A1', 'g4s1u5.A2']);
  const a1 = content.activities[0]?.tasks ?? [];
  const a2 = content.activities[1]?.tasks ?? [];
  expect(a1.map((t) => t.id)).toEqual([
    'g4s1u5.A1.T1',
    'g4s1u5.A1.T2',
    'g4s1u5.A1.T3',
    'g4s1u5.A1.T4',
    'g4s1u5.A1.T5',
  ]);
  expect(a2.map((t) => t.id)).toEqual(['g4s1u5.A2.T1', 'g4s1u5.A2.T2', 'g4s1u5.A2.T3']);
  expect(a1[0]?.config['graph']).toBe('student');
  expect(a1[0]?.response).toBeUndefined();
  // 읽는 과제(A1.T4·T5, A2.T2·T3)는 표를 숨기고 말풍선을 끈다.
  for (const task of [a1[3], a1[4], a2[1], a2[2]]) {
    expect(task?.config['table']).toBe('hidden');
    expect(task?.config['tooltips']).toBe('hide');
  }
  // 눈금을 바꿔 보는 두 과제도 말풍선을 끈다.
  for (const task of [a1[1], a1[2]]) expect(task?.config['tooltips']).toBe('hide');
  // A2.T1만 자료 묶음을 고르고(꾸민 예시 자료라 source 없음), 나머지는 한 묶음을 고정한다.
  const datasets = a2[0]?.config['datasets'] as readonly Record<string, unknown>[];
  expect(datasets.map((d) => d['id'])).toEqual(['snack', 'garden', 'library']);
  for (const set of datasets) expect(set['source']).toBeUndefined();
  expect(a2[1]?.config['datasets']).toBeUndefined();
  expect(a2[2]?.config['datasets']).toBeUndefined();
  for (const task of [...a1, ...a2]) {
    expect(task.prompt).not.toMatch(/[1-6]학년/);
    for (const hint of task.hints) expect(hint.say ?? '').not.toMatch(/[1-6]학년/);
  }
});

// 첫 화면 기준(뷰포트별): 판이 '확인하기'까지 한 화면에 다 들어오면 'fit', 아니면 'reachable'.
type Mode = 'fit' | 'reachable';
const FIRST_SCREEN: Record<string, Record<string, Mode>> = {
  'A1.T1': {},
  'A2.T1': {},
};

function slot(page: Page, name: string): Locator {
  return page.getByTestId(`runner-slot-${name}`);
}

function main(page: Page): Locator {
  return slot(page, 'main');
}

function field(page: Page, id: string): Locator {
  return slot(page, 'response').locator(`[data-response-field="${id}"]`);
}

function canvas(page: Page): Locator {
  return main(page).getByTestId('graph-canvas');
}

function bar(page: Page, cat: string): Locator {
  return canvas(page).locator(`g[data-cat="${cat}"][data-cells]`);
}

async function openActivity(page: Page, activity: 'A1' | 'A2'): Promise<void> {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.getByRole('button', { name: '1번', exact: true }).click();
  await page.getByRole('button', { name: '건너뛰기' }).click();
  await expect(page).toHaveURL(/#\/map$/);
  await page.goto(`/#/activity/g4s1u5.${activity}`);
  await expect(
    page.getByRole('heading', {
      name: activity === 'A1' ? '눈금 슬라이더와 가로·세로 플립' : '우리 관심사 자료 그래프',
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

/** 학생 화면에 학년 표시·값·결론 글이 없는지 확인한다. */
async function expectNoConclusionText(page: Page): Promise<void> {
  const text = (await page.locator('body').textContent()) ?? '';
  expect(text).not.toMatch(/축구가 가장|가장 많아요|가장 적어요|12명|8개|8권|3배|[1-6]학년/);
}

/** 그래프 SVG 상자 높이를 재어 기록하고 200px 이상인지 단언한다(두 칸 배치 포함). */
async function expectGraphHeight(page: Page, label: string, vp: string): Promise<void> {
  const graphBox = await canvas(page).boundingBox();
  const mainBox = await main(page).boundingBox();
  const response = slot(page, 'response');
  const respBox = (await response.count()) > 0 ? await response.boundingBox() : null;
  console.log(
    `[T162 ${vp}] ${label} 그래프 ${Math.round(graphBox?.width ?? 0)}x${Math.round(graphBox?.height ?? 0)}, 교구 판 ${Math.round(mainBox?.width ?? 0)}x${Math.round(mainBox?.height ?? 0)}, 응답 판 ${Math.round(respBox?.width ?? 0)}x${Math.round(respBox?.height ?? 0)}`,
  );
  expect(graphBox?.height ?? 0).toBeGreaterThanOrEqual(200);
}

// ---------------------------------------------------------------- 도우미

async function setNumber(page: Page, id: string, digits: string): Promise<void> {
  await field(page, id).locator('[data-part="whole"]').click();
  for (let i = 0; i < 4; i += 1) await page.keyboard.press('Backspace');
  for (const digit of digits) await page.keyboard.press(digit);
}

async function choose(page: Page, id: string, label: string): Promise<void> {
  await field(page, id).getByRole('button', { name: label, exact: true }).click();
}

/** 막대에 초점을 두고 ↑로 `cells`칸만큼 더 늘인다. */
async function growBar(page: Page, cat: string, cells: number): Promise<void> {
  const target = bar(page, cat);
  await target.focus();
  await expect(target).toBeFocused();
  for (let step = 0; step < cells; step += 1) await page.keyboard.press('ArrowUp');
}

/** 모든 막대를 키보드로 값(칸)만큼 늘인다. */
async function growAll(
  page: Page,
  values: Readonly<Record<string, number>>,
  skip: readonly string[] = [],
): Promise<void> {
  for (const [cat, cells] of Object.entries(values)) {
    if (skip.includes(cat)) continue;
    await growBar(page, cat, cells);
    await expect(bar(page, cat)).toHaveAttribute('data-cells', String(cells));
  }
}

/** 첫 막대 끝을 마우스로 끌어 `cells`칸(칸 경계에서 살짝 벗어난 위치)에 붙인다. */
async function dragFirstBar(page: Page, count: number, axisCells: number, cells: number) {
  const svg = canvas(page);
  await svg.scrollIntoViewIfNeeded();
  const box = await svg.boundingBox();
  if (!box) throw new Error('캔버스 크기를 알 수 없습니다.');
  const frame = frameOf('vertical', count, axisCells);
  const x = bandCenter(frame, 0);
  const start = logicalToScreen(box, x, valuePosition(frame, 0) - 6, 1000, 700);
  const end = logicalToScreen(box, x, valuePosition(frame, cells + 0.2), 1000, 700);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move((start.x + end.x) / 2, (start.y + end.y) / 2, { steps: 4 });
  await page.mouse.move(end.x, end.y, { steps: 4 });
  await page.mouse.up();
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

async function passA1T1(page: Page): Promise<void> {
  await growAll(page, SPORTS);
  await submit(page);
  await expectPassed(page);
}

async function passA1T2(page: Page): Promise<void> {
  await page.locator('[data-scale="2"]').click();
  await setNumber(page, 'cells', '6');
  await submit(page);
  await expectPassed(page);
}

async function passA1T3(page: Page): Promise<void> {
  await page.locator('[data-scale="5"]').click();
  await choose(page, 'issue', '어떤 막대는 끝이 눈금 줄에 딱 맞지 않아요');
  await submit(page);
  await expectPassed(page);
}

/** 가로로 바꾼 그래프에서 맨 위에 그려진 범주 이름(화면 위치로 잰다). */
async function topCategory(page: Page): Promise<string> {
  const names = await canvas(page).evaluate((svg) => {
    const rows: { cat: string; top: number }[] = [];
    svg.querySelectorAll('g[data-cat][data-cells]').forEach((node) => {
      rows.push({
        cat: node.getAttribute('data-cat') ?? '',
        top: node.getBoundingClientRect().top,
      });
    });
    rows.sort((a, b) => a.top - b.top);
    return rows.map((row) => row.cat);
  });
  return names[0] ?? '';
}

// ---------------------------------------------------------------- A1

test('g4s1u5.A1 — 5과제 흐름과 상태 규칙·오개념 ①②·오버레이 정렬', async ({ page }, testInfo) => {
  test.slow();
  await openActivity(page, 'A1');
  const vp = testInfo.project.name;
  const m = main(page);

  // T1: 첫 화면 + 스냅샷. 막대 끝 끌기 1개 + 키보드. 수영 한 칸 모자람 → 일반 ① → 채워서 통과
  await expect(canvas(page)).toBeVisible();
  await expect(m.getByTestId('graph-table')).toBeVisible();
  await expectFirstScreen(page, FIRST_SCREEN['A1.T1']?.[vp] ?? 'fit', [
    canvas(page),
    m.getByTestId('graph-table'),
  ]);
  await expectGraphHeight(page, 'A1.T1', vp);
  await expectNoConclusionText(page);
  await screenshot(page, 'g4s1u5-a1.png');
  await dragFirstBar(page, 4, 13, 12);
  await expect(bar(page, '축구')).toHaveAttribute('data-cells', '12');
  await growAll(page, { ...SPORTS, 수영: 9 }, ['축구']);
  await submit(page);
  await expectFailedWithHint(page, '막대 끝이 표의 수와 같은 눈금에 닿았나요?', 1);
  await submit(page);
  await expectFailedWithHint(page, '막대 끝을 그 눈금까지 끌어 봐요.', 2);
  await growBar(page, '수영', 1);
  await expect(bar(page, '수영')).toHaveAttribute('data-cells', '10');
  await submit(page);
  await expectPassed(page);

  // T2: 눈금 단추(주어진 막대의 칸 수는 엔진이 다시 그림). 12 → 일반 ① → 6 통과
  await expect(page.getByRole('radiogroup', { name: '눈금 한 칸' })).toBeVisible();
  await expect(m.getByTestId('graph-tooltip')).toHaveCount(0);
  await expectGraphHeight(page, 'A1.T2', vp);
  await setNumber(page, 'cells', '12');
  await submit(page);
  await expectFailedWithHint(page, '축구 막대의 칸을 세어 볼까요?', 1);
  await page.locator('[data-scale="2"]').click();
  await expect(bar(page, '축구')).toHaveAttribute('data-cells', '6');
  await setNumber(page, 'cells', '6');
  await submit(page);
  await expectPassed(page);

  // T3: 아무 문제가 없다 → 일반 ① → 눈금 5로 바꿔 보고 딱 맞지 않아요 통과
  await expectGraphHeight(page, 'A1.T3', vp);
  await choose(page, 'issue', '아무 문제가 없어요');
  await submit(page);
  await expectFailedWithHint(page, '눈금 5명을 골라 막대 끝이 어디에 닿는지 볼까요?', 1);
  await page.locator('[data-scale="5"]').click();
  await expect(page.locator('[data-scale="5"]')).toHaveAttribute('aria-checked', 'true');
  await choose(page, 'issue', '어떤 막대는 끝이 눈금 줄에 딱 맞지 않아요');
  await submit(page);
  await expectPassed(page);

  // T4: 표·말풍선 없음. 가로로 바꾸고 수영(맨 위) → MC ① → ② length-only → 통과(상태 규칙은 아래 별도 테스트)
  await expect(m.getByTestId('graph-table')).toHaveCount(0);
  await expectGraphHeight(page, 'A1.T4', vp);
  await expectNoConclusionText(page);
  await page.getByTestId('graph-flip').click();
  await expect(canvas(page)).toHaveAttribute('data-orientation', 'horizontal');
  // trap은 가로 그래프에서 실제로 맨 위에 그려지는 범주다(수영이어야 하고 축구이면 안 된다).
  const top = await topCategory(page);
  console.log(`[T162 ${vp}] A1.T4 가로 그래프 맨 위 범주: ${top}`);
  expect(top).toBe('수영');
  await choose(page, 'most', '수영');
  await submit(page);
  await expectFailedWithHint(page, '막대의 무엇으로 크기를 비교했지?', 1);
  await submit(page);
  await expectFailedWithHint(page, '길이만 비교해 봐요.', 2);
  const lengthOnly = await expectOverlayAligned(page, 'length-only');
  const groups = lengthOnly.locator('[data-length-cat]');
  await expect(groups).toHaveCount(4);
  const widths: number[] = [];
  for (let index = 0; index < 4; index += 1) {
    const box = await groups.nth(index).locator('rect').boundingBox();
    if (!box) throw new Error('막대 상자를 찾지 못했습니다.');
    widths.push(Math.round(box.height));
  }
  expect(new Set(widths).size).toBe(1);
  await expect(lengthOnly.locator('text')).toHaveCount(0);
  await choose(page, 'most', '축구');
  await submit(page);
  await expectPassed(page);

  // T5: 눈금 2. 5 → MC ① → 다시 → ② scale-count(정렬) → 10 통과
  await expect(m.getByTestId('graph-table')).toHaveCount(0);
  await expectGraphHeight(page, 'A1.T5', vp);
  await expectNoConclusionText(page);
  await setNumber(page, 'value', '5');
  await submit(page);
  await expectFailedWithHint(page, '세로 눈금에 쓰인 수를 볼까? 한 칸은 몇 명이지?', 1);
  await submit(page);
  await expectFailedWithHint(page, '칸마다 몇 명씩 늘어나는지 이어서 세어 봐요.', 2);
  const count = await expectOverlayAligned(page, 'scale-count');
  await expect(count.locator('[data-scale-count]')).toHaveCount(2);
  await expect(count.locator('[data-scale-count="2"]')).toBeVisible();
  await expect(count.locator('[data-scale-count="4"]')).toBeVisible();
  await expect(count.getByTestId('scale-count-more')).toContainText('…');
  await expect(count.locator('[data-scale-count="10"]')).toHaveCount(0);
  await setNumber(page, 'value', '10');
  await submit(page);
  await expectPassed(page, true);
});

test('g4s1u5.A1 — 과제마다 대표 오답은 일반 힌트 ①이 뜬다', async ({ page }) => {
  test.slow();
  await openActivity(page, 'A1');

  // T1: 줄넘기 한 칸 모자람 → 일반 ①
  await growAll(page, { ...SPORTS, 줄넘기: 4 });
  await submit(page);
  await expectFailedWithHint(page, '막대 끝이 표의 수와 같은 눈금에 닿았나요?', 1);
  await growBar(page, '줄넘기', 1);
  await submit(page);
  await expectPassed(page);

  // T2: 눈금을 바꾸지 않고 12 → 일반 ①
  await setNumber(page, 'cells', '12');
  await submit(page);
  await expectFailedWithHint(page, '눈금 한 칸이 몇 명인지 바꿔 보고', 1);
  await passA1T2(page);

  // T3: 막대가 너무 길어져요 → 일반 ①
  await choose(page, 'issue', '막대가 너무 길어져요');
  await submit(page);
  await expectFailedWithHint(page, '눈금 5명을 골라 막대 끝이 어디에 닿는지 볼까요?', 1);
  await passA1T3(page);

  // T4: 피구 → 일반 ①(가로로 바꾸었어도 오답)
  await page.getByTestId('graph-flip').click();
  await choose(page, 'most', '피구');
  await submit(page);
  await expectFailedWithHint(page, '막대 길이가 가장 긴 것을 찾아볼까요?', 1);
  await submit(page);
  await expectFailedWithHint(page, '축에서 막대 끝까지의 길이를 비교해 봐요.', 2);
  await choose(page, 'most', '축구');
  await submit(page);
  await expectPassed(page);

  // T5: 9 → 일반 ①
  await setNumber(page, 'value', '9');
  await submit(page);
  await expectFailedWithHint(page, '수영 막대 끝이 어느 눈금에 닿았는지 볼까요?', 1);
  await setNumber(page, 'value', '10');
  await submit(page);
  await expectPassed(page, true);
});

test('g4s1u5.A1.T4 — 바꾸지 않고 축구를 고르면 상태 ①, 가로로 바꾸고 축구면 통과', async ({
  page,
}) => {
  test.slow();
  await openActivity(page, 'A1');
  await passA1T1(page);
  await passA1T2(page);
  await passA1T3(page);
  await choose(page, 'most', '축구');
  await submit(page);
  await expectFailedWithHint(page, '그래프를 가로 막대그래프로 바꿨나요?', 1);
  await submit(page);
  await expectFailedWithHint(page, "'가로·세로 바꾸기' 단추를 눌러 봐요.", 2);
  // 가로·세로 바꾸기 단추는 키보드로도 누를 수 있다.
  const flip = page.getByTestId('graph-flip');
  await flip.focus();
  await page.keyboard.press('Enter');
  await expect(canvas(page)).toHaveAttribute('data-orientation', 'horizontal');
  await submit(page);
  await expectPassed(page);
});

test('g4s1u5.A1.T1 — 키보드만으로 푼다(막대 초점 ↑ 키)', async ({ page }) => {
  test.slow();
  await openActivity(page, 'A1');
  await growAll(page, SPORTS);
  await page.getByRole('button', { name: '확인하기' }).focus();
  await page.keyboard.press('Enter');
  await expectPassed(page);
});

// ---------------------------------------------------------------- A2

test('g4s1u5.A2 — 자료를 골라 막대그래프를 만들고 읽는 3과제', async ({ page }, testInfo) => {
  test.slow();
  await openActivity(page, 'A2');
  const vp = testInfo.project.name;
  const m = main(page);

  // T1: 고르기 전에는 안내만. 첫 화면 + 스냅샷
  await expect(page.getByRole('radiogroup', { name: '자료 묶음' })).toBeVisible();
  await expect(m.getByText('자료를 하나 골라요')).toBeVisible();
  await expectFirstScreen(page, FIRST_SCREEN['A2.T1']?.[vp] ?? 'fit', [
    page.getByRole('radiogroup', { name: '자료 묶음' }),
  ]);
  await expectNoConclusionText(page);
  await screenshot(page, 'g4s1u5-a2.png');
  // 고르기 전 확인 → 일반 ①
  await submit(page);
  await expectFailedWithHint(page, '막대 끝이 표의 수와 같은 눈금에 닿았나요?', 1);
  // 간식을 골라 막대 하나를 그린 뒤, 다른 묶음으로 바꾸면 학생 그래프가 비워진다.
  await m.getByRole('radio', { name: '우리 반이 좋아하는 간식' }).click();
  await expectGraphHeight(page, 'A2.T1 고른 뒤', vp);
  await growBar(page, '떡볶이', 3);
  await expect(bar(page, '떡볶이')).toHaveAttribute('data-cells', '3');
  await m.getByRole('radio', { name: '학교 텃밭 채소 수확' }).click();
  await expect(m.getByRole('radio', { name: '학교 텃밭 채소 수확' })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  for (const cat of Object.keys(GARDEN)) {
    await expect(bar(page, cat)).toHaveAttribute('data-cells', '0');
  }
  await expect(page.getByTestId('graph-tooltip')).toHaveCount(0);
  // 텃밭을 다 맞게 그려 통과(키보드)
  await growAll(page, GARDEN);
  await submit(page);
  await expectPassed(page);

  // T2: 표·말풍선 없음, 눈금 2. 4(칸 수로 읽은 차) → 일반 ① → 8 통과
  await expect(m.getByTestId('graph-table')).toHaveCount(0);
  await expectGraphHeight(page, 'A2.T2', vp);
  await expectNoConclusionText(page);
  await setNumber(page, 'diff', '4');
  await submit(page);
  await expectFailedWithHint(page, '가장 긴 막대와 가장 짧은 막대의 값을 먼저 읽어 볼까요?', 1);
  await setNumber(page, 'diff', '8');
  await submit(page);
  await expectPassed(page);

  // T3: 가로 막대, 8 → 일반 ① → 3 통과
  await expect(canvas(page)).toHaveAttribute('data-orientation', 'horizontal');
  await expect(m.getByTestId('graph-table')).toHaveCount(0);
  await expectGraphHeight(page, 'A2.T3', vp);
  await expectNoConclusionText(page);
  await setNumber(page, 'times', '8');
  await submit(page);
  await expectFailedWithHint(page, '역사 막대를 몇 번 이어 붙이면 동화 막대 길이가 될까요?', 1);
  await submit(page);
  await expectFailedWithHint(page, '역사 막대 길이로 동화 막대를 재어 봐요.', 2);
  await setNumber(page, 'times', '3');
  await submit(page);
  await expectPassed(page, true);
});

test('g4s1u5.A2.T1 — 다른 묶음(간식)으로도 그리면 통과하고, 묶음마다 그래프가 따로다', async ({
  page,
}) => {
  test.slow();
  await openActivity(page, 'A2');
  await main(page).getByRole('radio', { name: '우리 반이 좋아하는 간식' }).click();
  await growAll(page, SNACK);
  await submit(page);
  await expectPassed(page);
  await expect(canvas(page)).toBeVisible();
});

// ---------------------------------------------------------------- 오프라인

test('오프라인에서도 g4s1u5.A1 활동이 열린다', async ({ page, context }) => {
  await page.goto(PREVIEW_URL);
  await page.getByRole('button', { name: '1번', exact: true }).click();
  await page.getByRole('button', { name: '건너뛰기' }).click();
  await expect(page).toHaveURL(/#\/map$/);
  await page.goto(`${PREVIEW_URL}/#/activity/g4s1u5.A1`);
  await expect(page.getByRole('heading', { name: '눈금 슬라이더와 가로·세로 플립' })).toBeVisible();

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
  await expect(page.getByRole('heading', { name: '눈금 슬라이더와 가로·세로 플립' })).toBeVisible();
  await expect(page.getByRole('button', { name: '확인하기' })).toBeVisible();
});
