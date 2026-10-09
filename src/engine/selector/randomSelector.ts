/**
 * 全カテゴリ横断の通常ランダム出題セレクター
 *
 * 既存の QuestionSelector (カテゴリ指定学習) と同じ多様性制御
 * (重複回避・family 連続抑制・類似度) を共有し、
 * 「どのカテゴリ・どの Generator を出題するか」だけ Decide する。
 *
 * 抽選は2段構成:
 *   1. 指定難易度で実際に生成可能なカテゴリだけを等確率で抽選
 *   2. 抽選したカテゴリ内の Generator を等確率で抽選
 *
 * カテゴリ抽選に Generator 数 (geometry は24個で全体の26%) を重みに
 * していないのは、Generator の多いカテゴリが構造的に有利になり
 * 特定カテゴリに偏るためです。カテゴリはひとまず等確率。
 */

import type { DifficultyLevel, Problem } from '../../types/problem';
import type { AnswerRecord, QuestionHistory } from '../../types/history';
import {
  DEFAULT_DIVERSITY_CONFIG,
  buildRecentContext,
  selectBestCandidate,
  type DiversityConfig,
} from '../diversity/diversity';
import { fingerprintProblem, getTypeSupportedLevels } from '../diversity/metadata';
import { generateProblem, getAllGenerators, getGeneratorByType } from './generatorRegistry';
import type { ProblemSelector, SelectionRequest } from './types';

/**
 * 候補生成の設定
 *
 * 抽選処理 (chooseCandidate) と重み設定 (この型) を分離し、
 * 将来カテゴリごとの重みを調整できるようにしている。
 */
export interface RandomSelectorConfig {
  /** 直近履歴を何件まで考慮するか */
  recentHistoryLimit: number;
  /** 重複を避けるために考慮する最近の問題数 */
  duplicateAvoidanceCount: number;
  /** 1回の出題で生成する候補数 */
  candidateCount: number;
  /**
   * カテゴリ抽選の上限試行回数。
   * 抽選したカテゴリ内の Generator が全滅でも、候補が必ず残るようにする。
   */
  maxCategoryAttempts: number;
}

export const DEFAULT_RANDOM_SELECTOR_CONFIG: RandomSelectorConfig = {
  recentHistoryLimit: 20,
  duplicateAvoidanceCount: 10,
  candidateCount: 6,
  maxCategoryAttempts: 12,
};

/** 生成可能な Generator がない場合に投げるエラー */
export class NoViableGeneratorError extends Error {
  /** 除外された理由 (type とその lv) */
  readonly excluded: { type: string; difficulty: DifficultyLevel; reason: string }[];

  constructor(
    difficulty: DifficultyLevel,
    excluded: { type: string; difficulty: DifficultyLevel; reason: string }[],
  ) {
    const detail = excluded
      .slice(0, 8)
      .map((e) => `${e.type}(lv${e.difficulty}: ${e.reason})`)
      .join(', ');
    super(
      `難易度${difficulty}で出題可能なGeneratorがありません。` +
        `除外された候補: ${detail}${excluded.length > 8 ? ` ほか${excluded.length - 8}件` : ''}`,
    );
    this.name = 'NoViableGeneratorError';
    this.excluded = excluded;
  }
}

/** 抽選結果を表す型 */
export interface CandidateChoice {
  category: string;
  type: string;
}

/**
 * 指定難易度で実際に生成できる Generator だけを集めたカテゴリ別インデックス
 *
 * getTypeSupportedLevels の宣言値を候補判定に使う。宣言値は
 * Phase 0 の実測 (各 lv を複数 seed で実際に生成) と一致済みで、
 * 「その難易度で一致する問題を返せる」型だけを列挙している。
 */
export function buildViableGeneratorsByCategory(
  difficulty: DifficultyLevel,
  generators = getAllGenerators(),
): Map<string, string[]> {
  const byCategory = new Map<string, string[]>();

  for (const g of generators) {
    // 宣言に含まれない難易度は最初から候補にしない。
    if (!getTypeSupportedLevels(g.type).includes(difficulty)) continue;
    const list = byCategory.get(g.category) ?? [];
    list.push(g.type);
    byCategory.set(g.category, list);
  }

  return byCategory;
}

/**
 * カテゴリ -> Generator を抽選する
 *
 * カテゴリは等確率 (Generator 数は重みにしない)。
 * 直近に出題したカテゴリには軽い重み低下を掛けるが、
 * 除外はしない (候補が枯渇させないため)。
 */
export function chooseCandidate(
  viableByCategory: Map<string, string[]>,
  recentCategories: string[],
  random: () => number,
): CandidateChoice | null {
  const categories = [...viableByCategory.keys()];
  if (categories.length === 0) return null;

  const weights = categories.map((category) =>
    recentCategories.includes(category) ? 0.5 : 1,
  );
  const total = weights.reduce((sum, w) => sum + w, 0);
  if (total <= 0) return null;

  let roll = random() * total;
  let picked = categories[categories.length - 1];
  for (let i = 0; i < categories.length; i++) {
    roll -= weights[i];
    if (roll <= 0) {
      picked = categories[i];
      break;
    }
  }

  const types = viableByCategory.get(picked);
  if (!types || types.length === 0) return null;

  // カテゴリ内は等確率
  const index = Math.min(types.length - 1, Math.floor(random() * types.length));
  return { category: picked, type: types[index] };
}

export class RandomSelector implements ProblemSelector {
  private config: RandomSelectorConfig;

  constructor(config: Partial<RandomSelectorConfig> = {}) {
    this.config = { ...DEFAULT_RANDOM_SELECTOR_CONFIG, ...config };
  }
  /**
   * Next problem across every category.
   *
   * `history` is required by the shared ProblemSelector interface but is not
   * referenced here: random study picks categories uniformly instead of deriving
   * them from answer history. It stays in the signature for the `weak` mode
   * implementation that will use it.
   */
  selectNextQuestion(
    _history: AnswerRecord[],
    questionHistory: QuestionHistory[],
    request: SelectionRequest,
  ): Problem {
    const { difficulty } = request;
    const viable = buildViableGeneratorsByCategory(difficulty);
    if (viable.size === 0) {
      // 全カテゴリが生成不能だった場合。どの型がなぜ落ちたかを明示して出す。
      const excluded = getAllGenerators().map((g) => ({
        type: g.type,
        difficulty,
        reason: 'supportedLevels に含まれない',
      }));
      throw new NoViableGeneratorError(difficulty, excluded);
    }

    const diversityConfig: DiversityConfig = {
      ...DEFAULT_DIVERSITY_CONFIG,
      duplicateAvoidanceCount: this.config.duplicateAvoidanceCount,
      recentWindow: this.config.recentHistoryLimit,
      candidateCount: this.config.candidateCount,
    };
    const ctx = buildRecentContext(questionHistory, diversityConfig);

    // 直近カテゴリへの連続回避。この粗い側 (カテゴリ単位) を担い、
    // より細かい「直近の同一 type ペナルティ」は diversity.ts が担う。
    // 同じ問題を二重に評価しないよう役割を分離している。
    const recentCategories = ctx.entries.slice(0, 3).map((e) => {
      const gen = getGeneratorByType(e.problemType);
      return gen?.category ?? '';
    });

    const seenFingerprints = new Set(ctx.fingerprints);
    const candidates: Problem[] = [];
    const failures: { type: string; difficulty: DifficultyLevel; reason: string }[] = [];

    // 上限回数を設けることで再抽選の無限ループを防ぐ。
    // 1 Generator の失敗で全体を止めず、他カテゴリは試行し続ける。
    for (let attempt = 0; attempt < this.config.maxCategoryAttempts; attempt++) {
      if (candidates.length >= this.config.candidateCount) break;

      const choice = chooseCandidate(viable, recentCategories, Math.random);
      if (!choice) break;

      let problem: Problem;
      try {
        problem = generateProblem({ type: choice.type, difficulty });
      } catch (e) {
        failures.push({
          type: choice.type,
          difficulty,
          reason: e instanceof Error ? e.message.slice(0, 60) : 'unknown',
        });
        continue;
      }

      if (problem.difficulty.level !== difficulty) {
        failures.push({
          type: choice.type,
          difficulty,
          reason: `requested lv${difficulty} but got lv${problem.difficulty.level}`,
        });
        continue;
      }

      const fp = fingerprintProblem(problem);
      if (seenFingerprints.has(fp)) continue;
      seenFingerprints.add(fp);
      candidates.push(problem);
    }

    if (candidates.length === 0) {
      if (failures.length > 0) throw new NoViableGeneratorError(difficulty, failures);
      // 重複回避で全滅した場合 (直近と同じ問題しか出ない) は、
      // 学習を止めないことを優先して重複を無視して1問返す。
      return generateProblem({ difficulty });
    }

    const chosen = selectBestCandidate(candidates, ctx, diversityConfig);
    return chosen ? chosen.candidate : candidates[0];
  }
}
