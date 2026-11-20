/**
 * E13 map-route 화면과 조작 칸. 출발 단추(출발이 정해지지 않았을 때)·길 단추 목록·[하나 지우기]·[처음으로].
 * 단추는 Tab으로 고르고 Enter/Space로 누른다. 조건이 안 맞으면 이유를 글로 알린다.
 */
import { useRef } from 'react';
import { Btn } from '../Btn';
import { Frame } from '../Frame';
import { E13_STRINGS as S } from '../strings.ko';
import styles from '../View.module.css';
import { boardHeight } from './layout';
import { RouteBoard } from './RouteBoard';
import type { RouteAction, RouteState } from './types';
import { useRouteUi } from './useRouteUi';

export interface RouteViewProps {
  readonly state: RouteState;
  readonly dispatch: (action: RouteAction) => void;
  readonly targetSize: number;
  readonly readOnly?: boolean;
}

export function RouteView({ state, dispatch, targetSize, readOnly = false }: RouteViewProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const ui = useRouteUi(state, dispatch, readOnly);
  const names = S.route.nodeNames;
  const needStart = state.from === null && state.path.length === 0;
  const startNodes = Array.from(new Set(state.segments.flatMap((seg) => [seg.a, seg.b])));
  return (
    <Frame
      mode="map-route"
      error={state.error}
      targetSize={targetSize}
      logicalHeight={boardHeight()}
      renderBoard={(svgStyle, className) => (
        <RouteBoard
          svgRef={svgRef}
          state={state}
          ui={ui}
          locked={readOnly}
          svgStyle={svgStyle}
          className={className}
        />
      )}
      controls={
        <div className={styles.sideStack} data-testid="measure-controls">
          <p className={styles.instructions}>
            {needStart ? S.route.instructionsStart : S.route.instructionsGo}
          </p>
          <p className={styles.status} role="status" data-testid="measure-message">
            {ui.message ?? ''}
          </p>
          {needStart ? (
            <div className={styles.row} role="group" aria-label={S.route.startGroup}>
              {startNodes.map((node) => (
                <Btn
                  key={node}
                  label={S.route.startButton(names[node] ?? node)}
                  action={`start:${node}`}
                  disabled={readOnly}
                  onClick={() => ui.send({ type: 'start', node })}
                />
              ))}
            </div>
          ) : (
            <div className={styles.row} role="group" aria-label={S.route.segmentGroup}>
              {state.segments.map((seg) => (
                <Btn
                  key={seg.key}
                  label={S.route.segmentButton(names[seg.a] ?? seg.a, names[seg.b] ?? seg.b)}
                  action={`segment:${seg.key}`}
                  primary={state.used.includes(seg.key)}
                  pressed={state.used.includes(seg.key)}
                  disabled={readOnly}
                  onClick={() => ui.send({ type: 'add-segment', key: seg.key })}
                />
              ))}
            </div>
          )}
          <div className={styles.row} role="group" aria-label={S.controlsLabel}>
            <Btn
              label={S.route.undo}
              action="undo"
              disabled={readOnly}
              onClick={() => ui.send({ type: 'undo' })}
            />
            <Btn
              label={S.route.reset}
              action="reset"
              disabled={readOnly}
              onClick={() => ui.send({ type: 'reset' })}
            />
          </div>
        </div>
      }
    />
  );
}
