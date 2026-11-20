import { ALGO_COLOR, ALGO_LABEL, ALL, METRICS, fmt } from '../data/meta';
import type { AlgoId, MetricKey, Snapshot } from '../data/types';
import { Tooltip, useTip } from './Tooltip';

const RAMP = ['#16263a', '#184f95', '#2a78d6', '#6da7ec', '#b7d3f6'];

function rampColor(t: number): string {
  const x = Math.min(Math.max(t, 0), 1) * (RAMP.length - 1);
  const i = Math.min(Math.floor(x), RAMP.length - 2);
  const f = x - i;
  const a = hex(RAMP[i]);
  const b = hex(RAMP[i + 1]);
  return `rgb(${a.map((c, k) => Math.round(c + (b[k] - c) * f)).join(',')})`;
}
const hex = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

/** score 1 = best algorithm on that metric, 0 = worst (min-max normalised per column). */
export function scores(snap: Snapshot, keys: MetricKey[]): Record<AlgoId, Record<MetricKey, number>> {
  const out = {} as Record<AlgoId, Record<MetricKey, number>>;
  for (const key of keys) {
    const meta = METRICS.find((m) => m.key === key)!;
    const vals = snap.results.map((r) => r.metrics[key].mean);
    const lo = Math.min(...vals);
    const hi = Math.max(...vals);
    for (const r of snap.results) {
      const v = r.metrics[key].mean;
      const s = hi === lo ? 1 : meta.better === 'lower' ? (hi - v) / (hi - lo) : (v - lo) / (hi - lo);
      (out[r.algorithm] ??= {} as Record<MetricKey, number>)[key] = s;
    }
  }
  return out;
}

export default function TradeoffHeatmap({ snap, highlight = 'HMMGA' }: { snap: Snapshot; highlight?: AlgoId }) {
  const cols = METRICS.filter((m) => m.key !== 'averageExecutionTime');
  const sc = scores(snap, cols.map((c) => c.key));
  const rows = ALL.filter((a) => sc[a]);
  const cellW = 74;
  const cellH = 30;
  const left = 96;
  const top = 40;
  const W = left + cols.length * cellW + 4;
  const H = top + rows.length * cellH + 4;
  const { tip, show, hide } = useTip();

  return (
    <div className="chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Heatmap skor ternormalisasi per metrik">
        {cols.map((c, j) => (
          <text key={c.key} className="label" x={left + j * cellW + cellW / 2} y={top - 22} textAnchor="middle">
            {c.short}
          </text>
        ))}
        {cols.map((c, j) => (
          <text key={c.key + 'b'} className="tick" x={left + j * cellW + cellW / 2} y={top - 8} textAnchor="middle">
            {c.better === 'lower' ? '↓ baik' : '↑ baik'}
          </text>
        ))}
        {rows.map((a, i) => {
          const r = snap.results.find((x) => x.algorithm === a)!;
          const y = top + i * cellH;
          return (
            <g key={a}>
              <rect x={2} y={y + 9} width={10} height={10} rx={3} fill={ALGO_COLOR[a]} />
              <text className="label" x={18} y={y + cellH / 2 + 4} style={a === highlight ? { fill: 'var(--text-primary)', fontWeight: 600 } : undefined}>
                {ALGO_LABEL[a]}
              </text>
              {cols.map((c, j) => {
                const s = sc[a][c.key];
                const v = r.metrics[c.key].mean;
                const cx = left + j * cellW;
                return (
                  <g
                    key={c.key}
                    onMouseEnter={() =>
                      show({
                        x: cx + cellW / 2,
                        y,
                        title: `${ALGO_LABEL[a]} · ${c.label}`,
                        color: ALGO_COLOR[a],
                        rows: [
                          ['Nilai', `${fmt(v, c.digits)} ${c.unit}`],
                          ['Skor (1 = terbaik)', fmt(s, 2)],
                        ],
                      })
                    }
                    onMouseLeave={hide}
                  >
                    <rect x={cx + 1} y={y + 1} width={cellW - 2} height={cellH - 2} rx={4} fill={rampColor(s)} />
                    <text
                      x={cx + cellW / 2}
                      y={y + cellH / 2 + 4}
                      textAnchor="middle"
                      style={{ font: '600 11px var(--font-mono)', fill: s > 0.62 ? '#0b0b0b' : '#f0efec' }}
                    >
                      {short(v, c.digits)}
                    </text>
                  </g>
                );
              })}
              {a === highlight && <rect x={left} y={y + 0.5} width={cols.length * cellW} height={cellH - 1} rx={5} fill="none" stroke="#f0efec" strokeWidth={1.5} />}
            </g>
          );
        })}
      </svg>
      <Tooltip tip={tip} width={W} height={H} />
      <div className="legend" aria-hidden="true">
        <span>skor terburuk</span>
        <span style={{ width: 160, height: 10, borderRadius: 3, background: `linear-gradient(90deg, ${RAMP.join(',')})` }} />
        <span>skor terbaik (per kolom)</span>
      </div>
    </div>
  );
}

function short(v: number, digits: number): string {
  if (Math.abs(v) >= 10000) return `${(v / 1000).toFixed(1)}k`;
  if (Math.abs(v) >= 1000) return v.toFixed(0);
  return v.toFixed(Math.min(digits, Math.abs(v) < 1 ? 3 : 2));
}
