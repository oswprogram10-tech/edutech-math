/**
 * angle 모드의 설정·상태·Action(T102).
 *
 * 이 모드의 각은 **정수 도(°)**로 정의한다. 격자 좌표로 만든 각의 도 값은 대개
 * 무리수이므로 설정이 정수 도로 주고, 비교도 정수로 한다. 변을 그릴 때만
 * `Math.cos`/`Math.sin`(화면 number)을 쓴다.
 *
 * 각의 크기·종류는 Observation에만 두고 화면 글자로 쓰지 않는다.
 */

export type AngleTool = 'protractor';

export interface AngleSpec {
  readonly id?: string;
  /** 1~180 정수. */
  readonly degrees: number;
  /** 첫 변 방향. 0~359 정수(0 = 오른쪽, 화면에서 반시계). 기본 0. */
  readonly base?: number;
  /** 두 변 길이 비율. 0.4~1. 기본 [1, 1]. */
  readonly arms?: readonly [number, number];
}

export interface AnglePuzzleConfig {
  readonly type: 'laser-mirror';
  /** 1~179 정수. */
  readonly targetAngle: number;
}

export interface AngleConfig {
  readonly mode: 'angle';
  /** 유일한 값. */
  readonly tool?: AngleTool;
  /** 1~6개. 없으면 `[{ id: 'a1', degrees: 50 }]`. */
  readonly angles?: readonly AngleSpec[];
  /** 기본 false. */
  readonly highlightActiveScale?: boolean;
  /** 기본 false. 어림을 정하기 전에는 읽기를 거절한다. */
  readonly estimateFirst?: boolean;
  readonly puzzle?: AnglePuzzleConfig;
}

export interface AngleSetting {
  readonly id: string;
  readonly degrees: number;
  readonly base: number;
  readonly arms: readonly [number, number];
}

export interface AnglePuzzleSetting {
  readonly type: 'laser-mirror';
  readonly targetAngle: number;
}

export interface AngleSettings {
  readonly tool: AngleTool;
  readonly angles: readonly AngleSetting[];
  readonly highlightActiveScale: boolean;
  readonly estimateFirst: boolean;
  readonly puzzle: AnglePuzzleSetting | null;
}

export interface AngleEntry {
  readonly estimate: number | null;
  readonly reading: number | null;
  readonly readingAligned: boolean | null;
}

export interface AnglePuzzleState {
  readonly estimate: number | null;
  readonly fired: readonly number[];
}

export interface AngleState {
  readonly mode: 'angle';
  readonly current: number;
  /** `on`은 각 id 또는 `'launcher'`. */
  readonly protractor: { readonly on: string | null; readonly rotation: number };
  readonly entries: Readonly<Record<string, AngleEntry>>;
  readonly puzzle: AnglePuzzleState | null;
  readonly settings: AngleSettings;
}

export type AngleAction =
  | { readonly type: 'select-angle'; readonly index: number }
  | { readonly type: 'place-protractor'; readonly on: string }
  | { readonly type: 'lift-protractor' }
  | { readonly type: 'rotate-protractor'; readonly rotation: number }
  | { readonly type: 'set-estimate'; readonly angle: string; readonly value: number }
  | { readonly type: 'set-reading'; readonly angle: string; readonly value: number }
  | { readonly type: 'set-launch-estimate'; readonly value: number }
  | { readonly type: 'fire'; readonly angle: number };
