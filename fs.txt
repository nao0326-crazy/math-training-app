/**
 * 絞り込み指定セレクター (管理者モード専用)
 *
 * 母集団 (questionPool) に対して filter を適用してから等確率で選ぶ。
 * 「学年・分野・問題タイプ・難易度・難易度範囲」をまとめて指定でき、
 * 学習履歴や苦手度による重み付けは行わない。
 *
 * filter が空 (未指定) の場合も絞り込みを行わず、
 * 全出題可能範囲から等確率で選ぶ (「すべて選択」とは解釈しない)。
 * ただし `types: []` は候補0件として扱う (questionPool.ts 側で処理)。
 */

import type { Problem, DifficultyLevel } from '../../types/problem';
import type { AnswerRecord, QuestionHistory } from '../../types/history';
import { fingerprintProblem } from '../diversity/metadata';
import {
  DEFAULT_DIVERSITY_CONFIG,
  buildRecentContext,
} from '../diversity/diversity';
import { generateProblem } from './generatorRegistry';
import {
  buildQuestionPool,
  EmptyQuestionPoolError,
  filterQuestionPool,
  type QuestionFilter,
} from './questionPool';
import type { ProblemSelector } from './types';

/**
 * セッション内重複を避けるための引き直し上限 (回)。
 *
 * FilteredSelector は絞り込み母集団から等確率抽選するため、狭い母集団
 * (例: 特定タイプ + 特定難易度) では同一問題が連続で出やすい。
 * 直近に出たフィンガープリントと一致しない問題を探すまでこの回数だけ
 * 抽選し直す。母集団サイズが上限より大きい場合は
 * 母集団サイズ分だけ試す。
 */
const FILTERED_REDRAW_ATTEMPTS = 10;

export class FilteredSelector implements ProblemSelector {
  private filter: QuestionFilter;

  constructor(filter: QuestionFilter = {}) {
    this.filter = filter;
  }

  /** このセレクターが保持している絞り込み条件 */
  get selection(): QuestionFilter {
    return this.filter;
  }

  /**
   * 難易度を決定する。
   * - filter.difficulty が指定されていればそれを使う。
   * - filter.difficultyRange が指定されていれば、その範囲内で entry が
   *   対応する難易度の中からランダムに1つ選ぶ。
   * - どちらも指定されていなければ entry.supportedLevels[0] を使う。
   */
  private difficultyOf(
    entry: { supportedLevels: readonly DifficultyLevel[] },
    random: () => number = Math.random,
  ): DifficultyLevel {
    if (this.filter.difficulty) return this.filter.difficulty;
    if (this.filter.difficultyRange) {
      const { min, max } = this.filter.difficultyRange;
      const inRange = entry.supportedLevels.filter(
        (level) => level >= min && level <= max,
      );
      if (inRange.length > 0) return inRange[Math.floor(random() * inRange.length)];
    }
    return entry.supportedLevels[0];
  }

  selectNextQuestion(
    _history: AnswerRecord[],
    questionHistory: QuestionHistory[],
  ): Problem {
    const pool = filterQuestionPool(this.filter, buildQuestionPool());
    if (pool.length === 0) throw new EmptyQuestionPoolError(this.filter);

    // セッション内で「すでに出した問題 (同一フィンガープリント)」を避ける。
    // 狭い候補空間では直近1問だけを見ると2問前・3問前と同じ問題を
    // 連続で出す可能性があるため、buildRecentContext で直近の
    // フィンガープリント集合を作り、それに一致しない問題を選ぶ。
    const recentFingerprints = buildRecentContext(
      questionHistory,
      DEFAULT_DIVERSITY_CONFIG,
    ).fingerprints;

    let firstPick: Problem | null = null;
    const maxAttempts = Math.max(FILTERED_REDRAW_ATTEMPTS, pool.length);

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const target = pool[Math.floor(Math.random() * pool.length)];
      const difficulty = this.difficultyOf(target);

      let problem: Problem;
      try {
        problem = generateProblem({ type: target.type, difficulty });
      } catch (e) {
        throw new EmptyQuestionPoolError({
          ...this.filter,
          type: `${target.type} (${e instanceof Error ? e.message.slice(0, 40) : '生成失敗'})`,
        });
      }

      if (!firstPick) firstPick = problem;

      // セッション内で未出の問題なら採用する。
      if (!recentFingerprints.has(fingerprintProblem(problem))) return problem;
    }

    // どの抽選も過去に出た問題だった (候補空間が極端に狭い)。
    // 絞り込みを尊重してその空間の最初の抽選結果に戻す。
    if (firstPick) {
      const last = questionHistory[questionHistory.length - 1];
      if (
        last?.fingerprint &&
        fingerprintProblem(firstPick) === last.fingerprint &&
        pool.length > 1
      ) {
        const alternative = pool.find((e) => e.type !== firstPick!.type);
        if (alternative) {
          try {
            return generateProblem({
              type: alternative.type,
              difficulty: this.difficultyOf(alternative),
            });
          } catch {
            return firstPick;
          }
        }
      }
      return firstPick;
    }

    // 全ての抽選が生成失敗した場合のみここへ到達する。
    throw new EmptyQuestionPoolError(this.filter);
  }
}
