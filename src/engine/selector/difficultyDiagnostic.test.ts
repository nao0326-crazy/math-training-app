/**
 * 難易度診断テスト
 * 実際に生成された問題の難易度が指定した難易度と一致するか確認する
 */
import { describe, it } from 'vitest';
import { generateProblem } from './generatorRegistry';

describe('難易度診断', () => {
  it('難易度1を指定した場合の実際の難易度を確認', () => {
    for (let i = 0; i < 50; i++) {
      const p = generateProblem({ difficulty: 1 });
      console.log(
        `[L1] ${p.type} | actual=${p.difficulty.level} | calc=${p.difficulty.components.calculationComplexity} num=${p.difficulty.components.numberComplexity} reasoning=${p.difficulty.components.reasoningComplexity} reading=${p.difficulty.components.readingComplexity} | ${p.question}`,
      );
    }
  });

  it('難易度2を指定した場合の実際の難易度を確認', () => {
    for (let i = 0; i < 50; i++) {
      const p = generateProblem({ difficulty: 2 });
      console.log(
        `[L2] ${p.type} | actual=${p.difficulty.level} | calc=${p.difficulty.components.calculationComplexity} num=${p.difficulty.components.numberComplexity} reasoning=${p.difficulty.components.reasoningComplexity} reading=${p.difficulty.components.readingComplexity} | ${p.question}`,
      );
    }
  });

  it('難易度4を指定した場合の実際の難易度を確認', () => {
    for (let i = 0; i < 50; i++) {
      const p = generateProblem({ difficulty: 4 });
      console.log(
        `[L4] ${p.type} | actual=${p.difficulty.level} | calc=${p.difficulty.components.calculationComplexity} num=${p.difficulty.components.numberComplexity} reasoning=${p.difficulty.components.reasoningComplexity} reading=${p.difficulty.components.readingComplexity} | ${p.question}`,
      );
    }
  });

  it('難易度5を指定した場合の実際の難易度を確認', () => {
    for (let i = 0; i < 50; i++) {
      const p = generateProblem({ difficulty: 5 });
      console.log(
        `[L5] ${p.type} | actual=${p.difficulty.level} | calc=${p.difficulty.components.calculationComplexity} num=${p.difficulty.components.numberComplexity} reasoning=${p.difficulty.components.reasoningComplexity} reading=${p.difficulty.components.readingComplexity} | ${p.question}`,
      );
    }
  });
});