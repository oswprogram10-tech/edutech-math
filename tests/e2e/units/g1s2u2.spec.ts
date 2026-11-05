import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { PREVIEW_URL } from '../../../playwright.config';
import { logicalToScreen } from '../canvas-point';
import type { Box } from '../canvas-point';

/**
 * T054 g1s2u2 「덧셈과 뺄셈(1)」 단원 E2E.
 * 활동마다 대표 오답 → 힌트 ① → 고쳐서 통과 순서로 끝까지 해 본다.
 * 아이패드(WebKit)·크롬북·전자칠판 세 뷰포트에서 같은 흐름을 확인한다.
 */

// 블록을 하나씩 끌어 옮기는 과제라 기본 30초로는 모자란다.
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

async function typeNumber(page: Page, id: string, keys: readonly string[]): Promise<void> {
  const box = field(page, id);
  await box.getByRole('button', { name: /빈칸$/ }).first().click();
  for (const key of keys) await page.keyboard.press(key);
}

async function clearNumber(page: Page, id: string): Promise<void> {
  // 입력 대상 필드를 먼저 고른 뒤, 필드 밖에 하나뿐인 키패드의 지우기를 누른다.
  await field(page, id).getByRole('button').first().click();
  await responseSlot(page).getByRole('button', { name: '모두 지우기' }).click();
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

/** 캔버스가 뷰포트보다 길면 아래쪽까지 보이도록 스크롤하고 스크롤 뒤의 상자를 돌려준다. */
async function visibleCanvasBox(page: Page, canvas: Locator): Promise<Box> {
  await canvas.scrollIntoViewIfNeeded();
  const viewport = page.viewportSize();
  const box = await canvas.boundingBox();
  if (!viewport || !box) throw new Error('수 모형 캔버스 크기를 알 수 없습니다.');
  const overflow = box.y + box.height - viewport.height;
  if (overflow > 0) {
    await page.evaluate((delta) => window.scrollBy(0, delta), overflow + 8);
  }
  const fitted = await canvas.boundingBox();
  if (!fitted) throw new Error('수 모형 캔버스 크기를 알 수 없습니다.');
  return fitted;
}

/**
 * 수 모형 블록을 논리 좌표의 목표 자리로 끌어 옮긴다.
 *
 * 64px 터치 타깃을 위해 블록마다 투명한 손가락 여백이 붙는데, 이 여백이 이웃 블록과
 * 크게 겹친다. 그래서 실제 포인터로는 뒤에 그려진 이웃 블록이 대신 잡혀,
 * 가려진 블록은 집을 수 없다. 여기서는 옮길 블록을 정확히 지정해 그 블록에서
 * Pointer Events를 시작한다. 앱의 드래그·자석 스냅·구역 판정 코드는 그대로 지난다.
 */
async function dragBlocks(
  page: Page,
  panel: Locator,
  value: 1 | 10,
  count: number,
  targetX: number,
  targetY: number,
  sourceZone: 'sum' | 'take',
): Promise<void> {
  const canvas = panel.getByTestId('base-ten-canvas');
  const box = await visibleCanvasBox(page, canvas);
  const blocks = panel.locator(`[data-block-value="${value}"]`);
  await expect(blocks.first()).toBeVisible();
  if ((await blocks.count()) < count) {
    throw new Error(`${value} 블록이 ${count}개보다 적습니다.`);
  }
  const to = logicalToScreen(box, targetX, targetY);
  const scale = Math.min(box.width / 1000, box.height / 600);
  const originX = box.x + (box.width - 1000 * scale) / 2;
  const originY = box.y + (box.height - 600 * scale) / 2;
  const stillInSource = (point: { x: number; y: number }): boolean =>
    sourceZone === 'sum' ? point.y < 336 : point.x < 500;

  for (let moved = 0; moved < count; moved += 1) {
    const total = await blocks.count();
    let pick = -1;
    for (let index = total - 1; index >= 0; index -= 1) {
      const candidate = await blocks.nth(index).boundingBox();
      if (!candidate) continue;
      const center = {
        x: (candidate.x + candidate.width / 2 - originX) / scale,
        y: (candidate.y + candidate.height / 2 - originY) / scale,
      };
      if (stillInSource(center)) {
        pick = index;
        break;
      }
    }
    if (pick < 0) throw new Error(`옮길 ${value} 블록을 찾지 못했습니다.`);
    const block = blocks.nth(pick);
    const source = await block.boundingBox();
    if (!source) throw new Error(`${value} 블록 ${pick + 1}번째 자리를 찾을 수 없습니다.`);
    const from = { x: source.x + source.width / 2, y: source.y + source.height / 2 };
    const pointerId = 7 + moved;

    await block.evaluate(
      (element, point) => {
        element.dispatchEvent(
          new PointerEvent('pointerdown', {
            bubbles: true,
            cancelable: true,
            composed: true,
            pointerId: point.pointerId,
            pointerType: 'mouse',
            isPrimary: true,
            button: 0,
            buttons: 1,
            clientX: point.x,
            clientY: point.y,
          }),
        );
      },
      { ...from, pointerId },
    );
    // onPointerDown이 만든 드래그 상태가 다음 렌더에 반영될 때까지 기다린다.
    await page.waitForTimeout(50);
    await canvas.evaluate(
      (element, point) => {
        for (const type of ['pointermove', 'pointerup']) {
          element.dispatchEvent(
            new PointerEvent(type, {
              bubbles: true,
              cancelable: true,
              composed: true,
              pointerId: point.pointerId,
              pointerType: 'mouse',
              isPrimary: true,
              button: 0,
              buttons: type === 'pointerup' ? 0 : 1,
              clientX: point.x,
              clientY: point.y,
            }),
          );
        }
      },
      { ...to, pointerId },
    );
    await page.waitForTimeout(50);
  }
}

/** 개구리 점프 버튼을 차례로 누른다. */
async function jump(panel: Locator, sizes: readonly string[]): Promise<void> {
  for (const size of sizes) {
    await panel.getByRole('button', { name: size, exact: true }).click();
  }
}

test('A1 자석 스냅 수 모형 덧셈·뺄셈 — 대표 오답 뒤 고쳐서 다섯 과제를 통과한다', async ({
  page,
}) => {
  await openActivity(page, 'g1s2u2.A1', '자석 스냅 수 모형 덧셈·뺄셈');
  await screenshot(page, 'g1s2u2-a1.png');
  const panel = slot(page, 'main');

  // T1 — 32+25. 블록을 모두 모으기 칸으로 옮긴 뒤 12라고 답해
  // MC-PV-MIXED-UNITS를 만들고, 두 번째 실패에서 자릿값 오버레이를 본다.
  await dragBlocks(page, panel, 10, 5, 621, 400, 'sum');
  await dragBlocks(page, panel, 1, 7, 863, 400, 'sum');
  await typeNumber(page, 'n', ['1', '2']);
  await submit(page);
  await expectFailedWithHint(page, '묶음은 묶음끼리 모였어?');
  await submit(page);
  await expectFailedWithHint(page, '묶음 칸과 낱개 칸을 따로 세어 볼까?', 2);
  await expect(panel.locator('[data-overlay="place-value"]')).toBeVisible();
  await clearNumber(page, 'n');
  await typeNumber(page, 'n', ['5', '7']);
  await submit(page);
  await expectPassed(page);

  // T2 — 40+30. 십 블록 일곱 개를 옮기고 7이라고 답했다가 70으로 고친다.
  await dragBlocks(page, panel, 10, 7, 621, 400, 'sum');
  await typeNumber(page, 'n', ['7']);
  await submit(page);
  await expectFailedWithHint(page, '묶음은 묶음끼리 모였어?');
  await clearNumber(page, 'n');
  await typeNumber(page, 'n', ['7', '0']);
  await submit(page);
  await expectPassed(page);

  // T3 — 68−23. 십 2개·낱개 3개를 빼기 칸으로 옮기고 91이라고 답했다가 45로 고친다.
  await dragBlocks(page, panel, 10, 2, 806, 300, 'take');
  await dragBlocks(page, panel, 1, 3, 925, 300, 'take');
  await typeNumber(page, 'n', ['9', '1']);
  await submit(page);
  await expectFailedWithHint(page, '처음에 몇 개가 있었지? 뺀 뒤 남은 것만 세어 볼까?');
  await clearNumber(page, 'n');
  await typeNumber(page, 'n', ['4', '5']);
  await submit(page);
  await expectPassed(page);

  // T4 — 57−7. 낱개 일곱 개를 모두 빼고 64라고 답했다가 50으로 고친다.
  await dragBlocks(page, panel, 1, 7, 925, 300, 'take');
  await typeNumber(page, 'n', ['6', '4']);
  await submit(page);
  await expectFailedWithHint(page, '처음에 몇 개가 있었지? 뺀 뒤 남은 것만 세어 볼까?');
  await clearNumber(page, 'n');
  await typeNumber(page, 'n', ['5', '0']);
  await submit(page);
  await expectPassed(page);

  // T5 — 블록 없이 24+15. 12라고 답했다가 39로 고친다.
  await typeNumber(page, 'n', ['1', '2']);
  await submit(page);
  await expectFailedWithHint(page, '묶음은 묶음끼리 모였어?');
  await clearNumber(page, 'n');
  await typeNumber(page, 'n', ['3', '9']);
  await submit(page);
  await expectPassed(page, true);
});

test('A2 수직선 개구리 점프 — 대표 오답 뒤 고쳐서 네 과제를 통과한다', async ({ page }) => {
  await openActivity(page, 'g1s2u2.A2', '수직선 개구리 점프');
  await screenshot(page, 'g1s2u2-a2.png');
  const panel = slot(page, 'main');

  // T1 — 35에서 23. +10 두 번, +1 세 번 뛴 뒤 57이라고 답해
  // MC-JUMP-COUNT-START를 만들고, 두 번째 실패에서 칸 번호 오버레이를 본다.
  await jump(panel, ['+10', '+10', '+1', '+1', '+1']);
  await expect(panel.getByTestId('frog-log')).not.toContainText('58');
  await typeNumber(page, 'n', ['5', '7']);
  await submit(page);
  await expectFailedWithHint(page, '점프는 칸 사이를 세요.');
  await submit(page);
  await expectFailedWithHint(page, '점프마다 칸 사이를 세어 봤어요. 몇 칸 뛰었나요?', 2);
  await expect(panel.locator('[data-overlay="hop-numbers"]')).toBeVisible();
  await clearNumber(page, 'n');
  await typeNumber(page, 'n', ['5', '8']);
  await submit(page);
  await expectPassed(page);

  // T2 — 46에서 32. +10 세 번, +1 두 번 뛰고 70이라고 답했다가 78로 고친다.
  await jump(panel, ['+10', '+10', '+10', '+1', '+1']);
  await expect(panel.getByTestId('frog-log')).not.toContainText('78');
  await typeNumber(page, 'n', ['7', '0']);
  await submit(page);
  await expectFailedWithHint(page, '32에는 10이 몇 번 들어 있을까?');
  await clearNumber(page, 'n');
  await typeNumber(page, 'n', ['7', '8']);
  await submit(page);
  await expectPassed(page);

  // T3 — 87에서 34 뒤로. −10 세 번, −1 네 번 뛰고 121이라고 답했다가 53으로 고친다.
  await jump(panel, ['−10', '−10', '−10', '−1', '−1', '−1', '−1']);
  await expect(panel.getByTestId('frog-log')).not.toContainText('53');
  await typeNumber(page, 'n', ['1', '2', '1']);
  await submit(page);
  await expectFailedWithHint(page, '뒤로 뛰면 수가 커질까, 작아질까?');
  await clearNumber(page, 'n');
  await typeNumber(page, 'n', ['5', '3']);
  await submit(page);
  await expectPassed(page);

  // T4 — 엔진 없이 점프 기록을 식으로 고른다. 24+4를 골랐다가 24+22로 고친다.
  await field(page, 'expr').getByRole('button', { name: '24 + 4' }).click();
  await submit(page);
  await expectFailedWithHint(page, '10 점프 두 번은 모두 몇일까?');
  await field(page, 'expr').getByRole('button', { name: '24 + 22' }).click();
  await submit(page);
  await expectPassed(page, true);
});

test('크롬북·전자칠판 첫 화면에 엔진·응답 칸·확인하기가 들어온다', async ({ page }, testInfo) => {
  test.skip(
    testInfo.project.name === 'ipad',
    '아이패드는 판을 위아래로 두어 짧은 스크롤을 허용한다',
  );

  const cases = [
    {
      id: 'g1s2u2.A1',
      title: '자석 스냅 수 모형 덧셈·뺄셈',
      // 첫 과제에 수 응답 칸이 있어 키패드까지 첫 화면에 들어와야 한다.
      hasResponse: true,
      engine: (panel: Locator) => panel.locator('[data-block-value="10"]').first(),
    },
    {
      id: 'g1s2u2.A2',
      title: '수직선 개구리 점프',
      hasResponse: true,
      engine: (panel: Locator) => panel.getByRole('button', { name: '+10', exact: true }),
    },
  ] as const;

  for (const item of cases) {
    await openActivity(page, item.id, item.title);
    await page.evaluate(() => window.scrollTo(0, 0));

    // 64px 타깃이 켜진 상태에서 엔진 조작·확인하기가 모두 보여야 한다.
    await expect(slot(page, 'main')).toBeInViewport({ ratio: 1 });
    await expect(page.getByRole('button', { name: '확인하기' })).toBeInViewport({ ratio: 1 });
    await expect(item.engine(slot(page, 'main'))).toBeInViewport({ ratio: 1 });
    if (item.hasResponse) {
      await expect(responseSlot(page)).toBeInViewport({ ratio: 1 });
      await expect(
        responseSlot(page).getByRole('button', { name: '1', exact: true }),
      ).toBeInViewport({ ratio: 1 });
    }
  }
});

test('오프라인에서도 g1s2u2.A1 활동이 열린다', async ({ page, context }) => {
  await page.goto(PREVIEW_URL);
  await page.getByRole('button', { name: '1번', exact: true }).click();
  await page.getByRole('button', { name: '건너뛰기' }).click();
  await expect(page).toHaveURL(/#\/map$/);
  await page.goto(`${PREVIEW_URL}/#/activity/g1s2u2.A1`);
  await expect(page.getByRole('heading', { name: '자석 스냅 수 모형 덧셈·뺄셈' })).toBeVisible();

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
  await expect(page.getByRole('heading', { name: '자석 스냅 수 모형 덧셈·뺄셈' })).toBeVisible();
  await expect(page.getByRole('button', { name: '확인하기' })).toBeVisible();
});
