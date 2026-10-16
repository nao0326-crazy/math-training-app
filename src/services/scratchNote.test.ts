/**
 * 途中式ノートの保存サービステスト
 *
 * 検証する点:
 * - 保存・読み込み・全件取得の正常系 (db 層をモック)
 * - 保存失敗時に false を返し例外を投げない (アプリがクラッシュしない)
 * - 読み込み失敗時に null / 空配列を返す
 * - 不正な attemptId では読み込まない
 */

import { describe, expect, it, vi } from 'vitest';
import type { ScratchNote } from '../types/scratch';

const h = vi.hoisted(() => ({
  store: new Map<string, ScratchNote>(),
  throwOnSave: false,
  throwOnGet: false,
  throwOnGetAll: false,
}));

vi.mock('../storage/db', () => ({
  saveScratchNote: vi.fn(async (note: ScratchNote) => {
    if (h.throwOnSave) throw new Error('save failed');
    h.store.set(note.attemptId, note);
  }),
  getScratchNote: vi.fn(async (attemptId: string) => {
    if (h.throwOnGet) throw new Error('get failed');
    return h.store.get(attemptId);
  }),
  getAllScratchNotes: vi.fn(async () => {
    if (h.throwOnGetAll) throw new Error('getAll failed');
    return [...h.store.values()];
  }),
}));

import { loadAllScratchNotes, loadScratchNote, storeScratchNote } from './scratchNote';

function makeNote(attemptId: string): ScratchNote {
  return {
    attemptId,
    problemId: `prob-${attemptId}`,
    problemType: 'integer_addition',
    category: 'integer',
    question: '2 + 3 = ?',
    strokes: [{ points: [{ x: 0.1, y: 0.1 }, { x: 0.2, y: 0.2 }], color: '#111', width: 3 }],
    createdAt: '2026-10-16T00:00:00.000Z',
    updatedAt: '2026-10-16T00:00:00.000Z',
  };
}

describe('scratchNote service', () => {
  it('保存したデータを読み込める', async () => {
    h.store.clear();
    const note = makeNote('a1');
    expect(await storeScratchNote(note)).toBe(true);
    expect(await loadScratchNote('a1')).toEqual(note);
  });

  it('存在しない途中式は null を返す', async () => {
    h.store.clear();
    expect(await loadScratchNote('missing')).toBeNull();
  });

  it('不正な attemptId では読み込まない', async () => {
    expect(await loadScratchNote('')).toBeNull();
  });

  it('保存失敗時に false を返し例外を投げない', async () => {
    h.throwOnSave = true;
    try {
      await expect(storeScratchNote(makeNote('a2'))).resolves.toBe(false);
    } finally {
      h.throwOnSave = false;
    }
  });

  it('読み込み失敗時に null を返し例外を投げない', async () => {
    h.throwOnGet = true;
    try {
      await expect(loadScratchNote('a1')).resolves.toBeNull();
    } finally {
      h.throwOnGet = false;
    }
  });

  it('全件取得と失敗時の空配列', async () => {
    h.store.clear();
    await storeScratchNote(makeNote('b1'));
    await storeScratchNote(makeNote('b2'));
    expect((await loadAllScratchNotes()).map((n) => n.attemptId).sort()).toEqual(['b1', 'b2']);

    h.throwOnGetAll = true;
    try {
      await expect(loadAllScratchNotes()).resolves.toEqual([]);
    } finally {
      h.throwOnGetAll = false;
    }
  });

  it('別の出題の途中式は混ざらない', async () => {
    h.store.clear();
    await storeScratchNote(makeNote('c1'));
    const other = { ...makeNote('c2'), strokes: [] as ScratchNote['strokes'] };
    await storeScratchNote(other);
    expect((await loadScratchNote('c1'))?.strokes).toHaveLength(1);
    expect((await loadScratchNote('c2'))?.strokes).toHaveLength(0);
  });
});
