import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { Label } from '../../three/Overlay';
import type { Evaluator } from '../../sim/evaluator';
import type { Generation, Individual } from '../../sim/hmmga';
import { CHEF_COLORS, KITCHEN_HALF_WIDTH, TASKS } from '../model';
import { useKitchen } from '../store';
import { Toon } from './toon';
import { Spring3, smoothDamp, useInitial } from './anim';

export const ROOM_X = KITCHEN_HALF_WIDTH + 7.4;
const WALL_Z = -1.9;
const CARD_W = 1.8;
const CARD_H = 1.08;
const N = TASKS.length;

/** The steps of one GA generation, shown one at a time in the GA chapter. */
export const GA_PHASES = ['Populasi', 'Seleksi', 'Crossover', 'Mutasi', 'Generasi baru'] as const;
export const COLOR_A = '#ff7ab6';
export const COLOR_B = '#5ec8ff';
export const COLOR_CHILD = '#ffcf5c';

export const ORIGIN: Record<string, string> = {
  maxmin: 'Max-Min',
  seeded: 'varian Max-Min',
  random: 'acak',
  elite: 'elit',
  copy: 'disalin',
  cross: 'anak crossover',
  clone: 'klon',
};

/** The child followed through generation g (its first crossover child) and its parents from generation g-1. */
export function spotlight(gens: Generation[], g: number): { child: Individual; a: Individual; b: Individual; ia: number; ib: number } | null {
  if (g <= 0) return null;
  const child = gens[g].population.find((p) => p.origin === 'cross' && p.cut && p.parents);
  if (!child) return null;
  const prev = gens[g - 1].population;
  const [ia, ib] = child.parents!;
  return { child, a: prev[ia], b: prev[ib], ia, ib };
}

/** Child right after crossover (before mutation) and which genes changed afterwards. */
export function breed(spot: NonNullable<ReturnType<typeof spotlight>>, ev: Evaluator) {
  const [c0, c1] = spot.child.cut!;
  const pre = spot.a.genes.map((v, k) => (k >= c0 && k <= c1 ? spot.b.genes[k] : v));
  const changed = spot.child.genes.map((v, k) => (v !== pre[k] ? k : -1)).filter((k) => k >= 0);
  return { pre, preMs: ev.makespan(pre), changed, cut: [c0, c1] as [number, number] };
}

type Tag = 'A' | 'B' | 'AB' | 'child' | null;

export default function PlanningRoom() {
  const { run, scene } = useKitchen();
  const G = run.generations.length - 1;
  const g = scene.ga?.gen ?? G;
  const phase = g === 0 ? 4 : (scene.ga?.phase ?? 4);
  const wallG = phase < 4 ? g - 1 : g;
  const wall = run.generations[wallG];
  const spot = spotlight(run.generations, g);
  const order = useMemo(() => wall.population.map((ind, i) => ({ ind, i })).sort((a, b) => a.ind.makespan - b.ind.makespan), [wall]);
  const worst = Math.max(...run.generations[0].population.map((p) => p.makespan));
  const best = run.bestMakespan;

  const tagOf = (i: number): Tag => {
    if (!spot) return null;
    if (phase >= 1 && phase <= 3) {
      if (i === spot.ia && i === spot.ib) return 'AB';
      if (i === spot.ia) return 'A';
      if (i === spot.ib) return 'B';
    }
    if (phase === 4 && wall.population[i] === spot.child) return 'child';
    return null;
  };

  return (
    <group position={[ROOM_X, 0, 0]}>
      <mesh position={[0, 2.5, WALL_Z - 0.08]}>
        <boxGeometry args={[9.6, 5, 0.12]} />
        <Toon color="#284b63" />
      </mesh>
      <mesh position={[-1.1, 2.55, WALL_Z]}>
        <boxGeometry args={[7.2, 4.3, 0.04]} />
        <Toon color="#1d3446" />
      </mesh>
      <Label position={[-1.1, 4.95, WALL_Z]} center style={{ pointerEvents: 'none' }}>
        <div className="board-tag">
          Papan Rencana · generasi {wall.index}
          {g > 0 && phase < 4 ? ' (calon induk)' : ''}
        </div>
      </Label>
      {order.map(({ ind, i }, rank) => (
        <PlanCard key={i} ind={ind} rank={rank} worst={worst} best={best} isBest={rank === 0} tag={tagOf(i)} />
      ))}
      <Roulette g={g} phase={phase} spot={spot} />
      <BreedingTable spot={spot} g={g} phase={phase} />
    </group>
  );
}

const TAG_STYLE: Record<Exclude<Tag, null>, { color: string; text: string }> = {
  A: { color: COLOR_A, text: 'Induk A' },
  B: { color: COLOR_B, text: 'Induk B' },
  AB: { color: COLOR_A, text: 'Induk A = B' },
  child: { color: COLOR_CHILD, text: 'Anak yang diikuti' },
};

function PlanCard({ ind, rank, worst, best, isBest, tag }: { ind: Individual; rank: number; worst: number; best: number; isBest: boolean; tag: Tag }) {
  const ref = useRef<THREE.Group>(null);
  const col = rank % 4;
  const row = Math.floor(rank / 4);
  const fit = worst === best ? 1 : Math.max(0, (worst - ind.makespan) / (worst - best));
  const target = new THREE.Vector3(-1.1 + (col - 1.5) * 1.82, 4.05 - row * 1.32 - (1 - fit) * 0.18, WALL_Z + 0.08 + (tag ? 0.45 : 0));
  const init = useInitial<[number, number, number]>([target.x, target.y, target.z]);
  const spring = useRef(new Spring3());
  const sv = useRef({ v: 0 });
  useFrame((_, dt) => {
    const g = ref.current;
    if (!g) return;
    spring.current.step(g.position, target.x, target.y, target.z, 0.5, dt);
    g.scale.setScalar(smoothDamp(g.scale.x, tag ? 1.08 : 1, sv.current, 0.3, dt));
  });
  const ts = tag ? TAG_STYLE[tag] : null;
  return (
    <group ref={ref} position={init}>
      <mesh>
        <boxGeometry args={[CARD_W, CARD_H, 0.04]} />
        <Toon color={ts ? '#fffaf0' : '#f7efe0'} emissive={ts ? ts.color : '#000'} emissiveIntensity={ts ? 0.22 : 0} />
      </mesh>
      {ts && (
        <mesh position={[0, 0, -0.03]}>
          <boxGeometry args={[CARD_W + 0.12, CARD_H + 0.12, 0.02]} />
          <meshBasicMaterial color={ts.color} />
        </mesh>
      )}
      <mesh position={[-CARD_W / 2 + 0.05 + (CARD_W - 0.1) * fit * 0.5, CARD_H / 2 - 0.1, 0.03]}>
        <boxGeometry args={[(CARD_W - 0.1) * Math.max(0.02, fit), 0.07, 0.01]} />
        <meshBasicMaterial color={isBest ? '#f0b429' : '#5f8fbf'} />
      </mesh>
      {ind.genes.map((vm, k) => (
        <mesh key={k} position={[-0.75 + (k % 10) * 0.167, 0.13 - Math.floor(k / 10) * 0.2, 0.035]}>
          <boxGeometry args={[0.13, 0.13, 0.025]} />
          <meshBasicMaterial color={CHEF_COLORS[vm]} />
        </mesh>
      ))}
      {isBest && (
        <group position={[0, CARD_H / 2 + 0.2, 0]}>
          <mesh>
            <cylinderGeometry args={[0.2, 0.17, 0.14, 5, 1, true]} />
            <meshBasicMaterial color="#f0b429" side={THREE.DoubleSide} />
          </mesh>
          {[0, 1, 2, 3, 4].map((i) => (
            <mesh key={i} position={[Math.cos((i / 5) * Math.PI * 2) * 0.19, 0.12, Math.sin((i / 5) * Math.PI * 2) * 0.19]}>
              <coneGeometry args={[0.04, 0.12, 6]} />
              <meshBasicMaterial color="#f0b429" />
            </mesh>
          ))}
        </group>
      )}
      {ts && (
        <Label position={[0, CARD_H / 2 - 0.1, 0.08]} center style={{ pointerEvents: 'none' }}>
          <div className="pick-tag" style={{ ['--c' as string]: ts.color }}>
            {ts.text}
          </div>
        </Label>
      )}
      <Label position={[0, -CARD_H / 2 - 0.02, 0.05]} center style={{ pointerEvents: 'none' }}>
        <div className={`card-tag${isBest ? ' best' : ''}`}>
          {Math.round(ind.makespan)} s · {ORIGIN[ind.origin]}
          {ind.mutated?.length ? ' + mutasi' : ''}
        </div>
      </Label>
    </group>
  );
}

/** Restarts a clock whenever `key` changes; returns seconds since then. */
function usePhaseClock(key: string) {
  const ref = useRef({ key: '', t0: 0 });
  return (now: number) => {
    if (ref.current.key !== key) ref.current = { key, t0: now };
    return now - ref.current.t0;
  };
}

const SPIN_SPLIT = 1.9; // seconds into the selection step when the wheel turns again for parent B

/** Roulette over generation g-1: slice angle proportional to fitness 1/makespan; spins to parent A, then parent B. */
function Roulette({ g, phase, spot }: { g: number; phase: number; spot: ReturnType<typeof spotlight> }) {
  const { run } = useKitchen();
  const wheel = useRef<THREE.Group>(null);
  const prev = run.generations[Math.max(0, g - 1)].population;
  const slices = useMemo(() => {
    const fits = prev.map((p) => 1 / p.makespan);
    const total = fits.reduce((a, b) => a + b, 0);
    let acc = 0;
    return fits.map((f, i) => {
      const len = (f / total) * Math.PI * 2;
      const s = { start: acc, len, i };
      acc += len;
      return s;
    });
  }, [prev]);
  const centre = (i: number) => slices[i].start + slices[i].len / 2;
  // pointer sits at angle PI/2 (top); land the chosen slice centre under it after a few full turns
  const tA = spot ? Math.PI / 2 - centre(spot.ia) + Math.PI * 2 * 3 * (2 * g) : 0;
  const tB = spot ? Math.PI / 2 - centre(spot.ib) + Math.PI * 2 * 3 * (2 * g + 1) : 0;
  const clock = usePhaseClock(`${g}-${phase}`);
  const hold = useRef(0);
  const wv = useRef({ v: 0 });
  const [second, setSecond] = useState(false);
  useEffect(() => {
    setSecond(false);
    if (phase !== 1) return;
    const t = setTimeout(() => setSecond(true), SPIN_SPLIT * 1000);
    return () => clearTimeout(t);
  }, [g, phase]);

  useFrame(({ clock: c }, dt) => {
    const w = wheel.current;
    if (!w) return;
    const t = clock(c.elapsedTime);
    let target = hold.current;
    if (spot && phase === 1) target = t < SPIN_SPLIT ? tA : tB;
    else if (spot && phase > 1) target = tB;
    else if (phase === 0) target = hold.current; // wait for the selection step
    hold.current = target;
    w.rotation.z = smoothDamp(w.rotation.z, target, wv.current, 0.55, dt);
  });

  const showA = spot && phase >= 1;
  const showB = spot && (phase > 1 || (phase === 1 && second));
  const caption = !spot || phase === 0 ? 'Roda Roulette · irisan ∝ 1/makespan' : phase === 1 && !second ? 'Memutar… Induk A terpilih' : 'Induk A dan Induk B terpilih';
  return (
    <group position={[3.75, 2.75, WALL_Z + 0.1]}>
      <mesh position={[0, 0, -0.05]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[1.18, 1.18, 0.08, 48]} />
        <Toon color="#7a4b2a" />
      </mesh>
      <group ref={wheel}>
        {slices.map((s) => {
          const color = showA && s.i === spot!.ia ? COLOR_A : showB && s.i === spot!.ib ? COLOR_B : s.i % 2 ? '#e76f51' : '#f4f1de';
          return (
            <mesh key={s.i} position={[0, 0, 0.01]}>
              <circleGeometry args={[1.08, 24, s.start, s.len]} />
              <meshBasicMaterial color={color} side={THREE.DoubleSide} />
            </mesh>
          );
        })}
      </group>
      <mesh position={[0, 0, 0.1]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.12, 0.12, 0.1, 16]} />
        <Toon color="#2b2d3a" />
      </mesh>
      <mesh position={[0, 1.24, 0.12]} rotation={[0, 0, Math.PI]}>
        <coneGeometry args={[0.12, 0.3, 3]} />
        <meshBasicMaterial color="#ff5a5f" />
      </mesh>
      <Label position={[0, -1.45, 0]} center style={{ pointerEvents: 'none' }}>
        <div className="board-tag small">{caption}</div>
      </Label>
    </group>
  );
}

/**
 * Breeding table. Selection: parent strips appear. Crossover: each child chip flies in from parent A (outside the
 * cut) or parent B (inside the cut). Mutation: changed genes pulse and flip colour. New generation: final child.
 */
function BreedingTable({ spot, g, phase }: { spot: ReturnType<typeof spotlight>; g: number; phase: number }) {
  const { ev } = useKitchen();
  const chips = useRef<THREE.Group>(null);
  const ROWS = { a: 0.0, b: 0.62, c: 1.4 };
  const gap = 0.23;
  const x0 = -((N - 1) * gap) / 2 - 0.4;
  const info = useMemo(() => (spot ? breed(spot, ev) : null), [spot, ev]);
  const clock = usePhaseClock(`${g}-${phase}`);

  useFrame(({ clock: c }) => {
    const grp = chips.current;
    if (!grp || !spot || !info) return;
    const t = clock(c.elapsedTime);
    const [c0, c1] = info.cut;
    const changed = new Set(info.changed);
    grp.visible = phase >= 2;
    grp.children.forEach((m, k) => {
      const inCut = k >= c0 && k <= c1;
      const from = inCut ? ROWS.b : ROWS.a;
      let p = 1;
      if (phase === 2) {
        const delay = 0.3 + (inCut ? 1.0 : 0.1) + (k / N) * 0.6;
        p = THREE.MathUtils.smoothstep(t, delay, delay + 0.7);
      }
      m.position.set(x0 + k * gap, 1.0 + Math.sin(p * Math.PI) * 0.35, from + (ROWS.c - from) * p);
      const flipped = changed.has(k) && (phase === 4 || (phase === 3 && t > 1.1));
      const mat = (m as THREE.Mesh).material as THREE.MeshBasicMaterial;
      mat.color.set(CHEF_COLORS[flipped ? spot.child.genes[k] : info.pre[k]]);
      const pulse = changed.has(k) && phase === 3 && t < 2.2 ? 1.7 + Math.sin(t * 22) * 0.35 : 1;
      m.scale.set(pulse, changed.has(k) && phase >= 3 ? 1.8 : 1, pulse);
    });
  });

  const childMs = phase >= 3 && spot ? spot.child.makespan : info?.preMs;
  return (
    <group position={[-1.1, 0, 0.3]}>
      <mesh position={[0, 0.45, 0.7]}>
        <boxGeometry args={[N * gap + 1.4, 0.9, 1.7]} />
        <Toon color="#8d6748" />
      </mesh>
      <mesh position={[0, 0.91, 0.7]}>
        <boxGeometry args={[N * gap + 1.5, 0.04, 1.8]} />
        <Toon color="#c49a6c" />
      </mesh>
      {spot && info && phase >= 1 && (
        <>
          {(['a', 'b'] as const).map((key) => (
            <group key={key}>
              {spot[key].genes.map((vm, k) => {
                const inCut = k >= info.cut[0] && k <= info.cut[1];
                // after crossover, fade the genes the child did not take
                const used = phase < 2 || (key === 'a' ? !inCut : inCut);
                return (
                  <mesh key={k} position={[x0 + k * gap, 0.96, ROWS[key]]}>
                    <boxGeometry args={[0.16, 0.05, 0.2]} />
                    <meshBasicMaterial color={CHEF_COLORS[vm]} transparent opacity={used ? 0.9 : 0.18} />
                  </mesh>
                );
              })}
            </group>
          ))}
          {phase >= 2 && (
            <>
              {/* the cut: genes between the two markers come from parent B */}
              <mesh position={[x0 + ((info.cut[0] + info.cut[1]) / 2) * gap, 0.935, 0.7]} rotation={[-Math.PI / 2, 0, 0]}>
                <planeGeometry args={[(info.cut[1] - info.cut[0] + 1) * gap, 1.75]} />
                <meshBasicMaterial color={COLOR_B} transparent opacity={0.16} depthWrite={false} />
              </mesh>
              {info.cut.map((c, i) => (
                <mesh key={i} position={[x0 + (c + (i ? 0.5 : -0.5)) * gap, 1.1, 0.7]}>
                  <boxGeometry args={[0.025, 0.3, 1.6]} />
                  <meshBasicMaterial color={COLOR_CHILD} />
                </mesh>
              ))}
            </>
          )}
          <group ref={chips}>
            {spot.child.genes.map((_, k) => (
              <mesh key={`${g}-${k}`}>
                <boxGeometry args={[0.17, 0.1, 0.22]} />
                <meshBasicMaterial color="#ffffff" />
              </mesh>
            ))}
          </group>
          <Label position={[x0 + (N - 1) * gap + 0.3, 0.96, ROWS.a]} style={{ pointerEvents: 'none' }}>
            <div className="row-tag" style={{ transform: 'translateY(-50%)', borderLeft: `3px solid ${COLOR_A}` }}>
              Induk A · {Math.round(spot.a.makespan)} s
            </div>
          </Label>
          <Label position={[x0 + (N - 1) * gap + 0.3, 0.96, ROWS.b]} style={{ pointerEvents: 'none' }}>
            <div className="row-tag" style={{ transform: 'translateY(-50%)', borderLeft: `3px solid ${COLOR_B}` }}>
              Induk B · {Math.round(spot.b.makespan)} s
            </div>
          </Label>
          {phase >= 2 && (
            <Label position={[x0 + (N - 1) * gap + 0.3, 1.0, ROWS.c]} style={{ pointerEvents: 'none' }}>
              <div className="row-tag child" style={{ transform: 'translateY(-50%)' }}>
                Anak · {Math.round(childMs ?? 0)} s
              </div>
            </Label>
          )}
        </>
      )}
      {(!spot || phase === 0) && (
        <Label position={[0, 1.15, 0.7]} center style={{ pointerEvents: 'none' }}>
          <div className="board-tag small">{g === 0 ? 'Meja persilangan: mulai dari generasi 1' : 'Meja persilangan: menunggu induk dari roda roulette'}</div>
        </Label>
      )}
    </group>
  );
}
