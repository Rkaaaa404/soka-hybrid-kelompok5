import type { LabTask, LabVm } from './types';

export interface MaxMinStep {
  task: number;
  vm: number;
  pe: number;
  start: number;
  completion: number;
  /** best completion time of every still-unmapped task at this step (selected = max of these) */
  candidates: { task: number; completion: number; vm: number }[];
}

export interface MaxMinResult {
  taskOrder: number[];
  assignedVm: number[];
  steps: MaxMinStep[];
}

/** Port of BaselineSchedulers.runMinMax(isMaxMin = true) with per-step recording. */
export function maxMin(tasks: LabTask[], vms: LabVm[]): MaxMinResult {
  const n = tasks.length;
  const m = vms.length;
  const peFree = vms.map((vm) => new Array(vm.pes).fill(0) as number[]);
  const scheduled = new Array(n).fill(false);
  const bestC = new Array(n).fill(0);
  const bestV = new Array(n).fill(-1);
  const bestP = new Array(n).fill(-1);
  const taskOrder: number[] = [];
  const assignedVm = new Array(n).fill(0);
  const steps: MaxMinStep[] = [];

  const computeBest = (i: number) => {
    let minFinish = Infinity;
    let cv = -1;
    let cp = -1;
    for (let v = 0; v < m; v++) {
      for (let p = 0; p < vms[v].pes; p++) {
        const start = Math.max(tasks[i].arrivalTime, peFree[v][p]);
        const finish = start + tasks[i].lengthMi / vms[v].mips;
        if (finish < minFinish || (finish === minFinish && (cv === -1 || v < cv || (v === cv && p < cp)))) {
          minFinish = finish;
          cv = v;
          cp = p;
        }
      }
    }
    bestC[i] = minFinish;
    bestV[i] = cv;
    bestP[i] = cp;
  };

  for (let i = 0; i < n; i++) computeBest(i);

  for (let step = 0; step < n; step++) {
    let sel = -1;
    let target = -Infinity;
    const candidates: MaxMinStep['candidates'] = [];
    for (let i = 0; i < n; i++) {
      if (scheduled[i]) continue;
      candidates.push({ task: i, completion: bestC[i], vm: bestV[i] });
      if (bestC[i] > target || (bestC[i] === target && (sel === -1 || i < sel))) {
        target = bestC[i];
        sel = i;
      }
    }
    scheduled[sel] = true;
    const v = bestV[sel];
    const p = bestP[sel];
    assignedVm[sel] = v;
    taskOrder.push(sel);
    const duration = tasks[sel].lengthMi / vms[v].mips;
    steps.push({ task: sel, vm: v, pe: p, start: bestC[sel] - duration, completion: bestC[sel], candidates });
    peFree[v][p] = bestC[sel];
    for (let i = 0; i < n; i++) {
      if (!scheduled[i] && bestV[i] === v) computeBest(i);
    }
  }
  return { taskOrder, assignedVm, steps };
}
