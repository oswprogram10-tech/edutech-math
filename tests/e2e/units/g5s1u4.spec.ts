import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { PREVIEW_URL } from '../../../playwright.config';

/**
 * T024 g5s1u4 「약분과 통분」 단원 E2E.
 * 활동마다 과제를 대표 오답 → 힌트 ① → 정답 순서로 끝까지 해 본다.
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
      return {
        x: fresh.x + (x / 1000) * fresh.width,
        y: fresh.y + (y / 600) * fresh.height,
      };
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

async function refine(page: Page, factor: number): Promise<void> {
  await slot(page, 'left')
    .getByRole('button', { name: `×${factor} 더 잘게` })
    .click();
}

async function coarsen(page: Page, factor: number): Promise<void> {
  const target = (await slot(page, 'left').count()) > 0 ? slot(page, 'left') : slot(page, 'main');
  await target.getByRole('button', { name: `÷${factor} 더 굵게` }).click();
}

async function overlay(page: Page): Promise<void> {
  await slot(page, 'main').getByRole('button', { name: '겹치기', exact: true }).click();
}

async function smallerGrid(page: Page): Promise<void> {
  await slot(page, 'main').getByRole('button', { name: '격자 줄이기' }).click();
}

async function placeCard(
  page: Page,
  canvas: Canvas,
  card: string,
  x: number,
  y: number,
): Promise<void> {
  const cardButton = canvas.panel.getByRole('button', { name: `카드 ${card}` });
  // 카드 그림 위에 글자가 겹쳐 있어 포인터 클릭이 카드로 가지 않는다.
  // 카드는 키보드로도 고를 수 있으므로 Enter로 고른 뒤 수직선을 누른다.
  await cardButton.press('Enter');
  await expect(cardButton).toHaveAttribute('aria-pressed', 'true');
  const point = await canvas.at(x, y);
  await page.mouse.click(point.x, point.y);
  await expect(canvas.panel.locator(`[data-card="${card}"]`)).toHaveAttribute('data-placed', /./);
}

async function submit(page: Page): Promise<void> {
  await page.getByRole('button', { name: '확인하기' }).click();
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

test('A1 같은 양, 다른 이름 — 대표 오답 뒤 고쳐서 다섯 과제를 통과한다', async ({ page }) => {
  await openActivity(page, 'g5s1u4.A1', '같은 양, 다른 이름');
  await screenshot(page, 'g5s1u4-a1.png');

  // T1 — ×2로 잘게 자른 뒤 두 이름을 같은 6/8로 써서 틀린 뒤 6/8과 9/12로 고친다.
  await refine(page, 2);
  // 막대와 수직선 어디에도 아직 만들지 않은 이름이 미리 보이지 않는다.
  await expect(slot(page, 'left').getByTestId('fraction-canvas')).not.toContainText('6/8');
  await expect(slot(page, 'right').getByTestId('number-line-canvas')).not.toContainText('6/8');
  await expect(slot(page, 'right').getByTestId('number-line-canvas')).not.toContainText('9/12');
  await typeNumber(page, 'x2', ['6', '/', '8']);
  await typeNumber(page, 'x3', ['6', '/', '8']);
  await submit(page);
  await expectFailedWithHint(page, '막대를 ×2로 자르면');
  await clearNumber(page, 'x3');
  await typeNumber(page, 'x3', ['9', '/', '1', '2']);
  await submit(page);
  await expectPassed(page);

  // T2 — 세 카드를 제자리에 꽂은 뒤 4/5만 골라 틀린 뒤 4/6과 6/9로 고친다.
  const line = await canvasOf(page, 'main', 'number-line-canvas');
  await placeCard(page, line, '4/6', 633.3, 240);
  await placeCard(page, line, '6/9', 633.3, 240);
  await placeCard(page, line, '4/5', 740, 360);
  // 카드 값만 보이고 정답 점 이름(2/3)은 수직선에 찍혀 있지 않다.
  await expect(line.panel.getByTestId('number-line-canvas')).not.toContainText('2/3');
  await toggleChoice(page, 'sel', '4/5');
  await submit(page);
  await expectFailedWithHint(page, '4/5를 수직선에 꽂으면 2/3과 같은 자리에 오나요');
  await toggleChoice(page, 'sel', '4/5');
  await toggleChoice(page, 'sel', '4/6');
  await toggleChoice(page, 'sel', '6/9');
  await submit(page);
  await expectPassed(page);

  // T3 — 아무것도 묶지 않고 제출해 틀린 뒤 ÷2로 두 번 묶어 2/3을 만든다.
  await submit(page);
  await expectFailedWithHint(page, '8/12에서 색칠한 칸과 전체 칸을');
  await coarsen(page, 2);
  await coarsen(page, 2);
  await submit(page);
  await expectPassed(page);

  // T4 — 두 규칙 모두 '같은 수를 더한다'로 골라 틀린 뒤 곱하기·나누기로 고친다.
  await toggleChoice(page, 'mul', '분모와 분자에 같은 수를 더했어요');
  await toggleChoice(page, 'div', '분모와 분자에서 같은 수를 뺐어요');
  await submit(page);
  await expectFailedWithHint(page, '3/4에 분모와 분자만큼 같은 수를 더하면');
  await toggleChoice(page, 'mul', '분모와 분자에 같은 수를 곱했어요');
  await toggleChoice(page, 'div', '분모와 분자에서 같은 수를 나누었어요');
  await submit(page);
  await expectPassed(page);

  // T5 — 분모·분자에 같은 수를 더한 19/20으로 틀린 뒤 15/20으로 고친다.
  await typeNumber(page, 'ans', ['1', '9', '/', '2', '0']);
  await submit(page);
  await expectFailedWithHint(page, '3/4의 분모 4를 20으로 만들려면');
  await clearNumber(page, 'ans');
  await typeNumber(page, 'ans', ['1', '5', '/', '2', '0']);
  await submit(page);
  await expectPassed(page, true);
});

test('A2 투명 분수 타일 겹치기 — 대표 오답 뒤 고쳐서 다섯 과제를 통과한다', async ({ page }) => {
  await openActivity(page, 'g5s1u4.A2', '투명 분수 타일 겹치기');
  await screenshot(page, 'g5s1u4-a2.png');

  // T1 — 겹친 뒤 3/4과 5/8을 분모만 보고 '작다'로 골라 틀린 뒤 '크다'로 고친다.
  await overlay(page);
  await chooseCompare(page, 'c1', '작다');
  await chooseCompare(page, 'c2', '작다');
  await submit(page);
  await expectFailedWithHint(page, '분모 8은 전체를 8조각으로');
  await chooseCompare(page, 'c2', '크다');
  await submit(page);
  await expectPassed(page);

  // T2 — 겹친 뒤 파랑을 6/8로 잘못 써서 틀린 뒤 8/12로 고친다.
  await overlay(page);
  // 겹친 타일 그림에는 아직 두 이름(8/12, 9/12)이 적혀 있지 않다.
  await expect(slot(page, 'main').getByTestId('fraction-canvas')).not.toContainText('8/12');
  await expect(slot(page, 'main').getByTestId('fraction-canvas')).not.toContainText('9/12');
  await typeNumber(page, 'f1', ['6', '/', '8']);
  await typeNumber(page, 'f2', ['9', '/', '1', '2']);
  await submit(page);
  await expectFailedWithHint(page, '겹치기 전 2/3 타일과 3/4 타일은');
  await clearNumber(page, 'f1');
  await typeNumber(page, 'f1', ['8', '/', '1', '2']);
  await submit(page);
  await expectPassed(page);

  // T3 — 24칸에 머문 채 24를 써서 틀린 뒤 격자를 줄여 12로 고친다.
  await overlay(page);
  await typeNumber(page, 'den', ['2', '4']);
  await submit(page);
  await expectFailedWithHint(page, '5/6과 3/4의 분모 6과 4는');
  await smallerGrid(page);
  await clearNumber(page, 'den');
  await typeNumber(page, 'den', ['1', '2']);
  await submit(page);
  await expectPassed(page);

  // T4 — 가장 작은 공통분모를 두 분모의 곱인 48로 써서 틀린 뒤 24로 고친다.
  await typeNumber(page, 'd1', ['4', '8']);
  await typeNumber(page, 'd2', ['4', '8']);
  await submit(page);
  await expectFailedWithHint(page, '6과 8의 공배수를');
  await clearNumber(page, 'd2');
  await typeNumber(page, 'd2', ['2', '4']);
  await submit(page);
  await expectPassed(page);

  // T5 — 3/5을 10분의 몇으로 바꾸지 않고 '크다'로 골라 틀린 뒤 '작다'와 6/10으로 고친다.
  await chooseCompare(page, 'cmp', '크다');
  await typeNumber(page, 'tenths', ['3', '/', '5']);
  await submit(page);
  await expectFailedWithHint(page, '두 수를 같은 분모로 나타내려면');
  await chooseCompare(page, 'cmp', '작다');
  await clearNumber(page, 'tenths');
  await typeNumber(page, 'tenths', ['6', '/', '1', '0']);
  await submit(page);
  await expectPassed(page, true);
});

test('A3 약분 탐정 — 대표 오답 뒤 고쳐서 네 과제를 통과한다', async ({ page }) => {
  await openActivity(page, 'g5s1u4.A3', '약분 탐정');
  await screenshot(page, 'g5s1u4-a3.png');

  // T1 — 4칸씩만 골라 틀린 뒤 2·3·6칸씩으로 고친다.
  await toggleChoice(page, 'g', '4칸씩');
  await submit(page);
  await expectFailedWithHint(page, '24칸을 4칸씩 묶으면');
  await toggleChoice(page, 'g', '4칸씩');
  await toggleChoice(page, 'g', '2칸씩');
  await toggleChoice(page, 'g', '3칸씩');
  await toggleChoice(page, 'g', '6칸씩');
  await submit(page);
  await expectPassed(page);

  // T2 — 한 번만 약분한 9/12로 틀린 뒤 ÷3·÷2로 묶고 3/4로 고친다.
  await typeNumber(page, 'ans', ['9', '/', '1', '2']);
  await submit(page);
  await expectFailedWithHint(page, '한 번 묶은 뒤에도');
  await clearNumber(page, 'ans');
  await coarsen(page, 3);
  await coarsen(page, 2);
  await typeNumber(page, 'ans', ['3', '/', '4']);
  await submit(page);
  await expectPassed(page);

  // T3 — 8칸씩 골라 틀린 뒤 6칸씩을 고르고 두 번 묶어 3/4로 만든다.
  await toggleChoice(page, 'g', '8칸씩');
  await submit(page);
  await expectFailedWithHint(page, '8칸씩 묶으면 18칸이');
  await toggleChoice(page, 'g', '6칸씩');
  await coarsen(page, 3);
  await coarsen(page, 2);
  await submit(page);
  await expectPassed(page);

  // T4 — 36/48을 한 번만 약분한 18/24로 틀린 뒤 두 기약분수로 고친다.
  await typeNumber(page, 'f1', ['1', '8', '/', '2', '4']);
  await typeNumber(page, 'f2', ['5', '/', '7']);
  await submit(page);
  await expectFailedWithHint(page, '36/48을 한 번 약분한 뒤에도');
  await clearNumber(page, 'f1');
  await clearNumber(page, 'f2');
  await typeNumber(page, 'f1', ['3', '/', '4']);
  await typeNumber(page, 'f2', ['3', '/', '7']);
  await submit(page);
  await expectPassed(page, true);
});

test('크롬북·전자칠판 첫 화면에 응답 칸과 확인하기가 들어온다', async ({ page }, testInfo) => {
  test.skip(
    testInfo.project.name === 'ipad',
    '아이패드는 판을 위아래로 두어 짧은 스크롤을 허용한다',
  );

  const cases = [
    { id: 'g5s1u4.A1', title: '같은 양, 다른 이름' },
    { id: 'g5s1u4.A2', title: '투명 분수 타일 겹치기' },
    { id: 'g5s1u4.A3', title: '약분 탐정' },
  ] as const;

  for (const item of cases) {
    await openActivity(page, item.id, item.title);
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect(page.getByRole('button', { name: '확인하기' })).toBeInViewport({ ratio: 1 });
    await expect(responseSlot(page)).toBeInViewport({ ratio: 1 });
  }
});

test('오프라인에서도 g5s1u4.A1 활동이 열린다', async ({ page, context }) => {
  await page.goto(PREVIEW_URL);
  await page.getByRole('button', { name: '1번', exact: true }).click();
  await page.getByRole('button', { name: '건너뛰기' }).click();
  await expect(page).toHaveURL(/#\/map$/);
  await page.goto(`${PREVIEW_URL}/#/activity/g5s1u4.A1`);
  await expect(page.getByRole('heading', { name: '같은 양, 다른 이름' })).toBeVisible();

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
  await expect(page.getByRole('heading', { name: '같은 양, 다른 이름' })).toBeVisible();
  await expect(page.getByRole('button', { name: '확인하기' })).toBeVisible();
});
