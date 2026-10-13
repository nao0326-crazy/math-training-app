// realWorld/integration.test.ts — 現実連動教材の既存出題フロー統合の検査
//
// 目的:
//   - 新しいカテゴリ (realWorld) と分野 (くらしの中の算数) が既存の
//     母集団・出題選択 (adaptive / full-random / filtered) に統合されていること
//   - 出題経路で必ず画像 (ImageSpec) が付与されること
//   - 学習記録 (AnswerRecord) の category として保存でき、既存集計と互換であること
//   - 履歴・統計の既存機能が新しい category を壊さないこと

import { describe, expect, it } from 'vitest';
import { AdaptiveSelector } from '../../engine/selector/adaptiveSelector';
import { FullRandomSelector } from '../../engine/selector/fullRandomSelector';
import { buildQuestionPool, filterQuestionPool } from '../../engine/selector/questionPool';
import { generateProblem } from '../../engine/selector/generatorRegistry';
import { listLearningAreas } from '../../utils/adaptiveDifficulty';
import { calculateStats, categoryLabel } from '../../utils/stats';
import { validateProblem } from '../../engine/validator/validator';
import type { AnswerRecord } from '../../types/history';

const AREA = 'くらしの中の算数';

describe('現実連動教材: 母集団・分野への統合', () => {
  it('realworld_shopping が母集団に含まれる', () => {
    const pool = buildQuestionPool();
    const entry = pool.find((e) => e.type === 'realworld_shopping');
    expect(entry, 'realworld_shopping が母集団にありません').toBeDefined();
    expect(entry?.category).toBe('realWorld');
  });

  it('新しい分野 (くらしの中の算数) が通常モードの分野ボタンに現れる', () => {
    const areas = listLearningAreas();
    expect(areas).toContain(AREA);
  });

  it('分野 (area) で母集団を絞ると realworld_shopping になる', () => {
    const pool = buildQuestionPool().filter((e) => e.category === 'realWorld');
    expect(pool.map((e) => e.type)).toContain('realworld_shopping');
  });
});

describe('現実連動教材: 出題選択への統合', () => {
  it('adaptive (通常モードの分野別学習) で出題でき画像が付く', () => {
    const selector = new AdaptiveSelector(AREA);
    // 分野「くらしの中の算数」には写真教材が2種ある (買い物・卵)。
    const realWorldTypes = ['realworld_shopping', 'realworld_eggs'];
    for (let i = 0; i < 30; i++) {
      const p = selector.selectNextQuestion([], [], {
        mode: { kind: 'adaptive', area: AREA },
        difficulty: 2,
      });
      expect(realWorldTypes).toContain(p.type);
      expect(validateProblem(p).valid).toBe(true);
      // 種別に応じて正しい写真が付く。
      const expectedSrc =
        p.type === 'realworld_eggs'
          ? '/images/eggs-brown-white.jpg'
          : '/images/supermarket-shelf.svg';
      expect(p.image?.src).toBe(expectedSrc);
    }
  });

  it('full-random (通常ランダム) の母集団に realWorld が含まれる', () => {
    const selector = new FullRandomSelector();
    const seen = new Set<string>();
    for (let i = 0; i < 2000; i++) {
      const p = selector.selectNextQuestion([], [], {
        mode: { kind: 'full-random' },
        difficulty: 2,
      });
      seen.add(p.category);
      if (p.type === 'realworld_shopping') {
        expect(p.image?.src).toBe('/images/supermarket-shelf.svg');
      }
    }
    expect(seen.has('realWorld')).toBe(true);
  });

  it('filtered (管理者モード) でカテゴリ realWorld を指定して出題できる', () => {
    const pool = filterQuestionPool({ category: 'realWorld' });
    expect(pool.length).toBeGreaterThan(0);
    const p = generateProblem({ type: 'realworld_shopping', difficulty: 2 });
    expect(p.category).toBe('realWorld');
    expect(p.image).toBeDefined();
  });
});

describe('現実連動教材: 学習記録・統計との互換', () => {
  it('新しい category が統計集計に乗る (既存機能を壊さない)', () => {
    const records: AnswerRecord[] = [
      {
        problemId: 'p1',
        problemType: 'realworld_shopping',
        category: 'realWorld',
        isCorrect: true,
        answerTimeSec: 10,
        answeredAt: '2026-10-12T10:00:00.000Z',
        difficultyLevel: 2,
        question: 'q',
        userAnswer: '300',
        correctAnswer: '300',
      },
      {
        problemId: 'p2',
        problemType: 'integer_addition',
        category: 'integer',
        isCorrect: false,
        answerTimeSec: 12,
        answeredAt: '2026-10-12T10:01:00.000Z',
        difficultyLevel: 2,
        question: 'q',
        userAnswer: '5',
        correctAnswer: '6',
      },
    ];
    const stats = calculateStats(records);
    expect(stats.totalCount).toBe(2);
    expect(stats.correctCount).toBe(1);
    const realWorld = stats.byCategory.find((c) => c.category === 'realWorld');
    expect(realWorld?.totalCount).toBe(1);
    expect(realWorld?.correctCount).toBe(1);
  });

  it('新しい category に日本語ラベルが定義されている', () => {
    expect(categoryLabel('realWorld')).toBe('くらしの中の算数');
  });
});

describe('現実連動教材 (卵): 既存出題フローへの統合', () => {
  it('realworld_eggs が母集団に含まれる', () => {
    const pool = buildQuestionPool();
    const entry = pool.find((e) => e.type === 'realworld_eggs');
    expect(entry, 'realworld_eggs が母集団にありません').toBeDefined();
    expect(entry?.category).toBe('realWorld');
  });

  it('分野 (くらしの中の算数) で絞り込むと realworld_eggs も候補になる', () => {
    const pool = buildQuestionPool().filter((e) => e.category === 'realWorld');
    expect(pool.map((e) => e.type)).toContain('realworld_eggs');
  });

  it('filtered (管理者モード) で type 指定して出題でき、写真と解法ステップが付く', () => {
    const p = generateProblem({ type: 'realworld_eggs', difficulty: 3 });
    expect(p.category).toBe('realWorld');
    expect(p.type).toBe('realworld_eggs');
    expect(p.image?.src).toBe('/images/eggs-brown-white.jpg');
    // 出題パイプラインが解法ステップを添付し、正解と整合している。
    expect(p.solutionSteps && p.solutionSteps.length).toBeGreaterThan(0);
    expect(validateProblem(p).valid).toBe(true);
  });

  it('adaptive 出題で realWorld から出題され、写真が付与される', () => {
    const selector = new AdaptiveSelector(AREA);
    let sawEggs = false;
    for (let i = 0; i < 200 && !sawEggs; i++) {
      const p = selector.selectNextQuestion([], [], {
        mode: { kind: 'adaptive', area: AREA },
        difficulty: 3,
      });
      expect(p.category).toBe('realWorld');
      expect(p.image).toBeDefined();
      if (p.type === 'realworld_eggs') {
        expect(p.image?.src).toBe('/images/eggs-brown-white.jpg');
        sawEggs = true;
      }
    }
    expect(sawEggs, 'adaptive で realworld_eggs が出題されなかった').toBe(true);
  });
});
