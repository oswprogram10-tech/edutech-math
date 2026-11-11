import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { PREVIEW_URL } from '../../../playwright.config';
import {
  expectChromeBookCanvasSize,
  expectContentPanelsReachable,
  expectFitCanvasVisible,
} from '../panel-layout';

/**
 * T119 g5s1u6 「다각형의 둘레와 넓이」 A1 「잘라 붙여 넓이 공식 만들기」·
 * A2 「둘레 20 고무줄」 단원 E2E.
 * 과제마다 대표 오답 → 힌트 ① → 고쳐서 통과 순서로 끝까지 해 본다.
 * A1.T1은 서로 다른 오개념 ①을 모두 보려고 활동을 새로 열어 실패 횟수를 되돌린다.
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

function field(page: Page, id: string): Locator {
  return slot(page, 'response').locator(`[data-response-field="${id}"]`);
}

async function choose(page: Page, id: string, label: string): Promise<void> {
  await field(page, id).getByRole('button', { name: label, exact: true }).click();
}

async function typeNumber(page: Page, id: string, value: string): Promise<void> {
  const box = field(page, id);
  await box.focus();
  await typeDigits(page, value);
}

async function clearNumber(page: Page, id: string): Promise<void> {
  const box = field(page, id);
  await box.focus();
  for (let index = 0; index < 4; index += 1) await page.keyboard.press('Backspace');
}

/** 여러 자리 수를 한 자씩 넣는다(수 입력 위젯은 키보드 이벤트를 받는다). */
async function typeDigits(page: Page, value: string): Promise<void> {
  for (const digit of value) await page.keyboard.press(digit);
}

async function focusCanvas(page: Page, testId = 'cut-canvas'): Promise<Locator> {
  const canvas = main(page).getByTestId(testId);
  await canvas.focus();
  await expect(canvas).toBeFocused();
  return canvas;
}

/** 엔진 후보 커서를 목표 좌표까지 오른쪽으로 돌린다(후보 순서를 코드에 박지 않는다). */
async function stepCursorTo(
  page: Page,
  canvas: Locator,
  attribute: string,
  target: string,
): Promise<void> {
  for (let step = 0; step < 80; step += 1) {
    if ((await canvas.getAttribute(attribute)) === target) return;
    await page.keyboard.press('ArrowRight');
  }
  throw new Error(`커서를 ${target}까지 옮기지 못했습니다.`);
}

/** E11 자르기: 캔버스에서 C → 시작점 Enter → 끝점 Enter. */
async function cutAt(page: Page, from: string, to: string): Promise<void> {
  const canvas = await focusCanvas(page, 'cut-canvas');
  await page.keyboard.press('c');
  await stepCursorTo(page, canvas, 'data-cut-cursor', from);
  await page.keyboard.press('Enter');
  await stepCursorTo(page, canvas, 'data-cut-cursor', to);
  await page.keyboard.press('Enter');
}

/** 조각 하나에 포커스를 준다. 배열 0번이 먼저 그려진 조각이다. */
async function focusPiece(page: Page, index: number): Promise<Locator> {
  const piece = main(page).locator('[data-piece]').nth(index);
  await piece.focus();
  await expect(piece).toBeFocused();
  return piece;
}

/** E11 복제: 조각에서 D. 사본은 배열 1번에 붙는다. */
async function duplicateFirstPiece(page: Page): Promise<Locator> {
  await focusPiece(page, 0);
  await page.keyboard.press('d');
  const pieces = main(page).locator('[data-piece]');
  await expect(pieces).toHaveCount(2);
  return pieces.nth(1);
}

/** E11 경첩: 사본에서 H → 경첩 점 Enter. */
async function hingeCopy(page: Page, at: string): Promise<void> {
  const piece = await focusPiece(page, 1);
  await page.keyboard.press('h');
  const canvas = main(page).getByTestId('cut-canvas');
  await stepCursorTo(page, canvas, 'data-hinge-cursor', at);
  await page.keyboard.press('Enter');
  await expect(piece).not.toHaveAttribute('data-animating', 'true');
}

/** 조각을 격자 한 칸씩 옮긴다. 방향키는 조각에 포커스가 있을 때만 움직인다. */
async function movePiece(page: Page, index: number, key: string, count: number): Promise<void> {
  await focusPiece(page, index);
  for (let step = 0; step < count; step += 1) await page.keyboard.press(key);
}

test('A1 잘라 붙여 넓이 공식 만들기 — 자르기·경첩·넓이 입력', async ({ page }, testInfo) => {
  await openActivity(page, 'g5s1u6.A1', '잘라 붙여 넓이 공식 만들기');
  await screenshot(page, 'g5s1u6-a1.png');
  // T122로 판이 실행기 판 높이에 맞춰 줄어 세 뷰포트 모두 판 안 스크롤이 없다.
  await expectContentPanelsReachable(page);
  const boxes = await expectFitCanvasVisible(page);
  // 크롬북에서 E11 판이 0.99로 1px 남짓 걸린다(판 안 스크롤은 0). 일부 보임으로 잰다.
  await expect(main(page).getByTestId('cut-canvas')).toBeInViewport();
  await expect(page.getByRole('button', { name: '확인하기' })).toBeInViewport();
  if (testInfo.project.name === 'chromebook') expectChromeBookCanvasSize(boxes);

  // T1 — 단위 오답(cm)을 첫 실패로 만들어 MC-AREA-UNIT-CONFUSION ①을 본다.
  await typeNumber(page, 'area', '24');
  await choose(page, 'unit', 'cm');
  await submit(page);
  await expectFailedWithHint(page, '1cm²는 어떤 모양이었나요?', 1);

  // 활동을 새로 열어 실패 횟수를 되돌리고, 이번에는 옆변을 높이로 쓴 오답을 낸다.
  await openActivity(page, 'g5s1u6.A1', '잘라 붙여 넓이 공식 만들기');
  await typeNumber(page, 'area', '30');
  await submit(page);
  await expectFailedWithHint(page, '높이는 어디에서 어디까지 재는 길이였나요?', 1);
  await submit(page);
  await expectFailedWithHint(page, '옆변으로 만든 상자와 평행사변형을 겹쳐 보세요.', 2);
  await expectOverlayOverCanvas(main(page), 'slant-rectangle', 'cut-canvas');

  await clearNumber(page, 'area');
  await typeDigits(page, '24');
  await cutAt(page, '5,2', '5,6');
  await movePiece(page, 0, 'ArrowRight', 6);
  await choose(page, 'unit', 'cm²');
  await submit(page);
  await expectPassed(page);

  // T2 — ÷2를 빠뜨린 24를 내 NO-HALF ①, 복제·경첩·이동 뒤 12로 통과.
  await typeNumber(page, 'area', '24');
  await submit(page);
  await expectFailedWithHint(page, '이 삼각형 몇 개가 모여 평행사변형이 되었나요?', 1);
  await duplicateFirstPiece(page);
  await hingeCopy(page, '14,4');
  await movePiece(page, 1, 'ArrowLeft', 8);
  await clearNumber(page, 'area');
  await typeDigits(page, '12');
  await submit(page);
  await expectPassed(page);

  // T3 — ÷2를 빠뜨린 32를 내 일반 ①, 경첩 재조립 뒤 16으로 통과.
  await typeNumber(page, 'area', '32');
  await submit(page);
  await expectFailedWithHint(page, '사다리꼴 몇 개를 붙여 평행사변형을 만들었나요?', 1);
  await duplicateFirstPiece(page);
  await hingeCopy(page, '27/2,4');
  await movePiece(page, 1, 'ArrowLeft', 7);
  await clearNumber(page, 'area');
  await typeDigits(page, '16');
  await submit(page);
  await expectPassed(page);

  // T4 — ÷2 없는 식을 골라 ①, ÷2가 있는 식으로 통과.
  await choose(page, 'f', '(윗변 + 아랫변) × 높이');
  await submit(page);
  await expectFailedWithHint(
    page,
    '사다리꼴 2개로 만든 평행사변형의 넓이와 사다리꼴 하나의 넓이는 어떤 관계였나요?',
    1,
  );
  await choose(page, 'f', '(윗변 + 아랫변) × 높이 ÷ 2');
  await submit(page);
  await expectPassed(page);

  // T5 — 마름모 48을 내 일반 ①, 24로 통과.
  await typeNumber(page, 'area', '48');
  await submit(page);
  await expectFailedWithHint(page, '마름모를 두 대각선으로 나누면 어떤 도형이 보이나요?', 1);
  await clearNumber(page, 'area');
  await typeDigits(page, '24');
  await submit(page);
  await expectPassed(page);

  // T6 — 옆변(5)을 높이로 쓴 45를 내 SLANT ①, 36으로 통과.
  await typeNumber(page, 'area', '45');
  await submit(page);
  await expectFailedWithHint(page, '높이는 어디에서 어디까지 재는 길이였나요?', 1);
  await clearNumber(page, 'area');
  await typeDigits(page, '36');
  await submit(page);
  await expectPassed(page, true);
});

test('A2 둘레 20 고무줄 — 기록·최대 넓이·넓이 9·짧은 둘레', async ({ page }, testInfo) => {
  await openActivity(page, 'g5s1u6.A2', '둘레 20 고무줄');
  await screenshot(page, 'g5s1u6-a2.png');
  await expectContentPanelsReachable(page);
  const boxes = await expectFitCanvasVisible(page);
  await expect(main(page).getByTestId('geo-canvas')).toBeInViewport({ ratio: 1 });
  await expect(page.getByRole('button', { name: '확인하기' })).toBeInViewport({ ratio: 1 });
  if (testInfo.project.name === 'chromebook') expectChromeBookCanvasSize(boxes);

  // T1 — 3×7·4×6·5×5를 기록하고 "모두 같아요"를 골라 PERIMETER-AREA-SAME ①.
  await focusCanvas(page, 'geo-canvas');
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await choose(page, 'area', '모두 같아요');
  await submit(page);
  await expectFailedWithHint(page, '1×9와 5×5에 단위넓이가 몇 개씩 들어갈까요?', 1);
  await choose(page, 'area', '다른 것도 있어요');
  await submit(page);
  await expectPassed(page);

  // T2 — 처음 3×7로 제출해 일반 ①, → 두 번으로 5×5를 만들어 통과.
  await submit(page);
  await expectFailedWithHint(page, '넓이가 가장 큰 직사각형은 지금 모양과 무엇이 다를까요?', 1);
  await focusCanvas(page, 'geo-canvas');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await submit(page);
  await expectPassed(page);

  // T3 — 처음 3×7로 제출해 일반 ①, ← 두 번으로 1×9를 만들어 통과.
  await submit(page);
  await expectFailedWithHint(
    page,
    '세 직사각형의 둘레를 각각 구해 볼까요? 넓이가 9가 되는 가로와 세로의 짝은 무엇인가요?',
    1,
  );
  await focusCanvas(page, 'geo-canvas');
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowLeft');
  await submit(page);
  await expectPassed(page);

  // T4 — "둘레가 모두 같아요"를 골라 PERIMETER-AREA-SAME ①, 4×6으로 통과.
  await choose(page, 'p', '둘레가 모두 같아요');
  await submit(page);
  await expectFailedWithHint(page, '넓이가 같아도 둘레는 모두 같을까요?', 1);
  await choose(page, 'p', '가로 4cm, 세로 6cm');
  await submit(page);
  await expectPassed(page, true);
});

test('오프라인에서도 g5s1u6.A1 활동이 열린다', async ({ page, context }) => {
  await page.goto(PREVIEW_URL);
  await page.getByRole('button', { name: '1번', exact: true }).click();
  await page.getByRole('button', { name: '건너뛰기' }).click();
  await expect(page).toHaveURL(/#\/map$/);
  await page.goto(`${PREVIEW_URL}/#/activity/g5s1u6.A1`);
  await expect(page.getByRole('heading', { name: '잘라 붙여 넓이 공식 만들기' })).toBeVisible();

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
  await expect(page.getByRole('heading', { name: '잘라 붙여 넓이 공식 만들기' })).toBeVisible();
  await expect(page.getByRole('button', { name: '확인하기' })).toBeVisible();
});
