/**
 * 出題セレクターの組み立て
 *
 * QuizPage から「どのセレクターを使うか」を切り離し、
 * UI と同じ優先順位を 1か所で定義する (テストから直接検証できるようにする)。
 */

import { FilteredSelector } from '../engine/selector/filteredSelector';
import type { ProblemSelector, StudyMode } from '../engine/selector/types';
import type { QuestionFilter } from '../engine/selector/questionPool';
import type { DifficultyLevel } from '../types/problem';

/** 画面とセレクターが共有する「出題の意図」 */
export interface QuizSelection {
  /** 学習モード (常に 'filtered') */
  studyMode: StudyMode;
  /**
   * 難易度 (filtered モードでは出題決定に使わない)。
   * 出題レベルは技能ごとの習熟度から自動決定される。
   * 型互換のためこのフィールド自体は残している。
   */
  difficulty: number;
  /** 絞り込み条件 (管理者が設定した出題範囲) */
  filter: QuestionFilter | null;
}

/**
 * 学習モードと指定内容からセレクターを1つ選ぶ。
 *
 * すべての学習で FilteredSelector を使用し、管理者が設定した
 * 出題範囲 (filter) を厳密に適用する。出題レベルは FilteredSelector が
 * 学習履歴から推定した技能ごとの習熟度の一段上を自動で選ぶ。
 * 通常モード (full-random / adaptive / category など) は存在しない。
 */
export function createQuizSelector(selection: QuizSelection): ProblemSelector {
  const { studyMode, filter } = selection;

  if (studyMode.kind !== 'filtered') {
    throw new Error(`未対応の学習モードです: ${String(studyMode.kind)}`);
  }
  return new FilteredSelector(filter ?? {});
}

/** 難易度指定を型付きの値へ変換する (既存セレクターの要求値に合わせる) */
export function toDifficultyLevel(value: number): DifficultyLevel {
  const level = Math.min(5, Math.max(1, Math.round(value)));
  return level as DifficultyLevel;
}