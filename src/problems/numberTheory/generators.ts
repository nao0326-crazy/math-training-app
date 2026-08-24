/**
 * 数の性質 (約数・倍数・素数・公約数・公倍数・GCD/LCM) の問題ジェネレータ
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
  getDivisors,
  isPrime,
  getPrimesInRange,
  getCommonDivisors,
  getCommonMultiples,
  gcd,
  lcm,
  getMultiples,
} from '../../utils/numberTheory';
import {
  createDifficulty,
  numberSizeToComplexity,
  calculationStepsToComplexity,
} from '../../engine/difficulty/difficulty';

/**
 * 数の性質の問題の難易度を作成する
 */
function createNumberTheoryDifficulty(
  level: DifficultyLevel,
  value: number,
  reasoningLevel: DifficultyLevel = level >= 2 ? 2 : 1,
  readingLevel: DifficultyLevel = level >= 3 ? 2 : 1,
) {
  return createDifficulty({
    calculationComplexity: calculationStepsToComplexity(level),
    numberComplexity: numberSizeToComplexity(value),
    reasoningComplexity: reasoningLevel,
    readingComplexity: readingLevel,
  });
}

/**
 * 範囲内の約数を書き出す問題
 * 例: 12の約数をすべて答えなさい
 */
export class DivisorsFindingGenerator implements ProblemGenerator {
  readonly type = 'divisors_finding';
  readonly category = 'numberTheory' as const;
  readonly description = '約数をすべて求める';

  generate(config?: GenerationConfig): Problem {
    const rng = createRandom(config?.seed);
    const level = (config?.difficulty ?? rng.int(1, 3)) as DifficultyLevel;

    const candidates = this.getCandidates(level).filter((n) => {
      const divisors = getDivisors(n);
      if (level === 1) return divisors.length >= 4 && divisors.length <= 6;
      if (level === 2) return divisors.length >= 6 && divisors.length <= 8;
      return divisors.length >= 8;
    });
    const n = rng.pick(candidates.length > 0 ? candidates : this.getCandidates(level));

    const divisors = getDivisors(n);
    const answerText = divisors.join(', ');

    return {
      id: generateProblemId(),
      category: this.category,
      type: this.type,
      difficulty: createNumberTheoryDifficulty(level, n, 2, 1),
      question: `${n}の約数をすべて答えなさい。(小さい順にカンマ区切りで)`,
      answer: { kind: 'string', value: answerText },
      explanation: `${n}の約数は、${answerText} です。全部で${divisors.length}こあります。`,
      parameters: {
        n,
        answer: answerText,
        difficultyLevel: level,
        divisorCount: divisors.length,
      },
    };
  }

  private getCandidates(level: DifficultyLevel): number[] {
    switch (level) {
      case 1:
        return [6, 8, 10, 12, 14, 15, 16, 18, 20, 21, 22, 24, 27, 28, 30];
      case 2:
        return [24, 30, 36, 40, 42, 48, 54, 56, 60, 66, 70, 72, 78, 80, 84];
      case 3:
        return [60, 72, 84, 90, 96, 108, 120, 132, 144, 168, 180, 192, 216, 240, 360];
      case 4:
        return [120, 144, 168, 180, 192, 216, 240, 252, 288, 300, 324, 336, 360, 384, 420];
      default:
        return [240, 288, 300, 324, 336, 360, 384, 420, 432, 480, 504, 540, 576, 600, 720];
    }
  }

  validate(problem: Problem): ValidationResult {
    const errors: string[] = [];
    const { n, answer } = problem.parameters as { n: number; answer: string };
    if (!Number.isInteger(n) || n <= 0) {
      errors.push('約数の対象が正の整数ではありません');
    }
    const divisors = getDivisors(n);
    if (answer !== divisors.join(', ')) {
      errors.push('解答が約数の一覧と一致しません');
    }
    if (problem.answer.kind !== 'string' || problem.answer.value !== answer) {
      errors.push('問題の解答とパラメータが一致しません');
    }
    return { valid: errors.length === 0, errors };
  }
}

/**
 * 約数の個数を求める問題
 * 例: 12の約数は何個ありますか
 */
export class DivisorsCountGenerator implements ProblemGenerator {
  readonly type = 'divisors_count';
  readonly category = 'numberTheory' as const;
  readonly description = '約数の個数を求める';

  generate(config?: GenerationConfig): Problem {
    const rng = createRandom(config?.seed);
    const level = (config?.difficulty ?? rng.int(1, 3)) as DifficultyLevel;

    const candidates = this.getCandidates(level);
    const n = rng.pick(candidates);
    const count = getDivisors(n).length;

    return {
      id: generateProblemId(),
      category: this.category,
      type: this.type,
      difficulty: createNumberTheoryDifficulty(level, n, 2, 1),
      question: `${n}の約数は何個ありますか`,
      answer: { kind: 'integer', value: count },
      explanation: `${n}の約数は、${getDivisors(n).join(', ')} の ${count}個です。`,
      parameters: {
        n,
        count,
        answer: count,
        divisorCount: count,
        difficultyLevel: level,
      },
    };
  }

  private getCandidates(level: DifficultyLevel): number[] {
    switch (level) {
      case 1:
        return [6, 8, 10, 12, 14, 15, 16, 18, 20, 21, 22, 24, 27, 28, 30];
      case 2:
        return [24, 30, 36, 40, 42, 48, 50, 54, 56, 60, 66, 70, 72, 80, 84];
      case 3:
        return [60, 72, 84, 90, 96, 108, 120, 132, 144, 150, 168, 180, 196, 200, 240];
      case 4:
        return [120, 144, 168, 180, 192, 216, 240, 252, 288, 300, 324, 336, 360, 384, 420];
      default:
        return [240, 288, 300, 324, 336, 360, 384, 420, 432, 480, 504, 540, 576, 600, 720];
    }
  }

  validate(problem: Problem): ValidationResult {
    const errors: string[] = [];
    const { n, count } = problem.parameters as { n: number; count: number };
    if (!Number.isInteger(n) || n <= 0) {
      errors.push('約数の対象が正の整数ではありません');
    }
    const actualCount = getDivisors(n).length;
    if (actualCount !== count) {
      errors.push('約数の個数が誤っています');
    }
    if (problem.answer.kind !== 'integer' || problem.answer.value !== count) {
      errors.push('問題の解答がパラメータと一致しません');
    }
    return { valid: errors.length === 0, errors };
  }
}

/**
 * 倍数を求める問題
 * 例: 3の倍数を小さい方から3つ答えなさい
 */
export class MultiplesFindingGenerator implements ProblemGenerator {
  readonly type = 'multiples_finding';
  readonly category = 'numberTheory' as const;
  readonly description = '倍数を求める';

  generate(config?: GenerationConfig): Problem {
    const rng = createRandom(config?.seed);
    const level = (config?.difficulty ?? rng.int(1, 2)) as DifficultyLevel;

    const count = level === 1 ? 3 : rng.int(3, 4);
    const n = level === 1 ? rng.int(2, 9) : rng.int(2, 12);

    const multiples = getMultiples(n, count);
    const answerText = multiples.join(', ');

    return {
      id: generateProblemId(),
      category: this.category,
      type: this.type,
      difficulty: createNumberTheoryDifficulty(level, n, 1, 1),
      question: `${n}の倍数を小さい方から${count}こ答えなさい`,
      answer: { kind: 'string', value: answerText },
      explanation: `${n}の倍数は、${n}×1、${n}×2、... なので、${answerText} です。`,
      parameters: {
        n,
        count,
        answer: answerText,
        difficultyLevel: level,
      },
    };
  }

  validate(problem: Problem): ValidationResult {
    const errors: string[] = [];
    const { n, count, answer } = problem.parameters as { n: number; count: number; answer: string };
    if (!Number.isInteger(n) || n <= 0) {
      errors.push('倍数の対象が正の整数ではありません');
    }
    const expected = getMultiples(n, count).join(', ');
    if (answer !== expected) {
      errors.push('倍数の一覧が誤っています');
    }
    if (problem.answer.kind !== 'string' || problem.answer.value !== answer) {
      errors.push('問題の解答がパラメータと一致しません');
    }
    return { valid: errors.length === 0, errors };
  }
}

/**
 * 素数判定問題
 * 例: 次の数のうち素数はどれか
 */
export class PrimeJudgmentGenerator implements ProblemGenerator {
  readonly type = 'prime_judgment';
  readonly category = 'numberTheory' as const;
  readonly description = '素数かどうかを判定する';

  generate(config?: GenerationConfig): Problem {
    const rng = createRandom(config?.seed);
    const level = (config?.difficulty ?? rng.int(1, 2)) as DifficultyLevel;

    const maxNum = level === 1 ? 30 : 100;
    const primeCount = rng.int(1, 2);
    const primes = getPrimesInRange(2, maxNum);
    const compositePool = Array.from({ length: maxNum - 1 }, (_, i) => i + 2).filter(
      (n) => !isPrime(n),
    );

    const selectedPrimes = rng.pickMultiple(primes, Math.min(primeCount, primes.length));
    const selectedComposites = rng.pickMultiple(
      compositePool,
      Math.min(3 - selectedPrimes.length, compositePool.length),
    );

    const choices = rng.shuffle([...selectedPrimes, ...selectedComposites]);
    const prime = selectedPrimes[0];

    return {
      id: generateProblemId(),
      category: this.category,
      type: this.type,
      difficulty: createNumberTheoryDifficulty(level, maxNum, 2, 2),
      question: `${choices.join('、')} の中で素数はどれですか`,
      answer: { kind: 'string', value: String(prime) },
      explanation: `${prime}は、約数が1と自分自身だけなので素数です。ほかの数は素数ではありません。(1は素数ではないことに注意)`,
      parameters: {
        choices,
        answer: prime,
        difficultyLevel: level,
      },
    };
  }

  validate(problem: Problem): ValidationResult {
    const errors: string[] = [];
    const { answer } = problem.parameters as { choices: number[]; answer: number };
    if (!isPrime(answer)) {
      errors.push('解答が素数ではありません');
    }
    if (problem.answer.kind !== 'string' || problem.answer.value !== String(answer)) {
      errors.push('問題の解答がパラメータと一致しません');
    }
    return { valid: errors.length === 0, errors };
  }
}

/**
 * 範囲内の素数をすべて求める問題
 */
export class PrimeRangeGenerator implements ProblemGenerator {
  readonly type = 'prime_range';
  readonly category = 'numberTheory' as const;
  readonly description = '範囲内の素数をすべて求める';

  generate(config?: GenerationConfig): Problem {
    const rng = createRandom(config?.seed);
    const level = (config?.difficulty ?? rng.int(1, 2)) as DifficultyLevel;

    let min: number;
    let max: number;
    if (level === 1) {
      min = rng.int(1, 10);
      max = rng.int(min + 5, Math.min(30, min + 15));
    } else {
      min = rng.int(1, 20);
      max = rng.int(min + 10, Math.min(60, min + 25));
    }

    const primes = getPrimesInRange(min, max);
    const answerText = primes.join(', ');

    return {
      id: generateProblemId(),
      category: this.category,
      type: this.type,
      difficulty: createNumberTheoryDifficulty(level, max, 1, 1),
      question: `${min}から${max}までの間に素数はいくつあるでしょうか (すべて答えなさい)`,
      answer: { kind: 'string', value: answerText },
      explanation: `${min}から${max}までの素数は、${answerText} です。全部で${primes.length}個あります。`,
      parameters: {
        min,
        max,
        answer: answerText,
        primeCount: primes.length,
        difficultyLevel: level,
      },
    };
  }

  validate(problem: Problem): ValidationResult {
    const errors: string[] = [];
    const { min, max, answer } = problem.parameters as { min: number; max: number; answer: string };
    const expected = getPrimesInRange(min, max).join(', ');
    if (answer !== expected) {
      errors.push('素数列挙が誤っています');
    }
    if (problem.answer.kind !== 'string' || problem.answer.value !== answer) {
      errors.push('問題の解答がパラメータと一致しません');
    }
    return { valid: errors.length === 0, errors };
  }
}

/**
 * 公約数を求める問題
 * 例: 12と18の公約数をすべて答えなさい
 */
export class CommonDivisorsGenerator implements ProblemGenerator {
  readonly type = 'common_divisors';
  readonly category = 'numberTheory' as const;
  readonly description = '公約数をすべて求める';

  generate(config?: GenerationConfig): Problem {
    const rng = createRandom(config?.seed);
    const level = (config?.difficulty ?? rng.int(1, 3)) as DifficultyLevel;

    let a: number;
    let b: number;
    const candidates = this.getPairs(level);
    [a, b] = rng.pick(candidates);

    if (rng.next() < 0.5) {
      [a, b] = [b, a];
    }

    const commonDivs = getCommonDivisors(a, b);
    const answerText = commonDivs.join(', ');

    return {
      id: generateProblemId(),
      category: this.category,
      type: this.type,
      difficulty: createNumberTheoryDifficulty(level, Math.max(a, b), 2, 1),
      question: `${a}と${b}の公約数をすべて答えなさい`,
      answer: { kind: 'string', value: answerText },
      explanation: `${a}と${b}の公約数は、${answerText} です（${commonDivs.length}こ）。最大公約数は ${gcd(a, b)} です。`,
      parameters: {
        a,
        b,
        answer: answerText,
        g: gcd(a, b),
        difficultyLevel: level,
        commonDivisorCount: commonDivs.length,
      },
    };
  }

  /** 公約数が複数あるペアを選ぶ */
  private getPairs(level: DifficultyLevel): [number, number][] {
    switch (level) {
      case 1:
        return [
          [12, 18], [12, 16], [8, 12], [10, 15], [16, 20], [6, 12],
          [15, 18], [20, 28], [6, 9], [14, 21],
        ];
      case 2:
        return [
          [24, 36], [30, 45], [28, 42], [18, 30], [20, 32], [36, 48],
          [16, 32], [24, 40], [32, 48], [27, 45],
        ];
      case 3:
        return [
          [60, 90], [72, 108], [48, 72], [60, 120], [84, 126], [96, 120],
          [90, 135], [72, 96], [56, 84], [108, 144],
        ];
      case 4:
        return [
          [120, 180], [144, 216], [96, 144], [120, 240], [168, 252], [192, 240],
          [180, 270], [144, 192], [112, 168], [216, 288],
        ];
      default:
        return [
          [240, 360], [288, 432], [192, 288], [240, 480], [336, 504], [384, 480],
          [360, 540], [288, 384], [224, 336], [432, 576],
        ];
    }
  }

  validate(problem: Problem): ValidationResult {
    const errors: string[] = [];
    const { a, b, answer } = problem.parameters as { a: number; b: number; answer: string };
    if (!Number.isInteger(a) || !Number.isInteger(b) || a <= 0 || b <= 0) {
      errors.push('公約数の対象が正の整数ではありません');
    }
    const expected = getCommonDivisors(a, b).join(', ');
    if (answer !== expected) {
      errors.push('公約数の解答が誤っています');
    }
    if (problem.answer.kind !== 'string' || problem.answer.value !== answer) {
      errors.push('問題の解答がパラメータと一致しません');
    }
    return { valid: errors.length === 0, errors };
  }
}

/**
 * 公倍数を求める問題
 * 例: 4と6の公倍数を小さい方から3つ答えなさい
 */
export class CommonMultiplesGenerator implements ProblemGenerator {
  readonly type = 'common_multiples';
  readonly category = 'numberTheory' as const;
  readonly description = '公倍数を求める';

  generate(config?: GenerationConfig): Problem {
    const rng = createRandom(config?.seed);
    const level = (config?.difficulty ?? rng.int(1, 2)) as DifficultyLevel;

    const pairs: [number, number][] = level === 1
      ? [[2, 3], [2, 4], [3, 4], [2, 5], [3, 5], [4, 6]]
      : [[3, 4], [3, 5], [4, 5], [4, 6], [5, 6], [6, 8], [4, 10], [6, 9]];

    const [a, b] = rng.pick(pairs);
    const count = rng.int(3, 4);
    const multiples = getCommonMultiples(a, b, count);
    const answerText = multiples.join(', ');

    return {
      id: generateProblemId(),
      category: this.category,
      type: this.type,
      difficulty: createNumberTheoryDifficulty(level, Math.max(a, b), 2, 1),
      question: `${a}と${b}の公倍数を小さい方から${count}つ答えなさい`,
      answer: { kind: 'string', value: answerText },
      explanation: `${a}と${b}の最小公倍数は ${lcm(a, b)} なので、公倍数は小さい順に ${answerText} です。`,
      parameters: {
        a,
        b,
        count,
        answer: answerText,
        lcm: lcm(a, b),
        difficultyLevel: level,
      },
    };
  }

  validate(problem: Problem): ValidationResult {
    const errors: string[] = [];
    const { a, b, count, answer } = problem.parameters as {
      a: number; b: number; count: number; answer: string;
    };
    const expected = getCommonMultiples(a, b, count).join(', ');
    if (answer !== expected) {
      errors.push('公倍数の解答が誤っています');
    }
    if (problem.answer.kind !== 'string' || problem.answer.value !== answer) {
      errors.push('問題の解答がパラメータと一致しません');
    }
    return { valid: errors.length === 0, errors };
  }
}

/**
 * 最大公約数を求める問題
 */
export class GcdCalculationGenerator implements ProblemGenerator {
  readonly type = 'gcd_calculation';
  readonly category = 'numberTheory' as const;
  readonly description = '最大公約数を求める';

  generate(config?: GenerationConfig): Problem {
    const rng = createRandom(config?.seed);
    const lv = (config?.difficulty ?? rng.int(1, 3)) as DifficultyLevel;

    const pairs: [number, number][] = [
      [12, 18], [16, 24], [20, 30], [24, 36], [18, 27],
      [30, 45], [36, 54], [42, 63], [28, 42], [32, 48],
      [15, 25], [21, 28], [40, 60], [54, 81], [64, 96],
    ];
    const [a, b] = rng.pick(pairs);
    const g = gcd(a, b);

    const useThree = lv >= 3 && rng.next() < 0.3;
    if (useThree) {
      const a2 = g * rng.int(2, 4);
      const b2 = g * rng.int(2, 4);
      const c2 = g * rng.int(1, 3);
      const g3 = gcd(gcd(a2, b2), c2);
      return {
        id: generateProblemId(),
        category: this.category,
        type: this.type,
        difficulty: createNumberTheoryDifficulty(lv, Math.max(a2, b2, c2), 2, 1),
        question: `${a2}、${b2}、${c2}の最大公約数はいくつですか`,
        answer: { kind: 'integer', value: g3 },
        explanation: `${a2}、${b2}、${c2}を共通に割り切れる最大の数は ${g3} です。`,
        parameters: { numbers: [a2, b2, c2], answer: g3, difficultyLevel: lv, inputType: '三数' },
      };
    }

    return {
      id: generateProblemId(),
      category: this.category,
      type: this.type,
      difficulty: createNumberTheoryDifficulty(lv, Math.max(a, b), 2, 1),
      question: `${a}と${b}の最大公約数を求めなさい`,
      answer: { kind: 'integer', value: g },
      explanation: `${a}と${b}の最大公約数は ${g} です。`,
      parameters: { a, b, answer: g, difficultyLevel: lv },
    };
  }

  validate(problem: Problem): ValidationResult {
    const errors: string[] = [];
    const { answer } = problem.parameters as { answer: number };
    const numbers = (problem.parameters as { numbers?: number[] }).numbers;
    if (numbers && numbers.length === 3) {
      const expected = gcd(gcd(numbers[0], numbers[1]), numbers[2]);
      if (answer !== expected) errors.push('3数の最大公約数が誤っています');
    } else {
      const { a, b } = problem.parameters as { a: number; b: number };
      const expected = gcd(a, b);
      if (answer !== expected) errors.push('最大公約数が誤っています');
    }
    if (problem.answer.kind !== 'integer' || problem.answer.value !== answer) {
      errors.push('問題の解答がパラメータと一致しません');
    }
    return { valid: errors.length === 0, errors };
  }
}

/**
 * 最小公倍数を求める問題
 */
export class LcmCalculationGenerator implements ProblemGenerator {
  readonly type = 'lcm_calculation';
  readonly category = 'numberTheory' as const;
  readonly description = '最小公倍数を求める';

  generate(config?: GenerationConfig): Problem {
    const rng = createRandom(config?.seed);
    const lv = (config?.difficulty ?? rng.int(1, 3)) as DifficultyLevel;

    const pairs: [number, number][] = [
      [2, 3], [3, 4], [2, 5], [3, 5], [4, 6], [5, 6],
      [4, 7], [6, 8], [3, 8], [6, 9], [4, 10], [8, 12],
      [6, 10], [5, 12], [9, 12],
    ];
    const [a, b] = rng.pick(pairs);
    const l = lcm(a, b);

    return {
      id: generateProblemId(),
      category: this.category,
      type: this.type,
      difficulty: createNumberTheoryDifficulty(lv, l, 2, 1),
      question: `${a}と${b}の最小公倍数を求めなさい`,
      answer: { kind: 'integer', value: l },
      explanation: `${a}と${b}の最小公倍数は ${l} です。`,
      parameters: { a, b, answer: l, difficultyLevel: lv },
    };
  }

  validate(problem: Problem): ValidationResult {
    const errors: string[] = [];
    const { a, b, answer } = problem.parameters as { a: number; b: number; answer: number };
    const expected = lcm(a, b);
    if (answer !== expected) errors.push('最小公倍数が誤っています');
    if (problem.answer.kind !== 'integer' || problem.answer.value !== answer) {
      errors.push('問題の解答がパラメータと一致しません');
    }
    return { valid: errors.length === 0, errors };
  }
}

/**
 * 約数・倍数を利用した文章問題 (GCD/LCMの文章題)
 */
export class GcdLcmWordGenerator implements ProblemGenerator {
  readonly type = 'gcd_lcm_word';
  readonly category = 'numberTheory' as const;
  readonly description = '約数・倍数の文章問題';

  generate(config?: GenerationConfig): Problem {
    const rng = createRandom(config?.seed);
    const lv = (config?.difficulty ?? rng.int(1, 3)) as DifficultyLevel;

    const templates = [
      {
        type: 'gcd' as const,
        template: '{a}cmのリボンと{b}cmのリボンを、同じ長さに切って、あまりがないようにします。最も長い1本分の長さは何cmですか',
      },
      {
        type: 'gcd' as const,
        template: '{a}このアメと{b}このガムを、何人かの子どもに同じ数ずつ分けます。あまりなく分けるとき、最も多い人数は何人ですか',
      },
      {
        type: 'lcm' as const,
        template: 'ある電車Aは{a}分ごと、電車Bは{b}分ごとに発車します。最初に同時に発車したあと、次に同時に発車するのは何分後ですか',
      },
      {
        type: 'lcm' as const,
        template: '{a}cmのテープと{b}cmのテープを、それぞれ同じ長さに折っていきます。折り目が初めて重なる長さは何cmですか',
      },
      {
        type: 'period' as const,
        template: 'ケーキは{c}個ずつ、クッキーは{d}個ずつ入った箱を、同じ数になるように買いたい。それぞれ最も少ないセットは何箱ずつ買えばよいですか',
      },
    ];

    const t = rng.pick(templates);

    if (t.type === 'gcd') {
      const [a, b] = rng.pick([[12, 18], [16, 24], [20, 30], [18, 27], [24, 36], [28, 42], [32, 48]] as [number, number][]);
      const ans = gcd(a, b);
      const story = t.template.replace('{a}', String(a)).replace('{b}', String(b));
      return {
        id: generateProblemId(),
        category: this.category,
        type: this.type,
        difficulty: createNumberTheoryDifficulty(lv, Math.max(a, b), 3, 3),
        question: story,
        answer: { kind: 'integer', value: ans },
        explanation: `${a}と${b}の最大公約数を求めます。${a}と${b}の最大公約数は ${ans} です。`,
        parameters: { t: 'gcd', a, b, answer: ans, difficultyLevel: lv },
      };
    }

    if (t.type === 'lcm') {
      const [a, b] = rng.pick([[2, 3], [3, 4], [2, 5], [4, 6], [5, 6], [6, 8], [4, 10]] as [number, number][]);
      const ans = lcm(a, b);
      const story = t.template.replace('{a}', String(a)).replace('{b}', String(b));
      return {
        id: generateProblemId(),
        category: this.category,
        type: this.type,
        difficulty: createNumberTheoryDifficulty(lv, Math.max(a, b), 3, 3),
        question: story,
        answer: { kind: 'integer', value: ans },
        explanation: `${a}と${b}の最小公倍数を求めます。${a}と${b}の最小公倍数は ${ans} です。`,
        parameters: { t: 'lcm', a, b, answer: ans, difficultyLevel: lv },
      };
    }

    // period
    const c = rng.int(2, 9);
    const d = rng.int(2, 9);
    const ans = lcm(c, d);
    const story = t.template.replace('{c}', String(c)).replace('{d}', String(d));
    return {
      id: generateProblemId(),
      category: this.category,
      type: this.type,
      difficulty: createNumberTheoryDifficulty(lv, Math.max(c, d), 3, 3),
      question: story,
      answer: { kind: 'integer', value: ans },
      explanation: `${c}と${d}の最小公倍数を求めると ${ans} です。`,
      parameters: { t: 'period', c, d, answer: ans, difficultyLevel: lv },
    };
  }

  validate(problem: Problem): ValidationResult {
    const errors: string[] = [];
    const params = problem.parameters as Record<string, unknown>;
    const t = params.t as string;
    if (t === 'gcd') {
      const { a, b, answer } = params as { a: number; b: number; answer: number };
      if (gcd(a, b) !== answer) errors.push('最大公約数の解答が誤っています');
    } else if (t === 'lcm') {
      const { a, b, answer } = params as { a: number; b: number; answer: number };
      if (lcm(a, b) !== answer) errors.push('最小公倍数の解答が誤っています');
    } else {
      const { c, d, answer } = params as { c: number; d: number; answer: number };
      if (lcm(c, d) !== answer) errors.push('最小公倍数の解答が誤っています');
    }
    if (problem.answer.kind !== 'integer' || problem.answer.value !== (params.answer as number)) {
      errors.push('問題の解答がパラメータと一致しません');
    }
    return { valid: errors.length === 0, errors };
  }
}

/**
 * 周期・繰り返しを利用した問題
 * 例: 赤、青、白の旗を繰り返しならべると、20番目は何色?
 */
export class PeriodRepetitionGenerator implements ProblemGenerator {
  readonly type = 'period_repetition';
  readonly category = 'numberTheory' as const;
  readonly description = '周期・繰り返しの問題';

  generate(config?: GenerationConfig): Problem {
    const rng = createRandom(config?.seed);
    const lvl = (config?.difficulty ?? rng.int(1, 3)) as DifficultyLevel;

    const patterns = [
      { colors: ['赤', '白'], name: '赤、白の旗' },
      { colors: ['赤', '青', '白'], name: '赤、青、白の旗' },
      { colors: ['赤', '白', '青'], name: '赤、白、青の旗' },
      { colors: ['○', '○', '●', '○'], name: '赤い玉、白い玉4個セット' },
      { colors: ['A', 'B'], name: 'A、Bの旗' },
      { colors: ['A', 'B', 'C'], name: 'A、B、Cの旗' },
    ];

    const pattern = rng.pick(patterns);
    const period = pattern.colors.length;
    // 難易度に応じて周期の長さと問題の位置を調整する
    const n = lvl <= 1
      ? rng.int(Math.max(6, period * 3), Math.max(10, period * 5))
      : lvl === 2
        ? rng.int(Math.max(8, period * 4), Math.max(15, period * 7))
        : rng.int(Math.max(10, period * 5), Math.max(20, period * 10));
    const index = (n - 1) % period;
    const answer = pattern.colors[index];

    return {
      id: generateProblemId(),
      category: this.category,
      type: this.type,
      difficulty: createNumberTheoryDifficulty(lvl, n, 3, 2),
      question: `${pattern.name}を「${pattern.colors.join('、')}」の順にくり返しならべます。${n}番目は何色ですか`,
      answer: { kind: 'string', value: answer },
      explanation: `周期は${period}です。${n}÷${period}＝${Math.floor(n / period)} あまり ${n % period} なので、${
        n % period === 0 ? `${period}番目と同じ${answer}です。` : `${n % period}番目の${answer}になります。`
      }`,
      parameters: {
        pattern: pattern.colors,
        period,
        n,
        answer,
        difficultyLevel: lvl,
        remainder: n % period,
      },
    };
  }

  validate(problem: Problem): ValidationResult {
    const errors: string[] = [];
    const { pattern, n, answer } = problem.parameters as {
      pattern: string[]; n: number; answer: string;
    };
    const period = pattern.length;
    const expected = pattern[(n - 1) % period];
    if (answer !== expected) {
      errors.push('周期の問題が誤っています');
    }
    if (problem.answer.kind !== 'string' || problem.answer.value !== answer) {
      errors.push('問題の解答がパラメータと一致しません');
    }
    return { valid: errors.length === 0, errors };
  }
}