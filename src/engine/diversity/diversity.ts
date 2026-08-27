/**
 * 出題多様性制御エンジン
 *
 * 問題を1問生成して即出題する旧方式を改め、
 * 「候補を複数生成 → メタデータ取得 → 直近履歴と比較 → 類似度スコア → 最適選択」
 * の構造にする。
 *
 * 制約:
 * - 難易度は決して変えない (候抲は指定難易度のみ生成)
 * - 同じ問題 (フィンガープリント一致) を再出題しない
 * - 同じ family の連続出題を抑制
 * - family の出題バランスを保つ
 */

import type { Problem } from '../../types/problem';
import type { QuestionHistory } from '../../types/history';
import {
  deriveMetadata,
  deriveMetadataFromType,
  type ProblemMetadata,
} from './metadata';
import { similarityScore } from './similarity';

/** 多様性制御の設定 */
export interface DiversityConfig {
  /** 1回の選択で生成する候補数 */
  candidateCount: number;
  /** 直近何問の履歴を参照するか (類似度・family バランスの評価対象) */
  recentWindow: number;
  /** 直近何問の problemType を完全回避するか (重複タイプ防止) */
  duplicateAvoidanceCount: number;
  /** 遡って何問分のフィンガープリントを重複判定に使うか */
  fingerprintMemory: number;
  /** 同じ family の最大連続出題数 */
  maxFamilyRun: number;
  /** 年齢減衰率 (直近1問前 = 1.0, 1問前 = ageDecay, ...) */
  ageDecay: number;
  /** 直近に出題したタイプの追加ペナルティ */
  recentTypePenalty: number;
  /** family 連続超過1回あたりのペナルティ */
  runPenaltyBase: number;
  /** family 出題頻度の偏り反映重み */
  familyBalanceWeight: number;
}

/** デフォルト設定 */
export const DEFAULT_DIVERSITY_CONFIG: DiversityConfig = {
  candidateCount: 6,
  recentWindow: 20,
  duplicateAvoidanceCount: 10,
  fingerprintMemory: 300,
  maxFamilyRun: 3,
  ageDecay: 0.7,
  recentTypePenalty: 8,
  runPenaltyBase: 5,
  familyBalanceWeight: 12,
};

/** 直近履歴の構造化ビュー */
export interface RecentEntry {
  problemType: string;
  metadata: ProblemMetadata;
  fingerprint?: string;
}
export interface RecentContext {
  /** 最新が先頭の直近エントリ */
  entries: RecentEntry[];
  /** 直近重複回避用のフィンガープリント集合 */
  fingerprints: Set<string>;
  /** 直近 duplicateAvoidanceCount 問の problemType 集合 */
  recentTypes: Set<string>;
  /** 直近ウィンドウ内の family 出現回数 */
  familyCounts: Map<string, number>;
  /** 直近の same-family 連続出題数 (0 = 未確認) */
  consecutiveFamily: { family: string; run: number } | null;
}

/** 直近履歴から構造化コンテキストを構築する */
export function buildRecentContext(
  questionHistory: QuestionHistory[],
  config: Pick<
    DiversityConfig,
    'recentWindow' | 'duplicateAvoidanceCount' | 'fingerprintMemory'
  >,
): RecentContext {
  const windowSize = Math.min(config.recentWindow, questionHistory.length);
  const recentSlice = questionHistory.slice(-windowSize);

  // 重複判定用のフィンガープリントは類似度ウィンドウより広く記憶する
  // (「同じ問題を完全に再出題しない」ため。類似度評価は直近のみでよい)
  const memorySize = Math.max(config.fingerprintMemory, windowSize);
  const memorySlice = questionHistory.slice(-memorySize);

  const entries: RecentEntry[] = [];
  const fingerprints = new Set<string>();
  const familyCounts = new Map<string, number>();

  for (const h of memorySlice) {
    if (h.fingerprint) fingerprints.add(h.fingerprint);
  }

  for (let i = recentSlice.length - 1; i >= 0; i--) {
    // i = 0 (oldest) から新しい順に処理
    const h = recentSlice[i];
    const metadata = h.metadata ?? deriveMetadataFromType(h.problemType);
    const fp = h.fingerprint;
    familyCounts.set(metadata.family, (familyCounts.get(metadata.family) ?? 0) + 1);
    entries.push({ problemType: h.problemType, metadata, fingerprint: fp });
  }
  // entries を「最新が先頭」順に
  entries.reverse();

  // 直近 duplicateAvoidanceCount 問の problemType 集合
  const dupSlice = questionHistory.slice(-config.duplicateAvoidanceCount);
  const recentTypes = new Set(dupSlice.map((h) => h.problemType));

  // same-family 連続出題数 (最新から遡る)
  let consecutiveFamily: { family: string; run: number } | null = null;
  if (entries.length > 0) {
    const first = entries[0].metadata.family;
    let run = 0;
    for (const e of entries) {
      if (e.metadata.family === first) {
        run++;
      } else {
        break;
      }
    }
    consecutiveFamily = { family: first, run };
  }

  return { entries, fingerprints, recentTypes, familyCounts, consecutiveFamily };
}

/** 候補1問の評価結果 */
export interface CandidateEvaluation {
  candidate: Problem;
  penalty: number;
  reasons: string[];
}

/**
 * 1問の候補に対する出題多槣性ペナルティを計算する
 * (小さいほど出題しやすい)
 */
export function evaluateCandidate(
  candidate: Problem,
  ctx: RecentContext,
  config: DiversityConfig = DEFAULT_DIVERSITY_CONFIG,
): CandidateEvaluation {
  const meta = deriveMetadata(candidate);
  const reasons: string[] = [];
  let penalty = 0;

  // 1) 直近に出題したタイプとの完全一致は強く避ける
  if (ctx.recentTypes.has(candidate.type)) {
    penalty += config.recentTypePenalty;
    reasons.push('最近のタイプと一致');
  }

  // 2) 年齢減衰付き類似度 (直近ほど重視)
  let similarity = 0;
  ctx.entries.forEach((e, i) => {
    const weight = Math.pow(config.ageDecay, i);
    similarity += weight * similarityScore(meta, e.metadata);
  });
  penalty += similarity;
  reasons.push(`類似度${similarity.toFixed(1)}`);

  // 3) same-family 連続出題抑制
  if (
    ctx.consecutiveFamily &&
    ctx.consecutiveFamily.run >= config.maxFamilyRun &&
    ctx.consecutiveFamily.family === meta.family
  ) {
    const over = ctx.consecutiveFamily.run - config.maxFamilyRun + 1;
    penalty += config.runPenaltyBase * over;
    reasons.push(`family連続${ctx.consecutiveFamily.run}`);
  }

  // 4) family の出題偏り抑制 (最近何割が同じ family か)
  const freq = ctx.familyCounts.get(meta.family) ?? 0;
  const ratio = ctx.entries.length > 0 ? freq / ctx.entries.length : 0;
  penalty += config.familyBalanceWeight * ratio;
  reasons.push(`family出現比${ratio.toFixed(2)}`);

  return { candidate, penalty, reasons };
}

/**
 * 候補群をペナルティの昇順に並べる
 * (最も多様な問題が先頭)
 */
export function rankCandidates(
  candidates: Problem[],
  ctx: RecentContext,
  config: DiversityConfig = DEFAULT_DIVERSITY_CONFIG,
): CandidateEvaluation[] {
  return candidates
    .map((c) => evaluateCandidate(c, ctx, config))
    .sort((a, b) => a.penalty - b.penalty);
}

/**
 * 候補群の中から最も出題に適した1問を選ぶ
 * (ペナルティ最小)。候補が空の場合は null。
 */
export function selectBestCandidate(
  candidates: Problem[],
  ctx: RecentContext,
  config: DiversityConfig = DEFAULT_DIVERSITY_CONFIG,
): CandidateEvaluation | null {
  if (candidates.length === 0) return null;
  return rankCandidates(candidates, ctx, config)[0];
}
