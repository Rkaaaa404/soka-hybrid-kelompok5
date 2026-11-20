import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { Label } from '../../three/Overlay';
import {
  BOARD,
  BURNER_X,
  CHEF_COLORS,
  CHEF_NAMES,
  KITCHEN_HALF_WIDTH,
  MAX_MI,
  PASS_TOP,
  PASS_Z,
  STATION_WIDTH,
  STATION_X,
  TASKS,
  TOWER_MAX,
  VMS,
  LAB_LB,
  boardSlot,
  fmtS,
} from '../model';
import { useKitchen } from '../store';
import Chef, { type Mood } from './Chef';
import { Toon, shade } from './toon';
import { Spring3, smoothDamp, useInitial } from './anim';

const STOVE_H = 0.92;
const DISH_R = 0.27;

export default function Kitchen() {
  const { scene, stats, run, chapter } = useKitchen();
  // Time -> height scale follows the current plan, but never zooms in past the Max-Min schedule,
  // so towers of different plans are comparable.
  const tMax = Math.max(stats.makespan, run.maxMinMakespan, LAB_LB) * 1.04;
  const k = TOWER_MAX / tMax;
  const showLines = stats.placements.length > 0;
  return (
    <group>
      {VMS.map((vm, v) => (
        <Station key={vm.id} v={v} />
      ))}
      <Dishes k={k} />
      {showLines && <TimeLines k={k} />}
      <OrderBoard />
      <OrderWindow active={chapter <= 3} />
      <ManagerChef />
      {scene.celebrate && <Confetti />}
    </group>
  );
}

function Station({ v }: { v: number }) {
  const { scene, stats, selected, setSelected, setScene } = useKitchen();
  const vm = VMS[v];
  const w = STATION_WIDTH[v];
  const busy = stats.placements.filter((p) => p.vm === v);
  const isBottleneck = stats.bottleneck === v && stats.placements.length > 0;
  const focused = scene.focusVm === v;
  const [hover, setHover] = useState(false);
  const clickable = scene.interactive && selected !== null;

  let mood: Mood = busy.length ? 'cooking' : 'idle';
  if (isBottleneck && scene.plan.every((p) => p >= 0)) mood = 'stressed';
  if (scene.celebrate) mood = 'celebrate';
  if (focused) mood = 'thinking';

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    if (!clickable) return;
    e.stopPropagation();
    const plan = [...scene.plan];
    plan[selected!] = v;
    setScene({ plan });
    setSelected(null);
  };

  return (
    <group>
      <group
        position={[STATION_X[v], 0, 0]}
        onClick={onClick}
        onPointerOver={(e) => (e.stopPropagation(), setHover(true))}
        onPointerOut={() => setHover(false)}
      >
        {/* stove */}
        <mesh position={[0, STOVE_H / 2, 0]}>
          <boxGeometry args={[w, STOVE_H, 0.95]} />
          <Toon color={clickable && hover ? '#d6dde6' : '#b9c1cb'} emissive={focused ? CHEF_COLORS[v] : '#000'} emissiveIntensity={focused ? 0.25 : 0} />
        </mesh>
        <mesh position={[0, STOVE_H + 0.015, -0.05]}>
          <boxGeometry args={[w - 0.08, 0.03, 0.8]} />
          <Toon color="#3a3f48" />
        </mesh>
        {/* oven door + knobs in the chef colour */}
        <mesh position={[0, 0.42, 0.48]}>
          <boxGeometry args={[w - 0.3, 0.42, 0.02]} />
          <Toon color="#7f8996" />
        </mesh>
        {Array.from({ length: vm.pes }, (_, p) => (
          <mesh key={p} position={[BURNER_X[v][p] - STATION_X[v], 0.78, 0.49]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.05, 0.05, 0.05, 12]} />
            <Toon color={CHEF_COLORS[v]} />
          </mesh>
        ))}
        {/* pass shelf */}
        <mesh position={[0, PASS_TOP - 0.05, PASS_Z]}>
          <boxGeometry args={[w, 0.1, 0.62]} />
          <Toon color="#e9dcc4" />
        </mesh>
        <mesh position={[0, (PASS_TOP - 0.1) / 2, PASS_Z + 0.22]}>
          <boxGeometry args={[w - 0.1, PASS_TOP - 0.1, 0.06]} />
          <Toon color={shade(CHEF_COLORS[v], -0.04)} />
        </mesh>
        {focused && (
          <mesh position={[0, 0.02, 0.3]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[w * 0.55, w * 0.62, 48]} />
            <meshBasicMaterial color={CHEF_COLORS[v]} />
          </mesh>
        )}
      </group>
      {Array.from({ length: vm.pes }, (_, p) => (
        <Burner key={p} x={BURNER_X[v][p]} lit={busy.some((b) => b.pe === p)} hot={isBottleneck} />
      ))}
      {isBottleneck && <Smoke x={STATION_X[v]} />}
      {isBottleneck && <Flag x={STATION_X[v] + w / 2 - 0.25} />}
      <Chef
        position={[STATION_X[v], 0, -0.95]}
        apron={CHEF_COLORS[v]}
        mood={mood}
        scale={vm.type === 'Large' ? 1.18 : vm.type === 'Medium' ? 1.05 : 0.92}
        hat={vm.type === 'Large' ? 'tall' : 'toque'}
        phase={v * 1.7}
      />
      <Label position={[STATION_X[v], 0.05, 1.5]} center style={{ pointerEvents: 'none' }}>
        <div className={`chef-tag${focused ? ' on' : ''}${clickable ? ' drop' : ''}`} style={{ ['--c' as string]: CHEF_COLORS[v] }}>
          <b>{CHEF_NAMES[v]}</b>
          <span>
            {vm.pes} kompor · {vm.mips} MIPS
          </span>
        </div>
      </Label>
    </group>
  );
}

function Burner({ x, lit, hot }: { x: number; lit: boolean; hot: boolean }) {
  const flame = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const f = flame.current;
    if (!f) return;
    const t = clock.elapsedTime * (hot ? 18 : 11) + x * 3;
    const s = lit ? 1 + Math.sin(t) * 0.12 + Math.sin(t * 2.3) * 0.08 : 0.001;
    f.scale.set(s, lit ? s * (hot ? 1.5 : 1) : 0.001, s);
  });
  return (
    <group position={[x, STOVE_H + 0.03, -0.12]}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.2, 0.035, 8, 24]} />
        <Toon color="#22252b" />
      </mesh>
      <group ref={flame}>
        <mesh position={[0, 0.1, 0]}>
          <coneGeometry args={[0.16, 0.26, 12, 1, true]} />
          <meshBasicMaterial color={hot ? '#ff5a3c' : '#4fa3ff'} transparent opacity={0.85} side={THREE.DoubleSide} />
        </mesh>
        <mesh position={[0, 0.07, 0]}>
          <coneGeometry args={[0.09, 0.16, 10, 1, true]} />
          <meshBasicMaterial color={hot ? '#ffd166' : '#bfe3ff'} side={THREE.DoubleSide} />
        </mesh>
      </group>
      {/* wok */}
      <mesh position={[0, 0.2, 0]}>
        <sphereGeometry args={[0.24, 18, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2]} />
        <Toon color="#30343b" />
      </mesh>
    </group>
  );
}

function Smoke({ x }: { x: number }) {
  const g = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    g.current?.children.forEach((c, i) => {
      const k = (clock.elapsedTime * 0.45 + i / 6) % 1;
      c.position.set(Math.sin(i * 2.1 + k * 4) * 0.35, 1.3 + k * 2.4, -0.2);
      c.scale.setScalar(0.18 + k * 0.45);
      ((c as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = 0.55 * (1 - k);
    });
  });
  return (
    <group ref={g} position={[x, 0, 0]}>
      {Array.from({ length: 6 }, (_, i) => (
        <mesh key={i}>
          <sphereGeometry args={[1, 12, 10]} />
          <meshBasicMaterial color="#8b8f99" transparent opacity={0.4} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}

function Flag({ x }: { x: number }) {
  const cloth = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (cloth.current) cloth.current.rotation.y = Math.sin(clock.elapsedTime * 6) * 0.25;
  });
  return (
    <group position={[x, STOVE_H, -0.4]}>
      <mesh position={[0, 0.75, 0]}>
        <cylinderGeometry args={[0.025, 0.025, 1.5, 8]} />
        <Toon color="#d9d4c7" />
      </mesh>
      <mesh ref={cloth} position={[0.22, 1.32, 0]}>
        <boxGeometry args={[0.42, 0.28, 0.02]} />
        <Toon color="#e5484d" />
      </mesh>
    </group>
  );
}

/** One rantang per order. It damps toward its slot, so every plan change animates by itself. */
function Dishes({ k }: { k: number }) {
  const { scene, stats } = useKitchen();
  return (
    <>
      {TASKS.map((t) => {
        const v = scene.plan[t.id];
        const p = stats.byTask.get(t.id);
        let pos: [number, number, number];
        let h: number;
        let color: string;
        if (v < 0 || !p) {
          const s = boardSlot(t.id);
          h = 0.16 + 0.34 * (t.lengthMi / MAX_MI);
          pos = [s[0], s[1], s[2]];
          color = '#efe2c6';
        } else {
          h = Math.max(0.05, (p.finish - p.start) * k - 0.025);
          pos = [BURNER_X[v][p.pe], PASS_TOP + p.start * k, PASS_Z];
          color = CHEF_COLORS[v];
        }
        return <Dish key={t.id} task={t.id} target={pos} height={h} color={color} placed={!!p && v >= 0} />;
      })}
    </>
  );
}

function Dish({ task, target, height, color, placed }: { task: number; target: [number, number, number]; height: number; color: string; placed: boolean }) {
  const { scene, selected, setSelected, stats } = useKitchen();
  const g = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const [hover, setHover] = useState(false);
  const focus = scene.focusTask === task;
  const isSel = selected === task;
  const lift = isSel ? 0.35 : 0;
  const initPos = useInitial(target);
  const initScale = useInitial<[number, number, number]>([1, height, 1]);
  const spring = useRef(new Spring3());
  const hv = useRef({ v: 0 });

  useFrame((_, dt) => {
    const node = g.current;
    const b = body.current;
    if (!node || !b) return;
    const s = spring.current;
    // arc: while far from the target horizontally, aim higher so the rantang hops over the counter
    const far = Math.min(1.4, Math.hypot(target[0] - node.position.x, target[2] - node.position.z) * 0.5);
    node.position.x = smoothDamp(node.position.x, target[0], s.vx, 0.42, dt);
    node.position.z = smoothDamp(node.position.z, target[2], s.vz, 0.42, dt);
    node.position.y = smoothDamp(node.position.y, target[1] + far + lift, s.vy, 0.24, dt);
    b.scale.y = Math.max(0.01, smoothDamp(b.scale.y, height, hv.current, 0.3, dt));
    b.position.y = b.scale.y / 2;
  });

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    if (!scene.interactive) return;
    e.stopPropagation();
    setSelected(isSel ? null : task);
  };
  const p = stats.byTask.get(task);
  const t = TASKS[task];
  const glow = focus || isSel || hover;

  return (
    <group ref={g} position={initPos}>
      <group ref={body} scale={initScale}>
        <mesh onClick={onClick} onPointerOver={(e) => (e.stopPropagation(), setHover(true))} onPointerOut={() => setHover(false)}>
          <cylinderGeometry args={[DISH_R, DISH_R * 0.94, 1, 22]} />
          <Toon color={color} emissive={glow ? '#ffffff' : '#000'} emissiveIntensity={glow ? 0.28 : 0} />
        </mesh>
        <mesh position={[0, 0.5, 0]}>
          <cylinderGeometry args={[DISH_R * 1.04, DISH_R * 1.04, 0.04, 22]} />
          <Toon color={placed ? shade(color, -0.15) : '#c9a96e'} />
        </mesh>
      </group>
      {(hover || focus || isSel) && (
        <Label position={[0, height + 0.3, 0]} center style={{ pointerEvents: 'none' }}>
          <div className="tooltip k-tip">
            <div className="tt-title">Pesanan #{task}</div>
            <div className="tt-row">porsi {Math.round(t.lengthMi / 1000)}k MI · datang {fmtS(t.arrivalTime)}</div>
            {p && placed ? (
              <div className="tt-row">
                {CHEF_NAMES[p.vm]} · {fmtS(p.start)} → {fmtS(p.finish)}
              </div>
            ) : (
              <div className="tt-row">menunggu di papan pesanan</div>
            )}
          </div>
        </Label>
      )}
    </group>
  );
}

function TimeLines({ k }: { k: number }) {
  const { stats } = useKitchen();
  const w = KITCHEN_HALF_WIDTH * 2 + 0.6;
  const yM = PASS_TOP + stats.makespan * k;
  const yL = PASS_TOP + LAB_LB * k;
  const m = useRef<THREE.Group>(null);
  const initM = useInitial<[number, number, number]>([0, yM, PASS_Z]);
  const mv = useRef({ v: 0 });
  useFrame((_, dt) => {
    if (m.current) m.current.position.y = smoothDamp(m.current.position.y, yM, mv.current, 0.35, dt);
  });
  return (
    <>
      <group ref={m} position={initM}>
        <mesh>
          <boxGeometry args={[w, 0.03, 0.03]} />
          <meshBasicMaterial color="#ff5a5f" />
        </mesh>
        <Label position={[w / 2 + 0.1, 0, 0]} style={{ pointerEvents: 'none' }}>
          <div className="line-tag red" style={{ transform: 'translateY(-130%)' }}>
            makespan {fmtS(stats.makespan)}
          </div>
        </Label>
      </group>
      <group position={[0, yL, PASS_Z - 0.02]}>
        {Array.from({ length: 34 }, (_, i) => (
          <mesh key={i} position={[-w / 2 + (i + 0.5) * (w / 34), 0, 0]}>
            <boxGeometry args={[(w / 34) * 0.55, 0.025, 0.025]} />
            <meshBasicMaterial color="#5ec8ff" />
          </mesh>
        ))}
        <Label position={[w / 2 + 0.1, 0, 0]} style={{ pointerEvents: 'none' }}>
          <div className="line-tag blue" style={{ transform: 'translateY(30%)' }}>
            batas tercepat {fmtS(LAB_LB)}
          </div>
        </Label>
      </group>
    </>
  );
}

function OrderBoard() {
  const pending = useKitchen().scene.plan.filter((v) => v < 0).length;
  return (
    <group position={[BOARD.x, 0, BOARD.z]}>
      <mesh position={[0, 1.95, 0]}>
        <boxGeometry args={[BOARD.cols * BOARD.dx + 0.5, 3.4, 0.12]} />
        <Toon color="#8a5a3b" />
      </mesh>
      <mesh position={[0, 1.95, 0.065]}>
        <boxGeometry args={[BOARD.cols * BOARD.dx + 0.3, 3.2, 0.02]} />
        <Toon color="#c99a6b" />
      </mesh>
      {Array.from({ length: 5 }, (_, r) => (
        <mesh key={r} position={[0, BOARD.y0 + r * BOARD.dy - 0.02, 0.32]}>
          <boxGeometry args={[BOARD.cols * BOARD.dx + 0.2, 0.04, 0.5]} />
          <Toon color="#6e472d" />
        </mesh>
      ))}
      <Label position={[0, 3.95, 0.1]} center style={{ pointerEvents: 'none' }}>
        <div className="board-tag">Papan Pesanan · {pending} menunggu</div>
      </Label>
    </group>
  );
}

function ManagerChef() {
  const { scene } = useKitchen();
  const lookX = scene.focusVm !== null ? STATION_X[scene.focusVm] : null;
  return (
    <group>
      <Chef position={[BOARD.x + 2.3, 0, 0.9]} apron="#f0b429" mood={scene.focusTask !== null ? 'thinking' : 'idle'} hat="cap" lookX={lookX} phase={3} />
      <Label position={[BOARD.x + 2.3, 0.05, 1.55]} center style={{ pointerEvents: 'none' }}>
        <div className="chef-tag" style={{ ['--c' as string]: '#f0b429' }}>
          <b>Manajer</b>
          <span>scheduler (HMMGA)</span>
        </div>
      </Label>
    </group>
  );
}

function OrderWindow({ active }: { active: boolean }) {
  const scooter = useRef<THREE.Group>(null);
  const tickets = useRef<THREE.Group>(null);
  const base = useMemo(() => new THREE.Vector3(BOARD.x - 2.7, 1.3, 1.2), []);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (scooter.current) scooter.current.position.y = Math.abs(Math.sin(t * 7)) * 0.03;
    tickets.current?.children.forEach((c, i) => {
      const k = (t * 0.35 + i / 4) % 1;
      c.visible = active;
      c.position.set(base.x + k * 2.5, base.y + Math.sin(k * Math.PI) * 1.2 + k * 0.8, base.z - k * 1.3);
      c.rotation.set(k * 6, k * 4, 0);
    });
  });
  return (
    <group>
      <group position={[BOARD.x - 3.6, 0, 1.4]}>
        {/* pickup counter */}
        <mesh position={[0.6, 0.5, -0.6]}>
          <boxGeometry args={[1.4, 1, 0.6]} />
          <Toon color="#3d7068" />
        </mesh>
        <group ref={scooter} rotation={[0, 0.6, 0]}>
          {[-0.45, 0.45].map((x) => (
            <mesh key={x} position={[x, 0.18, 0]} rotation={[0, 0, Math.PI / 2]}>
              <torusGeometry args={[0.15, 0.06, 8, 16]} />
              <Toon color="#25262b" />
            </mesh>
          ))}
          <mesh position={[0, 0.42, 0]}>
            <boxGeometry args={[1.0, 0.22, 0.32]} />
            <Toon color="#6c5ce7" />
          </mesh>
          <mesh position={[-0.35, 0.72, 0]}>
            <boxGeometry args={[0.38, 0.38, 0.38]} />
            <Toon color="#f4a261" />
          </mesh>
          <Chef position={[0.05, 0.3, 0]} apron="#6c5ce7" mood="idle" scale={0.72} hat="cap" phase={1} />
        </group>
      </group>
      <group ref={tickets}>
        {Array.from({ length: 4 }, (_, i) => (
          <mesh key={i}>
            <planeGeometry args={[0.22, 0.3]} />
            <meshBasicMaterial color="#fff6e0" side={THREE.DoubleSide} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

function Confetti() {
  const g = useRef<THREE.Group>(null);
  const seeds = useMemo(() => Array.from({ length: 70 }, (_, i) => ({ x: (Math.sin(i * 12.9898) * 43758.5453) % 1, s: 0.4 + ((i * 7) % 10) / 15, c: ['#3987e5', '#f0b429', '#ff5a5f', '#2ec4b6', '#ffffff'][i % 5] })), []);
  useFrame(({ clock }) => {
    g.current?.children.forEach((c, i) => {
      const sd = seeds[i];
      const k = (clock.elapsedTime * sd.s * 0.3 + i / 70) % 1;
      c.position.set(sd.x * KITCHEN_HALF_WIDTH, 6 - k * 6.5, Math.cos(i) * 1.5);
      c.rotation.set(k * 10 + i, k * 7, 0);
    });
  });
  return (
    <group ref={g}>
      {seeds.map((s, i) => (
        <mesh key={i}>
          <planeGeometry args={[0.1, 0.16]} />
          <meshBasicMaterial color={s.c} side={THREE.DoubleSide} />
        </mesh>
      ))}
    </group>
  );
}
