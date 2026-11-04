import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { PREVIEW_URL } from '../../../playwright.config';

/**
 * T057 g2s1u1 「세 자리 수」 단원 E2E.
 * 활동마다 과제를 대표 오답 → 힌트 ① → 정답 순서로 끝까지 해 본다.
 * 아이패드(WebKit)·크롬북·전자칠판 세 뷰포트에서 같은 흐름을 확인한다.
 */

// 과제 하나에 조작·오답·힌트·수정이 이어져 기본 30초로는 모자란다.
test.describe.configure({ timeout: 120_000 });

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

async function undo(page: Page, times: number): Promise<void> {
  const button = page.getByRole('button', { name: '되돌리기' });
  for (let index = 0; index < times; index += 1) await button.click();
}

async function expectFailedWithHint(page: Page, text: string): Promise<void> {
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByTestId('hint')).toHaveAttribute('data-hint-level', '1');
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

/** 숫자 카드를 골라 자릿값 칸에 놓는다. 놓인 카드는 다시 고를 수 없어 되돌리기로 푼다. */
async function placeCard(panel: Locator, digit: number, place: string): Promise<void> {
  const card = panel.getByRole('button', { name: `${digit} 카드` });
  await card.press('Enter');
  await expect(card).toHaveAttribute('aria-pressed', 'true');
  await panel.getByRole('button', { name: `${place} 자리` }).click();
  await expect(card).toBeDisabled();
}

test('A1 100 모형 융합 프레스기 — 대표 오답 뒤 고쳐서 네 과제를 통과한다', async ({ page }) => {
  await openActivity(page, 'g2s1u1.A1', '100 모형 융합 프레스기');
  await screenshot(page, 'g2s1u1-a1.png');
  const panel = slot(page, 'main');

  // T1 — 막대를 묶지 않고 10이라고 써서 틀린 뒤, 묶고 100으로 고친다.
  await typeNumber(page, 'ans', ['1', '0']);
  await submit(page);
  await expectFailedWithHint(page, '막대가 아직 열 개 그대로 있어요');
  const groupTens = panel.getByRole('button', { name: '10개 묶기' });
  await groupTens.click();
  await expect(groupTens).toBeDisabled();
  await clearNumber(page, 'ans');
  await typeNumber(page, 'ans', ['1', '0', '0']);
  await submit(page);
  await expectPassed(page);

  // T2 — 막대 13개를 그대로 읽어 1134라고 써서 MC-PV-NONCANON을 만든 뒤 고친다.
  await typeNumber(page, 'ans', ['1', '1', '3', '4']);
  await submit(page);
  await expectFailedWithHint(page, '막대 10개로 무엇을 만들 수 있지?');
  await clearNumber(page, 'ans');
  await panel.getByRole('button', { name: '10개 묶기' }).click();
  await typeNumber(page, 'ans', ['2', '3', '4']);
  await submit(page);
  await expectPassed(page);

  // T3 — 십 자리를 빼고 26이라고 써서 MC-PV-ZERO를 만든 뒤 206으로 고친다.
  await typeNumber(page, 'ans', ['2', '6']);
  await submit(page);
  await expectFailedWithHint(page, '십 모형이 하나도 없으면 그 칸에 뭐라고 쓸까?');
  await clearNumber(page, 'ans');
  await typeNumber(page, 'ans', ['2', '0', '6']);
  await submit(page);
  await expectPassed(page);

  // T4 — 판을 풀지 않고 제출해 틀린 뒤, 백 판 하나를 키보드로 풀어 수가 그대로인지 확인한다.
  await submit(page);
  await expectFailedWithHint(page, '판 하나를 풀면 막대가 몇 개 생길까요?');
  const hundred = panel.locator('[data-block-value="100"]').first();
  await hundred.focus();
  await page.keyboard.press('Enter');
  await expect(panel.locator('[data-block-value="100"]')).toHaveCount(0);
  await submit(page);
  await expectPassed(page, true);
});

test('A2 자릿값 카드 대결 — 대표 오답 뒤 고쳐서 다섯 과제를 통과한다', async ({ page }) => {
  await openActivity(page, 'g2s1u1.A2', '자릿값 카드 대결');
  await screenshot(page, 'g2s1u1-a2.png');
  const panel = slot(page, 'main');

  // T1 — 가장 큰 수가 아닌 371을 만들어 틀린 뒤, 되돌려 731로 고친다.
  await placeCard(panel, 3, '백');
  await placeCard(panel, 7, '십');
  await placeCard(panel, 1, '일');
  await submit(page);
  await expectFailedWithHint(page, '백 자리에 가장 큰 카드를 놓으면');
  await undo(page, 3);
  await expect(panel.getByRole('button', { name: '7 카드' })).toBeEnabled();
  await placeCard(panel, 7, '백');
  await placeCard(panel, 3, '십');
  await placeCard(panel, 1, '일');
  await submit(page);
  await expectPassed(page);

  // T2 — 가장 큰 수 731을 만들어 틀린 뒤, 되돌려 137로 고친다.
  await placeCard(panel, 3, '백');
  await placeCard(panel, 7, '십');
  await placeCard(panel, 1, '일');
  await submit(page);
  await expectFailedWithHint(page, '가장 작은 수를 만들려면 가장 큰 카드를');
  await undo(page, 3);
  await expect(panel.getByRole('button', { name: '1 카드' })).toBeEnabled();
  await placeCard(panel, 1, '백');
  await placeCard(panel, 3, '십');
  await placeCard(panel, 7, '일');
  await submit(page);
  await expectPassed(page);

  // T3 — 백의 자리에 0을 놓아 25를 만들어 틀린 뒤, 되돌려 205로 고친다.
  await placeCard(panel, 0, '백');
  await placeCard(panel, 2, '십');
  await placeCard(panel, 5, '일');
  await submit(page);
  await expectFailedWithHint(page, '맨 앞에 0이 있으면 몇 자리 수일까요?');
  await undo(page, 3);
  await expect(panel.getByRole('button', { name: '2 카드' })).toBeEnabled();
  await placeCard(panel, 2, '백');
  await placeCard(panel, 0, '십');
  await placeCard(panel, 5, '일');
  await submit(page);
  await expectPassed(page);

  // T4 — 4가 나타내는 값을 4라고 써서 MC-PV-DIGIT-FACE를 만든 뒤 40으로 고친다.
  await typeNumber(page, 'ans', ['4']);
  await submit(page);
  await expectFailedWithHint(page, '4는 어느 칸에 있어?');
  await clearNumber(page, 'ans');
  await typeNumber(page, 'ans', ['4', '0']);
  await submit(page);
  await expectPassed(page);

  // T5 — 출발점 438을 그대로 세 번 써서 틀린 뒤, 448·458·468로 고친다.
  await typeNumber(page, 'n1', ['4', '3', '8']);
  await typeNumber(page, 'n2', ['4', '4', '8']);
  await typeNumber(page, 'n3', ['4', '5', '8']);
  await submit(page);
  await expectFailedWithHint(page, '10씩 뛰어 세면 십 자리 숫자가');
  await clearNumber(page, 'n1');
  await clearNumber(page, 'n2');
  await clearNumber(page, 'n3');
  await typeNumber(page, 'n1', ['4', '4', '8']);
  await typeNumber(page, 'n2', ['4', '5', '8']);
  await typeNumber(page, 'n3', ['4', '6', '8']);
  await submit(page);
  await expectPassed(page, true);
});

test('크롬북·전자칠판 첫 화면에 응답 칸과 확인하기가 들어온다', async ({ page }, testInfo) => {
  test.skip(
    testInfo.project.name === 'ipad',
    '아이패드는 판을 위아래로 두어 짧은 스크롤을 허용한다',
  );

  const cases = [
    { id: 'g2s1u1.A1', title: '100 모형 융합 프레스기', response: true },
    { id: 'g2s1u1.A2', title: '자릿값 카드 대결', response: false },
  ] as const;

  for (const item of cases) {
    await openActivity(page, item.id, item.title);
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect(page.getByRole('button', { name: '확인하기' })).toBeInViewport({ ratio: 1 });
    if (item.response) {
      await expect(responseSlot(page)).toBeInViewport({ ratio: 1 });
    } else {
      await expect(slot(page, 'main')).toBeInViewport({ ratio: 1 });
    }
  }
});

test('오프라인에서도 g2s1u1.A1 활동이 열린다', async ({ page, context }) => {
  await page.goto(PREVIEW_URL);
  await page.getByRole('button', { name: '1번', exact: true }).click();
  await page.getByRole('button', { name: '건너뛰기' }).click();
  await expect(page).toHaveURL(/#\/map$/);
  await page.goto(`${PREVIEW_URL}/#/activity/g2s1u1.A1`);
  await expect(page.getByRole('heading', { name: '100 모형 융합 프레스기' })).toBeVisible();

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
  await expect(page.getByRole('heading', { name: '100 모형 융합 프레스기' })).toBeVisible();
  await expect(page.getByRole('button', { name: '확인하기' })).toBeVisible();
});
