import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { PREVIEW_URL } from '../../../playwright.config';
import {
  expectChromeBookCanvasSize,
  expectContentPanelsReachable,
  expectFitCanvasVisible,
} from '../panel-layout';

/**
 * T198 g6s2u4 「비례식과 비례배분」 단원 E2E.
 * A1(E06 proportion 격자 저울) 6과제, A2(E20 bar-model 문장제 막대 모델) 6과제를 끝까지 해 본다.
 * 과제마다 대표 오답 → 힌트 ① → 고쳐서 통과 순서이고, 오개념 셋(ADDITIVE·CROSS-WRONG·DIVIDE)은 ②까지 가서
 * 오버레이가 본 캔버스와 1px 안에 겹치는지 본다.
 */

test.describe.configure({ timeout: 300_000 });

const A1_TITLE = '외항·내항 격자 넓이 동치 저울';
const A2_TITLE = '문장제 형광펜과 막대 모델';

function slot(page: Page, name: string): Locator {
  return page.getByTestId(`runner-slot-${name}`);
}

function main(page: Page): Locator {
  return slot(page, 'main');
}

async function startApp(page: Page, base = ''): Promise<void> {
  await page.goto(`${base}/`);
  await page.getByRole('button', { name: '1번', exact: true }).click();
  await page.getByRole('button', { name: '건너뛰기' }).click();
  await expect(page).toHaveURL(/#\/map$/);
}

async function openActivity(page: Page, id: 'A1' | 'A2'): Promise<void> {
  await startApp(page);
  await page.goto(`/#/activity/g6s2u4.${id}`);
  await expect(
    page.getByRole('heading', { name: id === 'A1' ? A1_TITLE : A2_TITLE }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: '확인하기' })).toBeVisible();
}

async function submit(page: Page): Promise<void> {
  await page.getByRole('button', { name: '확인하기' }).click();
}

async function expectFailedWithHint(page: Page, text: string, level = 1): Promise<void> {
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByTestId('hint')).toHaveAttribute('data-hint-level', String(level));
  await expect(page.getByTestId('hint-text')).toContainText(text);
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
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
  await expect(page).toHaveScreenshot(name, {
    maxDiffPixelRatio: 0.02,
    animations: 'disabled',
    fullPage: true,
  });
}

/** 힌트 ② 오버레이가 엔진의 본 캔버스 svg와 같은 자리·크기에 놓였는지 확인한다(1px). */
async function expectOverlayOverCanvas(
  panel: Locator,
  overlayName: string,
  canvasTestId: string,
): Promise<void> {
  const overlay = panel.locator(`[data-overlay="${overlayName}"]`);
  await expect(overlay).toBeVisible();
  const board = panel.getByTestId(canvasTestId);
  await expect
    .poll(async () => {
      const overlayBox = await overlay.locator('svg').boundingBox();
      const canvasBox = await board.boundingBox();
      if (!overlayBox || !canvasBox) return Number.POSITIVE_INFINITY;
      return Math.max(
        Math.abs(overlayBox.x - canvasBox.x),
        Math.abs(overlayBox.y - canvasBox.y),
        Math.abs(overlayBox.width - canvasBox.width),
        Math.abs(overlayBox.height - canvasBox.height),
      );
    })
    .toBeLessThanOrEqual(1);
  await expect(overlay.locator('svg')).toHaveCount(1);
}

// ───────────── 응답 칸(A1) ─────────────

function field(page: Page, id: string): Locator {
  return slot(page, 'response').locator(`[data-response-field="${id}"]`);
}

async function choose(page: Page, id: string, label: string): Promise<void> {
  await field(page, id).getByRole('button', { name: label, exact: true }).click();
}

async function typeDigits(page: Page, value: string): Promise<void> {
  for (const key of value) await page.keyboard.press(key);
}

/** 자연수 칸에 쓴다(자연수 틀 단추가 있으면 누른다). */
async function typeInteger(page: Page, id: string, value: string): Promise<void> {
  const box = field(page, id);
  const integerButton = box.getByRole('button', { name: '자연수', exact: true });
  if ((await integerButton.count()) > 0) await integerButton.click();
  await box.locator('[data-part="whole"]').click();
  for (let index = 0; index < 6; index += 1) await page.keyboard.press('Backspace');
  await typeDigits(page, value);
}

// ───────────── E06 proportion ─────────────

function balance(page: Page): Locator {
  return main(page).getByTestId('balance-canvas');
}

/** 슬라이더에 초점을 두고 → 키로 값을 맞춘다(처음 한 칸은 최솟값에서 시작). */
async function setSlider(page: Page, target: number): Promise<void> {
  const slider = main(page).getByTestId('proportion-slider');
  await slider.scrollIntoViewIfNeeded();
  await slider.focus();
  await page.keyboard.press('Home');
  for (let step = 1; step < target; step += 1) await page.keyboard.press('ArrowRight');
  await expect(slider).toHaveAttribute('aria-valuenow', String(target));
}

async function pickPair(page: Page, a: number, b: number): Promise<void> {
  await main(page).getByTestId(`term-${a}`).scrollIntoViewIfNeeded();
  await main(page).getByTestId(`term-${a}`).click();
  await main(page).getByTestId(`term-${b}`).click();
}

async function pickCard(page: Page, index: number): Promise<void> {
  await main(page).getByTestId(`card-${index}`).scrollIntoViewIfNeeded();
  await main(page).getByTestId(`card-${index}`).click();
}

async function solveA1T1(page: Page): Promise<void> {
  await pickCard(page, 0);
  await choose(page, 'prop', '가');
  await submit(page);
  await expectPassed(page);
}

async function solveA1T2(page: Page): Promise<void> {
  await setSlider(page, 12);
  await submit(page);
  await expectPassed(page);
}

async function solveRatio(page: Page, a: string, b: string): Promise<void> {
  await typeInteger(page, 'a', a);
  await typeInteger(page, 'b', b);
  await submit(page);
  await expectPassed(page);
}

// ───────────── E20 bar-model ─────────────

function ratioCanvas(page: Page): Locator {
  return main(page).getByTestId('ratio-canvas');
}

function tokenButton(page: Page, index: number): Locator {
  return main(page).locator(`[data-token-index="${index}"]`);
}

function tool(page: Page, name: string): Locator {
  return main(page).getByRole('button', { name, exact: true });
}

function input(page: Page, label: string): Locator {
  return main(page).getByLabel(label, { exact: true });
}

/** 사탕 문장(T1~T3·T6) 토큰 번호: 사탕0 35(1) 개를2 형과3 동생이4 3(5) :(6) 4(7) … */
const CANDY = { total: 1, three: 5, four: 7 } as const;
/** 끈 문장(T4) 토큰 번호: 길이가0 48(1) cm인2 끈을3 5(4) :(5) 3(6) … */
const ROPE = { total: 1, five: 4, three: 6 } as const;

async function paint(
  page: Page,
  totalIndex: number,
  ratioIndexes: readonly number[],
): Promise<void> {
  await tool(page, '전체 칠하기').click();
  await tokenButton(page, totalIndex).click();
  await tool(page, '비 칠하기').click();
  for (const index of ratioIndexes) await tokenButton(page, index).click();
}

async function solveA2T1(page: Page): Promise<void> {
  await paint(page, CANDY.total, [CANDY.three, CANDY.four]);
  await submit(page);
  await expectPassed(page);
}

async function solveA2T2(page: Page): Promise<void> {
  await input(page, '한 칸 크기').fill('5');
  await submit(page);
  await expectPassed(page);
}

async function solveA2T3(page: Page): Promise<void> {
  await input(page, '형 몫').fill('15');
  await input(page, '동생 몫').fill('20');
  await submit(page);
  await expectPassed(page);
}

async function solveA2T4(page: Page): Promise<void> {
  await paint(page, ROPE.total, [ROPE.five, ROPE.three]);
  await input(page, '가 몫').fill('30');
  await input(page, '나 몫').fill('18');
  await submit(page);
  await expectPassed(page);
}

async function solveA2T5(page: Page): Promise<void> {
  await input(page, '전체').fill('64');
  await submit(page);
  await expectPassed(page);
}

// ───────────── 첫 화면·정답 노출 ─────────────

test('A1 첫 화면(T1 카드 고르기)에 판·응답 칸이 보이고 학년 표시가 없다', async ({
  page,
}, info) => {
  await openActivity(page, 'A1');
  await expect(main(page)).toBeVisible();
  await expectContentPanelsReachable(page);
  const boxes = await expectFitCanvasVisible(page);
  if (info.project.name === 'chromebook') expectChromeBookCanvasSize(boxes);
  await expect(page.locator('body')).not.toContainText(/[1-6]\s*학년/);
});

test('A1.T2 첫 화면: 기울기 모르는 저울, 정답(12)이 화면 어디에도 없다', async ({ page }) => {
  await openActivity(page, 'A1');
  await solveA1T1(page);
  await expect(main(page).getByTestId('proportion-slider')).toBeVisible();
  await expect(balance(page)).toHaveAttribute('data-tilt', 'unknown');
  const text = await page.locator('body').innerText();
  const html = (await main(page).innerHTML()).replace(/<[^>]*>/g, ' ');
  for (const source of [text, html]) {
    expect(source).not.toMatch(/(^|[^0-9])12([^0-9]|$)/);
  }
  await expect(page.locator('body')).not.toContainText(/[1-6]\s*학년/);
  await screenshot(page, 'g6s2u4-a1-t2.png');
});

test('A2.T1 첫 화면: 문장과 흐린 막대, 한 칸 크기·몫 정답이 화면 어디에도 없다', async ({
  page,
}) => {
  await openActivity(page, 'A2');
  await expect(ratioCanvas(page)).toHaveAttribute('data-open', 'false');
  await expect(page.locator('body')).not.toContainText(/[1-6]\s*학년/);
  const board = (await main(page).getByTestId('ratio-board').innerHTML()).replace(/<[^>]*>/g, ' ');
  const sentence = (await main(page).getByTestId('bar-sentence').textContent()) ?? '';
  const fields = await main(page)
    .locator('input')
    .evaluateAll((list) => list.map((el) => (el as HTMLInputElement).value).join(' '));
  for (const source of [board, sentence, fields]) {
    expect(source).not.toMatch(/(^|[^0-9])(5|15|20)([^0-9]|$)/);
  }
  await screenshot(page, 'g6s2u4-a2-t1.png');
});

test('발문·힌트에 과제 답이 없다(콘텐츠 검사)', () => {
  const content = JSON.parse(readFileSync('data/content/g6s2u4.json', 'utf8')) as ContentFile;
  const forbidden: Record<string, readonly RegExp[]> = {
    'g6s2u4.A1.T2': [/(^|[^0-9])12([^0-9]|$)/],
    'g6s2u4.A1.T4': [/1\s*:\s*3/],
    'g6s2u4.A1.T5': [/3\s*:\s*2/],
    'g6s2u4.A1.T6': [/(^|[^0-9])9([^0-9]|$)/],
    'g6s2u4.A2.T2': [/(^|[^0-9])5([^0-9]|$)/],
    'g6s2u4.A2.T3': [/(^|[^0-9])(15|20)([^0-9]|$)/],
    'g6s2u4.A2.T4': [/(^|[^0-9])(30|18)([^0-9]|$)/],
    'g6s2u4.A2.T5': [/(^|[^0-9])64([^0-9]|$)/],
    'g6s2u4.A2.T6': [/(^|[^0-9])15([^0-9]|$)/],
  };
  let checked = 0;
  for (const activity of content.activities) {
    for (const task of activity.tasks) {
      const patterns = forbidden[task.id] ?? [];
      const texts = [task.prompt, ...task.hints.flatMap((hint) => (hint.say ? [hint.say] : []))];
      for (const text of texts) {
        for (const pattern of patterns) {
          expect(text, `${task.id}: ${text}`).not.toMatch(pattern);
        }
        expect(text, task.id).not.toMatch(/[1-6]\s*학년/);
        checked += 1;
      }
    }
  }
  expect(checked).toBeGreaterThan(40);
});

interface ContentFile {
  readonly activities: readonly {
    readonly tasks: readonly {
      readonly id: string;
      readonly prompt: string;
      readonly hints: readonly { readonly say?: string }[];
    }[];
  }[];
}

// ───────────── A1 흐름 ─────────────

test('A1 외항·내항 격자 저울 — 6과제를 대표 오답 → 힌트 → 통과로 끝까지', async ({
  page,
}, info) => {
  await openActivity(page, 'A1');
  await expectContentPanelsReachable(page);
  const boxes = await expectFitCanvasVisible(page);
  if (info.project.name === 'chromebook') expectChromeBookCanvasSize(boxes);

  // T1 — 카드 올려 보고 나 고르기 → 일반 ①(차를 지킨 카드), 가로 고쳐 통과.
  await pickCard(page, 1);
  await expect(balance(page)).toHaveAttribute('data-tilt', 'right');
  await choose(page, 'prop', '나');
  await submit(page);
  await expectFailedWithHint(page, '뒤의 수도 똑같이 그 배가 되었는지', 1);
  await pickCard(page, 0);
  await expect(balance(page)).toHaveAttribute('data-tilt', 'level');
  await choose(page, 'prop', '가');
  await submit(page);
  await expectPassed(page);

  // T2 — 11은 일반 ①, 18은 ADDITIVE ①·② big-tilt(1px), 12로 통과.
  await setSlider(page, 11);
  await expect(balance(page)).toHaveAttribute('data-tilt', 'left');
  await submit(page);
  await expectFailedWithHint(page, '뒤의 수가 몇 배가 되었는지', 1);
  await setSlider(page, 18);
  await submit(page);
  await expectFailedWithHint(page, '넣어 본 값으로 만든 두 접시의 넓이를 견주어 봐요.', 2);
  await expectOverlayOverCanvas(main(page), 'big-tilt', 'balance-canvas');
  await setSlider(page, 12);
  await expect(balance(page)).toHaveAttribute('data-tilt', 'level');
  await submit(page);
  await expectPassed(page);

  // T3 — 어긋난 짝({첫째, 셋째}) → CROSS-WRONG ①·② cross-brackets(1px), 외항 짝으로 통과.
  await pickPair(page, 0, 2);
  await expect(balance(page)).toHaveAttribute('data-tilt', 'right');
  await submit(page);
  await expectFailedWithHint(page, '바깥쪽 두 수, 안쪽 두 수는 어느 것이었지?', 1);
  await submit(page);
  await expectFailedWithHint(page, '서로 다른 괄호로 묶어 짝지어 봐요.', 2);
  await expectOverlayOverCanvas(main(page), 'cross-brackets', 'balance-canvas');
  await pickPair(page, 0, 3);
  await expect(balance(page)).toHaveAttribute('data-tilt', 'level');
  await submit(page);
  await expectPassed(page);

  // T4 — 안 줄인 4 : 12 → 일반 ①, 1 : 3으로 통과(응답만 있는 과제라 판이 없다).
  await expect(main(page).getByTestId('balance-canvas')).toHaveCount(0);
  await typeInteger(page, 'a', '4');
  await typeInteger(page, 'b', '12');
  await submit(page);
  await expectFailedWithHint(
    page,
    '전항과 후항에 같은 수를 곱하거나 나누면 비율은 어떻게 될까요?',
    1,
  );
  await submit(page);
  await expectFailedWithHint(page, '소수 한 자리인 두 수에 같은 수를 곱하면', 2);
  await solveRatio(page, '1', '3');

  // T5 — 2 : 3 → 일반 ①, 3 : 2로 통과.
  await typeInteger(page, 'a', '2');
  await typeInteger(page, 'b', '3');
  await submit(page);
  await expectFailedWithHint(page, '전항과 후항에 같은 수를 곱했나요?', 1);
  await solveRatio(page, '3', '2');

  // T6 — 13(차 보존) → ADDITIVE ①·② (symbols라 말만), 9로 통과.
  await expect(balance(page)).toHaveAttribute('data-look', 'symbols');
  await setSlider(page, 13);
  await submit(page);
  await expectFailedWithHint(page, '7이 21이 되려면 몇 배가 되었지?', 1);
  await submit(page);
  await expectFailedWithHint(page, '몇 배가 되었는지로 생각해 봐요.', 2);
  await expect(main(page).locator('[data-overlay]')).toHaveCount(0);
  await setSlider(page, 9);
  await submit(page);
  await expectPassed(page, true);
});

test('A1.T1 다 카드 오답도 일반 ①, 저울에 올리지 않고 고른 가 오답은 없다', async ({ page }) => {
  await openActivity(page, 'A1');
  await pickCard(page, 2);
  await choose(page, 'prop', '다');
  await submit(page);
  await expectFailedWithHint(page, '앞의 수가 몇 배가 되었는지', 1);
});

test('A1.T3 짝을 고르지 않고 확인하면 일반 ①', async ({ page }) => {
  await openActivity(page, 'A1');
  await solveA1T1(page);
  await solveA1T2(page);
  await submit(page);
  await expectFailedWithHint(page, '직사각형의 가로와 세로가 될 두 수를 골랐나요?', 1);
  await submit(page);
  await expectFailedWithHint(page, '이름을 떠올려 봐요.', 2);
  await pickPair(page, 1, 2);
  await expect(balance(page)).toHaveAttribute('data-tilt', 'level');
  await submit(page);
  await expectPassed(page);
});

test('A1.T2 키보드만으로 푼다(슬라이더 ←→, Tab, Enter)', async ({ page }) => {
  await openActivity(page, 'A1');
  await solveA1T1(page);
  const slider = main(page).getByTestId('proportion-slider');
  await slider.focus();
  for (let step = 0; step < 12; step += 1) await page.keyboard.press('ArrowRight');
  await expect(slider).toHaveAttribute('aria-valuenow', '12');
  await page.keyboard.press('ArrowLeft');
  await expect(balance(page)).toHaveAttribute('data-tilt', 'left');
  await page.keyboard.press('ArrowRight');
  await expect(balance(page)).toHaveAttribute('data-tilt', 'level');
  await page.getByRole('button', { name: '확인하기' }).focus();
  await page.keyboard.press('Enter');
  await expectPassed(page);
  await expect(page.getByRole('heading', { name: A1_TITLE })).toBeVisible();
  await expect(main(page).getByTestId('term-0')).toBeVisible();
});

// ───────────── A2 흐름 ─────────────

test('A2 문장제 막대 모델 — 6과제를 대표 오답 → 힌트 → 통과로 끝까지', async ({ page }, info) => {
  await openActivity(page, 'A2');
  await expectContentPanelsReachable(page);
  const boxes = await expectFitCanvasVisible(page);
  if (info.project.name === 'chromebook') expectChromeBookCanvasSize(boxes);

  // T1 — 전체만 칠하고 확인 → 형광펜 일반 ①, 비도 칠해 통과.
  await tool(page, '전체 칠하기').click();
  await tokenButton(page, CANDY.total).click();
  await submit(page);
  await expectFailedWithHint(page, '전체를 나타내는 수와 나누는 비를 찾아봐요.', 1);
  await tool(page, '비 칠하기').click();
  await tokenButton(page, CANDY.three).click();
  await tokenButton(page, CANDY.four).click();
  await submit(page);
  await expectPassed(page);

  // T2 — 한 칸 11 → DIVIDE ①·② unit-count(1px), 5로 통과.
  await expect(ratioCanvas(page)).toHaveAttribute('data-open', 'true');
  await input(page, '한 칸 크기').fill('11');
  await submit(page);
  await expectFailedWithHint(page, '형과 동생 몫을 합치면 35가 될까?', 1);
  await submit(page);
  await expectFailedWithHint(page, '전체가 모두 몇 칸인지 확인해 봐요.', 2);
  await expectOverlayOverCanvas(main(page), 'unit-count', 'ratio-canvas');
  await solveA2T2(page);

  // T3 — 10 · 25(합은 맞는 오답) → 일반 ①, ② share-bracket(1px), 15 · 20으로 통과.
  await input(page, '형 몫').fill('10');
  await input(page, '동생 몫').fill('25');
  await submit(page);
  await expectFailedWithHint(page, '가진 칸 수를 곱해 봐요.', 1);
  await submit(page);
  await expectFailedWithHint(page, '한 칸의 몇 배인지 묶어서 생각해 봐요.', 2);
  await expectOverlayOverCanvas(main(page), 'share-bracket', 'ratio-canvas');
  await solveA2T3(page);

  // T4 — 형광펜을 칠하고 합이 안 맞는 몫(20 · 20) → DIVIDE ①, 합만 맞는 몫 → 일반 ②, 바르게 고쳐 통과.
  await paint(page, ROPE.total, [ROPE.five, ROPE.three]);
  await input(page, '가 몫').fill('20');
  await input(page, '나 몫').fill('20');
  await submit(page);
  await expectFailedWithHint(page, '두 도막의 길이를 합치면 48cm가 될까?', 1);
  await input(page, '가 몫').fill('18');
  await input(page, '나 몫').fill('30');
  await submit(page);
  await expectFailedWithHint(page, '가 도막의 칸 수가 한 칸의 몇 배인지', 2);
  await expectOverlayOverCanvas(main(page), 'share-bracket', 'ratio-canvas');
  await input(page, '가 몫').fill('30');
  await input(page, '나 몫').fill('18');
  await submit(page);
  await expectPassed(page);

  // T5 — 거꾸로 문제: 형 24가 고정, 전체를 틀리게 써 일반 ①, 바르게 써 통과.
  await expect(main(page).locator('[data-field="part-0"]')).toContainText('24');
  await input(page, '전체').fill('40');
  await submit(page);
  await expectFailedWithHint(page, '알려 준 형의 몫 24개는 막대 몇 칸일까요?', 1);
  await solveA2T5(page);

  // T6 — symbols: 35 ÷ 3 → DIVIDE ①·② (막대가 없어 말만), 35 × 3/7과 15로 통과.
  await expect(ratioCanvas(page)).toHaveAttribute('data-look', 'symbols');
  await input(page, '식').fill('35 ÷ 3');
  await submit(page);
  await expectFailedWithHint(page, '형과 동생 몫을 합치면 35가 될까?', 1);
  await submit(page);
  await expectFailedWithHint(page, '전체가 비의 칸 수로 모두 몇 칸인지', 2);
  await expect(main(page).locator('[data-overlay]')).toHaveCount(0);
  await input(page, '식').fill('35 * 3/7');
  await input(page, '형 몫').fill('15');
  await submit(page);
  await expectPassed(page, true);
});

test('A2.T2 한 칸 크기를 비우고 확인하면 일반 ①(share-bracket은 ②)', async ({ page }) => {
  await openActivity(page, 'A2');
  await solveA2T1(page);
  await submit(page);
  await expectFailedWithHint(page, '막대 전체가 35개예요.', 1);
  await submit(page);
  await expectFailedWithHint(page, '한 칸의 몇 배인지 묶어서 생각해 봐요.', 2);
  await expectOverlayOverCanvas(main(page), 'share-bracket', 'ratio-canvas');
});

test('A2.T4 형광펜 오답은 ②까지 말만, ③은 역추적 안내', async ({ page }) => {
  await openActivity(page, 'A2');
  await solveA2T1(page);
  await solveA2T2(page);
  await solveA2T3(page);
  await submit(page);
  await expectFailedWithHint(page, '전체를 나타내는 수와 나누는 비를 찾아봐요.', 1);
  await submit(page);
  await expectFailedWithHint(page, "'전체'는 나누어지는 양이고", 2);
  await expect(main(page).locator('[data-overlay]')).toHaveCount(0);
});

test('A2 통과 흐름(T1~T6 정답 바로)', async ({ page }) => {
  await openActivity(page, 'A2');
  await solveA2T1(page);
  await solveA2T2(page);
  await solveA2T3(page);
  await solveA2T4(page);
  await solveA2T5(page);
  await input(page, '식').fill('35 * 3/7');
  await input(page, '형 몫').fill('15');
  await submit(page);
  await expectPassed(page, true);
});

test('오프라인에서도 g6s2u4.A1 활동이 열린다', async ({ page, context }) => {
  await startApp(page, PREVIEW_URL);
  await page.goto(`${PREVIEW_URL}/#/activity/g6s2u4.A1`);
  await expect(page.getByRole('heading', { name: A1_TITLE })).toBeVisible();

  // 서비스 워커가 설치·활성화되어 이 페이지를 제어할 때까지 기다린다.
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
  await expect(page.getByRole('heading', { name: A1_TITLE })).toBeVisible();
  await expect(page.getByRole('button', { name: '확인하기' })).toBeVisible();
  await expect(main(page).getByTestId('card-0')).toBeVisible();
});
