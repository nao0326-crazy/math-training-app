/**
 * 解法 (途中式) 生成器
 *
 * 問題ジェネレータが parameters に保存した「答えの計算に使った生の値」から、
 * 正解と同一の計算過程をたどる途中式 (SolutionStep[]) を組み立てる。
 *
 * - UI (QuizPage / SolutionDisplay) は計算方法を知らない
 * - 各問題タイプのビルダーは、その問題を実際に解く手順を表す
 * - 最後のステップには必ず答え (formatAnswer の結果) が含まれる
 * - パラメータが不足するなど生成できない場合は安全に空配列を返す
 */

import type { Problem, SolutionStep } from '../../types/problem';
import { formatAnswer } from '../../utils/answer';
import { formatFraction, gcd, lcm, reduceFraction } from '../../utils/fraction';
import { getDivisors, getPrimesInRange } from '../../utils/numberTheory';
// Phase 2-A: 並べ方 / 表の組み合わせは種類 (variant) ごとに途中式が変わるため型を参照する
// Phase 2-B: arrange_simple も variant ごとに途中式が変わるため型を参照する
// Phase 2-D: multiples_finding / speed_unit_conversion も variant ごとに途中式が変わる
import type {
  ArrangeTreeVariant,
  ArrangeSimpleVariant,
  CombineSimpleVariant,
  CombineTableVariant,
} from '../../problems/combinatorics/generators';
import type {
  CommonMultiplesVariant,
  MultiplesFindingVariant,
} from '../../problems/numberTheory/generators';
import type { SpeedUnitConversionVariant } from '../../problems/speed/generators';

/** 階乗 (r < 2 は1) */
function factorial(r: number): number {
  let result = 1;
  for (let i = 2; i <= r; i++) result *= i;
  return result;
}

/** n個から r個を選ぶ (並べない) 通り数。組み合せは掛け算とわり算で表す */
function comboValue(n: number, r: number): number {
  if (r === 0) return 1;
  if (r > n) return 0;
  const mirror = Math.min(r, n - r);
  let acc = 1;
  for (let i = 1; i <= mirror; i++) acc = (acc * (n - mirror + i)) / i;
  return acc;
}

/** r! を「2 × 3 × … × r」の文字列にする (r<2 は1) */
function factorialExpr(r: number): string {
  if (r < 2) return '1';
  const parts: string[] = [];
  for (let i = 2; i <= r; i++) parts.push(String(i));
  return parts.join(' × ');
}

/** 「a × b × c = d」形式の式から右辺 (計算結果) を取り出す */
function accOf(expression: string): string {
  const m = expression.match(/=\s*(-?\d+)\s*$/);
  return m ? m[1] : expression;
}

// ===== 表示ヘルパー =====

/** parameters から型付きで値を取り出す */
function P<T>(problem: Problem): T {
  return problem.parameters as T;
}

/** 計算で得た中間値を表示する (浮動小数点の誤差を掃除する) */
function num(v: number): string {
  if (!Number.isFinite(v)) return String(v);
  if (Number.isInteger(v)) return String(v);
  const cleaned = Number(v.toPrecision(12));
  return String(cleaned === 0 ? 0 : cleaned);
}

/** parameters や answer に保存済みの値は、元の文字列をそのまま使う */
function pv(v: number): string {
  return String(v);
}

/** 分数をスラッシュ表記にする (約分しない。中間過程用) */
function raw(n: number, d: number): string {
  return d === 1 ? String(n) : `${n}/${d}`;
}

/** 分数を約分してスラッシュ表記にする (中間過程用) */
function red(n: number, d: number): string {
  const r = reduceFraction(n, d);
  return raw(r.numerator, r.denominator);
}

/** 帯分数表記 (必要なら約分もする) */
function mixedStr(whole: number, n: number, d: number): string {
  const r = reduceFraction(n, d);
  if (whole === 0) return raw(r.numerator, r.denominator);
  if (r.denominator === 1) return String(whole);
  return `${whole}と${r.numerator}/${r.denominator}`;
}

const S = (expression?: string, explanation?: string): SolutionStep =>
  explanation === undefined ? { expression } : { expression, explanation };

// ===== 整数 =====

function integerFourOperations(p: Problem): SolutionStep[] {
  const { a, b, operator } = P<{ a: number; b: number; operator: string }>(p);
  return [S(`${a} ${operator} ${b} = ${formatAnswer(p.answer)}`)];
}

function integerDivision(p: Problem): SolutionStep[] {
  const { dividend, divisor, quotient } = P<{
    dividend: number;
    divisor: number;
    quotient: number;
  }>(p);
  return [
    S(`${dividend} ÷ ${divisor} = ${quotient}`),
    S(undefined, `確かめると ${divisor} × ${quotient} = ${dividend} なので正しいです`),
  ];
}

/** 複数項の計算: 乗除を先に、あとは左から順に (ジェネレータと同じ順序) */
function multiStep(p: Problem): SolutionStep[] {
  const { numbers, operators } = P<{ numbers: number[]; operators: string[] }>(p);
  const nums = [...numbers];
  const ops = [...operators];
  const steps: SolutionStep[] = [];

  // かけ算・わり算を先に
  let hadMulDiv = false;
  for (let i = 0; i < ops.length; i++) {
    if (ops[i] === '×' || ops[i] === '÷') {
      const left = nums[i];
      const right = nums[i + 1];
      const r = ops[i] === '×' ? left * right : left / right;
      steps.push(
        S(`${left} ${ops[i]} ${right} = ${num(r)}`, hadMulDiv ? undefined : 'かけ算・わり算を先に計算します'),
      );
      hadMulDiv = true;
      nums.splice(i, 2, r);
      ops.splice(i, 1);
      i--;
    }
  }

  // たし算・ひき算を左から順に
  let acc = nums[0];
  for (let i = 0; i < ops.length; i++) {
    const r = ops[i] === '+' ? acc + nums[i + 1] : acc - nums[i + 1];
    steps.push(S(`${num(acc)} ${ops[i]} ${num(nums[i + 1])} = ${num(r)}`));
    acc = r;
  }
  return steps;
}

/** 穴埋め問題: 逆算で □ をもとめる */
function fillBlank(p: Problem): SolutionStep[] {
  const { a, operator, answer } = P<{ a: number; operator: string; answer: number }>(p);
  // 元の式のもう一つの数 (□ 以外) を復元する
  const c =
    operator === '+'
      ? a + answer
      : operator === '-'
        ? a - answer
        : operator === '×'
          ? a * answer
          : a / answer;
  const expr =
    operator === '+'
      ? `${c} − ${a} = ${answer}`
      : operator === '-'
        ? `${a} − ${c} = ${answer}`
        : operator === '×'
          ? `${c} ÷ ${a} = ${answer}`
          : `${a} ÷ ${c} = ${answer}`;
  return [S(expr, '□に入る数は、逆にもとの式に戻してもとめます')];
}

function wordProblem(p: Problem): SolutionStep[] {
  const { a, b, operator } = P<{ a: number; b: number; operator: string }>(p);
  const ans = formatAnswer(p.answer);
  switch (operator) {
    case '+':
      return [S(`${a} + ${b} = ${ans}`, 'もとにあった数と、ふえた数をたします')];
    case '-':
      return [S(`${a} - ${b} = ${ans}`, '全体から、つかった数をひきます')];
    case '×':
      return [S(`${a} × ${b} = ${ans}`, '1つ分の大きさ × 個数で、全体をもとめます')];
    default:
      return [S(`${a} ÷ ${b} = ${ans}`, '同じ数ずつ分けるので、わり算をします')];
  }
}

// ===== 数の性質 =====

/** n の約数ペアの式リスト (例: 12 -> ["1 × 12", "2 × 6", "3 × 4"]) */
function pairExpressions(n: number): string[] {
  const pairs: string[] = [];
  for (let i = 1; i * i <= n; i++) {
    if (n % i === 0) pairs.push(`${i} × ${n / i}`);
  }
  return pairs;
}

function divisorsFinding(p: Problem): SolutionStep[] {
  const { n } = P<{ n: number }>(p);
  return [
    S(`${n} = ${pairExpressions(n).join(' = ')}`, `かけて ${n} になる組み合わせを小さいほうから見つけます`),
    S(getDivisors(n).join(', '), '式の左がわの数をすべて集めると、約数になります'),
  ];
}

function divisorsCount(p: Problem): SolutionStep[] {
  const { n, count } = P<{ n: number; count: number }>(p);
  return [
    S(`${n} = ${pairExpressions(n).join(' = ')}`, `かけて ${n} になる組み合わせを見つけます`),
    S(getDivisors(n).join(', '), `約数は全部で ${count} 個あります`),
  ];
}

function multiplesFinding(p: Problem): SolutionStep[] {
  const { n, variant, arg1, arg2 } = P<{
    n: number;
    variant: MultiplesFindingVariant;
    arg1: number;
    arg2: number;
  }>(p);
  const ans = formatAnswer(p.answer);
  // すべての構造で「n の倍数は n ずつ増える」を出発点にする
  const opening = S(undefined, `${n} の倍数は、${n} ずつふえていきます`);

  switch (variant) {
    case 'list_first_n': {
      // 1こずつ掛けて並べる
      const steps: SolutionStep[] = [opening];
      let acc = '';
      for (let i = 1; i <= arg1; i++) {
        acc = acc === '' ? String(n * i) : `${acc}, ${n * i}`;
        steps.push(S(`${n} × ${i} = ${n * i}`));
      }
      steps.push(S(`${ans} です。`, `${arg1} こなので ${arg1} 個答えました`));
      return steps;
    }
    case 'list_up_to': {
      // 上限に達するまで足していく
      const list: number[] = [];
      for (let k = n; k <= arg1; k += n) list.push(k);
      return [
        opening,
        S(`${n}, ${n + n}, ${n + n * 2}, … と ${arg1} まで書きます`, `次は ${arg1} を超えるのでここで止まります`),
        S(ans, `${list.length} こになりました`),
      ];
    }
    case 'list_between': {
      const list: number[] = [];
      for (let k = arg1; k <= arg2; k++) if (k % n === 0) list.push(k);
      return [
        opening,
        S(`${arg1} から ${arg2} までの ${n} の倍数は、${list.join(', ')} です。`, `${arg2} を超えるものはないので、${list.length} こです`),
      ];
    }
    case 'nth_multiple':
      return [
        opening,
        S(`${n} の ${arg1} 番目は、${n} × ${arg1}`, `${arg1} 個目の倍数は ${n} を ${arg1} 個並べた値です`),
        S(`${ans} です。`),
      ];
    case 'count_in_range': {
      const list: number[] = [];
      for (let k = n; k <= arg1; k += n) list.push(k);
      return [
        opening,
        S(`${list.join(', ')}`, `1 から ${arg1} までの ${n} の倍数です`),
        S(`${list.length} こ`, '並べた個数が答えになります'),
      ];
    }
    default:
      return [S(ans)];
  }
}

function primeJudgment(p: Problem): SolutionStep[] {
  const { choices } = P<{ choices: number[] }>(p);
  const steps: SolutionStep[] = [
    S(undefined, 'それぞれの数について、約数が1と自分自身だけか調べます'),
  ];
  for (const c of choices) {
    const isP = getDivisors(c).length === 2;
    steps.push(S(`${c}: ${isP ? '素数' : '素数ではない'}`));
  }
  steps.push(S(`よって素数は ${formatAnswer(p.answer)} です`));
  return steps;
}

function primeRange(p: Problem): SolutionStep[] {
  const { min, max } = P<{ min: number; max: number }>(p);
  const primes = getPrimesInRange(min, max);
  return [S(primes.join(', '), `${min} から ${max} までの中から、約数が1と自分自身だけの数を見つけます`)];
}

/** 約数の列挙 → 公約数の抽出という共通手順 */
function commonDivisorSteps(a: number, b: number): SolutionStep[] {
  const da = getDivisors(a);
  const db = getDivisors(b);
  const setB = new Set(db);
  const common = da.filter((d) => setB.has(d));
  return [
    S(da.join(', '), `${a} の約数`),
    S(db.join(', '), `${b} の約数`),
    S(common.join(', '), 'どちらの約数にもなっている数 (公約数) を見つけます'),
  ];
}

/** a の倍数を limit まで列挙する */
function multiplesUpTo(base: number, limit: number): number[] {
  const list: number[] = [];
  for (let m = base; m <= limit; m += base) list.push(m);
  return list;
}

function commonDivisors(p: Problem): SolutionStep[] {
  const { a, b } = P<{ a: number; b: number }>(p);
  return commonDivisorSteps(a, b);
}

function commonMultiples(p: Problem): SolutionStep[] {
  const params = P<{
    a: number;
    b: number;
    variant?: CommonMultiplesVariant;
    arg1?: number;
    arg2?: number | null;
  }>(p);
  const { a, b } = params;
  // variant を持たない旧形式 (list_first_n) も読み取れるようにしておく
  const variant = params.variant ?? 'list_first_n';
  const l = lcm(a, b);
  const lcmStep = S(String(l), `${a} と ${b} の最小公倍数をもとめます`);

  if (variant === 'count_in_range') {
    const upper = params.arg1 ?? 0;
    const list = Array.from({ length: Math.floor(upper / l) }, (_, i) => l * (i + 1));
    return [
      lcmStep,
      S(list.join(', '), `1 から ${upper} までの ${a} と ${b} の公倍数です`),
      S(`よって全部で ${list.length} こあります`, '並べた数の個数を数えます'),
    ];
  }

  if (variant === 'list_up_to') {
    const upper = params.arg1 ?? 0;
    const list = multiplesUpTo(l, upper);
    return [
      lcmStep,
      S(list.join(', '), `${upper} 以下にある公倍数です`),
    ];
  }

  if (variant === 'list_between') {
    const lo = params.arg1 ?? 0;
    const hi = params.arg2 ?? 0;
    const list = multiplesUpTo(l, hi).filter((m) => m >= lo);
    return [
      lcmStep,
      S(list.join(', '), `${lo} から ${hi} までの間にある公倍数です。両端も含むことに注意します`),
    ];
  }

  // list_first_n (従来の構造)
  const count = params.arg1 ?? 3;
  const list = Array.from({ length: count }, (_, i) => l * (i + 1));
  return [
    lcmStep,
    S(list.join(', '), '最小公倍数ずつふえた数が、公倍数です'),
  ];
}

function gcdCalculation(p: Problem): SolutionStep[] {
  const params = P<{ a?: number; b?: number; numbers?: number[] }>(p);
  // 3数のパターン (numbers) と 2数のパターン (a, b) の両方に対応
  const nums =
    params.numbers && params.numbers.length > 0
      ? params.numbers
      : [params.a as number, params.b as number];
  const lists = nums.map((n) => getDivisors(n));
  const common = lists[0].filter((d) => lists.every((l) => l.includes(d)));
  const g = common[common.length - 1];
  const steps: SolutionStep[] = lists.map((l, i) =>
    S(l.join(', '), `${nums[i]} の約数`),
  );
  steps.push(
    S(common.join(', '), 'どの数の約数にもなっている数 (公約数) を見つけます'),
    S(String(g), '公約数のうち、いちばん大きいものが最大公約数です'),
  );
  return steps;
}

function lcmCalculation(p: Problem): SolutionStep[] {
  const { a, b } = P<{ a: number; b: number }>(p);
  const l = lcm(a, b);
  return [
    S(multiplesUpTo(a, l).join(', '), `${a} の倍数`),
    S(multiplesUpTo(b, l).join(', '), `${b} の倍数`),
    S(String(l), '両方にあらわれる数のうち、いちばん小さいものが最小公倍数です'),
  ];
}

type GcdLcmWordParams = { t: string; a?: number; b?: number; c?: number; d?: number };

function gcdLcmWord(p: Problem): SolutionStep[] {
  const params = P<GcdLcmWordParams>(p);
  if (params.t === 'gcd') {
    const steps = gcdCalculation({ ...p, parameters: { a: params.a, b: params.b } });
    steps[0] = {
      ...steps[0],
      explanation: 'あまりなく分けられる量や人数は、2つの数の共通の約数です',
    };
    return steps;
  }
  // lcm / period
  const x = (params.t === 'lcm' ? params.a : params.c) ?? 0;
  const y = (params.t === 'lcm' ? params.b : params.d) ?? 0;
  const steps = lcmCalculation({ ...p, parameters: { a: x, b: y } });
  steps[0] = {
    ...steps[0],
    explanation: 'はじめて重なるのは、2つの数の共通の倍数が出るときです',
  };
  return steps;
}

function periodRepetition(p: Problem): SolutionStep[] {
  const { pattern, period, n } = P<{ pattern: string[]; period: number; n: number }>(p);
  const q = Math.floor(n / period);
  const r = n % period;
  const idx = r === 0 ? period - 1 : r - 1;
  const posText = r === 0 ? `${period}番目と同じ` : `${r}番目と同じ`;
  return [
    S(undefined, `ならべ方の周期 (くり返し) は ${period} です`),
    S(`${n} ÷ ${period} = ${q} あまり ${r}`),
    S(`${pattern[idx]} (${posText})`),
  ];
}

// ===== 分数 =====

/** 仮分数の計算結果に、約分・帯分数への変換があれば続けて足す共通仕上げ */
function finishFraction(steps: SolutionStep[], n: number, d: number): SolutionStep[] {
  const r = reduceFraction(n, d);
  if (r.numerator !== n || r.denominator !== d) {
    steps.push(S(`${red(n, d)}`, '分子と分母を同じ数でわって、約分します'));
  }
  if (r.denominator !== 1 && r.numerator > r.denominator) {
    steps.push(
      S(formatFraction(r.numerator, r.denominator), '仮分数を帯分数になおします'),
    );
  } else if (steps[steps.length - 1]?.expression !== formatFraction(r.numerator, r.denominator)) {
    // 最後の式が答えの形と一致していないときは明示する
    steps.push(S(formatFraction(r.numerator, r.denominator)));
  }
  return steps;
}

function fractionMulInteger(p: Problem): SolutionStep[] {
  const { numerator, denominator, integer } = P<{
    numerator: number;
    denominator: number;
    integer: number;
  }>(p);
  const steps = [
    S(`${raw(numerator, denominator)} × ${integer} = ${raw(numerator * integer, denominator)}`, '分子だけに、その数をかけます'),
  ];
  return finishFraction(steps, numerator * integer, denominator);
}

function fractionDivInteger(p: Problem): SolutionStep[] {
  const { numerator, denominator, integer } = P<{
    numerator: number;
    denominator: number;
    integer: number;
  }>(p);
  const steps = [
    S(`${raw(numerator, denominator)} ÷ ${integer} = ${raw(numerator, denominator * integer)}`, '分母に、その数をかけます'),
  ];
  return finishFraction(steps, numerator, denominator * integer);
}

function fractionMulFraction(p: Problem): SolutionStep[] {
  const { n1, d1, n2, d2 } = P<{ n1: number; d1: number; n2: number; d2: number }>(p);
  const steps = [
    S(`${raw(n1, d1)} × ${raw(n2, d2)} = ${raw(n1 * n2, d1 * d2)}`, '分子どうし、分母どうしをかけます'),
  ];
  return finishFraction(steps, n1 * n2, d1 * d2);
}

function fractionDivFraction(p: Problem): SolutionStep[] {
  const { n1, d1, n2, d2 } = P<{ n1: number; d1: number; n2: number; d2: number }>(p);
  const steps = [
    S(`${raw(n1, d1)} ÷ ${raw(n2, d2)} = ${raw(n1, d1)} × ${raw(d2, n2)}`, 'わり算は、わる分数の分子と分母をひっくりかえたかけ算になります'),
  ];
  return finishFraction(steps, n1 * d2, d1 * n2);
}

/** 帯分数まじりの計算の共通入り口 */
type MixedParams = {
  whole: number;
  numerator: number;
  denominator: number;
  n2: number;
  d2: number;
  mixedNumerator: number;
  mixedDenominator: number;
};

function mixedInputSteps(params: MixedParams, op: string): SolutionStep[] {
  const { whole, numerator, denominator, n2, d2, mixedNumerator, mixedDenominator } = params;
  const inputStr = mixedStr(whole, numerator, denominator);
  return [
    S(`${inputStr} ${op} ${raw(n2, d2)} の計算をします`),
    S(`${inputStr} = ${raw(mixedNumerator, mixedDenominator)}`, '帯分数を仮分数になおしてから計算します'),
  ];
}

function fractionMulMixed(p: Problem): SolutionStep[] {
  const m = P<MixedParams & { answerNumerator?: number }>(p);
  const steps = mixedInputSteps(m, '×');
  return finishFraction(steps, m.mixedNumerator * m.n2, m.mixedDenominator * m.d2);
}

function fractionDivMixed(p: Problem): SolutionStep[] {
  const m = P<MixedParams>(p);
  const inputStr = mixedStr(m.whole, m.numerator, m.denominator);
  const steps = [
    S(`${inputStr} ÷ ${raw(m.n2, m.d2)} の計算をします`),
    S(`${raw(m.mixedNumerator, m.mixedDenominator)} ÷ ${raw(m.n2, m.d2)} = ${raw(m.mixedNumerator, m.mixedDenominator)} × ${raw(m.d2, m.n2)}`, '帯分数を仮分数になおし、わり算をかけ算に変えます'),
  ];
  return finishFraction(steps, m.mixedNumerator * m.d2, m.mixedDenominator * m.n2);
}

function fractionReduce(p: Problem): SolutionStep[] {
  const { numerator, denominator } = P<{ numerator: number; denominator: number }>(p);
  const g = gcd(numerator, denominator);
  const r = reduceFraction(numerator, denominator);
  if (g === 1) {
    // パラメータ不備に備えた安全フォールバック
    return [S(formatFraction(r.numerator, r.denominator), 'これ以上約分できる数がありません')];
  }
  return [
    S(`${raw(numerator, denominator)} = ${formatFraction(r.numerator, r.denominator)}`, `分子と分母を ${g} でわると、約分できます`),
  ];
}

function fractionCommonDenominator(p: Problem): SolutionStep[] {
  const { n1, d1, n2, d2, common, newN1, newN2 } = P<{
    n1: number;
    d1: number;
    n2: number;
    d2: number;
    common: number;
    newN1: number;
    newN2: number;
  }>(p);
  return [
    S(`分母: ${d1}, ${d2} → 最小公倍数は ${common}`, '2つの分母をそろえます'),
    S(`${raw(n1, d1)} = ${raw(newN1, common)}`),
    S(`${raw(n2, d2)} = ${raw(newN2, common)}`),
    S(`${newN1}/${common} と ${newN2}/${common}`),
  ];
}

function fractionMixedConvert(p: Problem): SolutionStep[] {
  const { numerator, denominator, whole } = P<{
    numerator: number;
    denominator: number;
    whole?: number;
  }>(p);

  if (numerator > denominator) {
    // 仮分数 → 帯分数
    const q = Math.floor(numerator / denominator);
    const r = numerator % denominator;
    const rawMixed = r === 0 ? String(q) : `${q}と${r}/${denominator}`;
    const reducedMixed = r === 0 ? String(q) : mixedStr(q, r, denominator);
    const steps: SolutionStep[] = [
      S(`${numerator} ÷ ${denominator} = ${q} あまり ${r}`, '分子を分母でわります'),
      S(`${raw(numerator, denominator)} = ${rawMixed}`),
    ];
    if (reducedMixed !== rawMixed) {
      steps.push(S(`${rawMixed} = ${reducedMixed}`, '帯分数の分数部分を約分します'));
    }
    return steps;
  }

  // 帯分数 → 仮分数
  const w = whole ?? 0;
  const improperRaw = w * denominator + numerator;
  const r = reduceFraction(improperRaw, denominator);
  const steps: SolutionStep[] = [
    S(`${w} × ${denominator} + ${numerator} = ${improperRaw}`, '整数部 × 分母 ＋ 分子 で、仮分数の分子をもとめます'),
    S(`${mixedStr(w, numerator, denominator)} = ${raw(improperRaw, denominator)}`),
  ];
  const finalText = formatFraction(r.numerator, r.denominator);
  if (`${raw(improperRaw, denominator)}` !== finalText) {
    steps.push(S(`${raw(improperRaw, denominator)} = ${finalText}`, '約分できるときは約分します'));
  }
  return steps;
}

function fractionBigSmall(p: Problem): SolutionStep[] {
  const { numerator, denominator, smallerNumerator } = P<{
    numerator: number;
    denominator: number;
    smallerNumerator?: number;
  }>(p);
  const ans = formatAnswer(p.answer);
  const steps: SolutionStep[] = [];
  if (typeof smallerNumerator === 'number') {
    steps.push(
      S(`${smallerNumerator}/${denominator} と ${numerator}/${denominator}`, '分母が同じときは、分子が大きいほうが大きい分数です'),
    );
  }
  steps.push(S(`${ans} のほうが大きいです`));
  return steps;
}

// ===== 小数 =====

function decimalMulDecimal(p: Problem): SolutionStep[] {
  const { a, b, answer } = P<{ a: number; b: number; answer: number }>(p);
  return [
    S(`${pv(a)} × ${pv(b)} = ${pv(answer)}`, 'もとの数の小数位の合計ぶんだけ、答えに小数点をつけます'),
  ];
}

function decimalMulInteger(p: Problem): SolutionStep[] {
  const { a, b, answer } = P<{ a: number; b: number; answer: number }>(p);
  return [S(`${pv(a)} × ${pv(b)} = ${pv(answer)}`)];
}

function decimalDivDecimal(p: Problem): SolutionStep[] {
  const { dividend, divisor, quotient } = P<{
    dividend: number;
    divisor: number;
    quotient: number;
  }>(p);
  const decimals = (String(divisor).split('.')[1] ?? '').length;
  const shift = Math.pow(10, decimals);
  return [
    S(`${num(dividend * shift)} ÷ ${num(divisor * shift)}`, 'わる数の小数点を右へ動かして整数にそろえます (わられる数も同じだけ動かします)'),
    S(`= ${pv(quotient)}`),
  ];
}

function decimalDivInteger(p: Problem): SolutionStep[] {
  const { dividend, divisor, quotient } = P<{
    dividend: number;
    divisor: number;
    quotient: number;
  }>(p);
  return [S(`${pv(dividend)} ÷ ${pv(divisor)} = ${pv(quotient)}`, '小数を整数でわります')];
}

function decimalRound(p: Problem): SolutionStep[] {
  const { value, roundTo, rounded } = P<{ value: number; roundTo: number; rounded: number }>(p);
  return [
    S(`${pv(value)} → ${pv(rounded)}`, `小数第${roundTo}位までにもとめます。小数第${roundTo + 1}位が5以上なら切り上げます`),
  ];
}

// ===== 比・比例・反比例 =====

function ratioSimplify(p: Problem): SolutionStep[] {
  const { a, b, gcd: g0 } = P<{ a: number; b: number; gcd?: number }>(p);
  const g = g0 ?? gcd(a, b);
  return [
    S(`${a} ÷ ${g} = ${a / g}, ${b} ÷ ${g} = ${b / g}`, `${a} と ${b} を共通の約数 ${g} でわります`),
    S(`${a / g}：${b / g}`),
  ];
}

function ratioValue(p: Problem): SolutionStep[] {
  const { a, b } = P<{ a: number; b: number }>(p);
  // 答えは小数第2位に丸めた値なので、途中式も同じ値で表す
  const ans = formatAnswer(p.answer);
  return [S(`${a} ÷ ${b} = ${ans}`, '比の値は「前の数 ÷ 後の数」でもとめます')];
}

function ratioEqual(p: Problem): SolutionStep[] {
  const { a, b, x, y, factor } = P<{ a: number; b: number; x: number; y: number; factor: number }>(p);
  const same = a * y === b * x;
  return [
    S(`${a}:${b} の両方の項に ${factor} をかける → ${x}:${y}`, '両方の項に同じ数をかけても、比は変わりません'),
    S(same ? `${x}:${y} なので同じ比です → はい` : `${x}:${y} とは違う比です → いいえ`),
  ];
}

function ratioQuantity(p: Problem): SolutionStep[] {
  const { a, b, unit, total, askPart } = P<{
    a: number;
    b: number;
    unit: number;
    total: number;
    askPart: number;
  }>(p);
  const ans = formatAnswer(p.answer);
  return [
    S(`${a} + ${b} = ${a + b}`, 'あわせて何つぶんかをもとめます'),
    S(`${total} ÷ ${a + b} = ${unit}`, '1つぶんの大きさをもとめます'),
    S(`${unit} × ${askPart} = ${ans}`, `${askPart} つぶんぶんの大きさが答えです`),
  ];
}

function proportionalExpression(p: Problem): SolutionStep[] {
  const { k } = P<{ k: number }>(p);
  return [
    S(`1個の代金が一定 → 比例定数は${k}`, '代金 y は 個数 x に比例します'),
    S(`y=${k}x`),
  ];
}

function proportionalWord(p: Problem): SolutionStep[] {
  const { k, x1, y1, x2, y2 } = P<{
    k: number;
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  }>(p);
  return [
    S(`${y1} ÷ ${x1} = ${k}`, '1個ぶんの値段をもとめます'),
    S(`${k} × ${x2} = ${pv(y2)}`),
  ];
}

function inverseExpression(p: Problem): SolutionStep[] {
  const { k } = P<{ k: number }>(p);
  return [
    S(`x × y = ${k}`, 'かけて一定になるので、x と y は反比例します'),
    S(`y=${k}÷x`),
  ];
}

function inverseWord(p: Problem): SolutionStep[] {
  const { total, people1, per1, people2 } = P<{
    total: number;
    people1: number;
    per1: number;
    people2: number;
  }>(p);
  const ans = formatAnswer(p.answer);
  return [
    S(`${people1} × ${per1} = ${total}`, '分ける量の合計は変わりません'),
    S(`${total} ÷ ${people2} = ${ans}`, '人数がふえると、1人ぶんは小さくなります (反比例)'),
  ];
}

// ===== 速さ =====

function speedCalculation(p: Problem): SolutionStep[] {
  const { distance, time, timeUnit, distUnit } = P<{
    distance: number;
    time: number;
    timeUnit?: string;
    distUnit?: string;
  }>(p);
  const ans = formatAnswer(p.answer);
  const tu = timeUnit ?? '時間';
  return [
    S(`${distance} ÷ ${time} = ${ans}`, `道のり ${distance}${distUnit ?? 'km'} を ${time}${tu} で進んだときの速さは「道のり ÷ 時間」でもとめます`),
  ];
}

function distanceCalculation(p: Problem): SolutionStep[] {
  const { speed, time } = P<{ speed: number; time: number }>(p);
  return [
    S(`${speed} × ${time} = ${formatAnswer(p.answer)}`, '道のり ＝ 速さ × 時間 でもとめます'),
  ];
}

function timeCalculation(p: Problem): SolutionStep[] {
  const { speed, distance } = P<{ speed: number; distance: number }>(p);
  return [
    S(`${distance} ÷ ${speed} = ${formatAnswer(p.answer)}`, '時間 ＝ 道のり ÷ 速さ でもとめます'),
  ];
}

function speedUnitConversion(p: Problem): SolutionStep[] {
  const { givenValue, variant, answer } = P<{
    givenValue: number;
    variant: SpeedUnitConversionVariant;
    answer: number;
  }>(p);
  const ans = pv(answer);
  const v = givenValue;

  switch (variant) {
    case 'kmh_to_mmin':
      return [
        S(`${v}km = ${v * 1000}m`, '1時間に進む距離をmになおします'),
        S(`${v * 1000} ÷ 60 = ${ans}`, '1時間は60分なので、60でわると1分あたりの速さになります'),
      ];
    case 'mmin_to_kmh':
      return [
        S(`${v}m × 60 = ${v * 60}m`, '1時間に進む距離をmになおします'),
        S(`${v * 60} ÷ 1000 = ${ans}`, '1000mが1kmなので、1000でわると時速になります'),
      ];
    case 'kmh_to_ms':
      return [
        S(`${v}km = ${v * 1000}m`, '1時間に進む距離をmになおします'),
        S(`${v * 1000} ÷ 3600 = ${ans}`, '1時間は3600秒なので、3600でわると1秒あたりの速さになります'),
      ];
    case 'ms_to_kmh':
      return [
        S(`${v}m × 3600 = ${v * 3600}m`, '1時間に進む距離をmになおします'),
        S(`${v * 3600} ÷ 1000 = ${ans}`, '1000mが1kmなので、1000でわると時速になります'),
      ];
    default:
      return [S(ans)];
  }
}

function speedComparison(p: Problem): SolutionStep[] {
  const { speedA, speedB } = P<{ speedA: number; speedB: number }>(p);
  const ans = formatAnswer(p.answer);
  return [
    S(`たろうさん ${speedA}km、はなこさん ${speedB}km`, '同じ1時間なら、遠くまで進むほうが速いです'),
    S(`${ans} のほうが速いです`),
  ];
}

function speedWord(p: Problem): SolutionStep[] {
  const { speed, time, scenario } = P<{ speed: number; time: number; scenario?: string }>(p);
  const isMinutes = Number(scenario ?? 1) <= 2;
  return [
    S(`${speed} × ${time} = ${formatAnswer(p.answer)}`, `道のり ＝ 速さ × 時間 (${isMinutes ? '分速m・ふん' : '時速km・じかん'}で計算)`),
  ];
}

function speedMultiStep(p: Problem): SolutionStep[] {
  const { speed1, time1, speed2, time2, totalDistance, totalTime, averageSpeed } = P<{
    speed1: number;
    time1: number;
    speed2: number;
    time2: number;
    totalDistance: number;
    totalTime: number;
    averageSpeed: number;
  }>(p);
  return [
    S(`${speed1} × ${time1} = ${speed1 * time1}`, 'はじめの時間に進んだ道のり'),
    S(`${speed2} × ${time2} = ${speed2 * time2}`, 'つぎの時間に進んだ道のり'),
    S(`${totalDistance} ÷ ${totalTime} = ${pv(averageSpeed)}`, `合計 ${totalDistance}km を合計 ${totalTime}時間で進んだので、平均の速さ ＝ 道のり全部 ÷ 時間全部`),
  ];
}

// ===== 図形 =====

function circleAreaRadius(p: Problem): SolutionStep[] {
  const { radius, area } = P<{ radius: number; area: number; pi?: number }>(p);
  return [
    S(`${radius} × ${radius} × 3.14 = ${pv(area)}`, '円の面積 ＝ 半径 × 半径 × 円周率'),
  ];
}

function circleAreaDiameter(p: Problem): SolutionStep[] {
  const { diameter, radius, area } = P<{ diameter: number; radius: number; area: number }>(p);
  return [
    S(`${diameter} ÷ 2 = ${num(radius)}`, '直径の半分が半径です'),
    S(`${num(radius)} × ${num(radius)} × 3.14 = ${pv(area)}`, '円の面積 ＝ 半径 × 半径 × 円周率'),
  ];
}

function circleRadiusFromArea(p: Problem): SolutionStep[] {
  const { radius, area } = P<{ radius: number; area: number }>(p);
  const r2 = num(area / 3.14);
  return [
    S(`${pv(area)} ÷ 3.14 = ${r2}`, '面積 ÷ 円周率 で「半径 × 半径」がわかります'),
    S(`${radius} × ${radius} = ${r2}`, `かけて ${r2} になる数を探すと ${radius} なので、半径は ${radius}cm です`),
  ];
}

function volumeBox(p: Problem): SolutionStep[] {
  const { length, width, height, volume } = P<{
    length: number;
    width: number;
    height: number;
    volume: number;
  }>(p);
  return [S(`${length} × ${width} × ${height} = ${pv(volume)}cm³`, '直方体の体積 ＝ 縦 × 横 × 高さ')];
}

function volumeCube(p: Problem): SolutionStep[] {
  const { edge, volume } = P<{ edge: number; volume: number }>(p);
  return [S(`${edge} × ${edge} × ${edge} = ${pv(volume)}cm³`, '立方体の体積 ＝ 1辺 × 1辺 × 1辺')];
}

function volumePrism(p: Problem): SolutionStep[] {
  const { baseArea, height, volume } = P<{ baseArea: number; height: number; volume: number }>(p);
  return [S(`${baseArea} × ${height} = ${pv(volume)}cm³`, '角柱の体積 ＝ 底面積 × 高さ')];
}

function volumeCylinder(p: Problem): SolutionStep[] {
  const { radius, height, baseArea, volume } = P<{
    radius: number;
    height: number;
    baseArea: number;
    volume: number;
  }>(p);
  return [
    S(`${radius} × ${radius} × 3.14 = ${pv(baseArea)}`, '底面は円。底面積 ＝ 半径 × 半径 × 円周率'),
    S(`${pv(baseArea)} × ${height} = ${pv(volume)}cm³`, '円柱の体積 ＝ 底面積 × 高さ'),
  ];
}

function volumeFromHeight(p: Problem): SolutionStep[] {
  const { baseArea, volume, height } = P<{ baseArea: number; volume: number; height: number }>(p);
  return [S(`${volume} ÷ ${baseArea} = ${pv(height)}cm`, '高さ ＝ 体積 ÷ 底面積')];
}

function volumeUnit(p: Problem): SolutionStep[] {
  const { liters, cm3 } = P<{ liters: number; cm3: number }>(p);
  return [
    S(`1L = 1000cm³`, '1リットルは1000立方センチメートルです'),
    S(`${liters} × 1000 = ${pv(cm3)}cm³`),
  ];
}

function symmetryFold(p: Problem): SolutionStep[] {
  const { shape, isFold, count } = P<{ shape: string; isFold: boolean; count: number }>(p);
  const ans = formatAnswer(p.answer);
  return [
    S(undefined, `${shape} を折り重ねて、ぴったり重なるか考えます`),
    isFold
      ? S(`対称の軸は ${count} 本 → ${ans}`)
      : S(`対称の軸が1本もないので ${ans}`),
  ];
}

function symmetryPoint(p: Problem): SolutionStep[] {
  const { shape, isPoint } = P<{ shape: string; isPoint: boolean }>(p);
  const ans = formatAnswer(p.answer);
  return [
    S(undefined, '中心のまわりに180度回すと、ぴったり重なるか考えます'),
    isPoint
      ? S(`${shape} は中心でぴったり重なるので ${ans}`)
      : S(`${shape} は中心で重ならないので ${ans}`),
  ];
}

/**
 * judge_differs (図形の合同・三角形のみ・合同でない場合)
 *
 * 合同な図形は辺の長さと角の大きさがすべて対応して等しくなければならない。
 * 図Aと図Bを見比べたときに、辺の長さが一致しないことを確認する。
 */
function judgeDiffers(p: Problem): SolutionStep[] {
  const ans = formatAnswer(p.answer);
  return [
    S(undefined, '2つの図形を重ね合わせたときに、ぴったり重なるかを考えます'),
    S('辺の長さを対応させて比較します', '辺の長さがすべて等しくありません'),
    S(undefined, `図Aと図Bは合同ではないので ${ans}`),
  ];
}

/**
 * judge_same (図形の合同・三角形のみ)
 *
 * 合同変換 (回転・平行移動) は辺の長さと角の大きさを変えない。
 * 図Bは図Aを合同変換した図形なので、両者は合同である。
 */
function judgeSame(p: Problem): SolutionStep[] {
  const { rotationDeg } = P<{ rotationDeg: number }>(p);
  const ans = formatAnswer(p.answer);
  return [
    S(undefined, '図形を動かせば重なるか、辺の長さと角の大きさを比べます'),
    S(
      `回転(${rotationDeg}°)と平行移動では辺の長さが変わらない`,
      `図Aと図Bは合同なので ${ans}`,
    ),
  ];
}

function scaleLength(p: Problem): SolutionStep[] {
  const { scale, base, result, isEnlarge } = P<{
    scale: number;
    base: number;
    result: number;
    isEnlarge?: boolean;
  }>(p);
  return [
    S(`${base} × ${scale} = ${pv(result)}`, (isEnlarge ?? scale > 1)
      ? '拡大後の長さ ＝ もとの長さ × 倍率'
      : '実際の長さ ＝ 図形の長さ × 倍率'),
  ];
}

function angleBasic(p: Problem): SolutionStep[] {
  const { angleA, angleB, angleC } = P<{ angleA: number; angleB: number; angleC: number }>(p);
  return [
    S(undefined, '三角形の3つの角をあわせると、必ず180°になります'),
    S(`180 - ${angleA} = ${180 - angleA}`),
    S(`${180 - angleA} - ${angleB} = ${pv(angleC)}°`, '残りの角をもとめます'),
  ];
}

/* ------------------------------------------------------------------------- *
 * Phase 2-S: 円周 / 台形の面積 / 基本単位換算
 * ------------------------------------------------------------------------- */

function circleCircumference(p: Problem): SolutionStep[] {
  const { variant, diameter, circumference, unit } = P<{
    variant: string;
    diameter: number;
    circumference: number;
    unit: string;
  }>(p);
  const unitLabel = unit === 'm' ? 'm' : 'cm';
  if (variant === 'from_diameter') {
    const steps: SolutionStep[] = [
      S(`${diameter} × 3.14 = ${pv(circumference)}`, '円周 ＝ 直径 × 円周率'),
    ];
    if (unit === 'm') {
      steps.push(
        S(`100cm = 1m`, '長さの単位を m にそろえます'),
        S(`${pv(circumference)}cm ÷ 100 = ${formatAnswer(p.answer)}m`),
      );
    }
    steps.push(S(`円周は ${formatAnswer(p.answer)}${unitLabel} です`, '求める答えをまとめます'));
    return steps;
  }
  return [
    S(`${pv(circumference)} ÷ 3.14 = ${diameter}`, '円周 ÷ 円周率 で直径になります'),
    S(`直径は ${diameter}${unitLabel} です`, '求める答えをまとめます'),
  ];
}

function trapezoidArea(p: Problem): SolutionStep[] {
  const { variant, a, b, h, area } = P<{
    variant: string;
    a: number;
    b: number;
    h: number;
    area: number;
  }>(p);
  if (variant === 'basic') {
    return [
      S(`(${a} + ${b}) × ${h} ÷ 2 = ${pv(area)}cm²`, '台形の面積 ＝（上底＋下底）×高さ÷2'),
    ];
  }
  if (variant === 'reverse_height') {
    return [
      S(`${pv(area)} × 2 ÷ (${a} + ${b}) = ${h}cm`, '面積×2÷（上底＋下底）で高さをもとめます'),
    ];
  }
  return [
    S(`${pv(area)} × 2 ÷ ${h} = ${a + b}`, '面積×2÷高さ で「上底＋下底」がわかります'),
    S(`${a + b} - ${b} = ${a}cm`, '下底を引くと上底になります'),
  ];
}

function unitConversionBasic(p: Problem): SolutionStep[] {
  const { variant, from, to, value, answer } = P<{
    variant: string;
    from: string;
    to: string;
    value: number;
    answer: number;
  }>(p);
  if (variant === 'area') {
    const shrinks = value > answer;
    return [
      S(`1m = 100cm なので、1m² = 10000cm²`, '面積は長さの2乗なので、単位の倍率も2乗になります'),
      S(
        shrinks
          ? `${value}cm² ÷ 10000 = ${answer}m²`
          : `${value}m² × 10000 = ${answer}cm²`,
        `${from}を${to}に直します`,
      ),
    ];
  }
  // 大きな単位へ直すときは割り、小さな単位へ直すときは掛ける
  const shrinks = value > answer;
  const factor = shrinks ? value / answer : answer / value;
  return [
    S(
      shrinks
        ? `1${to} = ${factor}${from}`
        : `1${from} = ${factor}${to}`,
      `${from}と${to}の関係を確かめます`,
    ),
    S(
      shrinks
        ? `${value}${from} ÷ ${factor} = ${answer}${to}`
        : `${value}${from} × ${factor} = ${answer}${to}`,
      `${value}${from}を${to}に直します`,
    ),
  ];
}

// ============================================================================
  // Phase 2-T: 小数の位取り / 単位分数の導入 / 三角形の分類
  // ============================================================================

/** 溶液側で使う位名称 (generator 側の PLACE_LABEL と同値) */
const PLACE_LABELS: Record<number, string> = {
  1: '10分の1の位',
  2: '100分の1の位',
  3: '1000分の1の位',
};

function decimalPlaceValue(p: Problem): SolutionStep[] {
  const { variant, place, digits, digit } = P<{
    variant: string;
    place: number;
    digits?: number[];
    digit?: number;
    answer: number | string;
  }>(p);
  const unitText = '0.' + '0'.repeat(place - 1) + '1';
  if (variant === 'read_digit' && digits) {
    return [
      S(`0.${digits.join('')} の小数点は ${place} けた目まであります`, '小数点向右に数えます'),
      S(`${place} けた目の数字は ${digits[place - 1]}`, 'その位の数字を読み取ります'),
    ];
  }
  if (variant === 'place_value' && digit !== undefined) {
    return [
      S(`1 の ${Math.pow(10, place)} 分の1 は ${unitText}`, 'その位の1つ分の大きさです'),
      S(`${digit} × ${unitText} = ${formatAnswer(p.answer)}`, '桁の数字ぶん、1つ分を足します'),
    ];
  }
  if (variant === 'decompose') {
    const { bigPart, smallPart } = P<{ bigPart: number; smallPart: number }>(p);
    return [
      S(`${pv(bigPart)} は${PLACE_LABELS[place]}の値`, '大きい位の値を取り出します'),
      S(`${pv(bigPart)} + ${pv(smallPart)} = ${formatAnswer(p.answer)}`, '隣り合う位の値を足します'),
    ];
  }
  if (digits) {
    const parts: string[] = [];
    for (let i = 1; i <= place; i++) {
      if (digits[i - 1] !== 0) {
        parts.push(`${digits[i - 1]} × ${pv(Math.pow(10, -i))}`);
      }
    }
    return [S(parts.join(' + ') + ` = ${formatAnswer(p.answer)}`, '各位の数字をその位の重みにかけます')];
  }
  return [S(formatAnswer(p.answer), '答えをまとめます')];
}

function fractionUnitIntro(p: Problem): SolutionStep[] {
  const { variant, num, den } = P<{ variant: string; num: number; den: number }>(p);
  if (variant === 'meaning') {
    return [
      S(`全体を ${den} 等分する`, '何等分したかを考えます'),
      S(`1/${den}`, '1つ分は全体の 1/' + den + ' です'),
    ];
  }
  if (variant === 'how_many_units') {
    return [
      S(`分母が ${den} で同じなので 1/${den} を単位に数えます`, '分母が等分する数を示します'),
      S(`分子の ${num} は ${num} 個分 → ${num}`, '分子の数字が個数になります'),
    ];
  }
  if (variant === 'count_units') {
    return [
      S(`1/${den} が ${num} 個ある`, '集めた個数を分子に置き換えます'),
      S(`${num}/${den}`, '分母は変わりません'),
    ];
  }
  return [
    S(`分数の下の数は分母 → ${den}`, '下の数が分母です'),
    S(`分母は ${den}`, '全体を' + den + '等分があることを表します'),
  ];
}

function triangleClassify(p: Problem): SolutionStep[] {
  const { a, b, c, kind, variant } = P<{
    a: number;
    b: number;
    c: number;
    kind: string;
    variant?: string;
  }>(p);
  const sorted = [a, b, c].sort((x, y) => x - y);
  const steps: SolutionStep[] = [
    S(`${sorted[0]} + ${sorted[1]} = ${sorted[0] + sorted[1]} > ${sorted[2]}`, '三角形ができる条件を確認します'),
  ];
  if (a === b && b === c) steps.push(S(`3辺がすべて等しい → ${kind}`, '3辺を比べます'));
  else if (a === b || b === c || a === c) steps.push(S(`2辺が等しい → ${kind}`, '3辺を比べます'));
  else steps.push(S(`等しい辺がない → ${kind}`, '3辺を比べます'));
  if (variant === 'which_sides_equal') {
    steps.push(
      S(`等しい辺は ${a === b && b === c ? 3 : 2} 本`, '正三角形なら3本、二等辺三角形なら2本'),
    );
  }
  return steps;
}

// ===== 平行と垂直 (Phase 2-U) =====

function parallelPerpendicular(p: Problem): SolutionStep[] {
  const { variant, answerKind } = P<{ variant: string; answerKind: string }>(p);
  if (variant === 'definition_parallel') {
    return [
      S('2本の直線が互いに交わらない', '平行の定義を確認する'),
      S(`答え: ${formatAnswer(p.answer)}`, 'この関係を平行といいます'),
    ];
  }
  if (variant === 'definition_perpendicular') {
    return [
      S('2本の直線が交わり、できる角が直角', '垂直の定義を確認する'),
      S(`答え: ${formatAnswer(p.answer)}`, 'この関係を垂直といいます'),
    ];
  }
  if (variant === 'angle_judgment') {
    const { angle } = P<{ angle: number }>(p);
    if (answerKind === 'perpendicular') {
      return [
        S(`できる角の一つが ${angle}°`, '直角かどうかを確認する'),
        S('直角ができるので垂直', '交わる2直線が垂直になるのは直角のとき'),
      ];
    }
    return [
      S(`できる角の一つが ${angle}°`, '直角かどうかを確認する'),
      S(`${angle}° は直角 90° ではない`, '直角ではないので垂直ではない'),
      S('答え: 垂直ではありません', '交わる2直線が垂直になるのは直角のときだけ'),
    ];
  }
  if (variant === 'intersection_judgment') {
    const { intersects } = P<{ intersects: boolean }>(p);
    if (intersects) {
      return [
        S('2本の直線が交わっている', '交わるかどうかを確認する'),
        S('平行な直線は交わらないので平行ではない', '定義用到する条件を逆にたどる'),
      ];
    }
    return [
      S('同じ平面上にある2本の直線が交わらない', '交わるかどうかを確認する'),
      S('平行の定義に合う', '定義用到する条件をそのまま使う'),
    ];
  }
  if (variant === 'equal_distance') {
    const { constantDistance } = P<{ constantDistance: number }>(p);
    return [
      S(`2直線の間の距離はどこでも ${constantDistance}cm で一定`, '平行の性質を確認する'),
      S('距離が一定なら平行', '平行なら直線間の距離は変わらない'),
    ];
  }
  const { relation, pair } = P<{ relation: string; pair: { a: number; b: number } }>(p);
  const names = ['直線あ', '直線い', '直線う'];
  const given = [
    `${names[0]}と${names[1]}は平行`,
    `${names[0]}と${names[2]}は垂直`,
  ].join('、');
  return [
    S(given, '与えられた関係を整理する'),
    S(`求めるのは${relation === 'parallel' ? '平行' : '垂直'}な組`, '条件に合う組を絞る'),
    S(`答え: ${names[pair.a]}と${names[pair.b]}`, '条件に合う2本を選ぶ'),
  ];
}

// ===== 三角形・平行四辺形の面積 (Phase 2-Z1) =====

function triangleArea(p: Problem): SolutionStep[] {
  const { variant, base, height, area, answer, rectangleArea } = P<{
    variant: string;
    base: number;
    height: number;
    area: number;
    answer: number;
    rectangleArea?: number;
  }>(p);
  const product = base * height;
  if (variant === 'find_height') {
    return [
      S(`面積は 底辺 × 高さ ÷ 2 です`, '三角形の面積の公式を確認する'),
      S(`面積の2倍は ${area} × 2 = ${product}`, '高さの2倍を先に求める'),
      S(`次は ${product} ÷ ${base} = ${answer} cm`, '底辺で割ると高さが出る'),
    ];
  }
  if (variant === 'find_base') {
    return [
      S(`面積は 底辺 × 高さ ÷ 2 です`, '三角形の面積の公式を確認する'),
      S(`面積の2倍は ${area} × 2 = ${product}`, '底辺の2倍を先に求める'),
      S(`次は ${product} ÷ ${height} = ${answer} cm`, '高さで割ると底辺が出る'),
    ];
  }
  if (variant === 'compare_with_rectangle') {
    return [
      S(`長方形の面積は ${base} × ${height} = ${rectangleArea} cm2`, '同じ底辺と高さの長方形を考える'),
      S(`三角形の面積はその半分なので ${area} ÷ 2 = ${area} cm2`, '長方形の半分が三角形になる'),
      S(`答えは ${rectangleArea} − ${area} = ${answer} cm2`, '2つの面積の差を求める'),
    ];
  }
  const steps: SolutionStep[] = [];
  if (variant === 'find_area_with_slant') {
    steps.push(S('使うのは底辺と高さであり、斜辺は使いません', '斜辺と高さを区別する'));
  }
  steps.push(S(`${base} × ${height} = ${product}`, '底辺と高さを掛ける'));
  steps.push(S(`${product} ÷ 2 = ${area} cm2`, 'その半分が三角形の面積になる'));
  steps.push(S(`答え: ${formatAnswer(p.answer)}`, '答えを書く'));
  return steps;
}

function parallelogramArea(p: Problem): SolutionStep[] {
  const { variant, base, height, area, answer, triangleArea: tri } = P<{
    variant: string;
    base: number;
    height: number;
    area: number;
    answer: number;
    triangleArea?: number;
  }>(p);
  if (variant === 'find_height') {
    return [
      S(`面積は 底辺 × 高さ です`, '平行四辺形の面積の公式を確認する'),
      S(`${area} ÷ ${base} = ${answer} cm`, '面積を底辺で割ると高さが出る'),
    ];
  }
  if (variant === 'find_base') {
    return [
      S(`面積は 底辺 × 高さ です`, '平行四辺形の面積の公式を確認する'),
      S(`${area} ÷ ${height} = ${answer} cm`, '面積を高さで割ると底辺が出る'),
    ];
  }
  if (variant === 'two_triangles') {
    return [
      S(`平行四辺形の面積は ${base} × ${height} = ${area} cm2`, 'まず平行四辺形の面積を求める'),
      S(`対角線で分けた三角形はその半分なので ${area} ÷ 2 = ${tri} cm2`, '2つの三角形は等分される'),
      S(`答え: ${formatAnswer(p.answer)}`, '答えを書く'),
    ];
  }
  const steps: SolutionStep[] = [];
  if (variant === 'find_area_with_slant') {
    steps.push(S('使うのは底辺と高さであり、斜辺は使いません', '斜辺と高さを区別する'));
  }
  steps.push(S(`${base} × ${height} = ${area} cm2`, '平行四辺形の面積は底辺×高さ (三角形のように ÷2 しない)'));
  steps.push(S(`答え: ${formatAnswer(p.answer)}`, '答えを書く'));
  return steps;
}

// ===== 正方形・長方形の面積 (Phase 2-Z) =====

function rectangleArea(p: Problem): SolutionStep[] {
  const { variant, width, height, area, answer } = P<{
    variant: string;
    width: number;
    height: number;
    area: number;
    answer: number;
  }>(p);
  if (variant === 'unit_convert') {
    return [
      S('1 m = 100 cm なので長さを cm に直す', '面積の単位は長さの2乗であることに注意'),
      S(`1辺は ${width} cm`, 'm から cm へ変換する'),
      S(`正方形なので ${width} × ${width} = ${answer} cm2`, '正方形の面積は 1辺 × 1辺'),
    ];
  }
  if (variant === 'find_side') {
    const known = answer === width ? height : width;
    return [
      S(`面積は 縦 × 横 = ${area} cm2`, '面積を先に求める'),
      S(`次は ${area} ÷ ${known} で他方の辺を求める`, '面積を一方の辺で割る'),
      S(`答え: ${formatAnswer(p.answer)}`, '答えを書く'),
    ];
  }
  const steps: SolutionStep[] = [
    S(`${width} × ${height} = ${area} cm2`, '面積は 縦 × 横 で求める'),
  ];
  steps.push(S(`答え: ${formatAnswer(p.answer)}`, '答えを書く'));
  return steps;
}

// ===== 面積の単位変換 (Phase 2-V) =====

/**
 * 変換先の単位のほうが大きい (つまり「割る」) 変換の variant 名。
 * 単位の大きさは ㎠ < ㎡ < a < ha < ㎢ の順で、変換先が変換元より大きい組合せだけを列挙する。
 */
const AREA_DIVIDE_VARIANTS = new Set([
  'sqm_to_aresu',
  'sqm_to_hektaru',
  'hektaru_to_sqkm',
]);

function areaUnitConversion(p: Problem): SolutionStep[] {
  const { variant, from, to, givenValue, answer, multiplier } = P<{
    variant: string;
    from: string;
    to: string;
    givenValue: number;
    answer: number;
    multiplier: number;
  }>(p);
  const given = String(givenValue);
  // variant 名から方向を判定する (係数 factor は parameters に保存していないため)
  if (AREA_DIVIDE_VARIANTS.has(variant)) {
    // 変換先の単位のほうが大きいので割る
    return [
      S(`1${to} は 1${from} の ${multiplier} 倍です`, '単位の関係を確認する'),
      S(`${given}${from} ÷ ${multiplier} = ${answer}${to}`, '答えを求める'),
    ];
  }
  return [
    S(`1${to} は 1${from} の 1/${multiplier} です`, '単位の関係を確認する'),
    S(`${given}${from} × ${multiplier} = ${answer}${to}`, '答えを求める'),
  ];
}

// ===== 異分母の分数の加法・減法 (Phase 2-Y) =====

function fractionAddSub(p: Problem): SolutionStep[] {
  const { operation, n1, d1, n2, d2, numerator, denominator, commonDenominator } = P<{
    operation: string;
    n1: number;
    d1: number;
    n2: number;
    d2: number;
    numerator: number;
    denominator: number;
    commonDenominator: number;
  }>(p);
  const sign = operation === 'add' ? '＋' : '−';
  const l = commonDenominator;
  const rawNumerator = operation === 'add'
    ? n1 * (l / d1) + n2 * (l / d2)
    : n1 * (l / d1) - n2 * (l / d2);
  const steps: SolutionStep[] = [
    S(`分母の最小公倍数は ${l} です`, '分母をそろえます (通分)'),
    S(`${n1 * (l / d1)}/${l} ${sign} ${n2 * (l / d2)}/${l} = ${rawNumerator}/${l}`, '分子を足し引きします'),
  ];
  if (gcdOf(rawNumerator, l) > 1) {
    steps.push(S(`${rawNumerator}/${l} を約分すると ${numerator}/${denominator}`, '分子と分母の共通の約数で割ります'));
  } else {
    steps.push(S('これ以上約分できません', '分子と分母に共通の約数はありません'));
  }
  // 最後のステップには必ず答え (formatAnswer の結果) を含める
  steps.push(S(`答え: ${formatAnswer(p.answer)}`, '約分した答えを書きましょう'));
  return steps;
}

// ===== 百分率 (Phase 2-Y) =====

function percentage(p: Problem): SolutionStep[] {
  const { variant, percent, whole, part, answer } = P<{
    variant: string;
    percent: number;
    whole: number;
    part: number;
    answer: number;
  }>(p);
  const common: SolutionStep[] = [
    S(`割合 = ${part} ÷ ${whole}`, '部分量を全体で割って割合を求めます'),
    S(`割合 × 100 = ${round1((part / whole) * 100)}パーセント`, '100倍して百分率で表します'),
  ];
  if (variant === 'percent_of') {
    return [
      S(`${whole} の ${percent} パーセントを求めます`, '求める百分率を確認します'),
      S(`${whole} × ${percent} ÷ 100 = ${answer}`, '全体を100で割って掛けます'),
    ];
  }
  return [...common, S(`答え: ${answer}パーセント`, '求める百分率に単位を付けます')];
}

/** 小数第1位に丸める (溶液側で独立に使う) */
function round1(v: number): number {
  return Math.round(v * 10) / 10;
}

/** 最大公約数 (溶液側で独立に使う) */
function gcdOf(a: number, b: number): number {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y !== 0) {
    const t = x % y;
    x = y;
    y = t;
  }
  return x;
}

// ===== 積の見積もり (Phase 2-Z5B) =====

function estimateProduct(p: Problem): SolutionStep[] {
  const { a, b, placeA, placeB, roundedA, roundedB, exactProduct } = P<{
    a: number;
    b: number;
    placeA: number;
    placeB: number;
    roundedA: number;
    roundedB: number;
    estimate: number;
    exactProduct: number;
  }>(p);
  const label = (place: number): string =>
    place === 1 ? 'そのまま（1の倍数）' : (place === 100 ? '百の位' : '十の位') + '（' + place + 'の倍数）';
  return [
    S(`求めるのは正確な積ではなく、およその大きさです`, '概算値の練習であることを確認する'),
    S(`${a} → ${roundedA}、${b} → ${roundedB}`, `${label(placeA)}と${label(placeB)}にそろえる`),
    S(`正確な積は ${exactProduct} で、概算値とは一致しません`, '概算値と正確な積を区別する'),
    // 最後のステップには必ず答え (formatAnswer の結果) を含める
    S(`${roundedA} × ${roundedB} = ${formatAnswer(p.answer)}`, '答えを書く'),
  ];
}

// ===== 式 =====

function expressionMake(p: Problem): SolutionStep[] {
  const { count, x } = P<{ count: number; x: string }>(p);
  const ans = formatAnswer(p.answer);
  return [S(`${x} × ${count} = ${ans}`, '1本ぶんの代金 × 本数 で、全体の代金を表します')];
}

function expressionSubstitution(p: Problem): SolutionStep[] {
  const { a, b, x } = P<{ a: number; b: number; x: number }>(p);
  const ans = formatAnswer(p.answer);
  if (a === 1) {
    return [
      S(`${x} + ${b} = ${ans}`, 'x に代入して計算します'),
    ];
  }
  return [
    S(`${a} × ${x} = ${a * x}`, 'x に代入します'),
    S(`${a * x} + ${b} = ${ans}`),
  ];
}

function expressionWordMake(p: Problem): SolutionStep[] {
  const { price } = P<{ price: number }>(p);
  const ans = formatAnswer(p.answer);
  return [S(`${price} × x → ${ans}`, '1こぶんの値段 × 個数 (x) を式にします')];
}

function expressionMeaning(p: Problem): SolutionStep[] {
  // 言語で説明する問題のため、模範解答をそのまま解説として示す
  return [S(undefined, formatAnswer(p.answer))];
}

function expressionBlank(p: Problem): SolutionStep[] {
  const { b, result } = P<{ b: number; result: number }>(p);
  return [
    S(`${result} ÷ ${b} = ${formatAnswer(p.answer)}`, `□ × ${b} ＝ ${result} なので、逆にもとめます`),
  ];
}

function expressionMultiCondition(p: Problem): SolutionStep[] {
  const { a, b, x } = P<{ a: number; b: number; x: number }>(p);
  const ans = Number(formatAnswer(p.answer));
  const initial = ans - a * x;
  return [
    S(`${a} × ${x} = ${a * x}`, `${b}分間で ふえる数をもとめます`),
    S(`${initial} + ${a * x} = ${formatAnswer(p.answer)}`, 'はじめの数に、ふえた分をたします'),
  ];
}

// ===== 場合の数 =====

/** k から 1 ずつ減らしながらかけた積を、途中式つきで返す */
function factorialChainSteps(k: number, explanation: string): { steps: SolutionStep[]; product: number } {
  const steps: SolutionStep[] = [];
  let product = 1;
  const chain: string[] = [];
  for (let i = k; i >= 1; i--) {
    chain.push(String(i));
    product *= i;
    if (chain.length >= 2) {
      steps.push(S(`${chain.join(' × ')} = ${product}`, steps.length === 0 ? explanation : undefined));
    }
  }
  if (steps.length === 0) {
    steps.push(S(String(product), explanation));
  }
  return { steps, product };
}

/**
 * 並べ方 (n個から一部を選んで並べる) の途中式
 *
 * Phase 2-B: variant ごとに「何を選ぶか / どう並べるか」が変わるため、
 * 積の作り方を種類ごとに分ける。どの種類も最後の積が正解と一致する。
 */
function arrangeSimple(p: Problem): SolutionStep[] {
  const { n, r, variant } = P<{ n: number; r: number; variant: ArrangeSimpleVariant }>(p);
  const ans = formatAnswer(p.answer);

  /**
   * from 個から count 個を選ぶ積を、段階ごとに示す。
   * count が2以上なら「n = n」という無意味な1段目を出さず、積だけで示す。
   */
  const chainSteps = (from: number, count: number, firstNote: string): SolutionStep[] => {
    const steps: SolutionStep[] = [];
    let acc = 1;
    let expr = '';
    for (let i = 0; i < count; i++) {
      const term = from - i;
      acc *= term;
      // 選ぶ人が1人だけのときは「n = n」だと無意味なので「n 通り」と書く
      if (count === 1) {
        if (i === 0) steps.push(S(`${from} 通り`, firstNote));
        continue;
      }
      expr = expr === '' ? String(term) : `${expr} × ${term}`;
      // 2個以上選ぶときでも、最初の1段だけの「n = n」は意味がないので
      // 「n 通り」と説明し、2段目から積で示す
      if (i === 0 && count >= 2) {
        steps.push(S(`${term} 通り`, firstNote));
        continue;
      }
      steps.push(S(`${expr} = ${acc}`));
    }
    return steps;
  };

  switch (variant) {
    case 'pick_only':
      return [
        S(undefined, '1人めの選び方 × 2人めの選び方 × … の順で数えます'),
        ...chainSteps(n, r, `1番めに並べるのは${n}人のうち誰か、${r}通りです`),
        S(`全部で ${ans} 通り`),
      ];

    case 'pick_special': {
      // 特別の1人: n-1個から r-1個を選ぶ通り (並べない)
      const inner = comboValue(n - 1, r - 1);
      const fExpr = factorialExpr(r - 1);
      // かけ算とわり算を1行に書くと演算の順番が曖昧になるため、2段に分ける
      const terms = Array.from({ length: r - 1 }, (_, i) => n - 1 - i);
      const fallingTerms = terms.join(' × ');
      const falling = terms.reduce((a, b) => a * b, 1);
      if (r - 1 <= 1) {
        return [
          S(`${fallingTerms} = ${inner}`, '残りは1人だけなので、選ぶ人が決まれば1通りです'),
          S(`${n} × ${inner} = ${ans}`, `特別の1人の選び方が${n}通りあるのでかけます`),
        ];
      }
      return [
        S(`${fallingTerms} = ${falling}`, `${n - 1}人の中から${r - 1}人を順番つきで選ぶ数を、まず数えます`),
        S(`${falling} ÷ ${fExpr} = ${inner}`, '選ぶ順番が違うと同じ選び方になるので、重複したぶんをわります'),
        S(`${n} × ${inner} = ${ans}`, `特別の1人の選び方が${n}通りあるのでかけます`),
      ];
    }

    case 'pick_include_one':
      return [
        S(undefined, `Aさんは必ず選ぶので、残りはAさん以外の${n - 1}人の中から選びます`),
        ...(r - 1 <= 1
          ? [S(`${n - 1} 通り`, `選ぶ人が1人だけなので、残り${n - 1}人の中から1人を選びます`)]
          : chainSteps(n - 1, r - 1, `残りの${n - 1}通りは、Aさん以外の${n - 1}人から選びます`)),
        S(`全部で ${ans} 通り`),
      ];

    case 'pick_first_fixed':
      return [
        S(undefined, '1番めはAさんに決まっているので、残りから選びます'),
        ...(r - 1 <= 1
          ? [S(`${n - 1} 通り`, `選ぶ人が1人だけなので、残り${n - 1}人の中から1人を選びます`)]
          : chainSteps(n - 1, r - 1, `2番めに並べるのは残り${n - 1}人のうち誰か、${n - 1}通りです`)),
        S(`全部で ${ans} 通り`),
      ];

    case 'pick_both_ends': {
      if (r - 2 <= 0) {
        return [
          S(undefined, '左右のはしに入るBさんとCさんは、左右を入れかえた2通りあります'),
          S(`2 × 1 = ${ans}`, '残りの人は並べないので、並びかたはこの2通りだけです'),
        ];
      }
      const inner = chainSteps(n - 2, r - 2, '');
      const last = inner[inner.length - 1];
      return [
        S(undefined, '左右のはしに入るBさんとCさんは、左右を入れかえた2通りあります'),
        S(last.expression!, '残りの人は左のはしから順に並べます'),
        S(`2 × ${accOf(last.expression!)} = ${ans}`, '左右の2通りをそろえて2倍します'),
      ];
    }

    default:
      return [S(`全部で ${ans} 通り`)];
  }
}

function combineSimple(p: Problem): SolutionStep[] {
  const params = P<{
    n: number;
    r: number;
    variant?: CombineSimpleVariant;
  }>(p);
  // variant を持たない旧形式 (pick_only) も読み取れるようにしておく
  const variant = params.variant ?? 'pick_only';
  const { n, r } = params;
  const ans = formatAnswer(p.answer);

  /**
   * from 個から count 個を選ぶ途中式 (n×n-1×… を count! でわる)
   */
  const chooseSteps = (from: number, count: number, note: string): SolutionStep[] => {
    if (count <= 0) return [S(`1 通り`, note)];
    if (count === 1) return [S(`${from} 通り`, note)];
    const terms: string[] = [];
    let falling = 1;
    for (let i = 0; i < count; i++) {
      terms.push(String(from - i));
      falling *= from - i;
    }
    const dTerms: string[] = [];
    for (let i = count; i >= 2; i--) dTerms.push(String(i));
    return [
      S(`${terms.join(' × ')} = ${falling}`, 'まず「誰が選ばれたか + 順番」まですべて数えます'),
      S(`${falling} ÷ ${dTerms.join(' × ')} = ${falling / factorial(count)}`, `同じ${count}人の並べかえ (${dTerms.join(' × ')} 通り) は同じ選び方なのでわります`),
    ];
  };

  switch (variant) {
    case 'include_one':
      return [
        S(undefined, `Aさんは必ず選ぶので、残りはAさん以外の${n - 1}人から選びます`),
        ...chooseSteps(n - 1, r - 1, ''),
        S(`全部で ${ans} 通り`),
      ];
    case 'exclude_one':
      return [
        S(undefined, `Aさんは選ばないので、Aさん以外の${n - 1}人から選びます`),
        ...chooseSteps(n - 1, r, ''),
        S(`全部で ${ans} 通り`),
      ];
    default:
      return chooseSteps(n, r, '1人めの選び方 × 2人めの選び方 × … の順で数えます');
  }
}

function arrangeTree(p: Problem): SolutionStep[] {
  const { n, variant } = P<{ n: number; variant: ArrangeTreeVariant }>(p);
  const ans = formatAnswer(p.answer);

  // Phase 2-A: 並べ方の種類ごとに、途中式もその種類に合ったものにする。
  switch (variant) {
    case 'all': {
      const chain = factorialChainSteps(n, '1番め、2番め、… の選び方をかけ合わせます');
      return [S(undefined, chain.steps[0]?.explanation), ...chain.steps, S(`全部で ${ans} 通り`)];
    }
    case 'fixed_first': {
      // 1文字の位置が決まっているので、残り n-1 個の並び方になる
      const chain = factorialChainSteps(n - 1, '位置が決まった1文字を残りの n-1 個の並びとして数えます');
      return [S(undefined, chain.steps[0]?.explanation), ...chain.steps, S(`全部で ${ans} 通り`)];
    }
    case 'both_ends': {
      const chain = factorialChainSteps(n - 2, '両端を埋める2文字を除いた残りの並び方を数えます');
      return [
        S(undefined, chain.steps[0]?.explanation),
        ...chain.steps,
        S(`2 × ${chain.product} = ${ans} 通り`, '両端の2文字の左右は入れかわるので2倍します'),
      ];
    }
    case 'adjacent': {
      // 隣り合う2文字を「1つのまとまり」にして数える
      const chain = factorialChainSteps(n - 1, '隣り合う2文字を1つのまとまりとして数えます');
      return [
        S(undefined, chain.steps[0]?.explanation),
        ...chain.steps,
        S(`2 × ${chain.product} = ${ans} 通り`, '2文字の左右は入れかわるので2倍します'),
      ];
    }
    case 'circle': {
      const chain = factorialChainSteps(n - 1, '回転して重なる並びは同じなので、1文字を1つの目印に固定して数えます');
      return [S(undefined, chain.steps[0]?.explanation), ...chain.steps, S(`全部で ${ans} 通り`)];
    }
    default: {
      const chain = factorialChainSteps(n, '選び方をかけ合わせます');
      return [...chain.steps, S(`全部で ${ans} 通り`)];
    }
  }
}

function combineTable(p: Problem): SolutionStep[] {
  const { n, variant } = P<{ n: number; variant: CombineTableVariant }>(p);
  const ans = formatAnswer(p.answer);
  const doubleCount = `${n} × ${n - 1}`;
  const half = `${n} × ${n - 1} ÷ 2`;

  // Phase 2-A: 試合の条件ごとに、途中式もその条件に合ったものにする。
  switch (variant) {
    case 'two_rounds':
      return [
        S(`${half} × 2 = ${ans}`, 'まず1回分の試合数を数えてから、2回分にします'),
      ];
    case 'one_team_games':
      return [
        S(`1 × ${n - 1} = ${ans} 試合`, 'ある1チームの対戦相手は残りのチームだけです'),
      ];
    case 'one_game_pairs':
      return [
        S(`${half} = ${ans} 通り`, '1試合の組合せは、表の中の1つのマスに対応します'),
      ];
    case 'round_robin':
    default:
      return [
        S(`${doubleCount} ÷ 2 = ${ans}`, 'どの2チームの組合せか数えます (同じ組合せは1回だけ)'),
      ];
  }
}

function duplicateRemoval(p: Problem): SolutionStep[] {
  const { letters, duplicateCount } = P<{ letters: string; duplicateCount?: number }>(p);
  const ans = formatAnswer(p.answer);
  const len = letters.length;
  const counts = new Map<string, number>();
  for (const ch of letters) counts.set(ch, (counts.get(ch) ?? 0) + 1);
  // 分母 ∏(各文字の重複個数!)
  let denom = 1;
  for (const c of counts.values()) {
    for (let i = 2; i <= c; i++) denom *= i;
  }
  const chain = factorialChainSteps(len, 'まず、すべてのカードを区別して並べる場合の数を数えます');
  const steps: SolutionStep[] = [...chain.steps];
  if (denom > 1) {
    steps.push(
      S(`${chain.product} ÷ ${denom} = ${ans}`, `同じ文字 (${[...counts.keys()].filter((k) => (counts.get(k) ?? 0) > 1).join(', ')}) の入れかわりは同じ並びになるのでわります`),
    );
  } else if (`${chain.product}` !== ans) {
    steps.push(S(ans));
  }
  void duplicateCount;
  return steps;
}

// ===== データ =====

function dataAverage(p: Problem): SolutionStep[] {
  const { numbers, sum, count, average } = P<{
    numbers: number[];
    sum: number;
    count: number;
    average: number;
  }>(p);
  return [
    S(`${numbers.join(' + ')} = ${sum}`, 'まず合計をもとめます'),
    S(`${sum} ÷ ${count} = ${pv(average)}`, '合計 ÷ 個数 が平均です'),
  ];
}

function dataTotalFromAverage(p: Problem): SolutionStep[] {
  const { count, average, total } = P<{ count: number; average: number; total: number }>(p);
  return [S(`${average} × ${count} = ${pv(total)}`, '合計 ＝ 平均 × 個数')];
}

function dataMaxMin(p: Problem): SolutionStep[] {
  const { numbers, max, min } = P<{ numbers: number[]; max: number; min: number }>(p);
  return [
    S(numbers.join('、'), 'ならんでいる数を見くらべます'),
    S(`最大 ${max}、最小 ${min} → ${formatAnswer(p.answer)}`),
  ];
}

function dataCompare(p: Problem): SolutionStep[] {
  const { groupA, groupB, avgA, avgB } = P<{
    groupA: number[];
    groupB: number[];
    avgA: number;
    avgB: number;
  }>(p);
  const ans = formatAnswer(p.answer);
  return [
    S(`A: (${groupA.join(' + ')}) ÷ ${groupA.length} = ${pv(avgA)}`, 'それぞれの平均をもとめます'),
    S(`B: (${groupB.join(' + ')}) ÷ ${groupB.length} = ${pv(avgB)}`),
    S(`平均を比べると ${ans} が高いです`),
  ];
}

// ===== タイプ → ビルダー対応表 =====

type StepBuilder = (problem: Problem) => SolutionStep[];

const BUILDERS: Record<string, StepBuilder> = {
  // 整数
  integer_addition: integerFourOperations,
  integer_subtraction: integerFourOperations,
  integer_multiplication: integerFourOperations,
  integer_division: integerDivision,
  integer_multi_step: multiStep,
  // Phase 2-Z5B
  estimate_product: estimateProduct,
  integer_fill_blank: fillBlank,
  integer_word_problem: wordProblem,
  // 数の性質
  divisors_finding: divisorsFinding,
  divisors_count: divisorsCount,
  multiples_finding: multiplesFinding,
  prime_judgment: primeJudgment,
  prime_range: primeRange,
  common_divisors: commonDivisors,
  common_multiples: commonMultiples,
  gcd_calculation: gcdCalculation,
  lcm_calculation: lcmCalculation,
  gcd_lcm_word: gcdLcmWord,
  period_repetition: periodRepetition,
  // 分数
  fraction_mul_integer: fractionMulInteger,
  fraction_mul_fraction: fractionMulFraction,
  fraction_div_integer: fractionDivInteger,
  fraction_div_fraction: fractionDivFraction,
  fraction_mul_mixed: fractionMulMixed,
  fraction_div_mixed: fractionDivMixed,
  fraction_reduce: fractionReduce,
  fraction_common_denominator: fractionCommonDenominator,
  fraction_mixed_convert: fractionMixedConvert,
  fraction_big_small: fractionBigSmall,
  // 小数
  decimal_mul_decimal: decimalMulDecimal,
  decimal_div_decimal: decimalDivDecimal,
  decimal_mul_integer: decimalMulInteger,
  decimal_div_integer: decimalDivInteger,
  decimal_round: decimalRound,
  // 比・比例・反比例
  ratio_simplify: ratioSimplify,
  ratio_value: ratioValue,
  ratio_equal: ratioEqual,
  ratio_quantity: ratioQuantity,
  proportional_expression: proportionalExpression,
  proportional_word: proportionalWord,
  inverse_expression: inverseExpression,
  inverse_word: inverseWord,
  // 速さ
  speed_calculation: speedCalculation,
  distance_calculation: distanceCalculation,
  time_calculation: timeCalculation,
  speed_unit_conversion: speedUnitConversion,
  speed_comparison: speedComparison,
  speed_word: speedWord,
  speed_multi_step: speedMultiStep,
  // 図形
  circle_area_radius: circleAreaRadius,
  circle_area_diameter: circleAreaDiameter,
  circle_radius_from_area: circleRadiusFromArea,
  // Phase 2-S
  circle_circumference: circleCircumference,
  trapezoid_area: trapezoidArea,
  unit_conversion_basic: unitConversionBasic,
  // Phase 2-T
  decimal_place_value: decimalPlaceValue,
  fraction_unit_intro: fractionUnitIntro,
  triangle_classify: triangleClassify,
  // Phase 2-U
  parallel_perpendicular: parallelPerpendicular,
  // Phase 2-V
  area_unit_conversion: areaUnitConversion,
  // Phase 2-Z
  rectangle_area: rectangleArea,
  // Phase 2-Z1
  triangle_area: triangleArea,
  parallelogram_area: parallelogramArea,
  // Phase 2-Y
  fraction_add_sub: fractionAddSub,
  percentage: percentage,
  volume_box: volumeBox,
  volume_cube: volumeCube,
  volume_prism: volumePrism,
  volume_cylinder: volumeCylinder,
  volume_from_height: volumeFromHeight,
  volume_unit: volumeUnit,
  symmetry_fold: symmetryFold,
  symmetry_point: symmetryPoint,
  judge_same: judgeSame,
  judge_differs: judgeDiffers,
  scale_length: scaleLength,
  angle_basic: angleBasic,
  // 式
  expression_make: expressionMake,
  expression_substitution: expressionSubstitution,
  expression_word_make: expressionWordMake,
  expression_meaning: expressionMeaning,
  expression_blank: expressionBlank,
  expression_multi_condition: expressionMultiCondition,
  // 場合の数
  arrange_simple: arrangeSimple,
  combine_simple: combineSimple,
  arrange_tree: arrangeTree,
  combine_table: combineTable,
  duplicate_removal: duplicateRemoval,
  // データ
  data_average: dataAverage,
  data_total_from_average: dataTotalFromAverage,
  data_max_min: dataMaxMin,
  data_compare: dataCompare,
};

/**
 * 問題から途中式 (SolutionStep[]) を生成する。
 * 対応していないタイプや、パラメータ不備などで組み立てられない場合は
 * 空配列を返す (UI が壊れないようにする安全フォールバック)。
 */
export function generateSolutionSteps(problem: Problem): SolutionStep[] {
  try {
    const builder = BUILDERS[problem.type];
    if (!builder) return [];
    const steps = builder(problem);
    return steps.filter((s) => s.expression !== undefined || s.explanation !== undefined);
  } catch {
    return [];
  }
}

/**
 * 問題に solutionSteps を付加した新しい Problem を返す。
 * 問題生成パイプライン (generatorRegistry) の最後で呼ばれることで、
 * 「問題・正解・途中式」が必ず同じ生成処理から作られる。
 */
export function attachSolutionSteps(problem: Problem): Problem {
  const steps = generateSolutionSteps(problem);
  if (steps.length === 0) return problem;
  return { ...problem, solutionSteps: steps };
}













