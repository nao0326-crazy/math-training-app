import type { ScratchNote } from '../types/scratch';
import { getAllScratchNotes, getScratchNote, saveScratchNote } from '../storage/db';

/**
 * 途中式ノートの保存サービス。
 *
 * 途中式は「なくても解答できる」補助機能であるため、保存・読み込みに失敗しても
 * アプリ全体を止めないことを最優先とする。すべての操作を例外を捕捉して
 * 安全な既定値 (null / 空配列 / false) を返す。
 */

/** 指定した出題の途中式を読み込む。失敗時は null (存在しない場合と同じ扱い)。 */
export async function loadScratchNote(attemptId: string): Promise<ScratchNote | null> {
  if (!attemptId) return null;
  try {
    const note = await getScratchNote(attemptId);
    return note ?? null;
  } catch {
    return null;
  }
}

/** 途中式を保存する。成功したら true、失敗したら false (例外は投げない)。 */
export async function storeScratchNote(note: ScratchNote): Promise<boolean> {
  try {
    await saveScratchNote(note);
    return true;
  } catch {
    return false;
  }
}

/** 保存済みの途中式をすべて読み込む (復習画面用)。失敗時は空配列。 */
export async function loadAllScratchNotes(): Promise<ScratchNote[]> {
  try {
    const notes = await getAllScratchNotes();
    return Array.isArray(notes) ? notes : [];
  } catch {
    return [];
  }
}
