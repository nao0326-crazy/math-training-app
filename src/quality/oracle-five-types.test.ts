import { describe, expect, it } from 'vitest';
import type { Answer } from '../types/problem';
import { getAllGenerators } from '../engine/selector/generatorRegistry';
import { getTypeSupportedLevels } from '../engine/diversity/metadata';
import { oracleAnswer, answersMatch } from '../../scripts/oracle-audit.mts';

const TARGETS = [
  'unit_conversion_basic',
  'area_unit_conversion',
  'expression_meaning',
  'realworld_shopping',
  'realworld_eggs',
];

describe('未検証5タイプの独立オラクル', () => {
  it('5タイプすべてで oracleAnswer が null を返さず、生成された正解と一致する', () => {
    const generators = getAllGenerators().filter((g) => TARGETS.includes(g.type));
    expect(generators).toHaveLength(TARGETS.length);

    for (const g of generators) {
      const levels = getTypeSupportedLevels(g.type);
      for (const lv of levels) {
        for (let s = 0; s < 10; s++) {
          const seed = s * 7919 + lv * 131 + 11;
          const p = g.generate({ difficulty: lv as 1 | 2 | 3 | 4 | 5, seed }) as {
            answer: unknown;
            parameters?: Record<string, unknown>;
          };
          const params = (p.parameters ?? {}) as Record<string, unknown>;
          const oracle = oracleAnswer(g.type, params);
          expect(oracle, `${g.type} lv${lv} seed${seed} should be verifiable`).not.toBeNull();
          expect(
            answersMatch(p.answer as Answer, (oracle as { answer: Answer }).answer),
            `${g.type} lv${lv} seed${seed}: expected=${JSON.stringify((oracle as { answer: Answer }).answer)} actual=${JSON.stringify(p.answer)}`,
          ).toBe(true);
        }
      }
    }
  });

  it('意図的に誤った正解を与えた場合、answersMatch が false を返す', () => {
    const g = getAllGenerators().find((x) => x.type === 'unit_conversion_basic')!;
    const p = g.generate({ difficulty: 2, seed: 123 }) as {
      answer: { kind: string; value: number };
      parameters?: Record<string, unknown>;
    };
    const wrong = { kind: 'integer', value: p.answer.value + 1 } as Answer;
    expect(answersMatch(wrong, p.answer as Answer)).toBe(false);
  });
});
