import { ALGO_COLOR, ALGO_LABEL, FOCUS, LOWER_BOUND, fmt } from '../data/meta';
import type { Snapshot } from '../data/types';
import { compact, linear, log10 } from './scale';
import { Tooltip, useTip } from './Tooltip';

interface Box {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

const overlaps = (a: Box, b: Box) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;

/**
 * Quality vs cost of deciding: x = scheduling time (log ms), y = makespan gap above the lower bound.
 * Outliers far above the rest are pinned to the top edge (▲ + their value) so the cluster stays readable.
 * Every point is direct-labelled with greedy collision avoidance (secondary encoding for colour).
 */
export default function ScatterTradeoff({ snap }: { snap: Snapshot }) {
  const lb = LOWER_BOUND[snap.scenario.taskCount];
  const pts = snap.results.map((r) => ({
    algo: r.algorithm,
    x: Math.max(1, r.metrics.schedulingTime.mean),
    y: (r.metrics.makespan.mean / lb - 1) * 100,
    ms: r.metrics.makespan.mean,
  }));
  const W = 520;
  const H = 300;
  const pad = { l: 54, r: 24, t: 30, b: 40 };
  const x = log10([Math.min(...pts.map((p) => p.x)), Math.max(...pts.map((p) => p.x))], [pad.l, W - pad.r]);
  const inliers = pts.filter((p) => p.y < 100).map((p) => p.y);
  const cap = Math.max(10, (inliers.length ? Math.max(...inliers) : 100) * 1.15);
  const y = linear([0, cap], [H - pad.b, pad.t], 5);
  const { tip, show, hide } = useTip();

  const placed: Box[] = [];
  const marks = [...pts]
    .sort((a, b) => Number(FOCUS.includes(b.algo)) - Number(FOCUS.includes(a.algo)) || a.y - b.y)
    .map((p) => {
      const out = p.y > cap;
      const cx = x(p.x);
      const cy = out ? pad.t - 12 : y(p.y);
      const focus = FOCUS.includes(p.algo);
      const text = out ? `${ALGO_LABEL[p.algo]} +${compact(p.y)}%` : ALGO_LABEL[p.algo];
      const w = text.length * (focus ? 6.6 : 6.1) + 2;
      const candidates: [number, number, 'start' | 'end'][] = [
        [9, -7, 'start'],
        [9, 13, 'start'],
        [-9, -7, 'end'],
        [-9, 13, 'end'],
        [9, -19, 'start'],
        [9, 25, 'start'],
        [-9, -19, 'end'],
        [-9, 25, 'end'],
      ];
      let choice = candidates[0];
      let box: Box | null = null;
      for (const c of candidates) {
        const bx = c[2] === 'start' ? cx + c[0] : cx + c[0] - w;
        const b = { x0: bx, x1: bx + w, y0: cy + c[1] - 10, y1: cy + c[1] + 2 };
        const inside = b.x0 >= 2 && b.x1 <= W - 2 && b.y0 >= 0;
        if (inside && !placed.some((o) => overlaps(o, b))) {
          choice = c;
          box = b;
          break;
        }
      }
      if (!box) {
        const bx = cx + 9;
        box = { x0: bx, x1: bx + w, y0: cy - 17, y1: cy - 5 };
      }
      placed.push(box, { x0: cx - 6, x1: cx + 6, y0: cy - 6, y1: cy + 6 });
      return { p, out, cx, cy, focus, text, choice };
    })
    .reverse(); // baselines first so focus points draw on top

  return (
    <div className="chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Scatter makespan terhadap scheduling time">
        {y.ticks.map((t) => (
          <g key={t}>
            <line className="gridline" x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} />
            <text className="tick" x={pad.l - 8} y={y(t) + 4} textAnchor="end">
              +{compact(t)}%
            </text>
          </g>
        ))}
        {x.ticks.map((t) => (
          <g key={t}>
            <line className="gridline" x1={x(t)} x2={x(t)} y1={pad.t} y2={H - pad.b} />
            <text className="tick" x={x(t)} y={H - pad.b + 16} textAnchor="middle">
              {compact(t)} ms
            </text>
          </g>
        ))}
        <line x1={pad.l} x2={W - pad.r} y1={pad.t - 4} y2={pad.t - 4} stroke="#4a4a46" strokeDasharray="2 4" />
        <text className="tick" x={W - pad.r} y={H - 4} textAnchor="end">
          scheduling time (log) →
        </text>
        <text className="tick" x={pad.l - 8} y={H - 4} textAnchor="start">
          ↑ gap ke batas bawah
        </text>
        {marks.map(({ p, out, cx, cy, focus, text, choice }) => (
          <g
            key={p.algo}
            onMouseEnter={() =>
              show({
                x: cx,
                y: Math.max(cy, pad.t),
                title: ALGO_LABEL[p.algo],
                color: ALGO_COLOR[p.algo],
                rows: [
                  ['Makespan', `${fmt(p.ms)} s`],
                  ['Gap ke batas bawah', `+${fmt(p.y, 1)}%`],
                  ['Scheduling time', `${fmt(p.x, 0)} ms`],
                ],
              })
            }
            onMouseLeave={hide}
          >
            <circle cx={cx} cy={cy} r={14} fill="transparent" />
            {out ? (
              <path d={`M${cx},${cy - 6} L${cx + 6},${cy + 5} L${cx - 6},${cy + 5} Z`} fill={ALGO_COLOR[p.algo]} stroke="#1a1a19" strokeWidth={2} />
            ) : (
              <circle cx={cx} cy={cy} r={focus ? 6 : 4.5} fill={ALGO_COLOR[p.algo]} stroke="#1a1a19" strokeWidth={2} />
            )}
            <text
              className="label"
              x={cx + choice[0]}
              y={cy + choice[1]}
              textAnchor={choice[2]}
              style={focus ? { fill: 'var(--text-primary)', fontWeight: 600 } : undefined}
            >
              {text}
            </text>
          </g>
        ))}
      </svg>
      <Tooltip tip={tip} width={W} height={H} />
    </div>
  );
}
