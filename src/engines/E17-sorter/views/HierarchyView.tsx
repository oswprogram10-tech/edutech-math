/**
 * E17 hierarchy: 조건 토글로 모양이 바뀌는 사각형과 포함 관계 트리.
 *
 * - 모양의 이름은 좌표에서 계산한다(토글에서 바로 정하지 않는다).
 * - 트리 빈칸에는 이름을 미리 쓰지 않는다. 지금 모양 표시는 노드 자리만 가리킨다.
 */
import { useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import type { EngineViewProps, Point } from '../../../core/engine-sdk';
import {
  TREE_NODE,
  fitPoints,
  hierarchyPoints,
  hierarchyShapeBox,
  treeEdges,
  treeNodeBox,
  treeNodes,
} from '../layout';
import { hierarchyProps, quadNode } from '../properties';
import { sorterStrings as S } from '../strings.ko';
import { LOGICAL_HEIGHT, LOGICAL_WIDTH, NAME_CARD_ORDER } from '../types';
import type { HierarchyState, QuadName, SorterAction, SorterConfig } from '../types';
import { ParallelArrows, RightAngleMarks, SorterDefs } from './CardShape';
import styles from '../View.module.css';

const PAPER = '#fbfaf6';
const INK = '#1d2330';
const ORANGE = '#e8872e';
const GRID = '#c9d2e2';

type HierarchyViewProps = EngineViewProps<SorterConfig, HierarchyState, SorterAction>;

function polygon(points: readonly Point[]): string {
  return points.map((point) => `${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(' ');
}

export function HierarchyView({
  state,
  dispatch,
  cpa,
  readOnly = false,
  targetSize,
}: HierarchyViewProps) {
  const [held, setHeld] = useState<QuadName | null>(null);
  const { props } = hierarchyProps(state.toggles);
  const node = quadNode(props, state.settings.trapezoidDefinition);
  const shapeBox = hierarchyShapeBox();
  const shape = fitPoints(hierarchyPoints(state.toggles), shapeBox, 46);
  const marksOn =
    state.settings.marks !== 'hide' && (state.settings.marks === 'show' || cpa !== 'A');
  const showPosition =
    state.settings.showPosition === 'always' ||
    (state.settings.showPosition === 'auto' && cpa !== 'A');
  const nodes = treeNodes(state.settings.trapezoidDefinition);
  const nodeMap = new Map(nodes.map((treeNode) => [treeNode.name, treeNode]));

  const fill = (blank: QuadName, name: QuadName | null) => {
    dispatch({ type: 'fill-blank', node: blank, name });
    setHeld(null);
  };

  const pressBlank = (blank: QuadName) => {
    if (readOnly || !state.settings.treeBlanks.includes(blank)) return;
    if (held) {
      fill(blank, held);
      return;
    }
    const value = state.blanks[blank];
    if (value !== null && value !== undefined) fill(blank, null);
  };

  const onBlankKey = (event: ReactKeyboardEvent<SVGGElement>, blank: QuadName) => {
    if (event.key !== 'Enter' && event.key !== ' ' && event.key !== 'Spacebar') return;
    event.preventDefault();
    pressBlank(blank);
  };

  return (
    <div className={styles.wrap} data-target-size={targetSize}>
      <div className={styles.toolbar} role="group" aria-label={S.hierarchy.toggleTitle}>
        {state.settings.constraintToggles.map((toggle) => {
          const checked = state.toggles.includes(toggle);
          return (
            <button
              key={toggle}
              type="button"
              role="switch"
              className={styles.switch}
              aria-checked={checked}
              aria-label={S.toggle[toggle]}
              data-toggle={toggle}
              onClick={() => dispatch({ type: 'toggle', toggle })}
              disabled={readOnly}
            >
              <span className={styles.switchTrack} aria-hidden="true">
                {checked ? '✓' : ''}
              </span>
              {S.toggle[toggle]}
            </button>
          );
        })}
      </div>

      <p className={styles.instructions}>{S.instructions.hierarchy}</p>
      <p className={styles.status} role="status" data-testid="sorter-status">
        {held ? S.hierarchy.heldStatus(S.quadName[held]) : ''}
      </p>

      <div className={styles.stageRow}>
        <div className={styles.boardArea}>
          <svg
            className={styles.canvas}
            viewBox={`0 0 ${LOGICAL_WIDTH} ${LOGICAL_HEIGHT}`}
            role="group"
            aria-label={S.canvasLabel.hierarchy}
            tabIndex={readOnly ? -1 : 0}
            data-testid="sorter-canvas"
            data-mode="hierarchy"
          >
            <SorterDefs />
            <rect width={LOGICAL_WIDTH} height={LOGICAL_HEIGHT} fill={PAPER} />

            <text x={20} y={90} fontSize={18} fontWeight={700} fill={INK}>
              {S.hierarchy.shapeLabel}
            </text>
            <rect
              x={shapeBox.x}
              y={shapeBox.y}
              width={shapeBox.width}
              height={shapeBox.height}
              fill="#ffffff"
              stroke={GRID}
              rx={16}
            />
            {shape.length >= 3 ? (
              <>
                <polygon
                  points={polygon(shape)}
                  fill="#eaf1fd"
                  fillOpacity={0.6}
                  stroke={INK}
                  strokeWidth={3}
                  strokeLinejoin="round"
                />
                {marksOn ? (
                  <>
                    <RightAngleMarks points={shape} vertices={props.rightAngles} />
                    <ParallelArrows points={shape} pairs={props.parallelSidePairs} />
                  </>
                ) : null}
              </>
            ) : null}

            <g aria-label={S.hierarchy.treeLabel}>
              {treeEdges(state.settings.trapezoidDefinition).map(([from, to]) => {
                const parent = nodeMap.get(from);
                const child = nodeMap.get(to);
                if (!parent || !child) return null;
                return (
                  <line
                    key={`${from}-${to}`}
                    x1={parent.x}
                    y1={parent.y + TREE_NODE.height / 2}
                    x2={child.x}
                    y2={child.y - TREE_NODE.height / 2}
                    stroke={GRID}
                    strokeWidth={3}
                  />
                );
              })}
              {nodes.map((treeNode) => {
                const box = treeNodeBox(treeNode);
                const isBlank = state.settings.treeBlanks.includes(treeNode.name);
                const value = state.blanks[treeNode.name] ?? null;
                const current = showPosition && node === treeNode.name;
                const blankNumber = state.settings.treeBlanks.indexOf(treeNode.name) + 1;
                return (
                  <g
                    key={treeNode.name}
                    role={isBlank ? 'button' : undefined}
                    tabIndex={isBlank && !readOnly ? 0 : undefined}
                    aria-label={
                      isBlank
                        ? value === null
                          ? S.hierarchy.blankPosition(blankNumber)
                          : S.quadName[value]
                        : S.quadName[treeNode.name]
                    }
                    data-blank={isBlank ? treeNode.name : undefined}
                    data-current={current ? 'true' : undefined}
                    onClick={() => {
                      if (isBlank) pressBlank(treeNode.name);
                    }}
                    onKeyDown={(event) => {
                      if (isBlank) onBlankKey(event, treeNode.name);
                    }}
                  >
                    <rect
                      x={box.x}
                      y={box.y}
                      width={box.width}
                      height={box.height}
                      rx={12}
                      fill={current ? '#fff5e6' : '#ffffff'}
                      stroke={current ? ORANGE : isBlank ? GRID : INK}
                      strokeWidth={current ? 5 : isBlank ? 3 : 2}
                      strokeDasharray={isBlank && value === null ? '10 7' : undefined}
                    />
                    <text
                      x={treeNode.x}
                      y={treeNode.y + 7}
                      textAnchor="middle"
                      fontSize={19}
                      fontWeight={700}
                      fill={current ? '#8a4b00' : INK}
                    >
                      {isBlank
                        ? value === null
                          ? ''
                          : S.quadName[value]
                        : S.quadName[treeNode.name]}
                    </text>
                    {current ? (
                      <text
                        x={treeNode.x}
                        y={box.y - 10}
                        textAnchor="middle"
                        fontSize={16}
                        fontWeight={700}
                        fill={ORANGE}
                      >
                        {S.hierarchy.nowShape}
                      </text>
                    ) : null}
                  </g>
                );
              })}
            </g>
          </svg>
        </div>

        <div className={styles.sideStack}>
          <div className={styles.nameTray} role="group" aria-label={S.hierarchy.nameTitle}>
            {NAME_CARD_ORDER.map((name) => (
              <button
                key={name}
                type="button"
                className={styles.nameCard}
                aria-pressed={held === name}
                data-name-card={name}
                onClick={() => setHeld((current) => (current === name ? null : name))}
                disabled={readOnly}
              >
                {S.quadName[name]}
              </button>
            ))}
            <span className={styles.hint}>{S.hierarchy.hint}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
