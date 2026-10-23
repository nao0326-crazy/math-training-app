/**
 * 絞り込み指定セレクター (FilteredSelector) のテスト
 *
 * 管理者モードの入口。指定 Worked correctly ことを確認する:
 * - 条件があればその条件の母集団から出る
 * - 条件が空なら通常モード (完全ランダム) と同一
 * - 矛盾する条件は EmptyQuestionPoolError
 */

import { describe, expect, it } from 'vitest';
import { FilteredSelector } from './filteredSelector';
import { EmptyQuestionPoolError, filterQuestionPool } from './questionPool';
import { validateProblem } from '../validator/validator';
import { fingerprintProblem, getTypeSupportedLevels } from '../diversity/metadata';
import type { QuestionFilter } from './questionPool';
import type { Problem } from '../../types/problem';
import type { AnswerRecord, QuestionHistory } from '../../types/history';

/** 条件から出る問題の集合 (充分な試行数) */
function sample(filter: QuestionFilter, times = 60): Problem[] {
  const selector = new FilteredSelector(filter);
  const problems: Problem[] = [];
  for (let i = 0; i < times; i++) {
    problems.push(selector.selectNextQuestion([], []));
  }
  return problems;
}

describe('FilteredSelector: 条件付き出題', () => {
  it('分野を指定するとその分野だけから出る', () => {
    for (const p of sample({ category: 'fraction' })) {
      expect(p.category).toBe('fraction');
      expect(validateProblem(p).valid).toBe(true);
    }
  });

  it('学年を指定するとその学年の型だけから出る', () => {
    const grade6Types = new Set(
      filterQuestionPool({ grade: 6 }).map((e) => e.type),
    );
    for (const p of sample({ grade: 6 })) {
      expect(grade6Types.has(p.type), `grade6 に含まれない型: ${p.type}`).toBe(true);
    }
  });

  it('問題タイプを指定するとその型だけから出る', () => {
    for (const p of sample({ type: 'fraction_reduce', difficulty: 2 })) {
      expect(p.type).toBe('fraction_reduce');
      expect(p.difficulty.level).toBe(2);
    }
  });

  it('難易度を指定するとその難易度の問題になる', () => {
    for (const p of sample({ category: 'integer', difficulty: 3 })) {
      expect(p.category).toBe('integer');
      expect(p.difficulty.level).toBe(3);
    }
  });

  it('条件の積 (分野と学年) を両方満たす', () => {
    const types = new Set(filterQuestionPool({ category: 'geometry', grade: 5 }).map((e) => e.type));
    if (types.size === 0) return;
    for (const p of sample({ category: 'geometry', grade: 5 })) {
      expect(types.has(p.type)).toBe(true);
    }
  });

  it('条件が空なら通常モードと同じ完全ランダム (複数分野が出る)', () => {
    const categories = new Set(sample({}).map((p) => p.category));
    expect(categories.size).toBeGreaterThan(2);
  });
});

describe('FilteredSelector: セッション内の重複抑制', () => {
  /** 直近に出た問題の fingerprint を持つ QuestionHistory を作る */
  function historyOf(problems: Problem[]): QuestionHistory[] {
    return problems.map((p, i) => ({
      problemId: p.id,
      problemType: p.type,
      parameters: p.parameters,
      askedAt: new Date(Date.UTC(2026, 0, 1, 0, 0, i)).toISOString(),
      fingerprint: fingerprintProblem(p),
    }));
  }

  it('直前に出た問題と同一フィンガープリントなら引き直す', () => {
    // 同一 (type, difficulty) で母集団を固定し、直前履歴をその母集団の
    // 1問目に一致させる → 次の出題はその問題を避けなければならない。
    const filter: QuestionFilter = { type: 'fraction_reduce', difficulty: 2 };
    const first = sample(filter, 1)[0];
    // 同じ問題が連続で出るかを、直前履歴にその問題を入れて試す
    const selector = new FilteredSelector(filter);
    const problem = selector.selectNextQuestion([], historyOf([first]));
    expect(fingerprintProblem(problem)).not.toBe(fingerprintProblem(first));
  });

  it('複数回の抽選で直前問題を避ける (母集団が2種以上なら必ず別問題)', () => {
    const filter: QuestionFilter = { category: 'fraction', difficulty: 2 };
    const selector = new FilteredSelector(filter);
    // 50 回連続で「直前の問題」と同じものが出ないこと
    let prev = sample(filter, 1)[0];
    for (let i = 0; i < 50; i++) {
      const next = selector.selectNextQuestion([], historyOf([prev]));
      expect(
        fingerprintProblem(next),
        `試行${i}で直前の問題と同一`,
      ).not.toBe(fingerprintProblem(prev));
      prev = next;
    }
  });

  it('候補空間が1問しかない場合は絞り込みを壊さず出題を継続する', () => {
    // 1問しか存在しない母集団では重複回避が不可能。従来どおり出題できることを確認。
    const filter: QuestionFilter = { type: 'fraction_reduce', difficulty: 1 };
    const selector = new FilteredSelector(filter);
    // 履歴が空でも例外なく出る
    expect(() => selector.selectNextQuestion([], [])).not.toThrow();
    const p = selector.selectNextQuestion([], []);
    expect(p.type).toBe('fraction_reduce');
  });
});

describe('FilteredSelector: 条件が成立しない場合', () => {
  it('母集団が空になる条件は EmptyQuestionPoolError', () => {
    const selector = new FilteredSelector({ category: 'fraction', grade: 1 });
    expect(() => selector.selectNextQuestion([], [])).toThrow(EmptyQuestionPoolError);
  });
});

describe('FilteredSelector: 習熟度ベースの出題レベル', () => {
  /** 技能 type で level を n 問正解した履歴を作る */
  function stableHistory(type: string, level: number, n: number): AnswerRecord[] {
    return Array.from({ length: n }, (_, index) => ({
      problemId: `${type}-${level}-${index}`,
      problemType: type,
      category: 'fraction',
      isCorrect: true,
      answerTimeSec: 10,
      answeredAt: new Date(Date.UTC(2026, 0, 1, 0, 0, index)).toISOString(),
      difficultyLevel: level,
      question: 'question',
      userAnswer: 'answer',
      correctAnswer: 'answer',
    }));
  }

  /** 技能 type で level を n 問不正解した履歴を作る */
  function failingHistory(type: string, level: number, n: number): AnswerRecord[] {
    return stableHistory(type, level, n).map((record) => ({
      ...record,
      isCorrect: false,
    }));
  }

  const TYPE = 'fraction_add_sub';

  it('履歴が無いときは対象型の最下位レベル (基礎) から出題する', () => {
    const selector = new FilteredSelector({ types: [TYPE] });
    const lowest = Math.min(...getTypeSupportedLevels(TYPE));
    for (let i = 0; i < 8; i++) {
      const problem = selector.selectNextQuestion([], []);
      expect(problem.type).toBe(TYPE);
      expect(problem.difficulty.level).toBe(lowest);
    }
  });

  it('レベル2を安定して解めばレベル3を出題する (習熟 + 1)', () => {
    // 前提: この型は Lv3 に対応している (未宣言なら Lv1〜5)
    expect(getTypeSupportedLevels(TYPE)).toContain(3);
    const selector = new FilteredSelector({ types: [TYPE] });
    const history = stableHistory(TYPE, 2, 5);
    for (let i = 0; i < 8; i++) {
      const problem = selector.selectNextQuestion(history, []);
      expect(problem.difficulty.level, `${i}問目が想定外`).toBe(3);
    }
  });

  it('目標レベルで繰り返し不正解すると出題レベルが下がる', () => {
    const selector = new FilteredSelector({ types: [TYPE] });
    const history = [
      ...stableHistory(TYPE, 2, 5),
      ...failingHistory(TYPE, 3, 5),
    ];
    const problem = selector.selectNextQuestion(history, []);
    // 習熟 2 → 1 に下がり、出題目標も 3 → 2 になる
    expect(problem.difficulty.level).toBe(2);
  });

  it('最高レベルで習熟しても存在しないレベルを出さない', () => {
    const selector = new FilteredSelector({ types: [TYPE] });
    const history = stableHistory(TYPE, 5, 6);
    for (let i = 0; i < 5; i++) {
      const problem = selector.selectNextQuestion(history, []);
      expect(problem.difficulty.level).toBe(5);
    }
  });

  it('filter.difficulty の明示指定は習熟度より優先される', () => {
    const selector = new FilteredSelector({ types: [TYPE], difficulty: 4 });
    const history = stableHistory(TYPE, 2, 5);
    const problem = selector.selectNextQuestion(history, []);
    expect(problem.difficulty.level).toBe(4);
  });

  it('filter.difficultyRange が条件にある場合はその範囲内に収まる (エンジン互換)', () => {
    const selector = new FilteredSelector({
      types: [TYPE],
      difficultyRange: { min: 2, max: 3 },
    });
    // 履歴なし (習熟0) → 範囲の最下位から開始
    for (let i = 0; i < 6; i++) {
      const problem = selector.selectNextQuestion([], []);
      expect(problem.difficulty.level).toBe(2);
    }
    // 習熟4 でも範囲上限を超えない
    const advanced = selector.selectNextQuestion(stableHistory(TYPE, 4, 5), []);
    expect(advanced.difficulty.level).toBe(3);
  });
});
