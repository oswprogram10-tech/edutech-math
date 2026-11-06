import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { PREVIEW_URL } from '../../../playwright.config';
import { expectContentPanelsReachable, expectInsideScroller } from '../panel-layout';

/**
 * T052 g1s1u5 「50까지의 수」 단원 E2E.
 * 활동마다 대표 오답 → 힌트 ① → 고쳐서 통과 순서로 끝까지 해 본다.
 * 오개념 규칙과 힌트 ② 오버레이 위치도 함께 확인한다.
 * 아이패드(WebKit)·크롬북·전자칠판 세 뷰포트에서 같은 흐름을 확인한다.
 */

// 과제 하나에 조작·오답·힌트·수정이 이어져 기본 30초로는 모자란다.
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

async function toggleChoice(page: Page, id: string, label: string): Promise<void> {
  await field(page, id).getByRole('button', { name: label, exact: true }).click();
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
 * 실행기 칸 전체(버튼·안내 문구 포함)가 아니라 캔버스 상자와 1px 이내로 겹쳐야 한다(T081).
 */
async function expectOverlayOverCanvas(panel: Locator, overlayName: string, canvasTestId: string) {
  const overlay = panel.locator(`[data-overlay="${overlayName}"]`);
  await expect(overlay).toBeVisible();
  const canvas = panel.getByTestId(canvasTestId);
  // 오버레이는 힌트가 뜬 뒤 효과에서 본 svg를 재어 상자를 맞춘다. 잠깐 기다린다.
  await expect
    .poll(async () => {
      const overlayBox = await overlay.locator('svg').boundingBox();
      const canvasBox = await canvas.boundingBox();
      if (!overlayBox || !canvasBox) return Number.POSITIVE_INFINITY;
      return Math.max(
        Math.abs(overlayBox.x - canvasBox.x),
        Math.abs(overlayBox.y - canvasBox.y),
        Math.abs(overlayBox.width - canvasBox.width),
        Math.abs(overlayBox.height - canvasBox.height),
      );
    })
    .toBeLessThanOrEqual(1);
  // 오버레이가 실제로 무언가를 그렸는지도 확인한다(빈 레이어 통과 방지).
  await expect(overlay.locator('svg')).toHaveCount(1);
}

/**
 * 첫 낱개 블록 하나 둘레에 작은 올가미를 그린다.
 * 올가미는 포인터로만 그릴 수 있어 실제 마우스 움직임을 쓴다.
 * 같은 값 블록 열 개가 아니므로 lastAttempt가 실패로 남는다.
 */
async function lassoOneBlock(page: Page, panel: Locator): Promise<void> {
  const block = panel.locator('[data-block-value="1"]').first();
  await block.scrollIntoViewIfNeeded();
  const rect = await block.evaluate((element) => {
    const box = element.getBoundingClientRect();
    return { x: box.x, y: box.y, width: box.width, height: box.height };
  });
  const svgBox = await panel.locator('svg').first().boundingBox();
  if (!svgBox) throw new Error('수 모형 캔버스 크기를 알 수 없습니다.');
  const pad = 8;
  // 블록이 캔버스 가장자리에 있어도 올가미 시작점이 svg 밖으로 나가지 않게 자른다.
  const left = Math.max(svgBox.x + 2, rect.x - pad);
  const top = Math.max(svgBox.y + 2, rect.y - pad);
  const right = Math.min(svgBox.x + svgBox.width - 2, rect.x + rect.width + pad);
  const bottom = Math.min(svgBox.y + svgBox.height - 2, rect.y + rect.height + pad);
  const points = [
    { x: left, y: top },
    { x: right, y: top },
    { x: right, y: bottom },
    { x: left, y: bottom },
    { x: left, y: top },
  ];
  const first = points[0];
  if (!first) throw new Error('올가미 시작점이 없습니다.');
  await page.mouse.move(first.x, first.y);
  await page.mouse.down();
  for (const point of points.slice(1)) {
    await page.mouse.move(point.x, point.y, { steps: 8 });
  }
  await page.mouse.up();
}

async function pressButton(panel: Locator, name: string): Promise<void> {
  await panel.getByRole('button', { name, exact: true }).press('Enter');
}

test('A1 10개씩 올가미 묶기 — 대표 오답 뒤 고쳐서 일곱 과제를 통과한다', async ({ page }) => {
  await openActivity(page, 'g1s1u5.A1', '10개씩 올가미 묶기');
  await screenshot(page, 'g1s1u5-a1.png');
  const panel = slot(page, 'main');

  // T1 — 묶지 않고 20이라고 써서 MC-PV-NONCANON을 만든 뒤, 힌트 ②까지 보고 고친다.
  await typeNumber(page, 'n', ['2', '0']);
  await submit(page);
  await expectFailedWithHint(page, '낱개 중에 또 묶을 수 있는 게 있을까?');
  // 같은 오답을 한 번 더 내면 ② 점선 올가미와 안내가 나온다.
  await submit(page);
  await expectFailedWithHint(page, '점선 칸에 낱개 10개가 들어가요. 몇 칸이 찼나요?', 2);
  await expectOverlayOverCanvas(panel, 'ten-outline', 'base-ten-canvas');
  const groupTens = panel.getByRole('button', { name: '10개 묶기' });
  await groupTens.click();
  await groupTens.click();
  await expect(groupTens).toBeDisabled();
  await submit(page);
  await expectPassed(page);

  // T2 — 34개를 묶은 뒤 올가미를 잘못 그려 MC-COUNT-ONE-TO-ONE을 만들고 고친다.
  for (let index = 0; index < 3; index += 1) {
    await panel.getByRole('button', { name: '10개 묶기' }).click();
  }
  await lassoOneBlock(page, panel);
  await expect(panel.getByTestId('attempt-badge')).toBeVisible();
  await typeNumber(page, 'n', ['3', '3']);
  await submit(page);
  await expectFailedWithHint(page, '몇 개 들어갔는지 볼까?');
  await clearNumber(page, 'n');
  await typeNumber(page, 'n', ['3', '4']);
  await submit(page);
  await expectPassed(page);

  // T3 — 아무것도 놓지 않고 제출해 틀린 뒤, 묶음 4개와 낱개 7개를 만든다.
  await submit(page);
  await expectFailedWithHint(page, '10개씩 묶음은 몇 개, 낱개는 몇 개인가요?');
  for (let index = 0; index < 4; index += 1) await pressButton(panel, '십 블록 놓기');
  for (let index = 0; index < 7; index += 1) await pressButton(panel, '하나 블록 놓기');
  await submit(page);
  await expectPassed(page);

  // T4 — 아무것도 놓지 않고 제출해 틀린 뒤, 29를 정규형으로 놓는다.
  await submit(page);
  await expectFailedWithHint(page, '10개씩 묶음은 몇 개, 낱개는 몇 개인가요?');
  for (let index = 0; index < 2; index += 1) await pressButton(panel, '십 블록 놓기');
  for (let index = 0; index < 9; index += 1) await pressButton(panel, '하나 블록 놓기');
  await submit(page);
  await expectPassed(page);

  // T5 — 2묶음 15낱개를 그대로 이어 붙여 215라고 써서 MC-PV-NONCANON을 만든 뒤 고친다.
  await typeNumber(page, 'n', ['2', '1', '5']);
  await submit(page);
  await expectFailedWithHint(page, '낱개 중에 또 묶을 수 있는 게 있을까?');
  await panel.getByRole('button', { name: '10개 묶기' }).click();
  await clearNumber(page, 'n');
  await typeNumber(page, 'n', ['3', '5']);
  await submit(page);
  await expectPassed(page);

  // T6 — 엔진 없이 312라고 써서 MC-PV-NONCANON을 만든 뒤 42로 고친다.
  await typeNumber(page, 'n', ['3', '1', '2']);
  await submit(page);
  await expectFailedWithHint(page, '낱개 중에 또 묶을 수 있는 게 있을까?');
  await clearNumber(page, 'n');
  await typeNumber(page, 'n', ['4', '2']);
  await submit(page);
  await expectPassed(page);

  // T7 — 3을 낱개 3개로 골라 MC-PV-DIGIT-FACE를 만든 뒤 묶음 3개로 고친다.
  await toggleChoice(page, 'what', '낱개 3개');
  await submit(page);
  await expectFailedWithHint(page, '3은 무엇이 3개라는 뜻일까?');
  await toggleChoice(page, 'what', '낱개 3개');
  await toggleChoice(page, 'what', '10개씩 묶음 3개');
  await submit(page);
  await expectPassed(page, true);
});

test('A2 구슬셈판 뛰어 세기 — 대표 오답 뒤 고쳐서 다섯 과제를 통과한다', async ({ page }) => {
  await openActivity(page, 'g1s1u5.A2', '구슬셈판 뛰어 세기');
  await screenshot(page, 'g1s1u5-a2.png');
  const panel = slot(page, 'main');

  // T1 — 30개만 밀고 제출해 틀린 뒤, 힌트 ②를 보고 32를 만든다.
  for (const row of [1, 2, 3]) {
    await panel.getByRole('button', { name: `${row}번 줄 10개 밀기`, exact: true }).click();
  }
  await submit(page);
  await expectFailedWithHint(page, '한 줄에 구슬이 몇 개 있지? 몇 줄을 밀면 될까?');
  await submit(page);
  await expectFailedWithHint(page, '민 구슬을 5개·10개씩 묶어 봤어요. 다시 세어 볼까?', 2);
  await expectOverlayOverCanvas(panel, 'bead-groups', 'counters-canvas');
  await panel.getByRole('button', { name: '4번 줄 2개 밀기', exact: true }).click();
  await submit(page);
  await expectPassed(page);

  // T2 — 밀지 않고 제출해 틀린 뒤, 다섯 줄을 하나씩 밀어 10·20·30·40·50을 만든다.
  await submit(page);
  await expectFailedWithHint(page, '한 줄을 통째로 밀면 몇 개가 늘어날까?');
  for (const row of [1, 2, 3, 4, 5]) {
    await panel.getByRole('button', { name: `${row}번 줄 10개 밀기`, exact: true }).click();
  }
  await submit(page);
  await expectPassed(page);

  // T3 — 밀지 않고 제출해 틀린 뒤, 2개씩 밀어 20까지 간다.
  await submit(page);
  await expectFailedWithHint(page, '구슬을 2개씩 밀어 볼까?');
  for (let index = 0; index < 5; index += 1) {
    await panel.getByRole('button', { name: '1번 줄 2개 밀기', exact: true }).click();
    await panel.getByRole('button', { name: '2번 줄 2개 밀기', exact: true }).click();
  }
  await submit(page);
  await expectPassed(page);

  // T4 — 만들지 않고 제출해 틀린 뒤, 27과 31을 차례로 만들고 더 큰 수를 고른다.
  await submit(page);
  await expectFailedWithHint(page, '10개씩 묶음이 더 많은 수는 어느 쪽일까?');
  await panel.getByRole('button', { name: '1번 줄 10개 밀기', exact: true }).click();
  await panel.getByRole('button', { name: '2번 줄 10개 밀기', exact: true }).click();
  for (let index = 0; index < 7; index += 1) {
    await panel.getByRole('button', { name: '3번 줄 1개 밀기', exact: true }).click();
  }
  for (let index = 0; index < 3; index += 1) {
    await panel.getByRole('button', { name: '3번 줄 1개 밀기', exact: true }).click();
  }
  await panel.getByRole('button', { name: '4번 줄 1개 밀기', exact: true }).click();
  await toggleChoice(page, 'big', '31');
  await submit(page);
  await expectPassed(page);

  // T5 — 엔진 없이 29라고 써서 틀린 뒤 30으로 고친다.
  await typeNumber(page, 'n', ['2', '9']);
  await submit(page);
  await expectFailedWithHint(page, '29에서 구슬 하나를 더 밀면 한 줄이 어떻게 될까?');
  await clearNumber(page, 'n');
  await typeNumber(page, 'n', ['3', '0']);
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
      id: 'g1s1u5.A1',
      title: '10개씩 올가미 묶기',
      // 첫 과제에 수 응답 칸이 있어 키패드까지 첫 화면에 들어와야 한다.
      hasResponse: true,
      engine: (panel: Locator) => panel.getByRole('button', { name: '10개 묶기' }),
    },
    {
      id: 'g1s1u5.A2',
      title: '구슬셈판 뛰어 세기',
      // 첫 과제는 구슬만 미는 과제라 응답 칸이 없다(넷째 과제부터 응답).
      hasResponse: false,
      engine: (panel: Locator) =>
        panel.getByRole('button', { name: '1번 줄 10개 밀기', exact: true }),
    },
  ] as const;

  for (const item of cases) {
    await openActivity(page, item.id, item.title);
    await page.evaluate(() => window.scrollTo(0, 0));

    if (item.hasResponse) {
      // 응답 칸은 내용 높이를 쓰므로 판 안 스크롤 대신 페이지 스크롤로 확인한다.
      await expectContentPanelsReachable(page);
      await expect(responseSlot(page)).toBeVisible();
      await expectInsideScroller(item.engine(slot(page, 'main')));
      await expectInsideScroller(
        responseSlot(page).getByRole('button', { name: '1', exact: true }),
      );
      continue;
    }

    // 64px 타깃이 켜진 상태에서 엔진 조작·확인하기가 모두 보여야 한다.
    await expect(slot(page, 'main')).toBeInViewport({ ratio: 1 });
    await expect(page.getByRole('button', { name: '확인하기' })).toBeInViewport({ ratio: 1 });
    await expect(item.engine(slot(page, 'main'))).toBeInViewport({ ratio: 1 });
  }
});

test('오프라인에서도 g1s1u5.A1 활동이 열린다', async ({ page, context }) => {
  await page.goto(PREVIEW_URL);
  await page.getByRole('button', { name: '1번', exact: true }).click();
  await page.getByRole('button', { name: '건너뛰기' }).click();
  await expect(page).toHaveURL(/#\/map$/);
  await page.goto(`${PREVIEW_URL}/#/activity/g1s1u5.A1`);
  await expect(page.getByRole('heading', { name: '10개씩 올가미 묶기' })).toBeVisible();

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
  await expect(page.getByRole('heading', { name: '10개씩 올가미 묶기' })).toBeVisible();
  await expect(page.getByRole('button', { name: '확인하기' })).toBeVisible();
});
