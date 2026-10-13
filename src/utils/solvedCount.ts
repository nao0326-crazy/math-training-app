/**
 * 「解いた問題数」の判定ユーティリティ
 *
 * 確定仕様: 制限時間内に解答を完了した問題だけを「解いた問題数」にカウントする。
 * - 制限時間内に正答/誤答した問題: カウントする
 * - 時間切れになった問題: カウントしない (出題履歴・時間切れ記録としては保存してよい)
 *
 * 正答したかどうかではなく、制限時間内に解答を完了したかどうかで判定する。
 */

import type { AnswerRecord } from '../types/history';

/**
 * この記録が「解いた問題」かどうか (制限時間内に解答を完了したか)。
 *
 * `isTimedOut` は任意フィールドで、旧レコードには無いため undefined (= 時間内解答)。
 * 時間切れのときのみ true が入るため、`!== true` で判定する。
 */
export function isSolvedRecord(record: AnswerRecord): boolean {
  return record.isTimedOut !== true;
}

/**
 * 記録のうち「解いた問題数」をカウントする (時間切れは含めない)。
 */
export function countSolvedRecords(records: AnswerRecord[]): number {
  return records.filter(isSolvedRecord).length;
}
