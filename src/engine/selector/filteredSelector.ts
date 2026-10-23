/**
 * 絞り込み指定セレクター (管理者出題範囲 × 習熟度ベース出題)
 *
 * 母集団 (questionPool) に対して filter を適用してから等確率で選ぶ。
 * 「分野・問題タイプ・学年・難易度・難易度範囲」をまとめて指定でき、
 * 学習履歴や苦手度による母集団への重み付けは行わない
 * (選択された出題範囲を常に尊重する)。
 *
 * 出題レベルの決定 (従来の「難易度範囲内のランダム選択」を廃止):
 * - 技能 (problemType) ごとに学習履歴から習熟レベルを推定し、
 *   出題目標 = 現在の習熟レベル + 1 段階を resolveTargetLevel で決定する。
 * - filter.difficulty が明示指定されている場合はそれに従う
 *   (エンジン層の明示条件。UI からは渡さない)。
 * - 履歴が無い (習熟度未評価) ときは、条件の基礎レベルから出題が始まる。
 * - 問題が存在しないレベルは出さない (習熟+1 を超える候補が無ければ
 *   その型の最高レベルを出題し続ける)。
 *
 * filter が空 (未指定) の場合も絞り込みを行わず、
 * 全出題可能範囲から等確率で選ぶ。
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
  type QuestionPoolEntry,
} from './questionPool';
import type { ProblemSelector } from './types';
import {
  estimateSkillMastery,
  resolveTargetLevel,
  type SkillMastery,
} from '../../utils/mastery';

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
   * 出題レベル (内部的な問題難易度) を決定する。
   *
   * - filter.difficulty が明示指定されていればそれに従う。
   * - それ以外は、技能 (entry.type) の習熟レベルから「一段上」の
   *   目標レベルを resolveTargetLevel で決める。
   *   - 習熟レベル+1 が候補にあればちょうど一段上を出題する。
   *   - 最高レベル到達・型の上限では、その最高レベルを出し続ける
   *     (存在しないレベルを出さない)。
   *   - 履歴が無い場合は条件の基礎レベル (最下位) から始まる。
   *   - filter.difficultyRange が残っている条件 (エンジン層互換) なら
   *     その範囲内に収める。
   */
  private difficultyOf(
    entry: { supportedLevels: readonly DifficultyLevel[] },
    mastery: SkillMastery,
  ): DifficultyLevel {
    if (this.filter.difficulty) return this.filter.difficulty;
    return resolveTargetLevel(
      entry.supportedLevels,
      mastery.level,
      this.filter.difficultyRange,
    );
  }

  selectNextQuestion(
    history: AnswerRecord[],
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

    // 技能ごとの習熟度 (1回の出題でまとめて計算し、候補間で共有する)。
    // 履歴は出題のたびに更新されるため、セッション内でも毎回最新になる。
    const masteryCache = new Map<string, SkillMastery>();
    const masteryOf = (entry: QuestionPoolEntry): SkillMastery => {
      const cached = masteryCache.get(entry.type);
      if (cached) return cached;
      const mastery = estimateSkillMastery(history, entry.type, entry.category);
      masteryCache.set(entry.type, mastery);
      return mastery;
    };

    let firstPick: Problem | null = null;
    const failures: string[] = [];
    const maxAttempts = Math.max(FILTERED_REDRAW_ATTEMPTS, pool.length);

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const target = pool[Math.floor(Math.random() * pool.length)];
      const difficulty = this.difficultyOf(target, masteryOf(target));

      let problem: Problem;
      try {
        problem = generateProblem({ type: target.type, difficulty });
      } catch (e) {
        // この型・このレベルでは生成できない種がある (既存仕様)。
        // 絞り込み条件は緩めず、次の抽選で別の候補に切り替える。
        failures.push(
          `${target.type} lv${difficulty}: ${e instanceof Error ? e.message.slice(0, 40) : '生成失敗'}`,
        );
        continue;
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
              difficulty: this.difficultyOf(alternative, masteryOf(alternative)),
            });
          } catch {
            return firstPick;
          }
        }
      }
      return firstPick;
    }

    // 全ての抽選が生成失敗した場合のみここへ到達する。
    // 条件を緩めずにエラー表示できるよう、失敗内容も添える。
    const error = new EmptyQuestionPoolError(this.filter);
    if (failures.length > 0) {
      error.message += ` 生成失敗: ${failures.slice(0, 3).join(' / ')}`;
    }
    throw error;
  }
}
