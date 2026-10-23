// @ts-nocheck
/**
 * 独立オラクル監査 (answer を参照せず parameters から答えを再計算して照合)
 *
 * 目的:
 *  - 既存監査 (consistency-audit.mts) は generator.validate に依存するため、
 *    「生成器と生成器が同じ間違いをする」ケースを検出できない。
 *  - ここでは各 problem type ごとに独立した数式で期待値を再計算し、
 *    problem.answer と照合する。
 *
 * 実行: npx vite-node scripts/oracle-audit.mts
 */
import { writeFileSync } from 'node:fs';
import { getAllGenerators } from '../src/engine/selector/generatorRegistry';
import { getTypeSupportedLevels } from '../src/engine/diversity/metadata';
import type { Answer } from '../src/types/problem';

const SEEDS = Number(process.env.ORACLE_SEEDS ?? 40);

export type Issue = {
  type: string;
  level: number;
  seed: number;
  kind: string;
  detail: string;
  question: string;
  answer: string;
};

/** 分数を約分 */
export function gcd(a: number, b: number): number {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) {
    const t = a % b;
    a = b;
    b = t;
  }
  return a || 1;
}
export function reduce(n: number, d: number) {
  const g = gcd(n, d);
  return { numerator: n / g, denominator: d / g };
}

/** Answer を数値化 (mixed も含む) */
export function toNum(a: Answer): number | null {
  switch (a.kind) {
    case 'integer':
    case 'decimal':
      return a.value;
    case 'fraction':
      return a.numerator / a.denominator;
    case 'mixed':
      return a.whole + a.numerator / a.denominator;
    default:
      return null;
  }
}

/** Answer を improper 分数として返す */
export function toImproper(a: Answer): { n: number; d: number } | null {
  switch (a.kind) {
    case 'integer':
      return { n: a.value, d: 1 };
    case 'fraction':
      return { n: a.numerator, d: a.denominator };
    case 'mixed':
      return { n: a.whole * a.denominator + a.numerator, d: a.denominator };
    default:
      return null;
  }
}

export function numEq(x: number, y: number): boolean {
  return Math.abs(x - y) < 1e-9;
}

export function isPrime(x: number): boolean {
  if (x < 2) return false;
  if (x === 2) return true;
  if (x % 2 === 0) return false;
  for (let i = 3; i * i <= x; i += 2) if (x % i === 0) return false;
  return true;
}

/** 長さ・重さ・時間・面積の換算倍率 (生成器側とは独立に保持) */
const ORACLE_UNIT_FACTORS: Record<string, Record<string, number>> = {
  length: { mm: 1, cm: 10, m: 1000, km: 1000000 },
  mass: { g: 1, kg: 1000 },
  time: { '秒': 1, '分': 60, '時': 3600 },
  area: { '㎠': 1, '㎡': 10000 },
};
/** スーパーの値札の独立価格表 (生成器の SUPERMARKET_PRODUCTS とは別定義) */
const ORACLE_SHOPPING_PRICES: Record<string, number> = {
  'たまご': 120,
  'ぎゅうにゅう': 180,
  '食パン': 150,
  'りんご': 260,
  'オレンジジュース': 200,
  'クッキー': 90,
};

/** 卵写真から独立に確認した固定情報 (生成器の EGGS_PHOTO とは別定義) */
const ORACLE_EGGS_PHOTO = { total: 2, brown: 1, white: 1 } as const;


/** 面積の単位倍率 (基準: ㎠) */
const ORACLE_AREA_FACTOR: Record<string, number> = {
  '㎠': 1,
  '㎡': 10000,
  a: 10000 * 100,
  ha: 10000 * 100 * 100,
  '㎢': 10000 * 100 * 100 * 100,
};

/**
 * 独立オラクル: problem type + parameters から期待する Answer を返す。
 * 判定不能な type は null を返してスキップする。
 */
export function oracleAnswer(
  type: string,
  p: Record<string, any>,
): { answer: Answer; note?: string } | null {
  const n = (k: string) => p[k] as number;
  const s = (k: string) => String(p[k]);
  const list = (k: string) => (p[k] ?? []) as any[];

  switch (type) {
    // ===== 整数 =====
    case 'integer_addition':
      return { answer: { kind: 'integer', value: n('a') + n('b') } };
    case 'integer_subtraction':
      return { answer: { kind: 'integer', value: n('a') - n('b') } };
    case 'integer_multiplication':
      return { answer: { kind: 'integer', value: n('a') * n('b') } };
    case 'integer_division':
      return { answer: { kind: 'integer', value: n('dividend') / n('divisor') } };
    case 'integer_multi_step': {
      const nums = list('numbers') as number[];
      const ops = list('operators') as string[];
      // 標準の演算順序 (× ÷ を先に) で評価する
      const apply = (a: number, op: string, b: number): number =>
        op === '+' ? a + b : op === '-' ? a - b : op === '×' ? a * b : op === '÷' ? a / b : a;
      // 乗除を先に畳み込む
      const vals: number[] = [nums[0]];
      const ops2: string[] = [];
      for (let i = 0; i < ops.length; i++) {
        const b = nums[i + 1];
        if (ops[i] === '×' || ops[i] === '÷') {
          vals[vals.length - 1] = apply(vals[vals.length - 1], ops[i], b);
        } else {
          vals.push(b);
          ops2.push(ops[i]);
        }
      }
      let acc = vals[0];
      for (let i = 0; i < ops2.length; i++) acc = apply(acc, ops2[i], vals[i + 1]);
      return { answer: { kind: 'integer', value: acc } };
    }
    case 'integer_fill_blank':
      return { answer: { kind: 'integer', value: n('answer') } };
    case 'estimate_product': {
      const placeA = n('placeA');
      const placeB = n('placeB');
      const rA = Math.round(n('a') / placeA) * placeA;
      const rB = Math.round(n('b') / placeB) * placeB;
      const expect = rA * rB;
      return { answer: { kind: 'integer', value: expect } };
    }
    case 'integer_word_problem': {
      const op = s('operator');
      let v = 0;
      if (op === '+') v = n('a') + n('b');
      else if (op === '-') v = n('a') - n('b');
      else if (op === '×' || op === '*') v = n('a') * n('b');
      else if (op === '÷' || op === '/') v = n('a') / n('b');
      return { answer: { kind: 'integer', value: v } };
    }

    // ===== 整数論 =====
    case 'divisors_finding': {
      const num = n('n');
      const divs: number[] = [];
      for (let i = 1; i <= num; i++) if (num % i === 0) divs.push(i);
      return { answer: { kind: 'string', value: divs.join(', ') } };
    }
    case 'divisors_count': {
      const num = n('n');
      let c = 0;
      for (let i = 1; i <= num; i++) if (num % i === 0) c++;
      return { answer: { kind: 'integer', value: c } };
    }
    case 'multiples_finding': {
      const variant = s('variant');
      const num = n('n');
      const arg1 = n('arg1');
      const arg2 = n('arg2') ?? 0;
      if (variant === 'list_first_n') {
        const cnt = arg1;
        const arr: number[] = [];
        for (let i = 1; i <= cnt; i++) arr.push(num * i);
        return { answer: { kind: 'string', value: arr.join(', ') } };
      }
      if (variant === 'list_up_to') {
        const arr: number[] = [];
        for (let k = num; k <= arg1; k += num) arr.push(k);
        return { answer: { kind: 'string', value: arr.join(', ') } };
      }
      if (variant === 'list_between') {
        const arr: number[] = [];
        for (let k = arg1; k <= arg2; k++) if (k % num === 0) arr.push(k);
        return { answer: { kind: 'string', value: arr.join(', ') } };
      }
      if (variant === 'nth_multiple') {
        return { answer: { kind: 'integer', value: num * arg1 } };
      }
      if (variant === 'count_in_range') {
        const arr: number[] = [];
        for (let k = num; k <= arg1; k += num) arr.push(k);
        return { answer: { kind: 'integer', value: arr.length } };
      }
      // fallback
      return { answer: { kind: 'string', value: s('answer') } };
    }
    case 'prime_judgment': {
      const choices = list('choices') as number[];
      const primes = choices.filter(isPrime);
      if (primes.length !== 1)
        return { answer: { kind: 'string', value: 'AMBIGUOUS' }, note: 'primes=' + primes.length };
      return { answer: { kind: 'string', value: String(primes[0]) } };
    }
    case 'prime_range': {
      const arr: number[] = [];
      for (let i = n('min'); i <= n('max'); i++) if (isPrime(i)) arr.push(i);
      return { answer: { kind: 'string', value: arr.join(', ') } };
    }
    case 'common_divisors': {
      const a = n('a');
      const b = n('b');
      const arr: number[] = [];
      for (let i = 1; i <= Math.min(a, b); i++)
        if (a % i === 0 && b % i === 0) arr.push(i);
      return { answer: { kind: 'string', value: arr.join(', ') } };
    }
    case 'common_multiples': {
      const a = n('a');
      const b = n('b');
      const lcmv = (a * b) / gcd(a, b);
      const variant = s('variant');
      const arg1 = n('arg1');
      const arg2 = n('arg2') ?? 0;
      if (variant === 'list_first_n') {
        const cnt = arg1;
        const arr: number[] = [];
        for (let i = 1; i <= cnt; i++) arr.push(lcmv * i);
        return { answer: { kind: 'string', value: arr.join(', ') } };
      }
      if (variant === 'list_up_to') {
        const arr: number[] = [];
        for (let k = lcmv; k <= arg1; k += lcmv) arr.push(k);
        return { answer: { kind: 'string', value: arr.join(', ') } };
      }
      if (variant === 'list_between') {
        const arr: number[] = [];
        for (let k = arg1; k <= arg2; k++) if (k % lcmv === 0) arr.push(k);
        return { answer: { kind: 'string', value: arr.join(', ') } };
      }
      if (variant === 'count_in_range') {
        const arr: number[] = [];
        for (let k = lcmv; k <= arg1; k += lcmv) arr.push(k);
        return { answer: { kind: 'integer', value: arr.length } };
      }
      return { answer: { kind: 'string', value: s('answer') } };
    }
    case 'gcd_calculation': {
      const nums = list('numbers') as number[];
      let g = nums[0];
      for (const v of nums) g = gcd(g, v);
      return { answer: { kind: 'integer', value: g } };
    }
    case 'lcm_calculation': {
      const a = n('a');
      const b = n('b');
      return { answer: { kind: 'integer', value: (a * b) / gcd(a, b) } };
    }
    case 'gcd_lcm_word': {
      const t = s('t');
      let a = 0, b = 0;
      if (t === 'period') { a = n('c'); b = n('d'); }
      else { a = n('a'); b = n('b'); }
      const v = t === 'gcd' ? gcd(a, b) : (a * b) / gcd(a, b);
      return { answer: { kind: 'integer', value: v } };
    }
    case 'period_repetition': {
      const pattern = list('pattern') as string[];
      const idx = (n('n') - 1) % pattern.length;
      return { answer: { kind: 'string', value: pattern[idx] } };
    }

    // ===== 分数 =====
    case 'fraction_mul_integer': {
      const r = reduce(n('numerator') * n('integer'), n('denominator'));
      return { answer: { kind: 'fraction', numerator: r.numerator, denominator: r.denominator } };
    }
    case 'fraction_mul_fraction': {
      const r = reduce(n('n1') * n('n2'), n('d1') * n('d2'));
      return { answer: { kind: 'fraction', numerator: r.numerator, denominator: r.denominator } };
    }
    case 'fraction_div_integer': {
      const r = reduce(n('numerator'), n('denominator') * n('integer'));
      return { answer: { kind: 'fraction', numerator: r.numerator, denominator: r.denominator } };
    }
    case 'fraction_div_fraction': {
      const r = reduce(n('n1') * n('d2'), n('d1') * n('n2'));
      return { answer: { kind: 'fraction', numerator: r.numerator, denominator: r.denominator } };
    }
    case 'fraction_mul_mixed': {
      const mixed = n('whole') * n('denominator') + n('numerator');
      const r = reduce(mixed * n('n2'), n('denominator') * n('d2'));
      return { answer: { kind: 'fraction', numerator: r.numerator, denominator: r.denominator } };
    }
    case 'fraction_div_mixed': {
      const mixed = n('whole') * n('denominator') + n('numerator');
      const r = reduce(mixed * n('d2'), n('denominator') * n('n2'));
      return { answer: { kind: 'fraction', numerator: r.numerator, denominator: r.denominator } };
    }
    case 'fraction_reduce': {
      const r = reduce(n('numerator'), n('denominator'));
      return { answer: { kind: 'fraction', numerator: r.numerator, denominator: r.denominator } };
    }
    case 'fraction_common_denominator': {
      const common = (n('d1') * n('d2')) / gcd(n('d1'), n('d2'));
      const v1 = (n('n1') * common) / n('d1');
      const v2 = (n('n2') * common) / n('d2');
      return {
        answer: {
          kind: 'fractions',
          values: [
            { numerator: v1, denominator: common },
            { numerator: v2, denominator: common },
          ],
        },
      };
    }
    case 'fraction_mixed_convert': {
      const num = n('numerator');
      const den = n('denominator');
      // improper -> mixed
      if (num >= den) {
        const whole = Math.floor(num / den);
        const rem = num - whole * den;
        const r = reduce(rem, den);
        return { answer: { kind: 'mixed', whole, numerator: r.numerator, denominator: r.denominator } };
      }
      // mixed -> improper
      const whole = n('whole');
      const r = reduce(whole * den + num, den);
      // but if answerNumerator provided, use reduced answer
      if (p['answerNumerator'] !== undefined) {
        return { answer: { kind: 'fraction', numerator: n('answerNumerator'), denominator: n('answerDenominator') } };
      }
      return { answer: { kind: 'fraction', numerator: r.numerator, denominator: r.denominator } };
    }
    case 'fraction_unit_intro': {
      const ans = p['answer'];
      if (typeof ans === 'string') {
        if (ans.includes('/')) return { answer: { kind: 'string', value: ans } };
        return { answer: { kind: 'integer', value: Number(ans) } };
      }
      if (typeof ans === 'number') {
        if (Number.isInteger(ans)) return { answer: { kind: 'integer', value: ans } };
        return { answer: { kind: 'decimal', value: ans } };
      }
      return null;
    }
    case 'fraction_big_small': {
      const d = n('denominator');
      const big = `${d}分の${n('numerator')}`;
      const small = `${d}分の${n('smallerNumerator')}`;
      return {
        answer: { kind: 'string', value: n('numerator') > n('smallerNumerator') ? big : small },
      };
    }
    case 'fraction_add_sub': {
      const common = (n('d1') * n('d2')) / gcd(n('d1'), n('d2'));
      const a = (n('n1') * common) / n('d1');
      const b = (n('n2') * common) / n('d2');
      const sum = s('operation') === 'add' ? a + b : a - b;
      const r = reduce(sum, common);
      return { answer: { kind: 'fraction', numerator: r.numerator, denominator: r.denominator } };
    }

    // ===== 速さ =====
    case 'speed_calculation':
      return { answer: { kind: 'decimal', value: n('distance') / n('time') } };
    case 'distance_calculation':
      return { answer: { kind: 'integer', value: n('speed') * n('time') } };
    case 'time_calculation':
      return { answer: { kind: 'integer', value: n('distance') / n('speed') } };
    case 'speed_unit_conversion': {
      const conv = s('conversionType');
      const val = n('givenValue');
      if (conv === 'kmh_to_mmin' || conv === 'kmh_to_ms') {
        if (conv === 'kmh_to_mmin') return { answer: { kind: 'decimal', value: (val * 1000) / 60 } };
        return { answer: { kind: 'decimal', value: (val * 1000) / 3600 } };
      }
      if (conv === 'mmin_to_kmh') return { answer: { kind: 'decimal', value: (val * 60) / 1000 } };
      if (conv === 'ms_to_kmh') return { answer: { kind: 'decimal', value: (val * 3600) / 1000 } };
      return null;
    }
    case 'speed_comparison':
      return {
        answer: {
          kind: 'string',
          value: n('speedA') > n('speedB') ? 'たろうさん' : 'はなこさん',
        },
      };
    case 'speed_word':
      return { answer: { kind: 'integer', value: n('speed') * n('time') } };
    case 'speed_multi_step': {
      const d = n('speed1') * n('time1') + n('speed2') * n('time2');
      const t = n('time1') + n('time2');
      return { answer: { kind: 'decimal', value: d / t } };
    }

    // ===== 図形 =====
    case 'circle_area_radius':
      return { answer: { kind: 'decimal', value: 3.14 * n('radius') ** 2 } };
    case 'circle_area_diameter':
      return { answer: { kind: 'decimal', value: round2(3.14 * (n('diameter') / 2) ** 2) } };
    case 'circle_radius_from_area': {
      const r = Math.sqrt(n('area') / 3.14);
      return { answer: { kind: 'integer', value: Math.round(r) } };
    }
    case 'volume_box':
      return { answer: { kind: 'integer', value: n('length') * n('width') * n('height') } };
    case 'volume_cube':
      return { answer: { kind: 'integer', value: n('edge') ** 3 } };
    case 'volume_prism':
      return { answer: { kind: 'integer', value: n('baseArea') * n('height') } };
    case 'volume_cylinder':
      return { answer: { kind: 'decimal', value: 3.14 * n('radius') ** 2 * n('height') } };
    case 'volume_from_height':
      return { answer: { kind: 'integer', value: n('volume') / n('baseArea') } };
    case 'volume_unit':
      return { answer: { kind: 'integer', value: n('liters') * 1000 } };
    case 'scale_length':
      return { answer: { kind: 'integer', value: n('base') * n('scale') } };
    case 'angle_basic':
      return { answer: { kind: 'integer', value: 180 - n('angleA') - n('angleB') } };
    case 'circle_circumference': {
      const variant = s('variant');
      if (variant === 'from_diameter') {
        if (s('answerUnit') === 'm') return { answer: { kind: 'decimal', value: round2(n('circumference') / 100) } };
        return { answer: { kind: 'decimal', value: n('circumference') } };
      }
      // from_circumference
      return { answer: { kind: 'integer', value: n('diameter') } };
    }
    case 'trapezoid_area': {
      const variant = s('variant');
      const a = n('a');
      const b = n('b');
      const h = n('h');
      const area = n('area');
      if (variant === 'reverse_height') return { answer: { kind: 'integer', value: (2 * area) / (a + b) } };
      if (variant === 'reverse_base') return { answer: { kind: 'integer', value: (2 * area) / h - b } };
      return { answer: { kind: 'integer', value: (a + b) * h / 2 } };
    }
    case 'unit_conversion_basic': {
      // 独立した単位係数表から換算する (生成器の UNIT_FACTORS とは別定義)
      const variant = s('variant');
      const from = s('from');
      const to = s('to');
      const val = n('value');
      const table = ORACLE_UNIT_FACTORS[variant];
      if (!table) return null;
      const fFrom = table[from];
      const fTo = table[to];
      if (!fFrom || !fTo) return null;
      if (from === to) return null;
      // value(from) × fFrom = answer(to) × fTo
      const expected = (val * fFrom) / fTo;
      if (!Number.isFinite(expected)) return null;
      // 生成器は整数解のみを出すため、非整数は検証不能として扱う
      if (!Number.isInteger(expected)) return null;
      return { answer: { kind: 'integer', value: expected } };
    }
    case 'area_unit_conversion': {
      // 面積単位は長さの2乗の独立係数表を使う (ORACLE_AREA_FACTOR)
      const from = s('from');
      const to = s('to');
      const givenValue = n('givenValue');
      const fFrom = ORACLE_AREA_FACTOR[from];
      const fTo = ORACLE_AREA_FACTOR[to];
      if (!fFrom || !fTo) return null;
      if (from === to) return null;
      const expected = (givenValue * fFrom) / fTo;
      if (!Number.isFinite(expected)) return null;
      const rounded = Math.round(expected);
      if (Math.abs(expected - rounded) < 1e-9) {
        return { answer: { kind: 'integer', value: rounded } };
      }
      return { answer: { kind: 'decimal', value: expected } };
    }
    case 'rectangle_area': {
      const variant = s('variant');
      if (variant === 'find_side') return { answer: { kind: 'integer', value: n('answer') } };
      if (variant === 'choose_formula') return { answer: { kind: 'string', value: s('answerLabel') } };
      const w = n('width');
      const h = n('height');
      return { answer: { kind: 'integer', value: w * h } };
    }
    case 'triangle_area': {
      const variant = s('variant');
      if (variant === 'find_height' || variant === 'find_base') {
        return { answer: { kind: 'integer', value: n('answer') } };
      }
      const base = n('base');
      const height = n('height');
      return { answer: { kind: 'integer', value: (base * height) / 2 } };
    }
    case 'parallelogram_area': {
      const variant = s('variant');
      if (variant === 'find_height' || variant === 'find_base' || variant === 'two_triangles') {
        return { answer: { kind: 'integer', value: n('answer') } };
      }
      const base = n('base');
      const height = n('height');
      return { answer: { kind: 'integer', value: base * height } };
    }
    case 'decimal_place_value': {
      const variant = s('variant');
      if (variant === 'decompose') {
        const fmt = (x: number) => String(Math.round(x * 1e6) / 1e6);
        return { answer: { kind: 'string', value: fmt(n('bigPart')) + ' + ' + fmt(n('smallPart')) } };
      }
      const ans = p['answer'];
      if (typeof ans === 'string') return { answer: { kind: 'string', value: ans } };
      if (typeof ans === 'number') {
        if (Number.isInteger(ans)) return { answer: { kind: 'integer', value: ans } };
        return { answer: { kind: 'decimal', value: ans } };
      }
      return null;
    }
    case 'triangle_classify': {
      if (p['equalCount'] !== undefined) {
        return { answer: { kind: 'integer', value: n('equalCount') } };
      }
      return { answer: { kind: 'string', value: s('kind') } };
    }
    case 'parallel_perpendicular': {
      const pair = p['pair'];
      if (pair) {
        const names = ['あ', 'い', 'う'];
        const a = pair.a as number;
        const b = pair.b as number;
        const lo = Math.min(a, b);
        const hi = Math.max(a, b);
        return { answer: { kind: 'string', value: `直線${names[lo]}と直線${names[hi]}` } };
      }
      const ak = s('answerKind');
      const label =
        ak === 'parallel' ? '平行' :
        ak === 'perpendicular' ? '垂直' :
        ak === 'not_parallel' ? '平行ではありません' :
        '垂直ではありません';
      return { answer: { kind: 'string', value: label } };
    }
    case 'symmetry_fold': {
      return { answer: { kind: 'string', value: p['isFold'] ? 'はい' : 'いいえ' } };
    }
    case 'symmetry_point': {
      const shape = s('shape');
      const pointSym = ['長方形', '平行四辺形', 'ひし形', '正方形', '円', '正六角形'];
      return { answer: { kind: 'string', value: pointSym.includes(shape) ? 'はい' : 'いいえ' } };
    }
    case 'judge_same':
      return { answer: { kind: 'string', value: 'はい' } };
    case 'judge_differs':
      return { answer: { kind: 'string', value: 'いいえ' } };

    // ===== 比 =====
    case 'ratio_simplify': {
      const g = gcd(n('a'), n('b'));
      return { answer: { kind: 'string', value: `${n('a') / g}：${n('b') / g}` } };
    }
    case 'ratio_value':
      return { answer: { kind: 'decimal', value: n('a') / n('b') } };
    case 'ratio_equal': {
      const same = n('a') * n('y') === n('b') * n('x');
      return { answer: { kind: 'string', value: same ? 'はい' : 'いいえ' } };
    }
    case 'ratio_quantity': {
      const unit = n('total') / (n('a') + n('b'));
      return { answer: { kind: 'integer', value: unit * n('askPart') } };
    }
    case 'proportional_expression':
      return { answer: { kind: 'string', value: `y=${n('k')}x` } };
    case 'proportional_word':
      return { answer: { kind: 'integer', value: (n('y1') / n('x1')) * n('x2') } };
    case 'inverse_expression':
      return { answer: { kind: 'string', value: `y=${n('k')}÷x` } };
    case 'inverse_word': {
      const total = n('total');
      const people2 = n('people2');
      return { answer: { kind: 'integer', value: total / people2 } };
    }
    case 'percentage': {
      const variant = s('variant');
      if (variant === 'percent_of') {
        return { answer: { kind: 'integer', value: (n('whole') * n('percent')) / 100 } };
      }
      return { answer: { kind: 'integer', value: (n('part') / n('whole')) * 100 } };
    }

    // ===== 小数 =====
    case 'decimal_mul_decimal':
      return { answer: { kind: 'decimal', value: round2(n('a') * n('b')) } };
    case 'decimal_addition':
      return { answer: { kind: 'decimal', value: round2(n('a') + n('b')) } };
    case 'decimal_subtraction':
      return { answer: { kind: 'decimal', value: round2(n('a') - n('b')) } };
    case 'decimal_div_decimal':
      return { answer: { kind: 'decimal', value: round2(n('dividend') / n('divisor')) } };
    case 'decimal_mul_integer':
      return { answer: { kind: 'decimal', value: round2(n('a') * n('b')) } };
    case 'decimal_div_integer':
      return { answer: { kind: 'decimal', value: round2(n('dividend') / n('divisor')) } };
    case 'decimal_round': {
      const factor = 10 ** n('roundTo');
      return { answer: { kind: 'decimal', value: Math.round(n('value') * factor) / factor } };
    }

    // ===== 文字式 =====
    case 'expression_make':
      return { answer: { kind: 'string', value: `${n('count')}${s('x')}` } };
    case 'expression_substitution':
      return { answer: { kind: 'integer', value: n('a') * n('x') + n('b') } };
    case 'expression_word_make':
      return { answer: { kind: 'string', value: `${n('price')}×x` } };
    case 'expression_blank':
      return { answer: { kind: 'integer', value: n('result') / n('b') } };
    case 'expression_multi_condition':
      return { answer: { kind: 'integer', value: n('a') * n('x') + n('b') } };
    case 'expression_meaning': {
      const b = n('b');
      const answerText = `x${b}円は、x円の物を1こと${b}円の品物を買ったときの代金です`;
      return { answer: { kind: 'string', value: answerText } };
    }

    // ===== 組合せ =====
    case 'arrange_simple':
      return { answer: { kind: 'integer', value: n('answer') } };
    case 'combine_simple':
      return { answer: { kind: 'integer', value: n('answer') } };
    case 'arrange_tree':
      return { answer: { kind: 'integer', value: n('answer') } };
    case 'combine_table':
      return { answer: { kind: 'integer', value: n('answer') } };
    case 'duplicate_removal': {
      const letters = list('letters') as string[];
      const counts = new Map<string, number>();
      for (const l of letters) counts.set(l, (counts.get(l) ?? 0) + 1);
      let denom = 1;
      for (const c of counts.values()) denom *= factorial(c);
      return { answer: { kind: 'integer', value: factorial(letters.length) / denom } };
    }

    // ===== データ =====
    case 'data_average': {
      const nums = list('numbers') as number[];
      const sum = nums.reduce((a, b) => a + b, 0);
      return { answer: { kind: 'decimal', value: round2(sum / nums.length) } };
    }
    case 'data_total_from_average':
      return { answer: { kind: 'integer', value: n('count') * n('average') } };
    case 'data_max_min': {
      const nums = list('numbers') as number[];
      return {
        answer: { kind: 'string', value: `${Math.max(...nums)} と ${Math.min(...nums)}` },
      };
    }
    case 'data_compare': {
      const a = list('groupA') as number[];
      const b = list('groupB') as number[];
      const avgA = a.reduce((x, y) => x + y, 0) / a.length;
      const avgB = b.reduce((x, y) => x + y, 0) / b.length;
      return { answer: { kind: 'string', value: avgA > avgB ? 'A組' : 'B組' } };
    }

    // ===== 現実連動 =====
    case 'realworld_shopping': {
      const variant = s('variant');
      const price = (name: string) => {
        const p = ORACLE_SHOPPING_PRICES[name];
        if (p === undefined) return null;
        return p;
      };
      switch (variant) {
        case 'two_sum': {
          const pa = price(s('productA'));
          const pb = price(s('productB'));
          if (pa === null || pb === null) return null;
          return { answer: { kind: 'integer', value: pa + pb } };
        }
        case 'three_sum': {
          const pa = price(s('productA'));
          const pb = price(s('productB'));
          const pc = price(s('productC'));
          if (pa === null || pb === null || pc === null) return null;
          return { answer: { kind: 'integer', value: pa + pb + pc } };
        }
        case 'same_item_multiple': {
          const p = price(s('product'));
          if (p === null) return null;
          return { answer: { kind: 'integer', value: p * n('count') } };
        }
        case 'change': {
          const pa = price(s('productA'));
          const pb = price(s('productB'));
          if (pa === null || pb === null) return null;
          const budget = n('budget');
          return { answer: { kind: 'integer', value: budget - (pa + pb) } };
        }
        case 'multi_and_sum': {
          const pa = price(s('productA'));
          const pb = price(s('productB'));
          if (pa === null || pb === null) return null;
          return { answer: { kind: 'integer', value: pa * n('count') + pb } };
        }
        case 'max_count': {
          const p = price(s('product'));
          if (p === null) return null;
          const budget = n('budget');
          if (budget % p !== 0) return null;
          return { answer: { kind: 'integer', value: budget / p } };
        }
        case 'split_bill': {
          const pa = price(s('productA'));
          const pb = price(s('productB'));
          if (pa === null || pb === null) return null;
          const total = pa + pb;
          const people = n('people');
          if (people <= 0 || total % people !== 0) return null;
          return { answer: { kind: 'integer', value: total / people } };
        }
        default:
          return null;
      }
    }
    case 'realworld_eggs': {
      const variant = s('variant');
      switch (variant) {
        case 'fill_carton':
          return { answer: { kind: 'integer', value: n('carton') - ORACLE_EGGS_PHOTO.total } };
        case 'pair_price':
          return { answer: { kind: 'integer', value: n('priceA') + n('priceB') } };
        case 'pairs_total':
          return { answer: { kind: 'integer', value: ORACLE_EGGS_PHOTO.total * n('pairs') } };
        case 'pairs_in_carton':
          return { answer: { kind: 'integer', value: n('carton') / ORACLE_EGGS_PHOTO.total } };
        case 'pairs_cost': {
          const pairCost = n('priceA') + n('priceB');
          return { answer: { kind: 'integer', value: pairCost * n('pairs') } };
        }
        default:
          return null;
      }
    }

    default:
      return null;
  }
}

export function round2(x: number): number {
  return Math.round(x * 100) / 100;
}

export function factorial(x: number): number {
  let r = 1;
  for (let i = 2; i <= x; i++) r *= i;
  return r;
}

export function comb(n: number, r: number): number {
  if (r < 0 || r > n) return 0;
  return factorial(n) / (factorial(r) * factorial(n - r));
}

export function perm(n: number, r: number): number {
  if (r < 0 || r > n) return 0;
  return factorial(n) / factorial(n - r);
}

// ===== 実行部 =====

/** 2つの Answer が数学的に等価かを判定する (文字列は表記揺れを許容) */
export function answersMatch(actual: Answer, expected: Answer): boolean {
  // 分数・整数・小数は数値比較
  const na = toNum(actual);
  const ne = toNum(expected);
  if (na !== null && ne !== null) {
    if (numEq(na, ne)) return true;
    // improper 分数として比較 (帯分数 ↔ 仮分数の表記揺れ)
    const ia = toImproper(actual);
    const ie = toImproper(expected);
    if (ia && ie && ia.n * ie.d === ie.n * ia.d) return true;
    return false;
  }
  // 複数分数
  if (actual.kind === 'fractions' && expected.kind === 'fractions') {
    if (actual.values.length !== expected.values.length) return false;
    return actual.values.every((v, i) => {
      const w = expected.values[i];
      return v.numerator * w.denominator === w.numerator * v.denominator;
    });
  }
  // 文字列: 空白を除去して比較 (全角/半角の記号差も正規化)
  const norm = (x: string) =>
    x
      .replace(/\s+/g, '')
      .replace(/[×✕✖*＊]/g, '×')
      .replace(/[÷／]/g, '÷')
      .replace(/[：:]/g, ':')
      .replace(/[，,]/g, ',');
  if (actual.kind === 'string' && expected.kind === 'string') {
    if (norm(actual.value) === norm(expected.value)) return true;
    // 「7分の6」形式 と 「6/7」形式 の相互変換を許容
    const jp = actual.value.match(/^(\d+)分の(\d+)$/);
    const fr = expected.value.match(/^(-?\d+)\/(\d+)$/);
    if (jp && fr) return Number(jp[1]) * Number(fr[2]) === Number(jp[2]) * Number(fr[1]);
    const jp2 = expected.value.match(/^(\d+)分の(\d+)$/);
    const fr2 = actual.value.match(/^(-?\d+)\/(\d+)$/);
    if (jp2 && fr2) return Number(jp2[1]) * Number(fr2[2]) === Number(jp2[2]) * Number(fr2[1]);
    return false;
  }
  return false;
}

export function main() {
  const issues: Issue[] = [];
  const skipped = new Set<string>();
  let total = 0;
  let checked = 0;

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
          issues.push({
            type: g.type,
            level: lv,
            seed,
            kind: 'generate-throw',
            detail: String(e?.message ?? e),
            question: '',
            answer: '',
          });
          continue;
        }
        const params = (p.parameters ?? {}) as Record<string, any>;
        const oracle = oracleAnswer(g.type, params);
        if (!oracle) {
          skipped.add(g.type);
          continue;
        }
        checked++;
        if (!answersMatch(p.answer, oracle.answer)) {
          issues.push({
            type: g.type,
            level: lv,
            seed,
            kind: oracle.note ? 'oracle-mismatch:' + oracle.note : 'oracle-mismatch',
            detail: `expected=${JSON.stringify(oracle.answer)} actual=${JSON.stringify(p.answer)}`,
            question: p.question ?? '',
            answer: JSON.stringify(p.answer),
          });
        }
      }
    }
  }

  const byType: Record<string, number> = {};
  const byKind: Record<string, number> = {};
  const perTypeSamples: Record<string, Issue[]> = {};
  for (const i of issues) {
    byType[i.type] = (byType[i.type] ?? 0) + 1;
    byKind[i.kind] = (byKind[i.kind] ?? 0) + 1;
    const arr = (perTypeSamples[i.type] ??= []);
    if (arr.length < 3) arr.push(i);
  }
  const out = {
    total,
    checked,
    issues: issues.length,
    skippedTypes: [...skipped],
    byType,
    byKind,
    perTypeSamples,
  };
  writeFileSync('oracle-report.json', JSON.stringify(out, null, 2), 'utf8');
  console.log(
    `total=${total} checked=${checked} issues=${issues.length} skippedTypes=${skipped.size}`,
  );
  for (const [t, c] of Object.entries(byType)) console.log(`  ${t}: ${c}`);
}

// 直接実行されたときだけ監査を実行する (他スクリプトからの import 時は副作用を避ける)
if (process.argv[1] && /oracle-audit\.m?ts$/.test(process.argv[1])) {
  main();
}
