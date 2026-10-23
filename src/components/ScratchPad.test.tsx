/**
 * ScratchPad (手書き途中式キャンバス) のテスト (jsdom)
 *
 * jsdom には canvas の描画・ResizeObserver・IndexedDB が無いため、
 * - 保存サービスはモックし、筆跡データ (正規化座標) の受け渡しを検証する
 * - 描画は Pointer Events の発火で検証し、data-stroke-count で筆跡数を観測する
 * - リサイズは ResizeObserver の偽物と getBoundingClientRect の差し替えで検証する
 * - 各テストは固有の attemptId を使い、保存済みデータの混ざりを防ぐ
 *
 * 検証する点:
 * - 線の描画と複数ストローク
 * - 消しゴムと取り消し、全消去 (確認つき) と空になること
 * - リサイズ後も筆跡が保持され、正規化座標で保存されること
 *
 * @vitest-environment jsdom
 */

import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  saved: new Map<string, { attemptId: string; strokes: Array<{ points: Array<{ x: number; y: number }> }> }>(),
  storeResult: true,
  storeCalls: [] as Array<{ attemptId: string; strokes: unknown[] }>,
}));

vi.mock('../services/scratchNote', () => ({
  loadScratchNote: vi.fn(async (attemptId: string) => h.saved.get(attemptId) ?? null),
  storeScratchNote: vi.fn(async (note: { attemptId: string; strokes: unknown[] }) => {
    h.storeCalls.push(note);
    if (!h.storeResult) return false;
    h.saved.set(
      note.attemptId,
      note as { attemptId: string; strokes: Array<{ points: Array<{ x: number; y: number }> }> },
    );
    return true;
  }),
  loadAllScratchNotes: vi.fn(async () => [...h.saved.values()]),
}));

import ScratchPad from './ScratchPad';
import type { ScratchNoteMeta } from '../types/scratch';
import { cleanup } from '@testing-library/react';

/** テストごとに固有の attemptId を作る (モック保存の混ざり防止) */
let attemptSeq = 0;
function freshAttempt(prefix: string): string {
  attemptSeq += 1;
  return `${prefix}-${attemptSeq}-${Date.now()}`;
}

function makeMeta(attemptId: string): ScratchNoteMeta {
  return {
    attemptId,
    problemId: `prob-${attemptId}`,
    problemType: 'integer_addition',
    category: 'integer',
    question: '2 + 3 = ?',
  };
}

function getCanvas(): HTMLElement {
  const canvas = document.querySelector('.scratch-canvas');
  if (!canvas) throw new Error('scratch canvas が見つからない');
  return canvas as HTMLElement;
}

/** 読み込み完了 (loadedRef) を待つ。fake タイマー下では進めて待つ。 */
async function flushLoad(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  if (vi.isFakeTimers()) {
    await act(async () => {
      vi.advanceTimersByTime(0);
    });
  } else {
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }
}

/**
 * jsdom には PointerEvent が無い場合があるため、
 * clientX/clientY/pointerId を持たせたネイティブ Event を手動で作って発火する。
 * (fireEvent.pointerDown だけでは座標が渡らないことがある)
 */
function pointerEvent(type: string, x: number, y: number): Event {
  const ev = new Event(type, { bubbles: true, cancelable: true });
  const anyEv = ev as unknown as Record<string, unknown>;
  anyEv.clientX = x;
  anyEv.clientY = y;
  anyEv.pointerId = 1;
  return ev;
}

/** キャンバス上に1本の線を描く */
function drawStroke(canvas: HTMLElement, points: Array<[number, number]>): void {
  fireEvent(canvas, pointerEvent('pointerdown', points[0][0], points[0][1]));
  for (let i = 1; i < points.length; i++) {
    fireEvent(canvas, pointerEvent('pointermove', points[i][0], points[i][1]));
  }
  const last = points[points.length - 1];
  fireEvent(canvas, pointerEvent('pointerup', last[0], last[1]));
}

beforeEach(() => {
  h.saved.clear();
  h.storeCalls = [];
  h.storeResult = true;
  cleanup();
});

afterEach(() => {
  cleanup();
});

describe('ScratchPad: 描画', () => {
  it('ツールと空のキャンバスを表示する', async () => {
    render(<ScratchPad meta={makeMeta(freshAttempt('d0'))} />);
    await flushLoad();
    expect(screen.getByRole('button', { name: 'ペン' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '消しゴム' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'ひとつ戻す' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'ぜんぶ消す' })).toBeTruthy();
    expect(getCanvas().getAttribute('data-stroke-count')).toBe('0');
  });

  it('線を描画して筆跡が反映される', async () => {
    render(<ScratchPad meta={makeMeta(freshAttempt('d1'))} />);
    await flushLoad();
    const canvas = getCanvas();
    drawStroke(canvas, [
      [64, 22],
      [128, 44],
      [192, 66],
    ]);
    expect(canvas.getAttribute('data-stroke-count')).toBe('1');
  });

  it('複数のストロークを描画できる', async () => {
    render(<ScratchPad meta={makeMeta(freshAttempt('d2'))} />);
    await flushLoad();
    const canvas = getCanvas();
    drawStroke(canvas, [
      [64, 22],
      [128, 44],
    ]);
    drawStroke(canvas, [
      [200, 22],
      [264, 44],
    ]);
    drawStroke(canvas, [
      [300, 22],
      [364, 44],
    ]);
    expect(canvas.getAttribute('data-stroke-count')).toBe('3');
  });

  it('消しゴムと取り消しが機能する', async () => {
    render(<ScratchPad meta={makeMeta(freshAttempt('d3'))} />);
    await flushLoad();
    const canvas = getCanvas();
    // 左と右に1本ずつ描く
    drawStroke(canvas, [
      [64, 22],
      [128, 44],
    ]);
    drawStroke(canvas, [
      [512, 22],
      [576, 44],
    ]);
    expect(canvas.getAttribute('data-stroke-count')).toBe('2');

    // 消しゴムで左の1本だけ消す
    fireEvent.click(screen.getByRole('button', { name: '消しゴム' }));
    drawStroke(canvas, [
      [64, 22],
      [96, 33],
    ]);
    expect(canvas.getAttribute('data-stroke-count')).toBe('1');

    // 取り消しで戻る
    fireEvent.click(screen.getByRole('button', { name: 'ひとつ戻す' }));
    expect(canvas.getAttribute('data-stroke-count')).toBe('2');
  });

  it('全消去後にキャンバスが空になる (確認つき・取り消し可)', async () => {
    render(<ScratchPad meta={makeMeta(freshAttempt('d4'))} />);
    await flushLoad();
    const canvas = getCanvas();
    drawStroke(canvas, [
      [64, 22],
      [128, 44],
    ]);
    expect(canvas.getAttribute('data-stroke-count')).toBe('1');

    fireEvent.click(screen.getByRole('button', { name: 'ぜんぶ消す' }));
    // 確認が出て、やめると消えない
    expect(screen.getByRole('dialog', { name: '全消去の確認' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'やめる' }));
    expect(canvas.getAttribute('data-stroke-count')).toBe('1');

    // 確認して消すと空になる
    fireEvent.click(screen.getByRole('button', { name: 'ぜんぶ消す' }));
    fireEvent.click(screen.getByRole('button', { name: '全消去する' }));
    expect(canvas.getAttribute('data-stroke-count')).toBe('0');

    // 全消去も取り消せる
    fireEvent.click(screen.getByRole('button', { name: 'ひとつ戻す' }));
    expect(canvas.getAttribute('data-stroke-count')).toBe('1');
  });
});

describe('ScratchPad: リサイズ', () => {
  /** ResizeObserver の偽物 (jsdom には無い) */
  function installResizeObserverFake() {
    const callbacks = new Set<() => void>();
    const Original = typeof ResizeObserver === 'undefined' ? undefined : ResizeObserver;
    class FakeResizeObserver {
      constructor(cb: () => void) {
        callbacks.add(cb);
      }
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    (globalThis as unknown as Record<string, unknown>).ResizeObserver =
      FakeResizeObserver as unknown as typeof ResizeObserver;
    return {
      fire: () => callbacks.forEach((cb) => cb()),
      restore: () => {
        if (Original === undefined) delete (globalThis as unknown as Record<string, unknown>).ResizeObserver;
        else (globalThis as unknown as Record<string, unknown>).ResizeObserver = Original;
      },
    };
  }

  it('リサイズ後も筆跡が適切に保持される (正規化座標で保存)', async () => {
    const attemptId = freshAttempt('r1');
    const ro = installResizeObserverFake();
    try {
      render(<ScratchPad meta={makeMeta(attemptId)} />);
      await flushLoad();
      const canvas = getCanvas();
      drawStroke(canvas, [
        [64, 22],
        [128, 44],
      ]);
      expect(canvas.getAttribute('data-stroke-count')).toBe('1');

      // キャンバス幅が半分になったように見せかけてリサイズを発火させる
      const wrap = document.querySelector('.scratch-canvas-wrap');
      if (!wrap) throw new Error('wrap が見つからない');
      vi.spyOn(wrap, 'getBoundingClientRect').mockReturnValue({
        width: 320,
        height: 220,
        left: 0,
        top: 0,
        right: 320,
        bottom: 220,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      });
      ro.fire();
      await flushLoad();
      // 筆跡は消えずに残る
      expect(canvas.getAttribute('data-stroke-count')).toBe('1');
    } finally {
      ro.restore();
      vi.restoreAllMocks();
    }
  });
});

describe('ScratchPad: 保存と復元', () => {
  it('描画データがローカルに保存される (デバウンス後・同一 attemptId)', async () => {
    vi.useFakeTimers();
    const attemptId = freshAttempt('s1');
    try {
      render(<ScratchPad meta={makeMeta(attemptId)} />);
      await flushLoad();
      const canvas = getCanvas();
      drawStroke(canvas, [
        [64, 22],
        [128, 44],
      ]);
      // デバウンス前は未保存
      expect(h.storeCalls.filter((c) => c.attemptId === attemptId)).toHaveLength(0);
      await act(async () => {
        vi.advanceTimersByTime(1000);
      });
      const saved = h.saved.get(attemptId);
      expect(saved).toBeTruthy();
      expect(saved?.strokes).toHaveLength(1);
      // 正規化座標で保存されている (既定幅 640・高さ 220 に対する比率)
      const p0 = saved?.strokes[0].points[0];
      expect(p0?.x).toBeCloseTo(64 / 640, 3);
      expect(p0?.y).toBeCloseTo(22 / 220, 3);
      expect(screen.getByRole('status').textContent).toBe('保存済み');
    } finally {
      vi.useRealTimers();
    }
  });

  it('保存したデータから筆跡を復元できる', async () => {
    const attemptId = freshAttempt('s2');
    h.saved.set(attemptId, {
      attemptId,
      strokes: [{ points: [{ x: 0.1, y: 0.1 }, { x: 0.2, y: 0.2 }, { x: 0.3, y: 0.3 }] }],
    });
    render(<ScratchPad meta={makeMeta(attemptId)} />);
    await flushLoad();
    expect(getCanvas().getAttribute('data-stroke-count')).toBe('1');
  });

  it('問題を切り替えても別の問題の途中式と混ざらない', async () => {
    const a1 = freshAttempt('sep');
    const a2 = freshAttempt('sep');
    h.saved.set(a1, {
      attemptId: a1,
      strokes: [{ points: [{ x: 0.1, y: 0.1 }] }],
    });
    render(<ScratchPad meta={makeMeta(a1)} />);
    await flushLoad();
    expect(getCanvas().getAttribute('data-stroke-count')).toBe('1');
    cleanup();

    // 別の出題 (別の attemptId) は空で始まる
    render(<ScratchPad meta={makeMeta(a2)} />);
    await flushLoad();
    expect(getCanvas().getAttribute('data-stroke-count')).toBe('0');
  });

  it('同じ種類の問題が再出題されても過去の記録を上書きしない (attemptId が異なる)', async () => {
    vi.useFakeTimers();
    try {
      const first = freshAttempt('same');
      render(<ScratchPad meta={makeMeta(first)} />);
      await flushLoad();
      drawStroke(getCanvas(), [
        [64, 22],
        [128, 44],
      ]);
      await act(async () => {
        vi.advanceTimersByTime(1000);
      });
      const firstStrokes = h.saved.get(first)?.strokes.length ?? -1;
      expect(firstStrokes).toBe(1);
      cleanup();

      // 再出題は別の attemptId。何も書かずに保存しても空のノートとして別キーに保存される。
      const second = freshAttempt('same');
      expect(second).not.toBe(first);
      render(<ScratchPad meta={makeMeta(second)} />);
      await flushLoad();
      expect(getCanvas().getAttribute('data-stroke-count')).toBe('0');
      // 過去の記録は残ったまま
      expect(h.saved.get(first)?.strokes.length).toBe(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('自動保存中の画面遷移 (アンマウント) でデータが失われない', async () => {
    const attemptId = freshAttempt('s3');
    const { unmount } = render(<ScratchPad meta={makeMeta(attemptId)} />);
    await flushLoad();
    drawStroke(getCanvas(), [
      [64, 22],
      [128, 44],
    ]);
    // デバウンスを待たずに遷移 (アンマウント) しても、確定済み筆跡が保存される
    unmount();
    await flushLoad();
    expect(h.saved.get(attemptId)?.strokes).toHaveLength(1);
  });

  it('全消去の状態も保存される', async () => {
    vi.useFakeTimers();
    const attemptId = freshAttempt('s4');
    try {
      render(<ScratchPad meta={makeMeta(attemptId)} />);
      await flushLoad();
      const canvas = getCanvas();
      drawStroke(canvas, [
        [64, 22],
        [128, 44],
      ]);
      fireEvent.click(screen.getByRole('button', { name: 'ぜんぶ消す' }));
      fireEvent.click(screen.getByRole('button', { name: '全消去する' }));
      expect(canvas.getAttribute('data-stroke-count')).toBe('0');
      await act(async () => {
        vi.advanceTimersByTime(1000);
      });
      expect(h.saved.get(attemptId)?.strokes).toHaveLength(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('保存失敗時にアプリ全体がクラッシュせずエラーを表示する', async () => {
    vi.useFakeTimers();
    const attemptId = freshAttempt('s5');
    try {
      h.storeResult = false;
      render(<ScratchPad meta={makeMeta(attemptId)} />);
      await flushLoad();
      drawStroke(getCanvas(), [
        [64, 22],
        [128, 44],
      ]);
      await act(async () => {
        vi.advanceTimersByTime(1000);
      });
      expect(screen.getByRole('alert').textContent).toContain('保存できません');
      // 描画自体は保持されている
      expect(getCanvas().getAttribute('data-stroke-count')).toBe('1');
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('ScratchPad: 回答後の無効化 (disabled prop)', () => {
  it('disabled=true で線の描画を受け付けない', async () => {
    render(<ScratchPad meta={makeMeta(freshAttempt('d10'))} disabled />);
    await flushLoad();
    const canvas = getCanvas();
    drawStroke(canvas, [
      [64, 22],
      [128, 44],
    ]);
    // disabled なのでストロークが追加されない
    expect(canvas.getAttribute('data-stroke-count')).toBe('0');
  });

  it('disabled=true でツールバーのボタンが無効化される', async () => {
    render(<ScratchPad meta={makeMeta(freshAttempt('d11'))} disabled />);
    await flushLoad();
    const penBtn = screen.getByRole('button', { name: 'ペン' });
    const eraserBtn = screen.getByRole('button', { name: '消しゴム' });
    const undoBtn = screen.getByRole('button', { name: 'ひとつ戻す' });
    const clearBtn = screen.getByRole('button', { name: 'ぜんぶ消す' });
    expect((penBtn as HTMLButtonElement).disabled).toBe(true);
    expect((eraserBtn as HTMLButtonElement).disabled).toBe(true);
    expect((undoBtn as HTMLButtonElement).disabled).toBe(true);
    expect((clearBtn as HTMLButtonElement).disabled).toBe(true);
  });

  it('disabled=true でキャンバスに scratch-disabled クラスが付与される', async () => {
    render(<ScratchPad meta={makeMeta(freshAttempt('d12'))} disabled />);
    await flushLoad();
    const canvas = getCanvas();
    expect(canvas.className).toContain('scratch-disabled');
  });

  it('disabled=false (既定) では線を描画できる', async () => {
    render(<ScratchPad meta={makeMeta(freshAttempt('d13'))} />);
    await flushLoad();
    const canvas = getCanvas();
    drawStroke(canvas, [
      [64, 22],
      [128, 44],
    ]);
    expect(canvas.getAttribute('data-stroke-count')).toBe('1');
  });
});
