/**
 * 通常モードの一連出題を模した統合テスト
 *
 * QuizPage と同じ流れ (出題 → 履歴に fingerprint を記録 → 次の出題) を
 * 30問まわして、直前の問題と同じ問題が続かないことを確認する。
 * ここで確認する価値:
 * - 各問が必ず検証を通過し、解答が提示可能であること
 * - 直前の問題と完全に同一にならないこと
 * - 分野が1つに固定されないこと (分野固定が起きていないこと)
 */

import { describe, expect, it } from 'vitest';
import { FullRandomSelector } from './fullRandomSelector';
import { deriveMetadata, fingerprintProblem } from '../diversity/metadata';
import { validateProblem } from '../validator/validator';
import { formatAnswer, checkUserAnswer } from '../../utils/answer';
import type { QuestionHistory } from '../../types/history';

const selector = new FullRandomSelector();
const request = { mode: { kind: 'full-random' } as const, difficulty: 2 as const };

describe('通常モードのセッション (30問)', () => {
  it('全問が検証を通過し、直前と同一問題にならない', () => {
    const questionHistory: QuestionHistory[] = [];

    for (let i = 0; i < 30; i++) {
      const problem = selector.selectNextQuestion([], questionHistory, request);

      const result = validateProblem(problem);
      expect(result.valid, `${i}問目 ${problem.type}: ${result.errors.join(', ')}`).toBe(true);

      // 提示された正解はそのまま入力すれば正解判定される
      const shown = formatAnswer(problem.answer);
      expect(checkUserAnswer(shown, problem.answer), `${i}問目 ${problem.type}: ${shown}`).toBe(true);

      const previous = questionHistory[questionHistory.length - 1];
      if (previous?.fingerprint) {
        expect(
          fingerprintProblem(problem),
          `${i}問目が直前と同じ問題: ${problem.type}`,
        ).not.toBe(previous.fingerprint);
      }

      // QuizPage と同じ形で履歴に積む
      questionHistory.push({
        problemId: problem.id,
        problemType: problem.type,
        parameters: problem.parameters,
        askedAt: new Date(i * 1000).toISOString(),
        metadata: deriveMetadata(problem),
        fingerprint: fingerprintProblem(problem),
      });
    }

    expect(questionHistory).toHaveLength(30);
  });

  it('30問で複数の分野・複数の問題タイプが出題される (分野固定にならない)', () => {
    const questionHistory: QuestionHistory[] = [];
    const types = new Set<string>();

    for (let i = 0; i < 30; i++) {
      const problem = selector.selectNextQuestion([], questionHistory, request);
      types.add(problem.type);
      questionHistory.push({
        problemId: problem.id,
        problemType: problem.type,
        parameters: problem.parameters,
        askedAt: new Date(i * 1000).toISOString(),
    // request.difficulty は通常モードでは選出条件に使わない。
    // (指定難易度が母集団の絞り込みに混ざらないことを明示しておく)
      });
    }

    // 30問で1〜2種類しか出ないのは異様な偏りなので失敗とする
    expect(types.size, `出現した問題タイプ数: ${types.size}`).toBeGreaterThan(5);
  });
});
