/**
 * Selects a problem within the saved app-wide type range, using recent category
 * performance and adaptive difficulty while preserving problem diversity.
 */

import type { AnswerRecord, QuestionHistory } from '../../types/history';
import type {
  Category,
  DifficultyLevel,
  DifficultyRange,
  GenerationConfig,
  Problem,
} from '../../types/problem';
import { generateProblem, getAllGenerators } from './generatorRegistry';
import { getTypeSupportedLevels } from '../diversity/metadata';
import { snapToAvailableLevel } from '../../utils/adaptiveDifficulty';
import { nextAutoSeed } from '../../utils/random';
import {
  DEFAULT_DIVERSITY_CONFIG,
  buildRecentContext,
  selectBestCandidate,
  type DiversityConfig,
} from '../diversity/diversity';
import { fingerprintProblem } from '../diversity/metadata';

export interface QuestionSelectorConfig {
  /** Number of recent answers used for priority and difficulty. */
  recentHistoryLimit: number;
  /** Number of recent questions considered for duplicate avoidance. */
  duplicateAvoidanceCount: number;
  /** Accuracy contribution to category priority. */
  accuracyWeight: number;
  /** Response-time contribution to category priority. */
  timeWeight: number;
}

export const DEFAULT_SELECTOR_CONFIG: QuestionSelectorConfig = {
  recentHistoryLimit: 20,
  duplicateAvoidanceCount: 10,
  accuracyWeight: 1.5,
  timeWeight: 0.5,
};

const DEFAULT_DIFFICULTY_RANGE: DifficultyRange = { min: 1, max: 5 };

interface CategoryPerformance {
  category: Category;
  priorityScore: number;
}

const NEUTRAL_CATEGORY_PRIORITY = 1;

/** Available generator levels after applying the saved type and difficulty constraints. */
export function getAvailableDifficultyLevels(
  problemTypes: readonly string[] | undefined,
  difficultyRange: DifficultyRange = DEFAULT_DIFFICULTY_RANGE,
  category: Category | null = null,
): DifficultyLevel[] {
  if (
    !isDifficultyLevel(difficultyRange.min) ||
    !isDifficultyLevel(difficultyRange.max) ||
    difficultyRange.min > difficultyRange.max
  ) {
    return [];
  }

  const configuredTypes = problemTypes === undefined ? null : new Set(problemTypes);
  const levels = new Set<DifficultyLevel>();
  for (const generator of getAllGenerators()) {
    if (
      (configuredTypes !== null && !configuredTypes.has(generator.type)) ||
      (category !== null && generator.category !== category)
    ) {
      continue;
    }
    for (const level of getTypeSupportedLevels(generator.type)) {
      if (level >= difficultyRange.min && level <= difficultyRange.max) levels.add(level);
    }
  }
  return [...levels].sort((a, b) => a - b);
}

export class QuestionSelector {
  private config: QuestionSelectorConfig;

  constructor(config: Partial<QuestionSelectorConfig> = {}) {
    this.config = { ...DEFAULT_SELECTOR_CONFIG, ...config };
  }

  selectNextQuestion(
    history: AnswerRecord[],
    questionHistory: QuestionHistory[],
    settings: {
      difficultyLevel: number;
      category: Category | null;
      /** Saved app-wide range. Omitted only for callers that intentionally use the full pool. */
      problemTypes?: readonly string[];
      difficultyRange?: DifficultyRange;
    },
  ): Problem {
    const difficultyRange = settings.difficultyRange ?? DEFAULT_DIFFICULTY_RANGE;
    const availableLevels = getAvailableDifficultyLevels(
      settings.problemTypes,
      difficultyRange,
      settings.category,
    );
    if (settings.problemTypes?.length === 0) {
      throw new Error('出題範囲が設定されていません。管理者タブで範囲を設定してください。');
    }
    if (availableLevels.length === 0) {
      throw new Error(
        `現在の難易度で出題できる問題がありません（設定範囲：Lv${difficultyRange.min}〜Lv${difficultyRange.max}）。`,
      );
    }
    const requestedDifficulty = this.adjustDifficulty(history, settings.difficultyLevel);
    const boundedDifficulty = Math.min(
      difficultyRange.max,
      Math.max(difficultyRange.min, requestedDifficulty),
    ) as DifficultyLevel;
    const adjustedDifficulty = snapToAvailableLevel(boundedDifficulty, availableLevels);
    const configuredTypes =
      settings.problemTypes === undefined ? null : new Set(settings.problemTypes);
    const availableGenerators = getAllGenerators().filter(
      (generator) =>
        (configuredTypes === null || configuredTypes.has(generator.type)) &&
        (settings.category === null || generator.category === settings.category) &&
        getTypeSupportedLevels(generator.type).includes(adjustedDifficulty),
    );
    if (availableGenerators.length === 0) {
      throw new Error('設定された出題範囲から問題を生成できるタイプがありません。');
    }

    const typesByCategory = new Map<Category, string[]>();
    for (const generator of availableGenerators) {
      const types = typesByCategory.get(generator.category) ?? [];
      types.push(generator.type);
      typesByCategory.set(generator.category, types);
    }

    const eligibleCategories = [...typesByCategory.keys()];
    const performances = this.calculateCategoryPerformance(history, eligibleCategories);
    const categoryOrder =
      settings.category === null
        ? this.orderCategoriesByPriority(performances)
        : [settings.category];

    const diversityConfig: DiversityConfig = {
      ...DEFAULT_DIVERSITY_CONFIG,
      duplicateAvoidanceCount: this.config.duplicateAvoidanceCount,
      recentWindow: this.config.recentHistoryLimit,
    };
    const context = buildRecentContext(questionHistory, diversityConfig);
    const recentTypes = new Set(
      questionHistory
        .slice(-this.config.duplicateAvoidanceCount)
        .map((record) => record.problemType),
    );

    for (const category of categoryOrder) {
      const categoryTypes = typesByCategory.get(category);
      if (!categoryTypes?.length) continue;

      const preferredTypes = categoryTypes.filter((type) => !recentTypes.has(type));
      let candidates = this.generateCandidates(
        preferredTypes.length > 0 ? preferredTypes : categoryTypes,
        adjustedDifficulty,
        context.fingerprints,
        diversityConfig,
      );

      if (candidates.length === 0 && preferredTypes.length > 0) {
        candidates = this.generateCandidates(
          categoryTypes,
          adjustedDifficulty,
          context.fingerprints,
          diversityConfig,
        );
      }

      if (candidates.length > 0) {
        const chosen = selectBestCandidate(candidates, context, diversityConfig);
        return chosen ? chosen.candidate : candidates[0];
      }
    }

    throw new Error('設定された出題範囲から問題を生成できませんでした。');
  }

  private calculateCategoryPerformance(
    history: AnswerRecord[],
    availableCategories: Category[],
  ): CategoryPerformance[] {
    const eligibleCategories = new Set(availableCategories);
    const byCategory = new Map<Category, AnswerRecord[]>();
    for (const record of history.slice(-this.config.recentHistoryLimit)) {
      const category = record.category as Category;
      if (!eligibleCategories.has(category)) continue;
      const records = byCategory.get(category) ?? [];
      records.push(record);
      byCategory.set(category, records);
    }

    return availableCategories.map((category) => {
      const records = byCategory.get(category) ?? [];
      if (records.length === 0) {
        return { category, priorityScore: NEUTRAL_CATEGORY_PRIORITY };
      }

      const correctCount = records.filter((record) => record.isCorrect).length;
      const accuracyRate = correctCount / records.length;
      const averageTimeSec =
        records.reduce((sum, record) => sum + record.answerTimeSec, 0) / records.length;
      return {
        category,
        priorityScore:
          (1 - accuracyRate) * this.config.accuracyWeight +
          (averageTimeSec / 60) * this.config.timeWeight,
      };
    });
  }

  /** Weighted sampling without replacement provides a category-priority retry order. */
  private orderCategoriesByPriority(performances: CategoryPerformance[]): Category[] {
    const remaining = [...performances];
    const ordered: Category[] = [];

    while (remaining.length > 0) {
      const totalWeight = remaining.reduce(
        (sum, performance) => sum + Math.max(0, performance.priorityScore),
        0,
      );
      let selectedIndex: number;
      if (totalWeight === 0) {
        selectedIndex = Math.floor(Math.random() * remaining.length);
      } else {
        let threshold = Math.random() * totalWeight;
        selectedIndex = remaining.findIndex((performance) => {
          threshold -= Math.max(0, performance.priorityScore);
          return threshold < 0;
        });
        if (selectedIndex < 0) selectedIndex = remaining.length - 1;
      }

      ordered.push(remaining[selectedIndex].category);
      remaining.splice(selectedIndex, 1);
    }

    return ordered;
  }

  private generateCandidates(
    types: string[],
    difficulty: DifficultyLevel,
    recentFingerprints: Set<string>,
    diversityConfig: DiversityConfig,
  ): Problem[] {
    if (types.length === 0) return [];

    const candidates: Problem[] = [];
    const seenFingerprints = new Set(recentFingerprints);
    const maxAttempts = diversityConfig.candidateCount * 4;
    const startIndex = Math.floor(Math.random() * types.length);

    for (let attempts = 0; attempts < maxAttempts; attempts++) {
      if (candidates.length >= diversityConfig.candidateCount) break;
      const type = types[(startIndex + attempts) % types.length];
      let problem: Problem;
      try {
        const config: GenerationConfig = {
          type,
          difficulty,
          seed: nextAutoSeed(),
        };
        problem = generateProblem(config);
      } catch {
        continue;
      }
      const fingerprint = fingerprintProblem(problem);
      if (seenFingerprints.has(fingerprint)) continue;
      seenFingerprints.add(fingerprint);
      candidates.push(problem);
    }

    return candidates;
  }

  private adjustDifficulty(history: AnswerRecord[], baseLevel: number): DifficultyLevel {
    const recent = history.slice(-this.config.recentHistoryLimit);
    if (recent.length < 5) {
      return baseLevel as DifficultyLevel;
    }

    const correctCount = recent.filter((record) => record.isCorrect).length;
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

function isDifficultyLevel(value: number): value is DifficultyLevel {
  return value === 1 || value === 2 || value === 3 || value === 4 || value === 5;
}
