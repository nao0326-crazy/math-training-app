/**
 * 分野別・適応難易度セレクター (通常モードの標準)
 *
 * 責務:
 * 1. 母集団を「指定された分野 (curriculumScope.area)」だけに絞る
 * 2. 回答履歴から次の1問の難易度を毎回決める (decideAdaptiveDifficulty)
 * 3. その難易度を生成できる generator の中から等確率で選び、
 *    FullRandomSelector と同じ最小限の重複回避で生成する
 *    (直前の問題と完全同一 / 直前と同じ generator の連続を避ける)。
 *    セッション全体の fingerprint 重複禁止ではない (母集団が狭い分野では
 *    同一問題の再出題があり得る)。適応難易度の正しさを優先し、
 *    この最小限仕様を維持する。
 *
 * 方針:
 * - 難易度は分野ごとに独立して評価される (このセレクターは1分野専用)。
 * - request.difficulty は使わない (難易度は履歴から決まる)。
 * - リロード後の復元はしない。渡された履歴の範囲で毎回判断する。
 */

import type { DifficultyLevel, Problem } from '../../types/problem';
import type { AnswerRecord, QuestionHistory } from '../../types/history';
import { getCurriculumScope } from '../curriculum/curriculumScope';
import { fingerprintProblem } from '../diversity/metadata';
import { generateProblem } from './generatorRegistry';
import {
  buildQuestionPool,
  EmptyQuestionPoolError,
  type QuestionPoolEntry,
} from './questionPool';
import type { ProblemSelector, SelectionRequest } from './types';
import {
  decideAdaptiveDifficulty,
  snapToAvailableLevel,
} from '../../utils/adaptiveDifficulty';

export interface AdaptiveSelectorConfig {
  /** 再抽選の上限回数 */
  maxAttempts: number;
  /** 母集団をキャッシュする (既定 true) */
  poolCache?: boolean;
}

export const DEFAULT_ADAPTIVE_SELECTOR_CONFIG: AdaptiveSelectorConfig = {
  maxAttempts: 12,
};

export class AdaptiveSelector implements ProblemSelector {
  private area: string;
  private config: AdaptiveSelectorConfig;
  private cachedPool: QuestionPoolEntry[] | null = null;

  constructor(area: string, config: Partial<AdaptiveSelectorConfig> = {}) {
    this.area = area;
    this.config = { ...DEFAULT_ADAPTIVE_SELECTOR_CONFIG, ...config };
  }

  /** 出題母集団 (その分野に属する generator のみ) */
  private pool(): QuestionPoolEntry[] {
    if (this.config.poolCache === false) return this.buildPool();
    this.cachedPool ??= this.buildPool();
    return this.cachedPool;
  }

  private buildPool(): QuestionPoolEntry[] {
    return buildQuestionPool().filter(
      (entry) => getCurriculumScope(entry.type)?.area === this.area,
    );
  }

  /** その分野で生成可能な難易度 (generator の supportedLevels の和集合) */
  availableLevels(): DifficultyLevel[] {
    const levels = new Set<DifficultyLevel>();
    for (const entry of this.pool()) {
      for (const level of entry.supportedLevels) levels.add(level);
    }
    return [...levels].sort((a, b) => a - b);
  }

  /**
   * 分野の履歴から難易度を決めて1問生成する
   *
   * request.difficulty は使わない (adaptive では難易度が履歴から決まる)。
   */
  selectNextQuestion(
    history: AnswerRecord[],
    questionHistory: QuestionHistory[],
    request: SelectionRequest,
  ): Problem {
    void request;
    const pool = this.pool();
    if (pool.length === 0) {
      const err = new EmptyQuestionPoolError(null);
      err.message += ` 分野「${this.area}」に対応する問題がありません。`;
      throw err;
    }

    // 分野ごとの適応難易度 (履歴が無ければ初期 Lv2、生成可能範囲へ丸め)
    const available = this.availableLevels();
    const level = decideAdaptiveDifficulty(this.area, history, available);

    // その難易度を生成できる generator だけを候補にする
    const candidates = pool.filter((entry) => entry.supportedLevels.includes(level));
    // snap により空にはならないはずだが、防御として全件へフォールバックする
    const entries = candidates.length > 0 ? candidates : pool;

    const last = questionHistory[questionHistory.length - 1];
    const lastFingerprint = last?.fingerprint;
    const lastType = last?.problemType;

    let fallback: Problem | null = null;
    const failures: string[] = [];

    for (let attempt = 0; attempt < this.config.maxAttempts; attempt++) {
      const entry = entries[Math.floor(Math.random() * entries.length)];
      // 候補に絞れた時点で entry は level を持つ。フォールバック時のみ再丸め。
      const levelForEntry: DifficultyLevel = entry.supportedLevels.includes(level)
        ? level
        : snapToAvailableLevel(level, entry.supportedLevels);

      let problem: Problem;
      try {
        problem = generateProblem({ type: entry.type, difficulty: levelForEntry });
      } catch (e) {
        // この型・この難易度では生成できない種がある (既存仕様)。
        failures.push(
          `${entry.type} lv${levelForEntry}: ${e instanceof Error ? e.message.slice(0, 50) : 'unknown'}`,
        );
        continue;
      }

      if (!fallback) fallback = problem;

      // 直前の問題と完全同一なら続けて出題しない
      if (lastFingerprint && fingerprintProblem(problem) === lastFingerprint) continue;
      // 直前と同じ generator (同一生成条件) の連続も避ける
      if (lastType && problem.type === lastType) continue;

      return problem;
    }

    // 再抽選上限まで使っても条件に合う問題が出なかった場合。
    // 学習を止めないことを優先して、手持ちの問題をそのまま返す。
    if (fallback) return fallback;

    // 全抽選が生成失敗した場合のみここへ到達する。
    const err = new EmptyQuestionPoolError(null);
    err.message += ` 分野「${this.area}」 生成失敗: ${failures.slice(0, 3).join(' / ')}`;
    throw err;
  }
}