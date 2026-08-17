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
    const matching = candidates.filter((g) => {
      try {
        const p = g.generate({ ...config, difficulty: config.difficulty });
        // 検証を通過し、かつ生成された問題の総合難易度が要求難易度と一致するものだけを選ぶ
        return validateProblem(p).valid && p.difficulty.level === config.difficulty;
      } catch {
        return false;
      }
    });
    if (matching.length > 0) {
      candidates = matching;
    }
  }

  // ランダムにジェネレータを選んで生成
  const index = Math.floor(Math.random() * candidates.length);
  const generator = candidates[index];
  return generateValidatedProblem(generator, config);
}

/**
 * ジェネレータから検証済みの問題を生成する
 */
function generateValidatedProblem(
  generator: ProblemGenerator,
  config?: GenerationConfig,
): Problem {
  for (let attempt = 0; attempt < 100; attempt++) {
    const problem = generator.generate(config);
    const result = validateProblem(problem);
    if (result.valid) {
      return problem;
    }
  }
  throw new Error(
    `問題生成に失敗しました: ${generator.type} が100回試行しても検証を通過できませんでした`,
  );
}