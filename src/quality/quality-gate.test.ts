/**
 * quality-gate.test.ts - problem quality gate (Phase 1-A)
 *
 * These tests FAIL when a quality rule is violated; they are not log-only.
 *
 * Policy: when a violation comes from a deliberate design choice, the affected
 * type is listed in an explicit allowlist instead of loosening the threshold,
 * so the known limitation stays visible and greppable for Phase 2.
 */

import { describe, expect, it } from 'vitest';
import {
  generateProblem,
  getAllGenerators,
  getGeneratorByType,
} from '../engine/selector/generatorRegistry';
import { formatAnswer, checkUserAnswer } from '../utils/answer';
import type { DifficultyLevel, Problem } from '../types/problem';
import { decimalDigits, isDegenerateZeroAnswer, varietyRatio } from './quality-rules';

const DIFFICULTIES: DifficultyLevel[] = [1, 2, 3, 4, 5];
const SEEDS = 24;

/** Generate a problem, or null when the generator throws for this (level, seed). */
function tryGenerate(
  type: string,
  difficulty: DifficultyLevel,
  seed: number,
): Problem | null {
  const g = getGeneratorByType(type);
  if (!g) return null;
  try {
    return g.generate({ difficulty, seed });
  } catch {
    return null;
  }
}

/** Generators that must only ever produce a terminating decimal answer. */
const DECIMAL_QUALITY_TARGETS = [
  'speed_calculation',
  'speed_unit_conversion',
  'speed_multi_step',
  'circle_area_radius',
  'circle_area_diameter',
  'volume_cylinder',
  'ratio_value',
  'decimal_mul_decimal',
  'decimal_mul_integer',
  'data_average',
];

/**
 * Types where an integer answer of 0 is pedagogically intended.
 * Phase 1-B found none; add entries here if such a problem is designed later.
 */
const ZERO_IS_LEGITIMATE_TYPES = new Set<string>();

describe('decimal answer quality', () => {
  it('every target generator only produces terminating decimals (max 2 decimal digits)', () => {
    const violations: string[] = [];

    for (const type of DECIMAL_QUALITY_TARGETS) {
      expect(getGeneratorByType(type), `${type} is not registered`).toBeDefined();

      for (const difficulty of DIFFICULTIES) {
        for (let s = 0; s < SEEDS; s++) {
          const problem = tryGenerate(type, difficulty, s * 7919 + difficulty);
          if (!problem || problem.answer.kind !== 'decimal') continue;

          const digits = decimalDigits(problem.answer.value);
          if (digits > 2) {
            violations.push(
              `${type} lv${difficulty} seed${s}: answer=${formatAnswer(problem.answer)} ` +
                `(${digits} digits) Q="${problem.question}"`,
            );
          }
        }
      }
    }

    const detail =
      violations.slice(0, 12).join('\n') +
      (violations.length > 12 ? `\n... and ${violations.length - 12} more` : '');
    expect(detail, `${violations.length} non-terminating decimal answers`).toBe('');
  });

  it('for every generator the displayed answer is accepted when typed back', () => {
    const mismatches: string[] = [];

    for (const g of getAllGenerators()) {
      for (const difficulty of DIFFICULTIES) {
        for (let s = 0; s < SEEDS; s++) {
          const problem = tryGenerate(g.type, difficulty, s * 6151 + difficulty);
          if (!problem) continue;
          const shown = formatAnswer(problem.answer);
          if (!checkUserAnswer(shown, problem.answer)) {
            mismatches.push(
              `${g.type} lv${difficulty}: displayed "${shown}" judged wrong ` +
                `(answer=${JSON.stringify(problem.answer)})`,
            );
          }
        }
      }
    }

    expect(
      mismatches.slice(0, 10).join('\n'),
      `${mismatches.length} displayed answers are rejected by the judge`,
    ).toBe('');
  });
});

describe('degenerate zero answers', () => {
  it('integer_subtraction never produces an answer of 0', () => {
    const violations: string[] = [];

    for (const difficulty of DIFFICULTIES) {
      for (let s = 0; s < 60; s++) {
        const problem = tryGenerate('integer_subtraction', difficulty, s * 31 + difficulty);
        if (!problem || problem.answer.kind !== 'integer') continue;
        const { a, b } = problem.parameters as { a: number; b: number };
        if (problem.answer.value === 0) {
          violations.push(`lv${difficulty} seed${s}: ${a} - ${b} = 0  "${problem.question}"`);
        }
      }
    }

    expect(
      violations.slice(0, 10).join('\n'),
      `${violations.length} subtraction problems with answer 0 (a == b is not valid practice)`,
    ).toBe('');
  });

  it('no generator produces an integer answer of 0 unless allowlisted', () => {
    const violations: string[] = [];

    for (const g of getAllGenerators()) {
      if (ZERO_IS_LEGITIMATE_TYPES.has(g.type)) continue;
      for (const difficulty of DIFFICULTIES) {
        for (let s = 0; s < SEEDS; s++) {
          const problem = tryGenerate(g.type, difficulty, s * 104729 + difficulty);
          if (!problem || !isDegenerateZeroAnswer(problem)) continue;
          violations.push(
            `${g.type} lv${difficulty} seed${s}: "${problem.question}" ` +
              `(params=${JSON.stringify(problem.parameters)})`,
          );
        }
      }
    }

    const detail =
      violations.slice(0, 12).join('\n') +
      (violations.length > 12 ? `\n... and ${violations.length - 12} more` : '');
    expect(detail, `${violations.length} degenerate problems with answer 0`).toBe('');
  });
});

describe('problem variety (Phase 2 scope: detection only)', () => {
  /**
   * Generators measured below the 25% distinct-question floor today
   * (lv1-5 x 20 seeds = 100 samples per generator).
   *
   * Phase 1 does NOT expand variety (explicitly out of scope), so these are
   * recorded as a measured baseline. The assertion is a REGRESSION guard: no
   * NEW generator may fall below the floor, and Phase 2 removes entries from
   * this list as generators are improved (the message names stale entries).
   */
  const BASELINE_BELOW_FLOOR = new Set<string>([
    'circle_radius_from_area', // 19/100
    'combine_simple',   // 20/100
    'common_multiples', // 22/100
    'duplicate_removal', // 15/100
    'lcm_calculation',  // 15/100
    'multiples_finding', // 22/100
    'speed_unit_conversion', // 15/100
    'symmetry_fold',    //   8/100
    'symmetry_point',   //   7/100
    'volume_cube',      // 19/100
    // judge_same (4/100): 問題文 variety が構造的に低い。
    // 「図Aと図Bは合同か」を問う2図比較型のため、問題文が本質的に固定式になる
    // (中立的な言い回し4種しか作れない)。数学的な diversity は figure 側にあり、
    // 同じ lv でも 図A の形・回転角・平行移動量が毎回変わる。
    // 問題文に回転角を出すと合同変換であることが答え洩れするため出せない。
    // 値を水増ししただけの空虚な diversity は作らない。
    'judge_same',
    // judge_differs (15/80 = 18.8%, 基準 25%): Phase 2 で実測して登録。
    //
    //   実測: lv2〜5 x 20 seeds = 80 サンプル中 distinct 15 = 18.8%。
    //         (lv1 は supportedLevels 宣言により生成不可 = 0 サンプル)
    //   内訳: 問題文は「図A の三角形分類 (3種) x 言い回し (8種)」で上限 15。
    //
    //   基準未達の理由 (構造的制約):
    //     judge_same と同じ「2つの図形が合同かどうか」を問う比較型であり、
    //     問題文が本質的に固定式になる。答えを洩らさない範囲的多様化は
    //     図A の分類と言い回しの組み合わせに限られ，上面の 15 が上限。
    //     実際の数学的な diversity は figure 側にあり、同じ lv でも
    //     図A の形・変形の種別 (scaled / apex_moved / base_widened)・
    //     平行移動量が毎回異なる。
    //
    //   採用しなかった案と理由:
    //     - 問題文に回転角・変形の種別を入れる案:
    //       合同変換であることが一目で伝わり、答えが自明になるため却下。
    //       (judge_same と同様の理由で出せない)
    //     - 問題文に辺長や「どの辺を比べるか」を入れる案:
    //       辺の不一致そのものが答えの手がかりになり、不自然でもあったため却下。
    //     - 閾値の引下げ / 判定ロジックの変更: このランキングの趣旨に反するため不可。
    //
    //   値を水増ししただけの空虚な diversity は作らない方針を維持する。
    //   Phase 2 で問題型の設計自体が変わった場合に再計測し、
    //   25% 以上になったらこのエントリを外すこと。
    'judge_differs',
  ]);
  // Phase 2-A で 25% 以上の閾値をクリアしてリストから外れた型:
  //   - combine_table: 6/100 -> 25/100 (4 種類の試合条件を追加)
  //   - arrange_tree : 4/100 -> 25/100 (5 種類の並べ方条件を追加)
  // Phase 2-B で 25% 以上の閾値をクリアしてリストから外れた型:
  //   - arrange_simple: 24/100 -> 41/100 (5 種類の選び方を追加)
  //     同じ測定条件 (lv1-5 x 20 seeds, seed = s*104729 + lv) で計測した。
  //     数学的条件は 1 種類 -> 5 種類、解法パターンも 1 -> 5 に増えた。

  it('no NEW generator falls below the variety floor (baseline shrinks over time)', () => {
    const below: string[] = [];

    for (const g of getAllGenerators()) {
      const questions = new Set<string>();
      let total = 0;
      for (const difficulty of DIFFICULTIES) {
        for (let s = 0; s < 20; s++) {
          const problem = tryGenerate(g.type, difficulty, s * 104729 + difficulty);
          if (!problem) continue;
          questions.add(problem.question);
          total++;
        }
      }
      if (total === 0) continue;

      const ratio = varietyRatio(questions, total);
      if (ratio < 0.25) {
        below.push(`${g.type}: ${questions.size}/${total} distinct = ${(ratio * 100).toFixed(0)}%`);
      }
    }

    const actual = new Set(below.map((line) => line.split(':')[0]));
    const unexpected = [...actual].filter((t) => !BASELINE_BELOW_FLOOR.has(t));
    const stale = [...BASELINE_BELOW_FLOOR].filter((t) => !actual.has(t));

    expect(
      unexpected.join('\n'),
      `NEW generators fell below the variety floor. Measured below floor: ` +
        `${[...actual].join(', ')}. Remove stale baseline entries (already fixed): ` +
        `${stale.join(', ') || '(none)'}`,
    ).toBe('');
  });
});

describe('requested difficulty is honoured', () => {
  it('generateProblem({difficulty}) always returns exactly that difficulty level', () => {
    const mismatches: string[] = [];

    for (const difficulty of DIFFICULTIES) {
      for (let s = 0; s < 30; s++) {
        const problem = generateProblem({ difficulty, seed: s * 65537 + difficulty });
        if (problem.difficulty.level !== difficulty) {
          mismatches.push(
            `requested lv${difficulty} but got lv${problem.difficulty.level} (${problem.type})`,
          );
        }
      }
    }

    expect(
      mismatches.slice(0, 10).join('\n'),
      `${mismatches.length} problems did not match the requested difficulty`,
    ).toBe('');
  });

  it('a generator asked for a difficulty it cannot build never substitutes another', () => {
    // The registry filters candidates on this contract, so a generator that cannot
    // honour a level must not silently emit a different one.
    //
    // Phase 1 does NOT restructure the difficulty model (out of scope), so pairs
    // measured to ignore the request are baselined. This guards against NEW
    // (generator, difficulty) pairs appearing after the Phase 1-B/1-C changes.
    const BASELINE_MISMATCH = new Set<string>([
      'angle_basic:1', 'angle_basic:2',
      'circle_area_diameter:1', 'circle_area_radius:1',
      'circle_radius_from_area:1', 'circle_radius_from_area:2',
      'common_divisors:1', 'common_multiples:1',
      'data_average:1', 'data_compare:1', 'data_total_from_average:1',
      'distance_calculation:1', 'distance_calculation:2',
      'divisors_count:1', 'divisors_finding:1',
      'expression_blank:1', 'expression_make:1', 'expression_meaning:1',
      'expression_multi_condition:1', 'expression_multi_condition:2',
      'expression_substitution:1', 'expression_word_make:1',
      'fraction_big_small:1', 'fraction_common_denominator:1',
      'fraction_div_fraction:1', 'fraction_mixed_convert:1', 'fraction_mul_mixed:1',
      'gcd_calculation:1', 'gcd_lcm_word:1', 'gcd_lcm_word:2',
      'integer_division:2', 'integer_fill_blank:1', 'integer_word_problem:1',
      'inverse_expression:1', 'inverse_word:1', 'inverse_word:2',
      'lcm_calculation:1',
      'period_repetition:1', 'period_repetition:2',
      'prime_judgment:1', 'prime_judgment:2', 'prime_range:1',
      'proportional_expression:1', 'proportional_word:1',
      'ratio_equal:1', 'ratio_quantity:1', 'ratio_simplify:1',
      'scale_length:1',
      'speed_calculation:2', 'speed_comparison:1',
      'speed_multi_step:1', 'speed_multi_step:2',
      'speed_unit_conversion:1', 'speed_unit_conversion:2',
      'speed_word:1', 'speed_word:2',
      'symmetry_fold:1', 'symmetry_point:1',
      'time_calculation:1',
      'volume_cylinder:1', 'volume_cylinder:2', 'volume_from_height:1', 'volume_prism:1',
    ]);

    const mismatches = new Set<string>();
    for (const g of getAllGenerators()) {
      for (const difficulty of DIFFICULTIES) {
        for (let s = 0; s < 12; s++) {
          const problem = tryGenerate(g.type, difficulty, s * 15485863 + difficulty);
          if (!problem || problem.difficulty.level === difficulty) continue;
          mismatches.add(`${g.type}:${difficulty}`);
        }
      }
    }

    // Baseline entries are prefixes for whole families (e.g. `ratio_*:1`).
    const isBaselined = (key: string): boolean => {
      if (BASELINE_MISMATCH.has(key)) return true;
      const [type, lv] = key.split(':');
      return BASELINE_MISMATCH.has(`${type}:*`) || BASELINE_MISMATCH.has(`*:${lv}`);
    };

    const unexpected = [...mismatches].filter((k) => !isBaselined(k)).sort();
    expect(
      unexpected.join('\n'),
      `${unexpected.length} NEW (generator, difficulty) pairs ignore the requested level`,
    ).toBe('');
  });
});
