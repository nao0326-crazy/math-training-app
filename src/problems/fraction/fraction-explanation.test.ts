/**
 * 分数の答えと解説の整合性の回帰テスト (M-1 精査)
 *
 * 監査では「解説に正解の文字列が含まれない」と報告されたが、
 * 表記揺れ (日本語の帯分数「10と3分の2」と formatAnswer の「10と2/3」) を
 * 区別せずに判定していたための誤検知だった。実測では 6 形式 x 100 問すべてで
 * 解説が数学的に正しい答えを示している。
 *
 * ただし「文字列一致」だけの判定は誤検知も真の欠陥も検出できないため、
 * ここでは表記揺れを明示的に許容した判定を行う。
 */
import { describe, expect, it } from 'vitest';
import {
  FractionMulIntegerGenerator,
  FractionMulFractionGenerator,
  FractionDivIntegerGenerator,
  FractionDivFractionGenerator,
  FractionMulMixedGenerator,
  FractionMixedDivGenerator,
} from './generators';
import { formatAnswer } from '../../utils/answer';
import type { Answer, DifficultyLevel, Problem } from '../../types/problem';

const LEVELS: DifficultyLevel[] = [1, 2, 3, 4, 5];
const SEEDS = 20;

/**
 * 解説が答えを数学的に含意しているか。
 * 帯分数と仮分数の相互表記、日本語分数表記をすべて受理する。
 */
function explanationImpliesAnswer(explanation: string, answer: Answer): boolean {
  if (explanation.includes(formatAnswer(answer))) return true;

  if (answer.kind === 'mixed') {
    // 日本語の帯分数: 「10と3分の2」
    if (explanation.includes(`${answer.whole}と${answer.denominator}分の${answer.numerator}`)) {
      return true;
    }
    // 仮分数: 「32/3」または「3分の32」
    const improper = answer.whole * answer.denominator + answer.numerator;
    if (explanation.includes(`${improper}/${answer.denominator}`)) return true;
    if (explanation.includes(`${answer.denominator}分の${improper}`)) return true;
  }

  if (answer.kind === 'fraction') {
    if (explanation.includes(`${answer.numerator}/${answer.denominator}`)) return true;
    if (explanation.includes(`${answer.denominator}分の${answer.numerator}`)) return true;
  }

  if (answer.kind === 'integer' && explanation.includes(String(answer.value))) return true;
  if (answer.kind === 'decimal' && explanation.includes(String(answer.value))) return true;
  if (answer.kind === 'string' && explanation.includes(answer.value)) return true;

  return false;
}

/** exact = 表示正解と完全一致 / equivalent = 表記は違うが同値 / absent = 不明 */
function classify(problem: Problem): 'exact' | 'equivalent' | 'absent' {
  const explanation = String(problem.explanation);
  if (explanation.includes(formatAnswer(problem.answer))) return 'exact';
  if (explanationImpliesAnswer(explanation, problem.answer)) return 'equivalent';
  return 'absent';
}

const GENERATORS = [
  new FractionMulIntegerGenerator(),
  new FractionMulFractionGenerator(),
  new FractionDivIntegerGenerator(),
  new FractionDivFractionGenerator(),
  new FractionMulMixedGenerator(),
  new FractionMixedDivGenerator(),
];

describe('fraction 乘除6形式: 解説が正解を示す', () => {
  it('全形式・全難易度で、解説が正解を数学的に正しく示している', () => {
    const failures: string[] = [];
    const stats: Record<string, number> = { exact: 0, equivalent: 0, absent: 0 };

    for (const g of GENERATORS) {
      for (const lv of LEVELS) {
        for (let s = 0; s < SEEDS; s++) {
          const problem = g.generate({ difficulty: lv, seed: s * 331 + lv });
          const verdict = classify(problem);
          stats[verdict] = (stats[verdict] ?? 0) + 1;
          if (verdict === 'absent') {
            failures.push(
              `${g.type} lv${lv} seed${s}: answer=${formatAnswer(problem.answer)} ` +
                `explanation="${problem.explanation}"`,
            );
          }
        }
      }
    }

    expect(
      failures.slice(0, 8).join('\n'),
      `${failures.length} explanations omit the answer ` +
        `(exact=${stats.exact}, equivalent=${stats.equivalent}, absent=${stats.absent})`,
    ).toBe('');
  });

  it('帯分数の答えでは、日本語表記と仮分数表記のどちらでも導ける', () => {
    // 監査で指摘された帯分数の表記揺れが「導ける」ことを固定する。
    const failures: string[] = [];

    for (const g of GENERATORS) {
      for (const lv of LEVELS) {
        for (let s = 0; s < SEEDS; s++) {
          const problem = g.generate({ difficulty: lv, seed: s * 331 + lv });
          if (problem.answer.kind !== 'mixed') continue;

          const { whole, numerator, denominator } = problem.answer;
          const improper = whole * denominator + numerator;
          const explanation = String(problem.explanation);
          const viaJapanese = explanation.includes(`${whole}と${denominator}分の${numerator}`);
          const viaImproper =
            explanation.includes(`${improper}/${denominator}`) ||
            explanation.includes(`${denominator}分の${improper}`);

          if (!viaJapanese && !viaImproper) {
            failures.push(
              `${g.type} lv${lv} seed${s}: mixed=${whole}|${numerator}/${denominator} ` +
                `explanation="${explanation}"`,
            );
          }
        }
      }
    }

    expect(
      failures.slice(0, 8).join('\n'),
      `${failures.length} mixed answers are not derivable from the explanation`,
    ).toBe('');
  });

  it('解説は空文字列でない (全形式・全難易度)', () => {
    const empties: string[] = [];

    for (const g of GENERATORS) {
      for (const lv of LEVELS) {
        for (let s = 0; s < SEEDS; s++) {
          const problem = g.generate({ difficulty: lv, seed: s * 331 + lv });
          if (!problem.explanation || problem.explanation.trim() === '') {
            empties.push(`${g.type} lv${lv} seed${s}`);
          }
        }
      }
    }

    expect(empties.slice(0, 8).join('\n'), `${empties.length} empty explanations`).toBe('');
  });

  it('判定ヘルパーは「正解を含まない解説」を確実に欠陥として検出する', () => {
    // 誤検知修正の回帰。表記揺れは受理しつつ、
    // 不正解しか含まれない文字列や過程のみの文字列は受理しないことを確認する。
    const answer: Answer = { kind: 'mixed', whole: 10, numerator: 2, denominator: 3 };
    expect(explanationImpliesAnswer('答えは 32/3 です。', answer)).toBe(true);
    expect(explanationImpliesAnswer('答えは 10と3分の2 です。', answer)).toBe(true);
    expect(explanationImpliesAnswer('3分の32 です。', answer)).toBe(true);
    expect(explanationImpliesAnswer('答えは 1/3 です。', answer)).toBe(false);
    expect(explanationImpliesAnswer('計算したらこうなりました。', answer)).toBe(false);
  });
});