import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import * as THREE from 'three';
import { Toon, shade } from './toon';

export type Mood = 'idle' | 'cooking' | 'stressed' | 'celebrate' | 'thinking';

interface Props {
  position: [number, number, number];
  apron: string;
  mood: Mood;
  scale?: number;
  hat?: 'toque' | 'tall' | 'cap';
  phase?: number;
  /** world-space x the chef turns toward (manager pointing at a chef) */
  lookX?: number | null;
}

const SKIN = '#f1c7a0';

/** Procedural mascot: round body, chef jacket, coloured apron, toque. */
export default function Chef({ position, apron, mood, scale = 1, hat = 'toque', phase = 0, lookX = null }: Props) {
  const root = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const armR = useRef<THREE.Group>(null);
  const armL = useRef<THREE.Group>(null);
  const sweat = useRef<THREE.Group>(null);

  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime + phase;
    const b = body.current;
    if (b) {
      const bob = mood === 'celebrate' ? Math.abs(Math.sin(t * 5)) * 0.35 : mood === 'stressed' ? Math.abs(Math.sin(t * 9)) * 0.04 : Math.sin(t * 2) * 0.03;
      b.position.y = bob;
      b.rotation.z = mood === 'stressed' ? Math.sin(t * 14) * 0.05 : mood === 'thinking' ? Math.sin(t * 1.5) * 0.06 : 0;
    }
    if (armR.current) {
      const stir = mood === 'cooking' || mood === 'stressed' ? Math.sin(t * (mood === 'stressed' ? 12 : 6)) * 0.6 - 0.9 : mood === 'celebrate' ? -2.6 + Math.sin(t * 8) * 0.3 : mood === 'thinking' ? -1.6 : -0.2;
      armR.current.rotation.x = THREE.MathUtils.damp(armR.current.rotation.x, stir, 10, dt);
    }
    if (armL.current) {
      const target = mood === 'celebrate' ? -2.6 + Math.cos(t * 8) * 0.3 : mood === 'stressed' ? -0.8 + Math.cos(t * 12) * 0.5 : -0.2;
      armL.current.rotation.x = THREE.MathUtils.damp(armL.current.rotation.x, target, 10, dt);
    }
    if (sweat.current) {
      sweat.current.visible = mood === 'stressed';
      sweat.current.children.forEach((d, i) => {
        const k = (t * 1.4 + i * 0.37) % 1;
        d.position.set(0.22 * (i % 2 ? 1 : -1), 1.42 - k * 0.5, 0.18);
        d.scale.setScalar(1 - k * 0.6);
      });
    }
    if (root.current) {
      const want = lookX == null ? 0 : Math.atan2(lookX - position[0], 2.2) * 0.9;
      root.current.rotation.y = THREE.MathUtils.damp(root.current.rotation.y, want, 5, dt);
    }
  });

  return (
    <group ref={root} position={position} scale={scale}>
      <group ref={body}>
        {/* legs */}
        {[-0.12, 0.12].map((x) => (
          <mesh key={x} position={[x, 0.18, 0]}>
            <capsuleGeometry args={[0.08, 0.2, 4, 8]} />
            <Toon color="#2b2d3a" />
          </mesh>
        ))}
        {/* jacket */}
        <mesh position={[0, 0.62, 0]}>
          <capsuleGeometry args={[0.27, 0.36, 6, 16]} />
          <Toon color="#f7f4ee" />
        </mesh>
        {/* apron */}
        <mesh position={[0, 0.55, 0.2]} scale={[1, 1, 0.45]}>
          <cylinderGeometry args={[0.24, 0.29, 0.5, 18, 1, false, -1.2, 2.4]} />
          <Toon color={apron} />
        </mesh>
        <mesh position={[0, 0.86, 0.24]}>
          <boxGeometry args={[0.2, 0.08, 0.04]} />
          <Toon color={shade(apron, -0.12)} />
        </mesh>
        {/* arms */}
        <group ref={armR} position={[0.32, 0.82, 0]}>
          <mesh position={[0, -0.17, 0]}>
            <capsuleGeometry args={[0.075, 0.24, 4, 8]} />
            <Toon color="#f7f4ee" />
          </mesh>
          <mesh position={[0, -0.36, 0]}>
            <sphereGeometry args={[0.07, 12, 10]} />
            <Toon color={SKIN} />
          </mesh>
          {(mood === 'cooking' || mood === 'stressed') && (
            <mesh position={[0, -0.5, 0.02]}>
              <cylinderGeometry args={[0.018, 0.018, 0.32, 6]} />
              <Toon color="#a0784f" />
            </mesh>
          )}
        </group>
        <group ref={armL} position={[-0.32, 0.82, 0]}>
          <mesh position={[0, -0.17, 0]}>
            <capsuleGeometry args={[0.075, 0.24, 4, 8]} />
            <Toon color="#f7f4ee" />
          </mesh>
          <mesh position={[0, -0.36, 0]}>
            <sphereGeometry args={[0.07, 12, 10]} />
            <Toon color={SKIN} />
          </mesh>
        </group>
        {/* head */}
        <mesh position={[0, 1.18, 0]}>
          <sphereGeometry args={[0.24, 24, 18]} />
          <Toon color={SKIN} />
        </mesh>
        {[-0.08, 0.08].map((x) => (
          <mesh key={x} position={[x, 1.21, 0.21]}>
            <sphereGeometry args={[0.032, 10, 8]} />
            <meshBasicMaterial color="#1d1d22" />
          </mesh>
        ))}
        {[-0.15, 0.15].map((x) => (
          <mesh key={x} position={[x, 1.13, 0.19]}>
            <sphereGeometry args={[0.035, 10, 8]} />
            <meshBasicMaterial color={mood === 'stressed' ? '#ff6b6b' : '#f29b8f'} transparent opacity={0.7} />
          </mesh>
        ))}
        <mesh position={[0, 1.1, 0.215]} rotation={[0, 0, Math.PI]}>
          <torusGeometry args={[0.05, 0.012, 6, 12, mood === 'stressed' ? Math.PI : Math.PI]} />
          <meshBasicMaterial color="#5a2b2b" />
        </mesh>
        {/* hat */}
        {hat === 'cap' ? (
          <group position={[0, 1.36, 0]}>
            <mesh>
              <sphereGeometry args={[0.24, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
              <Toon color="#3c4a6b" />
            </mesh>
            <mesh position={[0, 0, 0.2]} rotation={[0.25, 0, 0]}>
              <boxGeometry args={[0.3, 0.02, 0.16]} />
              <Toon color="#2f3a55" />
            </mesh>
          </group>
        ) : (
          <group position={[0, 1.38, 0]}>
            <mesh position={[0, 0.06, 0]}>
              <cylinderGeometry args={[0.2, 0.19, hat === 'tall' ? 0.3 : 0.16, 18]} />
              <Toon color="#ffffff" />
            </mesh>
            {[
              [0, 0.26, 0],
              [0.13, 0.22, 0],
              [-0.13, 0.22, 0],
              [0, 0.22, 0.12],
              [0, 0.22, -0.12],
            ].map((p, i) => (
              <mesh key={i} position={[p[0], p[1] + (hat === 'tall' ? 0.12 : 0), p[2]]}>
                <sphereGeometry args={[0.13, 14, 10]} />
                <Toon color="#ffffff" />
              </mesh>
            ))}
          </group>
        )}
        <group ref={sweat}>
          {[0, 1, 2].map((i) => (
            <mesh key={i}>
              <sphereGeometry args={[0.035, 8, 6]} />
              <meshBasicMaterial color="#8fd3ff" />
            </mesh>
          ))}
        </group>
      </group>
    </group>
  );
}
