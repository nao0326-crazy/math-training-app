/**
 * 問題ジェネレータのレジストリ
 * 全ジェネレータを一元管理し、カテゴリ・タイプ・難易度から選択できるようにする
 */

import type {
  Category,
  GenerationConfig,
  Problem,
  ProblemGenerator,
} from '../../types/problem';
import {
  AdditionGenerator,
  SubtractionGenerator,
  MultiplicationGenerator,
  DivisionGenerator,
} from '../../problems/arithmetic/integer/basicOperations';
import {
  MultiStepGenerator,
  FillBlankGenerator,
} from '../../problems/arithmetic/integer/multiStep';
import { IntegerWordProblemGenerator } from '../../problems/arithmetic/integer/wordProblems';
import {
  DivisorsFindingGenerator,
  DivisorsCountGenerator,
  MultiplesFindingGenerator,
  PrimeJudgmentGenerator,
  PrimeRangeGenerator,
  CommonDivisorsGenerator,
  CommonMultiplesGenerator,
  GcdCalculationGenerator,
  LcmCalculationGenerator,
  GcdLcmWordGenerator,
  PeriodRepetitionGenerator,
} from '../../problems/numberTheory/generators';
import {
  FractionMulIntegerGenerator,
  FractionMulFractionGenerator,
  FractionDivIntegerGenerator,
  FractionDivFractionGenerator,
  FractionMulMixedGenerator,
  FractionMixedDivGenerator,
  FractionReduceGenerator,
  FractionCommonDenominatorGenerator,
  FractionMixedConvertGenerator,
  FractionBigSmallGenerator,
} from '../../problems/fraction/generators';
import {
  SpeedCalculationGenerator,
  DistanceCalculatorGenerator,
  TimeCalculatorGenerator,
  SpeedUnitConversionGenerator,
  SpeedComparisonGenerator,
  SpeedWordGenerator,
  SpeedMultiStepGenerator,
} from '../../problems/speed/generators';
import {
  CircleAreaFromRadiusGenerator,
  CircleAreaFromDiameterGenerator,
  CircleRadiusFromAreaGenerator,
  VolumeBoxGenerator,
  VolumeCubeGenerator,
  VolumePrismGenerator,
  VolumeCylinderGenerator,
  VolumeFromHeightGenerator,
  VolumeUnitGenerator,
  SymmetryFoldGenerator,
  SymmetryPointGenerator,
  ScaleLengthGenerator,
  AngleBasicGenerator,
} from '../../problems/geometry/generators';
import {
  RatioSimplifyGenerator,
  RatioValueGenerator,
  RatioEqualQuestionGenerator,
  RatioQuantityGenerator,
  ProportionalExpressionGenerator,
  ProportionalWordGenerator,
  InverseExpressionGenerator,
  InverseWordGenerator,
} from '../../problems/ratio/generators';
import {
  DecimalMulDecimalGenerator,
  DecimalDivDecimalGenerator,
  DecimalMulIntegerGenerator,
  DecimalDivIntegerGenerator,
  DecimalRoundGenerator,
} from '../../problems/decimal/generators';
import {
  ExpressionMakeGenerator,
  ExpressionSubstitutionGenerator,
  ExpressionWordToExpressionGenerator,
  ExpressionMeaningGenerator,
  ExpressionBlankGenerator,
  ExpressionComplexGenerator,
} from '../../problems/expression/generators';
import {
  ArrangeSimpleGenerator,
  CombineSimpleGenerator,
  TreeDiagramGenerator,
  CombineTableGenerator,
  DuplicateRemovalGenerator,
} from '../../problems/combinatorics/generators';
import {
  DataAverageGenerator,
  DataTotalFromAverageGenerator,
  DataMaxMinGenerator,
  DataCompareGenerator,
} from '../../problems/data/generators';
import { validateProblem } from '../validator/validator';
// 解法表示 (solutionSteps) を全出題経路に添付するため SolutionGenerator を組み込む
import { attachSolutionSteps } from '../solution/solutionGenerator';
// シード派生・自動シード・選択用乱数 (数値固定問題の根本修正で使用)
import { createRandom, deriveSeed, nextAutoSeed } from '../../utils/random';

/**
 * 全ジェネレータのリスト
 */
const GENERATORS: ProblemGenerator[] = [
  // 整数
  new AdditionGenerator(),
  new SubtractionGenerator(),
  new MultiplicationGenerator(),
  new DivisionGenerator(),
  new MultiStepGenerator(),
  new FillBlankGenerator(),
  new IntegerWordProblemGenerator(),
  // 数の性質
  new DivisorsFindingGenerator(),
  new DivisorsCountGenerator(),
  new MultiplesFindingGenerator(),
  new PrimeJudgmentGenerator(),
  new PrimeRangeGenerator(),
  new CommonDivisorsGenerator(),
  new CommonMultiplesGenerator(),
  new GcdCalculationGenerator(),
  new LcmCalculationGenerator(),
  new GcdLcmWordGenerator(),
  new PeriodRepetitionGenerator(),
  // 分数
  new FractionMulIntegerGenerator(),
  new FractionMulFractionGenerator(),
  new FractionDivIntegerGenerator(),
  new FractionDivFractionGenerator(),
  new FractionMulMixedGenerator(),
  new FractionMixedDivGenerator(),
  new FractionReduceGenerator(),
  new FractionCommonDenominatorGenerator(),
  new FractionMixedConvertGenerator(),
  new FractionBigSmallGenerator(),
  // 速さ
  new SpeedCalculationGenerator(),
  new DistanceCalculatorGenerator(),
  new TimeCalculatorGenerator(),
  new SpeedUnitConversionGenerator(),
  new SpeedComparisonGenerator(),
  new SpeedWordGenerator(),
  new SpeedMultiStepGenerator(),
  // 図形
  new CircleAreaFromRadiusGenerator(),
  new CircleAreaFromDiameterGenerator(),
  new CircleRadiusFromAreaGenerator(),
  new VolumeBoxGenerator(),
  new VolumeCubeGenerator(),
  new VolumePrismGenerator(),
  new VolumeCylinderGenerator(),
  new VolumeFromHeightGenerator(),
  new VolumeUnitGenerator(),
  new SymmetryFoldGenerator(),
  new SymmetryPointGenerator(),
  new ScaleLengthGenerator(),
  new AngleBasicGenerator(),
  // 比・比例
  new RatioSimplifyGenerator(),
  new RatioValueGenerator(),
  new RatioEqualQuestionGenerator(),
  new RatioQuantityGenerator(),
  new ProportionalExpressionGenerator(),
  new ProportionalWordGenerator(),
  new InverseExpressionGenerator(),
  new InverseWordGenerator(),
  // 小数
  new DecimalMulDecimalGenerator(),
  new DecimalDivDecimalGenerator(),
  new DecimalMulIntegerGenerator(),
  new DecimalDivIntegerGenerator(),
  new DecimalRoundGenerator(),
  // 文字と式
  new ExpressionMakeGenerator(),
  new ExpressionSubstitutionGenerator(),
  new ExpressionWordToExpressionGenerator(),
  new ExpressionMeaningGenerator(),
  new ExpressionBlankGenerator(),
  new ExpressionComplexGenerator(),
  // 場合の数
  new ArrangeSimpleGenerator(),
  new CombineSimpleGenerator(),
  new TreeDiagramGenerator(),
  new CombineTableGenerator(),
  new DuplicateRemovalGenerator(),
  // データの活用
  new DataAverageGenerator(),
  new DataTotalFromAverageGenerator(),
  new DataMaxMinGenerator(),
  new DataCompareGenerator(),
];

/**
 * ジェネレータをタイプで検索する
 */
export function getGeneratorByType(type: string): ProblemGenerator | undefined {
  return GENERATORS.find((g) => g.type === type);
}

/**
 * カテゴリに属するジェネレータを取得する
 */
export function getGeneratorsByCategory(category: Category): ProblemGenerator[] {
  return GENERATORS.filter((g) => g.category === category);
}

/**
 * 全ジェネレータを取得する
 */
export function getAllGenerators(): ProblemGenerator[] {
  return [...GENERATORS];
}

/**
 * カテゴリの一覧を取得する
 */
export function getCategories(): Category[] {
  const categories = new Set<Category>();
  for (const g of GENERATORS) {
    categories.add(g.category);
  }
  return [...categories];
}

/**
 * 問題を生成する
 * 生成後、自動検証を通過した問題のみを返す
 */
export function generateProblem(config?: GenerationConfig): Problem {
  // 試行用シードを作る。
  // - シード未指定: 試行ごとに独立した自動シード
  //   (旧実装は attempt=0,1,2... をそのままシードにしており、
  //    ほぼ全ケースが1回目で検証を通過するため常に seed=0 の問題が返って
  //    全単元で数値が固定する不具合の原因になっていた)
  // - シード指定あり: ベースシードから試行番号で派生させる
  //   (旧実装は全試行で同じシードを再利用していたため、難易度絞り込みの
  //    「20回試行」が実質1回しか機能せず、まれに該当ジェネレータが
  //    見つからない状態になっていた)
  const probe = (attempt: number): GenerationConfig => {
    if (config?.seed !== undefined) {
      return { ...config, seed: deriveSeed(config.seed, attempt) };
    }
    return { ...config, seed: nextAutoSeed() };
  };

  // タイプ指定があればそのジェネレータを使用
  if (config?.type) {
    const generator = getGeneratorByType(config.type);
    if (!generator) {
      throw new Error(`不明な問題タイプです: ${config.type}`);
    }
    return generateValidatedProblem(generator, config);
  }

  // カテゴリ指定があればそのカテゴリから選ぶ
  let candidates = GENERATORS;
  if (config?.category) {
    candidates = getGeneratorsByCategory(config.category);
    if (candidates.length === 0) {
      throw new Error(`カテゴリに問題がありません: ${config.category}`);
    }
  }

  // 難易度指定があればその難易度に合うものを優先
  if (config?.difficulty) {
    const requestedDifficulty = config.difficulty;
    // 各ジェネレータを複数回試行して、指定難易度に一致する問題を生成できるものを探す
    const matching = candidates.filter((g) => {
      try {
        // 複数回試行して、指定難易度に一致する問題が生成できるか確認
        for (let attempt = 0; attempt < 20; attempt++) {
          const p = g.generate({ ...probe(attempt), difficulty: requestedDifficulty });
          if (validateProblem(p).valid && p.difficulty.level === requestedDifficulty) {
            return true;
          }
        }
        return false;
      } catch {
        return false;
      }
    });

    if (matching.length > 0) {
      // 指定難易度を生成できるジェネレータからランダムに選ぶ
      candidates = matching;
    } else {
      // 指定難易度を生成できるジェネレータがない場合は、
      // 全ジェネレータからランダムに選び、指定難易度に一致する問題を生成する
      // (フォールバック: 指定難易度に一致する問題を生成できるジェネレータを探す)
      const fallback = candidates.filter((g) => {
        try {
          for (let attempt = 0; attempt < 20; attempt++) {
            const p = g.generate({ ...probe(attempt + 20), difficulty: requestedDifficulty });
            if (validateProblem(p).valid && p.difficulty.level === requestedDifficulty) {
              return true;
            }
          }
          return false;
        } catch {
          return false;
        }
      });
      if (fallback.length > 0) {
        candidates = fallback;
      }
    }
  }

  // ランダムにジェネレータを選んで生成
  // シード指定時はシードから決定論的に選ぶことで「seedで確定する」再現性を保証する
  // (シード未指定時は Math.random による非決定的な選択のまま)
  const index =
    config?.seed !== undefined
      ? createRandom(deriveSeed(config.seed, 0x7ea1)).int(0, candidates.length - 1)
      : Math.floor(Math.random() * candidates.length);
  const generator = candidates[index];
  return generateValidatedProblem(generator, config);
}

function generateValidatedProblem(
  generator: ProblemGenerator,
  config?: GenerationConfig,
): Problem {
  // 指定難易度への一致は確率的な抽選になるため、
  // めったに出ない難易度でも失敗しないよう十分な回数を試行する。
  // 試行ごとにシードを派生させて異なる数値を試す。
  // (旧実装は seed 指定時に毎回同じシードを再利用していたため、
  //  そのシードで検証や難易度一致を外すと結果が不変のまま最大3000回
  //  ループして必ず失敗しており、候補不足→固定問題フォールバックの一因だった)
  const maxAttempts = config?.difficulty ? 300 : 100;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    let problem: Problem;
    try {
      problem = generator.generate(probeSeed(config, attempt));
    } catch {
      // 一部のジェネレータ (例: 反比例の文章題) は条件を満たす数値が
      // 見つからない場合に例外を投げる。これは「このシードでは生成不可」
      // という意味なので、試行を無効として次の子シードで再抽選する。
      // (旧実装はここで即 throw していたため、まれに出題経路全体が失敗した)
      continue;
    }
    const result = validateProblem(problem);
    if (result.valid) {
      // 難易度指定がある場合は、指定難易度と一致することを確認
      if (config?.difficulty && problem.difficulty.level !== config.difficulty) {
        continue;
      }
      // 正解と同じパラメータから途中式を組み立てて添付する
      return attachSolutionSteps(problem);
    }
  }
  throw new Error(
    `問題生成に失敗しました: ${generator.type} が${maxAttempts}回試行しても検証を通過できませんでした`,
  );
}

/**
 * 試行ごとのシードを決める
 * - シード指定あり: ベースシードから試行番号で決定論的に派生させる
 *   (同一シードの使い回しによる「実質リトライ無し」を防ぎつつ、
 *    同じ (seed, attempt) を与えれば常に同じ問題になる再現性は維持する)
 * - シード未指定: 試行ごとに独立した自動シード
 *   (旧実装は attempt=0 の固定シードをほぼ常に使用するため全単元で数値が固定していた)
 */
function probeSeed(config: GenerationConfig | undefined, attempt: number): GenerationConfig {
  if (config?.seed !== undefined) {
    return { ...config, seed: deriveSeed(config.seed, attempt) };
  }
  return { ...config, seed: nextAutoSeed() };
}
