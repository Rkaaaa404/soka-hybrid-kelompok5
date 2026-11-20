import type { LabTask, LabVm, Placement } from './types';

/**
 * Port of ScheduleEvaluator / ScheduleDecoder (full capacity): each VM is simulated independently,
 * tasks are ingested in arrival order, the ready queue is ordered by priority rank, and a task
 * starts on the lowest-index free PE.
 */
export class Evaluator {
  readonly rank: number[];

  constructor(readonly tasks: LabTask[], readonly vms: LabVm[], taskOrder: number[]) {
    this.rank = new Array(tasks.length);
    taskOrder.forEach((t, i) => (this.rank[t] = i));
  }

  duration(t: number, v: number): number {
    return this.tasks[t].lengthMi / this.vms[v].mips;
  }

  /** Simulates VM v on ascending task ids; optionally records placements. */
  simulate(v: number, ids: number[], out?: Placement[]): number {
    const { tasks, rank } = this;
    const vm = this.vms[v];
    const peFree = new Array(vm.pes).fill(0);
    const ready: number[] = [];
    let next = 0;
    let done = 0;
    let now = 0;
    let makespan = 0;
    const count = ids.length;

    while (done < count) {
      if (ready.length === 0) {
        let minBusy = Infinity;
        let idle = false;
        for (const f of peFree) {
          if (f <= now) idle = true;
          else if (f < minBusy) minBusy = f;
        }
        if (idle) {
          if (next < count) now = Math.max(now, tasks[ids[next]].arrivalTime);
        } else {
          now = next < count ? Math.min(minBusy, Math.max(now, tasks[ids[next]].arrivalTime)) : minBusy;
        }
      }
      while (next < count && tasks[ids[next]].arrivalTime <= now) {
        ready.push(ids[next++]);
        ready.sort((a, b) => rank[a] - rank[b]);
      }
      let dispatched = false;
      while (ready.length > 0) {
        const pe = peFree.findIndex((f) => f <= now);
        if (pe === -1) break;
        const t = ready.shift()!;
        const finish = now + tasks[t].lengthMi / vm.mips;
        out?.push({ task: t, vm: v, pe, start: now, finish });
        peFree[pe] = finish;
        done++;
        dispatched = true;
        if (finish > makespan) makespan = finish;
      }
      if (!dispatched && done < count) {
        let minBusy = Infinity;
        for (const f of peFree) if (f > now && f < minBusy) minBusy = f;
        if (next < count) {
          const na = tasks[ids[next]].arrivalTime;
          now = na < minBusy ? Math.max(now, na) : minBusy;
        } else {
          now = minBusy;
        }
      }
    }
    return makespan;
  }

  buckets(assign: number[]): number[][] {
    const b: number[][] = this.vms.map(() => []);
    assign.forEach((v, t) => b[v].push(t));
    return b;
  }

  vmFinish(assign: number[]): number[] {
    return this.buckets(assign).map((ids, v) => this.simulate(v, ids));
  }

  makespan(assign: number[]): number {
    return Math.max(0, ...this.vmFinish(assign));
  }

  placements(assign: number[]): Placement[] {
    const out: Placement[] = [];
    this.buckets(assign).forEach((ids, v) => this.simulate(v, ids, out));
    return out;
  }
}
