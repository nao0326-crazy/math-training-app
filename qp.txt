/**
 * 出題母集団 (QuestionPool)
 *
 * 完全ランダム出題の「母集団」を1か所に定義する。
 * 既存の generatorRegistry が持つ全ジェネレータを、そのメタデータ
 * (カテゴリ / 対応難易度 / 学年配当 / 説明) 付きで一覧化する。
 *
 * - 通常モード: 絞り込みなしの全件を母集団にする
 * - 管理者モード: 学年・分野・問題タイプで母集団を絞る
 *
 * generator の実装には一切手を入れず、「母集団の定義と絞り込み」だけを
 * ここに閉じ込める (既存の生成器・問題データ・解答判定は変更しない)。
 */

import type {
  Category,
  DifficultyLevel,
  DifficultyRange,
} from '../../types/problem';
import {
  getCurriculumScope,
  type CurriculumCategory,
  type CurriculumGrade,
} from '../curriculum/curriculumScope';
import { getTypeSupportedLevels } from '../diversity/metadata';
import { getAllGenerators } from './generatorRegistry';
import type { ProblemGenerator } from '../../types/problem';

/** 母集団の1要素 (generator のメタデータ付き) */
export interface QuestionPoolEntry {
  /** generator ID (problem.type) */
  type: string;
  /** 分野 */
  category: Category;
  /** generator の説明 */
  description: string;
  /** その型が生成できる難易度 */
  supportedLevels: DifficultyLevel[];
  /** 学年配当 (curriculumScope に登録がある型のみ) */
  grade?: CurriculumGrade;
  /** 学習範囲の区分 (curriculumScope に登録がある型のみ) */
  curriculumCategory?: CurriculumCategory;
}

/**
 * 出題母集団の絞り込み条件
 *
 * すべて省略可。空の条件で呼べば「全出題可能範囲」になる。
 * 通常モードではこの条件を渡さない。
 */
export interface QuestionFilter {
  /** 分野 */
  category?: Category | null;
  /** 問題タイプ (generator ID) */
  type?: string | null;
  /**
   * 問題タイプの一覧 (generator ID の配列)。
   * 既存の `type: string` とは別枠で、複数指定用に使う。
   * - `[]` は候補0件として扱う (「すべて選択」と解釈しない)。
   * - `null` / `undefined` は種類による絞り込みを行わない。
   * - 値ありは配列内の種類に一致する問題だけを候補にする。
   * `type` と併用した場合は両方を満たす (AND)。
   */
  types?: string[] | null;
  /** 学年 */
  grade?: CurriculumGrade | null;
  /** 難易度 */
  difficulty?: DifficultyLevel | null;
  /** 難易度範囲。指定時は範囲内の難易度を生成できる型だけを候補にする。 */
  difficultyRange?: DifficultyRange | null;
}

/** 母集団を作る (generatorRegistry の全件をメタデータ付きに列挙) */
export function buildQuestionPool(
  generators: readonly ProblemGenerator[] = getAllGenerators(),
): QuestionPoolEntry[] {
  return generators.map((g) => {
    const scope = getCurriculumScope(g.type);
    return {
      type: g.type,
      category: g.category,
      description: g.description,
      supportedLevels: getTypeSupportedLevels(g.type),
      grade: scope?.grade,
      curriculumCategory: scope?.category,
    };
  });
}

/**
 * 条件に合わせて母集団を絞る
 *
 * 未指定 (undefined / null) は「その条件では絞らない」を意味する。
 * 難易度・学年の指定は「その条件で作れる型だけ」に限定する。
 */
export function filterQuestionPool(
  filter: QuestionFilter | null | undefined,
  pool: readonly QuestionPoolEntry[] = buildQuestionPool(),
): QuestionPoolEntry[] {
  if (!filter) return [...pool];

  // `types: []` は候補0件として扱う (「すべて選択」と解釈しない)。
  // `null` / `undefined` は種類による絞り込みを行わない。
  if (filter.types !== undefined && filter.types !== null && filter.types.length === 0) {
    return [];
  }
  const allowedTypes = filter.types ? new Set(filter.types) : null;

  return pool.filter((entry) => {
    if (filter.category && entry.category !== filter.category) return false;
    if (filter.type && entry.type !== filter.type) return false;
    if (allowedTypes && !allowedTypes.has(entry.type)) return false;
    if (filter.grade && entry.grade !== filter.grade) return false;
    if (filter.difficulty && !entry.supportedLevels.includes(filter.difficulty)) return false;
    if (filter.difficultyRange) {
      const { min, max } = filter.difficultyRange;
      const hasLevelInRange = entry.supportedLevels.some(
        (level) => level >= min && level <= max,
      );
      if (!hasLevelInRange) return false;
    }
    return true;
  });
}

/** 母集団が空のときに投げるエラー */
export class EmptyQuestionPoolError extends Error {
  constructor(filter: QuestionFilter | null | undefined) {
    const parts = Object.entries(filter ?? {})
      .filter(([, v]) => v !== undefined && v !== null)
      .map(([k, v]) => `${k}=${String(v)}`);
    super(
      '指定条件に出題できる問題がありません。' +
        (parts.length > 0 ? ` 条件: ${parts.join(', ')}` : ' 母集団が空です。'),
    );
    this.name = 'EmptyQuestionPoolError';
  }
}
