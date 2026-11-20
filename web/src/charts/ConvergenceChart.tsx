import { useMemo, useState } from 'react';
import { ALGO_COLOR, ALGO_LABEL, fmt } from '../data/meta';
import type { AlgoId } from '../data/types';
import { compact, linear, log10 } from './scale';
import { Tooltip, useTip } from './Tooltip';

export interface Series {
  algo: AlgoId;
  values: number[];
}

interface Props {
  series: Series[];
  lowerBound?: number;
  height?: number;
  logY?: boolean;
  xLabel?: string;
}

/** Best-so-far makespan per iteration (2px lines, crosshair tooltip, toggleable legend). */
export default function ConvergenceChart({ series, lowerBound, height = 260, logY = false, xLabel = 'iterasi / generasi' }: Props) {
  const [hidden, setHidden] = useState<Set<AlgoId>>(new Set());
  const [hoverX, setHoverX] = useState<number | null>(null);
  const { tip, show, hide } = useTip();
  const W = 560;
  const H = height;
  const pad = { l: 52, r: 16, t: 12, b: 34 };
  const visible = series.filter((s) => !hidden.has(s.algo) && s.values.length);
  const maxLen = Math.max(1, ...series.map((s) => s.values.length));
  const all = visible.flatMap((s) => s.values);
  const lo = Math.min(...all, lowerBound ?? Infinity);
  const hi = Math.max(...all);
  const x = linear([0, maxLen], [pad.l, W - pad.r], 5, false);
  const y = useMemo(
    () => (logY ? log10([lo * 0.95, hi * 1.05], [H - pad.b, pad.t]) : linear([lo * 0.97, hi * 1.02], [H - pad.b, pad.t], 4)),
    [logY, lo, hi, H, pad.b, pad.t],
  );
  const xTicks = linear([0, maxLen], [0, 1], 5).ticks.filter((t) => t <= maxLen);

  const onMove = (e: React.MouseEvent<SVGRectElement>) => {
    const box = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
    const px = ((e.clientX - box.left) / box.width) * W;
    const it = Math.round(((px - pad.l) / (W - pad.l - pad.r)) * maxLen);
    const i = Math.min(Math.max(it, 1), maxLen);
    setHoverX(i);
    show({
      x: x(i),
      y: pad.t + 10,
      title: `Iterasi ${i}`,
      rows: visible
        .filter((s) => s.values.length >= i)
        .map((s) => [ALGO_LABEL[s.algo], `${fmt(s.values[i - 1], 1)} s`] as [string, string]),
    });
  };

  return (
    <div>
      <div className="chart">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Kurva konvergensi best makespan per iterasi">
          {y.ticks.map((t) => (
            <g key={t}>
              <line className="gridline" x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} />
              <text className="tick" x={pad.l - 8} y={y(t) + 4} textAnchor="end">
                {compact(t)}
              </text>
            </g>
          ))}
          {xTicks.map((t) => (
            <text key={t} className="tick" x={x(t)} y={H - pad.b + 16} textAnchor="middle">
              {t}
            </text>
          ))}
          <text className="tick" x={W - pad.r} y={H - 4} textAnchor="end">
            {xLabel}
          </text>
          {lowerBound && lowerBound >= y.domain[0] && (
            <g>
              <line x1={pad.l} x2={W - pad.r} y1={y(lowerBound)} y2={y(lowerBound)} stroke="#c3c2b7" strokeDasharray="4 4" />
              <text className="label" x={W - pad.r - 4} y={y(lowerBound) - 5} textAnchor="end">
                batas bawah {compact(lowerBound)}
              </text>
            </g>
          )}
          {visible.map((s) => (
            <path
              key={s.algo}
              d={s.values.map((v, i) => `${i ? 'L' : 'M'}${x(i + 1).toFixed(1)},${y(v).toFixed(1)}`).join('')}
              fill="none"
              stroke={ALGO_COLOR[s.algo]}
              strokeWidth={2}
              strokeLinejoin="round"
            />
          ))}
          {hoverX !== null && (
            <g>
              <line x1={x(hoverX)} x2={x(hoverX)} y1={pad.t} y2={H - pad.b} stroke="#8f8e86" strokeWidth={1} />
              {visible
                .filter((s) => s.values.length >= hoverX)
                .map((s) => (
                  <circle key={s.algo} cx={x(hoverX)} cy={y(s.values[hoverX - 1])} r={4} fill={ALGO_COLOR[s.algo]} stroke="#1a1a19" strokeWidth={2} />
                ))}
            </g>
          )}
          <rect
            x={pad.l}
            y={pad.t}
            width={W - pad.l - pad.r}
            height={H - pad.t - pad.b}
            fill="transparent"
            onMouseMove={onMove}
            onMouseLeave={() => {
              setHoverX(null);
              hide();
            }}
          />
        </svg>
        <Tooltip tip={tip} width={W} height={H} />
      </div>
      <div className="legend" role="group" aria-label="Tampilkan atau sembunyikan seri">
        {series.map((s) => (
          <button
            key={s.algo}
            className="btn"
            style={{ padding: '3px 9px', opacity: hidden.has(s.algo) ? 0.45 : 1 }}
            aria-pressed={!hidden.has(s.algo)}
            onClick={() =>
              setHidden((h) => {
                const n = new Set(h);
                if (n.has(s.algo)) n.delete(s.algo);
                else n.add(s.algo);
                return n;
              })
            }
          >
            <span className="swatch" style={{ background: ALGO_COLOR[s.algo] }} />
            {ALGO_LABEL[s.algo]}
          </button>
        ))}
      </div>
    </div>
  );
}
