import { ALGO_COLOR, ALGO_LABEL, ALL, LOWER_BOUND, fmt } from '../data/meta';
import type { AlgoId, Snapshot } from '../data/types';
import { compact, hBarPath, linear } from './scale';
import { Tooltip, useTip } from './Tooltip';

/**
 * One small-multiple panel: horizontal makespan bars (mean of 3 runs) sorted best-first, ±1 SD whisker,
 * the 3 individual runs as dots, and the theoretical lower bound as a dashed reference line.
 */
export default function MakespanBars({ snap, highlight = 'HMMGA' }: { snap: Snapshot; highlight?: AlgoId }) {
  const n = snap.scenario.taskCount;
  const lb = LOWER_BOUND[n];
  const rows = ALL.map((a) => snap.results.find((r) => r.algorithm === a)!)
    .filter(Boolean)
    .sort((a, b) => a.metrics.makespan.mean - b.metrics.makespan.mean);

  const W = 420;
  const rowH = 26;
  const top = 8;
  const left = 82;
  const right = 64;
  const H = top + rows.length * rowH + 30;
  const max = Math.max(...rows.map((r) => r.metrics.makespan.mean + r.metrics.makespan.stddev));
  const x = linear([0, max], [left, W - right], 4);
  const { tip, show, hide } = useTip();

  return (
    <div className="chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Makespan ${n} task, rata-rata 3 run`}>
        {x.ticks.map((t) => (
          <g key={t}>
            <line className="gridline" x1={x(t)} x2={x(t)} y1={top} y2={H - 26} />
            <text className="tick" x={x(t)} y={H - 10} textAnchor="middle">
              {compact(t)}
            </text>
          </g>
        ))}
        <line className="axis-line" x1={left} x2={left} y1={top} y2={H - 26} />
        {lb && (
          <g>
            <line x1={x(lb)} x2={x(lb)} y1={top - 4} y2={H - 26} stroke="#c3c2b7" strokeDasharray="3 3" strokeWidth={1} />
          </g>
        )}
        {rows.map((r, i) => {
          const y = top + i * rowH + 5;
          const h = rowH - 10;
          const m = r.metrics.makespan;
          const isHl = r.algorithm === highlight;
          const atLb = lb !== undefined && Math.abs(m.mean - lb) < 0.5;
          const runs = r.runMetrics?.map((rm) => rm.metrics.makespan) ?? [];
          return (
            <g
              key={r.algorithm}
              onMouseEnter={() =>
                show({
                  x: x(m.mean),
                  y,
                  title: ALGO_LABEL[r.algorithm],
                  color: ALGO_COLOR[r.algorithm],
                  rows: [
                    ['Mean', `${fmt(m.mean)} s`],
                    ['SD (3 run)', `${fmt(m.stddev)} s`],
                    ...(runs.length ? ([['Per run', runs.map((v) => fmt(v, 0)).join(' · ')]] as [string, string][]) : []),
                    ['vs batas bawah', `+${fmt((m.mean / lb - 1) * 100, 1)}%`],
                  ],
                })
              }
              onMouseLeave={hide}
            >
              <rect x={0} y={y - 5} width={W} height={rowH} fill="transparent" />
              <text className="label" x={left - 8} y={y + h / 2 + 4} textAnchor="end" style={isHl ? { fill: 'var(--text-primary)', fontWeight: 600 } : undefined}>
                {ALGO_LABEL[r.algorithm]}
              </text>
              <path d={hBarPath(left, x(m.mean), y, h)} fill={ALGO_COLOR[r.algorithm]} opacity={isHl ? 1 : 0.82} />
              {m.stddev > 0 && (
                <line x1={x(m.mean - m.stddev)} x2={x(m.mean + m.stddev)} y1={y + h / 2} y2={y + h / 2} stroke="#f0efec" strokeWidth={1.5} />
              )}
              {runs.map((v, k) => (
                <circle key={k} cx={x(v)} cy={y + h / 2} r={2.6} fill="#f0efec" stroke="#1a1a19" strokeWidth={1} />
              ))}
              <text className="value-label" x={x(m.mean + m.stddev) + 6} y={y + h / 2 + 4}>
                {compact(m.mean)}
                {atLb ? ' ★' : ''}
              </text>
            </g>
          );
        })}
      </svg>
      <Tooltip tip={tip} width={W} height={H} />
    </div>
  );
}
