/**
 * 小数の問題ジェネレータ
 * 小学5・6年生の範囲:
 * - 小数×小数 / 小数÷小数
 * - 小数×整数 / 小数÷整数
 * - 四捨五入
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

function createDecimalDifficulty(
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

/**
 * 小数を文字列に変換する (浮動小数点の誤差で「9.799999999999999」のようになるのを防ぐ) */
function fmt(n: number): string {
  const normalized = Math.round(n * 1e6) / 1e6;
  return String(normalized);
}

/**
 * 小数×小数の答えを厳密に求める (Phase 1-C)
 *
 * 旧実装は `Math.round(a * b * 1000) / 1000` で丸めていたため、
 * 0.24 x 0.46 = 0.1104 が 0.11 になり **数学的に違う値を正解として提示していた**
 * (診断で 300 問中 82 問が不一致だった)。
 *
 * 小数×小数では「小数部分の桁数の和が答えの小数部分の桁数」になるため、
 * 桁数を丸めるのではなく **整数演算で厳密に求める**。
 * 例: 0.24 x 0.46 → 24 x 46 / 10000 = 1104 / 10000 = 0.1104
 *
 * これにより丸めによる精度損失がゼロになり、正解・解説・途中式が完全一致する。
 */
function mulDecimalExact(a: number, b: number): number {
  const da = decimalPlaces(a);
  const db = decimalPlaces(b);
  const scale = Math.pow(10, da + db);
  // a と b を整数に持ち上げてから整数で掛け、combined の桁数だけ割る
  const ia = Math.round(a * Math.pow(10, da));
  const ib = Math.round(b * Math.pow(10, db));
  return (ia * ib) / scale;
}

/** 小数点以下の桁数 (指数表記と非有限値は 0 扱い) */
function decimalPlaces(n: number): number {
  if (!Number.isFinite(n) || Number.isInteger(n)) return 0;
  const s = String(n);
  if (s.includes('e') || s.includes('E')) return 0;
  const dot = s.indexOf('.');
  return dot < 0 ? 0 : s.length - dot - 1;
}

/**
 * 小数×小数の難易度ごとの数値範囲 (整数部×10 の上限)。
 *
 * 小数×小数で練習する技能は「小数部分の桁数の和だけ、答えの小数点を
 * 後ろに動かす」ことである。この技能は数値の大きさに依存しないため、
 * 数値を増やしても練習できる内容は変わらない。
 *
 * そこで上限は「小6 の教科書で扱う 2桁の整数部 × 1桁の整数部
 * (答えが3桁まで)」に収めた。以前の lv4-5 は
 * 8928.8 × 45.1 のような 4桁×2桁を生成しており、小学生が
 * 筆算で計算できる範囲を超えていた。
 *
 * - lv1: 0.1〜0.9 × 0.1〜0.9        (答えが1未満)
 * - lv2: 1.0〜9.9 × 0.1〜0.9        (答えが1以上になりうる)
 * - lv3: 0.1〜9.9 × 1.0〜9.9        (どちらかが1以上)
 * - lv4: 10.0〜99.9 × 0.1〜9.9      (小数側の整数部が2桁)
 * - lv5: 10.0〜99.9 × 1.0〜9.9      (両方の整数部が2桁 = 最も重い筆算)
 */
const MUL_DECIMAL_RANGE: Record<
  DifficultyLevel,
  { aMin: number; aMax: number; bMin: number; bMax: number }
> = {
  1: { aMin: 1, aMax: 9, bMin: 1, bMax: 9 },
  2: { aMin: 10, aMax: 99, bMin: 1, bMax: 9 },
  3: { aMin: 1, aMax: 99, bMin: 10, bMax: 99 },
  4: { aMin: 100, aMax: 999, bMin: 1, bMax: 99 },
  5: { aMin: 100, aMax: 999, bMin: 10, bMax: 99 },
};

/**
 * 小数×小数
 * 例: 0.3 × 0.4 = ?
 *
 * 答えの品質 (Phase 1-C): 小数部分の桁数の和が答えの桁数になるため、
 * 小数第1位までの数どうし (答えも小数第2位まで) を生成することで、
 * 小学生が扱える範囲に収める。
 */
export class DecimalMulDecimalGenerator implements ProblemGenerator {
  readonly type = 'decimal_mul_decimal';
  readonly category = 'decimal' as const;
  readonly description = '小数×小数';

  generate(config?: GenerationConfig): Problem {
    const rng = createRandom(config?.seed);
    // Use provided difficulty, default to 2 (normal) if not specified
    const lv = config?.difficulty ?? (2 as DifficultyLevel);
    const range = MUL_DECIMAL_RANGE[lv];

    // 小数の桁数は「小数第1位 × 小数第1位」に固定し、答えは小数第2位までに収める
    // (小6で扱う小数×小数の標準的な型)。
    const a = rng.int(range.aMin, range.aMax) / 10;
    const b = rng.int(range.bMin, range.bMax) / 10;
    const answer = mulDecimalExact(a, b);

    return {
      id: generateProblemId(),
      category: this.category,
      type: this.type,
      difficulty: createDecimalDifficulty(lv, Math.max(a, b), 1, 1),
      question: fmt(a) + 'に' + fmt(b) + 'をかけるといくつになりますか',
      answer: { kind: 'decimal', value: answer },
      explanation: fmt(a) + '×' + fmt(b) + '＝' + answer + 'です。',
      parameters: { a, b, answer, difficultyLevel: lv },
    };
  }

  validate(problem: Problem): ValidationResult {
    const errors: string[] = [];
    const { a, b, answer } = problem.parameters as { a: number; b: number; answer: number };
    // 丸めではなく厳密一致で検証する (精度損失を検出できないため)
    if (Math.abs(mulDecimalExact(a, b) - answer) > 1e-12) errors.push('小数×小数の答えが誤っています');
    return { valid: errors.length === 0, errors };
  }
}

/**
 * 小数÷小数
 * 例: 0.6 ÷ 0.2 = ?
 */
export class DecimalDivDecimalGenerator implements ProblemGenerator {
  readonly type = 'decimal_div_decimal';
  readonly category = 'decimal' as const;
  readonly description = '小数÷小数';

  generate(config?: GenerationConfig): Problem {
    const rng = createRandom(config?.seed);
    // Use provided difficulty, default to 2 (normal) if not specified
    const lv = config?.difficulty ?? (2 as DifficultyLevel);

    // 難易度に応じて除数と商の範囲を変化させる
    const b10 = lv <= 1 ? rng.int(1, 5) : lv === 2 ? rng.int(1, 9) : lv === 3 ? rng.int(1, 15) : lv === 4 ? rng.int(1, 25) : rng.int(1, 50);
    const quotient = lv <= 1 ? rng.int(1, 5) : lv === 2 ? rng.int(1, 9) : lv === 3 ? rng.int(1, 15) : lv === 4 ? rng.int(1, 25) : rng.int(1, 50);
    // 整数どうしを掛けてから 1 回だけ除算することで、
    // 「1.4 × 7 = 9.799999999999999」のような浮動小数点誤差を防ぐ
    // (被除数・除数ともに表示値とパラメータが一致する)
    const dividend = (b10 * quotient) / 10;
    const divisor = b10 / 10;

    return {
      id: generateProblemId(),
      category: this.category,
      type: this.type,
      difficulty: createDecimalDifficulty(lv, dividend, 1, 1),
      question: fmt(dividend) + 'を' + fmt(divisor) + 'でわると、商はいくつですか',
      answer: { kind: 'decimal', value: quotient },
      explanation:
        fmt(dividend) + '÷' + fmt(divisor) + '＝' + fmt(quotient) + 'です。',
      parameters: { dividend, divisor, quotient, answer: quotient, difficultyLevel: lv },
    };
  }

  validate(problem: Problem): ValidationResult {
    const errors: string[] = [];
    const { dividend, divisor, quotient, answer } = problem.parameters as {
      dividend: number;
      divisor: number;
      quotient: number;
      answer: number;
    };
    if (divisor === 0) errors.push('除数が0です');
    if (Math.abs(dividend / divisor - quotient) > 0.001) errors.push('小数÷小数の計算結果が誤っています');
    if (answer !== quotient) errors.push('解答が一致しません');
    return { valid: errors.length === 0, errors };
  }
}

/**
 * 小数×整数
 * 例: 0.4 × 3 = ?
 *
 * 答えの品質 (Phase 1-C): 旧実装は小数第2位 × 整数 で答えが小数第3位になる場合があり、
 * かつ 小数第3桁で丸めていたため精度損失的机会があった。
 * 小数第1位 × 整数 に固定すれば、答えは整数・小数第1位のどちらかで終わり、
 * 丸めずに厳密に計算できる。
 */
export const MUL_INTEGER_RANGE: Record<
  DifficultyLevel,
  { aMin: number; aMax: number; bMin: number; bMax: number }
> = {
  // 小数部分は第1位に固定 (答えは整数・小数第1位のどちらかで終わる)。
  // 上限は「小数側の整数部が2桁・乗数が2桁」= 小5 の教科書の実用範囲とした。
  // (以前の lv4-5 は小数部分が 999.0 まで出て 892 × 25 のように
  //  答えが5桁になる計算量になっていた)
  1: { aMin: 1, aMax: 9, bMin: 2, bMax: 5 },
  2: { aMin: 10, aMax: 99, bMin: 2, bMax: 9 },
  3: { aMin: 10, aMax: 99, bMin: 10, bMax: 20 },
  4: { aMin: 10, aMax: 99, bMin: 21, bMax: 30 },
  5: { aMin: 10, aMax: 99, bMin: 31, bMax: 50 },
};

export class DecimalMulIntegerGenerator implements ProblemGenerator {
  readonly type = 'decimal_mul_integer';
  readonly category = 'decimal' as const;
  readonly description = '小数×整数';

  generate(config?: GenerationConfig): Problem {
    const rng = createRandom(config?.seed);
    // Use provided difficulty, default to 2 (normal) if not specified
    const lv = config?.difficulty ?? (2 as DifficultyLevel);

    // 難易度に応じて小数の整数部と整数の範囲を変化させる (小数부는第1位に固定)
    const range = MUL_INTEGER_RANGE[lv];
    const a = rng.int(range.aMin, range.aMax) / 10;
    const b = rng.int(range.bMin, range.bMax);
    // 丸めずに整数演算で厳密に求める (小数第1位 × 整数 なので誤差が出ない)
    const answer = Math.round(a * 10) * b / 10;

    return {
      id: generateProblemId(),
      category: this.category,
      type: this.type,
      difficulty: createDecimalDifficulty(lv, a, 1, 1),
      question: fmt(a) + '×' + b + ' はいくつになりますか',
      answer: { kind: 'decimal', value: answer },
      explanation: fmt(a) + '×' + b + '＝' + answer + 'です。',
      parameters: { a, b, answer, difficultyLevel: lv },
    };
  }

  validate(problem: Problem): ValidationResult {
    const errors: string[] = [];
    const { a, b, answer } = problem.parameters as { a: number; b: number; answer: number };
    // 厳密一致で検証する (丸めにより精度損失が起きていないことを確認)
    if (Math.abs(Math.round(a * 10) * b / 10 - answer) > 1e-12) errors.push('小数×整数の計算結果が誤っています');
    return { valid: errors.length === 0, errors };
  }
}

/**
 * 小数÷整数
 * 例: 0.8 ÷ 4 = ?
 */
export class DecimalDivIntegerGenerator implements ProblemGenerator {
  readonly type = 'decimal_div_integer';
  readonly category = 'decimal' as const;
  readonly description = '小数÷整数';

  generate(config?: GenerationConfig): Problem {
    const rng = createRandom(config?.seed);
    // Use provided difficulty, default to 2 (normal) if not specified
    const lv = config?.difficulty ?? (2 as DifficultyLevel);

    // 難易度に応じて除数と商の範囲を変化させる
    const divisor = lv <= 1 ? rng.int(2, 5) : lv === 2 ? rng.int(2, 9) : lv === 3 ? rng.int(2, 15) : lv === 4 ? rng.int(3, 25) : rng.int(5, 50);
    const rawQuotient = lv <= 1 ? rng.int(1, 5) : lv === 2 ? rng.int(1, 9) : lv === 3 ? rng.int(1, 15) : lv === 4 ? rng.int(1, 25) : rng.int(1, 50);
    // 小数 ÷ 整数 (被除数は小数第1位)。商は rawQuotient/10 (単一の除算できれいな値になる)
    const dividend = (divisor * rawQuotient) / 10;
    const quotient = rawQuotient / 10;

    return {
      id: generateProblemId(),
      category: this.category,
      type: this.type,
      difficulty: createDecimalDifficulty(lv, dividend, 1, 1),
      question: fmt(dividend) + 'を' + divisor + 'でわると、いくつになりますか',
      answer: { kind: 'decimal', value: quotient },
      explanation: fmt(dividend) + '÷' + divisor + '＝' + fmt(quotient) + 'です。',
      parameters: { dividend, divisor, quotient, answer: quotient, difficultyLevel: lv },
    };
  }

  validate(problem: Problem): ValidationResult {
    const errors: string[] = [];
    const { dividend, divisor, quotient, answer } = problem.parameters as {
      dividend: number;
      divisor: number;
      quotient: number;
      answer: number;
    };
    if (Math.abs(dividend / divisor - quotient) > 0.001) errors.push('小数÷整数の計算結果が誤っています');
    if (answer !== quotient) errors.push('解答が一致しません');
    return { valid: errors.length === 0, errors };
  }
}

/**
 * 小数の四捨五入の難易度ごとの設計。
 *
 * 修正前の実装には「丸めても値が変化しない」問題が大多数だった。
 * 入力の小数桁数と丸める桁が同じ (または入力の桁数が少ない) ため、
 * 四捨五入しても答えが入力と一致していた。
 * 例: 316.2 を小数第3位まで四捨五入 → 316.2 (丸めが起きない)
 *
 * さらに丸める桁を小数第3位までにしていたため、小学校6年の範囲
 * (小数第2位まで) を超えていた。
 *
 * 現在の設計:
 * - 「丸めの桁より1桁多く小数桁を持たせる」 = 必ず丸めが起きる構造にする
 * - 判定桁 (小数第(roundTo+1)桁) は切り上げ(5〜9)と切り捨て(0〜4)を
 *   ほぼ同数だけ出し、「5未満なら切り捨て / 5以上なら切り上げ」の
 *   **分岐そのものを**練習できるようにする (第3次監査で修正)
 * - 丸める桁は小数第1位 / 小数第2位 の2段階 (小6 で扱える範囲)
 */
const ROUND_SPEC: Record<
  DifficultyLevel,
  { intMax: number; roundTo: number }
> = {
  // lv1: 整数1桁・小数第2位 → 小数第1位まで (基本)
  1: { intMax: 9, roundTo: 1 },
  // lv2: 整数2桁・小数第2位 → 小数第1位まで
  2: { intMax: 99, roundTo: 1 },
  // lv3: 整数1桁・小数第3位 → 小数第2位まで (「小数第2位まで」という新しい概念)
  3: { intMax: 9, roundTo: 2 },
  // lv4: 整数2桁・小数第3位 → 小数第2位まで
  4: { intMax: 99, roundTo: 2 },
  // lv5: 整数3桁・小数第3位 → 小数第2位まで (最大負荷)
  5: { intMax: 999, roundTo: 2 },
};

/**
 * 「必ず丸めが起きる」小数を1つ作る。
 *
 * decimals = 丸める桁 + 1 に固定し、そのうち小数第 (roundTo+1) 桁を
 * 5〜9 (ランダム) にすることで、四捨五入で値が必ず変化するようにする。
 */
/**
 * 「丸めの規則が判断できる」小数を1つ作る。
 *
 * decimals = 丸める桁 + 1 に固定する (これより桁が細かいと判定桁が読めない)。
 *
 * 判定桁 (小数第 roundTo+1 桁) は「必ず5以上」だけにしない。
 * 四捨五入の学習目標は「5未満なら切り捨て、5以上なら切り上げ」の
 * **判定そのもの**なので、5未満 (切り捨て) と5以上 (切り上げ) を
 * ほぼ同数出現させる。5ちょうど (境界) も全体の約1割混入させる。
 *
 * 独立監査で、判定桁を5〜9に固定していたときは
 * 切り上げ99.2% / 切り捨て0.8% となり「5未満で切り捨て」を
 * ほとんど練習できていないことが判明したため修正した。
 */
function buildRoundingValue(
  rng: ReturnType<typeof createRandom>,
  intMax: number,
  roundTo: number,
  roundUp: boolean,
): number {
  const intPart = rng.int(1, intMax);
  const decimals = roundTo + 1;
  // 判定桁: 切り上げなら 5〜9、切り捨てなら 0〜4。
  // さらに1割の確率で「5ちょうど」の境界値を入れる (四捨五入の分岐点)。
  const judgeDigit = roundUp ? rng.int(5, 9) : rng.int(0, 4);
  let value = intPart;
  for (let pos = 1; pos <= decimals; pos++) {
    const digit =
      pos === decimals
        ? rng.int(0, 9) === 0
          ? 5
          : judgeDigit
        : rng.int(0, 9);
    value += digit / Math.pow(10, pos);
  }
  // 桁を足し合わせた結果には浮動小数点の誤差 (69.66999999999999) が残るため、
  // 「小数第 decimals 位まで」で整数に戻してから1回だけ割る。
  // 判定桁は整数として復元されるので、この丸めでは消えない。
  return Math.round(value * Math.pow(10, decimals)) / Math.pow(10, decimals);
}

/**
 * 小数の四捨五入
 * 例: 3.47 を小数第1位まで四捨五入 → 3.5
 *
 * 「丸めても変わらない問題」を出さないことが最優先の要件。
 * 生成後に value === rounded なら再抽選する (保険)。
 */
export class DecimalRoundGenerator implements ProblemGenerator {
  readonly type = 'decimal_round';
  readonly category = 'decimal' as const;
  readonly description = '四捨五入';

  generate(config?: GenerationConfig): Problem {
    const rng = createRandom(config?.seed);
    // Use provided difficulty, default to 2 (normal) if not specified
    const lv = config?.difficulty ?? (2 as DifficultyLevel);
    const spec = ROUND_SPEC[lv];

    const scale = Math.pow(10, spec.roundTo);
    let value = 0;
    let rounded = 0;
    // 切り上げ・切り捨てをほぼ同数だけ出す。
    // 四捨五入の学習内容は「判定桁が5未満かどうか」の分岐なので、
    // 片側だけを出す型では規則を練習できない。
    const roundUp = rng.int(0, 1) === 1;
    // 丸めが起きない値を引いた場合の保険 (構造的には起きないはずだが二重で保証する)
    for (let attempt = 0; attempt < 50; attempt++) {
      value = buildRoundingValue(rng, spec.intMax, spec.roundTo, roundUp);
      rounded = Math.round(value * scale) / scale;
      if (value !== rounded) break;
    }

    return {
      id: generateProblemId(),
      category: this.category,
      type: this.type,
      difficulty: createDecimalDifficulty(lv, value, 1, 1),
      question: fmt(value) + 'を、小数第' + spec.roundTo + '位まで四捨五入しなさい',
      answer: { kind: 'decimal', value: rounded },
      explanation:
        fmt(value) + 'の小数第' + (spec.roundTo + 1) + '桁に注目します。'
        + fmt(value) + 'は小数第' + spec.roundTo + '位まで四捨五入すると'
        + fmt(rounded) + 'です。',
      parameters: {
        value,
        roundTo: spec.roundTo,
        rounded,
        answer: rounded,
        difficultyLevel: lv,
      },
    };
  }

  validate(problem: Problem): ValidationResult {
    const errors: string[] = [];
    const { value, roundTo, rounded, answer } = problem.parameters as {
      value: number;
      roundTo: number;
      rounded: number;
      answer: number;
    };
    const scale = Math.pow(10, roundTo);
    const expected = Math.round(value * scale) / scale;
    if (Math.abs(expected - rounded) > 1e-9) errors.push('四捨五入の結果が誤っています');
    if (answer !== rounded) errors.push('解答が一致しません');
    // 丸めても変わらない問題は学習価値が無い (無意味問題の品質ゲートと対応)
    if (value === rounded) errors.push('丸めても値が変わらない問題です');
    return { valid: errors.length === 0, errors };
  }
}

/* ------------------------------------------------------------------------- *
 * Phase 2-T: 小数の位取り (3年 A(5) / 4年 A(4))
 *
 * 学習指導要領解説 小学校算数編 (一次資料) で確認した学年配当:
 *   - 第3学年 A(5)「小数の意味と表し方」小数の意味と表し方／小数の加法，減法
 *     (解説: 「0.6 は 0.1 の六つ分を意味し」)
 *   - 第4学年 A(4)「小数の仕組みとその計算」小数を用いた倍／小数と数の相対的な大きさ
 *     (解説: 「第４学年から第５学年で、1/10 の位、1/100 の位などについて指導し、
 *      小数が十進位取り記数法によって表されることの理解を深める」)
 *
 * 既存の decimal_* は計算のみを扱うため、位取りの理解として新設する。
 * ------------------------------------------------------------------------- */

export type DecimalPlaceValueVariant =
  /** ある位の数字を読む */
  | 'read_digit'
  /** ある1つの位が表す大きさを答える */
  | 'place_value'
  /** 位ごとの和で小数を表す */
  | 'decompose'
  /** 位の数字をもとに小数を作る */
  | 'compose';

/** 小数点以下の位 (1=10分の1の位) → 位の名称 */
const PLACE_LABEL: Record<number, string> = {
  1: '10分の1の位',
  2: '100分の1の位',
  3: '1000分の1の位',
};

/**
 * このジェネレータが出題する小数の最大桁数 (小数第2位まで)。
 *
 * 桁数は lv<=2 で第1位、lv>=3 で第2位までに制限されているため、
 * 答えは必ず小数第2位で終わる。浮動小数点演算の残渣
 * (0.1 * 3 = 0.30000000000000004) を防ぐ丸め精度もここに合わせる。
 */
const MAX_PLACE_DECIMALS = 2;

/** 小数を安定的に文字列化する (0.30000000000000004 を防ぐ) */
function fmtDecimal(n: number): string {
  return String(Math.round(n * 1e6) / 1e6);
}

/** 浮動小数点の残渣去除のため、桁数を指定して丸める */
function roundTo(n: number, digits: number): number {
  const f = Math.pow(10, digits);
  return Math.round(n * f) / f;
}

/** 小数点以下の数字列から小数の数値を作る */
function digitsToDecimal(digits: number[]): number {
  return Number('0.' + digits.map((d) => String(d)).join(''));
}

export class DecimalPlaceValueGenerator implements ProblemGenerator {
  readonly type = 'decimal_place_value';
  readonly category = 'decimal' as const;
  readonly description = '小数の位取り';

  generate(config?: GenerationConfig): Problem {
    const rng = createRandom(config?.seed);
    const lv = config?.difficulty ?? (2 as DifficultyLevel);

    // 桁数は 3年=小数第1位、4〜5年=第2位まで。lvを上げても桁は増やしすぎない。
    const maxPlace = lv <= 2 ? 1 : 2;
    const usable: DecimalPlaceValueVariant[] =
      lv <= 2
        ? ['read_digit', 'place_value', 'compose']
        : ['read_digit', 'place_value', 'decompose', 'compose'];

    for (let attempt = 0; attempt < 60; attempt++) {
      const variant = rng.pick(usable);
      const place = rng.int(1, maxPlace);
      const weight = Math.pow(10, -place);
      const label = PLACE_LABEL[place];
      const unitText = '0.' + '0'.repeat(place - 1) + '1';

      if (variant === 'read_digit') {
        const digits: number[] = [];
        for (let i = 1; i <= place; i++) digits.push(rng.int(0, 9));
        // 答えが 0 問題は品質ゲート (degenerate zero answers) に引っかかるため、
// 読ませる位の数字 (最下位) は必ず 1〜9 にする。ほかの位は 0 を許してよい。
        digits[place - 1] = rng.int(1, 9);
        const text = '0.' + digits.join('');
        const answer = digits[place - 1];
        return {
          id: generateProblemId(),
          category: this.category,
          type: this.type,
          difficulty: createDecimalDifficulty(lv, Number(text)),
          question: '小数 ' + text + ' の' + label + 'の数字は何ですか。',
          answer: { kind: 'integer', value: answer },
          explanation:
            '小数 ' + text + ' の小数点は' + place + 'けた目まであります。' +
            label + 'の数字は ' + answer + ' です。',
          parameters: { variant, place, digits, answer, difficultyLevel: lv },
        };
      }

      if (variant === 'place_value') {
        const digit = rng.int(1, 9);
        // 素の浮動小数点演算 (digit * 10^-place) は 0.30000000000000004 の
        // ような残渣を生む。そのまま answer.value に入れると
        // formatAnswer や解答表示が「0.30000000000000004」になり、
        // 小6の学習者が書き写せる値ではない。
        // この問いの答えは「digit を place 桁の小数で表した値」で、
        // 表記仕様も小数第 MAX_PLACE_DECIMALS 位までなので、
        // その桁数に丸めて保持する (丸めは表示精度の統一であり、
        // 近似の追加ではない: 3 × 0.1 = 0.3 は厳密に 0.3)。
        const answer = roundTo(digit * weight, MAX_PLACE_DECIMALS);
        return {
          id: generateProblemId(),
          category: this.category,
          type: this.type,
          difficulty: createDecimalDifficulty(lv, answer),
          question: label + 'が' + digit + 'のとき、小数はいくつになりますか。',
          answer: { kind: 'decimal', value: answer },
          explanation:
            label + 'は 1 の ' + Math.pow(10, place) + ' 分の1なので、' + unitText +
            ' が1つ分です。数字が ' + digit + ' なら ' + digit + ' 個分なので ' +
            fmtDecimal(answer) + ' です。',
          parameters: { variant, place, digit, answer, difficultyLevel: lv },
        };
      }

      if (variant === 'decompose') {
        if (place >= 2) continue;
        const low = rng.int(1, 5);
        const high = rng.int(1, 8);
        const bigPart = high * weight;
        const smallPart = low * 0.1;
        const total = bigPart + smallPart;
        return {
          id: generateProblemId(),
          category: this.category,
          type: this.type,
          difficulty: createDecimalDifficulty(lv, total),
          question:
            '小数 ' + fmtDecimal(total) + ' を、' + label + 'と' +
            PLACE_LABEL[2] + 'の和で表してください。',
          answer: {
            kind: 'string',
            value: fmtDecimal(bigPart) + ' + ' + fmtDecimal(smallPart),
          },
          explanation:
            label + 'の値は ' + fmtDecimal(bigPart) + '、' + PLACE_LABEL[2] +
            'の値は ' + fmtDecimal(smallPart) + ' です。両者を足すと ' +
            fmtDecimal(total) + ' になります。',
          parameters: {
            variant, place, low, high, bigPart, smallPart, answer: total,
            difficultyLevel: lv,
          },
        };
      }

      // compose: 位の数字から小数を作る
      const digits: number[] = [];
      for (let i = 1; i <= place; i++) digits.push(rng.int(0, 9));
      if (digits.every((d) => d === 0)) continue;
      const answer = digitsToDecimal(digits);
      const parts: string[] = [];
      for (let i = 1; i <= place; i++) {
        if (digits[i - 1] !== 0) {
          parts.push(digits[i - 1] + ' × ' + fmtDecimal(Math.pow(10, -i)));
        }
      }
      const given = digits
        .map((d, idx) => PLACE_LABEL[idx + 1] + 'が' + d)
        .join('、');
      return {
        id: generateProblemId(),
        category: this.category,
        type: this.type,
        difficulty: createDecimalDifficulty(lv, answer),
        question: given + 'となる小数を作ってください。',
        answer: { kind: 'decimal', value: answer },
        explanation:
          '各位の数字をその位の重みにかけます。' + parts.join(' ＋ ') +
          ' ＝ ' + fmtDecimal(answer) + ' です。',
        parameters: { variant, place, digits, answer, difficultyLevel: lv },
      };
    }

    throw new Error('小数の位取りの問題を生成できませんでした');
  }

  validate(problem: Problem): ValidationResult {
    const errors: string[] = [];
    const params = problem.parameters as {
      variant: DecimalPlaceValueVariant;
      place: number;
      digits?: number[];
      digit?: number;
      answer: number | string;
    };
    const { variant, place, digits, digit, answer } = params;
    if (place < 1 || place > 3) errors.push('対象とする位が不正です');

    if (variant === 'read_digit' && digits) {
      if (Number(answer) !== digits[place - 1]) errors.push('読み取った数字が誤っています');
    } else if (variant === 'place_value' && digit !== undefined) {
      const expect = digit * Math.pow(10, -place);
      if (typeof answer !== 'number' || Math.abs(answer - expect) > 1e-12) {
        errors.push('位が表す大きさが誤っています');
      }
    } else if (variant === 'compose' && digits) {
      const expect = digitsToDecimal(digits);
      if (typeof answer !== 'number' || Math.abs(answer - expect) > 1e-12) {
        errors.push('位の数字から作った小数が誤っています');
      }
    }
    return { valid: errors.length === 0, errors };
  }
}