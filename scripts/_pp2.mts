import { getAllGenerators } from './src/engine/selector/generatorRegistry';
import { getTypeSupportedLevels } from './src/engine/diversity/metadata';
const g=getAllGenerators().find(x=>x.type==='parallel_perpendicular')!;
const p:any=g.generate({difficulty:5 as any, seed:8585});
console.log(JSON.stringify(p.answer));
console.log('Q',p.question);
console.log('E',p.explanation);
