/**
 * 出題セレクターの共通型定義
 *
 * 学習モード (何を出題するか) を型で区別し、
 * セレクター実装を差し替えられるようにする。
 */

import type { Category, DifficultyLevel, Problem } from '../../types/problem';
import type { AnswerRecord, QuestionHistory } from '../../types/history';
import type { QuestionFilter } from './questionPool';

/**
 * 学習モード
 *
 * - adaptive    : 通常モードの標準。分野 (curriculumScope.area) を指定し、
 *                 その分野の母集団から出題する。難易度はその分野の
 *                 回答履歴から毎回決める (adaptiveDifficulty)。
 * - full-random : 全出題可能母集団 (全generator) から1問ずつランダムに出題する。
 *                 学年・分野・問題タイプ・難易度のいずれも指定に依存しない。
 * - filtered    : 管理者モード。学年・分野・問題タイプ・難易度の
 *                 組み合わせで母集団を絞って出題する。
 * - random      : 旧 RandomSelector (指定難易度の全カテゴリ横断)
 * - weak        : 苦手復習 (回答履歴から復習対象を決める)
 * - category    : 旧 QuestionSelector (カテゴリ指定学習。既存挙動を維持)
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