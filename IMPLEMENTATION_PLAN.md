# 小学6年生向け数学問題生成エンジン拡張計画

## 1. 現在の実装済み問題タイプ (7タイプ)

| # | タイプ | 学習分野 | 問題形式 |
|---|--------|---------|---------|
| 1 | integer_addition | 整数 | 直接計算 |
| 2 | integer_subtraction | 整数 | 直接計算 |
| 3 | integer_multiplication | 整数 | 直接計算 |
| 4 | integer_division | 整数 | 直接計算 |
| 5 | integer_multi_step | 整数 | 複数段階 |
| 6 | integer_fill_blank | 整数 | 穴埋め |
| 7 | integer_word_problem | 整数 | 文章題 |

## 2. 小6学習範囲 (文部科学省学習指導要領) との比較

実装済み: 整数の四則演算のみ

不足:
- A. 数と計算: 整数の性質 (約数・倍数・素数・公約数・公倍数・GCD/LCM)、分数計算 (約分・通分・分数×整数・分数×分数・分数÷整数・分数÷分数・帯分数・倍を表す分数・分数の大きさ比較)、小数計算 (小数×小数・小数÷小数)
- B. 量・測定: 円の面積 (半径・直径・面積逆算・複合図形)、体積 (直方体・立方体・角柱・円柱・単位換算)、速さ (速さ・道のり・時間・単位変換・速さの比較)
- C. 図形: 線対称・点対称・対角の軸・拡大図・縮図・基本図形の角度
- D. 比・比例・反比例: 比の表し方・比の値・等しい比・比の簡単化・比の利用、比例・反比例
- E. 文字と式: □を使った表現・代入
- F. 場合の数: 並べ方・組み合わせ・樹形図・表
- G. データの活用: 平均・柱状グラフ・帯グラフ・度数分布・資料の読み取り

## 3. 追加予定の問題タイプ (カテゴリ別)

### numberTheory (数の性質) - 約数・倍数・素数
1. divisors_finding - 約数をすべて求める
2. divisors_count - 約数の個数
3. multiples_finding - 倍数を求める
4. prime_judgment - 素数判定
5. prime_range - 範囲内の素数
6. common_divisors - 公約数
7. common_multiples - 公倍数
8. gcd_calculation - 最大公約数
9. lcm_calculation - 最小公倍数
10. gcd_lcm_word - 約数・倍数の文章題 (周期問題)
11. number_ladder_leap - 周期・繰り返し問題

### fraction (分数) - 14タイプ
1. fraction_mul_integer - 分数×整数
2. fraction_mul_fraction - 分数×分数
3. fraction_mul_mixed - 帯分数の掛け算
4. fraction_div_integer - 分数÷整数
5. fraction_div_fraction - 分数÷分数
6. fraction_div_mixed - 帯分数の割り算
7. fraction_reduce - 約分
8. fraction_common_denominator - 通分
9. fraction_mixed_convert - 仮分数と帯分数の変換
10. fraction_order - 分数の大きさ比較
11. fraction_word - 分数の文章題
12. fraction_ratio - 倍を表す分数
13. fraction_estimation - 答えの見積もり
14. fraction_number_line - 分数を数直線に表す
15. fraction_same_denominator_add_sub - 同分母の加減 (小5復習)

### decimal (小数) - 5タイプ
1. decimal_mul_decimal - 小数×小数
2. decimal_div_decimal - 小数÷小数
3. decimal_mul_integer - 小数×整数
4. decimal_div_integer - 小数÷整数
5. decimal_round - 四捨五入

### speed (速さ) - 7タイプ
1. speed_calculation - 速さを求める
2. distance_calculation - 道のりを求める
3. time_calculation - 時間を求める
4. speed_unit_conversion - 単位変換 (時速・分速・秒速)
5. speed_comparison - 速さの比較
6. speed_word - 速さの文章題
7. speed_multi_step - 複数段階の速さ問題

### geometry (図形) - 20タイプ
1. circle_area_from_radius - 円の面積 (半径→面積)
2. circle_area_from_diameter - 円の面積 (直径→面積)
3. circle_radius_from_area - 円の面積から半径を求める
4. circle_compound_area - 円と長方形などの複合図形
5. circle_approximate_area - およその面積
6. volume_box - 直方体の体積
7. volume_cube - 立方体の体積
8. volume_prism - 角柱の体積
9. volume_cylinder - 円柱の体積
10. volume_from_height - 体積から高さを求める
11. volume_from_base - 体積から底面積を求める
12. volume_compound - 複合立体
13. volume_unit_conversion - 体積の単位換算
14. symmetry_fold - 線対称の判定
15. symmetry_point - 点対称の判定
16. symmetry_axis - 対称の軸・中心
17. symmetry_classification - 対称な図形の分類
18. scale_expand - 拡大図・縮図のかき方・対応する辺
19. scale_length - 縮図から実際の長さを求める
20. angle_basic - 基本図形の角度

### ratio (比・比例) - 16タイプ
1. ratio_notation - 比の表し方
2. ratio_value - 比の値
3. ratio_equal - 等しい比
4. ratio_simplify - 比の簡単化
5. ratio_quantity - 比を使って量を求める
6. ratio_whole - 比から全体量を求める
7. ratio_word - 比の文章題
8. proportional_judgment - 比例する関係の判定
9. proportional_table - 表から比例を判断
10. proportional_expression - の式
11. proportional_constant - 比例定数を求める
12. proportional_graph - グラフから値を読み取る
13. proportional_word - 比例の文章題
14. inverse_judgment - 反比例の判定
15. inverse_table_expression - 反比例の表・式
16. inverse_word - 反比例の文章題

### expression (文字と式) - 6タイプ
1. expression_make - 数量を文字で表す
2. expression_substitution - 式に数を代入する
3. expression_word_to_expression - 文章を式にする
4. expression_meaning - 式の意味を読み取る
5. expression_blank - □を使った問題
6. expression_multi_condition - 複数条件の問題

### combinatorics (場合の数) - 8タイプ
1. arrange_simple - 単純な並べ方
2. arrange_condition - 条件付きの並べ方
3. combine_simple - 単純な組み合わせ
4. combine_condition - 条件付きの組み合わせ
5. combine_daily - 身近な場面での組み合わせ
6. arrange_tree - 樹形図の利用
7. combine_table - 表を使った整理
8. duplicate_removal - 重複を除く

### data (データの活用) - 10タイプ
1. data_average - 平均を求める
2. data_total_from_average - 平均から合計を求める
3. data_frequency_table - 度数分布表
4. data_bar_graph - 柱状グラフから読み取り
5. data_band_graph - 帯グラフ
6. data_dot_plot - ドットプロット
7. data_max_min - 最大値・最小値
8. data_distribution - データの分布
9. data_compare - 複数資料の比較
10. data_judgement - データから判断する問題

## 4. 実装方針

1. 各カテゴリにジェネレータを追加
2. generatorRegistry.ts に登録
3. HomePage.tsx のカテゴリ一覧を全カテゴリに拡張
4. 各ジェネレータに対して1000問生成 + バリデータ通過テスト
5. 全ジェネレータ合計10万問生成テスト
6. COVERAGE.md を更新

## 5. 実装順序

1. numberTheory (既存ユーティリティ活用で最も速い)
2. fraction (fraction.tsユーティリティを活用)
3. speed
4. geometry
5. ratio
6. data
7. expression
8. combinatorics
9. decimal

## 6. 制約

- 小6範囲を超えない (中1方程式・高校確率は追加しない)
- 問題構造の多様性を優先
- 完全ランダムではなく条件制御で生成
- 各Generatorにバリデータを含める