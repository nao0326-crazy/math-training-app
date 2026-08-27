/**
 * 数値ランダム化の回帰テスト
 *
 * 背景: かつて generatorRegistry のシード供給が壊れており
 * 「単元が変わっても問題に使用される数値が同じになる」不具合があった。
 *   - シード未指定時、試行番号 0,1,2... をそのままシードにしており
 *     ほぼ全問題が seed=0 (固定列の先頭) で生成されていた
 *   - SeededRandom のデフォルトシードが Date.now() のため同一ミリ秒内の
 *     連続生成が同じ数値になった
 *   - 検証リトライが同じシードを使い回していたため再抽選になっていなかった
 *
 * 本ファイルはこの回帰を防ぐためのテスト。
 * 原則として明示シードで決定論的に動作し、「たまたま全部同じなら失敗」という
 * 不安定なテストにならないようにしている (乱数非依存のアサーション)。
 */

import { describe, expect, it, vi, afterEach } from 'vitest';
import {
  getAllGenerators,
  getCategories,
  generateProblem,
} from './generatorRegistry';
import { validateProblem } from '../validator/validator';
import { fingerprintProblem } from '../diversity/metadata';
import { resetAutoSeedCounterForTest } from '../../utils/random';
import type { DifficultyLevel } from '../../types/problem';

afterEach(() => {
  vi.useRealTimers();
});

/** カテゴリ×難易度ごとのフィンガープリント数下限 */
const MIN_FINGERPRINTS: Record<string, number> = {
  // speed のレベル1は「推論の複雑さ2以上」を要求するジェネレータが除外され、
  // 学習範囲としても意図的に狭いため下限を 4 に緩める (旧バグ時は 1 程度)
  speed_1: 4,
};

/** 難易度ごとの試行シード数 */
const SEEDS_PER_LEVEL = 40;

describe('数値ランダム化 (ジェネレータ単位・決定論)', () => {
  it('全ジェネレータで、難易度1〜5×複数シードから複数の数値パターンが生成され、全問が検証を通過する', () => {
    const summary: string[] = [];

    for (const g of getAllGenerators()) {
      const uniquePatterns = new Set<string>();
      let sampled = 0;
      let thrown = 0;

      for (let lv = 1 as DifficultyLevel; lv <= 5; lv++) {
        for (let s = 0; s < SEEDS_PER_LEVEL; s++) {
          sampled++;
          let problem;
          try {
            // 一部ジェネレータは内部的な制約で生成できないシードがある (既存仕様)。
            // リトライ可能なのでここでは破棄して継続し、失敗率のみ監視する。
            problem = g.generate({ difficulty: lv, seed: s * 7919 + lv });
          } catch {
            thrown++;
            continue;
          }
          // 生成された問題は必ず自動検証を通過すること (割り切れる割り算・約分済み分数など)
          const result = validateProblem(problem);
          if (!result.valid) {
            throw new Error(
              `${g.type} (lv=${lv}, seed=${s}) 検証失敗: ${result.errors.join(', ')}`,
            );
          }
          // 数値パターンの識別には問題文と生成パラメータを使う
          uniquePatterns.add(problem.question + '::' + JSON.stringify(problem.parameters));
        }
      }

      // 内部制約による生成失敗は例外的に許容するが、常態化していないこと
      expect(thrown / sampled, `${g.type}: 生成失敗率が高すぎる`).toBeLessThan(0.05);

      // 数値固定の再発検査: 単一タイプから最低でも複数パターンが出ること
      expect(uniquePatterns.size, `${g.type}: 数値が固定している疑い`).toBeGreaterThanOrEqual(6);

      summary.push(`${g.category}/${g.type}: ${uniquePatterns.size} patterns`);
    }

    // 参考ログ (失敗時に全体像を見えるようにする)
    expect(summary.length).toBe(getAllGenerators().length);
  });

  it('全ジェネレータで、ある難易度内だけ見ても数値パターンが複数ある', () => {
    for (const g of getAllGenerators()) {
      for (let lv = 1 as DifficultyLevel; lv <= 5; lv++) {
        const uniqueQuestions = new Set<string>();
        for (let s = 0; s < SEEDS_PER_LEVEL; s++) {
          try {
            const p = g.generate({ difficulty: lv, seed: s * 104729 + 17 });
            uniqueQuestions.add(p.question);
          } catch {
            // 上記テストで失敗率を監視済み。ここではスキップ。
          }
        }
        // 同一難易度の中でも1種類しか出ない状態は「固定」とみなす
        // (候補空間が極端に小さいタイプでも、少なくとも複数は用意されている)
        expect(
          uniqueQuestions.size,
          `${g.type} lv${lv}: 同一難易度内で問題が固定`,
        ).toBeGreaterThanOrEqual(2);
      }
    }
  });
});

describe('数値ランダム化 (レジストリ経路)', () => {
  it('各カテゴリ×難易度で seed を変えると異なる問題が生成される', () => {
    const categories = getCategories();
    expect(categories.length).toBeGreaterThanOrEqual(10);

    for (const category of categories) {
      for (let lv = 1 as DifficultyLevel; lv <= 5; lv++) {
        const fingerprints = new Set<string>();
        for (let s = 0; s < 60; s++) {
          const problem = generateProblem({ category, difficulty: lv, seed: s * 65537 });
          const result = validateProblem(problem);
          expect(result.valid, `${category} lv${lv} seed${s}`).toBe(true);
          // レジストリ経路は指定難易度を必ず守る
          expect(problem.difficulty.level, `${category} lv${lv} seed${s}`).toBe(lv);
          fingerprints.add(fingerprintProblem(problem));
        }
        // カテゴリ全体として多彩な数値パターンが現れること。
        // 数値固定バグ発生時はタイプ数ぶん (2〜5) まで落ちるため十分分離できる
        expect(
          fingerprints.size,
          `${category} lv${lv}: 問題パターンが固定している疑い`,
        ).toBeGreaterThanOrEqual(MIN_FINGERPRINTS[`${category}_${lv}`] ?? 8);
      }
    }
  });

  it('時計を止めても (同一ミリ秒でも) 連続生成の数値は固定しない [旧バグの決定論的検知]', () => {
    // 旧実装の根本原因「Date.now() ベースのシード衝突」を再現条件ごと固定して検知する。
    // Date.now()/performance.now() を凍結した上で連続生成し、
    //   - 旧実装: 常に同一シード → 全問同一になる (このテストは失敗する)
    //   - 新実装: カウンタ混入により常に異なるシード → 多様な問題が出る
    vi.useFakeTimers({
      now: new Date('2025-01-01T00:00:00Z').getTime(),
      toFake: ['Date', 'performance'],
    });

    for (const category of getCategories()) {
      const questions = new Set<string>();
      resetAutoSeedCounterForTest(1); // 決定論化 (毎回同じ開始点)
      for (let i = 0; i < 12; i++) {
        const problem = generateProblem({ category, difficulty: 1 });
        questions.add(problem.question);
      }
      // 凍結された時刻 + 固定カウンタ開始からでも、12問中2種類以上出ること。
      // (旧実装ではここが必ず 1 になった)
      expect(
        questions.size,
        `${category}: 同一ミリ秒内の生成が固定している`,
      ).toBeGreaterThan(1);
    }
  });

  it('シード未指定で連続生成しても問題が崩壊しない (自動シード経路のスモークテスト)', () => {
    // 実運用 (Quiz 画面) と同じ「シード未指定」経路の回帰チェック。
    // 自動シード化されていれば 20 問で最低でも複数の異なる問題が出る。
    // すべて同一になるケースは生成器が壊れた場合のみ。
    for (const category of getCategories()) {
      for (let lv = 1 as DifficultyLevel; lv <= 3; lv++) {
        const questions = new Set<string>();
        for (let i = 0; i < 20; i++) {
          const problem = generateProblem({ category, difficulty: lv });
          const result = validateProblem(problem);
          expect(result.valid, `${category} lv${lv}`).toBe(true);
          expect(problem.difficulty.level, `${category} lv${lv}`).toBe(lv);
          questions.add(problem.question);
        }
        expect(
          questions.size,
          `${category} lv${lv}: シード未指定で同じ問題ばかり出ている`,
        ).toBeGreaterThanOrEqual(2);
      }
    }
  });
});

describe('再現性とフィンガープリント', () => {
  it('同じ (type, seed, difficulty) なら常に同じ問題になる (教師用の再現性維持)', () => {
    for (const type of ['fraction_mul_fraction', 'speed_calculation', 'gcd_calculation']) {
      const a = generateProblem({ type, difficulty: 2, seed: 987654321 });
      const b = generateProblem({ type, difficulty: 2, seed: 987654321 });
      expect(b.question).toBe(a.question);
      expect(fingerprintProblem(b)).toBe(fingerprintProblem(a));
    }
  });

  it('別々のシードならフィンガープリントが重複しない (同型でも数値が変わる)', () => {
    const fps = new Set<string>();
    for (let s = 0; s < 20; s++) {
      const p = generateProblem({
        type: 'fraction_mul_fraction',
        difficulty: 2,
        seed: s * 1234567 + 3,
      });
      fps.add(fingerprintProblem(p));
    }
    // 全部一致すると重複除外 (多様性制御) が機能しない
    expect(fps.size).toBeGreaterThanOrEqual(15);
  });
});
