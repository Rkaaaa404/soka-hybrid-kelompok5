import { useEffect } from 'react';
import MakespanBars from '../../charts/MakespanBars';
import ScatterTradeoff from '../../charts/ScatterTradeoff';
import TradeoffHeatmap from '../../charts/TradeoffHeatmap';
import { ALGO_COLOR, ALGO_LABEL, LOWER_BOUND, METRICS, METRIC_BY_KEY, SCALES, fmt } from '../../data/meta';
import { byAlgo, useSnapshots } from '../../data/results';
import type { AlgoId, MetricKey, Snapshot } from '../../data/types';
import { mean, pir } from '../../data/verdict';
import { ALL_ALGOS, useKitchen, type Scene } from '../store';
import { arenaCaption } from '../three/Arena';
import { Cite, Dock } from '../ui';

const BASE: Partial<Scene> = { focusTask: null, focusVm: null, target: false, celebrate: false, ga: null };

function ScaleTabs() {
  const { scene, setScene } = useKitchen();
  return (
    <div className="segmented small" role="group" aria-label="Skala dataset">
      {SCALES.map((n) => (
        <button key={n} aria-pressed={scene.arena.scale === n} onClick={() => setScene({ arena: { ...scene.arena, scale: n } })}>
          {n.toLocaleString('id-ID')} task
        </button>
      ))}
    </div>
  );
}

export function Competition() {
  const { setScene, run, scene } = useKitchen();
  const { data, error } = useSnapshots(SCALES);
  useEffect(() => setScene({ ...BASE, plan: run.best, arena: { scale: 5000, mode: 'makespan', algos: ALL_ALGOS } }), [run, setScene]);
  const snap = data[scene.arena.scale];
  const rivals: AlgoId[] = ['CSA', 'PHS', 'HSO'];
  return (
    <>
      <p className="eyebrow">Hasil CloudSim · metrik utama</p>
      <h2>Kompetisi dapur: siapa paling cepat?</h2>
      <p className="lead">
        Skala sebenarnya: 2 datacenter, 10 host, <b>50 VM</b> (20 Small, 20 Medium, 10 Large), GoCJ 1.000, 5.000, dan 10.000 task. Setiap algoritma dijalankan 3
        kali (seed 42, 43, 44) lalu dirata-rata. Tinggi menara = makespan ÷ batas bawah, jadi menara yang menyentuh bidang biru sudah optimal.
      </p>
      <Dock
        caption={
          <>
            Tinggi menara = makespan ÷ batas bawah · <b>makin rendah makin baik</b>
          </>
        }
      >
        <ScaleTabs />
      </Dock>
      {error && <p className="error">Gagal memuat hasil: {error}</p>}
      {snap ? <MakespanBars snap={snap} highlight="HMMGA" /> : <p className="muted">Memuat…</p>}
      <h3 className="sub">Performance Improvement Rate HMMGA</h3>
      <p className="note" style={{ marginTop: 0 }}>
        Eq. 14 paper HSO: PIR = (makespan lain − makespan HMMGA) × 100 / makespan HMMGA.
      </p>
      <table className="data compact">
        <thead>
          <tr>
            <th>Terhadap</th>
            {SCALES.map((n) => (
              <th key={n}>{n / 1000}k</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rivals.map((a) => (
            <tr key={a}>
              <td>
                <span className="swatch" style={{ background: ALGO_COLOR[a] }} /> {ALGO_LABEL[a]}
                {a !== 'HSO' && <span className="muted small"> (task-5)</span>}
              </td>
              {SCALES.map((n) => {
                const o = mean(data, n, a);
                const w = mean(data, n, 'HMMGA');
                return <td key={n}>{o !== undefined && w !== undefined ? `${pir(o, w) >= 0 ? '+' : ''}${fmt(pir(o, w), 1)}%` : '…'}</td>;
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="note">
        HMMGA menyentuh batas bawah di ketiga skala ({fmt(LOWER_BOUND[1000], 0)} / {fmt(LOWER_BOUND[5000], 1)} / {fmt(LOWER_BOUND[10000], 0)} s) dengan SD 0. PIR 0%
        terhadap PHS di 1k dan 10k berarti keduanya sama-sama optimal; pembedanya ada di 5k.
      </p>
    </>
  );
}

const TRADE_KEYS: MetricKey[] = ['makespan', 'averageWaitingTime', 'resourceUtilization', 'degreeOfImbalance', 'totalCost', 'schedulingTime'];

/** Rank (1 = best, ties share a rank) of every algorithm on one metric of one snapshot. */
function ranks(snap: Snapshot | undefined, key: MetricKey): { rank: Partial<Record<AlgoId, number>>; best: AlgoId[]; n: number } {
  if (!snap) return { rank: {}, best: [], n: 0 };
  const lower = METRIC_BY_KEY[key].better === 'lower';
  const vals = snap.results.map((r) => ({ a: r.algorithm, v: r.metrics[key].mean }));
  const eps = (v: number) => Math.abs(v) * 1e-6 + 1e-9;
  const rank: Partial<Record<AlgoId, number>> = {};
  for (const { a, v } of vals) rank[a] = 1 + vals.filter((o) => (lower ? o.v < v - eps(v) : o.v > v + eps(v))).length;
  return { rank, best: vals.filter((x) => rank[x.a] === 1).map((x) => x.a), n: vals.length };
}

/** Why HMMGA lands where it does on each metric (shown next to the computed verdict). */
const REASON: Partial<Record<MetricKey, string>> = {
  makespan: 'fitness GA-nya memang 1/makespan, dan elitisme menjaga rekor tidak memburuk',
  degreeOfImbalance: 'migrasi memindahkan task dari VM yang overload, jadi beban antar-VM rata',
  totalCost: 'biaya = total waktu CPU tiap task × tarif tetap, jadi makin banyak task di VM cepat makin murah; Min-Min dan SJF masih sedikit lebih murah',
  resourceUtilization: 'hasilnya bergantung skala',
  averageWaitingTime: 'HMMGA mengejar selesai paling akhir, bukan antrean per task; Min-Min dan SJF mendahulukan task pendek',
  schedulingTime: 'GA mengevaluasi puluhan jadwal per generasi, sedangkan heuristik cukup satu kali jalan',
};

function HmmgaReport({ onPick }: { onPick: (k: MetricKey) => void }) {
  const { data } = useSnapshots(SCALES);
  const { scene } = useKitchen();
  const table = TRADE_KEYS.map((k) => {
    const r = SCALES.map((n) => ranks(data[n], k));
    const hr = r.map((x) => x.rank.HMMGA).filter((x): x is number => x !== undefined);
    const avg = hr.length ? hr.reduce((a, b) => a + b, 0) / hr.length : NaN;
    return { k, r, hr, avg };
  });
  if (table.some((t) => t.hr.length < SCALES.length)) return null;
  const range = (hr: number[]) => (Math.min(...hr) === Math.max(...hr) ? `#${hr[0]}` : `#${Math.min(...hr)}–${Math.max(...hr)}`);
  const strong = table.filter((t) => t.avg <= 2);
  const mid = table.filter((t) => t.avg > 2 && t.avg <= 4);
  const weak = table.filter((t) => t.avg > 4);
  const n = table[0].r[0].n;
  const name = (k: MetricKey) => METRIC_BY_KEY[k].label.toLowerCase();
  const group = (title: string, cls: string, items: typeof table) =>
    items.length > 0 && (
      <li className={cls}>
        <b>{title}</b>{' '}
        {items.map((t, i) => (
          <span key={t.k}>
            {i ? '; ' : ''}
            {name(t.k)} ({range(t.hr)}){REASON[t.k] ? `, ${REASON[t.k]}` : ''}
          </span>
        ))}
        .
      </li>
    );
  return (
    <>
      <h3 className="sub">Rapor HMMGA: peringkat dari {n} algoritma</h3>
      <table className="data compact rapor">
        <thead>
          <tr>
            <th>Metrik</th>
            {SCALES.map((s) => (
              <th key={s}>{s / 1000}k</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.map((t) => (
            <tr key={t.k} className={scene.arena.mode === t.k ? 'hl' : undefined} onClick={() => onPick(t.k)}>
              <td>
                {METRIC_BY_KEY[t.k].short} <span className="muted small">{METRIC_BY_KEY[t.k].better === 'lower' ? '↓' : '↑'}</span>
              </td>
              {t.hr.map((r, i) => (
                <td key={i} className={r === 1 ? 'rank-win' : r <= 2 ? 'rank-good' : r > 4 ? 'rank-bad' : undefined}>
                  {r === 1 ? '👑 #1' : `#${r}`}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="note" style={{ marginTop: 4 }}>
        Klik baris untuk menampilkan metrik itu di menara. ↓ = makin rendah makin baik, ↑ = makin tinggi makin baik.
      </p>
      <h3 className="sub">Kesimpulan trade-off</h3>
      <ul className="clean bullets verdict">
        {group('HMMGA unggul di', 'good', strong)}
        {group('Menengah di', 'mid', mid)}
        {group('HMMGA lemah di', 'bad', weak)}
      </ul>
      <p className="callout gold">
        Pilih HMMGA kalau targetnya <b>semua task selesai secepat mungkin dengan beban VM seimbang</b>, dan waktu menyusun jadwal beberapa detik masih bisa
        diterima. Kalau yang dipentingkan respons tiap task atau penjadwalan instan, heuristik seperti Min-Min atau SJF lebih cocok.
      </p>
    </>
  );
}

export function Tradeoff() {
  const { setScene, run, scene } = useKitchen();
  const { data } = useSnapshots(SCALES);
  useEffect(() => setScene({ ...BASE, plan: run.best, arena: { scale: 5000, mode: 'schedulingTime', algos: ALL_ALGOS } }), [run, setScene]);
  const snap = data[scene.arena.scale];
  const mode = scene.arena.mode;
  const cap = arenaCaption(mode);
  const key: MetricKey = mode === 'makespan' ? 'makespan' : mode;
  const rk = ranks(snap, key);
  const meta = METRIC_BY_KEY[key];
  const val = (a: AlgoId) => {
    const r = byAlgo(snap, a);
    return r ? `${fmt(r.metrics[key].mean, meta.digits)}${meta.unit ? ` ${meta.unit}` : ''}` : '…';
  };
  const pick = (k: MetricKey) => setScene({ arena: { ...scene.arena, mode: k } });
  return (
    <>
      <p className="eyebrow">Trade-off</p>
      <h2>Makespan bukan satu-satunya ukuran</h2>
      <p className="lead">
        Pilih metrik untuk mengganti menara. HMMGA unggul di makespan, tapi manajernya <b>berpikir lebih lama</b>.
      </p>
      <p className="metric-cap">
        {cap.what} · <b>{cap.better}</b>.
        {rk.best.length > 0 && (
          <span className="winner-line">
            👑 Juara {meta.label.toLowerCase()} ({scene.arena.scale / 1000}k): <b>{rk.best.map((a) => ALGO_LABEL[a]).join(', ')}</b> ({val(rk.best[0])})
            {!rk.best.includes('HMMGA') && (
              <>
                {' '}
                · HMMGA peringkat #{rk.rank.HMMGA} ({val('HMMGA')})
              </>
            )}
          </span>
        )}
      </p>
      <Dock
        caption={
          <>
            {cap.what} · <b>{cap.better}</b>
            {rk.best.length > 0 && (
              <>
                {' '}
                · 👑 {rk.best.map((a) => ALGO_LABEL[a]).join(', ')}
              </>
            )}
          </>
        }
      >
        <div className="chip-row">
          {TRADE_KEYS.map((k) => (
            <button key={k} className="chip" aria-pressed={mode === k} onClick={() => pick(k)}>
              {METRICS.find((m) => m.key === k)!.label}
            </button>
          ))}
        </div>
        <ScaleTabs />
      </Dock>
      <HmmgaReport onPick={pick} />
      {snap && (
        <>
          <h3 className="sub">Semua metrik sekaligus</h3>
          <p className="note">Heatmap: semua metrik dinormalisasi supaya arahnya sama, jadi di sini warna lebih terang = lebih baik.</p>
          <div className="table-scroll">
            <TradeoffHeatmap snap={snap} />
          </div>
          <ScatterTradeoff snap={snap} />
        </>
      )}
      <p className="note">Energi dalam model ini proporsional terhadap makespan, jadi tidak dibahas terpisah.</p>
    </>
  );
}

export function Conclusion() {
  const { setScene, run } = useKitchen();
  const { data } = useSnapshots(SCALES);
  useEffect(() => setScene({ ...BASE, plan: run.best, celebrate: true, arena: { scale: 5000, mode: 'makespan', algos: ALL_ALGOS } }), [run, setScene]);
  const v = (n: number, a: AlgoId) => {
    const x = mean(data, n, a);
    return x === undefined ? '…' : fmt(x, 0);
  };
  return (
    <>
      <p className="eyebrow">Kesimpulan</p>
      <h2>HMMGA, manajer dapur terbaik untuk makespan</h2>
      <ul className="clean bullets">
        <li>
          <b>Juara makespan:</b> HMMGA menyentuh batas bawah di ketiga skala ({v(1000, 'HMMGA')} / {v(5000, 'HMMGA')} / {v(10000, 'HMMGA')} s).
        </li>
        <li>
          <b>vs HSO:</b> menang di 5k dan 10k ({v(5000, 'HSO')} dan {v(10000, 'HSO')} s), seri di 1k.
        </li>
        <li>
          <b>vs CSA &amp; PHS (task-5):</b> mengalahkan CSA di semua skala; mengalahkan PHS di 5k ({v(5000, 'PHS')} → {v(5000, 'HMMGA')} s), seri di 1k dan 10k.
        </li>
        <li>
          <b>Kenapa berhasil:</b> Max-Min memberi bibit yang kuat, GA dengan elitisme menjamin hasilnya tidak lebih buruk, dan migrasi merapikan koki yang menjadi
          bottleneck.
        </li>
        <li>
          <b>Harganya:</b> scheduling time lebih tinggi daripada PHS dan heuristik.
        </li>
      </ul>
      <h3 className="sub">Catatan jujur</h3>
      <ul className="clean bullets small">
        <li>MLR-DOVM pada HSO diadaptasi menjadi prediktor utilisasi CPU analitik, karena GoCJ tidak punya data profiling untuk melatih regresi.</li>
        <li>Di 1k dan 10k, makespan dikunci oleh task terakhir yang datang, sehingga beberapa algoritma sudah optimal; pembeda paling nyata ada di 5k.</li>
        <li>Dapur di presentasi ini adalah instance demo (30 task, 1 host). Angka hasil berasal dari CloudSim dengan 50 VM.</li>
      </ul>
      <h3 className="sub">Referensi</h3>
      <Cite
        text="Kodli, S., & Terdal, S. (2021). Hybrid Max-Min Genetic Algorithm for Load Balancing and Task Scheduling in Cloud Environment. IJIES, 14(1), 63–71."
        doi="10.22266/ijies2021.0228.07"
        pdf="hmmga-kodli-2021.pdf"
      />
      <Cite
        text="Eldesokey, H. M., dkk. (2021). Hybrid swarm optimization algorithm based on task scheduling in a cloud environment. Int. J. Commun. Syst., e4694."
        doi="10.1002/dac.4694"
        pdf="hso-eldesokey-2021.pdf"
      />
      <Cite text="Jena (2017). A Two-Stage Clonal Selection Algorithm for Task Scheduling in Cloud Computing Environment. (CSA, task-5)" pdf="csa-jena-2017.pdf" />
      <Cite text="Melnik & Trofimenko (2015). Polyrhythmic Harmony Search Algorithm for Resource Allocation in Distributed Computing Systems. (PHS, task-5)" pdf="phs-melnik-2015.pdf" />
    </>
  );
}
