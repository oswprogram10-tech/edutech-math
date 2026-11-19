import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { PREVIEW_URL } from '../../../playwright.config';
import { expectContentPanelsReachable } from '../panel-layout';

/**
 * T176 g5s1u3 「대응 관계」 단원 E2E.
 * - A1(공변 슬라이더와 대응표 4과제)·A2(관계식 레이저로 보석 모으기 4과제) 정답 통과, 과제마다 대표 오답 → 일반 ①
 * - 오개념 MC-PATTERN-RECURSIVE-ONLY(long-chain)·MC-PATTERN-ONE-PAIR(fail-cols, laser-miss)·
 *   MC-CORR-SWAP-VARS(swap-check) ①·② 오버레이가 실제로 그려지고 본 캔버스와 1px 안에서 맞는다.
 * - 슬라이더 포인터·키보드, 식 키패드 포인터, 키보드 식 입력
 * - 학생 화면에 숨은 규칙·학년 표시가 없다. 첫 화면 스냅샷, 오프라인.
 */

test.describe.configure({ timeout: 300_000 });
test.use({ actionTimeout: 20_000 });

interface UnitTask {
  readonly id: string;
  readonly prompt: string;
  readonly config: Record<string, unknown>;
  readonly hints: readonly { readonly say?: string }[];
}
interface UnitContent {
  readonly activities: readonly { readonly id: string; readonly tasks: readonly UnitTask[] }[];
}

const content = JSON.parse(
  readFileSync(new URL('../../../data/content/g5s1u3.json', import.meta.url), 'utf-8'),
) as UnitContent;

test('콘텐츠 설정이 명세를 따른다(A1 4과제, A2 4과제, 학년·숨은 규칙 노출 없음)', () => {
  expect(content.activities.map((a) => a.id)).toEqual(['g5s1u3.A1', 'g5s1u3.A2']);
  const a1 = content.activities[0]?.tasks ?? [];
  const a2 = content.activities[1]?.tasks ?? [];
  expect(a1.map((t) => t.id)).toEqual([
    'g5s1u3.A1.T1',
    'g5s1u3.A1.T2',
    'g5s1u3.A1.T3',
    'g5s1u3.A1.T4',
  ]);
  expect(a2.map((t) => t.id)).toEqual([
    'g5s1u3.A2.T1',
    'g5s1u3.A2.T2',
    'g5s1u3.A2.T3',
    'g5s1u3.A2.T4',
  ]);
  expect(a1.map((t) => t.config['mode'])).toEqual(['covary', 'table', 'covary', 'covary']);
  expect(a2.map((t) => t.config['mode'])).toEqual([
    'rule-shooter',
    'rule-shooter',
    'black-box',
    'rule-shooter',
  ]);
  expect(a1[0]?.config['ruleInput']).toBe(false);
  expect(a1[1]?.config['ruleInput']).toBe(false);
  expect(a2[3]?.config['avoidForm']).toBe('□ = ○ × 3 + 1');
  for (const task of [...a1, ...a2]) {
    expect(task.config['symbols']).toBeUndefined();
    expect(task.config['levels']).toBeUndefined();
    const hintTexts = task.hints.map((hint) => hint.say ?? '');
    // 빈칸 값(20·8)은 힌트에 쓰지 않는다. 발문의 수(5개, 32개)는 과제 자료다.
    for (const text of hintTexts) expect(text).not.toMatch(/\b(20|8)\b/);
    for (const text of [task.prompt, ...hintTexts]) {
      expect(text).not.toMatch(/[1-6]학년/);
      expect(text).not.toMatch(/함수|정의역|일차식/);
      // 숨은 규칙의 곱·더하는 수, 빈칸 값을 쓰지 않는다(A2.T4 발문의 이미 맞힌 식만 예외).
      if (task.id !== 'g5s1u3.A2.T4') {
        expect(text).not.toMatch(/× ?[2-4]|×[2-4]|[+] ?[13]\b/);
      }
    }
  }
});

function slot(page: Page, name: string): Locator {
  return page.getByTestId(`runner-slot-${name}`);
}

function main(page: Page): Locator {
  return slot(page, 'main');
}

function pad(page: Page, name: string): Locator {
  return main(page).getByRole('button', { name, exact: true });
}

async function openActivity(page: Page, activity: 'A1' | 'A2'): Promise<void> {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.getByRole('button', { name: '1번', exact: true }).click();
  await page.getByRole('button', { name: '건너뛰기' }).click();
  await expect(page).toHaveURL(/#\/map$/);
  await page.goto(`/#/activity/g5s1u3.${activity}`);
  await expect(
    page.getByRole('heading', {
      name: activity === 'A1' ? '공변 슬라이더와 대응표' : '관계식 레이저로 보석 모으기',
    }),
  ).toBeVisible();
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
    for (const element of document.querySelectorAll('*')) {
      if (element.scrollTop > 0) element.scrollTop = 0;
    }
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

/** 학생 화면에 학년 표시가 없다. */
async function expectNoGrade(page: Page): Promise<void> {
  const text = (await page.locator('body').textContent()) ?? '';
  expect(text).not.toMatch(/[1-6]학년/);
}

/** 화면 글자에 숨은 규칙(공백 없이 비교)이 없다. */
async function expectNoHiddenRule(page: Page, forbidden: readonly string[]): Promise<void> {
  const text = ((await main(page).textContent()) ?? '').replace(/\s+/g, '');
  const html = ((await main(page).innerHTML()) ?? '').replace(/\s+/g, '');
  for (const rule of forbidden) {
    expect(text).not.toContain(rule);
    expect(html).not.toContain(rule);
  }
}

/** 오버레이가 본 캔버스 svg와 1px 안으로 겹친다. */
async function expectOverlayAligned(
  page: Page,
  overlay: string,
  canvasTestId: string,
): Promise<Locator> {
  const layer = main(page).locator(`[data-overlay="${overlay}"]`);
  await expect(layer).toBeVisible();
  const canvas = main(page).getByTestId(canvasTestId);
  await expect
    .poll(async () => {
      const a = await canvas.boundingBox();
      const b = await layer.locator('svg').first().boundingBox();
      if (!a || !b) return Number.POSITIVE_INFINITY;
      return Math.max(
        Math.abs(a.x - b.x),
        Math.abs(a.y - b.y),
        Math.abs(a.width - b.width),
        Math.abs(a.height - b.height),
      );
    })
    .toBeLessThanOrEqual(1);
  await expect(layer.locator('svg')).toHaveCount(1);
  return layer;
}

// ---------------------------------------------------------------- 조작 도우미

/** 슬라이더를 키보드로 움직인다(Home → ArrowRight n번). 지나간 ○가 표에 쌓인다. */
async function slideTo(page: Page, x: number): Promise<void> {
  const slider = main(page).getByRole('slider');
  await slider.focus();
  await page.keyboard.press('Home');
  for (let i = 1; i < x; i += 1) await page.keyboard.press('ArrowRight');
}

/** 식 칸을 눌러 식 키패드를 열고 지운 뒤 기호 단추로 쓴다. */
async function writeRuleByPad(page: Page, text: string, action: '규칙 시험하기' | '발사') {
  await main(page).getByTestId('rule-input').click();
  await pad(page, '모두 지우기').click();
  for (const ch of text) {
    if (ch === ' ') continue;
    await pad(page, ch).click();
  }
  await pad(page, action).click();
}

async function enterCell(page: Page, cell: string, digits: string): Promise<void> {
  await main(page).locator(`[data-cell="${cell}"]`).click();
  for (const digit of digits) await pad(page, digit).click();
}

async function clearActiveCell(page: Page, times: number): Promise<void> {
  for (let i = 0; i < times; i += 1) await pad(page, '지우기').click();
}

async function insertTrial(page: Page, digits: string): Promise<void> {
  await main(page).getByTestId('input-draft').click();
  for (const digit of digits) await pad(page, digit).click();
  await pad(page, '넣기').click();
}

// 과제별 통과 도우미
async function passA1T1(page: Page): Promise<void> {
  await slideTo(page, 5);
  await enterCell(page, '5.y', '20');
  await submit(page);
  await expectPassed(page);
}
async function passA1T2(page: Page): Promise<void> {
  await enterCell(page, '3.x', '8');
  await submit(page);
  await expectPassed(page);
}
async function passA1T3(page: Page): Promise<void> {
  await slideTo(page, 3);
  await writeRuleByPad(page, '□ = ○ × 4', '규칙 시험하기');
  await submit(page);
  await expectPassed(page);
}
async function passA2T1(page: Page): Promise<void> {
  await writeRuleByPad(page, '□ = ○ × 3', '발사');
  await submit(page);
  await expectPassed(page);
}
async function passA2T2(page: Page): Promise<void> {
  await writeRuleByPad(page, '□ = ○ × 3 + 1', '발사');
  await submit(page);
  await expectPassed(page);
}

// ---------------------------------------------------------------- A1

test('g5s1u3.A1 — 4과제 흐름: 슬라이더 포인터·키보드, 식 키패드, 키보드 식 입력, 과제마다 일반 ①', async ({
  page,
}) => {
  test.slow();
  await openActivity(page, 'A1');
  await expectNoGrade(page);
  await expectNoHiddenRule(page, ['○×4', '□=○×4', '○×2+1']);
  await expectContentPanelsReachable(page);
  await screenshot(page, 'g5s1u3-a1.png');

  // T1: 슬라이더를 포인터로 끌어 보고, 키보드로 5까지 → 빈칸에 틀린 수 → 일반 ① → 고쳐서 통과
  const knob = main(page).getByTestId('covary-knob');
  const knobBox = await knob.boundingBox();
  const track = await main(page).getByTestId('covary-slider').boundingBox();
  if (!knobBox || !track) throw new Error('슬라이더를 찾지 못했습니다.');
  await page.mouse.move(knobBox.x + knobBox.width / 2, knobBox.y + knobBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(track.x + track.width - 4, knobBox.y + knobBox.height / 2, { steps: 8 });
  await page.mouse.up();
  await expect(main(page).getByTestId('scene-readout')).toContainText('○ = 10');
  await slideTo(page, 5);
  await expect(main(page).getByTestId('scene-readout')).toHaveText('○ = 5');
  // 빈칸 줄: 장면 글자에 □ 값이 없다.
  await expectNoHiddenRule(page, ['□=20']);
  await enterCell(page, '5.y', '24');
  await submit(page);
  await expectFailedWithHint(page, '그림과 표가 어떻게 바뀌나요?', 1);
  await clearActiveCell(page, 2);
  await enterCell(page, '5.y', '20');
  await submit(page);
  await expectPassed(page);

  // T2: 대응표(빈 ○ 칸)
  await expect(main(page).getByTestId('relation-canvas')).toBeVisible();
  await enterCell(page, '3.x', '7');
  await submit(page);
  await expectFailedWithHint(page, '의자 수와 다리 수는 어떤 관계인가요?', 1);
  await clearActiveCell(page, 1);
  await enterCell(page, '3.x', '8');
  await submit(page);
  await expectPassed(page);

  // T3: 식을 쓰지 않고 / 슬라이더를 3쌍 지나기 전에는 통과하지 않는다. 다른 식은 일반 ①.
  await slideTo(page, 3);
  await writeRuleByPad(page, '□ = ○ × 3', '규칙 시험하기');
  await submit(page);
  await expectFailedWithHint(page, '의자 수와 다리 수 사이에 늘 같은 관계가 있나요?', 1);
  // 키보드 식 입력 한 번
  await main(page).getByTestId('rule-input').focus();
  for (let i = 0; i < 12; i += 1) await page.keyboard.press('Backspace');
  await page.keyboard.type('b=o*4');
  await page.keyboard.press('Enter');
  await expect(main(page).getByTestId('rule-input')).toHaveText('□ = ○ × 4');
  await submit(page);
  await expectPassed(page);

  // T4: 삼각형과 이쑤시개
  await expect(main(page).getByTestId('scene-readout')).toBeVisible();
  await slideTo(page, 3);
  await writeRuleByPad(page, '□ = ○ × 2', '규칙 시험하기');
  await submit(page);
  await expectFailedWithHint(page, '삼각형 수와 이쑤시개 수 사이에 늘 같은 관계가 있나요?', 1);
  await writeRuleByPad(page, '□ = ○ × 2 + 1', '규칙 시험하기');
  await submit(page);
  await expectPassed(page, true);
});

test('g5s1u3.A1.T3 — □ = □ + 4: RECURSIVE-ONLY ① → ② long-chain 정렬', async ({ page }) => {
  test.slow();
  await openActivity(page, 'A1');
  await passA1T1(page);
  await passA1T2(page);
  await slideTo(page, 3);
  await writeRuleByPad(page, '□ = □ + 4', '규칙 시험하기');
  await submit(page);
  await expectFailedWithHint(page, '의자가 10개일 때 다리 수를 바로 알 수 있는 방법은?', 1);
  await submit(page);
  await expectFailedWithHint(page, '계속 더해 가는 모습', 2);
  const layer = await expectOverlayAligned(page, 'long-chain', 'relation-canvas');
  await expect(layer.locator('[data-testid="long-chain-step"]')).toHaveCount(3);
  await expectNoHiddenRule(page, ['○×4']);
  await writeRuleByPad(page, '□ = ○ × 4', '규칙 시험하기');
  await submit(page);
  await expectPassed(page);
});

test('g5s1u3.A1.T3 — □ = ○ + 3: ONE-PAIR ① → ② fail-cols 정렬', async ({ page }) => {
  test.slow();
  await openActivity(page, 'A1');
  await passA1T1(page);
  await passA1T2(page);
  await slideTo(page, 3);
  await writeRuleByPad(page, '□ = ○ + 3', '규칙 시험하기');
  await submit(page);
  await expectFailedWithHint(page, '다른 줄에서도 맞을까?', 1);
  await submit(page);
  await expectFailedWithHint(page, '빨간 테두리', 2);
  const layer = await expectOverlayAligned(page, 'fail-cols', 'relation-canvas');
  await expect(layer.locator('[data-testid="fail-col"]')).toHaveCount(2);
  await writeRuleByPad(page, '□ = ○ × 4', '규칙 시험하기');
  await submit(page);
  await expectPassed(page);
});

test('g5s1u3.A1.T4 — ○ = □ × 2 + 1(바꿔 씀): SWAP ① → ② swap-check 정렬', async ({ page }) => {
  test.slow();
  await openActivity(page, 'A1');
  await passA1T1(page);
  await passA1T2(page);
  await passA1T3(page);
  await slideTo(page, 3);
  await writeRuleByPad(page, '○ = □ × 2 + 1', '규칙 시험하기');
  await submit(page);
  await expectFailedWithHint(page, '○가 삼각형 수였지?', 1);
  await submit(page);
  await expectFailedWithHint(page, '나란히 놓았어요', 2);
  await expectOverlayAligned(page, 'swap-check', 'relation-canvas');
});

// ---------------------------------------------------------------- A2

test('g5s1u3.A2 — 4과제 흐름: 과제마다 일반 ①, 블랙박스 3번, 다른 모양의 식', async ({ page }) => {
  test.slow();
  await openActivity(page, 'A2');
  await expectNoGrade(page);
  await expectNoHiddenRule(page, ['○×3']);
  await expectContentPanelsReachable(page);
  await screenshot(page, 'g5s1u3-a2.png');

  // T1: 격자. 틀린 식 → 일반 ① → 통과
  await writeRuleByPad(page, '□ = ○ × 2', '발사');
  await submit(page);
  await expectFailedWithHint(page, '모든 보석에서 ○와 □는 어떤 관계일까요?', 1);
  await passA2T1(page);

  // T2: 보석 4개
  await writeRuleByPad(page, '□ = ○ × 3', '발사');
  await submit(page);
  await expectFailedWithHint(page, '하나씩 확인해 볼까요?', 1);
  await passA2T2(page);

  // T3: 블랙박스 — 넣기는 3번까지
  await insertTrial(page, '1');
  await insertTrial(page, '2');
  await writeRuleByPad(page, '□ = ○ × 2', '규칙 시험하기');
  await submit(page);
  await expectFailedWithHint(page, '넣는 수를 다르게 하면', 1);
  await insertTrial(page, '5');
  await expect(main(page).getByTestId('trial-count')).toHaveText('넣은 횟수 3 / 3');
  await expect(pad(page, '넣기')).toBeDisabled();
  await expectNoHiddenRule(page, ['○×2+3']);
  await writeRuleByPad(page, '□ = ○ × 2 + 3', '규칙 시험하기');
  await submit(page);
  await expectPassed(page);

  // T4: 이미 찾은 식은 통과하지 않고, 모양이 다른 식은 통과한다.
  await writeRuleByPad(page, '□ = ○ × 3 + 1', '발사');
  await submit(page);
  await expectFailedWithHint(page, '양쪽을 바꾸어 써 볼 수 있을까요?', 1);
  await writeRuleByPad(page, '□ − 1 = ○ × 3', '발사');
  await submit(page);
  await expectPassed(page, true);
});

test('g5s1u3.A2.T1 — □ = ○ + 2: ONE-PAIR ① → ② laser-miss 정렬', async ({ page }) => {
  test.slow();
  await openActivity(page, 'A2');
  await writeRuleByPad(page, '□ = ○ + 2', '발사');
  await submit(page);
  await expectFailedWithHint(page, '다른 보석에서도 맞을까?', 1);
  await submit(page);
  await expectFailedWithHint(page, '나란히 써 놓았어요', 2);
  const layer = await expectOverlayAligned(page, 'laser-miss', 'shooter-canvas');
  await expect(layer.locator('[data-testid="laser-miss-hit"]')).toHaveCount(1);
  await expect(layer.locator('[data-testid="laser-miss-gap"]')).toHaveCount(2);
  await passA2T1(page);
});

test('g5s1u3.A2.T1 — ○ = □ × 3: SWAP ① → ② swap-check 정렬', async ({ page }) => {
  test.slow();
  await openActivity(page, 'A2');
  await writeRuleByPad(page, '○ = □ × 3', '발사');
  await submit(page);
  await expectFailedWithHint(page, '○는 보석의 가로 값이었지?', 1);
  await submit(page);
  await expectFailedWithHint(page, '나란히 놓았어요', 2);
  const layer = await expectOverlayAligned(page, 'swap-check', 'shooter-canvas');
  await expect(layer.locator('[data-testid="swap-check-mine"]')).toBeVisible();
  await expect(layer.locator('[data-testid="swap-check-actual"]')).toBeVisible();
});

test('g5s1u3.A2.T3 — 블랙박스 오개념도 같은 규칙으로 걸린다(ONE-PAIR ① → fail-cols)', async ({
  page,
}) => {
  test.slow();
  await openActivity(page, 'A2');
  await passA2T1(page);
  await passA2T2(page);
  await insertTrial(page, '1');
  await insertTrial(page, '2');
  await writeRuleByPad(page, '□ = ○ + 4', '규칙 시험하기');
  await submit(page);
  await expectFailedWithHint(page, '다른 줄에서도 맞을까?', 1);
  await submit(page);
  await expectFailedWithHint(page, '빨간 테두리', 2);
  await expectOverlayAligned(page, 'fail-cols', 'relation-canvas');
});

// ---------------------------------------------------------------- 오프라인

test('오프라인에서도 g5s1u3.A1 활동이 열린다', async ({ page, context }) => {
  await page.goto(PREVIEW_URL);
  await page.getByRole('button', { name: '1번', exact: true }).click();
  await page.getByRole('button', { name: '건너뛰기' }).click();
  await expect(page).toHaveURL(/#\/map$/);
  await page.goto(`${PREVIEW_URL}/#/activity/g5s1u3.A1`);
  await expect(page.getByRole('heading', { name: '공변 슬라이더와 대응표' })).toBeVisible();

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
  await expect(page.getByRole('heading', { name: '공변 슬라이더와 대응표' })).toBeVisible();
  await expect(page.getByRole('button', { name: '확인하기' })).toBeVisible();
});
