import { useState, type ReactNode } from 'react';

export interface TipState {
  x: number;
  y: number;
  title: ReactNode;
  color?: string;
  rows: [string, string][];
}

export function useTip() {
  const [tip, setTip] = useState<TipState | null>(null);
  return { tip, show: setTip, hide: () => setTip(null) };
}

/** Positions in % of the chart box so it follows responsive SVG scaling. */
export function Tooltip({ tip, width, height }: { tip: TipState | null; width: number; height: number }) {
  if (!tip) return null;
  return (
    <div className="tooltip" style={{ left: `${(tip.x / width) * 100}%`, top: `${(tip.y / height) * 100}%` }} role="status">
      <div className="tt-title">
        {tip.color && <span className="swatch" style={{ background: tip.color }} />}
        {tip.title}
      </div>
      {tip.rows.map(([k, v]) => (
        <div className="tt-row" key={k}>
          <span>{k}</span>
          <b>{v}</b>
        </div>
      ))}
    </div>
  );
}
