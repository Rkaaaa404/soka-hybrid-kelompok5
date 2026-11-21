import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ALGO_COLOR, SCALES, fmt } from '../../data/meta';
import { useSnapshots } from '../../data/results';
import { hybridWinner, mean } from '../../data/verdict';
import { DEFAULT_LAB_PARAMS, candidateTasks } from '../../sim/hmmga';
import { CHEF_COLORS, CHEF_NAMES, CHEF_ROLE, LAB_LB, LAB_LB_PARTS, TASKS, VMS, fmtS, roundRobin } from '../model';
import { COLOR_A, COLOR_B, COLOR_CHILD, GA_PHASES, breed, recordMoments, spotlight } from '../three/PlanningRoom';
import { useKitchen, type Scene } from '../store';
import { ChefLegend, Cite, Dock, GeneRuler, GeneStrip, Pipeline, Player, SeedPicker, Sparkline, TimePlay, usePlayer } from '../ui';

const BASE: Partial<Scene> = { focusTask: null, focusVm: null, target: false, celebrate: false };

const MEMBERS = [
  ['5027241002', 'Balqis Sani Sabillah'],
  ['5027241018', 'Zaenal Mustofa'],
  ['5027241039', 'Rayka Dharma Pranandita'],
  ['5027241083', 'Mutiara Diva Jaladitha'],
  ['5027241101', 'Binar Najmuddin Mahya'],
];

export function Intro() {
  const { run, setScene, go } = useKitchen();
  useEffect(() => setScene({ ...BASE, plan: run.best, ga: null }), [run, setScene]);
  return (
    <>
      <p className="eyebrow">Tugas 7 SOKA · Kelompok 5</p>
      <h1 className="k-title">
        Cloud Kitchen<span>HMMGA menjadwalkan pesanan</span>
      </h1>
      <p className="lead">
        Cloud task scheduling itu mirip dapur pesanan online: banyak pesanan masuk, koki-kokinya punya kecepatan berbeda, dan semua orang ingin pesanan terakhir
        cepat selesai. Di dapur ini, <b>HMMGA</b> berperan sebagai manajer yang menyusun jadwalnya.
      </p>
      <div className="legend-grid">
        <span>👩‍🍳 Koki</span>
        <b>VM</b>
        <span>🔥 Kompor</span>
        <b>PE (core)</b>
        <span>⚡ Kecepatan masak</span>
        <b>MIPS</b>
        <span>🥡 Pesanan (rantang)</span>
        <b>task / cloudlet GoCJ</b>
        <span>📏 Porsi</span>
        <b>panjang task (MI)</b>
        <span>⏰ Pesanan terakhir selesai</span>
        <b>makespan</b>
        <span>📋 Manajer</span>
        <b>scheduler</b>
      </div>
      <button className="btn primary big" onClick={() => go(1)}>
        Mulai tur →
      </button>
      <ul className="team">
        {MEMBERS.map(([nrp, name]) => (
          <li key={nrp}>
            <span className="mono muted">{nrp}</span> {name}
          </li>
        ))}
      </ul>
      <p className="hint">Seret untuk memutar dunia · scroll untuk zoom · ← → untuk pindah bab · arahkan kursor ke rantang untuk detail.</p>
    </>
  );
}

export function Selection() {
  const { setScene, run, scene } = useKitchen();
  const { data } = useSnapshots(SCALES);
  const { winner, wins } = hybridWinner(data);
  useEffect(() => setScene({ ...BASE, plan: run.best, ga: null, arena: { scale: 5000, mode: 'makespan', algos: ['HSO', 'HMMGA'] } }), [run, setScene]);
  const setScale = (s: number) => setScene({ arena: { scale: s, mode: 'makespan', algos: ['HSO', 'HMMGA'] } });
  return (
    <>
      <p className="eyebrow">Pilih dua, presentasikan satu</p>
      <h2>Dua hybrid bertanding, satu jadi manajer</h2>
      <p className="lead">
        Kedua hybrid diimplementasikan di CloudSim dan dijalankan pada dataset GoCJ yang sama. Yang dipresentasikan adalah yang <b>makespan rata-ratanya lebih
        rendah</b> di mayoritas skala.
      </p>
      <div className="hybrid-cards">
        <div className="hcard" style={{ ['--c' as string]: ALGO_COLOR.HSO }}>
          <h3>HSO</h3>
          <p>PSO + Salp Swarm Optimization, plus deteksi VM overload (MLR-DOVM).</p>
          <Cite text="Eldesokey dkk. (2021), Int. J. Commun. Syst., e4694." doi="10.1002/dac.4694" pdf="hso-eldesokey-2021.pdf" />
        </div>
        <div className={`hcard${winner === 'HMMGA' ? ' win' : ''}`} style={{ ['--c' as string]: ALGO_COLOR.HMMGA }}>
          <h3>HMMGA {winner === 'HMMGA' && <span className="badge win">★ juara</span>}</h3>
          <p>Heuristik Max-Min + Genetic Algorithm adaptif, plus migrasi beban.</p>
          <Cite text="Kodli & Terdal (2021), IJIES 14(1), 63–71." doi="10.22266/ijies2021.0228.07" pdf="hmmga-kodli-2021.pdf" />
        </div>
      </div>
      <table className="data compact">
        <thead>
          <tr>
            <th>Makespan (s)</th>
            {SCALES.map((n) => (
              <th key={n}>
                <button className="link-btn" aria-pressed={scene.arena.scale === n} onClick={() => setScale(n)}>
                  {n / 1000}k
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {(['HSO', 'HMMGA'] as const).map((a) => (
            <tr key={a}>
              <td>
                <span className="swatch" style={{ background: ALGO_COLOR[a] }} /> {a}
              </td>
              {SCALES.map((n) => {
                const v = mean(data, n, a);
                const o = mean(data, n, a === 'HSO' ? 'HMMGA' : 'HSO');
                const best = v !== undefined && o !== undefined && v <= o;
                return (
                  <td key={n} className={best ? 'hl-cell' : undefined}>
                    {v !== undefined ? fmt(v, 0) : '…'}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <Dock dockOnly caption="HSO vs HMMGA · makespan rata-rata">
        <div className="segmented small" role="group" aria-label="Skala">
          {SCALES.map((n) => (
            <button key={n} aria-pressed={scene.arena.scale === n} onClick={() => setScale(n)}>
              {n.toLocaleString('id-ID')} task
            </button>
          ))}
        </div>
      </Dock>
      <p className="note">
        HMMGA menang di {wins.HMMGA} skala dan seri di 1k (keduanya sudah di batas bawah). HSO tidak stabil di skala besar (SD 276 s di 5k, 2.022 s di 10k).
        Karena itu, mulai bab berikutnya <b>HMMGA</b> yang menjadi manajer dapur. Klik 1k/5k/10k untuk mengganti skala menara.
      </p>
    </>
  );
}

/**
 * Makespan scoreboard: one time axis with fixed reference marks (lower bound, HMMGA, Max-Min, Round Robin) and one
 * moving pin for the schedule currently shown in the kitchen.
 */
function ScoreBoard({ name, compact = false }: { name: string; compact?: boolean }) {
  const { stats, run, ev, seed } = useKitchen();
  const rr = useMemo(() => ev.makespan(roundRobin()), [ev]);
  const hmmga = run.bestMakespan;
  const now = stats.makespan;
  const max = Math.max(rr, now) * 1.05;
  const pct = (v: number) => Math.min(100, (v / max) * 100);
  const pinColor = now <= hmmga + 1e-6 ? '#ffd166' : '#ff6b6f';
  const marks = [
    { key: 'lb', name: 'Batas tercepat', v: LAB_LB, color: '#5ec8ff' },
    { key: 'hmmga', name: 'HMMGA', v: hmmga, color: '#f0b429' },
    { key: 'mm', name: 'Max-Min', v: run.maxMinMakespan, color: '#c3c2b7' },
    { key: 'rr', name: 'Round Robin', v: rr, color: '#a18fd0' },
  ];
  return (
    <div className={`scoreboard${compact ? ' compact' : ''}`}>
      {!compact && (
        <div className="sb-head">
          <b>Makespan: waktu pesanan terakhir selesai</b>
          <span>← makin kiri makin baik</span>
        </div>
      )}
      <div className="sb-ladder">
        {/* the label slides with the pin but stays inside the box: shift it left by the same percentage */}
        <div className="sb-now" style={{ left: `${pct(now)}%`, transform: `translateX(-${pct(now)}%)` }}>
          Yang tampil <b style={{ color: pinColor }}>{fmtS(now)}</b> <em>{name}</em>
        </div>
        <div className="sb-axis">
          {marks.map((m) => (
            <i key={m.key} className="sb-tick" style={{ left: `${pct(m.v)}%`, background: m.color }} title={`${m.name} ${fmtS(m.v)}`} />
          ))}
          <span className="sb-pin" style={{ left: `${pct(now)}%`, background: pinColor }} />
        </div>
        <div className="sb-scale">
          <span>0 s</span>
          <span>{fmtS(max)}</span>
        </div>
      </div>
      <ul className="sb-legend">
        {marks.map((m) => (
          <li key={m.key}>
            <i style={{ background: m.color }} />
            {m.name} <b>{fmtS(m.v)}</b>
          </li>
        ))}
      </ul>
      {!compact && (
        <dl className="sb-defs">
          <dt>Yang tampil</dt>
          <dd>makespan jadwal yang sedang terlihat di dapur 3D (pilih lewat tab di atas).</dd>
          <dt>Round Robin · Max-Min · HMMGA</dt>
          <dd>tiga cara membagi 30 pesanan yang sama ke 5 koki yang sama (HMMGA seed {seed}).</dd>
          <dt>Batas tercepat</dt>
          <dd>
            tidak ada jadwal yang bisa lebih cepat, bahkan jika seluruh {LAB_LB_PARTS.mips.toLocaleString('id-ID')} MIPS dapur bekerja tanpa jeda sejak
            pesanan datang.
          </dd>
        </dl>
      )}
    </div>
  );
}

export function KitchenIntro() {
  const { setScene, run, stats, ev } = useKitchen();
  const [view, setView] = useState(0);
  // three ways to split the same 30 orders over the same 5 chefs (memoised so the scene effect runs once per tab)
  const schedules = useMemo(
    () => [
      { name: 'Round Robin', plan: roundRobin(), desc: 'Pesanan dibagi bergiliran ke koki 1, 2, 3, 4, 5, 1, … tanpa melihat kecepatan koki.' },
      { name: 'Max-Min', plan: run.maxMin.assignedVm, desc: 'Pesanan terberat lebih dulu, diberikan ke koki yang paling cepat menyelesaikannya. Ini tahap 1 HMMGA.' },
      { name: 'HMMGA', plan: run.best, desc: 'Jadwal Max-Min yang diperbaiki oleh GA dan migrasi beban (tahap 2 dan 3, dibahas di bab berikutnya).' },
    ],
    [run],
  );
  useEffect(() => setScene({ ...BASE, plan: schedules[view].plan, target: true, celebrate: view === 2, ga: null }), [view, schedules, setScene]);
  const ms = useMemo(() => schedules.map((s) => ev.makespan(s.plan)), [schedules, ev]);
  const cur = schedules[view];
  const hmmga = run.bestMakespan;
  const bottleneck = <b style={{ color: CHEF_COLORS[stats.bottleneck] }}>{CHEF_NAMES[stats.bottleneck]}</b>;
  return (
    <>
      <p className="eyebrow">Dapur = datacenter</p>
      <h2>Cara membagi pesanan menentukan makespan</h2>
      <p className="lead">
        Ini satu host dari CloudSim yang dijadikan dapur: 5 koki (VM) dengan kecepatan berbeda dan 30 pesanan GoCJ asli. Tugas manajer (scheduler) adalah
        membagi pesanan supaya <b>pesanan terakhir selesai secepat mungkin</b>. Waktu itulah yang disebut <b>makespan</b>.
      </p>
      <Dock caption={<>Jadwal di dapur: <b>{cur.name}</b> · makespan {fmtS(stats.makespan)}</>}>
        <div className="stage-tabs">
          {schedules.map((s, i) => (
            <button key={s.name} aria-pressed={view === i} onClick={() => setView(i)}>
              <span className="n">{i + 1}</span>
              {s.name}
              <b>{fmtS(ms[i])}</b>
            </button>
          ))}
        </div>
        <ScoreBoard name={cur.name} />
        <div className="btn-row">
          <TimePlay />
        </div>
      </Dock>
      <div className="callout">
        <b>{cur.name}</b>: {cur.desc}
        <br />
        {view === 0 && (
          <>
            Pesanan besar ikut jatuh ke koki junior yang paling lambat, sehingga {bottleneck} (bendera merah) baru selesai di {fmtS(stats.makespan)},{' '}
            <b>{fmt(stats.makespan / hmmga, 1)}×</b> lebih lama daripada HMMGA.
          </>
        )}
        {view === 1 && (
          <>
            Makespan turun ke {fmtS(stats.makespan)}. Koki paling lama kini {bottleneck}, masih {fmtS(stats.makespan - hmmga)} di atas HMMGA.
          </>
        )}
        {view === 2 && (
          <>
            Makespan {fmtS(stats.makespan)}, hanya {fmtS(stats.makespan - LAB_LB)} di atas batas tercepat. Bab 4–6 membahas bagaimana HMMGA sampai ke jadwal
            ini.
          </>
        )}
      </div>
      <h3 className="sub">Cara membaca dapur</h3>
      <ul className="clean bullets small">
        <li>
          <b>Tinggi rantang = lama dimasak.</b> Rantang di kompor yang sama ditumpuk berurutan, jadi puncak menara = waktu kompor itu selesai.
        </li>
        <li>
          <b style={{ color: '#ff9a9d' }}>Garis merah</b> = makespan (puncak menara tertinggi). <b style={{ color: '#a8e3ff' }}>Garis biru putus-putus</b> =
          batas tercepat. <b style={{ color: '#ffd166' }}>Garis emas</b> = target HMMGA.
        </li>
        <li>
          Tekan <b>▶ Putar waktu</b> untuk melihat dapur memasak dari detik 0. Menara tumbuh, dan garis merah muncul saat pesanan terakhir selesai.
        </li>
      </ul>
      <div className="chef-list">
        {VMS.map((vm, v) => (
          <div key={v} className="chef-row" style={{ ['--c' as string]: CHEF_COLORS[v] }}>
            <span className="dot" />
            <b>{CHEF_NAMES[v]}</b>
            <span className="muted">
              {CHEF_ROLE[v]} · {vm.pes} kompor · {vm.mips} MIPS
            </span>
          </div>
        ))}
      </div>
    </>
  );
}

export function MaxMinChapter() {
  const { run, setScene } = useKitchen();
  const steps = run.maxMin.steps;
  const p = usePlayer(steps.length, 0, 850);
  const k = p.pos;
  useEffect(() => {
    const plan = TASKS.map(() => -1);
    steps.slice(0, k).forEach((s) => (plan[s.task] = s.vm));
    const next = steps[k];
    setScene({ ...BASE, plan, ga: null, focusTask: next?.task ?? null, focusVm: next?.vm ?? null });
  }, [k, steps, setScene]);
  const next = steps[k];
  const cands = next ? [...next.candidates].sort((a, b) => b.completion - a.completion).slice(0, 5) : [];
  return (
    <>
      <Pipeline active={0} />
      <p className="eyebrow">Tahap 1 · Max-Min</p>
      <h2>Pesanan terberat diambil duluan</h2>
      <p className="lead">
        HMMGA tidak mulai dari nol. Tahap pertamanya adalah heuristik Max-Min yang cepat, dan hasilnya menjadi <b>bibit</b> untuk GA.
      </p>
      <ol className="steps">
        <li>
          Untuk setiap pesanan di papan, hitung kapan pesanan itu <b>selesai</b> jika diberikan ke tiap koki, lalu catat koki yang paling cepat
          menyelesaikannya.
        </li>
        <li>
          Dari semua pesanan, ambil yang waktu selesai tercepatnya paling <b>lama</b>, yaitu pesanan terberat, lalu berikan ke koki tercepat tadi.
        </li>
        <li>Ulangi sampai papan kosong.</li>
      </ol>
      <div className="formula">CTᵢⱼ = max(datangᵢ, kompor kosongⱼ) + porsiᵢ / MIPSⱼ → pilih maxᵢ minⱼ CTᵢⱼ</div>
      <p className="note">
        CT = completion time (waktu selesai). <i>Kompor kosongⱼ</i> = saat kompor koki j paling cepat bebas. Pesanan berat didahulukan supaya jadwal tidak
        diakhiri satu pesanan raksasa yang membuat semua koki lain menunggu.
      </p>
      {next ? (
        <div className="decision">
          <div className="decision-head">Langkah {k + 1} dari {steps.length}</div>
          <div className="decision-main">
            Pesanan <b>#{next.task}</b> ({Math.round(TASKS[next.task].lengthMi / 1000)}k MI) →{' '}
            <b style={{ color: CHEF_COLORS[next.vm] }}>{CHEF_NAMES[next.vm]}</b>, selesai {fmtS(next.completion)}
          </div>
          <table className="data compact">
            <thead>
              <tr>
                <th>Pesanan</th>
                <th>Koki tercepat</th>
                <th>CT min</th>
              </tr>
            </thead>
            <tbody>
              {cands.map((c) => (
                <tr key={c.task} className={c.task === next.task ? 'hl' : undefined}>
                  <td>#{c.task}</td>
                  <td style={{ color: CHEF_COLORS[c.vm] }}>{CHEF_NAMES[c.vm]}</td>
                  <td>{fmtS(c.completion)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="note">5 kandidat teratas dari {next.candidates.length} pesanan di papan. Yang paling atas yang dipilih.</p>
        </div>
      ) : (
        <div className="decision done">
          Papan kosong. Jadwal Max-Min selesai dengan makespan <b>{fmtS(run.maxMinMakespan)}</b>. Cepat dan masuk akal, tapi greedy: sekali diambil, keputusannya
          tidak pernah ditinjau ulang. Jadwal ini menjadi <b>bibit pertama</b> untuk GA.
        </div>
      )}
      <Dock
        caption={
          next ? (
            <>
              Langkah {k + 1}: pesanan <b>#{next.task}</b> ({Math.round(TASKS[next.task].lengthMi / 1000)}k MI) →{' '}
              <b style={{ color: CHEF_COLORS[next.vm] }}>{CHEF_NAMES[next.vm]}</b>, selesai {fmtS(next.completion)}
            </>
          ) : (
            <>
              Papan kosong · makespan Max-Min <b>{fmtS(run.maxMinMakespan)}</b>
            </>
          )
        }
      >
        <Player p={p} label="Langkah Max-Min" />
      </Dock>
    </>
  );
}

const PHASE_MS = [2200, 4200, 3400, 3000, 2400];

/** Make-up of every new generation, derived the same way as hmmga.ts (copyCount includes the elite). */
const recipe = (() => {
  const p = DEFAULT_LAB_PARAMS.population;
  const copyCount = Math.max(1, Math.round((1 - DEFAULT_LAB_PARAMS.crossoverShare) * p));
  return { elite: 1, copies: copyCount - 1, children: p - copyCount };
})();
/** Which recipe step each GA phase (Populasi, Seleksi, Crossover, Mutasi, Generasi baru) belongs to. */
const RECIPE_STEP_OF_PHASE = [-1, 0, 1, 2, 3];

/**
 * GA chapter. One step = one phase of one generation, so a generation is explained as
 * population → roulette selection → crossover → mutation → new generation.
 */
export function GaChapter() {
  const { run, setScene, seed, ev } = useKitchen();
  const G = run.generations.length - 1;
  const total = G * 5;
  const [s, setS] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [fast, setFast] = useState(false);
  const g = s === 0 ? 0 : Math.floor((s - 1) / 5) + 1;
  const phase = s === 0 ? 4 : (s - 1) % 5;
  const at = (gen: number, ph: number) => (gen === 0 ? 0 : 1 + (gen - 1) * 5 + ph);

  useEffect(() => {
    if (!playing) return;
    if (s >= total) {
      setPlaying(false);
      return;
    }
    const t = setTimeout(() => setS(fast ? Math.min(total, at(g + 1, 4)) : s + 1), fast ? 1100 : PHASE_MS[phase]);
    return () => clearTimeout(t);
  }, [playing, s, fast, total, g, phase]);

  const wallG = phase < 4 ? g - 1 : g;
  const wall = run.generations[wallG];
  useEffect(() => {
    setScene({ ...BASE, ga: { gen: g, phase }, plan: wall.population[wall.bestIdx].genes });
  }, [g, phase, wall, setScene]);

  const spot = spotlight(run.generations, g);
  const info = spot ? breed(spot, ev) : null;
  const prevPop = g > 0 ? run.generations[g - 1].population : [];
  const fsum = prevPop.reduce((a, p) => a + 1 / p.makespan, 0);
  const share = (i: number) => fmt(((1 / prevPop[i].makespan) / fsum) * 100, 1);
  const sorted = [...wall.population].sort((a, b) => a.makespan - b.makespan);
  const best = sorted[0];
  const moments = useMemo(() => recordMoments(run.generations), [run]);
  const crossGens = useMemo(() => run.generations.slice(1).filter((x) => x.population.some((p) => p.origin === 'cross')).length, [run]);
  // fitness stats of the parent population, stored on generation g by the sim; shown as makespans (1/f) to stay readable
  const genStats = g > 0 ? run.generations[g] : null;
  const asMs = (f: number) => fmtS(1 / f);
  const jump = (gen: number, ph: number) => {
    setPlaying(false);
    setS(at(gen, ph));
  };

  const kindLine = spot ? (
    <p className="spot-kind">
      Kartu yang diikuti:{' '}
      {spot.kind === 'cross' ? (
        <b>anak crossover dari dua induk</b>
      ) : spot.kind === 'clone' ? (
        <b>anak dari dua induk, tetapi crossover ditolak oleh Pc</b>
      ) : (
        <b>salinan roulette (bagian 40% yang tidak disilangkan)</b>
      )}
      {spot.record && <span className="record"> ★ kartu ini memecahkan rekor</span>}
    </p>
  ) : null;

  let body: ReactNode;
  if (g === 0) {
    const origins = wall.population.reduce<Record<string, number>>((a, p) => ((a[p.origin] = (a[p.origin] ?? 0) + 1), a), {});
    body = (
      <>
        <p>
          Populasi awal berisi {wall.population.length} kartu: 1 kartu jadwal <b>Max-Min</b> ({fmtS(run.maxMinMakespan)}), {origins.seeded ?? 0} varian
          Max-Min yang dimutasi ringan, dan {origins.random ?? 0} jadwal acak (sampai {fmtS(sorted[sorted.length - 1].makespan)}). Kartu terbaik diberi mahkota.
        </p>
        <p>Tekan › untuk mengikuti satu generasi langkah demi langkah, atau lompat ke momen penting di bawah.</p>
      </>
    );
  } else if (!spot || !info || !genStats) {
    body = <p>Generasi ini tidak punya kartu baru untuk diikuti.</p>;
  } else if (phase === 0) {
    body = (
      <>
        <p>
          Ini <b>generasi {g - 1}</b>: {prevPop.length} kartu calon induk, diurutkan dari yang tercepat (kiri atas). Terbaik {fmtS(sorted[0].makespan)},
          terburuk {fmtS(sorted[sorted.length - 1].makespan)}.
        </p>
        <p>Dari kartu-kartu ini akan dibuat {prevPop.length} kartu generasi berikutnya dengan resep di atas.</p>
      </>
    );
  } else if (phase === 1) {
    body =
      spot.kind === 'copy' ? (
        <>
          {kindLine}
          <p>
            Setiap kartu mendapat irisan roda selebar <b>fitness = 1/makespan</b>. Untuk kartu salinan, roda cukup diputar <b>sekali</b>: kartu{' '}
            <b style={{ color: COLOR_A }}>{fmtS(spot.a.makespan)}</b> terpilih (peluang {share(spot.ia)}%) dan disalin apa adanya.
          </p>
          <p className="note">Kartu terbaik (elit) selalu disalin tanpa roda. Kartu lambat tetap bisa terpilih, hanya peluangnya kecil, supaya populasi tetap beragam.</p>
        </>
      ) : (
        <>
          {kindLine}
          <p>
            Setiap kartu mendapat irisan roda selebar <b>fitness = 1/makespan</b>, jadi jadwal cepat punya irisan lebih besar. Roda diputar dua kali:
          </p>
          <ul className="clean bullets">
            <li>
              <b style={{ color: COLOR_A }}>Induk A</b>: {fmtS(spot.a.makespan)}, peluang {share(spot.ia)}% per putaran
            </li>
            <li>
              <b style={{ color: COLOR_B }}>Induk B</b>: {fmtS(spot.b.makespan)}, peluang {share(spot.ib)}% per putaran
            </li>
          </ul>
          <p className="note">Kartu lambat tetap bisa terpilih, hanya peluangnya kecil. Ini menjaga keragaman populasi.</p>
        </>
      );
  } else if (phase === 2) {
    const fPrime = Math.max(1 / spot.a.makespan, 1 / spot.b.makespan);
    body =
      spot.kind === 'copy' ? (
        <>
          {kindLine}
          <p>
            Kartu ini salinan, jadi <b>tidak melewati crossover</b>. Hanya {Math.round(DEFAULT_LAB_PARAMS.crossoverShare * 100)}% kartu baru yang dibuat dari
            pasangan induk.
          </p>
        </>
      ) : (
        <>
          {kindLine}
          <div className="formula">
            Pc = k₁ · (f_max − f′) / (f_max − f_avg) jika f′ ≥ f_avg, selain itu Pc = k₃ = {fmt(DEFAULT_LAB_PARAMS.k3, 1)}
          </div>
          <p className="small muted">
            f′ = induk yang lebih baik ({asMs(fPrime)}), f_avg setara {asMs(genStats.favg)}, f_max = kartu terbaik ({asMs(genStats.fmax)}).{' '}
            {fPrime >= genStats.favg ? 'Induk di atas rata-rata, jadi Pc mengecil.' : 'Induk di bawah rata-rata, jadi Pc = 1 (pasti disilangkan).'}
          </p>
          {spot.kind === 'cross' && info.cut ? (
            <>
              <p>
                <b>Pc = {fmt(spot.child.pc ?? 0, 2)}</b> dan undian lolos, jadi crossover terjadi. Dua titik potong dipilih acak: pesanan{' '}
                <b>
                  #{info.cut[0]}–#{info.cut[1]}
                </b>
                . Anak mengambil koki dari <b style={{ color: COLOR_A }}>Induk A</b> di luar potongan dan dari <b style={{ color: COLOR_B }}>Induk B</b> di
                dalamnya.
              </p>
              <div className="gene-box">
                <GeneRuler />
                <GeneStrip label="Induk A" color={COLOR_A} genes={spot.a.genes} ms={spot.a.makespan} cut={info.cut} dim="in" />
                <GeneStrip label="Induk B" color={COLOR_B} genes={spot.b.genes} ms={spot.b.makespan} cut={info.cut} dim="out" />
                <GeneStrip label="Anak" color={COLOR_CHILD} genes={info.pre} ms={info.preMs} cut={info.cut} />
              </div>
              <p className="note">Kotak = pesanan, warna = koki. Kotak bergaris = bagian potongan dari Induk B. Arahkan kursor ke kotak untuk detail.</p>
            </>
          ) : (
            <>
              <p>
                <b>Pc = {fmt(spot.child.pc ?? 0, 2)}</b>, jadi undian gagal: <b>tidak ada crossover</b>, dan anak = salinan Induk A ({fmtS(info.preMs)}).
              </p>
              <div className="gene-box">
                <GeneRuler />
                <GeneStrip label="Induk A" color={COLOR_A} genes={spot.a.genes} ms={spot.a.makespan} />
                <GeneStrip label="Anak" color={COLOR_CHILD} genes={info.pre} ms={info.preMs} />
              </div>
            </>
          )}
          <p className="note">
            Pasangan yang sudah bagus jarang disilangkan supaya tidak rusak, sedangkan pasangan di bawah rata-rata selalu disilangkan. Roulette paling sering
            memilih kartu-kartu terbaik sebagai induk, dan untuk pasangan seperti itu Pc ≈ 0. Akibatnya hanya {crossGens} dari {G} generasi di seed ini yang
            punya anak crossover.
          </p>
        </>
      );
  } else if (phase === 3) {
    const pm = spot.child.pm;
    body = (
      <>
        {kindLine}
        <div className="formula">
          Pm = k₂ · (f_max − f) / (f_max − f_avg) jika f ≥ f_avg, selain itu Pm = k₄ = {fmt(DEFAULT_LAB_PARAMS.k4, 1)}
        </div>
        <p>
          Untuk kartu ini (f setara {fmtS(info.preMs)}), <b>Pm = {pm !== undefined ? fmt(pm, 2) : '–'}</b>.{' '}
          {info.changed.length ? (
            <>
              Undian lolos, jadi kartu termutasi:{' '}
              {info.changed.map((k, i) => (
                <span key={k}>
                  {i ? ', ' : ''}pesanan <b>#{k}</b> pindah dari <b style={{ color: CHEF_COLORS[info.pre[k]] }}>{CHEF_NAMES[info.pre[k]]}</b> ke{' '}
                  <b style={{ color: CHEF_COLORS[spot.child.genes[k]] }}>{CHEF_NAMES[spot.child.genes[k]]}</b>
                </span>
              ))}
              . Makespan {fmtS(info.preMs)} → <b>{fmtS(spot.child.makespan)}</b>.
            </>
          ) : (
            <>Kali ini kartu tidak termutasi, jadi jadwalnya tetap {fmtS(spot.child.makespan)}.</>
          )}
        </p>
        {spot.record && info.changed.length > 0 && (
          <p className="record-msg">
            ★ Mutasi inilah yang memecahkan rekor: {fmtS(run.generations[g - 1].bestMakespan)} → {fmtS(run.generations[g].bestMakespan)}. Jadwal ini tidak ada di
            induk mana pun.
          </p>
        )}
        <div className="gene-box">
          <GeneRuler />
          <GeneStrip label="Sebelum" color={COLOR_CHILD} genes={info.pre} ms={info.preMs} marks={info.changed} />
          <GeneStrip label="Sesudah" color={COLOR_CHILD} genes={spot.child.genes} ms={spot.child.makespan} marks={info.changed} />
        </div>
        <p className="note">
          Mutasi memindahkan 1 pesanan ke koki acak atau ke koki yang paling ringan, supaya GA bisa mencoba jadwal yang tidak ada di induknya. Semua kartu
          kecuali elit ikut diundi.
        </p>
      </>
    );
  } else {
    const prevBest = run.generations[g - 1].bestMakespan;
    const nowBest = run.generations[g].bestMakespan;
    const moment = moments.find((m) => m.gen === g);
    const migs = run.generations[g].migrations;
    body = (
      <>
        <p>
          Kartu yang kita ikuti ({fmtS(spot.child.makespan)}) masuk <b>generasi {g}</b> bersama {wall.population.length - 1} kartu lain: {recipe.elite} elit,{' '}
          {recipe.copies} salinan roulette, dan {recipe.children} kartu dari pasangan induk. Lalu kartu terbaik menjalani <b>migrasi beban</b>.
        </p>
        <p>
          {moment ? (
            <>
              <b>Rekor turun {fmtS(prevBest)} → {fmtS(nowBest)}</b> karena {moment.cause}.
            </>
          ) : (
            <>Rekor tetap {fmtS(nowBest)}. Berkat elitisme, rekor tidak pernah memburuk.</>
          )}
          {migs.length
            ? ` Migrasi memindahkan ${migs.length} pesanan pada kartu terbaik (${migs.map((m) => `#${m.task} ${CHEF_NAMES[m.from]} → ${CHEF_NAMES[m.to]}`).join(', ')}).`
            : ' Migrasi tidak menemukan operan yang membantu di generasi ini.'}
        </p>
      </>
    );
  }

  const controls = (
    <>
      <div className="phase-tabs" role="group" aria-label="Langkah generasi">
        {GA_PHASES.map((name, i) => (
          <button key={name} aria-pressed={g > 0 && phase === i} onClick={() => setS(at(Math.max(1, g), i))}>
            <span className="n">{i + 1}</span>
            {name}
          </button>
        ))}
      </div>
      <div className="player">
        <button className="icon-btn" onClick={() => setS(Math.max(0, s - 1))} aria-label="Mundur satu langkah">
          ‹
        </button>
        <button
          className="btn primary"
          onClick={() => {
            if (s >= total) setS(0);
            setPlaying(!playing);
          }}
        >
          {playing ? 'Jeda' : s >= total ? 'Ulangi' : 'Putar'}
        </button>
        <button className="icon-btn" onClick={() => setS(Math.min(total, s + 1))} aria-label="Maju satu langkah">
          ›
        </button>
        <input type="range" min={0} max={G} value={g} onChange={(e) => setS(at(Number(e.target.value), 4))} aria-label="Generasi" />
        <span className="mono muted counter">
          gen {g}/{G}
        </span>
      </div>
      <div className="row-between">
        <label className="toggle">
          <input type="checkbox" checked={fast} onChange={(e) => setFast(e.target.checked)} /> putar cepat (lewati langkah)
        </label>
        <SeedPicker />
      </div>
    </>
  );

  return (
    <>
      <Pipeline active={1} />
      <p className="eyebrow">Tahap 2 · Genetic Algorithm</p>
      <h2>Ruang rencana: jadwal ikut berevolusi</h2>
      <p className="lead">
        Max-Min hanya menghasilkan satu jadwal. GA menyimpan <b>{DEFAULT_LAB_PARAMS.population} jadwal sekaligus</b>, lalu berulang kali membuat jadwal baru
        dari yang bagus, supaya muncul jadwal yang lebih cepat daripada Max-Min.
      </p>
      <details className="howto" open={g === 0}>
        <summary>Istilah GA dan cara membaca kartu</summary>
        <dl className="glossary">
          <dt>Kartu = kromosom</dt>
          <dd>satu jadwal lengkap: koki untuk setiap pesanan #0–#29.</dd>
          <dt>Kotak = gen</dt>
          <dd>satu pesanan. Warnanya menunjukkan koki yang memasaknya. Kotak urut dari kiri atas.</dd>
          <dt>Populasi</dt>
          <dd>{DEFAULT_LAB_PARAMS.population} kartu yang disimpan sekaligus di papan rencana.</dd>
          <dt>Fitness</dt>
          <dd>1 / makespan. Makin cepat jadwalnya, makin besar fitness-nya. Angka di bawah kartu adalah makespan.</dd>
          <dt>Generasi</dt>
          <dd>
            satu putaran: {DEFAULT_LAB_PARAMS.population} kartu lama → {DEFAULT_LAB_PARAMS.population} kartu baru.
          </dd>
        </dl>
        <GeneStrip label="contoh" genes={best.genes} ms={best.makespan} />
        <ChefLegend />
      </details>
      {moments.length > 0 && (
        <div className="chip-row moments" role="group" aria-label="Momen rekor">
          <span className="muted small">Lompat ke momen penting:</span>
          {moments.map((m) => (
            <button key={m.gen} className="chip" aria-pressed={g === m.gen} onClick={() => jump(m.gen, m.cause === 'migrasi' ? 4 : 3)}>
              Gen {m.gen} · {m.cause} {Math.round(m.from)}→{Math.round(m.to)} s
            </button>
          ))}
        </div>
      )}
      <div className="phase-card">
        <div className="phase-head">
          {g === 0 ? 'Generasi 0 · populasi awal' : `Generasi ${g - 1} → ${g} · langkah ${phase + 1}/5: ${GA_PHASES[phase]}`}
        </div>
        {body}
      </div>
      <div className="recipe">
        <div className="recipe-head">Resep satu generasi</div>
        <ol>
          <li className={RECIPE_STEP_OF_PHASE[phase] === 0 && g > 0 ? 'on' : undefined}>
            <b>Seleksi</b>: {recipe.elite} kartu terbaik disalin utuh (<i>elitisme</i>), lalu {recipe.copies} kartu disalin lewat roda roulette.
          </li>
          <li className={RECIPE_STEP_OF_PHASE[phase] === 1 && g > 0 ? 'on' : undefined}>
            <b>Crossover</b>: {recipe.children} kartu dibuat dari pasangan induk hasil roulette, disilangkan dengan peluang <b>Pc</b>.
          </li>
          <li className={RECIPE_STEP_OF_PHASE[phase] === 2 && g > 0 ? 'on' : undefined}>
            <b>Mutasi</b>: setiap kartu kecuali elit diundi dengan peluang <b>Pm</b> untuk memindahkan 1 pesanan.
          </li>
          <li className={RECIPE_STEP_OF_PHASE[phase] === 3 && g > 0 ? 'on' : undefined}>
            <b>Migrasi</b>: kartu terbaik mengoper pesanan dari koki overload (Tahap 3), lalu generasi baru siap.
          </li>
        </ol>
      </div>
      <Dock
        caption={
          g === 0 ? (
            <>Populasi awal · terbaik {fmtS(best.makespan)}</>
          ) : (
            <>
              Generasi {g} · langkah {phase + 1}: <b>{GA_PHASES[phase]}</b>
            </>
          )
        }
      >
        {controls}
      </Dock>
      <Sparkline
        values={run.generations.map((x) => x.bestMakespan)}
        cursor={g}
        baseline={run.maxMinMakespan}
        lb={LAB_LB}
        marks={moments.map((m) => ({ i: m.gen, label: `${m.cause} ${Math.round(m.to)} s` }))}
      />
      <p className="note">
        Pc dan Pm adaptif mengikuti Eq. 1–2 paper HMMGA (k₁ = k₃ = {fmt(DEFAULT_LAB_PARAMS.k1, 1)}, k₂ = k₄ = {fmt(DEFAULT_LAB_PARAMS.k2, 1)}). Demo ini
        memakai p = {DEFAULT_LAB_PARAMS.population} dan G = {G} supaya bisa diikuti langkah demi langkah. Eksperimen CloudSim memakai p = 30 dan G = 150. Seed{' '}
        {seed}.
      </p>
    </>
  );
}

export function MigrationChapter() {
  const { run, setScene, ev } = useKitchen();
  const [stage, setStage] = useState(0);
  // memoised: a fresh object every render would re-run the scene effect below forever
  const firstMig = useMemo(() => run.generations.flatMap((g) => g.migrations.map((m) => ({ ...m, gen: g.index })))[0], [run]);
  const moments = useMemo(() => recordMoments(run.generations), [run]);
  const lastMoment = moments[moments.length - 1];
  const mm = run.maxMin.assignedVm;
  const moved = useMemo(() => run.best.map((v, t) => (v !== mm[t] ? t : -1)).filter((t) => t >= 0), [run, mm]);

  /**
   * Two branches: the final schedule does not contain the first migration move, so it does not descend from the
   * migrated card. It came from another card of the population (e.g. a roulette copy of Max-Min) changed by a GA
   * operator. Explain where it came from, why migration never tried that move, and why both moves cannot be combined.
   */
  const branch = useMemo(() => {
    if (!firstMig || !lastMoment || lastMoment.cause === 'migrasi' || run.best[firstMig.task] === firstMig.to) return null;
    const gen = run.generations[lastMoment.gen];
    const card = gen.population[gen.bestIdx];
    const parentMs = card.parents ? run.generations[lastMoment.gen - 1].population[card.parents[0]].makespan : undefined;
    const ids = mm.map((v, t) => (v === firstMig.from ? t : -1)).filter((t) => t >= 0);
    const cands = new Set(candidateTasks(ev, ids));
    const notTried = moved.filter((t) => mm[t] === firstMig.from && !cands.has(t));
    const both = [...run.best];
    both[firstMig.task] = firstMig.to;
    const bothFinish = ev.vmFinish(both);
    const bothBottleneck = bothFinish.indexOf(Math.max(...bothFinish));
    return { card, parentMs, notTried, both, bothMs: ev.makespan(both), bothBottleneck, candidates: [...cands] };
  }, [run, firstMig, lastMoment, mm, moved, ev]);

  const plans = useMemo(() => {
    const p1 = [...mm];
    if (firstMig) p1[firstMig.task] = firstMig.to;
    return branch ? [mm, p1, run.best, branch.both] : [mm, p1, run.best];
  }, [run, mm, firstMig, branch]);
  useEffect(
    () =>
      setScene({
        ...BASE,
        ga: null,
        plan: plans[stage],
        celebrate: stage === 2,
        focusTask: stage === 1 && firstMig ? firstMig.task : stage === 2 && moved.length === 1 ? moved[0] : null,
      }),
    [stage, plans, firstMig, moved, setScene],
  );
  const ms = plans.map((pl) => ev.makespan(pl));
  const labels = [
    'Jadwal Max-Min',
    firstMig ? `${branch ? 'Cabang A · ' : ''}migrasi (gen ${firstMig.gen})` : 'Setelah migrasi',
    lastMoment && lastMoment.cause !== 'migrasi' ? `${branch ? 'Cabang B · ' : 'Hasil akhir · '}${lastMoment.cause} (gen ${lastMoment.gen})` : 'Hasil akhir HMMGA',
    ...(branch ? ['Coba gabung A + B'] : []),
  ];
  const fmt1 = (s: number) => `${fmt(s, 1)} s`;
  const moveText = (t: number, from: number, to: number) => (
    <>
      pesanan <b>#{t}</b> ({Math.round(TASKS[t].lengthMi / 1000)}k MI) dari <b style={{ color: CHEF_COLORS[from] }}>{CHEF_NAMES[from]}</b> ke{' '}
      <b style={{ color: CHEF_COLORS[to] }}>{CHEF_NAMES[to]}</b>
    </>
  );
  return (
    <>
      <Pipeline active={2} />
      <p className="eyebrow">Tahap 3 · Migrasi beban</p>
      <h2>Koki yang kewalahan mengoper pesanan</h2>
      <p className="lead">
        Migrasi bukan tahap terpisah setelah GA. Ia adalah langkah terakhir di <b>setiap generasi</b> (Step 6 paper) dan dijalankan pada kartu terbaik
        generasi itu.
      </p>
      <ol className="steps">
        <li>
          Cari koki <b>overload</b>: koki yang paling lama selesai (bendera merah, kompor berasap), jika waktu selesainya di atas rata-rata semua koki.
        </li>
        <li>Coba oper 3 pesanan terbesarnya dan 3 pesanan terakhirnya ke setiap koki lain.</li>
        <li>Ambil operan terbaik, asalkan makespan tidak naik dan si koki jadi lebih ringan. Ulangi sampai tidak ada operan yang membantu.</li>
      </ol>
      <Dock
        caption={
          stage === 1 && firstMig ? (
            <>
              Pesanan <b>#{firstMig.task}</b> dioper {CHEF_NAMES[firstMig.from]} → {CHEF_NAMES[firstMig.to]} · {fmtS(firstMig.before)} → {fmtS(firstMig.after)}
            </>
          ) : (
            labels[stage]
          )
        }
      >
        <div className="stage-tabs">
          {labels.map((l, i) => (
            <button key={l} aria-pressed={stage === i} onClick={() => setStage(i)}>
              <span className="n">{i + 1}</span>
              {l}
              <b>{i === 3 ? fmt1(ms[i]) : fmtS(ms[i])}</b>
            </button>
          ))}
        </div>
        <div className="btn-row">
          <TimePlay />
        </div>
      </Dock>
      {stage === 1 && firstMig && (
        <div className="callout">
          Generasi {firstMig.gen}: pesanan <b>#{firstMig.task}</b> dioper dari <b style={{ color: CHEF_COLORS[firstMig.from] }}>{CHEF_NAMES[firstMig.from]}</b> ke{' '}
          <b style={{ color: CHEF_COLORS[firstMig.to] }}>{CHEF_NAMES[firstMig.to]}</b>. Makespan {fmtS(firstMig.before)} → {fmtS(firstMig.after)}.
          {branch && (
            <>
              {' '}
              Ini <b>rekor sementara</b>. Hasil akhir HMMGA tidak berasal dari kartu ini, melainkan dari cabang lain (tahap 3).
            </>
          )}
        </div>
      )}
      {stage >= 2 && branch && firstMig && lastMoment && (
        <div className="branches">
          <div className="br-head">Dua cabang dari jadwal Max-Min</div>
          <div className="br-root">
            Max-Min <b>{fmtS(run.maxMinMakespan)}</b>
          </div>
          <div className="br-tree">
            <div className={`br-node${stage === 1 ? ' on' : ''}`}>
              <span className="br-tag a">Cabang A · migrasi gen {firstMig.gen}</span>
              <p>
                Kartu elit dimigrasi: {moveText(firstMig.task, firstMig.from, firstMig.to)} → <b>{fmtS(firstMig.after)}</b>. Rekor sementara.
              </p>
            </div>
            <div className={`br-node win${stage === 2 ? ' on' : ''}`}>
              <span className="br-tag b">
                Cabang B · {lastMoment.cause} gen {lastMoment.gen} ★ hasil akhir
              </span>
              <p>
                {branch.card.origin === 'copy' ? 'Kartu salinan roulette' : 'Kartu lain di populasi'}
                {branch.parentMs !== undefined && <> ({fmtS(branch.parentMs)}, belum pernah dimigrasi)</>} di{lastMoment.cause === 'mutasi' ? 'mutasi' : 'ubah'}:{' '}
                {moved.map((t, i) => (
                  <span key={t}>
                    {i ? ', ' : ''}
                    {moveText(t, mm[t], run.best[t])}
                  </span>
                ))}{' '}
                → <b>{fmtS(run.bestMakespan)}</b>. Kartu ini mengalahkan cabang A, jadi #{firstMig.task} tetap di {CHEF_NAMES[firstMig.from]} seperti di Max-Min.
              </p>
            </div>
          </div>
          <ul className="clean bullets small">
            <li>
              <b>Kenapa populasi masih punya kartu {fmtS(run.maxMinMakespan)}?</b> GA tidak hanya menyimpan kartu terbaik. Salinan roulette dan klon membawa
              jadwal lama ke generasi berikutnya, sehingga ada lebih dari satu "cabang" yang bisa berkembang.
            </li>
            {branch.notTried.length > 0 && (
              <li>
                <b>Kenapa migrasi tidak menemukannya?</b> Migrasi hanya mencoba 3 pesanan terbesar dan 3 pesanan terakhir dari koki overload (
                {branch.candidates
                  .slice()
                  .sort((x, y) => x - y)
                  .map((t) => `#${t}`)
                  .join(', ')}
                ). {branch.notTried.map((t) => `#${t}`).join(', ')} tidak termasuk, jadi tidak pernah dicoba. Mutasi memilih pesanan secara acak, sehingga bisa
                menemukan pindahan yang terlewat oleh aturan migrasi.
              </li>
            )}
            <li>
              <b>Kenapa tidak digabung saja?</b> Jika pindahan A dan B dilakukan bersama, makespan menjadi <b>{fmt1(branch.bothMs)}</b>, lebih buruk dari
              keduanya. Lihat tahap 4.
            </li>
          </ul>
        </div>
      )}
      {stage === 3 && branch && (
        <div className="callout">
          Pindahan A dan B digabung: makespan {fmt1(branch.bothMs)}. Kedua pesanan masuk ke{' '}
          <b style={{ color: CHEF_COLORS[branch.bothBottleneck] }}>{CHEF_NAMES[branch.bothBottleneck]}</b> (bendera merah), yang kini menjadi koki paling lama
          selesai. Karena itu jadwal terbaik HMMGA hanya memuat pindahan cabang B ({fmtS(run.bestMakespan)}).
        </div>
      )}
      {stage === 2 && (
        <div className="callout gold">
          Setelah {run.generations.length - 1} generasi: <b>{fmtS(run.bestMakespan)}</b>, turun {fmt(((run.maxMinMakespan - run.bestMakespan) / run.maxMinMakespan) * 100, 1)}%
          dari Max-Min. {moved.length} pesanan berpindah koki ({moved.map((t) => `#${t}`).join(', ')}).
          {moments.length > 0 && (
            <>
              {' '}
              {branch
                ? `Rekor tercatat: Max-Min ${fmtS(run.maxMinMakespan)}${moments.map((m) => `, ${m.cause} gen ${m.gen} ${fmtS(m.to)}`).join('')}. Rekor ${fmtS(run.bestMakespan)} bukan lanjutan dari ${fmtS(firstMig!.after)}, melainkan cabang lain (lihat di atas).`
                : `Perjalanannya: Max-Min ${fmtS(run.maxMinMakespan)}${moments.map((m) => ` → ${m.cause} gen ${m.gen} ${fmtS(m.to)}`).join('')}.`}
              {moments.some((m) => m.cause !== 'migrasi')
                ? ' Migrasi merapikan beban, dan operator GA menemukan jadwal yang tidak bisa dicapai migrasi saja.'
                : ' Di seed ini seluruh perbaikan datang dari migrasi. Operator GA tidak menemukan jadwal yang lebih cepat.'}
            </>
          )}
        </div>
      )}
      <p className="note">Tekan ▶ Putar waktu di tiap tahap dan bandingkan jam t saat pesanan terakhir selesai dan garis merah muncul.</p>
      <p className="note">Versi browser ini adalah port baris-per-baris dari HmmgaScheduler.java dengan RNG yang sama, dan hasilnya identik dengan Java untuk seed yang sama.</p>
      <SeedPicker />
    </>
  );
}
