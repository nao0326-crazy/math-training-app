/**
 * 全問題生成器の横断スイープテスト
 *
 * 目的: 既存の個別テストが拾いきらない「全生成器 × 全対応難易度」の一貫性を保証する。
 * - 生成例外・検証失敗・解答不能 (formatAnswer の往復不能)・途中式欠落を検出する
 * - 入力UI仕様 (choice の選択肢・answer の一致など) の矛盾を検出する
 * - 「同じ問題ばかり生成される」タイプの劣化 (多様性崩壊) を検出する
 * - 難易度契約を実アプリと同経路 (generateProblem 経由) で厳格に検証する
 *
 * 難易度の契約 (既存 quality-gate.test.ts / 内部仕様書と一致させる):
 * - generator.generate({difficulty, seed}) の difficulty は「希望値」であり、
 *   実際の難易度は生成される数値から算出されるため一致しない場合がある (近似)。
 *   → ダイレクト経路では level ∈ 1..5 のみを検証する。
 * - generateProblem (レジストリ) は再試行して指定難易度と一致させることが
 *   保証されている。これがユーザーが出題で踏む実経路。
 *   → レジストリ経路では指定難易度との「厳密一致」を検証する。
 *
 * 設計方針:
 * - シード付き生成は (type, difficulty, seed) で決定論的に再現できるため、
 *   失敗があれば必ず同一条件で再現できる。
 * - シード無し (実運用相当) の経路も、例外自体は「この乱数では生成不可」という
 *   正当な設計 (レジストリがリトライして吸収) であるため、
 *   「投げた場合は必ず次の試行で有効な問題を返す」ことを契約とする。
 */

import { describe, expect, it } from 'vitest';
import { generateProblem, getAllGenerators } from './generatorRegistry';
import { getTypeSupportedLevels } from '../diversity/metadata';
import { validateProblem } from '../validator/validator';
import { generateSolutionSteps } from '../solution/solutionGenerator';
import { formatAnswer, checkUserAnswer } from '../../utils/answer';
import { getProblemInputType, getProblemChoiceOptions } from '../../utils/inputType';
import { canonicalizeExpressionString } from '../../utils/answer';
import type { Problem } from '../../types/problem';

const SEEDS_PER_LEVEL = 12;
const UNSEEDED_TRIES = 40;
const REGISTRY_SEEDS_PER_LEVEL = 3;

/** 生成された問題が「出題・採点可能」であることを全生成器共通の契約として検査する */
function assertProblemIsFullyUsable(p: Problem, context: string): void {
  expect(typeof p.id, `${context}: id`).toBe('string');
  expect(p.id.trim(), `${context}: id が空`).not.toBe('');
  expect(typeof p.question, `${context}: question 型`).toBe('string');
  expect(p.question.trim(), `${context}: 問題文が空`).not.toBe('');
  expect(p.question, `${context}: undefined 文字列混入`).not.toContain('undefined');
  expect(p.question, `${context}: NaN 文字列混入`).not.toContain('NaN');
  expect(p.question, `${context}: null 文字列混入`).not.toContain('null');

  const v = validateProblem(p);
  expect(v.errors, `${context}: 検証エラー`).toEqual([]);

  // 解答の表示形式が空でなく、その表示形式がそのまま正解として採点できること (往復)
  const shown = formatAnswer(p.answer);
  expect(shown.trim(), `${context}: formatAnswer が空`).not.toBe('');
  expect(
    checkUserAnswer(shown, p.answer),
    `${context}: formatAnswer("${shown}") が正解として採点できない`,
  ).toBe(true);

  // 途中式は必ず生成される (答えの根拠として表示できる)
  expect(
    generateSolutionSteps(p).length,
    `${context}: solutionSteps が空`,
  ).toBeGreaterThan(0);

  // choice 入力UIの問題は、選択肢が存在し、正解が選択肢に含まれる (採点不能を防ぐ)
  const inputType = getProblemInputType(p);
  if (inputType === 'choice') {
    const options = getProblemChoiceOptions(p);
    expect(options.length, `${context}: choice だが選択肢が空`).toBeGreaterThan(0);
    if (p.answer.kind === 'string') {
      const answerCanonical = canonicalizeExpressionString(p.answer.value);
      const matched = options.some((o) => canonicalizeExpressionString(o) === answerCanonical);
      expect(matched, `${context}: 正解 "${p.answer.value}" が選択肢にない (${options.join(' / ')})`).toBe(
        true,
      );
    }
  }

  // 図形を持つ問題は頂点が有限の数値であること (描画破綻の防止)
  if (p.figure) {
    for (const f of p.figure.figures) {
      expect(f.vertices.length, `${context}: 図の頂点が空`).toBeGreaterThanOrEqual(3);
      for (const vert of f.vertices) {
        expect(Number.isFinite(vert.x) && Number.isFinite(vert.y), `${context}: 頂点座標が非有限`).toBe(
          true,
        );
      }
    }
  }

  // 画像を持つ問題は public/ からのルート相対パスと代替テキストを持つ
  if (p.image) {
    expect(p.image.src.startsWith('/'), `${context}: image.src がルート相対でない`).toBe(true);
    expect(p.image.altText.trim(), `${context}: image.altText が空`).not.toBe('');
  }
}

describe('全問題生成器のスイープ', () => {
  const generators = getAllGenerators();

  it('生成器が一覧化されている (空でない)', () => {
    expect(generators.length).toBeGreaterThan(50);
    const types = generators.map((g) => g.type);
    expect(new Set(types).size, '問題タイプの重複登録').toBe(types.length);
  });

  for (const g of generators) {
    it(
      `${g.type}: 対応難易度 × シード ${SEEDS_PER_LEVEL} 回で有効な問題を生成できる`,
      () => {
        const levels = getTypeSupportedLevels(g.type);
        expect(levels.length, `${g.type}: 対応難易度が空`).toBeGreaterThan(0);
        let generated = 0;
        const uniqueQuestions = new Set<string>();
        for (const lv of levels) {
          for (let s = 0; s < SEEDS_PER_LEVEL; s++) {
            const seed = s * 7919 + lv * 31 + 13;
            const ctx = `${g.type} lv${lv} seed=${seed}`;
            let p: Problem;
            try {
              p = g.generate({ difficulty: lv, seed });
            } catch (e) {
              // シード指定経路での例外は「そのシードで生成不可」を意味するが、
              // レジストリは自動リトライで吸収する契約。ここでは即 fail とする
              // (決定論的経路は全シードで成功するのが期待値。失敗は再現・修正対象)。
              throw new Error(`${ctx}: 生成時に例外 (理由: ${(e as Error).message})`);
            }
            assertProblemIsFullyUsable(p, ctx);
            // ダイレクト生成の difficulty は希望値 (近似)。厳密一致は
            // 下の「レジストリ経路」テストで検証する (quality-gate と同一契約)。
            expect(p.difficulty.level, `${ctx}: 難易度が範囲外`).toBeGreaterThanOrEqual(1);
            expect(p.difficulty.level, `${ctx}: 難易度が範囲外`).toBeLessThanOrEqual(5);
            uniqueQuestions.add(p.question);
            generated++;
          }
        }
        expect(generated).toBe(levels.length * SEEDS_PER_LEVEL);
        // 多様性: 全シードで同一問題文 = 乱数が効いていない劣化を検出する
        expect(
          uniqueQuestions.size,
          `${g.type}: ${generated} 回中 ${uniqueQuestions.size} 問しか問題文が被っていない (多様性崩壊)`,
        ).toBeGreaterThanOrEqual(2);
      },
      30000,
    );

    it(
      `${g.type}: シード無し経路でも必ず有効な問題を返す (例外→リトライ契約)`,
      () => {
        let ok = 0;
        for (let i = 0; i < UNSEEDED_TRIES; i++) {
          let p: Problem | null = null;
          try {
            p = g.generate();
          } catch {
            // 例外は許容 (次の試行で成功すればよい)
            p = null;
          }
          if (p) {
            assertProblemIsFullyUsable(p, `${g.type} unseeded#${i}`);
            ok++;
          }
        }
        // 全試行が例外 = 実運用で出題不能。過半数は成功している必要がある。
        expect(ok, `${g.type}: ${UNSEEDED_TRIES} 回中成功 ${ok} 回`).toBeGreaterThanOrEqual(
          Math.ceil(UNSEEDED_TRIES / 2),
        );
      },
      30000,
    );

    it(
      `${g.type}: レジストリ経由 (実出題経路) で指定難易度に厳密一致する`,
      () => {
        const levels = getTypeSupportedLevels(g.type);
        for (const lv of levels) {
          for (let s = 0; s < REGISTRY_SEEDS_PER_LEVEL; s++) {
            const seed = s * 104729 + lv * 7 + 3;
            const ctx = `generateProblem(${g.type}, lv${lv}, seed=${seed})`;
            let p: Problem;
            try {
              p = generateProblem({ type: g.type, difficulty: lv, seed });
            } catch (e) {
              throw new Error(`${ctx}: 生成失敗 (理由: ${(e as Error).message})`);
            }
            assertProblemIsFullyUsable(p, ctx);
            expect(p.difficulty.level, `${ctx}: 指定難易度に一致しない`).toBe(lv);
          }
        }
      },
      60000,
    );
  }
});
