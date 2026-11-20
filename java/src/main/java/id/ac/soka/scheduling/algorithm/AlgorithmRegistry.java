package id.ac.soka.scheduling.algorithm;

import id.ac.soka.scheduling.model.Scheduler;

import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Single source of truth for algorithm names, display labels and scheduler construction.
 * Iterative schedulers keep per-run state (convergence trace), so a new instance is created per call.
 */
public final class AlgorithmRegistry {

    private AlgorithmRegistry() {}

    /** Display/run order: hybrids first, then task-5 metaheuristics, then classic heuristics. */
    public static final List<String> NAMES = List.of(
        "HSO", "HMMGA", "CSA", "PHS", "MinMin", "MaxMin", "SJF", "FCFS", "RR"
    );

    public static final Set<String> ALLOWED = Set.copyOf(NAMES);

    private static final Map<String, String> LABELS = Map.of(
        "HSO", "HSO (PSO + Salp Swarm hybrid)",
        "HMMGA", "HMMGA (Max-Min + GA hybrid)",
        "CSA", "CSA (Clonal Selection Algorithm)",
        "PHS", "PHS (Polyrhythmic Harmony Search)",
        "MinMin", "Min-Min Heuristic",
        "MaxMin", "Max-Min Heuristic",
        "SJF", "Shortest Job First (SJF)",
        "FCFS", "First-Come First-Served (FCFS)",
        "RR", "Round Robin (RR)"
    );

    public static Scheduler create(String name, int totalHosts) {
        return switch (name) {
            case "HSO" -> new HsoScheduler(totalHosts);
            case "HMMGA" -> new HmmgaScheduler(totalHosts);
            case "CSA" -> new CsaScheduler(totalHosts);
            case "PHS" -> new PhsScheduler(totalHosts);
            case "FCFS" -> BaselineSchedulers.FCFS;
            case "RR" -> BaselineSchedulers.RR;
            case "SJF" -> BaselineSchedulers.SJF;
            case "MinMin" -> BaselineSchedulers.MIN_MIN;
            case "MaxMin" -> BaselineSchedulers.MAX_MIN;
            default -> throw new IllegalArgumentException("Unknown algorithm: " + name);
        };
    }

    public static String label(String name) {
        return LABELS.getOrDefault(name, name);
    }
}
