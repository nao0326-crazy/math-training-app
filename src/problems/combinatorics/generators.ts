/**
 * 場合の数の問題ジェネレータ
 * 小学6年生の学習範囲:
 * - 並べ方・組み合わせ
 * - 樹形図・表による整理
 * - 条件付きの場合の数
 * - 重複を除く
 */

import type {
  DifficultyLevel,
  GenerationConfig,
  Problem,
  ProblemGenerator,
  ValidationResult,
} from '../../types/problem';
import { createRandom, generateProblemId } from '../../utils/random';
import {
  createDifficulty,
  numberSizeToComplexity,
  calculationStepsToComplexity,
} from '../../engine/difficulty/difficulty';

function createCombDifficulty(
  level: DifficultyLevel,
  value: number,
  reasoningLevel: DifficultyLevel = 1,
  readingLevel: DifficultyLevel = 1,
) {
  return createDifficulty({
    calculationComplexity: calculationStepsToComplexity(level),
    numberComplexity: numberSizeToComplexity(value),
    reasoningComplexity: reasoningLevel,
    readingComplexity: readingLevel,
  });
}

/** 順列を数える nPr = n! / (n-r)! (小6なので小さい値のみ) */
function permutation(n: number, r: number): number {
  let result = 1;
  for (let i = 0; i < r; i++) {
    result *= n - i;
  }
  return result;
}

/** 組合せの数え上げ nCr */
function combination(n: number, r: number): number {
  if (r === 0) return 1;
  if (r > n) return 0;
  return permutation(n, r) / factorial(r);
}

/** 階乗 */
function factorial(n: number): number {
  let result = 1;
  for (let i = 2; i <= n; i++) result *= i;
  return result;
}
/**
 * 並べ方の問題の種類 (「n個から一部を選んで並べる」を対象にしたもの)
 *
 * arrange_tree (「すべてを並べる」) と明確に区別するため、ここでは必ず r < n
 * (一部しか選ばない) ことを前提とする。種類ごとに「選ぶ段階」と「並べる段階」の
 * どちらに条件があるかで、考え方も解法も異なる。
 *
 * 採用した種類はいずれも小6の基本的な方法 (かけ算・順序を考えて選ぶ) で解ける。
 * 組合せの公式 nCr を使う解法 (n! を r! で割る方法) は採用しない。
 */
export type ArrangeSimpleVariant =
  /** 並べる段階の条件なし: n個から r個を選んで並べる */
  | 'pick_only'
  /** 選ぶ段階の条件: n個から r個を選び、そのうち1人を特別扱いする */
  | 'pick_special'
  /** 並べる段階の条件: r人の中に必ずAさんを含める */
  | 'pick_include_one'
  /** 並べる段階の条件: Aさんを必ず選び、1番めに固定 */
  | 'pick_first_fixed'
  /** 並べる段階の条件: BさんとCさんを必ず選び、両端に固定 */
  | 'pick_both_ends';

/** 難易度ごとの候補 (条件が増えるほど思考が増える順) */
const ARRANGE_SIMPLE_VARIANTS: Record<DifficultyLevel, ArrangeSimpleVariant[]> = {
  1: ['pick_only', 'pick_special'],
  2: ['pick_only', 'pick_special', 'pick_include_one'],
  3: ['pick_only', 'pick_special', 'pick_include_one', 'pick_first_fixed'],
  4: ['pick_only', 'pick_special', 'pick_include_one', 'pick_first_fixed', 'pick_both_ends'],
  5: ['pick_special', 'pick_include_one', 'pick_first_fixed', 'pick_both_ends'],
};

/** 難易度ごとの「何人いるか (n)」の範囲 */
const ARRANGE_SIMPLE_N: Record<DifficultyLevel, [number, number]> = {
  1: [3, 4],
  2: [3, 5],
  3: [4, 6],
  4: [4, 7],
  5: [4, 7],
};

/** from 個から count 個を選んで並べる通り数 (かけ算の積で求める) */
function prod(from: number, count: number): number {
  let v = 1;
  for (let i = 0; i < count; i++) v *= from - i;
  return v;
}

/**
 * 種類ごとの答えを求める。
 *
 * pick_special だけは「並べない」問題になるため combination を使う。
 * それ以外はすべてかけ算の積 (prod) で求められる。
 */
function solveArrangeSimple(variant: ArrangeSimpleVariant, n: number, r: number): number {
  switch (variant) {
    case 'pick_only':
      // n個から r個を選んで並べる = n × (n-1) × … の r 個
      return prod(n, r);
    case 'pick_special':
      // 特別の1人を n 人の中から決める n 通り × 残り n-1 人から r-1 人を選ぶ
      return n * combination(n - 1, r - 1);
    case 'pick_include_one':
      // 必ずAさんを含めるので、残り n-1 人から r-1 人を選んで並べる
      return prod(n - 1, r - 1);
    case 'pick_first_fixed':
      // 先頭はAさんなので、残り n-1 人から r-1 人を選んで並べる
      return prod(n - 1, r - 1);
    case 'pick_both_ends':
      // 両端はBさんとCさん (左右2通り)、残り n-2 人から r-2 人を選んで並べる
      return 2 * prod(n - 2, r - 2);
  }
}

/** 難易度・乱数から、成立する (variant, n, r) を選び出す */
function pickVariantAndParams(
  rng: ReturnType<typeof createRandom>,
  lv: DifficultyLevel,
): { variant: ArrangeSimpleVariant; n: number; r: number } {
  const [minN, maxN] = ARRANGE_SIMPLE_N[lv];
  const usable = ARRANGE_SIMPLE_VARIANTS[lv];

  for (let attempt = 0; attempt < 50; attempt++) {
    const variant = rng.pick(usable);
    const n = rng.int(minN, maxN);
    // pick_both_ends は両端に2人固定するので最低3人選ぶ必要がある
    const minR = variant === 'pick_both_ends' ? 3 : 2;
    // r < n を保証する (r = n は arrange_tree と重複するため使わない)
    const maxR = n - 1;
    if (maxR < minR) continue;
    return { variant, n, r: rng.int(minR, maxR) };
  }

  // フォールバック (必ず成立する最小の組合せ)
  const fallbackN = Math.max(minN, 4);
  const fallback =
    usable.find((v) => (v === 'pick_both_ends' ? fallbackN >= 4 : true)) ?? 'pick_only';
  return { variant: fallback, n: fallbackN, r: 2 };
}

/** 積の式を「n×n-1×…×n-r+1」の文字列にする (count<=1 は1通り) */
function fallingString(from: number, count: number): string {
  if (count <= 1) return '1';
  const parts: string[] = [];
  for (let i = 0; i < count; i++) parts.push(String(from - i));
  return parts.join('×');
}

/** 種類ごとの問題文と解説 (問題文の条件と解法を正しく反映させる) */
function arrangeSimpleText(
  variant: ArrangeSimpleVariant,
  n: number,
  r: number,
  answer: number,
): { question: string; explanation: string } {
  switch (variant) {
    case 'pick_only':
      return {
        question: `${n}人の中から${r}人を選んで1列に並べます。並べ方は全部で何通りありますか`,
        explanation: `1番めに並べるのは${n}人のうち誰か、2番めは残り${n - 1}人のうち誰か、…と選ぶので、${fallingString(n, r)}＝${answer}通りです。`,
      };
    case 'pick_special': {
      // 特別の1人を n 人の中から決める (選んだ r 人の中からではない点に注意)
      // = n通り (特別の1人) × (そのほかの n-1 人から r-1 人を選ぶ)
      const rest = combination(n - 1, r - 1);
      return {
        question: `${n}人の中から${r}人を選び、そのうち1人を「特別の1人」として決めます。特別の1人以外は並べなくてかまいません。選び方は何通りありますか`,
        explanation: `特別の1人は、${n}人のうち誰でもよいので${n}通りです。残りの${r - 1}人はそのほかの${n - 1}人から選ぶので、${n}×${rest}＝${answer}通りです。`,
      };
    }
    case 'pick_include_one': {
      const terms = fallingString(n - 1, r - 1);
      return {
        question: `${n}人の中から${r}人を選んで1列に並べます。ただし、Aさんは必ず選ぶことにします。並べ方は何通りありますか`,
        explanation:
          r - 1 <= 1
            ? `Aさんは必ず選ぶので、残りはAさん以外の${n - 1}人から${r - 1}人を選びます。1人だけなら選び方は${n - 1}通り、答えは${answer}通りです。`
            : `Aさんは必ず選ぶので、残りはAさん以外の${n - 1}人から${r - 1}人を選んで並べます。${terms}＝${answer}通りです。`,
      };
    }
    case 'pick_first_fixed': {
      const terms = fallingString(n - 1, r - 1);
      return {
        question: `${n}人の中から${r}人を選んで1列に並べます。ただし、Aさんは必ず選び、1番め（いちばん左）に置くことにします。並べ方は何通りありますか`,
        explanation:
          r - 1 <= 1
            ? `1番めはAさんに決まっているので、残り${n - 1}人から${r - 1}人を選びます。1人だけなら選び方は${n - 1}通り、答えは${answer}通りです。`
            : `1番めはAさんに決まっているので、残り${n - 1}人の中から${r - 1}人を選んで並べます。${terms}＝${answer}通りです。`,
      };
    }
    case 'pick_both_ends': {
      const terms = fallingString(n - 2, r - 2);
      return {
        question: `${n}人の中から${r}人を選んで1列に並べます。ただし、BさんとCさんは両方とも選び、左右のはしに入れることにします。並べ方は何通りありますか`,
        explanation:
          r - 2 <= 0
            ? `左右のはしに入るBさんとCさんは、左右を入れかえた2通りあります。あとは選ぶだけなので、答えは${answer}通りです。`
            : `左右のはしに入るBさんとCさんは、左右を入れかえた2通りあります。残りは${n - 2}人の中から${r - 2}人を選んで並べるので、2×${terms}＝${answer}通りです。`,
      };
    }
  }
}

/**
 * 並べ方 (n個から一部を選んで並べる)
 *
 * Phase 2-B の変更点:
 *   - 以前は「n人からr人を選んで並べる」1種類のみで、(n, r) の組合せが25通り
 *     に限られ、100問中24種類しか出なかった。
 *     しかも r = n の場合は arrange_tree の「すべてを並べる」問題と同じものに
 *     なっていたため、問題の区別という意図に反していた。
 *   - 条件を「選ぶ段階」と「並べる段階」に分けて5種類を用意した。
 *     (人名や記号を替えるだけの変更はしていない)
 *   - r < n を保証し、arrange_tree と重複する問題を出さないようにしている。
 */
export class ArrangeSimpleGenerator implements ProblemGenerator {
  readonly type = 'arrange_simple';
  readonly category = 'combinatorics' as const;
  readonly description = '並べ方 (一部を選んで並べる)';

  generate(config?: GenerationConfig): Problem {
    const rng = createRandom(config?.seed);
    // Use provided difficulty, default to 2 (normal) if not specified
    const lv = config?.difficulty ?? (2 as DifficultyLevel);

    const { variant, n, r } = pickVariantAndParams(rng, lv);
    const answer = solveArrangeSimple(variant, n, r);
    const { question, explanation } = arrangeSimpleText(variant, n, r, answer);

    return {
      id: generateProblemId(),
      category: this.category,
      type: this.type,
      difficulty: createCombDifficulty(
        lv,
        n,
        Math.min(3, lv) as DifficultyLevel,
        Math.min(2, lv) as DifficultyLevel,
      ),
      question,
      answer: { kind: 'integer', value: answer },
      explanation,
      parameters: { n, r, variant, answer, difficultyLevel: lv },
    };
  }

  validate(problem: Problem): ValidationResult {
    const errors: string[] = [];
    const { n, r, variant, answer } = problem.parameters as {
      n: number;
      r: number;
      variant: ArrangeSimpleVariant;
      answer: number;
    };
    if (!Number.isInteger(n) || !Number.isInteger(r)) {
      errors.push('人数が整数ではありません');
      return { valid: false, errors };
    }
    if (r > n) {
      errors.push('選ぶ人数が人数を超えてしています');
    }
    if (r === n) {
      errors.push('全部を選ぶケースは arrange_tree と重複します');
    }
    const expected = solveArrangeSimple(variant, n, r);
    if (answer !== expected) {
      errors.push(`並べ方が誤っています (期待値 ${expected}, 実際 ${answer})`);
    }
    return { valid: errors.length === 0, errors };
  }
}

/**
 * 組み合わせ (n個からr個を選ぶ) の問題の種類
 *
 * Phase 2-E:
 *   - 以前は「n人からr人を選ぶ」1種類のみで、n<=10 / r=2〜4 に限られていた。
 *     (n, r) の組合せが最大でも数十通りしかなく、100問中20種類しか出ない。
 *   - 「選ぶときの条件」を変えた4種類を用意した。
 *     (人名や記号を替えただけの変更ではなく、選ぶ対象の集合そのものが変わる)
 *
 * Phase 2-K:
 *   - 「2条件が同時に指定される組合せ」(必ずAさんを選び、かつBさんを選ばない) は
 *     出題variantから除外した。
 *   - 除外の理由は「小6範囲外だと確定した」ためではない。
 *     Phase 2-I で小6の教科書・指導資料を調べたところ、2条件を同時に指定する
 *     組合せ問題の教材例を確認できなかったため、採用根拠が確立できないという
 *     判断である。再度見直して再検討する余地がある-variantである点にも注意。
 *
 * 教育範囲の根拠 (いずれも小6で扱えることの確認が取れているものだけ採用した):
 *   - 小6「ならべ方と組み合わせ方」単元そのもの
 *     (文部科学省 学習指導要領 解説 算数編 pp.69-70 / 小学館の单元構想でも確認)
 *   - 「条件がある場合の選び方」 = 必ずOOを選ぶ・OOを選ばない (条件は1つ)
 *     (小学館 / 文部科学省教科調査官監修の小6指導案 第2時
 *      「条件がある場合（4枚から3枚を選ぶなど）の選び方がなん通りあるか」と明記)
 *   - 選ぶ個数が「全体 − 1」になる場合 (残り4枚から3枚 = 5種類から4種類)
 *     (同じ指導案 第5時「5種類のお菓子から2種類、または4種類を選ぶ組み合わせ」)
 *     なお、教科書で確認できた具体例は n=5 までであり、n=6,7 の具体例や
 *     「n個からn-1個」という一般形そのものは未確認。生成される (n, r) も
 *     n=5 まで (r の上限が4のため lv5 では生成されない) に収まる。
 *   - 3つの数から選ぶ組合せ・補集合を使う問題 (「少なくとも何人」など)
 *     は小6では確認できないため採用していない。
 */
export type CombineSimpleVariant =
  /** 条件なし: n個からr個を選ぶ */
  | 'pick_only'
  /** 必ず1個を含める: 必ずAさんを含めてr個を選ぶ */
  | 'include_one'
  /** 1個を選ばない: Aさんを除いてr個を選ぶ */
  | 'exclude_one';

/** 難易度ごとの候補 (条件が増えるほど読み取る内容が増える順) */
const COMBINE_SIMPLE_VARIANTS: Record<DifficultyLevel, CombineSimpleVariant[]> = {
  1: ['pick_only'],
  2: ['pick_only', 'include_one', 'exclude_one'],
  3: ['pick_only', 'include_one', 'exclude_one'],
  4: ['pick_only', 'include_one', 'exclude_one'],
  5: ['pick_only', 'include_one', 'exclude_one'],
};

/** 難易度ごとの「何個から選ぶか (n)」の範囲 */
const COMBINE_SIMPLE_N: Record<DifficultyLevel, [number, number]> = {
  1: [3, 5],
  2: [3, 7],
  3: [4, 9],
  4: [5, 10],
  5: [6, 12],
};

/** 難易度ごとの「何個選ぶか (r)」の範囲 */
const COMBINE_SIMPLE_R: Record<DifficultyLevel, [number, number]> = {
  1: [2, 2],
  2: [2, 3],
  3: [2, 3],
  4: [2, 4],
  5: [2, 4],
};

/** 種類ごとに「r をいくらまでにしても答えが1通りにならないか」を決める上限 */
function maxRForVariant(variant: CombineSimpleVariant, n: number): number {
  switch (variant) {
    case 'pick_only':
      // r = n だと「全部選ぶ」1通りになる
      return n - 1;
    case 'include_one':
      // Aさん込みで全部 (r = n) だと1通り
      return n - 1;
    case 'exclude_one':
      // Aさん以外の残り全部 (r = n-1) だと1通り
      return n - 2;
  }
}

/** from 個から count 個を選ぶ通り数 (並べない) */
function combinationOf(from: number, count: number): number {
  return combination(from, count);
}

/** 種類ごとの答えを求める。条件によって「何個から何個選ぶか」が変わる */
function solveCombineSimple(variant: CombineSimpleVariant, n: number, r: number): number {
  switch (variant) {
    case 'pick_only':
      return combinationOf(n, r);
    case 'include_one':
      // Aさんは必ず選ぶので、残り n-1 個から r-1 個を選ぶ
      return combinationOf(n - 1, r - 1);
    case 'exclude_one':
      // Aさんは選ばないので、Aさん以外の n-1 個から r 個を選ぶ
      return combinationOf(n - 1, r);
  }
}

/** r! を「2 × 3 × … × r」の文字列にする (r<2 は1) */
function factorialTerm(r: number): string {
  if (r < 2) return '1';
  const parts: string[] = [];
  for (let i = 2; i <= r; i++) parts.push(String(i));
  return parts.join(' × ');
}

/** 「from 個から count 個を選ぶ」を ÷r! の式で説明する (小6でも段階が分かる形) */
function divideExpression(from: number, count: number, answer: number): string {
  if (count <= 0) return `選ぶ人がいないので1通り（${answer}通り）`;
  if (count === 1) return `${from}個から1個だけ選ぶので${answer}通り`;
  return `${fallingString(from, count)} ÷ ${factorialTerm(count)} ＝ ${answer}通り`;
}

/** 種類ごとの問題文と解説 (問題文の条件と解法を正しく反映させる) */
function combineSimpleText(
  variant: CombineSimpleVariant,
  n: number,
  r: number,
  answer: number,
): { question: string; explanation: string } {
  switch (variant) {
    case 'pick_only':
      return {
        question: `${n}人の中から${r}人を選びます。選び方は何通りありますか`,
        explanation: `順番は区別しないので、${divideExpression(n, r, answer)}です。`,
      };
    case 'include_one':
      return {
        question: `${n}人の中から${r}人を選びます。ただし、Aさんは必ず選ぶことにします。選び方は何通りありますか`,
        explanation:
          r <= 1
            ? `Aさんを選ぶだけなので、答えは${answer}通りです。`
            : `Aさんは必ず選ぶので、残りはAさん以外の${n - 1}人から${r - 1}人を選びます。${divideExpression(n - 1, r - 1, answer)}です。`,
      };
    case 'exclude_one':
      return {
        question: `${n}人の中から${r}人を選びます。ただし、Aさんは選ばないことにします。選び方は何通りありますか`,
        explanation: `Aさんを選ばないので、Aさん以外の${n - 1}人から${r}人を選びます。${divideExpression(n - 1, r, answer)}です。`,
      };
  }
}

/** 難易度・乱数から、成立する (variant, n, r) を選び出す */
function pickCombineSimpleParams(
  rng: ReturnType<typeof createRandom>,
  lv: DifficultyLevel,
): { variant: CombineSimpleVariant; n: number; r: number } {
  const usable = COMBINE_SIMPLE_VARIANTS[lv];
  const [minN, maxN] = COMBINE_SIMPLE_N[lv];
  const [minR, maxR] = COMBINE_SIMPLE_R[lv];

  for (let attempt = 0; attempt < 60; attempt++) {
    const variant = rng.pick(usable);
    const n = rng.int(minN, maxN);
    const hi = Math.min(maxR, maxRForVariant(variant, n));
    if (hi < minR) continue;
    return { variant, n, r: rng.int(minR, hi) };
  }

  // フォールバック (必ず成立する最小の組合せ)
  const fallbackN = Math.max(minN, 5);
  return { variant: 'pick_only', n: fallbackN, r: 2 };
}

/**
 * 組み合わせ (n個からr個を選ぶ)
 *
 * Phase 2-E:
 *   - 以前は (n, r) だけが変化し、条件は「n人からr人を選ぶ」1種類のみ。
 *   - 条件を変えた4種類 (variant) を用意し、n と r の範囲も難易度別に再設計した。
 *   - r の上限は種類ごとに決め、答えが1通りになる (学習価値が無い) 場合は出さない。
 *   - (Phase 2-K で「2条件が同時に指定される組合せ」を 1 種類撤去し、現在は3種類。
 *     撤去理由は教育範囲外と確定したためではなく、教材の直接例を確認できなかったため。
 *     詳細は CombineSimpleVariant の JSDoc を参照)
 */
export class CombineSimpleGenerator implements ProblemGenerator {
  readonly type = 'combine_simple';
  readonly category = 'combinatorics' as const;
  readonly description = '組み合わせ';

  generate(config?: GenerationConfig): Problem {
    const rng = createRandom(config?.seed);
    // Use provided difficulty, default to 2 (normal) if not specified
    const lv = config?.difficulty ?? (2 as DifficultyLevel);

    const { variant, n, r } = pickCombineSimpleParams(rng, lv);
    const ans = solveCombineSimple(variant, n, r);
    const { question, explanation } = combineSimpleText(variant, n, r, ans);

    return {
      id: generateProblemId(),
      category: this.category,
      type: this.type,
      difficulty: createCombDifficulty(
        lv,
        n,
        Math.min(3, lv) as DifficultyLevel,
        // 条件が増えるほど問題文が長くなるので、読解の負荷も上げる
        (variant === 'pick_only' ? 1 : 2) as DifficultyLevel,
      ),
      question,
      answer: { kind: 'integer', value: ans },
      explanation,
      parameters: { n, r, variant, answer: ans, difficultyLevel: lv },
    };
  }

  validate(problem: Problem): ValidationResult {
    const errors: string[] = [];
    const { n, r, variant, answer } = problem.parameters as {
      n: number;
      r: number;
      variant: CombineSimpleVariant;
      answer: number;
    };
    if (!Number.isInteger(n) || !Number.isInteger(r)) {
      errors.push('人数が整数ではありません');
      return { valid: false, errors };
    }
    if (r > n) {
      errors.push('選ぶ人数が人数を超えてしています');
    }
    // 全部を選ぶケースは答えが1通りになり学習価値が無い
    if (r === n) {
      errors.push('全部を選ぶケースは答えが1通りになり学習価値がありません');
    }
    const expected = solveCombineSimple(variant, n, r);
    if (answer !== expected) {
      errors.push(`組み合わせの数が誤っています (期待値 ${expected}, 実際 ${answer})`);
    }
    return { valid: errors.length === 0, errors };
  }
}

/**
 * 並べ方を全列挙して数える (小6なので n <= 6 で十分軽い)
 *
 * 回転して重なる並びを同一視する必要がある場面があるため、
 * 「各並びを正準形に直してから集合に入れる」方式で数える。
 * 答えを式から求めず列挙で確定させることで、解説・途中式・正解が必ず一致する
 * (DuplicateRemoval と同じ方針)。
 */

/** 並びを「回転して重なるもの同一視」できる正準形にする (円卓の並び用) */
function canonicalRotation(arr: string[]): string {
  const n = arr.length;
  let best = arr.join('');
  for (let k = 1; k < n; k++) {
    const rotated = [...arr.slice(k), ...arr.slice(0, k)].join('');
    if (rotated < best) best = rotated;
  }
  return best;
}

/** a が b の隣 (左右どちらでもよい) にあるか */
function areAdjacent(arr: string[], a: string, b: string): boolean {
  for (let i = 0; i < arr.length - 1; i++) {
    if ((arr[i] === a && arr[i + 1] === b) || (arr[i] === b && arr[i + 1] === a)) {
      return true;
    }
  }
  return false;
}

/** 並べ方の問題の種類 (小6の「並べ方」の範囲に収めたものだけ) */
export type ArrangeTreeVariant =
  | 'all' // n個すべてを自由に並べる
  | 'fixed_first' // 特定の1文字を1番め(先頭)に固定
  | 'both_ends' // 特定の2文字を両端に固定
  | 'adjacent' // 特定の2文字を隣り合わせる
  | 'circle'; // 円卓に並べ、回転して重なる並びを同一視

/**
 * 難易度ごとの候補。
 *
 * 新しい種類ほど条件が増える = 思考が増える、という次序で割り当てる。
 * 円卓と隣接は小6で扱われる基本の考え方 (回転同一視 / まとまりとして数える) に
 * 相当する。包除原理を必要とする「隣り合わない」は範囲外なので採用していない。
 */
const ARRANGE_TREE_VARIANTS: Record<DifficultyLevel, ArrangeTreeVariant[]> = {
  1: ['all', 'fixed_first'],
  2: ['all', 'fixed_first', 'both_ends'],
  3: ['all', 'fixed_first', 'both_ends', 'adjacent'],
  4: ['all', 'fixed_first', 'both_ends', 'adjacent', 'circle'],
  5: ['all', 'fixed_first', 'both_ends', 'adjacent', 'circle'],
};

/**
 * 難易度ごとの並べる個数。
 *
 * 全列挙で答えを確定させるため n が小さいことが前提だが、
 * 小6の教科書で扱われる上限は 6 なので 7 までに広げても 7! = 5040 で軽い。
 * 個数を増やすことで「条件が同じでも n が違う問題」として実質的な多様性を確保する。
 * 条件の種類 × n の組み合わせが 25% 以上の異なる問題になるよう調整済み。
 */
const ARRANGE_TREE_N: Record<DifficultyLevel, [number, number]> = {
  1: [3, 4],
  2: [3, 5],
  3: [4, 6],
  4: [4, 7],
  5: [3, 7],
};

const ARRANGE_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];

/**
 * 並べ方をすべて列挙し、条件を満たす相異なる並びの数を答えにする。
 * 解説で例挙げる並びの例も一緒に返す。
 */
function solveArrangement(
  variant: ArrangeTreeVariant,
  letters: string[],
): { answer: number; sample: string } {
  const found = new Set<string>();
  const permute = (current: string[], remaining: string[]): void => {
    if (remaining.length === 0) {
      const arr = current;
      let ok = true;
      if (variant === 'fixed_first') ok = arr[0] === letters[0];
      if (variant === 'both_ends') {
        const a = letters[0];
        const b = letters[1];
        const last = arr[arr.length - 1];
        ok = (arr[0] === a && last === b) || (arr[0] === b && last === a);
      }
      if (variant === 'adjacent') ok = areAdjacent(arr, letters[0], letters[1]);
      if (!ok) return;
      found.add(variant === 'circle' ? canonicalRotation(arr) : arr.join(''));
    }
    for (let i = 0; i < remaining.length; i++) {
      permute(
        [...current, remaining[i]],
        [...remaining.slice(0, i), ...remaining.slice(i + 1)],
      );
    }
  };
  permute([], letters);
  const keys = [...found].sort();
  return { answer: keys.length, sample: keys[0] ?? '' };
}
/** 並べ方の問題文と解説 (種類ごとに、条件と解法を正しく反映させる) */
function arrangeTreeText(
  variant: ArrangeTreeVariant,
  letters: string[],
  ans: number,
): { question: string; explanation: string } {
  const n = letters.length;
  const x = letters[0];
  const y = letters[1];
  const list = letters.join('、');

  switch (variant) {
    case 'all': {
      const chain = n <= 1 ? '1通り' : `${n}×${n - 1}×…×1＝${factorial(n)}通り`;
      return {
        question: `${list}の${n}個の文字をすべて1回ずつ使って、左から1列に並べます。並べ方は何通りありますか`,
        explanation: `1番めの文字は${n}通り、2番めは${n - 1}通り、…と選ぶので、${chain}です。`,
      };
    }
    case 'fixed_first': {
      const rest = n - 1;
      const chain = rest <= 1 ? '1通り' : `${rest}×${rest - 1}×…×1＝${factorial(rest)}通り`;
      return {
        question: `${list}の${n}個の文字のうち、${x}は1番め（いちばん左）に置くと決まっています。残りの${rest}個を自由に並べて、並べ方は何通りありますか`,
        explanation: `${x}の位置が決まっているので、残り${rest}個の並び方だけ数えます。${chain}です。`,
      };
    }
    case 'both_ends': {
      const rest = n - 2;
      // 残り1個以下では「a×b×…×1」の形が壊れるので表現を分ける
      const restText = rest <= 1 ? '1通り' : `${rest}×${rest - 1}×…×1＝${factorial(rest)}通り`;
      const restFactor = rest <= 1 ? '1' : `${factorial(rest)}`;
      return {
        question: `${list}の${n}個の文字のうち、${x}と${y}を左右のはしに入れると決まっています。残りの${rest}個を自由に並べて、並べ方は何通りありますか`,
        explanation: `${x}と${y}の左右は入れかわるので2通りあり、残り${rest}個は${restText}です。2×${restFactor}＝${ans}通りです。`,
      };
    }
    case 'adjacent':
      return {
        question: `${list}の${n}個の文字のうち、${x}と${y}は必ず隣り合うように並べます。並べ方は何通りありますか`,
        explanation: `${x}と${y}を1つのまとまりにすると、並べる対象は${n - 1}個なので${factorial(n - 1)}通りです。ただし${x}と${y}の左右は入れかわるので、${factorial(n - 1)}×2＝${ans}通りです。`,
      };
    case 'circle':
      return {
        question: `${list}の${n}個の文字を円卓のまわりに1つずつ並べます。回転させたら重なる並びは同じものとして数えます。並べ方は何通りありますか`,
        explanation: `決まった文字を1つの目印にすると、他の${n - 1}個の並びが決まれば全体の並びも決まります。よって${n - 1}×${n - 2}×…×1＝${ans}通りです。`,
      };
  }
}

/**
 * 並べ方 (樹形図の利用)
 *
 * Phase 2-A の変更点:
 *   - 以前は「n 個の文字を自由に並べる」1種類しかなく、n が3〜6の4通りしか
 *     存在せず、1000問中4問 (0.4%) しか異なる問題が出なかった。
 *   - 小6の「並べ方」の範囲内で、条件の異なる5種類を用意した。
 *     (人名や記号だけを替える変更はしていない)
 *   - 答えはすべて全列挙で確定させるため、解釈の揺れが起きない。
 */
export class TreeDiagramGenerator implements ProblemGenerator {
  readonly type = 'arrange_tree';
  readonly category = 'combinatorics' as const;
  readonly description = '並べ方 (樹形図の利用)';

  generate(config?: GenerationConfig): Problem {
    const rng = createRandom(config?.seed);
    // Use provided difficulty, default to 2 (normal) if not specified
    const lv = config?.difficulty ?? (2 as DifficultyLevel);

    const variants = ARRANGE_TREE_VARIANTS[lv];
    const [minN, maxN] = ARRANGE_TREE_N[lv];
    const n = rng.int(minN, maxN);

    // both_ends / adjacent は2文字を固定するので3個以上必要
    const usable = variants.filter(
      (v) => (v === 'both_ends' || v === 'adjacent' ? n >= 3 : true),
    );
    const variant = rng.pick(usable.length > 0 ? usable : variants);

    const letters = ARRANGE_LETTERS.slice(0, n);
    const { answer } = solveArrangement(variant, letters);
    const { question, explanation } = arrangeTreeText(variant, letters, answer);

    return {
      id: generateProblemId(),
      category: this.category,
      type: this.type,
      difficulty: createCombDifficulty(
        lv,
        n,
        Math.min(3, lv) as DifficultyLevel,
        Math.min(2, lv) as DifficultyLevel,
      ),
      question,
      answer: { kind: 'integer', value: answer },
      explanation,
      parameters: { n, letters, variant, answer, difficultyLevel: lv },
    };
  }

  validate(problem: Problem): ValidationResult {
    const errors: string[] = [];
    const { n, letters, variant, answer } = problem.parameters as {
      n: number;
      letters: string[];
      variant: ArrangeTreeVariant;
      answer: number;
    };
    if (!Array.isArray(letters) || letters.length !== n || letters.length === 0) {
      errors.push('並べる文字の構成が不正です');
      return { valid: false, errors };
    }
    const expected = solveArrangement(variant, letters).answer;
    if (answer !== expected) {
      errors.push(`並べ方が誤っています (期待値 ${expected}, 実際 ${answer})`);
    }
    return { valid: errors.length === 0, errors };
  }
}

/**
 * 表（または規則性）で組み合わせを数える問題の種類
 *
 * 総当たり試合だけだと「チーム数を数えるだけ」になるため、
 * 数える対象や条件、2回数える扱いが異なる4種類を用意する。
 * どれも小6で扱える初等的な数え方（全体に数えて2でわる／2倍する等）で解ける。
 */
export type CombineTableVariant =
  | 'round_robin' // 総当たり（どの2チームも1回ずつ）
  | 'two_rounds' // ホーム側とアウェイ側で2回ずつ試合する
  | 'one_team_games' // ある1チームが試合する数だけを数える
  | 'one_game_pairs'; // 1試合の相手になる2チームの選び方

/** 難易度ごとの候補 (新しい種類ほど数え方に工夫が必要になる) */
const COMBINE_TABLE_VARIANTS: Record<DifficultyLevel, CombineTableVariant[]> = {
  1: ['round_robin'],
  2: ['round_robin', 'two_rounds'],
  3: ['round_robin', 'two_rounds', 'one_team_games'],
  4: ['round_robin', 'two_rounds', 'one_team_games', 'one_game_pairs'],
  5: ['two_rounds', 'one_team_games', 'one_game_pairs'],
};

/**
 * 難易度ごとのチーム数。
 *
 * 条件の種類だけでなく、チーム数そのものも多様性の要素になる。
 * 10 チームまで広げても組合せの計算は軽い。
 */
const COMBINE_TABLE_N: Record<DifficultyLevel, [number, number]> = {
  1: [4, 5],
  2: [4, 7],
  3: [5, 8],
  4: [6, 10],
  5: [7, 10],
};

/** 種類ごとの答え (rounds は解説に書く式も一緒に返す) */
function solveCombineTable(
  variant: CombineTableVariant,
  n: number,
): { answer: number; formula: string } {
  switch (variant) {
    case 'round_robin':
      // 1回ずつなら n(n-1) 通りの「誰と誰」を2で割る
      return { answer: combination(n, 2), formula: `${n}×${n - 1}÷2` };
    case 'two_rounds':
      // ホームとアウェイがあるので2回分
      return { answer: n * (n - 1), formula: `${n}×${n - 1}` };
    case 'one_team_games':
      // 1チームが試合する回数は残り n-1 試合
      return { answer: n - 1, formula: `1×${n - 1}` };
    case 'one_game_pairs':
      // 1試合は「2チームの選択」に対応する
      return { answer: combination(n, 2), formula: `${n}×${n - 1}÷2` };
  }
}

/** 表を使う問題の問題文と解説 */
function combineTableText(
  variant: CombineTableVariant,
  n: number,
  res: { answer: number; formula: string },
): { question: string; explanation: string } {
  switch (variant) {
    case 'round_robin':
      return {
        question: `${n}チームのサッカー大会で、どの2チームも1回ずつ試合します。試合の数は全部で何試合になりますか`,
        explanation: `1チームの対戦相手は${n - 1}チームなので、${n}×${n - 1}＝${n * (n - 1)}と数えられます。しかしAチーム対BチームとBチーム対Aチームは同じ試合を2回数えているので、2でわります。${n}×${n - 1}÷2＝${res.answer}試合です。`,
      };
    case 'two_rounds':
      return {
        question: `${n}チームのサッカー大会で、どの2チームも1回ずつ試合します。さらにホーム側とアウェイ側で入れかわって、もう1回ずつ試合します。試合の数は全部で何試合になりますか`,
        explanation: `1回分は${n}×${n - 1}÷2＝${combination(n, 2)}試合です。2回試合するので、${combination(n, 2)}×2＝${res.answer}試合になります。`,
      };
    case 'one_team_games':
      return {
        question: `${n}チームのサッカー大会で、どの2チームも1回ずつ試合します。このうち、ある1チームが試合する試合は何試合になりますか`,
        explanation: `${n}チームのうち、ある1チームの対戦相手は残りの${n - 1}チームです。1×${n - 1}＝${res.answer}試合です。`,
      };
    case 'one_game_pairs':
      return {
        question: `${n}チームが総当たりで1回ずつ試合します。1試合の対戦になる2チームの選び方は何通りありますか`,
        explanation: `表をかくと、1つの試合は2チームの組み合わせに対応します。${n}チームから2チームを選ぶので、${n}×${n - 1}÷2＝${res.answer}通りです。`,
      };
  }
}

/**
 * 表を使った組み合わせ
 *
 * Phase 2-A の変更点:
 *   - 以前は「n チームの総当たり」1種類のみで、1000問中6問 (0.6%) しか
 *     異なる問題が出なかった。
 *   - 数える対象・条件・二度数えの扱いが異なる4種類を用意した。
 *     (チーム数だけでなく、試合の条件そのものが違っている)
 */
export class CombineTableGenerator implements ProblemGenerator {
  readonly type = 'combine_table';
  readonly category = 'combinatorics' as const;
  readonly description = '表を使った組み合わせ';

  generate(config?: GenerationConfig): Problem {
    const rng = createRandom(config?.seed);
    // Use provided difficulty, default to 2 (normal) if not specified
    const lv = config?.difficulty ?? (2 as DifficultyLevel);

    const variants = COMBINE_TABLE_VARIANTS[lv];
    const [minN, maxN] = COMBINE_TABLE_N[lv];
    const n = rng.int(minN, maxN);
    const variant = rng.pick(variants);

    const res = solveCombineTable(variant, n);
    const { question, explanation } = combineTableText(variant, n, res);

    return {
      id: generateProblemId(),
      category: this.category,
      type: this.type,
      difficulty: createCombDifficulty(
        lv,
        n,
        Math.min(3, lv) as DifficultyLevel,
        Math.min(2, lv) as DifficultyLevel,
      ),
      question,
      answer: { kind: 'integer', value: res.answer },
      explanation,
      parameters: { n, variant, answer: res.answer, difficultyLevel: lv },
    };
  }

  validate(problem: Problem): ValidationResult {
    const errors: string[] = [];
    const { n, variant, answer } = problem.parameters as {
      n: number;
      variant: CombineTableVariant;
      answer: number;
    };
    const expected = solveCombineTable(variant, n).answer;
    if (answer !== expected) {
      errors.push(`試合数の計算が誤っています (期待値 ${expected}, 実際 ${answer})`);
    }
    return { valid: errors.length === 0, errors };
  }
}

/**
 * 重複を除く問題
 * 例: 同じ文字が入る並び順
 */
/**
 * 重複を除く問題
 * 例: 同じ文字が入る並び順
 * 難易度に応じて文字カードの構成を変え、答えが常に同じにならないようにする。
 * 答えは異なる並びを全列挙して数えるため、検証と必ず一致する。
 */

/** 重複あり順列の異なる並び方の数を数える (小6範囲なので全列挙でよい) */
function countDistinctArrangements(cards: string[]): number {
  const seen = new Set<string>();
  const permute = (current: string[], remaining: string[]): void => {
    if (remaining.length === 0) {
      seen.add(current.join(''));
      return;
    }
    for (let i = 0; i < remaining.length; i++) {
      current.push(remaining[i]);
      permute(current, [...remaining.slice(0, i), ...remaining.slice(i + 1)]);
      current.pop();
    }
  };
  permute([], cards);
  return seen.size;
}

/**
 * 重複を除く問題の構造
 *
 * Phase 2-D:
 *   以前は lv ごとに数個の手書きパターンを並べるだけ (合計19通り) で、
 *   記号は A/B/C/D の4種類しか使われなかった。
 *   「重複の構成」自体を生成するようにしている:
 *     - 記号の種類数を 2〜5 で変える (1種類だけだと重複にならない)
 *     - それぞれの記号の枚数を 1〜4 で変える
 *     - 合計枚数を 3〜7 で変える
 *   これにより「何種類が同じか」「何枚ずつあるか」が問題ごとに変わり、
 *   考え方もそれに伴って変わる (2!=2 なのか 3! なのか …)。
 *
 * 答えは異なる並びを全列挙して数えるため、
 * 構成がどう変化しても必ず解と一致する。
 */
export type DuplicateRemovalSymbolMode =
  /** アルファベット記号 (A, B, C…) を使う */
  | 'letter'
  /** 数字記号 (1, 2, 3…) を使う */
  | 'digit';

/** 構造の組合せを生成する (手書きテーブルをやめる) */
function buildDuplicateStructure(
  rng: ReturnType<typeof createRandom>,
  level: DifficultyLevel,
): { cards: string[]; symbolMode: DuplicateRemovalSymbolMode; distinctCount: number } {
  // lv1: 2種類/3枚, lv2: 2-3種類/3-4枚, lv3: 2-3種類/4-5枚,
  // lv4: 3-4種類/4-6枚, lv5: 3-5種類/5-7枚
  const kinds =
    level <= 1 ? 2 : level === 2 ? rng.int(2, 3) : level === 3 ? rng.int(2, 3) : level === 4 ? rng.int(3, 4) : rng.int(3, 5);
  const total =
    level <= 1 ? 3 : level === 2 ? rng.int(3, 4) : level === 3 ? rng.int(4, 5) : level === 4 ? rng.int(4, 6) : rng.int(5, 7);

  // 必ず 1 枚以上重複させる (重複を除く問題なので)
  const minTotal = kinds + 1;
  const totalCards = Math.max(minTotal, total);

  // 記号の種類: lv3 から数字も使えるようにする
  const symbolMode: DuplicateRemovalSymbolMode =
    level >= 3 && rng.next() < 0.35 ? 'digit' : 'letter';

  // 記号ごとの枚数配分を作る (すべて 1 枚以上、残りをランダムに配る)
  const counts = new Array<number>(kinds).fill(1);
  let remaining = totalCards - kinds;
  // 1つの記号に偏りすぎないように、分配する位置を順番に変えながら選ぶ
  let cursor = rng.int(0, kinds - 1);
  while (remaining > 0) {
    const cap = level >= 4 ? 4 : 3;
    if (counts[cursor % kinds] < cap) {
      counts[cursor % kinds]++;
      remaining--;
    }
    cursor++;
  }

  const cards: string[] = [];
  for (let i = 0; i < kinds; i++) {
    const sym = symbolMode === 'letter' ? String.fromCharCode(65 + i) : String(i + 1);
    for (let k = 0; k < counts[i]; k++) cards.push(sym);
  }
  return { cards, symbolMode, distinctCount: kinds };
}

export class DuplicateRemovalGenerator implements ProblemGenerator {
  readonly type = 'duplicate_removal';
  readonly category = 'combinatorics' as const;
  readonly description = '重複を除く';

  generate(config?: GenerationConfig): Problem {
    const rng = createRandom(config?.seed);
    // Use provided difficulty, default to 2 (normal) if not specified
    const lv = config?.difficulty ?? (2 as DifficultyLevel);

    // 重複の構成を生成し、答えは異なる並びを全列挙して確定させる
    const { cards, symbolMode } = buildDuplicateStructure(rng, lv);
    const ans = countDistinctArrangements(cards);
    const cardText = cards.join('、');
    // 記号ごとの枚数 (説明に使う)
    const counts = new Map<string, number>();
    for (const c of cards) counts.set(c, (counts.get(c) ?? 0) + 1);
    const countParts = [...counts.entries()].map(([c, k]) => `${c} が ${k} 枚`);
    const label = symbolMode === 'letter' ? '文字' : '数字';

    return {
      id: generateProblemId(),
      category: this.category,
      type: this.type,
      difficulty: createCombDifficulty(
        lv,
        cards.length,
        Math.min(3, lv) as DifficultyLevel,
        Math.min(2, lv) as DifficultyLevel,
      ),
      question:
        cardText +
        'の' +
        cards.length +
        '枚のカードをすべて使って一列に並べます。同じ' +
        label +
        'は区別できないとして、並べ方は何通りありますか',
      answer: { kind: 'integer', value: ans },
      explanation:
        countParts.join('、') +
        'あります。すべてのカードを区別して並べた数から、同じ' +
        label +
        'の入れかわりで重複したぶんを除くと、' +
        ans +
        '通りです。',
      parameters: { letters: cards, symbolMode, answer: ans, difficultyLevel: lv },
    };
  }

  validate(problem: Problem): ValidationResult {
    const errors: string[] = [];
    const { letters, answer } = problem.parameters as {
      letters: string[];
      answer: number;
    };
    if (!Array.isArray(letters) || letters.length === 0) {
      errors.push('カードの構成がありません');
      return { valid: false, errors };
    }
    const expected = countDistinctArrangements(letters);
    if (answer !== expected) errors.push('重複を除いた並べ方が誤っています');
    return { valid: errors.length === 0, errors };
  }
}
