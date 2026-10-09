/**
 * decimal_place_value の浮動小数点残渣の回帰テスト (H-1)
 *
 * 「10分の1の位が3のとき、小数はいくつですか」の答えは 3 × 0.1。
 * 素の浮動小数点演算では 0.1 * 3 = 0.30000000000000004 になり、
 * その値がそのまま answer.value に入ると
 *   - 解答表示が 0.30000000000000004 になる (小6が書き写せない)
 *   - 解説の数値と正解の数値が別のものになる
 * という問題を起こしていた。
 *
 * 桁数は lv<=2 で第1位、lv>=3 で第2位までなので、答えは必ず小数第2位で終わる。
 * seed 5/7/8 (lv1) で実際に再現していた。
 */
import { describe, expect, it } from 'vitest';
import { DecimalPlaceValueGenerator } from './generators';
import { formatAnswer, checkUserAnswer } from '../../utils/answer';
import { decimalDigits } from '../../quality/quality-rules';
import type { DifficultyLevel } from '../../types/problem';

const LEVELS: DifficultyLevel[] = [1, 2, 3, 4, 5];
const SEEDS = 60;

describe('decimal_place_value: 小数の答えに浮動小数点残渣が出ない', () => {
  const generator = new DecimalPlaceValueGenerator();

  it('再現 seed (lv1 seed5/7/8) で答えが干干净净した小数になる', () => {
    // 修正前は 0.30000000000000004 / 0.6000000000000001 / 0.7000000000000001 だった。
    for (const seed of [5, 7, 8]) {
      const problem = generator.generate({ difficulty: 1, seed });
      if (problem.answer.kind !== 'decimal') continue;
      const shown = String(problem.answer.value);
      expect(shown, `lv1 seed${seed} の答えに残渣が残っている`).toMatch(/^[0-9]+(\.[0-9]{1,2})?$/);
      expect(decimalDigits(problem.answer.value), `lv1 seed${seed}`).toBeLessThanOrEqual(2);
    }
  });

  it('全 lv × 全 seed で答えが小数第2位までに収まる', () => {
    const violations: string[] = [];

    for (const lv of LEVELS) {
      for (let s = 0; s < SEEDS; s++) {
        const problem = generator.generate({ difficulty: lv, seed: s * 101 + lv });
        if (problem.answer.kind !== 'decimal') continue;
        const shown = String(problem.answer.value);
        if (!/^[0-9]+(\.[0-9]{1,2})?$/.test(shown)) {
          violations.push(`lv${lv} seed${s}: ${shown}`);
        }
      }
    }

    expect(
      violations.slice(0, 10).join('\n'),
      `${violations.length} answers contain floating point residue`,
    ).toBe('');
  });

  it('問題文・解説・正解の数値がすべて一致する', () => {
    // place_value 変種は「digit が何個分か」を問うので、
    // 解説中の答えと answer.value が同じ値であるべき。
    const mismatches: string[] = [];

    for (const lv of LEVELS) {
      for (let s = 0; s < SEEDS; s++) {
        const problem = generator.generate({ difficulty: lv, seed: s * 101 + lv });
        if (problem.answer.kind !== 'decimal') continue;
        if (problem.parameters.variant !== 'place_value') continue;

        const shown = formatAnswer(problem.answer);
        const explanation = problem.explanation ?? '';
        if (!explanation.includes(shown)) {
          mismatches.push(
            `lv${lv} seed${s}: explanation does not contain "${shown}" ` +
              `-> ${explanation}`,
          );
        }
      }
    }

    expect(
      mismatches.slice(0, 8).join('\n'),
      `${mismatches.length} explanations disagree with the answer value`,
    ).toBe('');
  });

  it('表示された答えはそのまま入力すれば正解になる', () => {
    // 残渣が残っていても Number() 比較なら判定は通ってしまうため、
    // 「採点が通る」ことではなく「表示が正しい」ことを担保する。
    const rejected: string[] = [];

    for (const lv of LEVELS) {
      for (let s = 0; s < SEEDS; s++) {
        const problem = generator.generate({ difficulty: lv, seed: s * 101 + lv });
        const shown = formatAnswer(problem.answer);
        if (!checkUserAnswer(shown, problem.answer)) {
          rejected.push(`lv${lv} seed${s}: "${shown}" was rejected`);
        }
      }
    }

    expect(rejected.slice(0, 8).join('\n'), `${rejected.length} answers rejected`).toBe('');
  });

  it('丸めしても数学的な答えは変わらない (桁は place にちょうど一致する)', () => {
    // 丸めが近似を混入させていないことの確認。
    // 答えは厳密に digit / 10^place なので、交差積で厳密に比較する。
    const errors: string[] = [];

    for (const lv of LEVELS) {
      for (let s = 0; s < SEEDS; s++) {
        const problem = generator.generate({ difficulty: lv, seed: s * 101 + lv });
        if (problem.parameters.variant !== 'place_value') continue;
        if (problem.answer.kind !== 'decimal') continue;

        const digit = Number(problem.parameters.digit);
        const place = Number(problem.parameters.place);
        // digit * 10^place === value * 10^place を整数で比較する。
        if (Math.round(problem.answer.value * 10 ** place) !== digit) {
          errors.push(
            `lv${lv} seed${s}: digit=${digit} place=${place} value=${problem.answer.value}`,
          );
        }
      }
    }

    expect(errors.slice(0, 8).join('\n'), `${errors.length} values are mathematically wrong`).toBe('');
  });
});