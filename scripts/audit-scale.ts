/**
 * audit-scale.ts — 数値制限の逆監査
 *
 * 問い: 「大きすぎるので数値を削った」こと自体は正しかったのか。
 *
 * 判断基準 (数値が大きい = 悪い、ではない):
 *   1) 答えの桁数が、その generator が練習する技能の計算量として
 *      許容範囲を超えていないか (暗算で解けるか)
 *   2) 大きさを學習目標にしている型 (概算・単位換算・まとめ割りなど) は
 *      逆に数値が小さ AMA 学習価値が失われていないか
 *
 * 実行: npx vite-node scripts/audit-scale.ts
 */

import { getAllGenerators } from '../src/engine/selector/generatorRegistry';
import { getTypeSupportedLevels } from '../src/engine/diversity/metadata';
import type { DifficultyLevel, Problem } from '../src/types/problem';

const SEEDS = Number(process.env.AUDIT_SEEDS ?? 60);

/** answer から最大絶対値を取り出す (整数・分数・小数) */
function answerMagnitude(p: Problem): number | null {
  switch (p.answer.kind) {
    case 'integer':
    case 'decimal':
      return Math.abs(p.answer.value);
    case 'fraction':
      return Math.abs(p.answer.numerator);
    case 'mixed':
      return Math.abs(p.answer.denominator);
    default:
      return null;
  }
}

/** 問題文中の最大数値 */
function questionMagnitude(p: Problem): number {
  let max = 0;
  for (const m of (p.question + ' ' + (p.explanation ?? '')).match(/\d+(?:\.\d+)?/g) ?? []) {
    const v = Math.abs(Number(m));
    if (Number.isFinite(v) && v > max) max = v;
  }
  return max;
}

const targets = [
  'decimal_mul_decimal', 'decimal_mul_integer', 'rectangle_area', 'trapezoid_area',
  'area_unit_conversion', 'speed_unit_conversion', 'integer_multi_step',
  'decimal_div_decimal', 'decimal_div_integer', 'parallelogram_area', 'triangle_area',
  'volume_box', 'volume_prism', 'speed_calculation', 'fraction_mul_integer',
];

const report: Record<string, unknown> = {};

for (const type of targets) {
  const g = getAllGenerators().find((x) => x.type === type);
  if (!g) {
    report[type] = { error: 'not found' };
    continue;
  }
  const byLevel: Record<string, {
    n: number; answerMax: number; questionMax: number;
    answerMin: number; samples: string[];
  }> = {};
  for (const lv of getTypeSupportedLevels(type)) {
    const stat = { n: 0, answerMax: 0, questionMax: 0, answerMin: Number.MAX_SAFE_INTEGER, samples: [] as string[] };
    for (let s = 0; s < SEEDS; s++) {
      let p: Problem;
      try {
        p = g.generate({ difficulty: lv as DifficultyLevel, seed: s * 7919 + lv * 31 });
      } catch {
        continue;
      }
      stat.n++;
      const a = answerMagnitude(p);
      if (a !== null) {
        stat.answerMax = Math.max(stat.answerMax, a);
        stat.answerMin = Math.min(stat.answerMin, a);
      }
      stat.questionMax = Math.max(stat.questionMax, questionMagnitude(p));
      if (stat.samples.length < 3) stat.samples.push(`ans=${JSON.stringify(p.answer)} qmax=${questionMagnitude(p)}`);
    }
    byLevel[`lv${lv}`] = stat;
  }
  report[type] = byLevel;
}

// ===== 「大きさが学習目標」の型か確認 =====
// 数値が小さすぎて学習価値を失っているかを判定するための参考値。
// 数値自体を扱うことが目標の型は、削りすぎてはいけない。
const sizeIsTheGoal = [
  'estimate_product', 'unit_conversion_basic', 'area_unit_conversion', 'volume_unit',
];
const sizeAudit: Record<string, unknown> = {};
for (const type of sizeIsTheGoal) {
  const g = getAllGenerators().find((x) => x.type === type);
  if (!g) continue;
  const stat = { n: 0, answerMax: 0, questionMax: 0, samples: [] as string[] };
  for (const lv of getTypeSupportedLevels(type)) {
    for (let s = 0; s < SEEDS; s++) {
      let p: Problem;
      try {
        p = g.generate({ difficulty: lv as DifficultyLevel, seed: s * 7919 + lv });
      } catch {
        continue;
      }
      stat.n++;
      const a = answerMagnitude(p);
      if (a !== null) stat.answerMax = Math.max(stat.answerMax, a);
      stat.questionMax = Math.max(stat.questionMax, questionMagnitude(p));
      // サンプルは数値のみ (日本語を出力すると端末の文字コードで JSON が壊れるため)
      if (stat.samples.length < 5) {
        stat.samples.push(`ans=${JSON.stringify(p.answer)} max=${questionMagnitude(p)}`);
      }
    }
  }
  sizeAudit[type] = stat;
}
report.sizeIsLearningGoal = sizeAudit;

console.log(JSON.stringify(report, null, 2));