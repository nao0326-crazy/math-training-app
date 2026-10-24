import { getAllGenerators } from './src/engine/selector/generatorRegistry';
import { getTypeSupportedLevels } from './src/engine/diversity/metadata';
import { formatAnswer } from './src/utils/answer';
const SEEDS=3;
const issues:any[]=[];
let total=0;
for (const g of getAllGenerators()) {
  for (const lv of getTypeSupportedLevels(g.type)) {
    for (let s=0;s<SEEDS;s++) {
      const seed=s*7919+lv*131+11;
      let p:any; try { p=g.generate({difficulty:lv as any, seed}); } catch { continue; }
      total++;
      // extract numbers from question
      const nums = (p.question.match(/-?\d+(?:\.\d+)?/g) || []).map(Number);
      const paramVals = Object.values(p.parameters||{}).flatMap((v:any)=> Array.isArray(v)?v:[v]).filter(v=>typeof v==='number');
      const ansNums=[];
      if (p.answer.kind==='integer'||p.answer.kind==='decimal') ansNums.push(p.answer.value);
      if (p.answer.kind==='fraction'||p.answer.kind==='mixed') { if(p.answer.kind==='fraction'){ansNums.push(p.answer.numerator,p.answer.denominator);} else {ansNums.push(p.answer.whole,p.answer.numerator,p.answer.denominator);} }
      const allowed=new Set([...paramVals,...ansNums,0,1,2,3,4,5,6,7,8,9,10,100]);
      const unknown = nums.filter(n=>!allowed.has(n));
      if (unknown.length) issues.push({type:g.type,lv,seed,unknown,q:p.question.slice(0,120)});
    }
  }
}
console.log('total',total,'issues',issues.length);
// group
const by=new Map();
for (const i of issues) by.set(i.type,(by.get(i.type)||0)+1);
for (const [t,c] of [...by.entries()].sort((a,b)=>b[1]-a[1]).slice(0,40)) console.log(t,c);
console.log('sample', JSON.stringify(issues[0],null,2));
