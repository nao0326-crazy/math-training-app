import { getAllGenerators } from '../src/engine/selector/generatorRegistry';
import { getTypeSupportedLevels } from '../src/engine/diversity/metadata';
import { validateProblem } from '../src/engine/validator/validator';
import { formatAnswer, checkUserAnswer, answerToNumber } from '../src/utils/answer';
import { reduceFraction, gcd } from '../src/utils/fraction';

const SEEDS = Number(process.env.CONSISTENCY_SEEDS ?? 30);
type Issue = { type: string; level: number; seed: number; kind: string; detail: string; question: string; answer: string };
const issues: Issue[] = [];
let total = 0;
function push(type: string, level: number, seed: number, kind: string, detail: string, q: string, a: string) {
  issues.push({ type, level, seed, kind, detail, question: q.slice(0, 200), answer: a.slice(0, 200) });
}
function numOf(ans: any): number | null {
  try { return answerToNumber(ans); } catch { return null; }
}
for (const g of getAllGenerators()) {
  const levels = getTypeSupportedLevels(g.type);
  for (const lv of levels) {
    for (let s = 0; s < SEEDS; s++) {
      const seed = s * 7919 + lv * 131 + 11;
      total++;
      let p: any;
      try {
        p = g.generate({ difficulty: lv as any, seed });
      } catch (e: any) {
        push(g.type, lv, seed, 'generate-throw', String(e?.message ?? e), '', '');
        continue;
      }
      const shown = (() => { try { return formatAnswer(p.answer); } catch (e: any) { return 'FORMAT-ERROR:' + e?.message; } })();
      const v = validateProblem(p);
      if (!v.valid) push(g.type, lv, seed, 'base-validator', v.errors.join('; '), p.question ?? '', shown);
      try {
        if (typeof (g as any).validate === 'function') {
          const r = (g as any).validate(p);
          if (!r.valid) push(g.type, lv, seed, 'generator-validate', r.errors.join('; '), p.question ?? '', shown);
        }
      } catch (e: any) {
        push(g.type, lv, seed, 'validate-throw', String(e?.message ?? e), p.question ?? '', shown);
      }
      try {
        if (!shown.trim()) push(g.type, lv, seed, 'empty-format', 'formatAnswer empty', p.question ?? '', shown);
        else if (!checkUserAnswer(shown, p.answer)) push(g.type, lv, seed, 'roundtrip-fail', 'kind=' + p.answer.kind, p.question ?? '', shown);
      } catch (e: any) {
        push(g.type, lv, seed, 'roundtrip-throw', String(e?.message ?? e), p.question ?? '', shown);
      }
      if (p.inputType === 'choice') {
        const choices = p.choices ?? [];
        if (!Array.isArray(choices) || choices.length < 2) push(g.type, lv, seed, 'choice-count', JSON.stringify(choices), p.question ?? '', shown);
        else {
          const norm = (x: string) => String(x).replace(/\s+/g, '');
          const hit = choices.filter((c: string) => norm(c) === norm(shown));
          if (hit.length === 0) push(g.type, lv, seed, 'choice-missing', shown + ' not in ' + JSON.stringify(choices), p.question ?? '', shown);
          if (hit.length > 1) push(g.type, lv, seed, 'choice-duplicate', shown + ' x' + hit.length, p.question ?? '', shown);
          if (new Set(choices.map(norm)).size !== choices.length) push(g.type, lv, seed, 'choice-dup-options', JSON.stringify(choices), p.question ?? '', shown);
        }
      }
      try {
        const params = p.parameters ?? {};
        if (g.type === 'integer_addition' && params.a !== undefined) {
          if (params.a + params.b !== p.answer.value) push(g.type, lv, seed, 'math-mismatch', params.a + '+' + params.b, p.question, shown);
        } else if (g.type === 'integer_subtraction' && params.a !== undefined) {
          if (params.a - params.b !== p.answer.value) push(g.type, lv, seed, 'math-mismatch', params.a + '-' + params.b, p.question, shown);
        } else if (g.type === 'integer_multiplication' && params.a !== undefined) {
          if (params.a * params.b !== p.answer.value) push(g.type, lv, seed, 'math-mismatch', params.a + 'x' + params.b, p.question, shown);
        } else if (g.type === 'integer_division' && params.dividend !== undefined) {
          if (params.dividend % params.divisor !== 0) push(g.type, lv, seed, 'not-divisible', params.dividend + '/' + params.divisor, p.question, shown);
          if (Math.floor(params.dividend / params.divisor) !== p.answer.value) push(g.type, lv, seed, 'math-mismatch', 'div', p.question, shown);
        } else if (g.type === 'fraction_reduce' && params.numerator !== undefined) {
          const r = reduceFraction(params.numerator, params.denominator);
          const n = numOf(p.answer);
          if (n !== null && Math.abs(n - r.numerator / r.denominator) > 1e-12) push(g.type, lv, seed, 'math-mismatch', 'reduce', p.question, shown);
          if (gcd(params.numerator, params.denominator) === 1) push(g.type, lv, seed, 'already-reduced', params.numerator + '/' + params.denominator, p.question, shown);
        } else if (g.type === 'data_average' && params.numbers) {
          const sum = params.numbers.reduce((a: number, b: number) => a + b, 0);
          const exp = Math.round((sum / params.numbers.length) * 100) / 100;
          if (Math.abs(exp - params.average) > 1e-9) push(g.type, lv, seed, 'math-mismatch', 'avg ' + exp + ' vs ' + params.average, p.question, shown);
        }
        const expl = String(p.explanation ?? '');
        const n = numOf(p.answer);
        const isStr = p.answer.kind === 'string';
        const ok = expl.includes(shown) || (n !== null && expl.includes(String(n))) || (isStr && expl.includes(String((p.answer as any).value)));
        if (!ok) push(g.type, lv, seed, 'expl-missing', 'no answer in expl', p.question ?? '', shown);
      } catch (e: any) {
        push(g.type, lv, seed, 'recompute-throw', String(e?.message ?? e), '', '');
      }
    }
  }
}
const byKind = new Map<string, number>();
for (const i of issues) byKind.set(i.kind, (byKind.get(i.kind) ?? 0) + 1);
console.log(JSON.stringify({ total, issues: issues.length, byKind: Object.fromEntries(byKind), samples: issues.slice(0, 120) }, null, 2));
