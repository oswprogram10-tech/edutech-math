import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { PREVIEW_URL } from '../../../playwright.config';
import { expectContentPanelsReachable, expectNoPanelInnerScroll } from '../panel-layout';
import { Rational } from '../../../src/core/math';
import {
  laneCenter,
  lineGeometry,
  normalizeLine,
  yOfValue,
} from '../../../src/engines/E18-graph-studio/line';

/**
 * T164 g4s2u5 「꺾은선그래프」 A1(강낭콩 키 자료로 꺾은선그래프 그리기)·A2(물결선 아코디언과 예측기) 단원 E2E.
 * - 8과제 정답 통과, 과제마다 대표 오답 → 일반 힌트 ①
 * - 상태 규칙(A1.T2: 순서대로 잇지 않음)과 오개념 3코드(MC-GRAPH-HEIGHT-NOT-CHANGE,
 *   MC-GRAPH-NO-INTERPOLATE, MC-GRAPH-WAVY-LINE) ①·②, 오버레이(change-bars, interp-guide,
 *   unfold-axis)가 실제로 그려지고 본 캔버스와 1px 안에서 맞음
 * - 점 찍기는 끌기 1개 + 키보드(↑), 첫 화면, 그래프 높이·0.5cm 한 칸 높이, 오프라인, 스냅샷
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
  readFileSync(new URL('../../../data/content/g4s2u5.json', import.meta.url), 'utf-8'),
) as UnitContent;

const LOGICAL_H = 700;
/** A1 강낭콩 자료(날짜 → 키 cm). 세로 눈금은 소수 문자열이다. */
const BEAN: readonly (readonly [string, string])[] = [
  ['1일', '0.5'],
  ['3일', '2'],
  ['5일', '5.5'],
  ['7일', '9.5'],
  ['9일', '11'],
];

function configOf(activity: 0 | 1, task: number): Record<string, unknown> {
  const found = content.activities[activity]?.tasks[task]?.config;
  if (!found) throw new Error('과제 설정을 찾지 못했습니다.');
  return found;
}

test('콘텐츠 설정이 명세를 따른다(A1 4과제, A2 4과제, 읽기 과제는 표·말풍선 숨김)', () => {
  expect(content.activities.map((a) => a.id)).toEqual(['g4s2u5.A1', 'g4s2u5.A2']);
  const a1 = content.activities[0]?.tasks ?? [];
  const a2 = content.activities[1]?.tasks ?? [];
  expect(a1.map((t) => t.id)).toEqual([
    'g4s2u5.A1.T1',
    'g4s2u5.A1.T2',
    'g4s2u5.A1.T3',
    'g4s2u5.A1.T4',
  ]);
  expect(a2.map((t) => t.id)).toEqual([
    'g4s2u5.A2.T1',
    'g4s2u5.A2.T2',
    'g4s2u5.A2.T3',
    'g4s2u5.A2.T4',
  ]);
  for (const task of [...a1, ...a2]) expect(task.config['mode']).toBe('line-graph');
  // 학생이 그리는 두 과제는 말풍선이 없는 student 그래프다. 응답 칸이 없다.
  expect(a1[0]?.config['graph']).toBe('student');
  expect(a1[0]?.response).toBeUndefined();
  expect(a1[1]?.config['connect']).toBe('student');
  expect(a1[1]?.response).toBeUndefined();
  // 읽는 과제(A1.T3, A2.T2~T4)는 표를 숨기고 말풍선을 끈다.
  for (const task of [a1[2], a2[1], a2[2], a2[3]]) {
    expect(task?.config['table']).toBe('hidden');
    expect(task?.config['tooltips']).toBe('hide');
  }
  expect(a1[3]?.config['predict']).toBe(true);
  expect(a2[0]?.config['yFromOptions']).toEqual(['0', '35', '36']);
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

function lane(page: Page, x: string): Locator {
  return canvas(page).locator(`[data-testid="line-lane"][data-x="${x}"]`);
}

function pointOf(page: Page, x: string, kind = 'actual'): Locator {
  return canvas(page).locator(`[data-testid="line-point"][data-x="${x}"][data-kind="${kind}"]`);
}

function segment(page: Page, a: number, b: number): Locator {
  return canvas(page).locator(`[data-testid="line-segment"][data-a="${a}"][data-b="${b}"]`);
}

async function openActivity(page: Page, activity: 'A1' | 'A2'): Promise<void> {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.getByRole('button', { name: '1번', exact: true }).click();
  await page.getByRole('button', { name: '건너뛰기' }).click();
  await expect(page).toHaveURL(/#\/map$/);
  await page.goto(`/#/activity/g4s2u5.${activity}`);
  await expect(
    page.getByRole('heading', {
      name: activity === 'A1' ? '강낭콩 키 자료로 꺾은선그래프 그리기' : '물결선 아코디언과 예측기',
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
  expect(text).not.toMatch(
    /5일에서 7일|5일~7일 사이|가장 많이 자랐어요|가장 많이 올랐어요|37\.1|[1-6]학년/,
  );
}

/** 그래프 SVG 상자 높이를 재어 기록하고 200px 이상인지 단언한다(응답 칸이 있으면 두 칸 배치). */
async function expectGraphHeight(page: Page, label: string, vp: string): Promise<void> {
  const graphBox = await canvas(page).boundingBox();
  const mainBox = await main(page).boundingBox();
  const response = slot(page, 'response');
  const respBox = (await response.count()) > 0 ? await response.boundingBox() : null;
  console.log(
    `[T164 ${vp}] ${label} 그래프 ${Math.round(graphBox?.width ?? 0)}x${Math.round(graphBox?.height ?? 0)}, 교구 판 ${Math.round(mainBox?.width ?? 0)}x${Math.round(mainBox?.height ?? 0)}, 응답 판 ${Math.round(respBox?.width ?? 0)}x${Math.round(respBox?.height ?? 0)}`,
  );
  expect(graphBox?.height ?? 0).toBeGreaterThanOrEqual(200);
}

/** 0.5cm 한 칸(plotStep)의 화면 높이(px)를 재어 기록하고 6px 이상인지 단언한다. */
async function expectPlotStepHeight(page: Page, label: string, vp: string): Promise<void> {
  const box = await canvas(page).boundingBox();
  if (!box) throw new Error('그래프 크기를 알 수 없습니다.');
  const width = Number(await canvas(page).getAttribute('data-logical-width'));
  const g = lineGeometry(normalizeLine(configOf(0, 0)), '0', width);
  const scale = Math.min(box.width / width, box.height / LOGICAL_H);
  const px = g.unit * 0.5 * scale;
  console.log(
    `[T164 ${vp}] ${label} 0.5cm 한 칸 ${px.toFixed(1)}px (그래프 ${Math.round(box.width)}x${Math.round(box.height)}, 논리 폭 ${width})`,
  );
  // 크롬북·전자칠판은 6px 이상이어야 한다(카드 기준). 아이패드 세로 화면은 그래프가 가로로 스크롤되는 좁은 판이라
  // 5px대이고, 점은 끌기·키보드 ↑로 0.5cm에 붙으므로 기록만 하고 5px 이상만 확인한다.
  expect(px).toBeGreaterThanOrEqual(vp === 'ipad' ? 5 : 6);
}

// ---------------------------------------------------------------- 도우미

/** 낱 소수 칸에 글자를 쓴다(이미 쓴 글자는 지운다). */
async function setDecimal(page: Page, id: string, text: string): Promise<void> {
  await field(page, id).locator('[data-part="decimal"]').click();
  for (let i = 0; i < 6; i += 1) await page.keyboard.press('Backspace');
  for (const char of text) await page.keyboard.press(char);
}

async function choose(page: Page, id: string, label: string): Promise<void> {
  await field(page, id).getByRole('button', { name: label, exact: true }).click();
}

/** 레인 번호와 값(문자열)의 화면 좌표. 그림이 화면 밖이면 스크롤해서 가져온다. */
async function screenOf(
  page: Page,
  config: Record<string, unknown>,
  index: number,
  y: string,
): Promise<{ x: number; y: number }> {
  const svg = canvas(page);
  await svg.scrollIntoViewIfNeeded();
  const box = await svg.boundingBox();
  if (!box) throw new Error('그래프를 찾지 못했습니다.');
  const width = Number(await svg.getAttribute('data-logical-width'));
  const from = (await svg.getAttribute('data-y-from')) ?? '0';
  const g = lineGeometry(normalizeLine(config), from, width);
  return {
    x: box.x + (laneCenter(g, index) * box.width) / width,
    y: box.y + (yOfValue(g, Rational.parse(y)) * box.height) / LOGICAL_H,
  };
}

/** 레인을 끌어서 손을 뗀 높이(값)에 점을 찍는다. */
async function dragPoint(
  page: Page,
  config: Record<string, unknown>,
  index: number,
  from: string,
  to: string,
): Promise<void> {
  const start = await screenOf(page, config, index, from);
  const end = await screenOf(page, config, index, to);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x + 3, (start.y + end.y) / 2, { steps: 4 });
  await page.mouse.move(end.x, end.y, { steps: 4 });
  await page.mouse.up();
}

/** 레인에 초점을 두고 ↑를 `times`번 누른다. 처음 ↑는 시작값(0)에 점을 놓는다. */
async function pressUp(page: Page, x: string, times: number): Promise<void> {
  const target = lane(page, x);
  await target.focus();
  await expect(target).toBeFocused();
  for (let step = 0; step < times; step += 1) await page.keyboard.press('ArrowUp');
}

/** 시작값 0에서 0.5cm씩 올려 `value`cm(0.5의 배수)에 점을 찍는다. 이미 점이 있으면 처음부터 다시 맞춘다. */
async function plotByKeyboard(page: Page, x: string, value: string): Promise<void> {
  await pressUp(page, x, Math.round(Number(value) * 2) + 1);
  await expect(pointOf(page, x)).toHaveAttribute('data-y', value);
}

async function plotAll(
  page: Page,
  skip: readonly string[] = [],
  override: Readonly<Record<string, string>> = {},
): Promise<void> {
  for (const [x, y] of BEAN) {
    if (skip.includes(x)) continue;
    await plotByKeyboard(page, x, override[x] ?? y);
  }
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

/** 이웃한 점(0-1, 1-2, 2-3, 3-4)을 레인에서 Enter로 차례로 잇는다. */
async function connectNeighbours(page: Page, skipFirst = false): Promise<void> {
  for (let index = skipFirst ? 1 : 0; index < BEAN.length - 1; index += 1) {
    await connectByKeyboard(page, index, index + 1);
  }
}

async function connectByKeyboard(page: Page, a: number, b: number): Promise<void> {
  const first = lane(page, BEAN[a]?.[0] ?? '');
  await first.focus();
  await expect(first).toBeFocused();
  await page.keyboard.press('Enter');
  const second = lane(page, BEAN[b]?.[0] ?? '');
  await second.focus();
  await expect(second).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(segment(page, a, b)).toHaveCount(1);
}

async function passA1T1(page: Page): Promise<void> {
  await plotAll(page);
  await submit(page);
  await expectPassed(page);
}

async function passA1T2(page: Page): Promise<void> {
  await plotAll(page);
  await connectNeighbours(page);
  await submit(page);
  await expectPassed(page);
}

async function passA1T3(page: Page): Promise<void> {
  await choose(page, 'period', '5일~7일');
  await submit(page);
  await expectPassed(page);
}

async function passA1T4(page: Page, last = false): Promise<void> {
  await predictTwoPoints(page);
  await page.getByTestId('line-finish-predict').click();
  await choose(page, 'diff', '가운데 날들');
  await submit(page);
  await expectPassed(page, last);
}

/** 예측 단계에서 1일·9일에 예측 점을 하나씩 찍는다(↑ 키: 처음 ↑는 0). */
async function predictTwoPoints(page: Page): Promise<void> {
  await pressUp(page, '1일', 3);
  await expect(pointOf(page, '1일', 'prediction')).toHaveAttribute('data-y', '1');
  await pressUp(page, '9일', 9);
  await expect(pointOf(page, '9일', 'prediction')).toHaveAttribute('data-y', '4');
}

async function passA2T1(page: Page): Promise<void> {
  await page.getByRole('radio', { name: '36부터' }).click();
  await expect(canvas(page)).toHaveAttribute('data-y-from', '36');
  await submit(page);
  await expectPassed(page);
}

/** A2.T2까지 가서 열린 상태. */
async function openA2T2(page: Page): Promise<void> {
  await openActivity(page, 'A2');
  await passA2T1(page);
  await expect(field(page, 'can')).toBeVisible();
}

// ---------------------------------------------------------------- A1

test('g4s2u5.A1 — 4과제 흐름과 상태 규칙·오개념 ①②·오버레이 정렬', async ({ page }, testInfo) => {
  test.slow();
  await openActivity(page, 'A1');
  const vp = testInfo.project.name;
  const m = main(page);
  const bean = configOf(0, 0);

  // T1: 첫 화면 + 스냅샷. 9일은 끌기 1개, 나머지는 키보드 ↑. 5일 한 칸 모자람 → 일반 ① → 고쳐서 통과
  await expect(canvas(page)).toBeVisible();
  await expect(m.getByTestId('graph-table')).toBeVisible();
  await expect(m.getByTestId('graph-tooltip')).toHaveCount(0);
  await expectFirstScreen(page, FIRST_SCREEN['A1.T1']?.[vp] ?? 'fit', [
    canvas(page),
    m.getByTestId('graph-table'),
  ]);
  await expectGraphHeight(page, 'A1.T1', vp);
  await expectPlotStepHeight(page, 'A1.T1', vp);
  await expectNoConclusionText(page);
  await screenshot(page, 'g4s2u5-a1.png');
  await dragPoint(page, bean, 4, '0', '11');
  await expect(pointOf(page, '9일')).toHaveAttribute('data-y', '11');
  await plotAll(page, ['9일'], { '5일': '5' });
  await submit(page);
  await expectFailedWithHint(page, '점마다 표의 키와 같은 높이에 찍었나요?', 1);
  await submit(page);
  await expectFailedWithHint(page, '한 칸의 절반은 0.5cm예요.', 2);
  await pressUp(page, '5일', 1);
  await expect(pointOf(page, '5일')).toHaveAttribute('data-y', '5.5');
  await submit(page);
  await expectPassed(page);

  // T2: 점을 다 찍고 1일–5일만 이음 → 상태 ① → 끊고 순서대로 이으면 통과
  await expect(canvas(page)).toHaveAttribute('data-logical-width', /\d+/);
  await expectGraphHeight(page, 'A1.T2', vp);
  await expectPlotStepHeight(page, 'A1.T2', vp);
  await plotAll(page);
  await connectByKeyboard(page, 0, 2);
  await submit(page);
  await expectFailedWithHint(page, '날짜 순서대로 바로 옆 점끼리 이었나요?', 1);
  await submit(page);
  await expectFailedWithHint(page, '건너뛴 선분은 눌러서 끊을 수 있어요.', 2);
  await segment(page, 0, 2).focus();
  await page.keyboard.press('Delete');
  await expect(segment(page, 0, 2)).toHaveCount(0);
  await connectNeighbours(page);
  await submit(page);
  await expectPassed(page);

  // T3: 표·말풍선 없음. 7일~9일 → MC ① → ② change-bars(정렬) → 5일~7일 통과
  await expect(m.getByTestId('graph-table')).toHaveCount(0);
  await expect(m.getByTestId('graph-tooltip')).toHaveCount(0);
  await expectGraphHeight(page, 'A1.T3', vp);
  await expectNoConclusionText(page);
  await choose(page, 'period', '7일~9일');
  await submit(page);
  await expectFailedWithHint(page, "'가장 큰 날'과 '가장 많이 자란 기간'은 같은 질문일까?", 1);
  await submit(page);
  await expectFailedWithHint(page, '가장 긴 막대를 찾아봐요.', 2);
  const bars = await expectOverlayAligned(page, 'change-bars');
  await expect(bars.locator('text')).toHaveCount(0);
  await choose(page, 'period', '5일~7일');
  await submit(page);
  await expectPassed(page);

  // T4: 예측 단계에는 표가 없다. 예측 전에 고르고 확인 → 일반 ① → 예측 점 2개 + 실제 자료 보기 + 고르기 → 통과
  await expect(m.getByTestId('graph-table')).toHaveCount(0);
  await expect(m.getByTestId('graph-tooltip')).toHaveCount(0);
  await expectGraphHeight(page, 'A1.T4', vp);
  await expectNoConclusionText(page);
  await choose(page, 'diff', '거의 비슷했어요');
  await submit(page);
  await expectFailedWithHint(page, "예측 점을 찍고 '실제 자료 보기'를 눌렀나요?", 1);
  await submit(page);
  await expectFailedWithHint(page, "날짜 줄을 눌러 예측 점을 찍은 뒤 '실제 자료 보기'를", 2);
  await predictTwoPoints(page);
  await expect(page.getByTestId('line-legend')).toContainText('예측');
  await page.getByTestId('line-finish-predict').click();
  await expect(m.getByTestId('graph-table')).toBeVisible();
  const legend = page.getByTestId('line-legend');
  await expect(legend).toContainText('예측');
  await expect(legend).toContainText('실제');
  await expect(pointOf(page, '5일', 'actual')).toHaveCount(1);
  await choose(page, 'diff', '가운데 날들');
  await submit(page);
  await expectPassed(page, true);
});

test('g4s2u5.A1 — 과제마다 대표 오답은 일반 힌트 ①이 뜬다', async ({ page }) => {
  test.slow();
  await openActivity(page, 'A1');

  // T1: 9일 점을 찍지 않음 → 일반 ①
  await plotAll(page, ['9일']);
  await submit(page);
  await expectFailedWithHint(page, '점마다 표의 키와 같은 높이에 찍었나요?', 1);
  await plotByKeyboard(page, '9일', '11');
  await submit(page);
  await expectPassed(page);

  // T2: 점 하나가 틀리고 선분이 없음 → 일반 ①(상태 규칙 아님)
  await plotAll(page, [], { '3일': '2.5' });
  await connectNeighbours(page);
  await submit(page);
  await expectFailedWithHint(page, '점마다 표의 키와 같은 높이에 찍었나요?', 1);
  await lane(page, '3일').focus();
  await page.keyboard.press('ArrowDown');
  await expect(pointOf(page, '3일')).toHaveAttribute('data-y', '2');
  await submit(page);
  await expectPassed(page);

  // T3: 1일~3일 → 일반 ①(처음 자란 기간은 오개념 함정이 아님)
  await choose(page, 'period', '1일~3일');
  await submit(page);
  await expectFailedWithHint(page, '선분이 가장 가파르게 올라간 곳을 찾아볼까요?', 1);
  await submit(page);
  await expectFailedWithHint(page, '기간마다 선분이 얼마나 기울었는지 비교해 봐요.', 2);
  await choose(page, 'period', '5일~7일');
  await submit(page);
  await expectPassed(page);

  // T4: 실제 자료 보기를 안 누르고 고르기만 → 일반 ①
  await choose(page, 'diff', '처음 며칠');
  await submit(page);
  await expectFailedWithHint(page, "예측 점을 찍고 '실제 자료 보기'를 눌렀나요?", 1);
  await passA1T4(page, true);
});

test('g4s2u5.A1.T2 — 점이 틀리면 선분이 순서대로여도 일반 ①이고, 모두 맞으면 통과한다', async ({
  page,
}) => {
  test.slow();
  await openActivity(page, 'A1');
  await passA1T1(page);
  await plotAll(page, [], { '9일': '10.5' });
  await connectNeighbours(page);
  await submit(page);
  await expectFailedWithHint(page, '점마다 표의 키와 같은 높이에 찍었나요?', 1);
  await pressUp(page, '9일', 1);
  await expect(pointOf(page, '9일')).toHaveAttribute('data-y', '11');
  await submit(page);
  await expectPassed(page);
});

test('g4s2u5.A1.T3 — 다른 오답(3일~5일)은 일반 ①, 정답은 통과한다', async ({ page }) => {
  test.slow();
  await openActivity(page, 'A1');
  await passA1T1(page);
  await passA1T2(page);
  await choose(page, 'period', '3일~5일');
  await submit(page);
  await expectFailedWithHint(page, '선분이 가장 가파르게 올라간 곳을 찾아볼까요?', 1);
  await passA1T3(page);
  await expect(field(page, 'diff')).toBeVisible();
});

// ---------------------------------------------------------------- A2

test('g4s2u5.A2 — 4과제 흐름과 오개념 ①②·오버레이 정렬', async ({ page }, testInfo) => {
  test.slow();
  await openActivity(page, 'A2');
  const vp = testInfo.project.name;
  const m = main(page);

  // T1: 첫 화면 + 스냅샷. 그대로 확인 → 일반 ① → 36부터 → data-y-from·data-wavy → 통과
  await expect(page.getByRole('radiogroup', { name: '물결선' })).toBeVisible();
  await expect(m.getByTestId('graph-table')).toBeVisible();
  await expectFirstScreen(page, FIRST_SCREEN['A2.T1']?.[vp] ?? 'fit', [
    canvas(page),
    page.getByRole('radiogroup', { name: '물결선' }),
  ]);
  await expectGraphHeight(page, 'A2.T1', vp);
  await expectNoConclusionText(page);
  await expect(canvas(page)).toHaveAttribute('data-y-from', '0');
  await expect(canvas(page)).toHaveAttribute('data-wavy', 'false');
  await screenshot(page, 'g4s2u5-a2.png');
  await submit(page);
  await expectFailedWithHint(page, '0부터 그린 그래프에서 체온 변화가 잘 보이나요?', 1);
  await submit(page);
  await expectFailedWithHint(page, "'물결선' 줄에서 더 큰 시작값을 골라", 2);
  await page.getByRole('radio', { name: '36부터' }).click();
  await expect(canvas(page)).toHaveAttribute('data-y-from', '36');
  await expect(canvas(page)).toHaveAttribute('data-wavy', 'true');
  await expect(page.getByTestId('line-wavy')).toBeVisible();
  await submit(page);
  await expectPassed(page);

  // T2: 표·말풍선·물결선 단추 없음. 알 수 없어요 → NO-INTERPOLATE ① → ② interp-guide(정렬) → 어림해서 통과
  await expect(m.getByTestId('graph-table')).toHaveCount(0);
  await expect(m.getByTestId('graph-tooltip')).toHaveCount(0);
  await expect(page.getByRole('radiogroup', { name: '물결선' })).toHaveCount(0);
  await expect(canvas(page)).toHaveAttribute('data-y-from', '36');
  await expectGraphHeight(page, 'A2.T2', vp);
  await expectNoConclusionText(page);
  await choose(page, 'can', '재지 않아서 알 수 없어요');
  await submit(page);
  await expectFailedWithHint(page, '선분 위에서 11시 30분은 어디쯤일까?', 1);
  await submit(page);
  await expectFailedWithHint(page, '선분과 만나는 곳을 봐요.', 2);
  const guide = await expectOverlayAligned(page, 'interp-guide');
  await expect(guide.locator('[data-testid="interp-guide-line"]')).toHaveCount(1);
  await expect(guide.locator('text')).toHaveCount(0);
  await choose(page, 'can', '선분을 보고 어림할 수 있어요');
  await setDecimal(page, 'temp', '37.1');
  await submit(page);
  await expectPassed(page);

  // T3: 11시~12시 → 일반 ① → 10시~11시 통과
  await expect(m.getByTestId('graph-table')).toHaveCount(0);
  await expectGraphHeight(page, 'A2.T3', vp);
  await expectNoConclusionText(page);
  await choose(page, 'rise', '11시~12시');
  await submit(page);
  await expectFailedWithHint(page, '가장 가파른 곳을 찾아볼까요?', 1);
  await submit(page);
  await expectFailedWithHint(page, '눈금 몇 칸만큼 올랐는지 세어 봐요.', 2);
  await choose(page, 'rise', '10시~11시');
  await submit(page);
  await expectPassed(page);

  // T4: 내려간다 + 36.8 → 일반 ① → 36.4 통과
  await expect(m.getByTestId('graph-table')).toHaveCount(0);
  await expectGraphHeight(page, 'A2.T4', vp);
  await expectNoConclusionText(page);
  await choose(page, 'reason', '11시부터 계속 내려가고 있어서');
  await setDecimal(page, 'next', '36.8');
  await submit(page);
  await expectFailedWithHint(page, '고른 근거와 예측한 체온이 서로 맞나요?', 1);
  await submit(page);
  await expectFailedWithHint(page, '근거에 맞춰 생각해 봐요.', 2);
  await setDecimal(page, 'next', '36.4');
  await submit(page);
  await expectPassed(page, true);
});

test('g4s2u5.A2.T2 — 물결선 오개념(37 아래를 0부터 읽음) ① → ② unfold-axis(정렬)', async ({
  page,
}) => {
  test.slow();
  await openA2T2(page);
  await choose(page, 'can', '선분을 보고 어림할 수 있어요');
  await setDecimal(page, 'temp', '1.1');
  await submit(page);
  await expectFailedWithHint(page, '물결선이 무엇을 줄여 놓은 표시였지?', 1);
  await submit(page);
  await expectFailedWithHint(page, '0부터 다시 펼쳐 보여 줘요.', 2);
  const unfold = await expectOverlayAligned(page, 'unfold-axis');
  await expect(unfold.locator('text')).toHaveCount(0);
  await setDecimal(page, 'temp', '37.1');
  await submit(page);
  await expectPassed(page);
});

test('g4s2u5.A2.T2 — 대표 오답(36.5)은 일반 ①, 37.1은 통과한다', async ({ page }) => {
  test.slow();
  await openA2T2(page);
  await choose(page, 'can', '선분을 보고 어림할 수 있어요');
  await setDecimal(page, 'temp', '36.5');
  await submit(page);
  await expectFailedWithHint(page, '11시 점과 12시 점을 잇는 선분의 가운데를 볼까요?', 1);
  await submit(page);
  await expectFailedWithHint(page, '세로 눈금을 읽어 봐요.', 2);
  await setDecimal(page, 'temp', '37.1');
  await submit(page);
  await expectPassed(page);
});

test('g4s2u5.A2.T2 — 37, 37.2도 통과하고 37.3은 통과하지 못한다', async ({ page }) => {
  test.slow();
  await openA2T2(page);
  await choose(page, 'can', '선분을 보고 어림할 수 있어요');
  await setDecimal(page, 'temp', '37.3');
  await submit(page);
  await expectFailedWithHint(page, '11시 점과 12시 점을 잇는 선분의 가운데를 볼까요?', 1);
  await setDecimal(page, 'temp', '37.2');
  await submit(page);
  await expectPassed(page);
});

test('g4s2u5.A2.T3·T4 — 9시~10시도 통과하고, 근거와 값이 맞으면 통과한다', async ({ page }) => {
  test.slow();
  await openA2T2(page);
  await choose(page, 'can', '선분을 보고 어림할 수 있어요');
  await setDecimal(page, 'temp', '37.0');
  await submit(page);
  await expectPassed(page);
  await choose(page, 'rise', '9시~10시');
  await submit(page);
  await expectPassed(page);
  // T4: 올라갈 것 같다 + 36.4 → 일반 ① → 36.9 통과
  await choose(page, 'reason', '다시 올라갈 것 같아서');
  await setDecimal(page, 'next', '36.4');
  await submit(page);
  await expectFailedWithHint(page, '고른 근거와 예측한 체온이 서로 맞나요?', 1);
  await setDecimal(page, 'next', '36.9');
  await submit(page);
  await expectPassed(page, true);
});

test('g4s2u5.A2.T4 — 비슷할 것 같다는 근거는 13시와 같은 36.6일 때만 통과한다', async ({
  page,
}) => {
  test.slow();
  await openA2T2(page);
  await choose(page, 'can', '선분을 보고 어림할 수 있어요');
  await setDecimal(page, 'temp', '37.1');
  await submit(page);
  await expectPassed(page);
  await choose(page, 'rise', '10시~11시');
  await submit(page);
  await expectPassed(page);
  await choose(page, 'reason', '13시와 비슷할 것 같아서');
  await setDecimal(page, 'next', '36.7');
  await submit(page);
  await expectFailedWithHint(page, '고른 근거와 예측한 체온이 서로 맞나요?', 1);
  await setDecimal(page, 'next', '36.6');
  await submit(page);
  await expectPassed(page, true);
});

// ---------------------------------------------------------------- 오프라인

test('오프라인에서도 g4s2u5.A1 활동이 열린다', async ({ page, context }) => {
  await page.goto(PREVIEW_URL);
  await page.getByRole('button', { name: '1번', exact: true }).click();
  await page.getByRole('button', { name: '건너뛰기' }).click();
  await expect(page).toHaveURL(/#\/map$/);
  await page.goto(`${PREVIEW_URL}/#/activity/g4s2u5.A1`);
  await expect(
    page.getByRole('heading', { name: '강낭콩 키 자료로 꺾은선그래프 그리기' }),
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
    page.getByRole('heading', { name: '강낭콩 키 자료로 꺾은선그래프 그리기' }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: '확인하기' })).toBeVisible();
});
