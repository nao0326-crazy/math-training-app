import { getAllGenerators } from './src/engine/selector/generatorRegistry';
import { readFileSync } from 'node:fs';
const oracle = readFileSync('scripts/oracle-audit.mts', 'utf8');
const covered = new Set([...oracle.matchAll(/case '([a-z_0-9]+)':/g)].map(m => m[1]));
const all = getAllGenerators().map(g => g.type);
console.log('TOTAL=' + all.length);
console.log('COVERED=' + all.filter(t => covered.has(t)).length);
console.log('UNCOVERED:');
console.log(all.filter(t => !covered.has(t)).join('\n'));
