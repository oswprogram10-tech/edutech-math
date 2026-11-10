/**
 * 힌트 ②: 학생이 만든 도형 옆에 정의의 조건 목록과 ✓/✗를 쓴다.
 * 목표 도형·정답·도형 이름은 그리지 않는다. 색만으로 구분하지 않고 ✓/✗ 모양을 같이 쓴다.
 */
import { CanvasAlignedOverlay } from '../../../core/engine-sdk';
import type { OverlayProps } from '../../../core/engine-sdk';
import type { SPoint } from '../../../core/math';
import { boardRect, surdToScreen } from '../layout';
import { classifyProps } from '../modes/classify/observe';
import { currentFigure } from '../modes/drag-test/observe';
import { propertyKeys } from '../properties';
import type { FigureProps } from '../properties';
import { geoBoardStrings as S } from '../strings.ko';
import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../types';
import type { GeoConfig, GeoState } from '../types';

type Definition = keyof typeof S.checklist.conditions;

function definitionOf(args: unknown): Definition | null {
  if (args === null || typeof args !== 'object') return null;
  const value = (args as { readonly definition?: unknown }).definition;
  if (typeof value !== 'string') return null;
  return value in S.checklist.conditions ? (value as Definition) : null;
}

function figureFor(state: GeoState): FigureProps | null {
  if (state.mode === 'classify') {
    const bands = [...state.bands].reverse();
    for (const band of bands) {
      const props = classifyProps(band);
      if (props) return props;
    }
    return null;
  }
  if (state.mode === 'drag-test') return currentFigure(state).props;
  return null;
}

function gridOf(state: GeoState): number {
  if (state.mode === 'drag-test') return state.settings.lattice + 1;
  if (state.mode === 'classify' || state.mode === 'geoboard') return state.settings.grid[0];
  return 9;
}

function gridRows(state: GeoState): number {
  if (state.mode === 'drag-test') return state.settings.lattice + 1;
  if (state.mode === 'classify' || state.mode === 'geoboard') return state.settings.grid[1];
  return 9;
}

export function PropertyChecklistOverlay({ state, args }: OverlayProps<GeoConfig, GeoState>) {
  const definition = definitionOf(args);
  if (!definition) return null;
  const props = figureFor(state);
  if (!props) return null;
  const conditions = S.checklist.conditions[definition];
  const keys = propertyKeys(props);
  const rect = boardRect(gridOf(state), gridRows(state));
  const points = props.vertices.map((point: SPoint) => ({
    x: rect.x + surdToScreen(point.x) * rect.spacing,
    y: rect.y + surdToScreen(point.y) * rect.spacing,
  }));
  if (points.length === 0) return null;
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const width = 286;
  const rowHeight = 31;
  const height = 50 + conditions.length * rowHeight;
  const x = maxX + 34 + width <= LOGICAL_WIDTH ? maxX + 34 : Math.max(10, minX - width - 34);
  const y = Math.max(10, Math.min(LOGICAL_HEIGHT - height - 10, minY));

  return (
    <CanvasAlignedOverlay
      testId="property-checklist"
      canvasSelector={'svg[data-testid="geo-canvas"]'}
      logicalWidth={LOGICAL_WIDTH}
      logicalHeight={LOGICAL_HEIGHT}
    >
      <g>
        <rect
          x={x}
          y={y}
          width={width}
          height={height}
          rx={14}
          fill="#ffffff"
          fillOpacity={0.95}
          stroke="#2f6fde"
          strokeWidth={2}
        />
        <text x={x + 16} y={y + 30} fontSize={17} fontWeight={700} fill="#1d2330">
          {S.checklist.title}
        </text>
        {conditions.map((condition, index) => {
          const ok = keys.includes(condition.key);
          return (
            <g key={condition.key}>
              <text
                x={x + 16}
                y={y + 52 + index * rowHeight}
                fontSize={17}
                fontWeight={700}
                fill={ok ? '#2f9e6b' : '#c2410c'}
              >
                {ok ? '✓' : '✗'}
              </text>
              <text x={x + 42} y={y + 52 + index * rowHeight} fontSize={15} fill="#1d2330">
                {condition.text}
              </text>
            </g>
          );
        })}
      </g>
    </CanvasAlignedOverlay>
  );
}
