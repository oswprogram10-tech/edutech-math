import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { logicalToScreen } from './canvas-point';

/**
 * T005 활동 실행기 E2E.
 * 아이패드(WebKit)·크롬북·전자칠판 뷰포트에서 같은 흐름을 확인한다.
 * 좌표는 화면 픽셀이 아니라 E00의 논리 좌표(1000×600)로 적는다.
 */
async function openRunner(page: Page) {
  await page.goto('/#/run/demo');
  await expect(page.getByRole('heading', { name: '셈돌로 만나는 첫 과제' })).toBeVisible();
}

function panel(page: Page, slot: string): Locator {
  return page.getByTestId(`runner-slot-${slot}`);
}

async function canvasAt(page: Page, slot: string) {
  const root = panel(page, slot);
  const canvas = root.getByTestId('demo-canvas');
  await expect(canvas).toBeVisible();
  const box = await canvas.boundingBox();
  if (!box) throw new Error(`${slot} 판의 캔버스 크기를 알 수 없습니다.`);
  return (x: number, y: number) => logicalToScreen(box, x, y);
}

async function addCounters(page: Page, slot: string, count: number) {
  const add = panel(page, slot).getByRole('button', { name: '셈돌 놓기' });
  for (let i = 0; i < count; i += 1) await add.click();
}

async function lassoAround(
  page: Page,
  slot: string,
  points: readonly (readonly [number, number])[],
) {
  const at = await canvasAt(page, slot);
  const [start, ...rest] = points;
  if (!start) throw new Error('올가미 시작점이 없습니다.');
  const from = at(start[0], start[1]);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  for (const [x, y] of rest) {
    const point = at(x, y);
    await page.mouse.move(point.x, point.y, { steps: 6 });
  }
  await page.mouse.up();
}

test('세 과제를 차례로 풀고, 실패해도 정답·판정 상태를 노출하지 않는다', async ({ page }) => {
  await openRunner(page);

  // 과제 1: 자동 제출. 셈돌 5개를 놓으면 바로 통과한다.
  await expect(page.getByRole('heading', { name: '셈돌을 5개 놓아 보세요.' })).toBeVisible();
  await addCounters(page, 'main', 5);
  await expect(page.getByText('좋아요, 통과했어요!')).toBeVisible();
  await page.getByRole('button', { name: '다음 과제' }).click();

  // 과제 2: 버튼 제출. 묶기 전에 제출하면 실패 문구만 보이고 정답은 보이지 않는다.
  await expect(
    page.getByRole('heading', { name: '셈돌 3개를 한 묶음으로 묶어 보세요.' }),
  ).toBeVisible();
  await addCounters(page, 'main', 3);
  await page.getByRole('button', { name: '확인하기' }).click();

  const failed = page.getByText('다시 볼까요? 지금 한 것을 천천히 살펴보고 고쳐 보세요.');
  await expect(failed).toBeVisible();
  await expect(page.getByText('좋아요, 통과했어요!')).toHaveCount(0);
  // 실행기는 Observation을 화면에 내보내지 않는다(샌드박스와 다르다).
  await expect(page.getByTestId('observation')).toHaveCount(0);

  // 조작을 다시 하면 실패 표시가 사라지고 다시 도전할 수 있다.
  await lassoAround(page, 'main', [
    [450, 240],
    [750, 240],
    [750, 360],
    [450, 360],
    [450, 240],
  ]);
  await expect(failed).toHaveCount(0);
  await page.getByRole('button', { name: '확인하기' }).click();
  await expect(page.getByText('좋아요, 통과했어요!')).toBeVisible();
  await page.getByRole('button', { name: '다음 과제' }).click();

  // 과제 3: 연결된 두 판. 왼쪽에 놓으면 오른쪽에도 놓인다.
  await expect(page.getByText('과제 3 / 8')).toBeVisible();
  await expect(panel(page, 'left')).toBeVisible();
  await expect(panel(page, 'right')).toBeVisible();

  await addCounters(page, 'left', 4);
  await expect(panel(page, 'right').locator('[data-counter-id]')).toHaveCount(4);
  await expect(page.getByText('좋아요, 통과했어요!')).toBeVisible();
  // demo.A3(응답 과제)가 뒤에 더 있으므로 아직 전체 완료는 아니다.
  await expect(page.getByRole('button', { name: '다음 과제' })).toBeVisible();
  await expect(page.getByText('모든 과제를 마쳤어요.')).toHaveCount(0);
});

test('키보드와 되돌리기로도 과제를 진행할 수 있다', async ({ page }) => {
  await openRunner(page);

  // 과제 1을 키보드만으로: 셈돌 놓기 버튼에 초점을 두고 Enter 다섯 번.
  const add = panel(page, 'main').getByRole('button', { name: '셈돌 놓기' });
  await add.focus();
  for (let i = 0; i < 5; i += 1) await page.keyboard.press('Enter');
  await expect(page.getByText('좋아요, 통과했어요!')).toBeVisible();

  // 통과 뒤에는 조작 도구가 잠긴다.
  await expect(
    page.getByRole('toolbar', { name: '과제 조작 도구' }).getByRole('button', { name: '되돌리기' }),
  ).toBeDisabled();
  await page.getByRole('button', { name: '다음 과제' }).click();

  // 과제 2: 셈돌 3개를 놓고, 하나를 골라 묶은 뒤 확인한다.
  await addCounters(page, 'main', 3);
  const counter = panel(page, 'main').getByRole('button', { name: '셈돌 1' });
  await counter.focus();
  await page.keyboard.press('Space');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Space');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Space');
  await page.keyboard.press('Enter');
  await expect(panel(page, 'main').getByText('묶음: 셈돌 3개')).toBeVisible();

  await page.getByRole('button', { name: '확인하기' }).click();
  await expect(page.getByText('좋아요, 통과했어요!')).toBeVisible();
});
