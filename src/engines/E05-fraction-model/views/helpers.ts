/** T049 새 화면이 함께 쓰는 작은 함수(React 컴포넌트 아님). */

export function isActivationKey(event: { key: string }): boolean {
  return event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar';
}

export function pathOf(points: readonly { x: number; y: number }[]): string {
  if (points.length === 0) return '';
  const [first, ...rest] = points;
  if (!first) return '';
  return `M ${first.x.toFixed(2)} ${first.y.toFixed(2)} ${rest
    .map((point) => `L ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(' ')} Z`;
}
