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
  const { n, count } = P<{ n: number; count: number }>(p);
  const list = Array.from({ length: count }, (_, i) => n * (i + 1));
  return [S(list.join(', '), `${n} の倍数は ${n} ずつふえていきます`)];
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
  const { a, b, count } = P<{ a: number; b: number; count: number }>(p);
  const l = lcm(a, b);
  const list = Array.from({ length: count }, (_, i) => l * (i + 1));
  return [
    S(String(l), `${a} と ${b} の最小公倍数をもとめます`),
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
  const { kmPerHour, answer } = P<{ kmPerHour: number; answer: number }>(p);
  const meters = kmPerHour * 1000;
  return [
    S(`${kmPerHour}km = ${meters}m`, '1時間に進む距離をmになおします'),
    S(`${meters} ÷ 60 = ${pv(answer)}`, '1時間は60分なので、60でわると1分あたりの速さになります'),
  ];
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

function arrangeSimple(p: Problem): SolutionStep[] {
  const { n, r } = P<{ n: number; r: number }>(p);
  const ans = formatAnswer(p.answer);
  // n × (n-1) × ... (r個) を左から順に
  const steps: SolutionStep[] = [];
  let acc = 1;
  let expr = '';
  for (let i = 0; i < r; i++) {
    const term = n - i;
    expr = expr === '' ? String(term) : `${expr} × ${term}`;
    acc *= term;
    if (i > 0 || r === 1) {
      steps.push(S(`${expr} = ${acc}`));
    }
  }
  if (steps.length === 0) steps.push(S(`${n} = ${ans}`));
  else steps[0] = { ...steps[0], explanation: '1人めの選び方 × 2人めの選び方 × … の順で数えます' };
  return [
    S(undefined, 'ならべる順番がちがうと、別のならべ方として数えます'),
    ...steps,
    S(`全部で ${ans} 通り`),
  ];
}

function combineSimple(p: Problem): SolutionStep[] {
  const { n, r } = P<{ n: number; r: number }>(p);
  const ans = formatAnswer(p.answer);
  if (r <= 1) {
    return [S(`${n}通り`, `${n}人の中から1人を選ぶだけです`)];
  }
  // 順番をつけた選び方 n×(n-1)×… を、重複ぶん r! でわる
  let falling = 1;
  const terms: string[] = [];
  for (let i = 0; i < r; i++) {
    terms.push(String(n - i));
    falling *= n - i;
  }
  const dTerms: string[] = [];
  for (let i = r; i >= 2; i--) {
    dTerms.push(String(i));
  }
  return [
    S(`${terms.join(' × ')} = ${falling}`, 'まず「誰が選ばれたか + 順番」まですべて数えます'),
    S(`${falling} ÷ ${dTerms.join(' × ')} = ${ans}`, `同じメンバーの並べかえ (${dTerms.join(' × ')} 通り) は同じ選び方なのでわります`),
  ];
}

function arrangeTree(p: Problem): SolutionStep[] {
  const { n } = P<{ n: number }>(p);
  const chain = factorialChainSteps(n, '1枚め、2枚め、… の選び方をかけ合わせます');
  return [
    S(undefined, chain.steps[0]?.explanation),
    ...chain.steps,
    S(`全部で ${formatAnswer(p.answer)} 通り`),
  ];
}

function combineTable(p: Problem): SolutionStep[] {
  const { n } = P<{ n: number }>(p);
  const ans = formatAnswer(p.answer);
  return [
    S(`${n} × ${n - 1} ÷ 2 = ${ans}`, 'どの2チームの組合せか数えます (同じ組合わせは1回だけ)'),
  ];
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
  volume_box: volumeBox,
  volume_cube: volumeCube,
  volume_prism: volumePrism,
  volume_cylinder: volumeCylinder,
  volume_from_height: volumeFromHeight,
  volume_unit: volumeUnit,
  symmetry_fold: symmetryFold,
  symmetry_point: symmetryPoint,
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














