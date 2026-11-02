/**
 * 응답 슬롯의 엔진 모양 정의.
 *
 * 엔진 레지스트리에 등록하지 않는다. 실행기가 특별 슬롯 `response`를 만들 때만
 * 이 정의를 끼워 넣어, 되돌리기·기록·재생이 엔진 슬롯과 같은 경로를 쓰게 한다.
 */
import type { EngineDefinition, EngineId, LoadedEngine } from '../../engine-sdk';
import { observe } from './observe';
import { createInitialState, reduce } from './reduce';
import { ResponseView } from './ResponseView';
import { responseStrings } from './strings.ko';
import type { ResponseAction, ResponseConfig, ResponseState } from './types';

const definition: EngineDefinition<ResponseConfig, ResponseState, ResponseAction> = {
  id: 'response' as EngineId,
  name: responseStrings.name,
  modes: ['response'],
  createInitialState,
  reduce,
  View: ResponseView,
  observe,
  events: [],
};

/** SlotView.definition에 넣기 위한 LoadedEngine 모양. 레지스트리에는 없다. */
export const responseDefinition = definition as unknown as LoadedEngine;
