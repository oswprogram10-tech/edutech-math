import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { PREVIEW_URL } from '../../../playwright.config';

/**
 * T192 g6s1u4 「비와 비율」 11과제 단원 E2E.
 * - A1(E20 `mix`·`percent` 6과제)·A2(E20 `resize`·`rate` + 응답만 5과제) 흐름과 오개념 4코드 감지(3뷰포트)
 * - 오개념 ② 오버레이 `side-by-side`(A1.T1)·`tens-brackets`(A1.T5)·`growth-arrows`(A2.T1)·`footprints`(A2.T3) 1px 정렬
 * - 과제마다 대표 오답은 일반 힌트 ①, 키보드만으로 A1.T1, 오프라인 A1
 * - 첫 화면 스냅샷(A1.T1, A2.T3) + 학생 화면에 답·학년이 보이지 않는다.
 */

test.describe.configure({ timeout: 300_000 });
test.use({ actionTimeout: 20_000 });

interface UnitTask {
  readonly id: string;
  readonly showEngine?: boolean;
  readonly config: Record<string, unknown>;
}
interface UnitContent {
  readonly activities: readonly { readonly id: string; readonly tasks: readonly UnitTask[] }[];
}

const content = JSON.parse(
  readFileSync(new URL('../../../data/content/g6s1u4.json', import.meta.url), 'utf-8'),
) as UnitContent;

test('콘텐츠 설정이 명세를 따른다(응답만 있는 과제는 엔진 화면을 숨긴다)', () => {
  const task = (id: string): UnitTask => {
    for (const activity of content.activities) {
      const found = activity.tasks.find((t) => t.id === id);
      if (found) return found;
    }
    throw new Error(`과제 ${id}를 찾지 못했다.`);
  };
  expect(task('g6s1u4.A1.T1').config['reference']).toEqual({ milk: 4, syrup: 1 });
  expect(task('g6s1u4.A1.T2').config['reference']).toBeNull();
  expect(task('g6s1u4.A2.T1').config['base']).toEqual({ w: 4, h: 3 });
  expect(task('g6s1u4.A2.T3').config['predictFirst']).toBe(true);
  expect(task('g6s1u4.A2.T5').showEngine).toBe(false);
  expect(content.activities.map((a) => a.tasks.length)).toEqual([6, 5]);
});

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

/** 엔진 조작 단추(판 안). */
function act(page: Page, name: string): Locator {
  return slot(page, 'main').getByRole('button', { name, exact: true });
}

async function press(page: Page, name: string, times = 1): Promise<void> {
  for (let i = 0; i < times; i += 1) await act(page, name).click();
}

async function choose(page: Page, id: string, label: string): Promise<void> {
  await field(page, id).getByRole('button', { name: label, exact: true }).click();
}

/** 수 칸의 한 부분을 비우고 숫자(또는 소수점)를 넣는다(칸은 최대 9자리). */
async function typePart(
  page: Page,
  id: string,
  part: 'whole' | 'numerator' | 'denominator' | 'decimal',
  keys: string,
): Promise<void> {
  await field(page, id).locator(`[data-part="${part}"]`).click();
  for (let i = 0; i < 9; i += 1) {
    await page.keyboard.press('Backspace');
  }
  for (const key of keys) {
    await page.keyboard.press(key);
  }
}

async function typeFraction(page: Page, id: string, n: string, d: string): Promise<void> {
  await typePart(page, id, 'numerator', n);
  await typePart(page, id, 'denominator', d);
}

async function submit(page: Page): Promise<void> {
  await page.getByRole('button', { name: '확인하기' }).click();
}

async function expectFailedWithHint(
  page: Page,
  text: string | null,
  level: 1 | 2 | 3 = 1,
): Promise<void> {
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByTestId('hint')).toHaveAttribute('data-hint-level', String(level));
  if (text !== null) {
    await expect(page.getByTestId('hint-text')).toContainText(text);
  }
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
    document.querySelectorAll('[data-testid="ratio-controls"]').forEach((el) => el.scrollTo(0, 0));
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

async function expectOverlayAligned(panel: Locator, overlayName: string): Promise<void> {
  const overlay = panel.locator(`[data-overlay="${overlayName}"]`);
  await expect(overlay).toBeVisible();
  const canvas = panel.getByTestId('ratio-canvas');
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
  await expect(overlay.locator('svg')).toHaveCount(1);
}

/** 첫 화면: 판과 [확인하기]에 닿을 수 있고(필요하면 스크롤), 판이 잘리지 않는다. */
async function expectReachable(
  page: Page,
  targets: readonly Locator[],
  ratio = 0.99,
): Promise<void> {
  for (const target of targets) {
    await target.scrollIntoViewIfNeeded();
    await expect(target).toBeInViewport({ ratio });
  }
  const confirm = page.getByRole('button', { name: '확인하기' });
  await confirm.scrollIntoViewIfNeeded();
  await expect(confirm).toBeInViewport({ ratio: 1 });
}

/** 학생 화면에 정답·학년이 보이지 않는지 확인한다. */
async function expectNoLeak(page: Page, forbidden: readonly RegExp[]): Promise<void> {
  const text = (await page.locator('body').textContent()) ?? '';
  expect(text, '학생 화면에 학년 표시가 없어야 한다').not.toMatch(/\d\s*학년/);
  for (const pattern of forbidden) {
    expect(text, `학생 화면에 ${pattern}가 없어야 한다`).not.toMatch(pattern);
  }
}

// ---------------------------------------------------------------- 과제별 통과 도우미

async function passA1T1(page: Page): Promise<void> {
  await press(page, '우유 넣기', 4);
  await press(page, '시럽 넣기');
  await press(page, '모두 ×2');
  await submit(page);
  await expectPassed(page);
}

async function passA1T2(page: Page): Promise<void> {
  await choose(page, 'darker', '가');
  await submit(page);
  await expectPassed(page);
}

async function passA1T3(page: Page): Promise<void> {
  await choose(page, 'base', '나');
  await submit(page);
  await expectPassed(page);
}

/** 분수·소수·백분율 칸을 채운다. 분수는 2/8처럼 약분하지 않은 표기도 같은 값이면 맞는다. */
async function fillA1T4(page: Page, n: string, d: string, dec: string, pct: string): Promise<void> {
  await typeFraction(page, 'frac', n, d);
  await typePart(page, 'dec', 'decimal', dec);
  await typePart(page, 'pct', 'whole', pct);
}

async function passA1T4(page: Page): Promise<void> {
  await fillA1T4(page, '2', '8', '0.25', '25');
  await submit(page);
  await expectPassed(page);
}

/** 100칸 판의 앞에서부터 count칸 칠한다(키보드: 방향키로 커서를 옮기고 Enter). */
async function fillCells(page: Page, count: number): Promise<void> {
  const cells = page.getByTestId('percent-cells');
  await cells.focus();
  const from = Number(await cells.getAttribute('data-cursor'));
  const to = count - 1;
  const rows = Math.floor(to / 10) - Math.floor(from / 10);
  const cols = (to % 10) - (from % 10);
  for (let i = 0; i < Math.abs(rows); i += 1) {
    await page.keyboard.press(rows > 0 ? 'ArrowDown' : 'ArrowUp');
  }
  for (let i = 0; i < Math.abs(cols); i += 1) {
    await page.keyboard.press(cols > 0 ? 'ArrowRight' : 'ArrowLeft');
  }
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('percent-count')).toHaveText(`칠한 칸 ${count} / 100`);
}

async function passA1T5(page: Page): Promise<void> {
  await fillCells(page, 25);
  await submit(page);
  await expectPassed(page);
}

async function passA2T1(page: Page): Promise<void> {
  await press(page, '가로·세로 둘 다 ×2');
  await press(page, '이 크기 담기');
  await press(page, '가로·세로 둘 다 ×2');
  await press(page, '이 크기 담기');
  await press(page, '처음으로');
  await press(page, '가로·세로 둘 다 ×3');
  await press(page, '이 크기 담기');
  await submit(page);
  await expectPassed(page);
}

async function passA2T2(page: Page): Promise<void> {
  await choose(page, 'why', '가');
  await submit(page);
  await expectPassed(page);
}

/**
 * 예측하고 경주를 본 뒤 더 빠른 쪽을 고른다.
 * 예측·경주는 단축키(1·2, G)로 한다. 응답 칸이 옆에 있는 반쪽 판에서는 크롬북에서 조작 칸이 32px로 눌려
 * 단추를 마우스로 누를 수 없기 때문이다(메모의 요청 참고).
 */
async function raceAndChoose(page: Page, predict: '토끼' | '거북', pick: string): Promise<void> {
  await act(page, predict).focus();
  await page.keyboard.press(predict === '토끼' ? 'Digit1' : 'Digit2');
  await expect(page.getByTestId('rate-prediction')).toHaveText(`내 예측: ${predict}`);
  await page.keyboard.press('KeyG');
  await expect(page.getByTestId('ratio-canvas')).toHaveAttribute('data-ran', 'true');
  await expect(page.getByTestId('ratio-canvas')).toHaveAttribute('data-playing', 'false');
  await choose(page, 'fast', pick);
}

async function fillTurtle(page: Page, distance: string, time: string): Promise<void> {
  await slot(page, 'main').getByLabel('거북 거리(m)').fill(distance);
  await slot(page, 'main').getByLabel('거북 시간(초)').fill(time);
}

async function passA2T4(page: Page): Promise<void> {
  await fillTurtle(page, '120', '20');
  await submit(page);
  await expectPassed(page);
}

// ---------------------------------------------------------------- A1

test('g6s1u4.A1 — 초코 우유 6과제 흐름·오개념 ①②·첫 화면', async ({ page }, testInfo) => {
  test.slow();
  void testInfo;
  await openActivity(page, 'g6s1u4.A1', '초코 우유 배합 실험');
  const main = slot(page, 'main');

  // T1 첫 화면 + 스냅샷, 답(시럽 2)이 없다
  await expect(main.getByTestId('ratio-canvas')).toBeVisible();
  await expectReachable(page, [main.getByTestId('ratio-canvas')]);
  await expectNoLeak(page, [/시럽\s*2/]);
  await screenshot(page, 'g6s1u4-a1.png');

  // T1: 우유 5·시럽 2(같은 수를 더함) → MC-RATIO-ADDITIVE ① → 다시 → ② side-by-side → ×2 통과
  await press(page, '우유 넣기', 5);
  await press(page, '시럽 넣기', 2);
  await submit(page);
  await expectFailedWithHint(page, '그렇게 섞으면 같은 색일까?', 1);
  await submit(page);
  await expectFailedWithHint(page, '내 컵과 기준 컵을 나란히 놓고 색을 비교해 봐요.', 2);
  await expectOverlayAligned(main, 'side-by-side');
  await press(page, '처음으로');
  await press(page, '우유 넣기', 4);
  await press(page, '시럽 넣기');
  await press(page, '모두 ×2');
  await submit(page);
  await expectPassed(page);

  // T2: 가/나 고르기
  await expect(main.getByTestId('ratio-canvas')).toBeVisible();
  await passA1T2(page);

  // T3: 4를 기준량으로 고르면 MC-RATIO-ORDER ①
  await choose(page, 'base', '가');
  await submit(page);
  await expectFailedWithHint(page, '무엇을 기준으로 비교했지?', 1);
  await passA1T3(page);

  // T4: 비율을 뒤집어 4/1 → MC-RATIO-ORDER ① → 2/8(같은 값), 0.25, 25 통과
  await expectNoLeak(page, [/1\s*\/\s*4/, /0\.25/, /25\s*%/]);
  await fillA1T4(page, '4', '1', '0.25', '25');
  await submit(page);
  await expectFailedWithHint(page, '무엇을 기준으로 비교했지?', 1);
  await typeFraction(page, 'frac', '2', '8');
  await submit(page);
  await expectPassed(page);

  // T5: 5칸 칠하기 → MC-PERCENT-AS-NUMBER ① → 다시 → ② tens-brackets → 25칸 통과
  await expect(main.getByTestId('ratio-canvas')).toHaveAttribute('data-look', 'grid');
  await fillCells(page, 5);
  await submit(page);
  await expectFailedWithHint(page, '100칸 중 몇 칸이었지?', 1);
  await submit(page);
  await expectFailedWithHint(page, '10칸씩 묶어서', 2);
  await expectOverlayAligned(main, 'tens-brackets');
  await fillCells(page, 25);
  await submit(page);
  await expectPassed(page);

  // T6: 보기 전용 판(25칸) + 계산. 25 → MC-PERCENT-AS-NUMBER ① → 75 통과
  await expect(main.getByTestId('percent-count')).toHaveText('칠한 칸 25 / 100');
  await typePart(page, 'n', 'whole', '25');
  await submit(page);
  await expectFailedWithHint(page, '100칸 중 몇 칸이었지?', 1);
  await typePart(page, 'n', 'whole', '75');
  await submit(page);
  await expectPassed(page, true);
});

test('g6s1u4.A1 — 과제마다 대표 오답은 일반 힌트 ①이 뜬다', async ({ page }) => {
  test.slow();
  await openActivity(page, 'g6s1u4.A1', '초코 우유 배합 실험');

  // T1: 우유 8·시럽 1(같은 수를 더한 것도 아님)
  await press(page, '우유 넣기', 8);
  await press(page, '시럽 넣기');
  await submit(page);
  await expectFailedWithHint(page, '기준 컵 한 묶음을 몇 번 모아야 우유가 8칸이 될까요?', 1);
  await press(page, '처음으로');
  await passA1T1(page);

  // T2: 나를 고름
  await choose(page, 'darker', '나');
  await submit(page);
  await expectFailedWithHint(page, '두 컵의 진하기를 띠에서 비교해 봐요.', 1);
  await passA1T2(page);

  await passA1T3(page);

  // T4: 분수는 맞지만 소수가 틀림
  await fillA1T4(page, '1', '4', '0.4', '25');
  await submit(page);
  await expectFailedWithHint(page, '비교하는 양을 기준량으로 나누어 먼저 분수로 나타내 봐요.', 1);
  await passA1T4(page);

  // T5: 칠하지 않고 확인
  await submit(page);
  await expectFailedWithHint(page, '안경 쓴 학생은 전체의 얼마만큼일까요?', 1);
  await passA1T5(page);

  // T6: 70
  await typePart(page, 'n', 'whole', '70');
  await submit(page);
  await expectFailedWithHint(page, '300명을 100칸으로 나누면 한 칸은 몇 명일까요?', 1);
  await typePart(page, 'n', 'whole', '75');
  await submit(page);
  await expectPassed(page, true);
});

test('g6s1u4.A1 — 키보드만으로 A1.T1을 한다', async ({ page }) => {
  test.slow();
  await openActivity(page, 'g6s1u4.A1', '초코 우유 배합 실험');
  await act(page, '우유 넣기').focus();
  for (const code of ['KeyM', 'KeyM', 'KeyM', 'KeyM', 'KeyS', 'Digit2']) {
    await page.keyboard.press(code);
  }
  await expect(slot(page, 'main')).toContainText(/내 컵\s*우유 8, 시럽 2/);
  await page.getByRole('button', { name: '확인하기' }).focus();
  await page.keyboard.press('Enter');
  await expectPassed(page);
});

// ---------------------------------------------------------------- A2

test('g6s1u4.A2 — 사진·경주·인구 밀도 5과제 흐름·오개념 ①②·첫 화면', async ({ page }) => {
  test.slow();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openActivity(page, 'g6s1u4.A2', '사진 리사이저와 속력 경주');
  const main = slot(page, 'main');

  // T1: +2씩 늘려 담으면 MC-RATIO-ADDITIVE ① → ② growth-arrows. 되돌리기로 담은 것을 빼고 ×2·×3으로 3개
  await expect(main.getByTestId('ratio-canvas')).toHaveAttribute('data-size', '4x3');
  await press(page, '가로·세로 둘 다 +2');
  await press(page, '이 크기 담기');
  await submit(page);
  await expectFailedWithHint(page, '그렇게 늘리면 같은 모양일까?', 1);
  await submit(page);
  await expectFailedWithHint(page, '가로와 세로가 늘어난 길이를 화살표로 비교해 봐요.', 2);
  await expectOverlayAligned(main, 'growth-arrows');
  await page.getByRole('button', { name: '되돌리기' }).click();
  await page.getByRole('button', { name: '되돌리기' }).click();
  await expect(main.getByTestId('ratio-canvas')).toHaveAttribute('data-size', '4x3');
  await passA2T1(page);

  // T2
  await expect(main.getByTestId('ratio-canvas')).toHaveAttribute('data-look', 'table');
  await passA2T2(page);

  // T3 첫 화면 + 스냅샷(예측 전)
  await expect(main.getByTestId('ratio-canvas')).toHaveAttribute('data-look', 'race');
  // 전자칠판(1920px)에서는 반쪽 판의 조작 칸이 판을 8% 가린다(메모의 요청 참고).
  await expectReachable(page, [main.getByTestId('ratio-canvas')], 0.9);
  await expectNoLeak(page, [/1초에/, /더 멀리/]);
  await screenshot(page, 'g6s1u4-a2.png');

  // T3: 거북(거리·시간이 더 긴 쪽)이라고 예측 → MC-RATE-DISTANCE-ONLY. 경주 뒤 거북을 고르면 ① → ② footprints → 토끼 통과
  await raceAndChoose(page, '거북', '거북');
  await submit(page);
  await expectFailedWithHint(page, '1초 동안 간 거리로 비교하면?', 1);
  await submit(page);
  await expectFailedWithHint(page, '1초마다 어디까지 갔는지 발자국으로 살펴봐요.', 2);
  await expectOverlayAligned(main, 'footprints');
  await choose(page, 'fast', '토끼');
  await submit(page);
  await expectPassed(page);

  // T4: 같은 속력(120m·20초) 통과
  await expect(main.getByLabel('거북 거리(m)')).toBeVisible();
  await passA2T4(page);

  // T5: 엔진 화면 없이 응답 칸만. 가(400명) → MC-RATE-DISTANCE-ONLY ① → 나 230 통과
  await expect(main).toHaveCount(0);
  await expectNoLeak(page, [/230/]);
  await choose(page, 'town', '가');
  await typePart(page, 'd', 'whole', '200');
  await submit(page);
  await expectFailedWithHint(page, '넓이도 함께 살펴봤나요?', 1);
  await choose(page, 'town', '나');
  await typePart(page, 'd', 'whole', '230');
  await submit(page);
  await expectPassed(page, true);
});

test('g6s1u4.A2 — 과제마다 대표 오답은 일반 힌트 ①이 뜬다', async ({ page }) => {
  test.slow();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openActivity(page, 'g6s1u4.A2', '사진 리사이저와 속력 경주');

  // T1: 2개만 담고 확인
  await press(page, '가로·세로 둘 다 ×2');
  await press(page, '이 크기 담기');
  await press(page, '가로·세로 둘 다 ×2');
  await press(page, '이 크기 담기');
  await submit(page);
  await expectFailedWithHint(page, '담은 크기가 처음 모양과 같은지 하나씩 살펴봐요.', 1);
  await press(page, '처음으로');
  await press(page, '가로·세로 둘 다 ×3');
  await press(page, '이 크기 담기');
  await submit(page);
  await expectPassed(page);

  // T2: 나를 고름
  await choose(page, 'why', '나');
  await submit(page);
  await expectFailedWithHint(
    page,
    '가로는 몇 배가 되었고 세로는 몇 배가 되었는지 표에서 견줘 봐요.',
    1,
  );
  await passA2T2(page);

  // T3: 토끼라고 예측했지만 경주 뒤 거북을 고름
  await raceAndChoose(page, '토끼', '거북');
  await submit(page);
  await expectFailedWithHint(page, '같은 시간 동안 누가 더 멀리 갔는지 봐요.', 1);
  await choose(page, 'fast', '토끼');
  await submit(page);
  await expectPassed(page);

  // T4: 속력이 다른 값 → 일반 ①, 토끼와 똑같은 값 → ②(sameSpeed 규칙), 다른 값 통과
  await fillTurtle(page, '100', '10');
  await submit(page);
  await expectFailedWithHint(page, '거북이 1초 동안 가는 거리를 토끼와 견줘 봐요.', 1);
  await fillTurtle(page, '60', '10');
  await submit(page);
  await expectFailedWithHint(page, '거리와 시간을 같은 수로 곱하거나 나눠 봐요.', 2);
  await passA2T4(page);

  // T5: 나를 골랐지만 인구 밀도가 틀림
  await choose(page, 'town', '나');
  await typePart(page, 'd', 'whole', '345');
  await submit(page);
  await expectFailedWithHint(page, '각 마을의 사람 수를 넓이로 나누면 무엇을 알 수 있을까요?', 1);
  await typePart(page, 'd', 'whole', '230');
  await submit(page);
  await expectPassed(page, true);
});

test('g6s1u4.A2.T3 — 예측하지 않으면 경주를 시작할 수 없고, 예측과 상관없이 경주 뒤 고르기로 판정한다', async ({
  page,
}) => {
  test.slow();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openActivity(page, 'g6s1u4.A2', '사진 리사이저와 속력 경주');
  await passA2T1(page);
  await passA2T2(page);
  await act(page, '경주 시작').focus();
  await page.keyboard.press('KeyG');
  await expect(page.getByTestId('ratio-message')).toHaveText('먼저 누가 더 빠를지 예측해 주세요.');
  await submit(page);
  await expectFailedWithHint(page, null, 1);
  await raceAndChoose(page, '거북', '토끼');
  await submit(page);
  await expectPassed(page);
});

// ---------------------------------------------------------------- 오프라인

test('오프라인에서도 g6s1u4.A1 활동이 열린다', async ({ page, context }) => {
  await page.goto(PREVIEW_URL);
  await page.getByRole('button', { name: '1번', exact: true }).click();
  await page.getByRole('button', { name: '건너뛰기' }).click();
  await expect(page).toHaveURL(/#\/map$/);
  await page.goto(`${PREVIEW_URL}/#/activity/g6s1u4.A1`);
  await expect(page.getByRole('heading', { name: '초코 우유 배합 실험' })).toBeVisible();

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
  await expect(page.getByRole('heading', { name: '초코 우유 배합 실험' })).toBeVisible();
  await expect(page.getByRole('button', { name: '확인하기' })).toBeVisible();
});
