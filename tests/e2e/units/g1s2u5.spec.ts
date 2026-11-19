import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { PREVIEW_URL } from '../../../playwright.config';
import { expectContentPanelsReachable } from '../panel-layout';

/**
 * T171 g1s2u5 「규칙 찾기」 단원 E2E.
 * - A1(모양-소리-춤 무늬 4과제)·A2(규칙 암호 전송기 4과제) 정답 통과, 과제마다 대표 오답 → 일반 ①
 * - 오개념 MC-PATTERN-LAST-ONLY·CORE·TRANSLATE ①·② 오버레이(replay-break, core-boxes, mapping-card)
 *   가 실제로 그려지고 본 캔버스와 1px 안에서 맞는다.
 * - 팔레트 탭·끌어 놓기 한 번, 키보드 숫자 입력 한 번
 * - 학생 화면에 학년·정답 노출이 없다(sound-only 칸에 토큰 이름·data-token 없음)
 * - 터치 타깃 64px, 첫 화면 스냅샷, 오프라인
 */

test.describe.configure({ timeout: 240_000 });
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
  readFileSync(new URL('../../../data/content/g1s2u5.json', import.meta.url), 'utf-8'),
) as UnitContent;

test('콘텐츠 설정이 명세를 따른다(A1 4과제, A2 4과제, 학년·정답 노출 없음)', () => {
  expect(content.activities.map((a) => a.id)).toEqual(['g1s2u5.A1', 'g1s2u5.A2']);
  const a1 = content.activities[0]?.tasks ?? [];
  const a2 = content.activities[1]?.tasks ?? [];
  expect(a1.map((t) => t.id)).toEqual([
    'g1s2u5.A1.T1',
    'g1s2u5.A1.T2',
    'g1s2u5.A1.T3',
    'g1s2u5.A1.T4',
  ]);
  expect(a2.map((t) => t.id)).toEqual([
    'g1s2u5.A2.T1',
    'g1s2u5.A2.T2',
    'g1s2u5.A2.T3',
    'g1s2u5.A2.T4',
  ]);
  expect(a1[2]?.config['givenDisplay']).toBe('sound-only');
  expect(a1[3]?.config['given']).toEqual([]);
  expect(a2[0]?.config['variant']).toBe('translate');
  expect(a2[2]?.config['mode']).toBe('hundred-chart');
  for (const task of [...a1, ...a2]) {
    const texts = [task.prompt, ...task.hints.map((hint) => hint.say ?? '')];
    for (const text of texts) {
      expect(text).not.toMatch(/[1-6]학년/);
      // 정답 모양·정답 수를 쓰지 않는다.
      expect(text).not.toMatch(/[○△□]|세모 다음|동그라미 다음|네모 다음/);
    }
  }
  // 소리만 듣는 과제는 주어진 무늬를 발문·힌트에 쓰지 않는다.
  const t3 = a1[2];
  for (const text of [t3?.prompt ?? '', ...(t3?.hints ?? []).map((hint) => hint.say ?? '')]) {
    expect(text).not.toMatch(/동그라미|세모|네모|도-도-솔/);
  }
  // 수 규칙 과제의 힌트·발문에 정답 수가 없다.
  const t4 = a2[3];
  for (const text of [t4?.prompt ?? '', ...(t4?.hints ?? []).map((hint) => hint.say ?? '')]) {
    expect(text).not.toMatch(/20|25/);
  }
});

function slot(page: Page, name: string): Locator {
  return page.getByTestId(`runner-slot-${name}`);
}

function main(page: Page): Locator {
  return slot(page, 'main');
}

function palette(page: Page): Locator {
  return main(page).getByTestId('pattern-palette');
}

function card(page: Page, name: string): Locator {
  return palette(page).getByRole('button', { name, exact: true });
}

async function openActivity(page: Page, activity: 'A1' | 'A2'): Promise<void> {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.getByRole('button', { name: '1번', exact: true }).click();
  await page.getByRole('button', { name: '건너뛰기' }).click();
  await expect(page).toHaveURL(/#\/map$/);
  await page.goto(`/#/activity/g1s2u5.${activity}`);
  await expect(
    page.getByRole('heading', {
      name: activity === 'A1' ? '모양-소리-춤 무늬' : '규칙 암호 전송기',
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

/** 오버레이가 본 캔버스 svg와 1px 안으로 겹치고 무언가를 그렸는지 확인한다. */
async function expectOverlayAligned(page: Page, overlay: string, canvasTestId: string) {
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

async function place(page: Page, names: readonly string[]): Promise<void> {
  for (const name of names) await card(page, name).click();
}

async function clearAll(page: Page): Promise<void> {
  await main(page).getByRole('button', { name: '모두 지우기' }).click();
}

// 과제별 통과 도우미
async function passA1T1(page: Page): Promise<void> {
  await place(page, ['세모', '동그라미', '세모']);
  await submit(page);
  await expectPassed(page);
}
async function passA1T2(page: Page): Promise<void> {
  await place(page, ['동그라미', '동그라미', '세모']);
  await submit(page);
  await expectPassed(page);
}
async function passA1T3(page: Page): Promise<void> {
  await place(page, ['동그라미', '동그라미', '네모', '동그라미', '동그라미', '네모']);
  await submit(page);
  await expectPassed(page);
}
async function passA1T4(page: Page): Promise<void> {
  await place(page, [
    '동그라미',
    '세모',
    '동그라미',
    '세모',
    '동그라미',
    '세모',
    '동그라미',
    '세모',
  ]);
  await submit(page);
  await expectPassed(page, true);
}
async function passA2T1(page: Page): Promise<void> {
  await place(page, ['1', '2', '2', '1', '2', '2', '1', '2', '2']);
  await submit(page);
  await expectPassed(page);
}
async function passA2T2(page: Page): Promise<void> {
  // 숫자 암호 3 1 3 1 → 어떤 일대일 대응이든 통과
  await place(page, ['세모', '동그라미', '세모', '동그라미']);
  await submit(page);
  await expectPassed(page);
}
async function passA2T3(page: Page): Promise<void> {
  for (let cell = 8; cell <= 30; cell += 2)
    await main(page).locator(`[data-cell="${cell}"]`).click();
  await submit(page);
  await expectPassed(page);
}

// ---------------------------------------------------------------- A1

test('g1s2u5.A1 — 4과제 흐름: LAST-ONLY·CORE ①② 오버레이, 끌어 놓기, 소리만 듣기', async ({
  page,
}) => {
  test.slow();
  await openActivity(page, 'A1');
  await expect(main(page).getByTestId('pattern-canvas')).toBeVisible();
  await expectNoGrade(page);
  await screenshot(page, 'g1s2u5-a1.png');

  // T1: 마지막 것만 따라 놓음(LAST-ONLY) → ① → ② replay-break(정렬) → 고쳐서 통과
  await place(page, ['동그라미', '동그라미', '동그라미']);
  await submit(page);
  await expectFailedWithHint(page, '처음부터 다시 소리 내어 읽어 볼까?', 1);
  await submit(page);
  await expectFailedWithHint(page, '리듬이 바뀌는 곳이 어디인지', 2);
  const replay = await expectOverlayAligned(page, 'replay-break', 'pattern-canvas');
  await expect(replay).toContainText('여기서 리듬이 바뀌어요');
  await clearAll(page);
  // 끌어 놓기 한 번: 세모 카드를 첫 번째 빈칸으로
  const dragCard = await card(page, '세모').boundingBox();
  const target = await main(page).getByTestId('pattern-slot-0').boundingBox();
  if (!dragCard || !target) throw new Error('상자를 찾지 못했습니다.');
  await page.mouse.move(dragCard.x + dragCard.width / 2, dragCard.y + dragCard.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    dragCard.x + dragCard.width / 2 + 20,
    dragCard.y + dragCard.height / 2 + 20,
    {
      steps: 3,
    },
  );
  await page.mouse.move(target.x + target.width / 2, target.y + target.height / 2, { steps: 8 });
  await page.mouse.up();
  await expect(main(page).getByTestId('pattern-slot-0')).toHaveAttribute('data-token', 'triangle');
  await place(page, ['동그라미', '세모']);
  await submit(page);
  await expectPassed(page);

  // T2: 단위를 잘못 잡음(CORE) → ① → ② core-boxes(정렬, ✕ 표시) → 고쳐서 통과
  await place(page, ['동그라미', '세모', '동그라미']);
  await submit(page);
  await expectFailedWithHint(page, '어디까지가 한 번이고, 어디서 다시 시작할까?', 1);
  await submit(page);
  await expectFailedWithHint(page, '점선 상자로 묶어 봤어요', 2);
  const boxes = await expectOverlayAligned(page, 'core-boxes', 'pattern-canvas');
  await expect(boxes.locator('[data-testid="core-boxes-x"]')).toHaveCount(2);
  await clearAll(page);
  await place(page, ['동그라미', '동그라미', '세모']);
  await submit(page);
  await expectPassed(page);

  // T3: 소리만 듣기. 주어진 칸에 토큰이 없다.
  await expect(main(page).locator('[data-testid^="pattern-given-"]')).toHaveCount(6);
  await expect(main(page).locator('[data-testid^="pattern-given-"][data-token]')).toHaveCount(0);
  const html = await main(page)
    .getByTestId('pattern-track')
    .locator('[data-testid^="pattern-given-"]')
    .evaluateAll((nodes) => nodes.map((node) => node.outerHTML).join(''));
  expect(html).not.toMatch(/circle|square|triangle|동그라미|네모|세모/);
  await expectNoGrade(page);
  await place(page, ['동그라미', '동그라미', '네모', '동그라미', '동그라미', '네모']);
  await submit(page);
  await expectPassed(page);

  // T4: 내 규칙 만들기
  await expect(main(page).locator('[data-testid^="pattern-given-"]')).toHaveCount(0);
  await place(page, [
    '동그라미',
    '세모',
    '동그라미',
    '세모',
    '동그라미',
    '세모',
    '동그라미',
    '세모',
  ]);
  await submit(page);
  await expectPassed(page, true);
});

test('g1s2u5.A1.T1·T2 — 마지막·단위 오개념이 아닌 오답은 일반 ①이다', async ({ page }) => {
  test.slow();
  await openActivity(page, 'A1');
  await place(page, ['세모', '세모', '세모']);
  await submit(page);
  await expectFailedWithHint(page, '되풀이되는 부분이 어디인지 찾아볼까?', 1);
  await submit(page);
  await expectFailedWithHint(page, '같은 소리가 다시 나오는 곳은 어디인가요?', 2);
  await clearAll(page);
  await passA1T1(page);
  await place(page, ['네모', '네모', '네모']);
  await submit(page);
  await expectFailedWithHint(page, '되풀이되는 부분이 어디인지 찾아볼까?', 1);
  await clearAll(page);
  await passA1T2(page);
});

test('g1s2u5.A1.T3·T4 — 빈칸이 모자라거나 단위가 한 가지면 일반 ①이다', async ({ page }) => {
  test.slow();
  await openActivity(page, 'A1');
  await passA1T1(page);
  await passA1T2(page);
  // T3: 단위를 한 가지 모양으로 놓음
  await place(page, ['동그라미', '동그라미', '동그라미', '동그라미', '동그라미', '동그라미']);
  await submit(page);
  await expectFailedWithHint(page, '몇 번째 소리마다 되풀이되는지 들어 봐요.', 1);
  await clearAll(page);
  await passA1T3(page);
  // T4: 한 모양만 되풀이
  await place(
    page,
    Array.from({ length: 8 }, () => '동그라미'),
  );
  await submit(page);
  await expectFailedWithHint(page, '두 가지 이상의 모양이 같은 순서로 되풀이되게 놓아 볼까?', 1);
  await clearAll(page);
  await passA1T4(page);
});

// ---------------------------------------------------------------- A2

test('g1s2u5.A2 — 4과제 흐름: TRANSLATE ①② mapping-card, 키보드, 수 규칙', async ({ page }) => {
  test.slow();
  await openActivity(page, 'A2');
  await expectNoGrade(page);
  await screenshot(page, 'g1s2u5-a2.png');

  // T1: 사과에 1과 3을 붙임(TRANSLATE) → ① → ② mapping-card(정렬) → 키보드 숫자로 고쳐 통과
  await place(page, ['1', '2', '2', '1', '3', '2', '1', '2', '2']);
  await submit(page);
  await expectFailedWithHint(page, '사과는 항상 어떤 숫자였지?', 1);
  await submit(page);
  await expectFailedWithHint(page, '같은 그림이 늘 같은 짝이었나요?', 2);
  const mapping = await expectOverlayAligned(page, 'mapping-card', 'pattern-canvas');
  await expect(mapping.locator('[data-testid="mapping-card-item"]')).toHaveCount(2);
  await clearAll(page);
  // 키보드: 숫자 1~3은 팔레트 번째 토큰
  await main(page).getByTestId('pattern-canvas').focus();
  for (const key of ['1', '2', '2', '1', '2', '2', '1', '2', '2']) await page.keyboard.press(key);
  await main(page).getByRole('button', { name: '보내기' }).click();
  await expect(main(page).getByTestId('pattern-restored-8')).toBeVisible();
  await expect(main(page).locator('[data-testid^="pattern-restored-x-"]')).toHaveCount(0);
  await submit(page);
  await expectPassed(page);

  // T2: 같은 수에 다른 모양(TRANSLATE) → ① → ② mapping-card(정렬) → 고쳐서 통과
  await place(page, ['동그라미', '세모', '네모', '세모']);
  await submit(page);
  await expectFailedWithHint(page, '같은 수는 늘 같은 모양으로 바꿨나요?', 1);
  await submit(page);
  await expectFailedWithHint(page, '같은 그림이 늘 같은 짝이었나요?', 2);
  await expectOverlayAligned(page, 'mapping-card', 'pattern-canvas');
  await clearAll(page);
  await place(page, ['세모', '동그라미', '세모', '동그라미']);
  await submit(page);
  await expectPassed(page);

  // T3: 수 배열표 칠하기. prepainted 2·4·6은 지워지지 않는다.
  await expect(main(page).locator('[data-cell="2"]')).toHaveAttribute('data-painted', 'true');
  await main(page).locator('[data-cell="2"]').click();
  await expect(main(page).locator('[data-cell="2"]')).toHaveAttribute('data-painted', 'true');
  for (let cell = 8; cell <= 30; cell += 2)
    await main(page).locator(`[data-cell="${cell}"]`).click();
  await submit(page);
  await expectPassed(page);

  // T4: 5, 10, 15, □, □
  await expect(main(page).locator('[data-testid^="pattern-given-"]')).toHaveCount(3);
  await place(page, ['20', '25']);
  await submit(page);
  await expectPassed(page, true);
});

test('g1s2u5.A2.T1·T2 — 빈칸이 남은 암호는 일반 ①이다', async ({ page }) => {
  test.slow();
  await openActivity(page, 'A2');
  await place(page, ['1', '2']);
  await submit(page);
  await expectFailedWithHint(page, '위에서부터 차례로 바꿔 볼까?', 1);
  await submit(page);
  await expectFailedWithHint(page, '되돌린 무늬가 처음 무늬와 같은지', 2);
  await clearAll(page);
  await passA2T1(page);
  await place(page, ['세모']);
  await submit(page);
  await expectFailedWithHint(page, '숫자마다 모양을 하나씩 정해서', 1);
  await clearAll(page);
  await passA2T2(page);
});

test('g1s2u5.A2.T3·T4 — 틀리게 칠하거나 채우면 일반 ①이다', async ({ page }) => {
  test.slow();
  await openActivity(page, 'A2');
  await passA2T1(page);
  await passA2T2(page);
  await main(page).locator('[data-cell="9"]').click();
  await submit(page);
  await expectFailedWithHint(page, '칠해진 칸은 몇 칸씩 건너뛰고 있나요?', 1);
  await main(page).locator('[data-cell="9"]').click();
  await passA2T3(page);
  await place(page, ['16', '20']);
  await submit(page);
  await expectFailedWithHint(page, '5에서 10, 10에서 15로 얼마씩 커졌나요?', 1);
  await clearAll(page);
  await place(page, ['20', '25']);
  await submit(page);
  await expectPassed(page, true);
});

// ---------------------------------------------------------------- 크기·오프라인

async function expectMin(locator: Locator, min: number, label: string): Promise<void> {
  const box = await locator.boundingBox();
  if (!box) throw new Error(`${label}: 상자를 찾지 못했습니다.`);
  console.log('T171', label, Math.round(box.width), Math.round(box.height));
  expect(Math.min(box.width, box.height), label).toBeGreaterThanOrEqual(min - 0.5);
}

test('저학년 64px 터치 타깃: 빈칸·팔레트·배열표 칸이 64px 이상이다', async ({ page }) => {
  await openActivity(page, 'A1');
  await expectMin(main(page).getByTestId('pattern-slot-0'), 64, 'A1 빈칸');
  await expectMin(card(page, '세모'), 64, 'A1 팔레트');
  await expectContentPanelsReachable(page);

  await openActivity(page, 'A2');
  await expectMin(card(page, '1'), 64, 'A2 팔레트(암호)');
  await passA2T1(page);
  await expect(main(page).getByTestId('pattern-slot-0')).toBeVisible();
  await expectMin(main(page).getByTestId('pattern-slot-0'), 64, 'A2.T2 빈칸');
  await passA2T2(page);
  await expectMin(main(page).locator('[data-cell="10"]'), 64, 'A2.T3 배열표 칸');
});

test('오프라인에서도 g1s2u5.A1 활동이 열린다', async ({ page, context }) => {
  await page.goto(PREVIEW_URL);
  await page.getByRole('button', { name: '1번', exact: true }).click();
  await page.getByRole('button', { name: '건너뛰기' }).click();
  await expect(page).toHaveURL(/#\/map$/);
  await page.goto(`${PREVIEW_URL}/#/activity/g1s2u5.A1`);
  await expect(page.getByRole('heading', { name: '모양-소리-춤 무늬' })).toBeVisible();

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
  await expect(page.getByRole('heading', { name: '모양-소리-춤 무늬' })).toBeVisible();
  await expect(page.getByRole('button', { name: '확인하기' })).toBeVisible();
});
