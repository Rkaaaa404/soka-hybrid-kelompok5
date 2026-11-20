package id.ac.soka.scheduling.model;

import java.util.List;

/**
 * Optional capability for iterative schedulers: exposes the best makespan found after each
 * iteration/generation of the most recent {@link #schedule} call (estimated by the decoder).
 * Scheduler instances are created per run, so the trace belongs to exactly one run.
 */
public interface TraceableScheduler extends Scheduler {
    List<Double> convergence();
}
