import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { PREVIEW_URL } from '../../../playwright.config';
import {
  expectChromeBookCanvasSize,
  expectContentPanelsReachable,
  expectFitCanvasVisible,
} from '../panel-layout';

/**
 * T116 g4s2u2 「삼각형」 A1 「드래깅 테스트 작도」·A2 「변·각 2차원 분류판」 단원 E2E.
 * 과제마다 대표 오답 → 힌트 ① → 고쳐서 통과 순서로 끝까지 해 본다.
 * 아이패드(WebKit)·크롬북·전자칠판 세 뷰포트에서 같은 흐름을 확인한다.
 * 힌트 ②는 A2.T1 t02를 두 번 틀려 angle-paint 오버레이 정렬까지 확인한다(T116 결정 23).
 */

test.describe.configure({ timeout: 300_000 });

function slot(page: Page, name: string): Locator {
  return page.getByTestId(`runner-slot-${name}`);
}

function main(page: Page): Locator {
  return slot(page, 'main');
}

function canvas(page: Page): Locator {
  return main(page).getByTestId('geo-canvas');
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

async function dragTool(page: Page, name: string): Promise<void> {
  await main(page).getByRole('button', { name, exact: true }).click();
  await focusCanvas(page);
}

async function shake(page: Page): Promise<void> {
  await main(page).getByRole('button', { name: '흔들기', exact: true }).click();
}

/**
 * 격자 이등변삼각형 ㄱ(0,0)·ㄴ(4,0)·ㄷ(2,3)을 세 선분으로 잇는다.
 * seed 1 흔들기에서 equal-sides-2가 사라지는 좌표다(구현 중 확인).
 */
async function buildEyeballIsosceles(page: Page): Promise<void> {
  await dragTool(page, '점 도구');
  await press(page, 'Enter');
  await press(page, 'ArrowRight', 4);
  await press(page, 'Enter');
  await press(page, 'ArrowLeft', 2);
  await press(page, 'ArrowDown', 3);
  await press(page, 'Enter');

  await dragTool(page, '선분 도구');
  await pressKeys(page, [
    'Enter',
    'Space',
    'Enter',
    'Space',
    'Enter',
    'Space',
    'Enter',
    'Space',
    'Enter',
    'Space',
    'Enter',
  ]);
}

/**
 * 컴퍼스 삼각형 ㄱ(0,0)·ㄴ(4,0): 폭 ㄱㄴ인 원 두 개의 교점 ㄷ과 세 선분.
 * keyPoint와 커서는 점·선분 작도 직후 상태(ㄴ, (4,0))에서 시작한다.
 */
async function buildCompassTriangle(page: Page): Promise<void> {
  await dragTool(page, '점 도구');
  await press(page, 'Enter');
  await press(page, 'ArrowRight', 4);
  await press(page, 'Enter');

  await dragTool(page, '선분 도구');
  await pressKeys(page, ['Enter', 'Space', 'Enter']);

  await dragTool(page, '컴퍼스 도구');
  await pressKeys(page, [
    'Enter',
    'Space',
    'Enter',
    'Space',
    'Enter',
    'Enter',
    'Space',
    'Enter',
    'Enter',
  ]);

  await main(page).getByRole('button', { name: '교점 도구', exact: true }).click();
  await main(page).getByRole('button', { name: '교점 후보 1', exact: true }).click();

  await dragTool(page, '선분 도구');
  await pressKeys(page, [
    'Space',
    'Space',
    'Enter',
    'Space',
    'Space',
    'Enter',
    'Space',
    'Space',
    'Enter',
    'Space',
    'Enter',
  ]);
}

/**
 * 컴퍼스 삼각형 ㄱ(0,0)·ㄴ(4,0)·ㄹ(교점): 폭 ㄱㄷ(3)인 원을 중심 ㄱ·ㄴ에 그린다.
 * 두 변만 같은 삼각형(3·3·4)이라 T4의 각 고르기에 쓴다.
 */
async function buildCompassIsosceles(page: Page): Promise<void> {
  await dragTool(page, '점 도구');
  await press(page, 'Enter');
  await press(page, 'ArrowRight', 4);
  await press(page, 'Enter');
  await press(page, 'ArrowLeft', 4);
  await press(page, 'ArrowDown', 3);
  await press(page, 'Enter');

  await dragTool(page, '컴퍼스 도구');
  await pressKeys(page, [
    'Space',
    'Enter',
    'Space',
    'Space',
    'Enter',
    'Space',
    'Enter',
    'Enter',
    'Space',
    'Space',
    'Enter',
    'Space',
    'Space',
    'Enter',
  ]);

  await main(page).getByRole('button', { name: '교점 도구', exact: true }).click();
  await main(page).getByRole('button', { name: '교점 후보 1', exact: true }).click();

  await dragTool(page, '선분 도구');
  await pressKeys(page, [
    'Space',
    'Space',
    'Enter',
    'Space',
    'Enter',
    'Space',
    'Enter',
    'Space',
    'Space',
    'Enter',
    'Space',
    'Enter',
    'Space',
    'Enter',
  ]);
}

/** 판 위의 점·선분을 모두 지운다(커서를 24,24로 옮긴 뒤 마지막 노드부터 지운다). */
async function clearDragBoard(page: Page, nodes: number): Promise<void> {
  await focusCanvas(page);
  await press(page, 'ArrowRight', 24);
  await press(page, 'ArrowDown', 24);
  await press(page, 'Delete', nodes);
  await press(page, 'ArrowLeft', 24);
  await press(page, 'ArrowUp', 24);
}

async function placeCard(page: Page, card: string, cell: string): Promise<void> {
  const cardNode = page.locator(`[data-card="${card}"]`);
  await cardNode.focus();
  await expect(cardNode).toBeFocused();
  await page.keyboard.press('Enter');
  const cellNode = page.locator(`[data-cell="${cell}"]`);
  await cellNode.focus();
  await expect(cellNode).toBeFocused();
  await page.keyboard.press('Enter');
}

async function pressCell(page: Page, cell: string): Promise<void> {
  const cellNode = page.locator(`[data-cell="${cell}"]`);
  await cellNode.focus();
  await expect(cellNode).toBeFocused();
  await page.keyboard.press('Enter');
}

function field(page: Page, id: string): Locator {
  return slot(page, 'response').locator(`[data-response-field="${id}"]`);
}

async function toggleChoice(page: Page, id: string, label: string): Promise<void> {
  await field(page, id).getByRole('button', { name: label, exact: true }).click();
}

/** T1 판정표(T108 결정 3). 카드 12장이 들어갈 칸. */
const T1_CELLS = [
  ['t01', 'acute|isosceles-only'],
  ['t12', 'acute|isosceles-only'],
  ['t04', 'acute|equilateral'],
  ['t09', 'acute|equilateral'],
  ['t07', 'acute|scalene'],
  ['t03', 'right|isosceles-only'],
  ['t08', 'right|isosceles-only'],
  ['t05', 'right|scalene'],
  ['t11', 'right|scalene'],
  ['t06', 'obtuse|isosceles-only'],
  ['t10', 'obtuse|isosceles-only'],
  ['t02', 'obtuse|scalene'],
] as const;

test('A1 드래깅 테스트 — 눈대중·컴퍼스 작도를 흔들어 확인한다', async ({ page }, testInfo) => {
  await openActivity(page, 'g4s2u2.A1', '드래깅 테스트 작도');
  await screenshot(page, 'g4s2u2-a1.png');
  // T122로 판이 실행기 판 높이에 맞춰 줄어 세 뷰포트 모두 판 안 스크롤이 없다.
  await expectContentPanelsReachable(page);
  const boxes = await expectFitCanvasVisible(page);
  await expect(main(page).getByTestId('geo-canvas')).toBeInViewport({ ratio: 1 });
  if (testInfo.project.name === 'chromebook') expectChromeBookCanvasSize(boxes);

  // T1 — 눈대중 이등변을 흔들지 않고 내면 ①. 흔들면 판정이 참이 된다.
  await buildEyeballIsosceles(page);
  await submit(page);
  await expectFailedWithHint(page, '이제 흔들기를 눌러 두 변이 그대로인지', 1);
  await shake(page);
  await submit(page);
  await expectPassed(page);

  // T2 — 같은 눈대중 삼각형을 흔들면 EYEBALL ①. 컴퍼스 작도로 고친다.
  await buildEyeballIsosceles(page);
  await shake(page);
  await submit(page);
  await expectFailedWithHint(page, '흔들어도 두 변이 같을까요?', 1);

  await clearDragBoard(page, 6);
  await buildCompassTriangle(page);
  await shake(page);
  await submit(page);
  await expectPassed(page);

  // T3 — 컴퍼스 정삼각형. 흔들지 않으면 일반 ①, 흔들면 통과.
  await buildCompassTriangle(page);
  await submit(page);
  await expectFailedWithHint(page, '세 변이 모두 같으려면 컴퍼스를 어떤 길이로', 1);
  await shake(page);
  await submit(page);
  await expectPassed(page);

  // T4 — 두 변만 같은 삼각형에서 밑각이 아닌 두 각을 고르면 일반 ①.
  await buildCompassIsosceles(page);
  await main(page).getByRole('button', { name: 'ㄱ', exact: true }).click();
  await main(page).getByRole('button', { name: 'ㄹ', exact: true }).click();
  await shake(page);
  await submit(page);
  await expectFailedWithHint(page, '같은 눈금이 있는 두 변을 찾았나요', 1);

  await main(page).getByRole('button', { name: 'ㄹ', exact: true }).click();
  await main(page).getByRole('button', { name: 'ㄴ', exact: true }).click();
  await shake(page);
  await submit(page);
  await expectPassed(page, true);
});

test('A2 변·각 분류판 — 카드 분류·불가능한 칸·점판 작도·정의 고르기', async ({
  page,
}, testInfo) => {
  await openActivity(page, 'g4s2u2.A2', '변·각 2차원 분류판');
  await screenshot(page, 'g4s2u2-a2.png');
  await expectContentPanelsReachable(page);
  const boxes = await expectFitCanvasVisible(page);
  await expect(main(page).getByTestId('sorter-canvas')).toBeInViewport({ ratio: 1 });
  if (testInfo.project.name === 'chromebook') expectChromeBookCanvasSize(boxes);

  // T1 — t12만 틀린 열에 넣어 ISO ①.
  for (const [card, cell] of T1_CELLS) {
    if (card === 't12') {
      await placeCard(page, card, 'acute|scalene');
    } else {
      await placeCard(page, card, cell);
    }
  }
  await submit(page);
  await expectFailedWithHint(page, '변의 길이를 견주어 볼까요? 같은 변이 있나요?', 1);

  // T1 — 힌트 단계는 과제 실패 횟수로 정해지므로, ACUTE ①을 첫 실패로 보려고
  // 활동을 새로 열어 T1부터 다시 한다(과제 안에서 두 오개념 ①을 함께 볼 수 없다).
  await openActivity(page, 'g4s2u2.A2', '변·각 2차원 분류판');
  for (const [card, cell] of T1_CELLS) {
    if (card === 't02') {
      await placeCard(page, card, 'acute|scalene');
    } else {
      await placeCard(page, card, cell);
    }
  }
  await submit(page);
  await expectFailedWithHint(page, '예각 줄에 넣은 삼각형의 세 각을 모두 살펴봤나요?', 1);

  // T1 — 같은 오답을 한 번 더 내 ②와 angle-paint 정렬을 확인한다.
  await submit(page);
  await expectFailedWithHint(page, '세 각을 칠해 가장 큰 각을 표시했어요.', 2);
  await expectOverlayOverCanvas(main(page), 'angle-paint', 'sorter-canvas');

  await placeCard(page, 't02', 'obtuse|scalene');
  await submit(page);
  await expectPassed(page);

  // T2 — 불가능한 칸을 하나만 표시하면 일반 ①.
  await page.getByRole('button', { name: '불가능한 칸 표시', exact: true }).click();
  await pressCell(page, 'acute|equilateral');
  await submit(page);
  await expectFailedWithHint(page, '세 변이 모두 같은 삼각형의 각은 어떤 각일까요?', 1);

  await pressCell(page, 'acute|equilateral');
  await pressCell(page, 'right|equilateral');
  await pressCell(page, 'obtuse|equilateral');
  await submit(page);
  await expectPassed(page);

  // T3 — 점판에 직각이면서 두 변이 같은 삼각형을 만든다. 3·2는 ⓐ ①.
  await focusCanvas(page);
  await pressKeys(page, [
    'Enter',
    'ArrowRight',
    'ArrowRight',
    'ArrowRight',
    'Enter',
    'ArrowLeft',
    'ArrowLeft',
    'ArrowLeft',
    'ArrowDown',
    'ArrowDown',
    'Enter',
    'ArrowUp',
    'ArrowUp',
    'Enter',
  ]);
  await submit(page);
  await expectFailedWithHint(page, '같은 길이인 변이 있나요?', 1);

  const band = main(page).getByRole('button', { name: '고무줄 1', exact: true });
  await band.focus();
  await page.keyboard.press('Delete');
  await expect(main(page).locator('[data-band]')).toHaveCount(0);

  await focusCanvas(page);
  await pressKeys(page, [
    'Enter',
    'ArrowRight',
    'ArrowRight',
    'Enter',
    'ArrowLeft',
    'ArrowLeft',
    'ArrowDown',
    'ArrowDown',
    'Enter',
    'ArrowUp',
    'ArrowUp',
    'Enter',
  ]);
  await submit(page);
  await expectPassed(page);

  // T4 — 예각이 하나라도 있으면 예각삼각형이라고 답하면 ACUTE ①.
  await toggleChoice(page, 'def', '예각이 하나라도 있는 삼각형');
  await submit(page);
  await expectFailedWithHint(page, '둔각이 있는 삼각형에도 예각이 있을까요?', 1);
  await toggleChoice(page, 'def', '세 각이 모두 예각인 삼각형');
  await submit(page);
  await expectPassed(page);

  // T5 — 정삼각형은 이등변삼각형이 아니라고 답하면 EQUI-NOT-ISO ①.
  await toggleChoice(page, 'why', '아니요, 세 변이 모두 같으면 이등변삼각형이 아니에요.');
  await submit(page);
  await expectFailedWithHint(page, '이등변삼각형이 되려면 같은 변이 몇 개 필요하지요?', 1);
  await toggleChoice(page, 'why', '예, 길이가 같은 변이 두 개 이상 있어요.');
  await submit(page);
  await expectPassed(page, true);
});

test('오프라인에서도 g4s2u2.A1 활동이 열린다', async ({ page, context }) => {
  await page.goto(PREVIEW_URL);
  await page.getByRole('button', { name: '1번', exact: true }).click();
  await page.getByRole('button', { name: '건너뛰기' }).click();
  await expect(page).toHaveURL(/#\/map$/);
  await page.goto(`${PREVIEW_URL}/#/activity/g4s2u2.A1`);
  await expect(page.getByRole('heading', { name: '드래깅 테스트 작도' })).toBeVisible();

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
  await expect(page.getByRole('heading', { name: '드래깅 테스트 작도' })).toBeVisible();
  await expect(page.getByRole('button', { name: '확인하기' })).toBeVisible();
});
