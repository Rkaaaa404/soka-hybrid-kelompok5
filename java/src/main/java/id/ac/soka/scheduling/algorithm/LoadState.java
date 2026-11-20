package id.ac.soka.scheduling.algorithm;

import id.ac.soka.scheduling.simulation.ScheduleEvaluator;

import java.util.Arrays;

/**
 * Mutable per-VM view of an assignment that supports O(tasks-on-two-VMs) task moves.
 *
 * <p>Shared by both hybrids for their load-balancing step:
 * <ul>
 *   <li>HSO: adaptation of MLR-DOVM (Eldesokey et al. 2021, Sec. 3.7). The predicted host utilisation
 *       HU (Eq. 11) is reduced to the CPU dimension because GoCJ cloudlets carry no RAM/BW demand;
 *       HU_v = predicted finish of VM v normalised by the mean over all VMs.</li>
 *   <li>HMMGA: Step 6 of Kodli &amp; Terdal 2021, migrating tasks from over-loaded to under-loaded VMs.</li>
 * </ul>
 */
public final class LoadState {
    private final ScheduleEvaluator eval;
    private final int[] assign;
    private final int[][] vmTasks;
    private final int[] vmSize;
    private final double[] finish;

    public LoadState(ScheduleEvaluator eval, int[] assignedVm) {
        this.eval = eval;
        int n = eval.taskCount();
        int m = eval.vmCount();
        this.assign = assignedVm.clone();
        this.vmSize = new int[m];
        for (int i = 0; i < n; i++) vmSize[assign[i]]++;
        this.vmTasks = new int[m][];
        for (int v = 0; v < m; v++) vmTasks[v] = new int[vmSize[v] + 8];
        Arrays.fill(vmSize, 0);
        for (int i = 0; i < n; i++) {
            int v = assign[i];
            vmTasks[v][vmSize[v]++] = i; // ascending id
        }
        this.finish = new double[m];
        for (int v = 0; v < m; v++) refresh(v);
    }

    public int[] assignment() {
        return assign.clone();
    }

    public double finish(int v) {
        return finish[v];
    }

    public double makespan() {
        double ms = 0.0;
        for (double f : finish) if (f > ms) ms = f;
        return ms;
    }

    private void refresh(int v) {
        finish[v] = eval.simulate(v, vmTasks[v], 0, vmSize[v]);
    }

    /** Moves task t to VM {@code to}; returns the new makespan. */
    public double move(int t, int to) {
        int from = assign[t];
        if (from == to) return makespan();
        remove(from, t);
        insert(to, t);
        assign[t] = to;
        refresh(from);
        refresh(to);
        return makespan();
    }

    private void remove(int v, int t) {
        int[] arr = vmTasks[v];
        int idx = Arrays.binarySearch(arr, 0, vmSize[v], t);
        System.arraycopy(arr, idx + 1, arr, idx, vmSize[v] - idx - 1);
        vmSize[v]--;
    }

    private void insert(int v, int t) {
        if (vmSize[v] == vmTasks[v].length) {
            vmTasks[v] = Arrays.copyOf(vmTasks[v], vmTasks[v].length * 2 + 8);
        }
        int[] arr = vmTasks[v];
        int idx = -(Arrays.binarySearch(arr, 0, vmSize[v], t) + 1);
        System.arraycopy(arr, idx, arr, idx + 1, vmSize[v] - idx);
        arr[idx] = t;
        vmSize[v]++;
    }

    /**
     * Overload-driven migration. While the bottleneck VM's normalised utilisation (finish / mean finish)
     * exceeds {@code threshold}, evaluate moving each candidate task of that VM (its largest tasks and its
     * latest arrivals, which dominate the tail) to every other VM, and apply the move with the best
     * resulting makespan ("optimal completion time").
     *
     * <p>Moves are ranked lexicographically by (makespan, max(finish src, finish dst)). A move that keeps
     * the makespan but lightens the bottleneck VM is accepted too: GoCJ lengths/arrivals are integral, so
     * several VMs often tie at the makespan and no single move can lower it strictly. Every accepted move
     * lowers that lexicographic key, so the loop cannot cycle and never worsens the makespan.</p>
     *
     * @return number of accepted migrations
     */
    public int migrateOverloaded(double threshold, int maxMoves) {
        final double eps = 1e-9;
        int m = finish.length;
        int accepted = 0;
        for (int step = 0; step < maxMoves; step++) {
            int src = 0;
            double sum = 0.0;
            for (int v = 0; v < m; v++) {
                sum += finish[v];
                if (finish[v] > finish[src]) src = v;
            }
            double mean = sum / m;
            if (mean <= 0 || finish[src] / mean <= threshold || vmSize[src] == 0) break;

            double before = makespan(); // == finish[src]
            double bestAfter = Double.POSITIVE_INFINITY;
            double bestLocal = Double.POSITIVE_INFINITY;
            int bestTask = -1, bestDst = -1;
            for (int t : candidateTasks(src)) {
                for (int dst = 0; dst < m; dst++) {
                    if (dst == src) continue;
                    double after = move(t, dst);
                    double local = Math.max(finish[src], finish[dst]);
                    // valid: makespan not worse, and both touched VMs end below the old bottleneck
                    boolean valid = after <= before + eps && local < before - eps;
                    boolean better = after < bestAfter - eps
                        || (Math.abs(after - bestAfter) <= eps && local < bestLocal - eps);
                    if (valid && better) {
                        bestAfter = after;
                        bestLocal = local;
                        bestTask = t;
                        bestDst = dst;
                    }
                    move(t, src); // revert
                }
            }
            if (bestTask < 0) break;
            move(bestTask, bestDst);
            accepted++;
        }
        return accepted;
    }

    /** Largest three tasks plus the three latest arrivals on VM v (deduplicated). */
    private int[] candidateTasks(int v) {
        int[] largest = largestTasks(v, 3);
        int size = vmSize[v];
        int[] out = Arrays.copyOf(largest, largest.length + Math.min(3, size));
        int k = largest.length;
        for (int i = size - 1; i >= 0 && i >= size - 3; i--) {
            int t = vmTasks[v][i];
            boolean dup = false;
            for (int j = 0; j < largest.length; j++) if (largest[j] == t) { dup = true; break; }
            if (!dup) out[k++] = t;
        }
        return Arrays.copyOf(out, k);
    }

    private int[] largestTasks(int v, int k) {
        int size = vmSize[v];
        int take = Math.min(k, size);
        int[] best = new int[take];
        long[] bestLen = new long[take];
        Arrays.fill(bestLen, -1);
        for (int i = 0; i < size; i++) {
            int t = vmTasks[v][i];
            long len = eval.lengthMi(t);
            for (int j = 0; j < take; j++) {
                if (len > bestLen[j]) {
                    System.arraycopy(bestLen, j, bestLen, j + 1, take - j - 1);
                    System.arraycopy(best, j, best, j + 1, take - j - 1);
                    bestLen[j] = len;
                    best[j] = t;
                    break;
                }
            }
        }
        return best;
    }
}
