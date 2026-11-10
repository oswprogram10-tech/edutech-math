import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { PREVIEW_URL } from '../../../playwright.config';
import { expectContentPanelsReachable } from '../panel-layout';

/**
 * T112 g3s1u2 「평면도형」 A1 「선 레이저 발사기」·A2 「직각 찾기와 직각 도형 만들기」 단원 E2E.
 * 과제마다 대표 오답 → 힌트 ① → 고쳐서 통과 순서로 끝까지 해 본다.
 * 아이패드(WebKit)·크롬북·전자칠판 세 뷰포트에서 같은 흐름을 확인한다.
 */

// 키보드로 못을 하나씩 옮기는 과제라 기본 30초로는 모자란다.
test.describe.configure({ timeout: 180_000 });

const PEG_ORIGIN = 100;
/** 못판은 1000×1000 논리 좌표에 100 여백을 두고 가운데 놓는다. */
function pegStep(grid: number): number {
  return (1000 - PEG_ORIGIN * 2) / (grid - 1);
}

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
async function cursorPeg(page: Page, grid: number): Promise<[number, number]> {
  const cursor = canvas(page).getByTestId('geo-cursor');
  await expect(cursor).toBeVisible();
  const cx = Number(await cursor.getAttribute('cx'));
  const cy = Number(await cursor.getAttribute('cy'));
  const step = pegStep(grid);
  return [Math.round((cx - PEG_ORIGIN) / step), Math.round((cy - PEG_ORIGIN) / step)];
}

/** 방향키로 커서를 못 (i,j)로 옮긴다. */
async function moveCursorTo(page: Page, grid: number, i: number, j: number): Promise<void> {
  const [startX, startY] = await cursorPeg(page, grid);
  const horizontal = i >= startX ? 'ArrowRight' : 'ArrowLeft';
  const vertical = j >= startY ? 'ArrowDown' : 'ArrowUp';
  for (let count = 0; count < Math.abs(i - startX); count += 1) {
    await page.keyboard.press(horizontal);
  }
  for (let count = 0; count < Math.abs(j - startY); count += 1) {
    await page.keyboard.press(vertical);
  }
  expect(await cursorPeg(page, grid)).toEqual([i, j]);
}

async function pressPeg(page: Page): Promise<void> {
  await page.keyboard.press('Enter');
}

/** construct에서 지금 고른 도구로 두 점을 잇는다. */
async function drawConstruct(
  page: Page,
  grid: number,
  from: readonly [number, number],
  to: readonly [number, number],
): Promise<void> {
  const before = await canvas(page).locator('[data-object]').count();
  await focusCanvas(page);
  await moveCursorTo(page, grid, from[0], from[1]);
  await pressPeg(page);
  await moveCursorTo(page, grid, to[0], to[1]);
  await pressPeg(page);
  await expect(canvas(page).locator('[data-object]')).toHaveCount(before + 1);
}

async function chooseTool(page: Page, label: string): Promise<void> {
  await slot(page, 'main').getByRole('button', { name: label, exact: true }).click();
}

/// construct에서 마지막으로 그린 선을 지운다.
async function removeLastObject(page: Page): Promise<void> {
  const objects = canvas(page).locator('[data-object]');
  const before = await objects.count();
  await slot(page, 'main').getByRole('button', { name: '선 지우기', exact: true }).click();
  await expect(objects).toHaveCount(before - 1);
}

/** 못 목록을 차례로 이어 닫힌 고무줄 하나를 만든다. */
async function drawClosedShape(
  page: Page,
  pegs: readonly (readonly [number, number])[],
): Promise<void> {
  await focusCanvas(page);
  const first = pegs[0];
  if (!first) throw new Error('못이 없습니다.');
  await moveCursorTo(page, 5, first[0], first[1]);
  await pressPeg(page);
  for (const peg of pegs.slice(1)) {
    await moveCursorTo(page, 5, peg[0], peg[1]);
    await pressPeg(page);
  }
  await moveCursorTo(page, 5, first[0], first[1]);
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

/** 각 꼭짓점에 삼각자를 대고 직각 표시를 한다. */
async function markAngle(page: Page, index: number): Promise<void> {
  const angle = slot(page, 'main').getByRole('button', { name: `각 ${index}`, exact: true });
  await angle.focus();
  await expect(angle).toBeFocused();
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: '직각 표시하기', exact: true }).click();
}

async function choose(page: Page, fieldId: string, label: string): Promise<void> {
  const field = slot(page, 'response').locator(`[data-response-field="${fieldId}"]`);
  await field.getByRole('button', { name: label, exact: true }).click();
}

function sortPanel(page: Page): Locator {
  return slot(page, 'response').locator('[data-response-kind="sort"]');
}

async function pickSortCard(page: Page, label: string): Promise<void> {
  await sortPanel(page)
    .getByRole('button', { name: `${label} 옮길 카드로 고르기`, exact: true })
    .click();
}

async function placeSortCard(page: Page, bin: string): Promise<void> {
  await sortPanel(page)
    .getByRole('button', { name: `${bin} 여기에 놓기`, exact: true })
    .click();
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

test('A1 선 레이저 발사기 — 대표 오답 뒤 고쳐서 네 과제를 통과한다', async ({ page }) => {
  await openActivity(page, 'g3s1u2.A1', '선 레이저 발사기');
  await screenshot(page, 'g3s1u2-a1.png');
  const panel = slot(page, 'main');

  // T1 — 반직선으로 ㄱ→ㄴ을 그어 MC-GEO-RAY-LINE-CONFUSE ①·②를 본 뒤,
  // 지우고 선분으로 고친다. ②에서 laser-extent 정렬도 확인한다.
  await chooseTool(page, '반직선');
  await drawConstruct(page, 9, [2, 4], [6, 4]);
  await submit(page);
  await expectFailedWithHint(page, '이 선은 몇 쪽으로 끝이 없을까요?');
  await submit(page);
  await expectFailedWithHint(page, '그은 선의 끝이 있는 쪽과 없는 쪽을 표시했어요.', 2);
  const laser = await expectOverlayOverCanvas(panel, 'laser-extent', 'geo-canvas');
  await expect(laser.locator('line')).not.toHaveCount(0);
  await removeLastObject(page);
  await chooseTool(page, '선분');
  await drawConstruct(page, 9, [2, 4], [6, 4]);
  await submit(page);
  await expectPassed(page);

  // T2 — 선분으로 두 별을 맞혀 MC-GEO-RAY-LINE-CONFUSE ①을 본 뒤,
  // 지우고 반직선으로 고친다.
  await expect(page.getByText('별 두 개를 한 번에 지나가는 반직선을 쏘아요.')).toBeVisible();
  await chooseTool(page, '선분');
  await drawConstruct(page, 9, [1, 1], [7, 4]);
  await submit(page);
  await expectFailedWithHint(page, '이 선은 몇 쪽으로 끝이 없을까요?');
  await removeLastObject(page);
  await chooseTool(page, '반직선');
  await drawConstruct(page, 9, [1, 1], [3, 2]);
  await submit(page);
  await expectPassed(page);

  // T3 — 반직선 ㄱㄴ 하나만 그어 힌트 ①을 본 뒤, 반직선 ㄴㄱ을 더 그어 통과한다.
  await expect(
    page.getByText('점 ㄱ과 점 ㄴ만 써서 반직선 ㄱㄴ과 반직선 ㄴㄱ을 각각 그어요.'),
  ).toBeVisible();
  await chooseTool(page, '반직선');
  await drawConstruct(page, 9, [2, 4], [6, 4]);
  await submit(page);
  await expectFailedWithHint(page, '두 반직선은 각각 어느 점에서 시작하나요?');
  await drawConstruct(page, 9, [6, 4], [2, 4]);
  await submit(page);
  await expectPassed(page);

  // T4 — ㄱㄴ과 ㄷㄹ을 바꿔 놓아 힌트 ①을 본 뒤, 다시 옮겨 통과한다.
  await expect(page.getByText('세 선을 알맞은 상자에 놓아요.')).toBeVisible();
  await expect(sortPanel(page)).toHaveAttribute('aria-label', '카드 나누기');
  await pickSortCard(page, '선 ㄱㄴ');
  await placeSortCard(page, '직선');
  await pickSortCard(page, '선 ㄷㄹ');
  await placeSortCard(page, '반직선');
  await pickSortCard(page, '선 ㅁㅂ');
  await placeSortCard(page, '선분');
  await submit(page);
  await expectFailedWithHint(page, '선마다 몇 쪽으로 끝이 없을까요?');
  await pickSortCard(page, '선 ㄱㄴ');
  await placeSortCard(page, '반직선');
  await pickSortCard(page, '선 ㄷㄹ');
  await placeSortCard(page, '직선');
  await submit(page);
  await expectPassed(page, true);
});

test('A2 직각 찾기 — 대표 오답 뒤 고쳐서 네 과제를 통과한다', async ({ page }) => {
  await openActivity(page, 'g3s1u2.A2', '직각 찾기와 직각 도형 만들기');
  await screenshot(page, 'g3s1u2-a2.png');
  const panel = slot(page, 'main');

  // T1 — 바른 직각 k1·k6만 표시해 MC-GEO-RIGHT-ANGLE-ORIENT ①·②를 본 뒤,
  // 기울어진 직각 k2·k4도 표시해 통과한다.
  await markAngle(page, 1);
  await markAngle(page, 6);
  await submit(page);
  await expectFailedWithHint(page, '삼각자를 돌려서 대 보면 어떨까요?');
  await submit(page);
  await expectFailedWithHint(page, '삼각자를 각에 대고 돌려 보세요. 꼭 맞나요?', 2);
  await expectOverlayOverCanvas(panel, 'square-turn', 'geo-canvas');
  await markAngle(page, 2);
  await markAngle(page, 4);
  await submit(page);
  await expectPassed(page);

  // T2 — 예각삼각형을 만들어 힌트 ①·②(angle-kinds)를 본 뒤,
  // 지우고 직각이 하나인 삼각형을 만든다.
  await expect(page.getByText('직각이 하나인 삼각형을 고무줄로 만들어요.')).toBeVisible();
  await drawClosedShape(page, [
    [0, 0],
    [4, 0],
    [2, 3],
  ]);
  await submit(page);
  await expectFailedWithHint(page, '삼각자 모서리에 꼭 맞는 각이 있나요?');
  await submit(page);
  await expectFailedWithHint(page, '만든 도형의 각마다 종류를 무늬로 칠했어요.', 2);
  const angles = panel.locator('[data-overlay="angle-kinds"]');
  await expect(angles).toBeVisible();
  await expect(angles.locator('path')).not.toHaveCount(0);
  await deleteLastShape(page);
  await drawClosedShape(page, [
    [0, 0],
    [3, 0],
    [0, 2],
  ]);
  await submit(page);
  await expectPassed(page);

  // T3 — 정사각형 두 개를 만들어 힌트 ①을 본 뒤, 하나를 지우고
  // 2×1 직사각형으로 바꿔 통과한다.
  await expect(
    page.getByText('네 각이 모두 직각인 사각형을 두 개 만들어요.', { exact: false }),
  ).toBeVisible();
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
  await expectFailedWithHint(page, '삼각자 모서리에 꼭 맞는 각이 있나요?');
  await deleteLastShape(page);
  await drawClosedShape(page, [
    [2, 2],
    [4, 2],
    [4, 3],
    [2, 3],
  ]);
  await submit(page);
  await expectPassed(page);

  // T4 — '아니요'를 골라 MC-GEO-SQUARE-NOT-RECT ①·②(property-checklist)를 본 뒤,
  // '예'와 까닭을 골라 통과한다.
  await expect(page.getByText('정사각형은 직사각형일까요? 까닭도 함께 골라요.')).toBeVisible();
  await choose(page, 'yn', '아니요');
  await choose(page, 'reason', '네 각이 모두 직각이에요');
  await submit(page);
  await expectFailedWithHint(
    page,
    '직사각형이 되려면 무엇이 필요했지요? 정사각형은 그걸 가졌나요?',
  );
  await submit(page);
  await expectFailedWithHint(page, '미리 놓인 도형에 직사각형의 조건을 하나씩 확인했어요.', 2);
  const checklist = panel.locator('[data-overlay="property-checklist"]');
  await expect(checklist).toBeVisible();
  await expect(checklist).toContainText('네 각이 모두 직각이에요');
  await expect(checklist.getByText('✓')).toHaveCount(2);
  await choose(page, 'yn', '예');
  // reason은 이미 '네 각이 모두 직각이에요'가 선택되어 있다(다시 누르면 해제된다).
  const reason = slot(page, 'response').locator('[data-response-field="reason"]');
  await expect(
    reason.getByRole('button', { name: '네 각이 모두 직각이에요', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await submit(page);
  await expectPassed(page, true);
});

test('A2 T1 일반 힌트 — 직각이 아닌 각만 표시하면 힌트 ①이 나온다', async ({ page }) => {
  await openActivity(page, 'g3s1u2.A2', '직각 찾기와 직각 도형 만들기');
  // k3은 예각이다. 삼각자를 대고 표시하면 대표 오답이 되어 일반 힌트 ①이 나온다.
  await markAngle(page, 3);
  await submit(page);
  await expectFailedWithHint(page, '삼각자를 대어 꼭 맞는 각만 표시했나요?');
});

test('첫 화면에 엔진·확인하기가 들어온다', async ({ page }) => {
  // 9×9 construct 판은 세로가 길어 앱 스크롤로 '확인하기'에 닿는지 본다.
  await openActivity(page, 'g3s1u2.A1', '선 레이저 발사기');
  await page.evaluate(() => window.scrollTo(0, 0));
  await expectContentPanelsReachable(page);
  await expect(canvas(page)).toBeVisible();
  await expect(page.getByRole('button', { name: '확인하기' })).toBeVisible();

  // classify 5×5 판도 같은 기준으로 확인한다.
  await openActivity(page, 'g3s1u2.A2', '직각 찾기와 직각 도형 만들기');
  await page.evaluate(() => window.scrollTo(0, 0));
  await expectContentPanelsReachable(page);
  await expect(canvas(page)).toBeVisible();
  await expect(page.getByRole('button', { name: '확인하기' })).toBeVisible();
});

test('오프라인에서도 g3s1u2.A1 활동이 열린다', async ({ page, context }) => {
  await page.goto(PREVIEW_URL);
  await page.getByRole('button', { name: '1번', exact: true }).click();
  await page.getByRole('button', { name: '건너뛰기' }).click();
  await expect(page).toHaveURL(/#\/map$/);
  await page.goto(`${PREVIEW_URL}/#/activity/g3s1u2.A1`);
  await expect(page.getByRole('heading', { name: '선 레이저 발사기' })).toBeVisible();

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
  await expect(page.getByRole('heading', { name: '선 레이저 발사기' })).toBeVisible();
  await expect(page.getByRole('button', { name: '확인하기' })).toBeVisible();
});
