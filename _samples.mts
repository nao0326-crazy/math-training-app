import { getAllGenerators } from './src/engine/selector/generatorRegistry';
import { getTypeSupportedLevels } from './src/engine/diversity/metadata';
for (const g of getAllGenerators()) {
  const lv = getTypeSupportedLevels(g.type)[0] ?? 1;
  try {
    const p: any = g.generate({ difficulty: lv, seed: 12345 });
    console.log(`TYPE=${g.type} LEVEL=${lv}`);
    console.log(`Q=${p.question}`);
    console.log(`A=${JSON.stringify(p.answer)}`);
    console.log(`P=${JSON.stringify(p.parameters)}`);
    console.log('---');
  } catch (e) {
    console.log(`TYPE=${g.type} ERROR=${e}`);
  }
}
EOF