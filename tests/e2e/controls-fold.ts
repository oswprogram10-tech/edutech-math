import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

/**
 * T223: E13 조작 칸(`measure-controls`)의 첫 단추 줄 아래 끝이 첫 화면(스크롤 0) 안에 있는지 본다.
 * 창과 스크롤 상자(overflow가 auto·scroll·hidden인 조상)의 아래 끝 중 가장 위에 있는 선을 기준으로,
 * 첫 단추의 아래 끝이 그 선을 넘은 px를 돌려준다(0 이하면 보인다).
 */
export async function controlsFoldOverflow(page: Page): Promise<number> {
  await page.evaluate(() => {
    window.scrollTo(0, 0);
    document.querySelectorAll('main').forEach((main) => {
      main.scrollTop = 0;
    });
  });
  const controls = page.getByTestId('runner-slot-main').getByTestId('measure-controls');
  const first = controls.getByRole('button').first();
  await first.waitFor({ state: 'visible' });
  return first.evaluate((button) => {
    let line = window.innerHeight;
    for (let node = button.parentElement; node; node = node.parentElement) {
      const overflow = getComputedStyle(node).overflowY;
      if (overflow === 'auto' || overflow === 'scroll' || overflow === 'hidden') {
        line = Math.min(line, node.getBoundingClientRect().bottom);
      }
    }
    return Math.round(button.getBoundingClientRect().bottom - line);
  });
}

/** 첫 화면 검사. 못 맞추면 어느 과제가 몇 px 모자란지 메시지에 남는다. */
export async function expectControlsAboveFold(
  page: Page,
  label: string,
  /** 크롬북(1366×768)에서 아직 못 맞추는 과제의 알려진 모자람(px). 더 나빠지는 것만 막는다. 0이면 완전히 보여야 한다. */
  chromebookShortfall = 0,
): Promise<void> {
  const allowed = test.info().project.name === 'chromebook' ? Math.max(0, chromebookShortfall) : 0;
  // 판이 칸에 맞춰 크기를 정한 뒤 잰다(값이 두 번 연속 같을 때까지).
  let previous = Number.NaN;
  await expect
    .poll(async () => {
      const now = await controlsFoldOverflow(page);
      const same = now === previous;
      previous = now;
      return same;
    })
    .toBe(true);
  expect(
    await controlsFoldOverflow(page),
    `${label}: 조작 칸 첫 단추 줄이 첫 화면 아래로 넘친 px`,
  ).toBeLessThanOrEqual(allowed);
}
