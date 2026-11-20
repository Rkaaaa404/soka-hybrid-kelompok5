import { useState } from 'react';
import * as THREE from 'three';

/**
 * Critically damped spring (Unity-style SmoothDamp): eases in and out and keeps velocity across target
 * changes, so a dish redirected mid-flight curves instead of snapping.
 */
export function smoothDamp(current: number, target: number, vel: { v: number }, smoothTime: number, dt: number): number {
  const step = Math.min(dt, 1 / 20);
  const omega = 2 / smoothTime;
  const x = omega * step;
  const exp = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
  const change = current - target;
  const temp = (vel.v + omega * change) * step;
  vel.v = (vel.v - omega * temp) * exp;
  return target + (change + temp) * exp;
}

export class Spring3 {
  vx = { v: 0 };
  vy = { v: 0 };
  vz = { v: 0 };
  step(o: THREE.Vector3, tx: number, ty: number, tz: number, time: number, dt: number) {
    o.x = smoothDamp(o.x, tx, this.vx, time, dt);
    o.y = smoothDamp(o.y, ty, this.vy, time, dt);
    o.z = smoothDamp(o.z, tz, this.vz, time, dt);
  }
}

/**
 * R3F re-applies a transform prop whenever its values change, which teleports an object that useFrame is
 * animating. Freeze the first value so the prop never changes after mount.
 */
export function useInitial<T>(value: T): T {
  return useState(value)[0];
}
