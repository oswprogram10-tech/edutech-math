import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { PREVIEW_URL } from '../../../playwright.config';
import { controlsFoldOverflow, expectControlsAboveFold } from '../controls-fold';

/**
 * T214 g3s2u5 「들이와 무게」 단원 E2E.
 * A1(E13 capacity: 컵으로 세기·눈금 없는 비커 퍼즐)·A2(E13 weight: 예측·윗접시저울·용수철저울)를
 * 끝까지 통과하고, 대표 오답의 힌트 ①②를 확인한다.
 * 3학년이라 터치 타깃 48px, 자동 읽기 없음. 조작은 단추·키보드로 하므로 판 좌표를 쓰지 않는다.
 * 아이패드(WebKit)·크롬북·전자칠판 세 뷰포트에서 같은 흐름을 확인한다.
 */

test.describe.configure({ timeout: 180_000 });

const A1 = { id: 'g3s2u5.A1', title: '눈금 없는 비커 물약 계량' } as const;
const A2 = { id: 'g3s2u5.A2', title: '저울 실험실' } as const;

function slot(page: Page, name: string): Locator {
  return page.getByTestId(`runner-slot-${name}`);
}

function responseSlot(page: Page): Locator {
  return slot(page, 'response');
}

function field(page: Page, id: string): Locator {
  return responseSlot(page).locator(`[data-response-field="${id}"]`);
}

function button(page: Page, name: string): Locator {
  return page.getByRole('button', { name, exact: true });
}

async function openActivity(page: Page, activity: { id: string; title: string }): Promise<void> {
  await page.goto('/');
  await page.getByRole('button', { name: '1번', exact: true }).click();
  await page.getByRole('button', { name: '건너뛰기' }).click();
  await expect(page).toHaveURL(/#\/map$/);
  await page.goto(`/#/activity/${activity.id}`);
  await expect(page.getByRole('heading', { name: activity.title })).toBeVisible();
  await expect(page.getByRole('button', { name: '확인하기' })).toBeVisible();
}

async function submit(page: Page): Promise<void> {
  await page.getByRole('button', { name: '확인하기' }).click();
}

async function expectHint(page: Page, level: number, text: string): Promise<void> {
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

function canvasOf(page: Page, testId: string): Locator {
  return slot(page, 'main').getByTestId(testId);
}

/** 판이 칸에 맞춰 크기를 정할 때까지(상자가 두 번 연속 같아질 때까지) 기다린다. */
async function settleCanvas(page: Page, testId: string): Promise<void> {
  await canvasOf(page, testId).scrollIntoViewIfNeeded();
  let previous = '';
  await expect
    .poll(async () => {
      const now = JSON.stringify(await canvasOf(page, testId).boundingBox());
      const same = now === previous;
      previous = now;
      return same;
    })
    .toBe(true);
}

/**
 * 못 맞추는 과제용 첫 화면 검사: 기기별로 알려진 모자람(px)을 허용하고 더 나빠지는 것만 막는다.
 * (크롬북 A1.T1·T2는 1px, A2.T2는 용수철저울 판이 높아 크롬북 72px·아이패드 10px. 카드 메모 참고.)
 */
async function expectControlsFoldWithin(
  page: Page,
  label: string,
  allowed: Readonly<Record<string, number>>,
): Promise<void> {
  const limit = allowed[test.info().project.name] ?? 0;
  let previous = Number.NaN;
  await expect
    .poll(async () => {
      const now = await controlsFoldOverflow(page);
      const same = now === previous;
      previous = now;
      return same;
    })
    .toBe(true);
  expect(
    await controlsFoldOverflow(page),
    `${label}: 조작 칸 첫 단추 줄이 첫 화면 아래로 넘친 px`,
  ).toBeLessThanOrEqual(limit);
}

async function screenshot(page: Page, testId: string, name: string): Promise<void> {
  await settleCanvas(page, testId);
  // 버튼 클릭으로 스크롤된 상태가 남지 않게 맨 위에서 찍는다.
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

/** 힌트 ② 오버레이가 본 판 svg와 같은 자리·크기(1px 안)에 놓였는지 본다. */
async function expectOverlayOverCanvas(
  page: Page,
  overlayName: string,
  canvasTestId: string,
): Promise<Locator> {
  const overlay = slot(page, 'main').locator(`[data-overlay="${overlayName}"]`);
  await expect(overlay).toBeVisible();
  await expect
    .poll(async () => {
      const overlayBox = await overlay.locator('svg').first().boundingBox();
      const canvasBox = await canvasOf(page, canvasTestId).boundingBox();
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

/** 수 응답 칸에 숫자를 쓴다(빈칸을 누르고 키를 친다). */
async function typeIn(page: Page, id: string, keys: string): Promise<void> {
  await field(page, id).getByRole('button', { name: /빈칸$/ }).first().click();
  for (const key of keys) await page.keyboard.press(key);
}

async function clearField(page: Page, id: string): Promise<void> {
  await field(page, id).getByRole('button').first().click();
  await responseSlot(page).getByRole('button', { name: '모두 지우기' }).click();
}

async function writeAnswer(
  page: Page,
  values: Readonly<Record<string, string>>,
  clear = false,
): Promise<void> {
  for (const [id, keys] of Object.entries(values)) {
    if (clear) await clearField(page, id);
    await typeIn(page, id, keys);
  }
}

async function choose(page: Page, label: string): Promise<void> {
  await field(page, 'pick').getByRole('button', { name: label, exact: true }).click();
}

async function press(page: Page, name: string, times = 1): Promise<void> {
  for (let i = 0; i < times; i += 1) await button(page, name).click();
}

const BOTTLE = '병 컵으로 붓기';
const BOWL = '그릇 컵으로 붓기';
const BEAKER = '비커 컵으로 붓기';
const FILL_A = '비커 가 채우기';
const FILL_B = '비커 나 채우기';
const EMPTY_B = '비커 나 비우기';
const A_TO_B = '비커 가의 물을 비커 나에 붓기';
const B_TO_A = '비커 나의 물을 비커 가에 붓기';

// ── A1 도우미 ──

async function passA1T1(page: Page): Promise<void> {
  await settleCanvas(page, 'capacity-canvas');
  await press(page, BOTTLE, 3);
  await press(page, BOWL, 4);
  await choose(page, '나 넓은 그릇');
  await submit(page);
  await expectPassed(page);
}

async function passA1T2(page: Page): Promise<void> {
  await settleCanvas(page, 'capacity-canvas');
  await press(page, BEAKER, 5);
  await writeAnswer(page, { n: '5' });
  await submit(page);
  await expectPassed(page);
}

/** 300mL 비커를 채워 500mL 비커에 두 번 부으면 300mL 비커에 100mL가 남는다. */
async function make100(page: Page): Promise<void> {
  await press(page, FILL_B);
  await press(page, B_TO_A);
  await press(page, FILL_B);
  await press(page, B_TO_A);
}

async function passA1T3(page: Page): Promise<void> {
  await settleCanvas(page, 'capacity-canvas');
  await make100(page);
  await submit(page);
  await expectPassed(page);
}

/** 500 채움 → 300에 부음 → 300 비움 → 200 옮김 → 500 채움 → 300에 부음(500 비커에 400). */
async function make400(page: Page): Promise<void> {
  await press(page, FILL_A);
  await press(page, A_TO_B);
  await press(page, EMPTY_B);
  await press(page, A_TO_B);
  await press(page, FILL_A);
  await press(page, A_TO_B);
}

async function passA1T4(page: Page): Promise<void> {
  await settleCanvas(page, 'capacity-canvas');
  await make400(page);
  await submit(page);
  await expectPassed(page);
}

async function passA1T5(page: Page): Promise<void> {
  await writeAnswer(page, { L: '2', mL: '200' });
  await submit(page);
  await expectPassed(page, true);
}

// ── A2 도우미 ──

async function predictBeachBall(page: Page): Promise<void> {
  await button(page, '비치볼').click();
  await button(page, '예측하기').click();
  await expect(page.getByTestId('weight-prediction')).toBeVisible();
}

async function compareBalls(page: Page): Promise<void> {
  await button(page, '비치볼').click();
  await button(page, '왼쪽 접시에 놓기').click();
  await button(page, '쇠구슬').click();
  await button(page, '오른쪽 접시에 놓기').click();
}

async function passA2T1(page: Page): Promise<void> {
  await settleCanvas(page, 'weight-canvas');
  await predictBeachBall(page);
  await compareBalls(page);
  await submit(page);
  await expectPassed(page);
}

async function hangBook(page: Page): Promise<void> {
  await button(page, '책').click();
  await button(page, '용수철저울에 걸기').click();
}

async function passA2T2(page: Page): Promise<void> {
  await settleCanvas(page, 'weight-canvas');
  await hangBook(page);
  await writeAnswer(page, { total: '450' });
  await submit(page);
  await expectPassed(page);
}

async function passA2T3(page: Page): Promise<void> {
  await writeAnswer(page, { total: '1250' });
  await submit(page);
  await expectPassed(page);
}

// ── A1 ──

test('A1 눈금 없는 비커 물약 계량 — 대표 오답 뒤 고쳐서 다섯 과제를 통과한다', async ({ page }) => {
  await openActivity(page, A1);

  // T1 — 길쭉한 병(가)을 고르면 MC-MEAS-CAPACITY-SHAPE ①, 다음 실패에서 ②(same-beaker 정렬).
  await settleCanvas(page, 'capacity-canvas');
  await choose(page, '가 길쭉한 병');
  await submit(page);
  await expectHint(page, 1, '컵으로 몇 번 들어갔는지 세어 볼까?');
  await submit(page);
  await expectHint(page, 2, '같은 모양 비커에 옮겨 담았다고');
  await expectOverlayOverCanvas(page, 'same-beaker', 'capacity-canvas');
  await press(page, BOTTLE, 3);
  await press(page, BOWL, 4);
  await choose(page, '나 넓은 그릇');
  await submit(page);
  await expectPassed(page);

  // T2 — 컵을 붓지 않고 쓰면 일반 ①, 다음 실패에서 ②(liter-cups 정렬).
  await settleCanvas(page, 'capacity-canvas');
  await writeAnswer(page, { n: '3' });
  await submit(page);
  await expectHint(page, 1, '컵으로 한 번 부을 때마다 비커가 얼마나 차는지');
  await submit(page);
  await expectHint(page, 2, '1L 병 하나가 100mL 컵 몇 개와 같은지');
  await expectOverlayOverCanvas(page, 'liter-cups', 'capacity-canvas');
  await press(page, BEAKER, 5);
  await writeAnswer(page, { n: '5' }, true);
  await submit(page);
  await expectPassed(page);

  // T3 — 아무것도 안 하고 확인하면 일반 ①. 그다음 100mL를 만든다.
  await settleCanvas(page, 'capacity-canvas');
  await screenshot(page, 'capacity-canvas', 'g3s2u5-a1t3.png');
  await submit(page);
  await expectHint(page, 1, '큰 비커를 채워 작은 비커에 부으면');
  await make100(page);
  await submit(page);
  await expectPassed(page);

  // T4 — 400mL(500mL 비커에 만든다).
  await passA1T4(page);

  // T5 — 1L 1200mL로 쓰면 MC-MEAS-MIXED-UNIT-CALC ①, 다음 실패에서 ②(ml-merge는 숨은 엔진이라 힌트 칸에).
  await expect(slot(page, 'main')).toHaveCount(0);
  await writeAnswer(page, { L: '1', mL: '1200' });
  await submit(page);
  await expectHint(page, 1, 'mL가 1000이 넘으면 무엇으로 바꿀 수 있지?');
  await submit(page);
  await expectHint(page, 2, '1L 병 하나로 합쳐지는 그림');
  await expect(page.getByTestId('hint-overlay').locator('[data-overlay="ml-merge"]')).toBeVisible();
  await writeAnswer(page, { L: '2', mL: '200' }, true);
  await submit(page);
  await expectPassed(page, true);
});

// ── A2 ──

test('A2 저울 실험실 — 대표 오답 뒤 고쳐서 네 과제를 통과한다', async ({ page }) => {
  await openActivity(page, A2);

  // T1 — 예측 없이 확인하면 일반 ①, 예측만 하고 확인하면 ②. 비교까지 하면 통과.
  await settleCanvas(page, 'weight-canvas');
  await screenshot(page, 'weight-canvas', 'g3s2u5-a2t1.png');
  await submit(page);
  await expectHint(page, 1, '저울을 쓰기 전에 어느 쪽이 더 무거울지 예측했는지');
  await predictBeachBall(page);
  await submit(page);
  await expectHint(page, 2, '두 공을 접시에 하나씩 올려서');
  await compareBalls(page);
  await submit(page);
  await expectPassed(page);

  // T2 — 눈금 숫자만 보고 500으로 쓰면 전용 ①. 450으로 고친다.
  await settleCanvas(page, 'weight-canvas');
  await screenshot(page, 'weight-canvas', 'g3s2u5-a2t2.png');
  await hangBook(page);
  await writeAnswer(page, { total: '500' });
  await submit(page);
  await expectHint(page, 1, '바늘이 400과 500 사이 어디에 있는지');
  await writeAnswer(page, { total: '450' }, true);
  await submit(page);
  await expectPassed(page);

  // T3 — 125로 쓰면 MC-MEAS-UNIT-CONVERT ①, 다음 실패에서 ②(say만).
  await expect(slot(page, 'main')).toHaveCount(0);
  await writeAnswer(page, { total: '125' });
  await submit(page);
  await expectHint(page, 1, '1kg은 몇 g이었지?');
  await submit(page);
  await expectHint(page, 2, '1kg은 1000g이에요.');
  await expect(page.locator('[data-overlay]')).toHaveCount(0);
  await writeAnswer(page, { total: '1250' }, true);
  await submit(page);
  await expectPassed(page);

  // T4 — 1kg 1500g으로 쓰면 전용 ①. 1kg 500g으로 고친다.
  await expect(slot(page, 'main')).toHaveCount(0);
  await writeAnswer(page, { kg: '1', g: '1500' });
  await submit(page);
  await expectHint(page, 1, 'g가 1000이 넘으면 무엇으로 바꿀 수 있지?');
  await writeAnswer(page, { g: '500' }, true);
  await submit(page);
  await expectPassed(page, true);
});

test('A1.T3을 키보드만으로 푼다', async ({ page }) => {
  await openActivity(page, A1);
  await passA1T1(page);
  await passA1T2(page);
  await settleCanvas(page, 'capacity-canvas');
  for (const name of [FILL_B, B_TO_A, FILL_B, B_TO_A]) {
    await button(page, name).focus();
    await page.keyboard.press('Enter');
  }
  await page.getByRole('button', { name: '확인하기' }).focus();
  await page.keyboard.press('Enter');
  await expectPassed(page);
});

// ── 노출·터치 타깃·첫 화면·오프라인 ──

/** 판 안 글·aria·data-(학생이 놓은 자리 좌표 제외)를 모아 돌려준다. */
async function exposedText(page: Page): Promise<string> {
  return slot(page, 'main').evaluate((root) => {
    const skip = new Set(['data-x', 'data-y', 'data-start', 'data-index', 'data-tick']);
    const parts: string[] = [root.textContent ?? ''];
    for (const element of [root, ...Array.from(root.querySelectorAll('*'))]) {
      for (const attribute of Array.from(element.attributes)) {
        if (attribute.name === 'aria-label' || attribute.name === 'title') {
          parts.push(attribute.value);
        } else if (attribute.name.startsWith('data-') && !skip.has(attribute.name)) {
          parts.push(attribute.value);
        }
      }
    }
    return parts.join('\n');
  });
}

function numberIn(text: string, values: readonly string[]): boolean {
  return new RegExp(`(^|[^\\d.])(${values.join('|')})([^\\d.]|$)`).test(text);
}

async function noGrade(page: Page): Promise<void> {
  expect((await page.locator('body').textContent()) ?? '').not.toMatch(/[1-6]학년/);
}

test('시작 화면 DOM·aria·data-에 그릇 들이·물건 무게 값이 없고 학년 표시도 없다', async ({
  page,
}) => {
  await openActivity(page, A1);

  // A1.T1 — 병 600mL·그릇 800mL·컵 200mL가 판에 없다.
  await settleCanvas(page, 'capacity-canvas');
  let text = await exposedText(page);
  expect(numberIn(text, ['600', '800', '200'])).toBe(false);
  expect(text).not.toMatch(/mL/);
  await noGrade(page);
  await passA1T1(page);

  // A1.T2 — 1L 비커(1000mL)·컵 200mL가 판에 없다.
  await settleCanvas(page, 'capacity-canvas');
  text = await exposedText(page);
  expect(numberIn(text, ['1000', '200'])).toBe(false);
  expect(text).not.toMatch(/mL/);
  await noGrade(page);
  await passA1T2(page);

  // A1.T3 — 비커 500mL·300mL·목표 100mL가 판에 없다.
  await settleCanvas(page, 'capacity-canvas');
  text = await exposedText(page);
  expect(numberIn(text, ['500', '300', '100'])).toBe(false);
  expect(text).not.toMatch(/mL/);
  await noGrade(page);
  await passA1T3(page);

  // A1.T4 — 목표 400mL가 판에 없다. 만드는 도중에도 물의 양 글이 없다.
  await settleCanvas(page, 'capacity-canvas');
  text = await exposedText(page);
  expect(numberIn(text, ['500', '300', '400'])).toBe(false);
  await make400(page);
  text = await exposedText(page);
  expect(numberIn(text, ['500', '300', '400', '200', '100'])).toBe(false);
  expect(text).not.toMatch(/mL/);
  await noGrade(page);
  await submit(page);
  await expectPassed(page);

  // A1.T5 — 엔진이 숨겨져 판이 없다. 응답 칸에도 답이 없다.
  await expect(slot(page, 'main')).toHaveCount(0);
  expect(await responseSlot(page).textContent()).not.toMatch(/200/);
  await noGrade(page);
  await passA1T5(page);

  // A2.T1 — 비치볼 150g·쇠구슬 800g이 판에 없다.
  await openActivity(page, A2);
  await settleCanvas(page, 'weight-canvas');
  text = await exposedText(page);
  expect(numberIn(text, ['150', '800'])).toBe(false);
  expect(text).not.toMatch(/\d\s*g\b/);
  await noGrade(page);
  await passA2T1(page);

  // A2.T2 — 용수철 눈금 숫자(0~500)는 보이지만 책 무게 450은 글·aria·data-에 없다. 건 뒤에도 같다.
  await settleCanvas(page, 'weight-canvas');
  text = await exposedText(page);
  expect(numberIn(text, ['450'])).toBe(false);
  await hangBook(page);
  text = await exposedText(page);
  expect(numberIn(text, ['450'])).toBe(false);
  await noGrade(page);
  await writeAnswer(page, { total: '450' });
  await submit(page);
  await expectPassed(page);

  // A2.T3 — 엔진이 숨겨져 판이 없다. 응답 칸에도 답이 없다.
  await expect(slot(page, 'main')).toHaveCount(0);
  expect(await responseSlot(page).textContent()).not.toMatch(/1250/);
  await noGrade(page);
  await passA2T3(page);

  // A2.T4
  await expect(slot(page, 'main')).toHaveCount(0);
  expect(await responseSlot(page).textContent()).not.toMatch(/1\s*kg\s*500/);
  await noGrade(page);
});

async function expectMin48(locator: Locator, label: string): Promise<void> {
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  expect(box, label).not.toBeNull();
  expect(box?.width ?? 0, `${label} 너비`).toBeGreaterThanOrEqual(47.5);
  expect(box?.height ?? 0, `${label} 높이`).toBeGreaterThanOrEqual(47.5);
}

test('3학년 48px 터치 타깃: 붓기·채우기·옮겨 붓기·예측·놓기·걸기·응답 칸', async ({ page }) => {
  await openActivity(page, A1);
  await settleCanvas(page, 'capacity-canvas');
  for (const name of [BOTTLE, BOWL, '병 비우기', '처음으로']) {
    await expectMin48(button(page, name), name);
  }
  for (const label of ['가 길쭉한 병', '나 넓은 그릇']) {
    await expectMin48(field(page, 'pick').getByRole('button', { name: label, exact: true }), label);
  }
  await passA1T1(page);
  await passA1T2(page);
  await settleCanvas(page, 'capacity-canvas');
  for (const name of [FILL_A, FILL_B, EMPTY_B, A_TO_B, B_TO_A]) {
    await expectMin48(button(page, name), name);
  }
  await passA1T3(page);
  await passA1T4(page);
  for (const id of ['L', 'mL']) {
    await expectMin48(field(page, id).getByRole('button').first(), `응답 칸 ${id}`);
  }

  await openActivity(page, A2);
  await settleCanvas(page, 'weight-canvas');
  for (const name of ['비치볼', '쇠구슬', '예측하기']) {
    await expectMin48(button(page, name), name);
  }
  await predictBeachBall(page);
  for (const name of ['왼쪽 접시에 놓기', '오른쪽 접시에 놓기', '선반에 내려놓기', '처음으로']) {
    await expectMin48(button(page, name), name);
  }
  await compareBalls(page);
  await submit(page);
  await expectPassed(page);
  await settleCanvas(page, 'weight-canvas');
  await expectMin48(button(page, '용수철저울에 걸기'), '용수철저울에 걸기');
});

test('엔진이 보이는 모든 과제에서 조작 칸 첫 단추 줄이 첫 화면에 보인다(T223)', async ({
  page,
}) => {
  await openActivity(page, A1);
  await settleCanvas(page, 'capacity-canvas');
  await expectControlsFoldWithin(page, 'g3s2u5.A1.T1', { chromebook: 1 });
  await passA1T1(page);

  await settleCanvas(page, 'capacity-canvas');
  await expectControlsFoldWithin(page, 'g3s2u5.A1.T2', { chromebook: 1 });
  await passA1T2(page);

  await settleCanvas(page, 'capacity-canvas');
  await expectControlsAboveFold(page, 'g3s2u5.A1.T3');
  await passA1T3(page);

  await settleCanvas(page, 'capacity-canvas');
  await expectControlsAboveFold(page, 'g3s2u5.A1.T4');
  await passA1T4(page);

  // A1.T5는 엔진을 숨겨(showEngine false) 조작 칸이 없다. 응답 칸과 확인하기만 본다.
  await expect(slot(page, 'main')).toHaveCount(0);
  await expect(responseSlot(page)).toBeVisible();
  await expect(page.getByRole('button', { name: '확인하기' })).toBeVisible();

  await openActivity(page, A2);
  await settleCanvas(page, 'weight-canvas');
  await expectControlsAboveFold(page, 'g3s2u5.A2.T1');
  await passA2T1(page);

  await settleCanvas(page, 'weight-canvas');
  await expectControlsFoldWithin(page, 'g3s2u5.A2.T2', { chromebook: 72, ipad: 10 });
  await passA2T2(page);

  await expect(slot(page, 'main')).toHaveCount(0);
  await expect(responseSlot(page)).toBeVisible();
  await passA2T3(page);
  await expect(slot(page, 'main')).toHaveCount(0);
  await expect(responseSlot(page)).toBeVisible();
});

test('오프라인에서도 g3s2u5.A1 활동이 열린다', async ({ page, context }) => {
  await page.goto(PREVIEW_URL);
  await page.getByRole('button', { name: '1번', exact: true }).click();
  await page.getByRole('button', { name: '건너뛰기' }).click();
  await expect(page).toHaveURL(/#\/map$/);
  await page.goto(`${PREVIEW_URL}/#/activity/${A1.id}`);
  await expect(page.getByRole('heading', { name: A1.title })).toBeVisible();

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
  await expect(page.getByRole('heading', { name: A1.title })).toBeVisible();
  await expect(page.getByRole('button', { name: '확인하기' })).toBeVisible();
});
