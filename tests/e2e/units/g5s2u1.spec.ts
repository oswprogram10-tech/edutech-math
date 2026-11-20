import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { PREVIEW_URL } from '../../../playwright.config';
import { expectControlsAboveFold } from '../controls-fold';
import { expectNoPanelInnerScroll } from '../panel-layout';

/**
 * T220 g5s2u1 「수의 범위와 어림하기」 단원 E2E.
 * - A1(E03 `range`) 5과제, A2(E03 `rounding`) 4과제를 끝까지 통과한다.
 * - 대표 오답: A1.T1 빈 동그라미(MC-RANGE-BOUNDARY-INCLUSION ①②, `boundary-rider` 1px),
 *   A2.T1 반올림(MC-ROUND-CONTEXT-BLIND ①②, `left-behind` 1px), A2.T3 4540(MC-ROUND-WRONG-PLACE ①)
 * - 엔진이 보이는 모든 과제의 조작 칸 첫 화면 검사 + range 수직선 첫 화면 검사
 * - 키보드만으로 A1.T1, 첫 화면 기준 이미지, 정답 노출 검사, 오프라인
 * 판 좌표는 판 상자 너비/1000으로만 배율을 구하고 논리 높이는 가정하지 않는다(눈금의 실제 화면 자리를 읽는다).
 */

test.describe.configure({ timeout: 240_000 });
test.use({ actionTimeout: 20_000 });

function slot(page: Page, name: string): Locator {
  return page.getByTestId(`runner-slot-${name}`);
}

function field(page: Page, id: string): Locator {
  return slot(page, 'response').locator(`[data-response-field="${id}"]`);
}

async function openActivity(page: Page, activityId: string, heading: string): Promise<void> {
  await page.goto('/');
  await page.getByRole('button', { name: '1번', exact: true }).click();
  await page.getByRole('button', { name: '건너뛰기' }).click();
  await expect(page).toHaveURL(/#\/map$/);
  await page.goto(`/#/activity/${activityId}`);
  await expect(page.getByRole('heading', { name: heading })).toBeVisible();
  await expect(page.getByRole('button', { name: '확인하기' })).toBeVisible();
}

async function submit(page: Page): Promise<void> {
  await page.getByRole('button', { name: '확인하기' }).click();
}

async function expectFailedWithHint(page: Page, text: string, level: 1 | 2 | 3 = 1): Promise<void> {
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
  await page.evaluate(() => {
    window.scrollTo(0, 0);
    document.querySelector('main')?.scrollTo(0, 0);
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

/** 고르기 응답의 보기 하나를 누른다(앞부분 글자로 찾는다). */
async function choose(page: Page, id: string, label: string): Promise<void> {
  await field(page, id)
    .getByRole('button', { name: new RegExp(`^${label}`) })
    .click();
}

async function typeNumberField(page: Page, id: string, digits: readonly string[]): Promise<void> {
  await field(page, id)
    .getByRole('button', { name: /^자연수 부분:/ })
    .first()
    .click();
  for (let i = 0; i < 5; i += 1) {
    await page.keyboard.press('Backspace');
  }
  for (const key of digits) {
    await page.keyboard.press(key);
  }
}

// ---------------------------------------------------------------- range 도우미

function canvasOf(page: Page): Locator {
  return page.getByTestId('number-line-canvas');
}

/** 수직선이 보이게 스크롤한 뒤의 판 상자. */
async function boxInView(page: Page) {
  const canvas = canvasOf(page);
  await canvas.evaluate((element) => element.scrollIntoView({ block: 'end' }));
  const box = await canvas.boundingBox();
  if (!box) throw new Error('수직선 판 크기를 알 수 없습니다.');
  return box;
}

/**
 * range 수직선 위 값의 화면 좌표. 판 상자는 칸 높이에 눌려 그림보다 넓을 수 있어서(가운데 정렬),
 * 상자 크기로 배율을 계산하지 않고 눈금(`data-tick-value`)의 실제 화면 자리를 읽는다.
 */
async function lineAt(page: Page, value: number): Promise<{ x: number; y: number }> {
  await boxInView(page);
  const tick = canvasOf(page).locator(`[data-tick-value="${value}"] line`);
  const box = await tick.boundingBox();
  if (!box) throw new Error(`${value} 눈금의 자리를 알 수 없습니다.`);
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

async function placeBound(page: Page, value: number): Promise<void> {
  const point = await lineAt(page, value);
  await page.mouse.click(point.x, point.y);
}

async function toggleBound(page: Page, value: number): Promise<void> {
  await placeBound(page, value);
}

async function clickControl(page: Page, name: string): Promise<void> {
  await page.getByRole('button', { name, exact: true }).click();
}

async function openGate(page: Page): Promise<void> {
  await clickControl(page, '게이트 열기');
  await expect(page.locator('[data-testid="range-story"][data-gate-done="true"]')).toBeVisible({
    timeout: 8000,
  });
}

/** 수직선 눈금 글자의 아래 끝이 첫 화면(스크롤 0) 아래로 넘친 px(0 이하면 보인다). */
async function lineFoldOverflow(page: Page): Promise<number> {
  await page.evaluate(() => {
    window.scrollTo(0, 0);
    document.querySelectorAll('main').forEach((main) => {
      main.scrollTop = 0;
    });
  });
  const label = canvasOf(page).locator('[data-tick-value="100"] text');
  await label.waitFor({ state: 'visible' });
  return label.evaluate((element) => {
    let line = window.innerHeight;
    // 판 칸(overflow가 auto·scroll·hidden인 조상)의 아래 끝 중 가장 위에 있는 선을 기준으로 한다.
    for (let node = element.parentElement; node; node = node.parentElement) {
      const overflow = getComputedStyle(node).overflowY;
      if (overflow === 'auto' || overflow === 'scroll' || overflow === 'hidden') {
        line = Math.min(line, node.getBoundingClientRect().bottom);
      }
    }
    return Math.round(element.getBoundingClientRect().bottom - line);
  });
}

async function expectLineAboveFold(page: Page, label: string): Promise<void> {
  let previous = Number.NaN;
  await expect
    .poll(async () => {
      const now = await lineFoldOverflow(page);
      const same = now === previous;
      previous = now;
      return same;
    })
    .toBe(true);
  expect(
    await lineFoldOverflow(page),
    `${label}: range 수직선이 첫 화면 아래로 넘친 px`,
  ).toBeLessThanOrEqual(0);
}

async function expectOverlayAligned(page: Page, testId: string): Promise<Locator> {
  const overlay = page.getByTestId(testId);
  await expect(overlay).toBeVisible();
  await expect
    .poll(async () => {
      const overlayBox = await overlay.boundingBox();
      const canvasBox = await canvasOf(page).boundingBox();
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

/**
 * 시작 화면 노출 검사: 응답 칸 밖의 글·aria-label·title·data-* 값에 금지어가 없다.
 * 수는 앞뒤가 숫자·쉼표·마침표가 아닌 낱개 수로만 센다(243 안의 24는 세지 않는다).
 */
async function exposedOutsideResponse(page: Page, source: string): Promise<string[]> {
  return page.evaluate((pattern) => {
    const regex = new RegExp(pattern);
    const response = document.querySelector('[data-testid="runner-slot-response"]');
    const found: string[] = [];
    const walk = (node: Element) => {
      if (response && (node === response || response.contains(node))) return;
      for (const attr of Array.from(node.attributes)) {
        if (attr.name === 'data-tick-index') continue;
        if (
          attr.name === 'aria-label' ||
          attr.name === 'title' ||
          attr.name === 'alt' ||
          attr.name.startsWith('data-')
        ) {
          if (regex.test(attr.value)) found.push(`${attr.name}=${attr.value}`);
        }
      }
      for (const child of Array.from(node.childNodes)) {
        if (child.nodeType === Node.TEXT_NODE) {
          const text = child.textContent ?? '';
          if (regex.test(text)) found.push(`text:${text.trim()}`);
        } else if (child instanceof Element) {
          if (['SCRIPT', 'STYLE'].includes(child.tagName)) continue;
          walk(child);
        }
      }
    };
    walk(document.body);
    return found;
  }, source);
}

const NUMBER_ANSWERS = '(^|[^\\d.,])(25|24|4,?500)([^\\d.,]|$)';

async function expectNoGradeLabel(page: Page): Promise<void> {
  const text = (await page.locator('body').innerText()) ?? '';
  expect(text).not.toMatch(/[1-6]\s*학년/);
}

// ---------------------------------------------------------------- A1

test('g5s2u1.A1 — 다섯 과제를 통과하고 대표 오답 힌트를 확인한다', async ({ page }) => {
  test.slow();
  await openActivity(page, 'g5s2u1.A1', '롤러코스터 탑승 게이트');
  await expectNoPanelInnerScroll(page);

  // T1 — 첫 화면, 빈 동그라미 → MC ① → ②(boundary-rider) → 속 찬 동그라미로 통과
  await expectControlsAboveFold(page, 'g5s2u1.A1.T1', 0, 'range-controls');
  await expectLineAboveFold(page, 'g5s2u1.A1.T1');
  await screenshot(page, 'g5s2u1-a1-t1.png');
  await placeBound(page, 130);
  await expect(page.getByTestId('range-bound-0')).toHaveAttribute('data-value', '130');
  await expect(page.getByTestId('range-bound-0')).toHaveAttribute('data-closed', 'false');
  await clickControl(page, '오른쪽으로');
  await openGate(page);
  await submit(page);
  await expectFailedWithHint(page, '키가 딱 130cm인 친구는 탈 수 있을까?', 1);
  await submit(page);
  await expectFailedWithHint(page, '130cm 친구가 지금 만든 게이트를 지나가는지 봐요.', 2);
  await expectOverlayAligned(page, 'overlay-boundary-rider');
  const rider = page.locator('[data-testid="overlay-boundary-rider"] [data-rider-height]');
  await expect(rider).toHaveCount(1);
  await expect(rider).toHaveAttribute('data-rider-height', '130');
  await expect(rider).toHaveAttribute('data-result', 'blocked');
  await toggleBound(page, 130);
  await expect(page.getByTestId('range-bound-0')).toHaveAttribute('data-closed', 'true');
  await openGate(page);
  await submit(page);
  await expectPassed(page);

  // T2 — 왼쪽이 아닌 오른쪽(150보다 큰 쪽) 방향 → 일반 전용 ① → 왼쪽·속 찬 동그라미로 통과
  await expectControlsAboveFold(page, 'g5s2u1.A1.T2', 0, 'range-controls');
  await expectLineAboveFold(page, 'g5s2u1.A1.T2');
  await placeBound(page, 150);
  await clickControl(page, '오른쪽으로');
  await openGate(page);
  await submit(page);
  await expectFailedWithHint(page, '탈 수 있는 사람은 150cm보다 큰 쪽일까요, 작은 쪽일까요?', 1);
  await clickControl(page, '왼쪽으로');
  await toggleBound(page, 150);
  await expect(page.getByTestId('range-bound-0')).toHaveAttribute('data-closed', 'true');
  await openGate(page);
  await submit(page);
  await expectPassed(page);

  // T3 — 두 경계가 모두 반대 → 왼쪽 경계 MC ① → 두 동그라미를 바로잡아 통과
  await expectControlsAboveFold(page, 'g5s2u1.A1.T3', 0, 'range-controls');
  await expectLineAboveFold(page, 'g5s2u1.A1.T3');
  await placeBound(page, 150);
  await placeBound(page, 130);
  await toggleBound(page, 150); // 150 속 찬(틀림)
  await submit(page);
  await expectFailedWithHint(page, '키가 딱 130cm인 친구는 탈 수 있을까?', 1);
  await toggleBound(page, 130); // 130 속 찬
  await toggleBound(page, 150); // 150 빈
  await submit(page);
  await expectPassed(page);

  // T4 — 게이트를 말로 쓰기: 나(130 이상)를 섞으면 MC ① → ②(boundary-rider 둘) → 가·다로 통과
  await expectControlsAboveFold(page, 'g5s2u1.A1.T4', 0, 'range-controls');
  await expectLineAboveFold(page, 'g5s2u1.A1.T4');
  expect(await exposedOutsideResponse(page, '초과|이하')).toEqual([]);
  await screenshot(page, 'g5s2u1-a1-t4.png');
  await choose(page, 'pick', '나');
  await choose(page, 'pick', '다');
  await submit(page);
  await expectFailedWithHint(page, '키가 딱 130cm, 150cm인 친구는 게이트를 지나갈 수 있을까?', 1);
  await submit(page);
  await expectFailedWithHint(
    page,
    '경계에 딱 맞는 키의 친구가 게이트를 어떻게 지나가는지 봐요.',
    2,
  );
  await expectOverlayAligned(page, 'overlay-boundary-rider');
  await expect(
    page.locator('[data-testid="overlay-boundary-rider"] [data-rider-height]'),
  ).toHaveCount(2);
  await choose(page, 'pick', '나'); // 빼기
  await choose(page, 'pick', '가');
  await submit(page);
  await expectPassed(page);

  // T5 — 수직선 없이 범위에 드는 수 고르기: 129·150을 섞으면 MC ① → ② → 130·149로 통과
  await expect(canvasOf(page)).toHaveCount(0);
  await choose(page, 'pick', '나');
  await choose(page, 'pick', '다');
  await submit(page);
  await expectFailedWithHint(page, '130과 150이 범위 안에 들어가는지 먼저 생각해 봐요.', 1);
  await submit(page);
  await expectFailedWithHint(page, '경계에 딱 맞는 수가 들어가는지 먼저 따져 봐요.', 2);
  await choose(page, 'pick', '다'); // 빼기
  await choose(page, 'pick', '라');
  await submit(page);
  await expectPassed(page, true);
});

test('g5s2u1.A1 — 키보드만으로 T1을 통과한다', async ({ page }) => {
  await openActivity(page, 'g5s2u1.A1', '롤러코스터 탑승 게이트');
  const canvas = canvasOf(page);
  await canvas.focus();
  for (let count = 0; count < 30; count += 1) await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('range-bound-0')).toHaveAttribute('data-value', '130');
  await page.keyboard.press('Space');
  await expect(page.getByTestId('range-bound-0')).toHaveAttribute('data-closed', 'true');
  await page.getByRole('button', { name: '오른쪽으로', exact: true }).focus();
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: '게이트 열기', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-testid="range-story"][data-gate-done="true"]')).toBeVisible({
    timeout: 8000,
  });
  await page.getByRole('button', { name: '확인하기' }).focus();
  await page.keyboard.press('Enter');
  await expectPassed(page);
});

// ---------------------------------------------------------------- A2

test('g5s2u1.A2 — 네 과제를 통과하고 대표 오답 힌트를 확인한다', async ({ page }) => {
  test.slow();
  await openActivity(page, 'g5s2u1.A2', '어림 의사결정 시뮬레이터');
  await expectNoPanelInnerScroll(page);

  // T1 — 첫 화면, 노출 검사, 반올림 → MC ① → ②(left-behind) → 올림·25로 통과
  await expectControlsAboveFold(page, 'g5s2u1.A2.T1', 0, 'rounding-controls');
  expect(await exposedOutsideResponse(page, NUMBER_ANSWERS)).toEqual([]);
  await expectNoGradeLabel(page);
  await screenshot(page, 'g5s2u1-a2-t1.png');
  await clickControl(page, '반올림');
  await typeNumberField(page, 'n', ['2', '4']);
  await submit(page);
  await expectFailedWithHint(page, '고른 방법대로 하면 학생이 모두 탈 수 있을까요?', 1);
  await submit(page);
  await expectFailedWithHint(page, '남는 것이 생기면 그 상황에서 괜찮은지 생각해 봐요.', 2);
  await expectOverlayAligned(page, 'overlay-left-behind');
  await expect(
    page.locator('[data-testid="overlay-left-behind"] [data-testid="scene-student"]'),
  ).toHaveCount(3);
  await clickControl(page, '올림');
  await typeNumberField(page, 'n', ['2', '5']);
  await submit(page);
  await expectPassed(page);

  // T2 — 올림·25 → MC ① → 버림·24로 통과
  await expectControlsAboveFold(page, 'g5s2u1.A2.T2', 0, 'rounding-controls');
  expect(await exposedOutsideResponse(page, NUMBER_ANSWERS)).toEqual([]);
  await clickControl(page, '올림');
  await typeNumberField(page, 'n', ['2', '5']);
  await submit(page);
  await expectFailedWithHint(page, '고른 방법대로 하면 봉지가 모두 가득 찰까요?', 1);
  await clickControl(page, '버림');
  await typeNumberField(page, 'n', ['2', '4']);
  await submit(page);
  await expectPassed(page);

  // T3 — 4540 → MC-ROUND-WRONG-PLACE ① → 4600 일반 ② → 4500으로 통과
  await expect(canvasOf(page)).toHaveCount(0);
  expect(await exposedOutsideResponse(page, NUMBER_ANSWERS)).toEqual([]);
  await typeNumberField(page, 'n', ['4', '5', '4', '0']);
  await submit(page);
  await expectFailedWithHint(page, '백의 자리까지 어림하려면 어느 자리 숫자를 봐야 할까?', 1);
  await typeNumberField(page, 'n', ['4', '6', '0', '0']);
  await submit(page);
  await expectFailedWithHint(page, '그 숫자가 5 이상이면 올리고, 4 이하이면 버려요.', 2);
  await typeNumberField(page, 'n', ['4', '5', '0', '0']);
  await submit(page);
  await expectPassed(page);

  // T4 — s1·s2에 반올림 → MC ① → ② → 올림·버림·반올림으로 통과
  await expect(canvasOf(page)).toHaveCount(0);
  await choose(page, 's1', '반올림');
  await choose(page, 's2', '버림');
  await choose(page, 's3', '반올림');
  await submit(page);
  await expectFailedWithHint(
    page,
    '고른 방법대로 하면 책을 꽂을 칸이나 바꿀 지폐가 모자라지 않을까요?',
    1,
  );
  await submit(page);
  await expectFailedWithHint(page, '남는 것이 생기면 그 상황에서 괜찮은지 생각해 봐요.', 2);
  await choose(page, 's1', '올림');
  await submit(page);
  await expectPassed(page, true);
});

test('오프라인에서도 g5s2u1.A1 활동이 열린다', async ({ page, context }) => {
  await page.goto(PREVIEW_URL);
  await page.getByRole('button', { name: '1번', exact: true }).click();
  await page.getByRole('button', { name: '건너뛰기' }).click();
  await expect(page).toHaveURL(/#\/map$/);
  await page.goto(`${PREVIEW_URL}/#/activity/g5s2u1.A1`);
  await expect(page.getByRole('heading', { name: '롤러코스터 탑승 게이트' })).toBeVisible();

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
  await expect(page.getByRole('heading', { name: '롤러코스터 탑승 게이트' })).toBeVisible();
  await expect(page.getByRole('button', { name: '확인하기' })).toBeVisible();
});
