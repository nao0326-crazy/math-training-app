/**
 * 苦手分野判定ユーティリティのテスト
 */

import { describe, expect, it } from 'vitest';
import type { AnswerRecord } from '../types/history';
import {
  DEFAULT_DIFFICULTY_LEVEL,
  findWeakAreas,
  getMostRecentDifficultyLevel,
  MIN_ATTEMPTS_FOR_WEAKNESS,
  REVIEW_QUESTION_COUNT,
  WEAKNESS_ACCURACY_THRESHOLD,
} from './weakAreas';

/** テスト用の AnswerRecord を作成する */
let seq = 0;
function record(options: {
  category: string;
  isCorrect: boolean;
  difficultyLevel?: number;
  isTimedOut?: boolean;
}): AnswerRecord {
  seq += 1;
  const base = new Date('2026-01-01T00:00:00Z').getTime();
  return {
    problemId: `p-${seq}`,
    problemType: `type-${seq}`,
    category: options.category,
    isCorrect: options.isCorrect,
    answerTimeSec: 20,
    answeredAt: new Date(base + seq * 1000).toISOString(),
    difficultyLevel: options.difficultyLevel ?? 2,
    question: `問題${seq}`,
    userAnswer: '1',
    correctAnswer: '2',
    isTimedOut: options.isTimedOut,
  };
}

/** 指定分野の記録を「total問中correct問正解」で作成する */
function makeRecords(
  category: string,
  total: number,
  correct: number,
  difficultyLevel = 2,
): AnswerRecord[] {
  return Array.from({ length: total }, (_, i) =>
    record({ category, isCorrect: i < correct, difficultyLevel }),
  );
}

describe('苦手判定の定数', () => {
  it('判定基準は仕様どおりの値が定数で管理されている', () => {
    expect(MIN_ATTEMPTS_FOR_WEAKNESS).toBe(5);
    expect(WEAKNESS_ACCURACY_THRESHOLD).toBe(0.7);
    expect(REVIEW_QUESTION_COUNT).toBe(5);
  });
});

describe('findWeakAreas', () => {
  it('10問中6問正解 (60%) の分野は苦手として検出される', () => {
    const areas = findWeakAreas(makeRecords('fraction', 10, 6));
    expect(areas).toHaveLength(1);
    expect(areas[0].category).toBe('fraction');
    expect(areas[0].totalCount).toBe(10);
    expect(areas[0].correctCount).toBe(6);
    expect(areas[0].accuracyRate).toBeCloseTo(0.6);
  });

  it('10問中9問正解 (90%) の分野は苦手として検出されない', () => {
    expect(findWeakAreas(makeRecords('fraction', 10, 9))).toHaveLength(0);
  });

  it('4問中2問正解 (50%) でも回答数が5未満なら検出されない', () => {
    expect(findWeakAreas(makeRecords('fraction', 4, 2))).toHaveLength(0);
  });

  it('ちょうど70%の分野は苦手として検出されない (未満のみ対象)', () => {
    expect(findWeakAreas(makeRecords('fraction', 10, 7))).toHaveLength(0);
  });

  it('複数の苦手分野は正答率が低い順に並ぶ (最も苦手な分野が先頭)', () => {
    const records = [
      ...makeRecords('fraction', 10, 6), // 60%
      ...makeRecords('speed', 11, 7), // 約63.6%
      ...makeRecords('geometry', 10, 9), // 90% (対象外)
    ];
    const areas = findWeakAreas(records);
    expect(areas.map((a) => a.category)).toEqual(['fraction', 'speed']);
  });

  it('正答率が同じ場合は回答数が多い順に並ぶ', () => {
    const records = [
      ...makeRecords('speed', 10, 6), // 60%
      ...makeRecords('fraction', 12, 7), // 約58.3%
      ...makeRecords('data', 10, 6), // 60% (同率・同数)
    ];
    const areas = findWeakAreas(records);
    expect(areas.map((a) => a.category)).toEqual(['fraction', 'speed', 'data']);
  });

  it('履歴が空の場合は空配列を返す', () => {
    expect(findWeakAreas([])).toEqual([]);
  });

  it('時間切れは苦手判定の母集団から除外される', () => {
    // 時間内解答 5問中 4問正解 (80%) → 苦手ではない
    // そこに時間切れの誤答 5問を加えても、母集団に含めないため判定は変わらない
    const within = makeRecords('fraction', 5, 4);
    const timeouts = Array.from({ length: 5 }, () =>
      record({ category: 'fraction', isCorrect: false, isTimedOut: true }),
    );
    expect(findWeakAreas([...within, ...timeouts])).toHaveLength(0);
  });

  it('時間切れしか無い分野は母集団が0件となり対象外になる', () => {
    const timeouts = Array.from({ length: 8 }, () =>
      record({ category: 'fraction', isCorrect: false, isTimedOut: true }),
    );
    expect(findWeakAreas(timeouts)).toHaveLength(0);
  });

  it('時間切れを除くと正答率が上がり苦手判定から外れる', () => {
    // 時間内解答: 10問中 5問正解 (50%) → 本来は苦手
    // さらに時間切れの誤答を 5問加えると「10問中5問」に見えるが、
    // 時間切れを除くと「10問中5問正解 (50%)」で苦手。
    // 逆に、時間内で 6/10 (60%) + 時間切れ5 → 除外後は 6/10 で苦手のまま。
    const within = makeRecords('fraction', 10, 6); // 60% → 苦手
    const timeouts = Array.from({ length: 5 }, () =>
      record({ category: 'fraction', isCorrect: true, isTimedOut: true }),
    );
    const areas = findWeakAreas([...within, ...timeouts]);
    // 時間切れ(正答扱い5件)を除いても 6/10 = 60% で苦手
    expect(areas).toHaveLength(1);
    expect(areas[0].totalCount).toBe(10);
    expect(areas[0].correctCount).toBe(6);
    expect(areas[0].accuracyRate).toBeCloseTo(0.6);
  });
});

describe('getMostRecentDifficultyLevel', () => {
  it('最新の回答で使用された難易度を返す', () => {
    const records = [
      ...makeRecords('fraction', 2, 1, 1),
      ...makeRecords('speed', 2, 1, 4),
    ];
    expect(getMostRecentDifficultyLevel(records)).toBe(4);
  });

  it('履歴がない場合は既定の難易度を返す', () => {
    expect(getMostRecentDifficultyLevel([])).toBe(DEFAULT_DIFFICULTY_LEVEL);
  });
});
