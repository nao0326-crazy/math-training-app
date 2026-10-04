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

      // ここで決めた g は「両方を割り切れる数」であり、最大公約数とは限らない。
      // (例: g=2 から a=4, b=8 が引かれると、g でわった 2:4 は約分されていない)
      // よって答えは必ず実際の最大公約数でわる。
      const realGcd = gcd(a, b);
      const simplifiedA = a / realGcd;
      const simplifiedB = b / realGcd;

      return {
        id: generateProblemId(),
        category: this.category,
        type: this.type,
        difficulty: createRatioDifficulty(lv, a, 1, 1),
        question: a + '：' + b + 'を、できるだけ簡単な比になおしなさい',
        answer: { kind: 'string', value: simplifiedA + '：' + simplifiedB },
        // 比専用UI (左 : 右を分離した入力)
        inputType: 'ratio',
        explanation:
          a + 'と' + b + 'を最大公約数' + realGcd + 'でわると、' + simplifiedA + '：' + simplifiedB + 'です。',
        parameters: {
          a,
          b,
          gcd: realGcd,
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
    // 生成側の gcd パラメータは「両方を割り切れる数」であって
    // 必ず最大公約数とは限らない (例: a=4, b=8 なら g=2 を選びうる)。
    // 検証は question / parameters から独立に最大公約数を求めて行う。
    const g = gcd(a, b);
    const expected = (a / g) + '：' + (b / g);
    if (answer !== expected) {
      errors.push(`比の簡単化が誤っています (期待値 ${expected}, 実際 ${answer})`);
    }
    if (problem.answer.kind !== 'string' || problem.answer.value !== answer) {
      errors.push('問題の解答がパラメータと一致しません');
    }
    return { valid: errors.length === 0, errors };
  }
}

/**
 * 小数の答えを小数第2位に丸める (Phase 1-C)。
 * 0.1 + 0.2 のような浮動小数点の誤差 (0.30000000000000004) を画面に出すのを防ぐ。
 */
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * 割り切れる (有限小数になる) かを判定する。
 * 約分したときの分母が 2 と 5 の因数だけなら有限小数になる。
 */
function isTerminating(a: number, b: number): boolean {
  let x = a;
  let y = b;
  while (x % 2 === 0) x /= 2;
  while (x % 5 === 0) x /= 5;
  let d = y;
  while (d % 2 === 0) d /= 2;
  while (d % 5 === 0) d /= 5;
  return d === 1;
}

/**
 * 比の値
 * 例: 3：4 の比の値 = 0.75
 *
 * 答えの品質 (Phase 1-C): a / b が割り切れないと 0.6666666666666666 のような
 * 無限小数になり、小学生は書き表せない。
 * 割り切れる (分母が 2 と 5 の因数だけ) 組合せだけを採用する。
 * 小6の教科書では比の値を割り切れる小数 (0.75 など) で扱ったあと、
 * 小数第3位までの丸めに入るため、この型を採る。
 * 小6では割り切れる比を扱った方が学習目標が明確なのでこちらを採る。
 */
export class RatioValueGenerator implements ProblemGenerator {
  readonly type = 'ratio_value';
  readonly category = 'ratio' as const;
  readonly description = '比の値を求める';

  generate(config?: GenerationConfig): Problem {
    const rng = createRandom(config?.seed);
    // Use provided difficulty, default to 2 (normal) if not specified
    const lv = config?.difficulty ?? (2 as DifficultyLevel);

    for (let attempt = 0; attempt < 200; attempt++) {
      // 難易度に応じて比の項の範囲を変化させる
      const maxTerm = lv <= 1 ? 8 : lv === 2 ? 12 : lv === 3 ? 20 : lv === 4 ? 30 : 50;
      const a = rng.int(2, maxTerm);
      const b = rng.int(2, maxTerm);
      if (a === b) continue;
      // 割り切れる比だけを採用する (無限小数を出さないため)
      if (!isTerminating(a, b)) continue;

      // 丸めは 2 桁まで (割り切れることが保証されているので精度損失はない)
      const value = round2(a / b);

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
    if (Math.abs(round2(a / b) - answer) > 1e-9) errors.push('比の値が誤っています');
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
      // 文字式専用UI (x・×・÷・= など)
      inputType: 'expression',
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
      // 文字式専用UI (x・×・÷・= など)
      inputType: 'expression',
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

    // 割り切れる組み合わせを反復的に探す。
    // 条件 (total が people1 でも people2 でも割り切れる) の成立確率は
    // lv5 では約17% (44/255) にすぎず、100回では生成失敗しうるため
    // 試行回数を増やす。difficulty の数値条件自体は変更しない。
    for (let attempt = 0; attempt < 3000; attempt++) {
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

// ===== 百分率 (パーセント) =====

/** 百分率の variant */
type PercentageVariant = 'find_percent' | 'percent_of' | 'what_percent';

/** variant ごとの最低難易度 */
const PERCENTAGE_MIN_LEVEL: Record<PercentageVariant, DifficultyLevel> = {
  find_percent: 1,
  percent_of: 2,
  what_percent: 3,
};

/** variant ごとの思考の負荷 */
const PERCENTAGE_REASONING: Record<PercentageVariant, DifficultyLevel> = {
  find_percent: 2,
  percent_of: 2,
  what_percent: 3,
};

/** 小数第1位までに丸める (百分率の答えに小数が出るため) */
function roundPercent(v: number): number {
  return Math.round(v * 10) / 10;
}

/**
 * 百分率（パーセント）
 *
 * 第5学年「割合，百分率」に対応する。
 * 「いくつがいくつパーセントか」「〜の何パーセントか」「〜の何パーセントが何分か」を問う。
 * 割合を 100 分の率として表す考え方をそのまま計算する。
 */
export class PercentageGenerator implements ProblemGenerator {
  readonly type = 'percentage';
  readonly category = 'ratio' as const;
  readonly description = '百分率';

  generate(config?: GenerationConfig): Problem {
    const rng = createRandom(config?.seed);
    const lv = config?.difficulty ?? (2 as DifficultyLevel);
    const usable = (Object.keys(PERCENTAGE_MIN_LEVEL) as PercentageVariant[])
      .filter((v) => PERCENTAGE_MIN_LEVEL[v] <= lv);

    for (let attempt = 0; attempt < 120; attempt++) {
      const variant = rng.pick(usable);
      const built = buildPercentage(variant, rng, lv);
      if (built) return built;
    }
    throw new Error('百分率の問題を生成できませんでした');
  }

  validate(problem: Problem): ValidationResult {
    const errors: string[] = [];
    const params = problem.parameters as {
      variant: PercentageVariant;
      percent: number;
      whole: number;
      part: number;
      answer: number;
      difficultyLevel: DifficultyLevel;
    };
    const { variant, percent, whole, part, answer } = params;

    if (!(percent > 0 && percent <= 100)) errors.push('百分率が不正です: ' + String(percent));
    if (!(whole > 0)) errors.push('全体量が正ではありません: ' + String(whole));
    if (!(part > 0 && part <= whole)) errors.push('部分量が範囲外です: ' + String(part));
    if (!Number.isFinite(answer)) errors.push('答えが有限ではありません');
    if (answer < 0) errors.push('答えが負です: ' + String(answer));

    // 独立に再計算する: 部分量 = 全体量 × 百分率 / 100
    const expectPart = (whole * percent) / 100;
    if (Math.abs(expectPart - part) > 1e-9) {
      errors.push('数値が互相に一致しません: 期待値は ' + expectPart);
    }
    if (variant === 'find_percent' && Math.abs(answer - percent) > 1e-9) {
      errors.push('答えが百分率と一致しません: ' + String(answer));
    }
    if (variant === 'what_percent' && Math.abs(answer - percent) > 1e-9) {
      errors.push('答えが百分率と一致しません: ' + String(answer));
    }
    if (variant === 'percent_of' && Math.abs(answer - expectPart) > 1e-9) {
      errors.push('答えが一致しません: 期待値は ' + expectPart);
    }
    if (problem.answer.kind !== 'integer' && problem.answer.kind !== 'decimal') {
      errors.push('解答型が不正です: ' + problem.answer.kind);
    } else if (Number(problem.answer.value) !== answer) {
      errors.push('problem.answer が parameters と一致しません');
    }
    return { valid: errors.length === 0, errors };
  }
}

/** 乱数ジェネレータの構造的部分型 (SeededRandom を直接公開せずに使う) */
type Rng = { int: (min: number, max: number) => number; pick: <T>(array: readonly T[]) => T };

/** 百分率の問題文の言い回しまとめ ($W=全体量 $P=部分量 $R=百分率) */
const PERCENT_FIND_PHRASES: readonly string[] = [
  '全体を $W と見たとき、$P は何パーセントですか。',
  '全体 $W のうち $P は、何パーセントですか。',
  '$W に注目して、$P が占める割合をパーセントで表すと何パーセントですか。',
];
const PERCENT_OF_PHRASES: readonly string[] = [
  'ある量が $W です。その $R パーセントは何ですか。',
  '全体の量が $W あります。$R パーセントに相当する量を求めなさい。',
  '$W を100として考えたとき、$R パーセントはいくつですか。',
];
const PERCENT_WHAT_PHRASES: readonly string[] = [
  'ある量が $W で、そのうち $P が占めています。何パーセントですか。',
  '全体 $W に対して $P です。$P が占める割合をパーセントで表してください。',
  '$P ものは、全体 $W に対して何パーセントですか。',
];

/** 百分率の1問を組み立てる (条件を満たさない場合は null) */
function buildPercentage(
  variant: PercentageVariant,
  rng: Rng,
  lv: DifficultyLevel,
): Problem | null {
  // 百分率は整数_percent×整数_whole の/%100 で整数になる組合せを選ぶ
  for (let inner = 0; inner < 40; inner++) {
    const percentList = [10, 20, 25, 30, 40, 50, 60, 70, 75, 80, 90];
    const percent = rng.pick(percentList);
    const maxWhole = lv <= 1 ? 40 : lv === 2 ? 100 : lv === 3 ? 200 : 400;
    const whole = rng.int(2, maxWhole);
    const exact = (whole * percent) / 100;
    if (!Number.isInteger(exact) || exact <= 0) continue;
    const part = exact;

    // 大きさの複雑度が難易度を超えないこと
    if (numberSizeToComplexity(whole) > lv) continue;
    if (numberSizeToComplexity(part) > lv) continue;

    let question: string;
    let answer: number;
    let answerKind: 'integer' | 'decimal';
    if (variant === 'find_percent') {
      question = rng.pick(PERCENT_FIND_PHRASES).replace('$W', String(whole)).replace('$P', String(part));
      answer = percent;
      answerKind = 'integer';
    } else if (variant === 'percent_of') {
      question = rng.pick(PERCENT_OF_PHRASES).replace('$W', String(whole)).replace('$R', String(percent));
      answer = part;
      answerKind = 'integer';
    } else {
      question = rng.pick(PERCENT_WHAT_PHRASES).replace('$W', String(whole)).replace('$P', String(part));
      answer = percent;
      answerKind = 'integer';
    }

    const explanation =
      '割合は「全体を100としたときの割合の値」です。'
      + 'この問題の答えは、' + part + ' ÷ ' + whole + ' × 100 = ' + roundPercent(percent)
      + ' パーセントと求められます。';

    return {
      id: generateProblemId(),
      category: 'ratio' as const,
      type: 'percentage',
      difficulty: createRatioDifficulty(
        lv,
        Math.max(whole, part),
        Math.min(lv, PERCENTAGE_REASONING[variant]) as DifficultyLevel,
      ),
      question,
      answer: { kind: answerKind, value: answer },
      explanation,
      parameters: { variant, percent, whole, part, answer, difficultyLevel: lv },
    };
  }
  return null;
}