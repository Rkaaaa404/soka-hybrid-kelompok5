import { CameraControls } from '@react-three/drei';
import { Canvas, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { LabelVisibility, OverlayRoot } from '../../three/Overlay';
import { useKitchen } from '../store';
import Arena, { ARENA_X, ARENA_Z } from './Arena';
import Kitchen from './Kitchen';
import PlanningRoom, { ROOM_X } from './PlanningRoom';
import Room from './Room';

type V3 = [number, number, number];

/**
 * Camera per chapter (indices match CHAPTERS in App.tsx): a viewing direction (pos - target) plus the
 * world width/height that must fit in the part of the screen not covered by the panel.
 */
export const CAMERAS: { pos: V3; target: V3; w: number; h: number }[] = [
  { pos: [-3, 6.2, 15], target: [-2.2, 2.1, 0.4], w: 21, h: 6 }, // intro
  { pos: [ARENA_X, 4.2, ARENA_Z + 8.5], target: [ARENA_X, 1.6, ARENA_Z], w: 7, h: 4.5 }, // hybrid selection
  { pos: [0.8, 5.2, 12], target: [0.8, 2.1, 0.3], w: 20, h: 5.6 }, // kitchen = datacenter
  { pos: [-3.6, 5.6, 12.5], target: [-3.6, 2, 0], w: 23.5, h: 6 }, // Max-Min
  { pos: [ROOM_X - 1.2, 4.2, 9.2], target: [ROOM_X - 0.4, 2.3, -0.3], w: 11.6, h: 5.6 }, // GA
  { pos: [0.8, 5.2, 12], target: [0.8, 2.1, 0.3], w: 20, h: 5.6 }, // migration
  { pos: [ARENA_X, 4.6, ARENA_Z + 12.5], target: [ARENA_X, 4.2, ARENA_Z], w: 15.5, h: 9.6 }, // competition
  { pos: [ARENA_X + 2, 4.8, ARENA_Z + 12], target: [ARENA_X, 2.2, ARENA_Z], w: 15.5, h: 4.8 }, // trade-off
  { pos: [2.5, 4.6, 13], target: [-1, 2.2, 0.4], w: 19, h: 6.5 }, // conclusion
];

const TAN = Math.tan(THREE.MathUtils.degToRad(21));

export const PANEL_MAX = 460;
export const PANEL_LARGE = 760;

function CameraRig() {
  const { chapter, panelOpen, panelSize } = useKitchen();
  const ref = useRef<CameraControls>(null);
  const size = useThree((s) => s.size);
  const first = useRef(true);

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const { pos, target, w, h } = CAMERAS[chapter];
    const mobile = size.width < 760;
    const panel =
      mobile || !panelOpen || panelSize === 'full' ? 0 : panelSize === 'large' ? Math.min(PANEL_LARGE, size.width * 0.56) : Math.min(PANEL_MAX, size.width * 0.38);
    const usableW = size.width - panel;
    const usableH = mobile && panelOpen ? size.height * (panelSize === 'normal' ? 0.52 : 0.3) : size.height;
    const aspect = usableW / Math.max(1, usableH);
    const dir = new THREE.Vector3(...pos).sub(new THREE.Vector3(...target));
    const d0 = dir.length();
    // usableH is a fraction of the canvas on mobile: the vertical fov only covers it partially
    const vFrac = usableH / size.height;
    // phones may crop the sides a little rather than shrink the scene to a sliver
    const fitW = mobile ? w * 0.72 : w;
    const need = Math.max(d0 * 0.75, (fitW / 2 / (TAN * aspect * vFrac)) * 1.06, (h / 2 / (TAN * vFrac)) * 1.1);
    const p = dir.normalize().multiplyScalar(need).add(new THREE.Vector3(...target));
    const animate = !first.current;
    c.setLookAt(p.x, p.y, p.z, target[0], target[1], target[2], animate);
    const d = p.distanceTo(new THREE.Vector3(...target));
    const visH = 2 * d * Math.tan(THREE.MathUtils.degToRad(21));
    const visW = visH * (size.width / size.height);
    if (mobile) c.setFocalOffset(0, panelOpen ? visH * (panelSize === 'normal' ? 0.24 : 0.35) : visH * 0.08, 0, animate);
    // hidden panel: the control dock sits above the chapter nav, so lift the scene a little
    else c.setFocalOffset(-(panel / 2 / size.width) * visW, panelOpen ? 0 : visH * 0.09, 0, animate);
    first.current = false;
  }, [chapter, size.width, size.height, panelOpen, panelSize]);

  return (
    <CameraControls
      ref={ref}
      makeDefault
      minDistance={4}
      maxDistance={48}
      maxPolarAngle={Math.PI / 2.08}
      smoothTime={0.9}
      dollySpeed={0.6}
    />
  );
}

const ARENA_CHAPTERS = [1, 6, 7];

function Zones() {
  const { chapter } = useKitchen();
  const arena = ARENA_CHAPTERS.includes(chapter);
  return (
    <>
      <LabelVisibility.Provider value={!arena && chapter !== 4}>
        <Room />
        <Kitchen />
      </LabelVisibility.Provider>
      <LabelVisibility.Provider value={chapter === 4}>
        <PlanningRoom />
      </LabelVisibility.Provider>
      <LabelVisibility.Provider value={arena}>
        <Arena />
      </LabelVisibility.Provider>
    </>
  );
}

export default function World() {
  return (
    <div className="world">
      <OverlayRoot>
        {() => (
          <Canvas camera={{ position: [-4, 6.4, 15.5], fov: 42, near: 0.1, far: 200 }} dpr={[1, 2]} gl={{ antialias: true }}>
            <color attach="background" args={['#120f22']} />
            <fog attach="fog" args={['#120f22', 34, 80]} />
            <hemisphereLight args={['#8fa2ff', '#3a2340', 0.85]} />
            <ambientLight intensity={0.35} />
            <directionalLight position={[6, 12, 9]} intensity={1.3} color="#fff1dc" />
            <directionalLight position={[-10, 6, 12]} intensity={0.45} color="#9fb4ff" />
            <Zones />
            <CameraRig />
          </Canvas>
        )}
      </OverlayRoot>
    </div>
  );
}
