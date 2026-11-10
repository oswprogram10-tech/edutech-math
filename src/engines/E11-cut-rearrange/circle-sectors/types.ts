/** circle-sectors 모드의 설정·상태·Action. */
export type CircleDimensionMode = 'off' | 'lines' | 'named';

export interface CircleSectorsConfig {
  readonly mode?: 'circle-sectors';
  readonly radius?: number | string;
  readonly pi?: number | string;
  readonly divisions?: readonly number[];
  readonly manualUpTo?: number;
  readonly showDimensions?: boolean | 'lines' | 'named';
}

export interface CircleSectorsSettings {
  readonly radius: string;
  readonly pi: string;
  readonly divisions: readonly number[];
  readonly manualUpTo: number;
  readonly showDimensions: CircleDimensionMode;
}

export interface CircleSlot {
  readonly sector: number;
  readonly arcUp: boolean;
}

export interface CircleSectorsState {
  readonly mode: 'circle-sectors';
  readonly level: number;
  readonly slots: readonly (CircleSlot | null)[];
  readonly autoArranged: boolean;
  readonly arrangedDivisions: readonly number[];
  readonly settings: CircleSectorsSettings;
}

export type CircleSectorsAction =
  | { readonly type: 'set-level'; readonly level: number }
  | {
      readonly type: 'place-sector';
      readonly sector: number;
      readonly slot: number;
      readonly arcUp: boolean;
    }
  | { readonly type: 'unplace-sector'; readonly sector: number }
  | { readonly type: 'auto-arrange' };
