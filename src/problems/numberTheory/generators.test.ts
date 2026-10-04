/**
 * 数の性質 (約数・倍数・素数・公約数・公倍数・GCD/LCM) のテスト
 */

import { describe, expect, it } from 'vitest';
import {
  DivisorsFindingGenerator,
  DivisorsCountGenerator,
  MultiplesFindingGenerator,
  PrimeJudgmentGenerator,
  PrimeRangeGenerator,
  CommonDivisorsGenerator,
  CommonMultiplesGenerator,
  GcdCalculationGenerator,
  LcmCalculationGenerator,
  GcdLcmWordGenerator,
  PeriodRepetitionGenerator,
} from './generators';
import { validateProblem } from '../../engine/validator/validator';
import { gcd, lcm, getDivisors, isPrime } from '../../utils/numberTheory';

describe('約数をすべて求める', () => {
  const generator = new DivisorsFindingGenerator();

  it('正しい約数を返す', () => {
    for (let i = 0; i < 100; i++) {
      const problem = generator.generate();
      const { n, answer } = problem.parameters as { n: number; answer: string };
      expect(answer).toBe(getDivisors(n).join(', '));
      expect(problem.answer.kind).toBe('string');
      if (problem.answer.kind === 'string') {
        expect(problem.answer.value).toBe(answer);
      }
    }
  });

  it('検証を通過する', () => {
    for (let i = 0; i < 100; i++) {
      const problem = generator.generate();
      const result = validateProblem(problem);
      expect(result.valid, result.errors.join(', ')).toBe(true);
    }
  });

  it('難易度1の問題が生成できる', () => {
    const problem = generator.generate({ difficulty: 1 });
    expect(problem.difficulty.level).toBeGreaterThanOrEqual(1);
    expect(problem.difficulty.level).toBeLessThanOrEqual(3);
  });
});

describe('約数の個数を求める', () => {
  const generator = new DivisorsCountGenerator();

  it('正しい個数を返す', () => {
    for (let i = 0; i < 100; i++) {
      const problem = generator.generate();
      const { n, count } = problem.parameters as { n: number; count: number };
      expect(count).toBe(getDivisors(n).length);
      if (problem.answer.kind === 'integer') {
        expect(problem.answer.value).toBe(count);
      }
    }
  });

  it('検証を通過する', () => {
    for (let i = 0; i < 100; i++) {
      const problem = generator.generate();
      const result = validateProblem(problem);
      expect(result.valid, result.errors.join(', ')).toBe(true);
    }
  });
});

describe('倍数を求める', () => {
  const generator = new MultiplesFindingGenerator();

  it('正しい倍数を返す', () => {
    for (let i = 0; i < 100; i++) {
      const problem = generator.generate();
      const { n, variant, arg1, arg2, answer } = problem.parameters as {
        n: number;
        variant: string;
        arg1: number;
        arg2: number | null;
        answer: string;
      };
      // Phase 2-D で構造 (variant) ごとに答えの求め方が変わったため、
      // 生成器の内部関数ではなく「倍数の定義」から期待値を作り直す。
      let expected: string;
      switch (variant) {
        case 'list_first_n': {
          expected = Array.from({ length: arg1 }, (_, idx) => n * (idx + 1)).join(', ');
          break;
        }
        case 'list_up_to': {
          const list: number[] = [];
          for (let k = n; k <= arg1; k++) if (k % n === 0) list.push(k);
          expected = list.join(', ');
          break;
        }
        case 'list_between': {
          const hi = arg2 as number;
          const list: number[] = [];
          for (let k = arg1; k <= hi; k++) if (k % n === 0) list.push(k);
          expected = list.join(', ');
          break;
        }
        case 'nth_multiple':
          expected = String(n * arg1);
          break;
        default: {
          // count_in_range は答えが個数なので、別の数え方で検証する
          let count = 0;
          for (let k = 1; k <= arg1; k++) if (k % n === 0) count++;
          expected = String(count);
          break;
        }
      }
      expect(answer, `${problem.question} (${variant})`).toBe(expected);
      if (problem.answer.kind === 'string') {
        expect(problem.answer.value).toBe(answer);
      }
    }
  });

  it('検証を通過する', () => {
    for (let i = 0; i < 100; i++) {
      const problem = generator.generate();
      const result = validateProblem(problem);
      expect(result.valid, result.errors.join(', ')).toBe(true);
    }
  });
});

describe('素数判定', () => {
  const generator = new PrimeJudgmentGenerator();

  it('答えが素数である', () => {
    for (let i = 0; i < 100; i++) {
      const problem = generator.generate();
      const { answer } = problem.parameters as { answer: number };
      expect(isPrime(answer)).toBe(true);
      if (problem.answer.kind === 'string') {
        expect(Number(problem.answer.value)).toBe(answer);
      }
    }
  });

  it('選択肢が3つ以上ある', () => {
    for (let i = 0; i < 100; i++) {
      const problem = generator.generate();
      const { choices } = problem.parameters as { choices: number[] };
      expect(choices.length).toBeGreaterThanOrEqual(3);
    }
  });

  it('検証を通過する', () => {
    for (let i = 0; i < 100; i++) {
      const problem = generator.generate();
      const result = validateProblem(problem);
      expect(result.valid, result.errors.join(', ')).toBe(true);
    }
  });
});

describe('範囲内の素数', () => {
  const generator = new PrimeRangeGenerator();

  it('範囲内の素数を正しく列挙する', () => {
    for (let i = 0; i < 100; i++) {
      const problem = generator.generate();
      const { min, max, answer } = problem.parameters as { min: number; max: number; answer: string };
      const primes: number[] = [];
      for (let n = Math.max(2, min); n <= max; n++) {
        if (isPrime(n)) primes.push(n);
      }
      expect(answer).toBe(primes.join(', '));
    }
  });

  it('検証を通過する', () => {
    for (let i = 0; i < 100; i++) {
      const problem = generator.generate();
      const result = validateProblem(problem);
      expect(result.valid, result.errors.join(', ')).toBe(true);
    }
  });
});

describe('公約数', () => {
  const generator = new CommonDivisorsGenerator();

  it('公約数を正しく列挙する', () => {
    for (let i = 0; i < 100; i++) {
      const problem = generator.generate();
      const { a, b, answer } = problem.parameters as { a: number; b: number; answer: string };
      const commonDivs = getDivisors(a).filter((d) => getDivisors(b).includes(d));
      expect(answer).toBe(commonDivs.join(', '));
    }
  });

  it('検証を通過する', () => {
    for (let i = 0; i < 100; i++) {
      const problem = generator.generate();
      const result = validateProblem(problem);
      expect(result.valid, result.errors.join(', ')).toBe(true);
    }
  });
});

describe('公倍数', () => {
  const generator = new CommonMultiplesGenerator();

  it('公倍数を正しく列挙する', () => {
    // Phase 2-E で構造 (variant) ごとに答えの求め方が変わったため、
    // 生成器の内部関数ではなく「公倍数の定義」から期待値を作り直す。
    for (let i = 0; i < 100; i++) {
      const problem = generator.generate();
      const { a, b, variant, arg1, arg2, answer } = problem.parameters as {
        a: number;
        b: number;
        variant: string;
        arg1: number;
        arg2: number | null;
        answer: string;
      };
      // 公倍数 = a でも b でも割り切れる正の整数
      const collect = (limit: number): number[] => {
        const out: number[] = [];
        for (let m = 1; m <= limit; m++) if (m % a === 0 && m % b === 0) out.push(m);
        return out;
      };
      let expected: string;
      switch (variant) {
        case 'list_first_n': {
          const found: number[] = [];
          for (let m = 1; found.length < arg1; m++) if (m % a === 0 && m % b === 0) found.push(m);
          expected = found.join(', ');
          break;
        }
        case 'list_up_to':
          expected = collect(arg1).join(', ');
          break;
        case 'list_between':
          expected = collect(arg2 ?? 0).filter((m) => m >= arg1).join(', ');
          break;
        default:
          expected = String(collect(arg1).length);
          break;
      }
      expect(answer).toBe(expected);
    }
  });

  it('検証を通過する', () => {
    for (let i = 0; i < 100; i++) {
      const problem = generator.generate();
      const result = validateProblem(problem);
      expect(result.valid, result.errors.join(', ')).toBe(true);
    }
  });
});

describe('最大公約数', () => {
  const generator = new GcdCalculationGenerator();

  it('正しい最大公約数を返す', () => {
    for (let i = 0; i < 100; i++) {
      const problem = generator.generate();
      const params = problem.parameters as { a?: number; b?: number; numbers?: number[]; answer: number };
      if (params.numbers && params.numbers.length === 3) {
        const [x, y, z] = params.numbers;
        expect(params.answer).toBe(gcd(gcd(x, y), z));
      } else {
        expect(params.answer).toBe(gcd(params.a!, params.b!));
      }
      if (problem.answer.kind === 'integer') {
        expect(problem.answer.value).toBe(params.answer);
      }
    }
  });

  it('検証を通過する', () => {
    for (let i = 0; i < 100; i++) {
      const problem = generator.generate();
      const result = validateProblem(problem);
      expect(result.valid, result.errors.join(', ')).toBe(true);
    }
  });
});

describe('最小公倍数', () => {
  const generator = new LcmCalculationGenerator();

  it('正しい答えを返す', () => {
    for (let i = 0; i < 100; i++) {
      const problem = generator.generate();
      const { a, b, answer } = problem.parameters as { a: number; b: number; answer: number };
      expect(answer).toBe(lcm(a, b));
      if (problem.answer.kind === 'integer') {
        expect(problem.answer.value).toBe(answer);
      }
    }
  });

  it('検証を通過する', () => {
    for (let i = 0; i < 100; i++) {
      const problem = generator.generate();
      const result = validateProblem(problem);
      expect(result.valid, result.errors.join(', ')).toBe(true);
    }
  });
});

describe('約数・倍数の文章題', () => {
  const generator = new GcdLcmWordGenerator();

  it('正しい答えを返す', () => {
    for (let i = 0; i < 100; i++) {
      const problem = generator.generate();
      const params = problem.parameters as { t: string; a?: number; b?: number; c?: number; d?: number; answer: number };
      if (params.t === 'gcd') {
        expect(params.answer).toBe(gcd(params.a!, params.b!));
      } else if (params.t === 'lcm') {
        expect(params.answer).toBe(lcm(params.a!, params.b!));
      } else {
        expect(params.answer).toBe(lcm(params.c!, params.d!));
      }
      if (problem.answer.kind === 'integer') {
        expect(problem.answer.value).toBe(params.answer);
      }
    }
  });

  it('検証を通過する', () => {
    for (let i = 0; i < 100; i++) {
      const problem = generator.generate();
      const result = validateProblem(problem);
      expect(result.valid, result.errors.join(', ')).toBe(true);
    }
  });
});

describe('周期・繰り返し', () => {
  const generator = new PeriodRepetitionGenerator();

  it('正しい答えを返す', () => {
    for (let i = 0; i < 100; i++) {
      const problem = generator.generate();
      const { pattern, n, answer } = problem.parameters as { pattern: string[]; n: number; answer: string };
      const expected = pattern[(n - 1) % pattern.length];
      expect(answer).toBe(expected);
      if (problem.answer.kind === 'string') {
        expect(problem.answer.value).toBe(answer);
      }
    }
  });

  it('検証を通過する', () => {
    for (let i = 0; i < 100; i++) {
      const problem = generator.generate();
      const result = validateProblem(problem);
      expect(result.valid, result.errors.join(', ')).toBe(true);
    }
  });
});