// Finds a 30-task GoCJ window where HMMGA visibly improves on Max-Min (for the in-browser lab).
import { readFileSync } from 'node:fs';
import { createServer } from 'vite';

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
const { runHmmga, DEFAULT_LAB_PARAMS } = await server.ssrLoadModule('/src/sim/hmmga.ts');
const { LAB_VMS } = await server.ssrLoadModule('/src/sim/lab.ts');
const N = 30;
const out = [];
for (const file of ['GoCJ_Dataset_1000.csv', 'GoCJ_Dataset_5000.csv']) {
  const rows = readFileSync(new URL(`../../dataset/${file}`, import.meta.url), 'utf8').trim().split(/\r?\n/).map((l) => l.split(',').map(Number));
  for (let start = 0; start + N <= Math.min(rows.length, 1500); start += 15) {
    const t0 = rows[start][2];
    const tasks = rows.slice(start, start + N).map(([len, sla, arr], id) => ({ id, lengthMi: len, sla, arrivalTime: arr - t0 }));
    const res = [42, 43, 44].map((seed) => runHmmga(tasks, LAB_VMS, { ...DEFAULT_LAB_PARAMS, seed }));
    const mm = res[0].maxMinMakespan;
    const bests = res.map((r) => r.bestMakespan);
    const gain = (mm - Math.min(...bests)) / mm;
    const firstGen = res[0].generations.findIndex((g) => g.bestMakespan < mm);
    out.push({ file, start, mm, bests, gain, distinct: new Set(bests).size, firstGen });
  }
}
out.sort((a, b) => b.gain - a.gain);
for (const o of out.slice(0, 12)) console.log(JSON.stringify(o));
await server.close();
