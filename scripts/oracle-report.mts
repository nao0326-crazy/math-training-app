/**
 * 診断: 不一致を型ごとにまとめ、パラメータと問題文を UTF-8 で出力する。
 *
 * 実行: npx vite-node scripts/oracle-report.mts
 */
import { writeFileSync } from 'node:fs';
import { getAllGenerators } from '../src/engine/selector/generatorRegistry';
import { getTypeSupportedLevels } from '../src/engine/diversity/metadata';
import { oracleAnswer } from './oracle-audit.mts';

const SEEDS = Number(process.env.ORACLE_SEEDS ?? 40);
const ONLY = process.env.ORACLE_ONLY ? process.env.ORACLE_ONLY.split(',') : null;

function answersMatch(actual: any, expected: any): boolean {
  const num = (a: any): number | null => {
    if (!a) return null;
    switch (a.kind) {
      case 'integer':
      case 'decimal':
        return a.value;
      case 'fraction':
        return a.numerator / a.denominator;
      case 'mixed':
        return a.whole + a.numerator / a.denominator;
      default:
        return null;
    }
  };
  const na = num(actual);
  const ne = num(expected);
  if (na !== null && ne !== null) return Math.abs(na - ne) < 1e-9;
  if (actual?.kind === 'fractions' && expected?.kind === 'fractions') {
    if (actual.values.length !== expected.values.length) return false;
    return actual.values.every((v: any, i: number) => {
      const w = expected.values[i];
      return v.numerator * w.denominator === w.numerator * v.denominator;
    });
  }
  if (actual?.kind === 'string' && expected?.kind === 'string') {
    const norm = (x: string) =>
      x
        .replace(/\s+/g, '')
        .replace(/[×✕✖*＊]/g, '×')
        .replace(/[÷／]/g, '÷')
        .replace(/[：:]/g, ':')
        .replace(/[，,]/g, ',');
    if (norm(actual.value) === norm(expected.value)) return true;
    const jp = actual.value.match(/^(\d+)分の(\d+)$/);
    const fr = expected.value.match(/^(-?\d+)\/(\d+)$/);
    if (jp && fr) return Number(jp[1]) * Number(fr[2]) === Number(jp[2]) * Number(fr[1]);
    const jp2 = expected.value.match(/^(\d+)分の(\d+)$/);
    const fr2 = actual.value.match(/^(-?\d+)\/(\d+)$/);
    if (jp2 && fr2) return Number(jp2[1]) * Number(fr2[2]) === Number(jp2[2]) * Number(fr2[1]);
    return false;
  }
  return false;
}

const lines: string[] = [];
const byType = new Map<string, { count: number; samples: string[] }>();

for (const g of getAllGenerators()) {
  if (ONLY && !ONLY.includes(g.type)) continue;
  const levels = getTypeSupportedLevels(g.type);
  for (const lv of levels) {
    for (let s = 0; s < SEEDS; s++) {
      const seed = s * 7919 + lv * 131 + 11;
      let p: any;
      try {
        p = g.generate({ difficulty: lv as any, seed });
      } catch (e: any) {
        const rec = byType.get(g.type) ?? { count: 0, samples: [] };
        rec.count++;
        rec.samples.push(`  THROW lv=${lv} seed=${seed} ${e?.message ?? e}`);
        byType.set(g.type, rec);
        continue;
      }
      const params = (p.parameters ?? {}) as Record<string, any>;
      const oracle = oracleAnswer(g.type, params);
      if (!oracle) continue;
      if (!answersMatch(p.answer, oracle.answer)) {
        const rec = byType.get(g.type) ?? { count: 0, samples: [] };
        rec.count++;
        if (rec.samples.length < 6) {
          rec.samples.push(
            `  lv=${lv} seed=${seed}\n    params: ${JSON.stringify(params)}\n    Q: ${p.question}\n    exp: ${JSON.stringify(oracle.answer)}\n    act: ${JSON.stringify(p.answer)}\n    expl: ${p.explanation ?? ''}`,
          );
        }
        byType.set(g.type, rec);
      }
    }
  }
}

for (const [t, rec] of [...byType.entries()].sort((a, b) => b[1].count - a[1].count)) {
  lines.push(`===== ${t} (${rec.count})`);
  lines.push(...rec.samples);
}
writeFileSync('oracle-detail.txt', lines.join('\n'), 'utf8');
console.log(`types=${byType.size} total=${[...byType.values()].reduce((a, b) => a + b.count, 0)}`);
