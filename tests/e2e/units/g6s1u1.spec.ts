import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { PREVIEW_URL } from '../../../playwright.config';
import { expectContentPanelsReachable } from '../panel-layout';

/**
 * T072 g6s1u1 「분수의 나눗셈」 단원 E2E.
 * 활동마다 대표 오답 → 힌트 ① → 정답 순서로 끝까지 해 본다.
 * 아이패드(WebKit)·크롬북·전자칠판 세 뷰포트에서 같은 흐름을 확인한다.
 */

// 과제 하나에 조작·오답·힌트·수정이 이어져 기본 30초로는 모자란다.
test.describe.configure({ timeout: 240_000 });

function slot(page: Page, name: string): Locator {
  return page.getByTestId(`runner-slot-${name}`);
}

function responseSlot(page: Page): Locator {
  return slot(page, 'response');
}

function field(page: Page, id: string): Locator {
  return responseSlot(page).locator(`[data-response-field="${id}"]`);
}

async function openActivity(page: Page, activityId: string, title: string): Promise<void> {
  await page.goto('/');
  await page.getByRole('button', { name: '1번', exact: true }).click();
  await page.getByRole('button', { name: '건너뛰기' }).click();
  await expect(page).toHaveURL(/#\/map$/);
  await page.goto(`/#/activity/${activityId}`);
  await expect(page.getByRole('heading', { name: title })).toBeVisible();
  await expect(page.getByRole('button', { name: '확인하기' })).toBeVisible();
}

/** 뷰가 하나면 main, 둘이면 left에 조작 버튼이 있다. */
async function engineSlot(page: Page): Promise<Locator> {
  const left = slot(page, 'left');
  return (await left.count()) > 0 ? left : slot(page, 'main');
}

async function engineAction(page: Page, name: string): Promise<void> {
  const target = await engineSlot(page);
  await target.getByRole('button', { name, exact: true }).click();
}

async function engineActionTimes(page: Page, name: string, count: number): Promise<void> {
  for (let index = 0; index < count; index += 1) await engineAction(page, name);
}

/** 분수 틀에 분자 → 분모 순서로 넣는다. */
async function typeFraction(
  page: Page,
  id: string,
  numerator: string,
  denominator: string,
): Promise<void> {
  const box = field(page, id);
  const fractionButton = box.getByRole('button', { name: '분수', exact: true });
  if ((await fractionButton.count()) > 0) await fractionButton.click();
  await box.locator('[data-part="numerator"]').click();
  for (const key of numerator) await page.keyboard.press(key);
  await box.locator('[data-part="denominator"]').click();
  for (const key of denominator) await page.keyboard.press(key);
}

async function clearNumber(page: Page, id: string): Promise<void> {
  // 입력 대상 필드를 먼저 고른 뒤, 필드 밖에 하나뿐인 키패드의 지우기를 누른다.
  await field(page, id).getByRole('button').first().click();
  await responseSlot(page).getByRole('button', { name: '모두 지우기' }).click();
}

async function toggleChoice(page: Page, id: string, label: string): Promise<void> {
  await field(page, id).getByRole('button', { name: label, exact: true }).click();
}

/** E08 줄에 분수 토큰 하나를 넣는다. */
async function typeStepFraction(
  page: Page,
  line: number,
  token: number,
  numerator: string,
  denominator: string,
): Promise<void> {
  await page.getByTestId('key-fraction').click();
  for (const digit of numerator) await page.getByTestId(`key-${digit}`).click();
  await page.getByTestId(`token-${line}-${token}-den`).click();
  for (const digit of denominator) await page.getByTestId(`key-${digit}`).click();
}

/** E08 토큰의 한 칸을 지우고 새 숫자를 넣는다. */
async function retypeStepField(
  page: Page,
  line: number,
  token: number,
  part: 'num' | 'den' | 'whole',
  digits: string,
  backspaces: number,
): Promise<void> {
  await page.getByTestId(`token-${line}-${token}-${part}`).click();
  for (let index = 0; index < backspaces; index += 1) await page.keyboard.press('Backspace');
  for (const digit of digits) await page.keyboard.press(digit);
}

async function submit(page: Page): Promise<void> {
  await page.getByRole('button', { name: '확인하기' }).click();
}

async function expectFailedWithHint(
  page: Page,
  text: string,
  answers: readonly string[] = [],
  level = 1,
): Promise<void> {
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByTestId('hint')).toHaveAttribute('data-hint-level', String(level));
  const hint = page.getByTestId('hint-text');
  await expect(hint).toContainText(text);
  const shown = await hint.innerText();
  for (const answer of answers) expect(shown).not.toContain(answer);
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

/** 전체를 똑같이 나누고 조각 하나씩을 차례로 접시에 나른다. */
async function shareEqually(page: Page, wholes: number, parts: number): Promise<void> {
  for (let whole = 1; whole <= wholes; whole += 1) {
    await engineAction(page, `${whole}번째 전체 똑같이 ${parts}조각`);
  }
  for (let whole = 0; whole < wholes; whole += 1) {
    for (let piece = 0; piece < parts; piece += 1) {
      const cell = page.locator(
        `[data-testid="share-piece"][data-whole="${whole}"][data-piece="${piece}"]`,
      );
      await cell.focus();
      await page.keyboard.press('Enter');
      await page.keyboard.press(String(piece + 1));
    }
  }
}

/** ÷n 카드를 열고 가로 칸을 divisor줄로 만든 뒤 첫 줄만 남긴다. */
async function divideIntoRows(page: Page, divisor: number, rows: number): Promise<void> {
  await engineAction(page, `÷ ${divisor}`);
  await engineActionTimes(page, '가로 칸 늘리기', rows - 1);
  await engineAction(page, '1번째 줄만 남기기');
}

/** ÷n 카드를 열고 묶음 지름길로 첫 묶음만 남긴다. */
async function divideIntoBundle(page: Page, divisor: number): Promise<void> {
  await engineAction(page, `÷ ${divisor}`);
  await engineAction(page, '묶어서 나누기');
  await engineAction(page, '1번째 묶음만 남기기');
}

test('A1 피자를 똑같이 나누기 — 대표 오답 뒤 고쳐서 세 과제를 통과한다', async ({ page }) => {
  await openActivity(page, 'g6s1u1.A1', '피자를 똑같이 나누기');
  await screenshot(page, 'g6s1u1-a1.png');

  // T1 — 한 판만 나눈 1/4로 틀린 뒤, 세 판을 4조각씩 접시에 나르고 3/4로 고친다.
  await typeFraction(page, 'ans', '1', '4');
  await submit(page);
  await expectFailedWithHint(page, '피자 한 판을 몇 조각으로 자르면 4명이 똑같이 나눌 수 있을까', [
    '3/4',
  ]);
  await clearNumber(page, 'ans');
  await shareEqually(page, 3, 4);
  await typeFraction(page, 'ans', '3', '4');
  await submit(page);
  await expectPassed(page);

  // T2 — 남은 한 판만 나눈 1/3로 틀린 뒤, 다섯 판을 3조각씩 접시에 나르고 5/3으로 고친다.
  await typeFraction(page, 'ans', '1', '3');
  await submit(page);
  await expectFailedWithHint(page, '한 명이 한 판씩 받고 남은 피자는 어떻게 나눌까', [
    '5/3',
    '1 2/3',
  ]);
  await clearNumber(page, 'ans');
  await shareEqually(page, 5, 3);
  await typeFraction(page, 'ans', '5', '3');
  await submit(page);
  await expectPassed(page);

  // T3 — '2 ÷ 5'를 골라 힌트 ①을 본 뒤 '5 ÷ 2'로 고친다.
  await toggleChoice(page, 'pick', '2 ÷ 5');
  await submit(page);
  await expectFailedWithHint(page, '피자 2판을 5명이 나누면 한 명이 한 판보다 많이 받을까', [
    '5 ÷ 2',
  ]);
  await toggleChoice(page, 'pick', '5 ÷ 2');
  await submit(page);
  await expectPassed(page, true);
});

test('A2 한 줄만 남겨 나누기 — 대표 오답 뒤 고쳐서 일곱 과제를 통과한다', async ({ page }) => {
  await openActivity(page, 'g6s1u1.A2', '한 줄만 남겨 나누기');
  await screenshot(page, 'g6s1u1-a2.png');

  // T1 — 분자에 3을 곱한 18/7로 틀려 MULT-DENOM 힌트 ①을 본 뒤 묶음 지름길로 2/7을 만든다.
  await typeFraction(page, 'ans', '18', '7');
  await submit(page);
  await expectFailedWithHint(page, '3명이 나누었는데 한 명 몫이 원래보다 많아졌을까', ['2/7']);
  // 같은 오답을 한 번 더 내면 오개념 힌트 ②의 그림이 함께 나온다.
  await submit(page);
  await expectFailedWithHint(page, '한 명 몫이 원래보다 많아졌다면', ['2/7'], 2);
  await expect(page.locator('[data-overlay="row-preview"]')).toHaveCount(1);
  await clearNumber(page, 'ans');
  await divideIntoBundle(page, 3);
  await typeFraction(page, 'ans', '2', '7');
  await submit(page);
  await expectPassed(page);

  // T2 — 분자를 잘못 나눈 4/3으로 틀려 WHOLE-NUMERATOR 힌트 ①을 본 뒤 세 줄로 나눈다.
  await typeFraction(page, 'ans', '4', '3');
  await submit(page);
  await expectFailedWithHint(page, '색칠한 부분을 3등분하려면 칼선을 어느 방향으로 더 그을까', [
    '4/15',
  ]);
  await clearNumber(page, 'ans');
  await divideIntoRows(page, 3, 3);
  await typeFraction(page, 'ans', '4', '15');
  await submit(page);
  await expectPassed(page);

  // T3 — '4/5 × 3'을 골라 힌트 ①을 본 뒤 그림을 만들고 '4/5 × 1/3'로 고친다.
  await toggleChoice(page, 'expr', '4/5 × 3');
  await submit(page);
  await expectFailedWithHint(page, '3명이 나누었는데 한 명 몫이 원래보다 많아졌을까', [
    '4/5 × 1/3',
  ]);
  await divideIntoRows(page, 3, 3);
  await toggleChoice(page, 'expr', '4/5 × 1/3');
  await submit(page);
  await expectPassed(page);

  // T4 — 대분수를 그대로 곱한 27/4로 틀린 뒤 세 줄로 나누어 3/4을 만든다.
  await typeFraction(page, 'ans', '27', '4');
  await submit(page);
  await expectFailedWithHint(page, '3명이 나누었는데 한 명 몫이 원래보다 많아졌을까', ['3/4']);
  await clearNumber(page, 'ans');
  await divideIntoRows(page, 3, 3);
  await typeFraction(page, 'ans', '3', '4');
  await submit(page);
  await expectPassed(page);

  // T5 — 분자에 4를 곱한 5/2로 틀려 힌트 ①을 본 뒤 5/32로 고친다.
  await typeStepFraction(page, 1, 0, '5', '2');
  await submit(page);
  await expectFailedWithHint(page, '4명이 나누었는데 한 명 몫이 원래보다 많아졌을까', ['5/32']);
  await retypeStepField(page, 1, 0, 'den', '32', 1);
  await submit(page);
  await expectPassed(page);

  // T6 — 분자에 5를 곱한 50/3로 틀려 힌트 ①을 본 뒤 2/3으로 고친다.
  await typeStepFraction(page, 1, 0, '50', '3');
  await submit(page);
  await expectFailedWithHint(page, '5명이 나누었는데 한 명 몫이 원래보다 많아졌을까', ['2/3']);
  await retypeStepField(page, 1, 0, 'num', '2', 2);
  await retypeStepField(page, 1, 0, 'den', '3', 1);
  await submit(page);
  await expectPassed(page);

  // T7 — '언제나 작아지니까'를 골라 ALWAYS-SMALLER 힌트 ①을 본 뒤 까닭을 고른다.
  await toggleChoice(page, 'why', '나누기를 하면 언제나 작아지니까');
  await submit(page);
  await expectFailedWithHint(page, '÷3이면 왜 작아졌을까? 3등분했기 때문일까, 나누기라서일까', [
    '4/5을 3등분한 것 중 하나라서',
  ]);
  await toggleChoice(page, 'why', '4/5을 3등분한 것 중 하나라서');
  await submit(page);
  await expectPassed(page, true);
});

test('크롬북·전자칠판에서 판 안 스크롤 없이 응답 칸과 확인하기에 닿는다', async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name === 'ipad',
    '아이패드는 판을 위아래로 두어 짧은 스크롤을 허용한다',
  );

  const cases = [
    { id: 'g6s1u1.A1', title: '피자를 똑같이 나누기' },
    { id: 'g6s1u1.A2', title: '한 줄만 남겨 나누기' },
  ] as const;

  for (const item of cases) {
    await openActivity(page, item.id, item.title);
    await page.evaluate(() => window.scrollTo(0, 0));
    // E08·응답 칸은 내용 높이를 쓰므로 판 안 스크롤 대신 페이지 스크롤로 확인한다.
    await expectContentPanelsReachable(page);
    await expect(responseSlot(page)).toBeVisible();
  }
});

test('오프라인에서도 g6s1u1.A1 활동이 열린다', async ({ page, context }) => {
  await page.goto(PREVIEW_URL);
  await page.getByRole('button', { name: '1번', exact: true }).click();
  await page.getByRole('button', { name: '건너뛰기' }).click();
  await expect(page).toHaveURL(/#\/map$/);
  await page.goto(`${PREVIEW_URL}/#/activity/g6s1u1.A1`);
  await expect(page.getByRole('heading', { name: '피자를 똑같이 나누기' })).toBeVisible();

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
  await expect(page.getByRole('heading', { name: '피자를 똑같이 나누기' })).toBeVisible();
  await expect(page.getByRole('button', { name: '확인하기' })).toBeVisible();
});
