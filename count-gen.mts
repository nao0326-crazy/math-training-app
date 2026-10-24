import { getAllGenerators } from './src/engine/selector/generatorRegistry';
import { getTypeSupportedLevels } from './src/engine/diversity/metadata';
const all = getAllGenerators();
const usable = all.filter((g) => getTypeSupportedLevels(g.type).length > 0);
console.log('total generators:', all.length);
console.log('usable (levels>0):', usable.length);
const missing = all.filter((g) => getTypeSupportedLevels(g.type).length === 0).map((g) => g.type);
console.log('excluded types:', JSON.stringify(missing));
