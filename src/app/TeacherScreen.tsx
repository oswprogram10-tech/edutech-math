/**
 * `#/teacher` — 교사 PIN 진입과 교사 첫 화면.
 *
 * PIN은 기기 안에 salt + SHA-256 해시로만 저장한다(T004).
 * 처음에는 4자리 PIN을 두 번 받아 만들고, 다음부터는 PIN을 확인한다.
 * PIN 분실 복구는 1단계에서 만들지 않는다.
 */
import { useEffect, useState } from 'react';
import { listEngineIds } from '../core/engine-sdk';
import type { JsonValue } from '../core/engine-sdk';
import {
  getStorage,
  isTeacherPinRecord,
  PinUnavailableError,
  saveTeacherPin,
  SETTINGS_KEYS,
  setEnabledUnits,
  verifyTeacherPin,
} from '../core/storage';
import type { Storage, StorageStatus } from '../core/storage';
import {
  constellationUnitIds,
  loadUnitSummaries,
  readEnabledUnitSetting,
  resolveEnabledUnitIds,
} from './content-units';
import type { UnitSummary } from './content-units';
import { teacherStrings } from './strings.ko';
import styles from './TeacherScreen.module.css';

type Phase = 'loading' | 'setup' | 'unlock' | 'home' | 'error';
type ErrorCode = 'wrongPin' | 'mismatch' | 'invalid' | 'unavailable' | 'saveError';

interface TeacherData {
  readonly storage: Storage;
  readonly status: StorageStatus;
}

function errorText(code: ErrorCode): string {
  switch (code) {
    case 'wrongPin':
      return teacherStrings.wrongPin;
    case 'mismatch':
      return teacherStrings.mismatch;
    case 'invalid':
      return teacherStrings.invalid;
    case 'unavailable':
      return teacherStrings.unavailable;
    case 'saveError':
      return teacherStrings.saveError;
  }
}

function onlyDigits(value: string): string {
  return value.replace(/\D/g, '').slice(0, 4);
}

function sortUnits(units: readonly UnitSummary[]): UnitSummary[] {
  return [...units].sort(
    (a, b) =>
      a.grade - b.grade || a.semester - b.semester || a.order - b.order || a.id.localeCompare(b.id),
  );
}

/**
 * 교사가 켠 단원만 학생 별자리에서 또렷하게 보인다.
 * 목록은 콘텐츠가 있는 단원(`demo` 제외)만 보여 준다.
 */
function UnitToggles({ storage }: { readonly storage: Storage }) {
  const [units, setUnits] = useState<readonly UnitSummary[] | null>(null);
  const [enabled, setEnabled] = useState<ReadonlySet<string>>(() => new Set());
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const ids = constellationUnitIds();
        const [all, raw] = await Promise.all([
          loadUnitSummaries(),
          readEnabledUnitSetting(storage),
        ]);
        if (cancelled) return;
        const byId = new Map(all.map((unit) => [unit.id, unit]));
        const list = sortUnits(
          ids.flatMap((id) => {
            const unit = byId.get(id);
            return unit ? [unit] : [];
          }),
        );
        setUnits(list);
        setEnabled(resolveEnabledUnitIds(raw, ids));
      } catch (reason) {
        console.warn('[app] 단원 목록을 불러오지 못했습니다.', reason);
        if (!cancelled) setError(true);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [storage]);

  const save = async (next: ReadonlySet<string>) => {
    setBusy(true);
    setError(false);
    setEnabled(next);
    try {
      await setEnabledUnits(storage, [...next]);
    } catch (reason) {
      console.warn('[app] 단원 설정을 저장하지 못했습니다.', reason);
      setError(true);
    } finally {
      setBusy(false);
    }
  };

  const toggle = (unitId: string, on: boolean) => {
    const next = new Set(enabled);
    if (on) next.add(unitId);
    else next.delete(unitId);
    void save(next);
  };

  return (
    <section className={styles.section} aria-labelledby="units-heading">
      <h2 id="units-heading" className={styles.sectionTitle}>
        {teacherStrings.unitsHeading}
      </h2>
      <p className={styles.status}>{teacherStrings.unitsHint}</p>

      {error ? (
        <p className={styles.error} role="alert">
          {teacherStrings.unitsError}
        </p>
      ) : null}

      {units === null ? (
        <p className={styles.status} role="status">
          {teacherStrings.unitsLoading}
        </p>
      ) : (
        <>
          <div className={styles.unitActions}>
            <button
              type="button"
              className={styles.link}
              disabled={busy}
              onClick={() => void save(new Set(units.map((unit) => unit.id)))}
            >
              {teacherStrings.enableAll}
            </button>
            <button
              type="button"
              className={styles.link}
              disabled={busy}
              onClick={() => void save(new Set())}
            >
              {teacherStrings.disableAll}
            </button>
          </div>

          <ul className={styles.unitList}>
            {units.map((unit) => (
              <li key={unit.id}>
                <label className={styles.unitRow}>
                  <input
                    type="checkbox"
                    className={styles.unitCheck}
                    checked={enabled.has(unit.id)}
                    disabled={busy}
                    onChange={(event) => toggle(unit.id, event.currentTarget.checked)}
                  />
                  <span className={styles.unitTitle}>{unit.title}</span>
                  <span className={styles.unitMeta}>
                    {teacherStrings.unitGrade(unit.grade, unit.semester)}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

export function TeacherScreen() {
  const [phase, setPhase] = useState<Phase>('loading');
  const [data, setData] = useState<TeacherData | null>(null);
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState<ErrorCode | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const storage = await getStorage();
        const [status, stored] = await Promise.all([
          storage.status(),
          storage.getSetting<JsonValue>(SETTINGS_KEYS.teacherPin),
        ]);
        if (cancelled) return;
        setData({ storage, status });
        setPhase(isTeacherPinRecord(stored) ? 'unlock' : 'setup');
      } catch (reason) {
        console.warn('[app] 교사 화면을 준비하지 못했습니다.', reason);
        if (!cancelled) setPhase('error');
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const createPin = async () => {
    if (!data || busy) return;
    if (pin.length !== 4 || confirmPin.length !== 4) {
      setError('invalid');
      return;
    }
    if (pin !== confirmPin) {
      setError('mismatch');
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await saveTeacherPin(data.storage, pin);
      setPin('');
      setConfirmPin('');
      setPhase('home');
    } catch (reason) {
      if (reason instanceof PinUnavailableError) {
        setError('unavailable');
      } else {
        console.warn('[app] 교사 PIN을 저장하지 못했습니다.', reason);
        setError('saveError');
      }
    } finally {
      setBusy(false);
    }
  };

  const unlock = async () => {
    if (!data || busy) return;
    if (pin.length !== 4) {
      setError('invalid');
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const ok = await verifyTeacherPin(data.storage, pin);
      if (ok) {
        setPin('');
        setPhase('home');
      } else {
        setPin('');
        setError('wrongPin');
      }
    } catch (reason) {
      if (reason instanceof PinUnavailableError) {
        setError('unavailable');
      } else {
        console.warn('[app] 교사 PIN을 확인하지 못했습니다.', reason);
        setError('saveError');
      }
    } finally {
      setBusy(false);
    }
  };

  if (phase === 'loading') {
    return (
      <main className={styles.screen}>
        <p role="status">{teacherStrings.loading}</p>
      </main>
    );
  }

  if (phase === 'error') {
    return (
      <main className={styles.screen}>
        <p role="alert">{teacherStrings.saveError}</p>
        <a className={styles.back} href="#/">
          {teacherStrings.back}
        </a>
      </main>
    );
  }

  if (phase === 'home' && data) {
    const engines = listEngineIds();
    return (
      <main className={styles.screen}>
        <header className={styles.header}>
          <div>
            <h1 className={styles.heading}>{teacherStrings.homeHeading}</h1>
            <p className={styles.hint}>{teacherStrings.homeHint}</p>
          </div>
          <a className={styles.back} href="#/">
            {teacherStrings.back}
          </a>
        </header>

        {data.status.backend === 'memory' ? (
          <p className={styles.notice} role="status">
            {teacherStrings.memoryNotice}
          </p>
        ) : null}
        {data.status.backend !== 'memory' && !data.status.persisted ? (
          <p className={styles.notice} role="status">
            {teacherStrings.persistentNotice}
          </p>
        ) : null}

        <section className={styles.section} aria-labelledby="demo-heading">
          <h2 id="demo-heading" className={styles.sectionTitle}>
            {teacherStrings.demoHeading}
          </h2>
          <p className={styles.status}>{teacherStrings.demoHint}</p>
          <a className={styles.primary} href="#/demo">
            {teacherStrings.demoOpen}
          </a>
        </section>

        <UnitToggles storage={data.storage} />

        <section className={styles.section} aria-labelledby="sandbox-heading">
          <h2 id="sandbox-heading" className={styles.sectionTitle}>
            {teacherStrings.sandboxHeading}
          </h2>
          <ul className={styles.list}>
            {engines.map((engineId) => (
              <li key={engineId}>
                <a className={styles.link} href={`#/sandbox/${engineId}`}>
                  {engineId}
                </a>
              </li>
            ))}
          </ul>
        </section>

        <section className={styles.section} aria-labelledby="storage-heading">
          <h2 id="storage-heading" className={styles.sectionTitle}>
            {teacherStrings.storageHeading}
          </h2>
          <p className={styles.status}>
            {data.status.backend === 'indexeddb'
              ? teacherStrings.backendIndexedDb
              : teacherStrings.backendMemory}
          </p>
          <p className={styles.status}>
            {data.status.persisted ? teacherStrings.persistedYes : teacherStrings.persistedUnknown}
          </p>
        </section>
      </main>
    );
  }

  const setup = phase === 'setup';

  return (
    <main className={styles.screen}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.heading}>
            {setup ? teacherStrings.setupHeading : teacherStrings.unlockHeading}
          </h1>
          {setup ? <p className={styles.hint}>{teacherStrings.setupHint}</p> : null}
        </div>
        <a className={styles.back} href="#/">
          {teacherStrings.back}
        </a>
      </header>

      <form
        className={styles.form}
        onSubmit={(event) => {
          event.preventDefault();
          if (setup) void createPin();
          else void unlock();
        }}
      >
        <label className={styles.field}>
          <span>{setup ? teacherStrings.newPin : teacherStrings.pin}</span>
          <input
            className={styles.input}
            type="password"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={4}
            autoComplete="off"
            value={pin}
            onChange={(event) => {
              setPin(onlyDigits(event.currentTarget.value));
              setError(null);
            }}
            disabled={busy}
          />
        </label>

        {setup ? (
          <label className={styles.field}>
            <span>{teacherStrings.confirmPin}</span>
            <input
              className={styles.input}
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={4}
              autoComplete="off"
              value={confirmPin}
              onChange={(event) => {
                setConfirmPin(onlyDigits(event.currentTarget.value));
                setError(null);
              }}
              disabled={busy}
            />
          </label>
        ) : null}

        {error ? (
          <p className={styles.error} role="alert">
            {errorText(error)}
          </p>
        ) : null}

        <button
          type="submit"
          className={styles.primary}
          disabled={busy || pin.length !== 4 || (setup && confirmPin.length !== 4)}
        >
          {setup ? teacherStrings.create : teacherStrings.enter}
        </button>
      </form>
    </main>
  );
}
