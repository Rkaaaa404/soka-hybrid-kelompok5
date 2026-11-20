import { useMemo } from 'react';
import * as THREE from 'three';

let gradient: THREE.DataTexture | null = null;

/** 3-step ramp for the playful toon look (shared by every toon material). */
export function toonGradient(): THREE.DataTexture {
  if (!gradient) {
    const data = new Uint8Array([90, 90, 90, 255, 180, 180, 180, 255, 255, 255, 255, 255]);
    gradient = new THREE.DataTexture(data, 3, 1, THREE.RGBAFormat);
    gradient.minFilter = THREE.NearestFilter;
    gradient.magFilter = THREE.NearestFilter;
    gradient.needsUpdate = true;
  }
  return gradient;
}

interface ToonProps {
  color: string;
  emissive?: string;
  emissiveIntensity?: number;
  transparent?: boolean;
  opacity?: number;
}

export function Toon({ color, emissive = '#000000', emissiveIntensity = 0, transparent, opacity }: ToonProps) {
  const g = useMemo(toonGradient, []);
  return (
    <meshToonMaterial
      color={color}
      gradientMap={g}
      emissive={emissive}
      emissiveIntensity={emissiveIntensity}
      transparent={transparent}
      opacity={opacity ?? 1}
    />
  );
}

/** Lighten (amt > 0) or darken (amt < 0) a hex colour. */
export function shade(hex: string, amt: number): string {
  const c = new THREE.Color(hex);
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  c.setHSL(hsl.h, hsl.s, Math.min(1, Math.max(0, hsl.l + amt)));
  return `#${c.getHexString()}`;
}
