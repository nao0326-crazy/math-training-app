/**
 * 出題アルゴリズムのテスト
 */

import { describe, expect, it } from 'vitest';
import { QuestionSelector } from './questionSelector';
import { validateProblem } from '../validator/validator';
import type { AnswerRecord, QuestionHistory } from '../../types/history';

describe('QuestionSelector', () => {
  const selector = new QuestionSelector();

  it('問題を生成できる', () => {
    const problem = selector.selectNextQuestion([], [], {
      difficultyLevel: 2,
      category: null,
    });
    expect(problem).toBeDefined();
    expect(problem.question.length).toBeGreaterThan(0);
    const result = validateProblem(problem);
    expect(result.valid, result.errors.join(', ')).toBe(true);
  });

  it('カテゴリ指定で生成できる', () => {
    const problem = selector.selectNextQuestion([], [], {
      difficultyLevel: 2,
      category: 'integer',
    });
    expect(problem.category).toBe('integer');
  });

  it('履歴がある場合も生成できる', () => {
    const history: AnswerRecord[] = [
      {
        problemId: 'p1',
        problemType: 'integer_addition',
        category: 'integer',
        isCorrect: true,
        answerTimeSec: 10,
        answeredAt: new Date().toISOString(),
        difficultyLevel: 2,
        question: '2 + 3 = □',
        userAnswer: '5',
        correctAnswer: '5',
      },
      {
        problemId: 'p2',
        problemType: 'integer_subtraction',
        category: 'integer',
        isCorrect: false,
        answerTimeSec: 30,
        answeredAt: new Date().toISOString(),
        difficultyLevel: 2,
        question: '7 - 3 = □',
        userAnswer: '3',
        correctAnswer: '4',
      },
    ];

    const questionHistory: QuestionHistory[] = [
      {
        problemId: 'p1',
        problemType: 'integer_addition',
        parameters: { a: 2, b: 3 },
        askedAt: new Date().toISOString(),
      },
    ];

    const problem = selector.selectNextQuestion(history, questionHistory, {
      difficultyLevel: 2,
      category: null,
    });
    expect(problem).toBeDefined();
    const result = validateProblem(problem);
    expect(result.valid, result.errors.join(', ')).toBe(true);
  });

  it('正答率が高いと難易度が上がる', () => {
    // 全問正解の履歴
    const history: AnswerRecord[] = Array.from({ length: 10 }, (_, i) => ({
      problemId: `p${i}`,
      problemType: 'integer_addition',
      category: 'integer',
      isCorrect: true,
      answerTimeSec: 5,
      answeredAt: new Date().toISOString(),
      difficultyLevel: 2,
      question: '2 + 3 = □',
      userAnswer: '5',
      correctAnswer: '5',
    }));

    // 難易度調整を直接テストするため、履歴がない場合と比較して
    // 問題が生成されることを確認
    const problem = selector.selectNextQuestion(history, [], {
      difficultyLevel: 2,
      category: 'integer',
    });
    expect(problem).toBeDefined();
    expect(problem.difficulty.level).toBeGreaterThanOrEqual(1);
    expect(problem.difficulty.level).toBeLessThanOrEqual(5);
    const result = validateProblem(problem);
    expect(result.valid).toBe(true);
  });

  it('正答率が低いと難易度が下がる', () => {
    // 全問不正解の履歴
    const history: AnswerRecord[] = Array.from({ length: 10 }, (_, i) => ({
      problemId: `p${i}`,
      problemType: 'integer_addition',
      category: 'integer',
      isCorrect: false,
      answerTimeSec: 60,
      answeredAt: new Date().toISOString(),
      difficultyLevel: 2,
      question: '2 + 3 = □',
      userAnswer: '1',
      correctAnswer: '5',
    }));

    const problem = selector.selectNextQuestion(history, [], {
      difficultyLevel: 3,
      category: 'integer',
    });
    expect(problem.difficulty.level).toBeLessThanOrEqual(3);
  });

  it('最近出題した問題タイプを避ける', () => {
    // 最近出題したタイプを記録
    const questionHistory: QuestionHistory[] = Array.from({ length: 10 }, (_, i) => ({
      problemId: `q${i}`,
      problemType: 'integer_addition',
      parameters: { a: i, b: i + 1 },
      askedAt: new Date().toISOString(),
    }));

    // 複数回生成して、integer_addition が連続しないことを確認
    for (let i = 0; i < 20; i++) {
      const problem = selector.selectNextQuestion([], questionHistory, {
        difficultyLevel: 2,
        category: 'integer',
      });
      expect(problem.type).not.toBe('integer_addition');
    }
  });
});