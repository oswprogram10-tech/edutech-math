import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { PREVIEW_URL } from '../../../playwright.config';
import { expectContentPanelsReachable, expectNoPanelInnerScroll } from '../panel-layout';

/**
 * T074 g6s2u1 「분수의 나눗셈」 단원 E2E.
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

async function pickCompare(
  page: Page,
  id: string,
  symbol: '작다' | '같다' | '크다',
): Promise<void> {
  await field(page, id).getByRole('button', { name: symbol, exact: true }).click();
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

/** E08 학생 줄을 비운다(마지막 학생 줄은 빈 줄로 되돌아간다). */
async function clearStepLine(page: Page): Promise<void> {
  await page.getByTestId('key-remove-line').click();
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

test('A1 나누는 수 막대로 재기 — 대표 오답 뒤 고쳐서 네 과제를 통과한다', async ({ page }) => {
  await openActivity(page, 'g6s2u1.A1', '나누는 수 막대로 재기');
  await screenshot(page, 'g6s2u1-a1.png');

  // T1 — 자를 5번만 놓고 5라고 써서 틀린 뒤, 여섯 번째 자를 놓고 6으로 고친다.
  await engineActionTimes(page, '자 놓기', 5);
  await typeInteger(page, 'q', '5');
  await submit(page);
  await expectFailedWithHint(page, '자를 끝까지 이어 놓았나요?', ['6']);
  await engineAction(page, '자 놓기');
  await clearNumber(page, 'q');
  await typeInteger(page, 'q', '6');
  await submit(page);
  await expectPassed(page);

  // T2 — 자를 2번만 놓고 2라고 쓴 뒤, 세 번째 자를 놓고 규칙 카드를 고른다.
  await engineActionTimes(page, '자 놓기', 2);
  await typeInteger(page, 'q', '2');
  await toggleChoice(page, 'rule', '분모끼리 나누어 구해요');
  await submit(page);
  await expectFailedWithHint(page, '1/7 조각이 6개 있는 막대를 2/7 자로 재면', ['3']);
  await engineAction(page, '자 놓기');
  await toggleChoice(page, 'rule', '분모가 같으면 분자끼리 나누어 구할 수 있어요');
  await clearNumber(page, 'q');
  await typeInteger(page, 'q', '3');
  await submit(page);
  await expectPassed(page);

  // T3 — 남은 부분을 전체 기준으로 읽은 13/12로 틀려 REMAINDER-UNIT 힌트 ①을 본 뒤 9/8로 고친다.
  await engineActionTimes(page, '자 놓기', 2);
  await typeFraction(page, 'q', '13', '12');
  await submit(page);
  await expectFailedWithHint(page, '남은 부분은 무엇의 몇 분의 몇일까?', ['9/8']);
  await clearNumber(page, 'q');
  await typeFraction(page, 'q', '9', '8');
  await submit(page);
  await expectPassed(page);

  // T4 — 2 ÷ 1/3이 2보다 작다고 골라 ALWAYS-SMALLER 힌트 ①을 본 뒤 크다와 까닭을 고른다.
  await engineActionTimes(page, '자 놓기', 6);
  await pickCompare(page, 'cmp', '작다');
  await toggleChoice(page, 'why', '나누면 언제나 작아져서');
  await submit(page);
  await expectFailedWithHint(page, '1/3 막대가 2 안에 몇 번 들어갈까?', ['6']);
  await pickCompare(page, 'cmp', '크다');
  await toggleChoice(page, 'why', '1/3이 2 안에 6번 들어가서');
  await submit(page);
  await expectPassed(page, true);
});

test('A2 이중 수직선으로 찾기 — 대표 오답 뒤 고쳐서 일곱 과제를 통과한다', async ({ page }) => {
  await openActivity(page, 'g6s2u1.A2', '이중 수직선으로 찾기');
  await screenshot(page, 'g6s2u1-a2.png');

  // T1 — 아래 값을 1/3로 틀린 뒤, ÷2를 눌러 1/2을 찾는다.
  await typeFraction(page, 'v', '1', '3');
  await submit(page);
  await expectFailedWithHint(page, '2/3을 반으로 나누면 1/3이지?', ['1/2']);
  await engineAction(page, '÷ 2');
  await clearNumber(page, 'v');
  await typeFraction(page, 'v', '1', '2');
  await submit(page);
  await expectPassed(page);

  // T2 — 아래 값을 2/3로 틀린 뒤, ÷2 → ×3으로 3/2을 찾는다.
  await typeFraction(page, 'v', '2', '3');
  await submit(page);
  await expectFailedWithHint(page, '1/3이 몇 개 모이면 1이 될까?', ['3/2']);
  await engineAction(page, '÷ 2');
  await engineAction(page, '× 3');
  await clearNumber(page, 'v');
  await typeFraction(page, 'v', '3', '2');
  await submit(page);
  await expectPassed(page);

  // T3 — 위 3/4까지 찾고, 피제수를 뒤집은 8/9로 틀려 INVERT-WRONG 힌트 ①을 본 뒤 고친다.
  await engineAction(page, '÷ 2');
  await engineAction(page, '× 3');
  await engineAction(page, '× 3');
  await engineAction(page, '÷ 2');
  await engineAction(page, '÷ 2');
  await toggleChoice(page, 'expr', '4/3 × 2/3');
  await typeFraction(page, 'v', '8', '9');
  await submit(page);
  await expectFailedWithHint(page, "어떤 수로 '재고' 있었지?", ['9/8']);
  // 같은 오답을 한 번 더 내면 오개념 힌트 ②의 그림이 함께 나온다.
  await submit(page);
  await expectFailedWithHint(
    page,
    '어떤 수로 재고 있었는지 그림에서 대응선을 따라가 볼까',
    ['9/8'],
    2,
  );
  await expect(page.locator('[data-overlay="pair-replay"]')).toHaveCount(1);
  await toggleChoice(page, 'expr', '3/4 × 3/2');
  await clearNumber(page, 'v');
  await typeFraction(page, 'v', '9', '8');
  await submit(page);
  await expectPassed(page);

  // T4 — ÷3 → ×5 → ÷6 → ×5로 5/6까지 찾고, 피제수를 뒤집은 18/25로 틀린 뒤 고친다.
  await engineAction(page, '÷ 3');
  await engineAction(page, '× 5');
  await engineAction(page, '÷ 6');
  await engineAction(page, '× 5');
  await typeFraction(page, 'v', '18', '25');
  await submit(page);
  await expectFailedWithHint(page, "어떤 수로 '재고' 있었지?", ['25/18']);
  await clearNumber(page, 'v');
  await typeFraction(page, 'v', '25', '18');
  await submit(page);
  await expectPassed(page);

  // T5 — 1/2로 틀려 INVERT-WRONG 힌트 ①을 본 뒤 2/1로 고친다.
  await typeStepFraction(page, 1, 0, '1', '2');
  await submit(page);
  await expectFailedWithHint(page, "어떤 수로 '재고' 있었지?", ['2/1']);
  await clearStepLine(page);
  await typeStepFraction(page, 1, 0, '2', '1');
  await submit(page);
  await expectPassed(page);

  // T6 — 1/10로 틀려 INVERT-WRONG 힌트 ①을 본 뒤 10/1로 고친다.
  await typeStepFraction(page, 1, 0, '1', '10');
  await submit(page);
  await expectFailedWithHint(page, "어떤 수로 '재고' 있었지?", ['10/1']);
  await clearStepLine(page);
  await typeStepFraction(page, 1, 0, '10', '1');
  await submit(page);
  await expectPassed(page);

  // T7 — 1/2로 틀려 INVERT-WRONG 힌트 ①을 본 뒤 2/1로 고친다.
  await typeStepFraction(page, 1, 0, '1', '2');
  await submit(page);
  await expectFailedWithHint(page, "어떤 수로 '재고' 있었지?", ['2/1']);
  await clearStepLine(page);
  await typeStepFraction(page, 1, 0, '2', '1');
  await submit(page);
  await expectPassed(page, true);
});

test('크롬북·전자칠판 첫 화면에 응답 칸과 확인하기가 들어온다', async ({ page }, testInfo) => {
  test.skip(
    testInfo.project.name === 'ipad',
    '아이패드는 판을 위아래로 두어 짧은 스크롤을 허용한다',
  );

  const cases = [
    { id: 'g6s2u1.A1', title: '나누는 수 막대로 재기' },
    { id: 'g6s2u1.A2', title: '이중 수직선으로 찾기' },
  ] as const;

  for (const item of cases) {
    await openActivity(page, item.id, item.title);
    await page.evaluate(() => window.scrollTo(0, 0));
    await expectNoPanelInnerScroll(page);
    if (item.id === 'g6s2u1.A2') {
      // A2는 크롬북에서 첫 화면(672px)을 넘는다. 판 안 스크롤 없이 페이지 스크롤로 확인한다.
      await expectContentPanelsReachable(page);
      await expect(responseSlot(page)).toBeVisible();
      continue;
    }
    await expect(page.getByRole('button', { name: '확인하기' })).toBeInViewport({ ratio: 1 });
    await expect(responseSlot(page)).toBeInViewport({ ratio: 1 });
  }
});

test('오프라인에서도 g6s2u1.A1 활동이 열린다', async ({ page, context }) => {
  await page.goto(PREVIEW_URL);
  await page.getByRole('button', { name: '1번', exact: true }).click();
  await page.getByRole('button', { name: '건너뛰기' }).click();
  await expect(page).toHaveURL(/#\/map$/);
  await page.goto(`${PREVIEW_URL}/#/activity/g6s2u1.A1`);
  await expect(page.getByRole('heading', { name: '나누는 수 막대로 재기' })).toBeVisible();

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
  await expect(page.getByRole('heading', { name: '나누는 수 막대로 재기' })).toBeVisible();
  await expect(page.getByRole('button', { name: '확인하기' })).toBeVisible();
});
