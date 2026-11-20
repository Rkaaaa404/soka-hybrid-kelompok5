export interface LabTask {
  id: number;
  lengthMi: number;
  sla: number;
  arrivalTime: number;
}

export interface LabVm {
  id: number;
  type: 'Small' | 'Medium' | 'Large';
  mips: number;
  pes: number;
  label: string;
}

export interface Placement {
  task: number;
  vm: number;
  pe: number;
  start: number;
  finish: number;
}
