import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { PREVIEW_URL } from '../../../playwright.config';
import { expectContentPanelsReachable } from '../panel-layout';

/**
 * T177 g4s1u6 「규칙 찾기」 단원 E2E.
 * - A1(입출력 블랙박스 4과제)·A2(블록 피라미드와 계산식 5과제) 정답 통과, 과제마다 대표 오답 → 일반 ①
 * - 오개념 ①·② 오버레이가 실제로 그려지고 본 캔버스와 1px 안에서 맞는다.
 *   ONE-PAIR(fail-cols), ADD-ONLY(diff-arrows), RECURSIVE-ONLY(step-table: 블록 쌓기·식·응답 23)
 * - 블록 쌓기 포인터·키보드, 식 키패드 포인터
 * - 학생 화면에 숨은 규칙·예측 값·학년 표시가 없다. 첫 화면 스냅샷, 오프라인.
 */

test.describe.configure({ timeout: 300_000 });
test.use({ actionTimeout: 20_000 });

interface UnitTask {
  readonly id: string;
  readonly prompt: string;
  readonly config: Record<string, unknown>;
  readonly hints: readonly { readonly say?: string }[];
}
interface UnitContent {
  readonly activities: readonly { readonly id: string; readonly tasks: readonly UnitTask[] }[];
}

const content = JSON.parse(
  readFileSync(new URL('../../../data/content/g4s1u6.json', import.meta.url), 'utf-8'),
) as UnitContent;

test('콘텐츠 설정이 명세를 따른다(A1 4과제, A2 5과제, 보상·숨은 규칙·예측 값 노출 없음)', () => {
  expect(content.activities.map((a) => a.id)).toEqual(['g4s1u6.A1', 'g4s1u6.A2']);
  const a1 = content.activities[0]?.tasks ?? [];
  const a2 = content.activities[1]?.tasks ?? [];
  expect(a1.map((t) => t.id)).toEqual([
    'g4s1u6.A1.T1',
    'g4s1u6.A1.T2',
    'g4s1u6.A1.T3',
    'g4s1u6.A1.T4',
  ]);
  expect(a2.map((t) => t.id)).toEqual([
    'g4s1u6.A2.T1',
    'g4s1u6.A2.T2',
    'g4s1u6.A2.T3',
    'g4s1u6.A2.T4',
    'g4s1u6.A2.T5',
  ]);
  expect(a1.map((t) => t.config['mode'])).toEqual(Array(4).fill('black-box'));
  expect(a2.map((t) => t.config['mode'])).toEqual(Array(5).fill('calc-pattern'));
  expect(a1[3]?.config['ruleInput']).toBe(false);
  expect(a1[3]?.config['maxTrials']).toBe(3);
  expect(a2[3]?.config['pattern']).toBe('repunit-square');
  const forbiddenValues = /× ?[23]|[+] ?[17]\b|\b(12|16|23|25|1234321)\b/;
  for (const task of [...a1, ...a2]) {
    for (const key of ['levels', 'predictStep', 'symbols', 'linkHighlight']) {
      expect(task.config[key]).toBeUndefined();
    }
    const hintTexts = task.hints.map((hint) => hint.say ?? '');
    for (const text of hintTexts) expect(text).not.toMatch(forbiddenValues);
    for (const text of [task.prompt, ...hintTexts]) {
      expect(text).not.toMatch(/[1-6]학년/);
      expect(text).not.toMatch(/별|점수|함수|정의역/);
    }
    // 숨은 규칙·예측 값은 발문에 없다(A1.T4 발문의 출력 25, A2.T4 발문의 1111 × 1111은 과제 자료).
    expect(task.prompt).not.toMatch(/× ?[23] ?\+|[+] ?7|1234321/);
  }
});

function slot(page: Page, name: string): Locator {
  return page.getByTestId(`runner-slot-${name}`);
}

function main(page: Page): Locator {
  return slot(page, 'main');
}

function pad(page: Page, name: string): Locator {
  return main(page).getByRole('button', { name, exact: true });
}

function field(page: Page, id: string): Locator {
  return slot(page, 'response').locator(`[data-response-field="${id}"]`);
}

const TITLES = { A1: '입출력 블랙박스 추리', A2: '블록 피라미드와 계산식' } as const;

async function openActivity(page: Page, activity: 'A1' | 'A2'): Promise<void> {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.getByRole('button', { name: '1번', exact: true }).click();
  await page.getByRole('button', { name: '건너뛰기' }).click();
  await expect(page).toHaveURL(/#\/map$/);
  await page.goto(`/#/activity/g4s1u6.${activity}`);
  await expect(page.getByRole('heading', { name: TITLES[activity] })).toBeVisible();
  await expect(page.getByRole('button', { name: '확인하기' })).toBeVisible();
}

async function submit(page: Page): Promise<void> {
  await page.getByRole('button', { name: '확인하기' }).click();
}

async function expectFailedWithHint(page: Page, text: string, level: 1 | 2 | 3 = 1): Promise<void> {
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

/** 학생 화면에 학년 표시가 없다. */
async function expectNoGrade(page: Page): Promise<void> {
  const text = (await page.locator('body').textContent()) ?? '';
  expect(text).not.toMatch(/[1-6]학년/);
}

/** 화면 글자·DOM에 숨은 규칙(공백 없이 비교)이 없다. */
async function expectNoHidden(page: Page, forbidden: readonly string[]): Promise<void> {
  const text = ((await main(page).textContent()) ?? '').replace(/\s+/g, '');
  const html = ((await main(page).innerHTML()) ?? '').replace(/\s+/g, '');
  for (const value of forbidden) {
    expect(text).not.toContain(value);
    expect(html).not.toContain(value);
  }
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

// ---------------------------------------------------------------- 조작 도우미

/** 식 칸을 눌러 식 키패드를 열고 지운 뒤 기호 단추로 쓴다. */
async function writeRuleByPad(page: Page, text: string): Promise<void> {
  await main(page).getByTestId('rule-input').click();
  await pad(page, '모두 지우기').click();
  for (const ch of text) {
    if (ch === ' ') continue;
    await pad(page, ch).click();
  }
  await pad(page, '규칙 시험하기').click();
}

async function insertTrial(page: Page, digits: string): Promise<void> {
  await main(page).getByTestId('input-draft').click();
  for (const digit of digits) await pad(page, digit).click();
  await pad(page, '넣기').click();
}

async function typeNumber(page: Page, id: string, keys: string): Promise<void> {
  await field(page, id).getByRole('button', { name: /빈칸$/ }).first().click();
  for (const key of keys) await page.keyboard.press(key);
}

async function clearNumber(page: Page, id: string): Promise<void> {
  await field(page, id).getByRole('button').first().click();
  await slot(page, 'response').getByRole('button', { name: '모두 지우기' }).click();
}

function buildCell(page: Page, col: number, h: number): Locator {
  return page.locator(`[data-testid="calc-build"] rect[data-col="${col}"][data-h="${h}"]`);
}

function calcPad(page: Page, name: string): Locator {
  return page.getByTestId('calc-pad').getByRole('button', { name, exact: true });
}

const PYRAMID4 = [1, 2, 3, 4, 3, 2, 1];

async function buildPyramid4(page: Page): Promise<void> {
  for (const [index, h] of PYRAMID4.entries()) await buildCell(page, index + 1, h).click();
  await expect(page.getByTestId('calc-built-count')).toHaveText('블록 16개');
}

async function tapExpr(page: Page, text: string): Promise<void> {
  for (const key of text) await calcPad(page, key).click();
}

// 과제별 통과 도우미
async function passA1T1(page: Page): Promise<void> {
  await insertTrial(page, '1');
  await writeRuleByPad(page, '□ = ○ + 7');
  await submit(page);
  await expectPassed(page);
}
async function passA2T1(page: Page): Promise<void> {
  await buildPyramid4(page);
  await submit(page);
  await expectPassed(page);
}
async function passA2T2(page: Page): Promise<void> {
  await tapExpr(page, '1+2+3+4+3+2+1=4×4');
  await submit(page);
  await expectPassed(page);
}
async function passA2T3(page: Page): Promise<void> {
  await typeNumber(page, 'p', '25');
  await submit(page);
  await expectPassed(page);
}

// ---------------------------------------------------------------- A1

test('g4s1u6.A1 — 4과제 흐름: 식 키패드 포인터, 넣기 3번, 과제마다 일반 ①', async ({ page }) => {
  test.slow();
  await openActivity(page, 'A1');
  await expectNoGrade(page);
  await expectNoHidden(page, ['○+7', '□=○+7', '○×3', '○×2+1']);
  await expectContentPanelsReachable(page);
  await screenshot(page, 'g4s1u6-a1.png');

  // T1: 틀린 식(성립하는 쌍 없음) → 일반 ① → 통과
  await insertTrial(page, '3');
  await insertTrial(page, '0');
  await expect(main(page).getByTestId('trial-count')).toBeVisible();
  await writeRuleByPad(page, '□ = ○ + 6');
  await submit(page);
  await expectFailedWithHint(page, '작은 수부터 차례로 넣어 보고', 1);
  await writeRuleByPad(page, '□ = ○ + 7');
  await submit(page);
  await expectPassed(page);

  // T2
  await insertTrial(page, '1');
  await writeRuleByPad(page, '□ = ○ × 2');
  await submit(page);
  await expectFailedWithHint(page, '작은 수부터 차례로 넣어 보고', 1);
  await writeRuleByPad(page, '□ = ○ × 3');
  await submit(page);
  await expectPassed(page);

  // T3
  await insertTrial(page, '1');
  await writeRuleByPad(page, '□ = ○ × 2');
  await submit(page);
  await expectFailedWithHint(page, '작은 수부터 차례로 넣어 보고', 1);
  await writeRuleByPad(page, '□ = ○ × 2 + 1');
  await submit(page);
  await expectPassed(page);

  // T4: 식 입력 칸이 없고, 넣기는 3번까지. 응답으로 입력 예측.
  await expect(main(page).getByTestId('rule-input')).toHaveCount(0);
  await expectNoHidden(page, ['○×2+1']);
  await insertTrial(page, '1');
  await insertTrial(page, '2');
  await insertTrial(page, '5');
  await expect(main(page).getByTestId('trial-count')).toHaveText('넣은 횟수 3 / 3');
  await expect(pad(page, '넣기')).toBeDisabled();
  await typeNumber(page, 'p', '24');
  await submit(page);
  await expectFailedWithHint(page, '거꾸로 따라가 볼까요?', 1);
  await clearNumber(page, 'p');
  await typeNumber(page, 'p', '12');
  await submit(page);
  await expectPassed(page, true);
});

test('g4s1u6.A1.T1 — 첫 쌍만 맞는 식: ONE-PAIR ① → ② fail-cols 정렬', async ({ page }) => {
  test.slow();
  await openActivity(page, 'A1');
  await insertTrial(page, '3');
  await insertTrial(page, '0');
  // □ = ○ × 3 + 1은 (3, 10)에서만 성립한다.
  await writeRuleByPad(page, '□ = ○ × 3 + 1');
  await submit(page);
  await expectFailedWithHint(page, '다른 줄에도 이 규칙이 맞을까?', 1);
  await submit(page);
  await expectFailedWithHint(page, '빨간 테두리', 2);
  const layer = await expectOverlayAligned(page, 'fail-cols', 'relation-canvas');
  await expect(layer.locator('[data-testid="fail-col"]')).toHaveCount(1);
  await expectNoHidden(page, ['○+7']);
});

test('g4s1u6.A1.T2 — 덧셈식 두 번: ADD-ONLY ① → ② diff-arrows 정렬', async ({ page }) => {
  test.slow();
  await openActivity(page, 'A1');
  await passA1T1(page);
  await insertTrial(page, '0');
  await insertTrial(page, '1');
  await insertTrial(page, '5');
  await writeRuleByPad(page, '□ = ○ + 4');
  await writeRuleByPad(page, '□ = ○ + 5');
  await submit(page);
  await expectFailedWithHint(page, '입력이 1씩 커질 때 출력은 얼마씩 커져?', 1);
  await submit(page);
  await expectFailedWithHint(page, '화살표', 2);
  const layer = await expectOverlayAligned(page, 'diff-arrows', 'relation-canvas');
  await expect(layer.locator('[data-testid="diff-arrow"]').first()).toBeVisible();
  await expectNoHidden(page, ['○×3']);
  await writeRuleByPad(page, '□ = ○ × 3');
  await submit(page);
  await expectPassed(page);
});

// ---------------------------------------------------------------- A2

test('g4s1u6.A2 — 5과제 흐름: 블록 쌓기 포인터, 식 키패드 포인터, 응답, 과제마다 일반 ①', async ({
  page,
}) => {
  test.slow();
  await openActivity(page, 'A2');
  await expectNoGrade(page);
  await expectContentPanelsReachable(page);
  await screenshot(page, 'g4s1u6-a2.png');

  // T1: 아무것도 쌓지 않고 확인 → 일반 ① → 포인터로 4단계 쌓기
  await submit(page);
  await expectFailedWithHint(page, '앞 단계들의 가운데 줄은 어떻게 변했나요?', 1);
  await passA2T1(page);

  // T2: 맞는 합 16만 쓴 식 → 일반 ①
  await tapExpr(page, '1+2+3+4+3+2+1=16');
  await submit(page);
  await expectFailedWithHint(page, '앞 단계 식처럼 왼쪽은 블록 줄마다의 수', 1);
  await calcPad(page, '모두 지우기').click();
  await passA2T2(page);

  // T3: 24 → 일반 ① → 25
  await expect(page.getByTestId('calc-build')).toHaveCount(0);
  await expect(page.getByTestId('calc-expr')).toHaveCount(0);
  await typeNumber(page, 'p', '24');
  await submit(page);
  await expectFailedWithHint(page, '단계 번호와 블록 수 사이의 관계를 찾아봐요.', 1);
  await clearNumber(page, 'p');
  await passA2T3(page);

  // T4: 1111 × 1111
  await expectNoHidden(page, ['1234321']);
  await typeNumber(page, 'p', '1234');
  await submit(page);
  await expectFailedWithHint(page, '곱하는 수의 1의 개수와 답의 가운데 숫자를 견주어 봐요.', 1);
  await clearNumber(page, 'p');
  await typeNumber(page, 'p', '1234321');
  await submit(page);
  await expectPassed(page);

  // T5: 문장 고르기
  await expect(page.getByTestId('calc-build')).toHaveCount(0);
  await field(page, 'rule').getByRole('button', { name: '나', exact: true }).click();
  await submit(page);
  await expectFailedWithHint(page, '1·2·3단계 식의 오른쪽을 살펴봐요.', 1);
  await field(page, 'rule').getByRole('button', { name: '가', exact: true }).click();
  await submit(page);
  await expectPassed(page, true);
});

test('g4s1u6.A2.T1 — 키보드만으로 4단계 쌓기', async ({ page }) => {
  test.slow();
  await openActivity(page, 'A2');
  await page.getByTestId('calc-build').focus();
  for (const [index, h] of PYRAMID4.entries()) {
    await page.keyboard.press(String(h));
    if (index < PYRAMID4.length - 1) await page.keyboard.press('ArrowRight');
  }
  await expect(page.getByTestId('calc-built-count')).toHaveText('블록 16개');
  await submit(page);
  await expectPassed(page);
});

test('g4s1u6.A2.T1 — 한 열만 덧붙임: RECURSIVE-ONLY ① → ② step-table 정렬', async ({ page }) => {
  test.slow();
  await openActivity(page, 'A2');
  for (const [index, h] of [1, 2, 3, 2, 1, 4].entries()) await buildCell(page, index, h).click();
  await submit(page);
  await expectFailedWithHint(page, '10단계까지 다 쌓지 않고 알 수 있을까?', 1);
  await submit(page);
  await expectFailedWithHint(page, '표로 나란히', 2);
  const layer = await expectOverlayAligned(page, 'step-table', 'calc-canvas');
  await expect(layer.locator('[data-testid="step-table-col"]')).toHaveCount(3);
  await expect(layer).not.toContainText('16');
});

test('g4s1u6.A2.T2 — 식 9 + 7 = 16: RECURSIVE-ONLY ① → ② step-table 정렬', async ({ page }) => {
  test.slow();
  await openActivity(page, 'A2');
  await passA2T1(page);
  await tapExpr(page, '9+7=16');
  await submit(page);
  await expectFailedWithHint(page, '10단계까지 다 쌓지 않고 알 수 있을까?', 1);
  await submit(page);
  await expectFailedWithHint(page, '표로 나란히', 2);
  await expectOverlayAligned(page, 'step-table', 'calc-canvas');
});

test('g4s1u6.A2.T3 — 응답 23: RECURSIVE-ONLY ① → ② step-table 정렬(보여 준 4단계까지)', async ({
  page,
}) => {
  test.slow();
  await openActivity(page, 'A2');
  await passA2T1(page);
  await passA2T2(page);
  await typeNumber(page, 'p', '23');
  await submit(page);
  await expectFailedWithHint(page, '10단계까지 다 쌓지 않고 알 수 있을까?', 1);
  await submit(page);
  await expectFailedWithHint(page, '표로 나란히', 2);
  const layer = await expectOverlayAligned(page, 'step-table', 'calc-canvas');
  await expect(layer.locator('[data-testid="step-table-col"]')).toHaveCount(4);
  await clearNumber(page, 'p');
  await passA2T3(page);
});

// ---------------------------------------------------------------- 오프라인

test('오프라인에서도 g4s1u6.A1 활동이 열린다', async ({ page, context }) => {
  await page.goto(PREVIEW_URL);
  await page.getByRole('button', { name: '1번', exact: true }).click();
  await page.getByRole('button', { name: '건너뛰기' }).click();
  await expect(page).toHaveURL(/#\/map$/);
  await page.goto(`${PREVIEW_URL}/#/activity/g4s1u6.A1`);
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
