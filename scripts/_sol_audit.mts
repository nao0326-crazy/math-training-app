import { getAllGenerators } from './src/engine/selector/generatorRegistry';
import { getTypeSupportedLevels } from './src/engine/diversity/metadata';
import { generateSolutionSteps } from './src/engine/solution/solutionGenerator';
import { formatAnswer } from './src/utils/answer';
const SEEDS=5;
let total=0, issues=0;
const byType=new Map();
for (const g of getAllGenerators()) {
  for (const lv of getTypeSupportedLevels(g.type)) {
    for (let s=0;s<SEEDS;s++) {
      const seed=s*7919+lv*131+11;
      let p:any; try { p=g.generate({difficulty:lv as any, seed}); } catch { continue; }
      total++;
      const steps=generateSolutionSteps(p);
      const shown=formatAnswer(p.answer);
      const text=steps.map((x:any)=>`${x.expression??''} ${x.explanation??''}`).join('\n');
      // final answer appears?
      const ok = text.includes(shown) || steps.some((x:any)=> (x.expression??'').includes(shown) || (x.explanation??'').includes(shown));
      if (!ok) { issues++; const r=byType.get(g.type)??{n:0}; r.n++; byType.set(g.type,r); }
    }
  }
}
console.log('total',total,'issues',issues);
for (const [t,r] of [...byType.entries()].sort((a,b)=>b[1].n-a[1].n)) console.log(t,r.n);
