package id.ac.soka.scheduling.simulation;

import id.ac.soka.scheduling.model.TaskSpec;
import id.ac.soka.scheduling.model.VmSpec;

import java.util.Arrays;
import java.util.List;

/**
 * Allocation-free makespan evaluator for full-capacity plans (all capacity factors = 1.0).
 *
 * <p>It reproduces {@link ScheduleDecoder#decode} exactly (same event logic: arrival-ordered ingestion,
 * ready queue ordered by priority rank, lowest free PE first), but works on primitive arrays and can
 * evaluate a single VM in isolation. Because VMs are decoded independently, moving one task only
 * requires re-evaluating the two VMs involved, which is what the hybrid schedulers' local migration
 * steps rely on. Equality with the decoder is covered by {@code ScheduleEvaluatorTest}.</p>
 *
 * <p>Not thread-safe: scratch buffers are reused between calls.</p>
 */
public final class ScheduleEvaluator {
    private final int n;
    private final int m;
    private final long[] lengthMi;
    private final double[] arrival;
    private final double[] mips;
    private final int[] pes;
    private final int[] rank;

    // scratch
    private final int[] bucketStart;
    private final int[] bucketFill;
    private final int[] bucketTasks;
    private final int[] heap;
    private final double[] peFree;

    public ScheduleEvaluator(List<TaskSpec> tasks, List<VmSpec> vms, int[] taskOrder) {
        this.n = tasks.size();
        this.m = vms.size();
        this.lengthMi = new long[n];
        this.arrival = new double[n];
        for (int i = 0; i < n; i++) {
            TaskSpec t = tasks.get(i);
            if (t.id() != i) {
                throw new IllegalArgumentException("Task ids must equal their list index (id " + t.id() + " at " + i + ")");
            }
            lengthMi[i] = t.lengthMi();
            arrival[i] = t.arrivalTime();
        }
        this.mips = new double[m];
        this.pes = new int[m];
        int maxPes = 1;
        for (int v = 0; v < m; v++) {
            mips[v] = vms.get(v).nominalMips();
            pes[v] = vms.get(v).pes();
            maxPes = Math.max(maxPes, pes[v]);
        }
        this.rank = new int[n];
        for (int i = 0; i < n; i++) {
            rank[taskOrder[i]] = i;
        }
        this.bucketStart = new int[m + 1];
        this.bucketFill = new int[m];
        this.bucketTasks = new int[n];
        this.heap = new int[Math.max(1, n)];
        this.peFree = new double[maxPes];
    }

    public int taskCount() { return n; }

    public int vmCount() { return m; }

    /** Execution time of task t on VM v (MI / MIPS). */
    public double duration(int t, int v) {
        return lengthMi[t] / mips[v];
    }

    /** Total compute capacity of VM v (MIPS x PEs), used as the load normaliser. */
    public double capacity(int v) {
        return mips[v] * pes[v];
    }

    public long lengthMi(int t) {
        return lengthMi[t];
    }

    /** Makespan of a full assignment. */
    public double makespan(int[] assignedVm) {
        return vmFinishTimes(assignedVm, null);
    }

    /**
     * Computes the finish time of every VM (0 for idle VMs) into {@code out} (if non-null)
     * and returns the makespan.
     */
    public double vmFinishTimes(int[] assignedVm, double[] out) {
        Arrays.fill(bucketFill, 0);
        for (int i = 0; i < n; i++) {
            int v = assignedVm[i];
            if (v < 0 || v >= m) throw new IllegalArgumentException("Invalid VM ID: " + v);
            bucketFill[v]++;
        }
        bucketStart[0] = 0;
        for (int v = 0; v < m; v++) {
            bucketStart[v + 1] = bucketStart[v] + bucketFill[v];
            bucketFill[v] = bucketStart[v];
        }
        // ascending task id == ascending arrival (GoCJ is arrival-sorted)
        for (int i = 0; i < n; i++) {
            bucketTasks[bucketFill[assignedVm[i]]++] = i;
        }
        double makespan = 0.0;
        for (int v = 0; v < m; v++) {
            double f = simulate(v, bucketTasks, bucketStart[v], bucketStart[v + 1]);
            if (out != null) out[v] = f;
            if (f > makespan) makespan = f;
        }
        return makespan;
    }

    /**
     * Finish time of VM v when it runs exactly the tasks {@code ids[from..to)}, which must be in
     * ascending id order.
     */
    public double simulate(int v, int[] ids, int from, int to) {
        int count = to - from;
        if (count <= 0) return 0.0;
        double effMips = mips[v];
        int p = pes[v];
        Arrays.fill(peFree, 0, p, 0.0);
        int heapSize = 0;
        int next = from;
        int completed = 0;
        double now = 0.0;
        double makespan = 0.0;

        while (completed < count) {
            if (heapSize == 0) {
                double minBusy = Double.POSITIVE_INFINITY;
                boolean idle = false;
                for (int k = 0; k < p; k++) {
                    if (peFree[k] <= now) idle = true;
                    else if (peFree[k] < minBusy) minBusy = peFree[k];
                }
                if (idle) {
                    if (next < to) now = Math.max(now, arrival[ids[next]]);
                } else {
                    now = (next < to) ? Math.min(minBusy, Math.max(now, arrival[ids[next]])) : minBusy;
                }
            }

            while (next < to && arrival[ids[next]] <= now) {
                heapSize = heapPush(ids[next++], heapSize);
            }

            boolean dispatched = false;
            while (heapSize > 0) {
                int freePe = -1;
                for (int k = 0; k < p; k++) {
                    if (peFree[k] <= now) { freePe = k; break; }
                }
                if (freePe == -1) break;
                int t = heap[0];
                heapSize = heapPop(heapSize);
                double finish = now + lengthMi[t] / effMips;
                peFree[freePe] = finish;
                completed++;
                dispatched = true;
                if (finish > makespan) makespan = finish;
            }

            if (!dispatched && completed < count) {
                double minBusy = Double.POSITIVE_INFINITY;
                for (int k = 0; k < p; k++) {
                    if (peFree[k] > now && peFree[k] < minBusy) minBusy = peFree[k];
                }
                if (next < to) {
                    double na = arrival[ids[next]];
                    now = (na < minBusy) ? Math.max(now, na) : minBusy;
                } else {
                    now = minBusy;
                }
            }
        }
        return makespan;
    }

    private int heapPush(int t, int size) {
        int i = size++;
        heap[i] = t;
        while (i > 0) {
            int parent = (i - 1) >>> 1;
            if (rank[heap[parent]] <= rank[heap[i]]) break;
            int tmp = heap[parent]; heap[parent] = heap[i]; heap[i] = tmp;
            i = parent;
        }
        return size;
    }

    private int heapPop(int size) {
        size--;
        heap[0] = heap[size];
        int i = 0;
        while (true) {
            int l = 2 * i + 1;
            if (l >= size) break;
            int r = l + 1;
            int c = (r < size && rank[heap[r]] < rank[heap[l]]) ? r : l;
            if (rank[heap[i]] <= rank[heap[c]]) break;
            int tmp = heap[c]; heap[c] = heap[i]; heap[i] = tmp;
            i = c;
        }
        return size;
    }
}
