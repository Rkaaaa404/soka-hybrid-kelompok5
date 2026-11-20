import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ALGO_COLOR, SCALES, fmt } from '../../data/meta';
import { useSnapshots } from '../../data/results';
import { hybridWinner, mean } from '../../data/verdict';
import { CHEF_COLORS, CHEF_NAMES, CHEF_ROLE, LAB_LB, TASKS, VMS, fmtS, roundRobin } from '../model';
import { COLOR_A, COLOR_B, COLOR_CHILD, GA_PHASES, breed, spotlight } from '../three/PlanningRoom';
import { useKitchen, type Scene } from '../store';
import { ChefLegend, Cite, Dock, GeneRuler, GeneStrip, Player, SeedPicker, Sparkline, usePlayer } from '../ui';

const BASE: Partial<Scene> = { focusTask: null, focusVm: null, interactive: false, celebrate: false };

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

/** Makespan scoreboard for the challenge: the three numbers on one scale, each with what it means. */
function ScoreBoard({ compact = false }: { compact?: boolean }) {
  const { stats, run, seed } = useKitchen();
  const hmmga = run.bestMakespan;
  const rows = [
    {
      key: 'you',
      name: 'Jadwalmu',
      v: stats.makespan,
      color: stats.makespan <= hmmga + 1e-6 ? '#ffd166' : '#ff6b6f',
      desc: (
        <>
          makespan jadwal yang sedang tampil di dapur. Paling lama: <b style={{ color: CHEF_COLORS[stats.bottleneck] }}>{CHEF_NAMES[stats.bottleneck]}</b>{' '}
          (bendera merah).
        </>
      ),
    },
    { key: 'hmmga', name: 'HMMGA', v: hmmga, color: '#3987e5', desc: <>jadwal terbaik yang ditemukan HMMGA untuk 30 pesanan yang sama (seed {seed}).</> },
    {
      key: 'lb',
      name: 'Batas tercepat',
      v: LAB_LB,
      color: '#5ec8ff',
      desc: <>tidak ada jadwal yang bisa lebih cepat: total porsi ÷ kecepatan seluruh dapur (13.000 MIPS).</>,
    },
  ];
  const max = Math.max(...rows.map((r) => r.v)) * 1.04;
  return (
    <div className={`scoreboard${compact ? ' compact' : ''}`}>
      {!compact && (
        <div className="sb-head">
          <b>Papan skor makespan</b>
          <span>waktu saat pesanan terakhir selesai · makin pendek makin baik</span>
        </div>
      )}
      {rows.map((r) => (
        <div key={r.key} className="sb-row">
          <span className="sb-name">{r.name}</span>
          <div className="sb-track">
            <div className="sb-bar" style={{ width: `${(r.v / max) * 100}%`, background: r.color }} />
          </div>
          <span className="sb-v" style={{ color: r.color }}>
            {fmtS(r.v)}
          </span>
          {!compact && <p className="sb-desc">{r.desc}</p>}
        </div>
      ))}
    </div>
  );
}

export function KitchenIntro() {
  const { setScene, run, stats, selected, ev } = useKitchen();
  useEffect(() => setScene({ ...BASE, plan: roundRobin(), interactive: true, ga: null }), [setScene]);
  const hmmga = run.bestMakespan;
  const beat = stats.makespan <= hmmga + 1e-6;
  const ratio = stats.makespan / hmmga;
  return (
    <>
      <p className="eyebrow">Dapur = datacenter</p>
      <h2>Coba jadi manajernya dulu</h2>
      <p className="lead">
        Ini satu host dari CloudSim yang dijadikan dapur: 5 koki (VM) dengan kecepatan berbeda dan 30 pesanan GoCJ asli. Tinggi rantang = lama pesanan itu
        dimasak oleh koki tersebut. Tugas manajer: membagi pesanan supaya <b>pesanan terakhir selesai secepat mungkin</b>. Waktu itulah yang disebut makespan.
      </p>
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
      <div className="callout">
        Dapur dimulai dengan <b>Round Robin</b>: pesanan dibagi bergiliran tanpa melihat kecepatan koki, sehingga pesanan besar menumpuk di koki junior yang
        paling lambat.
        <br />
        <b>Tantangan:</b> klik sebuah rantang, lalu klik kompor koki tujuan. Bisakah kamu menyamai HMMGA?
        {selected !== null && <div className="sel">Pesanan #{selected} dipilih ({Math.round(TASKS[selected].lengthMi / 1000)}k MI) → klik kompor tujuan</div>}
      </div>
      <Dock
        caption={
          selected !== null ? (
            <>
              Pesanan <b>#{selected}</b> dipilih → klik kompor koki tujuan
            </>
          ) : (
            'Tantangan: klik rantang, lalu klik kompor koki tujuan'
          )
        }
      >
        <ScoreBoard />
        {beat ? (
          <p className="win-msg">🎉 Jadwalmu setara HMMGA. Sekarang bayangkan melakukannya untuk 10.000 pesanan dan 50 koki.</p>
        ) : (
          <p className="sb-verdict">
            Jadwalmu <b>{fmt(ratio, 1)}×</b> lebih lama daripada HMMGA. Coba pindahkan rantang dari{' '}
            <b style={{ color: CHEF_COLORS[stats.bottleneck] }}>{CHEF_NAMES[stats.bottleneck]}</b> ke koki yang selesai lebih awal, terutama Kepala Koki.
          </p>
        )}
        <div className="btn-row">
          <button className="btn" onClick={() => setScene({ plan: roundRobin() })}>
            Ulang dari Round Robin
          </button>
          <button className="btn" onClick={() => setScene({ plan: run.maxMin.assignedVm })}>
            Pakai Max-Min · {fmtS(ev.makespan(run.maxMin.assignedVm))}
          </button>
          <button className="btn" onClick={() => setScene({ plan: run.best })}>
            Pakai HMMGA · {fmtS(hmmga)}
          </button>
        </div>
      </Dock>
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
      <p className="eyebrow">Tahap 1 · Max-Min</p>
      <h2>Pesanan terberat diambil duluan</h2>
      <p className="lead">
        Untuk setiap pesanan yang masih di papan, manajer mencari koki yang bisa <b>menyelesaikannya paling cepat</b>. Dari semua pesanan itu, yang waktu selesainya
        paling lama (pesanan terberat) diambil lebih dulu. Ulangi sampai papan kosong.
      </p>
      <div className="formula">CTᵢⱼ = max(datangᵢ, kompor kosongⱼ) + porsiᵢ / MIPSⱼ → pilih maxᵢ minⱼ CTᵢⱼ</div>
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

  let body: ReactNode;
  if (g === 0) {
    body = (
      <>
        <p>
          Populasi awal berisi 12 kartu: kartu jadwal <b>Max-Min</b> ({fmtS(run.maxMinMakespan)}), beberapa variannya, dan sisanya jadwal acak (sampai{' '}
          {fmtS(sorted[sorted.length - 1].makespan)}). Kartu terbaik diberi mahkota.
        </p>
        <p>Tekan ›, lalu ikuti satu generasi langkah demi langkah.</p>
      </>
    );
  } else if (!spot || !info) {
    body = <p>Generasi ini tidak punya anak hasil crossover untuk diikuti.</p>;
  } else if (phase === 0) {
    body = (
      <p>
        Ini <b>generasi {g - 1}</b>, 12 jadwal yang akan dikawinkan. Terbaik {fmtS(sorted[0].makespan)}, terburuk {fmtS(sorted[sorted.length - 1].makespan)}.
        Makin kecil makespan, makin besar peluangnya menjadi induk.
      </p>
    );
  } else if (phase === 1) {
    body = (
      <>
        <p>
          Setiap kartu mendapat irisan roda selebar <b>1/makespan</b>, jadi jadwal cepat punya irisan lebih besar. Roda diputar dua kali:
        </p>
        <ul className="clean bullets">
          <li>
            <b style={{ color: COLOR_A }}>Induk A</b>: {fmtS(spot.a.makespan)}, peluang {share(spot.ia)}% per putaran
          </li>
          <li>
            <b style={{ color: COLOR_B }}>Induk B</b>: {fmtS(spot.b.makespan)}, peluang {share(spot.ib)}% per putaran
          </li>
        </ul>
        <p className="note">Jadwal acak yang lambat tetap bisa terpilih, hanya peluangnya kecil. Ini menjaga keragaman.</p>
      </>
    );
  } else if (phase === 2) {
    body = (
      <>
        <p>
          Peluang crossover adaptif <b>Pc = {fmt(spot.child.pc ?? 0, 2)}</b>, dan kali ini crossover terjadi. Dua titik potong dipilih acak: pesanan{' '}
          <b>
            #{info.cut[0]}–#{info.cut[1]}
          </b>
          . Anak mengambil koki dari <b style={{ color: COLOR_A }}>Induk A</b> di luar potongan dan dari <b style={{ color: COLOR_B }}>Induk B</b> di dalamnya.
        </p>
        <div className="gene-box">
          <GeneRuler />
          <GeneStrip label="Induk A" color={COLOR_A} genes={spot.a.genes} ms={spot.a.makespan} cut={info.cut} dim="in" />
          <GeneStrip label="Induk B" color={COLOR_B} genes={spot.b.genes} ms={spot.b.makespan} cut={info.cut} dim="out" />
          <GeneStrip label="Anak" color={COLOR_CHILD} genes={info.pre} ms={info.preMs} cut={info.cut} />
        </div>
        <p className="note">Kotak = pesanan, warna = koki. Kotak bergaris = bagian potongan dari Induk B. Arahkan kursor ke kotak untuk detail.</p>
      </>
    );
  } else if (phase === 3) {
    const pm = spot.child.pm;
    body = (
      <>
        <p>
          Peluang mutasi adaptif <b>Pm = {pm !== undefined ? fmt(pm, 2) : '–'}</b>.{' '}
          {info.changed.length ? (
            <>
              Anak ini termutasi:{' '}
              {info.changed.map((k, i) => (
                <span key={k}>
                  {i ? ', ' : ''}pesanan <b>#{k}</b> pindah dari <b style={{ color: CHEF_COLORS[info.pre[k]] }}>{CHEF_NAMES[info.pre[k]]}</b> ke{' '}
                  <b style={{ color: CHEF_COLORS[spot.child.genes[k]] }}>{CHEF_NAMES[spot.child.genes[k]]}</b>
                </span>
              ))}
              . Makespan {fmtS(info.preMs)} → {fmtS(spot.child.makespan)}.
            </>
          ) : (
            <>Kali ini anak tidak termutasi, jadi jadwalnya tetap {fmtS(spot.child.makespan)}.</>
          )}
        </p>
        <div className="gene-box">
          <GeneRuler />
          <GeneStrip label="Sebelum" color={COLOR_CHILD} genes={info.pre} ms={info.preMs} marks={info.changed} />
          <GeneStrip label="Sesudah" color={COLOR_CHILD} genes={spot.child.genes} ms={spot.child.makespan} marks={info.changed} />
        </div>
        <p className="note">Mutasi memindahkan satu pesanan ke koki acak atau ke koki yang paling ringan, supaya GA bisa mencoba jadwal yang tidak ada di induknya.</p>
      </>
    );
  } else {
    const improved = run.generations[g].bestMakespan < run.generations[g - 1].bestMakespan;
    body = (
      <>
        <p>
          Anak yang kita ikuti ({fmtS(spot.child.makespan)}) masuk <b>generasi {g}</b> bersama 11 kartu lain: kartu terbaik lama disalin utuh (<b>elitisme</b>),
          beberapa disalin lewat roulette, sisanya anak crossover. Kartu terbaik sekarang {fmtS(best.makespan)}.
        </p>
        <p>
          {improved
            ? `Rekor turun ke ${fmtS(run.generations[g].bestMakespan)}.`
            : `Rekor tetap ${fmtS(run.generations[g].bestMakespan)}. Berkat elitisme, rekor tidak pernah naik.`}
          {run.generations[g].migrations.length ? ` Migrasi beban juga memindahkan ${run.generations[g].migrations.length} pesanan pada kartu terbaik.` : ''}
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
      <p className="eyebrow">Tahap 2 · Genetic Algorithm</p>
      <h2>Ruang rencana: jadwal ikut berevolusi</h2>
      <p className="lead">
        Max-Min hanya menghasilkan satu jadwal. GA menyimpan <b>12 jadwal sekaligus</b> (populasi), lalu berulang kali mengawinkan yang bagus supaya muncul
        jadwal yang lebih cepat. Satu putaran disebut satu <b>generasi</b>.
      </p>
      <details className="howto" open={g === 0}>
        <summary>Cara membaca kartu rencana</summary>
        <p>
          1 kartu = 1 jadwal lengkap (kromosom). Kartu berisi 30 kotak = 30 pesanan (gen), urut dari kiri atas. Warna kotak menunjukkan koki yang memasak
          pesanan itu. Angka di bawah kartu adalah makespan jadwal tersebut.
        </p>
        <GeneStrip label="contoh" genes={best.genes} ms={best.makespan} />
        <ChefLegend />
      </details>
      <div className="phase-card">
        <div className="phase-head">
          {g === 0 ? 'Generasi 0 · populasi awal' : `Generasi ${g - 1} → ${g} · langkah ${phase + 1}/5: ${GA_PHASES[phase]}`}
        </div>
        {body}
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
      <Sparkline values={run.generations.map((x) => x.bestMakespan)} cursor={g} baseline={run.maxMinMakespan} lb={LAB_LB} />
      <p className="note">
        Pc dan Pm adaptif (Eq. 1–2 paper HMMGA): pasangan yang sudah bagus lebih jarang disilangkan dan dimutasi supaya tidak rusak. Seed {seed}: p = 12, G ={' '}
        {G}.
      </p>
    </>
  );
}

export function MigrationChapter() {
  const { run, setScene, ev } = useKitchen();
  const [stage, setStage] = useState(0);
  const firstMig = run.generations.flatMap((g) => g.migrations.map((m) => ({ ...m, gen: g.index })))[0];
  const plans = useMemo(() => {
    const p0 = run.maxMin.assignedVm;
    const p1 = [...p0];
    if (firstMig) p1[firstMig.task] = firstMig.to;
    return [p0, p1, run.best];
  }, [run, firstMig]);
  useEffect(() => setScene({ ...BASE, ga: null, plan: plans[stage], celebrate: stage === 2, focusTask: stage === 1 && firstMig ? firstMig.task : null }), [stage, plans, firstMig, setScene]);
  const ms = plans.map((pl) => ev.makespan(pl));
  const moved = run.best.map((v, t) => (v !== run.maxMin.assignedVm[t] ? t : -1)).filter((t) => t >= 0);
  const labels = ['Jadwal Max-Min', 'Setelah migrasi', 'Hasil akhir HMMGA'];
  return (
    <>
      <p className="eyebrow">Tahap 3 · Migrasi beban</p>
      <h2>Koki yang kewalahan mengoper pesanan</h2>
      <p className="lead">
        Koki yang menentukan makespan (bendera merah, kompor berasap) disebut <b>overload</b>. Pesanan terbesar atau yang terakhir datang darinya dicoba dioper
        ke setiap koki lain, dan operan terbaik diambil, asalkan makespan tidak naik dan si koki jadi lebih ringan.
      </p>
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
              <b>{fmtS(ms[i])}</b>
            </button>
          ))}
        </div>
      </Dock>
      {stage === 1 && firstMig && (
        <div className="callout">
          Generasi {firstMig.gen}: pesanan <b>#{firstMig.task}</b> dioper dari <b style={{ color: CHEF_COLORS[firstMig.from] }}>{CHEF_NAMES[firstMig.from]}</b> ke{' '}
          <b style={{ color: CHEF_COLORS[firstMig.to] }}>{CHEF_NAMES[firstMig.to]}</b>. Makespan {fmtS(firstMig.before)} → {fmtS(firstMig.after)}.
        </div>
      )}
      {stage === 2 && (
        <div className="callout gold">
          Setelah {run.generations.length - 1} generasi: <b>{fmtS(run.bestMakespan)}</b>, turun {fmt(((run.maxMinMakespan - run.bestMakespan) / run.maxMinMakespan) * 100, 1)}%
          dari Max-Min. {moved.length} pesanan berpindah koki ({moved.map((t) => `#${t}`).join(', ')}). Ganti seed: seed 44 menemukan jadwal yang lebih baik lewat
          mutasi.
        </div>
      )}
      <p className="note">Versi browser ini adalah port baris-per-baris dari HmmgaScheduler.java dengan RNG yang sama, dan hasilnya identik dengan Java untuk seed yang sama.</p>
      <SeedPicker />
    </>
  );
}
