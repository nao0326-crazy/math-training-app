/**
 * 分野別・適応難易度 (adaptiveDifficulty) のテスト
 *
 * 設計上の要点をそのままテストにする:
 * - 履歴が無ければ初期 Lv2
 * - 1問の結果では動かない (最低 MIN_SAMPLE_ATTEMPTS 問)
 * - 分野ごとに独立して評価される (別の分野の成績は影響しない)
 * - 正答率に応じて ±1 で動く (上下限 1〜5)
 * - その分野に生成できる難易度へ丸める
 * - 評価は直近 EVALUATION_WINDOW 問だけ (古い履歴は外れる)
 */

import { describe, expect, it } from 'vitest';
import type { AnswerRecord } from '../types/history';
import type { DifficultyLevel } from '../types/problem';
import { buildQuestionPool } from '../engine/selector/questionPool';
import { getCurriculumScope } from '../engine/curriculum/curriculumScope';
import {
  EVALUATION_WINDOW,
  INITIAL_ADAPTIVE_DIFFICULTY,
  MIN_SAMPLE_ATTEMPTS,
  areaOfProblemType,
  decideAdaptiveDifficulty,
  evaluationWindow,
  levelStats,
  listLearningAreas,
  snapToAvailableLevel,
} from './adaptiveDifficulty';

const ALL: DifficultyLevel[] = [1, 2, 3, 4, 5];

let seq = 0;
function answer(
  problemType: string,
  difficultyLevel: DifficultyLevel,
  isCorrect: boolean,
): AnswerRecord {
  seq += 1;
  return {
    problemId: `p${seq}`,
    problemType,
    category: 'integer',
    isCorrect,
    answerTimeSec: 5,
    answeredAt: new Date(Date.UTC(2026, 0, 1, 0, 0, seq)).toISOString(),
    difficultyLevel,
    question: '',
    userAnswer: '',
    correctAnswer: '',
    submissionId: `s${seq}`,
  };
}

const corrects = (type: string, level: DifficultyLevel, n: number): AnswerRecord[] =>
  Array.from({ length: n }, () => answer(type, level, true));

const wrongs = (type: string, level: DifficultyLevel, n: number): AnswerRecord[] =>
  Array.from({ length: n }, () => answer(type, level, false));

/** 指定分野に属する問題タイプを1つ拾う */
function typeInArea(area: string): string {
  const entry = buildQuestionPool().find((e) => getCurriculumScope(e.type)?.area === area);
  if (!entry) throw new Error(`分野が見つからない: ${area}`);
  return entry.type;
}

describe('listLearningAreas / areaOfProblemType', () => {
  it('母集団に登場する分野を重複なしで返す', () => {
    const areas = listLearningAreas();
    expect(areas.length).toBeGreaterThan(0);
    expect(new Set(areas).size).toBe(areas.length);
    expect(areas).toContain('図形');
    expect(areas).toContain('数と計算');
    // 数量の関係は generator が1件でも統合せず別ボタンとして残す
    expect(areas).toContain('数量の関係');
    // 数量と関係の法則も独立分野として存在する (数量の関係と統合しない)
    expect(areas).toContain('数量と関係の法則');
    expect(areas).not.toContain('数量と関係');
  });

  it('問題タイプから分野を引ける (未登録の型は null)', () => {
    expect(areaOfProblemType(typeInArea('図形'))).toBe('図形');
    expect(areaOfProblemType('未登録のproblem_type_xyz')).toBeNull();
  });
});

describe('decideAdaptiveDifficulty', () => {
  const area = '図形';
  const type = typeInArea(area);

  it('履歴が無ければ初期難易度 (Lv2)', () => {
    expect(INITIAL_ADAPTIVE_DIFFICULTY).toBe(2);
    expect(decideAdaptiveDifficulty(area, [], ALL)).toBe(2);
  });

  it('1問の正解・不正解では難易度が動かない', () => {
    expect(decideAdaptiveDifficulty(area, [answer(type, 2, true)], ALL)).toBe(2);
    expect(decideAdaptiveDifficulty(area, [answer(type, 2, false)], ALL)).toBe(2);
  });

  it('現在の難易度で5問正解が続いたら Lv3 へ上がる', () => {
    const records = corrects(type, 2, 5);
    expect(decideAdaptiveDifficulty(area, records, ALL)).toBe(3);
  });

  it('正答率が低いと下がる (Lv2 → Lv1)', () => {
    const records = [answer(type, 2, true), ...wrongs(type, 2, 5)];
    expect(decideAdaptiveDifficulty(area, records, ALL)).toBe(1);
  });

  it('上がった先の難易度が低成績なら留まらない (Lv2 良好 / Lv3 低成績 → Lv2)', () => {
    const records = [...corrects(type, 2, 5), ...wrongs(type, 3, 5)];
    expect(decideAdaptiveDifficulty(area, records, ALL)).toBe(2);
  });

  it('分野ごとに独立して評価される', () => {
    const strongType = typeInArea('図形');
    const weakType = typeInArea('数と計算');
    const records = [
      ...corrects(strongType, 2, 5),
      answer(weakType, 2, true),
      ...wrongs(weakType, 2, 5),
    ];
    expect(decideAdaptiveDifficulty('図形', records, ALL)).toBe(3);
    expect(decideAdaptiveDifficulty('数と計算', records, ALL)).toBe(1);
  });

  it('昇降は ±1 の連鎖で、上下限 (1〜5) を超えない', () => {
    const high = [...corrects(type, 2, 5), ...corrects(type, 3, 5), ...corrects(type, 4, 5)];
    expect(decideAdaptiveDifficulty(area, high, ALL)).toBe(5);
    expect(decideAdaptiveDifficulty(area, wrongs(type, 2, 6), ALL)).toBe(1);
  });

  it('その分野に生成できない難易度には丸める', () => {
    // 履歴なしの初期2 は [3,4,5] の最寄りである 3 へ
    expect(decideAdaptiveDifficulty(area, [], [3, 4, 5])).toBe(3);
    // 成績が良くても、生成できない難易度へは上がらない
    expect(decideAdaptiveDifficulty(area, corrects(type, 2, 5), [1, 2])).toBe(2);
  });

  it('snapToAvailableLevel は最寄りへ (同距離なら低い方)', () => {
    expect(snapToAvailableLevel(2, [3, 4, 5])).toBe(3);
    expect(snapToAvailableLevel(4, [1, 2])).toBe(2);
    expect(snapToAvailableLevel(3, [1, 5])).toBe(1);
    expect(snapToAvailableLevel(3, [1, 2, 4, 5])).toBe(2);
    expect(snapToAvailableLevel(9, [1, 5])).toBe(5);
    expect(snapToAvailableLevel(0, [1, 5])).toBe(1);
  });

  it('評価は直近 EVALUATION_WINDOW 問だけ (古い履歴は評価から外れる)', () => {
    // 古い Lv3 の不振履歴があっても、直近 EVALUATION_WINDOW 問が
    // すべて Lv2 の良好成績なら、再び Lv3 へ挑戦できる
    const old = wrongs(type, 3, 6);
    const recent = corrects(type, 2, EVALUATION_WINDOW);
    expect(decideAdaptiveDifficulty(area, [...old, ...recent], ALL)).toBe(3);

    // 直近に Lv3 の不振が残っている場合は、上がった先から下がる
    const mixed = [...corrects(type, 2, 5), ...wrongs(type, 3, 5)];
    expect(evaluationWindow(area, mixed).length).toBe(10);
    expect(decideAdaptiveDifficulty(area, mixed, ALL)).toBe(2);
  });

  it('評価窓はその分野の回答だけを数える (他の分野は混ざらない)', () => {
    const own = corrects(type, 2, 3);
    const other = wrongs(typeInArea('データの活用'), 2, 10);
    const window = evaluationWindow(area, [...own, ...other]);
    expect(window.length).toBe(3);
    expect(window.every((r) => r.problemType === type)).toBe(true);
  });

  it('回答が蓄積されるたびに次問の難易度が再評価される (QuizPageの実経路)', () => {
    // QuizPage は回答確定のたびに historyRef へ追加し、その最新履歴で
    // 次問の selectNextQuestion → decideAdaptiveDifficulty を呼ぶ。
    // ここでは同じ順序 (追加→決定) を繰り返し、難易度の系列を固定する。
    const history: AnswerRecord[] = [];
    const observed: DifficultyLevel[] = [];
    for (let i = 0; i < 10; i++) {
      observed.push(decideAdaptiveDifficulty(area, history, ALL));
      history.push(answer(type, observed[observed.length - 1], false));
    }
    // 1問目から即座に落ちず、MIN_SAMPLE 後に降格する
    expect(observed[0]).toBe(2);
    expect(observed.slice(0, MIN_SAMPLE_ATTEMPTS - 1).every((lv) => lv === 2)).toBe(true);
    expect(observed).toContain(1);
    expect(levelStats(evaluationWindow(area, history), 2).total).toBeGreaterThanOrEqual(
      MIN_SAMPLE_ATTEMPTS,
    );
  });

  it('全分野で初期難易度が仕様通り (Lv2 / 無ければ最寄り)', () => {
    for (const target of listLearningAreas()) {
      const available = Array.from(
        new Set(
          buildQuestionPool()
            .filter((e) => getCurriculumScope(e.type)?.area === target)
            .flatMap((e) => e.supportedLevels),
        ),
      ).sort((a, b) => a - b) as DifficultyLevel[];
      expect(available.length).toBeGreaterThan(0);
      expect(decideAdaptiveDifficulty(target, [], available)).toBe(
        snapToAvailableLevel(INITIAL_ADAPTIVE_DIFFICULTY, available),
      );
    }
  });
});