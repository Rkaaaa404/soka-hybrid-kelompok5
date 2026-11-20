import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { CHEF_COLORS, CHEF_NAMES } from './model';
import { useKitchen } from './store';

/**
 * Chapter controls. Inline in the panel while it is open; when the panel is hidden they move to the floating
 * dock above the chapter nav, so the 3D can be demonstrated without the explanation in the way.
 * `caption` shows only in the dock, `dockOnly` content only in the dock.
 */
export function Dock({ children, caption, dockOnly = false }: { children: ReactNode; caption?: ReactNode; dockOnly?: boolean }) {
  const { panelOpen } = useKitchen();
  const el = typeof document !== 'undefined' ? document.getElementById('dock') : null;
  if (panelOpen || !el) return dockOnly ? null : <>{children}</>;
  return createPortal(
    <div className="dock-inner">
      {caption && <div className="dock-caption">{caption}</div>}
      {children}
    </div>,
    el,
  );
}

export function usePlayer(max: number, initial = 0, intervalMs = 700) {
  const [pos, setPos] = useState(initial);
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    if (!playing) return;
    if (pos >= max) {
      setPlaying(false);
      return;
    }
    const t = setTimeout(() => setPos((p) => Math.min(max, p + 1)), intervalMs);
    return () => clearTimeout(t);
  }, [playing, pos, max, intervalMs]);
  return { pos, setPos, playing, setPlaying, max };
}

export function Player({ p, label }: { p: ReturnType<typeof usePlayer>; label: string }) {
  const { pos, setPos, playing, setPlaying, max } = p;
  return (
    <div className="player">
      <button className="icon-btn" onClick={() => setPos(Math.max(0, pos - 1))} aria-label="Mundur satu langkah">
        ‹
      </button>
      <button
        className="btn primary"
        onClick={() => {
          if (pos >= max) setPos(0);
          setPlaying(!playing);
        }}
      >
        {playing ? 'Jeda' : pos >= max ? 'Ulangi' : 'Putar'}
      </button>
      <button className="icon-btn" onClick={() => setPos(Math.min(max, pos + 1))} aria-label="Maju satu langkah">
        ›
      </button>
      <input type="range" min={0} max={max} value={pos} onChange={(e) => setPos(Number(e.target.value))} aria-label={label} />
      <span className="mono muted counter">
        {pos}/{max}
      </span>
    </div>
  );
}

export function SeedPicker() {
  const { seed, setSeed } = useKitchen();
  return (
    <div className="segmented small" role="group" aria-label="Seed">
      {[42, 43, 44].map((s) => (
        <button key={s} aria-pressed={seed === s} onClick={() => setSeed(s)}>
          seed {s}
        </button>
      ))}
    </div>
  );
}

export function Sparkline({ values, cursor, baseline, lb }: { values: number[]; cursor: number; baseline: number; lb: number }) {
  const W = 400;
  const H = 120;
  const lo = Math.min(lb, ...values) * 0.97;
  const hi = Math.max(baseline, ...values) * 1.02;
  const x = (i: number) => 10 + (i / Math.max(1, values.length - 1)) * (W - 20);
  const y = (v: number) => H - 16 - ((v - lo) / (hi - lo)) * (H - 30);
  return (
    <div className="chart spark">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Makespan rencana terbaik per generasi">
        <line x1={10} x2={W - 10} y1={y(baseline)} y2={y(baseline)} stroke="#c3c2b7" strokeDasharray="4 4" />
        <text className="tick" x={W - 10} y={y(baseline) - 5} textAnchor="end">
          Max-Min {Math.round(baseline)} s
        </text>
        <line x1={10} x2={W - 10} y1={y(lb)} y2={y(lb)} stroke="#5ec8ff" strokeDasharray="2 4" />
        <text className="tick" x={14} y={y(lb) - 5} textAnchor="start" style={{ fill: '#5ec8ff' }}>
          batas tercepat {Math.round(lb)} s
        </text>
        <path d={values.map((v, i) => `${i ? 'L' : 'M'}${x(i)},${y(v)}`).join('')} fill="none" stroke="#3987e5" strokeWidth={2} />
        <circle cx={x(cursor)} cy={y(values[cursor])} r={5} fill="#3987e5" stroke="#1a1a19" strokeWidth={2} />
        <text className="tick" x={10} y={H - 2}>
          gen 0
        </text>
        <text className="tick" x={W - 10} y={H - 2} textAnchor="end">
          gen {values.length - 1}
        </text>
      </svg>
    </div>
  );
}

export function Stat({ label, value, tone }: { label: string; value: ReactNode; tone?: 'blue' | 'red' | 'gold' }) {
  return (
    <div className={`kstat${tone ? ` ${tone}` : ''}`}>
      <span className="kstat-v">{value}</span>
      <span className="kstat-l">{label}</span>
    </div>
  );
}

export function Cite({ text, doi, pdf }: { text: string; doi?: string; pdf: string }) {
  return (
    <p className="ref">
      {text}{' '}
      {doi && (
        <a href={`https://doi.org/${doi}`} target="_blank" rel="noreferrer">
          doi:{doi}
        </a>
      )}{' '}
      ·{' '}
      <a href={`${import.meta.env.BASE_URL}papers/${pdf}`} target="_blank" rel="noreferrer">
        PDF
      </a>
    </p>
  );
}

/** One chromosome as a row of 30 cells (cell k = order #k, colour = chef). Used to explain crossover and mutation. */
export function GeneStrip({
  genes,
  label,
  color,
  ms,
  cut,
  dim,
  marks,
}: {
  genes: number[];
  label: ReactNode;
  color?: string;
  ms?: number;
  cut?: [number, number];
  /** fade the genes inside or outside the cut (the part a parent did not pass on) */
  dim?: 'in' | 'out';
  marks?: number[];
}) {
  const mk = new Set(marks ?? []);
  return (
    <div className="gstrip">
      <span className="gs-label" style={color ? { borderLeftColor: color } : undefined}>
        {label}
      </span>
      <div className="gs-cells">
        {genes.map((v, k) => {
          const inCut = !!cut && k >= cut[0] && k <= cut[1];
          const faded = (dim === 'in' && inCut) || (dim === 'out' && cut && !inCut);
          return (
            <i
              key={k}
              className={`${inCut ? 'in-cut' : ''}${faded ? ' faded' : ''}${mk.has(k) ? ' mark' : ''}`}
              style={{ background: CHEF_COLORS[v] }}
              title={`Pesanan #${k} → ${CHEF_NAMES[v]}`}
            />
          );
        })}
      </div>
      <span className="gs-ms">{ms !== undefined ? `${Math.round(ms)} s` : ''}</span>
    </div>
  );
}

export function GeneRuler() {
  return (
    <div className="gstrip ruler" aria-hidden>
      <span className="gs-label">pesanan</span>
      <div className="gs-cells">
        {Array.from({ length: 30 }, (_, k) => (
          <b key={k}>{k % 5 === 0 ? `#${k}` : ''}</b>
        ))}
      </div>
      <span className="gs-ms" />
    </div>
  );
}

export function ChefLegend() {
  return (
    <div className="chef-legend">
      {CHEF_NAMES.map((n, v) => (
        <span key={n}>
          <i style={{ background: CHEF_COLORS[v] }} />
          {n}
        </span>
      ))}
    </div>
  );
}
