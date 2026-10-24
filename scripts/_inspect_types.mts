import { getAllGenerators } from './src/engine/selector/generatorRegistry';
const types=['judge_same','judge_differs','ratio_equal','data_max_min','symmetry_fold','symmetry_point','decimal_place_value'];
for (const t of types) {
  const g=getAllGenerators().find(x=>x.type===t)!;
  const p:any=g.generate({difficulty:2 as any, seed:1});
  console.log('====',t);
  console.log('Q',p.question);
  console.log('A',JSON.stringify(p.answer));
  console.log('E',p.explanation);
  console.log('choices',JSON.stringify(p.choices));
  console.log('steps',JSON.stringify(p.solutionSteps));
}
