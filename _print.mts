import { getGeneratorByType } from './src/engine/selector/generatorRegistry';
const g = getGeneratorByType('fraction_mul_fraction')!;
const p = g.generate({ difficulty: 1, seed: 142 });
console.log(JSON.stringify(p, null, 2));
EOF
