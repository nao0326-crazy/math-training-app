// @ts-nocheck
/**
 * 表示内容・意味的整合性監査
 *
 * 生成された Problem の question / choices / explanation / image / figure / solutionSteps が
 * 内部データ (parameters / answer) と整合しているかを、生成器の validate とは独立に検証する。
 *
 * 実行: npx vite-node scripts/semantic-audit.mts
 * 環境変数 SEMANTIC_SEEDS で試行数を変更できる (既定 10)。
 */
import { writeFileSync } from 'node:fs';
import { getAllGenerators } from '../src/engine/selector/generatorRegistry';
import { getTypeSupportedLevels } from '../src/engine/diversity/metadata';
import { validateProblem } from '../src/engine/validator/validator';
import { formatAnswer, checkUserAnswer } from '../src/utils/answer';
import { existsSync } from 'node:fs';
import { generateSolutionSteps } from '../src/engine/solution/solutionGenerator';

const SEEDS = Number(process.env.SEMANTIC_SEEDS ?? 10);

export type Issue = {
  type: string;
  level: number;
  seed: number;
  kind: string;
  detail: string;
  question: string;
};

const issues: Issue[] = [];
const reviewItems: { type: string; reason: string }[] = [];
let total = 0;
let checked = 0;

function push(type: string, level: number, seed: number, kind: string, detail: string, q: string) {
  issues.push({ type, level, seed, kind, detail, question: q.slice(0, 200) });
}

function norm(s: string) {
  return s.replace(/\s+/g, '');
}

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
  else if (ans.kind === 'fractions')
    ans.values.forEach((v: any) => toks.push(`${v.numerator}/${v.denominator}`));
  return toks;
}

// 解説に答えが逐語的には現れなくても、説明が答えを構成的に示すタイプ。
// (例: はい/いいえ問題では説明が「合同です」等で答えを含意する)
const REVIEW_TYPES = new Set([
  'judge_same',
  'judge_differs',
  'ratio_equal',
  'data_max_min',
  'symmetry_fold',
  'symmetry_point',
  'decimal_place_value',
]);
for (const t of REVIEW_TYPES) {
  reviewItems.push({
    type: t,
    reason:
      '答えが解説に逐語的には現れないが、説明が答えを構成的に示している (人間確認推奨)',
  });
}

for (const g of getAllGenerators()) {
  const levels = getTypeSupportedLevels(g.type);
  for (const lv of levels) {
    for (let s = 0; s < SEEDS; s++) {
      const seed = s * 7919 + lv * 131 + 11;
      let p: any;
      try {
        p = g.generate({ difficulty: lv as any, seed });
      } catch (e: any) {
        push(g.type, lv, seed, 'generate-throw', String(e?.message ?? e), '');
        continue;
      }
      const shown = (() => {
        try {
          return formatAnswer(p.answer);
        } catch (e: any) {
          return 'FORMAT-ERROR:' + e?.message;
        }
      })();
      total++;

      // 基本 validator
      const v = validateProblem(p);
      if (!v.valid) push(g.type, lv, seed, 'base-validator', v.errors.join('; '), p.question ?? '');

      // 生成器自身の validate
      try {
        if (typeof g.validate === 'function') {
          const r = g.validate(p);
          if (!r.valid) push(g.type, lv, seed, 'generator-validate', r.errors.join('; '), p.question ?? '');
        }
      } catch (e: any) {
        push(g.type, lv, seed, 'validate-throw', String(e?.message ?? e), p.question ?? '');
      }

      // roundtrip
      try {
        if (!shown.startsWith('FORMAT-ERROR:') && !checkUserAnswer(shown, p.answer))
          push(g.type, lv, seed, 'roundtrip-fail', shown, p.question ?? '');
      } catch (e: any) {
        push(g.type, lv, seed, 'roundtrip-throw', String(e?.message ?? e), p.question ?? '');
      }

      // 選択肢
      if (p.inputType === 'choice') {
        const choices = p.choices ?? [];
        if (!Array.isArray(choices) || choices.length < 2)
          push(g.type, lv, seed, 'choice-count', JSON.stringify(choices), p.question ?? '');
        else {
          const n = (x: string) => String(x).replace(/\s+/g, '');
          const hits = choices.filter((c: string) => n(c) === n(shown));
          if (hits.length === 0)
            push(g.type, lv, seed, 'choice-missing', shown + ' not in ' + JSON.stringify(choices), p.question ?? '');
          if (hits.length > 1)
            push(g.type, lv, seed, 'choice-duplicate', shown + ' x' + hits.length, p.question ?? '');
          if (new Set(choices.map(n)).size !== choices.length)
            push(g.type, lv, seed, 'choice-dup-options', JSON.stringify(choices), p.question ?? '');
        }
      }

      // 画像
      if (p.image) {
        if (!p.image.src || !String(p.image.src).startsWith('/images/'))
          push(g.type, lv, seed, 'image-src', String(p.image.src), p.question ?? '');
        else {
          const rel = String(p.image.src).replace(/^\//, '');
          if (!existsSync('public/' + rel))
            push(g.type, lv, seed, 'image-missing-file', rel, p.question ?? '');
        }
        if (!p.image.altText || String(p.image.altText).trim().length < 5)
          push(g.type, lv, seed, 'image-alt', '', p.question ?? '');
      }
      if ((g.type === 'realworld_shopping' || g.type === 'realworld_eggs') && !p.image)
        push(g.type, lv, seed, 'image-missing', '', p.question ?? '');

      // 図形
      if (p.figure) {
        if (!Array.isArray(p.figure.figures) || p.figure.figures.length === 0)
          push(g.type, lv, seed, 'figure-empty', '', p.question ?? '');
        for (const f of p.figure.figures ?? []) {
          if (!Array.isArray(f.vertices) || f.vertices.length < 3)
            push(g.type, lv, seed, 'figure-vertices', '', p.question ?? '');
        }
      }

      // 解説・途中式に答えが含まれるか (REVIEW_TYPES は人間確認扱い)
      if (!REVIEW_TYPES.has(g.type)) {
        const toks = answerTokens(p.answer);
        const expl = String(p.explanation ?? '');
        const steps = generateSolutionSteps(p)
          .map((x: any) => `${x.expression ?? ''} ${x.explanation ?? ''}`)
          .join('\n');
        const haystack = norm(expl + '\n' + steps);
        const hasToken = toks.some((t) => haystack.includes(norm(t)));
        if (!hasToken)
          push(g.type, lv, seed, 'answer-token-missing', toks.join(','), p.question ?? '');
      }

      // 問題文とパラメータの追加整合性 (integer_fill_blank)
      if (g.type === 'integer_fill_blank') {
        const { a, operator, answer } = p.parameters as { a: number; operator: string; answer: number };
        let result: number | null = null;
        if (operator === '+') result = a + answer;
        else if (operator === '-') result = a - answer;
        else if (operator === '×') result = a * answer;
        else if (operator === '÷') result = a / answer;
        if (result !== null && !String(p.question).includes(String(result)))
          push(g.type, lv, seed, 'question-param-mismatch', `${operator} result ${result}`, p.question ?? '');
      }

      checked++;
    }
  }
}

const byKind: Record<string, number> = {};
for (const i of issues) byKind[i.kind] = (byKind[i.kind] ?? 0) + 1;
const byType: Record<string, number> = {};
for (const i of issues) byType[i.type] = (byType[i.type] ?? 0) + 1;

const out = {
  total,
  checked,
  issues: issues.length,
  byKind,
  byType,
  reviewTypes: [...REVIEW_TYPES],
  reviewItems,
  samples: issues.slice(0, 50),
};
writeFileSync('semantic-audit-report.json', JSON.stringify(out, null, 2), 'utf8');
console.log(`total=${total} checked=${checked} issues=${issues.length} reviewTypes=${REVIEW_TYPES.size}`);
for (const [k, c] of Object.entries(byKind)) console.log(`  ${k}: ${c}`);
