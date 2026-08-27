/**
 * 文字と式ジェネレータの整合性テスト
 *
 * 「問題生成 → 正解データ → 正誤判定」が矛盾しないことを、
 * 固定シードを使った決定論的なケースで検証する。
 * - 問題文・正解・解説 (途中式) が常に一致すること
 * - ユーザーが式を入力する際、× と x の表記揺れ (×・*・＊・全角) が
 *   等価として正誤判定されること
 */

import { describe, expect, it } from 'vitest';
import {
  ExpressionMakeGenerator,
  ExpressionWordToExpressionGenerator,
  ExpressionSubstitutionGenerator,
  ExpressionBlankGenerator,
  ExpressionComplexGenerator,
} from './generators';
import { validateProblem } from '../../engine/validator/validator';
import { checkUserAnswer } from '../../utils/answer';

/**
 * 全ジェネレータを固定シードで複数回生成し、
 * ①検証を通過 ②正解が問題文と一貫している ことを確認する
 */
describe('文字と式: 固定シードでの問題生成→正解整合性', () => {
  const generators = [
    new ExpressionMakeGenerator(),
    new ExpressionWordToExpressionGenerator(),
    new ExpressionSubstitutionGenerator(),
    new ExpressionBlankGenerator(),
    new ExpressionComplexGenerator(),
  ];

  it('複数の固定シードで生成したすべての問題が検証を通過する', () => {
    for (const gen of generators) {
      for (const seed of [1, 7, 42, 2024]) {
        const problem = gen.generate({ seed, difficulty: 3 });
        const result = validateProblem(problem);
        expect(result.errors, `${gen.type} seed=${seed}`).toEqual([]);
      }
    }
  });

  it('式で答える問題は、× と x の表記揺れを等価として正誤判定できる', () => {
    // "1本x円のえんぴつを ✕✕ 本買ったときの代金を x を使った式で表しなさい"
    const gen = new ExpressionMakeGenerator();
    const problem = gen.generate({ seed: 5, difficulty: 2 });
    if (problem.answer.kind !== 'string') throw new Error('answer が string でない');

    const answer = problem.answer.value; // 例: "5x"
    // 正解そのもの
    expect(checkUserAnswer(answer, problem.answer)).toBe(true);
    // × や * 、全角で書いても正解
    const withMul = answer.replace(/x$/, '×x');
    expect(checkUserAnswer(withMul, problem.answer)).toBe(true);
    // 係数を変えたら不正解
    const wrong = answer.replace(/^\d+/, (d) => String(Number(d) + 1));
    expect(checkUserAnswer(wrong, problem.answer)).toBe(false);
  });

  it('「文章を式にする」は price×x を正解とし、xを使った変形も許容する', () => {
    const gen = new ExpressionWordToExpressionGenerator();
    const problem = gen.generate({ seed: 11, difficulty: 2 });
    if (problem.answer.kind !== 'string') throw new Error('answer が string でない');
    expect(problem.answer.value).toMatch(/×x$/);
    expect(Number.isNaN(parseInt(problem.answer.value, 10))).toBe(false);
    expect(checkUserAnswer(problem.answer.value, problem.answer)).toBe(true);
    // ×x と x は等価 (e.g. 5×x と 5x)
    const compact = problem.answer.value.replace('×x', 'x');
    expect(checkUserAnswer(compact, problem.answer)).toBe(true);
  });

  it('代入・穴埋め・複合条件は整数の正誤判定で一貫する', () => {
    const substitution = new ExpressionSubstitutionGenerator().generate({ seed: 3, difficulty: 2 });
    if (substitution.answer.kind !== 'integer') throw new Error('answer が integer でない');
    expect(checkUserAnswer(String(substitution.answer.value), substitution.answer)).toBe(true);
    expect(checkUserAnswer(String(substitution.answer.value + 1), substitution.answer)).toBe(false);

    const blank = new ExpressionBlankGenerator().generate({ seed: 4, difficulty: 2 });
    if (blank.answer.kind !== 'integer') throw new Error('answer が integer でない');
    expect(checkUserAnswer(String(blank.answer.value), blank.answer)).toBe(true);
    expect(checkUserAnswer(String(blank.answer.value + 1), blank.answer)).toBe(false);

    const complex = new ExpressionComplexGenerator().generate({ seed: 9, difficulty: 2 });
    if (complex.answer.kind !== 'integer') throw new Error('answer が integer でない');
    expect(checkUserAnswer(String(complex.answer.value), complex.answer)).toBe(true);
    expect(checkUserAnswer(String(complex.answer.value + 1), complex.answer)).toBe(false);
  });
});
