/**
 * 絞り込み指定セレクター (管理者モード専用)
 *
 * 母集団 (questionPool) に対して filter を適用してから等確率で選ぶ。
 * 既存の QuestionSelector (カテゴリ指定・苦手優先) や
 * RandomSelector (指定難易度の全カテゴリ横断) とは別物で、
 * 「学年・分野・問題タイプ・難易度」をまとめて指定できる管理者用の入口。
 *
 * filter が空 (未指定) の場合は FullRandomSelector と同じ
 * 「全出題可能範囲からランダム」になる。
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
import { FullRandomSelector } from './fullRandomSelector';
import type { ProblemSelector, SelectionRequest } from './types';

/**
 * セッション内重複を避けるための引き直し上限 (回)。
 *
 * FilteredSelector は絞り込み母集団から等確率抽選するため、狭い母集団
 * (例: 特定タイプ + 特定難易度) では同一問題が連続で出やすい。既存の
 * QuestionSelector と同様、直近に出たフィンガープリントと一致しない問題を
 * 探すまでこの回数だけ抽選し直す。母集団サイズが上限より大きい場合は
 * 母集団サイズ分だけ試す (呼び出し側で Math.max を取る)。
 */
const FILTERED_REDRAW_ATTEMPTS = 10;

export class FilteredSelector implements ProblemSelector {
  private filter: QuestionFilter;
  /** filter が空のときは完全ランダムに委譲する */
  private fallback: FullRandomSelector;

  constructor(filter: QuestionFilter = {}) {
    this.filter = filter;
    this.fallback = new FullRandomSelector();
  }

  /** このセレクターが保持している絞り込み条件 */
  get selection(): QuestionFilter {
    return this.filter;
  }

  selectNextQuestion(
    history: AnswerRecord[],
    questionHistory: QuestionHistory[],
    request: SelectionRequest,
  ): Problem {
    const pool = filterQuestionPool(this.filter, buildQuestionPool());
    if (pool.length === 0) throw new EmptyQuestionPoolError(this.filter);

    // 条件が1つも無い場合は通常モードと同一の完全ランダム出題にする
    const hasCondition = Object.values(this.filter).some(
      (v) => v !== undefined && v !== null,
    );
    if (!hasCondition) return this.fallback.selectNextQuestion(history, questionHistory, request);

    // セッション内で「すでに出した問題 (同一フィンガープリント)」を避ける。
    // 狭い候補空間 (例: lv3 の volume_cube は実質数種) では、直前1問だけを
    // 見るだけだと 2問前・3問前と同じ問題を連続で出してしまう。
    // 既存の QuestionSelector と同じ仕組み (buildRecentContext) で直近の
    // フィンガープリント集合を作り、それに一致しない問題を選ぶ。
    const recentFingerprints = buildRecentContext(
      questionHistory,
      DEFAULT_DIVERSITY_CONFIG,
    ).fingerprints;

    const difficultyOf = (entry: { supportedLevels: readonly DifficultyLevel[] }): DifficultyLevel =>
      this.filter.difficulty ?? entry.supportedLevels[0];

    // 候補空間から最大 attempts 回まで抽選し、セッション内で未出の問題を返す。
    // 見つからなければ、絞り込みを尊重してその空間の最初の抽選結果に戻す
    // (絞り込み指定を破らず、学習を止めない)。
    let firstPick: Problem | null = null;
    const maxAttempts = Math.max(FILTERED_REDRAW_ATTEMPTS, pool.length);

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const target = pool[Math.floor(Math.random() * pool.length)];
      const difficulty = difficultyOf(target);

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
    // 従来どおり、直近1問と完全同一になる場合だけ別型で引き直す。
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
              difficulty: difficultyOf(alternative),
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
