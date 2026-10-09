/**
 * 苦手復習セレクター
 *
 * 責務は「何を復習するか」に限定する:
 *   回答履歴 -> 復習対象の (problemType, difficulty) を決定 -> その型で問題を生成
 *
 * 「どの候補を選ぶか」の評価 (fingerprint 重複回避・family 連続抑制・類似度) は
 * diversity.ts の既存機構に委譲する。ここでは再実装しない。
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
import { generateProblem } from './generatorRegistry';
import type { ProblemSelector, SelectionRequest } from './types';
import { findWeakTargets, type WeakTarget } from './weakTargets';

/** 復習対象が1件も無い場合に投げるエラー */
export class NoWeakTargetError extends Error {
  /** 判定で除外された (problemType, difficulty) と理由 */
  readonly excluded: { problemType: string; difficulty: DifficultyLevel; reason: string }[];

  constructor(excluded: { problemType: string; difficulty: DifficultyLevel; reason: string }[]) {
    super(
      '復習できる苦手問題が見つかりませんでした。' +
        (excluded.length > 0
          ? `除外: ${excluded
              .slice(0, 5)
              .map((e) => `${e.problemType} lv${e.difficulty} (${e.reason})`)
              .join(', ')}${excluded.length > 5 ? ` ほか${excluded.length - 5}件` : ''}`
          : '回答履歴がまだありません。'),
    );
    this.name = 'NoWeakTargetError';
    this.excluded = excluded;
  }
}

export interface WeakSelectorConfig {
  /** 直近履歴を何件まで考慮するか */
  recentHistoryLimit: number;
  /** 重複を避けるために考慮する最近の問題数 */
  duplicateAvoidanceCount: number;
  /** 1問を生成する際の試行回数 */
  maxGenerationAttempts: number;
}

export const DEFAULT_WEAK_SELECTOR_CONFIG: WeakSelectorConfig = {
  recentHistoryLimit: 20,
  duplicateAvoidanceCount: 10,
  maxGenerationAttempts: 6,
};

/**
 * 復習対象から、実際に生成できるものだけを抽出する
 *
 * getTypeSupportedLevels の宣言で判定する。宣言値は Phase 0 の実測
 * (各 lv を複数 seed で実際に生成) と一致済みで、
 * 「その難易度で一致する問題を返せる」型だけを列挙している。
 * この方式なら generateProblem の大量リトライに依存しない。
 *
 * 引数の targets が null の場合は履歴から抽出する。
 */
export function filterGeneratableTargets(
  targets: readonly WeakTarget[] | null,
  history: AnswerRecord[],
): { viable: WeakTarget[]; excluded: { problemType: string; difficulty: DifficultyLevel; reason: string }[] } {
  const list = targets ?? findWeakTargets(history);
  const viable: WeakTarget[] = [];
  const excluded: { problemType: string; difficulty: DifficultyLevel; reason: string }[] = [];

  for (const t of list) {
    if (getTypeSupportedLevels(t.problemType).includes(t.difficulty)) {
      viable.push(t);
    } else {
      excluded.push({
        problemType: t.problemType,
        difficulty: t.difficulty,
        reason: 'この難易度では生成できない',
      });
    }
  }

  return { viable, excluded };
}

/**
 * 復習対象の1つを選ぶ
 *
 * 優先度順 (findWeakTargets の並び順) を尊重しつつ、
 * 先頭に固定されないよう呼び出しごとに巡回させる。
 *
 * 直近に出題した型を避けたい場合は recentTypes を渡す。
 * 完全排除ではなく、巡回により自然に分散させる。
 */
export function pickTarget(
  viable: readonly WeakTarget[],
  rotation = 0,
): WeakTarget {
  return viable[rotation % viable.length];
}

export class WeakSelector implements ProblemSelector {
  private config: WeakSelectorConfig;
  /**
   * 復習対象の巡回カウンタ。
   * 最も苦手な型に毎回固定されると1型しか復習されないため、
   * 出題ごとに次順位の対象へ回す。
   */
  private rotation = 0;

  constructor(config: Partial<WeakSelectorConfig> = {}) {
    this.config = { ...DEFAULT_WEAK_SELECTOR_CONFIG, ...config };
  }

  /**
   * 履歴から，并于立した復習対象を列挙する (出題せずに確認したい場合用)
   */
  listTargets(history: AnswerRecord[]): WeakTarget[] {
    return findWeakTargets(history);
  }

  /**
   * 苦手の問題を1問生成する
   */
  selectNextQuestion(
    history: AnswerRecord[],
    questionHistory: QuestionHistory[],
    request: SelectionRequest,
  ): Problem {
    // 復習対象の決定は履歴から行う。
    // request.difficulty ではなく **履歴に記録された実際の難易度** を使う
    // (problemType だけから難易度を推測しない)。
    //
    // request.mode が weak で types が指定されている場合は、
    // 「復習対象をこの型に限定する」という UI 側の意図をそのまま受け取る。
    // 指定がない (types が空) 場合は履歴から全対象を使う (A案)。
    const requestedTypes =
      request.mode.kind === 'weak' && request.mode.types.length > 0
        ? new Set(request.mode.types)
        : null;

    const all = filterGeneratableTargets(null, history);
    const viable = requestedTypes
      ? all.viable.filter((t) => requestedTypes.has(t.problemType))
      : all.viable;
    const excluded = requestedTypes
      ? [
          ...all.excluded,
          ...all.viable
            .filter((t) => !requestedTypes.has(t.problemType))
            .map((t) => ({
              problemType: t.problemType,
              difficulty: t.difficulty,
              reason: 'not in the requested weak types',
            })),
        ]
      : all.excluded;

    if (viable.length === 0) {
      throw new NoWeakTargetError(excluded);
    }

    // 並び順は findWeakTargets のまま (正答率が低い順、直近不正解が新しい順)。
    // ただし先頭に留め続けると1型に固定されるため、全体の並びを尊重して選ぶ。
    const diversityConfig: DiversityConfig = {
      ...DEFAULT_DIVERSITY_CONFIG,
      duplicateAvoidanceCount: this.config.duplicateAvoidanceCount,
      recentWindow: this.config.recentHistoryLimit,
    };
    const ctx = buildRecentContext(questionHistory, diversityConfig);

    const seenFingerprints = new Set(ctx.fingerprints);
    const candidates: Problem[] = [];
    const failures: string[] = [];

    for (let attempt = 0; attempt < this.config.maxGenerationAttempts; attempt++) {
      // 毎回 先頭からだと同じ型に固定されるため、復習対象を巡回させる。
      const target = viable[attempt % viable.length];

      let problem: Problem;
      try {
        problem = generateProblem({ type: target.problemType, difficulty: target.difficulty });
      } catch (e) {
        // この seed で生成できなかった型は次回以降をずらす。
        failures.push(
          `${target.problemType} lv${target.difficulty}: ` +
            (e instanceof Error ? e.message.slice(0, 50) : 'unknown'),
        );
        continue;
      }

      if (problem.difficulty.level !== target.difficulty || problem.type !== target.problemType) {
        failures.push(
          `${target.problemType} lv${target.difficulty}: ` +
            `got ${problem.type} lv${problem.difficulty.level}`,
        );
        continue;
      }

      const fp = fingerprintProblem(problem);
      if (seenFingerprints.has(fp)) continue;
      seenFingerprints.add(fp);
      candidates.push(problem);
    }

    if (candidates.length === 0) {
      // 重複・生成失敗で何も作れなかった。学習を止めないため
      // 再試行なしで1問返す (重複回避は尽力であり、必須ではない)。
      const fallbackTarget = viable[0];
      return generateProblem({
        type: fallbackTarget.problemType,
        difficulty: fallbackTarget.difficulty,
      });
    }

    // diversity.ts answers "which candidate is most diverse", but using it alone
    // would always return the single weakest target and review only one type.
    //
    // So rotation over the priority order is honoured first:
    //   - rotate through the targets so every weak type gets reviewed
    //   - fall back to the diversity winner only when that type produced
    //     no candidate (duplicate / generation failure)
    this.rotation += 1;
    const preferred = pickTarget(viable, this.rotation);
    const preferredCandidate = candidates.find(
      (c) => c.type === preferred.problemType,
    );
    if (preferredCandidate) return preferredCandidate;

    const chosen = selectBestCandidate(candidates, ctx, diversityConfig);
    return chosen ? chosen.candidate : candidates[0];
  }
}
