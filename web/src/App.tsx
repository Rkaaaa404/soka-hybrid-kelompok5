import { useEffect, type ComponentType } from 'react';
import { Competition, Conclusion, Tradeoff } from './kitchen/chapters/results';
import { GaChapter, Intro, KitchenIntro, MaxMinChapter, MigrationChapter, Selection } from './kitchen/chapters/story';
import { LAB_LB, fmtS } from './kitchen/model';
import { CHAPTER_COUNT, KitchenProvider, useKitchen, type PanelSize } from './kitchen/store';
import World from './kitchen/three/World';

interface Chapter {
  short: string;
  title: string;
  Panel: ComponentType;
  kitchen: boolean;
}

const CHAPTERS: Chapter[] = [
  { short: 'Sambutan', title: 'Selamat datang di Cloud Kitchen', Panel: Intro, kitchen: true },
  { short: 'Seleksi', title: 'HSO vs HMMGA', Panel: Selection, kitchen: false },
  { short: 'Dapur', title: 'Dapur = datacenter', Panel: KitchenIntro, kitchen: true },
  { short: 'Max-Min', title: 'Tahap 1 · Max-Min', Panel: MaxMinChapter, kitchen: true },
  { short: 'GA', title: 'Tahap 2 · Genetic Algorithm', Panel: GaChapter, kitchen: true },
  { short: 'Migrasi', title: 'Tahap 3 · Migrasi beban', Panel: MigrationChapter, kitchen: true },
  { short: 'Kompetisi', title: 'Hasil CloudSim', Panel: Competition, kitchen: false },
  { short: 'Trade-off', title: 'Trade-off', Panel: Tradeoff, kitchen: false },
  { short: 'Kesimpulan', title: 'Kesimpulan', Panel: Conclusion, kitchen: false },
];

if (CHAPTERS.length !== CHAPTER_COUNT) throw new Error('chapter count mismatch');

function Shell() {
  const { chapter, go, stats, panelOpen, setPanelOpen, panelSize, setPanelSize, scene } = useKitchen();
  const toggleSize = (s: PanelSize) => {
    if (!panelOpen) {
      setPanelOpen(true);
      setPanelSize(s);
      return;
    }
    setPanelSize(panelSize === s ? 'normal' : s);
  };
  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen?.();
  };
  const ch = CHAPTERS[chapter];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el.closest('input, textarea, select, [contenteditable="true"]')) return;
      if (e.key === 'ArrowRight' || e.key === 'PageDown') go(chapter + 1);
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp') go(chapter - 1);
      else if (e.key === 'Home') go(0);
      else if (e.key === 'End') go(CHAPTER_COUNT - 1);
      else if (e.key.toLowerCase() === 'h') setPanelOpen(!panelOpen);
      else if (e.key.toLowerCase() === 'f') toggleSize('full');
      else if (e.key.toLowerCase() === 'b') toggleSize('large');
      else if (e.key === 'Escape' && panelSize !== 'normal') setPanelSize('normal');
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const pending = scene.plan.some((v) => v < 0);

  return (
    <div className={`shell${panelOpen ? '' : ' panel-closed'} size-${panelSize}`}>
      <header className="hud">
        <div className="brand">
          <svg viewBox="0 0 32 32" aria-hidden>
            <path d="M6 15a10 10 0 0 1 20 0z" fill="#f0b429" />
            <rect x="4" y="15" width="24" height="4" rx="2" fill="#f7efe0" />
            <rect x="9" y="19" width="14" height="7" rx="2" fill="#3987e5" />
          </svg>
          <div>
            <b>Cloud Kitchen</b>
            <span>HMMGA · Tugas 7 SOKA</span>
          </div>
        </div>
        <div className="hud-right">
          {ch.kitchen && stats.placements.length > 0 && (
            <div className="clock" aria-live="polite">
              <span className="clock-ico">⏰</span>
              <div>
                <b>{pending ? '…' : fmtS(stats.makespan)}</b>
                <span>makespan dapur · batas {fmtS(LAB_LB)}</span>
              </div>
            </div>
          )}
          <button className="hud-btn" onClick={toggleFullscreen} title="Layar penuh browser" aria-label="Layar penuh browser">
            <svg viewBox="0 0 24 24" aria-hidden>
              <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </header>

      <aside className={`panel size-${panelSize}${panelOpen ? '' : ' closed'}`} aria-label={ch.title}>
        <div className="panel-tools">
          {!panelOpen && (
            <button className="pt-btn show" onClick={() => setPanelOpen(true)} aria-expanded={false} title="Tampilkan penjelasan (H)">
              ☰ Tampilkan penjelasan <kbd>H</kbd>
            </button>
          )}
          <button className="pt-btn" aria-pressed={panelOpen && panelSize === 'large'} onClick={() => toggleSize('large')} title="Perbesar panel dan teks (B)">
            A+ besar <kbd>B</kbd>
          </button>
          <button className="pt-btn" aria-pressed={panelOpen && panelSize === 'full'} onClick={() => toggleSize('full')} title="Mode baca layar penuh (F)">
            <svg className="pt-ico" viewBox="0 0 24 24" aria-hidden>
              <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
            </svg>
            penuh <kbd>F</kbd>
          </button>
          {panelOpen && (
            <button className="pt-btn" onClick={() => setPanelOpen(false)} aria-expanded title="Sembunyikan penjelasan (H)">
              ‹ sembunyikan <kbd>H</kbd>
            </button>
          )}
        </div>
        <div className="panel-body" key={chapter}>
          <ch.Panel />
        </div>
      </aside>

      <div id="dock" className="dock" aria-label="Kontrol bab" />

      <nav className="chapter-nav" aria-label="Bab">
        <button className="icon-btn" onClick={() => go(chapter - 1)} disabled={chapter === 0} aria-label="Bab sebelumnya">
          ‹
        </button>
        <ol>
          {CHAPTERS.map((c, i) => (
            <li key={c.short}>
              <button aria-current={i === chapter ? 'step' : undefined} className={i < chapter ? 'done' : undefined} onClick={() => go(i)} title={c.title}>
                <span className="n">{i + 1}</span>
                <span className="t">{c.short}</span>
              </button>
            </li>
          ))}
        </ol>
        <button className="icon-btn primary" onClick={() => go(chapter + 1)} disabled={chapter === CHAPTER_COUNT - 1} aria-label="Bab berikutnya">
          ›
        </button>
      </nav>
    </div>
  );
}

export default function App() {
  return (
    <KitchenProvider>
      <World />
      <Shell />
    </KitchenProvider>
  );
}
