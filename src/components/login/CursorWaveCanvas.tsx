import React, { useEffect, useRef } from 'react';

const IDLE_SCALE = 0.08;
const PEAK_SCALE = 0.5;
const ATTACK_SECONDS = 0.4;
const RELEASE_SECONDS = 0.6;
const BURST_SPEED = 1200;
const BURST_THICKNESS = 160;
const ORBIT_MS = 8000;
const NAVY = '8, 11, 83';
const MUTED = '59, 64, 102';

type Cell = {
  x: number;
  y: number;
  idleRadius: number;
  peakRadius: number;
  idleAlpha: number;
  rgb: string;
  radius: number;
  alpha: number;
};

function mediaMatches(query: string): boolean {
  return window.matchMedia(query).matches;
}

export const CursorWaveCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    if (!context) return;

    const reduceMotion = mediaMatches('(prefers-reduced-motion: reduce)');
    const coarsePointer = mediaMatches('(pointer: coarse)');
    let cells: Cell[] = [];
    let width = 0;
    let height = 0;
    let cellSize = 32;
    let frame = 0;
    let running = true;
    let pointerX = -9999;
    let pointerY = -9999;
    let pointerInside = false;
    let ring: { x: number; y: number; started: number } | null = null;
    let last = performance.now();
    let resizeTimer = 0;

    const layout = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      cellSize = width > 2560 ? 40 : 32;
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(width * ratio);
      canvas.height = Math.floor(height * ratio);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      cells = [];
      for (let y = cellSize / 2; y < height; y += cellSize) {
        for (let x = cellSize / 2; x < width; x += cellSize) {
          const roll = Math.random();
          const idleJitter = 0.8 + Math.random() * 0.4;
          const peakJitter = 0.85 + Math.random() * 0.3;
          let idleAlpha = 0.14;
          let rgb = NAVY;
          if (roll < 0.05) {
            idleAlpha = 0.12;
            rgb = MUTED;
          } else if (roll < 0.2) {
            idleAlpha = 0.1;
          }
          const idleRadius = cellSize * IDLE_SCALE * idleJitter;
          const peakRadius = (cellSize / 2) * PEAK_SCALE * peakJitter;
          cells.push({
            x,
            y,
            idleRadius,
            peakRadius,
            idleAlpha,
            rgb,
            radius: idleRadius,
            alpha: idleAlpha,
          });
        }
      }
    };

    const influencePoint = (now: number) => {
      if (coarsePointer) {
        const angle = ((now % ORBIT_MS) / ORBIT_MS) * Math.PI * 2;
        return {
          x: width / 2 + Math.cos(angle) * width * 0.28,
          y: height / 2 + Math.sin(angle) * height * 0.22,
        };
      }
      if (!pointerInside) return null;
      return { x: pointerX, y: pointerY };
    };

    const influenceFor = (cell: Cell, now: number) => {
      let influence = 0;
      const point = influencePoint(now);
      if (point) {
        const distance = Math.hypot(cell.x - point.x, cell.y - point.y);
        const reach = 0.14 * Math.min(width, height);
        if (distance < reach) {
          const falloff = distance / reach;
          influence = 1 - falloff * falloff;
        }
      }
      if (ring) {
        const elapsed = (now - ring.started) / 1000;
        const ringRadius = BURST_SPEED * elapsed;
        const distance = Math.hypot(cell.x - ring.x, cell.y - ring.y);
        if (Math.abs(distance - ringRadius) <= BURST_THICKNESS / 2) {
          influence = 1;
        }
        if (ringRadius > Math.hypot(width, height) + BURST_THICKNESS) {
          ring = null;
        }
      }
      return influence;
    };

    const paint = (now: number) => {
      context.fillStyle = '#FFFFFF';
      context.fillRect(0, 0, width, height);
      const dt = reduceMotion ? 1 : Math.min(0.05, (now - last) / 1000);
      last = now;
      for (const cell of cells) {
        const influence = reduceMotion ? 0 : influenceFor(cell, now);
        const targetRadius = cell.idleRadius + (cell.peakRadius - cell.idleRadius) * influence;
        const targetAlpha = cell.idleAlpha + (0.5 - cell.idleAlpha) * influence;
        const constant = targetRadius > cell.radius ? ATTACK_SECONDS : RELEASE_SECONDS;
        const step = reduceMotion ? 1 : 1 - Math.exp(-dt / constant);
        cell.radius += (targetRadius - cell.radius) * step;
        cell.alpha += (targetAlpha - cell.alpha) * step;
        const height = cell.radius * 2;
        const thickness = height * (9 / 12);
        const shear = height * (7 / 12);
        const top = cell.y - height / 2;
        const bottom = cell.y + height / 2;
        const half = thickness / 2;
        context.beginPath();
        context.fillStyle = `rgba(${cell.rgb}, ${cell.alpha})`;
        context.moveTo(cell.x - half + shear / 2, top);
        context.lineTo(cell.x + half + shear / 2, top);
        context.lineTo(cell.x + half - shear / 2, bottom);
        context.lineTo(cell.x - half - shear / 2, bottom);
        context.closePath();
        context.fill();
      }
    };

    const onMove = (event: PointerEvent) => {
      pointerX = event.clientX;
      pointerY = event.clientY;
      pointerInside = true;
    };
    const onLeave = () => {
      pointerInside = false;
    };
    const onDown = (event: PointerEvent) => {
      ring = { x: event.clientX, y: event.clientY, started: performance.now() };
    };
    const draw = () => {
      if (!running || document.hidden) return;
      paint(performance.now());
      frame = window.requestAnimationFrame(draw);
    };
    const onVisibility = () => {
      if (document.hidden) {
        running = false;
        window.cancelAnimationFrame(frame);
        return;
      }
      if (reduceMotion) return;
      running = true;
      last = performance.now();
      frame = window.requestAnimationFrame(draw);
    };
    const onResize = () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        last = performance.now();
        layout();
      }, 200);
    };

    layout();
    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(onResize);
      observer.observe(document.documentElement);
    }
    window.addEventListener('resize', onResize);

    if (reduceMotion) {
      paint(performance.now());
    } else {
      if (!coarsePointer) {
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerleave', onLeave);
      }
      window.addEventListener('pointerdown', onDown);
      document.addEventListener('visibilitychange', onVisibility);
      frame = window.requestAnimationFrame(draw);
    }

    return () => {
      running = false;
      window.cancelAnimationFrame(frame);
      window.clearTimeout(resizeTimer);
      observer?.disconnect();
      window.removeEventListener('resize', onResize);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerleave', onLeave);
      window.removeEventListener('pointerdown', onDown);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none fixed inset-0 z-0"
      style={{ pointerEvents: 'none' }}
      aria-hidden="true"
      data-testid="cursor-wave"
    />
  );
};
