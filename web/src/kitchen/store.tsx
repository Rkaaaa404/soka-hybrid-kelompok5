import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { AlgoId, MetricKey } from '../data/types';
import { Evaluator } from '../sim/evaluator';
import { DEFAULT_LAB_PARAMS, runHmmga, type HmmgaRun } from '../sim/hmmga';
import { TASKS, VMS, planStats } from './model';

export interface GaView {
  gen: number;
  /** step inside the generation, index into GA_PHASES (4 = the finished generation) */
  phase: number;
}

export interface ArenaView {
  scale: number;
  mode: 'makespan' | MetricKey;
  algos: AlgoId[];
}

/** What the 3D world shows. Each chapter panel sets the parts it cares about. */
export interface Scene {
  plan: number[]; // VM per task, -1 = order still waiting on the board
  focusTask: number | null;
  focusVm: number | null;
  /** draw the dashed HMMGA target line over the towers (schedule comparison chapter) */
  target: boolean;
  ga: GaView | null;
  arena: ArenaView;
  celebrate: boolean;
}

interface Kitchen {
  chapter: number;
  go: (n: number) => void;
  seed: number;
  setSeed: (s: number) => void;
  run: HmmgaRun;
  ev: Evaluator;
  scene: Scene;
  setScene: (patch: Partial<Scene>) => void;
  stats: ReturnType<typeof planStats>;
  panelOpen: boolean;
  setPanelOpen: (open: boolean) => void;
  panelSize: PanelSize;
  setPanelSize: (s: PanelSize) => void;
  /** "Putar waktu": simulated clock read every frame by the 3D kitchen (t = null when not playing). */
  clock: PlayClock;
  playing: boolean;
  startPlayback: () => void;
  stopPlayback: () => void;
}

export interface PlayClock {
  t: number | null;
}

export type PanelSize = 'normal' | 'large' | 'full';

const Ctx = createContext<Kitchen | null>(null);

export const CHAPTER_COUNT = 9;

function readHash(): number {
  const m = /bab-(\d+)/.exec(window.location.hash);
  const n = m ? Number(m[1]) - 1 : 0;
  return Math.min(Math.max(n, 0), CHAPTER_COUNT - 1);
}

const ALL_ALGOS: AlgoId[] = ['HMMGA', 'HSO', 'PHS', 'CSA', 'MinMin', 'MaxMin', 'SJF', 'FCFS', 'RR'];

export function KitchenProvider({ children }: { children: ReactNode }) {
  const [chapter, setChapter] = useState(readHash);
  // seed 44: the demo run where every HMMGA stage shows up (Max-Min 227 → migration 215 → mutation 207 s)
  const [seed, setSeed] = useState(44);
  const run = useMemo(() => runHmmga(TASKS, VMS, { ...DEFAULT_LAB_PARAMS, seed }), [seed]);
  const ev = useMemo(() => new Evaluator(TASKS, VMS, run.taskOrder), [run]);
  const [scene, setSceneState] = useState<Scene>(() => ({
    plan: run.best,
    focusTask: null,
    focusVm: null,
    target: false,
    ga: null,
    arena: { scale: 5000, mode: 'makespan', algos: ALL_ALGOS },
    celebrate: false,
  }));
  const [panelOpen, setPanelOpen] = useState(true);
  const [panelSize, setPanelSize] = useState<PanelSize>('normal');

  const setScene = useCallback((patch: Partial<Scene>) => setSceneState((s) => ({ ...s, ...patch })), []);
  const go = useCallback((n: number) => {
    const next = Math.min(Math.max(n, 0), CHAPTER_COUNT - 1);
    setChapter(next);
    history.replaceState(null, '', `#bab-${next + 1}`);
  }, []);

  useEffect(() => {
    const onHash = () => setChapter(readHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const stats = useMemo(() => planStats(ev, scene.plan), [ev, scene.plan]);

  const clock = useRef<PlayClock>({ t: null }).current;
  const [playing, setPlaying] = useState(false);
  const startPlayback = useCallback(() => {
    clock.t = 0;
    setPlaying(true);
  }, [clock]);
  const stopPlayback = useCallback(() => {
    clock.t = null;
    setPlaying(false);
  }, [clock]);
  // a new plan or chapter ends the playback
  useEffect(() => stopPlayback(), [scene.plan, chapter, stopPlayback]);

  const value = useMemo<Kitchen>(
    () => ({
      chapter,
      go,
      seed,
      setSeed,
      run,
      ev,
      scene,
      setScene,
      stats,
      panelOpen,
      setPanelOpen,
      panelSize,
      setPanelSize,
      clock,
      playing,
      startPlayback,
      stopPlayback,
    }),
    [chapter, go, seed, run, ev, scene, setScene, stats, panelOpen, panelSize, clock, playing, startPlayback, stopPlayback],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useKitchen(): Kitchen {
  const k = useContext(Ctx);
  if (!k) throw new Error('useKitchen outside KitchenProvider');
  return k;
}

export { ALL_ALGOS };
