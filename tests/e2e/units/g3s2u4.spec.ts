import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { PREVIEW_URL } from '../../../playwright.config';
import { logicalToScreen } from '../canvas-point';

/**
 * T021 g3s2u4 「분수」 단원 E2E.
 * 활동마다 과제 5개를 대표 오답 → 힌트 ① → 정답 순서로 끝까지 해 본다.
 * 아이패드(WebKit)·크롬북·전자칠판 세 뷰포트에서 같은 흐름을 확인한다.
 * 좌표는 화면 픽셀이 아니라 엔진의 논리 좌표(1000×600)로 적는다.
 */

interface Canvas {
  readonly panel: Locator;
  /** 화면 픽셀 좌표. 버튼 클릭으로 스크롤이 바뀔 수 있어 누를 때마다 다시 잰다. */
  readonly at: (x: number, y: number) => Promise<{ x: number; y: number }>;
}

// 과제 하나에 조작·오답·힌트·수정이 이어져 기본 30초로는 모자라다.
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

async function canvasOf(page: Page, name: string, testId: string): Promise<Canvas> {
  const panel = slot(page, name);
  const canvas = panel.getByTestId(testId);
  await expect(canvas).toBeVisible();
  const box = await canvas.boundingBox();
  if (!box) throw new Error(`그림 상자를 찾을 수 없습니다: ${name}`);
  return {
    panel,
    at: async (x, y) => {
      // 캔버스가 화면보다 커서 스크롤 위치에 따라 위쪽이 잘린다.
      // 조작 전에 캔버스 위쪽을 화면 위에 맞춰 논리 좌표가 화면 안에 오게 한다.
      await canvas.evaluate((element) =>
        element.scrollIntoView({ block: 'start', inline: 'nearest' }),
      );
      const fresh = await canvas.boundingBox();
      if (!fresh) throw new Error(`그림 상자를 다시 찾을 수 없습니다: ${name}`);
      return logicalToScreen(fresh, x, y);
    },
  };
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

/** 대분수는 자연수 → 분자 → 분모 순서로 넣는다. Space가 다음 칸으로 넘긴다. */
async function typeMixed(
  page: Page,
  id: string,
  whole: string,
  numerator: string,
  denominator: string,
): Promise<void> {
  const box = field(page, id);
  await box.locator('[data-part="whole"]').click();
  for (const key of whole) await page.keyboard.press(key);
  await page.keyboard.press('Space');
  for (const key of numerator) await page.keyboard.press(key);
  await page.keyboard.press('/');
  for (const key of denominator) await page.keyboard.press(key);
}

async function chooseCompare(
  page: Page,
  id: string,
  symbol: '작다' | '같다' | '크다',
): Promise<void> {
  await field(page, id).getByRole('button', { name: symbol }).click();
}

async function toggleChoice(page: Page, id: string, label: string): Promise<void> {
  await field(page, id).getByRole('button', { name: label, exact: true }).click();
}

async function sortCard(page: Page, label: string, bin: string): Promise<void> {
  await field(page, 'sort')
    .getByRole('button', { name: `${label} 옮길 카드로 고르기` })
    .click();
  await field(page, 'sort')
    .getByRole('button', { name: `${bin} 여기에 놓기` })
    .click();
}

async function setGroupSize(page: Page, size: number): Promise<void> {
  await slot(page, 'main')
    .getByRole('button', { name: `${size}개씩 묶기` })
    .click();
}

async function toggleGroup(page: Page, index: number, size: number): Promise<void> {
  // 묶음 사각형 위에는 사탕 아이콘이 겹쳐 있어 포인터 클릭이 아이콘에 막힌다.
  // 사각형은 키보드로도 고를 수 있으므로 Enter로 누른다(터치 대체 조작).
  await slot(page, 'main')
    .getByRole('button', { name: `${index + 1}번째 묶음, ${size}개` })
    .press('Enter');
}

async function placeCard(page: Page, canvas: Canvas, card: string, x: number): Promise<void> {
  const cardButton = canvas.panel.getByRole('button', { name: `카드 ${card}` });
  // 카드 그림 위에 글자가 겹쳐 있어 포인터 클릭이 카드로 가지 않는다.
  // 카드는 키보드로도 고를 수 있으므로 Enter로 고른 뒤 수직선을 누른다.
  await cardButton.press('Enter');
  await expect(cardButton).toHaveAttribute('aria-pressed', 'true');
  const point = await canvas.at(x, 300);
  await page.mouse.click(point.x, point.y);
  await expect(canvas.panel.locator(`[data-card="${card}"]`)).toHaveAttribute('data-placed', /./);
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

test('A1 사탕 묶음 스튜디오 — 대표 오답 뒤 고쳐서 다섯 과제를 통과한다', async ({ page }) => {
  await openActivity(page, 'g3s2u4.A1', '사탕 묶음 스튜디오');
  await screenshot(page, 'g3s2u4-a1.png');

  // T1 — 묶음 크기를 바꾸지 않고 1/2로 써서 틀린 뒤 3개씩 묶고 1/4로 고친다.
  await typeNumber(page, 'ans', ['1', '/', '2']);
  await submit(page);
  await expectFailedWithHint(page, '한 묶음에 사탕이 몇 개 있나요');
  await setGroupSize(page, 3);
  await clearNumber(page, 'ans');
  await typeNumber(page, 'ans', ['1', '/', '4']);
  await submit(page);
  await expectPassed(page);

  // T2 — 3개씩 묶고 세 묶음을 고른 뒤 사탕 수를 3, 4로 연달아 잘못 써서 틀린다.
  await setGroupSize(page, 3);
  for (let index = 0; index < 3; index += 1) await toggleGroup(page, index, 3);
  await typeNumber(page, 'ans', ['3']);
  await submit(page);
  await expectFailedWithHint(page, '3은 고른 묶음 수인가요');
  await clearNumber(page, 'ans');
  await typeNumber(page, 'ans', ['4']);
  await submit(page);
  await expectFailedWithHint(page, '4는 분모예요', 2);
  await clearNumber(page, 'ans');
  await typeNumber(page, 'ans', ['9']);
  await submit(page);
  await expectPassed(page);

  // T3 — 낱개 수 4/12로 두 번 써서 틀린 뒤 묶음 기준 1/3과 2/6으로 고친다.
  await typeNumber(page, 'f1', ['4', '/', '1', '2']);
  await typeNumber(page, 'f2', ['4', '/', '1', '2']);
  await submit(page);
  await expectFailedWithHint(page, "이번에는 '전체'가 몇 묶음인가요");
  await clearNumber(page, 'f1');
  await clearNumber(page, 'f2');
  await typeNumber(page, 'f1', ['1', '/', '3']);
  await typeNumber(page, 'f2', ['2', '/', '6']);
  await submit(page);
  await expectPassed(page);

  // T4 — 18개를 3개씩 묶고 네 묶음을 골라 12개를 만든 뒤 사탕 수를 3으로 잘못 쓴다.
  await setGroupSize(page, 3);
  for (let index = 0; index < 4; index += 1) await toggleGroup(page, index, 3);
  await typeNumber(page, 'ans', ['3']);
  await submit(page);
  await expectFailedWithHint(page, '분모 3은 사탕 18개를 몇 개씩 묶으라는 뜻인가요');
  await clearNumber(page, 'ans');
  await typeNumber(page, 'ans', ['1', '2']);
  await submit(page);
  await expectPassed(page);

  // T5 — 그림 없이 20의 3/5을 5로 잘못 쓴 뒤 12로 고친다.
  await typeNumber(page, 'ans', ['5']);
  await submit(page);
  await expectFailedWithHint(page, '분모 5는 20개를 몇 개씩 묶으라는 뜻인가요');
  await clearNumber(page, 'ans');
  await typeNumber(page, 'ans', ['1', '2']);
  await submit(page);
  await expectPassed(page, true);
});

test('A2 가분수·대분수 컨베이어 — 대표 오답 뒤 고쳐서 다섯 과제를 통과한다', async ({ page }) => {
  await openActivity(page, 'g3s2u4.A2', '가분수·대분수 컨베이어');
  await screenshot(page, 'g3s2u4-a2.png');

  // T1 — 가분수 7/5를 '분수가 아니에요'에 넣어 틀린 뒤 가분수 상자로 옮긴다.
  await sortCard(page, '7/5', '분수가 아니에요');
  await submit(page);
  await expectFailedWithHint(page, '가분수 카드를 1/4 조각이 몇 개 모인 것으로');
  await sortCard(page, '7/5', '가분수');
  await sortCard(page, '3/5', '진분수');
  await sortCard(page, '1 2/5', '대분수');
  await sortCard(page, '5/5', '가분수');
  await submit(page);
  await expectPassed(page);

  // T2 — 1/4 조각 11개를 두 번 융합하고 1 7/4로 잘못 쓴 뒤 2 3/4로 고친다.
  await slot(page, 'main').getByRole('button', { name: '1로 융합' }).click();
  await slot(page, 'main').getByRole('button', { name: '1로 융합' }).click();
  await typeMixed(page, 'ans', '1', '7', '4');
  await submit(page);
  await expectFailedWithHint(page, '남은 조각이 원판 하나보다 많지 않나요');
  await clearNumber(page, 'ans');
  await typeMixed(page, 'ans', '2', '3', '4');
  await submit(page);
  await expectPassed(page);

  // T3 — 자연수 2개를 풀어 2 1/3을 가분수로 만들고 3/3으로 잘못 쓴다.
  await slot(page, 'main').getByRole('button', { name: '자연수 1 풀기' }).click();
  await slot(page, 'main').getByRole('button', { name: '자연수 1 풀기' }).click();
  await typeNumber(page, 'ans', ['3', '/', '3']);
  await submit(page);
  await expectFailedWithHint(page, '자연수 2는 1/3 조각 몇 개로 바꿀 수 있나요');
  await clearNumber(page, 'ans');
  await typeNumber(page, 'ans', ['7', '/', '3']);
  await submit(page);
  await expectPassed(page);

  // T4 — 그림 없이 두 방향 변환을 하고 자연수 처리를 놓친 답으로 틀린다.
  await typeMixed(page, 'm1', '1', '8', '5');
  await typeNumber(page, 'm2', ['5', '/', '7']);
  await submit(page);
  await expectFailedWithHint(page, '13/5에는 5/5가 몇 번 들어가나요');
  await clearNumber(page, 'm1');
  await clearNumber(page, 'm2');
  await typeMixed(page, 'm1', '2', '3', '5');
  await typeNumber(page, 'm2', ['2', '3', '/', '7']);
  await submit(page);
  await expectPassed(page, true);
});

test('A3 수직선 매칭 — 대표 오답 뒤 고쳐서 다섯 과제를 통과한다', async ({ page }) => {
  await openActivity(page, 'g3s2u4.A3', '수직선 매칭');
  await screenshot(page, 'g3s2u4-a3.png');

  // T1 — 3/4 카드를 5/4 자리에 꽂아 틀린 뒤 여섯 장을 제자리에 꽂는다.
  const t1 = await canvasOf(page, 'main', 'number-line-canvas');
  await placeCard(page, t1, '3/4', 433.3);
  await submit(page);
  await expectFailedWithHint(page, '카드마다 분모가 몇 조각으로 나눈 것인지');
  await placeCard(page, t1, '3/4', 300);
  await placeCard(page, t1, '5/4', 433.3);
  await placeCard(page, t1, '1 1/4', 433.3);
  await placeCard(page, t1, '9/4', 700);
  await placeCard(page, t1, '2 3/4', 833.3);
  await placeCard(page, t1, '11/4', 833.3);
  await submit(page);
  await expectPassed(page);

  // T2 — 같은 점의 카드를 잘못 골라 틀린 뒤 1 1/4과 2 3/4로 고친다.
  await toggleChoice(page, 'pair1', '9/4');
  await toggleChoice(page, 'pair2', '9/4');
  await submit(page);
  await expectFailedWithHint(page, '분모가 같은 카드끼리 분자만 견주어 보세요');
  await toggleChoice(page, 'pair1', '1 1/4');
  await toggleChoice(page, 'pair2', '2 3/4');
  await submit(page);
  await expectPassed(page);

  // T3 — 두 카드를 수직선의 같은 자리에 꽂은 뒤 크다로 잘못 고르고 작다로 고친다.
  const t3 = await canvasOf(page, 'main', 'number-line-canvas');
  await placeCard(page, t3, '7/3', 722.2);
  await placeCard(page, t3, '2 2/3', 722.2);
  await chooseCompare(page, 'cmp', '크다');
  await submit(page);
  await expectFailedWithHint(page, '두 카드가 수직선에서 어디에 꽂혔는지 볼까요');
  await chooseCompare(page, 'cmp', '작다');
  await submit(page);
  await expectPassed(page);

  // T4 — 그림 없이 9/5와 12/5를 크다로 잘못 고른 뒤 작다로 고친다.
  await chooseCompare(page, 'cmp', '크다');
  await submit(page);
  await expectFailedWithHint(page, '두 분모가 같으면 한 칸의 크기가 같아요');
  await chooseCompare(page, 'cmp', '작다');
  await submit(page);
  await expectPassed(page);

  // T5 — 자연수 부분이 같을 때 분수 부분을 보지 않고 1 3/8을 골라 틀린다.
  await toggleChoice(page, 'pick', '1 3/8');
  await submit(page);
  await expectFailedWithHint(page, '1 3/8과 12/8은 모두 1을 지나요');
  await toggleChoice(page, 'pick', '12/8');
  await submit(page);
  await expectPassed(page, true);
});

test('크롬북·전자칠판 첫 화면에 응답 칸과 확인하기가 들어온다', async ({ page }, testInfo) => {
  test.skip(
    testInfo.project.name === 'ipad',
    '아이패드는 판을 위아래로 두어 짧은 스크롤을 허용한다',
  );

  const cases = [
    { id: 'g3s2u4.A1', title: '사탕 묶음 스튜디오', response: true },
    { id: 'g3s2u4.A2', title: '가분수·대분수 컨베이어', response: true },
    { id: 'g3s2u4.A3', title: '수직선 매칭', response: false },
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

test('오프라인에서도 g3s2u4.A1 활동이 열린다', async ({ page, context }) => {
  await page.goto(PREVIEW_URL);
  await page.getByRole('button', { name: '1번', exact: true }).click();
  await page.getByRole('button', { name: '건너뛰기' }).click();
  await expect(page).toHaveURL(/#\/map$/);
  await page.goto(`${PREVIEW_URL}/#/activity/g3s2u4.A1`);
  await expect(page.getByRole('heading', { name: '사탕 묶음 스튜디오' })).toBeVisible();

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
  await expect(page.getByRole('heading', { name: '사탕 묶음 스튜디오' })).toBeVisible();
  await expect(page.getByRole('button', { name: '확인하기' })).toBeVisible();
});
