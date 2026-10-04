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
  gcd,
  lcm,
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
 * 倍数を求める問題の問題の構造
 *
 * Phase 2-D:
 *   以前は「nの倍数を小さい方から count こ」1種類のみで、count も 3 か 4 の
 *   2値しかなく、difficulty を上げても数字が大きくなるだけだった。
 *   既存の divisors_finding (「nの約数をすべて」) と同じ「列挙」型の問題は
 *   新たに作らない。ここに置くのは「倍数」固有の学習内容だけにして、
 *   約数側の型と役割が重ならないようにする。
 */
export type MultiplesFindingVariant =
  /** 既存型: nの倍数を小さい方から count こ (列挙) */
  | 'list_first_n'
  /** n以下の倍数をすべて (上限があるので列挙が有限に決まる) */
  | 'list_up_to'
  /** lo〜hi の間にある nの倍数をすべて (区間の両端を考える必要がある) */
  | 'list_between'
  /** nの倍数を小さい方から k番目はいくつ (逆算の考え方) */
  | 'nth_multiple'
  /** 1から hi までにある nの倍数はいくつ (数える) */
  | 'count_in_range';

/** 難易度ごとの構造候補 (区間や数え上げを考えるものほど後段に置く) */
const MULTIPLES_FINDING_VARIANTS: Record<DifficultyLevel, MultiplesFindingVariant[]> = {
  1: ['list_first_n', 'list_up_to'],
  2: ['list_first_n', 'list_up_to', 'list_between'],
  3: ['list_first_n', 'list_up_to', 'list_between', 'nth_multiple'],
  4: ['list_first_n', 'list_up_to', 'list_between', 'nth_multiple', 'count_in_range'],
  5: ['list_up_to', 'list_between', 'nth_multiple', 'count_in_range'],
};

/** 構造ごとの答えを求める。倍数の定義 (n×整数) そのものから数え直す。 */
function solveMultiplesFinding(
  variant: MultiplesFindingVariant,
  n: number,
  arg1: number,
  arg2: number,
): {
  answerText: string;
  answerKind: 'string' | 'integer';
  question: string;
  explanation: string;
} {
  switch (variant) {
    case 'list_first_n': {
      const list: number[] = [];
      for (let i = 1; i <= arg1; i++) list.push(n * i);
      return {
        answerText: list.join(', '),
        answerKind: 'string',
        question: `${n}の倍数を小さい方から${arg1}こ答えなさい`,
        explanation: `${n}の倍数は、${n}×1、${n}×2、… なので、${list.join(', ')} です。`,
      };
    }
    case 'list_up_to': {
      const list: number[] = [];
      for (let k = n; k <= arg1; k += n) list.push(k);
      return {
        answerText: list.join(', '),
        answerKind: 'string',
        question: `${arg1}以下の${n}の倍数をすべて答えなさい`,
        explanation: `${arg1}以下の${n}の倍数は、${list.join(', ')} です。`,
      };
    }
    case 'list_between': {
      const list: number[] = [];
      for (let k = arg1; k <= arg2; k++) if (k % n === 0) list.push(k);
      return {
        answerText: list.join(', '),
        answerKind: 'string',
        question: `${arg1}から${arg2}までの間にある${n}の倍数をすべて答えなさい`,
        explanation: `${arg1}から${arg2}までの${n}の倍数は、${list.join(', ')} です。`,
      };
    }
    case 'nth_multiple':
      return {
        answerText: String(n * arg1),
        answerKind: 'integer',
        question: `${n}の倍数を小さい方から${arg1}番目は何ですか`,
        explanation: `${n}の倍数は${n}×1、${n}×2、… なので、${arg1}番目は${n}×${arg1}＝${n * arg1}です。`,
      };
    case 'count_in_range': {
      const list: number[] = [];
      for (let k = n; k <= arg1; k += n) list.push(k);
      return {
        answerText: String(list.length),
        answerKind: 'integer',
        question: `1から${arg1}までにある${n}の倍数はいくつありますか`,
        explanation: `1から${arg1}までの${n}の倍数は${list.join(', ')}で、全部で${list.length}こあります。`,
      };
    }
  }
}
/** 難易度・乱数から、成立する (variant, n, arg1, arg2) を選び出す */
function pickMultiplesParams(
  rng: ReturnType<typeof createRandom>,
  level: DifficultyLevel,
): { variant: MultiplesFindingVariant; n: number; arg1: number; arg2: number } {
  for (let attempt = 0; attempt < 60; attempt++) {
    const variant = rng.pick(MULTIPLES_FINDING_VARIANTS[level]);
    const n = rng.int(2, 9);
    let arg1 = 0;
    let arg2 = 0;
    switch (variant) {
      case 'list_first_n':
        // 1こだけだと倍数そのものになり学習がないため、2こ以上にする
        arg1 = rng.int(3, level === 1 ? 4 : level === 2 ? 5 : 6);
        break;
      case 'list_up_to':
        // nの倍数を含む上限にする (答えが空にならない)
        arg1 = rng.int(Math.max(12, n * 4), 30 + level * 10);
        break;
      case 'list_between': {
        // 区間に必ず1つ以上の倍数が入る幅にする
        const lo = rng.int(2, 20);
        arg1 = lo;
        arg2 = lo + rng.int(n * 2, n * 3);
        break;
      }
      case 'nth_multiple':
        arg1 = rng.int(4, level === 1 ? 5 : level === 2 ? 8 : 12);
        break;
      case 'count_in_range':
        arg1 = rng.int(Math.max(20, n * 5), 40 + level * 12);
        break;
    }
    return { variant, n, arg1, arg2 };
  }
  return { variant: 'list_first_n', n: 3, arg1: 4, arg2: 0 };
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

    const { variant, n, arg1, arg2 } = pickMultiplesParams(rng, level);
    const res = solveMultiplesFinding(variant, n, arg1, arg2);

    return {
      id: generateProblemId(),
      category: this.category,
      type: this.type,
      difficulty: createNumberTheoryDifficulty(
        level,
        Math.max(n, arg2),
        Math.min(3, level) as DifficultyLevel,
        Math.min(2, level) as DifficultyLevel,
      ),
      question: res.question,
      answer:
        res.answerKind === 'string'
          ? { kind: 'string', value: res.answerText }
          : { kind: 'integer', value: Number(res.answerText) },
      explanation: res.explanation,
      parameters: {
        n,
        variant,
        arg1,
        // arg2 は list_between のときだけ使われる。それ以外は問題文に
        // 現れないので null にして「パラメータは問題文に含まれる」検査を避ける。
        arg2: variant === 'list_between' ? arg2 : null,
        // 後方互換のため count も残す (list_first_n のときだけ意味を持つ)。
        count: variant === 'list_first_n' ? arg1 : null,
        answer: res.answerText,
        difficultyLevel: level,
      },
    };
  }

  validate(problem: Problem): ValidationResult {
    const errors: string[] = [];
    const { n, variant, arg1, answer } = problem.parameters as {
      n: number;
      variant: MultiplesFindingVariant;
      arg1: number;
      arg2: number | null;
      answer: string;
    };
    const arg2 = problem.parameters.arg2 as number | null;
    if (!Number.isInteger(n) || n <= 0) {
      errors.push('倍数の対象が正の整数ではありません');
      return { valid: false, errors };
    }
    if (!Number.isInteger(arg1)) {
      errors.push('倍数の指定値が整数ではありません');
      return { valid: false, errors };
    }
    // list_between 以外は arg2 が使われないので検査しない
    if (variant === 'list_between') {
      if (arg2 === null || !Number.isInteger(arg2)) {
        errors.push('区間の上限が設定されていません');
      } else if (arg1 > arg2) {
        errors.push('区間の下限が上限を上回っています');
      }
    }
    if (variant === 'list_up_to' && arg1 < n) {
      errors.push('上限が倍数のもとより小さいので答えが空になります');
    }
    if (variant === 'nth_multiple' && arg1 < 1) {
      errors.push('何番目かが1未満です');
    }
    const expected = solveMultiplesFinding(variant, n, arg1, arg2 ?? 0).answerText;
    if (answer !== expected) {
      errors.push('倍数の解答が誤っています');
    }
    if (problem.answer.kind === 'string' && problem.answer.value !== answer) {
      errors.push('問題の解答とパラメータが一致しません');
    }
    if (problem.answer.kind === 'integer' && String(problem.answer.value) !== answer) {
      errors.push('問題の解答とパラメータが一致しません');
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
 * 公倍数を求める問題の種類
 *
 * Phase 2-E:
 *   - 以前は (a, b) ペアが6〜8個固定で、構造も「小さい方からcount個」1種類のみ。
 *     100問中22種類しか出ていなかった。
 *   - 「最小公倍数を軸に広げる」という考え方は共通だが、何を求めるかで構造を4種類に分けた。
 *
 * 教育範囲の根拠 (Phase 2-L で調査結果に合わせて整理):
 *   - 公倍数・最小公倍数そのものは、調査した小5・小6の教科書や指導資料では
 *     小5の内容として扱われている。最小公倍数を軸に公倍数を並べる
 *     list_first_n は、この小5で扱われている基本に対応する。
 *   - 一方、範囲を区切って公倍数を並べる list_up_to / list_between と、
 *     範囲内に公倍数がいくつあるかを数える count_in_range については、
 *     調べた教材の中にこれらと直接対応する問題例を確認できなかった。
 *     multiples_finding (1つの数の倍数を求める) に範囲付きの列挙問題があるから
 *     といって、2つの数の公倍数にも同じ形式が使えるとは限らないため、
 *     それらと同じ扱いであるとは断定できない。
 *   - 3つ以上の数の公倍数についても、調査した範囲では教材例を確認できなかった。
 *     ただし、これは小6で扱わないことを示すものではなく、
 *     小5・小6の内容として十分に扱われていない、あるいは
 *     教材上は扱われていない可能性があることまでを含んでいる。
 *     本型で採用しないという判断は、根拠が足りないことを理由とするものである。
 *
 *   いずれの項目も「直接例を確認できなかった」ことは「教育範囲外である」こと
 *   と同じではない。ここでは証拠が足りないことをそのまま記録しているだけであり、
 *   このコメントだけを理由に variant を削除する根拠にはしない。
 *   削除の判断は、生成可能性や品質への影響評価を踏まえて別途行う。
 */
export type CommonMultiplesVariant =
  /** 小さい方から count 個求める */
  | 'list_first_n'
  /** upper 以下の公倍数をすべて並べる (上限の扱い) */
  | 'list_up_to'
  /** lo から hi までの範囲にある公倍数をすべて並べる (両端の扱い) */
  | 'list_between'
  /** 範囲内に公倍数がいくつあるかを数える (数え上げ) */
  | 'count_in_range';

/** 難易度ごとの構造候補 (範囲の境界や数え上げを考えるものほど後段に置く) */
const COMMON_MULTIPLES_VARIANTS: Record<DifficultyLevel, CommonMultiplesVariant[]> = {
  1: ['list_first_n'],
  2: ['list_first_n', 'list_up_to'],
  3: ['list_first_n', 'list_up_to', 'list_between'],
  4: ['list_first_n', 'list_up_to', 'list_between', 'count_in_range'],
  5: ['list_up_to', 'list_between', 'count_in_range'],
};

/** 難易度ごとの「a, b の上限」 */
const COMMON_MULTIPLES_NUM_MAX: Record<DifficultyLevel, number> = {
  1: 8, 2: 10, 3: 12, 4: 12, 5: 12,
};

/** 最小公倍数の上限 (これを超えるペアは答えが大きすぎて小6で扱えない) */
const COMMON_MULTIPLES_LCM_MAX: Record<DifficultyLevel, number> = {
  1: 36, 2: 60, 3: 120, 4: 180, 5: 240,
};

/**
 * (a, b) の候補を作る。
 * 手書きテーブルをやめて、条件 (2 <= a < b <= numMax, lcm <= lcmMax) から列挙する。
 */
function commonMultiplePairs(level: DifficultyLevel): [number, number][] {
  const numMax = COMMON_MULTIPLES_NUM_MAX[level];
  const lcmMax = COMMON_MULTIPLES_LCM_MAX[level];
  const pairs: [number, number][] = [];
  for (let a = 2; a <= numMax; a++) {
    for (let b = a + 1; b <= numMax; b++) {
      if (lcm(a, b) <= lcmMax) pairs.push([a, b]);
    }
  }
  return pairs;
}

/** a の倍数を lower 以上 upper 以下にだけ並べる */
function multiplesInRange(a: number, lower: number, upper: number): number[] {
  const list: number[] = [];
  const start = Math.ceil(lower / a) * a;
  for (let k = start; k <= upper; k += a) list.push(k);
  return list;
}
/**
 * 構造ごとの答え・問題文・解説を求める。
 * 公倍数は「最小公倍数の整数倍」なので、lcm を軸に境界を含めて数え直す。
 */
function solveCommonMultiples(
  variant: CommonMultiplesVariant,
  a: number,
  b: number,
  arg1: number,
  arg2: number,
): { answerText: string; answerKind: 'string' | 'integer'; question: string; explanation: string } {
  const L = lcm(a, b);
  switch (variant) {
    case 'list_first_n': {
      const list: number[] = [];
      for (let i = 1; i <= arg1; i++) list.push(L * i);
      return {
        answerText: list.join(', '),
        answerKind: 'string',
        question: `${a}と${b}の公倍数を小さい方から${arg1}つ答えなさい`,
        explanation: `${a}と${b}の最小公倍数は ${L} なので、公倍数は ${L} の整数倍です。小さい方から${arg1}個は ${list.join(', ')} です。`,
      };
    }
    case 'list_up_to': {
      const list = multiplesInRange(L, 1, arg1);
      return {
        answerText: list.join(', '),
        answerKind: 'string',
        question: `${arg1}以下の${a}と${b}の公倍数をすべて答えなさい`,
        explanation: `${a}と${b}の最小公倍数は ${L} です。${L} の整数倍のうち ${arg1} 以下のものは ${list.join(', ')} です。`,
      };
    }
    case 'list_between': {
      const list = multiplesInRange(L, arg1, arg2);
      return {
        answerText: list.join(', '),
        answerKind: 'string',
        question: `${arg1}から${arg2}までの間にある${a}と${b}の公倍数をすべて答えなさい`,
        explanation: `${a}と${b}の最小公倍数は ${L} です。${arg1}以上${arg2}以下にある ${L} の倍数は ${list.join(', ')} です。`,
      };
    }
    case 'count_in_range': {
      const list = multiplesInRange(L, 1, arg1);
      return {
        answerText: String(list.length),
        answerKind: 'integer',
        question: `1から${arg1}までにある${a}と${b}の公倍数はいくつありますか`,
        explanation: `${a}と${b}の最小公倍数は ${L} です。1から${arg1}までの ${L} の倍数は ${list.join(', ')} で、全部で${list.length}こあります。`,
      };
    }
  }
}

/** 難易度・乱数から、成立する (variant, a, b, arg1, arg2) を選び出す */
function pickCommonMultiplesParams(
  rng: ReturnType<typeof createRandom>,
  level: DifficultyLevel,
): { variant: CommonMultiplesVariant; a: number; b: number; arg1: number; arg2: number } {
  const usable = COMMON_MULTIPLES_VARIANTS[level];
  const pairs = commonMultiplePairs(level);

  for (let attempt = 0; attempt < 60; attempt++) {
    const variant = rng.pick(usable);
    const [a, b] = rng.pick(pairs);
    const L = lcm(a, b);

    let arg1 = 0;
    let arg2 = 0;
    if (variant === 'list_first_n') {
      // 1つだけだと最小公倍数そのものになり学習がないため、3つ以上にする
      arg1 = rng.int(3, level === 1 ? 4 : level <= 3 ? 5 : 6);
    } else if (variant === 'list_up_to') {
      // 上限が最小公倍数を含み、答えが2つ以上になる幅にする
      arg1 = L * rng.int(2, level <= 2 ? 3 : 4) + rng.int(0, Math.max(0, L - 1));
    } else if (variant === 'list_between') {
      // 区間の両端を含めても必ず2つ以上の公倍数が入る幅にする
      arg1 = L * rng.int(0, 2) + rng.int(1, Math.max(1, L - 1));
      arg2 = arg1 + L * rng.int(2, level <= 3 ? 3 : 4);
    } else {
      // count_in_range: 1つだけ数えるだけの問題を避ける
      arg1 = L * rng.int(3, level <= 3 ? 4 : 5) + rng.int(0, Math.max(0, L - 1));
    }

    const res = solveCommonMultiples(variant, a, b, arg1, arg2);
    if (variant === 'count_in_range') {
      // 答えが2以上になる範囲だけ採用する
      if (Number(res.answerText) >= 2) {
        return { variant, a, b, arg1, arg2 };
      }
      continue;
    }
    // リスト系は2つ以上入り、5個を超えると小6で書きにくいので避ける
    const count = res.answerText === '' ? 0 : res.answerText.split(', ').length;
    if (count >= 2 && count <= 5) {
      return { variant, a, b, arg1, arg2 };
    }
  }

  // フォールバック (必ず成立する最小の組合せ)
  return { variant: 'list_first_n', a: 2, b: 3, arg1: 3, arg2: 0 };
}

/**
 * 公倍数を求める問題
 * 例: 4と6の公倍数を小さい方から3つ答えなさい
 *
 * Phase 2-E: 構造を4種類に広げ、(a, b) ペアも難易度別に列挙で生成するようにした。
 */
export class CommonMultiplesGenerator implements ProblemGenerator {
  readonly type = 'common_multiples';
  readonly category = 'numberTheory' as const;
  readonly description = '公倍数を求める';

  generate(config?: GenerationConfig): Problem {
    const rng = createRandom(config?.seed);
    const level = (config?.difficulty ?? rng.int(1, 2)) as DifficultyLevel;

    const { variant, a, b, arg1, arg2 } = pickCommonMultiplesParams(rng, level);
    const res = solveCommonMultiples(variant, a, b, arg1, arg2);

    return {
      id: generateProblemId(),
      category: this.category,
      type: this.type,
      difficulty: createNumberTheoryDifficulty(
        level,
        Math.max(a, b, arg2),
        // 数え上げは「並べる」より手順が増えるため推論を1段上げる
        (variant === 'count_in_range' ? 3 : variant === 'list_first_n' ? 2 : 2) as DifficultyLevel,
        (variant === 'list_first_n' ? 1 : 2) as DifficultyLevel,
      ),
      question: res.question,
      answer:
        res.answerKind === 'string'
          ? { kind: 'string', value: res.answerText }
          : { kind: 'integer', value: Number(res.answerText) },
      // count_in_range は「個数」を答えるので整数専用UIにする
      // (common_multiples は既定で list UI に振り分けられるため、明示的に上書きする)
      inputType: res.answerKind === 'integer' ? 'integer' : 'list',
      explanation: res.explanation,
      parameters: {
        a,
        b,
        variant,
        arg1,
        // arg2 / count は list_between / list_first_n のときだけ意味を持つ
        arg2: variant === 'list_between' ? arg2 : null,
        count: variant === 'list_first_n' ? arg1 : null,
        answer: res.answerText,
        lcm: lcm(a, b),
        difficultyLevel: level,
      },
    };
  }

  validate(problem: Problem): ValidationResult {
    const errors: string[] = [];
    const params = problem.parameters as {
      a: number; b: number; variant: CommonMultiplesVariant;
      arg1: number; arg2: number | null; answer: string;
    };
    const { a, b, variant, arg1, answer } = params;
    const arg2 = params.arg2 ?? 0;

    if (!Number.isInteger(a) || !Number.isInteger(b) || a <= 0 || b <= 0) {
      errors.push('公倍数の対象が正の整数ではありません');
      return { valid: false, errors };
    }
    if (variant === 'list_between') {
      if (params.arg2 === null || !Number.isInteger(params.arg2)) {
        errors.push('区間の上限が設定されていません');
      } else if (arg1 > params.arg2) {
        errors.push('区間の下限が上限を上回っています');
      }
    }
    const expected = solveCommonMultiples(variant, a, b, arg1, arg2).answerText;
    if (answer !== expected) {
      errors.push('公倍数の解答が誤っています');
    }
    if (problem.answer.kind === 'string' && problem.answer.value !== answer) {
      errors.push('問題の解答がパラメータと一致しません');
    }
    if (problem.answer.kind === 'integer' && String(problem.answer.value) !== answer) {
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
