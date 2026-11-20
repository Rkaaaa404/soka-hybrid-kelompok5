export type AlgoId = 'HSO' | 'HMMGA' | 'CSA' | 'PHS' | 'MinMin' | 'MaxMin' | 'SJF' | 'FCFS' | 'RR';

export type MetricKey =
  | 'makespan'
  | 'averageWaitingTime'
  | 'averageExecutionTime'
  | 'averageTurnaroundTime'
  | 'throughput'
  | 'resourceUtilization'
  | 'degreeOfImbalance'
  | 'totalCost'
  | 'schedulingTime';

export interface MetricValue {
  mean: number;
  stddev: number;
  unit: string;
}

export interface VmSpec {
  id: number;
  datacenterIndex: number;
  hostIndex: number;
  type: 'Small' | 'Medium' | 'Large';
  nominalMips: number;
  pes: number;
}

export interface VmSummary {
  vmId: number;
  datacenterIndex: number;
  hostIndex: number;
  tasks: number;
  busy: number;
  lastFinish: number;
}

export interface Allocation {
  taskId: number;
  vmId: number;
  arrival: number;
  start: number;
  finish: number;
  cpuTime: number;
}

export interface AlgoResult {
  algorithm: AlgoId;
  metrics: Record<MetricKey, MetricValue>;
  runMetrics?: { runIndex: number; seed: number; metrics: Record<MetricKey, number> }[];
  representativeRun: {
    seed: number;
    vms: VmSpec[];
    allocations: Allocation[];
    convergence: number[] | null;
    vmSummary: VmSummary[];
  };
}

export interface Snapshot {
  scenario: { taskCount: number; runs: number; seed: number; dataset: string };
  provenance: { timestampUtc: string; engine: string; engineVersion: string; datasetSha256: string };
  results: AlgoResult[];
}

export interface SnapshotIndexEntry {
  file: string;
  taskCount: number;
  runs: number;
  timestampUtc: string;
  wallSeconds: number;
}
