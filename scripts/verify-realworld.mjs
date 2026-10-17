/** verify-realworld.mjs — 本番と同じレジストリ経路で画像問題を実証する */
import { getGeneratorByType, getAllGenerators } from '../src/engine/selector/generatorRegistry.ts';
import { getTypeSupportedLevels } from '../src/engine/diversity/metadata.ts';
import { attachSolutionSteps } from '../src/engine/solution/solutionGenerator.ts';
import { validateProblem } from '../src/engine/validator/validator.ts';

const TYPES = ['realworld_shopping', 'realworld_eggs'];
console.log('=== 1. 管理者UIで選択可能か (supported levels) ===');
for (const t of TYPES) {
  let lv = null; try { lv = getTypeSupportedLevels(t); } catch (e) { lv = 'THROW: ' + e.message; }
  console.log(`  ${t}: ${JSON.stringify(lv)}`);
}

console.log('\n=== 2. レジストリ経路 (generate→validate→attachSolutionSteps) ===');
let fail = 0;
for (const t of TYPES) {
  const gen = getGeneratorByType(t);
  if (!gen) { console.log(`  FAIL ${t}: generator not registered`); fail++; continue; }
  for (const level of [2, 3, 4, 5]) {
    const seed = [...`${t}-L${level}`].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) % 2147483647, 7);
    let problem = null, err = null;
    try {
      problem = gen.generate({ difficulty: level, seed });
      const v = validateProblem(problem);
      if (!v.valid) err = 'invalid: ' + JSON.stringify(v);
      problem = attachSolutionSteps(problem);
    } catch (e) { err = 'THROW: ' + e.message; }
    if (err) { console.log(`  FAIL ${t}:L${level} ${err}`); fail++; continue; }
    const steps = problem.solutionSteps?.length ?? 0;
    const hasImg = !!problem.image?.src;
    const ok = steps > 0 && hasImg;
    if (!ok) fail++;
    console.log(`  ${ok ? 'OK  ' : 'FAIL'} ${t}:L${level} img=${problem.image?.src} steps=${steps} alt=${(problem.image?.altText??'').slice(0,24)}`);
  }
}

console.log('\n=== 3. 全96生成器で image を持つものは2つだけか ===');
const withImg = [];
for (const g of getAllGenerators()) {
  try { const p = g.generate({ difficulty: 3, seed: 42 }); if (p?.image?.src) withImg.push(g.type); } catch {}
}
console.log(`  withImage(${withImg.length}): ${withImg.join(', ')}`);

console.log(`\nRESULT ${fail === 0 ? 'ALL_PASS' : 'FAILURES=' + fail}`);
process.exit(fail ? 1 : 0);
