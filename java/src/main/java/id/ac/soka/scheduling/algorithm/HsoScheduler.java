package id.ac.soka.scheduling.algorithm;

import id.ac.soka.scheduling.model.AlgorithmOptions;
import id.ac.soka.scheduling.model.SchedulePlan;
import id.ac.soka.scheduling.model.TaskSpec;
import id.ac.soka.scheduling.model.TraceableScheduler;
import id.ac.soka.scheduling.model.VmSpec;
import id.ac.soka.scheduling.simulation.ScheduleEvaluator;
import id.ac.soka.scheduling.util.Mulberry32;

import java.util.*;

/**
 * HSO: Hybrid Swarm Optimization (PSO + Salp Swarm Optimization).
 * Eldesokey, Abd El-atty, El-Shafai, Amoon &amp; Abd El-Samie (2021),
 * "Hybrid swarm optimization algorithm based on task scheduling in a cloud environment",
 * Int J Commun Syst 34:e4694, doi:10.1002/dac.4694.
 *
 * <p>Per iteration (Sec. 3.5): PSO updates the whole swarm (Eq. 9) and picks the preferable
 * solutions, then SSO refines them as a salp chain (leader Eq. 1 around the food source = gbest,
 * c1 from Eq. 2, followers Eq. 3), and the result is passed to the next iteration. The swarm is
 * initialised by a short GA run (Sec. 3.4). Overloaded VMs are then detected with a normalised
 * utilisation predictor (MLR-DOVM adaptation, Sec. 3.7) and relieved by migration.</p>
 *
 * <p>Discrete encoding: each task i has a continuous coordinate x_i in [0, m); VMs are indexed by
 * ascending compute capacity, so neighbouring coordinates map to VMs of similar power and the
 * PSO/SSA arithmetic remains meaningful. Fitness is the decoded makespan.</p>
 */
public class HsoScheduler implements TraceableScheduler {
    private final int totalHosts;
    private final List<Double> convergence = new ArrayList<>();

    public HsoScheduler(int totalHosts) {
        this.totalHosts = totalHosts;
    }

    @Override
    public List<Double> convergence() {
        return List.copyOf(convergence);
    }

    @Override
    public SchedulePlan schedule(List<TaskSpec> tasks, List<VmSpec> vms, AlgorithmOptions options, long seed) {
        convergence.clear();
        int n = tasks.size();
        int m = vms.size();
        AlgorithmOptions.HsoOptions o = (options != null && options.hso() != null)
            ? options.hso() : AlgorithmOptions.HsoOptions.defaults();
        Mulberry32 rng = new Mulberry32(seed);

        int[] taskOrder = arrivalOrder(tasks);
        double[] full = new double[m];
        Arrays.fill(full, 1.0);
        ScheduleEvaluator eval = new ScheduleEvaluator(tasks, vms, taskOrder);

        // Coordinate space: VMs sorted by capacity (MIPS x PEs), ties by id.
        Integer[] sorted = new Integer[m];
        for (int v = 0; v < m; v++) sorted[v] = v;
        Arrays.sort(sorted, Comparator.comparingDouble((Integer v) -> vms.get(v).totalNominalMips()).thenComparingInt(v -> v));
        int[] vmAt = new int[m];
        int[] slotOf = new int[m];
        for (int k = 0; k < m; k++) { vmAt[k] = sorted[k]; slotOf[sorted[k]] = k; }
        double upper = m - 1e-9;

        int swarm = o.swarm();

        // ---- 1. GA initialisation (Sec. 3.4) ----
        int[][] pop = new int[swarm][n];
        double[] popFit = new double[swarm];
        for (int s = 0; s < swarm; s++) {
            for (int i = 0; i < n; i++) pop[s][i] = rng.nextInt(m);
            popFit[s] = eval.makespan(pop[s]);
        }
        int mutGenes = Math.max(1, n / 100);
        for (int g = 0; g < o.gaInitGenerations(); g++) {
            int best = argMin(popFit);
            int[][] next = new int[swarm][];
            double[] nextFit = new double[swarm];
            next[0] = pop[best].clone();
            nextFit[0] = popFit[best];
            for (int s = 1; s < swarm; s++) {
                int a = tournament(popFit, rng);
                int b = tournament(popFit, rng);
                int[] child = new int[n];
                for (int i = 0; i < n; i++) child[i] = rng.nextBoolean() ? pop[a][i] : pop[b][i];
                for (int k = 0; k < mutGenes; k++) child[rng.nextInt(n)] = rng.nextInt(m);
                next[s] = child;
                nextFit[s] = eval.makespan(child);
            }
            pop = next;
            popFit = nextFit;
        }

        // ---- 2. Swarm state ----
        double[][] x = new double[swarm][n];
        double[][] vel = new double[swarm][n];
        double[][] pbest = new double[swarm][];
        double[] pbestFit = new double[swarm];
        double vmax = Math.max(1.0, 0.2 * m);
        for (int s = 0; s < swarm; s++) {
            for (int i = 0; i < n; i++) {
                x[s][i] = slotOf[pop[s][i]] + rng.nextDouble() * 0.999;
                vel[s][i] = (rng.nextDouble() * 2 - 1);
            }
            pbest[s] = x[s].clone();
            pbestFit[s] = popFit[s];
        }
        int g0 = argMin(pbestFit);
        double[] gbest = pbest[g0].clone();
        double gbestFit = pbestFit[g0];
        int[] assign = new int[n];
        double[] fit = popFit.clone();

        int chainLen = Math.max(2, Math.min(swarm, (int) Math.round(o.salpRatio() * swarm)));
        int iters = o.iterations();

        for (int it = 0; it < iters; it++) {
            // ---- 3a. PSO update (Eq. 9) ----
            double w = o.wMax() - (o.wMax() - o.wMin()) * it / Math.max(1, iters - 1);
            for (int s = 0; s < swarm; s++) {
                double[] xs = x[s], vs = vel[s], ps = pbest[s];
                for (int i = 0; i < n; i++) {
                    double v = w * vs[i]
                        + o.c1() * rng.nextDouble() * (ps[i] - xs[i])
                        + o.c2() * rng.nextDouble() * (gbest[i] - xs[i]);
                    if (v > vmax) v = vmax; else if (v < -vmax) v = -vmax;
                    vs[i] = v;
                    double nx = xs[i] + v;
                    xs[i] = nx < 0 ? 0 : (nx > upper ? upper : nx);
                }
                fit[s] = eval.makespan(toAssign(xs, vmAt, assign));
                if (fit[s] < pbestFit[s]) { pbestFit[s] = fit[s]; pbest[s] = xs.clone(); }
                if (fit[s] < gbestFit) { gbestFit = fit[s]; gbest = xs.clone(); }
            }

            // ---- 3b. SSO refinement of the preferable solutions (Eq. 1-3) ----
            Integer[] rankIdx = new Integer[swarm];
            for (int s = 0; s < swarm; s++) rankIdx[s] = s;
            final double[] fitSnap = fit;
            Arrays.sort(rankIdx, Comparator.comparingDouble((Integer s) -> fitSnap[s]).thenComparingInt(s -> s));

            double c1s = 2.0 * Math.exp(-Math.pow(4.0 * (it + 1) / iters, 2)); // Eq. 2
            // Eq. 1 is applied to a decaying subset of dimensions: perturbing all n (up to 10^4)
            // coordinates at once would turn the leader into a random restart.
            double dimRate = Math.min(1.0, 0.05 * c1s / 2.0 + 1.0 / n);
            for (int k = 0; k < chainLen; k++) {
                int s = rankIdx[k];
                double[] xs = x[s];
                if (k == 0) {
                    // Leader moves around the food source F = gbest
                    for (int i = 0; i < n; i++) {
                        xs[i] = gbest[i];
                        if (rng.nextDouble() < dimRate) {
                            double step = c1s * (m * rng.nextDouble());
                            double nx = rng.nextDouble() < 0.5 ? gbest[i] + step : gbest[i] - step;
                            xs[i] = nx < 0 ? 0 : (nx > upper ? upper : nx);
                        }
                    }
                } else {
                    // Follower: y_j = 1/2 (y_j + y_{j-1})
                    double[] prev = x[rankIdx[k - 1]];
                    for (int i = 0; i < n; i++) xs[i] = 0.5 * (xs[i] + prev[i]);
                }
                fit[s] = eval.makespan(toAssign(xs, vmAt, assign));
                if (fit[s] < pbestFit[s]) { pbestFit[s] = fit[s]; pbest[s] = xs.clone(); }
                if (fit[s] < gbestFit) { gbestFit = fit[s]; gbest = xs.clone(); }
            }

            // ---- 3c. Overloaded-VM detection & migration on the preferred solution ----
            LoadState state = new LoadState(eval, toAssign(gbest, vmAt, assign));
            if (state.migrateOverloaded(o.overloadThreshold(), 10) > 0) {
                int[] moved = state.assignment();
                for (int i = 0; i < n; i++) {
                    if (vmAt[(int) gbest[i]] != moved[i]) gbest[i] = slotOf[moved[i]] + 0.5;
                }
                gbestFit = state.makespan();
            }
            convergence.add(gbestFit);
        }

        int[] best = toAssign(gbest, vmAt, new int[n]);
        return new SchedulePlan(taskOrder, best, full);
    }

    static int[] arrivalOrder(List<TaskSpec> tasks) {
        List<TaskSpec> sortedTasks = new ArrayList<>(tasks);
        sortedTasks.sort(Comparator.comparingDouble(TaskSpec::arrivalTime).thenComparingInt(TaskSpec::id));
        int[] order = new int[tasks.size()];
        for (int i = 0; i < order.length; i++) order[i] = sortedTasks.get(i).id();
        return order;
    }

    private static int[] toAssign(double[] xs, int[] vmAt, int[] out) {
        for (int i = 0; i < xs.length; i++) out[i] = vmAt[(int) xs[i]];
        return out;
    }

    private static int argMin(double[] a) {
        int best = 0;
        for (int i = 1; i < a.length; i++) if (a[i] < a[best]) best = i;
        return best;
    }

    private static int tournament(double[] fit, Mulberry32 rng) {
        int a = rng.nextInt(fit.length);
        int b = rng.nextInt(fit.length);
        return fit[a] <= fit[b] ? a : b;
    }
}
