import { PrimeJudgmentGenerator } from './src/problems/numberTheory/generators';
import { writeFileSync } from 'fs';
const gen = new PrimeJudgmentGenerator();
const lines: string[] = [];
let multiPrime = 0, total = 0;
const seen = new Set<string>();
for (let s = 0; s < 3000; s++) {
  const p = gen.generate({ difficulty: 3 as any, seed: s * 31 + 7 });
  const q = p.parameters as any;
  total++;
  const primes = q.choices.filter((n: number) => {
    for (let d = 2; d * d <= n; d++) if (n % d === 0) return false;
    return n >= 2;
  });
  if (primes.length > 1) {
    multiPrime++;
    if (!seen.has('multi')) { seen.add('multi'); lines.push('MULTI-PRIME CASE: ' + p.question + ' | choices=' + JSON.stringify(q.choices) + ' answer=' + q.answer + ' primes=' + JSON.stringify(primes)); }
  }
  if (s < 3 && !seen.has('basic')) {
    seen.add('basic');
    lines.push('BASIC: ' + p.question);
    lines.push('  answer=' + JSON.stringify(p.answer));
    lines.push('  expl=' + p.explanation);
    lines.push('  params=' + JSON.stringify(q));
  }
}
lines.push('total=' + total + ' multiPrimeCases=' + multiPrime);
writeFileSync('_prime_out.txt', lines.join('\n'), 'utf8');
console.log('ok multi=' + multiPrime + '/' + total);
