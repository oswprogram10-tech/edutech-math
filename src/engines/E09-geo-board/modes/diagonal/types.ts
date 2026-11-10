/**
 * diagonal 모드의 설정·상태·Action(T103).
 *
 * - 대각선은 꼭짓점 **번호 쌍**(정수)으로만 저장한다. 좌표는 화면 계산뿐이다.
 * - 쌍은 `[작은 번호, 큰 번호]`로 정규화해 같은 선분을 두 번 세지 않는다.
 * - 전체 대각선 수·완성 여부·규칙은 Observation에만 두고 화면에 쓰지 않는다.
 */
import type { JsonValue } from '../../../../core/engine-sdk';

/** 정규화한 꼭짓점 번호 쌍. `[작은 번호, 큰 번호]` */
export type DiagonalPair = readonly [number, number];

export interface DiagonalConfig {
  readonly mode: 'diagonal';
  /** 3~10 정수, 중복 제거. 기본 `[3, 4, 5, 6]`. */
  readonly polygons?: readonly number[];
  /** 이웃한 꼭짓점을 그으면 거절한다. 기본 true. */
  readonly rejectAdjacent?: boolean;
  /** 학생이 그은 수만 적는 개수 표. 기본 false. */
  readonly countTable?: boolean;
  /** 받기만 하고 무시한다(카드 고르기는 응답 `choice` 위젯 몫). */
  readonly polygonCards?: JsonValue;
}

export interface DiagonalSettings {
  readonly polygons: readonly number[];
  readonly rejectAdjacent: boolean;
  readonly countTable: boolean;
}

export type DiagonalRejectReason = 'adjacent' | 'duplicate';

export interface DiagonalRejection {
  readonly n: number;
  readonly pair: DiagonalPair;
  readonly reason: DiagonalRejectReason;
}

export interface DiagonalState {
  readonly mode: 'diagonal';
  /** `settings.polygons`의 인덱스. */
  readonly current: number;
  /** 고른 첫 꼭짓점. 없으면 null. */
  readonly pending: number | null;
  /** 다각형별 그은 대각선. 키는 꼭짓점 수 n의 문자열. */
  readonly drawn: Readonly<Record<string, readonly DiagonalPair[]>>;
  /** `rejectAdjacent: false`일 때 그은 변. 대각선 수에 넣지 않는다. */
  readonly sides: Readonly<Record<string, readonly DiagonalPair[]>>;
  readonly adjacentAttempts: number;
  readonly duplicateAttempts: number;
  readonly lastRejected: DiagonalRejection | null;
  readonly settings: DiagonalSettings;
}

export type DiagonalAction =
  | { readonly type: 'select-polygon'; readonly index: number }
  | { readonly type: 'pick-vertex'; readonly vertex: number }
  | { readonly type: 'undo-diagonal' }
  | { readonly type: 'clear-diagonals' };
