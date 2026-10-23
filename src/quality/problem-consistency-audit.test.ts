import { describe, expect, it } from 'vitest';
import { getAllGenerators } from '../engine/selector/generatorRegistry';
import { getTypeSupportedLevels } from '../engine/diversity/metadata';

describe('独立オラクルによる問題文/正解の整合性', () => {
  it('96種類すべての生成器を監査し、不整合が0件である', async () => {
    const mod = (await import('../../scripts/oracle-audit.mts')) as {
      oracleAnswer: (type: string, p: Record<string, unknown>) => { answer: unknown } | null;
      answersMatch: (a: unknown, b: unknown) => boolean;
    };
    const oracleAnswer = mod.oracleAnswer;
    const answersMatch = mod.answersMatch;

    const SEEDS = 20;
    let total = 0;
    let checked = 0;
    const skipped = new Set<string>();
    const issues: { type: string; level: number; seed: number; detail: string }[] = [];

    for (const g of getAllGenerators()) {
      const levels = getTypeSupportedLevels(g.type);
      for (const lv of levels) {
        for (let s = 0; s < SEEDS; s++) {
          const seed = s * 7919 + lv * 131 + 11;
          total++;
          let p: unknown;
          try {
            p = g.generate({ difficulty: lv as 1 | 2 | 3 | 4 | 5, seed });
          } catch (e: unknown) {
            issues.push({ type: g.type, level: lv, seed, detail: 'generate-throw: ' + String((e as Error)?.message ?? e) });
            continue;
          }
          const params = ((p as { parameters?: unknown }).parameters ?? {}) as Record<string, unknown>;
          const oracle = oracleAnswer(g.type, params) as { answer: unknown } | null;
          if (!oracle) {
            skipped.add(g.type);
            continue;
          }
          checked++;
          const actualAnswer = (p as { answer: unknown }).answer;
          if (!answersMatch(actualAnswer, oracle.answer)) {
            issues.push({ type: g.type, level: lv, seed, detail: `expected=${JSON.stringify(oracle.answer)} actual=${JSON.stringify(actualAnswer)}` });
          }
        }
      }
    }

    console.log(`[consistency-audit] total=${total} checked=${checked} issues=${issues.length} skippedTypes=${skipped.size}`);
    console.log(`[consistency-audit] skipped=${[...skipped].join(',')}`);

    expect(issues, issues.slice(0, 5).map((i) => `${i.type} lv${i.level} seed${i.seed}: ${i.detail}`).join('\n')).toHaveLength(0);
  });
});
