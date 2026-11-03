/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadKnowledgeGraph } from '../../../core/knowledge';
import { loadUnitSummaries } from '../../content-units';
import type { ContentActivity } from '../../../core/runner';
import type { Brightness } from '../brightness';
import { layoutStars } from '../layout';
import type { LayoutConcept, StarMapLayout } from '../layout';
import { StarMapView } from '../StarMapView';

afterEach(cleanup);

const activity: ContentActivity = {
  id: 'u1.A1',
  title: '활동 하나',
  tasks: [{ id: 'u1.A1.T1' }, { id: 'u1.A1.T2' }] as unknown as ContentActivity['tasks'],
};

function smallLayout(): StarMapLayout {
  return {
    width: 1000,
    height: 1000,
    stars: [
      { index: 0, conceptId: 'c1', unitId: 'u1', label: '개념 하나', x: 120, y: 120 },
      { index: 1, conceptId: 'c2', unitId: 'u2', label: '개념 둘', x: 240, y: 240 },
    ],
    units: [],
    links: [],
    zones: [],
  };
}

interface RenderOptions {
  readonly layout?: StarMapLayout;
  readonly brightness?: ReadonlyMap<string, Brightness>;
  readonly sparkle?: ReadonlySet<string>;
  readonly enabledUnits?: ReadonlySet<string>;
  readonly activitiesByConcept?: ReadonlyMap<string, readonly ContentActivity[]>;
  readonly onOpenActivity?: (activityId: string) => void;
}

function renderView(options: RenderOptions = {}) {
  const layout = options.layout ?? smallLayout();
  return render(
    <StarMapView
      layout={layout}
      brightness={options.brightness ?? new Map()}
      sparkle={options.sparkle ?? new Set()}
      enabledUnits={options.enabledUnits ?? new Set(['u1'])}
      activitiesByConcept={options.activitiesByConcept ?? new Map()}
      targetSize={48}
      onOpenActivity={options.onOpenActivity ?? (() => {})}
    />,
  );
}

describe('StarMapView', () => {
  it('켠 단원의 별만 버튼이고 꺼진 별은 흐린 점이며 누를 수 없다', () => {
    const onOpen = vi.fn();
    renderView({ onOpenActivity: onOpen });

    const enabled = screen.getByRole('button', { name: '개념 하나, 아직' });
    const disabled = screen.getByRole('button', { name: '개념 둘, 아직' });

    expect(enabled.getAttribute('data-enabled')).toBe('true');
    expect(enabled.getAttribute('tabindex')).toBe('0');
    expect(disabled.getAttribute('data-enabled')).toBe('false');
    expect(disabled.getAttribute('aria-disabled')).toBe('true');
    expect(disabled.hasAttribute('tabindex')).toBe(false);
    expect(disabled.querySelector('path')).toBeNull();
    expect(disabled.querySelectorAll('circle')).toHaveLength(1);

    fireEvent.click(disabled);
    expect(screen.queryByTestId('star-detail')).toBeNull();
    expect(onOpen).not.toHaveBeenCalled();
  });

  it('별을 누르면 개념 이름과 활동 목록을 보여 주고 활동 화면으로 넘긴다', () => {
    const onOpen = vi.fn();
    const brightness: ReadonlyMap<string, Brightness> = new Map([['c1', 'mastered']]);
    renderView({
      brightness,
      sparkle: new Set(['c1']),
      activitiesByConcept: new Map([['c1', [activity]]]),
      onOpenActivity: onOpen,
    });

    fireEvent.keyDown(screen.getByRole('button', { name: '개념 하나, 숙달' }), { key: 'Enter' });

    expect(screen.getByTestId('star-detail')).toBeTruthy();
    expect(screen.getByText('개념 하나')).toBeTruthy();
    expect(within(screen.getByTestId('star-detail')).getByText('숙달')).toBeTruthy();
    expect(screen.getByText('부스터로 다시 해 내고 빛나는 별이에요.')).toBeTruthy();
    expect(screen.getByText('2개 과제')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /활동 하나/ }));
    expect(onOpen).toHaveBeenCalledWith('u1.A1');
  });

  it('켜진 단원 개념끼리 잇는 선만 그린다', () => {
    const layout = smallLayout();
    const linked: StarMapLayout = {
      ...layout,
      links: [
        { from: 'c1', to: 'c2' },
        { from: 'c2', to: 'c1' },
      ],
    };
    const { container, unmount } = renderView({ layout: linked, enabledUnits: new Set(['u1']) });
    expect(container.querySelectorAll('line')).toHaveLength(0);
    unmount();

    const both = renderView({ layout: linked, enabledUnits: new Set(['u1', 'u2']) });
    expect(both.container.querySelectorAll('line').length).toBeGreaterThan(0);
  });

  it('활동이 없는 별은 빈 활동 문구를 보여 준다', () => {
    renderView({ enabledUnits: new Set(['u2']) });
    fireEvent.click(screen.getByRole('button', { name: '개념 둘, 아직' }));
    expect(screen.getByText('이 별에 연결된 활동이 아직 없어요.')).toBeTruthy();
  });

  it('확대·처음 보기 버튼과 화살표 이동이 transform을 바꾼다', async () => {
    renderView();
    const canvas = screen.getByTestId('map-canvas');
    const transform = screen.getByTestId('map-transform');
    const initial = transform.getAttribute('transform');

    expect(screen.getByTestId('map-zoom').textContent).toBe('400%');
    fireEvent.click(screen.getByRole('button', { name: '축소' }));
    expect(screen.getByTestId('map-zoom').textContent).toBe('375%');
    await waitFor(() => {
      expect(transform.getAttribute('transform')).toContain('scale(3.75)');
    });

    const before = transform.getAttribute('transform');
    fireEvent.keyDown(canvas, { key: 'ArrowRight' });
    await waitFor(() => {
      expect(transform.getAttribute('transform')).not.toBe(before);
    });
    fireEvent.keyDown(canvas, { key: '+' });
    expect(screen.getByTestId('map-zoom').textContent).toBe('400%');

    fireEvent.click(screen.getByRole('button', { name: '처음 보기' }));
    expect(screen.getByTestId('map-zoom').textContent).toBe('400%');
    await waitFor(() => {
      expect(transform.getAttribute('transform')).toBe(initial);
    });
  });

  it('구역 배경과 이름도 별과 같은 변환 안에 있어 확대·이동을 따른다', () => {
    const zoned: StarMapLayout = {
      ...smallLayout(),
      zones: [
        {
          domain: 'number',
          x: 0,
          y: 0,
          width: 500,
          height: 500,
          labelX: 18,
          labelY: 28,
          labelAnchor: 'start',
        },
      ],
    };
    renderView({ layout: zoned });

    const transform = screen.getByTestId('map-transform');
    // 구역 이름이 변환 그룹 안에 있으면 별과 같은 배율·이동을 따른다.
    expect(within(transform).getByText('수와 연산')).toBeTruthy();
    expect(transform.querySelector('rect')?.getAttribute('vector-effect')).toBe(
      'non-scaling-stroke',
    );
  });

  it('학생 화면 DOM에 학년과 단원 ID를 쓰지 않는다', async () => {
    const [units, graph] = await Promise.all([loadUnitSummaries(), loadKnowledgeGraph()]);
    const concepts: LayoutConcept[] = [];
    for (const id of graph.conceptOrder) {
      const node = graph.concepts.get(id);
      if (!node) continue;
      concepts.push({
        id: node.id,
        unit: node.unit,
        label: node.label,
        prerequisites: node.prerequisites,
      });
    }

    renderView({
      layout: layoutStars(units, concepts),
      enabledUnits: new Set(['g3s1u6']),
    });

    const html = document.body.innerHTML;
    expect(html).not.toMatch(/\d\s*학년/);
    expect(html).not.toMatch(/g\d s\d u\d/i);
    expect(screen.getAllByRole('button', { name: /아직|연습 중|숙달/ }).length).toBeGreaterThan(0);
    expect(screen.getByTestId('legend-missing')).toBeTruthy();
    expect(screen.getByTestId('legend-practicing')).toBeTruthy();
    expect(screen.getByTestId('legend-mastered')).toBeTruthy();
  });
});
