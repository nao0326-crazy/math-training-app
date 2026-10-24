import { PrimeJudgmentGenerator } from '../src/problems/numberTheory/generators';
import { isPrime } from '../src/utils/numberTheory';

const gen = new PrimeJudgmentGenerator();
let ambiguous = 0;
let total = 0;
const samples: string[] = [];
for (let lv = 1; lv <= 3; lv++) {
  for (let s = 0; s < 300; s++) {
    const p = gen.generate({ difficulty: lv as any, seed: s * 7919 + lv });
    const q = p.parameters as { choices: number[]; answer: number };
    total++;
    const primesInChoices = q.choices.filter(isPrime);
    if (primesInChoices.length !== 1) {
      ambiguous++;
      if (samples.length < 5) {
        samples.push(`lv${lv} seed=${s} choices=${q.choices.join(',')} primes=[${primesInChoices.join(',')}] answer=${q.answer}`);
      }
    }
  }
}
console.log('total', total, 'ambiguous', ambiguous);
for (const s of samples) console.log('  ', s);
