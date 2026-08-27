/**
 * 問題メタデータ
 *
 * 「この問題が数学的にどういう問題か」を機械的に判定できるようにする。
 * 単元 → 難易度 → Family → Subtype → 数値パターン の階層で問題構造を捉え、
 * 出題の多様性制御・類似度判定・重複検出に使う。
 */

import type { Problem } from '../../types/problem';

/** 問題の構造メタデータ */
export interface ProblemMetadata {
  /** 単元 (カテゴリ) */
  unit: string;
  /** 問題ファミリー (解法の大分類。例: multiplication, common_denominator) */
  family: string;
  /** サブタイプ (例: integer / fraction / mixed_number / missing_value) */
  subtype?: string;
  /** 操作 (例: add / sub / mul / div / lcm / gcd / compare / convert) */
  operation?: string;
  /** 推定解法ステップ数 */
  steps?: number;
  /**
   * 数値パターン (数学的に意味のある分類)
   * 例: coprime_denominators / multiple_denominators / shared_factor_denominators /
   *     needs_reduction / small_numbers / medium_numbers / large_numbers
   */
  numberPattern?: string;
  /** 文脈 (plain / word_problem) */
  context?: string;
}

/** タイプごとの静的な分類 (family/subtype/operation/steps/context) */
interface TypeClassification {
  family: string;
  subtype?: string;
  operation?: string;
  steps?: number;
  context?: string;
}

/**
 * 全問題タイプの分類表。
 * family は「解法の大分類」。同じ family でも subtype が異なれば
 * バリエーションとして扱う。
 */
const TYPE_METADATA: Record<string, TypeClassification> = {
  integer_addition: { family: 'addition', operation: 'add', steps: 1 },
  integer_subtraction: { family: 'subtraction', operation: 'sub', steps: 1 },
  integer_multiplication: { family: 'multiplication', operation: 'mul', steps: 1 },
  integer_division: { family: 'division', operation: 'div', steps: 1 },
  integer_multi_step: { family: 'multi_step', subtype: 'multi_operation', steps: 3 },
  integer_fill_blank: { family: 'multi_step', subtype: 'missing_value', steps: 2 },
  integer_word_problem: { family: 'word_problem', subtype: 'application', steps: 2, context: 'word_problem' },
  divisors_finding: { family: 'divisors', subtype: 'enumeration' },
  divisors_count: { family: 'divisors', subtype: 'count' },
  multiples_finding: { family: 'multiples', subtype: 'enumeration' },
  prime_judgment: { family: 'primes', subtype: 'judgment' },
  prime_range: { family: 'primes', subtype: 'enumeration' },
  common_divisors: { family: 'gcd_lcm', subtype: 'common_divisors', operation: 'gcd' },
  common_multiples: { family: 'gcd_lcm', subtype: 'common_multiples', operation: 'lcm' },
  gcd_calculation: { family: 'gcd_lcm', operation: 'gcd' },
  lcm_calculation: { family: 'gcd_lcm', operation: 'lcm' },
  gcd_lcm_word: { family: 'gcd_lcm', subtype: 'word_problem', context: 'word_problem' },
  period_repetition: { family: 'periodic_pattern', subtype: 'remainder', context: 'word_problem' },
  fraction_mul_integer: { family: 'multiplication', subtype: 'integer', operation: 'mul', steps: 1 },
  fraction_mul_fraction: { family: 'multiplication', subtype: 'fraction', operation: 'mul', steps: 1 },
  fraction_mul_mixed: { family: 'multiplication', subtype: 'mixed_number', operation: 'mul', steps: 2 },
  fraction_div_integer: { family: 'division', subtype: 'integer', operation: 'div', steps: 1 },
  fraction_div_fraction: { family: 'division', subtype: 'fraction', operation: 'div', steps: 1 },
  fraction_div_mixed: { family: 'division', subtype: 'mixed_number', operation: 'div', steps: 2 },
  fraction_reduce: { family: 'reduction', operation: 'reduce', steps: 1 },
  fraction_common_denominator: { family: 'common_denominator', operation: 'lcm', steps: 1 },
  fraction_mixed_convert: { family: 'mixed_convert', operation: 'convert', steps: 1 },
  fraction_big_small: { family: 'comparison', operation: 'compare', steps: 1 },
  speed_calculation: { family: 'speed_triple', subtype: 'speed', operation: 'div' },
  distance_calculation: { family: 'speed_triple', subtype: 'distance', operation: 'mul' },
  time_calculation: { family: 'speed_triple', subtype: 'time', operation: 'div' },
  speed_unit_conversion: { family: 'unit_conversion', subtype: 'speed', operation: 'convert' },
  speed_comparison: { family: 'speed_triple', subtype: 'compare', operation: 'compare' },
  speed_word: { family: 'speed_triple', subtype: 'word_problem', context: 'word_problem' },
  speed_multi_step: { family: 'multi_step', subtype: 'speed', steps: 3, context: 'word_problem' },
  circle_area_radius: { family: 'circle_area', subtype: 'from_radius' },
  circle_area_diameter: { family: 'circle_area', subtype: 'from_diameter', steps: 2 },
  circle_radius_from_area: { family: 'circle_area', subtype: 'reverse', operation: 'div', steps: 2 },
  volume_box: { family: 'volume', subtype: 'box' },
  volume_cube: { family: 'volume', subtype: 'cube' },
  volume_prism: { family: 'volume', subtype: 'prism' },
  volume_cylinder: { family: 'volume', subtype: 'cylinder' },
  volume_from_height: { family: 'volume', subtype: 'reverse', operation: 'div', steps: 2 },
  volume_unit: { family: 'unit_conversion', subtype: 'volume', operation: 'convert' },
  symmetry_fold: { family: 'symmetry', subtype: 'fold' },
  symmetry_point: { family: 'symmetry', subtype: 'point_symmetry' },
    scale_length: { family: 'scale_drawing', subtype: 'length', operation: 'mul' },
  angle_basic: { family: 'angle', subtype: 'basic' },
  ratio_simplify: { family: 'simplify_ratio', operation: 'gcd' },
  ratio_value: { family: 'ratio_value', operation: 'div' },
  ratio_equal: { family: 'equivalent_ratio', operation: 'compare' },
  ratio_quantity: { family: 'quantity_split', operation: 'div', steps: 2 },
  proportional_expression: { family: 'proportional', subtype: 'expression' },
  proportional_word: { family: 'proportional', subtype: 'word_problem', context: 'word_problem' },
  inverse_expression: { family: 'inverse', subtype: 'expression' },
  inverse_word: { family: 'inverse', subtype: 'word_problem', context: 'word_problem' },
  decimal_mul_decimal: { family: 'multiplication', subtype: 'decimal_decimal', operation: 'mul' },
  decimal_div_decimal: { family: 'division', subtype: 'decimal_decimal', operation: 'div' },
  decimal_mul_integer: { family: 'multiplication', subtype: 'decimal_integer', operation: 'mul' },
  decimal_div_integer: { family: 'division', subtype: 'decimal_integer', operation: 'div' },
    decimal_round: { family: 'rounding', subtype: 'round' },
  expression_make: { family: 'make_expression', subtype: 'direct' },
  expression_substitution: { family: 'substitute', subtype: 'direct' },
  expression_word_make: { family: 'make_expression', subtype: 'word_problem', context: 'word_problem' },
  expression_meaning: { family: 'read_expression', subtype: 'meaning' },
  expression_blank: { family: 'make_expression', subtype: 'missing_value' },
  expression_multi_condition: { family: 'make_expression', subtype: 'multi_condition', steps: 3 },
  arrange_simple: { family: 'arrangement', subtype: 'direct' },
  arrange_tree: { family: 'arrangement', subtype: 'tree_diagram' },
  combine_simple: { family: 'combination', subtype: 'direct' },
  combine_table: { family: 'combination', subtype: 'table' },
  duplicate_removal: { family: 'combination', subtype: 'duplicate_removal', steps: 2 },
  data_average: { family: 'average', subtype: 'from_total', operation: 'div' },
  data_total_from_average: { family: 'average', subtype: 'reverse', operation: 'mul', steps: 2 },
  data_max_min: { family: 'range', subtype: 'max_min' },
  data_compare: { family: 'range', subtype: 'compare', operation: 'compare' },
};

/** 分母の組から数値パターンを推論する */
function fractionPairPattern(params: Record<string, unknown>): string | undefined {
  const d1 = params.d1;
  const d2 = params.d2;
  if (typeof d1 !== 'number' || typeof d2 !== 'number' || d1 <= 0 || d2 <= 0) {
    return undefined;
  }
  const a = Math.min(d1, d2);
  const b = Math.max(d1, d2);
  if (b % a === 0) return 'multiple_denominators';
  if (gcd(a, b) === 1) return 'coprime_denominators';
  return 'shared_factor_denominators';
}

/** 数値パラメータ群から大きさのパターンを推論する */
function magnitudePattern(params: Record<string, unknown>): string {
  let max = 0;
  for (const value of Object.values(params)) {
    if (typeof value === 'number' && Number.isFinite(value)) {
      max = Math.max(max, Math.abs(value));
    }
  }
  if (max === 0) return 'small_numbers';
  if (max <= 10) return 'small_numbers';
  if (max <= 30) return 'medium_numbers';
  return 'large_numbers';
}

/** 分数1つの入力に約分が必要な構造か */
function needsReduction(params: Record<string, unknown>, nKey: string, dKey: string): boolean {
  const n = params[nKey];
  const d = params[dKey];
  if (typeof n !== 'number' || typeof d !== 'number' || d <= 0) return false;
  return gcd(n, d) > 1;
}

function gcd(a: number, b: number): number {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b !== 0) {
    [a, b] = [b, a % b];
  }
  return a;
}

/**
 * 問題から構造メタデータを導出する
 * 静的分類表 + parameters からの数値パターン推論で構築する
 */
export function deriveMetadata(problem: Problem): ProblemMetadata {
  const base = TYPE_METADATA[problem.type];
  const classification: TypeClassification = base ?? { family: problem.type };
  const params = (problem.parameters ?? {}) as Record<string, unknown>;

  const metadata: ProblemMetadata = {
    unit: problem.category ?? 'unknown',
    family: classification.family,
    subtype: classification.subtype,
    operation: classification.operation,
    steps: classification.steps,
    context: classification.context,
  };

  const patterns: string[] = [];
  const pairPattern = fractionPairPattern(params);
  if (pairPattern) patterns.push(pairPattern);

  if (
    problem.type === 'fraction_reduce' &&
    needsReduction(params, 'numerator', 'denominator')
  ) {
    patterns.push('needs_reduction');
  }
  if (problem.type === 'fraction_mixed_convert') {
    const n = params.numerator;
    const d = params.denominator;
    if (typeof n === 'number' && typeof d === 'number' && d > 0) {
      patterns.push(gcd(n, d) > 1 ? 'needs_reduction' : 'irreducible');
    }
  }

  patterns.push(magnitudePattern(params));
  metadata.numberPattern = patterns.join('+');
  return metadata;
}

/**
 * 旧履歴レコードなど metadata が保存されていない場合に
 * problemType だけからメタデータを復元する
 */
export function deriveMetadataFromType(problemType: string): ProblemMetadata {
  const base = TYPE_METADATA[problemType];
  if (base) {
    const unitPrefix = problemType.split('_')[0];
    const knownUnits = new Set([
      'integer', 'fraction', 'decimal', 'ratio', 'speed',
      'geometry', 'data', 'expression', 'combinatorics',
    ]);
    const unit = knownUnits.has(unitPrefix) ? unitPrefix : 'numberTheory';
    return { unit, ...base };
  }
  return { unit: 'unknown', family: problemType };
}

// ===== フィンガープリント (完全重複検出) =====

const VOLATILE_PARAM_KEYS = new Set(['difficultyLevel']);

function stableStringify(value: unknown, parentKey = ''): string {
  if (Array.isArray(value)) {
    return '[' + value.map((v) => stableStringify(v)).join(',') + ']';
  }
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([k]) => !VOLATILE_PARAM_KEYS.has(parentKey === '' ? k : `${parentKey}.${k}`))
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return '{' + entries.map(([k, v]) => `${k}:${stableStringify(v, k)}`).join(',') + '}';
  }
  return String(value);
}

function fnv1a(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

/**
 * 問題のフィンガープリントを作る
 *
 * 「同じ問題タイプ + 同じ数学的条件 + 同じ数値」なら同一値になる。
 * 問題IDや難易度ラベル・出題日時など表現上の差異は含めないため、
 * 問題文の言い回しだけ変わった同内容も重複として検出できる。
 */
export function fingerprintProblem(problem: Problem): string {
  const payload = `t=${problem.type};p=${stableStringify(problem.parameters ?? {})};a=${stableStringify(problem.answer)}`;
  return `${problem.type}:${fnv1a(payload)}`;
}
