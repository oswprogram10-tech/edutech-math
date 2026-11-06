import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { PREVIEW_URL } from '../../../playwright.config';
import { expectNoPanelInnerScroll } from '../panel-layout';
import { logicalToScreen } from '../canvas-point';

/**
 * T022 g4s2u1 「분수의 덧셈과 뺄셈」 단원 E2E.
 * 활동마다 과제를 대표 오답 → 힌트 ① → 정답 순서로 끝까지 해 본다.
 * 오개념 일곱 코드가 이 단원 과제에서 실제로 감지되는지도 확인한다.
 * 아이패드(WebKit)·크롬북·전자칠판 세 뷰포트에서 같은 흐름을 확인한다.
 * 좌표는 화면 픽셀이 아니라 엔진의 논리 좌표(1000×600)로 적는다.
 */

interface Canvas {
  readonly panel: Locator;
  /** 화면 픽셀 좌표. 버튼 클릭으로 스크롤이 바뀔 수 있어 누를 때마다 다시 잰다. */
  readonly at: (x: number, y: number) => Promise<{ x: number; y: number }>;
}

// 과제 하나에 오답·힌트·수정이 여러 번 이어져 기본 30초로는 모자라다.
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

async function canvasOf(page: Page, name: string, testId: string): Promise<Canvas> {
  const panel = slot(page, name);
  const canvas = panel.getByTestId(testId);
  await expect(canvas).toBeVisible();
  const box = await canvas.boundingBox();
  if (!box) throw new Error(`그림 상자를 찾을 수 없습니다: ${name}`);
  return {
    panel,
    at: async (x, y) => {
      // 캔버스가 화면보다 커서 스크롤 위치에 따라 위쪽이 잘린다.
      // 조작 전에 캔버스 위쪽을 화면 위에 맞춰 논리 좌표가 화면 안에 오게 한다.
      await canvas.evaluate((element) =>
        element.scrollIntoView({ block: 'start', inline: 'nearest' }),
      );
      const fresh = await canvas.boundingBox();
      if (!fresh) throw new Error(`그림 상자를 다시 찾을 수 없습니다: ${name}`);
      return logicalToScreen(fresh, x, y);
    },
  };
}

/** F05 add-sub처럼 뷰가 하나면 main, 둘이면 left에 조작 버튼이 있다. */
async function engineSlot(page: Page): Promise<Locator> {
  const left = slot(page, 'left');
  return (await left.count()) > 0 ? left : slot(page, 'main');
}

async function engineAction(page: Page, name: string): Promise<void> {
  const target = await engineSlot(page);
  await target.getByRole('button', { name, exact: true }).click();
}

async function clearNumber(page: Page, id: string): Promise<void> {
  // 입력 대상 필드를 먼저 고른 뒤, 필드 밖에 하나뿐인 키패드의 지우기를 누른다.
  await field(page, id).getByRole('button').first().click();
  await responseSlot(page).getByRole('button', { name: '모두 지우기' }).click();
}

/** 분수 틀에 분자 → 분모 순서로 넣는다. */
async function typeFraction(page: Page, id: string, numerator: string, denominator: string) {
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

test('A1 조각 세기 덧셈·뺄셈 — 대표 오답 뒤 고쳐서 다섯 과제를 통과한다', async ({ page }) => {
  await openActivity(page, 'g4s2u1.A1', '조각 세기 덧셈·뺄셈');
  await screenshot(page, 'g4s2u1-a1.png');

  // T1 — 2/7 + 3/7을 합친 뒤 분모끼리 더한 5/14로 틀린다.
  await engineAction(page, '합치기');
  await typeFraction(page, 'ans', '5', '14');
  await submit(page);
  await expectFailedWithHint(page, '조각의 크기가 달라졌나요', ['5/7']);
  await clearNumber(page, 'ans');
  await typeFraction(page, 'ans', '5', '7');
  await submit(page);
  await expectPassed(page);

  // T2 — 합친 뒤 분모를 2배로 한 6/10으로 틀리고, 대분수 변환을 1 6/5로 틀린다.
  await engineAction(page, '합치기');
  await typeFraction(page, 'ans', '6', '10');
  await submit(page);
  await expectFailedWithHint(page, '조각의 크기가 1/10로 바뀌었나요', ['6/5', '1 1/5']);
  await clearNumber(page, 'ans');
  await typeMixed(page, 'ans', '1', '6', '5');
  await submit(page);
  await expectFailedWithHint(page, '꽉 찬 막대 1개와 남은 1/5 조각', ['6/5', '1 1/5'], 2);
  await clearNumber(page, 'ans');
  await typeMixed(page, 'ans', '1', '1', '5');
  await submit(page);
  await expectPassed(page);

  // T3 — 5/6 − 2/6을 덜어 낸 뒤 더한 7/6으로 틀린다.
  await engineAction(page, '덜어 내기');
  await typeFraction(page, 'ans', '7', '6');
  await submit(page);
  await expectFailedWithHint(page, '1/6 조각 5개에서 2개를 덜어 내면', ['1/2']);
  await clearNumber(page, 'ans');
  await typeFraction(page, 'ans', '1', '2');
  await submit(page);
  await expectPassed(page);

  // T4 — 자연수 1을 풀어 덜어 낸 뒤 1을 그대로 둔 3/8로 틀린다.
  await engineAction(page, '자연수 1 풀기');
  await engineAction(page, '덜어 내기');
  await typeFraction(page, 'ans', '3', '8');
  await submit(page);
  await expectFailedWithHint(page, '1을 1/8 조각으로 나타내면', ['5/8']);
  await clearNumber(page, 'ans');
  await typeFraction(page, 'ans', '5', '8');
  await submit(page);
  await expectPassed(page);

  // T5 — 수직선에 4/9와 11/9를 찍고 점프를 그린 뒤, 분모를 더한 11/18로 틀린다.
  const line = await canvasOf(page, 'main', 'number-line-canvas');
  const start = await line.at(277.78, 300);
  await page.mouse.click(start.x, start.y);
  const end = await line.at(588.89, 300);
  await page.mouse.click(end.x, end.y);
  await expect(line.panel.locator('[data-point-id]')).toHaveCount(2);
  const from = await line.at(277.78, 300);
  const to = await line.at(588.89, 300);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 8 });
  await page.mouse.up();
  await expect(line.panel.getByRole('button', { name: '점프 지우기' })).toBeVisible();

  await typeFraction(page, 'ans', '11', '18');
  await submit(page);
  await expectFailedWithHint(page, '1을 지나 몇 칸 더 가나요', ['11/9', '1 2/9']);
  await clearNumber(page, 'ans');
  await typeMixed(page, 'ans', '1', '2', '9');
  await submit(page);
  await expectPassed(page, true);
});

test('A2 대분수 막대 쪼개기 — 대표 오답 뒤 고쳐서 다섯 과제를 통과한다', async ({ page }) => {
  await openActivity(page, 'g4s2u1.A2', '대분수 막대 쪼개기');
  await screenshot(page, 'g4s2u1-a2.png');

  // T1 — 합친 뒤 분모끼리 더한 3 7/16으로 틀린다.
  await engineAction(page, '합치기');
  await typeMixed(page, 'ans', '3', '7', '16');
  await submit(page);
  await expectFailedWithHint(page, '자연수 부분끼리, 분수 부분끼리', ['3 7/8', '31/8']);
  await clearNumber(page, 'ans');
  await typeMixed(page, 'ans', '3', '7', '8');
  await submit(page);
  await expectPassed(page);

  // T2 — 합치지 않은 채 3 7/5로 끝내 틀린 뒤, 합쳐서 4 2/5로 고친다.
  await typeMixed(page, 'ans', '3', '7', '5');
  await submit(page);
  await expectFailedWithHint(page, '분수 부분 7/5에 꽉 찬 막대가', ['4 2/5', '22/5']);
  await engineAction(page, '합치기');
  await clearNumber(page, 'ans');
  await typeMixed(page, 'ans', '4', '2', '5');
  await submit(page);
  await expectPassed(page);

  // T3 — 덜어 낸 뒤 분모를 더한 2 3/14로 틀린다.
  await engineAction(page, '덜어 내기');
  await typeMixed(page, 'ans', '2', '3', '14');
  await submit(page);
  await expectFailedWithHint(page, '각각 얼마씩 덜어 내나요', ['2 3/7', '17/7']);
  await clearNumber(page, 'ans');
  await typeMixed(page, 'ans', '2', '3', '7');
  await submit(page);
  await expectPassed(page);

  // T4 — 자연수 1을 풀어 덜어 낸 뒤, 거꾸로 뺀 2 2/4와 10조각으로 바꾼 3 0/4로 차례로 틀린다.
  await engineAction(page, '자연수 1 풀기');
  await engineAction(page, '덜어 내기');
  await typeMixed(page, 'ans', '2', '2', '4');
  await submit(page);
  await expectFailedWithHint(page, '1/4에서 3/4을 덜어 낼 수 있나요', ['1 2/4', '1 1/2', '3/2']);
  await clearNumber(page, 'ans');
  await typeMixed(page, 'ans', '3', '0', '4');
  await submit(page);
  await expectFailedWithHint(
    page,
    '막대 하나를 쪼갠 조각 수는 무엇으로 정해지나요',
    ['1 2/4', '1 1/2', '3/2', '10개', '4개'],
    2,
  );
  await clearNumber(page, 'ans');
  await typeMixed(page, 'ans', '1', '2', '4');
  await submit(page);
  await expectPassed(page);

  // T5 — 자연수 1을 풀어 덜어 낸 뒤 자연수만 뺀 3 2/3으로 틀린다.
  await engineAction(page, '자연수 1 풀기');
  await engineAction(page, '덜어 내기');
  await typeMixed(page, 'ans', '3', '2', '3');
  await submit(page);
  await expectFailedWithHint(page, '5를 1/3 조각으로 모두 나타내면', ['2 1/3', '7/3']);
  await clearNumber(page, 'ans');
  await typeMixed(page, 'ans', '2', '1', '3');
  await submit(page);
  await expectPassed(page, true);
});

test('A3 줄 단위 풀이 진단 — 대표 오답 뒤 고쳐서 다섯 과제를 통과한다', async ({ page }) => {
  await openActivity(page, 'g4s2u1.A3', '줄 단위 풀이 진단');
  await screenshot(page, 'g4s2u1-a3.png');

  // T1 — 2/7 + 3/7을 분모끼리 더한 5/14로 틀린다.
  await typeStepFraction(page, 1, 0, '5', '14');
  await submit(page);
  await expectFailedWithHint(page, '조각의 크기가 바뀌었나요', ['5/7']);
  await retypeStepField(page, 1, 0, 'den', '7', 2);
  await submit(page);
  await expectPassed(page);

  // T2 — 친구의 둘째 줄을 고르고 3/10으로 고쳐 틀린 뒤 3/5으로 바로잡는다.
  await page.getByTestId('sample-line-1').click();
  await expect(page.getByTestId('sample-line-1')).toHaveAttribute('aria-pressed', 'true');
  await typeStepFraction(page, 2, 0, '3', '10');
  await submit(page);
  await expectFailedWithHint(page, '친구가 쓴 둘째 줄의 값이 첫 줄보다 작아졌나요', ['3/5']);
  await retypeStepField(page, 2, 0, 'den', '5', 2);
  await submit(page);
  await expectPassed(page);

  // T3 — 친구의 둘째 줄을 고르고 1 1/4로 고쳐 틀린 뒤 1 1/2로 바로잡는다.
  await page.getByTestId('sample-line-1').click();
  await expect(page.getByTestId('sample-line-1')).toHaveAttribute('aria-pressed', 'true');
  await typeStepMixed(page, 2, 0, '1', '1', '4');
  await submit(page);
  await expectFailedWithHint(page, '1/4에서 3/4을 덜어 낼 수 있나요', ['1 1/2', '3/2']);
  await retypeStepField(page, 2, 0, 'den', '2', 1);
  await submit(page);
  await expectPassed(page);

  // T4 — 자연수 1을 푸는 줄에 1 1/6을 써서 틀린 뒤 1 1/3으로 고친다.
  await typeStepMixed(page, 1, 0, '1', '1', '6');
  await submit(page);
  await expectFailedWithHint(page, '2 1/6에서 5/6을 덜어 낼 수 있나요', ['4/3', '1 1/3']);
  await retypeStepField(page, 1, 0, 'den', '3', 1);
  await submit(page);
  await expectPassed(page);

  // T5 — 1 3/9와 값이 다른 5/9을 써서 틀린 뒤 4/3으로 고친다.
  // 시작 줄도 서로 다른 식에 세므로, 학생이 쓴 식이 하나뿐이면 아직 통과하지 못한다.
  await typeStepFraction(page, 1, 0, '5', '9');
  await submit(page);
  await expectFailedWithHint(page, '1 3/9을 1/9 조각만으로 나타내면', ['12/9', '4/3']);
  await retypeStepField(page, 1, 0, 'num', '4', 1);
  await retypeStepField(page, 1, 0, 'den', '3', 1);
  await submit(page);
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByText('좋아요, 통과했어요!')).toHaveCount(0);

  // + 줄로 서로 다른 식을 하나 더 써서 시작 줄까지 세어 세 가지를 만든다.
  await page.getByTestId('key-add-line').click();
  await typeStepFraction(page, 2, 0, '8', '6');
  await submit(page);
  await expectPassed(page, true);
});

test('크롬북·전자칠판 첫 화면에 응답 칸과 확인하기가 들어온다', async ({ page }, testInfo) => {
  test.skip(
    testInfo.project.name === 'ipad',
    '아이패드는 판을 위아래로 두어 짧은 스크롤을 허용한다',
  );

  const cases = [
    { id: 'g4s2u1.A1', title: '조각 세기 덧셈·뺄셈', hasResponse: true },
    { id: 'g4s2u1.A2', title: '대분수 막대 쪼개기', hasResponse: true },
    { id: 'g4s2u1.A3', title: '줄 단위 풀이 진단', hasResponse: false },
  ] as const;

  for (const item of cases) {
    await openActivity(page, item.id, item.title);
    await page.evaluate(() => window.scrollTo(0, 0));
    await expectNoPanelInnerScroll(page);
    await expect(page.getByRole('button', { name: '확인하기' })).toBeInViewport({ ratio: 1 });
    // A3은 엔진 줄이 곧 답이라 응답 칸이 없다.
    if (item.hasResponse) {
      await expect(responseSlot(page)).toBeInViewport({ ratio: 1 });
    }
  }
});

test('오프라인에서도 g4s2u1.A1 활동이 열린다', async ({ page, context }) => {
  await page.goto(PREVIEW_URL);
  await page.getByRole('button', { name: '1번', exact: true }).click();
  await page.getByRole('button', { name: '건너뛰기' }).click();
  await expect(page).toHaveURL(/#\/map$/);
  await page.goto(`${PREVIEW_URL}/#/activity/g4s2u1.A1`);
  await expect(page.getByRole('heading', { name: '조각 세기 덧셈·뺄셈' })).toBeVisible();

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
  await expect(page.getByRole('heading', { name: '조각 세기 덧셈·뺄셈' })).toBeVisible();
  await expect(page.getByRole('button', { name: '확인하기' })).toBeVisible();
});
