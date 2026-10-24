import { getAllGenerators } from './src/engine/selector/generatorRegistry';
import { getTypeSupportedLevels } from './src/engine/diversity/metadata';
import { validateProblem } from './src/engine/validator/validator';
import { formatAnswer, checkUserAnswer } from './src/utils/answer';
import { existsSync } from 'node:fs';
import { generateSolutionSteps } from './src/engine/solution/solutionGenerator';

function norm(s:string){ return s.replace(/\s+/g,'').replace(/[×✕✖*＊]/g,'×').replace(/[÷／]/g,'÷'); }
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
const issues:any[]=[];
let total=0, checked=0;
function push(kind:string, p:any, g:any, lv:number, seed:number, detail:string){ issues.push({kind,type:g.type,level:lv,seed,detail,q:String(p.question).slice(0,120)}); }
for (const g of getAllGenerators()) {
  for (const lv of getTypeSupportedLevels(g.type)) {
    for (let s=0;s<SEEDS;s++) {
      const seed=s*7919+lv*131+11;
      let p:any; try { p=g.generate({difficulty:lv as any, seed}); } catch(e:any){ push('generate-throw',null,g,lv,seed,String(e?.message)); continue; }
      total++;
      const shown=formatAnswer(p.answer);
      // base validator
      const v=validateProblem(p); if(!v.valid) push('base-validator',p,g,lv,seed,v.errors.join(';'));
      try { if (typeof g.validate==='function'){ const r=g.validate(p); if(!r.valid) push('generator-validate',p,g,lv,seed,r.errors.join(';')); } } catch(e:any){ push('validate-throw',p,g,lv,seed,String(e?.message)); }
      // roundtrip
      try { if (!checkUserAnswer(shown,p.answer)) push('roundtrip-fail',p,g,lv,seed,shown); } catch(e:any){ push('roundtrip-throw',p,g,lv,seed,String(e?.message)); }
      // choices
      if (p.inputType==='choice') {
        const choices=p.choices??[];
        if (!Array.isArray(choices)||choices.length<2) push('choice-count',p,g,lv,seed,JSON.stringify(choices));
        else {
          const normc=(x:string)=>String(x).replace(/\s+/g,'');
          const hits=choices.filter((c:string)=>normc(c)===normc(shown));
          if (hits.length===0) push('choice-missing',p,g,lv,seed,shown+' not in '+JSON.stringify(choices));
          if (hits.length>1) push('choice-duplicate',p,g,lv,seed,shown+' x'+hits.length);
          if (new Set(choices.map(normc)).size!==choices.length) push('choice-dup-options',p,g,lv,seed,JSON.stringify(choices));
        }
      }
      // explanation/answer token
      const toks=answerTokens(p.answer);
      const expl=String(p.explanation??'');
      const steps=(p.solutionSteps??[]).map((x:any)=>`${x.expression??''} ${x.explanation??''}`).join('\n');
      const haystack=norm(expl+'\n'+steps);
      const hasToken = toks.some(t=>haystack.includes(norm(t)));
      if (!hasToken) push('answer-token-missing',p,g,lv,seed,toks.join(','));
      // image
      if (p.image) {
        if (!p.image.src || !p.image.src.startsWith('/images/')) push('image-src',p,g,lv,seed,String(p.image.src));
        else {
          const rel=p.image.src.replace(/^\//,'');
          if (!existsSync('public/'+rel)) push('image-missing-file',p,g,lv,seed,rel);
        }
        if (!p.image.altText || p.image.altText.trim().length<5) push('image-alt',p,g,lv,seed,'');
      }
      if ((g.type==='realworld_shopping'||g.type==='realworld_eggs') && !p.image) push('image-missing',p,g,lv,seed,'');
      // figure
      if (p.figure) {
        if (!Array.isArray(p.figure.figures)||p.figure.figures.length===0) push('figure-empty',p,g,lv,seed,'');
        for (const f of (p.figure.figures||[])) {
          if (!Array.isArray(f.vertices)||f.vertices.length<3) push('figure-vertices',p,g,lv,seed,'');
        }
      }
      checked++;
    }
  }
}
const byKind=new Map();
for (const i of issues) byKind.set(i.kind,(byKind.get(i.kind)||0)+1);
console.log(JSON.stringify({total,checked,issues:issues.length,byKind:Object.fromEntries(byKind)},null,2));
// show samples per kind
const shown=new Set();
for (const i of issues) { if (!shown.has(i.kind)) { shown.add(i.kind); console.log('SAMPLE',i.kind, i.type, i.level, i.seed, i.detail, i.q); } }
