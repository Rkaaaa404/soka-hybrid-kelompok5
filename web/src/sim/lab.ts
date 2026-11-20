import type { LabVm } from './types';

/** One host of the real scenario: the same 2 Small : 2 Medium : 1 Large VM template. */
export const LAB_VMS: LabVm[] = [
  { id: 0, type: 'Small', mips: 500, pes: 1, label: 'S0' },
  { id: 1, type: 'Small', mips: 500, pes: 1, label: 'S1' },
  { id: 2, type: 'Medium', mips: 1000, pes: 2, label: 'M0' },
  { id: 3, type: 'Medium', mips: 1000, pes: 2, label: 'M1' },
  { id: 4, type: 'Large', mips: 2000, pes: 4, label: 'L0' },
];

/** Identity colours for the five lab VMs (dark categorical slots 1-5, adjacent-pair validated). */
export const VM_COLORS = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181'];

export interface Lane {
  vm: number;
  pe: number;
  label: string;
}

export const LAB_LANES: Lane[] = LAB_VMS.flatMap((vm) =>
  Array.from({ length: vm.pes }, (_, pe) => ({ vm: vm.id, pe, label: vm.pes > 1 ? `${vm.label}·${pe}` : vm.label })),
);

export function laneIndex(vm: number, pe: number): number {
  return LAB_LANES.findIndex((l) => l.vm === vm && l.pe === pe);
}
