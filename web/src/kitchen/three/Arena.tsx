import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import * as THREE from 'three';
import { ALGO_COLOR, ALGO_LABEL, LOWER_BOUND, METRIC_BY_KEY, SCALES, fmt } from '../../data/meta';
import { byAlgo, useSnapshots } from '../../data/results';
import type { AlgoId, MetricKey } from '../../data/types';
import { Label } from '../../three/Overlay';
import { useKitchen } from '../store';
import { Toon, shade } from './toon';
import { smoothDamp } from './anim';

export const ARENA_X = -34;
export const ARENA_Z = 3;
const UNIT = 1.45; // tower height of the lower bound

const MAX_H = 3.6;

/** What the tower height means for the selected metric, and which direction is better. */
export function arenaCaption(mode: 'makespan' | MetricKey): { what: string; better: string } {
  if (mode === 'makespan') return { what: 'Tinggi menara = makespan ÷ batas bawah', better: 'makin rendah makin baik, menyentuh bidang biru = optimal' };
  const m = METRIC_BY_KEY[mode];
  return {
    what: `Tinggi menara = ${m.label.toLowerCase()}${m.unit ? ` (${m.unit})` : ''}`,
    better: m.better === 'lower' ? 'makin rendah makin baik' : 'makin tinggi makin baik',
  };
}

/** Competition stage: one rantang tower per algorithm; height = makespan / lower bound, or the raw value of the chosen metric. */
export default function Arena() {
  const { scene, panelOpen } = useKitchen();
  const { data } = useSnapshots(SCALES);
  const snap = data[scene.arena.scale];
  const { algos, mode } = scene.arena;
  const spacing = 1.55;
  const key: MetricKey = mode === 'makespan' ? 'makespan' : mode;
  const rows = snap ? algos.map((a) => byAlgo(snap, a)).filter((r) => r !== undefined) : [];
  const vals = rows.map((r) => r.metrics[key].mean);
  const top = Math.max(...vals, 1e-9);
  const bestVal = METRIC_BY_KEY[key].better === 'lower' ? Math.min(...vals) : Math.max(...vals);
  const cap = arenaCaption(mode);

  return (
    <group position={[ARENA_X, 0, ARENA_Z]}>
      <mesh position={[0, 0.06, 0]}>
        <cylinderGeometry args={[8.4, 8.8, 0.12, 64]} />
        <Toon color="#2c2541" />
      </mesh>
      <mesh position={[0, 0.125, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[7.9, 8.2, 64]} />
        <meshBasicMaterial color="#f0b429" />
      </mesh>
      {/* the dock repeats this caption while the panel is hidden */}
      {panelOpen && (
      <Label position={[0, 0.2, 3.3]} center style={{ pointerEvents: 'none' }}>
        <div className="board-tag arena-cap">
          GoCJ {scene.arena.scale.toLocaleString('id-ID')} task · {cap.what}
          <span>{cap.better}</span>
        </div>
      </Label>
      )}
      {snap &&
        algos.map((a, i) => {
          const r = byAlgo(snap, a);
          if (!r) return null;
          const x = (i - (algos.length - 1) / 2) * spacing;
          let h: number;
          let value: string;
          if (mode === 'makespan') {
            h = (r.metrics.makespan.mean / LOWER_BOUND[scene.arena.scale]) * UNIT;
            value = `${fmt(r.metrics.makespan.mean, 0)} s`;
          } else {
            const meta = METRIC_BY_KEY[key];
            h = Math.max(0.1, (r.metrics[key].mean / top) * MAX_H);
            value = `${fmt(r.metrics[key].mean, meta.digits)}${meta.unit ? ` ${meta.unit}` : ''}`;
          }
          const best = Math.abs(r.metrics[key].mean - bestVal) <= Math.abs(bestVal) * 1e-6;
          return <Tower key={a} algo={a} x={x} h={h} value={value} crown={best} />;
        })}
      {mode === 'makespan' && snap && (
        <group position={[0, 0.12 + UNIT, 0]}>
          <mesh>
            <boxGeometry args={[algos.length * spacing + 0.6, 0.02, 1.2]} />
            <meshBasicMaterial color="#5ec8ff" transparent opacity={0.25} depthWrite={false} />
          </mesh>
          <Label position={[(algos.length * spacing) / 2 + 0.4, 0, 0]} style={{ pointerEvents: 'none' }}>
            <div className="line-tag blue">batas bawah {fmt(LOWER_BOUND[scene.arena.scale], 0)} s</div>
          </Label>
        </group>
      )}
    </group>
  );
}

function Tower({ algo, x, h, value, crown }: { algo: AlgoId; x: number; h: number; value: string; crown: boolean }) {
  const body = useRef<THREE.Group>(null);
  const top = useRef<THREE.Group>(null);
  const color = ALGO_COLOR[algo];
  const hv = useRef({ v: 0 });
  useFrame((_, dt) => {
    const b = body.current;
    if (!b) return;
    b.scale.y = Math.max(0.01, smoothDamp(b.scale.y, h, hv.current, 0.55, dt));
    b.position.y = 0.12 + b.scale.y / 2;
    if (top.current) top.current.position.y = 0.12 + b.scale.y;
  });
  const tiers = 7;
  return (
    <group position={[x, 0, 0]}>
      <group ref={body} scale={[1, 0.01, 1]}>
        <mesh>
          <cylinderGeometry args={[0.5, 0.52, 1, 28]} />
          <Toon color={color} />
        </mesh>
        {Array.from({ length: tiers - 1 }, (_, i) => (
          <mesh key={i} position={[0, -0.5 + ((i + 1) / tiers), 0]}>
            <cylinderGeometry args={[0.535, 0.535, 0.012, 28]} />
            <Toon color={shade(color, -0.2)} />
          </mesh>
        ))}
      </group>
      <group ref={top}>
        <mesh position={[0, 0.04, 0]}>
          <cylinderGeometry args={[0.55, 0.55, 0.08, 28]} />
          <Toon color={shade(color, -0.15)} />
        </mesh>
        <mesh position={[0, 0.14, 0]}>
          <torusGeometry args={[0.16, 0.035, 8, 18]} />
          <Toon color="#d9d4c7" />
        </mesh>
        {crown && (
          <group position={[0, 0.42, 0]}>
            <mesh>
              <cylinderGeometry args={[0.3, 0.26, 0.2, 6, 1, true]} />
              <meshBasicMaterial color="#f0b429" side={THREE.DoubleSide} />
            </mesh>
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <mesh key={i} position={[Math.cos((i / 6) * Math.PI * 2) * 0.29, 0.17, Math.sin((i / 6) * Math.PI * 2) * 0.29]}>
                <coneGeometry args={[0.06, 0.16, 6]} />
                <meshBasicMaterial color="#f0b429" />
              </mesh>
            ))}
          </group>
        )}
        <Label position={[0, crown ? 0.9 : 0.45, 0]} center style={{ pointerEvents: 'none' }}>
          <div className={`tower-tag${crown ? ' win' : ''}`}>
            {crown ? '👑 ' : ''}
            {value}
          </div>
        </Label>
      </group>
      <Label position={[0, 0.15, 0.75]} center style={{ pointerEvents: 'none' }}>
        <div className="tower-name" style={{ ['--c' as string]: color }}>
          {ALGO_LABEL[algo]}
        </div>
      </Label>
    </group>
  );
}
