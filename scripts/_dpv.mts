import { getAllGenerators } from './src/engine/selector/generatorRegistry';
const g=getAllGenerators().find(x=>x.type==='decimal_place_value')!;
let c=0;
for (let seed=0;seed<30;seed++) {
  const p:any=g.generate({difficulty:2 as any, seed});
  const expl=String(p.explanation??'');
  if (!expl.includes(String((p.answer as any).value))) { c++; if (c<=5) console.log(JSON.stringify(p.parameters), 'Q',p.question,'E',expl,'A',JSON.stringify(p.answer)); }
}
console.log('missing count',c);
