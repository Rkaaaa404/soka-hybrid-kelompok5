import { Evaluator } from './evaluator';
import { maxMin, type MaxMinResult } from './maxmin';
import { Mulberry32 } from './rng';
import type { LabTask, LabVm } from './types';

/**
 * In-browser port of HmmgaScheduler.java (same RNG call order), instrumented so every generation
 * can be replayed by the 3D lab: who was copied, which pairs crossed over (and where), which genes
 * mutated, the adaptive Pc/Pm values and the load-balance migrations.
 */
export interface HmmgaParams {
  population: number;
  generations: number;
  k1: number;
  k2: number;
  k3: number;
  k4: number;
  crossoverShare: number;
  migrationMoves: number;
  seed: number;
}

export const DEFAULT_LAB_PARAMS: HmmgaParams = {
  population: 12,
  generations: 40,
  k1: 1.0,
  k2: 0.5,
  k3: 1.0,
  k4: 0.5,
  crossoverShare: 0.6,
  migrationMoves: 20,
  seed: 42,
};

export type Origin = 'maxmin' | 'seeded' | 'random' | 'elite' | 'copy' | 'cross' | 'clone';

export interface Individual {
  genes: number[];
  makespan: number;
  origin: Origin;
  parents?: [number, number];
  cut?: [number, number];
  pc?: number;
  pm?: number;
  mutated?: number[];
}

export interface Migration {
  task: number;
  from: number;
  to: number;
  before: number;
  after: number;
}

export interface Generation {
  index: number; // 0 = initial population
  population: Individual[];
  fmax: number;
  favg: number;
  bestIdx: number;
  bestMakespan: number; // best-so-far
  migrations: Migration[];
}

export interface HmmgaRun {
  maxMin: MaxMinResult;
  maxMinMakespan: number;
  generations: Generation[];
  best: number[];
  bestMakespan: number;
  taskOrder: number[];
}

export function runHmmga(tasks: LabTask[], vms: LabVm[], P: HmmgaParams): HmmgaRun {
  const n = tasks.length;
  const m = vms.length;
  const rng = new Mulberry32(P.seed);
  const mm = maxMin(tasks, vms);
  const ev = new Evaluator(tasks, vms, mm.taskOrder);

  // Step 4: population around the Max-Min mapping
  const p = P.population;
  const seeded = Math.max(1, Math.floor(p / 5));
  const lightMut = Math.max(1, Math.floor(n / 100));
  let pop: Individual[] = [];
  for (let s = 0; s < p; s++) {
    let genes: number[];
    let origin: Origin;
    if (s === 0) {
      genes = [...mm.assignedVm];
      origin = 'maxmin';
    } else if (s < seeded) {
      genes = [...mm.assignedVm];
      for (let k = 0; k < lightMut; k++) genes[rng.nextInt(n)] = rng.nextInt(m);
      origin = 'seeded';
    } else {
      genes = Array.from({ length: n }, () => rng.nextInt(m));
      origin = 'random';
    }
    pop.push({ genes, makespan: ev.makespan(genes), origin });
  }
  const maxMinMakespan = pop[0].makespan;
  let bestIdx = argMin(pop);
  let best = [...pop[bestIdx].genes];
  let bestMs = pop[bestIdx].makespan;

  const stats = (ps: Individual[]) => {
    let fmax = 0;
    let fsum = 0;
    for (const ind of ps) {
      const f = 1 / ind.makespan;
      fsum += f;
      if (f > fmax) fmax = f;
    }
    return { fmax, favg: fsum / ps.length, fsum };
  };

  const s0 = stats(pop);
  const generations: Generation[] = [
    { index: 0, population: pop, fmax: s0.fmax, favg: s0.favg, bestIdx, bestMakespan: bestMs, migrations: [] },
  ];

  const copyCount = Math.max(1, Math.round((1 - P.crossoverShare) * p));
  const mutGenes = Math.max(1, Math.floor(n / 500));

  for (let gen = 0; gen < P.generations; gen++) {
    const f = pop.map((ind) => 1 / ind.makespan);
    const { fmax, favg, fsum } = stats(pop);
    const spread = Math.max(1e-15, fmax - favg);
    const next: Individual[] = [];

    const elite = argMin(pop);
    next.push({ ...pop[elite], origin: 'elite', parents: [elite, elite], mutated: undefined, cut: undefined });
    while (next.length < copyCount) {
      const s = roulette(f, fsum, rng);
      next.push({ ...pop[s], origin: 'copy', parents: [s, s], mutated: undefined, cut: undefined });
    }

    while (next.length < p) {
      const a = roulette(f, fsum, rng);
      const b = roulette(f, fsum, rng);
      const fPrime = Math.max(f[a], f[b]);
      const pc = fPrime >= favg ? (P.k1 * (fmax - fPrime)) / spread : P.k3;
      const c1 = [...pop[a].genes];
      const c2 = [...pop[b].genes];
      let cut: [number, number] | undefined;
      if (rng.nextDouble() < pc && n > 1) {
        let cut1 = rng.nextInt(n);
        let cut2 = rng.nextInt(n);
        if (cut1 > cut2) [cut1, cut2] = [cut2, cut1];
        for (let i = cut1; i <= cut2; i++) [c1[i], c2[i]] = [c2[i], c1[i]];
        cut = [cut1, cut2];
      }
      for (const [child, parents] of [
        [c1, [a, b]],
        [c2, [b, a]],
      ] as [number[], [number, number]][]) {
        if (next.length >= p) break;
        next.push({ genes: child, makespan: ev.makespan(child), origin: cut ? 'cross' : 'clone', parents, cut, pc });
      }
    }

    for (let s = 1; s < p; s++) {
      const fs = 1 / next[s].makespan;
      const pm = fs >= favg ? (P.k2 * (fmax - fs)) / spread : P.k4;
      next[s].pm = pm;
      if (rng.nextDouble() >= pm) continue;
      const genes = [...next[s].genes];
      const fin = ev.vmFinish(next[s].genes);
      let lightest = 0;
      for (let v = 1; v < m; v++) if (fin[v] < fin[lightest]) lightest = v;
      const mutated: number[] = [];
      for (let k = 0; k < mutGenes; k++) {
        const i = rng.nextInt(n);
        genes[i] = rng.nextBoolean() ? rng.nextInt(m) : lightest;
        mutated.push(i);
      }
      next[s] = { ...next[s], genes, makespan: ev.makespan(genes), mutated };
    }

    const gBest = argMin(next);
    const migrations: Migration[] = [];
    if (P.migrationMoves > 0) {
      const genes = migrate(ev, next[gBest].genes, 1.0, P.migrationMoves, migrations);
      if (migrations.length > 0) next[gBest] = { ...next[gBest], genes, makespan: ev.makespan(genes) };
    }

    pop = next;
    if (pop[gBest].makespan < bestMs) {
      bestMs = pop[gBest].makespan;
      best = [...pop[gBest].genes];
    }
    bestIdx = gBest;
    generations.push({ index: gen + 1, population: pop, fmax, favg, bestIdx, bestMakespan: bestMs, migrations });
  }

  return { maxMin: mm, maxMinMakespan, generations, best, bestMakespan: bestMs, taskOrder: mm.taskOrder };
}

/** Port of LoadState.migrateOverloaded (lexicographic best-improvement over all VMs). */
function migrate(ev: Evaluator, input: number[], threshold: number, maxMoves: number, log: Migration[]): number[] {
  const eps = 1e-9;
  const assign = [...input];
  const m = ev.vms.length;
  const buckets = ev.buckets(assign);
  const finish = buckets.map((ids, v) => ev.simulate(v, ids));
  const makespan = () => Math.max(...finish);
  const move = (t: number, to: number) => {
    const from = assign[t];
    buckets[from] = buckets[from].filter((x) => x !== t);
    buckets[to] = [...buckets[to], t].sort((a, b) => a - b);
    assign[t] = to;
    finish[from] = ev.simulate(from, buckets[from]);
    finish[to] = ev.simulate(to, buckets[to]);
    return makespan();
  };

  for (let step = 0; step < maxMoves; step++) {
    let src = 0;
    let sum = 0;
    for (let v = 0; v < m; v++) {
      sum += finish[v];
      if (finish[v] > finish[src]) src = v;
    }
    const mean = sum / m;
    if (mean <= 0 || finish[src] / mean <= threshold || buckets[src].length === 0) break;
    const before = makespan();
    let bestAfter = Infinity;
    let bestLocal = Infinity;
    let bestTask = -1;
    let bestDst = -1;
    for (const t of candidateTasks(ev, buckets[src])) {
      for (let dst = 0; dst < m; dst++) {
        if (dst === src) continue;
        const after = move(t, dst);
        const local = Math.max(finish[src], finish[dst]);
        const valid = after <= before + eps && local < before - eps;
        const better = after < bestAfter - eps || (Math.abs(after - bestAfter) <= eps && local < bestLocal - eps);
        if (valid && better) {
          bestAfter = after;
          bestLocal = local;
          bestTask = t;
          bestDst = dst;
        }
        move(t, src);
      }
    }
    if (bestTask < 0) break;
    const after = move(bestTask, bestDst);
    log.push({ task: bestTask, from: src, to: bestDst, before, after });
  }
  return assign;
}

function candidateTasks(ev: Evaluator, ids: number[]): number[] {
  const largest: number[] = [];
  const lens: number[] = [];
  for (const t of ids) {
    const len = ev.tasks[t].lengthMi;
    for (let j = 0; j < 3; j++) {
      if (j >= largest.length || len > lens[j]) {
        largest.splice(j, 0, t);
        lens.splice(j, 0, len);
        if (largest.length > 3) {
          largest.pop();
          lens.pop();
        }
        break;
      }
    }
  }
  const out = [...largest];
  for (let i = ids.length - 1; i >= 0 && i >= ids.length - 3; i--) {
    if (!largest.includes(ids[i])) out.push(ids[i]);
  }
  return out;
}

function roulette(f: number[], total: number, rng: Mulberry32): number {
  const r = rng.nextDouble() * total;
  let acc = 0;
  for (let i = 0; i < f.length; i++) {
    acc += f[i];
    if (acc >= r) return i;
  }
  return f.length - 1;
}

function argMin(pop: Individual[]): number {
  let b = 0;
  for (let i = 1; i < pop.length; i++) if (pop[i].makespan < pop[b].makespan) b = i;
  return b;
}
