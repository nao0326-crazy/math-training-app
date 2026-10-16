import { useCallback, useEffect, useRef } from 'react';
import type { ScratchStroke } from '../types/scratch';
import { drawStrokes } from '../utils/scratchDraw';

const DEFAULT_WIDTH = 640;
const DEFAULT_HEIGHT = 180;

function getDpr(): number {
  const d = typeof window !== 'undefined' ? window.devicePixelRatio : 1;
  return Number.isFinite(d) && d > 0 ? d : 1;
}

interface ScratchNoteViewProps {
  /** 表示する筆跡 (正規化座標) */
  strokes: ScratchStroke[];
  /** 代替テキスト (キャンバスが使えない環境向け) */
  ariaLabel?: string;
}

/**
 * 保存された途中式を読み取り専用で描画する (復習画面用)。
 *
 * 操作は受け付けない。ストロークを正規化座標で保持しているため、
 * 表示サイズが異なっていても筆跡は相対位置を保ったまま再描画される。
 */
export default function ScratchNoteView({ strokes, ariaLabel }: ScratchNoteViewProps) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sizeRef = useRef({ width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT });
  const strokesRef = useRef<ScratchStroke[]>(strokes);
  strokesRef.current = strokes;

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let ctx: CanvasRenderingContext2D | null = null;
    try {
      ctx = canvas.getContext('2d');
    } catch {
      ctx = null;
    }
    if (!ctx) return;

    const { width, height } = sizeRef.current;
    const dpr = getDpr();
    const targetW = Math.max(1, Math.round(width * dpr));
    const targetH = Math.max(1, Math.round(height * dpr));
    if (canvas.width !== targetW) canvas.width = targetW;
    if (canvas.height !== targetH) canvas.height = targetH;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawStrokes(ctx, strokesRef.current, width, height);
  }, []);

  const measure = useCallback(() => {
    const el = wrapRef.current;
    if (!el) return;
    let rect: DOMRect;
    try {
      rect = el.getBoundingClientRect();
    } catch {
      return;
    }
    const w = rect.width > 0 ? rect.width : DEFAULT_WIDTH;
    const h = rect.height > 0 ? rect.height : DEFAULT_HEIGHT;
    if (w !== sizeRef.current.width || h !== sizeRef.current.height) {
      sizeRef.current = { width: w, height: h };
      redraw();
    }
  }, [redraw]);

  useEffect(() => {
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    let ro: ResizeObserver;
    try {
      ro = new ResizeObserver(() => measure());
    } catch {
      return;
    }
    if (wrapRef.current) ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, [measure, strokes]);

  // 筆跡が差し替わったら再描画する
  useEffect(() => {
    redraw();
  }, [strokes, redraw]);

  return (
    <div className="scratch-note-view" ref={wrapRef}>
      <canvas
        ref={canvasRef}
        className="scratch-note-canvas"
        role="img"
        aria-label={ariaLabel ?? '保存された途中式'}
        data-stroke-count={strokes.length}
      />
    </div>
  );
}
