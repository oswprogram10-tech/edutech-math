import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { PREVIEW_URL } from '../../../playwright.config';
import {
  expectChromeBookCanvasSize,
  expectContentPanelsReachable,
  expectFitCanvasVisible,
} from '../panel-layout';

/**
 * T117 g4s2u4 「사각형」 A1 「도형 스무고개」·A2 「사각형 진화 트리」 단원 E2E.
 * 과제마다 대표 오답 → 힌트 ① → 고쳐서 통과 순서로 끝까지 해 본다.
 * 힌트 단계는 과제 실패 횟수로 정해지므로, 한 과제에서 서로 다른 오개념 ①을
 * 보려면 활동을 새로 열어 그 오개념을 첫 실패로 만든다(T117 결정 23).
 */

test.describe.configure({ timeout: 300_000 });

function slot(page: Page, name: string): Locator {
  return page.getByTestId(`runner-slot-${name}`);
}

function main(page: Page): Locator {
  return slot(page, 'main');
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

/** 힌트 ② 오버레이가 엔진의 본 캔버스 svg와 같은 자리·크기에 놓였는지 확인한다. */
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

async function press(page: Page, locator: Locator): Promise<void> {
  await locator.focus();
  await expect(locator).toBeFocused();
  await page.keyboard.press('Enter');
}

/** A1 스무고개: 질문 단추를 누른다. */
async function ask(page: Page, question: string): Promise<void> {
  await main(page).locator(`[data-question="${question}"]`).click();
}

/** A1 스무고개: 카드를 눌러 뒤집어 지운다. */
async function eliminate(page: Page, card: string): Promise<void> {
  await press(page, main(page).locator(`[data-card="${card}"]`));
}

/** A1 스무고개: '이 카드예요'를 켜고 카드를 골라 맞힌다. */
async function guess(page: Page, card: string): Promise<void> {
  await main(page).getByRole('button', { name: '이 카드예요', exact: true }).click();
  await press(page, main(page).locator(`[data-card="${card}"]`));
}

/** A2 역할 바꾸기: 내 카드를 고른다. */
async function pickMine(page: Page, card: string): Promise<void> {
  await press(page, main(page).locator(`[data-card="${card}"]`));
}

function field(page: Page, id: string): Locator {
  return slot(page, 'response').locator(`[data-response-field="${id}"]`);
}

async function choose(page: Page, id: string, label: string): Promise<void> {
  await field(page, id).getByRole('button', { name: label, exact: true }).click();
}

/** A2.T2 계층 트리: 이름 카드를 골라 빈칸에 넣는다. */
async function fillBlank(page: Page, name: string, blank: string): Promise<void> {
  await press(page, main(page).locator(`[data-name-card="${name}"]`));
  await press(page, main(page).locator(`[data-blank="${blank}"]`));
}

async function answerComputerQuestions(page: Page, answer: '예' | '아니요'): Promise<void> {
  for (let step = 0; step < 8; step += 1) {
    const question = main(page).getByTestId('computer-question');
    if ((await question.getAttribute('data-question')) === null) break;
    await main(page).getByRole('button', { name: answer, exact: true }).click();
  }
  await expect(main(page).getByTestId('computer-question')).toHaveText(
    '알았다! 네 카드는 이 중에 있어요.',
  );
}

async function passA2T1(page: Page): Promise<void> {
  await main(page).getByRole('button', { name: '두 쌍 평행', exact: true }).click();
  await main(page).getByRole('button', { name: '흔들기', exact: true }).click();
  await submit(page);
  await expectPassed(page);
}

async function passA2T2(page: Page): Promise<void> {
  await fillBlank(page, 'trapezoid', 'trapezoid');
  await fillBlank(page, 'parallelogram', 'parallelogram');
  await fillBlank(page, 'rhombus', 'rhombus');
  await fillBlank(page, 'rectangle', 'rectangle');
  await fillBlank(page, 'square', 'square');
  await submit(page);
  await expectPassed(page);
}

test('A1 도형 스무고개 — 질문·카드 지우기·역할 바꾸기·질문 고르기', async ({ page }, testInfo) => {
  await openActivity(page, 'g4s2u4.A1', '도형 스무고개');
  await screenshot(page, 'g4s2u4-a1.png');
  // T122로 판이 실행기 판 높이에 맞춰 줄어 세 뷰포트 모두 판 안 스크롤이 없다.
  await expectContentPanelsReachable(page);
  const boxes = await expectFitCanvasVisible(page);
  // sorter 판은 16장 카드가 들어가 아이패드에서 판이 첫 화면보다 조금 길다(실측 0.92).
  // 판은 잘리지 않고 판 안 스크롤도 없다(expectFitCanvasVisible). '확인하기'는 앱 스크롤로 닿는다.
  await expect(main(page).getByTestId('sorter-canvas')).toBeInViewport();
  await expect(page.getByRole('button', { name: '확인하기' })).toBeInViewport();
  if (testInfo.project.name === 'chromebook') expectChromeBookCanvasSize(boxes);

  // T1 — 평행한 변 두 쌍을 묻고 q08(정사각형)을 지워 RHOMBUS ①.
  await ask(page, 'all-sides-equal');
  await eliminate(page, 'q08');
  await submit(page);
  await expectFailedWithHint(
    page,
    '네 변의 길이와 각을 다시 살펴볼까요? 질문의 답과 정말 맞지 않나요?',
    1,
  );

  // 같은 오답을 한 번 더 내 ② 문구와 upright-card 오버레이 정렬을 확인한다.
  await submit(page);
  await expectFailedWithHint(page, '카드를 돌려 바로 세운 모습을 겹쳐 그렸어요.', 2);
  await expectOverlayOverCanvas(main(page), 'upright-card', 'sorter-canvas');

  // PROTOTYPE ①을 각각 첫 실패로 보려고 활동을 새로 연다.
  await openActivity(page, 'g4s2u4.A1', '도형 스무고개');
  await ask(page, 'parallel-pairs==2');
  await eliminate(page, 'q06');
  await submit(page);
  await expectFailedWithHint(page, '질문의 답과 이 카드의 성질이 정말 맞지 않나요?', 1);

  // T1 통과 — 질문 3개로 q11(비밀 카드)과 서명이 같은 카드만 남긴다.
  await openActivity(page, 'g4s2u4.A1', '도형 스무고개');
  await ask(page, 'parallel-pairs==2');
  await ask(page, 'all-sides-equal');
  await ask(page, 'has-right-angle');
  await guess(page, 'q11');
  await submit(page);
  await expectPassed(page);

  // T2 일반 ① — 질문을 5개 쓰면 4개 제한에 걸린다.
  await ask(page, 'parallel-pairs>=1');
  await ask(page, 'parallel-pairs==2');
  await ask(page, 'all-sides-equal');
  await ask(page, 'has-right-angle');
  await ask(page, 'opposite-sides-equal');
  await guess(page, 'q15');
  await submit(page);
  await expectFailedWithHint(page, '어떤 질문이 카드를 가장 많이 반으로 나눌까요?', 1);

  // T3 통과를 위해 활동을 새로 열고 T1·T2를 다시 통과한다.
  await openActivity(page, 'g4s2u4.A1', '도형 스무고개');
  await ask(page, 'parallel-pairs==2');
  await ask(page, 'all-sides-equal');
  await ask(page, 'has-right-angle');
  await guess(page, 'q11');
  await submit(page);
  await expectPassed(page);
  await ask(page, 'parallel-pairs>=1');
  await ask(page, 'parallel-pairs==2');
  await ask(page, 'all-sides-equal');
  await ask(page, 'has-right-angle');
  await guess(page, 'q15');
  await submit(page);
  await expectPassed(page);

  // T3 — q08을 골라 첫 질문에 '아니요' → 근거 문장, 끝까지 답한 뒤 RHOMBUS ①.
  await pickMine(page, 'q08');
  await expect(main(page).getByTestId('computer-question')).toHaveAttribute(
    'data-question',
    'parallel-pairs==2',
  );
  await main(page).getByRole('button', { name: '아니요', exact: true }).click();
  await expect(main(page).getByTestId('swap-evidence')).toContainText('평행한 변이 두 쌍');
  await answerComputerQuestions(page, '예');
  await submit(page);
  await expectFailedWithHint(
    page,
    '네 변의 길이와 각을 다시 살펴볼까요? 질문의 답과 정말 맞지 않나요?',
    1,
  );

  // 역할을 두 번 바꾸면 T3가 처음부터 다시 시작된다(Opus 결정).
  await main(page).getByRole('button', { name: '내가 맞히기', exact: true }).click();
  await main(page).getByRole('button', { name: '내가 답하기', exact: true }).click();
  await expect(main(page).getByText('내 카드로 쓸 카드를 골라 보세요.')).toBeVisible();

  await pickMine(page, 'q12');
  await expect(main(page).getByTestId('computer-question')).toHaveAttribute(
    'data-question',
    'parallel-pairs==2',
  );
  await answerComputerQuestions(page, '예');
  await submit(page);
  await expectPassed(page);

  // T4 — eq+p2는 마름모도 남아 일반 ①, eq+rt는 정사각형만 남아 통과.
  await choose(page, 'q', '네 변의 길이가 모두 같나요?');
  await choose(page, 'q', '평행한 변이 두 쌍 있나요?');
  await submit(page);
  await expectFailedWithHint(
    page,
    '네 변이 같은 사각형에는 어떤 것들이 있나요? 그중 정사각형만 가진 성질은?',
    1,
  );
  await choose(page, 'q', '평행한 변이 두 쌍 있나요?');
  await choose(page, 'q', '직각이 하나 이상 있나요?');
  await submit(page);
  await expectPassed(page, true);
});

test('A2 사각형 진화 트리 — 조건·흔들기·이름 트리·포함 관계 고르기', async ({ page }, testInfo) => {
  await openActivity(page, 'g4s2u4.A2', '사각형 진화 트리');
  await screenshot(page, 'g4s2u4-a2.png');
  await expectContentPanelsReachable(page);
  const boxes = await expectFitCanvasVisible(page);
  await expect(main(page).getByTestId('geo-canvas')).toBeInViewport({ ratio: 1 });
  if (testInfo.project.name === 'chromebook') expectChromeBookCanvasSize(boxes);

  // T1 — '네 변 같음'까지 켜면 평행사변형 조건이 아니어서 일반 ①.
  const twoPairs = main(page).getByRole('button', { name: '두 쌍 평행', exact: true });
  const equalSides = main(page).getByRole('button', { name: '네 변 같음', exact: true });
  await twoPairs.click();
  await expect(twoPairs).toHaveAttribute('aria-pressed', 'true');
  await equalSides.click();
  await main(page).getByRole('button', { name: '흔들기', exact: true }).click();
  await submit(page);
  await expectFailedWithHint(
    page,
    '평행사변형은 어떤 변들이 평행한가요? 지금 켠 조건과 견주어 볼까요?',
    1,
  );

  await equalSides.click();
  await expect(equalSides).toHaveAttribute('aria-pressed', 'false');
  await main(page).getByRole('button', { name: '흔들기', exact: true }).click();
  await submit(page);
  await expectPassed(page);

  // T2 — 사다리꼴·평행사변형을 맞바꿔 넣어 일반 ①, 고쳐서 통과.
  await fillBlank(page, 'trapezoid', 'parallelogram');
  await fillBlank(page, 'parallelogram', 'trapezoid');
  await fillBlank(page, 'rhombus', 'rhombus');
  await fillBlank(page, 'rectangle', 'rectangle');
  await fillBlank(page, 'square', 'square');
  await submit(page);
  await expectFailedWithHint(
    page,
    '지금 켠 조건으로 만든 모양은 트리의 어느 칸에 있나요? 그 모양의 이름은?',
    1,
  );
  await fillBlank(page, 'trapezoid', 'trapezoid');
  await fillBlank(page, 'parallelogram', 'parallelogram');
  await submit(page);
  await expectPassed(page);

  // T3 — 마름모의 각 조건으로 판단한 오답 → SQUARE-NOT-RECT ①, 고쳐서 통과.
  await choose(page, 'why', '아니요, 정사각형은 네 각이 직각이라 마름모와 달라요.');
  await submit(page);
  await expectFailedWithHint(page, '마름모의 조건을 하나씩 정사각형에 확인해 볼까요?', 1);
  await choose(page, 'why', '예, 네 변의 길이가 모두 같으니까요.');
  await submit(page);
  await expectPassed(page);

  // T4 — 배타 정의 오답 → PARALLELOGRAM-NOT-TRAPEZOID ①, 고쳐서 통과.
  await choose(page, 'why', '아니요, 평행한 변이 두 쌍이면 사다리꼴이 아니에요.');
  await submit(page);
  await expectFailedWithHint(page, '사다리꼴의 조건이 뭐였지요? 평행사변형에도 그게 있나요?', 1);
  await choose(page, 'why', '예, 평행한 변이 한 쌍이라도 있으니까요.');
  await submit(page);
  await expectPassed(page);

  // T5 — '그런 사각형은 없어요' → SQUARE-NOT-RECT ①, 고쳐서 끝낸다.
  await choose(page, 'name', '그런 사각형은 없어요.');
  await submit(page);
  await expectFailedWithHint(
    page,
    '직사각형의 조건과 마름모의 조건을 모두 가진 사각형을 카드에서 찾아볼까요?',
    1,
  );
  await choose(page, 'name', '정사각형');
  await submit(page);
  await expectPassed(page, true);

  // T3의 다른 오개념(RHOMBUS-ORIENT)도 ①로 보려고 활동을 새로 열어 T1·T2를 다시 통과한다.
  await openActivity(page, 'g4s2u4.A2', '사각형 진화 트리');
  await passA2T1(page);
  await passA2T2(page);
  await choose(page, 'why', '아니요, 마름모는 비스듬히 기울어진 모양이에요.');
  await submit(page);
  await expectFailedWithHint(
    page,
    '네 변의 길이와 각을 재 볼까요? 놓인 방향이 바뀌면 성질도 바뀌나요?',
    1,
  );
});

test('오프라인에서도 g4s2u4.A1 활동이 열린다', async ({ page, context }) => {
  await page.goto(PREVIEW_URL);
  await page.getByRole('button', { name: '1번', exact: true }).click();
  await page.getByRole('button', { name: '건너뛰기' }).click();
  await expect(page).toHaveURL(/#\/map$/);
  await page.goto(`${PREVIEW_URL}/#/activity/g4s2u4.A1`);
  await expect(page.getByRole('heading', { name: '도형 스무고개' })).toBeVisible();

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
  await expect(page.getByRole('heading', { name: '도형 스무고개' })).toBeVisible();
  await expect(page.getByRole('button', { name: '확인하기' })).toBeVisible();
});
