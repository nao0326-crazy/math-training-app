// realWorld/generators.test.ts — 現実連動教材 (スーパーの買い物) の検査
//
// 目的:
//   - 写真の値札 (SUPERMARKET_PRODUCTS) と問題文・正解・解説が一致すること
//   - 全難易度で有効な問題が生成され、検証 (validateProblem) を通過すること
//   - 正解が一意に定まること (整数解答・余りの出ない割り算)
//   - 画像 (ImageSpec) が付与され、代替テキストに価格が含まれること
//   - parameters の価格が問題文または解説に含まれること (既存監査との整合)

import { describe, expect, it } from 'vitest';
import { SupermarketShoppingGenerator, SUPERMARKET_PRODUCTS, SUPERMARKET_IMAGE_SRC } from './generators';
import { validateProblem } from '../../engine/validator/validator';
import { checkUserAnswer, formatAnswer } from '../../utils/answer';

const gen = new SupermarketShoppingGenerator();

describe('SupermarketShoppingGenerator: 基本構造', () => {
  it('type / category / description が定義されている', () => {
    expect(gen.type).toBe('realworld_shopping');
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

describe('SupermarketShoppingGenerator: 正解と解説の整合', () => {
  it('正解が自分自身と一致する (採点が機能する)', () => {
    for (let seed = 0; seed < 200; seed++) {
      const p = gen.generate({ seed });
      const formatted = formatAnswer(p.answer);
      expect(checkUserAnswer(formatted, p.answer)).toBe(true);
    }
  });

  it('写真の値札価格と parameters の価格が一致する', () => {
    for (let seed = 0; seed < 200; seed++) {
      const p = gen.generate({ seed });
      const params = p.parameters as Record<string, number>;
      const validPrices = SUPERMARKET_PRODUCTS.map((x) => x.price);
      // parameters に価格が載っていれば、必ず値札の価格のいずれかと一致する
      for (const key of ['priceA', 'priceB', 'priceC', 'price']) {
        if (typeof params[key] === 'number') {
          expect(validPrices, `${key}=${params[key]} が値札と不一致`).toContain(params[key]);
        }
      }
    }
  });

  it('価格の数値が問題文または解説に含まれる (読み取りと整合)', () => {
    for (let seed = 0; seed < 200; seed++) {
      const p = gen.generate({ seed });
      const params = p.parameters as Record<string, number>;
      for (const key of ['priceA', 'priceB', 'priceC', 'price', 'budget']) {
        const v = params[key];
        if (typeof v === 'number') {
          const inQuestion = p.question.includes(String(v));
          const inExplanation = p.explanation?.includes(String(v)) ?? false;
          expect(
            inQuestion || inExplanation,
            `${p.type}: ${key}=${v} が問題文・解説にありません`,
          ).toBe(true);
        }
      }
    }
  });

  it('正解が正の整数 (買い物・割り勘なので 0 より大きい)', () => {
    for (let seed = 0; seed < 200; seed++) {
      const p = gen.generate({ seed });
      if (p.answer.kind === 'integer') {
        expect(p.answer.value).toBeGreaterThan(0);
      }
    }
  });
});

describe('SupermarketShoppingGenerator: 写真 (ImageSpec) の付与', () => {
  it('image が付与され、src が public/ 相対パスである', () => {
    const p = gen.generate({ seed: 1 });
    expect(p.image).toBeDefined();
    expect(p.image?.src).toBe(SUPERMARKET_IMAGE_SRC);
    expect(p.image?.src.startsWith('/')).toBe(true);
  });

  it('代替テキストに全商品の価格が含まれる (画像非表示でも解答できる)', () => {
    const p = gen.generate({ seed: 1 });
    for (const product of SUPERMARKET_PRODUCTS) {
      expect(p.image?.altText).toContain(product.name);
      expect(p.image?.altText).toContain(String(product.price));
    }
  });

  it('写真から読み取る情報 (photoFacts) に価格が含まれる', () => {
    const p = gen.generate({ seed: 1 });
    expect(p.image?.photoFacts?.length).toBe(SUPERMARKET_PRODUCTS.length);
    for (const fact of p.image?.photoFacts ?? []) {
      expect(fact).toMatch(/円$/);
    }
  });
});

describe('SupermarketShoppingGenerator: 値札の固定価格', () => {
  it('6商品の価格が写真 (SVG) と一致する定義済み値である', () => {
    // public/images/supermarket-shelf.svg の値札と一致させる。
    expect(SUPERMARKET_PRODUCTS.map((p) => p.price)).toEqual([120, 180, 150, 260, 200, 90]);
  });
});
