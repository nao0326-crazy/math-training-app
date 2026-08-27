/**
 * 出題多様性制御のテスト
 */

import { describe, expect, it } from 'vitest';
import {
  DEFAULT_DIVERSITY_CONFIG,
  buildRecentContext,
  evaluateCandidate,
  rankCandidates,
  selectBestCandidate,
} from './diversity';
import { deriveMetadata, fingerprintProblem, type ProblemMetadata } from './metadata';
import { similarityScore } from './similarity';
import { QuestionSelector } from '../selector/questionSelector';
import type { Problem } from '../../types/problem';
import type { QuestionHistory } from '../../types/history';
import { validateProblem } from '../validator/validator';

describe('ProblemMetadata', () => {
  it('3/4 と 2/5 の通分問題のメタデータを正しく分類する', () => {
    const problem = {
      type: 'fraction_common_denominator',
      category: 'fraction',
      parameters: { n1: 3, d1: 4, n2: 2, d2: 5 },
      answer: { kind: 'fractions' as const, values: [{ numerator: 15, denominator: 20 }, { numerator: 8, denominator: 20 }] },
    };
        const meta = deriveMetadata(problem as unknown as Problem);
    expect(meta.unit).toBe('fraction');
    expect(meta.family).toBe('common_denominator');
    expect(meta.operation).toBe('lcm');
    expect(meta.numberPattern).toMatch(/coprime_denominators/);
  });

  it('2/3 と 1/6 は multiple_denominators パターンになる', () => {
    const problem = {
      type: 'fraction_common_denominator',
      category: 'fraction',
      parameters: { n1: 2, d1: 3, n2: 1, d2: 6 },
      answer: { kind: 'fractions' as const, values: [] },
    };
        const meta = deriveMetadata(problem as unknown as Problem);
    expect(meta.numberPattern).toMatch(/multiple_denominators/);
  });
});

describe('similarityScore', () => {
  it('同一メタデータは最大スコア', () => {
    const a: ProblemMetadata = { unit: 'fraction', family: 'common_denominator', operation: 'lcm', numberPattern: 'coprime' };
    expect(similarityScore(a, a)).toBe(1 + 4 + 2 + 2);
  });

  it('family が違えば低スコア', () => {
    const a: ProblemMetadata = { unit: 'fraction', family: 'common_denominator', operation: 'lcm' };
    const b: ProblemMetadata = { unit: 'fraction', family: 'comparison', operation: 'compare' };
    expect(similarityScore(a, b)).toBe(1); // unit だけ
  });
});

describe('fingerprintProblem', () => {
  const base = {
    id: 'p1',
    category: 'fraction',
    type: 'fraction_common_denominator',
    difficulty: { level: 3, components: { calculationComplexity: 3, numberComplexity: 3, reasoningComplexity: 3, readingComplexity: 3 } },
    question: '問',
    answer: { kind: 'fractions' as const, values: [{ numerator: 15, denominator: 20 }, { numerator: 8, denominator: 20 }] },
    parameters: { n1: 3, d1: 4, n2: 2, d2: 5 },
  };

  it('同じ数学的条件+数値なら同一フィンガープリント (問題文違ってもOK)', () => {
    const a = { ...base, question: '問1' };
    const b = { ...base, question: '問2' };
    expect(fingerprintProblem(a as Problem)).toBe(fingerprintProblem(b as Problem));
  });

  it('数値が違えば異なるフィンガープリント', () => {
    const a = { ...base, parameters: { n1: 3, d1: 4, n2: 2, d2: 5 } };
    const b = { ...base, parameters: { n1: 2, d1: 3, n2: 3, d2: 7 } };
    expect(fingerprintProblem(a as Problem)).not.toBe(fingerprintProblem(b as Problem));
  });
});

describe('buildRecentContext', () => {
  it('直近ウィンドウとfamilyカウントを正しく構築する', () => {
    const history: QuestionHistory[] = [
      { problemId: 'h1', problemType: 'fraction_common_denominator', parameters: {}, askedAt: '2024-01-01', metadata: { unit: 'fraction', family: 'common_denominator' } },
      { problemId: 'h2', problemType: 'fraction_comparison', parameters: {}, askedAt: '2024-01-02', metadata: { unit: 'fraction', family: 'comparison' } },
      { problemId: 'h3', problemType: 'fraction_common_denominator', parameters: { d1: 4, d2: 5 }, askedAt: '2024-01-03', fingerprint: 'fp3', metadata: { unit: 'fraction', family: 'common_denominator' } },
    ];
    const ctx = buildRecentContext(history, { recentWindow: 10, duplicateAvoidanceCount: 5, fingerprintMemory: 300 });
    expect(ctx.familyCounts.get('common_denominator')).toBe(2);
    expect(ctx.fingerprints.has('fp3')).toBe(true);
    expect(ctx.entries[0].problemType).toBe('fraction_common_denominator'); // 最新が先頭
    expect(ctx.consecutiveFamily?.family).toBe('common_denominator');
    expect(ctx.consecutiveFamily?.run).toBe(1); // 最新1問
  });
});

describe('evaluateCandidate', () => {
  it('直近に出題したタイプにはペナルティ', () => {
    const ctx = buildRecentContext(
      [{ problemId: 'h1', problemType: 'fraction_common_denominator', parameters: {}, askedAt: '2024-01-01' }],
      { recentWindow: 10, duplicateAvoidanceCount: 5, fingerprintMemory: 300 },
    );
    const candidate = {
      id: 'p1',
      category: 'fraction',
      type: 'fraction_common_denominator',
      difficulty: { level: 3, components: { calculationComplexity: 3, numberComplexity: 3, reasoningComplexity: 3, readingComplexity: 3 } },
      question: '問',
      answer: { kind: 'fractions' as const, values: [] },
      parameters: { n1: 3, d1: 4, n2: 2, d2: 5 },
    };
    const evalResult = evaluateCandidate(candidate as Problem, ctx);
    expect(evalResult.penalty).toBeGreaterThan(0);
  });

  it('直近と異なる family の候補ほど低ペナルティで上位になる', () => {
    // 直近は通分 (common_denominator) ばかり出した履歴
    const history: QuestionHistory[] = Array.from({ length: 5 }, (_, i) => ({
      problemId: `h${i}`,
      problemType: 'fraction_common_denominator',
      parameters: {},
      askedAt: new Date().toISOString(),
      metadata: { unit: 'fraction', family: 'common_denominator', operation: 'lcm' },
    }));
    const ctx = buildRecentContext(history, { recentWindow: 10, duplicateAvoidanceCount: 5, fingerprintMemory: 300 });

    const makeProblem = (type: string, category: string, params: Record<string, unknown>) =>
      ({
        id: 'x',
        category,
        type,
        difficulty: { level: 3, components: { calculationComplexity: 3, numberComplexity: 3, reasoningComplexity: 3, readingComplexity: 3 } },
        question: '問',
        answer: { kind: 'integer' as const, value: 1 },
        parameters: params,
      }) as Problem;

    const sameFamily = makeProblem('fraction_common_denominator', 'fraction', { n1: 1, d1: 2, n2: 1, d2: 3 });
    const otherFamily = makeProblem('integer_addition', 'integer', { a: 1, b: 2 });

    const ranked = rankCandidates([sameFamily, otherFamily], ctx);
    expect(ranked[0].candidate.type).toBe('integer_addition');
    expect(ranked[0].penalty).toBeLessThan(ranked[1].penalty);

    const best = selectBestCandidate([sameFamily, otherFamily], ctx, DEFAULT_DIVERSITY_CONFIG);
    expect(best?.candidate.type).toBe('integer_addition');
  });

  it('空の候補リストには null を返す', () => {
    const ctx = buildRecentContext([], { recentWindow: 10, duplicateAvoidanceCount: 5, fingerprintMemory: 300 });
    expect(selectBestCandidate([], ctx)).toBeNull();
  });
});

describe('QuestionSelector 多様性統合テスト', () => {
  it('20問生成で family 偏り・重複・連続を抑制する', () => {
    const selector = new QuestionSelector();
    const questionHistory: QuestionHistory[] = [];
    const generatedFamilies: string[] = [];
    const fingerprints = new Map<string, number>();

    for (let i = 0; i < 20; i++) {
      const problem = selector.selectNextQuestion([], questionHistory, {
        difficultyLevel: 3,
        category: null,
      });
      expect(validateProblem(problem).valid, `問題 ${i} 検証失敗`).toBe(true);
      questionHistory.push({
        problemId: problem.id,
        problemType: problem.type,
        parameters: problem.parameters,
        askedAt: new Date().toISOString(),
        metadata: deriveMetadata(problem),
        fingerprint: fingerprintProblem(problem),
      });
      generatedFamilies.push(deriveMetadata(problem).family);
      const fp = fingerprintProblem(problem);
      fingerprints.set(fp, (fingerprints.get(fp) ?? 0) + 1);
    }

    const familyCounts = new Map<string, number>();
    for (const f of generatedFamilies) {
      familyCounts.set(f, (familyCounts.get(f) ?? 0) + 1);
    }
    console.log('Family distribution (20 questions):', Object.fromEntries(familyCounts));

    // family 連続出題5回以上はない
    let maxRun = 0;
    let currentRun = 1;
    for (let i = 1; i < generatedFamilies.length; i++) {
      if (generatedFamilies[i] === generatedFamilies[i - 1]) {
        currentRun++;
        maxRun = Math.max(maxRun, currentRun);
      } else {
        currentRun = 1;
      }
    }
    expect(maxRun).toBeLessThan(5);
    // 重複 (同一フィンガープリント) はない
    let maxDup = 0;
    for (const count of fingerprints.values()) {
      maxDup = Math.max(maxDup, count);
    }
    expect(maxDup).toBeLessThanOrEqual(1);
  }, 30000);

  it('100問生成で難易度が指定値±1の範囲を逸脱しない', () => {
    const selector = new QuestionSelector();
    const questionHistory: QuestionHistory[] = [];

    for (let i = 0; i < 100; i++) {
      const problem = selector.selectNextQuestion([], questionHistory, {
        difficultyLevel: 3,
        category: null,
      });
      expect(validateProblem(problem).valid, `問題 ${i} 検証失敗`).toBe(true);
      expect(problem.difficulty.level).toBeGreaterThanOrEqual(2);
      expect(problem.difficulty.level).toBeLessThanOrEqual(4);
      questionHistory.push({
        problemId: problem.id,
        problemType: problem.type,
        parameters: problem.parameters,
        askedAt: new Date().toISOString(),
        metadata: deriveMetadata(problem),
        fingerprint: fingerprintProblem(problem),
      });
    }
  }, 120000);
});
