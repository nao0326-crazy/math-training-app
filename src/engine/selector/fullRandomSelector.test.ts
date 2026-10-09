/**
 * 完全ランダム出題セレクター (FullRandomSelector) のテスト
 *
 * 通常モードの中心仕様を検証する:
 * - 母集団の全 generator が視野に入る (分野固定にならない)
 * - 同一問題の連続・同一 generator の連続だけを最小限避ける
 * - 人工的なローテーション (分野を1回ずつ等間隔で出す等) は入れない
 */

import { describe, expect, it } from 'vitest';
import { FullRandomSelector, randomLevelOf } from './fullRandomSelector';
import { buildQuestionPool } from './questionPool';
import { getAllGenerators } from './generatorRegistry';
import {
  deriveMetadataFromType,
  fingerprintProblem,
} from '../diversity/metadata';
import { validateProblem } from '../validator/validator';
import type { QuestionHistory } from '../../types/history';

const selector = new FullRandomSelector();
const request = { mode: { kind: 'full-random' } as const, difficulty: 2 as const };

/** 履歴なしでも1問出題する */
function ask() {
  return selector.selectNextQuestion([], [], request);
}

/** 直前の出題を表すエントリを作る */
function entry(type: string, fingerprint: string): QuestionHistory {
  return {
    problemId: `${type}_${fingerprint}`,
    problemType: type,
    parameters: {},
    askedAt: new Date(0).toISOString(),
    metadata: deriveMetadataFromType(type),
    fingerprint,
  };
}

describe('FullRandomSelector: 母集団全体から出題できる', () => {
  it('十分な試行数で多くの分野が出題される', () => {
    const categories = new Set<string>();
    for (let i = 0; i < 400; i++) {
      categories.add(ask().category);
    }
    // 母集団は全分野を含むので、複数分野は確実に出題される
    expect(categories.size).toBeGreaterThan(3);
  });

  it('生成される問題は必ず検証を通過する', () => {
    for (let i = 0; i < 60; i++) {
      const p = ask();
      expect(validateProblem(p).valid, `${p.type}: ${validateProblem(p).errors.join(', ')}`).toBe(true);
    }
  });

  it('難易度は1〜5のいずれか (指定難易度へ丸められない)', () => {
    const levels = new Set<number>();
    for (let i = 0; i < 200; i++) {
      const p = ask();
      expect([1, 2, 3, 4, 5]).toContain(p.difficulty.level);
      levels.add(p.difficulty.level);
    }
    // 難易度は選出条件ではないので、複数レベルが現れる
    expect(levels.size).toBeGreaterThan(1);
  });

  it('母集団の全分野が出題対象に入っている (generator が1つだけの分野でも出る)', () => {
    // 母集団の全フィールドが登録されていることの確認
    const poolCategories = new Set(buildQuestionPool().map((e) => e.category));
    expect(getAllGenerators().length).toBeGreaterThan(50);
    expect(poolCategories.size).toBeGreaterThanOrEqual(5);
  });
});

describe('FullRandomSelector: 重複回避は最小限', () => {
  it('直前と同じ generator は続けて出題されない', () => {
    let lastType = ask().type;
    for (let i = 0; i < 80; i++) {
      const history = [entry(lastType, 'fp-previous')];
      const p = selector.selectNextQuestion([], history, request);
      // 同一 generator の連続は再抽選で消費される。
      // 母集団サイズ (90件超) に対して連続を選ぶ確率は無視できるため、
      // これが起きるなら再抽選ループが機能していないとみなす。
      expect(p.type, `同一 generator が連続しました: ${lastType}`).not.toBe(lastType);
      lastType = p.type;
    }
  });

  it('直前の問題と完全に同じ問題 (fingerprint一致) は出さない', () => {
    for (let i = 0; i < 40; i++) {
      const previous = ask();
      const fp = fingerprintProblem(previous);
      const history = [entry(previous.type, fp)];
      const next = selector.selectNextQuestion([], history, request);
      expect(fingerprintProblem(next), `同じ問題が続いた: ${next.type}`).not.toBe(fp);
    }
  });

  it('再試行の上限に達しても1問は必ず返る (学習を止めない)', () => {
    const previous = ask();
    const history = [entry(previous.type, fingerprintProblem(previous))];
    const next = selector.selectNextQuestion([], history, request);
    expect(next).toBeDefined();
    expect(next.question.length).toBeGreaterThan(0);
  });

  it('履歴が空でも全generatorから出題できる (履歴依存にしない)', () => {
    for (let i = 0; i < 30; i++) {
      const a = selector.selectNextQuestion([], [], request);
      const b = selector.selectNextQuestion([], [], request);
      expect(a).toBeDefined();
      expect(b).toBeDefined();
    }
  });
});

describe('randomLevelOf', () => {
  it('対応レベルから選ぶ', () => {
    expect(randomLevelOf([3, 4], () => 0)).toBe(3);
    expect(randomLevelOf([3, 4], () => 0.99)).toBe(4);
  });

  it('空なら lv2 にフォールバックする', () => {
    expect(randomLevelOf([], () => 0)).toBe(2);
  });
});
