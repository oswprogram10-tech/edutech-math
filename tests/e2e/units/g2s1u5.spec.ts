import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { PREVIEW_URL } from '../../../playwright.config';
import { expectControlsAboveFold } from '../controls-fold';

/**
 * T218 g2s1u5 「분류하기」 단원 E2E.
 * A1(E17 sort 4과제)·A2(E17 secret-rule predict 2과제)를 끝까지 통과하고, 대표 오답의 힌트 ①②를 확인한다.
 * 카드는 키보드 숫자(1~4)로 상자에 넣는다. 좌표는 요소 상자에서만 읽고 논리 높이를 가정하지 않는다.
 * 움직임 줄이기를 켜서 벨트·점 연출이 바로 끝나게 한다.
 */

test.describe.configure({ timeout: 300_000 });
test.use({ actionTimeout: 20_000 });

const A1 = { id: 'g2s1u5.A1', title: '다중 속성 컨베이어 분류 상자' } as const;
const A2 = { id: 'g2s1u5.A2', title: '비밀 분류 기준 추리기' } as const;

type BinKey = '1' | '2' | '3' | '4';

const COLOR_BINS: Readonly<Record<string, BinKey>> = {
  b01: '1',
  b02: '1',
  b03: '1',
  b04: '1',
  b05: '1',
  b06: '2',
  b07: '2',
  b08: '2',
  b09: '2',
  b10: '3',
  b11: '3',
  b12: '3',
};
const SHAPE_BINS: Readonly<Record<string, BinKey>> = {
  b01: '1',
  b02: '1',
  b06: '1',
  b10: '1',
  b03: '2',
  b05: '2',
  b07: '2',
  b09: '2',
  b12: '2',
  b04: '3',
  b08: '3',
  b11: '3',
};
const HOLES_BINS: Readonly<Record<string, BinKey>> = {
  b01: '1',
  b03: '1',
  b05: '1',
  b06: '1',
  b08: '1',
  b10: '1',
  b12: '1',
  b02: '2',
  b04: '2',
  b07: '2',
  b09: '2',
  b11: '2',
};
/** 컨베이어는 b01부터 차례로 온다. */
const BELT_ORDER = [
  'b01',
  'b02',
  'b03',
  'b04',
  'b05',
  'b06',
  'b07',
  'b08',
  'b09',
  'b10',
  'b11',
  'b12',
];

function slot(page: Page, name: string): Locator {
  return page.getByTestId(`runner-slot-${name}`);
}

function main(page: Page): Locator {
  return slot(page, 'main');
}

function field(page: Page, id: string): Locator {
  return slot(page, 'response').locator(`[data-response-field="${id}"]`);
}

async function openActivity(page: Page, activity: { id: string; title: string }): Promise<void> {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.getByRole('button', { name: '1번', exact: true }).click();
  await page.getByRole('button', { name: '건너뛰기' }).click();
  await expect(page).toHaveURL(/#\/map$/);
  await page.goto(`/#/activity/${activity.id}`);
  await expect(page.getByRole('heading', { name: activity.title })).toBeVisible();
  await expect(page.getByRole('button', { name: '확인하기' })).toBeVisible();
  await expect(main(page).getByTestId('sorter-canvas')).toBeVisible();
}

async function submit(page: Page): Promise<void> {
  await page.getByRole('button', { name: '확인하기' }).click();
}

async function expectHint(page: Page, level: 1 | 2 | 3, text: string): Promise<void> {
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

/** 카드에 초점을 두고 숫자 키로 상자에 넣는다(0은 카드 칸으로). */
async function keyPlace(page: Page, card: string, key: string): Promise<void> {
  const target = main(page).locator(`[data-card="${card}"]`);
  await target.focus();
  await expect(target).toBeFocused();
  await page.keyboard.press(key);
}

async function placeAll(
  page: Page,
  bins: Readonly<Record<string, BinKey>>,
  order: readonly string[] = BELT_ORDER,
): Promise<void> {
  for (const card of order) await keyPlace(page, card, bins[card] ?? '1');
}

async function chooseCriterion(page: Page, criterion: string): Promise<void> {
  await main(page).locator(`[data-criterion="${criterion}"]`).click();
  await expect(main(page).locator(`[data-criterion="${criterion}"]`)).toHaveAttribute(
    'aria-pressed',
    'true',
  );
}

async function changeCriterion(page: Page): Promise<void> {
  await main(page).getByRole('button', { name: '기준 바꾸기' }).click();
  await expect(main(page).locator('[data-bin]')).toHaveCount(0);
}

async function fillCounts(page: Page, red: number, blue: number, yellow: number): Promise<void> {
  await main(page).getByRole('spinbutton', { name: '빨강 개수 쓰기' }).fill(String(red));
  await main(page).getByRole('spinbutton', { name: '파랑 개수 쓰기' }).fill(String(blue));
  await main(page).getByRole('spinbutton', { name: '노랑 개수 쓰기' }).fill(String(yellow));
}

/** 판이 칸에 맞춰 크기를 정할 때까지(상자가 두 번 연속 같아질 때까지) 기다린다. */
async function settleCanvas(page: Page): Promise<void> {
  const canvas = main(page).getByTestId('sorter-canvas');
  await canvas.scrollIntoViewIfNeeded();
  let previous = '';
  await expect
    .poll(async () => {
      const now = JSON.stringify(await canvas.boundingBox());
      const same = now === previous;
      previous = now;
      return same;
    })
    .toBe(true);
}

async function screenshot(page: Page, name: string): Promise<void> {
  await settleCanvas(page);
  await page.evaluate(() => {
    window.scrollTo(0, 0);
    (document.activeElement as HTMLElement | SVGElement | null)?.blur();
  });
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
  await expect(page).toHaveScreenshot(name, {
    maxDiffPixelRatio: 0.02,
    animations: 'disabled',
    fullPage: true,
  });
}

/** 힌트 ② 오버레이가 본 판 svg와 같은 자리·크기(1px 안)에 놓였는지 본다. */
async function expectOverlayOverCanvas(page: Page, overlayName: string): Promise<Locator> {
  const overlay = main(page).locator(`[data-overlay="${overlayName}"]`);
  await expect(overlay).toBeVisible();
  await expect
    .poll(async () => {
      const overlayBox = await overlay.locator('svg').first().boundingBox();
      const canvasBox = await main(page).getByTestId('sorter-canvas').boundingBox();
      if (!overlayBox || !canvasBox) return Number.POSITIVE_INFINITY;
      return Math.max(
        Math.abs(overlayBox.x - canvasBox.x),
        Math.abs(overlayBox.y - canvasBox.y),
        Math.abs(overlayBox.width - canvasBox.width),
        Math.abs(overlayBox.height - canvasBox.height),
      );
    })
    .toBeLessThanOrEqual(1);
  return overlay;
}

async function expectNoGradeText(page: Page): Promise<void> {
  const text = (await page.locator('body').textContent()) ?? '';
  expect(text).not.toMatch(/[1-6]학년/);
}

/** 한 요소 아래 모든 속성을 한 문자열로 모은다. */
async function attributeDump(root: Locator): Promise<string> {
  return root.evaluate((element) => {
    const parts: string[] = [];
    for (const node of [element, ...element.querySelectorAll('*')]) {
      for (const name of node.getAttributeNames()) parts.push(`${name}=${node.getAttribute(name)}`);
    }
    return parts.join('\n');
  });
}

// ---------------------------------------------------------------- A1

test('g2s1u5.A1 — 4과제 흐름·대표 오답 힌트·오버레이 정렬', async ({ page }) => {
  test.slow();
  await openActivity(page, A1);

  // T1: 첫 화면·스냅샷·노출 검사
  await settleCanvas(page);
  await expectControlsAboveFold(page, 'g2s1u5.A1.T1', 0, 'sorter-controls');
  await screenshot(page, 'g2s1u5-a1t1.png');
  await expectNoGradeText(page);
  await chooseCriterion(page, 'color');
  await expect(main(page).locator('[data-bin]')).toHaveCount(3);
  await placeAll(page, COLOR_BINS);
  // 개수 칸은 비어 있고, 상자 머리말·조작 칸 어디에도 상자별 개수가 없다.
  await expect(main(page).getByRole('spinbutton', { name: '빨강 개수 쓰기' })).toHaveValue('');
  const binText = (await main(page).locator('[data-bin]').allTextContents()).join(' ');
  expect(binText).not.toMatch(/\d/);
  const controlsText = (await main(page).getByTestId('sorter-controls').textContent()) ?? '';
  expect(controlsText).not.toMatch(/\d+\s*장/);
  expect(await attributeDump(main(page).getByTestId('sorter-controls'))).not.toMatch(/value=[1-9]/);

  // T1 대표 오답: 빨강을 하나 더 세었다(실제와 1 차이) → MC-COUNT-ONE-TO-ONE ①②
  await fillCounts(page, 6, 4, 3);
  await submit(page);
  await expectHint(page, 1, '하나씩 짚어 세어 볼까?');
  await submit(page);
  await expectHint(page, 2, '하나씩 짚었어요');
  const dots = await expectOverlayOverCanvas(page, 'touch-dots');
  await expect(dots.locator('[data-dot]').first()).toBeVisible();
  // 번호 글자는 쓰지 않는다.
  await expect(dots.locator('text')).toHaveCount(0);
  await fillCounts(page, 5, 4, 3);
  await submit(page);
  await expectPassed(page);

  // T2: 색으로 나누면 일반 ① → 기준 바꾸기 → 구멍 수로 재분류
  await settleCanvas(page);
  await expectControlsAboveFold(page, 'g2s1u5.A1.T2', 0, 'sorter-controls');
  await chooseCriterion(page, 'color');
  await placeAll(page, COLOR_BINS);
  await submit(page);
  await expectHint(page, 1, '[기준 바꾸기]를 누르면');
  await changeCriterion(page);
  await chooseCriterion(page, 'holes');
  await placeAll(page, HOLES_BINS);
  await submit(page);
  await expectPassed(page);

  // T3: '예쁜 것' → MC-SORT-SUBJECTIVE ①② + two-friends 정렬 → 분명한 기준(모양)으로 바꿔 통과
  await settleCanvas(page);
  await expectControlsAboveFold(page, 'g2s1u5.A1.T3', 0, 'sorter-controls');
  await chooseCriterion(page, 'pretty');
  await keyPlace(page, 'b01', '1');
  await keyPlace(page, 'b06', '2');
  await submit(page);
  await expectHint(page, 1, '친구가 해도 똑같이 나뉠까?');
  await submit(page);
  await expectHint(page, 2, '두 친구가 같은 단추를 나눈 모습이에요');
  const friends = await expectOverlayOverCanvas(page, 'two-friends');
  await expect(friends.locator('[data-friend]')).toHaveCount(2);
  await changeCriterion(page);
  await chooseCriterion(page, 'shape');
  await placeAll(page, SHAPE_BINS);
  await submit(page);
  await expectPassed(page);

  // T4: 개수표(자동) → 틀린 선택 → 일반 ① → 나 선택
  await settleCanvas(page);
  // 개수 고르기 응답 칸이 붙어 크롬북에서는 첫 단추 줄이 34px 모자란다(T218 메모).
  await expectControlsAboveFold(page, 'g2s1u5.A1.T4', 34, 'sorter-controls');
  await chooseCriterion(page, 'shape');
  await placeAll(page, SHAPE_BINS);
  await expect(main(page).locator('[data-bin]')).toHaveCount(3);
  await expect(main(page).getByTestId('sorter-canvas')).toContainText(/\d\s*장/);
  await field(page, 'pick').getByRole('button', { name: '가: 동그라미', exact: true }).click();
  await submit(page);
  await expectHint(page, 1, '개수표의 수를 서로 견주어 봐요.');
  await field(page, 'pick').getByRole('button', { name: '나: 네모', exact: true }).click();
  await submit(page);
  await expectPassed(page, true);
});

test('g2s1u5.A1 — 컨베이어는 지금 카드부터, 단추·상자 단추는 모두 48px 이상이다', async ({
  page,
}) => {
  await openActivity(page, A1);
  await chooseCriterion(page, 'color');
  // 벨트에는 지금 카드 하나만 있다.
  await expect(main(page).locator('[data-card]')).toHaveCount(1);
  await expect(main(page).locator('[data-card="b01"]')).toBeVisible();
  await keyPlace(page, 'b01', '1');
  await expect(main(page).locator('[data-card="b02"]')).toBeVisible();

  const buttons = main(page).getByTestId('sorter-controls').getByRole('button');
  const total = await buttons.count();
  expect(total).toBeGreaterThan(0);
  for (let index = 0; index < total; index += 1) {
    const box = await buttons.nth(index).boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(47.5);
  }
});

// ---------------------------------------------------------------- A2

/** 새 카드의 보이는 글자(aria)로 진짜 상자를 안다(테스트는 기준을 알고 있다). */
async function newCardHas(page: Page, word: string): Promise<boolean> {
  const label = (await main(page).locator('[data-new-card]').getAttribute('aria-label')) ?? '';
  return label.includes(word);
}

async function predictThree(
  page: Page,
  word: string,
  how: 'key' | 'button' | 'keyboard-pick',
): Promise<void> {
  for (let step = 0; step < 3; step += 1) {
    const card = main(page).locator('[data-new-card]');
    const before = await card.getAttribute('data-card');
    const yes = await newCardHas(page, word);
    if (how === 'key') {
      await keyPlace(page, before ?? '', yes ? '1' : '2');
    } else if (how === 'button') {
      await main(page)
        .locator(`button[data-predict="${yes ? 'yes' : 'no'}"]`)
        .click();
    } else {
      // 카드를 Enter로 들고 상자에서 Enter로 놓는다(키보드만).
      await card.focus();
      await page.keyboard.press('Enter');
      const bin = main(page).locator(`[data-bin="${yes ? 'yes' : 'no'}"]`);
      await bin.focus();
      await page.keyboard.press('Enter');
    }
    await expect(main(page).getByTestId('sorter-status')).toContainText('맞았어요');
    if (step < 2) await expect(card).not.toHaveAttribute('data-card', before ?? '');
  }
}

async function guessAndSubmit(page: Page, name: string): Promise<void> {
  const panel = main(page).getByTestId('guess-panel');
  await expect(panel).toBeVisible();
  await panel.getByRole('button', { name, exact: true }).click();
  await expect(main(page).getByTestId('guess-result')).toBeVisible();
  await submit(page);
}

test('g2s1u5.A2 — 비밀 기준 추리 2과제 흐름과 노출 검사', async ({ page }) => {
  test.slow();
  await openActivity(page, A2);

  // T1: 시작 DOM에 비밀 기준 표시가 없다(카드 aria 속성 글은 예외라 기준 전용 표시만 본다).
  await settleCanvas(page);
  await expectControlsAboveFold(page, 'g2s1u5.A2.T1', 0, 'sorter-controls');
  await screenshot(page, 'g2s1u5-a2t1.png');
  await expectNoGradeText(page);
  expect(await attributeDump(main(page))).not.toMatch(/rule|secret/i);
  await expect(main(page).getByTestId('guess-panel')).toHaveCount(0);
  const startText = (await page.locator('body').textContent()) ?? '';
  expect(startText).not.toContain('빨간색');

  // 틀린 기준을 먼저 골라 보고(잠금 풀린 뒤) 다시 이어 간다: 힌트 ①
  await predictThree(page, '빨강', 'button');
  await main(page).getByTestId('guess-panel').getByRole('button', { name: '구멍 4개' }).click();
  await expect(main(page).getByTestId('sorter-status')).toContainText('카드를 더 보고 다시 골라요');
  await submit(page);
  await expectHint(page, 1, '예 상자에 든 단추들의 같은 점을 찾아봐요.');
  await submit(page);
  await expectHint(page, 2, '아니요 상자 단추에는 없고 예 상자 단추에만 있는 것은 무엇일까요?');
  await predictThree(page, '빨강', 'key');
  await guessAndSubmit(page, '빨간색');
  await expectPassed(page);

  // T2: 구멍 4개
  await settleCanvas(page);
  await expectControlsAboveFold(page, 'g2s1u5.A2.T2', 0, 'sorter-controls');
  const t2Text = (await page.locator('body').textContent()) ?? '';
  expect(t2Text).not.toContain('구멍 4개');
  await predictThree(page, '구멍 4개', 'key');
  await guessAndSubmit(page, '구멍 4개');
  await expectPassed(page, true);
});

test('g2s1u5.A2 — 키보드만으로 A2.T1을 푼다', async ({ page }) => {
  test.slow();
  await openActivity(page, A2);
  await predictThree(page, '빨강', 'keyboard-pick');
  const option = main(page).getByTestId('guess-panel').getByRole('button', { name: '빨간색' });
  await option.focus();
  await expect(option).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(main(page).getByTestId('guess-result')).toBeVisible();
  const send = page.getByRole('button', { name: '확인하기' });
  await send.focus();
  await page.keyboard.press('Enter');
  await expectPassed(page);
});

// ---------------------------------------------------------------- 오프라인

test('오프라인에서도 g2s1u5.A1 활동이 열린다', async ({ page, context }) => {
  await page.goto(PREVIEW_URL);
  await page.getByRole('button', { name: '1번', exact: true }).click();
  await page.getByRole('button', { name: '건너뛰기' }).click();
  await expect(page).toHaveURL(/#\/map$/);
  await page.goto(`${PREVIEW_URL}/#/activity/${A1.id}`);
  await expect(page.getByRole('heading', { name: A1.title })).toBeVisible();

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
  await expect(page.getByRole('heading', { name: A1.title })).toBeVisible();
  await expect(page.getByRole('button', { name: '확인하기' })).toBeVisible();
});
