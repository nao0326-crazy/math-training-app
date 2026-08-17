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

/** 小数を文字列に変換する */
function fmt(n: number): string {
  return String(n);
}

/**
 * 小数×小数
 * 例: 0.3 × 0.4 = ?
 */
export class DecimalMulDecimalGenerator implements ProblemGenerator {
  readonly type = 'decimal_mul_decimal';
  readonly category = 'decimal' as const;
  readonly description = '小数×小数';

  generate(config?: GenerationConfig): Problem {
    const rng = createRandom(config?.seed);
    // Use provided difficulty, default to 2 (normal) if not specified
    const lv = config?.difficulty ?? (2 as DifficultyLevel);

    const a = lv === 1 ? rng.int(1, 9) / 10 : lv === 2 ? rng.int(1, 99) / 100 : rng.int(1, 99) / 10;
    const b = lv === 1 ? rng.int(1, 9) / 10 : lv === 2 ? rng.int(1, 99) / 100 : rng.int(1, 99) / 10;
    const answer = a * b;
    const roundedAnswer = Math.round(answer * 1000) / 1000;

    return {
      id: generateProblemId(),
      category: this.category,
      type: this.type,
      difficulty: createDecimalDifficulty(lv, Math.max(a, b), 1, 1),
      question: fmt(a) + 'に' + fmt(b) + 'をかけるといくつになりますか',
      answer: { kind: 'decimal', value: roundedAnswer },
      explanation: fmt(a) + '×' + fmt(b) + '＝' + roundedAnswer + 'です。',
      parameters: { a, b, answer: roundedAnswer, difficultyLevel: lv },
    };
  }

  validate(problem: Problem): ValidationResult {
    const errors: string[] = [];
    const { a, b, answer } = problem.parameters as { a: number; b: number; answer: number };
    if (Math.abs(a * b - answer) > 0.001) errors.push('小数×小数の答えが誤っています');
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

    const b10 = lv === 1 ? rng.int(1, 5) : rng.int(1, 9);
    const divisor = b10 / 10;
    const quotient = rng.int(1, lv === 1 ? 5 : 9);
    const dividend = divisor * quotient;

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
 */
export class DecimalMulIntegerGenerator implements ProblemGenerator {
  readonly type = 'decimal_mul_integer';
  readonly category = 'decimal' as const;
  readonly description = '小数×整数';

  generate(config?: GenerationConfig): Problem {
    const rng = createRandom(config?.seed);
    // Use provided difficulty, default to 2 (normal) if not specified
    const lv = config?.difficulty ?? (2 as DifficultyLevel);

    const a = lv === 1 ? rng.int(1, 9) / 10 : rng.int(1, 99) / 100;
    const b = rng.int(2, lv === 1 ? 5 : 9);
    const answer = a * b;
    const rounded = Math.round(answer * 1000) / 1000;

    return {
      id: generateProblemId(),
      category: this.category,
      type: this.type,
      difficulty: createDecimalDifficulty(lv, a, 1, 1),
      question: fmt(a) + '×' + b + ' はいくつになりますか',
      answer: { kind: 'decimal', value: rounded },
      explanation: fmt(a) + '×' + b + '＝' + rounded + 'です。',
      parameters: { a, b, answer: rounded, difficultyLevel: lv },
    };
  }

  validate(problem: Problem): ValidationResult {
    const errors: string[] = [];
    const { a, b, answer } = problem.parameters as { a: number; b: number; answer: number };
    if (Math.abs(a * b - answer) > 0.001) errors.push('小数×整数の計算結果が誤っています');
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

    const divisor = rng.int(2, lv === 1 ? 5 : 9);
    const quotient = rng.int(1, 9);
    const dividend = (divisor * quotient) / 10;

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
 * 小数の四捨五入
 * 例: 3.47 を小数第1位まで四捨五入
 */
export class DecimalRoundGenerator implements ProblemGenerator {
  readonly type = 'decimal_round';
  readonly category = 'decimal' as const;
  readonly description = '四捨五入';

  generate(config?: GenerationConfig): Problem {
    const rng = createRandom(config?.seed);
    // Use provided difficulty, default to 2 (normal) if not specified
    const lv = config?.difficulty ?? (2 as DifficultyLevel);

    const value = rng.int(100, 999) / 100;
    const roundTo = lv === 1 ? 1 : 1;
    const scale = Math.pow(10, roundTo);
    const rounded = Math.round(value * scale) / scale;

    return {
      id: generateProblemId(),
      category: this.category,
      type: this.type,
      difficulty: createDecimalDifficulty(lv, value, 1, 1),
      question: fmt(value) + 'を、小数第' + roundTo + '位まで四捨五入しなさい',
      answer: { kind: 'decimal', value: rounded },
      explanation: fmt(value) + 'は小数第' + roundTo + '位まで四捨五入すると' + fmt(rounded) + 'です。',
      parameters: { value, roundTo, rounded, answer: rounded, difficultyLevel: lv },
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
    return { valid: errors.length === 0, errors };
  }
}