import { getAllGenerators } from './src/engine/selector/generatorRegistry';
const g=getAllGenerators().find(x=>x.type==='integer_fill_blank')!;
const p:any=g.generate({difficulty:2 as any, seed:16111});
console.log(JSON.stringify(p.parameters,null,2));
console.log('Q',p.question);
console.log('A',JSON.stringify(p.answer));
