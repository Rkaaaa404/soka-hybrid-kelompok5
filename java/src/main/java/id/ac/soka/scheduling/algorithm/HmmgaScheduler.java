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
 * HMMGA: Hybrid Max-Min Genetic Algorithm.
 * Kodli &amp; Terdal (2021), "Hybrid Max-Min Genetic Algorithm for Load Balancing and Task Scheduling
 * in Cloud Environment", International Journal of Intelligent Engineering and Systems 14(1):63-71,
 * doi:10.22266/ijies2021.0228.07.
 *
 * <p>Steps (Sec. 3.3): (1-3) Max-Min maps the meta-task: the task with maximum execution time goes to
 * the VM with the optimal (earliest) completion time; (4) the gene population is initialised around
 * that mapping (gene count = task count); (5) load per VM is estimated from cloudlet length / VM MIPS;
 * (6) crossover and mutation exchange VM choices and over-loaded VMs' tasks migrate to under-loaded
 * VMs; (7) statuses are updated every generation; (8) the fittest gene order is returned.</p>
 *
 * <p>GA operators follow the paper's pseudocode: copy (1-r)·p members, crossover r·p members, mutate,
 * roulette selection, with adaptive Pc/Pm (Eq. 1-2, Srinivas-Patnaik form). Fitness f = 1/makespan
 * with the makespan estimated by the CloudSim-equivalent decoder.</p>
 */
public class HmmgaScheduler implements TraceableScheduler {
    private final int totalHosts;
    private final List<Double> convergence = new ArrayList<>();

    public HmmgaScheduler(int totalHosts) {
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
        AlgorithmOptions.HmmgaOptions o = (options != null && options.hmmga() != null)
            ? options.hmmga() : AlgorithmOptions.HmmgaOptions.defaults();
        Mulberry32 rng = new Mulberry32(seed);

        // ---- Steps 1-3: Max-Min mapping ----
        SchedulePlan maxMin = BaselineSchedulers.MAX_MIN.schedule(tasks, vms, options, seed);
        int[] taskOrder = maxMin.taskOrder();
        double[] full = new double[m];
        Arrays.fill(full, 1.0);
        ScheduleEvaluator eval = new ScheduleEvaluator(tasks, vms, taskOrder);

        // ---- Step 4: initialise gene population around the Max-Min mapping ----
        int p = o.population();
        int[][] pop = new int[p][];
        double[] ms = new double[p];
        double[][] vmFinish = new double[p][m];
        int seeded = Math.max(1, p / 5);
        int lightMut = Math.max(1, n / 100);
        for (int s = 0; s < p; s++) {
            int[] genes;
            if (s == 0) {
                genes = maxMin.assignedVm().clone();
            } else if (s < seeded) {
                genes = maxMin.assignedVm().clone();
                for (int k = 0; k < lightMut; k++) genes[rng.nextInt(n)] = rng.nextInt(m);
            } else {
                genes = new int[n];
                for (int i = 0; i < n; i++) genes[i] = rng.nextInt(m);
            }
            pop[s] = genes;
            ms[s] = eval.vmFinishTimes(genes, vmFinish[s]);
        }

        int bestIdx = argMin(ms);
        int[] best = pop[bestIdx].clone();
        double bestMs = ms[bestIdx];

        int copyCount = Math.max(1, (int) Math.round((1.0 - o.crossoverShare()) * p));
        int mutGenes = Math.max(1, n / 500);

        for (int gen = 0; gen < o.generations(); gen++) {
            double[] f = new double[p];
            double fmax = 0.0, fsum = 0.0;
            for (int s = 0; s < p; s++) {
                f[s] = 1.0 / ms[s];
                fsum += f[s];
                if (f[s] > fmax) fmax = f[s];
            }
            double favg = fsum / p;
            double spread = Math.max(1e-15, fmax - favg);

            int[][] next = new int[p][];
            double[] nextMs = new double[p];
            double[][] nextFinish = new double[p][];
            boolean[] fresh = new boolean[p];

            // Copy: elite first, then roulette-selected members.
            int elite = argMin(ms);
            next[0] = pop[elite];
            nextMs[0] = ms[elite];
            nextFinish[0] = vmFinish[elite];
            int filled = 1;
            while (filled < copyCount) {
                int s = roulette(f, fsum, rng);
                next[filled] = pop[s];
                nextMs[filled] = ms[s];
                nextFinish[filled] = vmFinish[s];
                filled++;
            }

            // Crossover with adaptive Pc (Eq. 1).
            while (filled < p) {
                int a = roulette(f, fsum, rng);
                int b = roulette(f, fsum, rng);
                double fPrime = Math.max(f[a], f[b]);
                double pc = fPrime >= favg ? o.k1() * (fmax - fPrime) / spread : o.k3();
                int[] c1 = pop[a].clone();
                int[] c2 = pop[b].clone();
                if (rng.nextDouble() < pc && n > 1) {
                    int cut1 = rng.nextInt(n);
                    int cut2 = rng.nextInt(n);
                    if (cut1 > cut2) { int t = cut1; cut1 = cut2; cut2 = t; }
                    for (int i = cut1; i <= cut2; i++) { int t = c1[i]; c1[i] = c2[i]; c2[i] = t; }
                }
                for (int[] child : new int[][] {c1, c2}) {
                    if (filled >= p) break;
                    double[] fin = new double[m];
                    next[filled] = child;
                    nextMs[filled] = eval.vmFinishTimes(child, fin);
                    nextFinish[filled] = fin;
                    fresh[filled] = true;
                    filled++;
                }
            }

            // Mutation with adaptive Pm (Eq. 2); the elite is never mutated.
            for (int s = 1; s < p; s++) {
                double fs = 1.0 / nextMs[s];
                double pm = fs >= favg ? o.k2() * (fmax - fs) / spread : o.k4();
                if (rng.nextDouble() >= pm) continue;
                int[] genes = fresh[s] ? next[s] : next[s].clone();
                double[] fin = nextFinish[s];
                int lightest = 0;
                for (int v = 1; v < m; v++) if (fin[v] < fin[lightest]) lightest = v;
                for (int k = 0; k < mutGenes; k++) {
                    int i = rng.nextInt(n);
                    genes[i] = rng.nextBoolean() ? rng.nextInt(m) : lightest;
                }
                double[] newFin = new double[m];
                next[s] = genes;
                nextMs[s] = eval.vmFinishTimes(genes, newFin);
                nextFinish[s] = newFin;
                fresh[s] = true;
            }

            // Step 6: migrate tasks of over-loaded VMs to under-loaded VMs on the best gene.
            int gBest = argMin(nextMs);
            if (o.migrationMoves() > 0) {
                LoadState state = new LoadState(eval, next[gBest]);
                if (state.migrateOverloaded(1.0, o.migrationMoves()) > 0) {
                    double[] fin = new double[m];
                    next[gBest] = state.assignment();
                    nextMs[gBest] = eval.vmFinishTimes(next[gBest], fin);
                    nextFinish[gBest] = fin;
                }
            }

            pop = next;
            ms = nextMs;
            vmFinish = nextFinish;

            // Step 7: update statuses / best-so-far
            if (ms[gBest] < bestMs) {
                bestMs = ms[gBest];
                best = pop[gBest].clone();
            }
            convergence.add(bestMs);
        }

        return new SchedulePlan(taskOrder, best, full);
    }

    private static int roulette(double[] f, double total, Mulberry32 rng) {
        double r = rng.nextDouble() * total;
        double acc = 0.0;
        for (int i = 0; i < f.length; i++) {
            acc += f[i];
            if (acc >= r) return i;
        }
        return f.length - 1;
    }

    private static int argMin(double[] a) {
        int best = 0;
        for (int i = 1; i < a.length; i++) if (a[i] < a[best]) best = i;
        return best;
    }
}
