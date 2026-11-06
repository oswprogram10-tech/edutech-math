import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { PREVIEW_URL } from '../../../playwright.config';
import {
  expectContentPanelsReachable,
  expectInsideScroller,
  expectNoPanelInnerScroll,
} from '../panel-layout';

/**
 * T025 g5s1u5 「분수의 덧셈과 뺄셈」 단원 E2E.
 * 과제마다 대표 오답 → 힌트 ① → 정답 순서로 끝까지 해 본다.
 * 아이패드(WebKit)·크롬북·전자칠판 세 뷰포트에서 같은 흐름을 확인한다.
 * 좌표는 화면 픽셀이 아니라 엔진의 논리 좌표(1000×600)로 적는다.
 */

// 과제 하나에 조작·오답·힌트·수정이 이어져 기본 30초로는 모자라다.
test.describe.configure({ timeout: 180_000 });

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

/** 대분수는 자연수 → 분자 → 분모 순서로 넣는다. */
async function typeMixed(
  page: Page,
  id: string,
  whole: string,
  numerator: string,
  denominator: string,
): Promise<void> {
  const box = field(page, id);
  const mixedButton = box.getByRole('button', { name: '대분수', exact: true });
  if ((await mixedButton.count()) > 0) await mixedButton.click();
  await box.locator('[data-part="whole"]').click();
  for (const key of whole) await page.keyboard.press(key);
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

/** E08 줄에 대분수 토큰 하나를 넣는다. */
async function typeStepMixed(
  page: Page,
  line: number,
  token: number,
  whole: string,
  numerator: string,
  denominator: string,
): Promise<void> {
  await page.getByTestId('key-mixed').click();
  await page.getByTestId(`token-${line}-${token}-whole`).click();
  for (const digit of whole) await page.getByTestId(`key-${digit}`).click();
  await page.getByTestId(`token-${line}-${token}-num`).click();
  for (const digit of numerator) await page.getByTestId(`key-${digit}`).click();
  await page.getByTestId(`token-${line}-${token}-den`).click();
  for (const digit of denominator) await page.getByTestId(`key-${digit}`).click();
}

/** E08 한 줄에 `대분수 − 대분수` 식을 넣는다. */
async function typeStepMixedMinusMixed(
  page: Page,
  line: number,
  left: readonly [string, string, string],
  right: readonly [string, string, string],
): Promise<void> {
  await page.getByTestId('key-mixed').click();
  await page.getByTestId(`token-${line}-0-whole`).click();
  for (const digit of left[0]) await page.getByTestId(`key-${digit}`).click();
  await page.getByTestId(`token-${line}-0-num`).click();
  for (const digit of left[1]) await page.getByTestId(`key-${digit}`).click();
  await page.getByTestId(`token-${line}-0-den`).click();
  for (const digit of left[2]) await page.getByTestId(`key-${digit}`).click();
  // 분수 토큰은 커서가 같은 칸에 머문다. 다음 토큰을 넣으려면 오른쪽으로 옮긴다.
  await page.getByTestId(`token-${line}-0-den`).press('ArrowRight');
  await page.getByTestId('key-sub').click();
  await page.getByTestId('key-mixed').click();
  await page.getByTestId(`token-${line}-2-whole`).click();
  for (const digit of right[0]) await page.getByTestId(`key-${digit}`).click();
  await page.getByTestId(`token-${line}-2-num`).click();
  for (const digit of right[1]) await page.getByTestId(`key-${digit}`).click();
  await page.getByTestId(`token-${line}-2-den`).click();
  for (const digit of right[2]) await page.getByTestId(`key-${digit}`).click();
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

test('A1 조각 크기 맞춰 합치기 — 대표 오답 뒤 고쳐서 네 과제를 통과한다', async ({ page }) => {
  await openActivity(page, 'g5s1u5.A1', '조각 크기 맞춰 합치기');
  await screenshot(page, 'g5s1u5-a1.png');

  // T1 — 겹치지 않은 채 분모끼리·분자끼리 더한 2/5로 틀린 뒤 5/6으로 고친다.
  await engineAction(page, '조각 크기 맞추기');
  await engineAction(page, '합치기');
  await typeFraction(page, 'ans', '2', '5');
  await submit(page);
  await expectFailedWithHint(page, '결과가 1/2보다 작아졌나요', ['5/6']);
  await clearNumber(page, 'ans');
  await typeFraction(page, 'ans', '5', '6');
  await submit(page);
  await expectPassed(page);

  // T2 — 통분한 뒤 더한 11/12로 틀린 뒤 7/12로 고친다.
  await engineAction(page, '조각 크기 맞추기');
  await engineAction(page, '덜어 내기');
  await typeFraction(page, 'ans', '11', '12');
  await submit(page);
  await expectFailedWithHint(page, '같은 조각 크기로 나타내려면', ['7/12']);
  await clearNumber(page, 'ans');
  await typeFraction(page, 'ans', '7', '12');
  await submit(page);
  await expectPassed(page);

  // T3 — 분모끼리 더한 7/9로 틀린 뒤 1 전체를 넘는 3/2로 고친다.
  await engineAction(page, '조각 크기 맞추기');
  await engineAction(page, '합치기');
  await typeFraction(page, 'ans', '7', '9');
  await submit(page);
  await expectFailedWithHint(page, '같은 조각으로 나타내면', ['3/2', '1 1/2']);
  await clearNumber(page, 'ans');
  await typeFraction(page, 'ans', '3', '2');
  await submit(page);
  await expectPassed(page);

  // T4 — 겹치지 않으면 엔진이 합치기를 막고, 까닭을 '조각의 수'로 골라 틀린 뒤 고친다.
  const subtractButton = (await engineSlot(page)).getByRole('button', {
    name: '덜어 내기',
    exact: true,
  });
  await expect(subtractButton).toBeDisabled();
  await expect(
    (await engineSlot(page)).getByText('먼저 두 막대를 겹쳐 조각 크기를 맞춰요.'),
  ).toBeVisible();
  // 맞는 선택지가 첫 자리에 오지 않도록 순서를 섞는다.
  const whyOptions = responseSlot(page).locator('[data-response-field="why"] [data-option-id]');
  await expect(whyOptions).toHaveCount(3);
  expect(
    await whyOptions.evaluateAll((nodes) =>
      nodes.map((node) => node.getAttribute('data-option-id')),
    ),
  ).toEqual(['b', 'a', 'c']);
  await toggleChoice(page, 'why', '조각의 수가 서로 달라서');
  await submit(page);
  await expectFailedWithHint(page, '칸선이 같은 자리에 있나요');
  await toggleChoice(page, 'why', '조각 하나의 크기가 서로 달라서');
  await submit(page);
  await expectPassed(page, true);
});

test('A2 4단계 풀이 코치 — 대표 오답 뒤 고쳐서 다섯 과제를 통과한다', async ({ page }) => {
  await openActivity(page, 'g5s1u5.A2', '4단계 풀이 코치');
  await screenshot(page, 'g5s1u5-a2.png');

  // T1 — 값은 맞지만 기약이 아닌 22/24로 틀린 뒤 11/12로 고친다.
  await typeStepFraction(page, 1, 0, '22', '24');
  await submit(page);
  await expectFailedWithHint(page, '같은 수로 나눌 수 있나요', ['11/12']);
  await retypeStepField(page, 1, 0, 'num', '11', 2);
  await retypeStepField(page, 1, 0, 'den', '12', 2);
  await submit(page);
  await expectPassed(page);

  // T2 — 분모만 통분하고 분자를 그대로 둔 1 4/12로 틀린 뒤 4 5/12로 고친다.
  await typeStepMixed(page, 1, 0, '1', '4', '12');
  await submit(page);
  await expectFailedWithHint(page, '분모만 바꾸고 분자는 그대로 두면', ['4 5/12', '53/12']);
  await retypeStepField(page, 1, 0, 'whole', '4', 1);
  await retypeStepField(page, 1, 0, 'num', '5', 1);
  await submit(page);
  await expectPassed(page);

  // T3 — 1을 10/12로 받아내린 1 3/12, 분수끼리 뒤집어 뺀 2 7/12로 차례로 틀린 뒤 1 5/12로 고친다.
  await typeStepMixedMinusMixed(page, 1, ['3', '2', '12'], ['1', '9', '12']);
  await page.getByTestId('key-add-line').click();
  await typeStepMixed(page, 2, 0, '1', '3', '12');
  await submit(page);
  await expectFailedWithHint(page, '꽉 찬 막대 하나는 원래 몇 조각', ['1 5/12', '17/12']);
  await retypeStepField(page, 2, 0, 'whole', '2', 1);
  await retypeStepField(page, 2, 0, 'num', '7', 1);
  await submit(page);
  await expectFailedWithHint(
    page,
    '작은 분수에서 큰 분수를 뺄 수 없을 때',
    ['1 5/12', '17/12', '3/12', '9/12'],
    2,
  );
  await retypeStepField(page, 2, 0, 'whole', '1', 1);
  await retypeStepField(page, 2, 0, 'num', '5', 1);
  await submit(page);
  await expectPassed(page);

  // T4 — 틀린 줄은 고르지만 같은 2/5로 고쳐 써서 틀린 뒤 5/6으로 바로잡는다.
  // 디버그 모드에서는 친구 풀이 줄을 먼저 골라야 고친 줄 입력칸이 열린다.
  await page.getByTestId('sample-line-1').click();
  await expect(page.getByTestId('sample-line-1')).toHaveAttribute('aria-pressed', 'true');
  await typeStepFraction(page, 2, 0, '2', '5');
  await submit(page);
  await expectFailedWithHint(page, '둘째 줄의 값이 첫 줄보다 작아졌나요', ['5/6']);
  await retypeStepField(page, 2, 0, 'num', '5', 1);
  await retypeStepField(page, 2, 0, 'den', '6', 1);
  await submit(page);
  await expectPassed(page);

  // T5 — 계산은 맞지만 어림을 '작다'로 골라 틀린 뒤 '크다'로 고친다.
  await typeStepFraction(page, 1, 0, '19', '12');
  await toggleChoice(page, 'est', '1보다 작다');
  await submit(page);
  await expectFailedWithHint(page, '각각 1에 얼마나 가까운가요', ['19/12', '1 7/12']);
  await toggleChoice(page, 'est', '1보다 크다');
  await submit(page);
  await expectPassed(page, true);
});

test('A3 대분수 막대 쪼개기 — 대표 오답 뒤 고쳐서 세 과제를 통과한다', async ({ page }) => {
  await openActivity(page, 'g5s1u5.A3', '대분수 막대 쪼개기');
  await screenshot(page, 'g5s1u5-a3.png');

  // T1 — 막대를 풀지 않고 제출해 틀린 뒤 자연수 1을 풀어 14/12 조각으로 만든다.
  await submit(page);
  await expectFailedWithHint(page, '1/6 조각으로 몇 개였나요', ['14/12']);
  await engineAction(page, '자연수 1 풀기');
  await submit(page);
  await expectPassed(page);

  // T2 — 자연수를 빼지 않은 2 5/12로 틀린 뒤 1 5/12로 고친다.
  await engineAction(page, '자연수 1 풀기');
  await engineAction(page, '덜어 내기');
  await typeMixed(page, 'ans', '2', '5', '12');
  await submit(page);
  await expectFailedWithHint(page, '남는 조각은 몇 개인가요', ['1 5/12', '17/12']);
  await clearNumber(page, 'ans');
  await typeMixed(page, 'ans', '1', '5', '12');
  await submit(page);
  await expectPassed(page);

  // T3 — 자연수만 먼저 뺀 2 2/5로 틀린 뒤 1 3/5으로 고친다.
  await typeMixed(page, 'ans', '2', '2', '5');
  await submit(page);
  await expectFailedWithHint(page, '남은 2/5을 그대로 두면', ['1 3/5', '8/5']);
  await clearNumber(page, 'ans');
  await typeMixed(page, 'ans', '1', '3', '5');
  await submit(page);
  await expectPassed(page, true);
});

test('크롬북에서 단계 이름표가 있어도 + 줄 키가 화면 안에 보인다', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromebook', '크롬북 화면에서만 확인한다');

  await openActivity(page, 'g5s1u5.A2', '4단계 풀이 코치');
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(page.getByTestId('key-add-line')).toBeInViewport({ ratio: 1 });

  // 단계 이름표가 있는 과제는 줄 목록만 스크롤하고 키패드는 판 안에 남는다.
  const layout = await page.getByTestId('step-solver').evaluate((root) => {
    const lines = root.querySelector('ol[class*="lines"]') as HTMLElement | null;
    const keypad = root.querySelector('[class*="keypad"]') as HTMLElement | null;
    return {
      linesOverflow: lines ? getComputedStyle(lines).overflowY : null,
      linesGrow: lines ? getComputedStyle(lines).flexGrow : null,
      keypadBottom: keypad?.getBoundingClientRect().bottom ?? null,
      rootBottom: root.getBoundingClientRect().bottom,
    };
  });
  expect(layout.linesOverflow).toBe('auto');
  expect(layout.linesGrow).toBe('1');
  expect(layout.keypadBottom).not.toBeNull();
  expect(layout.keypadBottom ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(
    layout.rootBottom + 1,
  );
});

test('크롬북·전자칠판 첫 화면에 입력 칸과 확인하기가 들어온다', async ({ page }, testInfo) => {
  test.skip(
    testInfo.project.name === 'ipad',
    '아이패드는 판을 위아래로 두어 짧은 스크롤을 허용한다',
  );

  const cases = [
    { id: 'g5s1u5.A1', title: '조각 크기 맞춰 합치기' },
    { id: 'g5s1u5.A2', title: '4단계 풀이 코치' },
    { id: 'g5s1u5.A3', title: '대분수 막대 쪼개기' },
  ] as const;

  for (const item of cases) {
    await openActivity(page, item.id, item.title);
    await page.evaluate(() => window.scrollTo(0, 0));
    await expectNoPanelInnerScroll(page);
    if (item.id === 'g5s1u5.A2') {
      // E08 A2는 크롬북에서 첫 화면(672px)을 넘는다. 판 안 스크롤 없이 페이지 스크롤로 확인한다.
      await expectContentPanelsReachable(page);
      await expectInsideScroller(page.getByTestId('line-1'));
      continue;
    }
    await expect(page.getByRole('button', { name: '확인하기' })).toBeInViewport({ ratio: 1 });
    if (item.id === 'g5s1u5.A3') {
      // A3 첫 과제는 막대를 푸는 조작이 답 입력이다.
      await expect(
        (await engineSlot(page)).getByRole('button', { name: '자연수 1 풀기' }),
      ).toBeInViewport({ ratio: 1 });
    } else {
      await expect(responseSlot(page)).toBeInViewport({ ratio: 1 });
    }
  }
});

test('오프라인에서도 g5s1u5.A1 활동이 열린다', async ({ page, context }) => {
  await page.goto(PREVIEW_URL);
  await page.getByRole('button', { name: '1번', exact: true }).click();
  await page.getByRole('button', { name: '건너뛰기' }).click();
  await expect(page).toHaveURL(/#\/map$/);
  await page.goto(`${PREVIEW_URL}/#/activity/g5s1u5.A1`);
  await expect(page.getByRole('heading', { name: '조각 크기 맞춰 합치기' })).toBeVisible();

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
  await expect(page.getByRole('heading', { name: '조각 크기 맞춰 합치기' })).toBeVisible();
  await expect(page.getByRole('button', { name: '확인하기' })).toBeVisible();
});
