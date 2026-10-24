/**
 * 診断: type ごとに生成される parameters のキーと実際の answer サンプルを出力する。
 * オラクルを「生成器の実仕様に合わせる」ための調査用。
 *
 * 実行: npx vite-node scripts/oracle-dump-params.mts
 */
import { writeFileSync } from 'node:fs';
import { getAllGenerators } from '../src/engine/selector/generatorRegistry';
import { getTypeSupportedLevels } from '../src/engine/diversity/metadata';

const SEEDS = Number(process.env.ORACLE_SEEDS ?? 3);
const ONLY = process.env.ORACLE_ONLY ? process.env.ORACLE_ONLY.split(',') : null;

const lines: string[] = [];

for (const g of getAllGenerators()) {
  if (ONLY && !ONLY.includes(g.type)) continue;
  const levels = getTypeSupportedLevels(g.type);
  lines.push(`===== ${g.type} (levels: ${levels.join(',')})`);
  const seen = new Set<string>();
  for (const lv of levels) {
    for (let s = 0; s < SEEDS; s++) {
      const seed = s * 7919 + lv * 131 + 11;
      let p: any;
      try {
        p = g.generate({ difficulty: lv as any, seed });
      } catch (e: any) {
        lines.push(`  THROW lv=${lv} seed=${seed} ${e?.message ?? e}`);
        continue;
      }
      // variant ごとに1件だけ出力
      const variant = String((p.parameters ?? {}).variant ?? '-');
      const key = `${lv}:${variant}`;
      if (seen.has(key)) continue;
      seen.add(key);
      lines.push(`  lv=${lv} variant=${variant}`);
      lines.push(`    params: ${JSON.stringify(p.parameters)}`);
      lines.push(`    answer: ${JSON.stringify(p.answer)}`);
      lines.push(`    Q: ${p.question}`);
    }
  }
}

const OUT = process.env.ORACLE_OUT ?? 'oracle-params.txt';
writeFileSync(OUT, lines.join('\n'), 'utf8');
console.log(`written ${OUT}: ${lines.length} lines`);
