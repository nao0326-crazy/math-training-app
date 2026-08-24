/**
 * 速さの問題ジェネレータ
 * 小学6年生の学習範囲
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

/**
 * 速さ問題の難易度を作成する
 */
function createSpeedDifficulty(
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
 * 速さを求める問題
 * 例: 120kmを2時間で進むと速さは?
 */
export class SpeedCalculationGenerator implements ProblemGenerator {
  readonly type = 'speed_calculation';
  readonly category = 'speed' as const;
  readonly description = '速さを求める';

  generate(config?: GenerationConfig): Problem {
    const rng = createRandom(config?.seed);
    // Use provided difficulty, default to 2 (normal) if not specified
    const lv = config?.difficulty ?? (2 as DifficultyLevel);

    // 難易度に応じて距離と時間を変化させる
    const time = lv <= 1 ? rng.int(2, 3) : lv === 2 ? rng.int(2, 4) : lv === 3 ? rng.int(3, 5) : lv === 4 ? rng.int(4, 6) : rng.int(5, 8);
    const dist = lv <= 1 ? rng.int(10, 30) : lv === 2 ? rng.int(30, 100) : lv === 3 ? rng.int(60, 200) : lv === 4 ? rng.int(100, 400) : rng.int(200, 800);
    const p = { distUnit: 'km', timeUnit: '時間', time, dist };
    const speed = p.dist / p.time;

    return {
      id: generateProblemId(),
      category: this.category,
      type: this.type,
      difficulty: createSpeedDifficulty(lv, p.dist, 1, 2),
      question:
        p.dist + p.distUnit + 'を' + p.time + p.timeUnit + 'で進みました。速さは何' +
        (p.distUnit === 'km' ? 'km' : 'm') + 'ですか（1' + p.timeUnit + 'あたり）',
      answer: { kind: 'decimal', value: speed },
      explanation: '速さ＝道のり÷時間 なので、' + p.dist + '÷' + p.time + '＝' + speed + 'です。',
      parameters: {
        distance: p.dist,
        time: p.time,
        timeUnit: p.timeUnit,
        distUnit: p.distUnit,
        answer: speed,
        difficultyLevel: lv,
      },
    };
  }

  validate(problem: Problem): ValidationResult {
    const errors: string[] = [];
    const { distance, time, answer } = problem.parameters as {
      distance: number;
      time: number;
      answer: number;
    };
    if (time === 0) errors.push('時間が0です');
    const expected = distance / time;
    if (Math.abs(expected - answer) > 1e-9) errors.push('速さの計算が誤っています');
    return { valid: errors.length === 0, errors };
  }
}

/**
 * 道のりを求める問題
 * 例: 時速60kmで3時間走ると?
 */
export class DistanceCalculatorGenerator implements ProblemGenerator {
  readonly type = 'distance_calculation';
  readonly category = 'speed' as const;
  readonly description = '道のりを求める';

  generate(config?: GenerationConfig): Problem {
    const rng = createRandom(config?.seed);
    // Use provided difficulty, default to 2 (normal) if not specified
    const lv = config?.difficulty ?? (2 as DifficultyLevel);

    // 難易度に応じて速さと時間を変化させる
    const speed = lv <= 1 ? rng.int(2, 10) : lv === 2 ? rng.int(5, 30) : lv === 3 ? rng.int(10, 50) : lv === 4 ? rng.int(20, 80) : rng.int(30, 120);
    const time = lv <= 1 ? rng.int(2, 5) : lv === 2 ? rng.int(2, 10) : lv === 3 ? rng.int(3, 12) : lv === 4 ? rng.int(4, 15) : rng.int(5, 20);
    const dist = speed * time;

    return {
      id: generateProblemId(),
      category: this.category,
      type: this.type,
      difficulty: createSpeedDifficulty(lv, dist, 2, 1),
      question: '時速' + speed + 'kmで' + time + '時間走ると、何km進みますか',
      answer: { kind: 'integer', value: dist },
      explanation: '道のり＝速さ×時間 なので、' + speed + '×' + time + '＝' + dist + 'です。',
      parameters: { speed, time, answer: dist, difficultyLevel: lv },
    };
  }

  validate(problem: Problem): ValidationResult {
    const errors: string[] = [];
    const { speed, time, answer } = problem.parameters as {
      speed: number;
      time: number;
      answer: number;
    };
    if (speed * time !== answer) errors.push('道のりが誤っています');
    return { valid: errors.length === 0, errors };
  }
}

/**
 * 時間を求める問題
 */
export class TimeCalculatorGenerator implements ProblemGenerator {
  readonly type = 'time_calculation';
  readonly category = 'speed' as const;
  readonly description = '時間を求める';

  generate(config?: GenerationConfig): Problem {
    const rng = createRandom(config?.seed);
    // Use provided difficulty, default to 2 (normal) if not specified
    const lv = config?.difficulty ?? (2 as DifficultyLevel);

    // 難易度に応じて速さと時間を変化させる
    const speed = lv <= 1 ? rng.int(2, 10) : lv === 2 ? rng.int(2, 20) : lv === 3 ? rng.int(5, 30) : lv === 4 ? rng.int(10, 50) : rng.int(20, 80);
    const time = lv <= 1 ? rng.int(1, 5) : lv === 2 ? rng.int(1, 8) : lv === 3 ? rng.int(2, 10) : lv === 4 ? rng.int(3, 12) : rng.int(4, 15);
    const dist = speed * time;

    return {
      id: generateProblemId(),
      category: this.category,
      type: this.type,
      difficulty: createSpeedDifficulty(lv, time, 2, 1),
      question: '時速' + speed + 'kmで' + dist + 'km進むと、何時間かかりますか',
      answer: { kind: 'integer', value: time },
      explanation: '時間＝道のり÷速さ なので、' + dist + '÷' + speed + '＝' + time + 'です。',
      parameters: { speed, distance: dist, answer: time, difficultyLevel: lv },
    };
  }

  validate(problem: Problem): ValidationResult {
    const errors: string[] = [];
    const { speed, distance, answer } = problem.parameters as {
      speed: number;
      distance: number;
      answer: number;
    };
    if (distance / speed !== answer) errors.push('時間が誤っています');
    return { valid: errors.length === 0, errors };
  }
}

/**
 * 速さの単位変換問題
 * 例: 時速60kmは分速何m?
 */
export class SpeedUnitConversionGenerator implements ProblemGenerator {
  readonly type = 'speed_unit_conversion';
  readonly category = 'speed' as const;
  readonly description = '速さの単位変換';

  generate(config?: GenerationConfig): Problem {
    const rng = createRandom(config?.seed);
    // Use provided difficulty, default to 2 (normal) if not specified
    const lv = config?.difficulty ?? (2 as DifficultyLevel);

    // 難易度に応じて時速を変化させる
    const kmPerHour = lv <= 1 ? rng.int(1, 3) * 6 : lv === 2 ? rng.int(1, 6) * 6 : lv === 3 ? rng.int(2, 8) * 6 : lv === 4 ? rng.int(3, 10) * 6 : rng.int(4, 15) * 6;
    const metersPerMinute = (kmPerHour * 1000) / 60;

    return {
      id: generateProblemId(),
      category: this.category,
      type: this.type,
      difficulty: createSpeedDifficulty(lv, kmPerHour, 2, 1),
      question: '時速' + kmPerHour + 'kmは、分速何mですか',
      answer: { kind: 'decimal', value: metersPerMinute },
      explanation:
        '時速' + kmPerHour + 'km＝' + kmPerHour * 1000 + 'm' +
        'を60分で進むので、' + kmPerHour * 1000 + '÷60＝' + metersPerMinute + 'm/分です。',
      parameters: {
        kmPerHour,
        answer: metersPerMinute,
        difficultyLevel: lv,
        conversionType: 'kmh_to_mmin',
      },
    };
  }

  validate(problem: Problem): ValidationResult {
    const errors: string[] = [];
    const { kmPerHour, answer } = problem.parameters as {
      kmPerHour: number;
      answer: number;
    };
    const expected = (kmPerHour * 1000) / 60;
    if (Math.abs(expected - answer) > 1e-6) errors.push('分速への変換が誤っています');
    return { valid: errors.length === 0, errors };
  }
}

/**
 * 速さの比較問題
 */
export class SpeedComparisonGenerator implements ProblemGenerator {
  readonly type = 'speed_comparison';
  readonly category = 'speed' as const;
  readonly description = '速さの比較';

  generate(config?: GenerationConfig): Problem {
    const rng = createRandom(config?.seed);
    // Use provided difficulty, default to 2 (normal) if not specified
    const lv = config?.difficulty ?? (2 as DifficultyLevel);

    for (let attempt = 0; attempt < 100; attempt++) {
      // 難易度に応じて速さの範囲を変化させる
      const maxSpeed = lv <= 1 ? 10 : lv === 2 ? 20 : lv === 3 ? 40 : lv === 4 ? 60 : 100;
      const speedA = rng.int(3, maxSpeed);
      const speedB = rng.int(3, maxSpeed);
      if (speedA === speedB) continue;

      const faster = speedA > speedB ? 'たろうさん' : 'はなこさん';

      return {
        id: generateProblemId(),
        category: this.category,
        type: this.type,
        difficulty: createSpeedDifficulty(lv, Math.max(speedA, speedB), 2, 2),
        question:
          'たろうさんは時速' + speedA + 'km、はなこさんは時速' + speedB + 'kmで進みます。どちらが速いですか',
        answer: { kind: 'string', value: faster },
        explanation:
          faster + 'の方が速いです。速さは時速' + (speedA > speedB ? speedA : speedB) + 'kmです。',
        parameters: { speedA, speedB, answer: faster, difficultyLevel: lv },
      };
    }
    throw new Error('速さの比較問題を生成できませんでした');
  }

  validate(problem: Problem): ValidationResult {
    const errors: string[] = [];
    const { speedA, speedB, answer } = problem.parameters as {
      speedA: number;
      speedB: number;
      answer: string;
    };
    const expected = speedA > speedB ? 'たろうさん' : 'はなこさん';
    if (answer !== expected) errors.push('速さの比較が誤っています');
    return { valid: errors.length === 0, errors };
  }
}

/**
 * 速さの文章題
 */
export class SpeedWordGenerator implements ProblemGenerator {
  readonly type = 'speed_word';
  readonly category = 'speed' as const;
  readonly description = '速さの文章題';

  generate(config?: GenerationConfig): Problem {
    const rng = createRandom(config?.seed);
    // Use provided difficulty, default to 2 (normal) if not specified
    const lv = config?.difficulty ?? (2 as DifficultyLevel);

    // 難易度に応じて速さと時間を変化させる
    const speed = lv <= 1 ? rng.int(20, 60) : lv === 2 ? rng.int(40, 90) : lv === 3 ? rng.int(60, 120) : lv === 4 ? rng.int(80, 150) : rng.int(100, 200);
    const time = lv <= 1 ? rng.int(2, 5) : lv === 2 ? rng.int(2, 6) : lv === 3 ? rng.int(3, 8) : lv === 4 ? rng.int(4, 10) : rng.int(5, 12);
    const unit = lv <= 2 ? '分' : '時間';
    const question = unit === '分'
      ? 'おうちから学校まで分速' + speed + 'mで歩くと' + time + '分かかります。学校までは何mですか。'
      : '自動車で時速' + speed + 'kmで' + time + '時間走ると何km進みますか。';
    const s = { speed, time, unit, question };
    const ans = s.speed * s.time;

    return {
      id: generateProblemId(),
      category: this.category,
      type: this.type,
      difficulty: createSpeedDifficulty(lv, ans, 2, 2),
      question: s.question,
      answer: { kind: 'integer', value: ans },
      explanation: '道のり＝速さ×時間 なので、' + s.speed + '×' + s.time + '＝' + ans + 'です。',
      parameters: { speed: s.speed, time: s.time, answer: ans, scenario: String(lv), difficultyLevel: lv },
    };
  }

  validate(problem: Problem): ValidationResult {
    const errors: string[] = [];
    const { speed, time, answer } = problem.parameters as {
      speed: number;
      time: number;
      answer: number;
    };
    if (speed * time !== answer) errors.push('文章題の答えが誤っています');
    return { valid: errors.length === 0, errors };
  }
}

/**
 * 速さの複数段階の問題
 * 例: 時速Xkmで... その後... 全体の時間
 */
export class SpeedMultiStepGenerator implements ProblemGenerator {
  readonly type = 'speed_multi_step';
  readonly category = 'speed' as const;
  readonly description = '複数段階の速さ問題';

  generate(config?: GenerationConfig): Problem {
    const rng = createRandom(config?.seed);
    // Use provided difficulty, default to 2 (normal) if not specified
    const lv = config?.difficulty ?? (2 as DifficultyLevel);

    // 難易度に応じて速さと時間を変化させる
    const maxSpeed = lv <= 1 ? 8 : lv === 2 ? 12 : lv === 3 ? 20 : lv === 4 ? 30 : 50;
    const maxTime = lv <= 1 ? 4 : lv === 2 ? 5 : lv === 3 ? 6 : lv === 4 ? 8 : 10;
    const speed1 = rng.int(3, maxSpeed);
    const time1 = rng.int(2, maxTime);
    const speed2 = speed1 + rng.int(1, lv <= 1 ? 3 : lv === 2 ? 4 : lv === 3 ? 6 : lv === 4 ? 8 : 12);
    const time2 = rng.int(2, maxTime);

    const dist1 = speed1 * time1;
    const dist2 = speed2 * time2;
    const totalDist = dist1 + dist2;
    const totalTime = time1 + time2;
    const avgSpeed = totalDist / totalTime;

    const q =
      'はじめの' + time1 + '時間は時速' + speed1 + 'kmで走り、つぎの' + time2 + '時間は時速' + speed2 + 'kmで走りました。' +
      '走った距離は全部で何kmですか。また平均の速さは時速何kmですか（2つ目の答えを入力）';

    return {
      id: generateProblemId(),
      category: this.category,
      type: this.type,
      difficulty: createSpeedDifficulty(lv, totalDist, 3, 3),
      question: q,
      answer: { kind: 'decimal', value: avgSpeed },
      explanation:
        '前半：' + speed1 + '×' + time1 + '＝' + dist1 + 'km、後半：' + speed2 + '×' + time2 + '＝' + dist2 + 'km、' +
        '合計：' + totalDist + 'km、平均速度：' + totalDist + '÷' + totalTime + '＝' + avgSpeed + 'km/hです。',
      parameters: {
        speed1,
        time1,
        speed2,
        time2,
        totalDistance: totalDist,
        totalTime,
        averageSpeed: avgSpeed,
        answer: avgSpeed,
        difficultyLevel: lv,
      },
    };
  }

  validate(problem: Problem): ValidationResult {
    const errors: string[] = [];
    const { speed1, time1, speed2, time2, totalDistance, totalTime, averageSpeed } = problem.parameters as {
      speed1: number;
      time1: number;
      speed2: number;
      time2: number;
      totalDistance: number;
      totalTime: number;
      averageSpeed: number;
    };
    if (totalDistance !== speed1 * time1 + speed2 * time2) errors.push('合計距離が誤っています');
    if (Math.abs(averageSpeed - totalDistance / totalTime) > 1e-9) errors.push('平均速度が誤っています');
    return { valid: errors.length === 0, errors };
  }
}