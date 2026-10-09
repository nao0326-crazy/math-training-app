/**
 * 出題セレクターの組み立て
 *
 * QuizPage から「どのセレクターを使うか」を切り離し、
 * UI と同じ優先順位を 1か所で定義する (テストから直接検証できるようにする)。
 */

import type { Category, DifficultyLevel, Problem } from '../types/problem';
import type { AnswerRecord, QuestionHistory } from '../types/history';
import { FullRandomSelector } from '../engine/selector/fullRandomSelector';
import { FilteredSelector } from '../engine/selector/filteredSelector';
import { RandomSelector } from '../engine/selector/randomSelector';
import { QuestionSelector } from '../engine/selector/questionSelector';
import { WeakSelector } from '../engine/selector/weakSelector';
import { AdaptiveSelector } from '../engine/selector/adaptiveSelector';
import type { ProblemSelector, SelectionRequest, StudyMode } from '../engine/selector/types';
import type { QuestionFilter } from '../engine/selector/questionPool';

/**
 * 旧 QuestionSelector を共通 ProblemSelector インタフェースへ包むアダプター
 *
 * QuestionSelector 自体は変更しない (既存のカテゴリ指定学習と
 * 既存テストをそのまま保つため)。新旧のセレクターを同じ型のまま
 * 扱えるようにするのがこのアダプターの役目。
 */
export class LegacyQuestionSelectorAdapter implements ProblemSelector {
  private inner: QuestionSelector;
  private category: Category | null;

  constructor(category: Category | null, inner = new QuestionSelector()) {
    this.inner = inner;
    this.category = category;
  }

  selectNextQuestion(
    history: AnswerRecord[],
    questionHistory: QuestionHistory[],
    request: SelectionRequest,
  ): Problem {
    return this.inner.selectNextQuestion(history, questionHistory, {
      difficultyLevel: request.difficulty,
      category: this.category,
    });
  }
}

/** 画面とセレクターが共有する「出題の意図」 */
export interface QuizSelection {
  /** 学習モード */
  studyMode?: StudyMode;
  /** 旧セレクター互換のカテゴリ指定 (通常モードでは常に null) */
  category: Category | null;
  /** 難易度 (full-random では選出条件に使わない) */
  difficulty: number;
  /** 管理者モード用の絞り込み条件 (通常モードでは常に null) */
  filter?: QuestionFilter | null;
}

/**
 * 学習モードと指定内容からセレクターを1つ選ぶ
 *
 * - adaptive    -> AdaptiveSelector (通常モードの標準: 分野固定・適応難易度)
 * - full-random -> FullRandomSelector
 * - filtered    -> FilteredSelector (管理者モード)
 * - weak        -> WeakSelector
 * - random      -> RandomSelector (旧: 指定難易度の全カテゴリ横断)
 * - category    -> QuestionSelector (旧: カテゴリ指定学習)
 * - 未指定      -> カテゴリがあれば FilteredSelector、無ければ FullRandomSelector
 *                 (通常は「完全ランダム」。カテゴリ指定は管理者モードからのみ来る)
 */
export function createQuizSelector(selection: QuizSelection): ProblemSelector {
  const { studyMode, category, filter } = selection;

  switch (studyMode?.kind) {
    case 'adaptive':
      return new AdaptiveSelector(studyMode.area);
    case 'full-random':
      return new FullRandomSelector();
    case 'filtered':
      return new FilteredSelector(studyMode.filter);
    case 'weak':
      return new WeakSelector();
    case 'random':
      return new RandomSelector();
    case 'category':
      return new LegacyQuestionSelectorAdapter(studyMode.category);
    default:
      break;
  }

  // studyMode が無い場合のフォールバック
  if (filter && Object.values(filter).some((v) => v !== undefined && v !== null)) {
    return new FilteredSelector(filter);
  }
  return category === null ? new FullRandomSelector() : new FilteredSelector({ category });
}

/** 難易度指定を型付きの値へ変換する (既存セレクターの要求値に合わせる) */
export function toDifficultyLevel(value: number): DifficultyLevel {
  const level = Math.min(5, Math.max(1, Math.round(value)));
  return level as DifficultyLevel;
}