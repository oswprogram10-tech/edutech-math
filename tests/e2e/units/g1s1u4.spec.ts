import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { PREVIEW_URL } from '../../../playwright.config';
import { expectControlsAboveFold } from '../controls-fold';
import { expectNoPanelInnerScroll } from '../panel-layout';

/**
 * T207 g1s1u4 「비교하기」 단원 E2E.
 * A1(E13 compare-direct)·A2(E06 compare)를 끝까지 통과하고, 대표 오답의 힌트 ①②를 확인한다.
 * 판 좌표는 논리 1000 폭이고, 상자 너비로만 배율을 구한다(논리 높이를 가정하지 않는다).
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

/** 고르기 응답 보기를 누른다. */
async function choose(page: Page, label: string): Promise<void> {
  await field(page, 'pick').getByRole('button', { name: label, exact: true }).click();
}

/** 순서 응답에서 물건을 위·아래로 옮긴다. */
async function moveOrder(
  page: Page,
  label: string,
  direction: '위로' | '아래로',
  times = 1,
): Promise<void> {
  for (let i = 0; i < times; i += 1) {
    await field(page, 'ord')
      .getByRole('button', { name: `${label} ${direction}` })
      .click();
  }
}

/** 힌트 ② 오버레이가 본 판 svg와 같은 자리·크기(1px 안)에 놓였는지 본다. */
async function expectOverlayOverCanvas(
  page: Page,
  overlayName: string,
  canvasTestId: string,
): Promise<Locator> {
  const overlay = slot(page, 'main').locator(`[data-overlay="${overlayName}"]`);
  await expect(overlay).toBeVisible();
  await expect
    .poll(async () => {
      const overlayBox = await overlay.locator('svg').first().boundingBox();
      const canvasBox = await slot(page, 'main').getByTestId(canvasTestId).boundingBox();
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

function canvasOf(page: Page, testId: string): Locator {
  return slot(page, 'main').getByTestId(testId);
}

/** 판이 칸에 맞춰 크기를 정할 때까지(상자가 두 번 연속 같아질 때까지) 기다린다. */
async function settleCanvas(page: Page, testId: string): Promise<void> {
  await canvasOf(page, testId).scrollIntoViewIfNeeded();
  let previous = '';
  await expect
    .poll(async () => {
      const now = JSON.stringify(await canvasOf(page, testId).boundingBox());
      const same = now === previous;
      previous = now;
      return same;
    })
    .toBe(true);
}

/** 논리 좌표(1000 기준)를 화면 좌표로. 배율은 상자 너비로만 구한다. */
async function toScreen(
  page: Page,
  testId: string,
  lx: number,
  ly: number,
): Promise<{ x: number; y: number }> {
  const box = await canvasOf(page, testId).boundingBox();
  if (!box) throw new Error('판을 찾지 못했습니다.');
  const scale = box.width / 1000;
  return { x: box.x + lx * scale, y: box.y + ly * scale };
}

async function dragBetween(
  page: Page,
  from: { x: number; y: number },
  to: { x: number; y: number },
): Promise<void> {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  const steps = 8;
  for (let i = 1; i <= steps; i += 1) {
    await page.mouse.move(
      from.x + ((to.x - from.x) * i) / steps,
      from.y + ((to.y - from.y) * i) / steps,
    );
  }
  await page.mouse.up();
}

// ── A1 도우미 ──

async function straightenRope(page: Page): Promise<void> {
  await slot(page, 'main').getByRole('button', { name: '구불구불한 밧줄 펴기' }).click();
  await expect(
    slot(page, 'main').getByRole('button', { name: '구불구불한 밧줄 펴기' }),
  ).toBeDisabled();
}

/** 연필의 왼쪽 끝을 방향키로 출발선(칸 0)까지 옮긴다. */
async function alignPencil(page: Page, label: string, cells: number): Promise<void> {
  const pencil = slot(page, 'main').getByRole('button', { name: `${label}. 방향키로 옮겨요` });
  await pencil.focus();
  for (let i = 0; i < cells; i += 1) await page.keyboard.press('ArrowLeft');
}

/** 손수건을 끌어 책의 왼쪽 위 모서리 가까이(0.4칸 어긋나게) 놓는다. 칸 위치는 DOM의 학생 화면 좌표다. */
async function overlapHanky(page: Page): Promise<void> {
  const main = slot(page, 'main');
  await settleCanvas(page, 'compare-canvas');
  const hanky = main.locator('[data-part="item"][data-id="hanky"]');
  const book = main.locator('[data-part="item"][data-id="book"]');
  const hx = Number(await hanky.getAttribute('data-x'));
  const hy = Number(await hanky.getAttribute('data-y'));
  const bx = Number(await book.getAttribute('data-x'));
  const by = Number(await book.getAttribute('data-y'));
  const CELL = 50;
  const from = await toScreen(page, 'compare-canvas', hx * CELL + 100, hy * CELL + 100);
  const to = await toScreen(page, 'compare-canvas', bx * CELL + 100 + 20, by * CELL + 100 - 18);
  await dragBetween(page, from, to);
  await expect(hanky).toHaveAttribute('data-x', String(bx));
  await expect(hanky).toHaveAttribute('data-y', String(by));
}

// ── A2 도우미 ──

function balanceItem(page: Page, id: string): Locator {
  return slot(page, 'main').locator(`[data-item="${id}"]`);
}

async function dragItem(page: Page, id: string, target: 'left' | 'right' | 'shelf'): Promise<void> {
  await settleCanvas(page, 'balance-canvas');
  await canvasOf(page, 'balance-canvas').evaluate((el) =>
    el.scrollIntoView({ block: 'center', inline: 'nearest' }),
  );
  await page.waitForTimeout(500); // 접시 옮김 애니메이션이 끝난 뒤의 자리를 잡는다.
  const board = await canvasOf(page, 'balance-canvas').boundingBox();
  const from = await balanceItem(page, id).boundingBox();
  if (!board || !from) throw new Error('판이나 물건을 찾지 못했습니다.');
  const scale = board.width / 1000;
  const drop = { left: [180, 300], right: [820, 300], shelf: [500, 540] }[target] as [
    number,
    number,
  ];
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(board.x + drop[0] * scale, board.y + drop[1] * scale, { steps: 8 });
  await page.mouse.up();
}

/** 물건을 키보드로 접시에 올린다(L·R·Backspace). */
async function keyItem(page: Page, id: string, key: 'l' | 'r' | 'Backspace'): Promise<void> {
  await balanceItem(page, id).focus();
  await page.keyboard.press(key);
}

async function expectPan(page: Page, pan: 'left' | 'right', ids: readonly string[]): Promise<void> {
  const pans = slot(page, 'main').locator(`[data-pan="${pan}"]`);
  await expect(pans).toHaveCount(1);
  for (const id of ids) {
    await expect(balanceItem(page, id)).toHaveAttribute('data-place', pan);
  }
}

test('A1 밧줄 펴기·겹치기·옮겨 담기 — 대표 오답 뒤 고쳐서 네 과제를 통과한다', async ({ page }) => {
  await openActivity(page, 'g1s1u4.A1', '밧줄 펴기·겹치기·옮겨 담기');
  await settleCanvas(page, 'compare-canvas');
  await screenshot(page, 'g1s1u4-a1t1.png');

  // T1 — 펴지 않고 곧은 밧줄을 고르면 MC-MEASURE-CURVE ①, 다음 실패에서 ②(반쯤 펴진 미리보기).
  await choose(page, '곧은 밧줄');
  await submit(page);
  await expectFailedWithHint(page, '밧줄을 쭉 펴 보면?');
  await submit(page);
  await expectFailedWithHint(page, '밧줄이 어떻게 펴지는지 봐요', 2);
  await expectOverlayOverCanvas(page, 'half-straighten', 'compare-canvas');
  await straightenRope(page);
  await choose(page, '구불구불한 밧줄');
  await submit(page);
  await expectPassed(page);

  // T2 — 오른쪽 끝만 보고 나·가·다로 놓으면 MC-MEASURE-ENDPOINT ①, 다음 실패에서 ②(왼쪽 끝 점선).
  await settleCanvas(page, 'compare-canvas');
  await moveOrder(page, '연필 다', '아래로', 2); // 가·나·다
  await moveOrder(page, '연필 나', '위로', 1); // 나·가·다
  await submit(page);
  await expectFailedWithHint(page, '출발선을 똑같이 맞췄어?');
  await submit(page);
  await expectFailedWithHint(page, '왼쪽 끝이 얼마나 어긋났는지 봐요', 2);
  const lines = await expectOverlayOverCanvas(page, 'endpoint-lines', 'compare-canvas');
  await expect(lines).toContainText('어긋남');
  await alignPencil(page, '연필 나', 3);
  await alignPencil(page, '연필 다', 2);
  await moveOrder(page, '연필 나', '아래로', 1); // 가·나·다
  await submit(page);
  await expectPassed(page);

  // T3 — 손수건을 책 위에 모서리를 맞춰 겹친 뒤 고른다.
  await overlapHanky(page);
  await choose(page, '손수건');
  await submit(page);
  await expectPassed(page);

  // T4 — 두 컵을 같은 수조에 모두 부은 뒤 고른다.
  await settleCanvas(page, 'compare-canvas');
  await screenshot(page, 'g1s1u4-a1t4.png');
  await slot(page, 'main')
    .getByRole('button', { name: '키 큰 컵의 물을 같은 수조에 붓기' })
    .click();
  await slot(page, 'main').getByRole('button', { name: '넓은 컵의 물을 같은 수조에 붓기' }).click();
  await choose(page, '넓은 컵');
  await submit(page);
  await expectPassed(page, true);
});

test('A1.T1 펴지 않고 구불구불한 밧줄을 고르면 정답이라도 실패하고 일반 힌트 ①이 나온다', async ({
  page,
}) => {
  await openActivity(page, 'g1s1u4.A1', '밧줄 펴기·겹치기·옮겨 담기');
  await choose(page, '구불구불한 밧줄');
  await submit(page);
  await expectFailedWithHint(page, '밧줄을 펴서 견주어 봐요.');
  await expect(page.getByText('좋아요, 통과했어요!')).toHaveCount(0);
  await straightenRope(page);
  await submit(page);
  await expectPassed(page);
});

test('A2 양팔저울 무게 비교 — 대표 오답 뒤 고쳐서 네 과제를 통과한다', async ({ page }) => {
  await openActivity(page, 'g1s1u4.A2', '양팔저울 무게 비교');
  await settleCanvas(page, 'balance-canvas');

  // T1 — 끌어서 두 물건을 올린다. 올리지 않고 고르면 실패한다.
  await choose(page, '사과');
  await submit(page);
  await expectFailedWithHint(page, '두 물건을 저울에 하나씩 올려 보았나요?');
  await dragItem(page, 'apple', 'left');
  await expectPan(page, 'left', ['apple']);
  await dragItem(page, 'feather', 'right');
  await expectPan(page, 'right', ['feather']);
  await submit(page);
  await expectPassed(page);

  // T2 — 큰 스펀지를 고르면 MC-SIZE-IS-WEIGHT ①, 저울에 올린 뒤 다음 실패에서 ②(크기·무게 막대).
  await settleCanvas(page, 'balance-canvas');
  await screenshot(page, 'g1s1u4-a2t2.png');
  await choose(page, '큰 스펀지');
  await submit(page);
  await expectFailedWithHint(page, '저울에 올려 보면?');
  await keyItem(page, 'sponge', 'l');
  await keyItem(page, 'iron-ball', 'r');
  await expectPan(page, 'left', ['sponge']);
  await expectPan(page, 'right', ['iron-ball']);
  await submit(page);
  await expectFailedWithHint(page, '크기와 무게를 나란히 견주어 봐요', 2);
  await expectOverlayOverCanvas(page, 'size-vs-weight', 'balance-canvas');
  await choose(page, '작은 쇠공');
  await submit(page);
  await expectPassed(page);

  // T3 — 두 번 비교해 무거운 것부터 놓는다. 한 번만 비교하고 맞게 놓으면 실패한다.
  await settleCanvas(page, 'balance-canvas');
  await keyItem(page, 'stone', 'l');
  await keyItem(page, 'apple', 'r');
  await moveOrder(page, '돌', '위로', 2); // 돌·사과·지우개
  await submit(page);
  await expectFailedWithHint(page, '두 개씩 저울에 올려 보았나요?');
  await keyItem(page, 'stone', 'Backspace');
  await keyItem(page, 'eraser', 'l');
  await submit(page);
  await expectPassed(page);

  // T4 — 한쪽에 두 개를 올려 수평을 만든다.
  await settleCanvas(page, 'balance-canvas');
  await keyItem(page, 'book', 'l');
  await keyItem(page, 'apple', 'r');
  await submit(page);
  await expectFailedWithHint(page, '한쪽에 두 개를 올려 보면 어떨까요?');
  await keyItem(page, 'eraser', 'r');
  await expect(canvasOf(page, 'balance-canvas')).toHaveAttribute('data-tilt', 'level');
  await submit(page);
  await expectPassed(page, true);
});

test('A2.T1을 키보드만으로 푼다', async ({ page }) => {
  await openActivity(page, 'g1s1u4.A2', '양팔저울 무게 비교');
  await settleCanvas(page, 'balance-canvas');
  await keyItem(page, 'apple', 'l');
  await keyItem(page, 'feather', 'r');
  await expectPan(page, 'left', ['apple']);
  await expectPan(page, 'right', ['feather']);
  const option = field(page, 'pick').getByRole('button', { name: '사과', exact: true });
  await option.focus();
  await page.keyboard.press('Enter');
  await expect(option).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: '확인하기' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByText('좋아요, 통과했어요!')).toBeVisible();
});

/** 판 안 글·aria·data-(학생이 놓은 자리 좌표 제외)를 모아 돌려준다. */
async function exposedText(page: Page): Promise<string> {
  return slot(page, 'main').evaluate((root) => {
    const skip = new Set([
      'data-x',
      'data-y',
      'data-start',
      'data-index',
      'data-tick',
      'data-target-size',
    ]);
    const parts: string[] = [root.textContent ?? ''];
    for (const element of [root, ...Array.from(root.querySelectorAll('*'))]) {
      for (const attribute of Array.from(element.attributes)) {
        if (attribute.name === 'aria-label' || attribute.name === 'title') {
          parts.push(attribute.value);
        } else if (attribute.name.startsWith('data-') && !skip.has(attribute.name)) {
          parts.push(attribute.value);
        }
      }
    }
    return parts.join('\n');
  });
}

test('시작 화면 DOM·aria·data-에 길이·무게 값과 결과 글이 없고 학년 표시도 없다', async ({
  page,
}) => {
  const resultText = /더 (긴|짧|길|무거|가벼|많|적|넓|좁)|무거워요|가벼워요|수평이에요/;

  await openActivity(page, 'g1s1u4.A1', '밧줄 펴기·겹치기·옮겨 담기');
  await settleCanvas(page, 'compare-canvas');
  let text = await exposedText(page);
  expect(text).not.toMatch(/(^|\D)(7|6)(\D|$)/); // 밧줄 길이
  expect(text).not.toMatch(resultText);
  expect((await page.locator('body').textContent()) ?? '').not.toMatch(/[1-6]학년/);

  await openActivity(page, 'g1s1u4.A2', '양팔저울 무게 비교');
  await settleCanvas(page, 'balance-canvas');
  text = await exposedText(page);
  expect(text).not.toMatch(/(^|\D)(1|3)(\D|$)/); // 사과·깃털 무게
  expect(text).not.toMatch(resultText);
  expect((await page.locator('body').textContent()) ?? '').not.toMatch(/[1-6]학년/);
});

test('저학년 모드 64px 터치 타깃: A2 옮기기 단추와 응답 보기', async ({ page }) => {
  await openActivity(page, 'g1s1u4.A2', '양팔저울 무게 비교');
  await settleCanvas(page, 'balance-canvas');
  const targets: Locator[] = [
    page.getByTestId('compare-left'),
    page.getByTestId('compare-right'),
    page.getByTestId('compare-shelf'),
    field(page, 'pick').getByRole('button', { name: '사과', exact: true }),
  ];
  for (const target of targets) {
    await target.scrollIntoViewIfNeeded();
    const box = await target.boundingBox();
    expect(box).not.toBeNull();
    expect(box?.width ?? 0).toBeGreaterThanOrEqual(63.5);
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(63.5);
  }
});

test('크롬북·전자칠판 첫 화면에 엔진·응답 칸·확인하기가 들어온다', async ({ page }, testInfo) => {
  test.skip(
    testInfo.project.name === 'ipad',
    '아이패드는 판을 위아래로 두어 짧은 스크롤을 허용한다',
  );

  const cases = [
    { id: 'g1s1u4.A1', title: '밧줄 펴기·겹치기·옮겨 담기' },
    { id: 'g1s1u4.A2', title: '양팔저울 무게 비교' },
  ] as const;

  for (const item of cases) {
    await openActivity(page, item.id, item.title);
    await page.evaluate(() => window.scrollTo(0, 0));
    await expectNoPanelInnerScroll(page);
    await expect(slot(page, 'main')).toBeInViewport({ ratio: 1 });
    await expect(responseSlot(page)).toBeInViewport({ ratio: 1 });
    await expect(page.getByRole('button', { name: '확인하기' })).toBeInViewport({ ratio: 1 });
  }
});

/**
 * compare-direct는 끌어 놓는 범위(길이 9줄·넓이 12줄)가 판 안에 모두 들어가야 해서 판이 600 높이를 쓴다
 * (모드 동작을 바꾸지 않는다). 그래서 크롬북 두 칸 화면에서 조작 칸 첫 단추 줄이 31~32px 모자란다(T223 메모).
 */
const COMPARE_CHROMEBOOK_SHORTFALL = 34;

test('A1 모든 과제에서 조작 칸 첫 단추 줄이 첫 화면에 보인다(T223)', async ({ page }) => {
  await openActivity(page, 'g1s1u4.A1', '밧줄 펴기·겹치기·옮겨 담기');

  // T1 — 밧줄 펴기 단추.
  await settleCanvas(page, 'compare-canvas');
  await expectControlsAboveFold(page, 'g1s1u4.A1.T1', COMPARE_CHROMEBOOK_SHORTFALL);
  await straightenRope(page);
  await choose(page, '구불구불한 밧줄');
  await submit(page);
  await expectPassed(page);

  // T2 — 연필 세 자루(옮기기 단추).
  await settleCanvas(page, 'compare-canvas');
  await expectControlsAboveFold(page, 'g1s1u4.A1.T2', COMPARE_CHROMEBOOK_SHORTFALL);
  await alignPencil(page, '연필 나', 3);
  await alignPencil(page, '연필 다', 2);
  await moveOrder(page, '연필 다', '아래로', 2); // 가·나·다
  await submit(page);
  await expectPassed(page);

  // T3 — 손수건·책 겹치기.
  await settleCanvas(page, 'compare-canvas');
  await expectControlsAboveFold(page, 'g1s1u4.A1.T3', COMPARE_CHROMEBOOK_SHORTFALL);
  await overlapHanky(page);
  await choose(page, '손수건');
  await submit(page);
  await expectPassed(page);

  // T4 — 컵 옮겨 담기.
  await settleCanvas(page, 'compare-canvas');
  await expectControlsAboveFold(page, 'g1s1u4.A1.T4', COMPARE_CHROMEBOOK_SHORTFALL);
});

test('오프라인에서도 g1s1u4.A1 활동이 열린다', async ({ page, context }) => {
  await page.goto(PREVIEW_URL);
  await page.getByRole('button', { name: '1번', exact: true }).click();
  await page.getByRole('button', { name: '건너뛰기' }).click();
  await expect(page).toHaveURL(/#\/map$/);
  await page.goto(`${PREVIEW_URL}/#/activity/g1s1u4.A1`);
  await expect(page.getByRole('heading', { name: '밧줄 펴기·겹치기·옮겨 담기' })).toBeVisible();

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
  await expect(page.getByRole('heading', { name: '밧줄 펴기·겹치기·옮겨 담기' })).toBeVisible();
  await expect(page.getByRole('button', { name: '확인하기' })).toBeVisible();
});
