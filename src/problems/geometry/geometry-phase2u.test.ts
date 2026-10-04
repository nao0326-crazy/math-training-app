// geometry-phase2u.test.ts — 平行と垂直 (Phase 2-U)
//
// 目的:
//   - lv1-5 で生成でき、要求した difficulty を返すこと
//   - 図を見なくても問題文だけで判断できる (矛盾した条件を出さない)
//   - generator ではなく、独立した定義で答えを検算すること
//   - validate が改ざんを検出すること
//   - 解説・途中式が必ず付くこと
//
// 独立検算の方式:
//   平行と垂直の定義そのものを、generator と別書きで実装して突き合わせる。
//   - 垂直 <=> できる角が直角 (90度)
//   - 平行 <=> 同一平面上にある2直線が交わらない

import { describe, expect, it } from 'vitest';
import { ParallelPerpendicularGenerator } from './generators';
import { validateProblem } from '../../engine/validator/validator';
import { generateSolutionSteps } from '../../engine/solution/solutionGenerator';
import { formatAnswer, checkUserAnswer } from '../../utils/answer';
import type { DifficultyLevel, Problem } from '../../types/problem';

const LEVELS: DifficultyLevel[] = [1, 2, 3, 4, 5];
const PER_LEVEL = 120;

function generateMany(lv: DifficultyLevel): Problem[] {
  const gen = new ParallelPerpendicularGenerator();
  const out: Problem[] = [];
  for (let s = 0; s < PER_LEVEL; s++) {
    out.push(gen.generate({ difficulty: lv, seed: s * 104729 + lv * 7919 }));
  }
  return out;
}

/** 独立実装: 交わる2直線が垂直かどうか */
function refIsPerpendicular(angle: number): boolean {
  return angle === 90;
}

/** 独立実装: 同一平面上にある2直線が平行かどうか */
function refIsParallel(intersects: boolean): boolean {
  return !intersects;
}

type Params = {
  variant: string;
  answerKind: string;
  angle?: number;
  intersects?: boolean;
  constantDistance?: number;
  relation?: string;
  pair?: { a: number; b: number };
};

describe('parallel_perpendicular: 生成と difficulty', () => {
  const gen = new ParallelPerpendicularGenerator();

  it('lv1-5 の各レベルで 100問以上生成でき、要求した difficulty を返す', () => {
    for (const lv of LEVELS) {
      const problems = generateMany(lv);
      expect(problems.length).toBeGreaterThanOrEqual(100);
      for (const p of problems) {
        expect(p.difficulty.level, `lv${lv}`).toBe(lv);
      }
    }
  });

  it('全問題が validate を通り、displayed answer を入力すると正解判定される', () => {
    for (const lv of LEVELS) {
      for (const p of generateMany(lv)) {
        expect(validateProblem(p).valid, `validate: ${p.question}`).toBe(true);
        expect(gen.validate(p).valid, `generator.validate: ${p.question}`).toBe(true);
        const shown = String(formatAnswer(p.answer));
        expect(shown.length, 'displayed answer が空').toBeGreaterThan(0);
        expect(checkUserAnswer(shown, p.answer), `自己入力判定: ${shown}`).toBe(true);
      }
    }
  });

  it('説明と途中式が必ず付き、選択式として提示される', () => {
    for (const lv of LEVELS) {
      for (const p of generateMany(lv)) {
        expect(String(p.explanation ?? '').length, `説明が空: ${p.question}`).toBeGreaterThan(0);
        const steps = generateSolutionSteps(p);
        expect(steps.length, `途中式が空: ${p.question}`).toBeGreaterThan(0);
        expect(p.choices, `選択肢が無い: ${p.question}`).toBeDefined();
        expect((p.choices ?? []).length).toBeGreaterThanOrEqual(3);
        // 答えは必ず選択肢に含まれる
        expect(p.choices).toContain(
          p.answer.kind === 'string' ? p.answer.value : String(p.answer.kind),
        );
        // 選択肢は重複しない
        expect(new Set(p.choices).size).toBe(p.choices?.length);
      }
    }
  });
});

describe('parallel_perpendicular: 独立検算', () => {
  const gen = new ParallelPerpendicularGenerator();

  it('各 variant の答えが定義どおりであること', () => {
    const seen = new Set<string>();
    for (const lv of LEVELS) {
      for (const p of generateMany(lv)) {
        const params = p.parameters as Params;
        seen.add(params.variant);
        const answer = p.answer.kind === 'string' ? p.answer.value : '';

        switch (params.variant) {
          case 'definition_parallel':
            // 平行の定義問題: 答えは「平行」
            expect(answer).toBe('平行');
            expect(params.answerKind).toBe('parallel');
            break;
          case 'definition_perpendicular':
            expect(answer).toBe('垂直');
            expect(params.answerKind).toBe('perpendicular');
            break;
          case 'angle_judgment': {
            const angle = params.angle!;
            expect(angle).toBeGreaterThan(0);
            expect(angle).toBeLessThan(180);
            // 交わる2直線が垂直になるのは角が直角のときだけ
            if (refIsPerpendicular(angle)) {
              expect(answer).toBe('垂直');
              expect(params.answerKind).toBe('perpendicular');
            } else {
              expect(answer).toBe('垂直ではありません');
              expect(params.answerKind).toBe('not_perpendicular');
            }
            // 交わっているので「平行」と答えてはいけない (矛盾条件の防止)
            expect(answer).not.toBe('平行');
            // 問題文に角度が含まれること (図なしでも判断できること)
            expect(p.question).toContain(String(angle));
            break;
          }
          case 'intersection_judgment': {
            const intersects = params.intersects!;
            if (refIsParallel(intersects)) {
              expect(answer).toBe('平行');
              expect(params.answerKind).toBe('parallel');
            } else {
              expect(answer).toBe('平行ではありません');
              expect(params.answerKind).toBe('not_parallel');
            }
            // 条件が問題文に明記されていること
            // 問題文の条件文が parameters.intersects と矛盾していないこと
            // (「交わらない」は「交わる」を部分文字列として含まないため、文で照合する)
            const conditions = params.intersects
              ? ['交わることが分かっています', '交わっています', '交わることを確かめています']
              : ['交わらないことが分かっています', '交わらないことを確かめています'];
            const matched = conditions.some((c) => p.question.includes(c));
            expect(matched, '条件不明: ' + p.question).toBe(true);
            break;
          }
          case 'equal_distance':
            expect(answer).toBe('平行');
            expect(params.answerKind).toBe('parallel');
            expect(params.constantDistance).toBeGreaterThan(0);
            // 距離が一定であることが問題文に書かれていること
            expect(p.question).toContain(String(params.constantDistance));
            break;
          case 'find_pair': {
            const pair = params.pair!;
            const names = ['直線あ', '直線い', '直線う'];
            // 与えられた構成: あい=平行 / あう=垂直 / いう=不明
            const expected = params.relation === 'parallel' ? { a: 0, b: 1 } : { a: 0, b: 2 };
            expect(pair).toEqual(expected);
            expect(answer).toBe(names[pair.a] + 'と' + names[pair.b]);
            // 関係が決まっていない組を正解にしない
            expect([pair.a, pair.b]).not.toEqual([1, 2]);
            expect(p.question).toContain(params.relation === 'parallel' ? 'parallel' : 'perpendicular');
            break;
          }
          default:
            throw new Error('未知の variant: ' + params.variant);
        }
      }
    }
    // 全難易度を合わせると全 variant が出現する
    expect([...seen].sort()).toEqual([
      'angle_judgment',
      'definition_parallel',
      'definition_perpendicular',
      'equal_distance',
      'find_pair',
      'intersection_judgment',
    ]);
  });

it('難しい variant は低い難易度では出ない (概念の理解で難易度を上げる)', () => {
    const byLevel = new Map<DifficultyLevel, Set<string>>();
    for (const lv of LEVELS) {
      const set = new Set<string>();
      for (const p of generateMany(lv)) {
        set.add((p.parameters as Params).variant);
      }
      byLevel.set(lv, set);
    }
    // lv1 では定義と角度判断だけ
    expect(byLevel.get(1)).not.toContain('intersection_judgment');
    expect(byLevel.get(1)).not.toContain('find_pair');
    // lv1 でも定義問題は出る (2種類以上)
    expect(byLevel.get(1)!.size).toBeGreaterThanOrEqual(2);
    // 難易度が上がるほど variant が増える
    expect(byLevel.get(5)!.size).toBeGreaterThanOrEqual(byLevel.get(1)!.size);
  });

  it('各難易度で十分な種類の問題が出る (重複率が高くない)', () => {
    for (const lv of LEVELS) {
      const problems = generateMany(lv);
      const questions = problems.map((p) => p.question);
      const unique = new Set(questions).size;
      // 120問のうち少なくとも 10 種類以上
      expect(unique, `lv${lv} の問題文の種類`).toBeGreaterThanOrEqual(10);
      expect(unique, `lv${lv} は全問同一問題`).toBeLessThan(PER_LEVEL);
    }
  });

  it('parameters を改ざんすると validate が不正を報告する', () => {
    for (const lv of LEVELS) {
      for (const p of generateMany(lv)) {
        const params = p.parameters as Params;
        // answerKind を型にない値にする
        const badKind: Problem = {
          ...p,
          parameters: { ...(p.parameters as object), answerKind: 'no_such_kind' },
        };
        expect(gen.validate(badKind).valid, '未定義の答えの種類を検出できる').toBe(false);

        // 答えを空にする
        const emptyAnswer: Problem = {
          ...p,
          answer: { kind: 'string', value: '' },
        };
        expect(gen.validate(emptyAnswer).valid, '空の答えを検出できる').toBe(false);

        if (params.variant === 'angle_judgment') {
          // 角度を90以外なのに垂直にした改ざん
          const wrongAngle: Problem = {
            ...p,
            parameters: { ...(p.parameters as object), angle: params.angle === 90 ? 45 : 90 },
          };
          expect(gen.validate(wrongAngle).valid, '角度と答えの矛盾を検出できる').toBe(false);
        }
        if (params.variant === 'intersection_judgment') {
          const flip: Problem = {
            ...p,
            parameters: { ...(p.parameters as object), intersects: !params.intersects },
          };
          expect(gen.validate(flip).valid, '交わりと答えの矛盾を検出できる').toBe(false);
        }
        if (params.variant === 'find_pair') {
          const wrongPair: Problem = {
            ...p,
            parameters: { ...(p.parameters as object), pair: { a: 0, b: 0 } },
          };
          expect(gen.validate(wrongPair).valid, '不正な直線の組を検出できる').toBe(false);
        }
      }
    }
  });
});