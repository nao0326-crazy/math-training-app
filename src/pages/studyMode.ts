import type { Category } from '../types/problem';
import type { StudyMode } from '../engine/selector/types';

/**
 * 学習方法の解決 (既存関数の維持)
 *
 * 通常モード (学習者) は完全ランダム出題だけなので、この関数を
 * 通さない。既存の「すべての問題 / 苦手復習」の組み合わせを壊さないため、
 * 旧セレクター (RandomSelector / QuestionSelector / WeakSelector) と
 * 言われたときの受け皿として残してある。
 *
 * - random : 通常の完全ランダム学習 (全出題可能母集団からランダム)
 * - weak   : 苦手復習 (回答履歴から復習対象を決める)
 *
 * 管理者モードで分野を指定する場合は QuestionFilter として表現し、
 * StudyMode は変えない (通常モードの型と画面選択の型を混ぜない)。
 */
export type StudyKind = 'all' | 'weak';

/**
 * 学習方法と選択カテゴリから、出題モードとカテゴリを解決する
 *
 * カテゴリ選択と学習方法が矛盾しないように、
 * どちらのセレクターを使うか (StudyMode) と
 * どちらのカテゴリを渡すかをここで一度に決める。
 *
 * - all  + カテゴリなし -> random / null (完全ランダム)
 * - all  + カテゴリあり -> category / そのカテゴリ (QuestionSelector)
 * - weak                 -> weak / null (カテゴリを勝手に指定しない)
 *
 * 通常モードではカテゴリは必ず null で random になる。
 * カテゴリ指定は管理者モードからのみ渡される。
 */
export function resolveStudyMode(
  kind: StudyKind,
  category: Category | null,
): { studyMode: StudyMode; category: Category | null } {
  if (kind === 'weak') {
    // 苦手復習ではカテゴリを指定しない。WeakSelector が履歴から対象を決める。
    return { studyMode: { kind: 'weak', types: [] }, category: null };
  }
  if (category === null) {
    return { studyMode: { kind: 'random' }, category: null };
  }
  return { studyMode: { kind: 'category', category }, category };
}