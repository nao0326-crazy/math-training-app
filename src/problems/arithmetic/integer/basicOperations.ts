/**
 * 整数の四則演算問題ジェネレータ
 * 足し算・引き算・掛け算・割り算
 */

import type {
  DifficultyLevel,
  GenerationConfig,
  Problem,
  ProblemGenerator,
  ValidationResult,
} from '../../../types/problem';
import { createRandom, generateProblemId } from '../../../utils/random';
import { validateProblem } from '../../../engine/validator/validator';
import {
  getAdditionRange,
  getMultiplicationRange,
  generateDivision,
  createIntegerDifficulty,
  expressionToJapanese,
} from './helpers';

/**
 * 足し算ジェネレータ
 */
export class AdditionGenerator implements ProblemGenerator {
  readonly type = 'integer_addition';
  readonly category = 'integer' as const;
  readonly description = '整数の足し算';

  generate(config?: GenerationConfig): Problem {
    const rng = createRandom(config?.seed);
    // Use provided difficulty, default to 2 (normal) if not specified
    const level = config?.difficulty ?? (2 as DifficultyLevel);
    const range = getAdditionRange(level);
    const a = rng.int(range.min, range.max);
    const b = rng.int(range.min, range.max);
    const answer = a + b;

    return {
      id: generateProblemId(),
      category: this.category,
      type: this.type,
      difficulty: createIntegerDifficulty(level, a, b),
      question: expressionToJapanese(a, '+', b),
      answer: { kind: 'integer', value: answer },
      explanation: `${a}＋${b}＝${answer} です。`,
      parameters: {
        a,
        b,
        operator: '+',
        answer,
        difficultyLevel: level,
      },
    };
  }

  validate(problem: Problem): ValidationResult {
    return validateProblem(problem);
  }
}

/**
 * 引き算ジェネレータ
 * 答えが負にならないように a >= b を保証する
 */
export class SubtractionGenerator implements ProblemGenerator {
  readonly type = 'integer_subtraction';
  readonly category = 'integer' as const;
  readonly description = '整数の引き算';

  generate(config?: GenerationConfig): Problem {
    const rng = createRandom(config?.seed);
    // Use provided difficulty, default to 2 (normal) if not specified
    const level = config?.difficulty ?? (2 as DifficultyLevel);
    const range = getAdditionRange(level);
    const a = rng.int(range.min, range.max);
    const b = rng.int(range.min, a); // b <= a を保証
    const answer = a - b;

    return {
      id: generateProblemId(),
      category: this.category,
      type: this.type,
      difficulty: createIntegerDifficulty(level, a, b),
      question: expressionToJapanese(a, '-', b),
      answer: { kind: 'integer', value: answer },
      explanation: `${a}−${b}＝${answer} です。`,
      parameters: {
        a,
        b,
        operator: '-',
        answer,
        difficultyLevel: level,
      },
    };
  }

  validate(problem: Problem): ValidationResult {
    return validateProblem(problem);
  }
}

/**
 * 掛け算ジェネレータ
 */
export class MultiplicationGenerator implements ProblemGenerator {
  readonly type = 'integer_multiplication';
  readonly category = 'integer' as const;
  readonly description = '整数の掛け算';

  generate(config?: GenerationConfig): Problem {
    const rng = createRandom(config?.seed);
    // Use provided difficulty, default to 2 (normal) if not specified
    const level = config?.difficulty ?? (2 as DifficultyLevel);
    const range = getMultiplicationRange(level);
    const a = rng.int(range.min, range.max);
    const b = rng.int(range.min, range.max);
    const answer = a * b;

    return {
      id: generateProblemId(),
      category: this.category,
      type: this.type,
      difficulty: createIntegerDifficulty(level, a, b),
      question: expressionToJapanese(a, '×', b),
      answer: { kind: 'integer', value: answer },
      explanation: `${a}×${b}＝${answer} です。`,
      parameters: {
        a,
        b,
        operator: '×',
        answer,
        difficultyLevel: level,
      },
    };
  }

  validate(problem: Problem): ValidationResult {
    return validateProblem(problem);
  }
}

/**
 * 割り算ジェネレータ
 * 割り切れる問題のみ生成する
 */
export class DivisionGenerator implements ProblemGenerator {
  readonly type = 'integer_division';
  readonly category = 'integer' as const;
  readonly description = '整数の割り算 (割り切れる)';

  generate(config?: GenerationConfig): Problem {
    const rng = createRandom(config?.seed);
    // Use provided difficulty, default to 1 (easy) if not specified
    // 商が1になるケースも含む簡単な割り算を生成する
    const level = config?.difficulty ?? (1 as DifficultyLevel);

    // レベル1では九九の範囲 (被除数・除数・商がすべて1桁) に抑え、
    // 数値の大きさの難易度もレベル1相当を維持する
    let dividend: number;
    let divisor: number;
    let quotient: number;
    if (level === 1) {
      divisor = rng.int(2, 9);
      quotient = rng.int(1, Math.floor(9 / divisor));
      dividend = divisor * quotient;
    } else {
      ({ dividend, divisor, quotient } = generateDivision(rng, level));
    }

    return {
      id: generateProblemId(),
      category: this.category,
      type: this.type,
      difficulty: createIntegerDifficulty(level, dividend, divisor),
      question: expressionToJapanese(dividend, '÷', divisor),
      answer: { kind: 'integer', value: quotient },
      explanation: `${dividend}÷${divisor}＝${quotient} です。${divisor}×${quotient}＝${dividend} なので確かめられます。`,
      parameters: {
        dividend,
        divisor,
        quotient,
        operator: '÷',
        answer: quotient,
        difficultyLevel: level,
      },
    };
  }

  validate(problem: Problem): ValidationResult {
    return validateProblem(problem);
  }
}