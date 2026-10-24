/**
 * 4 択選択肢の生成ユーティリティ
 *
 * 文章題を 4 択化する際に、正答と意味的に異なる誤答を 4 つにそろえる。
 * - 重複を除去する
 * - 正答が必ず含まれる
 * - 候補が足りない場合は正答の近傍値で安全に補う (不正な 4 択を表示しない)
 */
export function buildNumericChoiceOptions(
  rng: { int: (min: number, max: number) => number; shuffle: <T>(array: readonly T[]) => T[] },
  answer: number,
  candidates: readonly number[],
): string[] {
  const values = new Set<number>();
  values.add(answer);

  for (const candidate of candidates) {
    if (!Number.isFinite(candidate)) continue;
    if (candidate === answer) continue;
    values.add(candidate);
    if (values.size >= 4) break;
  }

  // 候補不足時の安全なフォールバック: 正答の近傍値を順に試す
  let delta = 1;
  while (values.size < 4 && delta < 1000) {
    const above = answer + delta;
    if (Number.isFinite(above) && above !== answer) values.add(above);
    if (values.size < 4) {
      const below = answer - delta;
      if (Number.isFinite(below) && below !== answer && below > 0) values.add(below);
    }
    delta += 1;
  }

  // それでも 4 つに満たない場合は、正答に倍数を加えて埋める
  while (values.size < 4) {
    const fallback = answer + values.size * 7 + 1;
    if (fallback !== answer) values.add(fallback);
    if (values.size >= 4) break;
  }

  const options = Array.from(values).slice(0, 4).map((value) => String(value));
  // 念のため重複除去後の長さを 4 にそろえる
  const unique = Array.from(new Set(options));
  while (unique.length < 4) {
    unique.push(String(answer + unique.length + 1));
  }
  return rng.shuffle(unique.slice(0, 4));
}
