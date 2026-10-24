import { getAllGenerators } from './src/engine/selector/generatorRegistry';
import { getTypeSupportedLevels } from './src/engine/diversity/metadata';
for (const t of ['fraction_add_sub', 'integer_addition', 'integer_subtraction']) {
  const g = getAllGenerators().find((x) => x.type === t);
  if (g) console.log(t, '|', g.category, '|', JSON.stringify(getTypeSupportedLevels(t)), '|', g.description);
}
