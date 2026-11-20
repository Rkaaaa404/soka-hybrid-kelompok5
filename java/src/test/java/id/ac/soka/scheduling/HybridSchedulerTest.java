package id.ac.soka.scheduling;

import id.ac.soka.scheduling.algorithm.AlgorithmRegistry;
import id.ac.soka.scheduling.algorithm.BaselineSchedulers;
import id.ac.soka.scheduling.algorithm.HmmgaScheduler;
import id.ac.soka.scheduling.algorithm.HsoScheduler;
import id.ac.soka.scheduling.algorithm.LoadState;
import id.ac.soka.scheduling.model.*;
import id.ac.soka.scheduling.simulation.ScheduleDecoder;
import id.ac.soka.scheduling.simulation.ScheduleEvaluator;
import id.ac.soka.scheduling.util.Mulberry32;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import java.util.*;

import static org.junit.jupiter.api.Assertions.*;

public class HybridSchedulerTest {

    /** Small heterogeneous fixture: arrival-sorted tasks, Small/Medium/Large VMs. */
    static List<TaskSpec> tasks(int n, long seed) {
        Mulberry32 rng = new Mulberry32(seed);
        List<TaskSpec> list = new ArrayList<>();
        double arrival = 0.0;
        for (int i = 0; i < n; i++) {
            arrival += rng.nextInt(4);
            list.add(new TaskSpec(i, 1000 + rng.nextInt(90000), 1 + rng.nextInt(3), arrival));
        }
        return list;
    }

    static List<VmSpec> vms() {
        List<VmSpec> list = new ArrayList<>();
        String[] type = {"Small", "Small", "Medium", "Medium", "Large", "Small"};
        double[] mips = {500, 500, 1000, 1000, 2000, 500};
        int[] pes = {1, 1, 2, 2, 4, 1};
        for (int v = 0; v < type.length; v++) {
            list.add(new VmSpec(v, 0, v / 3, type[v], mips[v], pes[v], 1024, 1000, 10000));
        }
        return list;
    }

    static AlgorithmOptions fastOptions() {
        return new AlgorithmOptions(null, null,
            new AlgorithmOptions.HsoOptions(12, 40, 5, 0.9, 0.4, 1.5, 1.5, 0.3, 1.0),
            new AlgorithmOptions.HmmgaOptions(12, 40, 1.0, 0.5, 1.0, 0.5, 0.6, 10));
    }

    static TraceableScheduler create(String algo) {
        return (TraceableScheduler) AlgorithmRegistry.create(algo, 2);
    }

    @Test
    public void evaluatorMatchesDecoderOnRandomPlans() {
        List<TaskSpec> tasks = tasks(300, 7);
        List<VmSpec> vms = vms();
        double[] full = {1, 1, 1, 1, 1, 1};
        Mulberry32 rng = new Mulberry32(99);
        for (int trial = 0; trial < 25; trial++) {
            int[] order = new int[tasks.size()];
            for (int i = 0; i < order.length; i++) order[i] = i;
            for (int i = order.length - 1; i > 0; i--) {
                int k = rng.nextInt(i + 1);
                int t = order[i]; order[i] = order[k]; order[k] = t;
            }
            int[] assign = new int[tasks.size()];
            for (int i = 0; i < assign.length; i++) assign[i] = rng.nextInt(vms.size());

            double expected = ScheduleDecoder.decode(tasks, vms, new SchedulePlan(order, assign, full), 2).makespan();
            double actual = new ScheduleEvaluator(tasks, vms, order).makespan(assign);
            assertEquals(expected, actual, 1e-9, "trial " + trial);
        }
    }

    @Test
    public void loadStateMovesStayConsistentWithFullEvaluation() {
        List<TaskSpec> tasks = tasks(200, 3);
        List<VmSpec> vms = vms();
        int[] order = new int[tasks.size()];
        for (int i = 0; i < order.length; i++) order[i] = i;
        ScheduleEvaluator eval = new ScheduleEvaluator(tasks, vms, order);
        Mulberry32 rng = new Mulberry32(5);
        int[] assign = new int[tasks.size()];
        for (int i = 0; i < assign.length; i++) assign[i] = rng.nextInt(vms.size());

        LoadState state = new LoadState(eval, assign);
        for (int k = 0; k < 50; k++) {
            state.move(rng.nextInt(tasks.size()), rng.nextInt(vms.size()));
        }
        assertEquals(eval.makespan(state.assignment()), state.makespan(), 1e-9);

        double before = state.makespan();
        state.migrateOverloaded(1.0, 20);
        assertTrue(state.makespan() <= before + 1e-9, "migration must never worsen makespan");
        assertEquals(eval.makespan(state.assignment()), state.makespan(), 1e-9);
    }

    @ParameterizedTest
    @ValueSource(strings = {"HSO", "HMMGA"})
    public void everyTaskScheduledOnceOnValidVm(String algo) {
        List<TaskSpec> tasks = tasks(120, 11);
        List<VmSpec> vms = vms();
        SchedulePlan plan = create(algo).schedule(tasks, vms, fastOptions(), 42L);

        assertEquals(tasks.size(), plan.assignedVm().length);
        int[] sortedOrder = plan.taskOrder().clone();
        Arrays.sort(sortedOrder);
        for (int i = 0; i < sortedOrder.length; i++) assertEquals(i, sortedOrder[i], "taskOrder must be a permutation");
        for (int v : plan.assignedVm()) assertTrue(v >= 0 && v < vms.size());
        for (double c : plan.capacityFactors()) assertEquals(1.0, c);
    }

    @ParameterizedTest
    @ValueSource(strings = {"HSO", "HMMGA"})
    public void deterministicForSameSeed(String algo) {
        List<TaskSpec> tasks = tasks(100, 13);
        List<VmSpec> vms = vms();
        SchedulePlan a = create(algo).schedule(tasks, vms, fastOptions(), 1234L);
        SchedulePlan b = create(algo).schedule(tasks, vms, fastOptions(), 1234L);
        assertArrayEquals(a.assignedVm(), b.assignedVm());
        assertArrayEquals(a.taskOrder(), b.taskOrder());
    }

    @ParameterizedTest
    @ValueSource(strings = {"HSO", "HMMGA"})
    public void singleTaskSingleVmBoundary(String algo) {
        List<TaskSpec> tasks = List.of(new TaskSpec(0, 500, 1, 0.0));
        List<VmSpec> vms = List.of(new VmSpec(0, 0, 0, "Small", 500.0, 1, 512, 500, 10000));
        SchedulePlan plan = AlgorithmRegistry.create(algo, 1).schedule(tasks, vms, fastOptions(), 42L);
        assertArrayEquals(new int[] {0}, plan.taskOrder());
        assertArrayEquals(new int[] {0}, plan.assignedVm());
    }

    @ParameterizedTest
    @ValueSource(strings = {"HSO", "HMMGA", "CSA", "PHS"})
    public void convergenceTraceHasOneEntryPerIterationAndNeverWorsens(String algo) {
        List<TaskSpec> tasks = tasks(80, 17);
        List<VmSpec> vms = vms();
        AlgorithmOptions opts = new AlgorithmOptions(
            new AlgorithmOptions.CsaOptions(10, 4, 30, 1.0, 0.5),
            new AlgorithmOptions.PhsOptions(6, 30, 2),
            fastOptions().hso(), fastOptions().hmmga());
        TraceableScheduler s = create(algo);
        s.schedule(tasks, vms, opts, 42L);
        List<Double> trace = s.convergence();
        int expected = switch (algo) {
            case "HSO" -> opts.hso().iterations();
            case "HMMGA" -> opts.hmmga().generations();
            case "CSA" -> opts.csa().generations();
            default -> opts.phs().iterations();
        };
        assertEquals(expected, trace.size());
        if (!algo.equals("CSA")) { // CSA tracks a weighted (makespan+energy) objective
            for (int i = 1; i < trace.size(); i++) {
                assertTrue(trace.get(i) <= trace.get(i - 1) + 1e-9, algo + " trace increased at " + i);
            }
        }
    }

    @Test
    public void hmmgaNeverWorseThanItsMaxMinSeed() {
        List<TaskSpec> tasks = tasks(150, 21);
        List<VmSpec> vms = vms();
        SchedulePlan maxMin = BaselineSchedulers.MAX_MIN.schedule(tasks, vms, AlgorithmOptions.defaults(), 42L);
        double seedMs = ScheduleDecoder.decode(tasks, vms, maxMin, 2).makespan();

        SchedulePlan plan = new HmmgaScheduler(2).schedule(tasks, vms, fastOptions(), 42L);
        double ms = ScheduleDecoder.decode(tasks, vms, plan, 2).makespan();
        assertTrue(ms <= seedMs + 1e-9, "HMMGA " + ms + " > Max-Min " + seedMs);
    }

    @Test
    public void hsoImprovesOverItsInitialSwarm() {
        List<TaskSpec> tasks = tasks(150, 23);
        List<VmSpec> vms = vms();
        HsoScheduler hso = new HsoScheduler(2);
        hso.schedule(tasks, vms, fastOptions(), 42L);
        List<Double> trace = hso.convergence();
        assertTrue(trace.get(trace.size() - 1) <= trace.get(0));
    }
}
