/**
 * 完全ランダム出題セレクター (通常モードの標準)
 *
 * 責務は1つ: 母集団 (questionPool) から generator を等確率で選び、
 * その1問を生成して返すこと。
 *
 * 方針:
 * - 母集団は「アプリに登録されている全 generator」。学年・分野・
 *   問題タイプ・難易度のいずれも指定側に依存しない。
 * - 母集団のどの要素も等確率 (generator 数による重み付けもしない)。
 *   分野を均等にするためのローテーションも、一定間隔の分野固定もしない。
 * - 重複回避は最小限のみ。直前の問題と「完全に同一の問題」になる、
 *   あるいは「直前と同じ generator (同一生成条件)」が連続する場合に
 *   だけ再抽選する。それ以外の重複は許容する。
 */

import type { DifficultyLevel, Problem } from '../../types/problem';
import type { AnswerRecord, QuestionHistory } from '../../types/history';
import { fingerprintProblem } from '../diversity/metadata';
import { generateProblem } from './generatorRegistry';
import { buildQuestionPool, EmptyQuestionPoolError } from './questionPool';
import type { ProblemSelector, SelectionRequest } from './types';

export interface FullRandomSelectorConfig {
  /** 再抽選の上限回数 */
  maxAttempts: number;
  /** 母集団をキャッシュする (既定 true) */
  poolCache?: boolean;
}

export const DEFAULT_FULL_RANDOM_SELECTOR_CONFIG: FullRandomSelectorConfig = {
  maxAttempts: 12,
};

/** 対応難易度の中から1つ選ぶ (未宣言の型は lv1〜5 を持つ) */
export function randomLevelOf(
  levels: readonly DifficultyLevel[],
  random: () => number = Math.random,
): DifficultyLevel {
  if (levels.length === 0) return 2;
  return levels[Math.floor(random() * levels.length)];
}

export class FullRandomSelector implements ProblemSelector {
  private config: FullRandomSelectorConfig;
  private cachedPool: ReturnType<typeof buildQuestionPool> | null = null;

  constructor(config: Partial<FullRandomSelectorConfig> = {}) {
    this.config = { ...DEFAULT_FULL_RANDOM_SELECTOR_CONFIG, ...config };
  }

  /** 出題母集団 (全 generator) */
  private pool(): ReturnType<typeof buildQuestionPool> {
    if (this.config.poolCache === false) return buildQuestionPool();
    this.cachedPool ??= buildQuestionPool();
    return this.cachedPool;
  }

  /**
   * 母集団から等確率で1問選んで生成する
   *
   * request.difficulty は通常モードでは選出条件にしない。
   * 生成される問題の難易度は、その型が対応する範囲からランダムに決まる。
   */
  selectNextQuestion(
    _history: AnswerRecord[],
    questionHistory: QuestionHistory[],
    request: SelectionRequest,
  ): Problem {
    // request.difficulty は通常モードでは選出条件に使わない。
    // (指定難易度が母集団の絞り込みに混ざらないことを明示しておく)
    void request;
    const pool = this.pool();
    if (pool.length === 0) throw new EmptyQuestionPoolError(null);

    const last = questionHistory[questionHistory.length - 1];
    const lastFingerprint = last?.fingerprint;
    const lastType = last?.problemType;

    let fallback: Problem | null = null;
    const failures: string[] = [];

    for (let attempt = 0; attempt < this.config.maxAttempts; attempt++) {
      const entry = pool[Math.floor(Math.random() * pool.length)];
      const level = randomLevelOf(entry.supportedLevels);

      let problem: Problem;
      try {
        problem = generateProblem({ type: entry.type, difficulty: level });
      } catch (e) {
        // この型・この難易度では生成できない種がある (既存仕様)。
        // 記録を取って次の抽選へ進む (無限ループは maxAttempts で防ぐ)。
        failures.push(
          `${entry.type} lv${level}: ${e instanceof Error ? e.message.slice(0, 50) : 'unknown'}`,
        );
        continue;
      }

      if (!fallback) fallback = problem;

      // 直前の問題と完全に同一なら続けて出題しない
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
    err.message += ` 生成失敗: ${failures.slice(0, 3).join(' / ')}`;
    throw err;
  }
}
