/**
 * 苦手復習対象の抽出
 *
 * 既存の findWeakAreas は category 単位で「苦手」を判定している。
 * 復習出題にはより細かい problemType x difficulty 粒度が必要なので、
 * 既存ルール (回答数 >= MIN_ATTEMPTS_FOR_WEAKNESS かつ
 * 正答率 < WEAKNESS_ACCURACY_THRESHOLD) をそのまま
 * problemType x difficulty の組に適用し直す。
 *
 * 新しい統計指標は導入せず、既存の閾値を再利用する。
 */

import type { AnswerRecord } from '../../types/history';
import type { DifficultyLevel } from '../../types/problem';
import {
  MIN_ATTEMPTS_FOR_WEAKNESS,
  WEAKNESS_ACCURACY_THRESHOLD,
} from '../../utils/weakAreas';

/**
 * 復習対象の (problemType, difficulty) 組
 *
 * `accuracyRate` は判定に用いた正答率。
 * `lastWrongAt` は直近の不正解日時 (ミリ秒)。直近に間違えているほど大きい。
 * `totalCount` は判定に用いた回答数 (直近のみを数える)。
 */
export interface WeakTarget {
  problemType: string;
  difficulty: DifficultyLevel;
  totalCount: number;
  correctCount: number;
  accuracyRate: number;
  /** 直近の不正解日時 (ミリ秒)。不正解が 없으면 0 */
  lastWrongAt: number;
}

/** problemType x difficulty のキーを作る */
function keyOf(problemType: string, difficulty: number): string {
  return `${problemType}@${difficulty}`;
}

/**
 * 回答履歴から復習対象の (problemType, difficulty) を抽出する
 *
 * 判定基準は既存と同じ 2 つだけを使う:
 *   - 回答数が MIN_ATTEMPTS_FOR_WEAKNESS 以上
 *   - 正答率が WEAKNESS_ACCURACY_THRESHOLD 未満
 *
 * これにより
 *   - 回答数が少ない組は判定しない (少ない回答で「苦手」と断定しない)
 *   - 1問間違えただけでは入らない (閾値未満にならない)
 *   - 正答が増えると外れる (同じ式で再計算される)
 * という既存.category 判定の性質をそのまま保てる。
 *
 * 並び順: 正答率が低い順、同率なら直近の不正解が新しい順、
 * さらに同程度なら回答数が多い順。
 */
export function findWeakTargets(records: AnswerRecord[]): WeakTarget[] {
  const groups = new Map<
    string,
    { problemType: string; difficulty: DifficultyLevel; records: AnswerRecord[] }
  >();

  for (const record of records) {
    const key = keyOf(record.problemType, record.difficultyLevel);
    const group = groups.get(key) ?? {
      problemType: record.problemType,
      difficulty: record.difficultyLevel as DifficultyLevel,
      records: [],
    };
    group.records.push(record);
    groups.set(key, group);
  }

  const targets: WeakTarget[] = [];
  for (const group of groups.values()) {
    const total = group.records.length;
    if (total < MIN_ATTEMPTS_FOR_WEAKNESS) continue;

    const correct = group.records.filter((r) => r.isCorrect).length;
    const accuracy = correct / total;
    if (accuracy >= WEAKNESS_ACCURACY_THRESHOLD) continue;

    let lastWrongAt = 0;
    for (const r of group.records) {
      if (r.isCorrect) continue;
      const t = new Date(r.answeredAt).getTime();
      if (Number.isFinite(t) && t > lastWrongAt) lastWrongAt = t;
    }

    targets.push({
      problemType: group.problemType,
      difficulty: group.difficulty,
      totalCount: total,
      correctCount: correct,
      accuracyRate: accuracy,
      lastWrongAt,
    });
  }

  return targets.sort((a, b) => {
    if (a.accuracyRate !== b.accuracyRate) return a.accuracyRate - b.accuracyRate;
    if (a.lastWrongAt !== b.lastWrongAt) return b.lastWrongAt - a.lastWrongAt;
    return b.totalCount - a.totalCount;
  });
}
