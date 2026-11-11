import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { PREVIEW_URL } from '../../../playwright.config';
import {
  expectChromeBookCanvasSize,
  expectContentPanelsReachable,
  expectFitCanvasVisible,
} from '../panel-layout';

/**
 * T115 g4s1u4 「평면도형의 이동」 A1 「트레이싱 페이퍼」·A2 「쪽매맞춤 디자이너」 단원 E2E.
 * 과제마다 대표 오답 → 힌트 ① → 고쳐서 통과 순서로 끝까지 해 본다.
 * 아이패드(WebKit)·크롬북·전자칠판 세 뷰포트에서 같은 흐름을 확인한다.
 * 힌트 ②는 A1.T2의 point-track 하나만 오버레이 정렬까지 확인한다(T115 결정 13).
 */

test.describe.configure({ timeout: 300_000 });

function slot(page: Page, name: string): Locator {
  return page.getByTestId(`runner-slot-${name}`);
}

function canvas(page: Page): Locator {
  return slot(page, 'main').getByTestId('transform-canvas');
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

async function focusCanvas(page: Page): Promise<void> {
  const board = canvas(page);
  await board.focus();
  await expect(board).toBeFocused();
}

async function press(page: Page, key: string, times = 1): Promise<void> {
  for (let index = 0; index < times; index += 1) await page.keyboard.press(key);
}

async function pressKeys(page: Page, keys: readonly string[]): Promise<void> {
  for (const key of keys) await page.keyboard.press(key);
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
async function expectOverlayOverCanvas(panel: Locator, overlayName: string): Promise<void> {
  const overlay = panel.locator(`[data-overlay="${overlayName}"]`);
  await expect(overlay).toBeVisible();
  const board = panel.getByTestId('transform-canvas');
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

async function clearPaint(page: Page): Promise<void> {
  await focusCanvas(page);
  await page.keyboard.press('Delete');
}

/**
 * 칠한 칸을 지운 뒤 커서를 시작 도형의 왼쪽 위 칸으로 되돌린다.
 * E10 예측 판은 Delete로 칠만 지우고 커서는 그대로 둔다(views/PredictView.tsx).
 */
async function resetPaintCursor(page: Page, cell: readonly [number, number]): Promise<void> {
  await clearPaint(page);
  await press(page, 'ArrowLeft', 9);
  await press(page, 'ArrowUp', 9);
  await press(page, 'ArrowRight', cell[0]);
  await press(page, 'ArrowDown', cell[1]);
}

/** T1 정답 칸 6,3 7,3 8,3 6,4 7,4 6,5 6,6. 커서 (1,3)에서 시작. */
const T1_RIGHT_5 = [
  'ArrowRight',
  'ArrowRight',
  'ArrowRight',
  'ArrowRight',
  'ArrowRight',
  'Enter',
  'ArrowRight',
  'Enter',
  'ArrowRight',
  'Enter',
  'ArrowLeft',
  'ArrowLeft',
  'ArrowDown',
  'Enter',
  'ArrowRight',
  'Enter',
  'ArrowLeft',
  'ArrowDown',
  'Enter',
  'ArrowDown',
  'Enter',
] as const;

/** T2 정답 칸 5,3 6,3 7,3 6,4 7,4 7,5 7,6. 커서 (2,3)에서 시작. */
const T2_FLIP_RIGHT = [
  'ArrowRight',
  'ArrowRight',
  'ArrowRight',
  'Enter',
  'ArrowRight',
  'Enter',
  'ArrowRight',
  'Enter',
  'ArrowLeft',
  'ArrowDown',
  'Enter',
  'ArrowRight',
  'Enter',
  'ArrowDown',
  'Enter',
  'ArrowDown',
  'Enter',
] as const;

/** T2 FLIP-TURN 대표 오답 칸 5,6 6,6 7,6 6,5 7,5 7,4 7,3(방향 r180). */
const T2_FLIP_TURN_WRONG = [
  'ArrowRight',
  'ArrowRight',
  'ArrowRight',
  'ArrowRight',
  'ArrowRight',
  'Enter',
  'ArrowDown',
  'Enter',
  'ArrowLeft',
  'ArrowDown',
  'Enter',
  'ArrowRight',
  'Enter',
  'ArrowLeft',
  'ArrowLeft',
  'ArrowDown',
  'Enter',
  'ArrowRight',
  'Enter',
  'ArrowRight',
  'Enter',
] as const;

/** T3 정답 칸 0,3 1,3 2,3 3,3 2,4 3,4 3,5. 커서 (4,3)에서 시작. */
const T3_TURN_CW90 = [
  'ArrowLeft',
  'ArrowLeft',
  'ArrowLeft',
  'ArrowLeft',
  'Enter',
  'ArrowRight',
  'Enter',
  'ArrowRight',
  'Enter',
  'ArrowRight',
  'Enter',
  'ArrowLeft',
  'ArrowDown',
  'Enter',
  'ArrowRight',
  'Enter',
  'ArrowDown',
  'Enter',
] as const;

/** T3 TURN-CENTER 대표 오답 칸 4,3 5,3 6,3 7,3 6,4 7,4 7,5(방향은 같고 자리만 다름). */
const T3_TURN_CENTER_WRONG = [
  'Enter',
  'ArrowRight',
  'Enter',
  'ArrowRight',
  'Enter',
  'ArrowRight',
  'Enter',
  'ArrowLeft',
  'ArrowDown',
  'Enter',
  'ArrowRight',
  'Enter',
  'ArrowDown',
  'Enter',
] as const;

/** E10 쪽매맞춤 정사각 타일 9장(한 번에 6칸씩 밀기). */
const SQUARE_NINE = [
  'Enter',
  'ArrowRight',
  'Enter',
  'ArrowRight',
  'Enter',
  'ArrowDown',
  'Enter',
  'ArrowLeft',
  'Enter',
  'ArrowLeft',
  'Enter',
  'ArrowDown',
  'Enter',
  'ArrowRight',
  'Enter',
  'ArrowRight',
  'Enter',
] as const;

/**
 * 정육각형 21장. 도장 중심 (1,1)에서 시작하는 T115 결정 13의 경로
 * (U E / R D E / R R U E ... LLLLLLLL D E ...).
 */
const HEXAGON_21 = [
  ...'UE'.split(''),
  ...'RDE'.split(''),
  ...'RRUE'.split(''),
  ...'RDE'.split(''),
  ...'RRUE'.split(''),
  ...'RDE'.split(''),
  ...'LLLLLLLLDE'.split(''),
  ...'RRRE'.split(''),
  ...'RRRE'.split(''),
  ...'LLLLLDE'.split(''),
  ...'RRRE'.split(''),
  ...'RRRE'.split(''),
  ...'LLLLLLLLDE'.split(''),
  ...'RRRE'.split(''),
  ...'RRRE'.split(''),
  ...'LLLLLDE'.split(''),
  ...'RRRE'.split(''),
  ...'RRRE'.split(''),
  ...'LLLLLLLLDE'.split(''),
  ...'RRRE'.split(''),
  ...'RRRE'.split(''),
].map((token) =>
  token === 'U'
    ? 'ArrowUp'
    : token === 'D'
      ? 'ArrowDown'
      : token === 'L'
        ? 'ArrowLeft'
        : token === 'R'
          ? 'ArrowRight'
          : 'Enter',
);

function field(page: Page, id: string): Locator {
  return slot(page, 'response').locator(`[data-response-field="${id}"]`);
}

async function typeNumber(page: Page, id: string, digits: string): Promise<void> {
  const box = field(page, id);
  await box.getByRole('button', { name: /빈칸$/ }).first().click();
  for (const digit of digits) await page.keyboard.press(digit);
}

async function clearNumber(page: Page, id: string): Promise<void> {
  // 입력 대상 필드를 먼저 고른 뒤, 필드 밖에 하나뿐인 키패드의 지우기를 누른다.
  await field(page, id).getByRole('button').first().click();
  await slot(page, 'response').getByRole('button', { name: '모두 지우기' }).click();
}

async function toggleChoice(page: Page, id: string, label: string): Promise<void> {
  await field(page, id).getByRole('button', { name: label, exact: true }).click();
}

async function clickTile(page: Page, label: string): Promise<void> {
  await slot(page, 'main').getByRole('button', { name: label, exact: true }).click();
}

test('A1 트레이싱 페이퍼 — 대표 오답 뒤 고쳐서 다섯 과제를 통과한다', async ({ page }) => {
  await openActivity(page, 'g4s1u4.A1', '트레이싱 페이퍼');
  await screenshot(page, 'g4s1u4-a1.png');
  await expectContentPanelsReachable(page);

  // T1 — 오른쪽으로 5칸 밀기 예측. 칸 세 개만 칠한 오답.
  await focusCanvas(page);
  await press(page, 'ArrowRight', 5);
  await press(page, 'Enter', 3);
  await submit(page);
  await expectFailedWithHint(page, '결과가 놓일 칸을 어떻게 찾을 수 있을까요?', 1);

  await resetPaintCursor(page, [1, 3]);
  await pressKeys(page, T1_RIGHT_5);
  await submit(page);
  await expectPassed(page);

  // T2 — 오른쪽으로 뒤집기 예측. r180으로 칠한 오답을 두 번 내 ②까지 본다.
  await focusCanvas(page);
  await pressKeys(page, T2_FLIP_TURN_WRONG);
  await submit(page);
  await expectFailedWithHint(
    page,
    '칠한 모양에서 점 ㄱ이 어디에 있는지 시작 도형과 견주어 볼까요?',
    1,
  );
  await submit(page);
  await expectFailedWithHint(page, '칠한 모양의 점 ㄱ과 시작 도형의 점 ㄱ을 이어 보았어요.', 2);
  await expectOverlayOverCanvas(slot(page, 'main'), 'point-track');

  await resetPaintCursor(page, [2, 3]);
  await pressKeys(page, T2_FLIP_RIGHT);
  await submit(page);
  await expectPassed(page);

  // T3 — 점 ㄱ을 중심으로 시계 90° 예측. 중심을 무시한 오답부터 본다.
  await focusCanvas(page);
  await pressKeys(page, T3_TURN_CENTER_WRONG);
  await submit(page);
  await expectFailedWithHint(page, '점 ㄱ을 압정으로 꽂고 돌리면 점 ㄱ은 어디에 있을까요?', 1);

  await resetPaintCursor(page, [4, 3]);
  await pressKeys(page, T3_TURN_CW90);
  await submit(page);
  await expectPassed(page);

  // T4 — 시계 270°를 시계 반대 방향으로 바꾸어 답한다. 270을 써서 DIRECTION ①.
  const turnGroup = slot(page, 'main').locator('section[aria-label="돌리기"]');
  await turnGroup.getByRole('button', { name: '시계', exact: true }).click();
  await turnGroup.getByRole('button', { name: '270°', exact: true }).click();
  await turnGroup.getByRole('button', { name: '돌리기', exact: true }).click();
  await typeNumber(page, 'deg', '270');
  await submit(page);
  await expectFailedWithHint(page, '두 방향으로 같은 모양이 되는 각은 몇 도일까요?', 1);

  await clearNumber(page, 'deg');
  await typeNumber(page, 'deg', '90');
  await submit(page);
  await expectPassed(page);

  // T5 — 결과 도형을 보고 두 번 이동 찾기. R만 누르면 일반 ①.
  await focusCanvas(page);
  await page.keyboard.press('r');
  await submit(page);
  await expectFailedWithHint(page, '결과 도형의 점 ㄱ은 어디에 있을까요?', 1);

  await focusCanvas(page);
  await page.keyboard.press('Backspace');
  await press(page, 'ArrowRight', 5);
  await press(page, 'ArrowDown', 2);
  await page.keyboard.press('r');
  await submit(page);
  await expectPassed(page, true);
});

test('A2 쪽매맞춤 — 정육각형·정오각형·변형 도형 과제를 통과한다', async ({ page }) => {
  await openActivity(page, 'g4s1u4.A2', '쪽매맞춤 디자이너');
  await screenshot(page, 'g4s1u4-a2.png');
  await expectContentPanelsReachable(page);

  // T1 — 정육각형 21장. 한 장만 놓으면 일반 ①.
  await clickTile(page, '정육각형');
  await focusCanvas(page);
  await page.keyboard.press('Enter');
  await submit(page);
  await expectFailedWithHint(page, '정육각형을 옆 칸에 붙여 가면 틀을 채울 수 있을까요?', 1);

  await slot(page, 'main').getByRole('button', { name: '모두 지우기', exact: true }).click();
  await focusCanvas(page);
  await pressKeys(page, HEXAGON_21);
  // 판이 작아지면서(T122) 21장 경로 끝에 빈 칸이 남을 수 있다.
  // 왼쪽으로 한 장씩 붙여 빈틈을 채운 뒤 제출한다.
  for (let index = 0; index < 8; index += 1) {
    const gaps = await slot(page, 'main').locator('[data-gap-cell]').count();
    if (gaps === 0) break;
    await focusCanvas(page);
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('Enter');
  }
  await submit(page);
  await expectPassed(page);

  // T2 — 정오각형은 한 꼭짓점 둘레에 3개까지 붙여도 빈틈이 남는다.
  await clickTile(page, '정오각형');
  await focusCanvas(page);
  await toggleChoice(page, 'fill', '빈틈없이 채울 수 없어요');
  await submit(page);
  await expectFailedWithHint(page, '한 꼭짓점 둘레에 정오각형을 몇 개까지 붙여 볼 수 있을까요?', 1);

  await focusCanvas(page);
  await press(page, 'Enter', 2);
  await submit(page);
  await expectPassed(page);

  // T3 — 정사각형 9장만 채우면 '변 깎기 편집판' ①이 뜬다.
  await focusCanvas(page);
  await pressKeys(page, SQUARE_NINE);
  await submit(page);
  await expectFailedWithHint(page, '변 깎기 편집판에서 한 변을 깎아 변형 도형을 만들어 볼까요?', 1);

  await slot(page, 'main').getByRole('button', { name: '모두 지우기', exact: true }).click();
  await clickTile(page, '변형 도형');
  const editor = slot(page, 'main').getByTestId('tile-editor');
  await editor.focus();
  await page.keyboard.press('Enter');
  await focusCanvas(page);
  await pressKeys(page, SQUARE_NINE);
  await press(page, 'ArrowLeft', 3);
  await page.keyboard.press('Enter');
  await press(page, 'ArrowUp', 1);
  await page.keyboard.press('Enter');
  await press(page, 'ArrowUp', 1);
  await page.keyboard.press('Enter');
  await submit(page);
  await expectPassed(page);

  // T4 — 정사각형 9장, 밀기만 쓴 무늬.
  await focusCanvas(page);
  await pressKeys(page, SQUARE_NINE);
  await toggleChoice(page, 'moves', '밀기');
  await toggleChoice(page, 'moves', '돌리기');
  await submit(page);
  await expectFailedWithHint(page, '도장을 움직일 때 어떤 방법을 썼나요?', 1);

  await toggleChoice(page, 'moves', '돌리기');
  await submit(page);
  await expectPassed(page, true);
});

test('A1.T1 — 엔진 확인 단추 없이 칠한 칸으로만 판정한다', async ({ page }) => {
  await openActivity(page, 'g4s1u4.A1', '트레이싱 페이퍼');
  // selfCheck:false면 엔진 '확인'·'다시 해 보기'가 없다(정답 그림을 보고 베끼지 못한다).
  await expect(slot(page, 'main').getByRole('button', { name: '확인', exact: true })).toHaveCount(
    0,
  );
  await expect(slot(page, 'main').getByRole('button', { name: '다시 해 보기' })).toHaveCount(0);
  // 칠하기·지우기는 남는다.
  await expect(slot(page, 'main').getByRole('button', { name: '칠한 칸 지우기' })).toBeVisible();
  await focusCanvas(page);
  await pressKeys(page, T1_RIGHT_5);
  await submit(page);
  await expectPassed(page);
});

test('A1.T3 ccw90 오답 — 반대 방향으로 칠하면 힌트 ①·②가 나온다', async ({ page }) => {
  await openActivity(page, 'g4s1u4.A1', '트레이싱 페이퍼');
  // T1·T2는 정답으로 통과시킨다.
  await focusCanvas(page);
  await pressKeys(page, T1_RIGHT_5);
  await submit(page);
  await expectPassed(page);
  await resetPaintCursor(page, [2, 3]);
  await pressKeys(page, T2_FLIP_RIGHT);
  await submit(page);
  await expectPassed(page);

  // T3 — 시계 반대 방향 자리(4,0 4,1 5,1 4,2 5,2 6,2 7,2)로 칠하면 오개념 ①·②.
  await focusCanvas(page);
  await press(page, 'ArrowLeft', 9);
  await press(page, 'ArrowUp', 9);
  await press(page, 'ArrowRight', 4);
  await press(page, 'ArrowDown', 0);
  const wrongCcw = [
    'Enter',
    'ArrowDown',
    'Enter',
    'ArrowRight',
    'Enter',
    'ArrowLeft',
    'ArrowDown',
    'Enter',
    'ArrowRight',
    'Enter',
    'ArrowRight',
    'Enter',
    'ArrowRight',
    'Enter',
  ];
  await pressKeys(page, wrongCcw);
  await submit(page);
  await expectFailedWithHint(page, '시계 방향으로 돌면 점 ㄴ은 어느 쪽으로 움직일까요?', 1);
  await submit(page);
  await expectFailedWithHint(page, '시계 방향으로 도는 화살표를 보며 다시 견주어 보세요.', 2);
});

test('A2.T2 정오각형을 채울 수 있다고 답하면 일반 ①이 뜬다', async ({ page }) => {
  await openActivity(page, 'g4s1u4.A2', '쪽매맞춤 디자이너');

  await clickTile(page, '정육각형');
  await focusCanvas(page);
  await pressKeys(page, HEXAGON_21);
  await submit(page);
  await expectPassed(page);

  await clickTile(page, '정오각형');
  await focusCanvas(page);
  await press(page, 'Enter', 2);
  await toggleChoice(page, 'fill', '빈틈없이 채울 수 있어요');
  await submit(page);
  await expectFailedWithHint(page, '한 꼭짓점 둘레에 정오각형을 붙이면 어떻게 될까요?', 1);
});

test('첫 화면에 엔진·확인하기가 들어온다', async ({ page }, testInfo) => {
  await openActivity(page, 'g4s1u4.A1', '트레이싱 페이퍼');
  await page.evaluate(() => window.scrollTo(0, 0));
  // T122로 E10 판이 실행기 판 높이에 맞춰 줄어 판 안 스크롤이 없다.
  await expectContentPanelsReachable(page);
  let boxes = await expectFitCanvasVisible(page);
  await expect(canvas(page)).toBeInViewport({ ratio: 1 });
  await expect(page.getByRole('button', { name: '확인하기' })).toBeInViewport({ ratio: 1 });
  if (testInfo.project.name === 'chromebook') expectChromeBookCanvasSize(boxes);

  await openActivity(page, 'g4s1u4.A2', '쪽매맞춤 디자이너');
  await page.evaluate(() => window.scrollTo(0, 0));
  await expectContentPanelsReachable(page);
  boxes = await expectFitCanvasVisible(page);
  await expect(canvas(page)).toBeInViewport({ ratio: 1 });
  await expect(page.getByRole('button', { name: '확인하기' })).toBeInViewport({ ratio: 1 });
  if (testInfo.project.name === 'chromebook') expectChromeBookCanvasSize(boxes);
});

test('오프라인에서도 g4s1u4.A1 활동이 열린다', async ({ page, context }) => {
  await page.goto(PREVIEW_URL);
  await page.getByRole('button', { name: '1번', exact: true }).click();
  await page.getByRole('button', { name: '건너뛰기' }).click();
  await expect(page).toHaveURL(/#\/map$/);
  await page.goto(`${PREVIEW_URL}/#/activity/g4s1u4.A1`);
  await expect(page.getByRole('heading', { name: '트레이싱 페이퍼' })).toBeVisible();

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
  await expect(page.getByRole('heading', { name: '트레이싱 페이퍼' })).toBeVisible();
  await expect(page.getByRole('button', { name: '확인하기' })).toBeVisible();
});
