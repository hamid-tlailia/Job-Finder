import { BackgroundRunner } from '@capacitor/background-runner';
import type { Job } from '../core/types';
import { dedupeKey } from '../core/match';
import { useStore } from '../store/useStore';
import { isNative } from './http';

const LABEL = 'qa.jobfinder.app.check';

/** Copies what the background check needs (profile, keys, already-known jobs) into the runner's storage. */
export async function syncBackground(): Promise<void> {
  if (!isNative) return;
  const { profile, settings, jobs, matches } = useStore.getState();
  const known = Object.values(jobs).flatMap((j) => [j.id, dedupeKey(j)]);
  try {
    await BackgroundRunner.dispatchEvent({
      label: LABEL,
      event: 'sync',
      details: {
        profile: { ...profile, cvText: '', tracks: (profile.tracks ?? []).map((t) => ({ ...t, cvText: '' })) },
        keys: { jooble: settings.joobleKey, serpapi: settings.serpapiKey },
        sources: settings.sources,
        uiLang: settings.uiLang,
        notifications: settings.notifications,
        known: known.slice(-1500),
        waiting: Object.values(matches).filter((m) => m.status === 'ready' && jobs[m.jobId]).length,
        syncedAt: Date.now(),
      },
    });
  } catch {
    /* runner unavailable (e.g. first launch) */
  }
}

/** Pulls jobs the background check found while the app was closed. */
export async function drainBackground(): Promise<Job[]> {
  if (!isNative) return [];
  try {
    const r = (await BackgroundRunner.dispatchEvent({ label: LABEL, event: 'drain', details: {} })) as { jobs?: Job[] } | undefined;
    return r?.jobs ?? [];
  } catch {
    return [];
  }
}

export interface BackgroundStatus {
  at?: string;
  found?: number;
  fresh?: number;
  error?: string;
}

/** Result of the last background check (scheduled or manual). */
export async function backgroundStatus(): Promise<BackgroundStatus> {
  if (!isNative) return {};
  try {
    return ((await BackgroundRunner.dispatchEvent({ label: LABEL, event: 'status', details: {} })) as BackgroundStatus | undefined) ?? {};
  } catch {
    return {};
  }
}

/** Runs the same check the OS schedules hourly, right now (used to verify notifications work). */
export async function runBackgroundCheckNow(): Promise<BackgroundStatus> {
  if (!isNative) return {};
  await syncBackground();
  await BackgroundRunner.dispatchEvent({ label: LABEL, event: 'checkJobs', details: {} });
  return backgroundStatus();
}
