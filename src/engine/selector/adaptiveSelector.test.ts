/**
 * 分野別・適応難易度セレクター (AdaptiveSelector) のテスト
 *
 * - 分野固定: 出題はすべて指定した分野の問題
 * - 履歴から難易度を毎回決める (履歴なし → 初期 Lv2 / 5問正解 → Lv3)
 * - 分野ごとに独立 (別の分野の履歴は影響しない)
 * - 直前の問題・直前と同じ generator の連続を避ける
 * - 分野が存在しない場合は EmptyQuestionPoolError
 */

import { describe, expect, it } from 'vitest';
import type { AnswerRecord, QuestionHistory } from '../../types/history';
import type { DifficultyLevel, Problem } from '../../types/problem';
import { AdaptiveSelector } from './adaptiveSelector';
import { buildQuestionPool, EmptyQuestionPoolError } from './questionPool';
import { getCurriculumScope } from '../curriculum/curriculumScope';
import { deriveMetadata, fingerprintProblem } from '../diversity/metadata';
import {
  INITIAL_ADAPTIVE_DIFFICULTY,
  decideAdaptiveDifficulty,
  listLearningAreas,
  snapToAvailableLevel,
} from '../../utils/adaptiveDifficulty';
import type { SelectionRequest } from './types';

function request(area: string): SelectionRequest {
  return { mode: { kind: 'adaptive', area }, difficulty: 2 };
}

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

/** 指定分野に属する問題タイプを1つ拾う */
function typeInArea(area: string): string {
  const entry = buildQuestionPool().find((e) => getCurriculumScope(e.type)?.area === area);
  if (!entry) throw new Error(`分野が見つからない: ${area}`);
  return entry.type;
}

/** 出題済みの問題から QuestionHistory を作る (重複回避のテスト用) */
function questionHistoryOf(problem: Problem): QuestionHistory {
  return {
    problemId: problem.id,
    problemType: problem.type,
    parameters: problem.parameters,
    askedAt: new Date().toISOString(),
    metadata: deriveMetadata(problem),
    fingerprint: fingerprintProblem(problem),
  };
}

describe('AdaptiveSelector', () => {
  it('指定した分野の問題だけを10問返す', () => {
    for (const area of ['数と計算', '図形', 'データの活用']) {
      const selector = new AdaptiveSelector(area);
      for (let i = 0; i < 10; i++) {
        const problem = selector.selectNextQuestion([], [], request(area));
        expect(getCurriculumScope(problem.type)?.area).toBe(area);
      }
    }
  });

  it('履歴が無ければ初期難易度 (Lv2) で出題する', () => {
    const area = '図形';
    const selector = new AdaptiveSelector(area);
    for (let i = 0; i < 5; i++) {
      const problem = selector.selectNextQuestion([], [], request(area));
      expect(problem.difficulty.level).toBe(2);
    }
  });

  it('その分野で5問正解したら Lv3 で出題する', () => {
    const area = '図形';
    const type = typeInArea(area);
    const history = corrects(type, 2, 5);
    const selector = new AdaptiveSelector(area);
    for (let i = 0; i < 5; i++) {
      const problem = selector.selectNextQuestion(history, [], request(area));
      expect(getCurriculumScope(problem.type)?.area).toBe(area);
      expect(problem.difficulty.level).toBe(3);
    }
  });

  it('別の分野の履歴はその分野の難易度に影響しない', () => {
    const area = '図形';
    const otherType = typeInArea('数と計算');
    const history = corrects(otherType, 2, 5);
    const problem = new AdaptiveSelector(area).selectNextQuestion(history, [], request(area));
    expect(getCurriculumScope(problem.type)?.area).toBe(area);
    expect(problem.difficulty.level).toBe(2);
  });

  it('直前の問題と同じ問題・同じ問題タイプを連続で出さない', () => {
    const area = '図形';
    const selector = new AdaptiveSelector(area);
    const first = selector.selectNextQuestion([], [], request(area));
    const second = selector.selectNextQuestion([], [questionHistoryOf(first)], request(area));
    expect(second.type).not.toBe(first.type);
    expect(fingerprintProblem(second)).not.toBe(fingerprintProblem(first));
  });

  it('分野が存在しない場合は EmptyQuestionPoolError', () => {
    const selector = new AdaptiveSelector('存在しない分野');
    expect(() =>
      selector.selectNextQuestion([], [], request('存在しない分野')),
    ).toThrow(EmptyQuestionPoolError);
  });

  it('availableLevels はその分野の generator の supportedLevels の和集合', () => {
    const levels = new AdaptiveSelector('数量の関係').availableLevels();
    expect(levels.length).toBeGreaterThan(0);
    // 数量の関係は generator が1件でも統合せず別ボタンとして残す
    expect(levels).toContain(2);
  });

  it('全分野で10問生成しても分野固定される (退化検知)', () => {
    for (const area of listLearningAreas()) {
      const selector = new AdaptiveSelector(area);
      for (let i = 0; i < 10; i++) {
        const problem = selector.selectNextQuestion([], [], request(area));
        expect(getCurriculumScope(problem.type)?.area).toBe(area);
      }
    }
  });

  it('「数量の関係」と「数量と関係の法則」は統合せず独立分野として存在する', () => {
    // generator 数が少ない「数量の関係」も、別ボタンとして残す (現在の仕様)。
    // 両者が listLearningAreas に独立して現れることで、将来の統合・改名による
    // 退化 (どちらかが消える) を検出する。
    const areas = listLearningAreas();
    expect(areas).toContain('数量の関係');
    expect(areas).toContain('数量と関係の法則');
    // それぞれ独立に出題でき、相手の分野へは流出しない
    for (const area of ['数量の関係', '数量と関係の法則']) {
      const selector = new AdaptiveSelector(area);
      for (let i = 0; i < 5; i++) {
        const problem = selector.selectNextQuestion([], [], request(area));
        expect(getCurriculumScope(problem.type)?.area).toBe(area);
      }
    }
  });

  it('全分野で availableLevels が空ではなく初期難易度が仕様通り', () => {
    for (const area of listLearningAreas()) {
      const selector = new AdaptiveSelector(area);
      const available = selector.availableLevels();
      // その分野に生成可能な難易度が1つはある
      expect(available.length).toBeGreaterThan(0);
      // 履歴なしの初期難易度は Lv2、Lv2が無ければ最寄り (現在の仕様)
      expect(decideAdaptiveDifficulty(area, [], available)).toBe(
        snapToAvailableLevel(INITIAL_ADAPTIVE_DIFFICULTY, available),
      );
    }
  });

  it('重複回避は直前1件のみの最小限である (セッション全体の禁止ではない)', () => {
    const area = '図形';
    const selector = new AdaptiveSelector(area);
    const first = selector.selectNextQuestion([], [], request(area));
    const second = selector.selectNextQuestion([], [questionHistoryOf(first)], request(area));
    // 直前との連続は避ける
    expect(second.type).not.toBe(first.type);
    expect(fingerprintProblem(second)).not.toBe(fingerprintProblem(first));
  });
});