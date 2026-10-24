import { getAllGenerators } from './src/engine/selector/generatorRegistry';
const g=getAllGenerators().find(x=>x.type==='decimal_place_value')!;
const p:any=g.generate({difficulty:3 as any, seed:16242});
console.log('answer', JSON.stringify(p.answer));
console.log('kind', p.answer.kind);
