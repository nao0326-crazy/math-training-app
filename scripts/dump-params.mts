/**
 * 各 generator タイプのパラメータ構造ダンプ (オラクル設計用)
 *
 * 実行: npx vite-node scripts/dump-params.mts
 */
import { writeFileSync } from 'node:fs';
import { getAllGenerators } from '../src/engine/selector/generatorRegistry';
import { getTypeSupportedLevels } from '../src/engine/diversity/metadata';

const out: any[] = [];
for (const g of getAllGenerators()) {
  const levels = getTypeSupportedLevels(g.type);
  const variants = new Map<string, { params: any; question: string; answer: any }>();
  const keySets = new Set<string>();
  let error = '';
  for (const lv of levels) {
    for (let s = 0; s < 60; s++) {
      const seed = s * 7919 + lv * 131 + 11;
      let p: any = null;
      try {
        p = g.generate({ difficulty: lv as any, seed });
      } catch (e: any) {
        error = String(e?.message ?? e);
        continue;
      }
      const v = String((p.parameters ?? {}).variant ?? '(none)');
      keySets.add(Object.keys(p.parameters ?? {}).sort().join(','));
      if (!variants.has(v)) {
        variants.set(v, {
          params: p.parameters,
          question: p.question,
          answer: p.answer,
          level: lv,
        });
      }
    }
  }
  out.push({
    type: g.type,
    error,
    variants: [...variants.entries()].map(([v, d]) => ({
      variant: v,
      level: d.level,
      question: d.question,
      answer: d.answer,
      params: d.params,
    })),
    keySets: [...keySets],
  });
}
writeFileSync('_params.json', JSON.stringify(out, null, 1), 'utf8');
console.log('types=' + out.length);
