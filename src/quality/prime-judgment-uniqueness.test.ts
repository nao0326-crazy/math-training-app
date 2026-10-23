import { describe, expect, it } from 'vitest';
import { PrimeJudgmentGenerator } from '../problems/numberTheory/generators';

describe('素数判定の選択肢の一意性', () => {
  it('選択肢に素数がちょうど1つだけ含まれ、その素数が正解である', () => {
    const g = new PrimeJudgmentGenerator();
    for (let seed = 0; seed < 100; seed++) {
      for (const lv of [1, 2] as const) {
        const p = g.generate({ difficulty: lv, seed });
        const choices = p.parameters.choices as number[];
        const primes = choices.filter((n) => {
          if (n < 2) return false;
          for (let i = 2; i * i <= n; i++) if (n % i === 0) return false;
          return true;
        });
        expect(primes.length, `seed=${seed} lv=${lv}`).toBe(1);
        expect(String((p.answer as { value: unknown }).value)).toBe(String(primes[0]));
      }
    }
  });
});
