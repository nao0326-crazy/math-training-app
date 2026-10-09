/**
 * 整数の複数項計算・穴埋め問題ジェネレータ
 */

import type {
  DifficultyLevel,
  GenerationConfig,
  Problem,
  ProblemGenerator,
  ValidationResult,
} from '../../../types/problem';
import { createRandom, generateProblemId } from '../../../utils/random';
import { validateProblem } from '../../../engine/validator/validator';
import { isReasonableAnswer } from '../../../utils/answer';
import { createMultiStepDifficulty, createEstimateDifficulty } from './helpers';
import type { SeededRandom } from '../../../utils/random';

/**
 * 複数項の計算問題ジェネレータ
 * 例: 12 + 5 × 3 = ?
 * 計算の順序 (乗除優先) を考慮する
 */
export class MultiStepGenerator implements ProblemGenerator {
  readonly type = 'integer_multi_step';
  readonly category = 'integer' as const;
  readonly description = '整数の複数項の計算';

  generate(config?: GenerationConfig): Problem {
    const rng = createRandom(config?.seed);
    const level = (config?.difficulty ?? rng.int(2, 4)) as DifficultyLevel;

    // 割り切れない・負になる場合は再試行
    for (let attempt = 0; attempt < 100; attempt++) {
      const problem = this.tryGenerate(rng, level);
      if (problem) {
        return problem;
      }
    }
    throw new Error('複数項の計算問題を生成できませんでした');
  }

  /**
   * 問題生成を試みる。条件を満たさない場合は null を返す
   */
  private tryGenerate(
    rng: ReturnType<typeof createRandom>,
    level: DifficultyLevel,
  ): Problem | null {
    // 項の数 (3〜4)
    const termCount = level >= 4 ? rng.int(3, 4) : 3;

    // 数値の範囲
    const maxNum = level <= 2 ? 9 : level === 3 ? 20 : 50;

    // 演算子を生成 (乗除は優先される)
    const operators: string[] = [];
    for (let i = 0; i < termCount - 1; i++) {
      const pool = level <= 2 ? ['+', '-'] : ['+', '-', '×', '÷'];
      operators.push(rng.pick(pool));
    }

    // 数値を生成
    const numbers: number[] = [];
    for (let i = 0; i < termCount; i++) {
      numbers.push(rng.int(1, maxNum));
    }

    // 減算で負にならないように調整する
    // 左から順に見て、引き算の直後に続く数値が合計以下になるようにする
    for (let i = 0; i < operators.length; i++) {
      if (operators[i] === '-') {
        // 現在の左側の合計を超えないように右側の数を小さくする
        let sumLeft = numbers[0];
        for (let j = 0; j < i; j++) {
          sumLeft += numbers[j + 1];
        }
        if (numbers[i + 1] > sumLeft) {
          numbers[i + 1] = Math.max(1, sumLeft);
        }
      }
    }

    // 割り算が割り切れるように数値を調整する
    if (!ensureDivisibility(numbers, operators)) {
      return null;
    }

    // 計算を実行 (乗除優先)
    let result: number;
    try {
      result = evaluateExpression(numbers, operators);
    } catch {
      // 割り切れない場合は再試行
      return null;
    }

    // 答えが負にならないようにする
    if (result < 0) {
      return null;
    }

    // 答え0は練習として成立しない (「全部ひいて残りが0」だけになる) ので再試行する。
    // 0 を学習対象の別の問題タイプが必要な場合は、そちらで明示的に扱う。
    if (result === 0) {
      return null;
    }

    // 検証基準 (isReasonableAnswer) と一致させるため、極端に大きな答えは再試行する
    // 例: レベル4の「47 × 44 × 44 × 25」のような全乗算では答えが100万を超え、
    // validateProblem の「解答が不自然な値です」で不合格になるため生成段階ではじく
    if (!isReasonableAnswer({ kind: 'integer', value: result })) {
      return null;
    }

    // この型の練習対象は「乗除優先で計算の順序を考えること」であり、
    // 答えが5桁以上になると暗算の範囲を超えて順序の学習が成立しなくなる。
    // (例: 47 × 46 × 45 + 44 = 97194 は計算順序が正しいかどうかが検証できない)
    if (Math.abs(result) > 10000) {
      return null;
    }

    // 式を組み立てる
    const expression = buildExpression(numbers, operators);

    return {
      id: generateProblemId(),
      category: this.category,
      type: this.type,
      difficulty: createMultiStepDifficulty(termCount - 1, maxNum, 1, 1, level),
      question: `${expression} はいくつになりますか`,
      answer: { kind: 'integer', value: result },
      explanation: `${expression}＝${result} です。かけ算・わり算を先に計算します。`,
      parameters: {
        numbers,
        operators,
        expression,
        answer: result,
        difficultyLevel: level,
        termCount,
      },
    };
  }

  validate(problem: Problem): ValidationResult {
    return validateProblem(problem);
  }
}

/**
 * 穴埋め問題ジェネレータ
 * 例: 12 + □ = 20 の □ を求める
 */
export class FillBlankGenerator implements ProblemGenerator {
  readonly type = 'integer_fill_blank';
  readonly category = 'integer' as const;
  readonly description = '整数の穴埋め問題';

  generate(config?: GenerationConfig): Problem {
    const rng = createRandom(config?.seed);
    const level = (config?.difficulty ?? rng.int(1, 3)) as DifficultyLevel;

    const maxNum = level <= 1 ? 9 : level === 2 ? 20 : 50;
    const op = rng.pick(['+', '-', '×', '÷'] as const);

    let a: number;
    let answer: number;
    let question: string;
    let explanation: string;

    switch (op) {
      case '+': {
        // a + □ = c の形
        a = rng.int(1, maxNum);
        answer = rng.int(1, maxNum);
        const c = a + answer;
        question = `${a}＋□＝${c} の □ にあてはまる数はいくつですか`;
        explanation = `${c}−${a}＝${answer} です。`;
        break;
      }
      case '-': {
        // a - □ = c の形
        a = rng.int(2, maxNum);
        answer = rng.int(1, a - 1);
        const c = a - answer;
        question = `${a}−□＝${c} の □ にあてはまる数はいくつですか`;
        explanation = `${a}−${c}＝${answer} です。`;
        break;
      }
      case '×': {
        // a × □ = c の形
        a = rng.int(2, maxNum);
        answer = rng.int(2, maxNum);
        const c = a * answer;
        question = `${a}×□＝${c} の □ にあてはまる数はいくつですか`;
        explanation = `${c}÷${a}＝${answer} です。`;
        break;
      }
      case '÷': {
        // a ÷ □ = c の形 (割り切れる)
        answer = rng.int(2, maxNum);
        const c = rng.int(2, maxNum);
        a = answer * c;
        question = `${a}÷□＝${c} の □ にあてはまる数はいくつですか`;
        explanation = `${a}÷${c}＝${answer} です。`;
        break;
      }
    }

    return {
      id: generateProblemId(),
      category: this.category,
      type: this.type,
      difficulty: createMultiStepDifficulty(1, maxNum, 2, 1, level),
      question,
      answer: { kind: 'integer', value: answer },
      explanation,
      parameters: {
        a,
        operator: op,
        answer,
        difficultyLevel: level,
        blankPosition: 'second',
      },
    };
  }

  validate(problem: Problem): ValidationResult {
    return validateProblem(problem);
  }
}

/**
 * 式を評価する (乗除優先)
 */
function evaluateExpression(numbers: number[], operators: string[]): number {
  // 乗除を先に計算
  const nums = [...numbers];
  const ops = [...operators];

  for (let i = 0; i < ops.length; i++) {
    if (ops[i] === '×' || ops[i] === '÷') {
      const left = nums[i];
      const right = nums[i + 1];
      const result = ops[i] === '×' ? left * right : left / right;
      if (!Number.isInteger(result)) {
        // 割り切れない場合は再生成
        throw new Error('Non-integer result');
      }
      nums.splice(i, 2, result);
      ops.splice(i, 1);
      i--;
    }
  }

  // 加減を計算
  let result = nums[0];
  for (let i = 0; i < ops.length; i++) {
    if (ops[i] === '+') {
      result += nums[i + 1];
    } else {
      result -= nums[i + 1];
    }
  }
  return result;
}

/**
 * 式を組み立てる
 */
function buildExpression(numbers: number[], operators: string[]): string {
  let expr = String(numbers[0]);
  for (let i = 0; i < operators.length; i++) {
    expr += ` ${operators[i]} ${numbers[i + 1]}`;
  }
  return expr;
}

/**
 * 割り算が割り切れるように数値を調整する
 * a ÷ b の形式のとき、a を b の倍数にする
 */
function ensureDivisibility(numbers: number[], operators: string[]): boolean {
  for (let i = 0; i < operators.length; i++) {
    if (operators[i] === '÷') {
      const divisor = numbers[i + 1];
      const dividend = numbers[i];
      if (dividend % divisor !== 0) {
        // 被除数を除数の倍数に調整する (最小でも除数倍)
        numbers[i] = divisor * Math.max(1, Math.floor(dividend / divisor));
      }
    }
  }
  // 除数が0でないことを確認
  return numbers.every((n) => n > 0);
}

// ===== 積の見積もり (第4学年「四則計算の結果の見積り」) =====

/** 積の見積もりの variant */
type EstimateProductVariant =
  | 'estimate_to_tens'
  | 'estimate_one_exact'
  | 'estimate_to_hundreds'
  | 'estimate_mixed_places'
  | 'estimate_shopping';

/**
 * variant ごとの対応最低レベル。
 *
 * lv1 は「十の位以上に丸めると概算値が必ず10以上になり、numberComplexity が2に
 * なる」ため、この難易度モデルとは構造的に両立しない。未対応として扱う。
 */
const ESTIMATE_MIN_LEVEL: Record<EstimateProductVariant, DifficultyLevel> = {
  estimate_to_tens: 2,
  estimate_one_exact: 2,
  estimate_to_hundreds: 3,
  estimate_mixed_places: 3,
  estimate_shopping: 5,
};

/** variant ごとの思考の負荷 (丸める手順数・判断の要否) */
const ESTIMATE_REASONING: Record<EstimateProductVariant, DifficultyLevel> = {
  estimate_to_tens: 2,
  estimate_one_exact: 2,
  estimate_to_hundreds: 3,
  estimate_mixed_places: 4,
  estimate_shopping: 4,
};

/** 丸める位の読み方 (問題文と解説の両方で明示する) */
const PLACE_LABEL: Record<number, string> = {
  10: '十の位',
  100: '百の位',
};

/** n を place の倍数に四捨五入する (概算に使う) */
function roundToPlace(n: number, place: number): number {
  return Math.round(n / place) * place;
}

/** 丸め方の説明文 (数字の単位も含む。registry のパラメータ整合規則を満たすため) */
function placeNote(place: number): string {
  // place = 1 は「丸めない」ことを表す
  if (place === 1) return 'そのまま使う（1の倍数）';
  return PLACE_LABEL[place] + '（' + place + 'の倍数）';
}

/**
 * 積の見積もり
 *
 * 正確な積を求めるのではなく、計算前に数を扱いやすい概数へ置き換え、およその大きさを
 * 把握する練習。第4学年「四則計算の結果の見積り」に対応する。
 *
 * 見積もりには妥当な方法が複数あるため、**どの位に丸めるかを必ず問題文で明示する**。
 * これにより答えが一意に定まり、複数の答えを許容する設計が不要になる。
 * 答えは概算値そのものを整数で返し、解説で正確な積とは異なることを明記する。
 *
 * 対応レベルは lv2〜lv5。lv1 は精度を1桁以上落とすedralと numberComplexity が
 * 2 になり lv1 の難易度契約を満たせないため、未対応として throw する。
 */
export class EstimateProductGenerator implements ProblemGenerator {
  readonly type = 'estimate_product';
  readonly category = 'integer' as const;
  readonly description = '積の見積もり';

  generate(config?: GenerationConfig): Problem {
    const rng = createRandom(config?.seed);
    const lv = config?.difficulty ?? (3 as DifficultyLevel);
    const usable = (Object.keys(ESTIMATE_MIN_LEVEL) as EstimateProductVariant[])
      .filter((v) => ESTIMATE_MIN_LEVEL[v] <= lv);
    // 未対応レベル (lv1) では、別のレベルの問題を返さず明示的に失敗する。
    // selector 側の難易度フィルタはこの例外を catch して候補から除外するため安全。
    if (usable.length === 0) {
      throw new Error('積の見積もりは lv2 以上の難易度でのみ生成できます: ' + lv);
    }
    for (let attempt = 0; attempt < 120; attempt++) {
      const variant = rng.pick(usable);
      const built = buildEstimateProduct(variant, rng, lv);
      if (built) return built;
    }
    throw new Error('積の見積もりの問題を生成できませんでした');
  }

  validate(problem: Problem): ValidationResult {
    const errors: string[] = [];
    const q = problem.parameters as {
      variant: EstimateProductVariant;
      a: number;
      b: number;
      placeA: number;
      placeB: number;
      roundedA: number;
      roundedB: number;
      estimate: number;
      exactProduct: number;
      difficultyLevel: DifficultyLevel;
    };
    const { a, b, placeA, placeB, roundedA, roundedB, estimate, exactProduct } = q;

    if (!(a > 0) || !(b > 0)) errors.push('元の数が正ではありません');
    if (!(placeA > 0) || !(placeB > 0)) errors.push('丸める位が不正です');
    // 独立に丸め直し・掛け直しをする
    if (roundToPlace(a, placeA) !== roundedA) errors.push('1つめの丸め方が不正です');
    if (roundToPlace(b, placeB) !== roundedB) errors.push('2つめの丸め方が不正です');
    if (roundedA * roundedB !== estimate) errors.push('概算値が概数どうしの積と一致しません');
    if (a * b !== exactProduct) errors.push('正確な積が誤っています');
    // 見積もりと正確な積を混同していないこと
    if (estimate === exactProduct) errors.push('概算値が正確な積と同じです (丸めていない)');
    // 概数が 0 にならないこと (0 だと見積もりの意味がなくなる)
    if (!(roundedA > 0) || !(roundedB > 0)) errors.push('概算した数が 0 になっています');
    // 未対応レベル (lv1) の問題は作られないこと
    if (q.difficultyLevel < 2) errors.push('未対応の難易度レベルです: ' + q.difficultyLevel);
    if (!Number.isInteger(estimate)) errors.push('概算値が整数ではありません');
    if (problem.answer.kind !== 'integer' || problem.answer.value !== estimate) {
      errors.push('problem.answer が parameters と一致しません');
    }
    return { valid: errors.length === 0, errors };
  }
}

/** 積の見積もりの1問を組み立てる (条件を満たさない場合は null を返して再試行させる) */
function buildEstimateProduct(
  variant: EstimateProductVariant,
  rng: SeededRandom,
  lv: DifficultyLevel,
): Problem | null {
  let a: number;
  let b: number;
  let placeA = 10;
  let placeB = 10;
  let scene = '';
  let question: string;

  if (variant === 'estimate_to_tens') {
    // 2桁の数。10の倍数を除いて必ず丸まるようにする。
    a = rng.int(15, 49);
    b = rng.int(15, 49);
    scene = '';
    question = a + ' × ' + b + ' の積は、およそいくつですか。'
      + '2つの数をどちらも' + placeNote(10) + 'に四捨五入してから掛け合わせてください。';
  } else if (variant === 'estimate_one_exact') {
    // 一方の数はそのまま使い、もう一方だけ扱いやすい数に丸める
    a = rng.int(11, 49);
    b = rng.int(15, 49);
    placeA = 1;
    placeB = 10;
    scene = '';
    question = a + ' × ' + b + ' の積は、およそいくつですか。'
      + a + ' はそのまま使い、' + b + ' だけを' + placeNote(10)
      + 'に四捨五入してから掛け合わせてください。';
  } else if (variant === 'estimate_to_hundreds') {
    a = rng.int(150, 449);
    b = rng.int(150, 449);
    placeA = 100;
    placeB = 100;
    scene = '';
    question = a + ' × ' + b + ' の積は、およそいくつですか。'
      + '2つの数をどちらも' + placeNote(100) + 'に四捨五入してから掛け合わせてください。';
  } else if (variant === 'estimate_mixed_places') {
    // 数が大きい方は百の位、小さい方は十の位という「数に応じた丸め方の選択」
    a = rng.int(15, 49);
    b = rng.int(150, 449);
    placeA = 10;
    placeB = 100;
    scene = '';
    question = a + ' × ' + b + ' の積は、およそいくつですか。'
      + a + ' を' + placeNote(10) + 'に、'
      + b + ' を' + placeNote(100)
      + 'に四捨五入してから掛け合わせてください。';
  } else {
    // 買い物の文脈 (見積りの usefulness を数量の場面で使う)
    const price = rng.int(150, 449);
    const qty = rng.int(11, 49);
    a = price;
    b = qty;
    placeA = 100;
    placeB = 10;
    scene = '1個 ' + price + ' 円のノートを ' + qty + ' 冊買うとき、およそいくらになりますか。';
    question = scene
      + '1個の値段を' + placeNote(100) + 'に、個数を' + placeNote(10)
      + 'に四捨五入してから掛け合わせてください。';
  }

  const roundedA = roundToPlace(a, placeA);
  const roundedB = roundToPlace(b, placeB);
  if (!(roundedA > 0) || !(roundedB > 0)) return null;
  const estimate = roundedA * roundedB;
  const exactProduct = a * b;
  // 概算値と正確な積が同じなら丸める意味がないので作り直す
  if (estimate === exactProduct) return null;
  if (!Number.isInteger(estimate)) return null;
  // 概算値は 1,000,000 以下に収める (アプリ全体の品質規則)
  if (estimate > 1000000) return null;

  const reason = placeA === 1
    ? '大きい数を掛け合わせるときは、扱える数にそろえると計算しやすくなるためです。'
    : '大きな数をそのまま掛けるのではなく、扱いやすい概数にそろえて、およその大きさを確かめます。';
  const explanation =
    '求めるのは正確な積ではなく、およその大きさです。' + reason
    + a + ' を' + placeNote(placeA) + 'に四捨五入すると ' + roundedA + '、'
    + b + ' を' + placeNote(placeB) + 'に四捨五入すると ' + roundedB + ' になります。'
    + 'その2つを掛け合わせると、'
    + roundedA + ' × ' + roundedB + ' = ' + estimate + ' となります。'
    + 'したがって、およその答えは ' + estimate + ' です。'
    + 'これは概算なので、正確な積 ' + exactProduct + ' とは一致しません。';

  return {
    id: generateProblemId(),
    category: 'integer' as const,
    type: 'estimate_product',
    difficulty: createEstimateDifficulty({
      level: lv,
      // 最も粗い丸め位数で評価する (10 -> 2, 100 -> 3)
      roundPlace: Math.max(placeA, placeB),
      reasoningLevel: ESTIMATE_REASONING[variant],
    }),
    question,
    answer: { kind: 'integer', value: estimate },
    explanation,
    parameters: {
      variant,
      a,
      b,
      placeA,
      placeB,
      roundedA,
      roundedB,
      estimate,
      exactProduct,
      difficultyLevel: lv,
    },
  };
}

// ESTIMATE_MARKER
