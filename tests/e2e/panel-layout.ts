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

export interface FitCanvasBox {
  readonly slot: string;
  readonly width: number;
  readonly height: number;
}

interface CanvasMeasurement {
  readonly width: number;
  readonly height: number;
  readonly overflowX: number;
  readonly overflowY: number;
  readonly inside: boolean;
  readonly overlaps: readonly string[];
}

/**
 * 판(또는 샌드박스 판) 안에서 엔진 캔버스 상자를 재고, 판 밖으로 나갔는지·판 안
 * 스크롤이 생겼는지·판 안의 다른 요소와 겹치는지 본다.
 * `host`는 실행기 판과 샌드박스 판 모두 같은 구조(첫 div가 viewport)다.
 */
async function measureCanvasIn(panel: Locator): Promise<CanvasMeasurement | null> {
  return panel.evaluate((element) => {
    const host = element.querySelector(':scope > div');
    const svg = element.querySelector('svg[data-testid$="-canvas"]');
    if (!(host instanceof HTMLElement) || !(svg instanceof SVGSVGElement)) return null;
    const svgBox = svg.getBoundingClientRect();
    const hostBox = host.getBoundingClientRect();
    const hostStyle = window.getComputedStyle(host);
    const padTop = Number.parseFloat(hostStyle.paddingTop) || 0;
    const padBottom = Number.parseFloat(hostStyle.paddingBottom) || 0;
    const padLeft = Number.parseFloat(hostStyle.paddingLeft) || 0;
    const padRight = Number.parseFloat(hostStyle.paddingRight) || 0;
    const inner = {
      top: hostBox.top + padTop,
      bottom: hostBox.bottom - padBottom,
      left: hostBox.left + padLeft,
      right: hostBox.right - padRight,
    };
    const overflowY = host.scrollHeight - host.clientHeight;
    const overflowX = host.scrollWidth - host.clientWidth;

    /** 스크롤·클립되는 조상에 잘린 뒤 실제로 보이는 상자. */
    const visibleBox = (start: Element, limit: Element) => {
      let box = start.getBoundingClientRect();
      let node: Element | null = start.parentElement;
      while (node && node !== limit.parentElement) {
        const style = window.getComputedStyle(node);
        if (/(hidden|auto|scroll|clip)/.test(`${style.overflowX} ${style.overflowY}`)) {
          const clip = node.getBoundingClientRect();
          const top = Math.max(box.top, clip.top);
          const bottom = Math.min(box.bottom, clip.bottom);
          const left = Math.max(box.left, clip.left);
          const right = Math.min(box.right, clip.right);
          if (right <= left || bottom <= top) {
            return { top, bottom, left, right, width: 0, height: 0 };
          }
          box = {
            x: left,
            y: top,
            top,
            bottom,
            left,
            right,
            width: right - left,
            height: bottom - top,
            toJSON: box.toJSON.bind(box),
          } as DOMRect;
        }
        node = node.parentElement;
      }
      return box;
    };

    // 판 안에서 보이는 다른 요소(단추·안내 글·패널)와 상자가 1px 넘게 겹치는지 본다.
    const overlaps: string[] = [];
    const candidates = element.querySelectorAll(
      'button, p, h3, h4, section, output, ol, aside, label, input, select',
    );
    candidates.forEach((candidate) => {
      if (candidate.contains(svg) || svg.contains(candidate)) return;
      if (!(candidate instanceof HTMLElement)) return;
      const style = window.getComputedStyle(candidate);
      if (style.visibility === 'hidden' || style.display === 'none') return;
      if (Number.parseFloat(style.opacity) === 0) return;
      const raw = candidate.getBoundingClientRect();
      if (raw.width < 1 || raw.height < 1) return;
      // 스크롤 칸에 잘려 안 보이는 부분은 겹침으로 세지 않는다.
      const box = visibleBox(candidate, element);
      if (box.width < 1 || box.height < 1) return;
      const overlapX = Math.min(svgBox.right, box.right) - Math.max(svgBox.left, box.left);
      const overlapY = Math.min(svgBox.bottom, box.bottom) - Math.max(svgBox.top, box.top);
      if (overlapX > 1 && overlapY > 1) {
        const label =
          candidate.textContent?.trim().slice(0, 24) ||
          candidate.getAttribute('aria-label') ||
          candidate.tagName;
        overlaps.push(label);
      }
    });

    return {
      width: svgBox.width,
      height: svgBox.height,
      overflowX,
      overflowY,
      inside:
        svgBox.top >= inner.top - 1 &&
        svgBox.bottom <= inner.bottom + 1 &&
        svgBox.left >= inner.left - 1 &&
        svgBox.right <= inner.right + 1,
      overlaps: overlaps.slice(0, 5),
    };
  });
}

/**
 * T122: 캔버스가 판 높이에 맞춰 줄어들었는지 본다.
 *
 * 판(fit·content 모두)마다
 * (a) 엔진 캔버스(`svg[data-testid$="-canvas"]`)가 판의 viewport 안에 판 안 스크롤
 *     없이 완전히 들어오고,
 * (b) 같은 판에서 보이는 다른 요소(단추·안내 글·패널)와 1px 넘게 겹치지 않는지 본다.
 */
export async function expectFitCanvasVisible(page: Page): Promise<FitCanvasBox[]> {
  const panels = page.locator('[data-testid^="runner-slot-"]');
  const count = await panels.count();
  const boxes: FitCanvasBox[] = [];
  for (let index = 0; index < count; index += 1) {
    const panel = panels.nth(index);
    const slot = (await panel.getAttribute('data-testid')) ?? `runner-slot-${index}`;
    const canvas = panel.locator('svg[data-testid$="-canvas"]').first();
    if ((await canvas.count()) === 0) continue;
    await expect(canvas, `${slot}: 캔버스가 보이지 않습니다.`).toBeVisible();

    const measured = await measureCanvasIn(panel);
    expect(measured, `${slot}: 판 안에서 캔버스를 찾지 못했습니다.`).not.toBeNull();
    if (!measured) continue;
    expect(measured.inside, `${slot}: 캔버스가 판 밖으로 나갔습니다.`).toBe(true);
    expect(measured.overflowX, `${slot}: 판 안 가로 스크롤이 생겼습니다.`).toBeLessThanOrEqual(1);
    expect(measured.overflowY, `${slot}: 판 안 세로 스크롤이 생겼습니다.`).toBeLessThanOrEqual(1);
    expect(measured.overlaps, `${slot}: 캔버스가 판 안의 글·단추와 겹칩니다.`).toEqual([]);
    boxes.push({ slot, width: measured.width, height: measured.height });
  }
  return boxes;
}

/**
 * T122: 엔진 샌드박스(`#/sandbox/Exx`) 판에서도 같은 검사를 한다.
 * 샌드박스 `.stage`가 실행기 판의 viewport와 같은 역할을 한다.
 */
export async function expectSandboxCanvasVisible(page: Page): Promise<FitCanvasBox> {
  const stage = page.locator('main > div[class*="stage"]').first();
  await expect(stage).toBeVisible();
  const canvas = stage.locator('svg[data-testid$="-canvas"]').first();
  await expect(canvas).toBeVisible();
  const measured = await measureCanvasIn(stage);
  expect(measured, '샌드박스 판에서 캔버스를 찾지 못했습니다.').not.toBeNull();
  if (!measured) return { slot: 'sandbox', width: 0, height: 0 };
  expect(measured.inside, '샌드박스: 캔버스가 판 밖으로 나갔습니다.').toBe(true);
  expect(measured.overflowX, '샌드박스: 판 안 가로 스크롤이 생겼습니다.').toBeLessThanOrEqual(1);
  expect(measured.overflowY, '샌드박스: 판 안 세로 스크롤이 생겼습니다.').toBeLessThanOrEqual(1);
  expect(measured.overlaps, '샌드박스: 캔버스가 글·단추와 겹칩니다.').toEqual([]);
  return { slot: 'sandbox', width: measured.width, height: measured.height };
}

/** 크롬북(1366×768)에서 캔버스 짧은 변이 200px 이상인지 본다. */
export function expectChromeBookCanvasSize(boxes: readonly FitCanvasBox[]): void {
  for (const box of boxes) {
    expect(
      Math.min(box.width, box.height),
      `${box.slot}: 크롬북에서 캔버스 짧은 변이 200px보다 작습니다.`,
    ).toBeGreaterThanOrEqual(200);
  }
}
