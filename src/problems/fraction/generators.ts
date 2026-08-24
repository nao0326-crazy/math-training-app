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
  lcm,
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
    const numerator = rng.int(1, denominator - 1);
    const integer =
      lv <= 1 ? rng.int(2, 6) : lv === 2 ? rng.int(2, 9) : lv === 3 ? rng.int(2, 12) : lv === 4 ? rng.int(3, 15) : rng.int(4, 20);

    const result = divideFractions(numerator, denominator, integer, 1);
    const answer = improperToAnswer(result.numerator, result.denominator);

    return {
      id: generateProblemId(),
      category: this.category,
      type: this.type,
      difficulty: createFractionDifficulty(lv, numerator, 1, 1),
      question:
        fractionJapanese(numerator, denominator) +
        '（分母' + denominator + '）を' +
        integer +
        'でわると、いくつになりますか',
      answer,
      explanation:
        fractionJapanese(numerator, denominator) +
        '（分子' + numerator + '、分母' + denominator + '）÷' +
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
      numerator = rng.int(1, Math.floor(denominator / divisor)) * divisor;
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
        fractionJapanese(numerator, denominator) +
        '（分子' + numerator + '、分母' + denominator + '）を約分しなさい',
      answer: ans,
      explanation:
        fractionJapanese(numerator, denominator) +
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
 */
export class FractionCommonDenominatorGenerator implements ProblemGenerator {
  readonly type = 'fraction_common_denominator';
  readonly category = 'fraction' as const;
  readonly description = '通分';

  generate(config?: GenerationConfig): Problem {
    const rng = createRandom(config?.seed);
    // Use provided difficulty, default to 2 (normal) if not specified
    const lv = config?.difficulty ?? (2 as DifficultyLevel);

    const d1 = lv === 1 ? rng.int(2, 5) : rng.int(2, 8);
    let d2 = rng.int(2, lv === 1 ? 5 : 8);
    while (d2 === d1) {
      d2 = rng.int(2, lv === 1 ? 5 : 8);
    }
    const n1 = rng.int(1, d1 - 1);
    const n2 = rng.int(1, d2 - 1);

    const common = lcm(d1, d2);
    const f1 = common / d1;
    const f2 = common / d2;
    const newN1 = n1 * f1;
    const newN2 = n2 * f2;

    return {
      id: generateProblemId(),
      category: this.category,
      type: this.type,
      difficulty: createFractionDifficulty(lv, common, 2, 2),
      question:
        fractionJapanese(n1, d1) +
        'と' +
        fractionJapanese(n2, d2) +
        'を、分母をそろえて表しなさい',
      answer: { kind: 'string', value: newN1 + '/' + common + ' と ' + newN2 + '/' + common },
      explanation:
        '最小公倍数は' +
        common +
        'なので、' +
        fractionJapanese(n1, d1) +
        '（分子' + n1 + '、分母' + d1 + '）＝' +
        fractionJapanese(newN1, common) +
        '（分子' + newN1 + '）、' +
        fractionJapanese(n2, d2) +
        '（分子' + n2 + '、分母' + d2 + '）＝' +
        fractionJapanese(newN2, common) +
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
    const expectedCommon = lcm(d1, d2);
    if (common !== expectedCommon) {
      errors.push('通分する分母が誤っています');
    }
    if (
      newN1 !== n1 * (expectedCommon / d1) ||
      newN2 !== n2 * (expectedCommon / d2)
    ) {
      errors.push('通分の分子が誤っています');
    }
    const answerText = newN1 + '/' + common + ' と ' + newN2 + '/' + common;
    if (problem.answer.kind !== 'string' || problem.answer.value !== answerText) {
      errors.push('問題の解答がパラメータと一致しません');
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
    const { denominator, answerDenominator } = problem.parameters as {
      denominator: number;
      answerDenominator: number;
    };
    if (answerDenominator !== denominator) {
      errors.push('分母が一致しません');
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

      // Ensure we can compare them
      const frac1 = reduceFraction(numerator1, denominator);
      const frac2 = reduceFraction(numerator2, denominator);

      if (frac1.numerator === frac2.numerator) continue;

      const largerNumerator = frac1.numerator > frac2.numerator ? numerator1 : numerator2;
      const largerDenominator = frac1.numerator > frac2.numerator ? denominator : denominator;

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
        answer: { kind: 'string', value: fractionJapanese(largerNumerator, largerDenominator) },
        explanation:
          fractionJapanese(largerNumerator, largerDenominator) +
          ' の方が大きいです。' +
          ' (分子' + largerNumerator + '、分母' + largerDenominator + ')',
        parameters: {
          numerator: largerNumerator,
          denominator: largerDenominator,
          difficultyLevel: lv,
        },
      };
    }
    throw new Error('分数の大きさ比較の問題を生成できませんでした');
  }

  validate(problem: Problem): ValidationResult {
    const errors: string[] = [];
    const { answer } = problem.parameters as { answer: string };
    if (problem.answer.kind !== 'string' || problem.answer.value !== answer) {
      errors.push('答えが誤っています');
    }
    return { valid: errors.length === 0, errors };
  }
}
