/**
 * 文字と式の問題ジェネレータ
 * 小学6年生の学習範囲:
 * - 数量を文字 (□, xなど) で表す
 * - 式に数を代入する
 * - 文章を式にする
 * - 式の意味を読み取る
 * - 複数条件を含む問題
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

function createExpressionDifficulty(
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
 * 数量を文字で表す
 * 例: 1本x円の鉛筆を5本買うと代金は?
 */
export class ExpressionMakeGenerator implements ProblemGenerator {
  readonly type = 'expression_make';
  readonly category = 'expression' as const;
  readonly description = '数量を文字で表す';

  generate(config?: GenerationConfig): Problem {
    const rng = createRandom(config?.seed);
    // Use provided difficulty, default to 2 (normal) if not specified
    const lv = config?.difficulty ?? (2 as DifficultyLevel);

    // 難易度に応じて本数を変化させる
    const count = lv <= 1 ? rng.int(2, 5) : lv === 2 ? rng.int(2, 8) : lv === 3 ? rng.int(3, 12) : lv === 4 ? rng.int(5, 20) : rng.int(8, 30);

    return {
      id: generateProblemId(),
      category: this.category,
      type: this.type,
      difficulty: createExpressionDifficulty(lv, count, 2, 1),
      question:
        '1本x円のえんぴつを' + count + '本買ったときの代金を、xを使った式で表しなさい',
      answer: { kind: 'string', value: count + 'x' },
      explanation:
        '1本x円×' + count + '本＝' + count + 'x円 です。',
      parameters: { count, x: 'x', answer: count + 'x', difficultyLevel: lv },
    };
  }

  validate(problem: Problem): ValidationResult {
    const errors: string[] = [];
    const { count, answer } = problem.parameters as { count: number; answer: string };
    if (answer !== count + 'x') errors.push('式が誤っています');
    return { valid: errors.length === 0, errors };
  }
}

/**
 * 式に数を代入する
 * 例: x=3のとき、2x+1は?
 */
export class ExpressionSubstitutionGenerator implements ProblemGenerator {
  readonly type = 'expression_substitution';
  readonly category = 'expression' as const;
  readonly description = '式に数を代入する';

  generate(config?: GenerationConfig): Problem {
    const rng = createRandom(config?.seed);
    // Use provided difficulty, default to 2 (normal) if not specified
    const lv = config?.difficulty ?? (2 as DifficultyLevel);

    // 難易度に応じて係数・定数・代入値を変化させる
    const a = lv <= 1 ? rng.int(1, 3) : lv === 2 ? rng.int(1, 5) : lv === 3 ? rng.int(2, 8) : lv === 4 ? rng.int(3, 12) : rng.int(5, 20);
    const b = lv <= 1 ? rng.int(1, 5) : lv === 2 ? rng.int(1, 10) : lv === 3 ? rng.int(2, 15) : lv === 4 ? rng.int(3, 25) : rng.int(5, 50);
    const x = lv <= 1 ? rng.int(1, 5) : lv === 2 ? rng.int(1, 10) : lv === 3 ? rng.int(2, 15) : lv === 4 ? rng.int(3, 20) : rng.int(5, 30);
    const answer = a * x + b;

    return {
      id: generateProblemId(),
      category: this.category,
      type: this.type,
      difficulty: createExpressionDifficulty(lv, answer, 1, 1),
      question:
        'x=' + x + ' のとき、' + a + 'x+' + b + ' の値を求めなさい',
      answer: { kind: 'integer', value: answer },
      explanation:
        a + '×' + x + '＋' + b + '＝' + a * x + '＋' + b + '＝' + answer + 'です。',
      parameters: { a, b, x, answer, difficultyLevel: lv },
    };
  }

  validate(problem: Problem): ValidationResult {
    const errors: string[] = [];
    const { a, b, x, answer } = problem.parameters as { a: number; b: number; x: number; answer: number };
    if (answer !== a * x + b) errors.push('代入計算が誤っています');
    if (problem.answer.kind !== 'integer' || problem.answer.value !== answer) {
      errors.push('問題の解答がパラメータと一致しません');
    }
    return { valid: errors.length === 0, errors };
  }
}

/**
 * 文章を式にする
 */
export class ExpressionWordToExpressionGenerator implements ProblemGenerator {
  readonly type = 'expression_word_make';
  readonly category = 'expression' as const;
  readonly description = '文章を式にする';

  generate(config?: GenerationConfig): Problem {
    const rng = createRandom(config?.seed);
    // Use provided difficulty, default to 2 (normal) if not specified
    const lv = config?.difficulty ?? (2 as DifficultyLevel);

    // 難易度に応じて単価を変化させる
    const price = lv <= 1 ? rng.int(2, 5) : lv === 2 ? rng.int(2, 9) : lv === 3 ? rng.int(3, 15) : lv === 4 ? rng.int(5, 25) : rng.int(8, 50);

    return {
      id: generateProblemId(),
      category: this.category,
      type: this.type,
      difficulty: createExpressionDifficulty(lv, price, 2, 2),
      question:
        '1こ' + price + '円のチョコレートをxこ買います。代金をxの式で表しなさい',
      answer: { kind: 'string', value: price + '×x' },
      explanation:
        '1こ' + price + '円がxこなので、' + price + '×x です。',
      parameters: { price, answer: price + '×x', difficultyLevel: lv },
    };
  }

  validate(problem: Problem): ValidationResult {
    const errors: string[] = [];
    const { price, answer } = problem.parameters as { price: number; answer: string };
    if (answer !== price + '×x') errors.push('式が誤っています');
    return { valid: errors.length === 0, errors };
  }
}

/**
 * 式の意味を読み取る
 * example: x+5 cm は何を表すか
 */
export class ExpressionMeaningGenerator implements ProblemGenerator {
  readonly type = 'expression_meaning';
  readonly category = 'expression' as const;
  readonly description = '式の意味を読み取る';

  generate(config?: GenerationConfig): Problem {
    const rng = createRandom(config?.seed);
    // Use provided difficulty, default to 2 (normal) if not specified
    const lv = config?.difficulty ?? (2 as DifficultyLevel);

    // 難易度に応じて定数項を変化させる
    const b = lv <= 1 ? rng.int(2, 5) : lv === 2 ? rng.int(2, 9) : lv === 3 ? rng.int(3, 15) : lv === 4 ? rng.int(5, 25) : rng.int(8, 50);
    const answerText = 'x' + b + '円は、x円の物を1こと' + b + '円の品物を買ったときの代金です';

    return {
      id: generateProblemId(),
      category: this.category,
      type: this.type,
      difficulty: createExpressionDifficulty(lv, b, 2, 2),
      question:
        'x' + b + '円という式があります。どのような意味があるか文章で説明してください',
      answer: { kind: 'string', value: answerText },
      explanation: answerText,
      parameters: { b, answer: answerText, difficultyLevel: lv },
    };
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

/**
 * □を使った穴埋め問題
 */
export class ExpressionBlankGenerator implements ProblemGenerator {
  readonly type = 'expression_blank';
  readonly category = 'expression' as const;
  readonly description = '□を使った問題';

  generate(config?: GenerationConfig): Problem {
    const rng = createRandom(config?.seed);
    // Use provided difficulty, default to 2 (normal) if not specified
    const lv = config?.difficulty ?? (2 as DifficultyLevel);

    // 難易度に応じて数値範囲を変化させる
    const a = lv <= 1 ? rng.int(2, 5) : lv === 2 ? rng.int(2, 9) : lv === 3 ? rng.int(3, 15) : lv === 4 ? rng.int(5, 25) : rng.int(8, 50);
    const b = lv <= 1 ? rng.int(2, 5) : lv === 2 ? rng.int(2, 8) : lv === 3 ? rng.int(3, 12) : lv === 4 ? rng.int(5, 20) : rng.int(8, 30);
    const result = a * b;

    return {
      id: generateProblemId(),
      category: this.category,
      type: this.type,
      difficulty: createExpressionDifficulty(lv, result, 1, 1),
      question:
        '□×' + b + '＝' + result + ' のとき、□に書く数はいくつですか',
      answer: { kind: 'integer', value: a },
      explanation:
        a + '×' + b + '＝' + result + ' なので、□は' + a + 'です。',
      parameters: { a, b, result, answer: a, difficultyLevel: lv },
    };
  }

  validate(problem: Problem): ValidationResult {
    const errors: string[] = [];
    const { answer, a } = problem.parameters as { answer: number; a: number };
    if (answer !== a) errors.push('□の値が誤っています');
    return { valid: errors.length === 0, errors };
  }
}

/**
 * 複数条件を含む文字式
 */
export class ExpressionComplexGenerator implements ProblemGenerator {
  readonly type = 'expression_multi_condition';
  readonly category = 'expression' as const;
  readonly description = '複数条件を含む文字式';

  generate(config?: GenerationConfig): Problem {
    const rng = createRandom(config?.seed);
    // Use provided difficulty, default to 2 (normal) if not specified
    const lv = config?.difficulty ?? (2 as DifficultyLevel);

    // 難易度に応じて係数・定数・時間を変化させる
    const a = lv <= 1 ? rng.int(2, 3) : lv === 2 ? rng.int(2, 5) : lv === 3 ? rng.int(3, 8) : lv === 4 ? rng.int(4, 12) : rng.int(6, 20);
    const b = lv <= 1 ? rng.int(1, 3) : lv === 2 ? rng.int(1, 6) : lv === 3 ? rng.int(2, 10) : lv === 4 ? rng.int(3, 15) : rng.int(5, 30);
    const x = lv <= 1 ? rng.int(1, 3) : lv === 2 ? rng.int(1, 5) : lv === 3 ? rng.int(2, 8) : lv === 4 ? rng.int(3, 12) : rng.int(5, 20);
    const answer = a * x + b;

    return {
      id: generateProblemId(),
      category: this.category,
      type: this.type,
      difficulty: createExpressionDifficulty(lv, answer, 3, 2),
      question:
        'はじめに' + b + '個ありました。1分間に' + a + 'こずつ' + x + '分間ふえると、最終的にいくつになりますか。' +
        'また式 (あれば x+ b の形) で表しなさい',
      answer: { kind: 'integer', value: answer },
      explanation:
        b + '＋' + a + '×' + x + '＝' + b + '＋' + a * x + '＝' + answer + 'です。',
      parameters: { a, b, x, answer, difficultyLevel: lv },
    };
  }

  validate(problem: Problem): ValidationResult {
    const errors: string[] = [];
    const { a, b, x, answer } = problem.parameters as { a: number; b: number; x: number; answer: number };
    if (answer !== a * x + b) errors.push('式の計算が誤っています');
    return { valid: errors.length === 0, errors };
  }
}