/**
 * 1セッションの問題数カウント (解いた問題数) のテスト
 *
 * 確定仕様の検証表:
 * | ケース                       | 解いた問題数への加算 |
 * | 時間内に正答                 | +1 |
 * | 時間内に誤答                 | +1 |
 * | 時間切れ                     | +0 |
 * | 時間切れ後に解説を確認       | +0 |
 * | 時間切れ処理が二重に発生     | 最大でも +0 |
 * | 時間内の解答処理が二重に発生 | 最大でも +1 |
 */

import { describe, expect, it } from 'vitest';
import { applyOutcome, createSessionTally, toSessionCounts } from './sessionTally';

describe('applyOutcome: 解いた問題数への加算', () => {
  it('時間内に正答 → +1', () => {
    const next = applyOutcome(createSessionTally(), 'q1', {
      timedOut: false,
      correct: true,
      answerTimeSec: 8,
    });
    expect(next.solvedCount).toBe(1);
    expect(next.correctCount).toBe(1);
    expect(next.totalCount).toBe(1);
    expect(next.timedOutCount).toBe(0);
  });

  it('時間内に誤答 → +1', () => {
    const next = applyOutcome(createSessionTally(), 'q1', {
      timedOut: false,
      correct: false,
      answerTimeSec: 12,
    });
    expect(next.solvedCount).toBe(1);
    expect(next.correctCount).toBe(0);
    expect(next.totalCount).toBe(1);
    expect(next.timedOutCount).toBe(0);
  });

  it('時間切れ → +0 (ただし出題数・時間切れ数は増える)', () => {
    const next = applyOutcome(createSessionTally(), 'q1', {
      timedOut: true,
      correct: false,
      answerTimeSec: 30,
    });
    expect(next.solvedCount).toBe(0);
    expect(next.correctCount).toBe(0);
    expect(next.totalCount).toBe(1);
    expect(next.timedOutCount).toBe(1);
  });
});

describe('applyOutcome: 時間切れ後に解説を確認しても加算しない', () => {
  it('時間切れ後の再適用 (解説確認・再送信の模擬) でも解いた問題数は0のまま', () => {
    const timedOut = applyOutcome(createSessionTally(), 'q1', {
      timedOut: true,
      correct: false,
      answerTimeSec: 30,
    });
    // 解説を確認する行為は解答を再送しない。仮に同一キーで再適用されても増えない。
    const afterExplanation = applyOutcome(timedOut, 'q1', {
      timedOut: true,
      correct: false,
      answerTimeSec: 30,
    });
    expect(afterExplanation.solvedCount).toBe(0);
    // 二重加算されていない (出題数・時間切れ数も1のまま)
    expect(afterExplanation.totalCount).toBe(1);
    expect(afterExplanation.timedOutCount).toBe(1);
  });
});

describe('applyOutcome: 二重発生のガード', () => {
  it('時間切れ処理が二重に発生 → 解いた問題数は最大でも+0', () => {
    let tally = createSessionTally();
    tally = applyOutcome(tally, 'q1', { timedOut: true, correct: false, answerTimeSec: 30 });
    tally = applyOutcome(tally, 'q1', { timedOut: true, correct: false, answerTimeSec: 30 });
    expect(tally.solvedCount).toBe(0);
    // 加算系すべて二重されない
    expect(tally.totalCount).toBe(1);
    expect(tally.timedOutCount).toBe(1);
  });

  it('時間内の解答処理が二重に発生 → 解いた問題数は最大でも+1', () => {
    let tally = createSessionTally();
    tally = applyOutcome(tally, 'q1', { timedOut: false, correct: true, answerTimeSec: 8 });
    tally = applyOutcome(tally, 'q1', { timedOut: false, correct: true, answerTimeSec: 8 });
    expect(tally.solvedCount).toBe(1);
    expect(tally.correctCount).toBe(1);
    expect(tally.totalCount).toBe(1);
  });

  it('時間切れと解答送信の競合 (異なる結果で同一キー) も二重加算しない', () => {
    let tally = createSessionTally();
    // 時間切れが先に成立し、その後に解答経路が同じ問題で発火する状況を模擬
    tally = applyOutcome(tally, 'q1', { timedOut: true, correct: false, answerTimeSec: 30 });
    tally = applyOutcome(tally, 'q1', { timedOut: false, correct: true, answerTimeSec: 5 });
    expect(tally.solvedCount).toBe(0); // 最初の成立 (時間切れ) のまま
    expect(tally.totalCount).toBe(1);
  });

  it('別々の問題はそれぞれ加算される', () => {
    let tally = createSessionTally();
    tally = applyOutcome(tally, 'q1', { timedOut: false, correct: true, answerTimeSec: 8 });
    tally = applyOutcome(tally, 'q2', { timedOut: false, correct: false, answerTimeSec: 12 });
    tally = applyOutcome(tally, 'q3', { timedOut: true, correct: false, answerTimeSec: 30 });
    expect(tally.solvedCount).toBe(2); // q1, q2 (q3は時間切れで除外)
    expect(tally.correctCount).toBe(1);
    expect(tally.timedOutCount).toBe(1);
    expect(tally.totalCount).toBe(3);
  });
});

describe('正答率の分母は既存仕様どおり (時間切れを誤答として含む)', () => {
  it('時間切れを含めて正答率 = 正答数 / 出題数', () => {
    let tally = createSessionTally();
    tally = applyOutcome(tally, 'q1', { timedOut: false, correct: true, answerTimeSec: 8 });
    tally = applyOutcome(tally, 'q2', { timedOut: true, correct: false, answerTimeSec: 30 });
    const counts = toSessionCounts(tally);
    // 解いた問題数は1だが、正答率の分母は出題数2 (時間切れを誤答として含める)
    expect(counts.solvedCount).toBe(1);
    expect(counts.totalCount).toBe(2);
    expect(counts.correctCount / counts.totalCount).toBeCloseTo(0.5);
  });
});

describe('toSessionCounts', () => {
  it('内部フィールド (countedKeys) を除いた表示用カウントを返す', () => {
    const tally = applyOutcome(createSessionTally(), 'q1', {
      timedOut: false,
      correct: true,
      answerTimeSec: 8,
    });
    const counts = toSessionCounts(tally);
    expect(counts).toEqual({
      totalCount: 1,
      solvedCount: 1,
      correctCount: 1,
      timedOutCount: 0,
      totalTimeSec: 8,
    });
    expect('countedKeys' in counts).toBe(false);
  });
});
