import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { PREVIEW_URL } from '../../../playwright.config';
import {
  expectChromeBookCanvasSize,
  expectContentPanelsReachable,
  expectFitCanvasVisible,
} from '../panel-layout';

/**
 * T111 g2s1u2 「여러 가지 도형」 A1 「고무줄 기하판」 단원 E2E.
 * 과제마다 대표 오답 → 힌트 ① → 고쳐서 통과 순서로 끝까지 해 본다.
 * 아이패드(WebKit)·크롬북·전자칠판 세 뷰포트에서 같은 흐름을 확인한다.
 */

// 키보드로 못을 하나씩 옮기는 과제라 기본 30초로는 모자란다.
test.describe.configure({ timeout: 180_000 });

const PEG_STEP = 200;
const PEG_ORIGIN = 100;

function slot(page: Page, name: string): Locator {
  return page.getByTestId(`runner-slot-${name}`);
}

function canvas(page: Page): Locator {
  return slot(page, 'main').getByTestId('geo-canvas');
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

/** 키보드 커서의 못 좌표. 화면의 `[data-testid="geo-cursor"]` cx·cy로 읽는다. */
async function cursorPeg(page: Page): Promise<[number, number]> {
  const cursor = canvas(page).getByTestId('geo-cursor');
  await expect(cursor).toBeVisible();
  const cx = Number(await cursor.getAttribute('cx'));
  const cy = Number(await cursor.getAttribute('cy'));
  return [Math.round((cx - PEG_ORIGIN) / PEG_STEP), Math.round((cy - PEG_ORIGIN) / PEG_STEP)];
}

/** 방향키로 커서를 못 (i,j)로 옮긴다. */
async function moveCursorTo(page: Page, i: number, j: number): Promise<void> {
  const [startX, startY] = await cursorPeg(page);
  const horizontal = i >= startX ? 'ArrowRight' : 'ArrowLeft';
  const vertical = j >= startY ? 'ArrowDown' : 'ArrowUp';
  for (let count = 0; count < Math.abs(i - startX); count += 1) {
    await page.keyboard.press(horizontal);
  }
  for (let count = 0; count < Math.abs(j - startY); count += 1) {
    await page.keyboard.press(vertical);
  }
  expect(await cursorPeg(page)).toEqual([i, j]);
}

async function pressPeg(page: Page): Promise<void> {
  await page.keyboard.press('Enter');
}

/** 못 목록을 차례로 이어 닫힌 고무줄 하나를 만든다. */
async function drawClosedShape(
  page: Page,
  pegs: readonly (readonly [number, number])[],
): Promise<void> {
  await focusCanvas(page);
  const first = pegs[0];
  if (!first) throw new Error('못이 없습니다.');
  await moveCursorTo(page, first[0], first[1]);
  await pressPeg(page);
  for (const peg of pegs.slice(1)) {
    await moveCursorTo(page, peg[0], peg[1]);
    await pressPeg(page);
  }
  await moveCursorTo(page, first[0], first[1]);
  await pressPeg(page);
  await expect(slot(page, 'main').locator('[data-band][data-closed="true"]').last()).toBeVisible();
}

/** 마지막 고무줄을 지운다. Delete는 포커스된 `[data-band]`에서만 동작한다. */
async function deleteLastShape(page: Page): Promise<void> {
  const bands = slot(page, 'main').locator('[data-band]');
  const before = await bands.count();
  const band = bands.last();
  await band.focus();
  await expect(band).toBeFocused();
  await page.keyboard.press('Delete');
  await expect(bands).toHaveCount(before - 1);
}

async function choose(page: Page, fieldId: string, label: string): Promise<void> {
  const field = slot(page, 'response').locator(`[data-response-field="${fieldId}"]`);
  await field.getByRole('button', { name: label, exact: true }).click();
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

/**
 * 힌트 ② 오버레이가 엔진의 본 캔버스 svg와 같은 자리·크기에 놓였는지 확인한다.
 */
async function expectOverlayOverCanvas(
  panel: Locator,
  overlayName: string,
  canvasTestId: string,
): Promise<Locator> {
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
  return overlay;
}

test('A1 고무줄 기하판 — 대표 오답 뒤 고쳐서 다섯 과제를 통과한다', async ({ page }) => {
  await openActivity(page, 'g2s1u2.A1', '고무줄 기하판');
  await screenshot(page, 'g2s1u2-a1.png');
  const panel = slot(page, 'main');

  // T1 — 4×4 사각형을 만들어 제출해 힌트 ①을 본 뒤, 지우고 삼각형을 만든다.
  await drawClosedShape(page, [
    [0, 0],
    [4, 0],
    [4, 4],
    [0, 4],
  ]);
  await submit(page);
  await expectFailedWithHint(page, '곧은 선 3개로 둘러싸 볼까요?');
  await deleteLastShape(page);
  await drawClosedShape(page, [
    [0, 0],
    [4, 0],
    [0, 4],
  ]);
  await submit(page);
  await expectPassed(page);

  // T2 — 같은 정사각형을 두 번 그려 제출해 힌트 ①을 본 뒤,
  // 두 번째를 지우고 2×1 직사각형으로 바꾼다.
  await expect(page.getByText('모양이 서로 다른 사각형을 두 개 만들어요.')).toBeVisible();
  await drawClosedShape(page, [
    [0, 0],
    [1, 0],
    [1, 1],
    [0, 1],
  ]);
  await drawClosedShape(page, [
    [2, 2],
    [3, 2],
    [3, 3],
    [2, 3],
  ]);
  await submit(page);
  await expectFailedWithHint(page, '두 사각형을 돌려서 겹치면 꼭 맞을까요?');
  await deleteLastShape(page);
  await drawClosedShape(page, [
    [2, 2],
    [4, 2],
    [4, 3],
    [2, 3],
  ]);
  await submit(page);
  await expectPassed(page);

  // T3 — 일직선 위의 못이 섞인 오각형으로 제출해 MC-SHAPE-VERTEX-COUNT ①·②를 본 뒤,
  // 지우고 꺾이는 점이 다섯인 도형을 만든다. ②에서 straight-run 정렬도 확인한다.
  await expect(page.getByText('꼭짓점이 5개인 도형을 만들어요.')).toBeVisible();
  await drawClosedShape(page, [
    [0, 0],
    [2, 0],
    [4, 0],
    [4, 4],
    [0, 4],
  ]);
  await submit(page);
  await expectFailedWithHint(page, '못마다 선이 꺾이는지 살펴볼까요?');
  await submit(page);
  await expectFailedWithHint(page, '꺾이지 않는 못에 × 표시를 했어요.', 2);
  const overlay = await expectOverlayOverCanvas(panel, 'straight-run', 'geo-canvas');
  await expect(overlay.locator('line')).not.toHaveCount(0);
  await deleteLastShape(page);
  await drawClosedShape(page, [
    [0, 0],
    [2, 0],
    [4, 2],
    [2, 4],
    [0, 4],
  ]);
  await submit(page);
  await expectPassed(page);

  // T4 — 미리 놓인 육각형에 오각형을 골라 제출해 힌트 ①을 본 뒤, 육각형을 고른다.
  await expect(page.getByText('꼭짓점이 6개인 도형이에요. 이름은 무엇일까요?')).toBeVisible();
  await choose(page, 'name', '오각형');
  await submit(page);
  await expectFailedWithHint(page, '삼각형, 사각형은 무엇을 보고 이름을 붙였나요?');
  await choose(page, 'name', '육각형');
  await submit(page);
  await expectPassed(page);

  // T5 — 기울어진 정사각형에 '사각형이 아니에요'를 골라 MC-SHAPE-ORIENTATION ①·②를 본 뒤,
  // '사각형이에요'로 고쳐 마친다.
  await expect(page.getByText('비스듬히 놓인 도형이에요. 이 도형도 사각형일까요?')).toBeVisible();
  await choose(page, 'quad', '사각형이 아니에요');
  await submit(page);
  await expectFailedWithHint(page, '변과 꼭짓점을 세어 볼까요?');
  await submit(page);
  await expectFailedWithHint(
    page,
    '바로 세운 모습을 파란 점선으로 그렸어요. 변과 꼭짓점 수가 달라졌나요?',
    2,
  );
  const ghost = panel.locator('[data-overlay="upright-ghost"]');
  await expect(ghost).toBeVisible();
  await expect(ghost.locator('polygon, path')).not.toHaveCount(0);
  await choose(page, 'quad', '사각형이에요');
  await submit(page);
  await expectPassed(page, true);
});

test('아이패드·크롬북·전자칠판 첫 화면에 엔진·확인하기가 들어온다', async ({ page }, testInfo) => {
  await openActivity(page, 'g2s1u2.A1', '고무줄 기하판');
  await page.evaluate(() => window.scrollTo(0, 0));
  // T122로 못판이 실행기 판 높이에 맞춰 줄어들어 세 뷰포트 모두 판 안 스크롤이 없다.
  await expectContentPanelsReachable(page);
  const boxes = await expectFitCanvasVisible(page);

  // 64px 타깃이 켜진 상태에서 판과 조작·확인하기가 모두 첫 화면에 보여야 한다.
  const panel = slot(page, 'main');
  await expect(panel).toBeInViewport({ ratio: 1 });
  await expect(page.getByRole('button', { name: '확인하기' })).toBeInViewport({ ratio: 1 });
  await expect(canvas(page)).toBeInViewport({ ratio: 1 });
  if (testInfo.project.name === 'chromebook') expectChromeBookCanvasSize(boxes);
});

test('오프라인에서도 g2s1u2.A1 활동이 열린다', async ({ page, context }) => {
  await page.goto(PREVIEW_URL);
  await page.getByRole('button', { name: '1번', exact: true }).click();
  await page.getByRole('button', { name: '건너뛰기' }).click();
  await expect(page).toHaveURL(/#\/map$/);
  await page.goto(`${PREVIEW_URL}/#/activity/g2s1u2.A1`);
  await expect(page.getByRole('heading', { name: '고무줄 기하판' })).toBeVisible();

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
  await expect(page.getByRole('heading', { name: '고무줄 기하판' })).toBeVisible();
  await expect(page.getByRole('button', { name: '확인하기' })).toBeVisible();
});
