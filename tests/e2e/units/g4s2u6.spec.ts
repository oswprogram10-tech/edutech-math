import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { PREVIEW_URL } from '../../../playwright.config';
import {
  expectChromeBookCanvasSize,
  expectContentPanelsReachable,
  expectFitCanvasVisible,
} from '../panel-layout';

/**
 * T118 g4s2u6 「다각형」 A1 「대각선 레이저 빔 생성기」·A2 「대각선 직교 사각형 실험실」 단원 E2E.
 * 과제마다 대표 오답 → 힌트 ① → 고쳐서 통과 순서로 끝까지 해 본다.
 * 힌트 단계는 과제 실패 횟수로 정해지므로, ②를 보는 과제는 같은 오답을 두 번 낸다.
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
  await page.keyboard.press('Backspace');
  await page.keyboard.press('Backspace');
}

/** 여러 자리 수를 한 자씩 넣는다(수 입력 위젯은 키보드 이벤트를 받는다). */
async function typeDigits(page: Page, value: string): Promise<void> {
  for (const digit of value) await page.keyboard.press(digit);
}

async function focusCanvas(page: Page): Promise<Locator> {
  const canvas = main(page).getByTestId('geo-canvas');
  await canvas.focus();
  await expect(canvas).toBeFocused();
  return canvas;
}

/** drag-test 사각형의 손잡이를 키보드로 한 칸 움직인다. 손잡이 번호 1~4 = ㄱ~ㄹ. */
async function nudgeHandle(page: Page, handle: 1 | 2 | 3 | 4, key: 'ArrowLeft' | 'ArrowRight') {
  await focusCanvas(page);
  await page.keyboard.press(String(handle));
  await page.keyboard.press(key);
  await page.keyboard.press('Escape');
}

/** 대각선 판의 꼭짓점 커서를 `from`에서 `to`로 옮긴다. 0번이 맨 위 꼭짓점이다. */
async function moveVertex(page: Page, from: number, to: number, n: number): Promise<number> {
  const forward = (((to - from) % n) + n) % n;
  const backward = n - forward;
  const key = forward <= backward ? 'ArrowRight' : 'ArrowLeft';
  const count = Math.min(forward, backward);
  for (let step = 0; step < count; step += 1) await page.keyboard.press(key);
  return to;
}

/** 꼭짓점 두 개를 차례로 골라 대각선 하나를 긋는다. */
async function pickPair(
  page: Page,
  from: number,
  pair: readonly [number, number],
  n: number,
): Promise<number> {
  const first = await moveVertex(page, from, pair[0], n);
  await page.keyboard.press('Enter');
  const second = await moveVertex(page, first, pair[1], n);
  await page.keyboard.press('Enter');
  return second;
}

/** 현재 다각형 단추를 다시 눌러 커서를 0번으로 되돌린다. */
async function resetVertexCursor(page: Page, n: number): Promise<void> {
  await main(page)
    .getByRole('button', { name: `꼭짓점 ${n}개`, exact: true })
    .click();
  await focusCanvas(page);
}

test('A1 대각선 레이저 빔 생성기 — 다각형 고르기·대각선 긋기·개수 세기·규칙 찾기', async ({
  page,
}, testInfo) => {
  await openActivity(page, 'g4s2u6.A1', '대각선 레이저 빔 생성기');
  await screenshot(page, 'g4s2u6-a1.png');
  // T122로 판이 실행기 판 높이에 맞춰 줄어 세 뷰포트 모두 판 안 스크롤이 없다.
  await expectContentPanelsReachable(page);
  const boxes = await expectFitCanvasVisible(page);
  await expect(main(page).getByTestId('geo-canvas')).toBeInViewport({ ratio: 1 });
  await expect(page.getByRole('button', { name: '확인하기' })).toBeInViewport({ ratio: 1 });
  if (testInfo.project.name === 'chromebook') expectChromeBookCanvasSize(boxes);

  // T1 — 곡선 카드(윗줄 2)를 골라 POLYGON-CURVE ①, 한 번 더 골라 ② curve-gap.
  await choose(page, 'poly', '윗줄 2');
  await submit(page);
  await expectFailedWithHint(page, '모든 변이 선분이야? 끝까지 둘러싸여 있어?', 1);
  await submit(page);
  await expectFailedWithHint(page, '곡선과 열린 틈을 표시했어요.', 2);
  await expectOverlayOverCanvas(main(page), 'curve-gap', 'geo-canvas');

  // 곡선 카드를 빼고 다각형 네 장만 골라 통과한다.
  await choose(page, 'poly', '윗줄 2');
  await choose(page, 'poly', '윗줄 1');
  await choose(page, 'poly', '윗줄 4');
  await choose(page, 'poly', '아랫줄 1');
  await choose(page, 'poly', '아랫줄 4');
  await submit(page);
  await expectPassed(page);

  // T2 — 이웃한 꼭짓점(ㄱ→ㄴ)을 두 번 그어 ADJACENT ①, 그 뒤 다섯 대각선을 모두 긋는다.
  await focusCanvas(page);
  let cursor = await moveVertex(page, 0, 0, 5);
  await page.keyboard.press('Enter');
  cursor = await moveVertex(page, cursor, 1, 5);
  await page.keyboard.press('Enter');
  cursor = await moveVertex(page, cursor, 0, 5);
  await page.keyboard.press('Enter');
  await moveVertex(page, cursor, 1, 5);
  await page.keyboard.press('Enter');
  await submit(page);
  await expectFailedWithHint(page, '그 선분은 원래 도형의 어디와 겹쳐?', 1);

  await resetVertexCursor(page, 5);
  cursor = 0;
  const pentagonDiagonals = [
    [0, 2],
    [0, 3],
    [1, 3],
    [1, 4],
    [2, 4],
  ] as const;
  for (const pair of pentagonDiagonals) cursor = await pickPair(page, cursor, pair, 5);
  await submit(page);
  await expectPassed(page);

  // T3 — 육각형에서 대각선 하나를 긋고 18을 써 DOUBLE ①, 한 번 더 써 ② merge-beams.
  await resetVertexCursor(page, 6);
  await pickPair(page, 0, [0, 2], 6);
  await typeNumber(page, 'n', '18');
  await submit(page);
  await expectFailedWithHint(
    page,
    '꼭짓점 ㄱ에서 ㄷ으로 그은 선과 ㄷ에서 ㄱ으로 그은 선은 다른 선분일까?',
    1,
  );
  await submit(page);
  await expectFailedWithHint(page, '양 끝에서 온 두 빔이 한 선분으로 만나요.', 2);
  await expectOverlayOverCanvas(main(page), 'merge-beams', 'geo-canvas');

  await clearNumber(page, 'n');
  await typeDigits(page, '9');
  await submit(page);
  await expectPassed(page);

  // T4 — 칠각형의 대각선 수를 예측한다. 28을 써 DOUBLE ①, 고쳐서 통과.
  await typeNumber(page, 'n', '28');
  await submit(page);
  await expectFailedWithHint(
    page,
    '꼭짓점 ㄱ에서 ㄷ으로 그은 선과 ㄷ에서 ㄱ으로 그은 선은 다른 선분일까?',
    1,
  );
  await clearNumber(page, 'n');
  await typeDigits(page, '14');
  await submit(page);
  await expectPassed(page);

  // T5 — 마름모 카드(아랫줄 3)를 골라 REGULAR ①, 두 정사각형만 남겨 통과.
  await choose(page, 'reg', '아랫줄 3');
  await submit(page);
  await expectFailedWithHint(page, '정다각형이 되려면 변 말고 또 무엇이 같아야 할까?', 1);
  await choose(page, 'reg', '아랫줄 3');
  await choose(page, 'reg', '윗줄 1');
  await choose(page, 'reg', '윗줄 3');
  await submit(page);
  await expectPassed(page, true);
});

test('A2 대각선 직교 사각형 실험실 — 조건 켜기·이름 고르기·수직이지만 이등분 아님', async ({
  page,
}, testInfo) => {
  await openActivity(page, 'g4s2u6.A2', '대각선 직교 사각형 실험실');
  await screenshot(page, 'g4s2u6-a2.png');
  await expectContentPanelsReachable(page);
  const boxes = await expectFitCanvasVisible(page);
  await expect(main(page).getByTestId('geo-canvas')).toBeInViewport({ ratio: 1 });
  await expect(page.getByRole('button', { name: '확인하기' })).toBeInViewport({ ratio: 1 });
  if (testInfo.project.name === 'chromebook') expectChromeBookCanvasSize(boxes);

  const toggle = (name: string) => main(page).getByRole('button', { name, exact: true }).click();

  // T1 — 이등분만 켜고 이름을 잘못 골라 ①, 평행사변형으로 고쳐 통과.
  await toggle('서로 이등분');
  await choose(page, 'name', '마름모');
  await submit(page);
  await expectFailedWithHint(
    page,
    '대각선이 서로를 이등분하면 어떤 사각형이 될까요? 손잡이를 끌어 확인해 보세요.',
    1,
  );
  await choose(page, 'name', '평행사변형');
  await submit(page);
  await expectPassed(page);

  // T2 — 이등분+수직, 잘못 골라 ①, 마름모로 통과.
  await toggle('서로 이등분');
  await toggle('서로 수직');
  await choose(page, 'name', '직사각형');
  await submit(page);
  await expectFailedWithHint(
    page,
    '이등분에 어떤 조건이 더해졌나요? 그 조건이 만드는 사각형을 떠올려 보세요.',
    1,
  );
  await choose(page, 'name', '마름모');
  await submit(page);
  await expectPassed(page);

  // T3 — 이등분+길이 같음, 잘못 골라 ①, 직사각형으로 통과.
  await toggle('서로 이등분');
  await toggle('길이 같음');
  await choose(page, 'name', '마름모');
  await submit(page);
  await expectFailedWithHint(
    page,
    '이등분에 어떤 조건이 더해졌나요? 두 대각선의 길이가 같으면 어떤 사각형이 될까요?',
    1,
  );
  await choose(page, 'name', '직사각형');
  await submit(page);
  await expectPassed(page);

  // T4 — 이등분+수직은 마름모라 실패(①). 이등분을 끄고 대각선 한쪽만 나누도록
  // ㄷ 손잡이를 한 칸 옮기면 수직이지만 마름모가 아니게 되어 통과한다.
  await toggle('서로 이등분');
  await toggle('서로 수직');
  await submit(page);
  await expectFailedWithHint(
    page,
    '대각선이 수직인 것과 서로를 이등분하는 것은 다른 성질이에요. 지금 모양은 어느 쪽인가요?',
    1,
  );
  await toggle('서로 이등분');
  await nudgeHandle(page, 3, 'ArrowLeft');
  await expect(main(page).getByTestId('drag-classify-live')).not.toContainText('같은 길이 변 4개');
  await submit(page);
  await expectPassed(page, true);
});

test('오프라인에서도 g4s2u6.A1 활동이 열린다', async ({ page, context }) => {
  await page.goto(PREVIEW_URL);
  await page.getByRole('button', { name: '1번', exact: true }).click();
  await page.getByRole('button', { name: '건너뛰기' }).click();
  await expect(page).toHaveURL(/#\/map$/);
  await page.goto(`${PREVIEW_URL}/#/activity/g4s2u6.A1`);
  await expect(page.getByRole('heading', { name: '대각선 레이저 빔 생성기' })).toBeVisible();

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
  await expect(page.getByRole('heading', { name: '대각선 레이저 빔 생성기' })).toBeVisible();
  await expect(page.getByRole('button', { name: '확인하기' })).toBeVisible();
});
