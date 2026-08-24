/**
 * 比・比例・反比例の問題ジェネレータ
 * 小学6年生の学習範囲
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
import { gcd } from '../../utils/numberTheory';

/**
 * 比問題の難易度を作成する
 */
function createRatioDifficulty(
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
 * 比の簡単化
 * 例: 6:8 を簡単にする
 */
export class RatioSimplifyGenerator implements ProblemGenerator {
  readonly type = 'ratio_simplify';
  readonly category = 'ratio' as const;
  readonly description = '比の簡単化';

  generate(config?: GenerationConfig): Problem {
    const rng = createRandom(config?.seed);
    // Use provided difficulty, default to 2 (normal) if not specified
    const lv = config?.difficulty ?? (2 as DifficultyLevel);

    for (let attempt = 0; attempt < 100; attempt++) {
      // 難易度に応じて公約数と係数の範囲を変化させる
      const g = lv <= 1 ? rng.int(2, 4) : lv === 2 ? rng.int(2, 6) : lv === 3 ? rng.int(3, 8) : lv === 4 ? rng.int(4, 10) : rng.int(5, 15);
      const maxFactor = lv <= 1 ? 4 : lv === 2 ? 5 : lv === 3 ? 7 : lv === 4 ? 10 : 15;
      const a = g * rng.int(1, maxFactor);
      const b = g * rng.int(1, maxFactor);
      if (a === b) continue;

      const simplifiedA = a / g;
      const simplifiedB = b / g;

      return {
        id: generateProblemId(),
        category: this.category,
        type: this.type,
        difficulty: createRatioDifficulty(lv, a, 1, 1),
        question: a + '：' + b + 'を、できるだけ簡単な比になおしなさい',
        answer: { kind: 'string', value: simplifiedA + '：' + simplifiedB },
        explanation:
          a + 'と' + b + 'を最大公約数' + g + 'でわると、' + simplifiedA + '：' + simplifiedB + 'です。',
        parameters: {
          a,
          b,
          gcd: g,
          answer: simplifiedA + '：' + simplifiedB,
          difficultyLevel: lv,
        },
      };
    }
    throw new Error('比の簡単化の問題を生成できませんでした');
  }

  validate(problem: Problem): ValidationResult {
    const errors: string[] = [];
    const { a, b, answer } = problem.parameters as { a: number; b: number; answer: string };
    const g = gcd(a, b);
    const expected = (a / g) + '：' + (b / g);
    if (answer !== expected) errors.push('比の簡単化が誤っています');
    return { valid: errors.length === 0, errors };
  }
}

/**
 * 比の値
 * 例: 3：4 の比の値 = 0.75
 */
export class RatioValueGenerator implements ProblemGenerator {
  readonly type = 'ratio_value';
  readonly category = 'ratio' as const;
  readonly description = '比の値を求める';

  generate(config?: GenerationConfig): Problem {
    const rng = createRandom(config?.seed);
    // Use provided difficulty, default to 2 (normal) if not specified
    const lv = config?.difficulty ?? (2 as DifficultyLevel);

    for (let attempt = 0; attempt < 100; attempt++) {
      // 難易度に応じて比の項の範囲を変化させる
      const maxTerm = lv <= 1 ? 8 : lv === 2 ? 12 : lv === 3 ? 20 : lv === 4 ? 30 : 50;
      const a = rng.int(2, maxTerm);
      const b = rng.int(2, maxTerm);
      if (a === b) continue;

      const value = a / b;

      return {
        id: generateProblemId(),
        category: this.category,
        type: this.type,
        difficulty: createRatioDifficulty(lv, a, 1, 1),
        question: a + '：' + b + ' の比の値を求めなさい',
        answer: { kind: 'decimal', value },
        explanation: '比の値は「前の数÷後の数」なので、' + a + '÷' + b + '＝' + value + 'です。',
        parameters: { a, b, answer: value, difficultyLevel: lv },
      };
    }
    throw new Error('比の値の問題を生成できませんでした');
  }

  validate(problem: Problem): ValidationResult {
    const errors: string[] = [];
    const { a, b, answer } = problem.parameters as { a: number; b: number; answer: number };
    if (b === 0) errors.push('比の後項が0です');
    if (Math.abs(a / b - answer) > 1e-9) errors.push('比の値が誤っています');
    return { valid: errors.length === 0, errors };
  }
}

/**
 * 等しい比を求める問題
 */
export class RatioEqualQuestionGenerator implements ProblemGenerator {
  readonly type = 'ratio_equal';
  readonly category = 'ratio' as const;
  readonly description = '等しい比';

  generate(config?: GenerationConfig): Problem {
    const rng = createRandom(config?.seed);
    // Use provided difficulty, default to 2 (normal) if not specified
    const lv = config?.difficulty ?? (2 as DifficultyLevel);

    for (let attempt = 0; attempt < 100; attempt++) {
      // 難易度に応じて比の項と倍率を変化させる
      const maxTerm = lv <= 1 ? 4 : lv === 2 ? 5 : lv === 3 ? 7 : lv === 4 ? 10 : 15;
      const a = rng.int(1, maxTerm);
      const b = rng.int(1, maxTerm);
      if (a === b) continue;

      const g = lv <= 1 ? rng.int(2, 3) : lv === 2 ? rng.int(2, 4) : lv === 3 ? rng.int(3, 6) : lv === 4 ? rng.int(4, 8) : rng.int(5, 12);
      const x = a * g;
      const y = b * g;

      return {
        id: generateProblemId(),
        category: this.category,
        type: this.type,
        difficulty: createRatioDifficulty(lv, x, 1, 1),
        question:
          a + '：' + b + ' は、' + x + '：' + y + ' と同じ比ですか？（はい/いいえ）',
        answer: { kind: 'string', value: 'はい' },
        explanation:
          '両方の項を' + g + '倍しても比は変わりません。' + a + '：' + b + ' ＝ ' + x + '：' + y + ' です。',
        parameters: { a, b, x, y, factor: g, difficultyLevel: lv },
      };
    }
    throw new Error('等しい比の問題を生成できませんでした');
  }

  validate(problem: Problem): ValidationResult {
    const errors: string[] = [];
    const { a, b, x, y } = problem.parameters as { a: number; b: number; x: number; y: number };
    if (a / b !== x / y) errors.push('等しくない比を等しいと出題しています');
    return { valid: errors.length === 0, errors };
  }
}

/**
 * 比を使って量を求める
 * 例: 全体を a:b に分ける
 */
export class RatioQuantityGenerator implements ProblemGenerator {
  readonly type = 'ratio_quantity';
  readonly category = 'ratio' as const;
  readonly description = '比を使って分ける';

  generate(config?: GenerationConfig): Problem {
    const rng = createRandom(config?.seed);
    // Use provided difficulty, default to 2 (normal) if not specified
    const lv = config?.difficulty ?? (2 as DifficultyLevel);

    for (let attempt = 0; attempt < 100; attempt++) {
      // 難易度に応じて比の項と1単位の大きさを変化させる
      const maxTerm = lv <= 1 ? 3 : lv === 2 ? 4 : lv === 3 ? 5 : lv === 4 ? 7 : 10;
      const a = rng.int(1, maxTerm);
      const b = rng.int(1, maxTerm);
      if (a === b) continue;
      const unit = lv <= 1 ? rng.int(2, 4) : lv === 2 ? rng.int(2, 8) : lv === 3 ? rng.int(3, 12) : lv === 4 ? rng.int(4, 20) : rng.int(5, 30);
      const partA = a * unit;
      const partB = b * unit;
      const total = partA + partB;

      const askLarger = rng.next() < 0.5;
      const askPart = askLarger ? Math.max(a, b) : Math.min(a, b);
      const askValue = askLarger ? Math.max(partA, partB) : Math.min(partA, partB);

      return {
        id: generateProblemId(),
        category: this.category,
        type: this.type,
        difficulty: createRatioDifficulty(lv, total, 2, 2),
        question:
          '全体が' + total + 'のとき、' + a + '：' + b + 'に分けると' +
          (askLarger ? '大きいほう' : '小さいほう') + 'はいくつになりますか',
        answer: { kind: 'integer', value: askValue },
        explanation:
          '1つ分は' + total + '÷' + (a + b) + '＝' + unit + '。' +
          (askLarger ? '大きいほう' : '小さいほう') + 'は' + askPart + 'つ分で、' +
          unit + '×' + askPart + '＝' + askValue + 'です。',
        parameters: {
          a,
          b,
          unit,
          total,
          askPart,
          answer: askValue,
          difficultyLevel: lv,
        },
      };
    }
    throw new Error('比を使って分ける問題を生成できませんでした');
  }

  validate(problem: Problem): ValidationResult {
    const errors: string[] = [];
    const { a, b, unit, total, askPart, answer } = problem.parameters as {
      a: number;
      b: number;
      unit: number;
      total: number;
      askPart: number;
      answer: number;
    };
    if ((a + b) * unit !== total) errors.push('全体量が誤っています');
    if (askPart * unit !== answer) errors.push('配分量が誤っています');
    return { valid: errors.length === 0, errors };
  }
}

/**
 * 比例の式を求める
 * 例: y=3x
 */
export class ProportionalExpressionGenerator implements ProblemGenerator {
  readonly type = 'proportional_expression';
  readonly category = 'ratio' as const;
  readonly description = '比例の式';

  generate(config?: GenerationConfig): Problem {
    const rng = createRandom(config?.seed);
    // Use provided difficulty, default to 2 (normal) if not specified
    const lv = config?.difficulty ?? (2 as DifficultyLevel);

    // 難易度に応じて比例定数を変化させる
    const k = lv <= 1 ? rng.int(2, 5) : lv === 2 ? rng.int(2, 10) : lv === 3 ? rng.int(3, 15) : lv === 4 ? rng.int(5, 25) : rng.int(8, 50);

    return {
      id: generateProblemId(),
      category: this.category,
      type: this.type,
      difficulty: createRatioDifficulty(lv, k, 2, 2),
      question:
        '1個' + k + '円のりんごをx個買うときの代金y円です。yをxの式で表しなさい',
      answer: { kind: 'string', value: 'y=' + k + 'x' },
      explanation: 'yはxに比例し、比例定数は' + k + 'なので、y=' + k + 'xです。',
      parameters: { k, answer: 'y=' + k + 'x', constant: k, difficultyLevel: lv },
    };
  }

  validate(problem: Problem): ValidationResult {
    const errors: string[] = [];
    const { k, answer } = problem.parameters as { k: number; answer: string };
    if (answer !== 'y=' + k + 'x') errors.push('比例の式が誤っています');
    if (problem.answer.kind !== 'string' || problem.answer.value !== answer) {
      errors.push('問題の解答がパラメータと一致しません');
    }
    return { valid: errors.length === 0, errors };
  }
}

/**
 * 比例の文章題
 * 例: 3個で150円なら、8個ではいくら?
 */
export class ProportionalWordGenerator implements ProblemGenerator {
  readonly type = 'proportional_word';
  readonly category = 'ratio' as const;
  readonly description = '比例の文章題';

  generate(config?: GenerationConfig): Problem {
    const rng = createRandom(config?.seed);
    // Use provided difficulty, default to 2 (normal) if not specified
    const lv = config?.difficulty ?? (2 as DifficultyLevel);

    // 難易度に応じて比例定数と個数を変化させる
    const k = lv <= 1 ? rng.int(2, 5) : lv === 2 ? rng.int(2, 8) : lv === 3 ? rng.int(3, 12) : lv === 4 ? rng.int(5, 20) : rng.int(8, 30);
    const x1 = lv <= 1 ? rng.int(2, 4) : lv === 2 ? rng.int(2, 5) : lv === 3 ? rng.int(3, 6) : lv === 4 ? rng.int(4, 8) : rng.int(5, 10);
    const x2 = lv <= 1 ? rng.int(x1 + 1, 10) : lv === 2 ? rng.int(x1 + 1, 12) : lv === 3 ? rng.int(x1 + 1, 15) : lv === 4 ? rng.int(x1 + 1, 20) : rng.int(x1 + 1, 30);
    const y1 = k * x1;
    const y2 = k * x2;

    return {
      id: generateProblemId(),
      category: this.category,
      type: this.type,
      difficulty: createRatioDifficulty(lv, y2, 2, 2),
      question:
        x1 + '個買うと' + y1 + '円の品物があります。同じ品物を' + x2 + '個買うと何円ですか',
      answer: { kind: 'integer', value: y2 },
      explanation:
        '1個は' + y1 + '÷' + x1 + '＝' + k + '円。' + x2 + '個で' + k + '×' + x2 + '＝' + y2 + '円です。',
      parameters: { k, x1, x2, y1, y2, answer: y2, difficultyLevel: lv },
    };
  }

  validate(problem: Problem): ValidationResult {
    const errors: string[] = [];
    const { k, x1, x2, y1, y2, answer } = problem.parameters as {
      k: number;
      x1: number;
      x2: number;
      y1: number;
      y2: number;
      answer: number;
    };
    if (y1 !== k * x1) errors.push('y1の計算が誤っています');
    if (y2 !== k * x2) errors.push('y2の計算が誤っています');
    if (answer !== y2) errors.push('解答が誤っています');
    return { valid: errors.length === 0, errors };
  }
}

/**
 * 反比例の式を求める
 * 例: y=12÷x
 */
export class InverseExpressionGenerator implements ProblemGenerator {
  readonly type = 'inverse_expression';
  readonly category = 'ratio' as const;
  readonly description = '反比例の式';

  generate(config?: GenerationConfig): Problem {
    const rng = createRandom(config?.seed);
    // Use provided difficulty, default to 2 (normal) if not specified
    const lv = config?.difficulty ?? (2 as DifficultyLevel);

    // 難易度に応じて反比例定数を変化させる
    const k = lv <= 1 ? rng.int(6, 10) : lv === 2 ? rng.int(6, 12) : lv === 3 ? rng.int(8, 20) : lv === 4 ? rng.int(12, 30) : rng.int(20, 50);

    return {
      id: generateProblemId(),
      category: this.category,
      type: this.type,
      difficulty: createRatioDifficulty(lv, k, 2, 2),
      question:
        '面積が' + k + '㎠の長方形があります。縦の長さをxcm、横の長さをycmとすると、yをxで表しなさい',
      answer: { kind: 'string', value: 'y=' + k + '÷x' },
      explanation: '縦×横＝面積 なので、x×y＝' + k + '。よって y=' + k + '÷x です。',
      parameters: { k, answer: 'y=' + k + '÷x', difficultyLevel: lv },
    };
  }

  validate(problem: Problem): ValidationResult {
    const errors: string[] = [];
    const { k, answer } = problem.parameters as { k: number; answer: string };
    if (answer !== 'y=' + k + '÷x') errors.push('反比例の式が誤っています');
    if (problem.answer.kind !== 'string' || problem.answer.value !== answer) {
      errors.push('答えの解答が一致しません');
    }
    return { valid: errors.length === 0, errors };
  }
}

/**
 * 反比例の文章題
 * 例: 12こを2人でわると6こ、6人なら2こ
 */
export class InverseWordGenerator implements ProblemGenerator {
  readonly type = 'inverse_word';
  readonly category = 'ratio' as const;
  readonly description = '反比例の文章題';

  generate(config?: GenerationConfig): Problem {
    const rng = createRandom(config?.seed);
    // Use provided difficulty, default to 2 (normal) if not specified
    const lv = config?.difficulty ?? (2 as DifficultyLevel);

    // 割り切れる組み合わせを反復的に探す
    for (let attempt = 0; attempt < 100; attempt++) {
      // 難易度に応じて全体量と人数を変化させる
      const total = lv <= 1 ? rng.int(12, 20) : lv === 2 ? rng.int(12, 20) : lv === 3 ? rng.int(20, 36) : lv === 4 ? rng.int(30, 60) : rng.int(50, 100);
      const people1 = lv <= 1 ? rng.int(2, 3) : lv === 2 ? rng.int(2, 4) : lv === 3 ? rng.int(2, 5) : lv === 4 ? rng.int(3, 6) : rng.int(4, 8);
      const people2 = lv <= 1 ? rng.int(people1 + 2, 6) : lv === 2 ? rng.int(people1 + 2, 9) : lv === 3 ? rng.int(people1 + 2, 12) : lv === 4 ? rng.int(people1 + 2, 15) : rng.int(people1 + 2, 20);
      const per1 = total / people1;
      const per2 = total / people2;
      if (!Number.isInteger(per1) || !Number.isInteger(per2)) continue;

      return {
        id: generateProblemId(),
        category: this.category,
        type: this.type,
        difficulty: createRatioDifficulty(lv, total, 3, 2),
        question:
          total + 'こを' + people1 + '人で分けると1人' + per1 + 'こになります。同じ数を' + people2 + '人で分けると、1人何こになりますか',
        answer: { kind: 'integer', value: per2 },
        explanation:
          '人数が増えると1人分は減る。' + total + '÷' + people2 + '＝' + per2 + 'こです。(反比例)',
        parameters: {
          total,
          people1,
          people2,
          per1,
          per2,
          answer: per2,
          difficultyLevel: lv,
        },
      };
    }
    throw new Error('反比例の文章題を生成できませんでした');
  }

  validate(problem: Problem): ValidationResult {
    const errors: string[] = [];
    const { total, people1, people2, per1, per2 } = problem.parameters as {
      total: number;
      people1: number;
      people2: number;
      per1: number;
      per2: number;
    };
    if (per1 !== total / people1) errors.push('反比例の式1が誤っています');
    if (per2 !== total / people2) errors.push('反比例の式2が誤っています');
    if (!Number.isInteger(per2)) errors.push('整数でない反比例の問題です');
    return { valid: errors.length === 0, errors };
  }
}