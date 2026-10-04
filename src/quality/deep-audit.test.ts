/**
 * 重点監査テスト
 */

import { describe, expect, it } from 'vitest';
import { SpeedWordGenerator } from '../problems/speed/generators';
import { DecimalDivDecimalGenerator } from '../problems/decimal/generators';
import { FractionBigSmallGenerator } from '../problems/fraction/generators';
import { RatioSimplifyGenerator } from '../problems/ratio/generators';
import type { Problem } from '../types/problem';
import { evaluateProblem } from './deep-audit-helpers';

describe('重点監査', () => {
  describe('SpeedWordGenerator', () => {
    const generator = new SpeedWordGenerator();

    it('レベル5の問題を生成して確認', () => {
      const problems: Problem[] = [];
      for (let seed = 0; seed < 20; seed++) {
        try {
          const problem = generator.generate({ difficulty: 5, seed });
          problems.push(problem);
        } catch (e) {
          // 生成失敗はスキップ
        }
      }

      console.log('\n===== SpeedWordGenerator レベル5 =====');
      for (const problem of problems.slice(0, 5)) {
        const { issues, examples } = evaluateProblem(problem);
        console.log('\n--- 問題 ---');
        for (const line of examples) {
          console.log(line);
        }
        if (issues.length > 0) {
          console.log(`問題点: ${issues.join(', ')}`);
        }
      }

      const hasHaisoku = problems.some((p) => p.question.includes('倍速'));
      expect(hasHaisoku).toBe(false);
    });
  });

  describe('DecimalDivDecimalGenerator', () => {
    const generator = new DecimalDivDecimalGenerator();

    it('問題を生成して丸め指示を確認', () => {
      const problems: Problem[] = [];
      for (let seed = 0; seed < 50; seed++) {
        for (let lv = 1; lv <= 5; lv++) {
          try {
            const problem = generator.generate({ difficulty: lv as 1 | 2 | 3 | 4 | 5, seed });
            problems.push(problem);
          } catch (e) {
            // 生成失敗はスキップ
          }
        }
      }

      console.log('\n===== DecimalDivDecimalGenerator =====');
      for (const problem of problems.slice(0, 10)) {
        const { issues, examples } = evaluateProblem(problem);
        console.log('\n--- 問題 ---');
        for (const line of examples) {
          console.log(line);
        }
        if (issues.length > 0) {
          console.log(`問題点: ${issues.join(', ')}`);
        }
      }

      const problemsWithoutRounding = problems.filter(
        (p) => !p.question.includes('四捨五入') && !p.question.includes('丸め')
      );

      const hasNonTerminating = problems.some((p) => {
        if (p.answer.kind === 'decimal') {
          const answerStr = String(p.answer.value);
          return answerStr.length > 4;
        }
        return false;
      });

      if (hasNonTerminating && problemsWithoutRounding.length > 0) {
        console.log(`\n警告: 割り切れない問題のうち、丸め指示がない問題が ${problemsWithoutRounding.length} 件あります`);
      }
    });
  });

  describe('FractionBigSmallGenerator', () => {
    const generator = new FractionBigSmallGenerator();

    it('問題を生成して約分の一貫性を確認', () => {
      const problems: Problem[] = [];
      for (let seed = 0; seed < 100; seed++) {
        for (let lv = 1; lv <= 5; lv++) {
          try {
            const problem = generator.generate({ difficulty: lv as 1 | 2 | 3 | 4 | 5, seed });
            problems.push(problem);
          } catch (e) {
            // 生成失敗はスキップ
          }
        }
      }

      console.log('\n===== FractionBigSmallGenerator =====');
      for (const problem of problems.slice(0, 10)) {
        const { issues, examples } = evaluateProblem(problem);
        console.log('\n--- 問題 ---');
        for (const line of examples) {
          console.log(line);
        }
        if (issues.length > 0) {
          console.log(`問題点: ${issues.join(', ')}`);
        }
      }

      for (const problem of problems) {
        const questionText = problem.question;
        const answerText = problem.answer.kind === 'string' ? problem.answer.value : '';

        const fractionPattern = /(\d+)分の(\d+)/g;
        const questionFractions: string[] = [];
        let match;
        while ((match = fractionPattern.exec(questionText)) !== null) {
          questionFractions.push(`${match[1]}分の${match[2]}`);
        }

        if (questionFractions.length > 0 && answerText) {
          const answerFraction = answerText;
          const isInQuestion = questionFractions.some((f) => f === answerFraction);

          if (!isInQuestion) {
            console.log('\n潜在的な問題:');
            console.log(`問題文: ${questionText}`);
            console.log(`正解: ${answerFraction}`);
            console.log(`問題文の分数: ${questionFractions.join(', ')}`);
          }
        }
      }
    });
  });

  describe('RatioSimplifyGenerator', () => {
    const generator = new RatioSimplifyGenerator();

    it('問題を生成して既約比でないことを確認', () => {
      const problems: Problem[] = [];
      for (let seed = 0; seed < 100; seed++) {
        for (let lv = 1; lv <= 5; lv++) {
          try {
            const problem = generator.generate({ difficulty: lv as 1 | 2 | 3 | 4 | 5, seed });
            problems.push(problem);
          } catch (e) {
            // 生成失敗はスキップ
          }
        }
      }

      console.log('\n===== RatioSimplifyGenerator =====');
      for (const problem of problems.slice(0, 10)) {
        const { issues, examples } = evaluateProblem(problem);
        console.log('\n--- 問題 ---');
        for (const line of examples) {
          console.log(line);
        }
        if (issues.length > 0) {
          console.log(`問題点: ${issues.join(', ')}`);
        }
      }

      const allSimplifiable = problems.every((p) => {
        const params = p.parameters as { gcd: number };
        return params.gcd > 1;
      });

      console.log(`\nすべての問題が簡単化できる: ${allSimplifiable}`);
      console.log(`生成された問題数: ${problems.length}`);
    });
  });
});
