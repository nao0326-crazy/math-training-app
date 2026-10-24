import { getAllGenerators } from './src/engine/selector/generatorRegistry';
import { getTypeSupportedLevels } from './src/engine/diversity/metadata';
import { validateProblem } from './src/engine/validator/validator';
import { formatAnswer, checkUserAnswer } from './src/utils/answer';
import { existsSync } from 'node:fs';
import { generateSolutionSteps } from './src/engine/solution/solutionGenerator';
function norm(s:string){ return s.replace(/\s+/g,''); }
function answerTokens(ans:any): string[] {
  const toks=[];
  if (ans.kind==='integer'||ans.kind==='decimal') toks.push(String(ans.value));
  else if (ans.kind==='fraction') { toks.push(`${ans.numerator}/${ans.denominator}`); toks.push(`${ans.denominator}分の${ans.numerator}`); }
  else if (ans.kind==='mixed') { toks.push(`${ans.whole}と${ans.numerator}/${ans.denominator}`); toks.push(`${ans.whole}と${ans.denominator}分の${ans.numerator}`); }
  else if (ans.kind==='string') toks.push(String(ans.value));
  else if (ans.kind==='fractions') ans.values.forEach((v:any)=>{toks.push(`${v.numerator}/${v.denominator}`);});
  return toks;
}
const SEEDS=8;
const byType=new Map();
for (const g of getAllGenerators()) {
  for (const lv of getTypeSupportedLevels(g.type)) {
    for (let s=0;s<SEEDS;s++) {
      const seed=s*7919+lv*131+11;
      let p:any; try { p=g.generate({difficulty:lv as any, seed}); } catch { continue; }
      const expl=String(p.explanation??'');
      const steps=(p.solutionSteps??[]).map((x:any)=>`${x.expression??''} ${x.explanation??''}`).join('\n');
      const haystack=norm(expl+'\n'+steps);
      const toks=answerTokens(p.answer);
      const hasToken = toks.some(t=>haystack.includes(norm(t)));
      if (!hasToken) byType.set(g.type,(byType.get(g.type)||0)+1);
    }
  }
}
for (const [t,c] of [...byType.entries()].sort((a,b)=>b[1]-a[1])) console.log(t,c);
