package id.ac.soka.scheduling.model;

public record AlgorithmOptions(CsaOptions csa, PhsOptions phs, HsoOptions hso, HmmgaOptions hmmga) {
    public AlgorithmOptions {
        if (csa == null) csa = CsaOptions.defaults();
        if (phs == null) phs = PhsOptions.defaults();
        if (hso == null) hso = HsoOptions.defaults();
        if (hmmga == null) hmmga = HmmgaOptions.defaults();
    }

    /** Task-5 compatible constructor (hybrid options fall back to defaults). */
    public AlgorithmOptions(CsaOptions csa, PhsOptions phs) {
        this(csa, phs, null, null);
    }

    public static AlgorithmOptions defaults() {
        return new AlgorithmOptions(null, null, null, null);
    }

    public record CsaOptions(int population, int selected, int generations, double beta, double timeWeight) {
        public static CsaOptions defaults() {
            return new CsaOptions(30, 10, 200, 1.0, 0.5);
        }

        public CsaOptions {
            if (population < 2 || population > 100) {
                throw new IllegalArgumentException("population must be 2..100, got: " + population);
            }
            if (selected < 1 || selected > population) {
                throw new IllegalArgumentException("selected must be 1..population, got: " + selected);
            }
            if (generations < 1 || generations > 10000) {
                throw new IllegalArgumentException("generations must be 1..10000, got: " + generations);
            }
            if (beta <= 0 || beta > 5) {
                throw new IllegalArgumentException("beta must be (0, 5], got: " + beta);
            }
            if (timeWeight < 0 || timeWeight > 1) {
                throw new IllegalArgumentException("timeWeight must be [0, 1], got: " + timeWeight);
            }
        }
    }

    public record PhsOptions(int memorySize, int iterations, int improvisations) {
        public static PhsOptions defaults() {
            return new PhsOptions(10, 200, 3);
        }

        public PhsOptions {
            if (memorySize < 2 || memorySize > 50) {
                throw new IllegalArgumentException("memorySize must be 2..50, got: " + memorySize);
            }
            if (iterations < 1 || iterations > 10000) {
                throw new IllegalArgumentException("iterations must be 1..10000, got: " + iterations);
            }
            if (improvisations < 1 || improvisations > 10) {
                throw new IllegalArgumentException("improvisations must be 1..10, got: " + improvisations);
            }
        }
    }

    /**
     * HSO (Eldesokey et al., 2021): PSO + Salp Swarm refinement + overload detection.
     *
     * @param swarm             number of particles
     * @param iterations        PSO/SSA iterations (s_max)
     * @param gaInitGenerations short GA run used to initialise the swarm (paper: "initialized using the GA")
     * @param wMax              initial inertia weight (decreases linearly to wMin)
     * @param wMin              final inertia weight
     * @param c1                cognitive coefficient k1 (Eq. 9)
     * @param c2                social coefficient k2 (Eq. 9)
     * @param salpRatio         fraction of the swarm that forms the salp chain refined by SSA
     * @param overloadThreshold VM is overloaded when predicted utilisation / mean utilisation exceeds this
     */
    public record HsoOptions(
        int swarm,
        int iterations,
        int gaInitGenerations,
        double wMax,
        double wMin,
        double c1,
        double c2,
        double salpRatio,
        double overloadThreshold
    ) {
        public static HsoOptions defaults() {
            return new HsoOptions(30, 150, 10, 0.9, 0.4, 1.5, 1.5, 0.3, 1.0);
        }

        public HsoOptions {
            if (swarm < 2 || swarm > 200) throw new IllegalArgumentException("swarm must be 2..200, got: " + swarm);
            if (iterations < 1 || iterations > 10000) throw new IllegalArgumentException("iterations must be 1..10000, got: " + iterations);
            if (gaInitGenerations < 0 || gaInitGenerations > 1000) throw new IllegalArgumentException("gaInitGenerations must be 0..1000, got: " + gaInitGenerations);
            if (wMin < 0 || wMax > 2 || wMin > wMax) throw new IllegalArgumentException("inertia must satisfy 0 <= wMin <= wMax <= 2");
            if (c1 < 0 || c1 > 4 || c2 < 0 || c2 > 4) throw new IllegalArgumentException("c1/c2 must be within [0, 4]");
            if (salpRatio <= 0 || salpRatio > 1) throw new IllegalArgumentException("salpRatio must be (0, 1], got: " + salpRatio);
            if (overloadThreshold < 1 || overloadThreshold > 5) throw new IllegalArgumentException("overloadThreshold must be [1, 5], got: " + overloadThreshold);
        }
    }

    /**
     * HMMGA (Kodli &amp; Terdal, 2021): Max-Min seeded GA with adaptive Pc/Pm (Eq. 1-2) and load-balance migration.
     *
     * @param population     chromosomes per generation
     * @param generations    number of generations
     * @param k1             Pc scale when f' >= favg
     * @param k2             Pm scale when f >= favg
     * @param k3             Pc when f' < favg
     * @param k4             Pm when f < favg
     * @param crossoverShare r: fraction of the next generation produced by crossover (the rest is copied)
     * @param migrationMoves max task migrations from overloaded to underloaded VMs per generation
     */
    public record HmmgaOptions(
        int population,
        int generations,
        double k1,
        double k2,
        double k3,
        double k4,
        double crossoverShare,
        int migrationMoves
    ) {
        public static HmmgaOptions defaults() {
            return new HmmgaOptions(30, 150, 1.0, 0.5, 1.0, 0.5, 0.6, 20);
        }

        public HmmgaOptions {
            if (population < 2 || population > 200) throw new IllegalArgumentException("population must be 2..200, got: " + population);
            if (generations < 1 || generations > 10000) throw new IllegalArgumentException("generations must be 1..10000, got: " + generations);
            for (double k : new double[] {k1, k2, k3, k4}) {
                if (k < 0 || k > 1) throw new IllegalArgumentException("k1..k4 must be within [0, 1]");
            }
            if (crossoverShare < 0 || crossoverShare > 1) throw new IllegalArgumentException("crossoverShare must be [0, 1], got: " + crossoverShare);
            if (migrationMoves < 0 || migrationMoves > 10000) throw new IllegalArgumentException("migrationMoves must be 0..10000, got: " + migrationMoves);
        }
    }
}
