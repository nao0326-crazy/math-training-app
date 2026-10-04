// curriculumScope.test.ts — 学習範囲タグの基盤と分類の検査 (Phase 2-U)
//
// 目的:
//   - registry の全型に学習範囲タグが存在すること (分類漏れ検出)
//   - 区分・学年・確度が既定値に限り、根拠と注記を，具备すること
//   - variant 単位のタグが型単位より優先されること
//   - 未登録の型が undefined を返し、例外を出さないこと
//   - 未分類を「範囲外」と判定しないこと
//   - 集計 (区分別・学年別) が正しく取れること
//   - 素数2型が extension に分類されていること
//   - 既存の metadata / 問題生成に影響しないこと

import { describe, expect, it } from 'vitest';
import {
  CURRICULUM_CATEGORIES,
  CURRICULUM_GRADES,
  CURRICULUM_SCOPE,
  CURATED_SOURCES,
  SCOPE_CONFIDENCES,
  findUnclassifiedTypes,
  getCurriculumScope,
  getTypeCurriculumScope,
  listClassifiedTypes,
  summarizeByCategory,
  summarizeByGrade,
  validateScopeTable,
  type CurriculumCategory,
  type TypeCurriculumScope,
} from './curriculumScope';
import { getAllGenerators } from '../selector/generatorRegistry';
import { generateProblem } from '../selector/generatorRegistry';
import { deriveMetadata } from '../diversity/metadata';
import type { DifficultyLevel } from '../../types/problem';

/** registry が実際に登録している型 */
const REGISTERED_TYPES = getAllGenerators().map((g) => g.type);

describe('curriculumScope: 分類漏れ検査', () => {
  it('registry の全型に学習範囲タグがある', () => {
    expect(REGISTERED_TYPES.length).toBeGreaterThan(0);
    const missing = findUnclassifiedTypes(REGISTERED_TYPES);
    expect(missing.join(', '), '未分類の generator があります').toBe('');
  });

  it('分類表に registry にない型を混入させていない (削除・改名のtypo検出)', () => {
    const registered = new Set(REGISTERED_TYPES);
    const orphans = listClassifiedTypes().filter((t) => !registered.has(t));
    expect(orphans.join(', '), 'registry にない型が分類表に残っています').toBe('');
  });

  it('registry と分類表の型数が一致する', () => {
    expect(listClassifiedTypes().length).toBe(REGISTERED_TYPES.length);
  });
});

describe('curriculumScope: 分類値の妥当性', () => {
  it('区分・学年・確度が既定値に限り、根拠と注記がある', () => {
    const errors = validateScopeTable();
    expect(errors.join('\n'), '分類表に不正があります').toBe('');
  });

  it('区分は 4 区分のいずれかである', () => {
    for (const [type, entry] of Object.entries(CURRICULUM_SCOPE)) {
      expect(CURRICULUM_CATEGORIES, type).toContain(entry.category);
      if (entry.grade !== undefined) expect(CURRICULUM_GRADES, type).toContain(entry.grade);
      if (entry.confidence !== undefined) expect(SCOPE_CONFIDENCES, type).toContain(entry.confidence);
    }
  });

  it('required / review は小学校6学年までに配当されている', () => {
    for (const [type, entry] of Object.entries(CURRICULUM_SCOPE)) {
      if (entry.category !== 'required' && entry.category !== 'review') continue;
      expect(entry.grade, `${type} に学年情報がありません`).toBeDefined();
      expect(entry.grade, `${type} は小6より外を指しています`).not.toBe('jhs1');
      if (typeof entry.grade === 'number') {
        expect(entry.grade, `${type} が小6を超えています`).toBeLessThanOrEqual(6);
      }
    }
  });

  it('小6までに出題されるのに jhs1 を指している型はない', () => {
    for (const [type, entry] of Object.entries(CURRICULUM_SCOPE)) {
      if (entry.grade === 'jhs1') {
        expect(
          ['extension', 'uncertain'],
          `${type} が中学校1年を示すなら extension / uncertain であるべき`,
        ).toContain(entry.category);
      }
    }
  });

  it('不正な区分・学年・確度を検証で検出できる', () => {
    const bad: Record<string, TypeCurriculumScope> = {
      broken_category: { category: 'nope' as CurriculumCategory, citation: 'x' },
      broken_grade: { category: 'required', grade: 9 as never, citation: 'x' },
      broken_confidence: { category: 'required', citation: 'x', confidence: 'maybe' as never },
      missing_citation: { category: 'required' },
      empty_note: { category: 'required', citation: 'x', note: '' },
      broken_variant: {
        category: 'required',
        citation: 'x',
        variants: { v: { category: 'nope' as CurriculumCategory } },
      },
    };
    const errors = validateScopeTable(bad);
    expect(errors.length).toBeGreaterThanOrEqual(6);
    expect(errors.join('\n')).toContain('broken_category');
    expect(errors.join('\n')).toContain('broken_grade');
    expect(errors.join('\n')).toContain('broken_confidence');
    expect(errors.join('\n')).toContain('missing_citation');
    expect(errors.join('\n')).toContain('empty_note');
    expect(errors.join('\n')).toContain('broken_variant.v');
  });
});

describe('curriculumScope: variant 単位の扱い', () => {
  it('decimal_place_value は variant によって学年が変わる', () => {
    // 型単位は小3 (位取りの読み書き)
    expect(getCurriculumScope('decimal_place_value')?.grade).toBe(3);
    // variant 単位は小数を使う組み立てが小4
    expect(getCurriculumScope('decimal_place_value', 'read_digit')?.grade).toBe(3);
    expect(getCurriculumScope('decimal_place_value', 'place_value')?.grade).toBe(3);
    expect(getCurriculumScope('decimal_place_value', 'decompose')?.grade).toBe(4);
    expect(getCurriculumScope('decimal_place_value', 'compose')?.grade).toBe(4);
  });

  it('variant 側の値が型単位より優先され、未指定の欄は型単位を継承する', () => {
    const base = getCurriculumScope('decimal_place_value');
    const variant = getCurriculumScope('decimal_place_value', 'compose');
    expect(variant).toBeDefined();
    expect(base).toBeDefined();
    // source / area は型単位から継承される
    expect(variant?.source).toBe(base?.source);
    expect(variant?.area).toBe(base?.area);
    // grade は variant 側の値が優先される
    expect(variant?.grade).toBe(4);
    expect(variant?.grade).not.toBe(base?.grade);
  });

  it('未登録の variant は型単位の値にフォールバックする', () => {
    expect(getCurriculumScope('decimal_place_value', 'no_such_variant')?.grade).toBe(3);
  });

  it('実際に生成された問題の variant で参照できる', () => {
    const problem = generateProblem({ difficulty: 3 as DifficultyLevel, seed: 12345 });
    const params = problem.parameters as { variant?: string };
    const scope = getCurriculumScope(problem.type, params.variant);
    expect(scope, `${problem.type}/${params.variant} の範囲タグが取得できません`).toBeDefined();
    expect(CURRICULUM_CATEGORIES).toContain(scope?.category);
  });
});

describe('curriculumScope: 未分類は「範囲外」ではない', () => {
  it('未登録の型は undefined を返し例外を出さない', () => {
    expect(getTypeCurriculumScope('no_such_type')).toBeUndefined();
    expect(getCurriculumScope('no_such_type')).toBeUndefined();
    expect(getCurriculumScope('no_such_type', 'some_variant')).toBeUndefined();
  });

  it('未登録の型を渡しても findUnclassifiedTypes は例外を出さない', () => {
    const missing = findUnclassifiedTypes(['no_such_type', 'prime_judgment']);
    expect(missing).toEqual(['no_such_type']);
  });

  it('未分類は unclassified として集計される (どの区分にも勝手に割り当てない)', () => {
    const summary = summarizeByCategory(['prime_judgment', 'no_such_type']);
    expect(summary.unclassified).toBe(1);
    expect(summary.extension).toBe(1);
    expect(summary.required).toBe(0);
    expect(summary.review).toBe(0);
    expect(summary.uncertain).toBe(0);
  });
});

describe('curriculumScope: 集計', () => {
  it('区分別の内訳を取り出せる', () => {
    const summary = summarizeByCategory();
    const total = CURRICULUM_CATEGORIES.reduce((sum, c) => sum + summary[c], 0) + summary.unclassified;
    expect(total).toBe(REGISTERED_TYPES.length);
    expect(summary.unclassified).toBe(0);
  });

  it('4区分すべてが実際に使われている', () => {
    const summary = summarizeByCategory();
    for (const c of CURRICULUM_CATEGORIES) {
      expect(summary[c], `${c} が使われていません`).toBeGreaterThan(0);
    }
  });

  it('学年別の内訳を取り出せる', () => {
    const summary = summarizeByGrade();
    expect(summary.unspecified).toBe(0);
    for (const g of ['1', '2', '3', '4', '5', '6', 'jhs1']) {
      expect(summary[g], `学年 ${g} に型がありません`).toBeGreaterThan(0);
    }
  });
});

describe('curriculumScope: 素数2型の扱い', () => {
  it('prime_judgment / prime_range は extension・中学校1年として分類されている', () => {
    for (const type of ['prime_judgment', 'prime_range']) {
      const scope = getTypeCurriculumScope(type);
      expect(scope?.category, type).toBe('extension');
      expect(scope?.grade, type).toBe('jhs1');
      expect(scope?.citation, `${type} に根拠がありません`).toBeTruthy();
    }
  });

  it('素数2型は registry 上で有効のまま (分類だけで出題は変えていない)', () => {
    expect(REGISTERED_TYPES).toContain('prime_judgment');
    expect(REGISTERED_TYPES).toContain('prime_range');
    // 実際の生成も影響を受けない
    for (const type of ['prime_judgment', 'prime_range']) {
      for (let s = 0; s < 5; s++) {
        const p = generateProblem({ difficulty: 2 as DifficultyLevel, seed: s * 7919 + 3 });
        if (p.type === type) expect(p.question.length).toBeGreaterThan(0);
      }
    }
  });
});

describe('curriculumScope: 根拠の記録が実態と整合していること (Phase 2-W)', () => {
  it('すべての型に出典 (source) が記録されている', () => {
    for (const [type, entry] of Object.entries(CURRICULUM_SCOPE)) {
      expect(entry.source, `${type} に出典がありません`).toBeTruthy();
    }
  });

  it('出典は一覧表に載っている資料のいずれかである (出所の捏造を防ぐ)', () => {
    for (const [type, entry] of Object.entries(CURRICULUM_SCOPE)) {
      expect(CURATED_SOURCES, `${type} の出典が未登録: ${String(entry.source)}`).toContain(entry.source);
      for (const [variant, vScope] of Object.entries(entry.variants ?? {})) {
        expect(
          CURATED_SOURCES,
          `${type}.${variant} の出典が未登録: ${String(vScope.source)}`,
        ).toContain(vScope.source);
      }
    }
  });

  it('confirmed は citation と出典と注記をすべて持つ (確度を不承担にしない)', () => {
    for (const [type, entry] of Object.entries(CURRICULUM_SCOPE)) {
      if (entry.confidence !== 'confirmed') continue;
      expect(entry.citation, `${type} に citation がありません`).toBeTruthy();
      expect(entry.source, `${type} に出典がありません`).toBeTruthy();
      expect(entry.note, `${type} に確認内容の注記がありません`).toBeTruthy();
    }
  });

  it('unverified には未確認の理由が記録されている', () => {
    for (const [type, entry] of Object.entries(CURRICULUM_SCOPE)) {
      if (entry.confidence !== 'unverified') continue;
      expect(entry.note, `${type} に未確認の理由がありません`).toBeTruthy();
    }
  });

  it('素数は extension のままであり、確度を上げていない', () => {
    for (const type of ['prime_judgment', 'prime_range']) {
      const scope = getTypeCurriculumScope(type);
      expect(scope?.category, type).toBe('extension');
      expect(scope?.grade, type).toBe('jhs1');
      // 学年配当そのものは一次資料で確認できていないため、confirmed にはしない
      expect(scope?.confidence, type).not.toBe('confirmed');
    }
  });
});

describe('curriculumScope: 既存機能への影響がないこと', () => {
  it('学習範囲タグは diversity metadata を変えない (保存形式は据え置き)', () => {
    const problem = generateProblem({ difficulty: 3 as DifficultyLevel, seed: 999 });
    const meta = deriveMetadata(problem);
    expect(meta.unit).toBe(problem.category);
    expect(meta.family.length).toBeGreaterThan(0);
    // 範囲タグは ProblemMetadata に混ざらない
    expect(Object.keys(meta)).not.toContain('category_grade');
    expect(Object.keys(meta)).not.toContain('curriculum');
  });

  it('全型の問題が scope を引数に依存せず生成できる', () => {
    for (const g of getAllGenerators()) {
      const scope = getTypeCurriculumScope(g.type);
      expect(scope, `${g.type} の scope が無い`).toBeDefined();
      // scope 付き/無しで結果が変わらないことは生成側からは観測しない。
      // ここでは scope の取得が例外を出さないことを確認する。
      expect(() => getCurriculumScope(g.type, 'x')).not.toThrow();
    }
  });
});