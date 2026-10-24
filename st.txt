/**
 * 出題セレクターの共通型定義
 *
 * 学習モード (何を出題するか) を型で区別し、
 * セレクター実装を差し替えられるようにする。
 *
 * 【重要】通常学習モードは廃止済み。画面 (HomePage / App) から起動できる
 * モードは 'filtered' のみであり、createQuizSelector も 'filtered' 以外を
 * 拒否する。以下の旧モード種別 (adaptive / full-random / random / weak /
 * category) は、UI から到達できないエンジン層の既存セレクターとその回帰
 * テストを型のまま維持するために残している (新規 UI からは使わない)。
 */

import type { Category, DifficultyLevel, Problem } from '../../types/problem';
import type { AnswerRecord, QuestionHistory } from '../../types/history';
import type { QuestionFilter } from './questionPool';

/**
 * 学習モード
 *
 * - filtered    : 唯一 UI から起動できるモード。管理者が出題範囲
 *                 (分野・カテゴリ・問題タイプ・難易度・難易度範囲) を設定し、
 *                 その条件に一致する母集団から一様ランダムに出題する。
 *                 学習履歴や苦手度による重み付けは行わない。
 *                 空の条件でも「絞り込みなし (全出題可能範囲)」として扱う。
 * - adaptive    : 旧通常モード (分野指定・適応難易度)。UI からは起動不可。
 * - full-random : 旧完全ランダムモード。UI からは起動不可。
 * - random      : 旧 RandomSelector。UI からは起動不可。
 * - weak        : 旧苦手復習 (WeakSelector)。UI からは起動不可
 *                 (復習も filtered + カテゴリ絞り込みで出題する)。
 * - category    : 旧カテゴリ指定学習。UI からは起動不可。
 */
export type StudyMode =
  | { kind: 'adaptive'; area: string }
  | { kind: 'full-random' }
  | { kind: 'filtered'; filter: QuestionFilter }
  | { kind: 'random' }
  | { kind: 'weak'; types: string[] }
  | { kind: 'category'; category: Category };

/** 出題要求 */
export interface SelectionRequest {
  mode: StudyMode;
  difficulty: DifficultyLevel;
}

/**
 * 出題セレクターの共通インタフェース
 *
 * 履歴 (回答履歴・出題履歴) と要求から、次の1問を選び返す。
 */
export interface ProblemSelector {
  selectNextQuestion(
    history: AnswerRecord[],
    questionHistory: QuestionHistory[],
    request: SelectionRequest,
  ): Problem;
}