/**
 * 出題アルゴリズム
 * 以下の要素を考慮して次の問題を選択する
 * - 苦手な分野
 * - 最近の正答率
 * - 解答時間
 * - 現在の難易度
 * - 最近出題した問題
 *
 * 最初のバージョンではシンプルな重み付け方式で実装し、
 * 拡張可能な構造にする
 */

import type { AnswerRecord, QuestionHistory } from '../../types/history';
import type { Category, DifficultyLevel, GenerationConfig, Problem } from '../../types/problem';
import { generateProblem } from './generatorRegistry';

/**
 * 出題選択の設定
 */
export interface QuestionSelectorConfig {
  /** 最近の履歴を何件まで考慮するか */
  recentHistoryLimit: number;
  /** 重複を避けるために考慮する最近の問題数 */
  duplicateAvoidanceCount: number;
  /** 苦手分野の優先度の重み */
  weakCategoryWeight: number;
  /** 正答率の重み */
  accuracyWeight: number;
  /** 解答時間の重み */
  timeWeight: number;
  /** 難易度の重み */
  difficultyWeight: number;
}

/**
 * デフォルト設定
 */
export const DEFAULT_SELECTOR_CONFIG: QuestionSelectorConfig = {
  recentHistoryLimit: 20,
  duplicateAvoidanceCount: 10,
  weakCategoryWeight: 2.0,
  accuracyWeight: 1.5,
  timeWeight: 0.5,
  difficultyWeight: 1.0,
};

/**
 * カテゴリ別の成績
 */
interface CategoryPerformance {
  category: Category;
  totalCount: number;
  correctCount: number;
  accuracyRate: number;
  averageTimeSec: number;
  /** スコアが低いほど優先して出題する */
  priorityScore: number;
}

/**
 * 出題アルゴリズム
 */
export class QuestionSelector {
  private config: QuestionSelectorConfig;

  constructor(config: Partial<QuestionSelectorConfig> = {}) {
    this.config = { ...DEFAULT_SELECTOR_CONFIG, ...config };
  }

  /**
   * 次の問題を選択して生成する
   */
  selectNextQuestion(
    history: AnswerRecord[],
    questionHistory: QuestionHistory[],
    settings: {
      difficultyLevel: number;
      category: Category | null;
    },
  ): Problem {
    // カテゴリ別の成績を計算
    const performances = this.calculateCategoryPerformance(history);

    // カテゴリを選択
    const selectedCategory = this.selectCategory(performances, settings.category);

    // 最近出題した問題タイプを取得 (重複回避用)
    const recentTypes = new Set(
      questionHistory
        .slice(-this.config.duplicateAvoidanceCount)
        .map((q) => q.problemType),
    );

    // 難易度を調整
    const adjustedDifficulty = this.adjustDifficulty(history, settings.difficultyLevel);

    // 問題を生成
    const config: GenerationConfig = {
      category: selectedCategory,
      difficulty: adjustedDifficulty,
    };

    // 重複を避けるため、最近出題したタイプを避けて生成を試みる
    for (let attempt = 0; attempt < 5; attempt++) {
      const problem = generateProblem(config);
      if (!recentTypes.has(problem.type)) {
        return problem;
      }
    }

    // それでも重複する場合は最後に生成した問題を返す
    return generateProblem(config);
  }

  /**
   * カテゴリ別の成績を計算する
   */
  private calculateCategoryPerformance(history: AnswerRecord[]): CategoryPerformance[] {
    const recent = history.slice(-this.config.recentHistoryLimit);
    const byCategory = new Map<Category, AnswerRecord[]>();

    for (const record of recent) {
      const category = record.category as Category;
      const list = byCategory.get(category) ?? [];
      list.push(record);
      byCategory.set(category, list);
    }

    const performances: CategoryPerformance[] = [];
    for (const [category, records] of byCategory) {
      const correctCount = records.filter((r) => r.isCorrect).length;
      const totalCount = records.length;
      const accuracyRate = totalCount > 0 ? correctCount / totalCount : 0;
      const averageTimeSec =
        totalCount > 0
          ? records.reduce((sum, r) => sum + r.answerTimeSec, 0) / totalCount
          : 0;

      // 優先度スコア (低いほど優先)
      // 正答率が低いほど、解答時間が長いほど優先度が高くなる
      const priorityScore =
        (1 - accuracyRate) * this.config.accuracyWeight +
        (averageTimeSec / 60) * this.config.timeWeight;

      performances.push({
        category,
        totalCount,
        correctCount,
        accuracyRate,
        averageTimeSec,
        priorityScore,
      });
    }

    return performances;
  }

  /**
   * 出題するカテゴリを選択する
   */
  private selectCategory(
    performances: CategoryPerformance[],
    preferredCategory: Category | null,
  ): Category {
    // 指定カテゴリがあればそれを使う
    if (preferredCategory) {
      return preferredCategory;
    }

    // 履歴がない場合はランダム
    if (performances.length === 0) {
      const categories: Category[] = ['integer'];
      return categories[Math.floor(Math.random() * categories.length)];
    }

    // 苦手なカテゴリを優先 (優先度スコアが高いほど選ばれやすい)
    const totalScore = performances.reduce((sum, p) => sum + p.priorityScore, 0);
    if (totalScore <= 0) {
      // 全カテゴリが得意な場合はランダム
      const random = performances[Math.floor(Math.random() * performances.length)];
      return random.category;
    }

    let randomValue = Math.random() * totalScore;
    for (const p of performances) {
      randomValue -= p.priorityScore;
      if (randomValue <= 0) {
        return p.category;
      }
    }
    return performances[performances.length - 1].category;
  }

  /**
   * 難易度を調整する
   * 正答率が高い場合は難易度を上げ、低い場合は下げる
   */
  private adjustDifficulty(history: AnswerRecord[], baseLevel: number): DifficultyLevel {
    const recent = history.slice(-this.config.recentHistoryLimit);
    if (recent.length < 5) {
      return baseLevel as DifficultyLevel;
    }

    const correctCount = recent.filter((r) => r.isCorrect).length;
    const accuracyRate = correctCount / recent.length;

    let adjusted = baseLevel;
    if (accuracyRate >= 0.9) {
      adjusted = Math.min(5, baseLevel + 1);
    } else if (accuracyRate <= 0.4) {
      adjusted = Math.max(1, baseLevel - 1);
    }

    return adjusted as DifficultyLevel;
  }
}