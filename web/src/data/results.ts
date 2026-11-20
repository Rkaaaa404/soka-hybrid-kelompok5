import { useEffect, useState } from 'react';
import type { AlgoId, AlgoResult, Snapshot } from './types';

const BASE = `${import.meta.env.BASE_URL}data/results/`;
const cache = new Map<number, Promise<Snapshot>>();

export function loadSnapshot(taskCount: number): Promise<Snapshot> {
  let p = cache.get(taskCount);
  if (!p) {
    p = fetch(`${BASE}gocj-${taskCount}.json`).then((r) => {
      if (!r.ok) throw new Error(`gocj-${taskCount}.json: HTTP ${r.status}`);
      return r.json() as Promise<Snapshot>;
    });
    cache.set(taskCount, p);
  }
  return p;
}

export type SnapshotMap = Partial<Record<number, Snapshot>>;

/** Loads all requested scales; returns what is available plus an error message if any failed. */
export function useSnapshots(scales: readonly number[]): { data: SnapshotMap; error: string | null } {
  const [data, setData] = useState<SnapshotMap>({});
  const [error, setError] = useState<string | null>(null);
  const key = scales.join(',');
  useEffect(() => {
    let alive = true;
    scales.forEach((n) =>
      loadSnapshot(n)
        .then((s) => alive && setData((d) => ({ ...d, [n]: s })))
        .catch((e: Error) => alive && setError(e.message)),
    );
    return () => {
      alive = false;
    };
  }, [key]);
  return { data, error };
}

export function byAlgo(s: Snapshot | undefined, algo: AlgoId): AlgoResult | undefined {
  return s?.results.find((r) => r.algorithm === algo);
}
