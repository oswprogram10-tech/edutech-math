/**
 * `#/map`의 자료 로딩 래퍼.
 *
 * 지식 그래프·단원 메타데이터·숙달 기록·켠 단원·활동 목록을 읽어
 * 순수 배치(`layoutStars`)와 화면(`StarMapView`)에 넘긴다.
 * 쓰기는 하지 않는다. 교사 화면에서 단원을 켜고 끄는 것만 storage에 저장한다.
 */
import { useEffect, useState } from 'react';
import { loadKnowledgeGraph } from '../../core/knowledge';
import type { KnowledgeGraph } from '../../core/knowledge';
import { loadUnitContent } from '../../core/runner';
import type { ContentActivity, UnitContent } from '../../core/runner';
import type { LearnerId, Storage } from '../../core/storage';
import {
  constellationUnitIds,
  loadUnitSummaries,
  readEnabledUnitSetting,
  resolveEnabledUnitIds,
} from '../content-units';
import { navigate } from '../router';
import { starMapStrings } from '../strings.ko';
import { brightnessByConcept, sparkleConcepts } from './brightness';
import type { Brightness } from './brightness';
import { layoutStars } from './layout';
import type { LayoutConcept, StarMapLayout } from './layout';
import { StarMapView } from './StarMapView';
import styles from './StarMap.module.css';

export interface StarMapProps {
  readonly storage: Storage;
  readonly learner: LearnerId;
  readonly targetSize: number;
}

interface StarMapData {
  readonly layout: StarMapLayout;
  readonly brightness: ReadonlyMap<string, Brightness>;
  readonly sparkle: ReadonlySet<string>;
  readonly enabledUnits: ReadonlySet<string>;
  readonly activitiesByConcept: ReadonlyMap<string, readonly ContentActivity[]>;
}

function layoutConcepts(graph: KnowledgeGraph): LayoutConcept[] {
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
  return concepts;
}

function indexActivities(
  contents: readonly (UnitContent | undefined)[],
): Map<string, readonly ContentActivity[]> {
  const byConcept = new Map<string, ContentActivity[]>();
  const seen = new Map<string, Set<string>>();

  for (const content of contents) {
    if (!content) continue;
    for (const activity of content.activities) {
      for (const task of activity.tasks) {
        for (const conceptId of task.concepts) {
          let activityIds = seen.get(conceptId);
          if (!activityIds) {
            activityIds = new Set();
            seen.set(conceptId, activityIds);
          }
          if (activityIds.has(activity.id)) continue;
          activityIds.add(activity.id);
          const list = byConcept.get(conceptId);
          if (list) list.push(activity);
          else byConcept.set(conceptId, [activity]);
        }
      }
    }
  }

  return byConcept;
}

async function loadOptionalContent(unitId: string): Promise<UnitContent | undefined> {
  try {
    return await loadUnitContent(unitId);
  } catch (error) {
    console.warn(`[map] ${unitId} 활동을 불러오지 못했습니다.`, error);
    return undefined;
  }
}

export function StarMap({ storage, learner, targetSize }: StarMapProps) {
  const [data, setData] = useState<StarMapData | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const [graph, units, mastery, events, rawEnabled] = await Promise.all([
          loadKnowledgeGraph(),
          loadUnitSummaries(),
          storage.listMastery(),
          storage.listEvents(),
          readEnabledUnitSetting(storage),
        ]);
        const unitIds = constellationUnitIds();
        const contents = await Promise.all(unitIds.map(loadOptionalContent));
        if (cancelled) return;

        const enabledUnits = resolveEnabledUnitIds(rawEnabled, unitIds);
        setData({
          layout: layoutStars(units, layoutConcepts(graph)),
          brightness: brightnessByConcept(mastery, learner),
          sparkle: sparkleConcepts(events, learner),
          enabledUnits,
          activitiesByConcept: indexActivities(contents),
        });
      } catch (reason) {
        console.warn('[map] 별자리를 불러오지 못했습니다.', reason);
        if (!cancelled) setError(true);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [learner, storage]);

  if (error) {
    return (
      <div className={styles.state}>
        <p role="alert">{starMapStrings.loadError}</p>
        <a className={styles.homeLink} href="#/">
          {starMapStrings.home}
        </a>
      </div>
    );
  }

  if (data === null) {
    return (
      <div className={styles.state}>
        <p role="status">{starMapStrings.loading}</p>
      </div>
    );
  }

  return (
    <StarMapView
      layout={data.layout}
      brightness={data.brightness}
      sparkle={data.sparkle}
      enabledUnits={data.enabledUnits}
      activitiesByConcept={data.activitiesByConcept}
      targetSize={targetSize}
      onOpenActivity={(activityId) => navigate({ kind: 'activity', activityId })}
    />
  );
}
