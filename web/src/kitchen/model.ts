import type { Evaluator } from '../sim/evaluator';
import { LAB_VMS, VM_COLORS } from '../sim/lab';
import { SAMPLE_TASKS } from '../sim/sample';
import type { Placement } from '../sim/types';

/**
 * Cloud Kitchen metaphor: one host of the real scenario becomes one kitchen.
 *   VM            -> a chef; PE count -> burners on the chef's stove; MIPS -> cooking speed
 *   task (GoCJ)   -> an online order (rantang); length in MI -> portion size; arrival -> order time
 *   makespan      -> the time the last order is finished
 */
export const TASKS = SAMPLE_TASKS;
export const VMS = LAB_VMS;
export const CHEF_COLORS = VM_COLORS;
export const CHEF_NAMES = ['Koki Junior 1', 'Koki Junior 2', 'Koki Senior 1', 'Koki Senior 2', 'Kepala Koki'];
export const CHEF_ROLE = ['Small VM', 'Small VM', 'Medium VM', 'Medium VM', 'Large VM'];

/**
 * Lower bound for the demo kitchen = max of
 *  - every order needs at least length / 2000 MIPS after it arrives (fastest single burner), and
 *  - all orders arriving from time a on need their total work / total kitchen speed (13,000 MIPS).
 */
const KITCHEN_MIPS = LAB_VMS.reduce((s, vm) => s + vm.mips * vm.pes, 0);
const ARRIVAL_LB = Math.max(...TASKS.map((t) => t.arrivalTime + t.lengthMi / 2000));
const WORK_LB = Math.max(
  ...TASKS.map((t) => t.arrivalTime + TASKS.filter((u) => u.arrivalTime >= t.arrivalTime).reduce((s, u) => s + u.lengthMi, 0) / KITCHEN_MIPS),
);
export const LAB_LB = Math.max(ARRIVAL_LB, WORK_LB);
export const LAB_LB_PARTS = { arrival: ARRIVAL_LB, work: WORK_LB, mips: KITCHEN_MIPS };
export const MAX_MI = Math.max(...TASKS.map((t) => t.lengthMi));

export const BURNER_GAP = 0.82;
const STATION_PAD = 0.62;
const STATION_GAP = 0.75;

export const STATION_WIDTH = VMS.map((vm) => STATION_PAD * 2 + (vm.pes - 1) * BURNER_GAP + 0.4);
const total = STATION_WIDTH.reduce((a, b) => a + b, 0) + STATION_GAP * (VMS.length - 1);
export const STATION_X: number[] = [];
{
  let x = -total / 2;
  STATION_WIDTH.forEach((w) => {
    STATION_X.push(x + w / 2);
    x += w + STATION_GAP;
  });
}
export const KITCHEN_HALF_WIDTH = total / 2;
export const BURNER_X = VMS.map((vm, v) => Array.from({ length: vm.pes }, (_, p) => STATION_X[v] + (p - (vm.pes - 1) / 2) * BURNER_GAP));

/** z of the pass shelf where finished rantang towers stand, and its top surface. */
export const PASS_Z = 0.78;
export const PASS_TOP = 1.02;
/** Tallest tower height (world units) for the current time scale. */
export const TOWER_MAX = 3.1;

/** Order board (queue) at the left of the kitchen. */
export const BOARD = { x: -KITCHEN_HALF_WIDTH - 3.4, z: -0.4, cols: 6, dx: 0.66, dy: 0.62, y0: 0.55 };
export function boardSlot(t: number): [number, number, number] {
  const c = t % BOARD.cols;
  const r = Math.floor(t / BOARD.cols);
  return [BOARD.x + (c - (BOARD.cols - 1) / 2) * BOARD.dx, BOARD.y0 + (4 - r) * BOARD.dy, BOARD.z + 0.35];
}

/** Placements for a partial plan (assign[t] < 0 = still waiting on the order board). */
export function partialPlacements(ev: Evaluator, assign: number[]): Placement[] {
  const buckets: number[][] = VMS.map(() => []);
  assign.forEach((v, t) => v >= 0 && buckets[v].push(t));
  const out: Placement[] = [];
  buckets.forEach((ids, v) => ids.length && ev.simulate(v, ids, out));
  return out;
}

export function planStats(ev: Evaluator, assign: number[]) {
  const placements = partialPlacements(ev, assign);
  const vmFinish = VMS.map(() => 0);
  for (const p of placements) vmFinish[p.vm] = Math.max(vmFinish[p.vm], p.finish);
  const makespan = Math.max(0, ...vmFinish);
  const bottleneck = makespan > 0 ? vmFinish.indexOf(makespan) : -1;
  const byTask = new Map(placements.map((p) => [p.task, p]));
  return { placements, byTask, vmFinish, makespan, bottleneck };
}

export function roundRobin(): number[] {
  return TASKS.map((_, t) => t % VMS.length);
}

export const fmtS = (s: number) => `${Math.round(s)} s`;
