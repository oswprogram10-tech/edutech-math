import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { PREVIEW_URL } from '../../../playwright.config';
import { expectContentPanelsReachable } from '../panel-layout';

/**
 * T180 g2s2u6 「규칙 찾기」 단원 E2E.
 * - A1(쌓기나무 성장 패턴 4과제)·A2(덧셈표·곱셈표 돋보기 탐정 4과제) 정답 통과, 과제마다 대표 오답 → 일반 ①
 * - 오개념 ①·②: A1.T3 5단계 개수 2 → GROWTH-TOTAL(growth-split), A2.T3 19 → ROW-COL(cell-diff). 본 캔버스와 1px 안에서 맞는다.
 * - 조작: 표 칸 포인터·키보드, E12 쌓기 포인터, 돋보기, 화살표
 * - 저학년 64px, 두 화면(A1.T2) 판 맞춤, 9×9 곱셈표가 스크롤로 닿음
 * - 학생 화면에 가린 칸 값·정답 개수·학년 표시가 없다. 첫 화면 스냅샷, 오프라인.
 */

test.describe.configure({ timeout: 300_000 });
test.use({ actionTimeout: 20_000 });

interface UnitTask {
  readonly id: string;
  readonly prompt: string;
  readonly config: Record<string, unknown>;
  readonly hints: readonly { readonly say?: string }[];
  readonly views?: readonly { readonly slot: string; readonly engine: string }[];
}
interface UnitContent {
  readonly activities: readonly { readonly id: string; readonly tasks: readonly UnitTask[] }[];
}

const content = JSON.parse(
  readFileSync(new URL('../../../data/content/g2s2u6.json', import.meta.url), 'utf-8'),
) as UnitContent;

test('콘텐츠 설정이 명세를 따른다(A1 4과제, A2 4과제, 정답·학년·보상 노출 없음)', () => {
  expect(content.activities.map((a) => a.id)).toEqual(['g2s2u6.A1', 'g2s2u6.A2']);
  const a1 = content.activities[0]?.tasks ?? [];
  const a2 = content.activities[1]?.tasks ?? [];
  expect(a1.map((t) => t.id)).toEqual([
    'g2s2u6.A1.T1',
    'g2s2u6.A1.T2',
    'g2s2u6.A1.T3',
    'g2s2u6.A1.T4',
  ]);
  expect(a2.map((t) => t.id)).toEqual([
    'g2s2u6.A2.T1',
    'g2s2u6.A2.T2',
    'g2s2u6.A2.T3',
    'g2s2u6.A2.T4',
  ]);
  expect(a1.map((t) => t.config['mode'])).toEqual(['growth', 'cubes', 'growth', 'growth']);
  expect(a2.map((t) => t.config['mode'])).toEqual(Array(4).fill('calc-pattern'));
  // 두 화면(A1.T2): 판정 화면(E12)이 첫 슬롯이다.
  expect(a1[1]?.views?.map((v) => `${v.slot}:${v.engine}`)).toEqual(['right:E12', 'left:E15']);
  expect(a1[0]?.config['table']).toEqual({ upTo: 3, counts: 'given', increments: 'blank' });
  expect(a2[1]?.config['magnifierUses']).toBe(3);
  expect(a2[2]?.config['size']).toEqual([9, 9]);
  expect(a2[3]?.config['hidden']).toEqual([]);

  for (const task of [...a1, ...a2]) {
    expect(task.hints.length).toBeGreaterThanOrEqual(3);
    const hintTexts = task.hints.map((hint) => hint.say ?? '');
    for (const text of hintTexts) {
      // 늘어난 수·예측 값·가린 칸 값·화살표 증가량·정답 방향을 말하지 않는다.
      expect(text).not.toMatch(/[2-9]개|\b7\b|\b9\b|[+] ?\d|[×x] ?\d|\b(12|19|20|30|40)\b|↙/);
      expect(text).not.toMatch(/정답|답은/);
    }
    for (const text of [task.prompt, ...hintTexts]) {
      expect(text).not.toMatch(/[1-6]학년/);
      expect(text).not.toMatch(/별|점수|랭킹|꾸미기/);
    }
    // 발문에는 늘어난 수·예측 값이 없다(A1.T4는 고르기 선택지 문장이라 예외).
    if (task.id.startsWith('g2s2u6.A1.') && task.id !== 'g2s2u6.A1.T4')
      expect(task.prompt).not.toMatch(/[2-9]개|\b[79]\b/);
  }
});

function slot(page: Page, name: string): Locator {
  return page.getByTestId(`runner-slot-${name}`);
}

function main(page: Page): Locator {
  return slot(page, 'main');
}

function field(page: Page, id: string): Locator {
  return slot(page, 'response').locator(`[data-response-field="${id}"]`);
}

const TITLES = { A1: '쌓기나무 성장 패턴', A2: '덧셈표·곱셈표 돋보기 탐정' } as const;

async function openActivity(page: Page, activity: 'A1' | 'A2'): Promise<void> {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  // E12 쌓기 포인터 조작은 등각 그림(2D)에서 한다. 3D 그림은 키보드로 쌓는다.
  await page.addInitScript(() => {
    window.localStorage.setItem('mathexplorer.e12.renderer.v1', 'isometric');
  });
  await page.goto('/');
  await page.getByRole('button', { name: '1번', exact: true }).click();
  await page.getByRole('button', { name: '건너뛰기' }).click();
  await expect(page).toHaveURL(/#\/map$/);
  await page.goto(`/#/activity/g2s2u6.${activity}`);
  await expect(page.getByRole('heading', { name: TITLES[activity] })).toBeVisible();
  await expect(page.getByRole('button', { name: '확인하기' })).toBeVisible();
}

async function submit(page: Page): Promise<void> {
  await page.getByRole('button', { name: '확인하기' }).click();
}

async function expectFailedWithHint(page: Page, text: string, level: 1 | 2 | 3 = 1): Promise<void> {
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByTestId('hint')).toHaveAttribute('data-hint-level', String(level));
  if (text !== '') await expect(page.getByTestId('hint-text')).toContainText(text);
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

async function expectNoGrade(page: Page): Promise<void> {
  const text = (await page.locator('body').textContent()) ?? '';
  expect(text).not.toMatch(/[1-6]학년/);
}

/** 오버레이가 본 캔버스 svg와 1px 안으로 겹친다. */
async function expectOverlayAligned(
  page: Page,
  overlay: string,
  canvasTestId: string,
): Promise<Locator> {
  const layer = main(page).locator(`[data-overlay="${overlay}"]`);
  await expect(layer).toBeVisible();
  const canvas = main(page).getByTestId(canvasTestId);
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
  await expect(layer.locator('svg')).toHaveCount(1);
  return layer;
}

async function expectMin(locator: Locator, min: number, label: string): Promise<void> {
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  expect(box, label).not.toBeNull();
  if (!box) return;
  expect(box.width, `${label} 너비`).toBeGreaterThanOrEqual(min - 0.5);
  expect(box.height, `${label} 높이`).toBeGreaterThanOrEqual(min - 0.5);
}

// ---------------------------------------------------------------- 조작 도우미

function growthCell(page: Page, key: string): Locator {
  return main(page).locator(`[data-testid="growth-table"] [data-cell="${key}"]`);
}

function growthPad(page: Page, name: string): Locator {
  return main(page).getByTestId('growth-pad').getByRole('button', { name, exact: true });
}

async function writeGrowth(page: Page, key: string, digits: string): Promise<void> {
  await growthCell(page, key).click();
  for (const digit of digits) await growthPad(page, digit).click();
}

async function clearGrowth(page: Page, key: string, count: number): Promise<void> {
  await growthCell(page, key).click();
  for (let i = 0; i < count; i += 1) await growthPad(page, '지우기').click();
}

function tableCell(page: Page, key: string): Locator {
  return main(page).locator(`[data-testid="calc-table-canvas"] [data-cell="${key}"]`);
}

function tablePad(page: Page, name: string): Locator {
  return main(page).getByTestId('table-pad').getByRole('button', { name, exact: true });
}

async function writeTable(page: Page, key: string, digits: string): Promise<void> {
  await tableCell(page, key).scrollIntoViewIfNeeded();
  await tableCell(page, key).click();
  for (const digit of digits) {
    await tablePad(page, digit).scrollIntoViewIfNeeded();
    await tablePad(page, digit).click();
  }
}

async function clearTable(page: Page, key: string, count: number): Promise<void> {
  await tableCell(page, key).scrollIntoViewIfNeeded();
  await tableCell(page, key).click();
  for (let i = 0; i < count; i += 1) {
    await tablePad(page, '지우기').scrollIntoViewIfNeeded();
    await tablePad(page, '지우기').click();
  }
}

function cubeColumn(page: Page, x: number): Locator {
  return slot(page, 'right').locator(`[data-col="${x},0"]`);
}

/** E12 4단계: 가로 4개 + 왼쪽 끝 위로 3개(7개). 포인터로 칸을 누를 때마다 한 개가 쌓인다. */
async function buildL4(page: Page): Promise<void> {
  for (let i = 0; i < 4; i += 1) await cubeColumn(page, 0).click();
  for (const x of [1, 2, 3]) await cubeColumn(page, x).click();
}

// 과제별 통과 도우미
async function passA1T1(page: Page): Promise<void> {
  await writeGrowth(page, '2.inc', '2');
  await writeGrowth(page, '3.inc', '2');
  await submit(page);
  await expectPassed(page);
}
async function passA1T2(page: Page): Promise<void> {
  await buildL4(page);
  await submit(page);
  await expectPassed(page);
}
async function passA1T3(page: Page): Promise<void> {
  await writeGrowth(page, '4.count', '7');
  await writeGrowth(page, '5.count', '9');
  await submit(page);
  await expectPassed(page);
}
async function passA2T1(page: Page): Promise<void> {
  await writeTable(page, '2.3', '7');
  await writeTable(page, '4.1', '7');
  await writeTable(page, '5.5', '12');
  await submit(page);
  await expectPassed(page);
}
async function drawArrow(page: Page, amount: string): Promise<void> {
  await page.getByRole('button', { name: '화살표', exact: true }).click();
  await tableCell(page, '1.1').click();
  await page.getByRole('button', { name: '↘ 오른쪽 아래' }).click();
  await tablePad(page, amount).click();
  await page.getByTestId('table-arrow-commit').click();
}
async function passA2T2(page: Page): Promise<void> {
  await drawArrow(page, '2');
  await submit(page);
  await expectPassed(page);
}
async function fillA2T3(page: Page): Promise<void> {
  await writeTable(page, '4.3', '20');
  await writeTable(page, '4.5', '30');
  await writeTable(page, '4.7', '40');
}

// ---------------------------------------------------------------- A1

test('g2s2u6.A1 — 4과제 흐름: 표 칸 포인터·패드, 두 화면 쌓기, 과제마다 일반 ①', async ({
  page,
}) => {
  test.slow();
  await openActivity(page, 'A1');
  await expectNoGrade(page);
  await expectContentPanelsReachable(page);
  // 빈칸에 정답이 없다.
  await expect(growthCell(page, '2.inc')).not.toContainText(/\d/);
  await expect(growthCell(page, '3.inc')).not.toContainText(/\d/);
  await screenshot(page, 'g2s2u6-a1-t1.png');

  // T1: 틀린 수 → 일반 ① → 통과
  await writeGrowth(page, '2.inc', '3');
  await writeGrowth(page, '3.inc', '3');
  await submit(page);
  await expectFailedWithHint(page, '1단계에서 2단계로 갈 때 새로 생긴 쌓기나무를 세어 봐요.', 1);
  await clearGrowth(page, '2.inc', 1);
  await writeGrowth(page, '2.inc', '2');
  await clearGrowth(page, '3.inc', 1);
  await writeGrowth(page, '3.inc', '2');
  await submit(page);
  await expectPassed(page);

  // T2: 두 화면(왼쪽 growth, 오른쪽 cubes). 아무것도 안 쌓고 확인 → 일반 ① → 쌓기
  await expect(slot(page, 'left').getByTestId('growth-canvas')).toBeVisible();
  await expect(slot(page, 'right').getByTestId('cubes-canvas')).toBeVisible();
  await expectContentPanelsReachable(page);
  await screenshot(page, 'g2s2u6-a1-t2.png');
  await submit(page);
  await expectFailedWithHint(page, '3단계 모양에서 어디에 몇 개를 더 놓았는지 살펴봐요.', 1);
  await passA1T2(page);

  // T3: 6 → 일반 ① → 9와 7
  await writeGrowth(page, '5.count', '6');
  await submit(page);
  await expectFailedWithHint(page, '한 단계 갈 때마다 몇 개씩 늘었는지 표에서 찾아봐요.', 1);
  await clearGrowth(page, '5.count', 1);
  await passA1T3(page);

  // T4: 나 → 일반 ① → 가
  await field(page, 'rule').getByRole('button', { name: '나', exact: true }).click();
  await submit(page);
  await expectFailedWithHint(page, '1단계, 2단계, 3단계 모양을 차례로 견주어 봐요.', 1);
  await field(page, 'rule').getByRole('button', { name: '가', exact: true }).click();
  await submit(page);
  await expectPassed(page, true);
});

test('g2s2u6.A1.T2 — 두 화면이 판 안에 들어가고 포인터로 쌓는다', async ({ page }) => {
  test.slow();
  await openActivity(page, 'A1');
  await passA1T1(page);
  for (const [name, id] of [
    ['left', 'growth-canvas'],
    ['right', 'cubes-canvas'],
  ] as const) {
    const panel = slot(page, name);
    const canvas = panel.getByTestId(id);
    await canvas.scrollIntoViewIfNeeded();
    const outer = await panel.boundingBox();
    const inner = await canvas.boundingBox();
    expect(outer, name).not.toBeNull();
    expect(inner, name).not.toBeNull();
    if (!outer || !inner) continue;
    expect(inner.width, `${name} 너비`).toBeGreaterThan(80);
    expect(inner.height, `${name} 높이`).toBeGreaterThan(60);
    expect(inner.x, `${name} 왼쪽`).toBeGreaterThanOrEqual(outer.x - 1);
    expect(inner.x + inner.width, `${name} 오른쪽`).toBeLessThanOrEqual(outer.x + outer.width + 1);
  }
  // 세로 4개만 쌓고 확인하면 모자라다. 이어서 가로 3칸을 채우면 통과한다.
  for (let i = 0; i < 4; i += 1) await cubeColumn(page, 0).click();
  await submit(page);
  await expect(page.getByRole('alert')).toBeVisible();
  for (const x of [1, 2, 3]) await cubeColumn(page, x).click();
  await submit(page);
  await expectPassed(page);
});

test('g2s2u6.A1.T3 — 5단계 개수에 2: GROWTH-TOTAL ① → ② growth-split 정렬', async ({ page }) => {
  test.slow();
  await openActivity(page, 'A1');
  await passA1T1(page);
  await passA1T2(page);
  // 쌓지 않은 단계의 개수 칸에 정답이 없다.
  await expect(growthCell(page, '4.count')).not.toContainText(/\d/);
  await expect(growthCell(page, '5.count')).not.toContainText(/\d/);
  await writeGrowth(page, '5.count', '2');
  await submit(page);
  await expectFailedWithHint(page, '새로 놓은 것만 셀까, 전체를 셀까?', 1);
  await submit(page);
  await expectFailedWithHint(page, '회색으로 덮었어요', 2);
  const layer = await expectOverlayAligned(page, 'growth-split', 'growth-canvas');
  await expect(layer.locator('[data-testid="growth-split-panel"]')).toHaveCount(3);
  await clearGrowth(page, '5.count', 1);
  await passA1T3(page);
});

test('g2s2u6.A1.T1 — 키보드만으로 표 칸을 옮기고 숫자를 쓴다', async ({ page }) => {
  test.slow();
  await openActivity(page, 'A1');
  await growthCell(page, '2.inc').focus();
  await page.keyboard.press('2');
  await page.keyboard.press('ArrowRight');
  await expect(growthCell(page, '3.inc')).toBeFocused();
  await page.keyboard.press('2');
  await submit(page);
  await expectPassed(page);
});

// ---------------------------------------------------------------- A2

test('g2s2u6.A2 — 4과제 흐름: 가린 칸 쓰기, 돋보기, 화살표, 방향 고르기, 과제마다 일반 ①', async ({
  page,
}) => {
  test.slow();
  await openActivity(page, 'A2');
  await expectNoGrade(page);
  await expectContentPanelsReachable(page);
  // 가린 칸은 ?로만 보이고 값은 DOM에 없다.
  for (const key of ['2.3', '4.1', '5.5']) {
    await expect(page.locator(`[data-cell-text="${key}"]`)).toHaveText('?');
  }
  await screenshot(page, 'g2s2u6-a2-t1.png');

  // T1: 틀린 수 → 일반 ① → 통과
  await writeTable(page, '2.3', '6');
  await submit(page);
  await expectFailedWithHint(page, '오른쪽으로 한 칸, 아래로 한 칸 갈 때 수가 어떻게 변해요?', 1);
  await clearTable(page, '2.3', 1);
  await passA2T1(page);

  // T2: 돋보기 한 번, 틀린 증가량 → 일반 ① → 통과
  await page.getByRole('button', { name: '돋보기 (남은 3번)' }).click();
  await tableCell(page, '1.1').click();
  await expect(page.locator('[data-cell-text="1.1"]')).not.toHaveText('?');
  await expect(page.getByRole('button', { name: '돋보기 (남은 2번)' })).toBeVisible();
  await drawArrow(page, '3');
  await submit(page);
  await expectFailedWithHint(
    page,
    '↘ 방향으로 한 칸 갈 때 얼마가 커지는지 돋보기로 확인해 봐요.',
    1,
  );
  await page.getByTestId('table-arrow-list').getByRole('button').first().click();
  await drawArrow(page, '2');
  await submit(page);
  await expectPassed(page);

  // T3: 9×9. 아무것도 안 쓰고 확인 → 일반 ① → 5단 줄 세 칸
  await submit(page);
  await expectFailedWithHint(page, '5단 줄에서 오른쪽으로 한 칸 가면 얼마씩 커져요?', 1);
  await fillA2T3(page);
  await submit(page);
  await expectPassed(page);

  // T4: 가 → 일반 ① → 나
  await field(page, 'dir').getByRole('button', { name: '가', exact: true }).click();
  await submit(page);
  await expectFailedWithHint(page, '수가 같은 칸을 두세 개 찾아서', 1);
  await field(page, 'dir').getByRole('button', { name: '나', exact: true }).click();
  await submit(page);
  await expectPassed(page, true);
});

test('g2s2u6.A2.T3 — 5단 칸에 19: ROW-COL ① → ② cell-diff 정렬', async ({ page }) => {
  test.slow();
  await openActivity(page, 'A2');
  await passA2T1(page);
  await passA2T2(page);
  await writeTable(page, '4.3', '19');
  await submit(page);
  await expectFailedWithHint(page, '옆 칸과 아래 칸은 얼마씩 차이 나요?', 1);
  await submit(page);
  await expectFailedWithHint(page, '표 위에 그렸어요', 2);
  const layer = await expectOverlayAligned(page, 'cell-diff', 'calc-table-canvas');
  await expect(layer.getByTestId('cell-diff-row-label')).toBeVisible();
  await expect(layer.getByTestId('cell-diff-col-label')).toBeVisible();
  // 가린 칸 값(20)과 학생이 쓴 수(19)는 오버레이에 없다.
  await expect(layer).not.toContainText('20');
  await expect(layer).not.toContainText('19');
  await clearTable(page, '4.3', 2);
  await fillA2T3(page);
  await submit(page);
  await expectPassed(page);
});

test('g2s2u6.A2 — 키보드만으로 쓰기·돋보기·화살표를 한다', async ({ page }) => {
  test.slow();
  await openActivity(page, 'A2');
  // T1: 칸에 초점을 두고 숫자 키로 쓰기
  await tableCell(page, '2.3').focus();
  await page.keyboard.press('7');
  await tableCell(page, '4.1').focus();
  await page.keyboard.press('7');
  await tableCell(page, '5.5').focus();
  await page.keyboard.press('1');
  await page.keyboard.press('2');
  await submit(page);
  await expectPassed(page);
  // T2: M 돋보기, A 화살표
  await tableCell(page, '1.1').focus();
  await page.keyboard.press('m');
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-cell-text="1.1"]')).not.toHaveText('?');
  await page.keyboard.press('a');
  await tableCell(page, '1.1').focus();
  await page.keyboard.press('Enter');
  await page.keyboard.press('3');
  await page.keyboard.press('2');
  await page.keyboard.press('Enter');
  await submit(page);
  await expectPassed(page);
});

test('g2s2u6.A2 — 표 칸·패드·도구 단추는 저학년 64px 이상이고 9×9 표도 맨 아래까지 닿는다', async ({
  page,
}) => {
  test.slow();
  await openActivity(page, 'A2');
  await expectMin(tableCell(page, '4.4'), 64, '덧셈표 칸');
  await expectMin(tablePad(page, '5'), 64, '패드');
  await passA2T1(page);
  await expectMin(main(page).getByTestId('table-tool-magnifier'), 64, '돋보기 도구');
  await expectMin(main(page).getByTestId('table-tool-arrow'), 64, '화살표 도구');
  await passA2T2(page);
  // T3 9×9: 칸이 줄지 않고 스크롤로 닿는다.
  await expectMin(tableCell(page, '4.4'), 64, '곱셈표 칸');
  const last = tableCell(page, '8.8');
  await last.scrollIntoViewIfNeeded();
  await expect(last).toBeInViewport();
  await expectMin(tablePad(page, '5'), 64, '곱셈표 패드');
  const clearAll = tablePad(page, '모두 지우기');
  await clearAll.scrollIntoViewIfNeeded();
  await expect(clearAll).toBeInViewport();
});

// ---------------------------------------------------------------- 오프라인

test('오프라인에서도 g2s2u6.A1 활동이 열린다', async ({ page, context }) => {
  await page.goto(PREVIEW_URL);
  await page.getByRole('button', { name: '1번', exact: true }).click();
  await page.getByRole('button', { name: '건너뛰기' }).click();
  await expect(page).toHaveURL(/#\/map$/);
  await page.goto(`${PREVIEW_URL}/#/activity/g2s2u6.A1`);
  await expect(page.getByRole('heading', { name: TITLES.A1 })).toBeVisible();

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
  await expect(page.getByRole('heading', { name: TITLES.A1 })).toBeVisible();
  await expect(page.getByRole('button', { name: '확인하기' })).toBeVisible();
});
