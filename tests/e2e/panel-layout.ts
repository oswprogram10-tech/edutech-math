import { expect } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

/**
 * T082: `layout: 'content'` 판은 판 안쪽 스크롤 대신 앱의 스크롤 영역(main)을 쓴다.
 * 단원 E2E의 '첫 화면' 검사를 이 기준으로 바꿀 때 쓴다.
 */

/** 판의 첫 번째 div가 실행기의 viewport다(판 제목은 h3). */
export function panelViewport(panel: Locator): Locator {
  return panel.locator(':scope > div').first();
}

/** 모든 content 판의 viewport가 판 안에서 스크롤되지 않아야 한다. */
export async function expectNoPanelInnerScroll(page: Page): Promise<void> {
  const panels = page.locator('[data-testid^="runner-slot-"][data-layout="content"]');
  const count = await panels.count();
  for (let index = 0; index < count; index += 1) {
    const overflow = await panelViewport(panels.nth(index)).evaluate(
      (element) => element.scrollHeight - element.clientHeight,
    );
    expect(overflow).toBeLessThanOrEqual(1);
  }
}

/** 앱의 스크롤 영역(ActivityRunner의 main) 안에 완전히 들어오는지 확인한다. */
export async function expectInsideScroller(target: Locator): Promise<void> {
  await target.scrollIntoViewIfNeeded();
  const clipped = await target.evaluate((element) => {
    const scroller = element.closest('main');
    if (!scroller) throw new Error('스크롤 영역(main)을 찾지 못했습니다.');
    const rect = element.getBoundingClientRect();
    const host = scroller.getBoundingClientRect();
    return {
      above: rect.top < host.top - 1,
      below: rect.bottom > host.bottom + 1,
      left: rect.left < host.left - 1,
      right: rect.right > host.right + 1,
    };
  });
  expect(clipped).toEqual({ above: false, below: false, left: false, right: false });
}

/**
 * content 판이 있는 과제의 첫 화면 검사.
 * (a) 판 안 스크롤이 없고 (b) 페이지 스크롤로 '확인하기'에 닿는다.
 */
export async function expectContentPanelsReachable(page: Page): Promise<void> {
  await expectNoPanelInnerScroll(page);
  const submit = page.getByRole('button', { name: '확인하기' });
  await expectInsideScroller(submit);
  await expect(submit).toBeVisible();
}
