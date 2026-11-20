package id.ac.soka.scheduling.model;

import java.util.List;

/**
 * @param convergence best decoded makespan per iteration (null for non-iterative schedulers)
 */
public record RepresentativeRun(
    int runIndex,
    long seed,
    List<VmSpec> vms,
    List<TaskAllocation> allocations,
    List<Double> convergence
) {
    public RepresentativeRun(int runIndex, long seed, List<VmSpec> vms, List<TaskAllocation> allocations) {
        this(runIndex, seed, vms, allocations, null);
    }
}
