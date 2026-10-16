/**
 * 手書き途中式の描画ユーティリティとデータモデルのテスト
 *
 * 検証する点:
 * - ストローク描画 (線・点打ち・空データの安全な取り扱い)
 * - 消しゴムの近接判定
 * - 正規化座標のクランプ
 * - attemptId の一意性 (同一問題の再解答で上書きしないための主キー)
 * - 空ストロークの判定
 */

import { describe, expect, it } from 'vitest';
import { clamp01, drawStrokes, ERASER_RADIUS, isStrokeNear } from './scratchDraw';
import type { ScratchStroke } from '../types/scratch';
import { createScratchAttemptId, isEmptyScratch } from '../types/scratch';

/** 描画呼び出しを記録する最小限の Canvas 2D コンテキストの偽物 */
function makeFakeCtx() {
  const calls: string[] = [];
  const ctx = {
    strokeStyle: '',
    fillStyle: '',
    lineWidth: 1,
    lineCap: '',
    lineJoin: '',
    moveTo: (...args: unknown[]) => calls.push(`moveTo:${args.join(',')}`),
    lineTo: (...args: unknown[]) => calls.push(`lineTo:${args.join(',')}`),
    arc: (...args: unknown[]) => calls.push(`arc:${args.join(',')}`),
    beginPath: () => calls.push('beginPath'),
    stroke: () => calls.push('stroke'),
    fill: () => calls.push('fill'),
  };
  return { ctx: ctx as unknown as CanvasRenderingContext2D, calls };
}

describe('drawStrokes', () => {
  it('複数の点を持つストロークを線で描画する', () => {
    const { ctx, calls } = makeFakeCtx();
    const strokes: ScratchStroke[] = [
      { points: [{ x: 0, y: 0 }, { x: 0.5, y: 0.5 }, { x: 1, y: 1 }], color: '#111', width: 3 },
    ];
    drawStrokes(ctx, strokes, 200, 100);
    expect(calls).toContain('moveTo:0,0');
    expect(calls).toContain('lineTo:100,50');
    expect(calls).toContain('lineTo:200,100');
    expect(calls).toContain('stroke');
  });

  it('1点だけのストロークは点として描画する', () => {
    const { ctx, calls } = makeFakeCtx();
    const strokes: ScratchStroke[] = [{ points: [{ x: 0.5, y: 0.5 }], color: '#111', width: 4 }];
    drawStrokes(ctx, strokes, 200, 100);
    expect(calls.some((c) => c.startsWith('arc:100,50'))).toBe(true);
    expect(calls).toContain('fill');
  });

  it('空の点列・不正なストロークは無視してクラッシュしない', () => {
    const { ctx, calls } = makeFakeCtx();
    const strokes = [
      { points: [], color: '#111', width: 3 },
      null,
      undefined,
      { points: [{ x: 0, y: 0 }], color: '#111', width: 2 },
    ] as unknown as ScratchStroke[];
    expect(() => drawStrokes(ctx, strokes, 200, 100)).not.toThrow();
    // 有効な1点ストロークだけが描画される
    expect(calls.some((c) => c.startsWith('arc:0,0'))).toBe(true);
  });

  it('線の色と太さをストロークごとに設定する', () => {
    const { ctx } = makeFakeCtx();
    const strokes: ScratchStroke[] = [
      { points: [{ x: 0, y: 0 }, { x: 1, y: 1 }], color: 'red', width: 5 },
    ];
    drawStrokes(ctx, strokes, 100, 100);
    expect(ctx.strokeStyle).toBe('red');
    expect(ctx.lineWidth).toBe(5);
  });
});

describe('isStrokeNear', () => {
  const stroke: ScratchStroke = {
    points: [
      { x: 0.1, y: 0.1 },
      { x: 0.2, y: 0.2 },
    ],
    color: '#111',
    width: 3,
  };

  it('近くの点は消しゴム対象になる', () => {
    expect(isStrokeNear(stroke, 0.11, 0.11)).toBe(true);
  });

  it('遠い点は消しゴム対象にならない', () => {
    expect(isStrokeNear(stroke, 0.8, 0.8)).toBe(false);
  });

  it('半径を指定できる', () => {
    expect(isStrokeNear(stroke, 0.15, 0.15, 0.001)).toBe(false);
    expect(isStrokeNear(stroke, 0.15, 0.15, 0.2)).toBe(true);
  });

  it('既定の消しゴム半径は正の値である', () => {
    expect(ERASER_RADIUS).toBeGreaterThan(0);
  });
});

describe('clamp01', () => {
  it('0..1 にクランプする', () => {
    expect(clamp01(-0.5)).toBe(0);
    expect(clamp01(1.5)).toBe(1);
    expect(clamp01(0.3)).toBe(0.3);
  });

  it('非数値は 0 にする', () => {
    expect(clamp01(NaN)).toBe(0);
    expect(clamp01(Infinity)).toBe(0);
  });
});

describe('createScratchAttemptId', () => {
  it('連続生成でも一意になる (同じ問題の再解答で上書きしない)', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 200; i++) ids.add(createScratchAttemptId());
    expect(ids.size).toBe(200);
  });

  it('問題IDとは異なる命名空間である', () => {
    expect(createScratchAttemptId()).toMatch(/^scratch_/);
  });
});

describe('isEmptyScratch', () => {
  it('空配列は空', () => {
    expect(isEmptyScratch([])).toBe(true);
  });

  it('点の無いストロークだけは空 (全消去の状態)', () => {
    expect(isEmptyScratch([{ points: [], color: '#111', width: 3 }])).toBe(true);
  });

  it('1点でも描かれていれば空でない', () => {
    expect(
      isEmptyScratch([{ points: [{ x: 0.1, y: 0.1 }], color: '#111', width: 3 }]),
    ).toBe(false);
  });
});
