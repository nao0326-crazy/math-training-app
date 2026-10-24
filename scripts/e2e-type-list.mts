import { getAllGenerators } from '../src/engine/selector/generatorRegistry';
import { getTypeSupportedLevels } from '../src/engine/diversity/metadata';
import { writeFileSync } from 'node:fs';

const out = getAllGenerators().map((g) => ({
  type: g.type,
  description: g.description,
  category: g.category,
  levels: getTypeSupportedLevels(g.type),
}));

writeFileSync('e2e-type-list.json', JSON.stringify(out, null, 2), 'utf8');
console.log(`types=${out.length} totalCases=${out.reduce((n, x) => n + x.levels.length, 0)}`);