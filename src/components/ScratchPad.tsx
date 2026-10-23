import { useCallback, useEffect, useRef, useState } from 'react';
import type { ScratchNote, ScratchNoteMeta, ScratchPoint, ScratchStroke } from '../types/scratch';
import { clamp01, drawStrokes, isStrokeNear, ERASER_RADIUS } from '../utils/scratchDraw';
import { loadScratchNote, storeScratchNote } from '../services/scratchNote';

/** 未計測時 (表示前・jsdom) の既定キャンバスサイズ */
const DEFAULT_WIDTH = 640;
const DEFAULT_HEIGHT = 440;
/** 線の既定色と太さ */
const DEFAULT_COLOR = '#1f2937';
const COLOR_CHOICES = [
  { value: '#1f2937', label: 'くろ' },
  { value: '#2563eb', label: 'あお' },
  { value: '#dc2626', label: 'あか' },
];
const PEN_WIDTH = 3;
/** 描画が止まってから保存するまでの待ち時間 (描画ごとに連続保存しないため) */
const SAVE_DELAY_MS = 400;
/** 取り消し履歴の上限 (メモリ保護) */
const MAX_UNDO = 100;

type Tool = 'pen' | 'eraser';
type SaveState = 'idle' | 'saving' | 'saved' | 'error';
type DrawMode = 'idle' | 'pen' | 'erase';

/** 取り消し対象の1操作 */
type HistoryEntry =
  | { type: 'add'; stroke: ScratchStroke }
  | { type: 'erase'; before: ScratchStroke[] }
  | { type: 'clear'; before: ScratchStroke[] };

interface ScratchPadProps {
  /** 出題インスタンスと問題のメタ情報 (attemptId を主キーに保存する) */
  meta: ScratchNoteMeta;
  /** 回答確定後などに true で描画・操作を無効化する */
  disabled?: boolean;
}

function getDpr(): number {
  const d = typeof window !== 'undefined' ? window.devicePixelRatio : 1;
  return Number.isFinite(d) && d > 0 ? d : 1;
}

/**
 * 手書き途中式ノート (描画 + 自動保存)
 *
 * - マウス/タッチ/スタイラスを Pointer Events で受け付ける。
 * - 筆跡は正規化座標のストロークとして保持し、リサイズ・高DPIに耐えられるよう
 *   毎回すべてを再描画する。
 * - 描画の変更はデバウンスして自動保存する (描画ごとには保存しない)。
 * - 途中式は解答の必須条件にしない (保存失敗も解答・描画を妨げない)。
 */
export default function ScratchPad({ meta, disabled = false }: ScratchPadProps) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  /** 確定済みの筆跡 (描画中の作業ストロークは含まない) */
  const strokesRef = useRef<ScratchStroke[]>([]);
  const [strokes, setStrokes] = useState<ScratchStroke[]>([]);
  /** 描画中のストローク (ペン) */
  const workingRef = useRef<ScratchStroke | null>(null);
  /** 描画中の消しゴム作業 (before: 消す前の全体, current: 消した結果) */
  const eraseRef = useRef<{ before: ScratchStroke[]; current: ScratchStroke[] } | null>(null);
  const modeRef = useRef<DrawMode>('idle');
  const undoRef = useRef<HistoryEntry[]>([]);

  const sizeRef = useRef({ width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT });
  const metaRef = useRef(meta);
  metaRef.current = meta;
  const createdAtRef = useRef<string>('');
  const loadedRef = useRef(false);
  const dirtyRef = useRef(false);
  const unmountedRef = useRef(false);
  const saveTimerRef = useRef<number | null>(null);

  const [tool, setTool] = useState<Tool>('pen');
  const [color, setColor] = useState<string>(DEFAULT_COLOR);
  const toolRef = useRef(tool);
  toolRef.current = tool;
  const colorRef = useRef(color);
  colorRef.current = color;

  const [undoSize, setUndoSize] = useState(0);
  const [rev, setRev] = useState(0);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [confirmingClear, setConfirmingClear] = useState(false);

  /** 確定済み筆跡をまとめて更新する (ref と state を同期) */
  const applyStrokes = useCallback((next: ScratchStroke[]) => {
    strokesRef.current = next;
    setStrokes(next);
  }, []);

  /** すべての筆跡 (描画中を含む) をキャンバスへ再描画する */
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

    // 高DPI対応: 裏面を devicePixelRatio 倍にし、CSS ピクセル座標で描く
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const composed = [...strokesRef.current];
    if (workingRef.current) composed.push(workingRef.current);
    drawStrokes(ctx, composed, width, height);
  }, []);

  /** コンテキストサイズを測定する (0 のときは既定値を使う) */
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

  // 起動時に保存済みの途中式を読み込む (失敗しても空のまま描ける)
  useEffect(() => {
    let cancelled = false;
    loadedRef.current = false;
    void (async () => {
      const note = await loadScratchNote(meta.attemptId);
      if (cancelled) return;
      if (note && Array.isArray(note.strokes)) {
        applyStrokes(note.strokes);
        createdAtRef.current = note.createdAt || '';
      } else {
        applyStrokes([]);
      }
      loadedRef.current = true;
      redraw();
    })();
    return () => {
      cancelled = true;
    };
  }, [meta.attemptId, applyStrokes, redraw]);

  // 初期計測とリサイズ追従 (ResizeObserver が無い環境では初期計測のみ)
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
  }, [measure]);

  /** 確定済み筆跡を直近の状態として保存する (失敗しても例外は投げない) */
  const flushSave = useCallback(async () => {
    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    if (!loadedRef.current || !dirtyRef.current) return;
    dirtyRef.current = false;
    setSaveState('saving');
    const now = new Date().toISOString();
    const note: ScratchNote = {
      ...metaRef.current,
      strokes: strokesRef.current,
      createdAt: createdAtRef.current || now,
      updatedAt: now,
    };
    const ok = await storeScratchNote(note);
    if (ok) {
      if (!createdAtRef.current) createdAtRef.current = note.createdAt;
      setSaveState('saved');
    } else {
      // 保存失敗: 次回の保存で再試行し、状態をユーザーへ表示する (描画は継続可)
      dirtyRef.current = true;
      setSaveState('error');
    }
  }, []);

  // 変更をデバウンスして自動保存する (描画のたびには保存しない)
  useEffect(() => {
    if (!loadedRef.current || !dirtyRef.current) return;
    if (saveTimerRef.current !== null) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => {
      void flushSave();
    }, SAVE_DELAY_MS);
    return () => {
      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
    };
  }, [rev, flushSave]);

  // 画面遷移・アンマウント時に未保存の確定済み筆跡を失わないよう保存する
  useEffect(
    () => () => {
      unmountedRef.current = true;
      void flushSave();
    },
    [flushSave],
  );

  /** 描画が確定したときに呼ぶ: dirty にして自動保存を予約する */
  const markDirty = useCallback(() => {
    dirtyRef.current = true;
    setRev((r) => r + 1);
  }, []);

  const pushUndo = useCallback((entry: HistoryEntry) => {
    undoRef.current.push(entry);
    if (undoRef.current.length > MAX_UNDO) undoRef.current.shift();
    setUndoSize(undoRef.current.length);
  }, []);

  /** ポインタ位置を正規化座標 [0,1] に変換する */
  const toNorm = useCallback((clientX: number, clientY: number): ScratchPoint => {
    const canvas = canvasRef.current;
    let w = sizeRef.current.width;
    let h = sizeRef.current.height;
    let left = 0;
    let top = 0;
    if (canvas) {
      try {
        const rect = canvas.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          w = rect.width;
          h = rect.height;
          left = rect.left;
          top = rect.top;
        }
      } catch {
        /* 計測不可時は既定サイズを使う */
      }
    }
    return { x: clamp01((clientX - left) / (w || 1)), y: clamp01((clientY - top) / (h || 1)) };
  }, []);

  const eraseAt = useCallback((x: number, y: number) => {
    const st = eraseRef.current;
    if (!st) return;
    st.current = st.current.filter((s) => !isStrokeNear(s, x, y, ERASER_RADIUS));
  }, []);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (disabled) return; // 回答確定後は描画を受け付けない
      if (!loadedRef.current) return; // 読み込み前に描かせて既存記録を保護する
      e.preventDefault();
      const p = toNorm(e.clientX, e.clientY);
      try {
        e.currentTarget.setPointerCapture?.(e.pointerId);
      } catch {
        /* サポートされない環境では無視 */
      }
      if (toolRef.current === 'pen') {
        modeRef.current = 'pen';
        workingRef.current = { points: [p], color: colorRef.current, width: PEN_WIDTH };
      } else {
        modeRef.current = 'erase';
        eraseRef.current = { before: strokesRef.current, current: strokesRef.current };
        eraseAt(p.x, p.y);
      }
      redraw();
    },
    [disabled, toNorm, eraseAt, redraw],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (disabled) return; // 回答確定後は描画を受け付けない
      const mode = modeRef.current;
      if (mode === 'idle') return;
      e.preventDefault();
      const p = toNorm(e.clientX, e.clientY);
      if (mode === 'pen') {
        if (!workingRef.current) return;
        workingRef.current.points.push(p);
      } else {
        eraseAt(p.x, p.y);
      }
      redraw();
    },
    [disabled, toNorm, eraseAt, redraw],
  );

  const endStroke = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (disabled) return; // 回答確定後は描画を受け付けない
      const mode = modeRef.current;
      if (mode === 'idle') return;
      try {
        e.currentTarget.releasePointerCapture?.(e.pointerId);
      } catch {
        /* 無視 */
      }
      modeRef.current = 'idle';
      if (mode === 'pen') {
        const working = workingRef.current;
        workingRef.current = null;
        if (working && working.points.length > 0) {
          applyStrokes([...strokesRef.current, working]);
          pushUndo({ type: 'add', stroke: working });
          markDirty();
        }
      } else {
        const st = eraseRef.current;
        eraseRef.current = null;
        if (st && st.current.length !== st.before.length) {
          applyStrokes(st.current);
          pushUndo({ type: 'erase', before: st.before });
          markDirty();
        }
      }
      redraw();
    },
    [disabled, applyStrokes, pushUndo, markDirty, redraw],
  );

  const handleUndo = useCallback(() => {
    const entry = undoRef.current.pop();
    if (!entry) return;
    setUndoSize(undoRef.current.length);
    if (entry.type === 'add') {
      applyStrokes(strokesRef.current.filter((s) => s !== entry.stroke));
    } else {
      applyStrokes(entry.before);
    }
    markDirty();
    redraw();
  }, [applyStrokes, markDirty, redraw]);

  const handleClearConfirm = useCallback(() => {
    setConfirmingClear(false);
    const before = strokesRef.current;
    if (before.length === 0) return;
    applyStrokes([]);
    pushUndo({ type: 'clear', before });
    markDirty();
    redraw();
  }, [applyStrokes, pushUndo, markDirty, redraw]);

  const saveLabel =
    saveState === 'saving'
      ? '保存中...'
      : saveState === 'saved'
        ? '保存済み'
        : saveState === 'error'
          ? '保存できません'
          : '';

  return (
    <div className="scratch-pad">
      <div className="scratch-toolbar">
        <span className="scratch-title">とちゅうしきノート</span>
        <div className="scratch-tools">
          <button
            type="button"
            className={`scratch-tool-btn ${tool === 'pen' ? 'active' : ''} ${disabled ? 'disabled' : ''}`}
            aria-label="ペン"
            disabled={disabled}
            onClick={() => setTool('pen')}
          >
            ペン
          </button>
          <button
            type="button"
            className={`scratch-tool-btn ${tool === 'eraser' ? 'active' : ''} ${disabled ? 'disabled' : ''}`}
            aria-label="消しゴム"
            disabled={disabled}
            onClick={() => setTool('eraser')}
          >
            消しゴム
          </button>
          <button
            type="button"
            className={`scratch-tool-btn ${disabled ? 'disabled' : ''}`}
            aria-label="ひとつ戻す"
            disabled={disabled || undoSize === 0}
            onClick={handleUndo}
          >
            もどす
          </button>
          <button
            type="button"
            className={`scratch-tool-btn ${disabled ? 'disabled' : ''}`}
            aria-label="ぜんぶ消す"
            disabled={disabled}
            onClick={() => setConfirmingClear(true)}
          >
            全消去
          </button>
          <span className="scratch-colors">
            {COLOR_CHOICES.map((c) => (
              <button
                key={c.value}
                type="button"
                className={`scratch-color ${color === c.value ? 'active' : ''} ${disabled ? 'disabled' : ''}`}
                style={{ background: c.value }}
                aria-label={`色 ${c.label}`}
                disabled={disabled}
                onClick={() => {
                  setColor(c.value);
                  setTool('pen');
                }}
              />
            ))}
          </span>
        </div>
        <span className={`scratch-save-state ${saveState}`} role="status">
          {saveLabel}
        </span>
      </div>

      <div className="scratch-canvas-wrap" ref={wrapRef}>
        <canvas
          ref={canvasRef}
          className={`scratch-canvas ${disabled ? 'scratch-disabled' : ''}`}
          data-stroke-count={strokes.length}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={endStroke}
          onPointerCancel={endStroke}
        />
      </div>

      {confirmingClear && (
        <div className="scratch-confirm" role="dialog" aria-label="全消去の確認">
          <span className="scratch-confirm-text">ぜんぶ消しますか？</span>
          <button
            type="button"
            className={`scratch-confirm-yes ${disabled ? 'disabled' : ''}`}
            aria-label="全消去する"
            disabled={disabled}
            onClick={handleClearConfirm}
          >
            消す
          </button>
          <button
            type="button"
            className={`scratch-confirm-no ${disabled ? 'disabled' : ''}`}
            aria-label="やめる"
            disabled={disabled}
            onClick={() => setConfirmingClear(false)}
          >
            やめる
          </button>
        </div>
      )}

      {saveState === 'error' && (
        <div className="scratch-save-error" role="alert">
          途中式を保存できませんでした。描画は画面内に保持されています。
        </div>
      )}
    </div>
  );
}

