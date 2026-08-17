/**
 * 図形の問題ジェネレータ
 * 小学6年生の学習範囲:
 * - 円の面積 (半径→面積 直径→面積 面積逆算)
 * - 直方体・立方体・角柱・円柱の体積
 * - 線対称・点対称
 * - 拡大図・縮図
 * - 基本図形の角度
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

const PI = 3.14;

function createGeometryDifficulty(
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
 * 円の面積 (半径→面積)
 */
export class CircleAreaFromRadiusGenerator implements ProblemGenerator {
  readonly type = 'circle_area_radius';
  readonly category = 'geometry' as const;
  readonly description = '円の面積を半径から求める';

  generate(config?: GenerationConfig): Problem {
    const rng = createRandom(config?.seed);
    // Use provided difficulty, default to 2 (normal) if not specified
    const lv = config?.difficulty ?? (2 as DifficultyLevel);

    const radius = lv === 1 ? rng.int(2, 5) : lv === 2 ? rng.int(5, 10) : rng.int(10, 15);
    const area = radius * radius * PI;

    return {
      id: generateProblemId(),
      category: this.category,
      type: this.type,
      difficulty: createGeometryDifficulty(lv, radius, 1, 2),
      question:
        '半径' + radius + 'cmの円の面積を求めなさい。円周率は3.14とします。',
      answer: { kind: 'decimal', value: area },
      explanation:
        '円の面積＝半径×半径×円周率 なので、' + radius + '×' + radius + '×3.14＝' + area + 'cm²です。',
      parameters: {
        radius,
        area,
        answer: area,
        pi: 3.14,
        difficultyLevel: lv,
      },
    };
  }

  validate(problem: Problem): ValidationResult {
    const errors: string[] = [];
    const { radius, area } = problem.parameters as { radius: number; area: number };
    const expected = radius * radius * PI;
    if (Math.abs(expected - area) > 0.001) errors.push('円の面積が誤っています');
    return { valid: errors.length === 0, errors };
  }
}

/**
 * 円の面積 (直径→面積)
 */
export class CircleAreaFromDiameterGenerator implements ProblemGenerator {
  readonly type = 'circle_area_diameter';
  readonly category = 'geometry' as const;
  readonly description = '円の面積を直径から求める';

  generate(config?: GenerationConfig): Problem {
    const rng = createRandom(config?.seed);
    // Use provided difficulty, default to 2 (normal) if not specified
    const lv = config?.difficulty ?? (2 as DifficultyLevel);

    const diameter = lv === 1 ? rng.int(4, 10) : rng.int(10, 20);
    const radius = diameter / 2;
    const area = radius * radius * PI;

    return {
      id: generateProblemId(),
      category: this.category,
      type: this.type,
      difficulty: createGeometryDifficulty(lv, diameter, 1, 2),
      question:
        '直径' + diameter + 'cmの円の面積を求めなさい。円周率は3.14とします。',
      answer: { kind: 'decimal', value: area },
      explanation:
        '半径は' + diameter + '÷2＝' + radius + 'cm。面積＝' + radius + '×' + radius + '×3.14＝' + area + 'cm²です。',
      parameters: {
        diameter,
        radius,
        area,
        difficultyLevel: lv,
      },
    };
  }

  validate(problem: Problem): ValidationResult {
    const errors: string[] = [];
    const { diameter, radius, area } = problem.parameters as { diameter: number; radius: number; area: number };
    if (radius !== diameter / 2) errors.push('半径の計算が誤っています');
    if (Math.abs(radius * radius * PI - area) > 0.001) errors.push('面積が誤っています');
    return { valid: errors.length === 0, errors };
  }
}

/**
 * 円の面積から半径を求める問題
 */
export class CircleRadiusFromAreaGenerator implements ProblemGenerator {
  readonly type = 'circle_radius_from_area';
  readonly category = 'geometry' as const;
  readonly description = '円の面積から半径を求める';

  generate(config?: GenerationConfig): Problem {
    const rng = createRandom(config?.seed);
    // Use provided difficulty, default to 2 (normal) if not specified
    const lv = config?.difficulty ?? (2 as DifficultyLevel);

    // 半径は整数になるようにする
    const radius = rng.int(2, lv === 2 ? 8 : 12);
    const area = radius * radius * PI;

    return {
      id: generateProblemId(),
      category: this.category,
      type: this.type,
      difficulty: createGeometryDifficulty(lv, area, 2, 2),
      question:
        '面積が' + area + 'cm²の円があります。この円の半径は何cmですか。円周率は3.14とします。',
      answer: { kind: 'integer', value: radius },
      explanation:
        '半径×半径×3.14＝' + area + ' なので、半径×半径＝' + area / PI + '。' +
        radius + '×' + radius + '＝' + area / PI + ' だから、半径は' + radius + 'cmです。',
      parameters: {
        radius,
        area,
        difficultyLevel: lv,
      },
    };
  }

  validate(problem: Problem): ValidationResult {
    const errors: string[] = [];
    const { radius, area } = problem.parameters as { radius: number; area: number };
    if (Math.abs(radius * radius * PI - area) > 0.001) errors.push('面積と半径の関係が誤っています');
    return { valid: errors.length === 0, errors };
  }
}

/**
 * 直方体の体積
 */
export class VolumeBoxGenerator implements ProblemGenerator {
  readonly type = 'volume_box';
  readonly category = 'geometry' as const;
  readonly description = '直方体の体積';

  generate(config?: GenerationConfig): Problem {
    const rng = createRandom(config?.seed);
    // Use provided difficulty, default to 2 (normal) if not specified
    const lv = config?.difficulty ?? (2 as DifficultyLevel);

    const l = rng.int(2, lv === 1 ? 5 : 9);
    const w = rng.int(2, lv === 1 ? 5 : 9);
    const h = rng.int(2, lv === 1 ? 5 : 9);
    const vol = l * w * h;

    return {
      id: generateProblemId(),
      category: this.category,
      type: this.type,
      difficulty: createGeometryDifficulty(lv, vol, 1, 1),
      question:
        '縦' + l + 'cm、横' + w + 'cm、高さ' + h + 'cmの直方体の体積を求めよ。',
      answer: { kind: 'integer', value: vol },
      explanation:
        '体積＝縦×横×高さ なので、' + l + '×' + w + '×' + h + '＝' + vol + 'cm³です。',
      parameters: {
        length: l,
        width: w,
        height: h,
        volume: vol,
        difficultyLevel: lv,
      },
    };
  }

  validate(problem: Problem): ValidationResult {
    const errors: string[] = [];
    const { length, width, height, volume } = problem.parameters as {
      length: number;
      width: number;
      height: number;
      volume: number;
    };
    if (length * width * height !== volume) errors.push('体積が誤っています');
    return { valid: errors.length === 0, errors };
  }
}

/**
 * 立方体の体積
 */
export class VolumeCubeGenerator implements ProblemGenerator {
  readonly type = 'volume_cube';
  readonly category = 'geometry' as const;
  readonly description = '立方体の体積';

  generate(config?: GenerationConfig): Problem {
    const rng = createRandom(config?.seed);
    // Use provided difficulty, default to 2 (normal) if not specified
    const lv = config?.difficulty ?? (2 as DifficultyLevel);

    const a = rng.int(2, lv === 1 ? 5 : 9);
    const vol = a * a * a;

    return {
      id: generateProblemId(),
      category: this.category,
      type: this.type,
      difficulty: createGeometryDifficulty(lv, vol, 1, 1),
      question: '1辺が' + a + 'cmの立方体の体積を求めよ。',
      answer: { kind: 'integer', value: vol },
      explanation: '体積＝一辺×一辺×一辺 なので、' + a + '×' + a + '×' + a + '＝' + vol + 'cm³です。',
      parameters: { edge: a, volume: vol, difficultyLevel: lv },
    };
  }

  validate(problem: Problem): ValidationResult {
    const errors: string[] = [];
    const { edge, volume } = problem.parameters as { edge: number; volume: number };
    if (edge * edge * edge !== volume) errors.push('立方体の体積が誤っています');
    return { valid: errors.length === 0, errors };
  }
}

/**
 * 角柱の体積
 */
export class VolumePrismGenerator implements ProblemGenerator {
  readonly type = 'volume_prism';
  readonly category = 'geometry' as const;
  readonly description = '角柱の体積';

  generate(config?: GenerationConfig): Problem {
    const rng = createRandom(config?.seed);
    // Use provided difficulty, default to 2 (normal) if not specified
    const lv = config?.difficulty ?? (2 as DifficultyLevel);

    const baseArea = rng.int(3, lv === 1 ? 8 : 12);
    const height = rng.int(2, lv === 1 ? 5 : 8);
    const vol = baseArea * height;

    return {
      id: generateProblemId(),
      category: this.category,
      type: this.type,
      difficulty: createGeometryDifficulty(lv, vol, 2, 1),
      question:
        '底面積が' + baseArea + 'cm²、高さ' + height + 'cmの角柱の体積を求めよ。',
      answer: { kind: 'integer', value: vol },
      explanation:
        '角柱の体積＝底面積×高さ なので、' + baseArea + '×' + height + '＝' + vol + 'cm³です。',
      parameters: { baseArea, height, volume: vol, difficultyLevel: lv },
    };
  }

  validate(problem: Problem): ValidationResult {
    const errors: string[] = [];
    const { baseArea, height, volume } = problem.parameters as { baseArea: number; height: number; volume: number };
    if (baseArea * height !== volume) errors.push('角柱の体積が誤っています');
    return { valid: errors.length === 0, errors };
  }
}

/**
 * 円柱の体積
 */
export class VolumeCylinderGenerator implements ProblemGenerator {
  readonly type = 'volume_cylinder';
  readonly category = 'geometry' as const;
  readonly description = '円柱の体積';

  generate(config?: GenerationConfig): Problem {
    const rng = createRandom(config?.seed);
    // Use provided difficulty, default to 2 (normal) if not specified
    const lv = config?.difficulty ?? (2 as DifficultyLevel);

    const radius = rng.int(2, 5);
    const height = rng.int(2, lv === 2 ? 6 : 10);
    const baseArea = radius * radius * PI;
    const vol = baseArea * height;

    return {
      id: generateProblemId(),
      category: this.category,
      type: this.type,
      difficulty: createGeometryDifficulty(lv, vol, 2, 1),
      question:
        '半径' + radius + 'cm、高さ' + height + 'cmの円柱の体積を求めよ。円周率は3.14。',
      answer: { kind: 'decimal', value: vol },
      explanation:
        '底面積＝' + radius + '×' + radius + '×3.14＝' + baseArea + 'cm²。体積＝' + baseArea + '×' + height + '＝' + vol + 'cm³',
      parameters: {
        radius,
        height,
        baseArea,
        volume: vol,
        difficultyLevel: lv,
      },
    };
  }

  validate(problem: Problem): ValidationResult {
    const errors: string[] = [];
    const { radius, height, baseArea, volume } = problem.parameters as {
      radius: number;
      height: number;
      baseArea: number;
      volume: number;
    };
    if (Math.abs(radius * radius * PI - baseArea) > 0.01) errors.push('底面積が誤っています');
    if (Math.abs(baseArea * radius * height) > 0.01) {
      if (Math.abs(baseArea * height - volume) > 0.01) errors.push('円柱の体積が誤っています');
    }
    return { valid: errors.length === 0, errors };
  }
}

/**
 * 体積から高さを求める
 */
export class VolumeFromHeightGenerator implements ProblemGenerator {
  readonly type = 'volume_from_height';
  readonly category = 'geometry' as const;
  readonly description = '体積から高さを求める';

  generate(config?: GenerationConfig): Problem {
    const rng = createRandom(config?.seed);
    // Use provided difficulty, default to 2 (normal) if not specified
    const lv = config?.difficulty ?? (2 as DifficultyLevel);

    const baseArea = rng.int(3, 8);
    const height = rng.int(3, lv === 2 ? 8 : 12);
    const vol = baseArea * height;

    return {
      id: generateProblemId(),
      category: this.category,
      type: this.type,
      difficulty: createGeometryDifficulty(lv, vol, 2, 2),
      question:
        '底面積が' + baseArea + 'cm²の角柱の体積が' + vol + 'cm³のとき、この角柱の高さを求めよ。',
      answer: { kind: 'integer', value: height },
      explanation:
        '高さ＝体積÷底面積 なので、' + vol + '÷' + baseArea + '＝' + height + 'cmです。',
      parameters: { baseArea, volume: vol, height, difficultyLevel: lv },
    };
  }

  validate(problem: Problem): ValidationResult {
    const errors: string[] = [];
    const { baseArea, volume, height } = problem.parameters as { baseArea: number; volume: number; height: number };
    if (baseArea * height !== volume) errors.push('高さの計算が誤っています');
    return { valid: errors.length === 0, errors };
  }
}

/**
 * 体積の単位換算
 * 例: ●L = ●cm³
 */
export class VolumeUnitGenerator implements ProblemGenerator {
  readonly type = 'volume_unit';
  readonly category = 'geometry' as const;
  readonly description = '体積の単位換算';

  generate(config?: GenerationConfig): Problem {
    const rng = createRandom(config?.seed);
    // Use provided difficulty, default to 2 (normal) if not specified
    const lv = config?.difficulty ?? (2 as DifficultyLevel);

    const liters = rng.int(1, lv === 1 ? 3 : 10);
    const cm3 = liters * 1000;

    return {
      id: generateProblemId(),
      category: this.category,
      type: this.type,
      difficulty: createGeometryDifficulty(lv, liters, 1, 1),
      question: liters + 'Lは何cm³ですか',
      answer: { kind: 'integer', value: cm3 },
      explanation: '1L＝1000cm³ なので、' + liters + '×1000＝' + cm3 + 'cm³です。',
      parameters: { liters, cm3, difficultyLevel: lv },
    };
  }

  validate(problem: Problem): ValidationResult {
    const errors: string[] = [];
    const { liters, cm3 } = problem.parameters as { liters: number; cm3: number };
    if (liters * 1000 !== cm3) errors.push('単位換算が誤っています');
    return { valid: errors.length === 0, errors };
  }
}

/**
 * 線対称の判定問題
 */
export class SymmetryFoldGenerator implements ProblemGenerator {
  readonly type = 'symmetry_fold';
  readonly category = 'geometry' as const;
  readonly description = '線対称の判定';

  generate(config?: GenerationConfig): Problem {
    const rng = createRandom(config?.seed);
    const level = config?.difficulty ?? (2 as DifficultyLevel);

    const shapes = [
      { name: '正三角形', valid: true, axisCount: 3 },
      { name: '長方形', valid: true, axisCount: 2 },
      { name: '正五角形', valid: true, axisCount: 5 },
      { name: 'ひし形', valid: true, axisCount: 2 },
      { name: '三角形', valid: false, axisCount: 0 },
      { name: '平行四辺形', valid: false, axisCount: 0 },
      { name: '台形', valid: false, axisCount: 0 },
      { name: '正六角形', valid: true, axisCount: 6 },
    ];

    const s = rng.pick(shapes);
    const isFold = s.valid;

    return {
      id: generateProblemId(),
      category: this.category,
      type: this.type,
      difficulty: createGeometryDifficulty(level, 1, 2, 2),
      question:
        s.name + 'は線対称な図形ですか？（はい/いいえ）',
      answer: { kind: 'string', value: isFold ? 'はい' : 'いいえ' },
      explanation:
        s.name + 'は線対称' + (isFold ? 'である' : 'でない') + '。対称の軸は' +
        (isFold ? s.axisCount + '本あります' : '1本もありません') + '。',
      parameters: {
        shape: s.name,
        isFold,
        count: s.axisCount,
        difficultyLevel: level,
      },
    };
  }

  validate(problem: Problem): ValidationResult {
    const errors: string[] = [];
    const { isFold, answer } = problem.parameters as { isFold: boolean; answer: string };
    const expected = isFold ? 'はい' : 'いいえ';
    if (answer !== expected) errors.push('線対称の判定が誤っています');
    return { valid: errors.length === 0, errors };
  }
}

/**
 * 点対称の判定問題
 */
export class SymmetryPointGenerator implements ProblemGenerator {
  readonly type = 'symmetry_point';
  readonly category = 'geometry' as const;
  readonly description = '点対称の判定';

  generate(config?: GenerationConfig): Problem {
    const rng = createRandom(config?.seed);
    const level = config?.difficulty ?? (2 as DifficultyLevel);

    const shapes = [
      { name: '長方形', isPoint: true },
      { name: '正方形', isPoint: true },
      { name: '正六角形', isPoint: true },
      { name: '円', isPoint: true },
      { name: '正三角形', isPoint: false },
      { name: '台形', isPoint: false },
      { name: '平行四辺形', isPoint: true },
    ];

    const s = rng.pick(shapes);
    const expected = s.isPoint ? 'はい' : 'いいえ';

    return {
      id: generateProblemId(),
      category: this.category,
      type: this.type,
      difficulty: createGeometryDifficulty(level, 1, 2, 2),
      question: s.name + 'は点対称な図形ですか？（はい/いいえ）',
      answer: { kind: 'string', value: expected },
      explanation:
        s.name + 'は点対称' + (s.isPoint ? 'である' : 'でない') + '。',
      parameters: { shape: s.name, isPoint: s.isPoint, difficultyLevel: level },
    };
  }

  validate(problem: Problem): ValidationResult {
    const errors: string[] = [];
    const { isPoint, answer } = problem.parameters as { isPoint: boolean; answer: string };
    const expected = isPoint ? 'はい' : 'いいえ';
    if (answer !== expected) errors.push('点対称の判定が誤っています');
    return { valid: errors.length === 0, errors };
  }
}

/**
 * 拡大図・縮図
 */
export class ScaleLengthGenerator implements ProblemGenerator {
  readonly type = 'scale_length';
  readonly category = 'geometry' as const;
  readonly description = '拡大図・縮図の長さを求める';

  generate(config?: GenerationConfig): Problem {
    const rng = createRandom(config?.seed);
    // Use provided difficulty, default to 2 (normal) if not specified
    const lv = config?.difficulty ?? (2 as DifficultyLevel);

    // 図形を拡大する。
    // 実際の長さと縮尺
    const scale = rng.pick([2, 3, 4, 5, 0.5, 0.25]);
    const base = rng.int(2, 8);
    const isEnlarge = scale > 1;

    return {
      id: generateProblemId(),
      category: this.category,
      type: this.type,
      difficulty: createGeometryDifficulty(lv, base, 2, 2),
      question:
        (isEnlarge ? 'ある図形を' : '実際の') +
        scale +
        (isEnlarge ? '倍に拡大' : 'に縮小') +
        'しました。もとの図形の長さが' +
        (isEnlarge ? base : base) +
        'cmのとき、' +
        (isEnlarge ? '拡大後の' : '実際の') +
        '長さは何cmですか？',
      answer: { kind: 'integer', value: isEnlarge ? base * scale : base * scale },
      explanation:
        (isEnlarge ? '拡大後' : '縮小後') +
        'の長さ＝' +
        base +
        '×' +
        scale +
        '＝' +
        (base * scale) +
        'cmです。',
      parameters: {
        scale,
        base,
        result: base * scale,
        difficultyLevel: lv,
        isEnlarge,
      },
    };
  }

  validate(problem: Problem): ValidationResult {
    const errors: string[] = [];
    const { base, result, scale } = problem.parameters as { base: number; result: number; scale: number };
    if (base * scale !== result) errors.push('拡大・縮小の結果が誤っています');
    return { valid: errors.length === 0, errors };
  }
}

/**
 * 基本図形の角度
 */
export class AngleBasicGenerator implements ProblemGenerator {
  readonly type = 'angle_basic';
  readonly category = 'geometry' as const;
  readonly description = '基本図形の角度';

  generate(config?: GenerationConfig): Problem {
    const rng = createRandom(config?.seed);
    // Use provided difficulty, default to 2 (normal) if not specified
    const lv = config?.difficulty ?? (2 as DifficultyLevel);

    for (let attempt = 0; attempt < 100; attempt++) {
      // 三角形の角度
      const a = rng.int(30, 80);
      const b = rng.int(30, 90 - a);
      if (a + b >= 180) continue;
      const c = 180 - a - b;

      return {
        id: generateProblemId(),
        category: this.category,
        type: this.type,
        difficulty: createGeometryDifficulty(lv, 180, 2, 1),
        question:
          '三角形の2つの角が' + a + '°と' + b + '°です。残りの角は何度ですか。',
        answer: { kind: 'integer', value: c },
        explanation:
          '三角形の内角の和は180° なので、180−' + a + '−' + b + '＝' + c + '°です。',
        parameters: { angleA: a, angleB: b, angleC: c, difficultyLevel: lv },
      };
    }
    throw new Error('角度の問題を生成できませんでした');
  }

  validate(problem: Problem): ValidationResult {
    const errors: string[] = [];
    const { angleA, angleB, angleC } = problem.parameters as { angleA: number; angleB: number; angleC: number };
    if (angleA + angleB + angleC !== 180) errors.push('角度の和が180ではありません');
    return { valid: errors.length === 0, errors };
  }
}