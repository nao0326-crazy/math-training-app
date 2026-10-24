import { PercentageGenerator } from './src/problems/ratio/generators';
import { writeFileSync } from 'fs';
const gen = new PercentageGenerator();
const lines: string[] = [];
const seen = new Set<string>();
for (let s = 0; s < 400 && seen.size < 3; s++) {
  const p = gen.generate({ difficulty: 3 as any, seed: s * 7919 + 3 });
  const q = p.parameters as any;
  const key = q.variant;
  if (seen.has(key)) continue;
  seen.add(key);
  lines.push('### ' + q.variant);
  lines.push('Q: ' + p.question);
  lines.push('A: ' + JSON.stringify(p.answer));
  lines.push('params: ' + JSON.stringify(q));
  lines.push('EXPL: ' + p.explanation);
  lines.push('');
}
writeFileSync('_pct_out.txt', lines.join('\n'), 'utf8');
console.log('written', seen.size);
