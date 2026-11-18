import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { PREVIEW_URL } from '../../../playwright.config';
import { expectContentPanelsReachable, expectNoPanelInnerScroll } from '../panel-layout';

/**
 * T159 g3s2u6 「그림그래프」 A1(아이콘 압축 그림그래프 만들기)·A2(그림그래프 읽기와 해석) 단원 E2E.
 * - 7과제 정답 통과, 과제마다 대표 오답 → 일반 힌트 ①(A2.T3은 오답이 모두 MC라 일반 ①이 없다)
 * - 상태 규칙(묶지 않음, 범례 안 바꿈)과 오개념 2코드(MC-GRAPH-ICON-VALUE,
 *   MC-GRAPH-ICON-COUNT-COMPARE) ①·②, 오버레이(expand-icons, expand-compare)가 실제로 그려지고 정렬 1px
 * - 키보드 경로(+ 작은 그림, 묶기)와 올가미 토글 경로, 첫 화면, 크롬북 두 칸 배치 그래프 높이, 오프라인, 스냅샷
 * - A2 읽기 과제는 표·말풍선·값 글자가 없다. 학생 화면에 "학년" 표시도 없다.
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
  readFileSync(new URL('../../../data/content/g3s2u6.json', import.meta.url), 'utf-8'),
) as UnitContent;

test('콘텐츠 설정이 명세를 따른다(A1 4과제, A2 3과제, A2는 그림그래프만·말풍선 끔)', () => {
  expect(content.activities.map((a) => a.id)).toEqual(['g3s2u6.A1', 'g3s2u6.A2']);
  const a1 = content.activities[0]?.tasks ?? [];
  const a2 = content.activities[1]?.tasks ?? [];
  expect(a1.map((t) => t.id)).toEqual([
    'g3s2u6.A1.T1',
    'g3s2u6.A1.T2',
    'g3s2u6.A1.T3',
    'g3s2u6.A1.T4',
  ]);
  expect(a2.map((t) => t.id)).toEqual(['g3s2u6.A2.T1', 'g3s2u6.A2.T2', 'g3s2u6.A2.T3']);
  for (const task of a1) {
    expect(task.config['mode']).toBe('pictograph');
    expect(task.config['table']).toBe('given');
  }
  // 그림그래프를 만드는 과제 중 응답 칸이 없는 것은 T1·T3·T4다.
  expect(a1[0]?.response).toBeUndefined();
  expect(a1[1]?.response).toBeDefined();
  expect(a1[2]?.config['legendEditable']).toBe(true);
  expect(a1[3]?.config['icon']).toBe('person');
  for (const task of a2) {
    expect(task.config['views']).toEqual(['pictograph']);
    expect(task.config['tooltips']).toBe('hide');
    expect(task.response).toBeDefined();
  }
  for (const task of [...a1, ...a2]) expect(task.prompt).not.toMatch(/[1-6]학년/);
});

// 첫 화면 기준(뷰포트별): 판이 '확인하기'까지 한 화면에 다 들어오면 'fit', 아니면 'reachable'.
type Mode = 'fit' | 'reachable';
const FIRST_SCREEN: Record<string, Record<string, Mode>> = {
  'A1.T1': { ipad: 'reachable', chromebook: 'reachable', board: 'reachable' },
  'A2.T1': { ipad: 'reachable', chromebook: 'reachable' },
};

const ROWS: Record<string, { readonly big: number; readonly small: number }> = {
  가: { big: 3, small: 2 },
  나: { big: 2, small: 5 },
  다: { big: 4, small: 1 },
  라: { big: 1, small: 8 },
};
const APPLES: Record<string, number> = { 가: 32, 나: 25, 다: 41, 라: 18 };

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

function smalls(page: Page, cat: string): Locator {
  return canvas(page).locator(`g[data-cat="${cat}"][data-kind="small"]`);
}

function bigs(page: Page, cat: string): Locator {
  return canvas(page).locator(`g[data-cat="${cat}"][data-kind="big"]`);
}

async function openActivity(page: Page, activity: 'A1' | 'A2'): Promise<void> {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.getByRole('button', { name: '1번', exact: true }).click();
  await page.getByRole('button', { name: '건너뛰기' }).click();
  await expect(page).toHaveURL(/#\/map$/);
  await page.goto(`/#/activity/g3s2u6.${activity}`);
  await expect(
    page.getByRole('heading', {
      name: activity === 'A1' ? '아이콘 압축 그림그래프 만들기' : '그림그래프 읽기와 해석',
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

/** 학생 화면에 학년 표시·값 글자가 없는지 확인한다. */
async function expectNoConclusionText(page: Page): Promise<void> {
  const text = (await page.locator('body').textContent()) ?? '';
  expect(text).not.toMatch(/다 마을이 가장|가장 많아요|가장 적어요|41상자|23상자|[1-6]학년/);
}

// ---------------------------------------------------------------- 도우미

async function addSmall(page: Page, cat: string, count: number): Promise<void> {
  const button = page.getByRole('button', { name: `${cat} 작은 그림 놓기` });
  for (let index = 0; index < count; index += 1) await button.click();
}

async function compress(page: Page, cat: string, big: number, times: number): Promise<void> {
  const button = page.getByRole('button', {
    name: `${cat} 작은 그림 ${big}개를 큰 그림 1개로 묶기`,
  });
  for (let index = 0; index < times; index += 1) await button.click();
}

/** 행마다 작은 그림을 값만큼 놓는다(묶지 않은 모양). */
async function fillAllSmall(page: Page, data: Readonly<Record<string, number>>): Promise<void> {
  for (const [cat, value] of Object.entries(data)) await addSmall(page, cat, value);
}

/** 사과 자료를 큰 그림 = big(10 또는 5)으로 묶어 정답 모양으로 만든다. */
async function buildApples(page: Page, big: 10 | 5): Promise<void> {
  for (const [cat, value] of Object.entries(APPLES)) {
    await addSmall(page, cat, value);
    await compress(page, cat, big, Math.floor(value / big));
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

/**
 * 행의 작은 그림 [from, to)번을 둘러싸는 올가미를 마우스로 그린다.
 * 행이 두 줄로 접혀 있으면(좁은 판) 줄마다 계단 모양으로 둘러싼다(다른 그림을 건드리지 않게).
 */
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
  // 줄별(같은 y)로 묶는다.
  const lines: { x0: number; x1: number; y0: number; y1: number }[] = [];
  for (const box of boxes) {
    const line = lines.find((item) => Math.abs(item.y0 - box.y) < 4);
    if (line) {
      line.x0 = Math.min(line.x0, box.x);
      line.x1 = Math.max(line.x1, box.x + box.width);
    } else {
      lines.push({ x0: box.x, x1: box.x + box.width, y0: box.y, y1: box.y + box.height });
    }
  }
  if (lines.length > 2) throw new Error('올가미 도우미는 두 줄까지만 둘러쌉니다.');
  const left = Math.min(...lines.map((line) => line.x0)) - margin;
  const first = lines[0];
  const second = lines[1];
  if (!first) throw new Error('그림 상자를 찾지 못했습니다.');
  const points: { x: number; y: number }[] = second
    ? [
        { x: left, y: first.y0 - margin },
        { x: first.x1 + margin, y: first.y0 - margin },
        { x: first.x1 + margin, y: (first.y1 + second.y0) / 2 },
        { x: second.x1 + margin, y: (first.y1 + second.y0) / 2 },
        { x: second.x1 + margin, y: second.y1 + margin },
        { x: left, y: second.y1 + margin },
      ]
    : [
        { x: left, y: first.y0 - margin },
        { x: first.x1 + margin, y: first.y0 - margin },
        { x: first.x1 + margin, y: first.y1 + margin },
        { x: left, y: first.y1 + margin },
      ];
  const start = points[0];
  if (!start) throw new Error('올가미 점이 없습니다.');
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  for (const point of points.slice(1)) await page.mouse.move(point.x, point.y, { steps: 6 });
  await page.mouse.move(start.x, start.y + 2, { steps: 4 });
  await page.mouse.up();
}

async function passA1T1(page: Page): Promise<void> {
  await buildApples(page, 10);
  await submit(page);
  await expectPassed(page);
}

async function passA1T2(page: Page): Promise<void> {
  await addSmall(page, '가', 32);
  await compress(page, '가', 10, 3);
  await setNumber(page, 'fewer', '27');
  await submit(page);
  await expectPassed(page);
}

async function passA1T3(page: Page): Promise<void> {
  await page.getByRole('radio', { name: '큰 그림 = 5상자' }).click();
  await buildApples(page, 5);
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

// ---------------------------------------------------------------- A1

test('g3s2u6.A1 — 그림그래프 4과제 흐름과 상태 규칙(묶지 않음·범례 안 바꿈)', async ({
  page,
}, testInfo) => {
  test.slow();
  await openActivity(page, 'A1');
  const vp = testInfo.project.name;
  const m = main(page);

  // T1: 첫 화면 + 스냅샷. 모두 작은 그림으로 채움 → 상태 ① → 다시 → ② → 묶어서 통과
  await expect(canvas(page)).toBeVisible();
  await expect(m.getByTestId('graph-table')).toBeVisible();
  await expectFirstScreen(page, FIRST_SCREEN['A1.T1']?.[vp] ?? 'fit', [
    page.getByRole('button', { name: '가 작은 그림 놓기' }),
    m.getByTestId('graph-table'),
  ]);
  const box = await canvas(page).boundingBox();
  const mainBox = await m.boundingBox();
  console.log(
    `[T159 ${vp}] A1.T1 그래프 ${Math.round(box?.width ?? 0)}x${Math.round(box?.height ?? 0)}, 교구 판 ${Math.round(mainBox?.width ?? 0)}x${Math.round(mainBox?.height ?? 0)}`,
  );
  await expectNoConclusionText(page);
  await screenshot(page, 'g3s2u6-a1.png');
  await fillAllSmall(page, APPLES);
  await submit(page);
  await expectFailedWithHint(page, '작은 그림이 10개 넘게 있는 줄이 있나요?', 1);
  await submit(page);
  await expectFailedWithHint(page, "'묶기' 단추를 눌러 봐요.", 2);
  for (const [cat, row] of Object.entries(ROWS)) await compress(page, cat, 10, row.big);
  await submit(page);
  await expectPassed(page);

  // T2: 한 줄(가). 32개 → 묶기 3번 → 27 통과
  await expect(smalls(page, '가')).toHaveCount(0);
  await expect(canvas(page).locator('[data-row]')).toHaveCount(1);
  await addSmall(page, '가', 32);
  await compress(page, '가', 10, 3);
  await expect(bigs(page, '가')).toHaveCount(3);
  await expect(smalls(page, '가')).toHaveCount(2);
  await setNumber(page, 'fewer', '27');
  await submit(page);
  await expectPassed(page);

  // T3: 범례 10인 채 정답 그래프 → 상태 ① → 다시 → ② → 범례 5로 바꾸고 다시 만들어 통과
  await buildApples(page, 10);
  await expect(page.getByRole('radio', { name: '큰 그림 = 10상자' })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await submit(page);
  await expectFailedWithHint(page, '범례를 바꿨나요?', 1);
  await submit(page);
  await expectFailedWithHint(page, '큰 그림 = 5를 골라 봐요.', 2);
  await page.getByRole('radio', { name: '큰 그림 = 5상자' }).click();
  await page.getByTestId('pictograph-reset').click();
  await expect(smalls(page, '가')).toHaveCount(0);
  await buildApples(page, 5);
  await submit(page);
  await expectPassed(page);

  // T4: 학급 자료(계절, 사람 그림). 정답 통과
  await expect(page.getByTestId('graph-table')).toContainText('봄');
  await expectNoConclusionText(page);
  await addSmall(page, '봄', 12);
  await addSmall(page, '여름', 15);
  await addSmall(page, '가을', 9);
  await addSmall(page, '겨울', 6);
  await compress(page, '봄', 10, 1);
  await compress(page, '여름', 10, 1);
  await submit(page);
  await expectPassed(page, true);
});

test('g3s2u6.A1 — 과제마다 대표 오답은 일반 힌트 ①이 뜬다', async ({ page }) => {
  test.slow();
  await openActivity(page, 'A1');

  // T1: 나 줄에 작은 그림 하나 더 → 값 틀림 → 일반 ①
  for (const [cat, value] of Object.entries(APPLES)) {
    await addSmall(page, cat, cat === '나' ? value + 1 : value);
    await compress(page, cat, 10, Math.floor(value / 10));
  }
  await submit(page);
  await expectFailedWithHint(page, '줄마다 큰 그림과 작은 그림이 몇 상자인지 세어 볼까요?', 1);
  await smalls(page, '나').last().click();
  await submit(page);
  await expectPassed(page);

  // T2: 묶기 전 32 그대로 답 → 일반 ①
  await addSmall(page, '가', 32);
  await setNumber(page, 'fewer', '32');
  await submit(page);
  await expectFailedWithHint(page, '묶기 전 그림 수와 묶은 뒤 그림 수를 각각 세어 볼까요?', 1);
  await compress(page, '가', 10, 3);
  await setNumber(page, 'fewer', '27');
  await submit(page);
  await expectPassed(page);

  // T3: 범례를 5로 바꿨지만 가 줄만 10 기준 모양(값 틀림) → 일반 ①
  await addSmall(page, '가', 32);
  await compress(page, '가', 10, 3);
  await page.getByRole('radio', { name: '큰 그림 = 5상자' }).click();
  await submit(page);
  await expectFailedWithHint(page, '큰 그림 1개가 이제 몇 상자인지 범례를 볼까요?', 1);
  await page.getByTestId('pictograph-reset').click();
  await buildApples(page, 5);
  await submit(page);
  await expectPassed(page);

  // T4: 봄 줄 하나 더 → 일반 ①
  await addSmall(page, '봄', 13);
  await addSmall(page, '여름', 15);
  await addSmall(page, '가을', 9);
  await addSmall(page, '겨울', 6);
  await compress(page, '봄', 10, 1);
  await compress(page, '여름', 10, 1);
  await submit(page);
  await expectFailedWithHint(page, '줄마다 큰 그림과 작은 그림이 몇 명인지 세어 볼까요?', 1);
  await smalls(page, '봄').last().click();
  await submit(page);
  await expectPassed(page, true);
});

test('g3s2u6.A1.T2 — 키보드만으로 푼다(+ 작은 그림, 묶기, 숫자 키)', async ({ page }) => {
  test.slow();
  await openActivity(page, 'A1');
  await passA1T1(page);
  const add = page.getByRole('button', { name: '가 작은 그림 놓기' });
  await add.focus();
  for (let index = 0; index < 32; index += 1) await page.keyboard.press('Enter');
  await expect(smalls(page, '가')).toHaveCount(32);
  const group = page.getByRole('button', { name: '가 작은 그림 10개를 큰 그림 1개로 묶기' });
  for (let index = 0; index < 3; index += 1) {
    await group.focus();
    await page.keyboard.press('Enter');
  }
  await expect(bigs(page, '가')).toHaveCount(3);
  await field(page, 'fewer').locator('[data-part="whole"]').focus();
  await page.keyboard.press('2');
  await page.keyboard.press('7');
  await page.getByRole('button', { name: '확인하기' }).focus();
  await page.keyboard.press('Enter');
  await expectPassed(page);
});

test('g3s2u6.A1.T2 — 올가미 토글을 켜고 작은 그림 10개를 둘러싸 묶는다', async ({ page }) => {
  test.slow();
  await openActivity(page, 'A1');
  await passA1T1(page);
  await page.getByTestId('pictograph-lasso-toggle').click();
  await expect(page.getByTestId('pictograph-lasso-toggle')).toHaveAttribute('aria-pressed', 'true');
  await addSmall(page, '가', 32);
  for (let index = 1; index <= 3; index += 1) {
    await lassoSmalls(page, '가', 0, 10);
    await expect(bigs(page, '가')).toHaveCount(index);
  }
  await expect(smalls(page, '가')).toHaveCount(2);
  await setNumber(page, 'fewer', '27');
  await submit(page);
  await expectPassed(page);
});

// ---------------------------------------------------------------- A2

test('g3s2u6.A2 — 읽기 3과제 흐름과 오개념 ①②·오버레이 정렬', async ({ page }, testInfo) => {
  test.slow();
  await openActivity(page, 'A2');
  const vp = testInfo.project.name;
  const m = main(page);

  // T1: 표·말풍선 없이 그림그래프만. 5 → MC ① → 다시 → ② expand-icons(정렬) → 41 통과
  await expect(canvas(page)).toBeVisible();
  await expect(m.getByTestId('graph-table')).toHaveCount(0);
  const graphBox = await canvas(page).boundingBox();
  const mainBox = await m.boundingBox();
  const respBox = await slot(page, 'response').boundingBox();
  console.log(
    `[T159 ${vp}] A2.T1 그래프 ${Math.round(graphBox?.width ?? 0)}x${Math.round(graphBox?.height ?? 0)}, 교구 판 ${Math.round(mainBox?.width ?? 0)}x${Math.round(mainBox?.height ?? 0)}, 응답 판 ${Math.round(respBox?.width ?? 0)}x${Math.round(respBox?.height ?? 0)}`,
  );
  expect(graphBox?.height ?? 0).toBeGreaterThanOrEqual(200);
  await expectFirstScreen(page, FIRST_SCREEN['A2.T1']?.[vp] ?? 'fit', [field(page, 'value')]);
  await expectNoConclusionText(page);
  await screenshot(page, 'g3s2u6-a2.png');
  // 그림을 눌러도 말풍선(값)이 뜨지 않는다(tooltips: hide).
  await bigs(page, '다').first().click({ force: true });
  await expect(page.getByTestId('graph-tooltip')).toHaveCount(0);
  await setNumber(page, 'value', '5');
  await submit(page);
  await expectFailedWithHint(page, '큰 사과 하나는 몇 상자였지? 범례를 볼까?', 1);
  await submit(page);
  await expectFailedWithHint(page, '큰 그림 하나를 작은 그림으로 펼쳐 봐요.', 2);
  const icons = await expectOverlayAligned(page, 'expand-icons');
  await expect(icons.locator('[data-ghost-icon]')).toHaveCount(10);
  for (const text of await icons.locator('text').allTextContents()) {
    expect(text).not.toMatch(/\d/);
  }
  await setNumber(page, 'value', '41');
  await submit(page);
  await expectPassed(page);

  // T2: 23 통과 (차)
  await setNumber(page, 'diff', '23');
  await submit(page);
  await expectPassed(page);

  // T3: 예 → MC ① → 다시 → ② expand-compare(정렬) → 아니요 통과
  await choose(page, 'most', '네, 가장 많아요');
  await submit(page);
  await expectFailedWithHint(page, '큰 그림 1개와 작은 그림 9개 중 무엇이 더 많을까?', 1);
  await submit(page);
  await expectFailedWithHint(page, '두 줄을 모두 작은 그림으로 펼쳐 길이를 비교해 봐요.', 2);
  const compare = await expectOverlayAligned(page, 'expand-compare');
  await expect(compare.locator('[data-compare-row]')).toHaveCount(2);
  await expect(compare.locator('[data-compare-row="라"] [data-compare-cell]')).toHaveCount(18);
  await expect(compare.locator('[data-compare-row="다"] [data-compare-cell]')).toHaveCount(41);
  for (const text of await compare.locator('text').allTextContents()) {
    expect(text).not.toMatch(/\d/);
  }
  await choose(page, 'most', '아니요, 아니에요');
  await submit(page);
  await expectPassed(page, true);
});

test('g3s2u6.A2 — 과제마다 대표 오답은 일반 힌트 ①이 뜬다(T3은 오답이 모두 MC)', async ({
  page,
}) => {
  test.slow();
  await openActivity(page, 'A2');

  // T1: 40(큰 그림만 셈) → 일반 ①
  await setNumber(page, 'value', '40');
  await submit(page);
  await expectFailedWithHint(page, '큰 그림과 작은 그림을 따로 세어 볼까요?', 1);
  await setNumber(page, 'value', '41');
  await submit(page);
  await expectPassed(page);

  // T2: 22 → 일반 ①
  await setNumber(page, 'diff', '22');
  await submit(page);
  await expectFailedWithHint(page, '가장 많은 마을과 가장 적은 마을의 값을 먼저 읽어 볼까요?', 1);
  await setNumber(page, 'diff', '23');
  await submit(page);
  await expectPassed(page);

  // T3: 아니요 → 통과(예는 MC)
  await choose(page, 'most', '아니요, 아니에요');
  await submit(page);
  await expectPassed(page, true);
});

// ---------------------------------------------------------------- 오프라인

test('오프라인에서도 g3s2u6.A1 활동이 열린다', async ({ page, context }) => {
  await page.goto(PREVIEW_URL);
  await page.getByRole('button', { name: '1번', exact: true }).click();
  await page.getByRole('button', { name: '건너뛰기' }).click();
  await expect(page).toHaveURL(/#\/map$/);
  await page.goto(`${PREVIEW_URL}/#/activity/g3s2u6.A1`);
  await expect(page.getByRole('heading', { name: '아이콘 압축 그림그래프 만들기' })).toBeVisible();

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
  await expect(page.getByRole('heading', { name: '아이콘 압축 그림그래프 만들기' })).toBeVisible();
  await expect(page.getByRole('button', { name: '확인하기' })).toBeVisible();
});

// passA1T3는 흐름 테스트가 같은 단계를 직접 하므로, 여기서는 범례 단추가 보이는지만 따로 본다.
test('g3s2u6.A1.T3 — 범례 단추(큰 그림 = 10상자, 5상자)가 보이고 정답 값 글자는 없다', async ({
  page,
}) => {
  test.slow();
  await openActivity(page, 'A1');
  await passA1T1(page);
  await passA1T2(page);
  await expect(page.getByRole('radio', { name: '큰 그림 = 10상자' })).toBeVisible();
  await expect(page.getByRole('radio', { name: '큰 그림 = 5상자' })).toBeVisible();
  await expectNoConclusionText(page);
  await passA1T3(page);
  await expect(page.getByTestId('graph-table')).toContainText('봄');
});
