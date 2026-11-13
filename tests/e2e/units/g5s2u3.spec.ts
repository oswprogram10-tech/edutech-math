import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { PREVIEW_URL } from '../../../playwright.config';
import {
  expectChromeBookCanvasSize,
  expectContentPanelsReachable,
  expectFitCanvasVisible,
} from '../panel-layout';

/**
 * T120 g5s2u3 「합동과 대칭」 A1 「포개기와 데칼코마니」·
 * A2 「180° 압정 회전 스튜디오」 단원 E2E.
 * 과제마다 대표 오답 → 힌트 ① → 고쳐서 통과 순서로 끝까지 해 본다.
 * A1.T1은 겹친 뒤 대응변 짝짓기까지, A1.T6만 MC-CONG-SIZE-ONLY를 본다.
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

async function focusCanvas(page: Page): Promise<Locator> {
  const canvas = main(page).getByTestId('transform-canvas');
  await canvas.focus();
  await expect(canvas).toBeFocused();
  return canvas;
}

async function press(page: Page, keys: readonly string[]): Promise<void> {
  for (const key of keys) await page.keyboard.press(key);
}

/** E10 점판: 커서를 dx·dy칸 옮긴다(커서는 좌표 속성을 쓰지 않는다). */
async function nudge(page: Page, dx: number, dy: number): Promise<void> {
  const keys: string[] = [];
  for (let index = 0; index < Math.abs(dx); index += 1) {
    keys.push(dx > 0 ? 'ArrowRight' : 'ArrowLeft');
  }
  for (let index = 0; index < Math.abs(dy); index += 1) {
    keys.push(dy > 0 ? 'ArrowDown' : 'ArrowUp');
  }
  await press(page, keys);
}

/** E10 선대칭 점판: (from)에서 (to)까지 방향키로 옮긴다. */
async function moveLineCursor(
  page: Page,
  from: readonly [number, number],
  to: readonly [number, number],
): Promise<void> {
  await nudge(page, to[0] - from[0], to[1] - from[1]);
}

/** E10 대응변 짝짓기: 움직인 도형 m번 변과 고정된 도형 f번 변을 잇는다. */
async function pairSides(page: Page, moving: number, fixed: number): Promise<void> {
  const section = main(page).getByRole('region', { name: '대응하는 변 짝짓기' });
  await section.getByLabel('움직인 도형의 변').selectOption({ index: moving });
  await section.getByLabel('고정된 도형의 변').selectOption({ index: fixed });
  await section.getByRole('button', { name: '짝 짓기', exact: true }).click();
}

test('A1 포개기와 접기 — 포개기·대칭축·완성', async ({ page }, testInfo) => {
  await openActivity(page, 'g5s2u3.A1', '포개기와 접기');
  await screenshot(page, 'g5s2u3-a1.png');
  // T122로 판이 실행기 판 높이에 맞춰 줄어 세 뷰포트 모두 판 안 스크롤이 없다.
  await expectContentPanelsReachable(page);
  const boxes = await expectFitCanvasVisible(page);
  await expect(main(page).getByTestId('transform-canvas')).toBeInViewport();
  await expect(page.getByRole('button', { name: '확인하기' })).toBeInViewport({ ratio: 1 });
  if (testInfo.project.name === 'chromebook') expectChromeBookCanvasSize(boxes);

  // T1 — C,C,R,→,↑,↑로 겹친 뒤 대응변을 잘못(ㅁㅂ–ㄴㄷ) 한 쌍만 지어 '겹친 뒤 짝' ①.
  await focusCanvas(page);
  await press(page, ['c', 'c', 'r', 'ArrowRight', 'ArrowUp', 'ArrowUp']);
  await pairSides(page, 0, 1);
  await submit(page);
  await expectFailedWithHint(page, '겹쳤을 때 같은 자리에 온 꼭짓점은 어느 것끼리일까요?', 1);

  // 네 변을 대응대로 짝 지으면 통과한다. 0↔0을 지으면 0↔1은 엔진이 지운다.
  await pairSides(page, 0, 0);
  await pairSides(page, 1, 1);
  await pairSides(page, 2, 2);
  await pairSides(page, 3, 3);
  await submit(page);
  await expectPassed(page);

  // T2 — 직사각형 대각선 (2,3)·(6,5)로 접어 DIAGONAL ①, 세로·가로 축을 차례로 접어 통과.
  await focusCanvas(page);
  await moveLineCursor(page, [4, 0], [2, 3]);
  await press(page, ['Enter']);
  await moveLineCursor(page, [2, 3], [6, 5]);
  await press(page, ['Enter', 'f']);
  await submit(page);
  await expectFailedWithHint(page, '그 선으로 접으면 두 쪽이 딱 겹칠까?', 1);

  await focusCanvas(page);
  await press(page, ['Escape']);
  await moveLineCursor(page, [6, 5], [4, 0]);
  await press(page, ['Enter']);
  await moveLineCursor(page, [4, 0], [4, 8]);
  await press(page, ['Enter', 'f']);
  await moveLineCursor(page, [4, 8], [0, 4]);
  await press(page, ['Enter']);
  await moveLineCursor(page, [0, 4], [8, 4]);
  await press(page, ['Enter', 'f']);
  await submit(page);
  await expectPassed(page);

  // T3 — 평행사변형 대각선 (7,3)·(1,6)은 빈틈. "2개"를 두 번 내 ①·② 뒤 "없어요"로 통과.
  await focusCanvas(page);
  await moveLineCursor(page, [4, 0], [7, 3]);
  await press(page, ['Enter']);
  await moveLineCursor(page, [7, 3], [1, 6]);
  await press(page, ['Enter', 'f']);
  await expect(main(page).locator('[data-fold-gap]')).toHaveCount(1);
  await choose(page, 'axes', '2개');
  await submit(page);
  await expectFailedWithHint(page, '그 선으로 접으면 두 쪽이 딱 겹칠까?', 1);
  await submit(page);
  await expectFailedWithHint(page, '접었을 때 생긴 빈틈을 살펴보세요.', 2);
  await expectOverlayOverCanvas(main(page), 'fold-gap', 'transform-canvas');
  await choose(page, 'axes', '없어요');
  await submit(page);
  await expectPassed(page);

  // T4 — 정육각형 대칭축 3개는 일반 ①, 6개로 통과.
  await typeNumber(page, 'n', '3');
  await submit(page);
  await expectFailedWithHint(page, '꼭짓점끼리 이은 선 말고 다른 선으로도 접어 볼까요?', 1);
  await clearNumber(page, 'n');
  await typeDigits(page, '6');
  await submit(page);
  await expectPassed(page);

  // T5 — 반쪽 끝 (4,7)에서 시작해 닫혔지만 대칭이 아닌 경로로 일반 ①, 지우고 대칭 경로로 통과.
  await focusCanvas(page);
  await nudge(page, 0, 7);
  await press(page, ['Enter']);
  await nudge(page, 2, 0);
  await press(page, ['Enter']);
  await nudge(page, 1, -2);
  await press(page, ['Enter']);
  await nudge(page, -1, -3);
  await press(page, ['Enter']);
  await nudge(page, -2, -1);
  await press(page, ['Enter']);
  await submit(page);
  await expectFailedWithHint(
    page,
    '반쪽의 끝에서 시작해 점을 이어 보세요. 어디에서 닫아야 할까요?',
    1,
  );

  await focusCanvas(page);
  await press(page, ['Backspace', 'Backspace', 'Backspace', 'Backspace']);
  await moveLineCursor(page, [4, 1], [5, 7]);
  await press(page, ['Enter']);
  await moveLineCursor(page, [5, 7], [7, 5]);
  await press(page, ['Enter']);
  await moveLineCursor(page, [7, 5], [6, 2]);
  await press(page, ['Enter']);
  await moveLineCursor(page, [6, 2], [4, 1]);
  await press(page, ['Enter']);
  await submit(page);
  await expectPassed(page);

  // T6 — 넓이가 같아도 합동이 아닌 두 도형. yes는 SIZE-ONLY ①, 한 번 민 뒤 yes는 ②, no로 통과.
  await choose(page, 'cong', '합동이에요');
  await submit(page);
  await expectFailedWithHint(page, '포개 보면 딱 겹칠까?', 1);
  await focusCanvas(page);
  await press(page, ['ArrowRight']);
  await submit(page);
  await expectFailedWithHint(page, '겹치지 않고 삐져나온 부분을 살펴보세요.', 2);
  await expectOverlayOverCanvas(main(page), 'protrude', 'transform-canvas');
  await choose(page, 'cong', '합동이 아니에요');
  await submit(page);
  await expectPassed(page, true);
});

test('A2 180° 압정 회전 스튜디오 — 중심·분류·거리·완성', async ({ page }, testInfo) => {
  await openActivity(page, 'g5s2u3.A2', '180° 압정 회전 스튜디오');
  await screenshot(page, 'g5s2u3-a2.png');
  await expectContentPanelsReachable(page);
  const boxes = await expectFitCanvasVisible(page);
  await expect(main(page).getByTestId('transform-canvas')).toBeInViewport({ ratio: 1 });
  await expect(page.getByRole('button', { name: '확인하기' })).toBeInViewport({ ratio: 1 });
  if (testInfo.project.name === 'chromebook') expectChromeBookCanvasSize(boxes);

  // T1 — 뒤집고 압정을 엉뚱한 곳에 꽂아 POINT-AS-LINE ①·②, 중심 (8,9)로 통과.
  await focusCanvas(page);
  await press(page, ['Shift+ArrowRight', 'Enter', 't']);
  await submit(page);
  await expectFailedWithHint(page, '180° 돌리기와 뒤집기는 어떻게 달랐지?', 1);
  await submit(page);
  await expectFailedWithHint(page, '뒤집은 모양과 180° 돌린 모양을 나란히 보았어요.', 2);
  await expectOverlayOverCanvas(main(page), 'flip-vs-turn', 'transform-canvas');

  await focusCanvas(page);
  await press(page, ['ArrowLeft', 'Enter', 't']);
  await submit(page);
  await expectPassed(page);

  // T2 — 도형 1·3을 골라 통과. 도형 2(정오각형)를 더 고르면 POINT-AS-LINE ①.
  await focusCanvas(page);
  await press(page, ['1', '3']);
  await choose(page, 'pick', '도형 1');
  await choose(page, 'pick', '도형 2');
  await choose(page, 'pick', '도형 3');
  await submit(page);
  await expectFailedWithHint(page, '180° 돌리기와 뒤집기는 어떻게 달랐지?', 1);
  await choose(page, 'pick', '도형 2');
  await submit(page);
  await expectPassed(page);

  // T3 — letter-S 중심 (9,9)에 압정을 꽂고 180° 돌리면 이등분 눈금이 보인다. far ①, same 통과.
  await focusCanvas(page);
  await press(page, ['Enter', 't']);
  await expect(main(page).locator('[data-bisect]').first()).toBeVisible();
  await choose(page, 'dist', '한쪽이 더 멀어요');
  await submit(page);
  await expectFailedWithHint(page, '압정 자리에서 짝이 되는 두 점까지의 거리를 견주어 보세요.', 1);
  await choose(page, 'dist', '두 거리가 같아요');
  await submit(page);
  await expectPassed(page);

  // T4 — (6,6)(2,6)(2,2)는 닫혔지만 대칭이 아니어서 일반 ①, 지우고 (4,6)·(2,4)로 통과.
  await focusCanvas(page);
  await press(page, ['Enter']);
  await nudge(page, -4, 0);
  await press(page, ['Enter']);
  await nudge(page, 0, -4);
  await press(page, ['Enter']);
  await submit(page);
  await expectFailedWithHint(page, '반쪽의 끝 점은 중심 건너편 어디에 와야 할까요?', 1);
  // 같은 오답을 한 번 더 내면 ②(조작 중심 질문)가 나온다.
  await submit(page);
  await expectFailedWithHint(
    page,
    '중심에 압정을 꽂고 반쪽을 반 바퀴 돌리면 끝 점은 어디로 갈까요?',
    2,
  );

  await focusCanvas(page);
  await press(page, ['Backspace', 'Backspace']);
  await moveLineCursor(page, [2, 2], [4, 6]);
  await press(page, ['Enter']);
  await moveLineCursor(page, [4, 6], [2, 4]);
  await press(page, ['Enter']);
  await moveLineCursor(page, [2, 4], [2, 2]);
  await press(page, ['Enter']);
  await submit(page);
  await expectPassed(page, true);
});

test('A2.T2 도형 2만 고른 단일 오답은 힌트 ①이 나온다', async ({ page }) => {
  await openActivity(page, 'g5s2u3.A2', '180° 압정 회전 스튜디오');
  // T1은 뒤집기 오답 → 압정으로 통과.
  await focusCanvas(page);
  await press(page, ['Shift+ArrowRight', 'Enter', 't']);
  await submit(page);
  await expectFailedWithHint(page, '180° 돌리기와 뒤집기는 어떻게 달랐지?', 1);
  await focusCanvas(page);
  await press(page, ['ArrowLeft', 'Enter', 't']);
  await submit(page);
  await expectPassed(page);

  // T2 — 도형 2만 고르면(단일 ["s2"]) ①이 나온다.
  await choose(page, 'pick', '도형 2');
  await submit(page);
  await expectFailedWithHint(page, '180° 돌리기와 뒤집기는 어떻게 달랐지?', 1);
});

test('오프라인에서도 g5s2u3.A1 활동이 열린다', async ({ page, context }) => {
  await page.goto(PREVIEW_URL);
  await page.getByRole('button', { name: '1번', exact: true }).click();
  await page.getByRole('button', { name: '건너뛰기' }).click();
  await expect(page).toHaveURL(/#\/map$/);
  await page.goto(`${PREVIEW_URL}/#/activity/g5s2u3.A1`);
  await expect(page.getByRole('heading', { name: '포개기와 접기' })).toBeVisible();

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
  await expect(page.getByRole('heading', { name: '포개기와 접기' })).toBeVisible();
  await expect(page.getByRole('button', { name: '확인하기' })).toBeVisible();
});
