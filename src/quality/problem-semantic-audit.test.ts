import { describe, expect, it } from 'vitest';
import { getAllGenerators } from '../engine/selector/generatorRegistry';
import { getTypeSupportedLevels } from '../engine/diversity/metadata';
import { validateProblem } from '../engine/validator/validator';
import { formatAnswer, checkUserAnswer } from '../utils/answer';
const PUBLIC_IMAGES = new Set(['supermarket-shelf.svg', 'eggs-brown-white.jpg']);
import { generateSolutionSteps } from '../engine/solution/solutionGenerator';

const REVIEW_TYPES = new Set([
  'judge_same',
  'judge_differs',
  'ratio_equal',
  'data_max_min',
  'symmetry_fold',
  'symmetry_point',
  'decimal_place_value',
]);

function norm(s: string) { return s.replace(/\s+/g, ''); }
function answerTokens(ans: any): string[] {
  const toks: string[] = [];
  if (ans.kind === 'integer' || ans.kind === 'decimal') toks.push(String(ans.value));
  else if (ans.kind === 'fraction') {
    toks.push(`${ans.numerator}/${ans.denominator}`);
    toks.push(`${ans.denominator}分の${ans.numerator}`);
  } else if (ans.kind === 'mixed') {
    toks.push(`${ans.whole}と${ans.numerator}/${ans.denominator}`);
    toks.push(`${ans.whole}と${ans.denominator}分の${ans.numerator}`);
  } else if (ans.kind === 'string') toks.push(String(ans.value));
  else if (ans.kind === 'fractions') ans.values.forEach((v: any) => toks.push(`${v.numerator}/${v.denominator}`));
  return toks;
}

describe('問題の表示内容・意味的整合性監査', () => {
  it('全96タイプを監査し、高信頼チェックの不整合が0件である', () => {
    const SEEDS = 5;
    const issues: string[] = [];
    let total = 0;
    let checked = 0;

    for (const g of getAllGenerators()) {
      for (const lv of getTypeSupportedLevels(g.type)) {
        for (let s = 0; s < SEEDS; s++) {
          const seed = s * 7919 + lv * 131 + 11;
          let p: any;
          try {
            p = g.generate({ difficulty: lv as any, seed });
          } catch (e: any) {
            issues.push(`${g.type} lv${lv} seed${seed}: generate-throw ${e?.message ?? e}`);
            continue;
          }
          const shown = (() => { try { return formatAnswer(p.answer); } catch (e: any) { return 'FORMAT-ERROR:' + e?.message; } })();
          total++;
          const v = validateProblem(p);
          if (!v.valid) issues.push(`${g.type} lv${lv} seed${seed}: base-validator ${v.errors.join('; ')}`);
          try {
            if (typeof g.validate === 'function') {
              const r = g.validate(p);
              if (!r.valid) issues.push(`${g.type} lv${lv} seed${seed}: generator-validate ${r.errors.join('; ')}`);
            }
          } catch (e: any) {
            issues.push(`${g.type} lv${lv} seed${seed}: validate-throw ${e?.message ?? e}`);
          }
          try {
            if (!shown.startsWith('FORMAT-ERROR:') && !checkUserAnswer(shown, p.answer))
              issues.push(`${g.type} lv${lv} seed${seed}: roundtrip-fail ${shown}`);
          } catch (e: any) {
            issues.push(`${g.type} lv${lv} seed${seed}: roundtrip-throw ${e?.message ?? e}`);
          }
          if (p.inputType === 'choice') {
            const choices = p.choices ?? [];
            if (!Array.isArray(choices) || choices.length < 2) issues.push(`${g.type} lv${lv} seed${seed}: choice-count ${JSON.stringify(choices)}`);
            else {
              const n = (x: string) => String(x).replace(/\s+/g, '');
              const hits = choices.filter((c: string) => n(c) === n(shown));
              if (hits.length === 0) issues.push(`${g.type} lv${lv} seed${seed}: choice-missing ${shown}`);
              if (hits.length > 1) issues.push(`${g.type} lv${lv} seed${seed}: choice-duplicate ${shown}`);
              if (new Set(choices.map(n)).size !== choices.length) issues.push(`${g.type} lv${lv} seed${seed}: choice-dup-options`);
            }
          }
          if (p.image) {
            if (!p.image.src || !String(p.image.src).startsWith('/images/')) issues.push(`${g.type} lv${lv} seed${seed}: image-src ${p.image.src}`);
            else {
              const rel = String(p.image.src).replace(/^\//, '');
              if (!PUBLIC_IMAGES.has(rel.split('/').pop() ?? '')) issues.push(g.type + ' lv' + lv + ' seed' + seed + ': image-missing-file ' + rel);
            }
            if (!p.image.altText || String(p.image.altText).trim().length < 5) issues.push(`${g.type} lv${lv} seed${seed}: image-alt`);
          }
          if ((g.type === 'realworld_shopping' || g.type === 'realworld_eggs') && !p.image) issues.push(`${g.type} lv${lv} seed${seed}: image-missing`);
          if (p.figure) {
            if (!Array.isArray(p.figure.figures) || p.figure.figures.length === 0) issues.push(`${g.type} lv${lv} seed${seed}: figure-empty`);
            for (const f of p.figure.figures ?? []) {
              if (!Array.isArray(f.vertices) || f.vertices.length < 3) issues.push(`${g.type} lv${lv} seed${seed}: figure-vertices`);
            }
          }
          if (!REVIEW_TYPES.has(g.type)) {
            const toks = answerTokens(p.answer);
            const expl = String(p.explanation ?? '');
            const steps = generateSolutionSteps(p).map((x: any) => `${x.expression ?? ''} ${x.explanation ?? ''}`).join('\n');
            const haystack = norm(expl + '\n' + steps);
            const hasToken = toks.some((t) => haystack.includes(norm(t)));
            if (!hasToken) issues.push(`${g.type} lv${lv} seed${seed}: answer-token-missing ${toks.join(',')}`);
          }
          if (g.type === 'integer_fill_blank') {
            const { a, operator, answer } = p.parameters as { a: number; operator: string; answer: number };
            let result: number | null = null;
            if (operator === '+') result = a + answer;
            else if (operator === '-') result = a - answer;
            else if (operator === '×') result = a * answer;
            else if (operator === '÷') result = a / answer;
            if (result !== null && !String(p.question).includes(String(result))) issues.push(`${g.type} lv${lv} seed${seed}: question-param-mismatch ${result}`);
          }
          checked++;
        }
      }
    }

    console.log(`[problem-semantic-audit] total=${total} checked=${checked} issues=${issues.length}`);
    expect(issues, issues.slice(0, 10).join('\n')).toHaveLength(0);
  });
});
