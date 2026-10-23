/** 百分率 (パーセント) の回帰テスト
 *
 * 百分率には 3 つの variant があり、それぞれ「求めるもの」が異なる:
 *   - find_percent: 部分量が全体の何%か → 答え = percent = part÷whole×100
 *   - percent_of:   全体の x% は何ですか → 答え = part = whole×percent÷100
 *   - what_percent: 部分量が全体の何%か → 答え = percent = part÷whole×100
 *
 * これらを独立に検算し、variant ごとに正しい計算式が使われることを保証する。
 */

import { describe, expect, it } from 'vitest';
import { PercentageGenerator } from './generators';
import type { DifficultyLevel } from '../../types/problem';

const LEVELS: DifficultyLevel[] = [1, 2, 3, 4, 5];

describe('PercentageGenerator: what_percent 変種', () => {
  const gen = new PercentageGenerator();

  it('答えは percent = part÷whole×100 (whole×percent÷100 ではない)', () => {
    for (const lv of LEVELS) {
      for (let s = 0; s < 200; s++) {
        const p = gen.generate({ difficulty: lv, seed: s * 7919 + lv * 31 + 7 });
        const params = p.parameters as {
          variant: string;
          percent: number;
          whole: number;
          part: number;
          answer: number;
        };
        if (params.variant !== 'what_percent') continue;
        const want = (params.part / params.whole) * 100;
        expect(Math.abs(params.answer - want)).toBeLessThan(1e-9);
        expect(params.answer).toBe(params.percent);
      }
    }
  });

  it('percent_of 変種では 答え = whole×percent÷100 = part', () => {
    for (const lv of LEVELS) {
      for (let s = 0; s < 200; s++) {
        const p = gen.generate({ difficulty: lv, seed: s * 7919 + lv * 31 + 7 });
        const params = p.parameters as {
          variant: string;
          percent: number;
          whole: number;
          part: number;
          answer: number;
        };
        if (params.variant !== 'percent_of') continue;
        const want = (params.whole * params.percent) / 100;
        expect(Math.abs(params.answer - want)).toBeLessThan(1e-9);
        expect(params.answer).toBe(params.part);
      }
    }
  });

  it('find_percent 変種では 答え = part÷whole×100 = percent', () => {
    for (const lv of LEVELS) {
      for (let s = 0; s < 200; s++) {
        const p = gen.generate({ difficulty: lv, seed: s * 7919 + lv * 31 + 7 });
        const params = p.parameters as {
          variant: string;
          percent: number;
          whole: number;
          part: number;
          answer: number;
        };
        if (params.variant !== 'find_percent') continue;
        const want = (params.part / params.whole) * 100;
        expect(Math.abs(params.answer - want)).toBeLessThan(1e-9);
        expect(params.answer).toBe(params.percent);
      }
    }
  });

  it('全レベルでバリアントが偏らず生成される', () => {
    const counts: Record<string, number> = {};
    for (const lv of LEVELS) {
      for (let s = 0; s < 200; s++) {
        const p = gen.generate({ difficulty: lv, seed: s * 7919 + lv * 31 + 7 });
        const params = p.parameters as { variant: string };
        counts[params.variant] = (counts[params.variant] ?? 0) + 1;
      }
    }
    // 各バリアントが少なくとも1回は生成される
    expect(counts.find_percent ?? 0).toBeGreaterThan(0);
    expect(counts.percent_of ?? 0).toBeGreaterThan(0);
    expect(counts.what_percent ?? 0).toBeGreaterThan(0);
  });
});
