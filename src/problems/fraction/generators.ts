/**
 * 分数の問題ジェネレータ
 * 小学6年生の学習範囲:
 * - 分数×整数 / 分数×分数 / 帯分数の掛け算
 * - 分数÷整数 / 分数÷分数 / 帯分数の割り算
 * - 約分 / 通分 / 仮分数・帯分数の変換
 * - 分数の大きさ比較 / 倍を表す分数 / 分数の文章題
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
  reduceFraction,
  multiplyFractions,
  divideFractions,
  toMixedNumber,
  formatFractionJapanese,
  isValidFraction,
  gcd,
  commonDenominatorForm,
} from '../../utils/fraction';
import {
  createDifficulty,
  numberSizeToComplexity,
  calculationStepsToComplexity,
} from '../../engine/difficulty/difficulty';

/**
 * 分数問題の難易度を作成する
 */
function createFractionDifficulty(
  level: DifficultyLevel,
  value: number,
  reasoningLevel: DifficultyLevel = 2,
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
 * 分数の日本語表記 (問題文用)
 * 例: 3/4 -> 4分の3
 */
function fractionJapanese(n: number, d: number): string {
  const r = reduceFraction(n, d);
  if (r.denominator === 1) return String(r.numerator);
  return r.denominator + '分の' + r.numerator;
}

/**
 * 約分する前の分数をそのまま日本語表記する。
 *
 * fractionJapanese は約分した結果を表示するため、「約分しなさい」問題では
 * 答えを問題文に出してしまう (例: 4/8 → 「2分の1（分子4、分母8）を約分しなさい」)。
 * 約分問題では必ずこちらを使う。
 */
function rawFractionJapanese(n: number, d: number): string {
  if (d === 1) return String(n);
  return d + '分の' + n;
}

/**
 * 帯分数の日本語表記
 * 例: 1と2/3 → 1と3分の2
 */
function mixedJapanese(whole: number, numerator: number, denominator: number): string {
  const r = reduceFraction(numerator, denominator);
  if (whole === 0) return fractionJapanese(r.numerator, r.denominator);
  return whole + 'と' + r.denominator + '分の' + r.numerator;
}

/**
 * 帯分数を仮分数に変換する
 */
function mixedToImproper(
  whole: number,
  numerator: number,
  denominator: number,
): { numerator: number; denominator: number } {
  return {
    numerator: whole * denominator + numerator,
    denominator,
  };
}

/**
 * 仮分数を帯分数へ変換して解として返す
 */
function improperToAnswer(
  numerator: number,
  denominator: number,
): Problem['answer'] {
  const r = reduceFraction(numerator, denominator);
  if (r.denominator === 1) {
    return { kind: 'integer', value: r.numerator };
  }
  const mixed = toMixedNumber(r.numerator, r.denominator);
  if (mixed.whole !== 0) {
    return {
      kind: 'mixed',
      whole: mixed.whole,
      numerator: mixed.numerator,
      denominator: mixed.denominator,
    };
  }
  return { kind: 'fraction', numerator: r.numerator, denominator: r.denominator };
}

/**
 * 解答を日本語の分数表記に変換 (テンプレート用)
 */
function formatAnswerJapanese(answer: Problem['answer']): string {
  switch (answer.kind) {
    case 'integer':
      return String(answer.value);
    case 'decimal':
      return String(answer.value);
    case 'fraction':
      return formatFractionJapanese(answer.numerator, answer.denominator);
    case 'mixed':
      return (
        answer.whole + 'と' + answer.denominator + '分の' + answer.numerator
      );
    case 'string':
      return answer.value;
    case 'fractions':
      return answer.values
        .map((v) => v.numerator + '/' + v.denominator)
        .join('と');
  }
}

/**
 * 分数×整数
 * 例: 3/4 × 2 = ?
 */
export class FractionMulIntegerGenerator implements ProblemGenerator {
  readonly type = 'fraction_mul_integer';
  readonly category = 'fraction' as const;
  readonly description = '分数×整数';

  generate(config?: GenerationConfig): Problem {
    const rng = createRandom(config?.seed);
    // Use provided difficulty, default to 2 (normal) if not specified
    const lv = config?.difficulty ?? (2 as DifficultyLevel);

    for (let attempt = 0; attempt < 100; attempt++) {
      const problem = this.tryGenerate(rng, lv);
      if (problem) return problem;
    }
    throw new Error('分数×整数の問題を生成できませんでした');
  }

  private tryGenerate(
    rng: ReturnType<typeof createRandom>,
    lv: DifficultyLevel,
  ): Problem | null {
    // 難易度に応じて分母・分子・整数の範囲を変化させる
    const denominator =
      lv <= 1 ? rng.int(2, 6) : lv === 2 ? rng.int(2, 9) : lv === 3 ? rng.int(2, 12) : lv === 4 ? rng.int(3, 15) : rng.int(4, 20);
    const numerator =
      lv <= 1 ? rng.int(1, denominator - 1) : lv === 2 ? rng.int(1, denominator * 2) : lv === 3 ? rng.int(1, denominator * 3) : lv === 4 ? rng.int(1, denominator * 4) : rng.int(1, denominator * 5);
    const integer =
      lv <= 1 ? rng.int(2, 6) : lv === 2 ? rng.int(2, 9) : lv === 3 ? rng.int(2, 12) : lv === 4 ? rng.int(3, 15) : rng.int(4, 20);

    if (numerator === 0 || denominator === 0) return null;

    // 分数×整数なのに分数にならない (整数に約分される) 場合を弾く。
    // 例: 12/4 は問題文が「3に8をかける」となり、
    // 整数乗算 (integer_multiplication) と同じ問題になってしまう。
    if (reduceFraction(numerator, denominator).denominator === 1) return null;

    const result = reduceFraction(numerator * integer, denominator);
    const answer = improperToAnswer(result.numerator, result.denominator);
    const expStr =
      fractionJapanese(numerator, denominator) +
      '（分子' + numerator + '、分母' + denominator + '）×' +
      integer +
      '＝' +
      formatFractionJapanese(result.numerator, result.denominator) +
      (result.denominator === 1 ? '' : '＝' + formatAnswerJapanese(answer)) +
      'です。';

    return {
      id: generateProblemId(),
      category: this.category,
      type: this.type,
      difficulty: createFractionDifficulty(lv, integer, 1, 1),
      question:
        fractionJapanese(numerator, denominator) +
        'に' +
        integer +
        'をかけるといくつになりますか',
      answer,
      explanation: expStr,
      parameters: {
        numerator,
        denominator,
        integer,
        answerNumerator: result.numerator,
        answerDenominator: result.denominator,
        difficultyLevel: lv,
        requiresReduction: gcd(numerator * integer, denominator) > 1,
        isImproper: numerator * integer >= denominator,
      },
    };
  }

  validate(problem: Problem): ValidationResult {
    const errors: string[] = [];
    const { numerator, denominator, integer, answerNumerator, answerDenominator } =
      problem.parameters as {
        numerator: number;
        denominator: number;
        integer: number;
        answerNumerator: number;
        answerDenominator: number;
      };
    const expected = reduceFraction(numerator * integer, denominator);
    if (
      expected.numerator !== answerNumerator ||
      expected.denominator !== answerDenominator
    ) {
      errors.push('分数×整数の答えが誤っています');
    }
    return { valid: errors.length === 0, errors };
  }
}

/**
 * 分数×分数
 */
export class FractionMulFractionGenerator implements ProblemGenerator {
  readonly type = 'fraction_mul_fraction';
  readonly category = 'fraction' as const;
  readonly description = '分数×分数';

  generate(config?: GenerationConfig): Problem {
    const rng = createRandom(config?.seed);
    // Use provided difficulty, default to 2 (normal) if not specified
    const lv = config?.difficulty ?? (2 as DifficultyLevel);

    for (let attempt = 0; attempt < 100; attempt++) {
      const problem = this.tryGenerate(rng, lv);
      if (problem) return problem;
    }
    throw new Error('分数×分数の問題を生成できませんでした');
  }

  private tryGenerate(
    rng: ReturnType<typeof createRandom>,
    lv: DifficultyLevel,
  ): Problem | null {
    // 難易度に応じて分母の範囲を変化させる
    const maxDen = lv <= 1 ? 6 : lv === 2 ? 9 : lv === 3 ? 12 : lv === 4 ? 15 : 20;
    const d1 = rng.int(2, maxDen);
    const n1 = rng.int(1, d1 - 1);
    const d2 = rng.int(2, maxDen);
    const n2 = rng.int(1, d2 - 1);

    const result = multiplyFractions(n1, d1, n2, d2);
    const answer = improperToAnswer(result.numerator, result.denominator);

    return {
      id: generateProblemId(),
      category: this.category,
      type: this.type,
      difficulty: createFractionDifficulty(lv, Math.max(d1, d2), 1, 1),
      question:
        fractionJapanese(n1, d1) +
        'と' +
        fractionJapanese(n2, d2) +
        'をかけるといくつになりますか',
      answer,
      explanation:
        fractionJapanese(n1, d1) +
        '（分子' + n1 + '、分母' + d1 + '）×' +
        fractionJapanese(n2, d2) +
        '（分子' + n2 + '、分母' + d2 + '）＝' +
        formatFractionJapanese(result.numerator, result.denominator) +
        (result.denominator === 1 ? '' : '＝' + formatAnswerJapanese(answer)) +
        'です。',
      parameters: {
        n1,
        d1,
        n2,
        d2,
        answerNumerator: result.numerator,
        answerDenominator: result.denominator,
        difficultyLevel: lv,
        isProperAnswer: result.numerator < result.denominator,
      },
    };
  }

  validate(problem: Problem): ValidationResult {
    const errors: string[] = [];
    const { n1, d1, n2, d2, answerNumerator, answerDenominator } =
      problem.parameters as {
        n1: number;
        d1: number;
        n2: number;
        d2: number;
        answerNumerator: number;
        answerDenominator: number;
      };
    const expected = multiplyFractions(n1, d1, n2, d2);
    if (
      expected.numerator !== answerNumerator ||
      expected.denominator !== answerDenominator
    ) {
      errors.push('分数×分数の答えが誤っています');
    }
    return { valid: errors.length === 0, errors };
  }
}

/**
 * 分数÷整数
 */
export class FractionDivIntegerGenerator implements ProblemGenerator {
  readonly type = 'fraction_div_integer';
  readonly category = 'fraction' as const;
  readonly description = '分数÷整数';

  generate(config?: GenerationConfig): Problem {
    const rng = createRandom(config?.seed);
    // Use provided difficulty, default to 2 (normal) if not specified
    const lv = config?.difficulty ?? (2 as DifficultyLevel);

    for (let attempt = 0; attempt < 100; attempt++) {
      const problem = this.tryGenerate(rng, lv);
      if (problem) return problem;
    }
    throw new Error('分数÷整数の問題を生成できませんでした');
  }

  private tryGenerate(
    rng: ReturnType<typeof createRandom>,
    lv: DifficultyLevel,
  ): Problem | null {
    // 難易度に応じて分母・整数の範囲を変化させる
    const denominator =
      lv <= 1 ? rng.int(2, 6) : lv === 2 ? rng.int(2, 9) : lv === 3 ? rng.int(2, 12) : lv === 4 ? rng.int(3, 15) : rng.int(4, 20);
    const integer =
      lv <= 1 ? rng.int(2, 6) : lv === 2 ? rng.int(2, 9) : lv === 3 ? rng.int(2, 12) : lv === 4 ? rng.int(3, 15) : rng.int(4, 20);

    // 約分できる分数 (例 4/8) を問題文に出すと、答えの計算过程中でも
    // 「最初から約分しておくべき」混乱が起きるため、
    // 問題文に出す分数は必ず最簡分数にする。
    let numerator = 1;
    for (let attempt = 0; attempt < 40; attempt++) {
      const candidate = rng.int(1, denominator - 1);
      if (gcd(candidate, denominator) === 1) {
        numerator = candidate;
        break;
      }
      numerator = candidate;
    }

    const result = divideFractions(numerator, denominator, integer, 1);
    const answer = improperToAnswer(result.numerator, result.denominator);

    return {
      id: generateProblemId(),
      category: this.category,
      type: this.type,
      difficulty: createFractionDifficulty(lv, numerator, 1, 1),
      // 分数÷整数の問題文に「（分母○）」を付けると、
      // 「3分の1（分母3）」のように同じ情報を二重に示すだけになって
      // 小学生には不自然な書き方になるため、括弧は付けない。
      question:
        fractionJapanese(numerator, denominator) +
        'を' +
        integer +
        'でわると、いくつになりますか',
      answer,
      explanation:
        fractionJapanese(numerator, denominator) +
        '÷' +
        integer +
        '＝' +
        formatFractionJapanese(result.numerator, result.denominator) +
        (result.denominator === 1 ? '' : '＝' + formatAnswerJapanese(answer)) +
        'です。',
      parameters: {
        numerator,
        denominator,
        integer,
        answerNumerator: result.numerator,
        answerDenominator: result.denominator,
        difficultyLevel: lv,
      },
    };
  }

  validate(problem: Problem): ValidationResult {
    const errors: string[] = [];
    const { numerator, denominator, integer, answerNumerator, answerDenominator } =
      problem.parameters as {
        numerator: number;
        denominator: number;
        integer: number;
        answerNumerator: number;
        answerDenominator: number;
      };
    const expected = divideFractions(numerator, denominator, integer, 1);
    if (
      expected.numerator !== answerNumerator ||
      expected.denominator !== answerDenominator
    ) {
      errors.push('分数÷整数の答えが誤っています');
    }
    return { valid: errors.length === 0, errors };
  }
}

/**
 * 分数÷分数
 */
export class FractionDivFractionGenerator implements ProblemGenerator {
  readonly type = 'fraction_div_fraction';
  readonly category = 'fraction' as const;
  readonly description = '分数÷分数';

  generate(config?: GenerationConfig): Problem {
    const rng = createRandom(config?.seed);
    // Use provided difficulty, default to 2 (normal) if not specified
    const lv = config?.difficulty ?? (2 as DifficultyLevel);

    for (let attempt = 0; attempt < 100; attempt++) {
      const problem = this.tryGenerate(rng, lv);
      if (problem) return problem;
    }
    throw new Error('分数÷分数の問題を生成できませんでした');
  }

  private tryGenerate(
    rng: ReturnType<typeof createRandom>,
    lv: DifficultyLevel,
  ): Problem | null {
    // 難易度に応じて分母の範囲を変化させる
    const maxDen = lv <= 1 ? 6 : lv === 2 ? 9 : lv === 3 ? 12 : lv === 4 ? 15 : 20;
    const d1 = rng.int(2, maxDen);
    const n1 = rng.int(1, d1 - 1);
    const d2 = rng.int(2, maxDen);
    const n2 = rng.int(1, d2 - 1);

    const result = divideFractions(n1, d1, n2, d2);
    const answer = improperToAnswer(result.numerator, result.denominator);

    return {
      id: generateProblemId(),
      category: this.category,
      type: this.type,
      difficulty: createFractionDifficulty(lv, Math.max(d1, d2), 2, 1),
      question:
        fractionJapanese(n1, d1) +
        'を' +
        fractionJapanese(n2, d2) +
        'でわると、商はいくつですか',
      answer,
      explanation:
        '÷' +
        fractionJapanese(n2, d2) +
        '（分子' + n2 + '、分母' + d2 + '） は ×' +
        fractionJapanese(d2, n2) +
        ' と同じです。' +
        fractionJapanese(n1, d1) +
        '（分子' + n1 + '、分母' + d1 + '）×' +
        fractionJapanese(d2, n2) +
        '＝' +
        formatFractionJapanese(result.numerator, result.denominator) +
        (result.denominator === 1 ? '' : '＝' + formatAnswerJapanese(answer)) +
        'です。',
      parameters: {
        n1,
        d1,
        n2,
        d2,
        answerNumerator: result.numerator,
        answerDenominator: result.denominator,
        difficultyLevel: lv,
      },
    };
  }

  validate(problem: Problem): ValidationResult {
    const errors: string[] = [];
    const { n1, d1, n2, d2, answerNumerator, answerDenominator } =
      problem.parameters as {
        n1: number;
        d1: number;
        n2: number;
        d2: number;
        answerNumerator: number;
        answerDenominator: number;
      };
    const expected = divideFractions(n1, d1, n2, d2);
    if (
      expected.numerator !== answerNumerator ||
      expected.denominator !== answerDenominator
    ) {
      errors.push('分数÷分数の答えが誤っています');
    }
    return { valid: errors.length === 0, errors };
  }
}

/**
 * 帯分数を含む掛け算
 */
export class FractionMulMixedGenerator implements ProblemGenerator {
  readonly type = 'fraction_mul_mixed';
  readonly category = 'fraction' as const;
  readonly description = '帯分数を含む掛け算';

  generate(config?: GenerationConfig): Problem {
    const rng = createRandom(config?.seed);
    // Use provided difficulty, default to 2 (normal) if not specified
    const lv = config?.difficulty ?? (2 as DifficultyLevel);

    for (let attempt = 0; attempt < 100; attempt++) {
      const problem = this.tryGenerate(rng, lv);
      if (problem) return problem;
    }
    throw new Error('帯分数の掛け算の問題を生成できませんでした');
  }

  private tryGenerate(
    rng: ReturnType<typeof createRandom>,
    lv: DifficultyLevel,
  ): Problem | null {
    // 難易度に応じて帯分数の範囲を変化させる
    const whole = lv <= 1 ? rng.int(1, 2) : lv === 2 ? rng.int(1, 2) : lv === 3 ? rng.int(1, 3) : lv === 4 ? rng.int(1, 4) : rng.int(1, 5);
    const numerator = lv <= 1 ? rng.int(1, 3) : lv === 2 ? rng.int(1, 4) : lv === 3 ? rng.int(1, 5) : lv === 4 ? rng.int(1, 6) : rng.int(1, 8);
    const denominator = rng.int(numerator + 1, lv <= 1 ? 6 : lv === 2 ? 6 : lv === 3 ? 9 : lv === 4 ? 12 : 15);

    const d2 = rng.int(2, lv <= 1 ? 6 : lv === 2 ? 6 : lv === 3 ? 9 : lv === 4 ? 12 : 15);
    const n2 = rng.int(1, d2 - 1);

    const mixed = mixedToImproper(whole, numerator, denominator);
    const result = multiplyFractions(mixed.numerator, mixed.denominator, n2, d2);
    const answer = improperToAnswer(result.numerator, result.denominator);

    return {
      id: generateProblemId(),
      category: this.category,
      type: this.type,
      difficulty: createFractionDifficulty(
        lv,
        whole * denominator + numerator,
        lv <= 1 ? 1 : 2,
        1,
      ),
      question:
        mixedJapanese(whole, numerator, denominator) +
        'と' +
        fractionJapanese(n2, d2) +
        'をかけるといくつになりますか',
      answer,
      explanation:
        mixedJapanese(whole, numerator, denominator) +
        '（分子' + numerator + '、分母' + denominator + '）＝' +
        mixed.numerator +
        '/' +
        mixed.denominator +
        ' として計算します。' +
        fractionJapanese(mixed.numerator, mixed.denominator) +
        '×' +
        fractionJapanese(n2, d2) +
        '（分子' + n2 + '、分母' + d2 + '）＝' +
        formatFractionJapanese(result.numerator, result.denominator) +
        (result.denominator === 1 ? '' : '＝' + formatAnswerJapanese(answer)) +
        'です。',
      parameters: {
        whole,
        numerator,
        denominator,
        n2,
        d2,
        mixedNumerator: mixed.numerator,
        mixedDenominator: mixed.denominator,
        answerNumerator: result.numerator,
        answerDenominator: result.denominator,
        difficultyLevel: lv,
      },
    };
  }

  validate(problem: Problem): ValidationResult {
    const errors: string[] = [];
    const {
      mixedNumerator,
      mixedDenominator,
      n2,
      d2,
      answerNumerator,
      answerDenominator,
    } = problem.parameters as {
      mixedNumerator: number;
      mixedDenominator: number;
      n2: number;
      d2: number;
      answerNumerator: number;
      answerDenominator: number;
    };
    const expected = multiplyFractions(mixedNumerator, mixedDenominator, n2, d2);
    if (
      expected.numerator !== answerNumerator ||
      expected.denominator !== answerDenominator
    ) {
      errors.push('帯分数の掛け算の答えが誤っています');
    }
    return { valid: errors.length === 0, errors };
  }
}

/**
 * 帯分数を含む割り算
 */
export class FractionMixedDivGenerator implements ProblemGenerator {
  readonly type = 'fraction_div_mixed';
  readonly category = 'fraction' as const;
  readonly description = '帯分数を含む割り算';

  generate(config?: GenerationConfig): Problem {
    const rng = createRandom(config?.seed);
    // Use provided difficulty, default to 2 (normal) if not specified
    const lv = config?.difficulty ?? (2 as DifficultyLevel);

    for (let attempt = 0; attempt < 100; attempt++) {
      const problem = this.tryGenerate(rng, lv);
      if (problem) return problem;
    }
    throw new Error('帯分数の割り算の問題を生成できませんでした');
  }

  private tryGenerate(
    rng: ReturnType<typeof createRandom>,
    lv: DifficultyLevel,
  ): Problem | null {
    // 難易度に応じて帯分数の範囲を変化させる
    const whole = lv <= 1 ? rng.int(1, 1) : lv === 2 ? rng.int(1, 1) : lv === 3 ? rng.int(1, 2) : lv === 4 ? rng.int(1, 3) : rng.int(1, 4);
    const numerator = lv <= 1 ? rng.int(1, 2) : lv === 2 ? rng.int(1, 3) : lv === 3 ? rng.int(1, 4) : lv === 4 ? rng.int(1, 5) : rng.int(1, 6);
    const denominator = rng.int(numerator + 1, lv <= 1 ? 5 : lv === 2 ? 5 : lv === 3 ? 6 : lv === 4 ? 8 : 10);

    const d2 = rng.int(2, lv <= 1 ? 5 : lv === 2 ? 5 : lv === 3 ? 6 : lv === 4 ? 8 : 10);
    const n2 = rng.int(1, d2 - 1);

    const mixed = mixedToImproper(whole, numerator, denominator);
    const result = divideFractions(mixed.numerator, mixed.denominator, n2, d2);
    const answer = improperToAnswer(result.numerator, result.denominator);

    return {
      id: generateProblemId(),
      category: this.category,
      type: this.type,
      difficulty: createFractionDifficulty(lv, whole * denominator, lv <= 1 ? 1 : 2, 1),
      question:
        mixedJapanese(whole, numerator, denominator) +
        'を' +
        fractionJapanese(n2, d2) +
        'でわると、いくつになりますか',
      answer,
      explanation:
        mixedJapanese(whole, numerator, denominator) +
        '（分子' + numerator + '、分母' + denominator + '）＝' +
        mixed.numerator +
        '/' +
        mixed.denominator +
        ' として計算します。' +
        mixed.numerator +
        '/' +
        mixed.denominator +
        '÷' +
        fractionJapanese(n2, d2) +
        '（' + n2 + '/' + d2 + '）' +
        '＝' +
        formatFractionJapanese(result.numerator, result.denominator) +
        (result.denominator === 1 ? '' : '＝' + formatAnswerJapanese(answer)) +
        'です。',
      parameters: {
        whole,
        numerator,
        denominator,
        n2,
        d2,
        mixedNumerator: mixed.numerator,
        mixedDenominator: mixed.denominator,
        answerNumerator: result.numerator,
        answerDenominator: result.denominator,
        difficultyLevel: lv,
      },
    };
  }

  validate(problem: Problem): ValidationResult {
    const errors: string[] = [];
    const {
      mixedNumerator,
      mixedDenominator,
      n2,
      d2,
      answerNumerator,
      answerDenominator,
    } = problem.parameters as {
      mixedNumerator: number;
      mixedDenominator: number;
      n2: number;
      d2: number;
      answerNumerator: number;
      answerDenominator: number;
    };
    const expected = divideFractions(mixedNumerator, mixedDenominator, n2, d2);
    if (
      expected.numerator !== answerNumerator ||
      expected.denominator !== answerDenominator
    ) {
      errors.push('帯分数の割り算の答えが誤っています');
    }
    return { valid: errors.length === 0, errors };
  }
}

/**
 * 約分の問題
 * 例: 6/8 を約分しなさい
 */
export class FractionReduceGenerator implements ProblemGenerator {
  readonly type = 'fraction_reduce';
  readonly category = 'fraction' as const;
  readonly description = '約分する';

  generate(config?: GenerationConfig): Problem {
    const rng = createRandom(config?.seed);
    // Use provided difficulty, default to 2 (normal) if not specified
    const lv = config?.difficulty ?? (2 as DifficultyLevel);

    // 約分できる分数を反復的に探す
    let denominator = 0;
    let divisor = 0;
    let numerator = 0;
    for (let attempt = 0; attempt < 100; attempt++) {
      denominator = lv === 1 ? rng.int(4, 10) : rng.int(6, 20);
      divisor = rng.int(2, lv === 1 ? 4 : 6);
      // 分子は分母未満かつ divisor の倍数にする。
      // divisor*k < denominator を満たす最大の k を使うので、
      // 「4分の4」「10分の10」のような「1を1に直すだけ」の
      // 約分問題は生成されない。
      const maxK = Math.floor((denominator - 1) / divisor);
      if (maxK < 1) continue;
      numerator = rng.int(1, maxK) * divisor;
      if (gcd(numerator, denominator) > 1) break;
    }
    if (gcd(numerator, denominator) <= 1) {
      throw new Error('約分できる分数を生成できませんでした');
    }

    const reduced = reduceFraction(numerator, denominator);
    const ans: Problem['answer'] =
      reduced.denominator === 1
        ? { kind: 'integer', value: reduced.numerator }
        : {
            kind: 'fraction',
            numerator: reduced.numerator,
            denominator: reduced.denominator,
          };

    return {
      id: generateProblemId(),
      category: this.category,
      type: this.type,
      difficulty: createFractionDifficulty(lv, numerator, lv >= 2 ? 2 : 1, 1),
      question:
        rawFractionJapanese(numerator, denominator) +
        'を約分しなさい',
      answer: ans,
      explanation:
        rawFractionJapanese(numerator, denominator) +
        ' は、分子と分母を' +
        gcd(numerator, denominator) +
        'でわると ' +
        fractionJapanese(reduced.numerator, reduced.denominator) +
        ' になります。',
      parameters: {
        numerator,
        denominator,
        answerNumerator: reduced.numerator,
        answerDenominator: reduced.denominator,
        divisor: gcd(numerator, denominator),
        difficultyLevel: lv,
      },
    };
  }

  validate(problem: Problem): ValidationResult {
    const errors: string[] = [];
    const { numerator, denominator, answerNumerator, answerDenominator } =
      problem.parameters as {
        numerator: number;
        denominator: number;
        answerNumerator: number;
        answerDenominator: number;
      };
    const expected = reduceFraction(numerator, denominator);
    if (
      expected.numerator !== answerNumerator ||
      expected.denominator !== answerDenominator
    ) {
      errors.push('約分の結果が誤っています');
    }
    if (
      !isValidFraction(answerNumerator, answerDenominator) &&
      answerDenominator !== 1
    ) {
      errors.push('約分結果が正規の分数ではありません');
    }
    return { valid: errors.length === 0, errors };
  }
}

/**
 * 通分の問題
 *
 * 生成仕様 (教育上の制約):
 * - 共通分母は必ず分母の最小公倍数 (LCM) を使用する。分母の積は使用しない。
 * - 正解は最小公倍数を用いた標準形として生成する。
 * - 問題文の分数は既約分数とする。表示 (fractionJapanese は約分して表示する) と
 *   計算 (parameters) の不一致が「3/4 と 2/5」に対し「30/40 と 16/40」のような
 *   誤った標準形を生むため、最初から既約分数だけを採用する。 [根本原因修正]
 * - 解答は文字列ではなく kind: 'fractions' の構造化データで保持し、
 *   アプリ側で LCM を再計算して検証する。
 */
export class FractionCommonDenominatorGenerator implements ProblemGenerator {
  readonly type = 'fraction_common_denominator';
  readonly category = 'fraction' as const;
  readonly description = '通分';

  generate(config?: GenerationConfig): Problem {
    const rng = createRandom(config?.seed);
    // Use provided difficulty, default to 2 (normal) if not specified
    const lv = config?.difficulty ?? (2 as DifficultyLevel);

    // 既約分数のペアを採用するまで反復する
    let f1: { numerator: number; denominator: number } | null = null;
    let f2: { numerator: number; denominator: number } | null = null;
    for (let attempt = 0; attempt < 100; attempt++) {
      const d1 = lv === 1 ? rng.int(2, 5) : rng.int(2, 8);
      let d2 = rng.int(2, lv === 1 ? 5 : 8);
      while (d2 === d1) {
        d2 = rng.int(2, lv === 1 ? 5 : 8);
      }
      const n1 = rng.int(1, d1 - 1);
      const n2 = rng.int(1, d2 - 1);

      const r1 = reduceFraction(n1, d1);
      const r2 = reduceFraction(n2, d2);
      // 約分すると分母が一致したり値が等しくなる組合せは避ける
      if (r1.denominator === r2.denominator) continue;
      if (r1.numerator * r2.denominator === r2.numerator * r1.denominator) continue;
      f1 = r1;
      f2 = r2;
      break;
    }
    if (!f1 || !f2) {
      throw new Error('通分の問題を生成できませんでした');
    }

    const n1 = f1.numerator;
    const d1 = f1.denominator;
    const n2 = f2.numerator;
    const d2 = f2.denominator;

    // 共通分母は最小公倍数。分子は common / 分母 の倍率を掛けて求める
    const { commonDenominator: common, numerators } = commonDenominatorForm(
      n1, d1, n2, d2,
    );
    const newN1 = numerators[0];
    const newN2 = numerators[1];

    return {
      id: generateProblemId(),
      category: this.category,
      type: this.type,
      difficulty: createFractionDifficulty(lv, common, 2, 2),
      question:
        fractionJapanese(n1, d1) +
        'と' +
        fractionJapanese(n2, d2) +
        'を、分母を最小公倍数にそろえて表しなさい',
      answer: {
        kind: 'fractions',
        values: [
          { numerator: newN1, denominator: common },
          { numerator: newN2, denominator: common },
        ],
      },
      explanation:
        '分母' +
        d1 +
        'と' +
        d2 +
        'の最小公倍数は' +
        common +
        'なので、' +
        fractionJapanese(n1, d1) +
        '（分子' + n1 + '、分母' + d1 + '）＝' + newN1 + '/' + common +
        '（分子' + newN1 + '）、' +
        fractionJapanese(n2, d2) +
        '（分子' + n2 + '、分母' + d2 + '）＝' + newN2 + '/' + common +
        '（分子' + newN2 + '） になります。',
      parameters: {
        n1,
        d1,
        n2,
        d2,
        common,
        newN1,
        newN2,
        difficultyLevel: lv,
      },
    };
  }

  validate(problem: Problem): ValidationResult {
    const errors: string[] = [];
    const { n1, d1, n2, d2, common, newN1, newN2 } = problem.parameters as {
      n1: number;
      d1: number;
      n2: number;
      d2: number;
      common: number;
      newN1: number;
      newN2: number;
    };
    // 問題に使う分数は既約であること (表示と計算の一致を保証する根本原因対策)
    if (gcd(n1, d1) !== 1 || gcd(n2, d2) !== 1) {
      errors.push('問題の分数が約分されていません');
    }
    // アプリ側で LCM を再計算して検証する (AI 等の出力を信用しない)
    const expected = commonDenominatorForm(n1, d1, n2, d2);
    if (expected.commonDenominator !== common) {
      errors.push('通分する分母 (最小公倍数) が誤っています');
    }
    if (
      expected.numerators[0] !== newN1 ||
      expected.numerators[1] !== newN2
    ) {
      errors.push('通分の分子が誤っています');
    }
    if (problem.answer.kind !== 'fractions') {
      errors.push('解答が構造化された分数リストではありません');
    } else {
      const [a1, a2] = problem.answer.values;
      if (
        !a1 ||
        !a2 ||
        a1.numerator !== newN1 ||
        a1.denominator !== common ||
        a2.numerator !== newN2 ||
        a2.denominator !== common
      ) {
        errors.push('問題の解答がパラメータ (標準形) と一致しません');
      }
    }
    return { valid: errors.length === 0, errors };
  }
}

/**
 * 仮分数と帯分数の変換
 */
export class FractionMixedConvertGenerator implements ProblemGenerator {
  readonly type = 'fraction_mixed_convert';
  readonly category = 'fraction' as const;
  readonly description = '仮分数と帯分数の変換';

  generate(config?: GenerationConfig): Problem {
    const rng = createRandom(config?.seed);
    // Use provided difficulty, default to 2 (normal) if not specified
    const lv = config?.difficulty ?? (2 as DifficultyLevel);

    const toMixed = rng.next() < 0.5;
    const denominator = rng.int(2, lv === 1 ? 6 : 9);

    if (toMixed) {
      const whole = rng.int(1, lv === 1 ? 3 : 5);
      const remainder = rng.int(1, denominator - 1);
      const numerator = whole * denominator + remainder;
      const mixed = toMixedNumber(numerator, denominator);
      return {
        id: generateProblemId(),
        category: this.category,
        type: this.type,
        difficulty: createFractionDifficulty(lv, numerator, 2, 1),
        question: numerator + '/' + denominator + ' を帯分数で表しなさい',
        answer: {
          kind: 'mixed',
          whole: mixed.whole,
          numerator: mixed.numerator,
          denominator: mixed.denominator,
        },
        explanation:
          numerator +
          '÷' +
          denominator +
          '＝' +
          whole +
          ' あまり ' +
          remainder +
          ' なので、' +
          mixedJapanese(mixed.whole, mixed.numerator, mixed.denominator) +
          ' になります。',
        parameters: {
          numerator,
          denominator,
          whole: mixed.whole,
          answerNumerator: mixed.numerator,
          answerDenominator: mixed.denominator,
          difficultyLevel: lv,
        },
      };
    }

    const whole = rng.int(1, lv === 1 ? 3 : 5);
    const num = rng.int(1, denominator - 1);
    // 約分が必要な場合に備えて既約分数に整える
    const improperRaw = whole * denominator + num;
    const improperReduced = reduceFraction(improperRaw, denominator);
    const improper = improperReduced.numerator;
    const improperDen = improperReduced.denominator;
    return {
      id: generateProblemId(),
      category: this.category,
      type: this.type,
      difficulty: createFractionDifficulty(lv, whole * denominator, 2, 1),
      question:
        mixedJapanese(whole, num, denominator) + ' を仮分数で表しなさい',
      answer: { kind: 'fraction', numerator: improper, denominator: improperDen },
      explanation:
        whole +
        'と' +
        num +
        '/' +
        denominator +
        ' = ' +
        whole +
        '×' +
        denominator +
        '＋' +
        num +
        ' = ' +
        improperRaw +
        ' なので、' +
        improper +
        '/' +
        improperDen +
        ' です。',
      parameters: {
        whole,
        numerator: num,
        denominator,
        answerNumerator: improper,
        answerDenominator: improperDen,
        difficultyLevel: lv,
      },
    };
  }

  validate(problem: Problem): ValidationResult {
    const errors: string[] = [];
    const params = problem.parameters as {
      numerator?: number;
      denominator?: number;
      whole?: number;
      answerNumerator?: number;
      answerDenominator?: number;
    };
    const { numerator, denominator, answerNumerator, answerDenominator } = params;
    if (
      !Number.isInteger(numerator) || !Number.isInteger(denominator) ||
      !Number.isInteger(answerNumerator) || !Number.isInteger(answerDenominator)
    ) {
      errors.push('変換の数値が整数ではありません');
      return { valid: errors.length === 0, errors };
    }

    // Number.isInteger のガードでは型が狭まらないため、
    // 検証済みの値をローカルに確定させてから使う
    const n = numerator as number;
    const d = denominator as number;
    const an = answerNumerator as number;
    const ad = answerDenominator as number;

    // この型は「仮分数→帯分数」と「帯分数→仮分数」の両方を出すが、
    // answer.kind でどちらの変換か判別できる。どちらの場合も
    // 「変換の前後で分数の値が変わらないこと」を数学的に確認する。
    if (problem.answer.kind === 'mixed') {
      // 仮分数 → 帯分数: 入力は numerator/denominator
      // (帯分数の答えは簡約されるため、答えの分母は入力と一致しなくてよい)
      const expected = toMixedNumber(n, d);
      // 帯分数 whole と an/ad が元の n/d と同じ値かを交差乗算で比べる
      const isSameValue =
        (expected.whole * ad + an) * d === n * ad;
      if (!isSameValue) {
        errors.push(`帯分数への変換が誤っています (${n}/${d})`);
      }
      if (
        problem.answer.whole !== expected.whole ||
        problem.answer.numerator !== an ||
        problem.answer.denominator !== ad
      ) {
        errors.push('問題の解答がパラメータと一致しません');
      }
    } else if (problem.answer.kind === 'fraction') {
      // 帯分数 → 仮分数: 入力は whole と numerator/denominator
      // (仮分数の答えは簡約されるため、分母は一致しなくてよい)
      const whole = params.whole;
      if (typeof whole !== 'number' || !Number.isInteger(whole)) {
        errors.push('整数部が設定されていません');
      } else {
        const improperRaw = whole * d + n;
        if (an * d !== improperRaw * ad || ad <= 0) {
          errors.push(`仮分数への変換が誤っています (${whole}と${n}/${d})`);
        }
      }
      if (
        problem.answer.numerator !== an ||
        problem.answer.denominator !== ad
      ) {
        errors.push('問題の解答がパラメータと一致しません');
      }
    } else {
      errors.push('答えが分数 (fraction / mixed) になっていません');
    }
    return { valid: errors.length === 0, errors };
  }
}

/**
 * 分数の大きさ比較
 * 例: 3/5 と 7/10 はどちらが大きいですか
 */
export class FractionBigSmallGenerator implements ProblemGenerator {
  readonly type = 'fraction_big_small';
  readonly category = 'fraction' as const;
  readonly description = '分数の大きさ比較';

  generate(config?: GenerationConfig): Problem {
    const rng = createRandom(config?.seed);
    // Use provided difficulty, default to 2 (normal) if not specified
    const lv = config?.difficulty ?? (2 as DifficultyLevel);

    for (let attempt = 0; attempt < 100; attempt++) {
      const denominator =
        lv <= 1 ? rng.int(4, 10) : lv === 2 ? rng.int(4, 15) : rng.int(4, 20);
      const numerator1 = rng.int(1, denominator - 1);
      const numerator2 = rng.int(1, denominator - 1);
      if (numerator1 === numerator2) continue;

      // 約分後の値で比較する（約分が必要な場合は約分後の形で表示）
      const frac1 = reduceFraction(numerator1, denominator);
      const frac2 = reduceFraction(numerator2, denominator);

      if (frac1.numerator === frac2.numerator) continue;

      const largerFrac = frac1.numerator > frac2.numerator ? frac1 : frac2;

      return {
        id: generateProblemId(),
        category: this.category,
        type: this.type,
        difficulty: createFractionDifficulty(lv, denominator, 2, 2),
        question:
          fractionJapanese(numerator1, denominator) +
          'と' +
          fractionJapanese(numerator2, denominator) +
          ' のどちらが大きいか比べなさい',
        answer: { kind: 'string', value: fractionJapanese(largerFrac.numerator, largerFrac.denominator) },
        explanation:
          fractionJapanese(largerFrac.numerator, largerFrac.denominator) +
          ' の方が大きいです。' +
          ' (分子' + largerFrac.numerator + '、分母' + largerFrac.denominator + ')' +
          'もう一方は分子' +
          (frac1.numerator > frac2.numerator ? frac2.numerator : frac1.numerator) +
          'です。',
        // 選択式UI: 2つの分数を選択肢として明示する (文字入力を不要にする)
        inputType: 'choice',
        choices: [
          fractionJapanese(frac1.numerator, frac1.denominator),
          fractionJapanese(frac2.numerator, frac2.denominator),
        ],
        parameters: {
          numerator: largerFrac.numerator,
          denominator: largerFrac.denominator,
          // 比較のもう一方 (途中式の表示用。答えには影響しない)
          smallerNumerator:
            frac1.numerator > frac2.numerator ? frac2.numerator : frac1.numerator,
          difficultyLevel: lv,
        },
      };
    }
    throw new Error('分数の大きさ比較の問題を生成できませんでした');
  }

  validate(problem: Problem): ValidationResult {
    const errors: string[] = [];
    const { numerator, denominator } = problem.parameters as {
      numerator: number;
      denominator: number;
    };
    // パラメータから期待される答えを再計算して検証する（約分後の形）
    const r = reduceFraction(numerator, denominator);
    const expected = fractionJapanese(r.numerator, r.denominator);
    if (problem.answer.kind !== 'string' || problem.answer.value !== expected) {
      errors.push('答えが誤っています');
    }
    return { valid: errors.length === 0, errors };
  }
}

/* ------------------------------------------------------------------------- *
 * Phase 2-T: 単位分数の導入 (3年 A(6))
 *
 * 学習指導要領解説 小学校算数編 (一次資料):
 *   第3学年 A(6)「分数の意味と表し方」/ 分数の意味と表し方／単位分数の幾つ分／
 *   簡単な場合の分数の加法，減法
 *   (解説: 「分数が単位分数の幾つ分かで表せることを指導する」)
 *
 * 既存の fraction_* は計算 (乗除・約分・通分・比較) が中心で、
 * 「全体を等しく分けたうちの1つ」という分数の導入を扱っていなかったため新設する。
 * 計算には入らないので、通分・約分・四則には進まない。
 * ------------------------------------------------------------------------- */

export type FractionUnitIntroVariant =
  /** 分母が表す等分の数と、単位分数の関係 */
  | 'meaning'
  /** 分数が単位分数の何個分か */
  | 'how_many_units'
  /** 指定した個数の単位分数の和 */
  | 'count_units'
  /** 分数を分子・分母の形で表す */
  | 'read_fraction';

export class FractionUnitIntroGenerator implements ProblemGenerator {
  readonly type = 'fraction_unit_intro';
  readonly category = 'fraction' as const;
  readonly description = '単位分数の導入';

  generate(config?: GenerationConfig): Problem {
    const rng = createRandom(config?.seed);
    const lv = config?.difficulty ?? (2 as DifficultyLevel);

    // 3年導入なので分母は小さめに保つ (lvを上げても分母は大きくしすぎない)
    const maxDen = lv <= 2 ? 6 : 8;
    const usable: FractionUnitIntroVariant[] =
      lv <= 2
        ? ['meaning', 'how_many_units', 'read_fraction']
        : ['meaning', 'how_many_units', 'count_units', 'read_fraction'];

    for (let attempt = 0; attempt < 60; attempt++) {
      const variant = rng.pick(usable);
      // 分母は2以上、分子は分母以下にする (2/n, 3/n のような導入に絞る)
      const den = rng.int(2, maxDen);
      const num = rng.int(1, den);
      const frac = (a: number, b: number): string => a + '/' + b;
      // lv1 では推論の負荷も1に抑える (既定の2だと要求レベルを外した問題になる)
      const reasoning = (lv <= 1 ? 1 : 2) as DifficultyLevel;

      if (variant === 'meaning') {
        // 例: 全体を8等分したときの1つ分は何分の一ですか
        return {
          id: generateProblemId(),
          category: this.category,
          type: this.type,
          difficulty: createFractionDifficulty(lv, num, reasoning),
          question: 'ある量を' + den + '等分したときの1つ分は、何分の一ですか。',
          answer: { kind: 'string', value: frac(1, den) },
          explanation:
            '全体を' + den + '等分すると、1つ分は全体の 1/' + den + ' です。' +
            '分母の ' + den + ' は「全体を' + den + '等分した」ことを表します。',
          parameters: { variant, num: 1, den, answer: frac(1, den), difficultyLevel: lv },
        };
      }

      if (variant === 'how_many_units') {
        // 例: 3/8 は 1/8 がいくつあるか
        return {
          id: generateProblemId(),
          category: this.category,
          type: this.type,
          difficulty: createFractionDifficulty(lv, num, reasoning),
          question: frac(num, den) + ' は、1/' + den + ' いくつ分ですか。',
          answer: { kind: 'integer', value: num },
          explanation:
            '分母の ' + den + ' が同じなので、分子の ' + num +
            ' は 1/' + den + ' が ' + num + ' 個分あることを表します。',
          parameters: { variant, num, den, answer: num, difficultyLevel: lv },
        };
      }

      if (variant === 'count_units') {
        // 例: 1/6 を4個集めると (k は分母未満に留める。n/n は値が1になり導入の意図と異なる)
        const k = den > 2 ? rng.int(2, den - 1) : 1;
        return {
          id: generateProblemId(),
          category: this.category,
          type: this.type,
          difficulty: createFractionDifficulty(lv, k, reasoning),
          question: '1/' + den + ' を ' + k + ' 個集めると、何分の一になりますか。',
          answer: { kind: 'string', value: frac(k, den) },
          explanation:
            '1/' + den + ' が ' + k + ' 個あるので、分子が ' + k + ' の ' +
            frac(k, den) + ' になります。分母は' + den + 'のままです。',
          parameters: { variant, num: k, den, answer: frac(k, den), difficultyLevel: lv },
        };
      }

      // read_fraction: 分子と分母を分けて理解する
      return {
        id: generateProblemId(),
        category: this.category,
        type: this.type,
        difficulty: createFractionDifficulty(lv, num, reasoning),
        question: frac(num, den) + ' の分母は何ですか。',
        answer: { kind: 'integer', value: den },
        explanation:
          frac(num, den) + ' の分母 ' + den + ' は、下の数が表す ' + den +
          ' です。全体を' + den + '等分していることを表します。',
        parameters: { variant, num, den, answer: den, difficultyLevel: lv },
      };
    }

    throw new Error('単位分数の問題を生成できませんでした');
  }

  validate(problem: Problem): ValidationResult {
    const errors: string[] = [];
    const params = problem.parameters as {
      variant: FractionUnitIntroVariant;
      num: number;
      den: number;
      answer: number | string;
    };
    const { variant, num, den, answer } = params;
    if (!(den >= 2)) errors.push('分母が2以上ではありません');
    if (!(num >= 1 && num <= den)) errors.push('分子の範囲が不正です');

    if (variant === 'meaning') {
      if (answer !== '1/' + den) errors.push('単位分数の表し方が誤っています');
    } else if (variant === 'how_many_units') {
      if (Number(answer) !== num) errors.push('単位分数の個数が誤っています');
    } else if (variant === 'count_units') {
      if (answer !== num + '/' + den) errors.push('集めた分数の表し方が誤っています');
    } else if (Number(answer) !== den) {
      errors.push('分母の読み取りが誤っています');
    }
    return { valid: errors.length === 0, errors };
  }
}

// ===== 異分母の分数の加法・減法 (第5学年) =====

/** 異分母の分数の加減算の variant */
type FractionAddSubVariant = 'add' | 'subtract' | 'add_reduces' | 'add_improper' | 'fill_blank';

/** variant ごとに必要になる最低難易度 */
const FRACTION_ADDSUB_MIN_LEVEL: Record<FractionAddSubVariant, DifficultyLevel> = {
  add: 1,
  subtract: 1,
  add_reduces: 2,
  add_improper: 3,
  fill_blank: 4,
};

/** variant ごとの思考の負荷 (要求難易度を超えない) */
const FRACTION_ADDSUB_REASONING: Record<FractionAddSubVariant, DifficultyLevel> = {
  add: 2,
  subtract: 2,
  add_reduces: 3,
  add_improper: 2,
  fill_blank: 3,
};

/** 2つの分数の最小公倍数 */
function lcmOf(a: number, b: number): number {
  return (a * b) / gcd(a, b);
}

/**
 * 異分母の分数の加法・減法
 *
 * 第5学年「異分母分数の加法及び減法」に対応する。
 * 通分してから分子を足し引きし、最後に約分する手順を問題と解説で示す。
 * 入力は真分数に限り、答えは既約分数で返す (仮分数も可)。
 */
export class FractionAddSubGenerator implements ProblemGenerator {
  readonly type = 'fraction_add_sub';
  readonly category = 'fraction' as const;
  readonly description = '異分母の分数の加法・減法';

  generate(config?: GenerationConfig): Problem {
    const rng = createRandom(config?.seed);
    const lv = config?.difficulty ?? (2 as DifficultyLevel);
    const usable = (Object.keys(FRACTION_ADDSUB_MIN_LEVEL) as FractionAddSubVariant[])
      .filter((v) => FRACTION_ADDSUB_MIN_LEVEL[v] <= lv);

    for (let attempt = 0; attempt < 120; attempt++) {
      const variant = rng.pick(usable);
      const built = buildFractionAddSub(variant, rng, lv);
      if (built) return built;
    }
    throw new Error('異分母の分数の加法・減法の問題を生成できませんでした');
  }

  validate(problem: Problem): ValidationResult {
    const errors: string[] = [];
    const params = problem.parameters as {
      variant: FractionAddSubVariant;
      operation: 'add' | 'subtract';
      n1: number;
      d1: number;
      n2: number;
      d2: number;
      numerator: number;
      denominator: number;
      commonDenominator: number;
      difficultyLevel: DifficultyLevel;
    };
    const { operation, n1, d1, n2, d2, numerator, denominator } = params;

    if (!(d1 >= 2) || !(d2 >= 2)) errors.push('分母が2以上ではありません');
    if (!(n1 >= 1 && n1 < d1)) errors.push('1つめが真分数ではありません: ' + n1 + '/' + d1);
    if (!(n2 >= 1 && n2 < d2)) errors.push('2つめが真分数ではありません: ' + n2 + '/' + d2);

    // 独立に再計算する
    const l = lcmOf(d1, d2);
    if (l !== params.commonDenominator) {
      errors.push('通分後の分母が不正です: ' + String(params.commonDenominator) + ' (期待値 ' + l + ')');
    }
    const a = (n1 * l) / d1;
    const b = (n2 * l) / d2;
    const raw = operation === 'add' ? a + b : a - b;
    if (raw <= 0) errors.push('計算結果が正ではありません: ' + String(raw));
    const reduced = reduceFraction(raw, l);
    if (reduced.numerator !== numerator || reduced.denominator !== denominator) {
      errors.push('答えが一致しません: ' + numerator + '/' + denominator
        + ' (期待値 ' + reduced.numerator + '/' + reduced.denominator + ')');
    }
    if (!isValidFraction(numerator, denominator)) {
      errors.push('答えが約分されていません: ' + numerator + '/' + denominator);
    }
    if (problem.answer.kind !== 'fraction'
      || problem.answer.numerator !== numerator
      || problem.answer.denominator !== denominator) {
      errors.push('problem.answer が parameters と一致しません');
    }
    return { valid: errors.length === 0, errors };
  }
}

/** 乱数ジェネレータの構造的部分型 (SeededRandom を直接公開せずに使う) */
type Rng = { int: (min: number, max: number) => number; pick: <T>(array: readonly T[]) => T };

/**
 * 異分母の分数の加減算の1問を組み立てる。
 * 条件を満たさない場合は null を返して再試行させる。
 */
function buildFractionAddSub(
  variant: FractionAddSubVariant,
  rng: Rng,
  lv: DifficultyLevel,
): Problem | null {
  // 分子は小さく保つ。分母は 2〜6 程度まで。
  const maxDen = lv <= 1 ? 4 : lv === 2 ? 6 : lv === 3 ? 8 : 10;
  for (let inner = 0; inner < 30; inner++) {
    const d1 = rng.int(2, maxDen);
    const d2 = rng.int(2, maxDen);
    if (d1 === d2) continue;
    const n1 = rng.int(1, d1 - 1);
    const n2 = rng.int(1, d2 - 1);

    const l = lcmOf(d1, d2);
    if (l > 36) continue; // 分母が大きすぎると教材として扱わない
    const a = (n1 * l) / d1;
    const b = (n2 * l) / d2;

    let operation: 'add' | 'subtract';
    if (variant === 'fill_blank') operation = 'add';
    else if (variant === 'subtract' || variant === 'add_reduces') operation = 'subtract';
    else operation = 'add';

    // 減法は結果が正になる組合せだけ
    if (operation === 'subtract' && a <= b) continue;

    const raw = operation === 'add' ? a + b : a - b;
    if (raw <= 0) continue;
    const reduced = reduceFraction(raw, l);
    if (!isValidFraction(reduced.numerator, reduced.denominator)) continue;

    // variant ごとの答えの形を保証する
    const isProper = reduced.numerator < reduced.denominator;
    const reducedForm = gcd(raw, l) > 1;
    if (variant === 'add' && (!isProper || reducedForm)) continue;
    if (variant === 'add_reduces' && (!reducedForm || !isProper)) continue;
    if (variant === 'add_improper' && isProper) continue;
    if (variant === 'subtract' && (!isProper || reducedForm)) continue;
    if (variant === 'fill_blank' && reducedForm) continue;

    // 数値の複雑度が要求難易度を超えないこと (分母が大きくなりすぎるudia)
    if (numberSizeToComplexity(Math.max(reduced.numerator, reduced.denominator)) > lv) continue;

    const f1 = n1 + '/' + d1;
    const f2 = n2 + '/' + d2;
    const sign = operation === 'add' ? '＋' : '−';
    const question = variant === 'fill_blank'
      ? '□ ＋ ' + f2 + ' = ' + f1 + ' のとき、□ に入る分数はいくつですか。'
      : f1 + ' ' + sign + ' ' + f2 + ' を計算し、約分した答えを書きなさい。';

    const step1 = n1 + '/' + d1 + ' と ' + n2 + '/' + d2
      + ' の最小公倍数は ' + l + ' です。分母を ' + l + ' にそろえます。';
    const step2 = (n1 * (l / d1)) + '/' + l + ' ' + sign + ' ' + (n2 * (l / d2)) + '/' + l
      + ' = ' + raw + '/' + l;
    const step3 = reducedForm
      ? '分子と分母を ' + gcd(raw, l) + ' で割ると、'
        + reduced.numerator + '/' + reduced.denominator + ' になります。'
      : 'これ以上約分できないので、答えは ' + reduced.numerator + '/' + reduced.denominator + ' です。';

    return {
      id: generateProblemId(),
      category: 'fraction' as const,
      type: 'fraction_add_sub',
      difficulty: createFractionDifficulty(
        lv,
        Math.max(reduced.numerator, reduced.denominator),
        Math.min(lv, FRACTION_ADDSUB_REASONING[variant]) as DifficultyLevel,
      ),
      question,
      answer: { kind: 'fraction', numerator: reduced.numerator, denominator: reduced.denominator },
      explanation: step1 + ' ' + step2 + ' ' + step3,
      parameters: {
        variant,
        operation,
        n1,
        d1,
        n2,
        d2,
        numerator: reduced.numerator,
        denominator: reduced.denominator,
        commonDenominator: l,
        difficultyLevel: lv,
      },
    };
  }
  return null;
}
