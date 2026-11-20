import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { Label } from '../../three/Overlay';
import { KITCHEN_HALF_WIDTH } from '../model';
import { Toon } from './toon';

function tileTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  g.fillStyle = '#2f2a3d';
  g.fillRect(0, 0, 128, 128);
  g.fillStyle = '#3a3450';
  g.fillRect(0, 0, 64, 64);
  g.fillRect(64, 64, 64, 64);
  g.strokeStyle = '#25212f';
  g.lineWidth = 3;
  g.strokeRect(0, 0, 128, 128);
  g.strokeRect(0, 0, 64, 64);
  g.strokeRect(64, 64, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(40, 24);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Night-shift kitchen: tiled floor, back wall with neon sign, hanging lamps, shelves of pots. */
export default function Room() {
  const tex = useMemo(tileTexture, []);
  const W = KITCHEN_HALF_WIDTH;
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-8, 0, 6]}>
        <planeGeometry args={[110, 64]} />
        <meshToonMaterial map={tex} />
      </mesh>
      {/* back wall */}
      <mesh position={[4, 3.2, -2.6]}>
        <boxGeometry args={[44, 6.4, 0.2]} />
        <Toon color="#1e3a44" />
      </mesh>
      {/* tiled splash band */}
      <mesh position={[0, 1.6, -2.48]}>
        <boxGeometry args={[W * 2 + 2, 1.4, 0.04]} />
        <Toon color="#e8e1d3" />
      </mesh>
      {/* hood over the stoves */}
      <mesh position={[0, 3.25, -1.5]}>
        <boxGeometry args={[W * 2 + 0.8, 0.55, 1.5]} />
        <Toon color="#9aa4b1" />
      </mesh>
      <NeonSign position={[0, 4.55, -2.45]} />
      {/* shelves with pots */}
      {[-1, 1].map((side) => (
        <group key={side} position={[side * (W - 1.6), 4.0, -2.35]}>
          <mesh>
            <boxGeometry args={[3, 0.08, 0.4]} />
            <Toon color="#7b5536" />
          </mesh>
          {[-1, 0, 1].map((i) => (
            <mesh key={i} position={[i * 0.9, 0.22, 0]}>
              <cylinderGeometry args={[0.22, 0.2, 0.36, 18]} />
              <Toon color={['#e76f51', '#2a9d8f', '#e9c46a'][i + 1]} />
            </mesh>
          ))}
        </group>
      ))}
      {[-W * 0.66, 0, W * 0.66].map((x) => (
        <Lamp key={x} x={x} />
      ))}
      <Stars />
    </group>
  );
}

function NeonSign({ position }: { position: [number, number, number] }) {
  const frame = useRef<THREE.MeshBasicMaterial>(null);
  useFrame(({ clock }) => {
    if (frame.current) frame.current.opacity = 0.75 + Math.sin(clock.elapsedTime * 3) * 0.08 + (Math.sin(clock.elapsedTime * 17) > 0.97 ? -0.4 : 0);
  });
  return (
    <group position={position}>
      <mesh>
        <boxGeometry args={[6.4, 1.15, 0.05]} />
        <meshBasicMaterial ref={frame} color="#ff7ab6" transparent opacity={0.8} />
      </mesh>
      <mesh position={[0, 0, 0.03]}>
        <boxGeometry args={[6.2, 0.95, 0.04]} />
        <meshBasicMaterial color="#1a1426" />
      </mesh>
      <Label position={[0, 0, 0.06]} center style={{ pointerEvents: 'none' }}>
        <div className="neon">
          CLOUD<span>☁</span>KITCHEN
        </div>
      </Label>
    </group>
  );
}

function Lamp({ x }: { x: number }) {
  return (
    <group position={[x, 5.8, 0.6]}>
      <mesh position={[0, 0.6, 0]}>
        <cylinderGeometry args={[0.012, 0.012, 1.2, 4]} />
        <meshBasicMaterial color="#555" />
      </mesh>
      <mesh>
        <coneGeometry args={[0.45, 0.4, 20, 1, true]} />
        <Toon color="#f0b429" />
      </mesh>
      <mesh position={[0, -0.12, 0]}>
        <sphereGeometry args={[0.14, 12, 10]} />
        <meshBasicMaterial color="#fff2c6" />
      </mesh>
      <pointLight position={[0, -0.4, 0]} intensity={7} distance={9} decay={1.6} color="#ffd39a" />
    </group>
  );
}

function Stars() {
  const geo = useMemo(() => {
    const pts = new Float32Array(600 * 3);
    for (let i = 0; i < 600; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 45 + Math.random() * 20;
      pts.set([Math.cos(a) * r, 8 + Math.random() * 30, Math.sin(a) * r], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pts, 3));
    return g;
  }, []);
  return (
    <points geometry={geo}>
      <pointsMaterial color="#cfd8ff" size={0.18} sizeAttenuation />
    </points>
  );
}
