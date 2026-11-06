import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { PREVIEW_URL } from '../../../playwright.config';
import { expectNoPanelInnerScroll } from '../panel-layout';

/**
 * T053 g1s2u1 「100까지의 수」 단원 E2E.
 * 활동마다 대표 오답 → 힌트 ① → 고쳐서 통과 순서로 끝까지 해 본다.
 * 오개념 규칙(MC-PV-NONCANON·MC-ODD-EVEN-SIZE)과 힌트 ② 오버레이도 확인한다.
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

async function undo(page: Page): Promise<void> {
  await page.getByRole('button', { name: '되돌리기', exact: true }).click();
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

async function pressButton(panel: Locator, name: string): Promise<void> {
  await panel.getByRole('button', { name, exact: true }).press('Enter');
}

test('A1 십 모형으로 99와 100 — 대표 오답 뒤 고쳐서 네 과제를 통과한다', async ({ page }) => {
  await openActivity(page, 'g1s2u1.A1', '십 모형으로 99와 100');
  await screenshot(page, 'g1s2u1-a1.png');
  const panel = slot(page, 'main');

  // T1 — 낱개 10개를 그대로 두고 제출해 MC-PV-NONCANON을 만든 뒤, 힌트 ②까지 보고 68을 만든다.
  for (let index = 0; index < 10; index += 1) await pressButton(panel, '하나 블록 놓기');
  await submit(page);
  await expectFailedWithHint(page, '낱개 중에 또 묶을 수 있는 게 있을까?');
  // 같은 오답을 한 번 더 내면 ② 점선 올가미와 안내가 나온다.
  await submit(page);
  await expectFailedWithHint(page, '점선 칸에 낱개 10개가 들어가요. 몇 칸이 찼나요?', 2);
  await expectOverlayOverCanvas(panel, 'ten-outline', 'base-ten-canvas');

  // 낱개 10개를 묶어 막대 하나로 만들고, 68이 되게 채운다.
  await panel.getByRole('button', { name: '10개 묶기', exact: true }).click();
  for (let index = 0; index < 5; index += 1) await pressButton(panel, '십 블록 놓기');
  for (let index = 0; index < 8; index += 1) await pressButton(panel, '하나 블록 놓기');
  await submit(page);
  await expectPassed(page);

  // T2 — 75를 막대 7개로 보고, 응답을 비운 채 제출해 힌트 ①을 본 뒤 7을 쓴다.
  await submit(page);
  await expectFailedWithHint(page, '막대가 몇 개 있나요?');
  await typeNumber(page, 'n', ['7']);
  await submit(page);
  await expectPassed(page);

  // T3 — 낱개를 하나 더 놓고 910이라고 써서 MC-PV-NONCANON을 만든 뒤 묶어서 100을 만든다.
  await pressButton(panel, '하나 블록 놓기');
  await typeNumber(page, 'n', ['9', '1', '0']);
  await submit(page);
  await expectFailedWithHint(page, '낱개 중에 또 묶을 수 있는 게 있을까?');
  await panel.getByRole('button', { name: '10개 묶기', exact: true }).click();
  await clearNumber(page, 'n');
  await typeNumber(page, 'n', ['1', '0', '0']);
  await submit(page);
  await expectPassed(page);

  // T4 — 더 작은 57을 골라 힌트 ①을 본 뒤 75로 고친다.
  await toggleChoice(page, 'big', '57');
  await submit(page);
  await expectFailedWithHint(page, '막대가 더 많은 수는 어느 쪽일까?');
  await toggleChoice(page, 'big', '75');
  await submit(page);
  await expectPassed(page, true);
});

test('A3 둘씩 짝짓기 — 대표 오답 뒤 고쳐서 다섯 과제를 통과한다', async ({ page }) => {
  await openActivity(page, 'g1s2u1.A3', '둘씩 짝짓기 행진');
  await screenshot(page, 'g1s2u1-a3.png');
  const panel = slot(page, 'main');

  // T1 — 8명을 짝지은 뒤 홀수라고 골라 MC-ODD-EVEN-SIZE를 만들고, 힌트 ②까지 본다.
  await panel.getByRole('button', { name: '짝 만들기', exact: true }).click();
  // 짝 선은 가로선이라 높이가 0이어서 toBeVisible 대신 개수로 확인한다.
  await expect(panel.locator('[data-pair-line="0"]')).toHaveCount(1);
  await toggleChoice(page, 'kind', '홀수');
  await submit(page);
  await expectFailedWithHint(page, '둘씩 짝지어 보면 남을까?');
  await submit(page);
  await expectFailedWithHint(page, '짝 짓기를 다시 보여 줄게요. 남는 친구가 있나요?', 2);
  await expectOverlayOverCanvas(panel, 'pair-march', 'counters-canvas');
  await toggleChoice(page, 'kind', '짝수');
  await submit(page);
  await expectPassed(page);

  // T2 — 13명을 짝수로 잘못 예상한 뒤, 되돌리기로 예상 단계로 돌아가 홀수로 고친다.
  await panel.getByRole('button', { name: '짝수', exact: true }).click();
  await panel.getByRole('button', { name: '짝 만들기', exact: true }).click();
  await submit(page);
  await expectFailedWithHint(page, '둘씩 짝지어 보면 남을까?');
  // 예상은 짝을 만들면 되돌릴 수 없어 실행기 되돌리기로 예상 단계까지 돌아간다.
  await undo(page);
  await undo(page);
  await expect(panel.getByRole('button', { name: '홀수', exact: true })).toBeVisible();
  await panel.getByRole('button', { name: '홀수', exact: true }).click();
  await panel.getByRole('button', { name: '짝 만들기', exact: true }).click();
  await submit(page);
  await expectPassed(page);

  // T3 — 점 16개를 홀수로 잘못 예상한 뒤 되돌려 짝수로 고친다.
  await panel.getByRole('button', { name: '홀수', exact: true }).click();
  await panel.getByRole('button', { name: '짝 만들기', exact: true }).click();
  await submit(page);
  await expectFailedWithHint(page, '둘씩 짝지어 보면 남을까?');
  await undo(page);
  await undo(page);
  await panel.getByRole('button', { name: '짝수', exact: true }).click();
  await panel.getByRole('button', { name: '짝 만들기', exact: true }).click();
  await submit(page);
  await expectPassed(page);

  // T4 — 11과 12를 골라 틀린 뒤, 12·14·16·18·20으로 고친다.
  await toggleChoice(page, 'evens', '11');
  await toggleChoice(page, 'evens', '12');
  await submit(page);
  await expectFailedWithHint(page, '각 수를 둘씩 짝지으면 남는 것이 있을까?');
  await toggleChoice(page, 'evens', '11');
  for (const label of ['14', '16', '18', '20']) {
    await toggleChoice(page, 'evens', label);
  }
  await submit(page);
  await expectPassed(page);

  // T5 — 끝자리 7을 짝수로 골라 힌트 ①을 본 뒤 홀수로 고친다.
  await toggleChoice(page, 'kind', '짝수');
  await submit(page);
  await expectFailedWithHint(page, '둘씩 짝지어 보면 남을까?');
  await toggleChoice(page, 'kind', '홀수');
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
      id: 'g1s2u1.A1',
      title: '십 모형으로 99와 100',
      // 첫 과제는 블록만 놓는 과제라 응답 칸이 없다(둘째 과제부터 응답).
      hasResponse: false,
      engine: (panel: Locator) =>
        panel.getByRole('button', { name: '하나 블록 놓기', exact: true }),
    },
    {
      id: 'g1s2u1.A3',
      title: '둘씩 짝짓기 행진',
      // 첫 과제부터 짝수·홀수 고르기 응답이 있다.
      hasResponse: true,
      engine: (panel: Locator) => panel.getByRole('button', { name: '짝 만들기', exact: true }),
    },
  ] as const;

  for (const item of cases) {
    await openActivity(page, item.id, item.title);
    await page.evaluate(() => window.scrollTo(0, 0));
    await expectNoPanelInnerScroll(page);

    // 64px 타깃이 켜진 상태에서 엔진 조작·확인하기가 모두 보여야 한다.
    await expect(slot(page, 'main')).toBeInViewport({ ratio: 1 });
    await expect(page.getByRole('button', { name: '확인하기' })).toBeInViewport({ ratio: 1 });
    await expect(item.engine(slot(page, 'main'))).toBeInViewport({ ratio: 1 });
    if (item.hasResponse) {
      await expect(responseSlot(page)).toBeInViewport({ ratio: 1 });
      await expect(
        responseSlot(page).getByRole('button', { name: '짝수', exact: true }),
      ).toBeInViewport({ ratio: 1 });
    }
  }
});

test('오프라인에서도 g1s2u1.A1 활동이 열린다', async ({ page, context }) => {
  await page.goto(PREVIEW_URL);
  await page.getByRole('button', { name: '1번', exact: true }).click();
  await page.getByRole('button', { name: '건너뛰기' }).click();
  await expect(page).toHaveURL(/#\/map$/);
  await page.goto(`${PREVIEW_URL}/#/activity/g1s2u1.A1`);
  await expect(page.getByRole('heading', { name: '십 모형으로 99와 100' })).toBeVisible();

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
  await expect(page.getByRole('heading', { name: '십 모형으로 99와 100' })).toBeVisible();
  await expect(page.getByRole('button', { name: '확인하기' })).toBeVisible();
});
