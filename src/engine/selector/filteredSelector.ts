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

import type { Problem } from '../../types/problem';
import type { AnswerRecord, QuestionHistory } from '../../types/history';
import { fingerprintProblem } from '../diversity/metadata';
import { generateProblem } from './generatorRegistry';
import {
  buildQuestionPool,
  EmptyQuestionPoolError,
  filterQuestionPool,
  type QuestionFilter,
} from './questionPool';
import { FullRandomSelector } from './fullRandomSelector';
import type { ProblemSelector, SelectionRequest } from './types';

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

    const target = pool[Math.floor(Math.random() * pool.length)];
    const difficulty = this.filter.difficulty ?? target.supportedLevels[0];

    let problem: Problem;
    try {
      problem = generateProblem({ type: target.type, difficulty });
    } catch (e) {
      throw new EmptyQuestionPoolError({
        ...this.filter,
        type: `${target.type} (${e instanceof Error ? e.message.slice(0, 40) : '生成失敗'})`,
      });
    }

    // 直前の問題と完全に同一なら、その型でもう1回引く
    const last = questionHistory[questionHistory.length - 1];
    if (
      last?.fingerprint &&
      fingerprintProblem(problem) === last.fingerprint &&
      pool.length > 1
    ) {
      const alternative = pool.find((e) => e.type !== target.type);
      if (alternative) {
        try {
          return generateProblem({
            type: alternative.type,
            difficulty: this.filter.difficulty ?? alternative.supportedLevels[0],
          });
        } catch {
          // 代替型が生成できない場合は、1問目の問題をそのまま使う
          return problem;
        }
      }
    }

    return problem;
  }
}
