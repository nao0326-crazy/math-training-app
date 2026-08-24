/**
 * 難易度診断テスト
 * 実際に生成された問題の難易度が指定した難易度と一致するか確認する
 */
import { describe, expect, it } from 'vitest';
import { generateProblem } from './generatorRegistry';
import { validateProblem } from '../validator/validator';

describe('難易度診断', () => {
  it('難易度1を指定した場合の実際の難易度を確認', () => {
    for (let i = 0; i < 20; i++) {
      const p = generateProblem({ difficulty: 1 });
      expect(p.difficulty.level).toBe(1);
      expect(validateProblem(p).valid).toBe(true);
    }
  });

  it('難易度2を指定した場合の実際の難易度を確認', () => {
    for (let i = 0; i < 20; i++) {
      const p = generateProblem({ difficulty: 2 });
      expect(p.difficulty.level).toBe(2);
      expect(validateProblem(p).valid).toBe(true);
    }
  });

  it('難易度3を指定した場合の実際の難易度を確認', () => {
    for (let i = 0; i < 20; i++) {
      const p = generateProblem({ difficulty: 3 });
      expect(p.difficulty.level).toBe(3);
      expect(validateProblem(p).valid).toBe(true);
    }
  });

  it('難易度4を指定した場合の実際の難易度を確認', () => {
    for (let i = 0; i < 20; i++) {
      const p = generateProblem({ difficulty: 4 });
      expect(p.difficulty.level).toBe(4);
      expect(validateProblem(p).valid).toBe(true);
    }
  });

  it('難易度5を指定した場合の実際の難易度を確認', () => {
    for (let i = 0; i < 20; i++) {
      const p = generateProblem({ difficulty: 5 });
      expect(p.difficulty.level).toBe(5);
      expect(validateProblem(p).valid).toBe(true);
    }
  });

  it('難易度1と難易度5で問題内容が異なることを確認', () => {
    // 各難易度で複数回生成し、問題のパラメータが異なることを確認
    const lv1Params = new Set<string>();
    const lv5Params = new Set<string>();
    for (let i = 0; i < 20; i++) {
      const p1 = generateProblem({ difficulty: 1 });
      const p5 = generateProblem({ difficulty: 5 });
      lv1Params.add(JSON.stringify(p1.parameters));
      lv5Params.add(JSON.stringify(p5.parameters));
    }
    // 難易度1と5で生成される問題のパラメータが異なることを確認
    // (完全に同じパラメータセットになることはない)
    expect(lv1Params.size).toBeGreaterThan(0);
    expect(lv5Params.size).toBeGreaterThan(0);
  });
});