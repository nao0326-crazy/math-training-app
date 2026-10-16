// realWorld/eggs.test.ts — 現実連動教材 (卵の数を読み取る) の検査
//
// 目的:
//   - 写真に写る卵の個数 (合わせて2個・茶色1・白1) と問題文・正解・解説が一致すること
//   - 全難易度 (1〜5) で有効な問題が生成され、検証 (validateProblem) を通過すること
//   - 正解が一意に定まること (整数解答・余りの出ない割り算)
//   - 画像 (ImageSpec) が付与され、代替テキスト・出典 (Public domain) が含まれること
//   - 写真から読み取れない数値 (カートン数・値段・組数) が「設定した数値」と明示されること
//   - 解法ステップ (generateSolutionSteps) が正解と一致すること
//   - parameters の数値が問題文または解説に含まれること (既存監査との整合)

import { describe, expect, it } from 'vitest';
import {
  EggCountingGenerator,
  EGGS_PHOTO,
  EGGS_IMAGE_SRC,
} from './generators';
import { validateProblem } from '../../engine/validator/validator';
import { checkUserAnswer, formatAnswer } from '../../utils/answer';
import { generateSolutionSteps } from '../../engine/solution/solutionGenerator';

const gen = new EggCountingGenerator();

describe('EggCountingGenerator: 基本構造', () => {
  it('type / category / description が定義されている', () => {
    expect(gen.type).toBe('realworld_eggs');
    expect(gen.category).toBe('realWorld');
    expect(gen.description.length).toBeGreaterThan(0);
  });

  it('全難易度 (1〜5) で有効な問題を生成する', () => {
    for (let level = 1; level <= 5; level++) {
      for (let seed = 0; seed < 50; seed++) {
        const p = gen.generate({ difficulty: level as 1 | 2 | 3 | 4 | 5, seed });
        const result = validateProblem(p);
        expect(result.valid, `${gen.type} Lv${level} seed${seed}: ${result.errors.join(', ')}`).toBe(true);
        expect(p.difficulty.level).toBe(level);
        expect(p.answer.kind).toBe('integer');
        if (p.answer.kind === 'integer') {
          expect(Number.isInteger(p.answer.value)).toBe(true);
        }
      }
    }
  });
});

describe('EggCountingGenerator: 写真の読み取り情報の一致', () => {
  it('正解が自分自身と一致する (採点が機能する)', () => {
    for (let seed = 0; seed < 200; seed++) {
      const p = gen.generate({ seed });
      const formatted = formatAnswer(p.answer);
      expect(checkUserAnswer(formatted, p.answer)).toBe(true);
    }
  });

  it('画像が付与され、個数・出典・公開情報が代替テキスト等に含まれる', () => {
    const p = gen.generate({ seed: 1 });
    expect(p.image).toBeDefined();
    expect(p.image?.src).toBe(EGGS_IMAGE_SRC);
    expect(p.image?.src).toBe('/images/eggs-brown-white.jpg');
    // 画像が表示できない環境でも解答できるよう、個数を代替テキストに含める。
    expect(p.image?.altText).toContain('2個');
    // 出典・利用条件 (Public domain) をクレジットに記録する。
    expect(p.image?.credit).toContain('Evan-Amos');
    expect(p.image?.credit).toContain('Public domain');
    // 写真から読み取る情報と、補足する情報を区別して保持する。
    expect(p.image?.photoFacts?.join('')).toContain('2個');
    expect((p.image?.supplementalText ?? []).join('')).toContain('設定した数値');
  });

  it('個数を数える系統の問題では、解説に写真の個数 (2個) が含まれる', () => {
    // fill_carton (難易度1) と pairs_total (難易度3) は、写真の個数 (2個) を数えて解く。
    for (let seed = 0; seed < 30; seed++) {
      const fc = gen.generate({ difficulty: 1, seed });
      expect(fc.explanation ?? '', 'fill_carton: 2個の読み取りが解説に必要').toContain(
        String(EGGS_PHOTO.total),
      );
      const pt = gen.generate({ difficulty: 3, seed });
      expect(pt.explanation ?? '', 'pairs_total: 2個の読み取りが解説に必要').toContain(
        String(EGGS_PHOTO.total),
      );
    }
    // pairs_in_carton (難易度4) も「1組2個」を読み取る (難易度4は2種なので種別を限定)。
    for (let seed = 0; seed < 50; seed++) {
      const pic = gen.generate({ difficulty: 4, seed });
      if (pic.parameters.variant === 'pairs_in_carton') {
        expect(pic.explanation ?? '', 'pairs_in_carton: 2個の読み取りが解説に必要').toContain(
          String(EGGS_PHOTO.total),
        );
      }
    }
  });
});

describe('EggCountingGenerator: 写真から読み取れない数値は「設定した数値」と明示', () => {
  it('値段を使う問題 (pair_price: 難易度2 / pairs_cost: 難易度5) は値段を設定値と明示する', () => {
    for (let seed = 0; seed < 50; seed++) {
      const pp = gen.generate({ difficulty: 2, seed });
      expect(pp.parameters.variant).toBe('pair_price');
      expect(pp.question, 'pair_price: 値段が設定値である注記が必要').toContain('設定した数値');
      const pc = gen.generate({ difficulty: 5, seed });
      expect(pc.parameters.variant).toBe('pairs_cost');
      expect(pc.question, 'pairs_cost: 値段が設定値である注記が必要').toContain('設定した数値');
    }
  });

  it('カートン数を使う問題 (fill_carton: 難易度1) は設定値と明示する', () => {
    for (let seed = 0; seed < 50; seed++) {
      const fc = gen.generate({ difficulty: 1, seed });
      expect(fc.parameters.variant).toBe('fill_carton');
      expect(fc.question, 'fill_carton: カートン数が設定値である注記が必要').toContain('設定した数値');
    }
  });

  it('組数・カートン数を使う問題 (pairs_total: 難易度3 / pairs_in_carton: 難易度4) は設定値と明示する', () => {
    for (let seed = 0; seed < 50; seed++) {
      const pt = gen.generate({ difficulty: 3, seed });
      expect(pt.parameters.variant).toBe('pairs_total');
      expect(pt.question, 'pairs_total: 組数が設定値である注記が必要').toContain('設定した数値');
      const pic = gen.generate({ difficulty: 4, seed });
      expect(['pairs_in_carton', 'pairs_cost']).toContain(pic.parameters.variant);
      expect(pic.question, '難易度4: 設定値の注記が必要').toContain('設定した数値');
    }
  });
});

describe('EggCountingGenerator: 計算と解法ステップの整合', () => {
  it('解法ステップが生成され、最後のステップに正解が含まれる', () => {
    for (let seed = 0; seed < 100; seed++) {
      const p = gen.generate({ seed });
      const steps = generateSolutionSteps(p);
      expect(steps.length).toBeGreaterThan(0);
      const ans = formatAnswer(p.answer);
      expect(steps[steps.length - 1].expression ?? '').toContain(ans);
    }
  });

  it('各バリエーションの正解が定義通りに計算される', () => {
    // fill_carton (難易度1): carton - 2 (カートンサイズは 6/10/12 のいずれか)
    const fc = gen.generate({ difficulty: 1, seed: 3 });
    expect(fc.parameters.variant).toBe('fill_carton');
    const fcCarton = fc.parameters.carton as number;
    expect(fc.answer).toEqual({ kind: 'integer', value: fcCarton - EGGS_PHOTO.total });

    // pairs_in_carton (難易度4): carton / 2 (難易度4は2種のため探す)
    let found = false;
    for (let seed = 0; seed < 50 && !found; seed++) {
      const p = gen.generate({ difficulty: 4, seed });
      if (p.parameters.variant === 'pairs_in_carton') {
        const carton = p.parameters.carton as number;
        expect(p.answer).toEqual({ kind: 'integer', value: carton / EGGS_PHOTO.total });
        found = true;
      }
    }
    expect(found, 'pairs_in_carton が生成されなかった').toBe(true);
  });
});
