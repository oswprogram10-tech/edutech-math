/**
 * `prism-pyramid` 힌트 ② 오버레이가 함께 쓰는 작은 입체 그림(정사영, 개수·번호 없음).
 */
import {
  hiddenPrismEdges,
  hiddenPrismVertices,
  polygonPoints,
  prismScaleForStage,
  projectPrismPoint,
  viewBasis,
  visiblePrismFaces,
  type PrismModel,
  type XrayViewAngle,
} from '../prism/geometry';

interface PrismMiniSolidProps {
  readonly model: PrismModel;
  readonly view: XrayViewAngle;
  readonly width: number;
  readonly height: number;
  /** true면 숨은 모서리를 굵은 주황 점선, 숨은 꼭짓점을 속 빈 원으로 그린다. */
  readonly showHidden?: boolean;
  /** true면 옅게(고스트) 그린다. */
  readonly ghost?: boolean;
  readonly testIdPrefix?: string;
}

export function PrismMiniSolid({
  model,
  view,
  width,
  height,
  showHidden = false,
  ghost = false,
  testIdPrefix,
}: PrismMiniSolidProps) {
  const basis = viewBasis(view);
  const scale = prismScaleForStage(width, height);
  const proj = (p: readonly [number, number, number]) =>
    projectPrismPoint(p, basis, scale, width, height);
  const visible = new Set(visiblePrismFaces(model, view));
  const hiddenEdgeSet = new Set(hiddenPrismEdges(model, view));
  const hiddenVertexIds = hiddenPrismVertices(model, view);

  const faces = (showHidden ? model.faces : model.faces.filter((f) => visible.has(f.id)))
    .map((f) => ({
      id: f.id,
      depth: proj(f.center).depth,
      points: polygonPoints(f.points.map(proj)),
    }))
    .sort((a, b) => a.depth - b.depth);

  return (
    <g opacity={ghost ? 0.45 : 1}>
      {faces.map((f) => (
        <polygon
          key={`mf-${f.id}`}
          points={f.points}
          fill={showHidden ? '#e2e8f0' : '#ffffff'}
          fillOpacity={showHidden ? 0.35 : 0.9}
          stroke="none"
        />
      ))}
      {showHidden
        ? model.edges
            .filter((e) => hiddenEdgeSet.has(e.id))
            .map((e) => {
              const pa = proj(e.a);
              const pb = proj(e.b);
              return (
                <line
                  key={`mh-${e.id}`}
                  data-testid={testIdPrefix ? `${testIdPrefix}-edge-${e.id}` : undefined}
                  x1={pa.x}
                  y1={pa.y}
                  x2={pb.x}
                  y2={pb.y}
                  stroke="#ea580c"
                  strokeWidth={2.8}
                  strokeDasharray="6 4"
                  strokeLinecap="round"
                />
              );
            })
        : null}
      {model.edges
        .filter((e) => !hiddenEdgeSet.has(e.id))
        .map((e) => {
          const pa = proj(e.a);
          const pb = proj(e.b);
          return (
            <line
              key={`mv-${e.id}`}
              x1={pa.x}
              y1={pa.y}
              x2={pb.x}
              y2={pb.y}
              stroke="#334155"
              strokeWidth={1.6}
              strokeLinecap="round"
            />
          );
        })}
      {showHidden
        ? hiddenVertexIds.map((id) => {
            const v = model.vertices.find((x) => x.id === id);
            if (!v) return null;
            const pt = proj(v.p);
            return (
              <circle
                key={`mhv-${id}`}
                data-testid={testIdPrefix ? `${testIdPrefix}-vertex-${id}` : undefined}
                cx={pt.x}
                cy={pt.y}
                r={5}
                fill="#ffffff"
                stroke="#ea580c"
                strokeWidth={2.2}
              />
            );
          })
        : null}
    </g>
  );
}
