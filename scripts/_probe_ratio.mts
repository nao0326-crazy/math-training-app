import { getAllGenerators } from '../src/engine/selector/generatorRegistry';
const g = getAllGenerators().find(x => x.type === 'ratio_simplify')!;
for (let s=1;s<5;s++){
  const p:any = g.generate({ difficulty: 2, seed: s });
  console.log(s, JSON.stringify(p.answer), p.question);
}