export type Scale = ((v: number) => number) & { ticks: number[]; domain: [number, number] };

export function niceStep(span: number, count: number): number {
  const raw = span / Math.max(1, count);
  const mag = 10 ** Math.floor(Math.log10(raw));
  const norm = raw / mag;
  const step = norm >= 5 ? 10 : norm >= 2 ? 5 : norm >= 1 ? 2 : 1;
  return step * mag;
}

export function linear(domain: [number, number], range: [number, number], tickCount = 5, nice = true): Scale {
  let [d0, d1] = domain;
  if (d1 === d0) d1 = d0 + 1;
  const step = niceStep(d1 - d0, tickCount);
  if (nice) {
    d0 = Math.floor(d0 / step) * step;
    d1 = Math.ceil(d1 / step) * step;
  }
  const f = ((v: number) => range[0] + ((v - d0) / (d1 - d0)) * (range[1] - range[0])) as Scale;
  const ticks: number[] = [];
  for (let t = d0; t <= d1 + step * 1e-6; t += step) ticks.push(+t.toFixed(10));
  f.ticks = ticks;
  f.domain = [d0, d1];
  return f;
}

export function log10(domain: [number, number], range: [number, number]): Scale {
  const l0 = Math.floor(Math.log10(Math.max(domain[0], 1e-9)));
  const l1 = Math.ceil(Math.log10(Math.max(domain[1], 1e-9)));
  const hi = l1 === l0 ? l0 + 1 : l1;
  const f = ((v: number) => range[0] + ((Math.log10(Math.max(v, 1e-9)) - l0) / (hi - l0)) * (range[1] - range[0])) as Scale;
  f.ticks = Array.from({ length: hi - l0 + 1 }, (_, i) => 10 ** (l0 + i));
  f.domain = [10 ** l0, 10 ** hi];
  return f;
}

export function compact(v: number): string {
  const a = Math.abs(v);
  if (a >= 1e6) return `${+(v / 1e6).toFixed(1)}M`;
  if (a >= 1e3) return `${+(v / 1e3).toFixed(a >= 1e4 ? 0 : 1)}k`;
  return `${+v.toFixed(a < 10 ? 2 : 0)}`;
}

/** Rounded-end horizontal bar path: square at the baseline, 4px radius at the data end. */
export function hBarPath(x0: number, x1: number, y: number, h: number, r = 4): string {
  const w = Math.max(0, x1 - x0);
  const rr = Math.min(r, w, h / 2);
  return `M${x0},${y}H${x0 + w - rr}Q${x0 + w},${y} ${x0 + w},${y + rr}V${y + h - rr}Q${x0 + w},${y + h} ${x0 + w - rr},${y + h}H${x0}Z`;
}
