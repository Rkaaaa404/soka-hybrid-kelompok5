// Prints the JS HMMGA result on the lab instance so it can be compared with the Java scheduler.
import { createServer } from 'vite';

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
try {
  const { runHmmga, DEFAULT_LAB_PARAMS } = await server.ssrLoadModule('/src/sim/hmmga.ts');
  const { LAB_VMS } = await server.ssrLoadModule('/src/sim/lab.ts');
  const { SAMPLE_TASKS } = await server.ssrLoadModule('/src/sim/sample.ts');
  for (const seed of [42, 43, 44]) {
    const r = runHmmga(SAMPLE_TASKS, LAB_VMS, { ...DEFAULT_LAB_PARAMS, seed });
    console.log(`seed ${seed} maxmin=${r.maxMinMakespan} best=${r.bestMakespan} genes=${r.best.join('')}`);
  }
} finally {
  await server.close();
}
