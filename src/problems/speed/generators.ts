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
 *
 * 答えの品質 (Phase 1-C):
 *   道のり÷時間が割り切れないと 27.666666666666668 のような無限小数になり、
 *   小学生は書き表せず入力も判定もできない。
 *   そのため **速さを先に整数で決め、道のり = 速さ × 時間** として生成し、
 *   必ず割り切れるようにする (答えも整数、または小数第1位で終わる値)。
 */
export class SpeedCalculationGenerator implements ProblemGenerator {
  readonly type = 'speed_calculation';
  readonly category = 'speed' as const;
  readonly description = '速さを求める';

  generate(config?: GenerationConfig): Problem {
    const rng = createRandom(config?.seed);
    // Use provided difficulty, default to 2 (normal) if not specified
    const lv = config?.difficulty ?? (2 as DifficultyLevel);

    // 難易度に応じて時間幅と速さの取り方を変化させる
    const time = lv <= 1 ? rng.int(2, 3) : lv === 2 ? rng.int(2, 4) : lv === 3 ? rng.int(3, 5) : lv === 4 ? rng.int(4, 6) : rng.int(5, 8);
    // レベル1では距離・時間・速さがすべて1桁に収まる組み合わせにする
    // レベル2以降は速さを整数で決め、その倍数として距離を組み立てる。
    const speed = lv <= 1 ? rng.int(2, 3) : lv === 2 ? rng.int(10, 30) : lv === 3 ? rng.int(15, 40) : lv === 4 ? rng.int(20, 60) : rng.int(25, 80);
    const dist = speed * time;
    const p = { distUnit: 'km', timeUnit: '時間', time, dist };
    const answer = speed;

    return {
      id: generateProblemId(),
      category: this.category,
      type: this.type,
      difficulty: createSpeedDifficulty(lv, p.dist, 1, Math.min(2, lv) as DifficultyLevel),
      question:
        p.dist + p.distUnit + 'を' + p.time + p.timeUnit + 'で進みました。速さは何' +
        (p.distUnit === 'km' ? 'km' : 'm') + 'ですか（1' + p.timeUnit + 'あたり）',
      answer: { kind: 'decimal', value: answer },
      explanation: '速さ＝道のり÷時間 なので、' + p.dist + '÷' + p.time + '＝' + answer + 'です。',
      parameters: {
        distance: p.dist,
        time: p.time,
        timeUnit: p.timeUnit,
        distUnit: p.distUnit,
        answer: answer,
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
 * 速さの単位変換の問題の構造
 *
 * Phase 2-D:
 *   以前は「時速→分速」の1方向のみで、入力値も60の倍数だけだった。
 *   数値は増えたが、変換の考え方は1種類しかなかった。
 *
 * 採用した変換方向 (いずれも割り切れる入力値だけを使うので有限小数になる):
 *   kmh_to_mmin : 時速 km → 分速 m   (×1000÷60)
 *   mmin_to_kmh : 分速 m → 時速 km   (×60÷1000)
 *   kmh_to_ms   : 時速 km → 秒速 m   (×1000÷3600)
 *   ms_to_kmh   : 秒速 m → 時速 km   (×3600÷1000)
 */
export type SpeedUnitConversionVariant =
  | 'kmh_to_mmin'
  | 'mmin_to_kmh'
  | 'kmh_to_ms'
  | 'ms_to_kmh';

/** 難易度ごとの構造候補 */
const SPEED_UNIT_VARIANTS: Record<DifficultyLevel, SpeedUnitConversionVariant[]> = {
  1: ['kmh_to_mmin'],
  2: ['kmh_to_mmin', 'mmin_to_kmh'],
  3: ['kmh_to_mmin', 'mmin_to_kmh', 'kmh_to_ms'],
  4: ['kmh_to_mmin', 'mmin_to_kmh', 'kmh_to_ms', 'ms_to_kmh'],
  5: ['mmin_to_kmh', 'kmh_to_ms', 'ms_to_kmh'],
};

/**
 * 変換の定義そのもので答えを出す。
 *
 * 1時間 = 60分 = 3600秒、1km = 1000m という関係だけを使う。
 */
function solveSpeedUnitConversion(
  variant: SpeedUnitConversionVariant,
  value: number,
): { answer: number; question: string; explanation: string } {
  switch (variant) {
    case 'kmh_to_mmin':
      return {
        answer: (value * 1000) / 60,
        question: '時速' + value + 'kmは、分速何mですか',
        explanation:
          '時速' + value + 'kmは、1時間に' + value * 1000 + 'm進みます。' +
          '1時間は60分なので、' + value * 1000 + '÷60＝' + (value * 1000) / 60 + 'mです。',
      };
    case 'mmin_to_kmh':
      return {
        answer: (value * 60) / 1000,
        question: '分速' + value + 'mは、時速何kmですか',
        explanation:
          '分速' + value + 'mは、1時間に' + value * 60 + 'm進みます。' +
          '1000mが1kmなので、' + value * 60 + '÷1000＝' + (value * 60) / 1000 + 'kmです。',
      };
    case 'kmh_to_ms':
      return {
        answer: (value * 1000) / 3600,
        question: '時速' + value + 'kmは、秒速何mですか',
        explanation:
          '時速' + value + 'kmは、1時間に' + value * 1000 + 'm進みます。' +
          '1時間は3600秒なので、' + value * 1000 + '÷3600＝' + (value * 1000) / 3600 + 'mです。',
      };
    case 'ms_to_kmh':
      return {
        answer: (value * 3600) / 1000,
        question: '秒速' + value + 'mは、時速何kmですか',
        explanation:
          '秒速' + value + 'mは、1時間に' + value * 3600 + 'm進みます。' +
          '1000mが1kmなので、' + value * 3600 + '÷1000＝' + (value * 3600) / 1000 + 'kmです。',
      };
  }
}

/** 構造と乱数から、割り切れる入力値を一緒に選ぶ */
function pickSpeedParams(
  rng: ReturnType<typeof createRandom>,
  level: DifficultyLevel,
): { variant: SpeedUnitConversionVariant; value: number } {
  for (let attempt = 0; attempt < 60; attempt++) {
    const variant = rng.pick(SPEED_UNIT_VARIANTS[level]);
    // 答えが必ず割り切れるよう、分母の約数倍数を入力値にする。
    // (×1000÷60)  -> 60 の倍数
    // (×60÷1000)  -> 50 の倍数 (1200 の約数)
    // (×1000÷3600)-> 18 の倍数 (3600 の約数)
    // (×3600÷1000)-> 25 の倍数 (3600 の約数)
    let step: number;
    let base: number;
    switch (variant) {
      case 'kmh_to_mmin':
        step = 60;
        base = 1;
        break;
      case 'mmin_to_kmh':
        step = 50;
        base = 1;
        break;
      case 'kmh_to_ms':
        step = 18;
        base = 2;
        break;
      case 'ms_to_kmh':
        step = 25;
        base = 1;
        break;
    }
    const kMax = level <= 1 ? 3 : level === 2 ? 6 : level === 3 ? 10 : level === 4 ? 15 : 20;
    const value = step * (base + rng.int(0, Math.max(1, kMax - base)));
    return { variant, value };
  }
  return { variant: 'kmh_to_mmin', value: 60 };
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

    const { variant, value } = pickSpeedParams(rng, lv);
    const res = solveSpeedUnitConversion(variant, value);

    return {
      id: generateProblemId(),
      category: this.category,
      type: this.type,
      difficulty: createSpeedDifficulty(
        lv,
        // 数値の複雑さは「問題文に現れる入力値」で決める。
        // 変換後の答え (例: 分速2000m) は4桁になり、
        // それを基準にすると difficulty が指定された lv より上がってしまう。
        value,
        // 思考・読解の複雑さは Phase 1-C 従来と同じ設定を維持する
        // (lv1・lv2 がベースラインとして記録されているため、ここを変えると
        //  既存のベースラインが壊れ「新しく無視している組」になる)。
        2,
        1,
      ),
      question: res.question,
      answer: { kind: 'decimal', value: res.answer },
      explanation: res.explanation,
      parameters: {
        // 旧パラメータ (kmPerHour) は他コードから参照される可能性があるため残す。
        // km 以外の単位を変換する variant では 0 とする。
        kmPerHour: variant === 'kmh_to_mmin' || variant === 'kmh_to_ms' ? value : 0,
        givenValue: value,
        variant,
        conversionType: variant,
        answer: res.answer,
        difficultyLevel: lv,
      },
    };
  }

  validate(problem: Problem): ValidationResult {
    const errors: string[] = [];
    const { givenValue, variant, answer } = problem.parameters as {
      givenValue: number;
      variant: SpeedUnitConversionVariant;
      answer: number;
    };
    if (!Number.isFinite(givenValue) || givenValue <= 0) {
      errors.push('変換する速さが正の値ではありません');
      return { valid: false, errors };
    }
    const expected = solveSpeedUnitConversion(variant, givenValue).answer;
    if (Math.abs(expected - answer) > 1e-9) {
      errors.push('単位変換の計算が誤っています');
    }
    // 答えは整数、または小数第1位で終わる有限小数である必要がある
    const rounded = Math.round(expected * 100) / 100;
    if (Math.abs(rounded - expected) > 1e-9) {
      errors.push('答えが有限小数で表せません');
    }
    if (problem.answer.kind !== 'decimal') {
      errors.push('問題の解答が小数になっていません');
    }
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
        // 答えの品質 (Phase 1-C): 平均 = 合計距離 / 合計時間 が割り切れないと
    // 5.142857142857143 のような無限小数になり、小学生は書き表せない。
    // 合計時間が合成数 (2x3, 4x3 ...) だと割り切れない組合せが多いため、
    // 「合計距離/合計時間で割り切れる」組合せだけを採用する。
    // 再抽選しても条件を満たす組合せが無い場合は、合計時間を 2 の倍数に
    // 固定してから距離側を調整して、有限小数を保証する。
    let speed1 = 0;
    let time1 = 0;
    let speed2 = 0;
    let time2 = 0;
    let dist1 = 0;
    let dist2 = 0;
    let totalDist = 0;
    let totalTime = 0;
    let avgSpeed = 0;
    let ok = false;
    for (let attempt = 0; attempt < 200 && !ok; attempt++) {
      speed1 = rng.int(3, maxSpeed);
      time1 = rng.int(2, maxTime);
      speed2 = speed1 + rng.int(1, lv <= 1 ? 3 : lv === 2 ? 4 : lv === 3 ? 6 : lv === 4 ? 8 : 12);
      time2 = rng.int(2, maxTime);
      dist1 = speed1 * time1;
      dist2 = speed2 * time2;
      totalDist = dist1 + dist2;
      totalTime = time1 + time2;
      // 平均速さが整数になる組合せだけを採る (整数の答えだけを生成する)
      ok = totalDist % totalTime === 0;
    }
    if (!ok) {
      // 総時間を 2 の倍数に確定させ、その倍数になる総距離へ調整する
      time1 = 2;
      time2 = 2;
      totalTime = time1 + time2;
      speed1 = rng.int(3, maxSpeed);
      dist1 = speed1 * time1;
      const targetTotal = Math.ceil((dist1 + speed2 * time2) / totalTime) * totalTime;
      // dist2 を 2 の倍数として総距離に合わせる
      dist2 = targetTotal - dist1;
      while (dist2 < 2) dist2 += totalTime;
      speed2 = dist2 / time2;
      totalDist = dist1 + dist2;
      avgSpeed = totalDist / totalTime;
    } else {
      avgSpeed = totalDist / totalTime;
    }
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