import { getAllGenerators } from './src/engine/selector/generatorRegistry';
const g=getAllGenerators();
console.log(g.length);
console.log(g.map(x=>x.type).join(', '));
