'use client';
import React, { useEffect, useRef, useState } from 'react';

// Lightweight two-pane canvas HedgeChart (no external deps)
// Props: data = { timestamps: number[], values: number[] }
export default function HedgeChart({ data, topHeight = 360, bottomHeight = 160 }) {
  const topRef = useRef(null);
  const bottomRef = useRef(null);
  const containerRef = useRef(null);

  const timestamps = data?.timestamps || [];
  const values = data?.values || [];

  // view window in indices
  const N = timestamps.length;
  const initialWindow = Math.min(500, N || 500);
  const [view, setView] = useState({ start: Math.max(0, N - initialWindow), end: N - 1 });

  useEffect(() => {
    const newN = timestamps.length;
    const newWindow = Math.min(500, newN || 500);
    setView({ start: Math.max(0, newN - newWindow), end: newN - 1 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const drawPane = (canvas, ts, vals, start, end, opts = {}) => {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    ctx.clearRect(0, 0, width, height);
    if (!ts.length || !vals.length) return;
    const s = Math.max(0, start);
    const e = Math.min(vals.length - 1, end);
    if (e - s < 1) return;
    const xs = ts.slice(s, e + 1).map(x => x * 1000);
    const ys = vals.slice(s, e + 1);

    const xmin = xs[0];
    const xmax = xs[xs.length - 1];
    let ymin = ys[0], ymax = ys[0];
    for (let v of ys) { if (v < ymin) ymin = v; if (v > ymax) ymax = v; }
    const pad = (ymax - ymin) * 0.05 || 1;
    ymin -= pad; ymax += pad;

    // background
    ctx.fillStyle = '#071022';
    ctx.fillRect(0, 0, width, height);

    // grid
    ctx.strokeStyle = '#0f3350';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = (i / 4) * height;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
    }

    // line
    ctx.strokeStyle = opts.color || '#4fd1c5';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    const sx = t => ((t - xmin) / (xmax - xmin || 1)) * width;
    const sy = v => height - ((v - ymin) / (ymax - ymin || 1)) * height;
    ctx.moveTo(sx(xs[0]), sy(ys[0]));
    for (let i = 1; i < xs.length; i++) ctx.lineTo(sx(xs[i]), sy(ys[i]));
    ctx.stroke();

    // labels
    ctx.fillStyle = '#9fb6d6'; ctx.font = '12px sans-serif';
    ctx.fillText(ymax.toFixed(2), 6, 14);
    ctx.fillText(ymin.toFixed(2), 6, height - 6);
    const timeFmt = ts => new Date(ts).toISOString().slice(0, 19).replace('T', ' ');
    ctx.fillText(timeFmt(xs[0]), 6, 26);
    ctx.fillText(timeFmt(xs[xs.length - 1]), width - 180, 26);
  };

  useEffect(() => {
    drawPane(topRef.current, timestamps, values, view.start, view.end, { color: '#4fd1c5' });
    drawPane(bottomRef.current, timestamps, values, view.start, view.end, { color: '#f6ad55' });
  }, [data, view]);

  // interactions: drag to pan, wheel to zoom
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let down = false, lastX = 0;
    const onDown = e => { down = true; lastX = e.clientX || e.touches?.[0]?.clientX || 0; };
    const onUp = () => { down = false; };
    const onMove = e => {
      if (!down) return;
      const x = e.clientX || e.touches?.[0]?.clientX || 0;
      const dx = x - lastX; lastX = x;
      const width = container.clientWidth; const visible = view.end - view.start + 1;
      const shift = Math.round((-dx / width) * visible);
      if (!shift) return;
      let s = view.start + shift; let en = view.end + shift;
      if (s < 0) { en += -s; s = 0; }
      if (en > N - 1) { s -= (en - (N - 1)); en = N - 1; }
      setView({ start: Math.max(0, s), end: Math.min(N - 1, en) });
    };
    const onWheel = e => { e.preventDefault(); const visible = Math.max(10, view.end - view.start + 1); const factor = e.deltaY > 0 ? 1.15 : 0.85; const center = Math.round((view.start + view.end) / 2); const newVisible = Math.min(N, Math.max(10, Math.round(visible * factor))); let s = Math.max(0, center - Math.floor(newVisible / 2)); let en = Math.min(N - 1, s + newVisible - 1); if (en - s + 1 < newVisible) s = Math.max(0, en - newVisible + 1); setView({ start: s, end: en }); };

    container.addEventListener('mousedown', onDown);
    window.addEventListener('mouseup', onUp);
    container.addEventListener('mousemove', onMove);
    container.addEventListener('wheel', onWheel, { passive: false });
    container.addEventListener('touchstart', onDown, { passive: true });
    container.addEventListener('touchmove', onMove, { passive: true });
    container.addEventListener('touchend', onUp, { passive: true });
    return () => {
      container.removeEventListener('mousedown', onDown);
      window.removeEventListener('mouseup', onUp);
      container.removeEventListener('mousemove', onMove);
      container.removeEventListener('wheel', onWheel);
      container.removeEventListener('touchstart', onDown);
      container.removeEventListener('touchmove', onMove);
      container.removeEventListener('touchend', onUp);
    };
  }, [view, data, N]);

  return (
    <div ref={containerRef} style={{ userSelect: 'none' }}>
      <div style={{ width: '100%', height: topHeight, marginBottom: 8 }}>
        <canvas ref={topRef} style={{ width: '100%', height: '100%', display: 'block' }} />
      </div>
      <div style={{ width: '100%', height: bottomHeight }}>
        <canvas ref={bottomRef} style={{ width: '100%', height: '100%', display: 'block' }} />
      </div>
    </div>
  );
}