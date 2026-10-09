/**
 * 全 generator の大量生成監査 (Phase 9) + 完全ランダム性の確認 (Phase 10)
 *
 * 実行:  npx vite-node scripts/audit-generators.ts
 * 出力:  JSON (generator別 unique率、無意味問題の検出数、scope内訳など)
 *
 * 環境変数 AUDIT_SEEDS で seed 数を変えられる (既定40)。
 */

import { getAllGenerators } from '../src/engine/selector/generatorRegistry';
import { getTypeSupportedLevels, fingerprintProblem } from '../src/engine/diversity/metadata';
import { FullRandomSelector } from '../src/engine/selector/fullRandomSelector';
import { buildQuestionPool } from '../src/engine/selector/questionPool';
import { validateProblem } from '../src/engine/validator/validator';
import { generateSolutionSteps } from '../src/engine/solution/solutionGenerator';
import { formatAnswer, checkUserAnswer } from '../src/utils/answer';
import { findLearningQualityIssues } from '../src/quality/learning-quality';
import { getTypeCurriculumScope } from '../src/engine/curriculum/curriculumScope';

const SEEDS = Number(process.env.AUDIT_SEEDS ?? 40);
const DRAWS = Number(process.env.AUDIT_DRAWS ?? 6000);
const gens = getAllGenerators();

let total = 0,
  genFail = 0,
  invalid = 0,
  unanswerable = 0,
  noSteps = 0,
  meaningless = 0,
  curric = 0;
const perType = new Map<string, { gen: number; uniq: Set<string> }>();
const ruleHits = new Map<string, number>();
const scopeHits = new Map<string, number>();

/** 小6終了時点を超える概念のシグナル */
const OUT_OF_SCOPE = /平方根|√|球|円錐|扇形|相似|内角|外角|対頂角|一次方程式|連立方程式|確率|べき乗|指数関数/;

for (const g of gens) {
  const rec = { gen: 0, uniq: new Set<string>() };
  perType.set(g.type, rec);
  for (const lv of getTypeSupportedLevels(g.type)) {
    for (let s = 0; s < SEEDS; s++) {
      rec.gen++;
      total++;
      let p;
      try {
        p = g.generate({ difficulty: lv, seed: s * 7919 + lv * 31 + 7 });
      } catch {
        genFail++;
        continue;
      }
      if (!p) {
        genFail++;
        continue;
      }
      rec.uniq.add(p.question);
      if (!validateProblem(p).valid) invalid++;
      const shown = formatAnswer(p.answer);
      if (!shown.trim() || !checkUserAnswer(shown, p.answer)) unanswerable++;
      if (generateSolutionSteps(p).length === 0) noSteps++;
      for (const issue of findLearningQualityIssues(p)) {
        meaningless++;
        ruleHits.set(issue.rule, (ruleHits.get(issue.rule) ?? 0) + 1);
      }
      if (OUT_OF_SCOPE.test(p.question)) curric++;
      const scope = getTypeCurriculumScope(p.type);
      const cat = scope?.category ?? 'unknown';
      scopeHits.set(cat, (scopeHits.get(cat) ?? 0) + 1);
    }
  }
}

// ===== Phase 10: FullRandomSelector の完全ランダム性 =====
const selector = new FullRandomSelector();
const hits = new Map<string, number>();
let lastFp: string | null = null;
let lastType: string | null = null;
let exactRepeat = 0;
let sameTypeAdjacent = 0;

for (let i = 0; i < DRAWS; i++) {
  // FullRandomSelector は Math.random を使うため seed は渡さない。
  const problem = selector.selectNextQuestion([], [], {
    mode: { kind: 'full-random' },
    difficulty: 3,
  });
  hits.set(problem.type, (hits.get(problem.type) ?? 0) + 1);
  const fp = fingerprintProblem(problem);
  if (lastFp === fp) exactRepeat++;
  if (lastType === problem.type) sameTypeAdjacent++;
  lastFp = fp;
  lastType = problem.type;
}

const pool = buildQuestionPool();
const poolTypes = pool.map((p) => p.type);
const missing = poolTypes.filter((t) => !hits.has(t));
const counts = [...hits.values()].sort((a, b) => a - b);
const expected = DRAWS / poolTypes.length;

const report = {
  generators: gens.length,
  poolSize: pool.length,
  totalGenerated: total,
  generationFailures: genFail,
  validatorFailures: invalid,
  unanswerableAnswers: unanswerable,
  missingSolutionSteps: noSteps,
  meaninglessProblems: meaningless,
  ruleHits: Object.fromEntries(ruleHits),
  curriculumOutOfRangeSignals: curric,
  scopeCategoryCounts: Object.fromEntries(scopeHits),
  uniqueness: [...perType.entries()]
    .map(([type, r]) => ({
      type,
      generated: r.gen,
      unique: r.uniq.size,
      ratio: +(r.uniq.size / Math.max(1, r.gen)).toFixed(3),
    }))
    .sort((a, b) => a.ratio - b.ratio),
  fullRandom: {
    draws: DRAWS,
    distinctTypesSeen: hits.size,
    missingTypes: missing,
    expectedPerType: +expected.toFixed(1),
    minCount: counts[0],
    maxCount: counts[counts.length - 1],
    exactAdjacentRepeat: exactRepeat,
    sameTypeAdjacent,
  },
};

console.log(JSON.stringify(report, null, 2));