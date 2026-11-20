import type { AlgoId, MetricKey } from './types';

/**
 * Colour by role, validated with the dataviz validator (dark surface #1a1a19, all checks pass):
 * the four metaheuristics take categorical slots 1-4; the five classic baselines are folded into
 * one neutral ink so the chart never needs a 9th hue.
 */
export const ALGO_COLOR: Record<AlgoId, string> = {
  HMMGA: '#3987e5',
  HSO: '#d95926',
  CSA: '#199e70',
  PHS: '#c98500',
  MinMin: '#8a8984',
  MaxMin: '#8a8984',
  SJF: '#8a8984',
  FCFS: '#8a8984',
  RR: '#8a8984',
};

export const FOCUS: AlgoId[] = ['HMMGA', 'HSO', 'CSA', 'PHS'];
export const ALL: AlgoId[] = ['HMMGA', 'HSO', 'CSA', 'PHS', 'MinMin', 'MaxMin', 'SJF', 'FCFS', 'RR'];

export const ALGO_LABEL: Record<AlgoId, string> = {
  HMMGA: 'HMMGA',
  HSO: 'HSO',
  CSA: 'CSA',
  PHS: 'PHS',
  MinMin: 'Min-Min',
  MaxMin: 'Max-Min',
  SJF: 'SJF',
  FCFS: 'FCFS',
  RR: 'Round Robin',
};

export const ALGO_ROLE: Record<AlgoId, string> = {
  HMMGA: 'Hybrid (pemenang)',
  HSO: 'Hybrid',
  CSA: 'Metode task-5',
  PHS: 'Metode task-5',
  MinMin: 'Heuristik klasik',
  MaxMin: 'Heuristik klasik',
  SJF: 'Heuristik klasik',
  FCFS: 'Heuristik klasik',
  RR: 'Heuristik klasik',
};

export interface MetricMeta {
  key: MetricKey;
  label: string;
  short: string;
  unit: string;
  better: 'lower' | 'higher';
  digits: number;
}

export const METRICS: MetricMeta[] = [
  { key: 'makespan', label: 'Makespan', short: 'Makespan', unit: 's', better: 'lower', digits: 1 },
  { key: 'averageWaitingTime', label: 'Rata-rata waiting time', short: 'Waiting', unit: 's', better: 'lower', digits: 1 },
  { key: 'averageTurnaroundTime', label: 'Rata-rata turnaround', short: 'Turnaround', unit: 's', better: 'lower', digits: 1 },
  { key: 'averageExecutionTime', label: 'Rata-rata execution time', short: 'Execution', unit: 's', better: 'lower', digits: 1 },
  { key: 'throughput', label: 'Throughput', short: 'Throughput', unit: 'task/s', better: 'higher', digits: 3 },
  { key: 'resourceUtilization', label: 'Utilisasi sumber daya', short: 'Utilisasi', unit: '%', better: 'higher', digits: 1 },
  { key: 'degreeOfImbalance', label: 'Degree of imbalance', short: 'Imbalance', unit: '', better: 'lower', digits: 2 },
  { key: 'totalCost', label: 'Total cost', short: 'Cost', unit: 'G$', better: 'lower', digits: 1 },
  { key: 'schedulingTime', label: 'Scheduling time', short: 'Sched. time', unit: 'ms', better: 'lower', digits: 0 },
];

export const METRIC_BY_KEY = Object.fromEntries(METRICS.map((m) => [m.key, m])) as Record<MetricKey, MetricMeta>;

/** Theoretical lower bound: max over tasks of (arrival + length / fastest VM MIPS). See slide "Setup". */
export const LOWER_BOUND: Record<number, number> = { 1000: 2062.0, 5000: 5237.5, 10000: 23173.25 };

export const SCALES = [1000, 5000, 10000] as const;

export function fmt(value: number, digits = 1): string {
  return value.toLocaleString('id-ID', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}
