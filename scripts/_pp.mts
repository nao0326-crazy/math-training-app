import { getAllGenerators } from './src/engine/selector/generatorRegistry';
import { getTypeSupportedLevels } from './src/engine/diversity/metadata';
import { generateSolutionSteps } from './src/engine/solution/solutionGenerator';
import { formatAnswer } from './src/utils/answer';
const g=getAllGenerators().find(x=>x.type==='parallel_perpendicular')!;
for (const lv of getTypeSupportedLevels(g.type)) {
  for (let s=0;s<3;s++) {
    const seed=s*7919+lv*131+11;
    const p:any=g.generate({difficulty:lv as any, seed});
    const steps=generateSolutionSteps(p);
    const shown=formatAnswer(p.answer);
    const text=steps.map((x:any)=>`${x.expression??''} ${x.explanation??''}`).join(' | ');
    if (!text.includes(shown)) console.log('lv',lv,'seed',seed,'ans',shown,'params',JSON.stringify(p.parameters),'steps',text);
  }
}
