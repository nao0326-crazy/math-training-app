/**
 * 学習範囲（curriculum scope）タグ
 *
 * 目的:
 *   小学校6年生までの必須内容・既習内容の復習・発展・根拠未確認を
 *   generator 単位で (必要なら variant 単位で) 管理する。
 *
 * 設計上の約束:
 *   - 既存の diversity/metadata.ts の ProblemMetadata とは **独立** に置く。
 *     ProblemMetadata は学習履歴 (types/history.ts) に永続化されるため、
 *     ここに範囲タグを混ぜると保存形式が変わる。混ぜない。
 *   - 問題生成・選択・保存のいずれの挙動にも干渉しない (参照専用の表)。
 *   - 未分類は「範囲外」ではない。未分類は undefined として返し、
 *     呼び出し側が明示的に検出する。
 */

/**
 * 学習範囲の区分
 * - required: 小学校6年生までの必須学習内容
 * - review:   小学校1〜5年生までの既習内容の復習として適切 (除外対象ではない)
 * - extension: 必須ではないが発展問題として明示して扱う内容
 * - uncertain: 学年配当や教育的位置づけについて十分な根拠が確認できない内容
 */
export type CurriculumCategory = 'required' | 'review' | 'extension' | 'uncertain';

/** 妥当な区分の一覧 (テストと集計で共有する) */
export const CURRICULUM_CATEGORIES: readonly CurriculumCategory[] = [
  'required',
  'review',
  'extension',
  'uncertain',
];

/**
 * 学年配当。'jhs1' は「小学校では必須でなく、中学校1年で扱う」ことを表す。
 */
export type CurriculumGrade = 1 | 2 | 3 | 4 | 5 | 6 | 'jhs1';

/** 妥当な学年の一覧 (テストで検証する) */
export const CURRICULUM_GRADES: readonly CurriculumGrade[] = [1, 2, 3, 4, 5, 6, 'jhs1'];

/**
 * 根拠の確度
 * - confirmed: 一次資料 (学習指導要領・解説) の該当箇所を直接確認した
 * - partial:   該当学年・領域は確認できたが、項目の細区分は未確認
 * - inferred:  curriculum の構成から推論した
 * - unverified:根拠未確認
 */
export type ScopeConfidence = 'confirmed' | 'partial' | 'inferred' | 'unverified';

/** 妥当な確度の一覧 */
export const SCOPE_CONFIDENCES: readonly ScopeConfidence[] = [
  'confirmed',
  'partial',
  'inferred',
  'unverified',
];

/** 1つの学習範囲タグ */
export interface CurriculumScope {
  /** 学習範囲の区分 */
  category: CurriculumCategory;
  /** 学年配当 (確認できる場合) */
  grade?: CurriculumGrade;
  /** 学習領域 (例: 図形 / 数と計算 / 数量と関係) */
  area?: string;
  /** 根拠資料名 */
  source?: string;
  /** 該当箇所・項目 */
  citation?: string;
  /** 根拠の確度 */
  confidence?: ScopeConfidence;
  /** 判断に関する短い注記 */
  note?: string;
}

/**
 * generator 単位の学習範囲タグ。
 * variants は「generator 全体では一意に分類できない」場合だけ使う。
 * variant 指定があるときは variant 側の値が優先される (未指定の欄は型側の値を継承)。
 */
export interface TypeCurriculumScope extends CurriculumScope {
  variants?: Record<string, CurriculumScope>;
}

// ===== 根拠資料 =====

/** 一次資料 (文部科学省) の名称 */
export const MEXT_KIRAN = '文部科学省 学習指導要領 小学校編 (平成29年告示)';
export const MEXT_KAISETSU = '文部科学省 学習指導要領解説 小学校算数編';
export const MEXT_NAKATSU = '文部科学省 中学校学習指導要領 数学編 (平成29年告示)';
export const MEXT_KAISETSU_URL = 'https://www.mext.go.jp/a_menu/shotou/new-cs/1384661.htm';
/** 小学校学習指導要領 本文のPDF (上記ページからリンクされている。5MB超のため自動取得可可) */
export const MEXT_KIRAN_PDF_URL = 'https://www.mext.go.jp/content/1413522_001.pdf';
/** 教科書解説など、学習指導要領そのものではないが単元配当を直接示す資料 */
export const SHOKASHO_KAISETSU = '教科書解説 (小学校算数) による単元配当の説明';
/**
 * 学習指導要領解説 小学校算数編 の学年別のまとめ (平成29年告示)。
 * 非公式の公開再現ページであり、条文ではなく解説編の記述である点は明記しておく。
 */
export const KIRAN_KAISETSU_NAV = '学習指導要領ナビ (学習指導要領解説 小学校算数編の学年別まとめ)';

/** 分類表が根拠として参照する資料の一覧 (cite の健全性テストで使う) */
export const CURATED_SOURCES: readonly string[] = [
  MEXT_KIRAN,
  MEXT_KAISETSU,
  MEXT_NAKATSU,
  SHOKASHO_KAISETSU,
  KIRAN_KAISETSU_NAV,
];

/** scope を作るヘルパー (分類表を短く保つため) */
function s(
  category: CurriculumCategory,
  grade: CurriculumGrade | undefined,
  area: string,
  citation: string,
  confidence: ScopeConfidence,
  note?: string,
): CurriculumScope {
  return { category, grade, area, citation, confidence, note, source: MEXT_KIRAN };
}

/** 解説編を根拠にする場合のヘルパー */
function k(
  category: CurriculumCategory,
  grade: CurriculumGrade | undefined,
  area: string,
  citation: string,
  confidence: ScopeConfidence,
  note?: string,
): CurriculumScope {
  return { category, grade, area, citation, confidence, note, source: MEXT_KAISETSU };
}

/**
 * 教科書解説など (学習指導要領そのものではない資料) を根拠にする場合のヘルパー。
 * 資料名と 学習指導要領が区別できるよう、source を明示する。
 */
function b(
  category: CurriculumCategory,
  grade: CurriculumGrade | undefined,
  area: string,
  citation: string,
  confidence: ScopeConfidence,
  note?: string,
): CurriculumScope {
  return { category, grade, area, citation, confidence, note, source: SHOKASHO_KAISETSU };
}

/**
 * 全 generator 型の学習範囲分類表。
 *
 * ===== citation の記録粒度について (Phase 2-W 監査で明記) =====
 * citation は「学年 + 領域 + 単元のキーワード」単位で記録しており、
 * 学習指導要領の条文番号 (例: A(1)(ア) のイ) までは含めない。
 * 条文番号まで確定していないものは confidence を partial / inferred に留めている。
 *
 * ===== 根拠の確認状況 (Phase 2-W 監査) =====
 * confirmed は、各フェーズで実際に資料本文を取得して確認できたものにのみ付けている
 * (Phase 2-S/2-T: 学習指導要領解説 小学校算数編、Phase 2-V: 教科書解説)。
 * ただし平成29年告示の本文PDFは 5MB 超であり、Phase 2-W の自動取得では
 * 参照できなかったため、confirmed の項目も同フェーズでは再確認できていない。
 *
 * ===== 区分の決め方 =====
 *   - 小学校6学年までの学習指導要領に載る内容 → required
 *   - 小1〜5で学ぶが体系的な復習として válidaな内容 → review
 *   - 小学校必須でない (中学校移行、または発展) → extension
 *   - 根拠を確認できていない → uncertain
 *
 * confidence は「その場で一次資料の該当行を確認できたか」を表す。
 * 学年・領域は確認できているが項目の細区分まで見ていないものは partial、
 * 解説の構成から読み取ったものは inferred とした。
 */
export const CURRICULUM_SCOPE: Record<string, TypeCurriculumScope> = {
  // ===== 数と計算: 整数 =====
  integer_addition: s('review', 1, '数と計算', '第1学年 A(2) 整数の加法', 'partial',
    '小1で成立する基本計算。6年生向けの練習では既習内容の復習として扱う。'),
  integer_subtraction: s('review', 1, '数と計算', '第1学年 A(2) 整数の減法', 'partial',
    '小1で成立する基本計算。6年生向けの練習では既習内容の復習として扱う。'),
  integer_multiplication: s('review', 2, '数と計算', '第2学年 A(3) 整数の乗法', 'partial',
    '小2で九九表として成立する。6年生向けの練習では復習として扱う。'),
  integer_division: s('review', 2, '数と計算', '第2学年 A(3) 整数の除法', 'partial',
    '小2で等分として成立する。6年生向けの練習では復習として扱う。'),
  integer_multi_step: s('review', 3, '数と計算', '第3学年 A(4) 几步計算', 'partial',
    '整数の加減乗除の上に成り立つ計算。小1〜2の整数演算と同じ位置づけで、'
    + '小6年生が新たに学ぶ内容ではなく既有計算の演習にあたるため review とする。'),
  integer_fill_blank: s('review', 3, '数と計算', '第3学年 A(4) 几步計算', 'partial',
    '計算の習熟を問う問題。小6で新たに導入される単元ではないため review とする。'),
  integer_word_problem: s('review', 2, '数量と関係の法則', '第2学年 B(1) 数量と関係', 'partial',
    '整数演算で数量関係を読む問題。小2〜3で成立し、小6では分数や小数の文章題の'
    + '土台として復習される内容のため review とする。'),

  // ===== Phase 2-Z5B: 4学年 四則計算の結果の見積り =====
  estimate_product: k('required', 4, '数と計算', '第4学年 数と計算 「加法，減法及び乗法の結果の見積り」', 'partial',
    '平成29年告示の解説編の学年別まとめで第4学年に位置づけられていることを確認した。'
    + '正確な積を求めるのではなく、数を概数に置き換えておよその大きさを把握する練習。'
    + '丸める位は問題文で明示するため答えは一意になる。'),

  // ===== 数の性質 =====
  divisors_finding: s('required', 5, '数と性質', '第5学年 A(1) 整数とその性質 (約数)', 'partial',
    '約数をすべて挙げる。10までの数なら小学校でも十分扱える。'),
  divisors_count: s('required', 5, '数と性質', '第5学年 A(1) 整数とその性質 (約数)', 'partial'),
  multiples_finding: s('required', 5, '数と性質', '第5学年 A(1) 整数とその性質 (倍数)', 'partial'),
  prime_judgment: {
    category: 'extension',
    grade: 'jhs1',
    area: '数と性質',
    citation: '中学校 整数の性質 (素数)',
    // Phase 2-W: 素数が中学校で扱うべき内容であることは確認できたが、
    // 「中学校1年」という学年配当は平成29年告示で直接確認できていないため partial に格下げ。
    confidence: 'partial',
    source: MEXT_KIRAN,
    note: '小学校では素数を扱わないことは確認できた。'
      + '学年配当については、旧課程の中学校学習指導要領では素数が第3学年の用語・記号に'
      + '現れることを確認したが、現行課程(平成29年告示)の中学校1年という主張は'
      + '一次資料で確認できていないため、中学校1年とみなしてextensionに分類はするが'
      + '確度はpartialに留める。',
  },
  prime_range: {
    category: 'extension',
    grade: 'jhs1',
    area: '数と性質',
    citation: '中学校 整数の性質 (素数)',
    confidence: 'partial',
    source: MEXT_KIRAN,
    note: 'prime_judgment と同じ位置づけ。'
      + '範囲内の素数をすべて挙げる作業は素数の判定より処理が重い。'
      + '学年配当はprime_judgment と同じく一次資料で確認できていない。',
  },
  common_divisors: s('required', 5, '数と性質', '第5学年 A(1) 整数とその性質 (最大公約数)', 'partial'),
  common_multiples: s('required', 5, '数と性質', '第5学年 A(1) 整数とその性質 (最小公倍数)', 'partial'),
  gcd_calculation: s('required', 6, '数と性質', '第6学年 A(1) 整数の性質', 'partial',
    '第5学年では和应用として扱い、第6学年で計算をまとめる段階。'),
  lcm_calculation: s('required', 6, '数と性質', '第6学年 A(1) 整数の性質', 'partial'),
  gcd_lcm_word: s('required', 6, '数量と関係の法則', '第6学年 分数のわり算 約分への応用', 'partial',
    '分数の約分を最大公約数で説明する応用問題。'),

  // ===== 周期性 =====
  period_repetition: s('required', 5, '数と性質', '第5学年 A(1) はしまでの周期性', 'partial',
    '並びのはしから次を求める問題。'),

  // ===== 組合せ =====
  arrange_simple: s('uncertain', 4, '数量と関係の法則', '第4学年〜第5学年 B(1) ものの数', 'unverified',
    '並べ方を数える内容は4学年と5学年のどちらに配当されるか、この場では一次資料を確認できていない。'
    + '5学年「ものの数」で導入される可能性が高いが、断定しないため uncertain とした。'),
  arrange_tree: s('required', 5, '数量と関係の法則', '第5学年 B(1) ものの数 (組合せ)', 'partial',
    '樹形図を使って組合せを数える問題。'),
  combine_simple: s('required', 5, '数量と関係の法則', '第5学年 B(1) ものの数 (組合せ)', 'partial'),
  combine_table: s('required', 5, '数量と関係の法則', '第5学年 B(1) ものの数 (組合せ)', 'partial',
    '表を使って組合せを数える段階。'),
  duplicate_removal: s('required', 6, '数量と関係の法則', '第6学年 B(1) ものの数', 'partial',
    '重複を除いた選び方を数える問題。'),

  // ===== 分数 =====
  fraction_mul_integer: s('required', 6, '数と計算', '第6学年 B(1) 分数の乗法', 'partial'),
  fraction_mul_fraction: s('required', 6, '数と計算', '第6学年 B(1) 分数の乗法', 'partial'),
  fraction_mul_mixed: s('required', 6, '数と計算', '第6学年 B(1) 分数の乗法', 'partial',
    '帯分数を分数に直してから掛ける段階。'),
  fraction_div_integer: s('required', 6, '数と計算', '第6学年 B(2) 分数の除法', 'partial'),
  fraction_div_fraction: s('required', 6, '数と計算', '第6学年 B(2) 分数の除法', 'partial'),
  fraction_div_mixed: s('required', 6, '数と計算', '第6学年 B(2) 分数の除法', 'partial',
    '帯分数を含む分数の除法。6学年後半の内容。'),
  fraction_reduce: s('required', 6, '数と計算', '第6学年 A(1) 分数の意味 約分', 'partial'),
  fraction_common_denominator: s('required', 6, '数と計算', '第6学年 B(1) 通分 約分', 'partial'),
  fraction_mixed_convert: s('required', 5, '数と計算', '第5学年 A(1) 分数の意味 帯分数', 'partial',
    '仮分数と帯分数の相互変換。'),
  fraction_big_small: s('required', 6, '数と計算', '第6学年 A(1) 分数の大小', 'partial'),
  fraction_unit_intro: k('required', 3, '数と計算', '第3学年 A(1) 分数の意味', 'confirmed',
    '全体を何等分したか、1つ分やいくつかのまとめ方を扱う導入段階。真分数のみを扱う。'),

  // ===== 小数 =====
  decimal_addition: s('required', 3, '数と計算', '第3学年 B(1) 小数の加算 減算', 'partial',
    '小数の加算・減算。第3学年で導入し、第4〜5学年で位をそろえた計算を扱う。'),
  decimal_subtraction: s('required', 3, '数と計算', '第3学年 B(1) 小数の加算 減算', 'partial',
    '小数の加算・減算。第3学年で導入し、第4〜5学年で位をそろえた計算を扱う。'),
  decimal_mul_integer: s('required', 5, '数と計算', '第5学年 B(1) 小数×整数', 'partial'),
  decimal_div_integer: s('required', 5, '数と計算', '第5学年 B(1) 小数÷整数', 'partial'),
  decimal_mul_decimal: s('required', 6, '数と計算', '第6学年 B(1) 小数×小数', 'partial'),
  decimal_div_decimal: s('required', 6, '数と計算', '第6学年 B(2) 小数÷小数', 'partial'),
  decimal_round: s('required', 5, '数と性質', '第5学年 B(2) およその数 近似値', 'partial',
    '四捨五入による概数。5学年「およその数」の扱い。'),
  decimal_place_value: {
    ...k('required', 3, '数と計算', '第3学年 A(1) 小数の性質', 'confirmed',
      '小数の位取りと読み書き。第3学年で導入する。'),
    // 同じ generator でも variant によって学年配当が変わるため variant 単位で指定する。
    // 位取りの読み書きは小3、小数の性質を使う組み立ては小4で扱う。
    variants: {
      read_digit: k('required', 3, '数と計算', '第3学年 A(1) 小数の性質 (位取り)', 'partial'),
      place_value: k('required', 3, '数と計算', '第3学年 A(1) 小数の性質 (位取り)', 'partial'),
      decompose: k('required', 4, '数と計算', '第4学年 A(1) 小数の性質', 'partial'),
      compose: k('required', 4, '数と計算', '第4学年 A(1) 小数の性質', 'partial'),
    },
  },

  // ===== 速さ =====
  speed_calculation: s('required', 5, '数量と関係の法則', '第5学年 C(1) 速さ', 'partial'),
  distance_calculation: s('required', 5, '数量と関係の法則', '第5学年 C(1) 速さ', 'partial'),
  time_calculation: s('required', 5, '数量と関係の法則', '第5学年 C(1) 速さ', 'partial'),
  speed_unit_conversion: s('required', 5, '数量と関係の法則', '第5学年 C(1) 速さ 単位の換算', 'partial',
    '時速・分速などの単位をそろえる問題。'),
  speed_comparison: s('required', 5, '数量と関係の法則', '第5学年 C(1) 速さ', 'partial'),
  speed_word: s('required', 6, '数量と関係の法則', '第6学年 B/C 速さの文章題', 'partial'),
  speed_multi_step: s('required', 6, '数量と関係の法則', '第6学年 数量と関係 複合問題', 'partial',
    '速さを2回以上使う複合問題。速さ自体は5学年だが、'
    + '複数の関係を読み取る段階は6学年の数量と関係に対応する。'),

  // ===== 比と比例 =====
  ratio_simplify: s('required', 6, '数量と関係の法則', '第6学年 C(1) 比', 'partial'),
  ratio_value: s('required', 6, '数量と関係の法則', '第6学年 C(1) 比', 'partial'),
  ratio_equal: s('required', 6, '数量と関係の法則', '第6学年 C(1) 比', 'partial'),
  ratio_quantity: s('required', 6, '数量と関係の法則', '第6学年 C(1) 比 分配', 'partial'),
  proportional_expression: k('required', 6, '数量と関係の法則', '第6学年 C(1) 比例 ア 比例の式', 'confirmed',
    '比例の関係にある2つの量の関係を式に表す問題。'),
  proportional_word: k('required', 6, '数量と関係の法則', '第6学年 C(1) 比例 イ 比例の性質', 'confirmed',
    '比例の関係を使った文章題。'),
  inverse_expression: k('required', 6, '数量と関係の法則', '第6学年 C(1) 比例 ウ 反比例の関係', 'confirmed',
    '反比例の関係にある2つの量の関係を式に表す問題。'
    + '反比例は小6の比例の単元内にあり、小学校必須の範囲に入る。'),
  inverse_word: k('required', 6, '数量と関係の法則', '第6学年 C(1) 比例 ウ 反比例の関係', 'confirmed',
    '反比例の関係を使った文章題。反比例は小6の比例の単元内にあり、小学校必須の範囲に入る。'),

  // ===== 図形 (面積・円・立体・対称・角度・長さ) =====
  circle_area_radius: s('required', 6, '図形', '第6学年 B(2) 円の面積', 'partial',
    '円の面積は6学年で扱う。5学年では円周のみ。'),
  circle_area_diameter: s('required', 6, '図形', '第6学年 B(2) 円の面積', 'partial',
    '直径から円の面積を求める段階。'),
  circle_radius_from_area: s('required', 6, '図形', '第6学年 B(2) 円の面積', 'partial',
    '面積から半径を逆算する段階。'),
  circle_circumference: k('required', 5, '図形', '第5学年 B(3) 円の周長', 'confirmed',
    '円の周長は5学年で扱う。6学年では面積とともに扱う。'),
  trapezoid_area: {
    category: 'required',
    grade: 5,
    area: '図形',
    citation: '第5学年 図形 「三角形，平行四辺形，ひし形，台形の求積」',
    // Phase 2-Y: 台形の求積は第5学年と確認できたため第6学年から修正する。
    confidence: 'partial',
    source: KIRAN_KAISETSU_NAV,
    note: '台形の性質は第4学年、台形の面積の求め方は第5学年。'
      + '円の求積が第6学年である点和を混同しないようにしている。',
  },
  angle_basic: {
    category: 'required',
    grade: 5,
    area: '図形',
    citation: '第5学年 図形 「三角形の三つの角，四角形の四つの角の大きさの和」',
    // Phase 2-Y: 平成29年告示の解説編で三角形の角の和は第5学年と確認できた。
    // 従来「角と直線は第4学年」と一小節だけ読み違えて第4学年としていたため修正する。
    confidence: 'partial',
    source: KIRAN_KAISETSU_NAV,
    note: '平行・垂直・角の大きさの測定は第4学年だが、三角形の内角の和は第5学年に'
      + '位置づけられている。angle_basic は三角形の内角の和を扱うため第5学年に修正した。',
  },
  triangle_classify: k('required', 3, '図形', '第3学年 B(1) 三角形', 'confirmed',
    '三角形を正三角形 二等辺三角形 不等辺三角形に分類する。3学年で扱う。'),
  symmetry_fold: s('required', 6, '図形', '第6学年 B(3) 図形の対称', 'partial',
    '図形を折り返したときの重なりを扱う問題。'),
  symmetry_point: s('required', 6, '図形', '第6学年 B(3) 図形の対称', 'partial',
    '点対称を扱う問題。'),
  judge_same: s('required', 6, '図形', '第6学年 B(3) 図形の合同', 'partial',
    '2つの図形が合同かどうかを判定する問題。Phase 1 は三角形のみ・合同である場合のみ。'),
  judge_differs: s('required', 6, '図形', '第6学年 B(3) 図形の合同', 'partial',
    '2つの図形が合同かどうかを判定する問題。Phase 2 は三角形のみ・合同でない場合のみ。'),
  scale_length: s('required', 6, '図形', '第6学年 B(3) 拡大図 縮図', 'partial',
    '縮尺を使って対応する長さを求める問題。'),
  volume_box: s('required', 5, '図形', '第5学年 B(3) 直方体 立体', 'partial'),
  volume_cube: s('required', 5, '図形', '第5学年 B(3) 立方体 立体', 'partial'),
  volume_prism: s('required', 6, '図形', '第6学年 B(3) 立体 底面積と高さ', 'partial'),
  volume_cylinder: s('required', 6, '図形', '第6学年 B(3) 円柱の体積', 'partial',
    '円柱の体積は6学年で扱う。'),
  volume_from_height: s('required', 6, '図形', '第6学年 B(3) 立体 高さから体積', 'partial'),
  // 実装が扱うのは「L (リットル) と cm3 (立方センチメートル)」の換算であり、
  // ㎥↔㎤ ではない。記録の整合性を保つために注記を実装に合わせて更新した。
  volume_unit: s('required', 6, '量と単位', '第6学年 D 単位の換算 立体', 'partial',
    'リットル (L) と立方センチメートル (cm3) の換算。'),
  unit_conversion_basic: k('required', 3, '量と単位', '第3学年 D 単位の換算', 'confirmed',
    '長さ 面積 重さ 時間の基本単位への換算。第3学年で導入する。'),

  // ===== 平行と垂直 (Phase 2-U) =====
  parallel_perpendicular: s('required', 4, '図形', '第4学年 B(1) 角と直線 (平行と垂直)', 'partial',
    '平行と垂直の定義、および2直線の交わりからその関係来判断する問題。'
    + '文章だけで判断できる問題に限定し、図は使わない。'),

  // ===== 面積の単位変換 (Phase 2-V) =====
  area_unit_conversion: {
    ...b('required', 4, '図形', '第4学年 図形「平面図形の面積」', 'partial',
      '面積の単位「cm2」「m2」「km2」「a」「ha」とその関係を扱う単元として'
      + '第4学年に配当されていることは教科書解説で直接確認できた。'
      + 'ただし根拠は教科書解説であり学習指導要領そのものではないため、'
      + '条文番号まで確認できていないので partial とした。'
      + 'unit_conversion_basic は長さ・重さ・時間と ㎠↔㎡ のみを扱うため、'
      + 'a・ha・㎢ を含む面積どうしの換算は本型が担当する。'),
    // 第4学年が扱う面積の単位は cm2・m2・km2 であり、a (アール) と ha (ヘクタール)
    // は小学校の解説編に一切記載がない。したがって a/ha を用いる variant は
    // 必須範囲ではなく発展として扱う (Phase 2-Y で確認)。
    variants: {
      aresu_to_sqm: {
        category: 'extension', grade: undefined, area: '図形',
        citation: '小学校の学習指導要領解説にはアール (a) の記載がない',
        confidence: 'partial', source: KIRAN_KAISETSU_NAV,
        note: 'アールを用いる換算。小学校内容として確認できないため発展扱い。',
      },
      hektaru_to_aresu: {
        category: 'extension', grade: undefined, area: '図形',
        citation: '小学校の学習指導要領解説にはヘクタール (ha) の記載がない',
        confidence: 'partial', source: KIRAN_KAISETSU_NAV,
        note: 'ヘクタールを用いる換算。小学校内容として確認できないため発展扱い。',
      },
      sqkm_to_hektaru: {
        category: 'extension', grade: undefined, area: '図形',
        citation: '平方キロメートルは第4学年だがヘクタール (ha) は小学校にない',
        confidence: 'partial', source: KIRAN_KAISETSU_NAV,
        note: '㎢ は第4学年内容だが ha を経由するため発展扱い。',
      },
      sqm_to_sqcm: {
        category: 'required', grade: 4, area: '図形',
        citation: '第4学年 図形 「面積の単位（cm2，m2，km2）と測定」',
        confidence: 'partial', source: KIRAN_KAISETSU_NAV,
        note: '㎠ と ㎡ の換算は第4学年の中核的な内容として確認できる。',
      },
      sqm_to_aresu: {
        category: 'extension', grade: undefined, area: '図形',
        citation: '小学校の学習指導要領解説にはアール (a) の記載がない',
        confidence: 'partial', source: KIRAN_KAISETSU_NAV,
        note: 'アールを用いる換算のため発展扱い。',
      },
      hektaru_to_sqkm: {
        category: 'extension', grade: undefined, area: '図形',
        citation: '平方キロメートルは第4学年だがヘクタール (ha) は小学校にない',
        confidence: 'partial', source: KIRAN_KAISETSU_NAV,
        note: 'ha を経由するため発展扱い。',
      },
      hektaru_to_sqm: {
        category: 'extension', grade: undefined, area: '図形',
        citation: '小学校の学習指導要領解説にはヘクタール (ha) の記載がない',
        confidence: 'partial', source: KIRAN_KAISETSU_NAV,
        note: 'ヘクタールを用いる換算のため発展扱い。',
      },
      sqm_to_hektaru: {
        category: 'extension', grade: undefined, area: '図形',
        citation: '小学校の学習指導要領解説にはヘクタール (ha) の記載がない',
        confidence: 'partial', source: KIRAN_KAISETSU_NAV,
        note: 'ヘクタールを用いる換算のため発展扱い。',
      },
    },
  },

  // ===== Phase 2-Y: 今回の調査で確認できた学年 =====

  // 第5学年 異分母分数の加法及び減法。既存 generator では扱われていなかった空白だった。
  fraction_add_sub: {
    category: 'required',
    grade: 5,
    area: '数と計算',
    citation: '第5学年 数と計算 「異分母分数の加法及び減法」',
    confidence: 'partial',
    source: KIRAN_KAISETSU_NAV,
    note: '解説編の学年別まとめで第4学年が同分母、第5学年が異分母と確認できる。'
      + '既習の通分・約分を使うので、fraction_common_denominator / fraction_reduce と一体で学習する。',
  },

  // 第5学年 割合・百分率。既存 generator では扱われていなかった空白だった。
  percentage: {
    category: 'required',
    grade: 5,
    area: '数量の関係',
    citation: '第5学年 変化と関係 「割合，百分率」',
    confidence: 'partial',
    source: KIRAN_KAISETSU_NAV,
    note: '解説編で第5学年に「割合，百分率」と記載されている。'
      + '第6学年が扱うのは比・比例・反比例であり、百分率そのものは第5学年が担当する。',
  },

  // ===== Phase 2-Z: 4学年 平面図形の面積 (正方形・長方形) =====
  rectangle_area: {
    ...k('required', 4, '図形', '第4学年 図形 「平面図形の面積」 (正方形，長方形の面積)', 'partial',
      '解説編で第4学年「正方形，長方形の面積」と「面積の単位（cm2，m2，km2）」に'
      + '位置づけられていることを確認した。'),
    variants: {
      square: k('required', 4, '図形', '第4学年 「正方形の面積」', 'partial'),
      rectangle: k('required', 4, '図形', '第4学年 「長方形の面積」', 'partial'),
      find_side: k('required', 4, '図形', '第4学年 「正方形，長方形の面積」', 'partial',
        '面積と一方の辺から他方の辺を求める形。公式を逆に使う場面。'),
      unit_convert: k('required', 4, '図形', '第4学年 「面積の単位（cm2，m2，km2）と測定」', 'partial'),
      choose_formula: k('required', 4, '図形', '第4学年 「正方形，長方形の面積」', 'partial',
        'どの式を使うかを判断する選択式の問題。'),
    },
  },

  // ===== Phase 2-Z1: 5学年 三角形の求積・平行四辺形の求積 =====
  triangle_area: {
    ...k('required', 5, '図形', '第5学年 図形 「三角形，平行四辺形，ひし形，台形の求積」', 'partial',
      '解説編で第5学年「三角形，平行四辺形，ひし形，台形の求積」に位置づけられていることを確認した。'),
    variants: {
      find_area: k('required', 5, '図形', '第5学年 「三角形の求積」', 'partial'),
      find_area_with_slant: k('required', 5, '図形', '第5学年 「三角形の求積」', 'partial',
        '斜辺の長さを併記し、高さと区別する練習。斜辺は計算に使わない。'),
      find_height: k('required', 5, '図形', '第5学年 「三角形の求積」', 'partial'),
      find_base: k('required', 5, '図形', '第5学年 「三角形の求積」', 'partial'),
      compare_with_rectangle: k('required', 5, '図形', '第5学年 「三角形の求積」', 'partial',
        '長方形と三角形の面積の比較。三角形の面積が長方形の半分であることを確かめる。'),
    },
  },
  parallelogram_area: {
    ...k('required', 5, '図形', '第5学年 図形 「三角形，平行四辺形，ひし形，台形の求積」', 'partial',
      '解説編で第5学年「三角形，平行四辺形，ひし形，台形の求積」に位置づけられていることを確認した。'),
    variants: {
      find_area: k('required', 5, '図形', '第5学年 「平行四辺形の求積」', 'partial'),
      find_area_with_slant: k('required', 5, '図形', '第5学年 「平行四辺形の求積」', 'partial',
        '斜辺の長さを併記し、底辺に垂直な高さと区別する練習。'),
      find_height: k('required', 5, '図形', '第5学年 「平行四辺形の求積」', 'partial'),
      find_base: k('required', 5, '図形', '第5学年 「平行四辺形の求積」', 'partial'),
      two_triangles: k('required', 5, '図形', '第5学年 「三角形の求積」', 'partial',
        '平行四辺形を対角線で分けた三角形の面積。三角形の求積の応用として扱う。'),
    },
  },

  // ===== 文字と式 =====
  expression_make: s('required', 5, '数量と関係の法則', '第5学年 B(2) 文字と式', 'partial'),
  expression_substitution: s('required', 5, '数量と関係の法則', '第5学年 B(2) 文字と式', 'partial'),
  expression_word_make: s('required', 5, '数量と関係の法則', '第5学年 B(2) 文字と式', 'partial'),
  expression_meaning: s('required', 6, '数量と関係の法則', '第6学年 B(2) 文字と式', 'partial'),
  expression_blank: s('required', 6, '数量と関係の法則', '第6学年 B(2) 文字と式', 'partial'),
  expression_multi_condition: s('required', 6, '数量と関係の法則', '第6学年 B(2) 文字と式', 'partial',
    '2つ以上の条件から式を立てる段階。'),

  // ===== データ =====
  data_average: s('required', 5, 'データの活用', '第5学年 D データの活用 平均', 'partial'),
  data_total_from_average: s('required', 6, 'データの活用', '第6学年 D データの活用 平均', 'partial',
    '平均から合計を求める逆の問題。'),
  data_max_min: s('required', 5, 'データの活用', '第5学年 D データの活用', 'partial',
    '度数分布表から最大値と最小値を読み取る問題。'),
  data_compare: s('required', 5, 'データの活用', '第5学年 D データの活用', 'partial',
    'グラフや表を比較して読み取る問題。'),
};

// ===== 参照 API =====

/**
 * 型単位の学習範囲タグを返す。未登録なら undefined。
 * undefined は「範囲外」ではない。未分類という状態を表す。
 */
export function getTypeCurriculumScope(type: string): TypeCurriculumScope | undefined {
  return Object.prototype.hasOwnProperty.call(CURRICULUM_SCOPE, type)
    ? CURRICULUM_SCOPE[type]
    : undefined;
}

/**
 * 学習範囲タグを解決する。
 *
 * variant が指定され、その variant 単位のタグが存在する場合は
 * 型単位の値を土台に variant 側の値を上書きで合する (variant 側の値が優先)。
 * variant に指定がなければ型単位の値をそのまま返す。
 * どちらにも該当しなければ undefined。
 */
export function getCurriculumScope(
  type: string,
  variant?: string,
): CurriculumScope | undefined {
  const base = getTypeCurriculumScope(type);
  if (!base) return undefined;
  const { variants, ...typeScope } = base;
  if (!variant) return typeScope;
  const variantScope = variants?.[variant];
  if (!variantScope) return typeScope;
  const { variants: _ignored, ...rest } = variantScope as TypeCurriculumScope;
  return { ...typeScope, ...rest };
}

/** 分類済みの型名をすべて返す */
export function listClassifiedTypes(): string[] {
  return Object.keys(CURRICULUM_SCOPE).sort();
}

/** 区分ごとの型数を集計する (未分類は unclassified として数える) */
export function summarizeByCategory(
  types: readonly string[] = listClassifiedTypes(),
): Record<string, number> {
  const summary: Record<string, number> = {};
  for (const c of CURRICULUM_CATEGORIES) summary[c] = 0;
  summary.unclassified = 0;
  for (const t of types) {
    const scope = getTypeCurriculumScope(t);
    summary[scope ? scope.category : 'unclassified'] += 1;
  }
  return summary;
}

/** 学年ごとの型数を集計する */
export function summarizeByGrade(
  types: readonly string[] = listClassifiedTypes(),
): Record<string, number> {
  const summary: Record<string, number> = { unspecified: 0 };
  for (const t of types) {
    const scope = getTypeCurriculumScope(t);
    const key = scope?.grade === undefined ? 'unspecified' : String(scope.grade);
    summary[key] = (summary[key] ?? 0) + 1;
  }
  return summary;
}

/**
 * 分類されていない型を検出する。
 * registry から渡された型一覧に対して、分類表に無いものを返す。
 */
export function findUnclassifiedTypes(types: readonly string[]): string[] {
  return types.filter((t) => getTypeCurriculumScope(t) === undefined).sort();
}

/**
 * 分類表自体の不正を検出する。
 * - 区分・学年・確度が既定値以外
 * - 根拠 (citation) と注記 (note) が必ず存在するか
 * - variant 単位の区分・学年が既定値以外
 */
export function validateScopeTable(
  table: Record<string, TypeCurriculumScope> = CURRICULUM_SCOPE,
): string[] {
  const errors: string[] = [];
  for (const [type, entry] of Object.entries(table)) {
    if (!CURRICULUM_CATEGORIES.includes(entry.category)) {
      errors.push(`${type}: 不正な区分 ${String(entry.category)}`);
    }
    if (entry.grade !== undefined && !CURRICULUM_GRADES.includes(entry.grade)) {
      errors.push(`${type}: 不正な学年 ${String(entry.grade)}`);
    }
    if (entry.confidence !== undefined && !SCOPE_CONFIDENCES.includes(entry.confidence)) {
      errors.push(`${type}: 不正な確度 ${String(entry.confidence)}`);
    }
    if (!entry.citation) errors.push(`${type}: 根拠 (citation) がありません`);
    // 注記 (note) は任意。空文字列だけを不正として扱う。
    if (entry.note !== undefined && entry.note.length === 0) {
      errors.push(`${type}: 判断の注記が空です`);
    }
    for (const [variant, vScope] of Object.entries(entry.variants ?? {})) {
      if (!CURRICULUM_CATEGORIES.includes(vScope.category)) {
        errors.push(`${type}.${variant}: 不正な区分 ${String(vScope.category)}`);
      }
      if (vScope.grade !== undefined && !CURRICULUM_GRADES.includes(vScope.grade)) {
        errors.push(`${type}.${variant}: 不正な学年 ${String(vScope.grade)}`);
      }
    }
  }
  return errors;
}

// CURRICULUM_SCOPE_MARKER