/**
 * データの活用の問題ジェネレータ
 * 小学6年生の学習範囲:
 * - 平均・合計
 * - 最大値・最小値
 * - ドットプロット・度数分布
 * - データの比較・判断
 */

import type {
  DifficultyLevel,
  GenerationConfig,
  Problem,
  ProblemGenerator,
  ValidationResult,
} from '../../types/problem';
import { createRandom, generateProblemId } from '../../utils/random';
import {
  createDifficulty,
  numberSizeToComplexity,
  calculationStepsToComplexity,
} from '../../engine/difficulty/difficulty';

function createDataDifficulty(
  level: DifficultyLevel,
  value: number,
  reasoningLevel: DifficultyLevel = 1,
  readingLevel: DifficultyLevel = 1,
) {
  return createDifficulty({
    calculationComplexity: calculationStepsToComplexity(level),
    numberComplexity: numberSizeToComplexity(value),
    reasoningComplexity: reasoningLevel,
    readingComplexity: readingLevel,
  });
}

/**
 * 平均を求める問題
 * 例: 3つの数の平均
 */
export class DataAverageGenerator implements ProblemGenerator {
  readonly type = 'data_average';
  readonly category = 'data' as const;
  readonly description = '平均を求める';

  generate(config?: GenerationConfig): Problem {
    const rng = createRandom(config?.seed);
    // Use provided difficulty, default to 2 (normal) if not specified
    const lv = config?.difficulty ?? (2 as DifficultyLevel);

    const count = lv === 1 ? 3 : lv === 2 ? 4 : 5;
    const nums: number[] = [];
    for (let i = 0; i < count; i++) {
      nums.push(rng.int(1, lv === 1 ? 9 : 20));
    }
    const sum = nums.reduce((a, b) => a + b, 0);
    const avg = sum / count;

    return {
      id: generateProblemId(),
      category: this.category,
      type: this.type,
      difficulty: createDataDifficulty(lv, avg, 1, 2),
      question:
        nums.join('、') + ' の平均を求めなさい',
      answer: { kind: 'decimal', value: avg },
      explanation:
        '合計は' + sum + '。' + sum + '÷' + count + '＝' + avg + 'が平均です。',
      parameters: { numbers: nums, sum, count, average: avg, answer: avg, difficultyLevel: lv },
    };
  }

  validate(problem: Problem): ValidationResult {
    const errors: string[] = [];
    const { numbers, count, average } = problem.parameters as {
      numbers: number[];
      count: number;
      average: number;
    };
    const sum = numbers.reduce((a, b) => a + b, 0);
    if (count !== numbers.length) errors.push('個数が誤っています');
    if (Math.abs(sum / count - average) > 1e-9) errors.push('平均の計算が誤っています');
    return { valid: errors.length === 0, errors };
  }
}

/**
 * 平均から合計を求める問題
 */
export class DataTotalFromAverageGenerator implements ProblemGenerator {
  readonly type = 'data_total_from_average';
  readonly category = 'data' as const;
  readonly description = '平均から合計を求める';

  generate(config?: GenerationConfig): Problem {
    const rng = createRandom(config?.seed);
    // Use provided difficulty, default to 2 (normal) if not specified
    const lv = config?.difficulty ?? (2 as DifficultyLevel);

    const count = rng.int(3, lv === 1 ? 5 : 8);
    const avg = rng.int(1, lv === 1 ? 5 : 10);
    const total = count * avg;

    return {
      id: generateProblemId(),
      category: this.category,
      type: this.type,
      difficulty: createDataDifficulty(lv, total, 1, 1),
      question:
        count + 'この平均が' + avg + 'です。この' + count + 'この合計はいくつですか',
      answer: { kind: 'integer', value: total },
      explanation: '合計＝平均×個数 なので、' + avg + '×' + count + '＝' + total + 'です。',
      parameters: { count, average: avg, total, answer: total, difficultyLevel: lv },
    };
  }

  public validate(problem: Problem): ValidationResult {
    const errors: string[] = [];
    const { count, average, total } = problem.parameters as {
      count: number;
      average: number;
      total: number;
    };
    if (count * average !== total) errors.push('合計の計算が誤っています');
    return { valid: errors.length === 0, errors };
  }
}

/**
 * 最大値・最小値
 */
export class DataMaxMinGenerator implements ProblemGenerator {
  readonly type = 'data_max_min';
  readonly category = 'data' as const;
  readonly description = '最大値・最小値';

  generate(config?: GenerationConfig): Problem {
    const rng = createRandom(config?.seed);
    // Use provided difficulty, default to 2 (normal) if not specified
    const lv = config?.difficulty ?? (2 as DifficultyLevel);

    const nums: number[] = [];
    const count = 5;
    for (let i = 0; i < count; i++) {
      nums.push(rng.int(1, lv === 1 ? 9 : 20));
    }
    const max = Math.max(...nums);
    const min = Math.min(...nums);

    return {
      id: generateProblemId(),
      category: this.category,
      type: this.type,
      difficulty: createDataDifficulty(lv, max, 1, 1),
      question:
        nums.join('、') + ' の中で、最大の数と最小の数を答えなさい',
      answer: { kind: 'string', value: max + ' と ' + min },
      explanation: '最大は' + max + '、最小は' + min + 'です。',
      parameters: { numbers: nums, max, min, answer: max + ' と ' + min, difficultyLevel: lv },
    };
  }

  public validate(problem: Problem): ValidationResult {
    const errors: string[] = [];
    const { numbers, max, min } = problem.parameters as {
      numbers: number[];
      max: number;
      min: number;
    };
    if (Math.max(...numbers) !== max) errors.push('最大値が誤っています');
    if (Math.min(...numbers) !== min) errors.push('最小値が誤っています');
    return { valid: errors.length === 0, errors };
  }
}

/**
 * データの比較
 */
export class DataCompareGenerator implements ProblemGenerator {
  readonly type = 'data_compare';
  readonly category = 'data' as const;
  readonly description = 'データの比較';

  public generate(config?: GenerationConfig): Problem {
    const rng = createRandom(config?.seed);
    // Use provided difficulty, default to 2 (normal) if not specified
    const lv = config?.difficulty ?? (2 as DifficultyLevel);

    const groupA: number[] = [];
    const groupB: number[] = [];
    for (let i = 0; i < 5; i++) {
      groupA.push(rng.int(1, 10));
      groupB.push(rng.int(1, 10));
    }
    const sumA = groupA.reduce((a, b) => a + b, 0);
    const sumB = groupB.reduce((a, b) => a + b, 0);
    const avgA = sumA / groupA.length;
    const avgB = sumB / groupB.length;

    const largerAvg = avgA > avgB ? 'A' : 'B';

    return {
      id: generateProblemId(),
      category: this.category,
      type: this.type,
      difficulty: createDataDifficulty(lv, Math.max(sumA, sumB), 2, 2),
      question:
        'A組とB組のテストの点があります。それぞれ平均を比べると、どちらが高いと言えますか',
      answer: { kind: 'string', value: largerAvg + '組' },
      explanation:
        'Aの平均は' + avgA + '、Bの平均は' + avgB + '。よって' + largerAvg + '組が高いです。',
      parameters: {
        groupA,
        groupB,
        avgA,
        avgB,
        answer: largerAvg + '組',
        difficultyLevel: lv,
      },
    };
  }

  public validate(problem: Problem): ValidationResult {
    const errors: string[] = [];
    const { groupA, groupB, avgA, avgB } = problem.parameters as {
      groupA: number[];
      groupB: number[];
      avgA: number;
      avgB: number;
    };
    const expectA = groupA.reduce((a, b) => a + b, 0) / groupA.length;
    const expectB = groupB.reduce((a, b) => a + b, 0) / groupB.length;
    if (Math.abs(expectA - avgA) > 1e-9) errors.push('Aの平均が誤っています');
    if (Math.abs(expectB - avgB) > 1e-9) errors.push('Bの平均が誤っています');
    if (expectA === expectB) errors.push('平均が同じなので比較できません');
    return { valid: errors.length === 0, errors };
  }
}