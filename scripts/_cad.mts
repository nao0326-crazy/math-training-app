import { getAllGenerators } from './src/engine/selector/generatorRegistry';
const g=getAllGenerators().find(x=>x.type==='circle_area_diameter')!;
const p:any=g.generate({difficulty:2 as any, seed:1});
console.log(JSON.stringify(p.parameters,null,2));
console.log('Q',p.question);
console.log('A',JSON.stringify(p.answer));
