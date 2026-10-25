/**
 * IndexedDB スキーマ移行のテスト (idb をモック)
 *
 * 検証する点:
 * - v2 (oldVersion=2) からの移行で scratchNotes ストアが追加される
 * - 新規作成 (oldVersion=0) では全ストアが作られる
 * - 移行は既存ストアを削除しない (既存の学習記録が残る)
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

/** インメモリの疑似 IndexedDBで使う upgrade コールバックの型 (hoisted より前で宣言) */
type UpgradeFn = (db: unknown, oldVersion: number) => void;

/** upgrade 未実行のまま CRUD を呼ばれた場合に備え、ストアを遅延作成する */
function runUpgradeDefault(store: string, value: unknown): void {
  if (!h.stores.has(store)) h.stores.set(store, new Map());
  const s = h.stores.get(store);
  if (!s) return;
  if (
    store === 'scratchNotes' &&
    typeof value === 'object' &&
    value !== null &&
    'attemptId' in value
  ) {
    s.set((value as { attemptId: unknown }).attemptId, value);
  } else {
    s.set(Math.random(), value);
  }
}

/** db モジュールから最新の関数群を取得する (接続キャッシュの都合で毎回再取得) */
async function dbFns() {
  await import('./db');
  return {
    getAllScratchNotes: getAllDbNotes,
    getScratchNote: getDbNote,
    saveScratchNote: saveDbNote,
    deleteScratchNote,
    clearAllData,
  };
}
/** インメモリの疑似 IndexedDB (ストアごとの Map と作成履歴を保持) */
const h = vi.hoisted(() => {
  const stores = new Map<string, Map<unknown, unknown>>();
  const createdStores: Array<{ name: string; keyPath?: string }> = [];
  const deletedStores: string[] = [];
  const box: { capturedUpgrade: UpgradeFn | null; openVersion: number } = {
    capturedUpgrade: null,
    openVersion: -1,
  };
  return { stores, createdStores, deletedStores, box };
});

function makeFakeDb() {
  return {
    createObjectStore: (name: string, options?: { keyPath?: string }) => {
      h.createdStores.push({ name, keyPath: options?.keyPath });
      if (!h.stores.has(name)) h.stores.set(name, new Map());
      return { createIndex: () => {} };
    },
    deleteObjectStore: (name: string) => {
      h.deletedStores.push(name);
      h.stores.delete(name);
    },
    put: async (store: string, value: unknown) => {
      // autoIncrement ストアの add と異なり、put は keyPath で上書きする
      const keyPath = h.createdStores.find((c) => c.name === store)?.keyPath;
      const s = h.stores.get(store);
      if (keyPath === undefined || !s) runUpgradeDefault(store, value);
      else {
        const key =
          typeof value === 'object' && value !== null
            ? (value as Record<string, unknown>)[keyPath]
            : JSON.stringify(value);
        s.set(key, value);
      }
    },
    get: async (store: string, key: unknown) => h.stores.get(store)?.get(key),
    getAll: async (store: string) => [...(h.stores.get(store)?.values() ?? [])],
    delete: async (store: string, key: unknown) => h.stores.get(store)?.delete(key),
    clear: async (store: string) => h.stores.get(store)?.clear(),
    add: async (store: string, value: unknown) => h.stores.get(store)?.set(Math.random(), value),
    transaction: () => ({
      objectStore: () => ({ add: async () => {}, put: async () => {} }),
      done: Promise.resolve(),
    }),
  };
}

vi.mock('idb', () => ({
  openDB: vi.fn(
    async (_name: string, version: number, opts: { upgrade: (db: unknown, oldVersion: number) => void }) => {
      h.box.openVersion = version;
      h.box.capturedUpgrade = opts.upgrade;
      return makeFakeDb();
    },
  ),
}));

import {
  clearAllData,
  deleteScratchNote,
  getAllScratchNotes as getAllDbNotes,
  getScratchNote as getDbNote,
  saveScratchNote as saveDbNote,
} from './db';
import type { ScratchNote } from '../types/scratch';

function makeNote(attemptId: string): ScratchNote {
  return {
    attemptId,
    problemId: `prob-${attemptId}`,
    problemType: 'integer_addition',
    category: 'integer',
    question: '2 + 3 = ?',
    strokes: [{ points: [{ x: 0.1, y: 0.1 }], color: '#111', width: 3 }],
    createdAt: '2026-10-16T00:00:00.000Z',
    updatedAt: '2026-10-16T00:00:00.000Z',
  };
}

/** upgrade コールバックを指定の oldVersion で実行する */
function runUpgrade(oldVersion: number): void {
  const upgrade = h.box.capturedUpgrade;
  if (!upgrade) throw new Error('upgrade が捕捉できていない');
  const fake = makeFakeDb();
  upgrade(fake, oldVersion);
}

beforeEach(async () => {
  h.stores.clear();
  h.createdStores.length = 0;
  h.deletedStores.length = 0;
  h.box.capturedUpgrade = null;
  // db モジュールの接続キャッシュを作り直し、openDB モックから upgrade を捕捉する
  vi.resetModules();
  const db = await import('./db');
  await db.getAllScratchNotes().catch(() => []);
});

/** ストアを用意する (upgrade を実行してから CRUD を使う場合の前提条件) */
function ensureStores(upgradedFrom = 0): void {
  runUpgrade(upgradedFrom);
  h.createdStores.length = 0;
}

describe('db migration', () => {
  it('DB バージョンは 4 以上で開かれる', async () => {
    expect(h.box.openVersion).toBeGreaterThanOrEqual(4);
  });

  it('新規作成 (v0) では scratchNotes を含む全ストアが作られる', async () => {
    runUpgrade(0);
    const names = h.createdStores.map((c) => c.name);
    expect(names).toContain('answers');
    expect(names).toContain('questions');
    expect(names).toContain('settings');
    expect(names).toContain('dailySync');
    expect(names).toContain('scratchNotes');
    expect(names).toContain('speedGateSessions');
    const scratch = h.createdStores.find((c) => c.name === 'scratchNotes');
    expect(scratch?.keyPath).toBe('attemptId');
    const speedGate = h.createdStores.find((c) => c.name === 'speedGateSessions');
    expect(speedGate?.keyPath).toBe('dateKey');
  });

  it('v3 からの移行で speedGateSessions だけ追加され、既存ストアは消えない', async () => {
    // v3 相当の既存ストアを用意し、既存の学習記録を入れる
    runUpgrade(0);
    h.createdStores.length = 0;
    h.stores.get('answers')?.set(1, { problemId: 'legacy', isCorrect: true });

    // v3 -> v4 の移行を実行
    runUpgrade(3);
    expect(h.createdStores.map((c) => c.name)).toEqual(['speedGateSessions']);
    expect(h.deletedStores).toHaveLength(0);
    // 既存の学習記録が残っている
    expect(h.stores.get('answers')?.get(1)).toEqual({ problemId: 'legacy', isCorrect: true });
  });

  it('v4 以降では新しいストアは作られない (再移行なし)', async () => {
    runUpgrade(4);
    expect(h.createdStores).toHaveLength(0);
    expect(h.deletedStores).toHaveLength(0);
  });
});

describe('scratchNotes CRUD', () => {
  it('保存・取得・全件取得・削除ができる', async () => {
    ensureStores(0);
    const { saveScratchNote, getScratchNote, getAllScratchNotes, deleteScratchNote } = await dbFns();
    await saveScratchNote(makeNote('m1'));
    expect(await getScratchNote('m1')).toEqual(makeNote('m1'));
    await saveScratchNote(makeNote('m2'));
    expect((await getAllScratchNotes()).map((n) => n.attemptId).sort()).toEqual(['m1', 'm2']);
    await deleteScratchNote('m1');
    expect(await getScratchNote('m1')).toBeUndefined();
  });

  it('全削除は scratchNotes も消す', async () => {
    ensureStores(0);
    const { saveScratchNote, getAllScratchNotes, clearAllData } = await dbFns();
    await saveScratchNote(makeNote('m9'));
    await clearAllData();
    expect(await getAllScratchNotes()).toEqual([]);
  });
});
