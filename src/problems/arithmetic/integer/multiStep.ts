/**
 * 整数の複数項計算・穴埋め問題ジェネレータ
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
import { createMultiStepDifficulty } from './helpers';

/**
 * 複数項の計算問題ジェネレータ
 * 例: 12 + 5 × 3 = ?
 * 計算の順序 (乗除優先) を考慮する
 */
export class MultiStepGenerator implements ProblemGenerator {
  readonly type = 'integer_multi_step';
  readonly category = 'integer' as const;
  readonly description = '整数の複数項の計算';

  generate(config?: GenerationConfig): Problem {
    const rng = createRandom(config?.seed);
    const level = (config?.difficulty ?? rng.int(2, 4)) as DifficultyLevel;

    // 割り切れない・負になる場合は再試行
    for (let attempt = 0; attempt < 100; attempt++) {
      const problem = this.tryGenerate(rng, level);
      if (problem) {
        return problem;
      }
    }
    throw new Error('複数項の計算問題を生成できませんでした');
  }

  /**
   * 問題生成を試みる。条件を満たさない場合は null を返す
   */
  private tryGenerate(
    rng: ReturnType<typeof createRandom>,
    level: DifficultyLevel,
  ): Problem | null {
    // 項の数 (3〜4)
    const termCount = level >= 4 ? rng.int(3, 4) : 3;

    // 数値の範囲
    const maxNum = level <= 2 ? 9 : level === 3 ? 20 : 50;

    // 演算子を生成 (乗除は優先される)
    const operators: string[] = [];
    for (let i = 0; i < termCount - 1; i++) {
      const pool = level <= 2 ? ['+', '-'] : ['+', '-', '×', '÷'];
      operators.push(rng.pick(pool));
    }

    // 数値を生成
    const numbers: number[] = [];
    for (let i = 0; i < termCount; i++) {
      numbers.push(rng.int(1, maxNum));
    }

    // 割り算が割り切れるように数値を調整する
    if (!ensureDivisibility(numbers, operators)) {
      return null;
    }

    // 計算を実行 (乗除優先)
    let result: number;
    try {
      result = evaluateExpression(numbers, operators);
    } catch {
      // 割り切れない場合は再試行
      return null;
    }

    // 答えが負にならないようにする
    if (result < 0) {
      return null;
    }

    // 式を組み立てる
    const expression = buildExpression(numbers, operators);

    return {
      id: generateProblemId(),
      category: this.category,
      type: this.type,
      difficulty: createMultiStepDifficulty(termCount - 1, maxNum, 1, 1, level),
      question: `${expression} はいくつになりますか`,
      answer: { kind: 'integer', value: result },
      explanation: `${expression}＝${result} です。かけ算・わり算を先に計算します。`,
      parameters: {
        numbers,
        operators,
        expression,
        answer: result,
        difficultyLevel: level,
        termCount,
      },
    };
  }

  validate(problem: Problem): ValidationResult {
    return validateProblem(problem);
  }
}

/**
 * 穴埋め問題ジェネレータ
 * 例: 12 + □ = 20 の □ を求める
 */
export class FillBlankGenerator implements ProblemGenerator {
  readonly type = 'integer_fill_blank';
  readonly category = 'integer' as const;
  readonly description = '整数の穴埋め問題';

  generate(config?: GenerationConfig): Problem {
    const rng = createRandom(config?.seed);
    const level = (config?.difficulty ?? rng.int(1, 3)) as DifficultyLevel;

    const maxNum = level <= 1 ? 9 : level === 2 ? 20 : 50;
    const op = rng.pick(['+', '-', '×', '÷'] as const);

    let a: number;
    let answer: number;
    let question: string;
    let explanation: string;

    switch (op) {
      case '+': {
        // a + □ = c の形
        a = rng.int(1, maxNum);
        answer = rng.int(1, maxNum);
        const c = a + answer;
        question = `${a}＋□＝${c} の □ にあてはまる数はいくつですか`;
        explanation = `${c}−${a}＝${answer} です。`;
        break;
      }
      case '-': {
        // a - □ = c の形
        a = rng.int(2, maxNum);
        answer = rng.int(1, a - 1);
        const c = a - answer;
        question = `${a}−□＝${c} の □ にあてはまる数はいくつですか`;
        explanation = `${a}−${c}＝${answer} です。`;
        break;
      }
      case '×': {
        // a × □ = c の形
        a = rng.int(2, maxNum);
        answer = rng.int(2, maxNum);
        const c = a * answer;
        question = `${a}×□＝${c} の □ にあてはまる数はいくつですか`;
        explanation = `${c}÷${a}＝${answer} です。`;
        break;
      }
      case '÷': {
        // a ÷ □ = c の形 (割り切れる)
        answer = rng.int(2, maxNum);
        const c = rng.int(2, maxNum);
        a = answer * c;
        question = `${a}÷□＝${c} の □ にあてはまる数はいくつですか`;
        explanation = `${a}÷${c}＝${answer} です。`;
        break;
      }
    }

    return {
      id: generateProblemId(),
      category: this.category,
      type: this.type,
      difficulty: createMultiStepDifficulty(1, maxNum, 2, 1, level),
      question,
      answer: { kind: 'integer', value: answer },
      explanation,
      parameters: {
        a,
        operator: op,
        answer,
        difficultyLevel: level,
        blankPosition: 'second',
      },
    };
  }

  validate(problem: Problem): ValidationResult {
    return validateProblem(problem);
  }
}

/**
 * 式を評価する (乗除優先)
 */
function evaluateExpression(numbers: number[], operators: string[]): number {
  // 乗除を先に計算
  const nums = [...numbers];
  const ops = [...operators];

  for (let i = 0; i < ops.length; i++) {
    if (ops[i] === '×' || ops[i] === '÷') {
      const left = nums[i];
      const right = nums[i + 1];
      const result = ops[i] === '×' ? left * right : left / right;
      if (!Number.isInteger(result)) {
        // 割り切れない場合は再生成
        throw new Error('Non-integer result');
      }
      nums.splice(i, 2, result);
      ops.splice(i, 1);
      i--;
    }
  }

  // 加減を計算
  let result = nums[0];
  for (let i = 0; i < ops.length; i++) {
    if (ops[i] === '+') {
      result += nums[i + 1];
    } else {
      result -= nums[i + 1];
    }
  }
  return result;
}

/**
 * 式を組み立てる
 */
function buildExpression(numbers: number[], operators: string[]): string {
  let expr = String(numbers[0]);
  for (let i = 0; i < operators.length; i++) {
    expr += ` ${operators[i]} ${numbers[i + 1]}`;
  }
  return expr;
}

/**
 * 割り算が割り切れるように数値を調整する
 * a ÷ b の形式のとき、a を b の倍数にする
 */
function ensureDivisibility(numbers: number[], operators: string[]): boolean {
  for (let i = 0; i < operators.length; i++) {
    if (operators[i] === '÷') {
      const divisor = numbers[i + 1];
      const dividend = numbers[i];
      if (dividend % divisor !== 0) {
        // 被除数を除数の倍数に調整する (最小でも除数倍)
        numbers[i] = divisor * Math.max(1, Math.floor(dividend / divisor));
      }
    }
  }
  // 除数が0でないことを確認
  return numbers.every((n) => n > 0);
}
