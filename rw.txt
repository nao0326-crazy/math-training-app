/**
 * 現実連動教材: スーパーでの買い物
 *
 * 写真 (public/images/supermarket-shelf.svg) の値札から価格を読み取り、
 * 小学算数の既習内容 (整数の加法・減法・乗法・除法) で課題を解く教材。
 *
 * 設計方針:
 * - 価格は写真に写っている固定値。問題文には価格を書かず、写真 (画像) から
 *   読み取らせる。画像が表示できない環境では altText にも価格を含めるため解答できる。
 * - 正解は一意に定まるものだけを出す (予算内の組み合わせ探索など複数解の問題は作らない)。
 * - 割り算 (予算内で何個買えるか / 割り勘) は割り切れる定義済みケースから選び一意解を保証する。
 * - 価格の数値は解説に必ず含める (parameters と解説の整合性を保つ)。
 */

import type {
  DifficultyLevel,
  GenerationConfig,
  ImageSpec,
  Problem,
  ProblemGenerator,
  ValidationResult,
} from '../../types/problem';
import { createRandom, generateProblemId } from '../../utils/random';
import { validateProblem } from '../../engine/validator/validator';
import {
  clampLevel,
  createDifficulty,
  numberSizeToComplexity,
} from '../../engine/difficulty/difficulty';

/** 棚に並ぶ商品 (価格は写真の値札と完全に一致させる) */
interface Product {
  /** 商品名 */
  name: string;
  /** 数量を数える単位 (例: パック) */
  unit: string;
  /** 値札の価格 (円) */
  price: number;
}

export const SUPERMARKET_PRODUCTS: readonly Product[] = [
  { name: 'たまご', unit: 'パック', price: 120 },
  { name: 'ぎゅうにゅう', unit: '本', price: 180 },
  { name: '食パン', unit: '袋', price: 150 },
  { name: 'りんご', unit: 'ふさ', price: 260 },
  { name: 'オレンジジュース', unit: '本', price: 200 },
  { name: 'クッキー', unit: '箱', price: 90 },
];

/** 写真の参照先 (public/ からのルート相対パス。配布・PWA キャッシュ対応) */
export const SUPERMARKET_IMAGE_SRC = '/images/supermarket-shelf.svg';

/** 写真の表示仕様を組み立てる (全問題で共通) */
export function buildSupermarketImage(): ImageSpec {
  return {
    src: SUPERMARKET_IMAGE_SRC,
    // 画像が表示できない環境でも解答できるよう、全商品の価格を代替テキストに含める。
    altText:
      'スーパーの棚の写真。値札は、'
      + SUPERMARKET_PRODUCTS.map((p) => `${p.name}1${p.unit}${p.price}円`).join('、')
      + '。',
    caption: 'スーパーの棚 (値札が見えます)',
    credit: '本プロジェクト作成のオリジナル画像 (SVG)',
    // 写真から読み取る情報 (問題文には書かない)。
    photoFacts: SUPERMARKET_PRODUCTS.map((p) => `${p.name}は1${p.unit}${p.price}円`),
  };
}

/** 商品を「名前1単位」で説明する (例: たまご1パック) */
function item(p: Product): string {
  return `${p.name}1${p.unit}`;
}

/** 難易度を作る。calculationComplexity を主成分とし、他は level を超えないよう丸める。 */
function shoppingDifficulty(
  level: DifficultyLevel,
  maxNumber: number,
  reasoning: number = 1,
  reading: number = 2,
) {
  return createDifficulty({
    calculationComplexity: clampLevel(level),
    numberComplexity: clampLevel(Math.min(numberSizeToComplexity(maxNumber), level)),
    reasoningComplexity: clampLevel(Math.min(reasoning, level)),
    readingComplexity: clampLevel(Math.min(reading, level)),
  });
}

/** 割り算 (予算内で何個買えるか) の、割り切れる定義済みケース。 */
const MAX_COUNT_CASES: readonly { productIndex: number; budget: number }[] = [
  { productIndex: 0, budget: 480 }, // たまご 120円 → 4個
  { productIndex: 0, budget: 360 }, // → 3個
  { productIndex: 1, budget: 540 }, // ぎゅうにゅう 180円 → 3個
  { productIndex: 1, budget: 360 }, // → 2個
  { productIndex: 2, budget: 450 }, // 食パン 150円 → 3個
  { productIndex: 2, budget: 600 }, // → 4個
  { productIndex: 3, budget: 520 }, // りんご 260円 → 2個
  { productIndex: 4, budget: 600 }, // ジュース 200円 → 3個
  { productIndex: 4, budget: 400 }, // → 2個
  { productIndex: 5, budget: 360 }, // クッキー 90円 → 4個
  { productIndex: 5, budget: 450 }, // → 5個
];

/** 割り勘 (合計を何人かで等分) の、割り切れる定義済みケース。 */
const SPLIT_BILL_CASES: readonly { a: number; b: number; people: number }[] = [
  { a: 0, b: 1, people: 3 }, // 120+180=300 → 1人100円
  { a: 0, b: 2, people: 3 }, // 120+150=270 → 1人90円
  { a: 0, b: 5, people: 3 }, // 120+90=210 → 1人70円
  { a: 1, b: 2, people: 3 }, // 180+150=330 → 1人110円
  { a: 1, b: 5, people: 3 }, // 180+90=270 → 1人90円
  { a: 2, b: 5, people: 4 }, // 150+90=240 → 1人60円
  { a: 0, b: 4, people: 2 }, // 120+200=320 → 1人160円
  { a: 3, b: 5, people: 2 }, // 260+90=350 → 1人175円
  { a: 0, b: 1, people: 2 }, // 120+180=300 → 1人150円
  { a: 2, b: 4, people: 2 }, // 150+200=350 → 1人175円
];

/** 問題のバリエーション */
type ShoppingVariant =
  | 'two_sum' // 2品の合計 (加算)
  | 'three_sum' // 3品の合計 (加算)
  | 'same_item_multiple' // 同じ商品を複数個 (乗算)
  | 'change' // 1000円で買ったおつり (減法)
  | 'multi_and_sum' // 商品A×個数 + 商品B (乗算+加算)
  | 'max_count' // 予算内で何個買えるか (除法)
  | 'split_bill'; // 何人かで割り勘 (除法)

/** 難易度ごとに出すバリエーション */
const VARIANTS_BY_LEVEL: Record<DifficultyLevel, ShoppingVariant[]> = {
  1: ['two_sum'],
  2: ['two_sum', 'same_item_multiple'],
  3: ['three_sum', 'same_item_multiple', 'change'],
  4: ['three_sum', 'change', 'multi_and_sum', 'max_count', 'split_bill'],
  5: ['multi_and_sum', 'max_count', 'split_bill', 'change'],
};

/** 問題生成の途中結果 */
interface BuiltProblem {
  question: string;
  answer: Problem['answer'];
  explanation: string;
  difficulty: Problem['difficulty'];
  parameters: Record<string, unknown>;
}

/**
 * スーパーでの買い物ジェネレータ (現実連動・写真から価格を読み取る)
 */
export class SupermarketShoppingGenerator implements ProblemGenerator {
  readonly type = 'realworld_shopping';
  readonly category = 'realWorld' as const;
  readonly description = 'スーパーの買い物 (写真の値札を読み取って計算する)';

  generate(config?: GenerationConfig): Problem {
    const rng = createRandom(config?.seed);
    const level = (config?.difficulty ?? rng.int(1, 5)) as DifficultyLevel;
    const candidates = VARIANTS_BY_LEVEL[level] ?? VARIANTS_BY_LEVEL[2];
    const variant = rng.pick(candidates);

    const built = this.buildVariant(variant, rng, level);
    // 途中式 (solutionSteps) は設定しない。出題パイプライン (attachSolutionSteps) が
    // parameters から組み立てる (全ジェネレータ共通の設計に合わせて一元化)。
    return {
      id: generateProblemId(),
      category: this.category,
      type: this.type,
      difficulty: built.difficulty,
      question: built.question,
      answer: built.answer,
      explanation: built.explanation,
      parameters: { ...built.parameters, difficultyLevel: level },
      image: buildSupermarketImage(),
    };
  }

  validate(problem: Problem): ValidationResult {
    return validateProblem(problem);
  }

  private buildVariant(
    variant: ShoppingVariant,
    rng: ReturnType<typeof createRandom>,
    level: DifficultyLevel,
  ): BuiltProblem {
    switch (variant) {
      case 'two_sum':
        return this.twoSum(rng, level);
      case 'three_sum':
        return this.threeSum(rng, level);
      case 'same_item_multiple':
        return this.sameItemMultiple(rng, level);
      case 'change':
        return this.change(rng, level);
      case 'multi_and_sum':
        return this.multiAndSum(rng, level);
      case 'max_count':
        return this.maxCount(rng, level);
      case 'split_bill':
        return this.splitBill(rng, level);
    }
  }

  /** 2品の合計 (加算) */
  private twoSum(rng: ReturnType<typeof createRandom>, level: DifficultyLevel): BuiltProblem {
    const [ia, ib] = rng.pickMultiple(
      SUPERMARKET_PRODUCTS.map((_, i) => i),
      2,
    );
    const pa = SUPERMARKET_PRODUCTS[ia];
    const pb = SUPERMARKET_PRODUCTS[ib];
    const total = pa.price + pb.price;
    return {
      question: `写真の値札を見て、${item(pa)}と${item(pb)}を買います。代金は合計いくらですか。`,
      answer: { kind: 'integer', value: total },
      explanation:
        `${pa.name}は1${pa.unit}${pa.price}円、${pb.name}は1${pb.unit}${pb.price}円です。`
        + `${pa.price}＋${pb.price}＝${total}より、代金は合計${total}円です。`,
      difficulty: shoppingDifficulty(level, total),
      parameters: {
        variant: 'two_sum',
        productA: pa.name,
        productB: pb.name,
        priceA: pa.price,
        priceB: pb.price,
        answer: total,
      },
    };
  }

  /** 3品の合計 (加算) */
  private threeSum(rng: ReturnType<typeof createRandom>, level: DifficultyLevel): BuiltProblem {
    const idx = rng.pickMultiple(
      SUPERMARKET_PRODUCTS.map((_, i) => i),
      3,
    );
    const [pa, pb, pc] = idx.map((i) => SUPERMARKET_PRODUCTS[i]);
    const total = pa.price + pb.price + pc.price;
    return {
      question:
        `写真の値札を見て、${item(pa)}と${item(pb)}と${item(pc)}を買います。代金は合計いくらですか。`,
      answer: { kind: 'integer', value: total },
      explanation:
        `${pa.name}は${pa.price}円、${pb.name}は${pb.price}円、${pc.name}は${pc.price}円です。`
        + `${pa.price}＋${pb.price}＋${pc.price}＝${total}より、代金は合計${total}円です。`,
      difficulty: shoppingDifficulty(level, total, 1, 3),
      parameters: {
        variant: 'three_sum',
        productA: pa.name,
        productB: pb.name,
        productC: pc.name,
        priceA: pa.price,
        priceB: pb.price,
        priceC: pc.price,
        answer: total,
      },
    };
  }

  /** 同じ商品を複数個 (乗算) */
  private sameItemMultiple(
    rng: ReturnType<typeof createRandom>,
    level: DifficultyLevel,
  ): BuiltProblem {
    const ia = rng.int(0, SUPERMARKET_PRODUCTS.length - 1);
    const p = SUPERMARKET_PRODUCTS[ia];
    const maxCount = level >= 3 ? 3 : 2;
    const count = rng.int(2, maxCount);
    const total = p.price * count;
    return {
      question: `写真の値札を見て、${p.name}を${count}${p.unit}買います。代金はいくらですか。`,
      answer: { kind: 'integer', value: total },
      explanation:
        `${p.name}は1${p.unit}${p.price}円です。${p.price}×${count}＝${total}より、代金は${total}円です。`,
      difficulty: shoppingDifficulty(level, total),
      parameters: {
        variant: 'same_item_multiple',
        product: p.name,
        count,
        price: p.price,
        answer: total,
      },
    };
  }

  /** 1000円で買ったおつり (減法) */
  private change(rng: ReturnType<typeof createRandom>, level: DifficultyLevel): BuiltProblem {
    const [ia, ib] = rng.pickMultiple(
      SUPERMARKET_PRODUCTS.map((_, i) => i),
      2,
    );
    const pa = SUPERMARKET_PRODUCTS[ia];
    const pb = SUPERMARKET_PRODUCTS[ib];
    const budget = 1000;
    const spent = pa.price + pb.price;
    const change = budget - spent;
    return {
      question: `1000円札で、${item(pa)}と${item(pb)}を買います。おつりはいくらですか。`,
      answer: { kind: 'integer', value: change },
      explanation:
        `${pa.name}は${pa.price}円、${pb.name}は${pb.price}円なので、`
        + `${pa.price}＋${pb.price}＝${spent}円です。`
        + `1000−${spent}＝${change}より、おつりは${change}円です。`,
      difficulty: shoppingDifficulty(level, change),
      parameters: {
        variant: 'change',
        productA: pa.name,
        productB: pb.name,
        budget,
        priceA: pa.price,
        priceB: pb.price,
        answer: change,
      },
    };
  }

  /** 商品A×個数 + 商品B (乗算+加算) */
  private multiAndSum(rng: ReturnType<typeof createRandom>, level: DifficultyLevel): BuiltProblem {
    const [ia, ib] = rng.pickMultiple(
      SUPERMARKET_PRODUCTS.map((_, i) => i),
      2,
    );
    const pa = SUPERMARKET_PRODUCTS[ia];
    const pb = SUPERMARKET_PRODUCTS[ib];
    const maxCount = level >= 5 ? 3 : 2;
    const count = rng.int(2, maxCount);
    const sub = pa.price * count;
    const total = sub + pb.price;
    return {
      question:
        `写真の値札を見て、${pa.name}を${count}${pa.unit}と、`
        + `${item(pb)}を買います。代金は合計いくらですか。`,
      answer: { kind: 'integer', value: total },
      explanation:
        `${pa.name}は1${pa.unit}${pa.price}円で、${count}${pa.unit}だと`
        + `${pa.price}×${count}＝${sub}円です。${pb.name}は1${pb.unit}${pb.price}円なので、`
        + `${sub}＋${pb.price}＝${total}より、代金は合計${total}円です。`,
      difficulty: shoppingDifficulty(level, total, 2, 3),
      parameters: {
        variant: 'multi_and_sum',
        productA: pa.name,
        productB: pb.name,
        count,
        priceA: pa.price,
        priceB: pb.price,
        answer: total,
      },
    };
  }

  /** 予算内で何個買えるか (除法・割り切れる定義済みケース) */
  private maxCount(rng: ReturnType<typeof createRandom>, level: DifficultyLevel): BuiltProblem {
    const c = rng.pick(MAX_COUNT_CASES);
    const p = SUPERMARKET_PRODUCTS[c.productIndex];
    const count = c.budget / p.price;
    return {
      question: `${c.budget}円を持っています。写真の値札を見て、${p.name}は何${p.unit}買えますか。`,
      answer: { kind: 'integer', value: count },
      explanation:
        `${p.name}は1${p.unit}${p.price}円です。${c.budget}÷${p.price}＝${count}より、`
        + `${count}${p.unit}買えます。`,
      difficulty: shoppingDifficulty(level, c.budget, 3, 2),
      parameters: {
        variant: 'max_count',
        product: p.name,
        budget: c.budget,
        price: p.price,
        answer: count,
      },
    };
  }

  /** 何人かで割り勘 (除法・割り切れる定義済みケース) */
  private splitBill(rng: ReturnType<typeof createRandom>, level: DifficultyLevel): BuiltProblem {
    const c = rng.pick(SPLIT_BILL_CASES);
    const pa = SUPERMARKET_PRODUCTS[c.a];
    const pb = SUPERMARKET_PRODUCTS[c.b];
    const total = pa.price + pb.price;
    const per = total / c.people;
    return {
      question:
        `${item(pa)}と${item(pb)}をみんなで買いました。写真の値札を見て、代金を`
        + `${c.people}人で同じずつ分けると、1人分はいくらですか。`,
      answer: { kind: 'integer', value: per },
      explanation:
        `${pa.name}は${pa.price}円、${pb.name}は${pb.price}円なので、`
        + `${pa.price}＋${pb.price}＝${total}円です。`
        + `${total}÷${c.people}＝${per}より、1人分は${per}円です。`,
      difficulty: shoppingDifficulty(level, total, 3, 3),
      parameters: {
        variant: 'split_bill',
        productA: pa.name,
        productB: pb.name,
        people: c.people,
        priceA: pa.price,
        priceB: pb.price,
        answer: per,
      },
    };
  }
}

// ===== 現実連動: 卵の数を読み取って計算する (realworld_eggs) =====
// 写真 (public/images/eggs-brown-white.jpg) には茶色い卵1個と白い卵1個、合わせて2個が
// 写っている。この「2個 (茶色1・白1)」を写真から読み取らせ、整数の四則演算で課題を解く。
//
// 設計方針:
// - 写真から読み取る情報は「卵は合わせて2個 (茶色1個・白1個)」の1点に限定する。
//   画像を2値化した連結成分解析で客観的に確認済み (左=茶色1個・右=白1個、他に卵はない)。
// - カートンの卵の数・卵の値段・買う組数など、写真からは読み取れない数値は
//   問題文で「問題で設定した数値」であることを明示し、写真の情報と区別する。
// - 正解は一意に定まるものだけを出す。割り算は割り切れる定義済みケースから選ぶ。

/** 写真から客観的に確認した、読み取る情報 (全問題で共通の固定値) */
export const EGGS_PHOTO = {
  /** 卵の合計個数 */
  total: 2,
  /** 茶色い卵の個数 */
  brown: 1,
  /** 白い卵の個数 */
  white: 1,
} as const;

/** 写真の参照先 (public/ からのルート相対パス。配布・PWA キャッシュ対応) */
export const EGGS_IMAGE_SRC = '/images/eggs-brown-white.jpg';

/** カートンに入る卵の数 (実在する一般的なサイズ。全て偶数なので1組2個で割り切れる) */
const EGG_CARTON_SIZES: readonly number[] = [6, 10, 12];

/** 卵の値段 (茶色い卵・白い卵) の定義済みケース (問題で設定した数値) */
const EGG_PRICE_CASES: readonly { brown: number; white: number }[] = [
  { brown: 30, white: 25 },
  { brown: 35, white: 28 },
  { brown: 40, white: 32 },
  { brown: 25, white: 30 },
  { brown: 45, white: 35 },
];

/** 買う組数の定義済みケース (かけ算向け) */
const EGG_PAIRS_CASES: readonly number[] = [3, 4, 5, 6, 8, 10];

/** 写真の表示仕様を組み立てる (全問題で共通) */
export function buildEggsImage(): ImageSpec {
  return {
    src: EGGS_IMAGE_SRC,
    altText: '卵の写真。茶色い卵が1個と、白い卵が1個、合わせて2個の卵が写っています。',
    caption: '茶色い卵と白い卵 (合わせて2個)',
    credit: 'Evan-Amos / Wikimedia Commons「White-&-Brown-Eggs.jpg」 (Public domain)',
    // 写真から読み取る情報 (問題文には書かない)。
    photoFacts: [
      '茶色い卵が1個写っています。',
      '白い卵が1個写っています。',
      '卵は合わせて2個です (茶色1個・白1個)。',
    ],
    // 写真には写っていない、問題で設定した情報。
    supplementalText: [
      'カートンに入る卵の数、卵の値段、買う組の数など、写真からは読み取れない数値は、'
      + '問題文に「問題で設定した数値」として示します。',
    ],
  };
}

/** 難易度を作る (スーパー教材と同じ丸め方) */
function eggsDifficulty(
  level: DifficultyLevel,
  maxNumber: number,
  reasoning: number = 1,
  reading: number = 2,
) {
  return createDifficulty({
    calculationComplexity: clampLevel(level),
    numberComplexity: clampLevel(Math.min(numberSizeToComplexity(maxNumber), level)),
    reasoningComplexity: clampLevel(Math.min(reasoning, level)),
    readingComplexity: clampLevel(Math.min(reading, level)),
  });
}

/** 問題のバリエーション */
type EggVariant =
  | 'fill_carton' // カートンにあと何個の卵が必要か (減法)
  | 'pair_price' // 茶色1個と白1個の代金 (加法)
  | 'pairs_total' // 組をN組用意すると卵は何個か (乗法)
  | 'pairs_in_carton' // カートンに何組入るか (除法)
  | 'pairs_cost'; // 組をN組買うといくらか (乗法+加法)

/** 難易度ごとに出すバリエーション */
const EGG_VARIANTS_BY_LEVEL: Record<DifficultyLevel, EggVariant[]> = {
  1: ['fill_carton'],
  2: ['pair_price'],
  3: ['pairs_total'],
  4: ['pairs_in_carton', 'pairs_cost'],
  5: ['pairs_cost'],
};

/**
 * 卵の写真から情報を読み取る教材ジェネレータ (現実連動)
 */
export class EggCountingGenerator implements ProblemGenerator {
  readonly type = 'realworld_eggs';
  readonly category = 'realWorld' as const;
  readonly description = '卵の写真から数を読み取って計算する (現実連動)';

  generate(config?: GenerationConfig): Problem {
    const rng = createRandom(config?.seed);
    const level = (config?.difficulty ?? rng.int(1, 5)) as DifficultyLevel;
    const candidates = EGG_VARIANTS_BY_LEVEL[level] ?? EGG_VARIANTS_BY_LEVEL[2];
    const variant = rng.pick(candidates);

    const built = this.buildVariant(variant, rng, level);
    // 途中式 (solutionSteps) は出題パイプライン (attachSolutionSteps) が
    // parameters から組み立てる (全ジェネレータ共通の設計に合わせて一元化)。
    return {
      id: generateProblemId(),
      category: this.category,
      type: this.type,
      difficulty: built.difficulty,
      question: built.question,
      answer: built.answer,
      explanation: built.explanation,
      parameters: { ...built.parameters, difficultyLevel: level },
      image: buildEggsImage(),
    };
  }

  validate(problem: Problem): ValidationResult {
    return validateProblem(problem);
  }

  private buildVariant(
    variant: EggVariant,
    rng: ReturnType<typeof createRandom>,
    level: DifficultyLevel,
  ): BuiltProblem {
    switch (variant) {
      case 'fill_carton':
        return this.fillCarton(rng, level);
      case 'pair_price':
        return this.pairPrice(rng, level);
      case 'pairs_total':
        return this.pairsTotal(rng, level);
      case 'pairs_in_carton':
        return this.pairsInCarton(rng, level);
      case 'pairs_cost':
        return this.pairsCost(rng, level);
    }
  }

  /** カートンにあと何個の卵が必要か (減法) */
  private fillCarton(rng: ReturnType<typeof createRandom>, level: DifficultyLevel): BuiltProblem {
    const carton = rng.pick(EGG_CARTON_SIZES);
    const rest = carton - EGGS_PHOTO.total;
    return {
      question:
        `写真を見て、卵の数を数えます。1つのカートンには卵を${carton}個入れることにします`
        + `（この${carton}個は問題で設定した数値です）。`
        + `写真に写っている卵を入れたあと、カートンをいっぱいにするにはあと何個の卵が必要ですか。`,
      answer: { kind: 'integer', value: rest },
      explanation:
        `写真には茶色い卵が1個と白い卵が1個、合わせて${EGGS_PHOTO.total}個の卵が写っています。`
        + `カートンには${carton}個入れるので、${carton}−${EGGS_PHOTO.total}＝${rest}より、`
        + `あと${rest}個の卵が必要です。`,
      difficulty: eggsDifficulty(level, carton),
      parameters: { variant: 'fill_carton', carton, totalEggs: EGGS_PHOTO.total, answer: rest },
    };
  }

  /** 茶色い卵1個と白い卵1個の代金 (加法) */
  private pairPrice(rng: ReturnType<typeof createRandom>, level: DifficultyLevel): BuiltProblem {
    const c = rng.pick(EGG_PRICE_CASES);
    const total = c.brown + c.white;
    return {
      question:
        `茶色い卵は1個${c.brown}円、白い卵は1個${c.white}円です`
        + `（この値段は問題で設定した数値です）。`
        + `写真のように、茶色い卵を1個と白い卵を1個買います。代金は合計いくらですか。`,
      answer: { kind: 'integer', value: total },
      explanation:
        `写真のように茶色い卵1個と白い卵1個を買います。`
        + `茶色い卵は${c.brown}円、白い卵は${c.white}円なので、`
        + `${c.brown}＋${c.white}＝${total}より、代金は合計${total}円です。`,
      difficulty: eggsDifficulty(level, total),
      parameters: { variant: 'pair_price', priceA: c.brown, priceB: c.white, answer: total },
    };
  }

  /** 組をN組用意すると卵は何個か (乗法) */
  private pairsTotal(rng: ReturnType<typeof createRandom>, level: DifficultyLevel): BuiltProblem {
    const pairs = rng.pick(EGG_PAIRS_CASES);
    const total = EGGS_PHOTO.total * pairs;
    return {
      question:
        `写真の茶色い卵1個と白い卵1個を、1組とします。`
        + `この1組を${pairs}組用意します（この${pairs}組は問題で設定した数値です）。`
        + `卵は合わせて何個になりますか。`,
      answer: { kind: 'integer', value: total },
      explanation:
        `写真を見ると、茶色い卵1個と白い卵1個の合わせて${EGGS_PHOTO.total}個が1組です。`
        + `1組が${EGGS_PHOTO.total}個なので、${pairs}組だと${EGGS_PHOTO.total}×${pairs}＝${total}より、`
        + `卵は合わせて${total}個になります。`,
      difficulty: eggsDifficulty(level, total, 1, 3),
      parameters: { variant: 'pairs_total', pairs, eggsPerPair: EGGS_PHOTO.total, answer: total },
    };
  }

  /** カートンに何組入るか (除法・割り切れる定義済みケース) */
  private pairsInCarton(rng: ReturnType<typeof createRandom>, level: DifficultyLevel): BuiltProblem {
    const carton = rng.pick(EGG_CARTON_SIZES);
    const groups = carton / EGGS_PHOTO.total;
    return {
      question:
        `写真の茶色い卵1個と白い卵1個を、1組とします。`
        + `1つのカートンには卵を${carton}個入れることにします`
        + `（この${carton}個は問題で設定した数値です）。`
        + `茶色い卵と白い卵を1個ずつ組にしてカートンをいっぱいにすると、何組できますか。`,
      answer: { kind: 'integer', value: groups },
      explanation:
        `写真を見ると、茶色い卵1個と白い卵1個の合わせて${EGGS_PHOTO.total}個が1組です。`
        + `カートンには${carton}個入れるので、${carton}÷${EGGS_PHOTO.total}＝${groups}より、`
        + `${groups}組できます。`,
      difficulty: eggsDifficulty(level, carton, 2, 3),
      parameters: { variant: 'pairs_in_carton', carton, eggsPerPair: EGGS_PHOTO.total, answer: groups },
    };
  }

  /** 組をN組買うといくらか (乗法+加法) */
  private pairsCost(rng: ReturnType<typeof createRandom>, level: DifficultyLevel): BuiltProblem {
    const c = rng.pick(EGG_PRICE_CASES);
    const pairs = rng.pick(EGG_PAIRS_CASES);
    const pairCost = c.brown + c.white;
    const total = pairCost * pairs;
    return {
      question:
        `茶色い卵は1個${c.brown}円、白い卵は1個${c.white}円です`
        + `（この値段は問題で設定した数値です）。`
        + `写真のように、茶色い卵1個と白い卵1個を1組として、この1組を${pairs}組買います`
        + `（この${pairs}組は問題で設定した数値です）。代金は合計いくらですか。`,
      answer: { kind: 'integer', value: total },
      explanation:
        `茶色い卵は${c.brown}円、白い卵は${c.white}円なので、1組の代金は`
        + `${c.brown}＋${c.white}＝${pairCost}円です。`
        + `${pairs}組買うので、${pairCost}×${pairs}＝${total}より、代金は合計${total}円です。`,
      difficulty: eggsDifficulty(level, total, 2, 3),
      parameters: {
        variant: 'pairs_cost',
        pairs,
        priceA: c.brown,
        priceB: c.white,
        pairCost,
        answer: total,
      },
    };
  }
}

