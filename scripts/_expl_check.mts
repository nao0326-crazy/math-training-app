import { getAllGenerators } from '../src/engine/selector/generatorRegistry';
import { getTypeSupportedLevels } from '../src/engine/diversity/metadata';
import { formatAnswer } from '../src/utils/answer';
import { writeFileSync } from 'node:fs';
const lines: string[] = [];
const byType = new Map<string, {count:number; samples:string[]}>();
for (const g of getAllGenerators()) {
  for (const lv of getTypeSupportedLevels(g.type)) {
    for (let s=0; s<15; s++) {
      const seed = s*7919 + lv*131 + 11;
      let p: any;
      try { p = g.generate({difficulty: lv as any, seed}); } catch { continue; }
      const shown = (() => { try { return formatAnswer(p.answer); } catch { return '?'; } })();
      const expl = String(p.explanation ?? '');
      const n = (() => { try { const a = p.answer; if (a.kind==='integer'||a.kind==='decimal') return a.value; if (a.kind==='fraction') return a.numerator/a.denominator; if (a.kind==='mixed') return a.whole+a.numerator/a.denominator; return null; } catch { return null; } })();
      const isStr = p.answer.kind === 'string';
      const ok = !expl.trim() ? true : expl.includes(shown) || (n!==null && expl.includes(String(n))) || (isStr && expl.includes(String(p.answer.value ?? '')));
      if (!ok) { const r = byType.get(g.type) ?? {count:0,samples:[]}; r.count++; if (r.samples.length<4) r.samples.push(`lv=${lv} seed=${seed} kind=${p.answer.kind} shown=${shown}\n    q=${p.question}\n    expl=${expl}`); byType.set(g.type, r); }
    }
  }
}
for (const [t,r] of [...byType.entries()].sort((a,b)=>b[1].count-a[1].count)) { lines.push(`===== ${t} (${r.count})`); lines.push(...r.samples.map(s=>'  '+s)); }
writeFileSync('_expl_report.txt', lines.join('\n'), 'utf8');
console.log('types=' + byType.size);
