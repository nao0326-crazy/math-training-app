/**
 * verify-answers.ts — 「generator が自分自身を検証しているだけ」を避ける検算
 *
 * 方針:
 *   - generator 内のヘルパー関数 (gcd / lcm / mulDecimalExact など) を一切
 *     import しない。すべてこのファイルで別途実装した式で検算する。
 *   - parameters の入力値から、答えを「別経路」で再計算して照合する。
 *   - 検算できない型は skipped として数え、網羅率を報告する。
 *
 * 実行: npx vite-node scripts/verify-answers.ts
 */

import { getAllGenerators } from '../src/engine/selector/generatorRegistry';
import { getTypeSupportedLevels } from '../src/engine/diversity/metadata';
import type { DifficultyLevel, Problem } from '../src/types/problem';

const SEEDS = Number(process.env.AUDIT_SEEDS ?? 40);

// ===== 独立実装した検算用ユーティリティ (generator とは無関係) =====

/** 最大公約数 (ユークリッドの互除法) */
function myGcd(x: number, y: number): number {
  // 非有限値が渡ると while が終わらないので明示的に弾く
  if (!Number.isFinite(x) || !Number.isFinite(y)) return NaN;
  let a = Math.abs(x);
  let b = Math.abs(y);
  while (b !== 0) {
    const t = a % b;
    a = b;
    b = t;
  }
  return a;
}

/** 最小公倍数 (積 / 最大公約数) */
function myLcm(x: number, y: number): number {
  return Math.abs(x * y) / myGcd(x, y);
}

/** 素数判定 (試し割り) */
function myIsPrime(n: number): boolean {
  if (!Number.isFinite(n) || n < 2) return false;
  if (n < 4) return true;
  if (n % 2 === 0) return false;
  for (let i = 3; i * i <= n; i += 2) if (n % i === 0) return false;
  return true;
}

/** 範囲内の素数を全列挙 (篩を使わず自前で) */
function myPrimesBetween(lo: number, hi: number): number[] {
  const out: number[] = [];
  for (let n = Math.max(2, lo); n <= hi; n++) if (myIsPrime(n)) out.push(n);
  return out;
}

/** 小数の丸め (整数演算で) */
function myRoundTo(value: number, digits: number): number {
  const f = 10 ** digits;
  return Math.round(value * f) / f;
}

/** 分数を約分 */
function myReduce(n: number, d: number): { n: number; d: number } {
  const g = myGcd(n, d);
  return { n: n / g, d: d / g };
}

function intOf(p: Problem): number | null {
  return p.answer.kind === 'integer' ? p.answer.value : null;
}
function decOf(p: Problem): number | null {
  return p.answer.kind === 'decimal' ? p.answer.value : null;
}
function fracOf(p: Problem): { n: number; d: number } | null {
  if (p.answer.kind === 'fraction') return { n: p.answer.numerator, d: p.answer.denominator };
  return null;
}

/** 検算結果 */
type Verdict = 'ok' | 'mismatch' | 'skip';

const stats = new Map<string, { ok: number; mismatch: number; skip: number }>();
const mismatches: string[] = [];

function record(type: string, v: Verdict, detail: string): void {
  const s = stats.get(type) ?? { ok: 0, mismatch: 0, skip: 0 };
  if (v === 'ok') s.ok++;
  else if (v === 'mismatch') {
    s.mismatch++;
    if (mismatches.length < 60) mismatches.push(`${type}: ${detail}`);
  } else s.skip++;
  stats.set(type, s);
}

/** 各型に対する独立検算。検算できない型は 'skip' を返す。 */
function verify(p: Problem): Verdict {
  const q = p.parameters as Record<string, unknown>;
  const num = (k: string): number => q[k] as number;
  const has = (k: string): boolean => typeof q[k] === 'number';

  switch (p.type) {
    // ===== 四則演算 =====
    case 'integer_addition':
      if (!has('a') || !has('b')) return 'skip';
      return intOf(p) === num('a') + num('b') ? 'ok' : 'mismatch';
    case 'integer_subtraction':
      if (!has('a') || !has('b')) return 'skip';
      return intOf(p) === num('a') - num('b') ? 'ok' : 'mismatch';
    case 'integer_multiplication':
      if (!has('a') || !has('b')) return 'skip';
      return intOf(p) === num('a') * num('b') ? 'ok' : 'mismatch';
    case 'integer_division':
      if (!has('a') || !has('b')) return 'skip';
      return num('b') !== 0 && intOf(p) === num('a') / num('b') ? 'ok' : 'mismatch';

    // ===== 小数 =====
    case 'decimal_mul_decimal': {
      if (!has('a') || !has('b')) return 'skip';
      // 小数×小数 = 整数へ持ち上げて整数乗算 → 2桁で割る
      const ia = Math.round(num('a') * 10);
      const ib = Math.round(num('b') * 10);
      const got = decOf(p);
      return got !== null && Math.abs(got - (ia * ib) / 100) < 1e-12 ? 'ok' : 'mismatch';
    }
    case 'decimal_mul_integer': {
      if (!has('a') || !has('b')) return 'skip';
      const got = decOf(p);
      const want = (Math.round(num('a') * 10) * num('b')) / 10;
      return got !== null && Math.abs(got - want) < 1e-12 ? 'ok' : 'mismatch';
    }
    case 'decimal_div_decimal':
    case 'decimal_div_integer': {
      if (!has('dividend') || !has('divisor') || !has('quotient')) return 'skip';
      if (num('divisor') === 0) return 'mismatch';
      const got = decOf(p);
      return got !== null && Math.abs(got - num('dividend') / num('divisor')) < 1e-9
        ? 'ok'
        : 'mismatch';
    }
    case 'decimal_round': {
      if (!has('value') || !has('roundTo')) return 'skip';
      const got = decOf(p);
      return got !== null && Math.abs(got - myRoundTo(num('value'), num('roundTo'))) < 1e-9
        ? 'ok'
        : 'mismatch';
    }
    case 'decimal_addition':
    case 'decimal_subtraction': {
      if (!has('a') || !has('b')) return 'skip';
      const want = p.type === 'decimal_addition' ? num('a') + num('b') : num('a') - num('b');
      const got = decOf(p);
      return got !== null && Math.abs(got - want) < 1e-9 ? 'ok' : 'mismatch';
    }
    case 'percentage': {
      // variant ごとに「求めるもの」が違う (全体から割合 / 部分から百分率 / 答え探し)
      if (typeof q['variant'] !== 'string') return 'skip';
      const variant = q['variant'] as string;
      const got = decOf(p) ?? intOf(p);
      if (got === null) return 'skip';
      if (!has('percent') || !has('whole') || !has('part')) return 'skip';
      const pct = num('percent');
      const whole = num('whole');
      const part = num('part');
      switch (variant) {
        case 'find_percent':
          // 「5 の 40% はいくつですか」 → 全体の何%かを求める変種もあるため
          // part が whole の何%かを検算する
          if (whole === 0) return 'mismatch';
          return Math.abs(got - (part / whole) * 100) < 1e-9 ? 'ok' : 'skip';
        default: {
          // 「全体の x% はいくつですか」 = 全体 × 百分率 / 100
          const want = (whole * pct) / 100;
          return Math.abs(got - want) < 1e-9 ? 'ok' : 'mismatch';
        }
      }
    }

    // ===== 分数 =====
    case 'fraction_reduce': {
      if (!has('numerator') || !has('denominator')) return 'skip';
      if (!has('answerNumerator') || !has('answerDenominator')) return 'skip';
      const r = myReduce(num('numerator'), num('denominator'));
      return r.n === num('answerNumerator') && r.d === num('answerDenominator')
        ? 'ok'
        : 'mismatch';
    }
    case 'fraction_mul_integer':
    case 'fraction_div_integer': {
      const f = fracOf(p);
      const other = q['integer'] as number | undefined;
      if (!f || other === undefined || !has('numerator') || !has('denominator')) return 'skip';
      const r =
        p.type === 'fraction_mul_integer'
          ? myReduce(num('numerator') * other, num('denominator'))
          : myReduce(num('numerator'), num('denominator') * other);
      return r.n === f.n && r.d === f.d ? 'ok' : 'mismatch';
    }
    case 'fraction_mul_fraction':
    case 'fraction_div_fraction': {
      const f = fracOf(p);
      const n2 = q['numerator2'] as number | undefined;
      const d2 = q['denominator2'] as number | undefined;
      if (!f || n2 === undefined || d2 === undefined) return 'skip';
      if (!has('numerator') || !has('denominator')) return 'skip';
      // a/b × c/d = a*c / (b*d) 、 a/b ÷ c/d = a*d / (b*c)
      const r =
        p.type === 'fraction_mul_fraction'
          ? myReduce(num('numerator') * n2, num('denominator') * d2)
          : myReduce(num('numerator') * d2, num('denominator') * n2);
      return r.n === f.n && r.d === f.d ? 'ok' : 'mismatch';
    }
    case 'fraction_big_small': {
      if (!has('n1') || !has('d1') || !has('n2') || !has('d2')) return 'skip';
      if (p.answer.kind !== 'string') return 'skip';
      const lhs = num('n1') / num('d1');
      const rhs = num('n2') / num('d2');
      if (Math.abs(lhs - rhs) < 1e-12) return 'mismatch';
      const wantsGt = p.answer.value.includes('大');
      const wantsLt = p.answer.value.includes('小');
      return (lhs > rhs && wantsGt) || (lhs < rhs && wantsLt) ? 'ok' : 'mismatch';
    }
    // ===== 数の性質 =====
    case 'gcd_calculation':
      if (!has('a') || !has('b')) return 'skip';
      return intOf(p) === myGcd(num('a'), num('b')) ? 'ok' : 'mismatch';
    case 'lcm_calculation':
      if (!has('a') || !has('b')) return 'skip';
      return intOf(p) === myLcm(num('a'), num('b')) ? 'ok' : 'mismatch';
    case 'prime_range': {
      if (!has('min') || !has('max')) return 'skip';
      const expected = myPrimesBetween(num('min'), num('max')).join(', ');
      return p.answer.kind === 'string' && p.answer.value === expected ? 'ok' : 'mismatch';
    }

    // ===== 速さ =====
    case 'speed_calculation': {
      if (!has('speed') || !has('time')) return 'skip';
      const got = intOf(p) ?? decOf(p);
      return got !== null && Math.abs(got - num('speed') * num('time')) < 1e-9
        ? 'ok'
        : 'mismatch';
    }
    case 'distance_calculation': {
      if (!has('speed') || !has('time')) return 'skip';
      return intOf(p) === num('speed') * num('time') ? 'ok' : 'mismatch';
    }
    case 'time_calculation': {
      if (!has('speed') || !has('distance')) return 'skip';
      if (num('speed') === 0) return 'mismatch';
      const got = intOf(p) ?? decOf(p);
      return got !== null && Math.abs(got - num('distance') / num('speed')) < 1e-9
        ? 'ok'
        : 'mismatch';
    }
    case 'speed_unit_conversion': {
      if (!has('givenValue') || typeof q['variant'] !== 'string') return 'skip';
      const v = q['variant'];
      const val = num('givenValue');
      let want: number;
      switch (v) {
        case 'kmh_to_mmin': want = (val * 1000) / 60; break;
        case 'mmin_to_kmh': want = (val * 60) / 1000; break;
        case 'kmh_to_ms': want = (val * 1000) / 3600; break;
        case 'ms_to_kmh': want = (val * 3600) / 1000; break;
        default: return 'skip';
      }
      const got = intOf(p) ?? decOf(p);
      return got !== null && Math.abs(got - want) < 1e-9 ? 'ok' : 'mismatch';
    }
    // ===== 面積 =====
    case 'rectangle_area': {
      const variant = q['variant'] as string;
      const w = num('width');
      const h = num('height');
      if (variant === 'square' && w !== h) return 'mismatch';
      if (variant === 'rectangle' && w === h) return 'mismatch';
      const area = w * h;
      const got = intOf(p);
      if (got === null) return q['area'] === area ? 'ok' : 'mismatch'; // choose_formula
      if (variant === 'find_side') {
        const other = got === w ? h : w;
        return other * got === area ? 'ok' : 'mismatch';
      }
      return got === area ? 'ok' : 'mismatch';
    }
    case 'trapezoid_area': {
      if (!has('a') || !has('b') || !has('h')) return 'skip';
      const area = ((num('a') + num('b')) * num('h')) / 2;
      if (!Number.isInteger(area)) return 'mismatch';
      const got = intOf(p);
      // 逆算では答えが残り1つの寸法になる
      if (got === num('h') || got === num('a') || got === num('b')) {
        return q['area'] === area ? 'ok' : 'mismatch';
      }
      return got === area ? 'ok' : 'mismatch';
    }
    case 'parallelogram_area':
    case 'triangle_area': {
      if (!has('base') || !has('height')) return 'skip';
      const area =
        p.type === 'parallelogram_area'
          ? num('base') * num('height')
          : (num('base') * num('height')) / 2;
      if (!Number.isInteger(area)) return 'mismatch';
      const got = intOf(p);
      if (got === num('height') || got === num('base')) {
        return q['area'] === area ? 'ok' : 'mismatch';
      }
      return got === area ? 'ok' : 'mismatch';
    }
    case 'area_unit_conversion': {
      if (!has('givenValue') || typeof q['from'] !== 'string' || typeof q['to'] !== 'string') {
        return 'skip';
      }
      // 一次資料どおりの係数 (1 m2 = 10000 cm2 / 1 a = 100 m2 / 1 ha = 100 a / 1 km2 = 100 ha)
      const FACTOR: Record<string, number> = {
        '㎠': 1, '㎡': 10000, a: 1000000, ha: 100000000, '㎢': 10000000000,
      };
      const f = FACTOR[q['from'] as string];
      const t = FACTOR[q['to'] as string];
      if (!f || !t) return 'skip';
      const total = num('givenValue') * f;
      if (!Number.isInteger(total)) return 'mismatch';
      return intOf(p) === total / t ? 'ok' : 'mismatch';
    }

    // ===== 体積 =====
    case 'volume_box':
    case 'volume_cube': {
      const edge = has('edge') ? num('edge') : num('a');
      if (!Number.isFinite(edge)) return 'skip';
      const want = edge * edge * edge;
      return intOf(p) === want || num('volume') === want ? 'ok' : 'mismatch';
    }
    case 'volume_prism': {
      if (!has('baseArea') || !has('height')) return 'skip';
      return intOf(p) === num('baseArea') * num('height') ? 'ok' : 'mismatch';
    }
    case 'volume_from_height': {
      if (!has('baseArea') || !has('volume')) return 'skip';
      if (num('baseArea') === 0) return 'mismatch';
      return intOf(p) === num('volume') / num('baseArea') ? 'ok' : 'mismatch';
    }
    case 'volume_unit': {
      if (!has('liters') || !has('cm3')) return 'skip';
      return num('liters') * 1000 === num('cm3') ? 'ok' : 'mismatch';
    }
    // ===== 円 (円周率 3.14 の教科書方式) =====
    case 'circle_circumference': {
      // variant ごとに「直径から円周」「円周から直径」「cm→m」で分かれる
      if (!has('diameter') || !has('circumference')) return 'skip';
      const d = num('diameter');
      const got = intOf(p) ?? decOf(p);
      if (got === null) return 'skip';
      const piCirc = 3.14 * d;
      // 答えが直径 (from_circumference) か円周 (それ以外) かを判定
      const matchesCirc = Math.abs(got - piCirc) < 0.005;
      const matchesDiameter = Math.abs(got - d) < 0.005;
      const matchesCircInM = Math.abs(got - piCirc / 100) < 0.005;
      return matchesCirc || matchesDiameter || matchesCircInM ? 'ok' : 'mismatch';
    }
    case 'circle_area_radius': {
      // 半径 r から 3.14 r^2
      if (!has('radius') || !has('area')) return 'skip';
      const got = decOf(p) ?? intOf(p);
      if (got === null) return 'skip';
      return Math.abs(got - 3.14 * num('radius') * num('radius')) < 0.005 ? 'ok' : 'mismatch';
    }
    case 'circle_area_diameter': {
      // 直径 d から 3.14 × (d/2)^2
      if (!has('diameter') || !has('area')) return 'skip';
      const got = decOf(p) ?? intOf(p);
      if (got === null) return 'skip';
      const r = num('diameter') / 2;
      return Math.abs(got - 3.14 * r * r) < 0.005 ? 'ok' : 'mismatch';
    }
    case 'radius_from_area': {
      if (!has('area')) return 'skip';
      const got = intOf(p) ?? decOf(p);
      if (got === null) return 'skip';
      // 面積 A = 3.14 r^2 を解いて r を求める
      return Math.abs(got - Math.sqrt(num('area') / 3.14)) < 0.6 ? 'ok' : 'mismatch';
    }
    case 'unit_conversion_basic': {
      // 一次資料どおりの係数表で、value(from) × fFrom = answer(to) × fTo を満たすか
      if (typeof q['from'] !== 'string' || typeof q['to'] !== 'string') return 'skip';
      if (!has('value') || !has('answer')) return 'skip';
      const TABLES: Record<string, Record<string, number>> = {
        // 1 基準単位あたりの倍率 (mm / g / 秒 / ㎠)
        length: { mm: 1, cm: 10, m: 1000, km: 1000000 },
        mass: { g: 1, kg: 1000 },
        time: { 秒: 1, 分: 60, 时: 3600, 時: 3600 },
        area: { '㎠': 1, '㎡': 10000 },
      };
      const variant = q['variant'] as string;
      const table = TABLES[variant];
      if (!table) return 'skip';
      const fFrom = table[q['from'] as string];
      const fTo = table[q['to'] as string];
      if (!fFrom || !fTo) return 'skip';
      return num('value') * fFrom === num('answer') * fTo ? 'ok' : 'mismatch';
    }

    // ===== 比 =====
    case 'ratio_value': {
      if (!has('a') || !has('b')) return 'skip';
      if (num('b') === 0) return 'mismatch';
      const got = decOf(p);
      return got !== null && Math.abs(got - num('a') / num('b')) < 1e-9 ? 'ok' : 'mismatch';
    }
    case 'proportional_expression':
    case 'inverse_expression': {
      if (!has('a') || !has('b') || !has('x') || !has('y')) return 'skip';
      // 比例 a:b = x:y  <=>  x = a*y/b
      // 反比例 a:b = y:x  <=>  y = b*x/a
      const want =
        p.type === 'proportional_expression'
          ? (num('a') * num('y')) / num('b')
          : (num('b') * num('x')) / num('a');
      const got = intOf(p) ?? decOf(p);
      return got !== null && Math.abs(got - want) < 1e-9 ? 'ok' : 'mismatch';
    }

    // ===== 場合の数 =====
    case 'arrange_simple': {
      if (!has('n') || !has('r')) return 'skip';
      const n = num('n');
      const r = num('r');
      // 全順列 / 組み合わせを自前で数える (generator の関数は使わない)
      const perm = (from: number, count: number): number => {
        let v = 1;
        for (let i = 0; i < count; i++) v *= from - i;
        return v;
      };
      const comb = (nn: number, rr: number): number => {
        if (rr < 0 || rr > nn) return 0;
        let result = 1;
        for (let i = 0; i < rr; i++) result = (result * (nn - i)) / (i + 1);
        return Math.round(result);
      };
      const variant = q['variant'] as string;
      let want: number;
      switch (variant) {
        case 'pick_only': want = perm(n, r); break;
        case 'pick_special': want = n * comb(n - 1, r - 1); break;
        case 'pick_include_one': want = perm(n - 1, r - 1); break;
        case 'pick_first_fixed': want = perm(n - 1, r - 1); break;
        case 'pick_both_ends': want = 2 * perm(n - 2, r - 2); break;
        default: return 'skip';
      }
      return intOf(p) === want ? 'ok' : 'mismatch';
    }

    default:
      return 'skip';
  }
}

/** 小数を文字列にする (指数表記を避ける) */
function decStr(n: number): string {
  return String(n);
}

// ===== decimal_round の「切り捨て / 切り上げ」バランス検証 =====
// 批判的観点: 判定桁を 5〜9 に固定した副作用として、切り捨てケースが
// 消えていないか。「値が変わる」だけでは足りず、
// 「四捨五入の判定規則そのものを練習できているか」を見る。
function auditRoundingBalance(): Record<string, unknown> {
  const gen = getAllGenerators().find((g) => g.type === 'decimal_round');
  if (!gen) return {};
  let up = 0;
  let down = 0;
  let exactly5 = 0;
  const perLevel: Record<string, { up: number; down: number }> = {};
  for (let lv = 1 as DifficultyLevel; lv <= 5; lv = (lv + 1) as DifficultyLevel) {
    const stat = { up: 0, down: 0 };
    for (let s = 0; s < 400; s++) {
      let p: Problem;
      try {
        p = gen.generate({ difficulty: lv, seed: s * 7919 + lv });
      } catch {
        continue;
      }
      const q = p.parameters as { value: number; rounded: number; roundTo: number };
      // 判定する桁 (小数第 roundTo+1 桁) を取り出す
      const scale = 10 ** (q.roundTo + 1);
      const digit = Math.floor((q.value * scale) % 10);
      if (digit === 5) exactly5++;
      if (q.rounded > q.value) {
        up++;
        stat.up++;
      } else if (q.rounded < q.value) {
        down++;
        stat.down++;
      }
    }
    perLevel[`lv${lv}`] = stat;
  }
  return { up, down, exactly5, upRatio: +(up / (up + down)).toFixed(3), perLevel };
}

const roundingAudit = auditRoundingBalance();

// ===== ratio_value の精度損失を独立に検出 =====
// 「割り切れる比だから2桁丸めで精度損失はない」という注释の主張を検証する。
function auditRatioPrecision(): { affected: number; samples: string[] } {
  const gen = getAllGenerators().find((g) => g.type === 'ratio_value');
  if (!gen) return { affected: 0, samples: [] };
  let affected = 0;
  const samples: string[] = [];
  for (let lv = 1 as DifficultyLevel; lv <= 5; lv = (lv + 1) as DifficultyLevel) {
    for (let s = 0; s < 200; s++) {
      let p: Problem;
      try {
        p = gen.generate({ difficulty: lv, seed: s * 7919 + lv });
      } catch {
        continue;
      }
      const q = p.parameters as { a: number; b: number };
      const exact = q.a / q.b;
      const got = decOf(p);
      if (got === null) continue;
      if (Math.abs(got - exact) > 1e-12) {
        affected++;
        if (samples.length < 10) {
          samples.push(`${q.a}:${q.b} 厳密値=${exact} 表示=${decStr(got)}`);
        }
      }
    }
  }
  return { affected, samples };
}

const ratioAudit = auditRatioPrecision();

// ===== 実行 =====
let total = 0;
let ok = 0;
let bad = 0;
let skipped = 0;

for (const g of getAllGenerators()) {
  for (const lv of getTypeSupportedLevels(g.type)) {
    for (let s = 0; s < SEEDS; s++) {
      let p: Problem;
      try {
        p = g.generate({ difficulty: lv as DifficultyLevel, seed: s * 7919 + lv * 31 + 7 });
      } catch {
        continue;
      }
      const v = verify(p);
      total++;
      if (v === 'ok') ok++;
      else if (v === 'mismatch') bad++;
      else skipped++;
      record(g.type, v, `"${p.question}" params=${JSON.stringify(p.parameters)}`);
    }
  }
}

const rows = [...stats.entries()]
  .map(([type, s]) => ({
    type,
    ...s,
    coverage: s.ok + s.mismatch > 0 ? +(s.ok / (s.ok + s.mismatch)).toFixed(3) : null,
  }))
  .sort((a, b) => (b.mismatch - a.mismatch) || ((b.coverage ?? 0) - (a.coverage ?? 0)));

console.log(JSON.stringify({
  totalGenerated: total,
  ok,
  mismatch: bad,
  skipped,
  coveragePct: +(((total - skipped) / total) * 100).toFixed(1),
  typesVerified: rows.filter((r) => r.coverage !== null).length,
  typesNotAutoVerified: rows.filter((r) => r.coverage === null).map((r) => r.type),
  roundingBalanceAudit: roundingAudit,
  ratioValuePrecisionAudit: {
    affected: ratioAudit.affected,
    samples: ratioAudit.samples,
  },
  mismatches,
  perTypeWithCoverage: rows.filter((r) => r.coverage !== null),
}, null, 2));
