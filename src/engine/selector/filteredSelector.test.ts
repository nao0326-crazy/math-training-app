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
import { fingerprintProblem } from '../diversity/metadata';
import type { QuestionFilter } from './questionPool';
import type { Problem } from '../../types/problem';
import type { QuestionHistory } from '../../types/history';

const request = { mode: { kind: 'full-random' } as const, difficulty: 2 as const };

/** 条件から出る問題の集合 (充分な試行数) */
function sample(filter: QuestionFilter, times = 60): Problem[] {
  const selector = new FilteredSelector(filter);
  const problems: Problem[] = [];
  for (let i = 0; i < times; i++) {
    problems.push(selector.selectNextQuestion([], [], request));
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
    const request = { mode: { kind: 'full-random' } as const, difficulty: 2 as const };
    const problem = selector.selectNextQuestion([], historyOf([first]), request);
    expect(fingerprintProblem(problem)).not.toBe(fingerprintProblem(first));
  });

  it('複数回の抽選で直前問題を避ける (母集団が2種以上なら必ず別問題)', () => {
    const filter: QuestionFilter = { category: 'fraction', difficulty: 2 };
    const request = { mode: { kind: 'full-random' } as const, difficulty: 2 as const };
    const selector = new FilteredSelector(filter);
    // 50 回連続で「直前の問題」と同じものが出ないこと
    let prev = sample(filter, 1)[0];
    for (let i = 0; i < 50; i++) {
      const next = selector.selectNextQuestion([], historyOf([prev]), request);
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
    const request = { mode: { kind: 'full-random' } as const, difficulty: 1 as const };
    // 履歴が空でも例外なく出る
    expect(() => selector.selectNextQuestion([], [], request)).not.toThrow();
    const p = selector.selectNextQuestion([], [], request);
    expect(p.type).toBe('fraction_reduce');
  });
});

describe('FilteredSelector: 条件が成立しない場合', () => {
  it('母集団が空になる条件は EmptyQuestionPoolError', () => {
    const selector = new FilteredSelector({ category: 'fraction', grade: 1 });
    expect(() => selector.selectNextQuestion([], [], request)).toThrow(EmptyQuestionPoolError);
  });
});
