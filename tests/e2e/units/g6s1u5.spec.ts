import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { PREVIEW_URL } from '../../../playwright.config';
import { expectContentPanelsReachable, expectNoPanelInnerScroll } from '../panel-layout';
import { logicalToScreen } from '../canvas-point';

/**
 * T168 g6s1u5 「여러 가지 그래프」 A1(띠그래프를 말아 원그래프 만들기)·A2(같은 자료, 다른 그래프) 단원 E2E.
 * - 9과제 정답 통과, 과제마다 대표 오답 → 일반 힌트 ①
 * - 상태 규칙(A1.T3: 원그래프로 말지 않음)과 오개념 3코드(MC-GRAPH-PERCENT-AS-COUNT,
 *   MC-GRAPH-AREA-AS-AMOUNT, MC-GRAPH-TRUNCATED-AXIS) ①·②, 오버레이(band-frame, total-bars,
 *   zero-axis)가 실제로 그려지고 본 캔버스와 1px 안에서 맞음
 * - 띠 손잡이는 키보드로, 말기는 끌기(A1.T3)와 단추(변형 테스트)로 푼다.
 * - 첫 화면, 응답 칸 두 칸 배치에서 원 지름·막대그래프 높이, 오프라인, 스냅샷
 * - 학생 화면에 값·결론·"학년" 표시가 없고, A2.T3에서 DOM에 예시 flaws가 없다.
 * 측정값을 읽는 단언은 expect.poll·web-first 단언으로 기다린다. 움직임 줄이기를 켠다.
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
  readFileSync(new URL('../../../data/content/g6s1u5.json', import.meta.url), 'utf-8'),
) as UnitContent;

/** 띠 논리 좌표(T166): 띠는 x 50~950(한 칸 9), 가운데 선 y 140. */
const BAND_X = 50;
const BAND_Y = 140;

test('콘텐츠 설정이 명세를 따른다(A1 5과제, A2 4과제, 학년·값·결론 노출 없음)', () => {
  expect(content.activities.map((a) => a.id)).toEqual(['g6s1u5.A1', 'g6s1u5.A2']);
  const a1 = content.activities[0]?.tasks ?? [];
  const a2 = content.activities[1]?.tasks ?? [];
  expect(a1.map((t) => t.id)).toEqual([
    'g6s1u5.A1.T1',
    'g6s1u5.A1.T2',
    'g6s1u5.A1.T3',
    'g6s1u5.A1.T4',
    'g6s1u5.A1.T5',
  ]);
  expect(a2.map((t) => t.id)).toEqual([
    'g6s1u5.A2.T1',
    'g6s1u5.A2.T2',
    'g6s1u5.A2.T3',
    'g6s1u5.A2.T4',
  ]);
  for (const task of a1) expect(task.config['mode']).toBe('band-circle');
  for (const task of a2) expect(task.config['mode']).toBe('distortion');
  expect(a1[0]?.config['percentEntry']).toBe('student');
  expect(a1[1]?.config['band']).toBe('student');
  expect(a1[2]?.config['percentEntry']).toBe('hidden');
  expect(a1[2]?.config['table']).toBe('hidden');
  expect(a1[4]?.config['compare']).toBeDefined();
  for (const task of [...a1, ...a2]) {
    expect(task.prompt).not.toMatch(/[1-6]학년/);
    expect(task.prompt).not.toMatch(/45|30%|2반이 더 많/);
    for (const hint of task.hints) {
      expect(hint.say ?? '').not.toMatch(/[1-6]학년/);
      expect(hint.say ?? '').not.toMatch(/\d+ ?%|2반이 더 많|1반이 더 많/);
    }
  }
});

// 첫 화면 기준(뷰포트별): 판이 '확인하기'까지 한 화면에 다 들어오면 'fit', 아니면 'reachable'.
type Mode = 'fit' | 'reachable';
const FIRST_SCREEN: Record<string, Record<string, Mode>> = {
  'A1.T1': { ipad: 'reachable', chromebook: 'reachable', board: 'reachable' },
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

async function openActivity(page: Page, activity: 'A1' | 'A2'): Promise<void> {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.getByRole('button', { name: '1번', exact: true }).click();
  await page.getByRole('button', { name: '건너뛰기' }).click();
  await expect(page).toHaveURL(/#\/map$/);
  await page.goto(`/#/activity/g6s1u5.${activity}`);
  await expect(
    page.getByRole('heading', {
      name: activity === 'A1' ? '띠그래프를 말아 원그래프 만들기' : '같은 자료, 다른 그래프',
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
    for (const element of document.querySelectorAll('*')) {
      if (element.scrollTop > 0) element.scrollTop = 0;
    }
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
  reachableRatio = 0.99,
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
    await loc.evaluate((element) => element.scrollIntoView({ block: 'center' }));
    await expect(loc).toBeInViewport({ ratio: reachableRatio });
  }
}

/** 학생 화면에 학년 표시·결론 글이 없는지 확인한다. */
async function expectNoConclusionText(page: Page): Promise<void> {
  const text = (await page.locator('body').textContent()) ?? '';
  expect(text).not.toMatch(/2반이 더 많|1반이 더 많|2반이 압도|[1-6]학년/);
}

// ---------------------------------------------------------------- 도우미

async function choose(page: Page, id: string, label: string): Promise<void> {
  await field(page, id).getByRole('button', { name: label, exact: true }).click();
}

async function typeFraction(
  page: Page,
  id: string,
  numerator: string,
  denominator: string,
): Promise<void> {
  const box = field(page, id);
  await box.locator('[data-part="numerator"]').click();
  for (let i = 0; i < 3; i += 1) await page.keyboard.press('Backspace');
  for (const key of numerator) await page.keyboard.press(key);
  await box.locator('[data-part="denominator"]').click();
  for (let i = 0; i < 3; i += 1) await page.keyboard.press('Backspace');
  for (const key of denominator) await page.keyboard.press(key);
}

async function sortCard(page: Page, label: string, bin: string): Promise<void> {
  await field(page, 'sort')
    .getByRole('button', { name: `${label} 옮길 카드로 고르기` })
    .click();
  await field(page, 'sort')
    .getByRole('button', { name: `${bin} 여기에 놓기` })
    .click();
}

function handle(page: Page, cat: string): Locator {
  return canvas(page).locator(`[data-testid="band-handle"][data-cat="${cat}"]`);
}

/** 손잡이에서 키보드로 칸 수를 맞춘다(Delete로 0, PageUp 10칸, → 1칸). */
async function setCells(page: Page, cat: string, cells: number): Promise<void> {
  const target = handle(page, cat);
  await target.focus();
  await expect(target).toBeFocused();
  await page.keyboard.press('Delete');
  for (let i = 0; i < Math.floor(cells / 10); i += 1) await page.keyboard.press('PageUp');
  for (let i = 0; i < cells % 10; i += 1) await page.keyboard.press('ArrowRight');
  await expect(target).toHaveAttribute('aria-valuenow', String(cells));
}

async function setBand(page: Page, cells: readonly number[]): Promise<void> {
  const cats = ['사과', '포도', '딸기', '기타'];
  for (const [index, cat] of cats.entries()) await setCells(page, cat, cells[index] ?? 0);
}

async function fillPercents(page: Page, values: readonly number[]): Promise<void> {
  const inputs = main(page).getByTestId('band-percent-input');
  await expect(inputs).toHaveCount(4);
  for (const [index, value] of values.entries()) await inputs.nth(index).fill(String(value));
}

async function center(locator: Locator): Promise<{ x: number; y: number }> {
  const box = await locator.boundingBox();
  if (!box) throw new Error('요소 크기를 알 수 없습니다.');
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/** 띠 끝 손잡이를 끌어 둥글게 말아 원그래프(curl 100)로 만든다. 레이아웃이 움직이면 다시 시도한다. */
async function dragToCircle(page: Page): Promise<void> {
  await expect(async () => {
    await page
      .getByTestId('band-morph-hit')
      .evaluate((element) => element.scrollIntoView({ block: 'center' }));
    const box = await canvas(page).boundingBox();
    if (!box) throw new Error('캔버스 크기를 알 수 없습니다.');
    const width = Number(await canvas(page).getAttribute('data-logical-width'));
    const height = Number(await canvas(page).getAttribute('data-logical-height'));
    const from = await center(page.getByTestId('band-morph-hit'));
    const to = logicalToScreen(box, BAND_X + 130, BAND_Y, width, height);
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move((from.x + to.x) / 2, (from.y + to.y) / 2, { steps: 4 });
    await page.mouse.move(to.x, to.y, { steps: 4 });
    await page.mouse.up();
    await expect(canvas(page)).toHaveAttribute('data-curl', '100', { timeout: 3000 });
  }).toPass({ timeout: 20_000 });
}

/** 오버레이 svg 상자가 본 캔버스 svg 상자와 1px 이내로 같은지. */
async function expectOverlayAligned(page: Page, overlayName: string): Promise<Locator> {
  const overlay = main(page).locator(`[data-overlay="${overlayName}"]`);
  await expect(overlay).toBeVisible();
  await expect(overlay.locator('svg').first()).toBeVisible();
  await expect
    .poll(async () => {
      const overlayBox = await overlay.locator('svg').first().boundingBox();
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

/** 원그래프 지름(px)과 그래프 상자를 재어 기록한다. 원 윤곽은 `band-frame-line`이다. */
async function measureCircle(page: Page, label: string, vp: string): Promise<number> {
  const outline = canvas(page).getByTestId('band-frame-line').first();
  await expect(outline).toBeVisible();
  const box = await canvas(page).boundingBox();
  let diameter = 0;
  await expect
    .poll(async () => {
      const shape = await outline.boundingBox();
      diameter = Math.min(shape?.width ?? 0, shape?.height ?? 0);
      return diameter;
    })
    .toBeGreaterThan(100);
  console.log(
    `[T168 ${vp}] ${label} 원 지름 ${diameter.toFixed(1)}px, 그래프 ${Math.round(box?.width ?? 0)}x${Math.round(box?.height ?? 0)}`,
  );
  return diameter;
}

function bars(page: Page): Locator {
  return canvas(page).locator('[data-testid="distortion-bar"]');
}

async function barHeights(page: Page): Promise<number[]> {
  return bars(page).evaluateAll((nodes) =>
    nodes.map((node) => node.getBoundingClientRect().height),
  );
}

async function expectBarHeight(page: Page, label: string, vp: string): Promise<void> {
  const box = await canvas(page).boundingBox();
  console.log(
    `[T168 ${vp}] ${label} 막대그래프 ${Math.round(box?.width ?? 0)}x${Math.round(box?.height ?? 0)}`,
  );
  expect(box?.height ?? 0).toBeGreaterThanOrEqual(200);
}

/**
 * T169: 그래프 SVG가 아래 형제 상자(기사 제목 줄 등)와 겹치지 않고, 세로축 0 눈금과 가로축 범주 이름이
 * 다른 요소에 덮이지 않았는지 elementFromPoint로 확인한다(.wrap이 스크롤하면 그 글자를 보이게 굴린다).
 */
async function expectDistortionNotCovered(page: Page, vp: string): Promise<void> {
  const result = await canvas(page).evaluate((svg) => {
    const wrap = svg.closest('[data-mode="distortion"]') as HTMLElement | null;
    if (!wrap) throw new Error('distortion 화면을 찾지 못했습니다.');
    const graph = svg.getBoundingClientRect();
    const overlaps: string[] = [];
    for (const id of ['distortion-controls', 'distortion-headline']) {
      const node = wrap.querySelector(`[data-testid="${id}"]`);
      if (!node) continue;
      const r = node.getBoundingClientRect();
      const w = Math.min(graph.right, r.right) - Math.max(graph.left, r.left);
      const h = Math.min(graph.bottom, r.bottom) - Math.max(graph.top, r.top);
      if (w > 1 && h > 1) overlaps.push(id);
    }
    const wrapRect = wrap.getBoundingClientRect();
    const hidden: string[] = [];
    let found = 0;
    for (const node of Array.from(svg.querySelectorAll('text'))) {
      const label = node.textContent?.trim() ?? '';
      if (label !== '0' && label !== '1반' && label !== '2반') continue;
      found += 1;
      node.scrollIntoView({ block: 'nearest' });
      const r = node.getBoundingClientRect();
      const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      const visible =
        r.top >= wrapRect.top - 1 &&
        r.bottom <= wrapRect.bottom + 1 &&
        top !== null &&
        svg.contains(top);
      if (!visible) hidden.push(label);
    }
    wrap.scrollTo(0, 0);
    return { overlaps, hidden, found };
  });
  console.log(`[T169 ${vp}] A2.T1 ${JSON.stringify(result)}`);
  expect(result.overlaps).toEqual([]);
  expect(result.found).toBe(3);
  expect(result.hidden).toEqual([]);
}

async function pickStart(page: Page, value: number): Promise<void> {
  await page.getByRole('radio', { name: `${value}부터`, exact: true }).click();
  await expect(page.getByRole('radio', { name: `${value}부터`, exact: true })).toHaveAttribute(
    'aria-checked',
    'true',
  );
}

async function passA1T1(page: Page): Promise<void> {
  await fillPercents(page, [45, 30, 15, 10]);
  await submit(page);
  await expectPassed(page);
}

async function passA1T2(page: Page): Promise<void> {
  await setBand(page, [45, 30, 15, 10]);
  await submit(page);
  await expectPassed(page);
}

async function passA1T3(page: Page): Promise<void> {
  await dragToCircle(page);
  await typeFraction(page, 'grape', '3', '10');
  await submit(page);
  await expectPassed(page);
}

async function passA1T4(page: Page): Promise<void> {
  await sortCard(page, '사과를 좋아하는 학생은 몇 명일까?', '막대그래프가 나아요');
  await sortCard(page, '포도와 딸기를 좋아하는 학생 수의 차는?', '막대그래프가 나아요');
  await sortCard(page, '사과는 전체의 몇 %일까?', '원그래프가 나아요');
  await sortCard(page, '포도는 전체의 어느 정도를 차지할까?', '원그래프가 나아요');
  await submit(page);
  await expectPassed(page);
}

async function passA1(page: Page): Promise<void> {
  await passA1T1(page);
  await passA1T2(page);
  await passA1T3(page);
  await passA1T4(page);
  await choose(page, 'apple', '2반');
  await submit(page);
  await expectPassed(page, true);
}

async function passA2T1(page: Page): Promise<void> {
  await pickStart(page, 45);
  await choose(page, 'really', '거의 같아요');
  await submit(page);
  await expectPassed(page);
}

async function passA2T2(page: Page): Promise<void> {
  await pickStart(page, 0);
  await submit(page);
  await expectPassed(page);
}

const ITEM = {
  zero: '세로축이 0에서 시작하나? 문제 있음',
  step: '눈금 간격이 일정한가? 문제 있음',
  sum: '원그래프 합이 100%인가? 문제 있음',
  group: '항목을 임의로 묶었나? 문제 있음',
} as const;

async function markExample(
  page: Page,
  tab: string,
  items: readonly (keyof typeof ITEM)[],
): Promise<void> {
  await page.getByRole('tab', { name: tab }).click();
  await expect(page.getByRole('tab', { name: tab })).toHaveAttribute('aria-selected', 'true');
  for (const item of items) await page.getByRole('checkbox', { name: ITEM[item] }).check();
}

async function passA2T3(page: Page): Promise<void> {
  await markExample(page, '예시 1', ['zero']);
  await markExample(page, '예시 2', ['step']);
  await markExample(page, '예시 3', ['sum']);
  await submit(page);
  await expectPassed(page);
}

// ---------------------------------------------------------------- A1

test('g6s1u5.A1 — 5과제 흐름과 상태 규칙·오개념 ①②·오버레이 정렬', async ({ page }, testInfo) => {
  test.slow();
  await openActivity(page, 'A1');
  const vp = testInfo.project.name;
  const m = main(page);

  // T1: 첫 화면 + 스냅샷. 개수를 그대로 씀 → PERCENT-AS-COUNT ① → ② band-frame(정렬) → 합 95 → 일반 ① → 통과
  await expect(canvas(page)).toBeVisible();
  await expect(m.getByTestId('graph-table')).toBeVisible();
  // 크롬북은 판 안(428px)에서 그래프(528px)와 표가 안쪽 스크롤로 이어진다(T166 설계). 그래프 80% 이상이 보인다.
  await expectFirstScreen(
    page,
    FIRST_SCREEN['A1.T1']?.[vp] ?? 'fit',
    [canvas(page), m.getByTestId('graph-table')],
    0.8,
  );
  await expectNoConclusionText(page);
  expect((await m.textContent()) ?? '').not.toMatch(/45|30%/);
  await screenshot(page, 'g6s1u5-a1.png');
  await fillPercents(page, [9, 6, 3, 2]);
  await expect(canvas(page)).toHaveAttribute('data-cell-sum', '20');
  await submit(page);
  await expectFailedWithHint(page, '전체를 몇 칸으로 나눈 띠였지?', 1);
  await submit(page);
  await expectFailedWithHint(page, '비어 있는 칸이 있는지 살펴봐요.', 2);
  const frame = await expectOverlayAligned(page, 'band-frame');
  await expect(frame.locator('text')).toHaveCount(0);
  await fillPercents(page, [45, 30, 15, 10]);
  await expect(canvas(page)).toHaveAttribute('data-cell-sum', '100');
  await submit(page);
  await expectPassed(page);

  // T2: 표에 백분율이 주어진다. 개수만큼 칸을 채움 → ① → ② band-frame(정렬) → 95칸 → 일반 ① → 통과
  await expect(m.getByTestId('graph-table')).toBeVisible();
  await expectNoConclusionText(page);
  await setBand(page, [9, 6, 3, 2]);
  await expect(canvas(page)).toHaveAttribute('data-cell-sum', '20');
  await submit(page);
  await expectFailedWithHint(page, '전체를 몇 칸으로 나눈 띠였지?', 1);
  await submit(page);
  await expectFailedWithHint(page, '비어 있는 칸이 있는지 살펴봐요.', 2);
  await expectOverlayAligned(page, 'band-frame');
  await setBand(page, [45, 30, 15, 10]);
  await expect(canvas(page)).toHaveAttribute('data-cell-sum', '100');
  await submit(page);
  await expectPassed(page);

  // T3: 표·백분율이 없다. 말지 않고 확인 → 상태 ① → ② → 끌어 말기 → 1/2 → 일반 ① → 3/10 통과
  await expect(m.getByTestId('graph-table')).toHaveCount(0);
  await expectNoConclusionText(page);
  await typeFraction(page, 'grape', '3', '10');
  await submit(page);
  await expectFailedWithHint(page, '띠를 말아 원그래프로 만들었나요?', 1);
  await submit(page);
  await expectFailedWithHint(page, "'원그래프로 말기' 단추를 눌러요.", 2);
  await dragToCircle(page);
  await submit(page);
  await expectPassed(page);

  // T4: 카드 하나가 틀림 → 일반 ① → 통과
  await expect(field(page, 'sort')).toBeVisible();
  await expectNoConclusionText(page);
  await sortCard(page, '사과를 좋아하는 학생은 몇 명일까?', '원그래프가 나아요');
  await sortCard(page, '포도와 딸기를 좋아하는 학생 수의 차는?', '막대그래프가 나아요');
  await sortCard(page, '사과는 전체의 몇 %일까?', '원그래프가 나아요');
  await sortCard(page, '포도는 전체의 어느 정도를 차지할까?', '원그래프가 나아요');
  await submit(page);
  await expectFailedWithHint(page, '정확한 수나 차를 알아야 할까요', 1);
  await submit(page);
  await expectFailedWithHint(page, '가려 봐요.', 2);
  await sortCard(page, '사과를 좋아하는 학생은 몇 명일까?', '막대그래프가 나아요');
  await submit(page);
  await expectPassed(page);

  // T5: 1반 → AREA-AS-AMOUNT ① → ② total-bars(정렬, 글자 없음) → 같아요 → 일반 ① → 2반 통과
  await expect(canvas(page).getByTestId('compare-circle')).toBeVisible();
  await expectNoConclusionText(page);
  await choose(page, 'apple', '1반');
  await submit(page);
  await expectFailedWithHint(page, '두 반의 전체 학생 수는 같을까?', 1);
  await submit(page);
  await expectFailedWithHint(page, '막대의 길이를 견줘 봐요.', 2);
  const total = await expectOverlayAligned(page, 'total-bars');
  await expect(total.locator('[data-testid="total-bar"]')).toHaveCount(2);
  await expect(total.locator('text')).toHaveCount(0);
  await choose(page, 'apple', '2반');
  await submit(page);
  await expectPassed(page, true);
});

test('g6s1u5.A1.T1 — 개수 그대로가 아닌 오답은 일반 ①, 정답은 통과한다', async ({ page }) => {
  test.slow();
  await openActivity(page, 'A1');
  await fillPercents(page, [45, 30, 15, 5]);
  await submit(page);
  await expectFailedWithHint(page, '종류마다 전체의 몇 %인지 생각했나요?', 1);
  await submit(page);
  await expectFailedWithHint(page, '백분율을 모두 더하면 전체가 돼야 해요.', 2);
  await fillPercents(page, [45, 30, 15, 10]);
  await submit(page);
  await expectPassed(page);
});

test('g6s1u5.A1.T2 — 칸 합이 100이어도 칸이 틀리면 일반 ①이고, 맞으면 통과한다', async ({
  page,
}) => {
  test.slow();
  await openActivity(page, 'A1');
  await passA1T1(page);
  await setBand(page, [30, 45, 15, 10]);
  await expect(canvas(page)).toHaveAttribute('data-cell-sum', '100');
  await submit(page);
  await expectFailedWithHint(page, '표의 백분율만큼 칸을 채웠나요?', 1);
  await submit(page);
  await expectFailedWithHint(page, 'PageUp·PageDown 키로 열 칸씩', 2);
  await setCells(page, '사과', 45);
  await setCells(page, '포도', 30);
  await submit(page);
  await expectPassed(page);
});

test('g6s1u5.A1.T3 — 단추로 말고, 1/4·7/20·1/3은 통과, 1/5·2/5는 통과하지 못한다', async ({
  page,
}) => {
  test.slow();
  await openActivity(page, 'A1');
  await passA1T1(page);
  await passA1T2(page);
  const toggle = page.getByTestId('band-morph-toggle');
  await expect(toggle).toHaveText('원그래프로 말기');
  await toggle.click();
  await expect(canvas(page)).toHaveAttribute('data-curl', '100');
  await expect(toggle).toHaveText('띠그래프로 펴기');
  await typeFraction(page, 'grape', '1', '5');
  await submit(page);
  await expectFailedWithHint(page, '포도 조각이 몇 분의 몇쯤인지', 1);
  await typeFraction(page, 'grape', '2', '5');
  await submit(page);
  await expectFailedWithHint(page, '4분의 1 조각과 견주어 봐요.', 2);
  await typeFraction(page, 'grape', '7', '20');
  await submit(page);
  await expectPassed(page);
});

test('g6s1u5.A1.T3 — 1/4과 1/3도 통과한다', async ({ page }) => {
  test.slow();
  await openActivity(page, 'A1');
  await passA1T1(page);
  await passA1T2(page);
  await dragToCircle(page);
  await typeFraction(page, 'grape', '1', '3');
  await submit(page);
  await expectPassed(page);
});

test('g6s1u5.A1.T4·T5 — 짝이 틀리거나 같아요를 고르면 일반 ①이다', async ({ page }) => {
  test.slow();
  await openActivity(page, 'A1');
  await passA1T1(page);
  await passA1T2(page);
  await passA1T3(page);
  await sortCard(page, '사과를 좋아하는 학생은 몇 명일까?', '막대그래프가 나아요');
  await submit(page);
  await expectFailedWithHint(page, '정확한 수나 차를 알아야 할까요', 1);
  await passA1T4(page);
  await choose(page, 'apple', '같아요');
  await submit(page);
  await expectFailedWithHint(page, '학생 수를 각각 구해서 견줘 볼까요?', 1);
  await choose(page, 'apple', '2반');
  await submit(page);
  await expectPassed(page, true);
});

test('g6s1u5.A1 — 응답 칸이 있는 과제의 크롬북 두 칸 배치에서 원 지름과 띠 한 칸을 잰다', async ({
  page,
}, testInfo) => {
  test.slow();
  await openActivity(page, 'A1');
  const vp = testInfo.project.name;
  const bandBox = await canvas(page).boundingBox();
  console.log(
    `[T168 ${vp}] A1.T1 그래프 ${Math.round(bandBox?.width ?? 0)}x${Math.round(bandBox?.height ?? 0)}`,
  );
  await passA1T1(page);
  await passA1T2(page);
  await expect(canvas(page)).toBeVisible();
  const frameBox = await canvas(page).getByTestId('band-frame-line').first().boundingBox();
  console.log(`[T168 ${vp}] A1.T2 띠 한 칸 ${((frameBox?.width ?? 0) / 100).toFixed(2)}px`);
  expect((frameBox?.width ?? 0) / 100).toBeGreaterThanOrEqual(4);
  await dragToCircle(page);
  expect(await measureCircle(page, 'A1.T3', vp)).toBeGreaterThanOrEqual(200);
  await typeFraction(page, 'grape', '3', '10');
  await submit(page);
  await expectPassed(page);
  await passA1T4(page);
  await expect(canvas(page).getByTestId('compare-circle')).toBeVisible();
  expect(await measureCircle(page, 'A1.T5', vp)).toBeGreaterThanOrEqual(200);
});

// ---------------------------------------------------------------- A2

test('g6s1u5.A2 — 4과제 흐름과 오개념 ①②·오버레이 정렬', async ({ page }, testInfo) => {
  test.slow();
  await openActivity(page, 'A2');
  const vp = testInfo.project.name;
  const m = main(page);

  // T1: 첫 화면 + 스냅샷. 45부터 + 2배쯤 → TRUNCATED-AXIS ① → ② zero-axis(정렬) → 통과
  await expect(page.getByRole('radiogroup', { name: '세로축 시작' })).toBeVisible();
  await expect(page.getByRole('radio', { name: '0부터', exact: true })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await expectFirstScreen(page, FIRST_SCREEN['A2.T1']?.[vp] ?? 'fit', [
    canvas(page),
    page.getByRole('radiogroup', { name: '세로축 시작' }),
  ]);
  await expectBarHeight(page, 'A2.T1', vp);
  await expectDistortionNotCovered(page, vp);
  await expectNoConclusionText(page);
  await screenshot(page, 'g6s1u5-a2.png');
  await expect
    .poll(async () => {
      const [a, b] = await barHeights(page);
      return Math.abs((a ?? 0) / (b ?? 1) - 52 / 48) < 0.04;
    })
    .toBe(true);
  await pickStart(page, 45);
  await expect
    .poll(async () => {
      const [a, b] = await barHeights(page);
      return (a ?? 0) / (b ?? 1) > 2;
    })
    .toBe(true);
  await page.getByRole('button', { name: '1반이 압도적!' }).click();
  await expect(m.getByTestId('headline-text')).toHaveText('1반이 압도적!');
  await choose(page, 'really', '2배쯤');
  await submit(page);
  await expectFailedWithHint(page, '세로축 맨 아래 숫자는 몇이야?', 1);
  await submit(page);
  await expectFailedWithHint(page, '0부터 그린 같은 막대를 옅게 겹쳐', 2);
  const zero = await expectOverlayAligned(page, 'zero-axis');
  await expect(zero.locator('text')).toHaveCount(0);
  await expect(zero.locator('[data-testid="zero-axis-bar"]').first()).toBeVisible();
  await choose(page, 'really', '거의 같아요');
  await submit(page);
  await expectPassed(page);

  // T2: 45부터에서 시작한다. 그대로 확인 → 일반 ① → 0부터 → 통과
  await expect(page.getByRole('radio', { name: '45부터', exact: true })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await expectBarHeight(page, 'A2.T2', vp);
  await expectNoConclusionText(page);
  await submit(page);
  await expectFailedWithHint(page, '세로축을 어디에서 시작해야 할까?', 1);
  await submit(page);
  await expectFailedWithHint(page, '두 막대의 길이가 어떻게 달라지는지 비교해 봐요.', 2);
  await pickStart(page, 0);
  await submit(page);
  await expectPassed(page);

  // T3: 예시 탭. DOM에 flaws가 없다. 예시 1에 엉뚱한 항목 → ① → 맞게 표시해 통과
  await expect(page.getByRole('tablist', { name: '볼 그래프' })).toBeVisible();
  await expectNoConclusionText(page);
  for (const tab of ['예시 1', '예시 2', '예시 3']) {
    await page.getByRole('tab', { name: tab }).click();
    const html = await page.content();
    expect(html).not.toMatch(/flaws|data-flaw|data-correct|data-wrong|data-answer/);
  }
  await markExample(page, '예시 1', ['step']);
  await markExample(page, '예시 2', ['step']);
  await markExample(page, '예시 3', ['sum']);
  await submit(page);
  await expectFailedWithHint(page, '체크리스트 질문을 하나씩 그래프에 물어보며', 1);
  await submit(page);
  await expectFailedWithHint(page, null, 2);
  await markExample(page, '예시 1', ['zero']);
  await page.getByRole('checkbox', { name: ITEM.step }).uncheck();
  await submit(page);
  await expectPassed(page);

  // T4: 막대 색·제목 길이는 조건이 아니다 → 일반 ① → 두 조건을 골라 통과
  await expectBarHeight(page, 'A2.T4', vp);
  await expectNoConclusionText(page);
  await choose(page, 'fair', '막대 색이 화려하다');
  await choose(page, 'fair', '제목이 짧다');
  await submit(page);
  await expectFailedWithHint(page, '인상을 달리 만들 수 있는 것은 무엇이었나요?', 1);
  await submit(page);
  await expectFailedWithHint(page, '막대의 색이나 제목 길이가', 2);
  await choose(page, 'fair', '막대 색이 화려하다');
  await choose(page, 'fair', '제목이 짧다');
  await choose(page, 'fair', '세로축이 0에서 시작한다');
  await choose(page, 'fair', '눈금 간격이 일정하다');
  await submit(page);
  await expectPassed(page, true);
});

test('g6s1u5.A2.T1 — 45부터에 3배 넘게도 오개념 ①이고, 40부터나 0부터가 아닌 채 같아요를 고르면 통과한다', async ({
  page,
}) => {
  test.slow();
  await openActivity(page, 'A2');
  await pickStart(page, 40);
  await choose(page, 'really', '3배 넘게');
  await submit(page);
  await expectFailedWithHint(page, '세로축 맨 아래 숫자는 몇이야?', 1);
  await choose(page, 'really', '거의 같아요');
  await submit(page);
  await expectPassed(page);
});

test('g6s1u5.A2.T1 — 물결선과 눈금 한 칸을 바꿔도 같아요를 고르면 통과한다', async ({ page }) => {
  test.slow();
  await openActivity(page, 'A2');
  await pickStart(page, 45);
  await main(page).getByTestId('distortion-wavy-toggle').click();
  await expect(main(page).getByTestId('distortion-wavy-toggle')).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await page.getByRole('radio', { name: '2권' }).click();
  await expect(page.getByRole('radio', { name: '2권' })).toHaveAttribute('aria-checked', 'true');
  await choose(page, 'really', '거의 같아요');
  await submit(page);
  await expectPassed(page);
});

test('g6s1u5.A2.T1 — 0부터인 채로 같아요를 고르면 상태 규칙 ①②이다', async ({ page }) => {
  test.slow();
  await openActivity(page, 'A2');
  await choose(page, 'really', '거의 같아요');
  await submit(page);
  await expectFailedWithHint(page, '0에서 시작하는 그래프에서도', 1);
  await submit(page);
  await expectFailedWithHint(page, '값을 골라 막대 높이가 어떻게 달라지는지 봐요.', 2);
  await pickStart(page, 45);
  await submit(page);
  await expectPassed(page);
});

test('g6s1u5.A2.T2 — 40부터는 일반 ①이고 0부터는 통과한다', async ({ page }) => {
  test.slow();
  await openActivity(page, 'A2');
  await passA2T1(page);
  await pickStart(page, 40);
  await submit(page);
  await expectFailedWithHint(page, '세로축을 어디에서 시작해야 할까?', 1);
  await pickStart(page, 0);
  await submit(page);
  await expectPassed(page);
});

test('g6s1u5.A2.T3 — 합이 100이 아닌 원그래프를 놓치면 일반 ①이고, 항목을 더 표시해도 통과하지 못한다', async ({
  page,
}) => {
  test.slow();
  await openActivity(page, 'A2');
  await passA2T1(page);
  await passA2T2(page);
  await markExample(page, '예시 1', ['zero']);
  await markExample(page, '예시 2', ['step']);
  await submit(page);
  await expectFailedWithHint(page, '체크리스트 질문을 하나씩', 1);
  await markExample(page, '예시 3', ['sum', 'group']);
  await submit(page);
  await expectFailedWithHint(page, null, 2);
  await page.getByRole('checkbox', { name: ITEM.group }).uncheck();
  await submit(page);
  await expectPassed(page);
});

test('g6s1u5.A2.T4 — 한 조건만 고르면 일반 ①이고 두 조건은 통과한다', async ({ page }) => {
  test.slow();
  await openActivity(page, 'A2');
  await passA2T1(page);
  await passA2T2(page);
  await passA2T3(page);
  await choose(page, 'fair', '세로축이 0에서 시작한다');
  await submit(page);
  await expectFailedWithHint(page, '인상을 달리 만들 수 있는 것은 무엇이었나요?', 1);
  await choose(page, 'fair', '눈금 간격이 일정하다');
  await submit(page);
  await expectPassed(page, true);
});

test('g6s1u5.A1 — 5과제를 정답으로 차례로 통과한다', async ({ page }) => {
  test.slow();
  await openActivity(page, 'A1');
  await passA1(page);
});

// ---------------------------------------------------------------- 오프라인

test('오프라인에서도 g6s1u5.A1 활동이 열린다', async ({ page, context }) => {
  await page.goto(PREVIEW_URL);
  await page.getByRole('button', { name: '1번', exact: true }).click();
  await page.getByRole('button', { name: '건너뛰기' }).click();
  await expect(page).toHaveURL(/#\/map$/);
  await page.goto(`${PREVIEW_URL}/#/activity/g6s1u5.A1`);
  await expect(
    page.getByRole('heading', { name: '띠그래프를 말아 원그래프 만들기' }),
  ).toBeVisible();

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
  await expect(
    page.getByRole('heading', { name: '띠그래프를 말아 원그래프 만들기' }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: '확인하기' })).toBeVisible();
});
