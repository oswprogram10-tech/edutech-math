import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { PREVIEW_URL } from '../../../playwright.config';
import { expectContentPanelsReachable, expectInsideScroller } from '../panel-layout';

/**
 * T056 g1s2u6 「덧셈과 뺄셈(3)」 단원 E2E.
 * 활동마다 대표 오답 → 힌트 ① → 고쳐서 통과 순서로 끝까지 해 본다.
 * 오개념 규칙(MC-MAKE10-SPLIT·MC-ADD-BRIDGE-OFF-BY-ONE·MC-SUB-DIRECTION·
 * MC-EQUAL-ANSWER)과 힌트 ② 오버레이도 확인한다.
 * 아이패드(WebKit)·크롬북·전자칠판 세 뷰포트에서 같은 흐름을 확인한다.
 */

// 과제 하나에 조작·오답·힌트·수정이 이어져 기본 30초로는 모자란다.
test.describe.configure({ timeout: 240_000 });

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

async function retypeNumber(page: Page, id: string, keys: readonly string[]): Promise<void> {
  await clearNumber(page, id);
  await typeNumber(page, id, keys);
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

/** 오른쪽 프레임의 셈돌을 왼쪽 프레임으로 넘긴다. */
async function swipeToFirstFrame(panel: Locator): Promise<void> {
  await panel.getByRole('button', { name: '1번 프레임으로 밀기', exact: true }).click();
}

/** 프레임에 놓인 셈돌 하나를 집어 낸다(키보드 Enter). */
async function removeOneCounter(panel: Locator): Promise<void> {
  await panel.locator('[data-counter-id]').first().press('Enter');
}

test('A1 이중 텐프레임 10 채우기 — 대표 오답 뒤 고쳐서 다섯 과제를 통과한다', async ({ page }) => {
  await openActivity(page, 'g1s2u6.A1', '이중 텐프레임 10 채우기');
  await screenshot(page, 'g1s2u6-a1.png');
  const panel = slot(page, 'main');

  // T1 — 12라고 답해 MC-ADD-BRIDGE-OFF-BY-ONE을 만든 뒤, 힌트 ②까지 보고 13으로 고친다.
  await typeNumber(page, 'n', ['1', '2']);
  await submit(page);
  await expectFailedWithHint(page, '오른쪽에 남은 셈돌을 세어 볼까?');
  // 같은 오답을 한 번 더 내면 ② 남은 셈돌 번호와 안내가 나온다.
  await submit(page);
  await expectFailedWithHint(page, '남은 셈돌에 번호를 붙였어요.', 2);
  await expectOverlayOverCanvas(panel, 'count-ones', 'counters-canvas');

  // 오른쪽 셈돌을 왼쪽으로 넘기면 왼쪽 10, 오른쪽 3이 된다.
  await swipeToFirstFrame(panel);
  await expect(panel.locator('[data-frame="0"]')).toBeVisible();
  await retypeNumber(page, 'n', ['1', '3']);
  await submit(page);
  await expectPassed(page);

  // T2 — 넘긴 수를 3, 모두를 16이라고 답해 MC-MAKE10-SPLIT을 만든 뒤 힌트 ②까지 본다.
  await typeNumber(page, 'x', ['3']);
  await typeNumber(page, 'n', ['1', '6']);
  await submit(page);
  await expectFailedWithHint(page, '10이 되려면 몇 개가 더 필요해?');
  await submit(page);
  await expectFailedWithHint(page, '왼쪽 프레임의 빈칸에 점선 동그라미를 그렸어요.', 2);
  await expectOverlayOverCanvas(panel, 'frame-gaps', 'counters-canvas');

  // 넘겨서 가르기 나무를 만들고, 넘긴 수 1과 모두 15로 고친다.
  await swipeToFirstFrame(panel);
  await retypeNumber(page, 'x', ['1']);
  await retypeNumber(page, 'n', ['1', '5']);
  await submit(page);
  await expectPassed(page);

  // T3 — 12라고 답해 다시 MC-ADD-BRIDGE-OFF-BY-ONE을 만든 뒤, 넘겨서 13으로 고친다.
  await typeNumber(page, 'n', ['1', '2']);
  await submit(page);
  await expectFailedWithHint(page, '오른쪽에 남은 셈돌을 세어 볼까?');
  await swipeToFirstFrame(panel);
  await retypeNumber(page, 'n', ['1', '3']);
  await submit(page);
  await expectPassed(page);

  // T4 — 18이라고 답해 MC-SUB-DIRECTION을 만든 뒤, 5개를 빼고 8로 고친다.
  await typeNumber(page, 'n', ['1', '8']);
  await submit(page);
  await expectFailedWithHint(page, '3개에서 5개를 뺄 수 있어?');
  for (let index = 0; index < 5; index += 1) await removeOneCounter(panel);
  await expect(panel.locator('[data-counter-id]')).toHaveCount(8);
  await retypeNumber(page, 'n', ['8']);
  await submit(page);
  await expectPassed(page);

  // T5 — 엔진 없이 22라고 답해 MC-EQUAL-ANSWER를 만든 뒤, 8로 고친다.
  await typeNumber(page, 'n', ['2', '2']);
  await submit(page);
  await expectFailedWithHint(page, '양쪽이 같아야 해. 7에 얼마를 더하면 15가 될까?');
  await retypeNumber(page, 'n', ['8']);
  await submit(page);
  await expectPassed(page, true);
});

test('A2 블록 다리 건설 — 대표 오답 뒤 고쳐서 네 과제를 통과한다', async ({ page }) => {
  await openActivity(page, 'g1s2u6.A2', '블록 다리 건설');
  await screenshot(page, 'g1s2u6-a2.png');
  const panel = slot(page, 'main');

  // T1 — 막대 없이 제출해 틀린 뒤, 9와 4로 틈 13을 채운다.
  await submit(page);
  await expectFailedWithHint(page, '10칸 표시선까지 몇 칸이 남았을까?');
  await panel.getByRole('button', { name: '9칸 막대', exact: true }).click();
  await panel.getByRole('button', { name: '4칸 막대', exact: true }).click();
  await submit(page);
  await expectPassed(page);

  // T2 — 9가 놓인 채로 제출해 틀린 뒤, 6을 더해 틈 15를 채운다.
  await submit(page);
  await expectFailedWithHint(page, '10칸 표시선까지 몇 칸이 남았을까?');
  await panel.getByRole('button', { name: '6칸 막대', exact: true }).click();
  await submit(page);
  await expectPassed(page);

  // T3 — 기록 없이 제출해 틀린 뒤, 서로 다른 두 방법(9+2, 8+3)을 기록한다.
  await submit(page);
  await expectFailedWithHint(page, '막대 하나를 바꾸면 다른 방법이 생길까?');
  await panel.getByRole('button', { name: '9칸 막대', exact: true }).click();
  await panel.getByRole('button', { name: '2칸 막대', exact: true }).click();
  await panel.getByRole('button', { name: '다리 기록하기', exact: true }).click();
  await panel.getByRole('button', { name: '9짜리 막대 빼기', exact: true }).press('Delete');
  await panel.getByRole('button', { name: '2짜리 막대 빼기', exact: true }).press('Delete');
  await panel.getByRole('button', { name: '8칸 막대', exact: true }).click();
  await panel.getByRole('button', { name: '3칸 막대', exact: true }).click();
  await panel.getByRole('button', { name: '다리 기록하기', exact: true }).click();
  await submit(page);
  await expectPassed(page);

  // T4 — 9+7로 너무 긴 채 제출해 틀린 뒤, 7을 빼고 5를 놓아 9+5로 고친다.
  await submit(page);
  await expectFailedWithHint(page, '어느 막대가 너무 길까? 몇 칸이 튀어나왔지?');
  await panel.getByRole('button', { name: '7짜리 막대 빼기', exact: true }).press('Delete');
  await panel.getByRole('button', { name: '5칸 막대', exact: true }).click();
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
      id: 'g1s2u6.A1',
      title: '이중 텐프레임 10 채우기',
      // 첫 과제부터 수 응답 칸과 키패드가 있다.
      hasResponse: true,
      engine: (panel: Locator) =>
        panel.getByRole('button', { name: '1번 프레임으로 밀기', exact: true }),
    },
    {
      id: 'g1s2u6.A2',
      title: '블록 다리 건설',
      // 첫 과제는 막대만 놓는 과제라 응답 칸이 없다(둘째 과제부터도 없다).
      hasResponse: false,
      engine: (panel: Locator) => panel.getByRole('button', { name: '9칸 막대', exact: true }),
    },
  ] as const;

  for (const item of cases) {
    await openActivity(page, item.id, item.title);
    await page.evaluate(() => window.scrollTo(0, 0));

    if (item.hasResponse) {
      // 응답 칸은 내용 높이를 쓰므로 판 안 스크롤 대신 페이지 스크롤로 확인한다.
      await expectContentPanelsReachable(page);
      await expect(responseSlot(page)).toBeVisible();
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

test('오프라인에서도 g1s2u6.A1 활동이 열린다', async ({ page, context }) => {
  await page.goto(PREVIEW_URL);
  await page.getByRole('button', { name: '1번', exact: true }).click();
  await page.getByRole('button', { name: '건너뛰기' }).click();
  await expect(page).toHaveURL(/#\/map$/);
  await page.goto(`${PREVIEW_URL}/#/activity/g1s2u6.A1`);
  await expect(page.getByRole('heading', { name: '이중 텐프레임 10 채우기' })).toBeVisible();

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
  await expect(page.getByRole('heading', { name: '이중 텐프레임 10 채우기' })).toBeVisible();
  await expect(page.getByRole('button', { name: '확인하기' })).toBeVisible();
});
