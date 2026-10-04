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
  Figure,
  FigurePoint,
  GenerationConfig,
  Problem,
  ProblemGenerator,
  ValidationResult,
} from '../../types/problem';
import { createRandom, generateProblemId } from '../../utils/random';
import type { SeededRandom } from '../../utils/random';
import {
  createDifficulty,
  numberSizeToComplexity,
  calculationStepsToComplexity,
} from '../../engine/difficulty/difficulty';

const PI = 3.14;

/**
 * 円周率を用いた結果を小数第2位に丸める (Phase 1-C)。
 *
 * 23 x 23 x 3.14 を素の JS で計算すると 1661.0600000000002 のような
 * 浮動小数点の誤差が出る。小学生が書き写せる形 (1661.06) に丸めることで、
 * 画面表示・解答判定・途中式のすべてが同じ値になる。
 * 丸めるのは**表示精度の統一**であって、数学的な近似の追加ではない
 * (円周率 3.14 自体は問題文で指定された近似値)。
 */
function piArea(radius: number): number {
  return Math.round(radius * radius * PI * 100) / 100;
}

function createGeometryDifficulty(
  level: DifficultyLevel,
  value: number,
  reasoningLevel: DifficultyLevel = level >= 2 ? 2 : 1,
  readingLevel: DifficultyLevel = level >= 3 ? 2 : 1,
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

    // 難易度に応じて半径を変化させる
    const radius = lv <= 1 ? rng.int(2, 5) : lv === 2 ? rng.int(5, 10) : lv === 3 ? rng.int(10, 15) : lv === 4 ? rng.int(12, 20) : rng.int(15, 30);
    const area = piArea(radius);

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
    const expected = piArea(radius);
    if (Math.abs(expected - area) > 1e-9) errors.push('円の面積が誤っています');
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

    // 難易度に応じて直径を変化させる
    const diameter = lv <= 1 ? rng.int(4, 10) : lv === 2 ? rng.int(10, 20) : lv === 3 ? rng.int(12, 24) : lv === 4 ? rng.int(16, 30) : rng.int(20, 40);
    const radius = diameter / 2;
    const area = piArea(radius);

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
    if (Math.abs(piArea(radius) - area) > 1e-9) errors.push('面積が誤っています');
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
    const radius = lv <= 1 ? rng.int(2, 5) : lv === 2 ? rng.int(2, 8) : lv === 3 ? rng.int(3, 12) : lv === 4 ? rng.int(4, 15) : rng.int(5, 20);
    const area = piArea(radius);

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
    if (Math.abs(piArea(radius) - area) > 1e-9) errors.push('面積と半径の関係が誤っています');
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

    // 難易度に応じて辺の長さを変化させる
    const maxEdge = lv <= 1 ? 5 : lv === 2 ? 9 : lv === 3 ? 12 : lv === 4 ? 15 : 20;
    const l = rng.int(2, maxEdge);
    const w = rng.int(2, maxEdge);
    const h = rng.int(2, maxEdge);
    const vol = l * w * h;

    return {
      id: generateProblemId(),
      category: this.category,
      type: this.type,
      difficulty: createGeometryDifficulty(lv, maxEdge, 1, 1),
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

    // 難易度に応じて辺の長さを変化させる
    const a = lv <= 1 ? rng.int(2, 5) : lv === 2 ? rng.int(2, 9) : lv === 3 ? rng.int(3, 12) : lv === 4 ? rng.int(4, 15) : rng.int(5, 20);
    const vol = a * a * a;

    return {
      id: generateProblemId(),
      category: this.category,
      type: this.type,
      difficulty: createGeometryDifficulty(lv, a, 1, 1),
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

    // 難易度に応じて底面積と高さを変化させる
    const baseArea = lv <= 1 ? rng.int(3, 8) : lv === 2 ? rng.int(3, 12) : lv === 3 ? rng.int(4, 15) : lv === 4 ? rng.int(5, 20) : rng.int(6, 30);
    const height = lv <= 1 ? rng.int(2, 5) : lv === 2 ? rng.int(2, 8) : lv === 3 ? rng.int(3, 10) : lv === 4 ? rng.int(4, 12) : rng.int(5, 15);
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

    // 難易度に応じて半径と高さを変化させる
    const radius = lv <= 1 ? rng.int(2, 3) : lv === 2 ? rng.int(2, 5) : lv === 3 ? rng.int(3, 6) : lv === 4 ? rng.int(4, 8) : rng.int(5, 10);
    const height = lv <= 1 ? rng.int(2, 4) : lv === 2 ? rng.int(2, 6) : lv === 3 ? rng.int(3, 8) : lv === 4 ? rng.int(4, 10) : rng.int(5, 12);
    const baseArea = piArea(radius);
    // 体積も小数第2位に丸める (float の誤差が 62.800000000000004 のような
    // 15桁の答えになるため)。底面積が2桁で終端するため体積も2桁で終端する。
    const vol = Math.round(baseArea * height * 100) / 100;

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
    if (Math.abs(piArea(radius) - baseArea) > 1e-9) errors.push('底面積が誤っています');
    if (Math.abs(Math.round(baseArea * height * 100) / 100 - volume) > 1e-9) {
      errors.push('円柱の体積が誤っています');
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

    // 難易度に応じて底面積と高さを変化させる
    const baseArea = lv <= 1 ? rng.int(3, 6) : lv === 2 ? rng.int(3, 8) : lv === 3 ? rng.int(4, 10) : lv === 4 ? rng.int(5, 12) : rng.int(6, 15);
    const height = lv <= 1 ? rng.int(3, 6) : lv === 2 ? rng.int(3, 8) : lv === 3 ? rng.int(4, 10) : lv === 4 ? rng.int(5, 12) : rng.int(6, 15);
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

    // 難易度に応じてリットル数を変化させる
    const liters = lv <= 1 ? rng.int(1, 3) : lv === 2 ? rng.int(1, 10) : lv === 3 ? rng.int(2, 20) : lv === 4 ? rng.int(3, 50) : rng.int(5, 100);
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
    // parameters には正答の文字列を保存していないので、
    // 判定そのもの (isFold / isPoint) から期待値を作る。
    // (以前は parameters.answer を参照しており、その値が常に undefined だったため、
    //  正しい問題がすべて validate に失敗していた)
    const { isFold } = problem.parameters as { isFold: boolean };
    if (typeof isFold !== 'boolean') {
      errors.push('線対称の判定が parameters にありません');
      return { valid: false, errors };
    }
    const expected = isFold ? 'はい' : 'いいえ';
    // 問題側の正解が判定と一致しているかを確認する
    if (problem.answer.kind !== 'string' || problem.answer.value !== expected) {
      errors.push('線対称の判定が誤っています');
    }
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
    // parameters には正答の文字列を保存していないので、
    // 判定そのもの (isPoint) から期待値を作る。
    const { isPoint } = problem.parameters as { isPoint: boolean };
    if (typeof isPoint !== 'boolean') {
      errors.push('点対称の判定が parameters にありません');
      return { valid: false, errors };
    }
    const expected = isPoint ? 'はい' : 'いいえ';
    // 問題側の正解が判定と一致しているかを確認する
    if (problem.answer.kind !== 'string' || problem.answer.value !== expected) {
      errors.push('点対称の判定が誤っています');
    }
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
    // 難易度に応じて倍率と元の長さを変化させる
    const scale = lv <= 1 ? rng.pick([2, 3]) : lv === 2 ? rng.pick([2, 3, 4, 0.5]) : lv === 3 ? rng.pick([2, 3, 4, 5, 0.5, 0.25]) : lv === 4 ? rng.pick([3, 4, 5, 6, 0.5, 0.25, 0.2]) : rng.pick([4, 5, 6, 8, 0.5, 0.25, 0.2, 0.1]);
    const base = lv <= 1 ? rng.int(2, 5) : lv === 2 ? rng.int(2, 8) : lv === 3 ? rng.int(3, 10) : lv === 4 ? rng.int(4, 12) : rng.int(5, 15);
    const isEnlarge = scale > 1;

    // 倍率を分数 (num/den) として扱い、整数演算で結果を出す。
    // (浮動小数点の誤差で「7 × 0.2 = 1.4000000000000001」のようになるのを防ぐ)
    const { num, den } = toScaleRational(scale);
    const result = (base * num) / den;
    const resultRounded = Math.round(result * 10000) / 10000;

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
        base +
        'cmのとき、' +
        (isEnlarge ? '拡大後の' : '実際の') +
        '長さは何cmですか？',
      // 倍率 0.5 などで小数になる場合は decimal 型にする
      // (integer のままだと入力UIに小数点が出ず、正解を入力できない)
      answer: {
        kind: Number.isInteger(resultRounded) ? 'integer' : 'decimal',
        value: resultRounded,
      },
      explanation:
        (isEnlarge ? '拡大後' : '縮小後') +
        'の長さ＝' +
        base +
        '×' +
        scale +
        '＝' +
        resultRounded +
        'cmです。',
      parameters: {
        scale,
        base,
        result: resultRounded,
        difficultyLevel: lv,
        isEnlarge,
      },
    };
  }

  validate(problem: Problem): ValidationResult {
    const errors: string[] = [];
    const { base, result } = problem.parameters as {
      base: number;
      result: number;
      scale?: number;
    };
    const scale = (problem.parameters as { scale: number }).scale;
    // 倍率を分数化して整数演算で再計算する (誤差を排除して比較)
    const { num, den } = toScaleRational(scale);
    const expected = (base * num) / den;
    if (Math.abs(expected - result) > 1e-9) {
      errors.push('拡大・縮小の結果が誤っています');
    }
    // 答えが整数なら integer、小数なら decimal であること
    const isIntResult = Number.isInteger(result);
    if (isIntResult && problem.answer.kind !== 'integer') {
      errors.push('整数の答えなのに解答型がintegerではありません');
    }
    if (!isIntResult && problem.answer.kind !== 'decimal') {
      errors.push('小数の答えなのに解答型がdecimalではありません');
    }
    return { valid: errors.length === 0, errors };
  }
}

/** 倍率を分数表現に変換する (既知の倍率のみ。未知の値は100分率にフォールバック) */
function toScaleRational(scale: number): { num: number; den: number } {
  switch (scale) {
    case 8:
      return { num: 8, den: 1 };
    case 6:
      return { num: 6, den: 1 };
    case 5:
      return { num: 5, den: 1 };
    case 4:
      return { num: 4, den: 1 };
    case 3:
      return { num: 3, den: 1 };
    case 2:
      return { num: 2, den: 1 };
    case 0.5:
      return { num: 1, den: 2 };
    case 0.25:
      return { num: 1, den: 4 };
    case 0.2:
      return { num: 1, den: 5 };
    case 0.1:
      return { num: 1, den: 10 };
    default:
      return { num: Math.round(scale * 100), den: 100 };
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
      // 難易度に応じて角度の範囲を変化させる
      const maxAngle = lv <= 1 ? 80 : lv === 2 ? 90 : lv === 3 ? 100 : lv === 4 ? 110 : 120;
      const a = rng.int(30, maxAngle);
      const b = rng.int(30, Math.min(maxAngle, 180 - a - 30));
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

/* ------------------------------------------------------------------------- *
 * Phase 2-S: 円周 (5年 B(1) 直径と円周の関係・円周率)
 *
 * 学習指導要領解説 小学校算数編 第5学年「B(1)平面図形の性質」に
 * 「直径と円周との関係」「円周率」が明記されていることに基づく。
 * 面積 (circle_area_*) とは別の問題種別。丸めは piArea と同じ扱いとする。
 * ------------------------------------------------------------------------- */

export type CircleCircumferenceVariant =
  /** 直径から円周を求める */
  | 'from_diameter'
  /** 円周から直径を求める (逆算) */
  | 'from_circumference';

/** 難易度ごとの構造候補 (逆算ほど後段に置く) */
const CIRCUMFERENCE_VARIANTS: Record<DifficultyLevel, CircleCircumferenceVariant[]> = {
  1: ['from_diameter'],
  2: ['from_circumference'],
  3: ['from_diameter'],
  4: ['from_diameter'],
  5: ['from_circumference'],
};

/** 円周 = 直径 × 円周率 を小数第2位に丸める (piArea と同じ扱い) */
function piCircumference(diameter: number): number {
  return Math.round(diameter * PI * 100) / 100;
}

/**
 * 円周を求める
 *
 * 問題文で「直径」「円周」を明示し、半径と取り違えないようにする。
 * difficulty には「与えられた量」を渡し、答えの大きさでは判定させない
 * (既存の円の面積generatorと同じ方針)。
 */
export class CircleCircumferenceGenerator implements ProblemGenerator {
  readonly type = 'circle_circumference';
  readonly category = 'geometry' as const;
  readonly description = '円周を求める';

  generate(config?: GenerationConfig): Problem {
    const rng = createRandom(config?.seed);
    const lv = config?.difficulty ?? (2 as DifficultyLevel);

    const usable = CIRCUMFERENCE_VARIANTS[lv];
    for (let attempt = 0; attempt < 40; attempt++) {
      const variant = rng.pick(usable);

      if (variant === 'from_diameter') {
        // lv1: 1桁 / lv3: 2桁 / lv4: 3桁 (答えは m で表す)
        const diameter = lv <= 1 ? rng.int(2, 9) : lv === 3 ? rng.int(10, 99) : rng.int(100, 999);
        const circumference = piCircumference(diameter);
        if (lv <= 3) {
          return {
            id: generateProblemId(),
            category: this.category,
            type: this.type,
            difficulty: createGeometryDifficulty(lv, diameter),
            question:
              '直径' + diameter + 'cmの円の円周の長さを求めなさい。円周率は3.14とします。',
            answer: { kind: 'decimal', value: circumference },
            explanation:
              '円周＝直径×円周率 なので、' + diameter + '×3.14＝' + circumference + 'cmです。',
            parameters: { variant, diameter, circumference, unit: 'cm', pi: 3.14, difficultyLevel: lv },
          };
        }
        // lv4: cm で与えて m で答える (単位換算を伴う)
        const inMeters = Math.round((circumference / 100) * 100) / 100;
        return {
          id: generateProblemId(),
          category: this.category,
          type: this.type,
          difficulty: createGeometryDifficulty(lv, diameter),
          question:
            '直径' + diameter + 'cmの円の円周の長さをmで求めなさい。円周率は3.14とします。',
          answer: { kind: 'decimal', value: inMeters },
          explanation:
            'まずcmで求めると、' +
            diameter +
            '×3.14＝' +
            circumference +
            'cm。100cm＝1m なので、' +
            circumference +
            'cmは' +
            inMeters +
            'mです。',
          // 直径・円周はどちらも cm で保持し、答えの単位だけを answerUnit で区別する
          // (unit は diameter/circumference の内部単位、answerUnit は解答の単位)
          parameters: {
            variant, diameter, circumference, unit: 'cm', answerUnit: 'm',
            pi: 3.14, difficultyLevel: lv,
          },
        };
      }

      // from_circumference: 円周から直径を逆算する
      if (lv <= 2) {
        const diameter = rng.int(2, 9);
        const circumference = piCircumference(diameter);
        return {
          id: generateProblemId(),
          category: this.category,
          type: this.type,
          difficulty: createGeometryDifficulty(lv, circumference),
          question:
            '円周が' + circumference + 'cmの円の直径は何cmですか。円周率は3.14とします。',
          answer: { kind: 'integer', value: diameter },
          explanation:
            '円周＝直径×円周率 なので、円周を円周率で割ると直径になります。' +
            circumference +
            '÷3.14＝' +
            diameter +
            'cmです。',
          parameters: { variant, diameter, circumference, unit: 'cm', pi: 3.14, difficultyLevel: lv },
        };
      }

      // lv5: 直径を m 単位の整数にして、円周も m で表す
      const diameterM = rng.int(1, 9);
      const diameterCm = diameterM * 100;
      const circumferenceM = piCircumference(diameterCm) / 100;
      return {
        id: generateProblemId(),
        category: this.category,
        type: this.type,
        difficulty: createGeometryDifficulty(lv, circumferenceM),
        question:
          '円周が' + circumferenceM + 'mの円の直径は何mですか。円周率は3.14とします。',
        answer: { kind: 'integer', value: diameterM },
        explanation: '円周＝直径×円周率 なので、' + circumferenceM + '÷3.14＝' + diameterM + 'mです。',
        parameters: {
          variant, diameter: diameterM, circumference: circumferenceM,
          unit: 'm', pi: 3.14, difficultyLevel: lv,
        },
      };
    }

    throw new Error('円周の問題を生成できませんでした');
  }

  validate(problem: Problem): ValidationResult {
    const errors: string[] = [];
    const params = problem.parameters as {
      variant: CircleCircumferenceVariant;
      diameter: number;
      circumference: number;
      unit: string;
    };
    const { variant, diameter, circumference } = params;
    if (variant !== 'from_diameter' && variant !== 'from_circumference') {
      errors.push('未知の variant です');
    }
    if (!(diameter > 0)) errors.push('直径が正ではありません');
    // unit が m のときは diameter/circumference を cm に戻して照合する
    const scale = params.unit === 'm' ? 100 : 1;
    const expected = piCircumference(diameter * scale);
    if (Math.abs(expected - circumference * scale) > 1e-6) {
      errors.push('円周と直径の関係が誤っています');
    }
    return { valid: errors.length === 0, errors };
  }
}

/* ------------------------------------------------------------------------- *
 * Phase 2-S: 台形の面積 (5年 B(3) 平面図形の面積)
 *
 * 学習指導要領解説 小学校算数編 第5学年「B(3)平面図形の面積」に
 * 「三角形，平行四辺形，ひし形及び台形の面積の計算による求め方」と明記。
 * 図形描画基盤は新設せず、問題文による数値条件だけで出題する。
 * (上底+下底) が偶数になる組だけを生成することで、
 * 小数にならない整数解を保証する。
 * ------------------------------------------------------------------------- */

export type TrapezoidAreaVariant =
  /** 公式代入 */
  | 'basic'
  /** 面積と底辺から高さを逆算 */
  | 'reverse_height'
  /** 面積と一方の底・高さから、もう一方の底を逆算 */
  | 'reverse_base';

const TRAPEZOID_VARIANTS: Record<DifficultyLevel, TrapezoidAreaVariant[]> = {
  1: ['basic'],
  2: ['reverse_height'],
  3: ['reverse_base'],
  4: ['basic'],
  5: ['reverse_height'],
};

/** 台形の面積 (上底 a / 下底 b / 高さ h)。(a+b) が偶数のとき必ず整数になる。 */
function trapezoidArea(a: number, b: number, h: number): number {
  return ((a + b) * h) / 2;
}

/**
 * 台形の面積を求める
 *
 * 問題文で「上底」「下底」「高さ」を明示し、斜辺と取り違えないようにする。
 */
export class TrapezoidAreaGenerator implements ProblemGenerator {
  readonly type = 'trapezoid_area';
  readonly category = 'geometry' as const;
  readonly description = '台形の面積を求める';

  generate(config?: GenerationConfig): Problem {
    const rng = createRandom(config?.seed);
    const lv = config?.difficulty ?? (2 as DifficultyLevel);

    const usable = TRAPEZOID_VARIANTS[lv];
    for (let attempt = 0; attempt < 400; attempt++) {
      const variant = rng.pick(usable);

      // 数値の上限は difficulty の数値複雑度が lv を超えないように決める
      const maxA = lv <= 1 ? 9 : lv <= 3 ? 40 : lv === 4 ? 200 : 500;
      const maxB = lv <= 1 ? 9 : lv <= 3 ? 40 : lv === 4 ? 200 : 500;
      const maxH = lv <= 1 ? 9 : lv <= 3 ? 30 : lv === 4 ? 90 : 120;

      // 同じ偶奇にそろえることで (a+b) を偶数にし、答えを整数にする
      const parity = rng.int(0, 1);
      const pickSide = (max: number): number => {
        const v = rng.int(1, max);
        return v % 2 === parity ? v : v + 1 <= max ? v + 1 : v - 1;
      };
      const a = pickSide(maxA); // 上底
      const b = pickSide(maxB); // 下底
      // 上底 < 下底 となるまで入れ替える (面積の公式自体は対称なのでどちらでも可)
      const top = Math.min(a, b);
      const bottom = Math.max(a, b);
      const h = pickSide(maxH);
      if (top <= 0 || h <= 0) continue;
      const area = trapezoidArea(top, bottom, h);
      if (!Number.isInteger(area)) continue;
      // difficulty に渡す値 (basic は高さ、逆算は面積) の桁数が lv を超えるものは捨てる。
      // そうしないと要求レベルの問題が出せず、requested difficulty が崩れる。
      const usedValue = variant === 'basic' ? h : area;
      if (numberSizeToComplexity(usedValue) > lv) continue;

      if (variant === 'basic') {
        return {
          id: generateProblemId(),
          category: this.category,
          type: this.type,
          difficulty: createGeometryDifficulty(lv, h),
          question:
            '上底が' +
            top +
            'cm、下底が' +
            bottom +
            'cm、高さが' +
            h +
            'cmの台形の面積を求めなさい。',
          answer: { kind: 'integer', value: area },
          explanation:
            '台形の面積＝（上底＋下底）×高さ÷2 なので、（' +
            top +
            '＋' +
            bottom +
            '）×' +
            h +
            '÷2＝' +
            area +
            'cm²です。',
          parameters: { variant, a: top, b: bottom, h, area, difficultyLevel: lv },
        };
      }

      if (variant === 'reverse_height') {
        return {
          id: generateProblemId(),
          category: this.category,
          type: this.type,
          difficulty: createGeometryDifficulty(lv, area),
          question:
            '上底が' +
            top +
            'cm、下底が' +
            bottom +
            'cm、面積が' +
            area +
            'cm²の台形の高さは何cmですか。',
          answer: { kind: 'integer', value: h },
          explanation:
            '台形の面積＝（上底＋下底）×高さ÷2 なので、高さは面積×2÷（上底＋下底）です。' +
            area +
            '×2÷（' +
            top +
            '＋' +
            bottom +
            '）＝' +
            h +
            'cmです。',
          parameters: { variant, a: top, b: bottom, h, area, difficultyLevel: lv },
        };
      }

      // reverse_base: 面積・高さ・下底から上底を求める
      return {
        id: generateProblemId(),
        category: this.category,
        type: this.type,
        difficulty: createGeometryDifficulty(lv, area),
        question:
          '下底が' +
          bottom +
          'cm、高さが' +
          h +
          'cm、面積が' +
          area +
          'cm²の台形の上底は何cmですか。',
        answer: { kind: 'integer', value: top },
        explanation:
          '台形の面積＝（上底＋下底）×高さ÷2 より、上底＋下底＝面積×2÷高さ なので、上底は' +
          area +
          '×2÷' +
          h +
          '－' +
          bottom +
          '＝' +
          top +
          'cmです。',
        parameters: { variant, a: top, b: bottom, h, area, difficultyLevel: lv },
      };
    }

    throw new Error('台形の面積の問題を生成できませんでした');
  }

  validate(problem: Problem): ValidationResult {
    const errors: string[] = [];
    const params = problem.parameters as {
      variant: TrapezoidAreaVariant;
      a: number;
      b: number;
      h: number;
      area: number;
    };
    const { variant, a, b, h, area } = params;
    if (variant !== 'basic' && variant !== 'reverse_height' && variant !== 'reverse_base') {
      errors.push('未知の variant です');
    }
    if (!(a > 0) || !(b > 0) || !(h > 0)) errors.push('上底・下底・高さが正ではありません');
    if (trapezoidArea(a, b, h) !== area) errors.push('台形の面積が誤っています');
    return { valid: errors.length === 0, errors };
  }
}

/* ------------------------------------------------------------------------- *
 * Phase 2-S: 基本単位換算 (2〜4年 C(1) 量と測定)
 *
 * 学習指導要領解説 小学校算数編 で確認した学年配当に基づく。
 *   - 長さ (k, m, mm などの接頭語): 第3学年
 *     「○メートル法の単位の仕組み（k(キロ), m(ミリ)など接頭語について）」
 *   - 重さ (かさ) : 第2学年「長さやかさの単位と測定」
 *   - 時間        : 第2学年「時間の単位」
 *   - 面積        : 第4学年「面積の単位（㎠, ㎡, ㎢）と測定」
 *
 * 体積は既存の volume_unit と重複するため今回の対象から除外する。
 * 面積の単位換算倍率は、長さの2乗であることを解説で明示する。
 * -------------------------------------------------------------------------- */

export type UnitConversionVariant =
  /** 長さ (mm / cm / m / km) */
  | 'length'
  /** 重さ (g / kg) */
  | 'mass'
  /** 時間 (秒 / 分 / 時) */
  | 'time'
  /** 面積 (㎠ / ㎡) */
  | 'area';

const UNIT_VARIANTS: Record<DifficultyLevel, UnitConversionVariant[]> = {
  1: ['length', 'time'],
  2: ['length', 'mass', 'time'],
  3: ['length', 'area', 'time'],
  4: ['length', 'area', 'time'],
  5: ['area', 'length'],
};

/** 1 基準単位あたりの換算倍率 (基準: mm / g / 秒 / ㎠) */
const UNIT_FACTORS: Record<UnitConversionVariant, Record<string, number>> = {
  length: { mm: 1, cm: 10, m: 1000, km: 1000000 },
  mass: { g: 1, kg: 1000 },
  time: { 秒: 1, 分: 60, 時: 3600 },
  area: { '㎠': 1, '㎡': 10000 },
};

export class UnitConversionBasicGenerator implements ProblemGenerator {
  readonly type = 'unit_conversion_basic';
  readonly category = 'geometry' as const;
  readonly description = '基本単位の換算';

  generate(config?: GenerationConfig): Problem {
    const rng = createRandom(config?.seed);
    const lv = config?.difficulty ?? (2 as DifficultyLevel);

    const usable = UNIT_VARIANTS[lv];
    for (let attempt = 0; attempt < 40; attempt++) {
      const variant = rng.pick(usable);
      const units = Object.keys(UNIT_FACTORS[variant]);
      if (units.length < 2) continue;

      const from = rng.pick(units);
      const to = rng.pick(units);
      if (from === to) continue;

      const fFrom = UNIT_FACTORS[variant][from];
      const fTo = UNIT_FACTORS[variant][to];

// 入力値が difficulty の数値複雑度を超えないよう組み立てる。
      // 換算の関係は「value(from) × fFrom = answer(to) × fTo」。
      // 必ず「整数倍の係数」を先に選んでから数値を決めるので、
      // 割り切れない数値が出たり、答えが巨大になったりしない。
      const maxFrom = lv <= 1 ? 9 : lv === 2 ? 99 : lv <= 3 ? 999 : lv <= 4 ? 9999 : 100000;
      const MAX_ANSWER = 100000;

      let value: number;
      let answer: number;
      const toIsBigger = fTo > fFrom;
      if (toIsBigger) {
        // 大きな単位へ直すので、求める数 (answer) を基準に選ぶ。
        // 例: 30mm → 3cm (fFrom=1, fTo=10)
        const ratio = fTo / fFrom;
        if (!Number.isInteger(ratio)) continue;
        const kMax = Math.min(Math.floor(maxFrom / ratio), MAX_ANSWER);
        if (kMax < 1) continue;
        const k = rng.int(1, kMax);
        value = k * ratio;
        answer = k;
      } else {
        // 小さな単位へ直すので、也与えた値 (value) を基準に選ぶ。
        // 例: 3cm → 30mm (fFrom=10, fTo=1)
        const ratio = fFrom / fTo;
        if (!Number.isInteger(ratio)) continue;
        const kMax = Math.min(maxFrom, Math.floor(MAX_ANSWER / ratio));
        if (kMax < 1) continue;
        const k = rng.int(1, kMax);
        value = k;
        answer = k * ratio;
      }
      if (value > maxFrom || answer > MAX_ANSWER) continue;
      if (value <= 0 || answer <= 0) continue;

      const factor = fTo > fFrom ? fTo / fFrom : fFrom / fTo;
      const explanation =
        variant === 'area'
          ? '面積は長さの2乗なので、1mは10000㎠に直されます。' +
            value +
            from +
            (fTo > fFrom ? ' ÷ ' : ' × ') +
            factor +
            '＝' +
            answer +
            to +
            'です。'
          : '1' +
            from +
            (fTo > fFrom ? ' は ' : ' は ') +
            factor +
            to +
            (fTo > fFrom ? ' です。' : ' です。') +
            value +
            from +
            (fTo > fFrom ? ' ÷ ' : ' × ') +
            factor +
            '＝' +
            answer +
            to +
            'です。';

      return {
        id: generateProblemId(),
        category: this.category,
        type: this.type,
        difficulty: createGeometryDifficulty(lv, value),
        question: value + from + 'は何' + to + 'ですか',
        answer: { kind: 'integer', value: answer },
        explanation,
        parameters: {
          variant, from, to, value, answer, difficultyLevel: lv,
        },
      };
    }

    throw new Error('単位換算の問題を生成できませんでした');
  }

  validate(problem: Problem): ValidationResult {
    const errors: string[] = [];
    const params = problem.parameters as {
      variant: UnitConversionVariant;
      from: string;
      to: string;
      value: number;
      answer: number;
    };
    const { variant, from, to, value, answer } = params;
    const table = UNIT_FACTORS[variant];
    if (!table) {
      errors.push('未知の variant です');
      return { valid: false, errors };
    }
    const fFrom = table[from];
    const fTo = table[to];
    if (!fFrom || !fTo) {
      errors.push('未知の単位です');
      return { valid: false, errors };
    }
    if (!(value > 0)) errors.push('変換前の値が正ではありません');
    // 換算の関係: value(from) × fFrom ＝ answer(to) × fTo
    if (value * fFrom !== answer * fTo) errors.push('単位換算が誤っています');
    if (from === to) errors.push('変換前後の単位が同じです');
    return { valid: errors.length === 0, errors };
  }
}

/* ------------------------------------------------------------------------- *
 * Phase 2-T: 三角形の分類 (3年 B(1))
 *
 * 学習指導要領解説 小学校算数編 (一次資料):
 *   第3学年 B(1)「二等辺三角形，正三角形などの図形」/ 二等辺三角形，正三角形／角／円，球
 *
 * 三角形の3辺の長さは必ず三角形を決める条件 (a + b > c) を満たす必要があるため、
 * 生成後に必ずその条件を確認する。矛盾する組み合わせ
 * (「二等辺三角形ではない正三角形」など) は生成しない。
 * 図形描画は新設せず、辺の長さの文章だけで成立する問題にする。
 * ------------------------------------------------------------------------- */

export type TriangleClassifyVariant =
  /** 3辺の長さから種類を答える */
  | 'classify'
  /** どの辺の長さが等しいかを答える */
  | 'which_sides_equal';

/** 3年 B(1) で扱う分類 (二等辺三角形，正三角形など) */
type TriangleKind = '正三角形' | '二等辺三角形' | '不等辺三角形';

/** 3辺から種類を判定する (直角三角形の分類は3年の内容外なので扱わない) */
function classifyTriangle(a: number, b: number, c: number): TriangleKind {
  const sorted = [a, b, c].sort((x, y) => x - y);
  const [x, y, z] = sorted;
  if (x + y <= z) return '不等辺三角形';
  if (a === b && b === c) return '正三角形';
  if (a === b || b === c || a === c) return '二等辺三角形';
  return '不等辺三角形';
}

export class TriangleClassifyGenerator implements ProblemGenerator {
  readonly type = 'triangle_classify';
  readonly category = 'geometry' as const;
  readonly description = '三角形の分類';

  generate(config?: GenerationConfig): Problem {
    const rng = createRandom(config?.seed);
    const lv = config?.difficulty ?? (2 as DifficultyLevel);

    // 3年 内容なので 辺の長さは 2桁程度までに収める (lv を上げても桁は増やさない)
    const maxSide = lv <= 2 ? 9 : 30;
    const usable: TriangleClassifyVariant[] =
      lv <= 2 ? ['classify', 'which_sides_equal'] : ['classify', 'which_sides_equal'];

    for (let attempt = 0; attempt < 60; attempt++) {
      const variant = rng.pick(usable);
      const a = rng.int(2, maxSide);
      const b = rng.int(2, maxSide);
      const c = rng.int(2, maxSide);
      // 三角形が成立しない場合は棄却する
      const sorted = [a, b, c].sort((x, y) => x - y);
      if (sorted[0] + sorted[1] <= sorted[2]) continue;
      const kind = classifyTriangle(a, b, c);
      if (kind === '不等辺三角形' && variant === 'which_sides_equal') continue;

      const sideText = '辺の長さが ' + a + 'cm、' + b + 'cm、' + c + 'cm の三角形';

      if (variant === 'classify') {
        return {
          id: generateProblemId(),
          category: this.category,
          type: this.type,
          difficulty: createGeometryDifficulty(lv, Math.max(a, b, c)),
          question: sideText + 'は、どんな三角形ですか。',
          answer: { kind: 'string', value: kind },
          explanation:
            '最も長い辺は ' + sorted[2] + 'cm、他の2辺の和は ' + (sorted[0] + sorted[1]) +
            'cm で、三角形ができる条件を満たしています。辺の長さを比べると' +
            (a === b && b === c
              ? '3辺がすべて等しいため正三角形です。'
              : a === b || b === c || a === c
                ? '2辺が等しいため二等辺三角形です。'
                : '2辺が等しくないため不等辺三角形です。'),
          parameters: { variant, a, b, c, kind, difficultyLevel: lv },
        };
      }

      // which_sides_equal: 「等しい辺は何本か」を整数で問う
      // (長い文字列を答えにすると選択式UIで入力できず、判定も不安定になるため)
      const equalCount = a === b && b === c ? 3 : 2;
      return {
        id: generateProblemId(),
        category: this.category,
        type: this.type,
        difficulty: createGeometryDifficulty(lv, Math.max(a, b, c)),
        question:
          sideText + 'で、長さが等しい辺は何本ありますか。',
        answer: { kind: 'integer', value: equalCount },
        explanation:
          '3辺の長さを順に並べると ' + sorted.join('、') +
          ' です。' +
          (equalCount === 3
            ? '3辺の長さがすべて同じなので、正三角形であり等しい辺は3本です。'
            : '長さが同じ辺が2本あるので、二等辺三角形であり等しい辺は2本です。'),
        parameters: { variant, a, b, c, kind, equalCount, difficultyLevel: lv },
      };
    }

    throw new Error('三角形の分類の問題を生成できませんでした');
  }

  validate(problem: Problem): ValidationResult {
    const errors: string[] = [];
    const params = problem.parameters as {
      variant: TriangleClassifyVariant;
      a: number;
      b: number;
      c: number;
      kind: string;
    };
    const { a, b, c, kind } = params;
    const sorted = [a, b, c].sort((x, y) => x - y);
    if (sorted[0] + sorted[1] <= sorted[2]) errors.push('三角形が成立していません');
    if (classifyTriangle(a, b, c) !== kind) errors.push('三角形の分類が誤っています');
    if (params.variant === 'which_sides_equal') {
      const equalCount = (problem.parameters as { equalCount?: number }).equalCount;
      const expected = kind === '正三角形' ? 3 : 2;
      if (equalCount !== expected) {
        errors.push('等しい辺の本数が誤っています: ' + String(equalCount) + ' (期待値 ' + expected + ')');
      }
      const answered = problem.answer.kind === 'integer' ? problem.answer.value : undefined;
      if (answered !== expected) errors.push('答えの等しい辺の本数が parameters と一致しません');
    }
    return { valid: errors.length === 0, errors };
  }
}
// ===== 平行と垂直 (小4年「角と直線」) =====

/** 平行と垂直で扱う問題の variant */
type ParallelPerpendicularVariant =
  | 'definition_parallel'
  | 'definition_perpendicular'
  | 'angle_judgment'
  | 'intersection_judgment'
  | 'equal_distance'
  | 'find_pair';

/**
 * 答えの種類。
 * 'not_perpendicular' / 'not_parallel' は「垂直ではない」「平行ではない」を表す。
 * 「否定の答え」を別の種類にすることで、答えの文字列だけでは区別できない混乱を防ぐ。
 */
type ParallelPerpendicularAnswerKind =
  | 'parallel'
  | 'perpendicular'
  | 'not_parallel'
  | 'not_perpendicular';

const PARALLEL_LABEL = '平行';
const PERPENDICULAR_LABEL = '垂直';
const NOT_PARALLEL_LABEL = '平行ではありません';
const NOT_PERPENDICULAR_LABEL = '垂直ではありません';

/** 妥当な答えの種類 (validate とテストで使う) */
const PARALLEL_PERPENDICULAR_ANSWER_KINDS: readonly ParallelPerpendicularAnswerKind[] = [
  'parallel',
  'perpendicular',
  'not_parallel',
  'not_perpendicular',
];

/** 答えの種類 → 表示文言 */
const ANSWER_KIND_LABEL: Record<ParallelPerpendicularAnswerKind, string> = {
  parallel: PARALLEL_LABEL,
  perpendicular: PERPENDICULAR_LABEL,
  not_parallel: NOT_PARALLEL_LABEL,
  not_perpendicular: NOT_PERPENDICULAR_LABEL,
};

/** variant ごとの選択肢 (4択) */
const VARIANT_CHOICES: Record<ParallelPerpendicularVariant, string[]> = {
  definition_parallel: [PARALLEL_LABEL, PERPENDICULAR_LABEL, '垂直ではありません', '平行ではありません'],
  definition_perpendicular: [PERPENDICULAR_LABEL, PARALLEL_LABEL, '平行ではありません', '垂直ではありません'],
  angle_judgment: [PERPENDICULAR_LABEL, NOT_PERPENDICULAR_LABEL, PARALLEL_LABEL, NOT_PARALLEL_LABEL],
  intersection_judgment: [PARALLEL_LABEL, NOT_PARALLEL_LABEL, PERPENDICULAR_LABEL, NOT_PERPENDICULAR_LABEL],
  equal_distance: [PARALLEL_LABEL, PERPENDICULAR_LABEL, NOT_PARALLEL_LABEL, NOT_PERPENDICULAR_LABEL],
  find_pair: [], // 3直線の組ごとに構成するため生成時に決める
};

/** variant が使える最低難易度 (この難易度未満では出さない) */
const VARIANT_MIN_LEVEL: Record<ParallelPerpendicularVariant, DifficultyLevel> = {
  definition_parallel: 1,
  definition_perpendicular: 1,
  angle_judgment: 1,
  intersection_judgment: 2,
  equal_distance: 3,
  find_pair: 4,
};

/** variant ごとの思考の負荷 (難易度はこれを超えない) */
const VARIANT_REASONING: Record<ParallelPerpendicularVariant, DifficultyLevel> = {
  definition_parallel: 1,
  definition_perpendicular: 1,
  angle_judgment: 2,
  intersection_judgment: 2,
  equal_distance: 3,
  find_pair: 3,
};

/** variant ごとの文章読解の負荷 (難易度はこれを超えない) */
const VARIANT_READING: Record<ParallelPerpendicularVariant, DifficultyLevel> = {
  definition_parallel: 1,
  definition_perpendicular: 1,
  angle_judgment: 1,
  intersection_judgment: 2,
  equal_distance: 2,
  find_pair: 3,
};

/** 直線の名前 (あ・い・う) */
const LINE_NAMES = ['あ', 'い', 'う'] as const;

/** 直線の組を表示する文言 (例: 「直線あと直線い」) */
function linePairAnswer(a: number, b: number): string {
  const lo = Math.min(a, b);
  const hi = Math.max(a, b);
  return '直線' + LINE_NAMES[lo] + 'と直線' + LINE_NAMES[hi];
}

/**
 * 平行と垂直の難易度。
 * 数値の大きさは難度の要因ではないので numberComplexity は 1 に固定し、
 * 概念の理解 (reasoning) と条件の読み取り (reading) で難易度差をつける。
 * calculation を難易度そのものにして、どの難易度を要求されてもその難易度を返す。
 */
function createParallelPerpendicularDifficulty(
  lv: DifficultyLevel,
  variant: ParallelPerpendicularVariant,
): ReturnType<typeof createDifficulty> {
  return createDifficulty({
    calculationComplexity: calculationStepsToComplexity(lv),
    numberComplexity: 1,
    reasoningComplexity: Math.min(lv, VARIANT_REASONING[variant]) as DifficultyLevel,
    readingComplexity: Math.min(lv, VARIANT_READING[variant]) as DifficultyLevel,
  });
}

/**
 * 平行と垂直
 *
 * 小4年「角と直線」で扱う平行と垂直を扱う。
 * 図は使わず、問題文だけで条件が判断できる問題に限っている (描画基盤は使わない)。
 * - 垂直: 2本の直線が交わり、できる角が直角である
 * - 平行: 同一平面上にある2本の直線が、互いに交わらない
 */
export class ParallelPerpendicularGenerator implements ProblemGenerator {
  readonly type = 'parallel_perpendicular';
  readonly category = 'geometry' as const;
  readonly description = '平行と垂直';

  generate(config?: GenerationConfig): Problem {
    const rng = createRandom(config?.seed);
    const lv = config?.difficulty ?? (2 as DifficultyLevel);

    const usable = (Object.keys(VARIANT_MIN_LEVEL) as ParallelPerpendicularVariant[])
      .filter((v) => VARIANT_MIN_LEVEL[v] <= lv);

    for (let attempt = 0; attempt < 60; attempt++) {
      const variant = rng.pick(usable);
      const built = buildParallelPerpendicular(variant, rng, lv);
      if (built) return built;
    }
    throw new Error('平行と垂直の問題を生成できませんでした');
  }

  validate(problem: Problem): ValidationResult {
    const errors: string[] = [];
    const params = problem.parameters as {
      variant: ParallelPerpendicularVariant;
      answer: string;
      answerKind: ParallelPerpendicularAnswerKind;
      angle?: number;
      intersects?: boolean;
      constantDistance?: number;
      pair?: { a: number; b: number };
      difficultyLevel: DifficultyLevel;
    };
    const { variant, answerKind } = params;
    // 答えは parameters ではなく problem.answer を正とする
    const answer = problem.answer.kind === 'string' ? problem.answer.value : '';

    if (!PARALLEL_PERPENDICULAR_ANSWER_KINDS.includes(answerKind)) {
      errors.push('未定義の答えの種類です: ' + String(answerKind));
    }
    if (typeof answer !== 'string' || answer.length === 0) {
      errors.push('答えが空です');
    }
    // 答えは選択肢のどれか之一でなければならない
    const choices = problem.choices;
    if (!choices || !choices.includes(answer)) {
      errors.push('答えが選択肢に含まれていません: ' + String(answer));
    }

    switch (variant) {
      case 'definition_parallel':
        if (answerKind !== 'parallel' || answer !== PARALLEL_LABEL) {
          errors.push('平行の定義の答えが不正です: ' + String(answer));
        }
        break;
      case 'definition_perpendicular':
        if (answerKind !== 'perpendicular' || answer !== PERPENDICULAR_LABEL) {
          errors.push('垂直の定義の答えが不正です: ' + String(answer));
        }
        break;
      case 'angle_judgment': {
        const angle = params.angle;
        if (angle === undefined || angle <= 0 || angle >= 180) {
          errors.push('角度が不正です: ' + String(angle));
          break;
        }
        // 交わる2直線が垂直になるのは、できる角が直角のときだけ
        const expectKind = angle === 90 ? 'perpendicular' : 'not_perpendicular';
        if (answerKind !== expectKind) {
          errors.push('角度に対する答えの種類が不正です: ' + String(answerKind));
        }
        break;
      }
      case 'intersection_judgment': {
        const intersects = params.intersects;
        if (typeof intersects !== 'boolean') {
          errors.push('交わるかどうかが不正です');
          break;
        }
        // 同一平面上にある2直線が平行なのは、交わらないときだけ
        const expectKind = intersects ? 'not_parallel' : 'parallel';
        if (answerKind !== expectKind) {
          errors.push('交わりに対する答えの種類が不正です: ' + String(answerKind));
        }
        break;
      }
      case 'equal_distance':
        if (answerKind !== 'parallel' || answer !== PARALLEL_LABEL) {
          errors.push('距離がどこでも一定の答えが不正です: ' + String(answer));
        }
        break;
      case 'find_pair': {
        const pair = params.pair;
        if (!pair) {
          errors.push('直線の組が設定されていません');
          break;
        }
        if (pair.a === pair.b || pair.a > pair.b) {
          errors.push('直線の組が不正です: ' + JSON.stringify(pair));
          break;
        }
        const expect = linePairAnswer(pair.a, pair.b);
        if (answer !== expect) {
          errors.push('直線の組の答えが不正です: ' + String(answer) + ' (期待値 ' + expect + ')');
        }
        break;
      }
      default:
        errors.push('未知の variant: ' + String(variant));
    }

    return { valid: errors.length === 0, errors };
  }
}

// PARALLEL_PERPENDICULAR_MARKER

/** 乱数ジェネレータの構造的部分型 (SeededRandom を直接公開せずに使う) */
type Rng = { int: (min: number, max: number) => number; pick: <T>(array: readonly T[]) => T };

/** 平行の定義の説明 (表現の種類を増やすための文言) */
const PARALLEL_DEFINITION_QUESTIONS: readonly string[] = [
  '同じ平面上にある2本の直線が、互いに交わらないとき、この2本の直線を何といいますか。',
  '2本の直線が交わらないとき、この2本の直線の関係は何といいますか。',
  '同一の平面上で、2本の直線が交わらないという関係は何といいますか。',
  '同じ平面上にある2本の直線が、ほかの直線と交わらず、互いにも交わらないとき、'
    + 'この2本の直線を何といいますか。',
];

/** 垂直の定義の説明 (表現の種類を増やすための文言) */
const PERPENDICULAR_DEFINITION_QUESTIONS: readonly string[] = [
  '2本の直線が交わるとき、できる角が直角であるとき、この2本の直線を何といいますか。',
  '2本の直線が直角に交わるとき、この2本の直線の関係は何といいますか。',
  '2本の直線が直角に交わるという関係は何といいますか。',
  '2本の直線が交わるとき、できる4つの角がすべて直角であるとき、'
    + 'この2本の直線を何といいますか。',
];

/** 垂直ではないと判断するための角 (90 度は別扱い) */
const NON_RIGHT_ANGLES: readonly number[] = [
  15, 30, 40, 45, 50, 60, 70, 80, 100, 110, 120, 135, 140, 150, 160, 170,
];

/** 交わるときの条件の言い方 */
const INTERSECTS_CONDITIONS: readonly string[] = [
  '1つの点で交わることが分かっています',
  '1つの点で交わっています',
  '交わることを確かめています',
];

/** 交わらないときの条件の言い方 */
const NOT_INTERSECTS_CONDITIONS: readonly string[] = [
  '互いに交わらないことが分かっています',
  '互いに交わらないことを確かめています',
  '交わらないことが分かっています',
];

/** 平行と垂直の問題を1問組み立てる */
function buildParallelPerpendicular(
  variant: ParallelPerpendicularVariant,
  rng: Rng,
  lv: DifficultyLevel,
): Problem {
  const base = {
    id: generateProblemId(),
    category: 'geometry' as const,
    type: 'parallel_perpendicular',
    difficulty: createParallelPerpendicularDifficulty(lv, variant),
    inputType: 'choice' as const,
  };

  if (variant === 'definition_parallel') {
    return {
      ...base,
      question: rng.pick(PARALLEL_DEFINITION_QUESTIONS),
      answer: { kind: 'string', value: PARALLEL_LABEL },
      choices: VARIANT_CHOICES[variant],
      explanation:
        '同じ平面上にある2本の直線が、互いに交わらないとき、この2本の直線は平行といいます。'
        + '平行な直線は、どこまでも交わらずに広がっています。',
      parameters: { variant, answerKind: 'parallel', difficultyLevel: lv },
    };
  }

  if (variant === 'definition_perpendicular') {
    return {
      ...base,
      question: rng.pick(PERPENDICULAR_DEFINITION_QUESTIONS),
      answer: { kind: 'string', value: PERPENDICULAR_LABEL },
      choices: VARIANT_CHOICES[variant],
      explanation:
        '2本の直線が交わるとき、できる角が直角なら、この2本の直線は垂直といいます。'
        + '垂直な2直線は、できる4つの角がすべて直角です。',
      parameters: { variant, answerKind: 'perpendicular', difficultyLevel: lv },
    };
  }

  if (variant === 'angle_judgment') {
    // 垂直になるのは、できる角が直角のときだけ
    const isRight = rng.int(0, 1) === 1;
    const angle = isRight ? 90 : rng.pick(NON_RIGHT_ANGLES);
    const answerKind: ParallelPerpendicularAnswerKind = isRight ? 'perpendicular' : 'not_perpendicular';
    return {
      ...base,
      question:
        '2本の直線が交わっています。そのうち1つの角は ' + angle + '° です。'
        + 'この2本の直線について、説明の正しいものはどれですか。',
      answer: { kind: 'string', value: ANSWER_KIND_LABEL[answerKind] },
      choices: VARIANT_CHOICES[variant],
      explanation: isRight
        ? 'できる角の一つが 90° なら、その2本の直線は垂直です。'
        + '垂直な2直線は、できる4つの角がすべて直角になります。'
        : 'できる角の一つが ' + angle + '° で直角ではないため、垂直ではありません。'
          + '交わっている2直線が垂直になるのは、できる角が直角のときだけです。',
      parameters: { variant, angle, answerKind, difficultyLevel: lv },
    };
  }

  if (variant === 'intersection_judgment') {
    // 同一平面上にある2直線が平行なのは、交わらないときだけ
    const intersects = rng.int(0, 1) === 1;
    const answerKind: ParallelPerpendicularAnswerKind = intersects ? 'not_parallel' : 'parallel';
    const condition = rng.pick(intersects ? INTERSECTS_CONDITIONS : NOT_INTERSECTS_CONDITIONS);
    return {
      ...base,
      question:
        '同じ平面上にある2本の直線 l と m は、' + condition + '。'
        + 'l と m の関係として正しいものはどれですか。',
      answer: { kind: 'string', value: ANSWER_KIND_LABEL[answerKind] },
      choices: VARIANT_CHOICES[variant],
      explanation: intersects
        ? '2本の直線が交わっているので、平行ではありません。'
        + '平行な直線は、互いに交わりません。'
        : '同じ平面上にある2本の直線が互いに交わらないので、平行です。',
      parameters: { variant, intersects, answerKind, difficultyLevel: lv },
    };
  }

  if (variant === 'equal_distance') {
    const constantDistance = rng.int(2, 20);
    return {
      ...base,
      question:
        '同じ平面上にある2本の直線の間で、2直線の間の距離は'
        + '、どの場所でも ' + constantDistance + 'cm 的一样です。'
        + 'この2本の直線は何といいますか。',
      answer: { kind: 'string', value: PARALLEL_LABEL },
      choices: VARIANT_CHOICES[variant],
      explanation:
        '2本の直線の間の距離🦶がどこでも一定なら、その2本の直線は平行です。'
        + '平行な直線は、どの場所でも離れて距離が変わりません。',
      parameters: { variant, constantDistance, answerKind: 'parallel', difficultyLevel: lv },
    };
  }

  // find_pair: 3本の直線のうち、指定した関係にある2本を答えさせる
  const relation = rng.pick(['parallel', 'perpendicular'] as const);
  // 直線あと直線い は平行、直線あと直線う は垂直という構成を固定する
  const pair = relation === 'parallel' ? { a: 0, b: 1 } : { a: 0, b: 2 };
  const choices = [
    linePairAnswer(0, 1),
    linePairAnswer(0, 2),
    linePairAnswer(1, 2),
  ];
  const answer = linePairAnswer(pair.a, pair.b);
  return {
    ...base,
    question:
      '3本の直線 あ、い、う があります。'
      + '直線あと直線いは平行で、直線あと直線うは垂直です。'
      + relation + 'な2本の直線の組はどれですか。',
    answer: { kind: 'string', value: answer },
    choices,
    explanation:
      '与えられた関係は「直線あと直線いが平行」と「直線あと直線うが垂直」です。'
      + (relation === 'parallel'
        ? '平行な組は直線あと直線いです。'
        : '垂直な組は直線あと直線う です。')
      + '直線いと直線うについては、この情報からは関係を決められません。',
    parameters: { variant, relation, pair, answerKind: relation, difficultyLevel: lv },
  };
}
// ===== 面積の単位変換 (第4学年 B 図形 平面図形の面積) =====

/** 面積の単位 */
type AreaUnit = '㎠' | '㎡' | 'a' | 'ha' | '㎢';

/** 1単位あたりの面積 (基準は ㎠) */
const AREA_SQM_FACTOR: Record<AreaUnit, number> = {
  '㎠': 1,
  '㎡': 10000,
  'a': 10000 * 100,
  'ha': 10000 * 100 * 100,
  '㎢': 10000 * 100 * 100 * 100,
};

/** 1つの換算 (from の単位を to の単位に直す) */
interface AreaConversion {
  /** variant 名 */
  name: string;
  from: AreaUnit;
  to: AreaUnit;
  /** これより低い難易度では出さない */
  minLevel: DifficultyLevel;
}

/**
 * 換算の一覧。
 * 1 a = 100 m2 / 1 ha = 100 a / 1 km2 = 100 ha / 1 m2 = 10000 cm2 より、
 * 隣り合う単位 (100 倍) と 1段飛ばし (10000 倍) の組み合わせだけを採る。
 * これより大きい倍率 (10万倍など) は数値が大きすぎて教材に適さないため採らない。
 */
const AREA_CONVERSIONS: readonly AreaConversion[] = [
  { name: 'aresu_to_sqm', from: 'a', to: '㎡', minLevel: 1 },
  { name: 'hektaru_to_aresu', from: 'ha', to: 'a', minLevel: 1 },
  { name: 'sqkm_to_hektaru', from: '㎢', to: 'ha', minLevel: 1 },
  { name: 'sqm_to_sqcm', from: '㎡', to: '㎠', minLevel: 2 },
  { name: 'sqm_to_aresu', from: '㎡', to: 'a', minLevel: 3 },
  { name: 'hektaru_to_sqkm', from: 'ha', to: '㎢', minLevel: 4 },
  { name: 'hektaru_to_sqm', from: 'ha', to: '㎡', minLevel: 5 },
  { name: 'sqm_to_hektaru', from: '㎡', to: 'ha', minLevel: 5 },
];

/**
 * 小数を許すときの「きれいな値」。
 * 分母を2のべき乗 (1/2, 1/4, 1/8) に限定している。
 * これらは2進表記で厳密に表せるので、掛け算しても誤差が出ない。
 */
const NICE_DECIMALS: readonly number[] = [0.25, 0.5, 1.25, 1.5, 2.5, 3.5, 0.125];

/**
 * 答えの上限。
 * アプリ全体の品質規則 (utils/answer.ts isReasonableAnswer) が
 * 「数値の絶対値は 1,000,000 以下」を要求しているため、ここでも同じ上限を設ける。
 */
const AREA_MAX_ANSWER = 1000000;

/** 難易度ごとの、与えてよい値の最大値 (数値の複雑度が難易度を超えないように) */
function areaMaxGiven(lv: DifficultyLevel): number {
  if (lv <= 1) return 9;
  if (lv === 2) return 99;
  if (lv === 3) return 999;
  if (lv === 4) return 9999;
  return 99999;
}

/** 面積の単位変換の難易度 */
function createAreaUnitDifficulty(lv: DifficultyLevel, givenValue: number, steps: number): ReturnType<typeof createDifficulty> {
  return createDifficulty({
    calculationComplexity: calculationStepsToComplexity(lv),
    numberComplexity: numberSizeToComplexity(givenValue),
    reasoningComplexity: Math.min(lv, steps) as DifficultyLevel,
    readingComplexity: Math.min(lv, 1) as DifficultyLevel,
  });
}

/**
 * 面積の単位変換
 *
 * 第4学年 B 図形「平面図形の面積」の面積の単位を扱う。
 * 1 a = 100 m2 / 1 ha = 100 a / 1 km2 = 100 ha / 1 m2 = 10000 cm2 の関係を、
 * 文章と数値だけで解く問題にする (図は使わない)。
 *
 * 長さの単位変換 (unit_conversion_basic) とは責務を分ける。
 * こちらは「a・ha・km2 を含む面積どうしの換算」だけを扱う。
 */
export class AreaUnitConversionGenerator implements ProblemGenerator {
  readonly type = 'area_unit_conversion';
  readonly category = 'geometry' as const;
  readonly description = '面積の単位変換';

  generate(config?: GenerationConfig): Problem {
    const rng = createRandom(config?.seed);
    const lv = config?.difficulty ?? (2 as DifficultyLevel);

    const usable = AREA_CONVERSIONS.filter((c) => c.minLevel <= lv);
    for (let attempt = 0; attempt < 80; attempt++) {
      const conv = rng.pick(usable);
      const built = buildAreaUnitConversion(conv, rng, lv);
      if (built) return built;
    }
    throw new Error('面積の単位変換の問題を生成できませんでした');
  }

  validate(problem: Problem): ValidationResult {
    const errors: string[] = [];
    const params = problem.parameters as {
      variant: string;
      from: AreaUnit;
      to: AreaUnit;
      valueNum: number;
      valueDen: number;
      answer: number;
      givenValue: number;
      multiplier: number;
      difficultyLevel: DifficultyLevel;
    };
    const { from, to, givenValue, multiplier } = params;

    if (!Object.prototype.hasOwnProperty.call(AREA_SQM_FACTOR, from)) {
      errors.push('変換元の単位が不正です: ' + String(from));
      return { valid: false, errors };
    }
    if (!Object.prototype.hasOwnProperty.call(AREA_SQM_FACTOR, to)) {
      errors.push('変換先の単位が不正です: ' + String(to));
      return { valid: false, errors };
    }
    if (from === to) errors.push('変換元と変換先が同じ単位です');
    if (givenValue <= 0) errors.push('与えられた値が正ではありません: ' + String(givenValue));
    if (params.answer <= 0) errors.push('答えが正ではありません: ' + String(params.answer));

    // 倍率が実際の単位の関係と一致しているか
    const realFactor = AREA_SQM_FACTOR[to] / AREA_SQM_FACTOR[from];
    const realMultiplier = realFactor >= 1 ? realFactor : 1 / realFactor;
    if (realMultiplier !== multiplier) {
      errors.push('乗除の倍率が不正です: ' + String(multiplier) + ' (期待値 ' + realMultiplier + ')');
    }
    if (!Number.isInteger(multiplier) || multiplier < 1) {
      errors.push('乗除の倍率が整数ではありません: ' + String(multiplier));
    }
    // 答えが整数かつ正しい (割り切れない値を丸めて誤魔化さない)
    if (!Number.isInteger(params.answer)) {
      errors.push('答えが整数ではありません: ' + String(params.answer));
    }
    // 独立に再計算する
    const totalSqcm = givenValue * AREA_SQM_FACTOR[from];
    if (!Number.isInteger(totalSqcm)) {
      errors.push('与えられた値が ㎠ に換算できません');
    } else if (AREA_SQM_FACTOR[to] !== 0) {
      const want = totalSqcm / AREA_SQM_FACTOR[to];
      if (Math.abs(want - params.answer) > 1e-9) {
        errors.push('答えが単位の関係と合いません: ' + String(params.answer) + ' (期待値 ' + want + ')');
      }
    }
    if (problem.answer.kind !== 'integer' || problem.answer.value !== params.answer) {
      errors.push('答えが parameters と一致しません');
    }
    return { valid: errors.length === 0, errors };
  }
}

/** 単位どうしの関係 (解説で使う) */
const AREA_UNIT_NOTE: Record<AreaUnit, string> = {
  '㎠': '1 平方センチメートルは 1 平方センチメートルです',
  '㎡': '1 平方メートルは 10000 平方センチメートルです',
  'a': '1 アールは 100 平方メートルです',
  'ha': '1 ヘクタールは 100 アールです',
  '㎢': '1 平方キロメートルは 100 ヘクタールです',
};

/** 面積の単位変換の1問を組み立てる (条件を満たさない場合は null を返して再試行させる) */
function buildAreaUnitConversion(
  conv: AreaConversion,
  rng: Rng,
  lv: DifficultyLevel,
): Problem | null {
  // factor は「変換先 1 単位は変換元 何 単位か」を表す (1 未満だったりする)。
  // parameters には保存しない (registry の「数値パラメータは問題文か解説に現れる」
  // という規則に引っかかるため)。方向の判定だけに使って捨てる。
  // multiplier は実際に掛ける・割る整数 (常に 100 以上) で、計算にはこちらを使う。
  const factor = AREA_SQM_FACTOR[conv.to] / AREA_SQM_FACTOR[conv.from];
  const multiplier = factor >= 1 ? factor : 1 / factor;
  const maxGiven = areaMaxGiven(lv);
  const toIsBigger = factor > 1;

  let givenValue = 0;
  let answer = 0;
  let usedDecimal = false;

  if (toIsBigger) {
    // 大きな単位に直すので、multiplier の倍数を値として選ぶ (必ず割り切れる)
    const kMax = Math.floor(maxGiven / multiplier);
    if (kMax < 1) return null;
    const k = rng.int(1, kMax);
    givenValue = k * multiplier;
    answer = k;
  } else {
    const kMax = Math.min(maxGiven, Math.floor(AREA_MAX_ANSWER / multiplier));
    if (kMax < 1) return null;
    // lv4 から小数を許す (答えが整数になるものだけを使う)
    if (lv >= 4 && rng.int(0, 1) === 1) {
      const cand = rng.pick(NICE_DECIMALS);
      const scaled = cand * multiplier;
      if (Number.isInteger(scaled) && scaled > 0 && scaled <= AREA_MAX_ANSWER) {
        givenValue = cand;
        answer = scaled;
        usedDecimal = true;
      }
    }
    if (!usedDecimal) {
      const k = rng.int(1, kMax);
      givenValue = k;
      answer = k * multiplier;
    }
  }

  if (answer <= 0 || answer > AREA_MAX_ANSWER) return null;
  if (givenValue <= 0 || !Number.isFinite(givenValue)) return null;
  // 2進表記で厳密に表れる値だけを使うので、換算しても誤差が出ない
  const totalSqcm = givenValue * AREA_SQM_FACTOR[conv.from];
  if (!Number.isInteger(totalSqcm)) return null;

  // 数値の複雑度が難易度を超えないことは maxGiven の上限で保証している
  const steps = multiplier === 10000 ? 2 : 1;

  const givenText = String(givenValue);
  const question =
    '面積の単位を直します。' + givenText + conv.from + ' は何' + conv.to + ' です。';

  // 掛け算か割り算かを明示した解説にする (答えだけでなく考え方を含める)
  const explanation = toIsBigger
    ? AREA_UNIT_NOTE[conv.from] + '、' + AREA_UNIT_NOTE[conv.to]
      + ' なので、' + multiplier + ' で割ります。'
      + givenText + conv.from + ' ÷ ' + multiplier + ' = ' + answer + conv.to + ' です。'
    : AREA_UNIT_NOTE[conv.from] + '、' + AREA_UNIT_NOTE[conv.to]
      + ' なので、' + multiplier + ' を掛けます。'
      + givenText + conv.from + ' × ' + multiplier + ' = ' + answer + conv.to + ' です。'
      + (usedDecimal ? '（小数の値なので、かけ算の結果が整数になる値を選んでいます。）' : '');

  return {
    id: generateProblemId(),
    category: 'geometry' as const,
    type: 'area_unit_conversion',
    difficulty: createAreaUnitDifficulty(lv, givenValue, steps),
    question,
    answer: { kind: 'integer', value: answer },
    explanation,
    parameters: {
      variant: conv.name,
      from: conv.from,
      to: conv.to,
      givenValue,
      multiplier,
      answer,
      difficultyLevel: lv,
    },
  };
}

// AREA_UNIT_MARKER

// ===== 面積: 正方形・長方形 (第4学年) =====

/** 正方形・長方形の面積の variant */
type RectangleAreaVariant = 'square' | 'rectangle' | 'find_side' | 'unit_convert' | 'choose_formula';

/** variant の最低難易度 */
const RECT_AREA_MIN_LEVEL: Record<RectangleAreaVariant, DifficultyLevel> = {
  square: 1,
  rectangle: 1,
  find_side: 2,
  unit_convert: 5,
  choose_formula: 4,
};

/** 面積問題の難易度 (数値の大きさと思考の負荷で決める) */
function createAreaDifficulty(lv: DifficultyLevel, value: number, steps: number): ReturnType<typeof createDifficulty> {
  return createDifficulty({
    // 既存 generator と同じく calculation を要求难度に合わせ、他はそれ以下にする
    calculationComplexity: calculationStepsToComplexity(lv),
    numberComplexity: numberSizeToComplexity(value),
    reasoningComplexity: Math.min(lv, steps) as DifficultyLevel,
    readingComplexity: Math.min(lv, 1) as DifficultyLevel,
  });
}

/** 正方形・長方形の面積 */
export class RectangleAreaGenerator implements ProblemGenerator {
  readonly type = 'rectangle_area';
  readonly category = 'geometry' as const;
  readonly description = '正方形・長方形の面積';

  generate(config?: GenerationConfig): Problem {
    const rng = createRandom(config?.seed);
    const lv = config?.difficulty ?? (2 as DifficultyLevel);
    const usable = (Object.keys(RECT_AREA_MIN_LEVEL) as RectangleAreaVariant[])
      .filter((v) => RECT_AREA_MIN_LEVEL[v] <= lv);
    for (let attempt = 0; attempt < 80; attempt++) {
      const variant = rng.pick(usable);
      const built = buildRectangleArea(variant, rng, lv);
      if (built) return built;
    }
    throw new Error('正方形・長方形の面積の問題を生成できませんでした');
  }

  validate(problem: Problem): ValidationResult {
    const errors: string[] = [];
    const q = problem.parameters as {
      variant: RectangleAreaVariant;
      width: number;
      height: number;
      area: number;
      answer: number;
      unit: string;
    };
    const { variant, width, height, area, answer } = q;

    if (!(width > 0) || !(height > 0)) errors.push('辺の長さが正ではありません');
    if (!(area > 0)) errors.push('面積が正ではありません');

    // 正方形なら2辺が等しいこと (正方形と長方形を取り違えない)
    if (variant === 'square' && width !== height) {
      errors.push('正方形の2辺が等しくありません: ' + width + ' と ' + height);
    }
    if (variant === 'rectangle' && width === height) {
      errors.push('長方形の2辺が等しくなっています (正方形です)');
    }
    // 面積 = 縦 × 横 の独立検算
    if (width * height !== area) {
      errors.push('面積が縦×横と一致しません: ' + area + ' (期待値 ' + width * height + ')');
    }
    // 1辺から求める variant では、答えがもう一方の辺になること
    if (variant === 'find_side') {
      const other = answer === width ? height : width;
      if (other === 0 || other * answer !== area) {
        errors.push('求める辺の長さが面積と整合しません: ' + answer);
      }
    } else if (variant === 'choose_formula') {
      if (problem.answer.kind !== 'string') errors.push('式を選ぶ問題は文字列解答であるべきです');
    } else if (problem.answer.kind !== 'integer' || problem.answer.value !== answer) {
      errors.push('problem.answer が parameters と一致しません');
    }
    return { valid: errors.length === 0, errors };
  }
}

/** 正方形・長方形の面積の1問を組み立てる */
function buildRectangleArea(
  variant: RectangleAreaVariant,
  rng: Rng,
  lv: DifficultyLevel,
): Problem | null {
  // lv1 では積が10未満になるよう辺を小さく保つ (数値の複雑度が难度を超えないため)
  const maxSide = lv <= 1 ? 3 : lv === 2 ? 9 : lv === 3 ? 31 : 99;
  const maxArea = lv <= 1 ? 9 : lv <= 2 ? 81 : 9801;

  if (variant === 'square') {
    const side = rng.int(2, maxSide);
    const area = side * side;
    if (area > maxArea) return null;
    return makeAreaProblem({
      type: 'rectangle_area', variant, rng, lv,
      question: '1辺が ' + side + ' cm の正方形の面積を求めなさい。',
      answer: area,
      explanation: '正方形の面積は 1辺 × 1辺 です。'
        + side + ' × ' + side + ' = ' + area + ' cm2 となります。',
      parameters: { variant, width: side, height: side, area, answer: area, unit: 'cm2' },
      steps: 1,
    });
  }

  if (variant === 'rectangle') {
    const w = rng.int(3, maxSide);
    const h = rng.int(2, maxSide);
    if (w === h) return null;
    const area = w * h;
    if (area > maxArea) return null;
    return makeAreaProblem({
      type: 'rectangle_area', variant, rng, lv,
      question: '縦 ' + h + ' cm、横 ' + w + ' cm の長方形の面積を求めなさい。',
      answer: area,
      explanation: '長方形の面積は 縦 × 横 です。'
        + h + ' × ' + w + ' = ' + area + ' cm2 となります。',
      parameters: { variant, width: w, height: h, area, answer: area, unit: 'cm2' },
      steps: 1,
    });
  }

  if (variant === 'find_side') {
    const h = rng.int(2, maxSide);
    const w = rng.int(2, maxSide);
    const area = w * h;
    if (area > maxArea) return null;
    const askWidth = rng.int(0, 1) === 1;
    const known = askWidth ? h : w;
    const want = askWidth ? w : h;
    const knownLabel = askWidth ? '縦' : '横';
    const wantLabel = askWidth ? '横' : '縦';
    return makeAreaProblem({
      type: 'rectangle_area', variant, rng, lv,
      question: '縦 ' + h + ' cm、横 ' + w + ' cm の長方形があります。'
        + knownLabel + 'の長さが ' + known + ' cm のとき、'
        + wantLabel + 'の長さはいくつですか。',
      answer: want,
      explanation: '長方形の面積は 縦 × 横 です。'
        + '面積を縦の長さで割ると横の長さが求まります。'
        + '面積は ' + h + ' × ' + w + ' = ' + area + ' cm2 なので、'
        + area + ' ÷ ' + known + ' = ' + want + ' cm です。',
      parameters: { variant, width: w, height: h, area, answer: want, unit: 'cm' },
      steps: 2,
    });
  }

  if (variant === 'unit_convert') {
    // 1 m = 100 cm なので、1 m2 = 10000 cm2 を使う (第4学年 面積の単位)
    const sideM = rng.int(2, 9);
    const sideCm = sideM * 100;
    const sqcm = sideCm * sideCm;
    return makeAreaProblem({
      type: 'rectangle_area', variant, rng, lv,
      question: '1辺が ' + sideM + ' m の正方形の面積を cm2 で表すと、何 cm2 ですか。',
      answer: sqcm,
      explanation: '1辺の長さを cm に直します。1 m = 100 cm なので、'
        + sideM + ' m = ' + sideCm + ' cm です。'
        + '正方形の面積は 1辺 × 1辺 なので、'
        + sideCm + ' × ' + sideCm + ' = ' + sqcm + ' cm2 となります。'
        + '(1 m2 = 100 × 100 = 10000 cm2 であることを使っても同じ答えになります。)',
      parameters: { variant, width: sideCm, height: sideCm, area: sqcm, answer: sqcm, unit: 'cm2' },
      steps: 2,
    });
  }

  // choose_formula: 面積を求める式を選ぶ
  const w = rng.int(2, maxSide);
  const h = rng.int(2, maxSide);
  if (w === h) return null;
  const useProduct = rng.int(0, 1) === 1;
  const answer = useProduct ? w * h : w * h;
  const correct = useProduct
    ? '縦 × 横'
    : '横 × 縦';
  const wrongA = '縦 ＋ 横';
  const wrongB = '縦 × 縦';
  return makeAreaProblem({
    type: 'rectangle_area', variant, rng, lv,
    question: '縦 ' + h + ' cm、横 ' + w + ' cm の長方形の面積を求める式はどれですか。'
      + '(1) ' + wrongA + '  (2) ' + correct + '  (3) ' + wrongB,
    answer: answer,
    answerLabel: correct,
    explanation: '長方形の面積は 縦 × 横 (または 横 × 縦) です。'
      + '掛け算を使うので、答えは「' + correct + '」です。'
      + h + ' × ' + w + ' = ' + answer + ' cm2 となります。'
      + '足し算では単位が合いません。',
    parameters: { variant, width: w, height: h, area: answer, answer: answer, unit: 'cm2' },
    steps: 1,
    choices: [wrongA, correct, wrongB],
  });
}

/** 面積問題の結果を Problem にまとめる */
function makeAreaProblem(o: {
  type: string;
  rng: Rng;
  lv: DifficultyLevel;
  question: string;
  answer: number;
  explanation: string;
  parameters: Record<string, unknown>;
  variant?: RectangleAreaVariant;
  steps: number;
  answerLabel?: string;
  choices?: string[];
}): Problem {
  return {
    id: generateProblemId(),
    category: 'geometry' as const,
    type: o.type,
    difficulty: createAreaDifficulty(o.lv, Math.max(o.answer, 1), o.steps),
    question: o.question,
    answer: o.choices !== undefined
      ? { kind: 'string', value: o.answerLabel ?? String(o.answer) }
      : { kind: 'integer', value: o.answer },
    explanation: o.explanation,
    ...(o.choices ? { inputType: 'choice' as const, choices: o.choices } : {}),
    parameters: { ...o.parameters, difficultyLevel: o.lv },
  };
}

// RECT_AREA_MARKER

// ===== 三角形の面積 (第5学年) =====

/** 三角形の面積の variant */
type TriangleAreaVariant =
  | 'find_area'
  | 'find_area_with_slant'
  | 'find_height'
  | 'find_base'
  | 'compare_with_rectangle';

/** variant の最低難易度 */
const TRI_AREA_MIN_LEVEL: Record<TriangleAreaVariant, DifficultyLevel> = {
  find_area: 1,
  find_area_with_slant: 2,
  find_height: 3,
  find_base: 4,
  compare_with_rectangle: 5,
};

/**
 * 三角形の面積
 *
 * 第5学年「三角形 ... の求積」に対応する。
 * 面積 = 底辺 × 高さ ÷ 2。底辺と高さは問題文に数値で明示し、図がなくても解けるようにする。
 * 答えが整数になる組合せだけを生成する (割り切れない値を丸めない)。
 */
export class TriangleAreaGenerator implements ProblemGenerator {
  readonly type = 'triangle_area';
  readonly category = 'geometry' as const;
  readonly description = '三角形の面積';

  generate(config?: GenerationConfig): Problem {
    const rng = createRandom(config?.seed);
    const lv = config?.difficulty ?? (2 as DifficultyLevel);
    const usable = (Object.keys(TRI_AREA_MIN_LEVEL) as TriangleAreaVariant[])
      .filter((v) => TRI_AREA_MIN_LEVEL[v] <= lv);
    for (let attempt = 0; attempt < 120; attempt++) {
      const variant = rng.pick(usable);
      const built = buildTriangleArea(variant, rng, lv);
      if (built) return built;
    }
    throw new Error('三角形の面積の問題を生成できませんでした');
  }

  validate(problem: Problem): ValidationResult {
    const errors: string[] = [];
    const q = problem.parameters as {
      variant: TriangleAreaVariant;
      base: number;
      height: number;
      area: number;
      answer: number;
      rectangleArea?: number;
    };
    const { base, height, area, answer } = q;
    if (!(base > 0) || !(height > 0)) errors.push('底辺や高さが正ではありません');
    if (!(area > 0)) errors.push('面積が正ではありません');
    if ((base * height) % 2 !== 0) errors.push('底辺×高さが奇数です (答えが整数になりません)');
    // 独立検算: 面積 = 底辺 × 高さ ÷ 2
    if (base * height / 2 !== area) {
      errors.push('面積が底辺×高さ÷2 と一致しません: ' + area);
    }
    // 逆算では他方の辺がもとの値に戻る
    if (q.variant === 'find_height' && base * answer / 2 !== area) {
      errors.push('高さの答えが面積と整合しません: ' + answer);
    }
    if (q.variant === 'find_base' && answer * height / 2 !== area) {
      errors.push('底辺の答えが面積と整合しません: ' + answer);
    }
    if (q.variant === 'compare_with_rectangle') {
      // 長方形との面積の差 = 三角形の面積
      if (q.rectangleArea !== undefined && q.rectangleArea - area !== area) {
        errors.push('長方形との差が三角形の面積と一致しません');
      }
      if (answer !== area) errors.push('差の答えが三角形の面積と一致しません');
    }
    if (problem.answer.kind !== 'integer' || problem.answer.value !== answer) {
      errors.push('problem.answer が parameters と一致しません');
    }
    return { valid: errors.length === 0, errors };
  }
}

/** 難易度ごとに許す答えの上限 (数値の複雑度が難易度を超えないように) */
function triangleAreaMax(lv: DifficultyLevel): number {
  if (lv <= 1) return 9;
  if (lv === 2) return 99;
  if (lv === 3) return 999;
  if (lv === 4) return 9999;
  return 99999;
}

/** 三角形の面積の1問を組み立てる */
function buildTriangleArea(
  variant: TriangleAreaVariant,
  rng: Rng,
  lv: DifficultyLevel,
): Problem | null {
  const max = triangleAreaMax(lv);
  // 底辺と高さの上限。積が max を超えないように小さい側から選ぶ
  // 面積の上限で自動的に絞られるため、辺の上限は少し広めに取り組合せを増やす
  const maxSide = Math.max(4, Math.floor(Math.sqrt(max)) * 3);

  for (let inner = 0; inner < 60; inner++) {
    const base = rng.int(2, Math.min(maxSide, 99));
    const height = rng.int(2, Math.min(maxSide, 99));
    const product = base * height;
    if (product % 2 !== 0) continue; // 答えが整数になる組合せだけ
    const area = product / 2;
    if (area <= 0 || area > max) continue;

    if (variant === 'find_area_with_slant') {
      // 斜辺の長さは面積の計算には使わない (高さExplicitに伝えるのが要点)
      const slant = height + rng.int(2, Math.max(3, Math.floor(height / 2)));
      return makeAreaProblem({
        type: 'triangle_area',
        rng, lv,
        question: '底辺が ' + base + ' cm、斜辺が ' + slant
          + ' cm、高さが ' + height + ' cm の三角形の面積を求めなさい。',
        answer: area,
        explanation: '求めるのは三角形の面積です。'
          + '三角形の面積は「底辺 × 高さ ÷ 2」で求めます。'
          + 'ここで使うのは底辺と高さであり、斜辺 ' + slant + ' cm は使いません。'
          + '底辺と高さで長方形を作ると、その半分が三角形になります。'
          + base + ' × ' + height + ' = ' + product + '、'
          + product + ' ÷ 2 = ' + area + ' cm2 となります。',
        parameters: { variant, base, height, slant, area, answer: area },
        steps: 2,
      });
    }

    if (variant === 'find_area') {
      return makeAreaProblem({
        type: 'triangle_area',
        rng, lv,
        question: '底辺が ' + base + ' cm、高さが ' + height
          + ' cm の三角形の面積を求めなさい。',
        answer: area,
        explanation: '求めるのは三角形の面積です。'
          + '三角形の面積は「底辺 × 高さ ÷ 2」で求めます。'
          + '長方形や平行四辺形の面積を底辺と高さで求めたあと、その半分が三角形となるためです。'
          + base + ' × ' + height + ' = ' + product + '、'
          + product + ' ÷ 2 = ' + area + ' cm2 となります。',
        parameters: { variant, base, height, area, answer: area },
        steps: 1,
      });
    }

    if (variant === 'find_height') {
      return makeAreaProblem({
        type: 'triangle_area',
        rng, lv,
        question: '底辺が ' + base + ' cm、面積が ' + area
          + ' cm2 の三角形があります。高さは何cmですか。',
        answer: height,
        explanation: '三角形の面積は「底辺 × 高さ ÷ 2」です。'
          + '面積を底辺で割ると高さの2倍になるので、最後に2で割ります。'
          + area + ' × 2 = ' + product + '、'
          + product + ' ÷ ' + base + ' = ' + height + ' cm となります。',
        parameters: { variant, base, height, area, answer: height },
        steps: 2,
      });
    }

    if (variant === 'find_base') {
      return makeAreaProblem({
        type: 'triangle_area',
        rng, lv,
        question: '高さが ' + height + ' cm、面積が ' + area
          + ' cm2 の三角形があります。底辺は何cmですか。',
        answer: base,
        explanation: '三角形の面積は「底辺 × 高さ ÷ 2」です。'
          + '面積を高さの2倍で割ると底辺が求まります。'
          + area + ' × 2 = ' + product + '、'
          + product + ' ÷ ' + height + ' = ' + base + ' cm となります。',
        parameters: { variant, base, height, area, answer: base },
        steps: 2,
      });
    }

    // compare_with_rectangle: 同じ底辺・高さの長方形と面積を比較する
    const rectangleArea = product;
    return makeAreaProblem({
      type: 'triangle_area',
      rng, lv,
      question: '底辺が ' + base + ' cm、高さが ' + height
        + ' cm の長方形と、底辺と高さが同じ三角形の面積のの差は何 cm2 ですか。'
        + '（三角形の面積は小数になりません。）',
      answer: area,
      explanation: '長方形の面積は 底辺 × 高さ = ' + base + ' × ' + height
        + ' = ' + rectangleArea + ' cm2 です。'
        + '三角形の面積はその半分なので ' + area + ' cm2 です。'
        + 'その差は ' + rectangleArea + ' − ' + area + ' = ' + area
        + ' cm2 となります（長方形の半分が三角形の面積に等しくなります）。',
      parameters: { variant, base, height, area, rectangleArea, answer: area },
      steps: 3,
    });
  }
  return null;
}

// ===== 平行四辺形の面積 (第5学年) =====

/** 平行四辺形の面積の variant */
type ParallelogramAreaVariant =
  | 'find_area'
  | 'find_area_with_slant'
  | 'find_height'
  | 'find_base'
  | 'two_triangles';

/** variant の最低難易度 */
const PARA_AREA_MIN_LEVEL: Record<ParallelogramAreaVariant, DifficultyLevel> = {
  find_area: 1,
  find_area_with_slant: 2,
  find_height: 3,
  find_base: 4,
  two_triangles: 5,
};

/** 難易度ごとに許す答えの上限 */
function parallelogramAreaMax(lv: DifficultyLevel): number {
  if (lv <= 1) return 9;
  if (lv === 2) return 99;
  if (lv === 3) return 999;
  if (lv === 4) return 9999;
  return 99999;
}

/**
 * 平行四辺形の面積
 *
 * 第5学年「平行四辺形 ... の求積」に対応する。
 * 面積 = 底辺 × 高さ。高さは斜辺ではなく底辺に垂直な辺の長さを指す。
 * 問題文には高さの値を明示し、斜辺の長さは別に示すことで混同を防ぐ。
 */
export class ParallelogramAreaGenerator implements ProblemGenerator {
  readonly type = 'parallelogram_area';
  readonly category = 'geometry' as const;
  readonly description = '平行四辺形の面積';

  generate(config?: GenerationConfig): Problem {
    const rng = createRandom(config?.seed);
    const lv = config?.difficulty ?? (2 as DifficultyLevel);
    const usable = (Object.keys(PARA_AREA_MIN_LEVEL) as ParallelogramAreaVariant[])
      .filter((v) => PARA_AREA_MIN_LEVEL[v] <= lv);
    for (let attempt = 0; attempt < 120; attempt++) {
      const variant = rng.pick(usable);
      const built = buildParallelogramArea(variant, rng, lv);
      if (built) return built;
    }
    throw new Error('平行四辺形の面積の問題を生成できませんでした');
  }

  validate(problem: Problem): ValidationResult {
    const errors: string[] = [];
    const q = problem.parameters as {
      variant: ParallelogramAreaVariant;
      base: number;
      height: number;
      area: number;
      answer: number;
      slant?: number;
      triangleArea?: number;
    };
    const { base, height, area, answer } = q;
    if (!(base > 0) || !(height > 0)) errors.push('底辺や高さが正ではありません');
    if (!(area > 0)) errors.push('面積が正ではありません');
    // 独立検算: 面積 = 底辺 × 高さ (三角形처럼 ÷2 しない)
    if (base * height !== area) {
      errors.push('面積が底辺×高さと一致しません: ' + area);
    }
    if (q.variant === 'find_height' && base * answer !== area) {
      errors.push('高さの答えが面積と整合しません: ' + answer);
    }
    if (q.variant === 'find_base' && answer * height !== area) {
      errors.push('底辺の答えが面積と整合しません: ' + answer);
    }
    if (q.variant === 'two_triangles') {
      // 対角線で分けた各三角形の面積は平行四辺形の半分
      if (q.triangleArea !== undefined && q.triangleArea * 2 !== area) {
        errors.push('三角形の面積の2倍が平行四辺形の面積と一致しません');
      }
      if (answer !== q.triangleArea) errors.push('答えが三角形の面積と一致しません');
      if (!Number.isInteger(answer)) errors.push('三角形の面積が整数ではありません');
    }
    if (problem.answer.kind !== 'integer' || problem.answer.value !== answer) {
      errors.push('problem.answer が parameters と一致しません');
    }
    return { valid: errors.length === 0, errors };
  }
}

/** 平行四辺形の面積の1問を組み立てる */
function buildParallelogramArea(
  variant: ParallelogramAreaVariant,
  rng: Rng,
  lv: DifficultyLevel,
): Problem | null {
  const max = parallelogramAreaMax(lv);
  // 面積の上限で自動的に絞られるため、辺の上限は少し広めに取り組合せを増やす
  const maxSide = Math.max(4, Math.floor(Math.sqrt(max)) * 3);

  for (let inner = 0; inner < 60; inner++) {
    const base = rng.int(2, Math.min(maxSide, 99));
    const height = rng.int(2, Math.min(maxSide, 99));
    const area = base * height;
    if (area <= 0 || area > max) continue;

    if (variant === 'find_area_with_slant') {
      // 斜辺の長さは計算に使わない (高さとの区別が要点)
      const slant = height + rng.int(1, Math.max(2, height));
      return makeAreaProblem({
        type: 'parallelogram_area',
        rng, lv,
        question: '底辺が ' + base + ' cm、斜辺が ' + slant
          + ' cm、底辺に垂直な辺（高さ）が ' + height
          + ' cm の平行四辺形の面積を求めなさい。',
        answer: area,
        explanation: '平行四辺形の面積は「底辺 × 高さ」で求めます。'
          + 'ここで使うのは底辺 ' + base + ' cm と高さ ' + height + ' cm であり、'
          + '斜辺の長さ ' + slant + ' cm は使いません。'
          + base + ' × ' + height + ' = ' + area + ' cm2 となります。',
        parameters: { variant, base, height, slant, area, answer: area },
        steps: 2,
      });
    }

    if (variant === 'find_area') {
      return makeAreaProblem({
        type: 'parallelogram_area',
        rng, lv,
        question: '底辺が ' + base + ' cm、高さが ' + height
          + ' cm の平行四辺形の面積を求めなさい。',
        answer: area,
        explanation: '求めるのは平行四辺形の面積です。'
          + '平行四辺形の面積は「底辺 × 高さ」で求めます。'
          + '長方形の面積を求めるのと同じ式になります。'
          + base + ' × ' + height + ' = ' + area + ' cm2 となります。',
        parameters: { variant, base, height, area, answer: area },
        steps: 1,
      });
    }

    if (variant === 'find_height') {
      return makeAreaProblem({
        type: 'parallelogram_area',
        rng, lv,
        question: '底辺が ' + base + ' cm、面積が ' + area
          + ' cm2 の平行四辺形があります。高さは何cmですか。',
        answer: height,
        explanation: '平行四辺形の面積は「底辺 × 高さ」です。'
          + '面積を底辺で割ると高さが求まります。'
          + area + ' ÷ ' + base + ' = ' + height + ' cm となります。',
        parameters: { variant, base, height, area, answer: height },
        steps: 2,
      });
    }

    if (variant === 'find_base') {
      return makeAreaProblem({
        type: 'parallelogram_area',
        rng, lv,
        question: '高さが ' + height + ' cm、面積が ' + area
          + ' cm2 の平行四辺形があります。底辺は何cmですか。',
        answer: base,
        explanation: '平行四辺形の面積は「底辺 × 高さ」です。'
          + '面積を高さで割ると底辺が求まります。'
          + area + ' ÷ ' + height + ' = ' + base + ' cm となります。',
        parameters: { variant, base, height, area, answer: base },
        steps: 2,
      });
    }

    // two_triangles: 対角線で分けた各三角形の面積を求める (整数になる組合せだけ)
    if (area % 2 !== 0) continue;
    const triangleArea = area / 2;
    return makeAreaProblem({
      type: 'parallelogram_area',
      rng, lv,
      question: '底辺が ' + base + ' cm、高さが ' + height
        + ' cm の平行四辺形を、対角線で2つの三角形に分けました。'
        + 'このうち1つの三角形の面積は何 cm2 ですか。',
      answer: triangleArea,
      explanation: '平行四辺形の面積は 底辺 × 高さ = ' + base + ' × ' + height
        + ' = ' + area + ' cm2 です。'
        + '対角線で分けた2つの三角形は、それぞれ面積が平行四辺形の半分になります。'
        + area + ' ÷ 2 = ' + triangleArea + ' cm2 となります。',
      parameters: { variant, base, height, area, triangleArea, answer: triangleArea },
      steps: 2,
    });
  }
  return null;
}

// PARA_AREA_MARKER

// ============================================================
// 合同図形 (judge_same) — Phase 1: 三角形のみ・合同であるケースのみ
// ============================================================

/**
 * judge_same の問題設計:
 *
 * - 図Aとなる三角形を先に生成する。
 * - 図Bは図Aに「合同変換 (回転 + 平行移動。拡大縮小なし)」を適用して作る。
 *   よって B は必ず A と合同であることが数学的に保証される。
 * - 答えは必ず「はい」。非合同ケースは別 problemType の責務とし、ここでは扱わない。
 *
 * 座標は viewBox  normalisation を考慮して小さい整数に収める。
 */
export class CongruentJudgeSameGenerator implements ProblemGenerator {
  readonly type = 'judge_same';
  readonly category = 'geometry' as const;
  readonly description = '2つの三角形が合同かどうかを判定する (合同である場合)';

  generate(config?: GenerationConfig): Problem {
    const rng = createRandom(config?.seed);
    const lv = (config?.difficulty ?? (2 as DifficultyLevel)) as DifficultyLevel;

    // --- 図Aとなる非退化三角形 (整数格子) を生成する ---
    // 面積>0 (非退化) かつ 極端に細長くない (最長辺/最短辺 <= 3) を満たす組を採用する。
    const buildTriangleA = (): FigurePoint[] => {
      for (let t = 0; t < 200; t++) {
        const pts: FigurePoint[] = [
          { x: rng.int(0, 2), y: rng.int(0, 1) },
          { x: rng.int(4, 7), y: rng.int(0, 1) },
          { x: rng.int(1, 6), y: rng.int(3, 5) },
        ];
        if (polygonArea(pts) <= 1) continue; // 非退化
        const sides = triangleSideLengths(pts); // 昇順
        if (sides[2] / sides[0] > 3) continue; // 細長すぎる
        return pts;
      }
      // フォールバック (常に非退化)
      return [
        { x: 0, y: 0 },
        { x: 5, y: 0 },
        { x: 1, y: 3 },
      ];
    };

    const triA = buildTriangleA();

    // --- 図B = 図A を合同変換 (回転 + 平行移動) ---
    // 拡大縮小は行わない。
    //
    // 回転角は 90° の倍数 (90/180/270) に限定する。
    // cos/sin が厳密に 0/±1 になるため、浮動小数点の丸め誤差がゼロに収まり、
    // 「辺長・面積・距離行列が完全に一致する」ことが保証される。
    // (45° 系は √2 が出て端数が発生し、丸めにより合同性が壊れるため使わない)
    const angles = [90, 180, 270] as const;
    const angle = rng.pick([...angles]);
    const rad = (angle * Math.PI) / 180;
    const cos = Math.round(Math.cos(rad)); // 0 / 1 / -1 のいずれか (厳密)
    const sin = Math.round(Math.sin(rad));
    // 平行移動量 (図Aと図Bが重ならないよう離す)
    const tx = rng.int(10, 13);
    const ty = rng.int(0, 2);

    const rot = (p: FigurePoint): FigurePoint => ({
      x: p.x * cos - p.y * sin + tx,
      y: p.x * sin + p.y * cos + ty,
    });
    const triB: FigurePoint[] = triA.map(rot);

    // 図A / 図B の FigureSpec
    const labelTriangle = (pts: FigurePoint[], caption: string): Figure => ({
      kind: 'triangle',
      vertices: pts,
      caption,
      points: [
        { at: pts[0], label: 'A' },
        { at: pts[1], label: 'B' },
        { at: pts[2], label: 'C' },
      ],
    });

    // 問題文は答えを洩らさない表現を搾り出す。
    // 「○度回転した」と書くと合同変換であることを教えてしまい、
    // 「合同か?」という問いに自明な答えを与えてしまうため回転角は出さない。
    // 意味の上では中立な言い回しの違いだけで variety を作る。
    const WORDINGS = [
      '図Aと図Bは合同ですか。（はい/いいえ）',
      '図Aと図Bは、重ねるとぴったり重なりますか。（はい/いいえ）',
      '下の図Aと図Bは合同した図形ですか。（はい/いいえ）',
    ];
    const wording = rng.pick(WORDINGS);

    return {
      id: generateProblemId(),
      category: this.category,
      type: this.type,
      // 難易度 level は指定 lv に一致させる必要がある。
      // calculateDifficultyLevel は 4 成分の最大値なので、
      // 成分をそのまま書くと level が固定され lv 指定の生成が失敗する。
      // reasoning と reading を lv に追従させて level == lv を保証する。
      difficulty: createGeometryDifficulty(lv, 8, lv >= 3 ? 3 : lv, lv >= 2 ? 2 : 1),
      question: wording,
      answer: { kind: 'string', value: 'はい' },
      explanation:
        '図Bは図Aを' + angle + '°回転させ、平行移動した図形です。'
        + '回転と平行移動では辺の長さと角の大きさが変わらないので、'
        + '図Aと図Bは合同です。',
      parameters: {
        rotationDeg: angle,
        difficultyLevel: lv,
        // tx/ty (平行移動量) と図Aの座標は figure に含まれている。
        // parameters には数値を残さない。数値パラメータを問題文・解説に
        // 出す必要がないため (既存の内部インデックス系の扱いと同じ)。
      },
      figure: {
        figures: [labelTriangle(triA, '図A'), labelTriangle(triB, '図B')],
      },
    };
  }

  validate(problem: Problem): ValidationResult {
    const errors: string[] = [];
    // 図が figure に含まれているか
    const spec = problem.figure;
    if (!spec || spec.figures.length !== 2) {
      errors.push('judge_same は図を2つ持つ必要があります');
      return { valid: false, errors };
    }
    // 答えが「はい」か
    if (problem.answer.kind !== 'string' || problem.answer.value !== 'はい') {
      errors.push('judge_same の正解は「はい」です');
    }
    return { valid: errors.length === 0, errors };
  }
}
// ============================================================
// 合同図形 (judge_differs) — Phase 2: 三角形のみ・合同でないケースのみ
// ============================================================

/**
 * judge_differs の問題設計:
 *
 * - 図A (非退化三角形) を生成し、図B を「合同ではない」3種の変形で作る。
 *     scaled        : 図A 全体を2倍にする (大きさが違う)
 *     apex_moved    : 図A の頂点1つだけを横に移動する (形が違う / 底辺は同じ)
 *     base_widened  : 図A の底辺の両端を広げる (底辺が違う)
 * - 変形後は **generator 側で独立に検算** し、
 *   「辺長のmultiset が一致している」「いずれかの頂点対応で全距離一致する」
 *   場合は合同である可能性が残るため採用せず、再生成する。
 *   上限到達時は黙って縮退せず、明示的に Error を投げる。
 *
 * 答えは必ず「いいえ」。合同ケースは judge_same の責務。
 */

/** 図Aの三角形を作る (非退化かつ非細長) */
function buildBaseTriangleForDiffers(rng: SeededRandom): FigurePoint[] {
  for (let t = 0; t < 200; t++) {
    const pts: FigurePoint[] = [
      { x: rng.int(0, 2), y: rng.int(0, 1) },
      { x: rng.int(4, 7), y: rng.int(0, 1) },
      { x: rng.int(1, 6), y: rng.int(3, 5) },
    ];
    if (polygonArea(pts) <= 1) continue;
    const sides = triangleSideLengths(pts);
    if (sides[2] / sides[0] > 3) continue;
    return pts;
  }
  return [
    { x: 0, y: 0 },
    { x: 5, y: 0 },
    { x: 1, y: 3 },
  ];
}

/**
 * 合同でない図Bを作る。変形で図形が壊れる場合は null を返す
 * (generate 側で再試行として扱う)。
 */
function makeNonCongruentPartner(
  rng: SeededRandom,
  triA: FigurePoint[],
): { triB: FigurePoint[]; variant: string } | null {
  const tx = rng.int(10, 13);
  const ty = rng.int(0, 2);
  const variant = rng.pick(['scaled', 'apex_moved', 'base_widened'] as const);

  let pts: FigurePoint[];
  if (variant === 'scaled') {
    // 全体を2倍 (整数座標のまま) — 大きさが違う
    pts = triA.map((p) => ({ x: p.x * 2, y: p.y * 2 }));
  } else if (variant === 'apex_moved') {
    // 頂点(先頭)だけを横へ移動 — 底辺はそのまま、形だけ違う
    const dx = rng.int(-2, 2);
    if (dx === 0) return null;
    pts = [triA[0], triA[1], { x: triA[2].x + dx, y: triA[2].y }];
  } else {
    // 底辺の両端を1ずつ広げる — 底辺が違う
    pts = [
      { x: triA[0].x - 1, y: triA[0].y },
      { x: triA[1].x + 1, y: triA[1].y },
      triA[2],
    ];
  }

  const triB = pts.map((p) => ({ x: p.x + tx, y: p.y + ty }));
  if (polygonArea(triB) <= 1) return null; // 退化した場合は採用しない
  const sides = triangleSideLengths(triB);
  if (!(sides[2] / sides[0] <= 3)) return null; // 細長すぎる
  return { triB, variant };
}

/* --- judge_differs 専用の独立検算 (guard) ---
   生成した図形が本当に合同でないかを判定するためだけのもの。
   テスト側はこれらを一切使わず、別の式で再計算する。
*/

function guardDist(a: FigurePoint, b: FigurePoint): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

/** 辺長のmultiset (昇順) */
function guardSideSet(t: FigurePoint[]): number[] {
  return [guardDist(t[0], t[1]), guardDist(t[1], t[2]), guardDist(t[2], t[0])].sort(
    (x, y) => x - y,
  );
}

/** 頂点対応6通りを全探索して合同なら true (SSS の直接検証) */
function guardIsCongruent(a: FigurePoint[], b: FigurePoint[]): boolean {
  const da = [
    guardDist(a[0], a[1]),
    guardDist(a[0], a[2]),
    guardDist(a[1], a[2]),
  ];
  const perms = [
    [0, 1, 2], [0, 2, 1], [1, 0, 2],
    [1, 2, 0], [2, 0, 1], [2, 1, 0],
  ];
  for (const [i, j, k] of perms) {
    if (
      Math.abs(da[0] - guardDist(b[i], b[j])) < 1e-6 &&
      Math.abs(da[1] - guardDist(b[i], b[k])) < 1e-6 &&
      Math.abs(da[2] - guardDist(b[j], b[k])) < 1e-6
    ) {
      return true;
    }
  }
  return false;
}

/** 三角形の分類 (図Aの説明文に使う。答えの手がかりにはしない) */
function guardTriangleType(t: FigurePoint[]): '正三角形' | '二等辺三角形' | '不等辺三角形' {
  const s = guardSideSet(t);
  const eq = (x: number, y: number): boolean => Math.abs(x - y) < 1e-9;
  if (eq(s[0], s[1]) && eq(s[1], s[2])) return '正三角形';
  if (eq(s[0], s[1]) || eq(s[1], s[2]) || eq(s[0], s[2])) return '二等辺三角形';
  return '不等辺三角形';
}
export class CongruentJudgeDiffersGenerator implements ProblemGenerator {
  readonly type = 'judge_differs';
  readonly category = 'geometry' as const;
  readonly description = '2つの三角形が合同かどうかを判定する (合同でない場合)';

  /** 再生成の上限。上限に達したら黙って縮退せず Error を投げる。 */
  private static readonly MAX_ATTEMPTS = 60;

  generate(config?: GenerationConfig): Problem {
    const rng = createRandom(config?.seed);
    const lv = (config?.difficulty ?? (3 as DifficultyLevel)) as DifficultyLevel;

    // lv1 は対象外 (metadata の supportedLevels: [2,3,4,5] と一致させる)。
    // 未対応レベルの生成を黙って行うと宣言と実際の挙動が食い違う。
    if (lv < 2) {
      throw new Error('judge_differs は lv2〜5 のみを対応しています (lv1 は未対応)');
    }

    const max = CongruentJudgeDiffersGenerator.MAX_ATTEMPTS;
    for (let attempt = 0; attempt < max; attempt++) {
      const triA = buildBaseTriangleForDiffers(rng);
      const made = makeNonCongruentPartner(rng, triA);
      if (!made) continue;

      // --- 生成後の独立検算: 合同である可能性が残る組は採用しない ---
      const sideSetA = guardSideSet(triA);
      const sideSetB = guardSideSet(made.triB);
      if (sideSetA.every((v, i) => Math.abs(v - sideSetB[i]) < 1e-6)) continue;
      if (guardIsCongruent(triA, made.triB)) continue;

      const typeA = guardTriangleType(triA);

      // 問題文は答えを洩らさない表現を搾り出す。
      // 図Aの形(分類)を書くのは答えの手がかりにならないため安全。
      // 図Bの分類は「分類が違う→合同でない」と推れるため書かない。
      const WORDINGS = [
        '図Aと図Bは合同ですか。（はい/いいえ）',
        '図Aと図Bは、重ねるとぴったり重なりますか。（はい/いいえ）',
        '図Aと図Bは合同した図形ですか。（はい/いいえ）',
        '図Aと図Bの形と大きさは同じですか。（はい/いいえ）',
        '図Aを回転させたり平行移動させたりすると図Bになりますか。（はい/いいえ）',
        '図Aと図Bは、辺の長さと角の大きさがすべて対応して等しいですか。（はい/いいえ）',
        '下の図Aと図Bは合同ですか。（はい/いいえ）',
        '図Aと図Bは、形も大きさも同じですか。（はい/いいえ）',
      ];
      // 答えを洩らさない範囲での多様化はここが上限。
      // 問題文の distinct は「図Aの分類(3種) x 言い回し(8種)」で最大15。
      // 回転角・辺長を問題文に出すと合同変換や不一致が答えとして伝わるため出さない。
      const question = '図Aは' + typeA + 'です。' + rng.pick(WORDINGS);

      return {
        id: generateProblemId(),
        category: this.category,
        type: this.type,
        // calculateDifficultyLevel は最大値なので成分を lv に追従させる。
        difficulty: createGeometryDifficulty(lv, 8, lv >= 3 ? 3 : lv, lv >= 2 ? 2 : 1),
        question,
        answer: { kind: 'string', value: 'いいえ' },
        explanation:
          '図Aと図Bでは、対応する辺の長さがすべて等しくありません。'
          + '合同な図形は辺の長さと角の大きさがすべて対応して等しいはずなので、'
          + '図Aと図Bは合同ではありません。',
        parameters: {
          variant: made.variant,
          difficultyLevel: lv,
        },
        figure: {
          figures: [
            labelTriangleFigure(triA, '図A'),
            labelTriangleFigure(made.triB, '図B'),
          ],
        },
      };
    }

    throw new Error(
      `judge_differs: ${max}回試行しても非合同な三角形2つを生成できませんでした`,
    );
  }

  validate(problem: Problem): ValidationResult {
    const errors: string[] = [];
    const spec = problem.figure;
    if (!spec || spec.figures.length !== 2) {
      errors.push('judge_differs は図を2つ持つ必要があります');
      return { valid: false, errors };
    }
    const a = spec.figures[0].vertices;
    const b = spec.figures[1].vertices;
    if (a.length !== 3 || b.length !== 3) {
      errors.push('judge_differs は三角形を持つ必要があります');
    } else if (guardIsCongruent(a, b)) {
      // 図形データから非合同であることを自前で検証する
      errors.push('judge_differs の図形は合同です (厳密には誤り)');
    }
    if (problem.answer.kind !== 'string' || problem.answer.value !== 'いいえ') {
      errors.push('judge_differs の正解は「いいえ」です');
    }
    return { valid: errors.length === 0, errors };
  }
}

/** 三角形に頂点ラベルを付けて Figure を作る */
function labelTriangleFigure(pts: FigurePoint[], caption: string): Figure {
  return {
    kind: 'triangle',
    vertices: pts,
    caption,
    points: [
      { at: pts[0], label: 'A' },
      { at: pts[1], label: 'B' },
      { at: pts[2], label: 'C' },
    ],
  };
}

/** 多角形の面積 (Shoelace formula) を独立に計算する */
function polygonArea(pts: FigurePoint[]): number {
  let sum = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    sum += a.x * b.y - b.x * a.y;
  }
  return Math.abs(sum) / 2;
}

/** 三角形の3辺の長さを独立に計算する (重複除去なしで3本) */
function triangleSideLengths(pts: FigurePoint[]): number[] {
  const dist = (a: FigurePoint, b: FigurePoint): number =>
    Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
  return [
    dist(pts[0], pts[1]),
    dist(pts[1], pts[2]),
    dist(pts[2], pts[0]),
  ].sort((x, y) => x - y);
}
