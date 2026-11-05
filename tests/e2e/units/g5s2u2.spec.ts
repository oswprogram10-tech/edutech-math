import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { PREVIEW_URL } from '../../../playwright.config';

/**
 * T070 g5s2u2 「분수의 곱셈」 단원 E2E.
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

/** 자연수 틀에 숫자를 넣는다. */
async function typeInteger(page: Page, id: string, digits: string): Promise<void> {
  const box = field(page, id);
  const integerButton = box.getByRole('button', { name: '자연수', exact: true });
  if ((await integerButton.count()) > 0) await integerButton.click();
  await box.locator('[data-part="whole"]').click();
  for (const key of digits) await page.keyboard.press(key);
}

async function clearNumber(page: Page, id: string): Promise<void> {
  // 입력 대상 필드를 먼저 고른 뒤, 필드 밖에 하나뿐인 키패드의 지우기를 누른다.
  await field(page, id).getByRole('button').first().click();
  await responseSlot(page).getByRole('button', { name: '모두 지우기' }).click();
}

async function toggleChoice(page: Page, id: string, label: string): Promise<void> {
  await field(page, id).getByRole('button', { name: label, exact: true }).click();
}

async function chooseCompare(
  page: Page,
  id: string,
  label: '작다' | '같다' | '크다',
): Promise<void> {
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

test('A1 겹친 넓이로 곱셈하기 — 대표 오답 뒤 고쳐서 다섯 과제를 통과한다', async ({ page }) => {
  await openActivity(page, 'g5s2u2.A1', '겹친 넓이로 곱셈하기');
  await screenshot(page, 'g5s2u2-a1.png');

  // T1 — 분모에도 4를 곱한 2/3로 틀린 뒤 8/3으로 고친다.
  await engineActionTimes(page, '노랑 칸 늘리기', 4);
  await engineActionTimes(page, '파랑 칸 늘리기', 2);
  await typeFraction(page, 'ans', '2', '3');
  await submit(page);
  await expectFailedWithHint(page, '2/3이 4개 모이면 2/3과 크기가 같을까요', ['8/3', '2 2/3']);
  await clearNumber(page, 'ans');
  await typeFraction(page, 'ans', '8', '3');
  await submit(page);
  await expectPassed(page);

  // T2 — 분자끼리·분모끼리 더한 5/7로 틀린 뒤 1/2로 고친다.
  await engineActionTimes(page, '노랑 칸 늘리기', 2);
  await engineActionTimes(page, '파랑 칸 늘리기', 3);
  await typeFraction(page, 'ans', '5', '7');
  await submit(page);
  await expectFailedWithHint(page, '분자끼리 더하고 분모끼리 더한 값이 맞을까요', ['1/2']);
  await clearNumber(page, 'ans');
  await typeFraction(page, 'ans', '1', '2');
  await submit(page);
  await expectPassed(page);

  // T3 — '먼저 통분해요'로 틀려 COMMON-DENOM 힌트 ①을 본 뒤 '분모끼리 곱해요'로 고친다.
  // (분모 덧셈 고르기 규칙은 level 1이라 두 번째 실패에서는 다시 나오지 않는다.
  //  같은 오개념 코드 MC-FRAC-ADD-DENOM은 T2의 diagnose 규칙으로 확인한다.)
  await typeFraction(page, 'ans', '1', '10');
  await toggleChoice(page, 'rule', '먼저 통분해요');
  await submit(page);
  await expectFailedWithHint(page, '통분은 조각 크기를 맞추려고 했지', ['1/10']);
  await toggleChoice(page, 'rule', '분모끼리 곱해요');
  await submit(page);
  await expectPassed(page);

  // T4 — 정사각형 두 개를 한 개로 본 3/2로 틀린 뒤 1로 고친다.
  await typeFraction(page, 'ans', '3', '2');
  await submit(page);
  await expectFailedWithHint(page, '겹친 칸을 모으면 정사각형 몇 개만큼일까', ['1']);
  await clearNumber(page, 'ans');
  await typeFraction(page, 'ans', '1', '1');
  await submit(page);
  await expectPassed(page);

  // T5 — 값은 맞지만 기약이 아닌 5/10으로 틀린 뒤 1/2로 고친다.
  await typeStepFraction(page, 1, 0, '5', '10');
  await submit(page);
  await expectFailedWithHint(page, '마지막 분수를 더 간단하게 나타낼 수 있을까', ['1/2']);
  await retypeStepField(page, 1, 0, 'num', '1', 1);
  await retypeStepField(page, 1, 0, 'den', '2', 2);
  await submit(page);
  await expectPassed(page, true);
});

test('A2 리본 길이 바꾸기 — 대표 오답 뒤 고쳐서 다섯 과제를 통과한다', async ({ page }) => {
  await openActivity(page, 'g5s2u2.A2', '리본 길이 바꾸기');
  await screenshot(page, 'g5s2u2-a2.png');

  // T1 — '길어질까'로 예측해 ALWAYS-BIGGER 힌트 ①을 본 뒤 '짧아질까'로 고친다.
  await engineAction(page, '길어질까');
  await engineActionTimes(page, '뒤 눈금', 3);
  await typeInteger(page, 'len', '9');
  await submit(page);
  await expectFailedWithHint(page, '12m의 3/4만큼이면 리본 전체보다 많을까', ['9']);
  await engineAction(page, '짧아질까');
  await submit(page);
  await expectPassed(page);

  // T2 — '짧아질까'로 예측해 힌트 ①을 본 뒤 '길어질까'로 고치고 5/4까지 옮긴다.
  await engineAction(page, '짧아질까');
  await typeInteger(page, 'len', '15');
  await submit(page);
  await expectFailedWithHint(page, '5/4은 1보다 클까, 작을까', ['15']);
  await engineAction(page, '길어질까');
  await engineActionTimes(page, '뒤 눈금', 5);
  await submit(page);
  await expectPassed(page);

  // T3 — 1을 골라 힌트 ①을 본 뒤 1보다 작은 세 수를 고른다.
  await toggleChoice(page, 'pick', '1');
  await submit(page);
  await expectFailedWithHint(page, '곱하는 수가 1보다 작으면 리본이 어떻게 됐지', [
    '1/4',
    '1/2',
    '3/4',
  ]);
  await toggleChoice(page, 'pick', '1');
  await toggleChoice(page, 'pick', '1/4');
  await toggleChoice(page, 'pick', '1/2');
  await toggleChoice(page, 'pick', '3/4');
  await submit(page);
  await expectPassed(page);

  // T4 — 값은 맞지만 기약이 아닌 2/12로 틀린 뒤 1/6으로 고친다.
  await typeStepFraction(page, 1, 0, '2', '12');
  await submit(page);
  await expectFailedWithHint(page, '마지막 분수를 더 간단하게 나타낼 수 있을까', ['1/6']);
  await retypeStepField(page, 1, 0, 'num', '1', 1);
  await retypeStepField(page, 1, 0, 'den', '6', 2);
  await submit(page);
  await expectPassed(page);

  // T5 — '크다'를 골라 힌트 ①을 본 뒤 '작다'로 고친다.
  await chooseCompare(page, 'cmp', '크다');
  await submit(page);
  await expectFailedWithHint(page, '□의 7/8만큼이면 □보다 많을까', ['<']);
  await chooseCompare(page, 'cmp', '작다');
  await submit(page);
  await expectPassed(page, true);
});

test('크롬북·전자칠판 첫 화면에 응답 칸과 확인하기가 들어온다', async ({ page }, testInfo) => {
  test.skip(
    testInfo.project.name === 'ipad',
    '아이패드는 판을 위아래로 두어 짧은 스크롤을 허용한다',
  );

  const cases = [
    { id: 'g5s2u2.A1', title: '겹친 넓이로 곱셈하기' },
    { id: 'g5s2u2.A2', title: '리본 길이 바꾸기' },
  ] as const;

  for (const item of cases) {
    await openActivity(page, item.id, item.title);
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect(page.getByRole('button', { name: '확인하기' })).toBeInViewport({ ratio: 1 });
    await expect(responseSlot(page)).toBeInViewport({ ratio: 1 });
  }
});

test('오프라인에서도 g5s2u2.A1 활동이 열린다', async ({ page, context }) => {
  await page.goto(PREVIEW_URL);
  await page.getByRole('button', { name: '1번', exact: true }).click();
  await page.getByRole('button', { name: '건너뛰기' }).click();
  await expect(page).toHaveURL(/#\/map$/);
  await page.goto(`${PREVIEW_URL}/#/activity/g5s2u2.A1`);
  await expect(page.getByRole('heading', { name: '겹친 넓이로 곱셈하기' })).toBeVisible();

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
  await expect(page.getByRole('heading', { name: '겹친 넓이로 곱셈하기' })).toBeVisible();
  await expect(page.getByRole('button', { name: '확인하기' })).toBeVisible();
});
