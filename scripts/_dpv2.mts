import { getAllGenerators } from './src/engine/selector/generatorRegistry';
import { getTypeSupportedLevels } from './src/engine/diversity/metadata';
const g=getAllGenerators().find(x=>x.type==='decimal_place_value')!;
function norm(s:string){ return s.replace(/\s+/g,''); }
for (const lv of getTypeSupportedLevels(g.type)) {
  for (let s=0;s<8;s++) {
    const seed=s*7919+lv*131+11;
    const p:any=g.generate({difficulty:lv as any, seed});
    const expl=String(p.explanation??'');
    const steps=(p.solutionSteps??[]).map((x:any)=>`${x.expression??''} ${x.explanation??''}`).join('\n');
    const haystack=norm(expl+'\n'+steps);
    const tok=String((p.answer as any).value);
    if (!haystack.includes(tok)) console.log('MISSING', 'lv',lv,'seed',seed, JSON.stringify(p.parameters), 'Q',p.question, 'E',expl, 'steps',steps);
  }
}
console.log('done');
