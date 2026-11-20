import { LOWER_BOUND, SCALES } from './meta';
import type { AlgoId } from './types';
import type { SnapshotMap } from './results';

/** Paper HSO Eq. 14: PIR(%) = (makespan_other - makespan_proposed) * 100 / makespan_proposed. */
export function pir(other: number, proposed: number): number {
  return ((other - proposed) * 100) / proposed;
}

export function mean(map: SnapshotMap, n: number, algo: AlgoId): number | undefined {
  return map[n]?.results.find((r) => r.algorithm === algo)?.metrics.makespan.mean;
}

/**
 * Winner rule used throughout the deck: the hybrid with the lower mean makespan on the majority of
 * scales; ties are broken by the mean of makespan / lower bound over all scales.
 */
export function hybridWinner(map: SnapshotMap): { winner: AlgoId; wins: Record<string, number>; complete: boolean } {
  const wins: Record<string, number> = { HSO: 0, HMMGA: 0 };
  let ratioHso = 0;
  let ratioHmmga = 0;
  let complete = true;
  for (const n of SCALES) {
    const a = mean(map, n, 'HSO');
    const b = mean(map, n, 'HMMGA');
    if (a === undefined || b === undefined) {
      complete = false;
      continue;
    }
    if (a < b - 1e-6) wins.HSO++;
    else if (b < a - 1e-6) wins.HMMGA++;
    ratioHso += a / LOWER_BOUND[n];
    ratioHmmga += b / LOWER_BOUND[n];
  }
  const winner: AlgoId = wins.HSO !== wins.HMMGA ? (wins.HSO > wins.HMMGA ? 'HSO' : 'HMMGA') : ratioHso < ratioHmmga ? 'HSO' : 'HMMGA';
  return { winner, wins, complete };
}
