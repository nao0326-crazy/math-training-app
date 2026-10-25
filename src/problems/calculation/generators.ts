import type { ProblemGenerator, CalculationType, GenerationConfig, Problem, Category, ValidationResult, DifficultyLevel } from '../../types/problem';
import { v4 as generateProblemId } from 'uuid';

function createRandom(seed?: number) {
  const seedValue = seed || Date.now();
  let state = seedValue;
  return {
    int: (min: number, max: number) => {
      state = (state * 16807) % 2147483647;
      return Math.floor(min + (state / 2147483647) * (max - min + 1));
    },
  };
}

/** 単純計算の問題ジェネレータ */
export class CalculationGenerator implements ProblemGenerator {
  readonly type = "calculation" as const;
  readonly category: Category = 'integer';
  readonly description = "単純計算問題";

  constructor(
    readonly questionCount = 100,
    readonly types: CalculationType[] = [
      "addition_1_1",
      "addition_2_1",
      "addition_2_2",
      "subtraction_1_1",
      "subtraction_2_1",
      "subtraction_2_2",
      "multiplication_1_1",
      "multiplication_2_1",
      "multiplication_2_2",
      "division_2_1",
    ],
  ) {}

  generate(config?: GenerationConfig & { seed?: number }): Problem {
    const rng = createRandom(config?.seed);

    const difficulty: DifficultyLevel = (config?.difficulty ?? rng.int(1, 5)) as DifficultyLevel;

    const typesToGenerate = config?.type
      ? [config.type as CalculationType]
      : this.types;

    const problems: Problem[] = [];
    const usedQuestions = new Set();

    const questionsPerType = Math.floor(this.questionCount / typesToGenerate.length);
    const remainder = this.questionCount - questionsPerType * typesToGenerate.length;

    let questionIndex = 1;

    for (let ti = 0; ti < typesToGenerate.length; ti++) {
      const type = typesToGenerate[ti];
      const count = questionsPerType + (ti < remainder ? 1 : 0);

      for (let i = 0; i < count; i++) {
        let a: number;
        let b: number;
        let answer: number;
        let attempts = 0;

        const typeKey = type.split("_");
        const digitsA = parseInt(typeKey[1]) || 1;

        // Generate operands based on type
        switch (type) {
          case "addition_1_1": {
            a = rng.int(1, 9);
            b = rng.int(1, 9);
            answer = a + b;
            break;
          }
          case "addition_2_1": {
            a = rng.int(10, 99);
            b = rng.int(1, 9);
            answer = a + b;
            break;
          }
          case "addition_2_2": {
            a = rng.int(10, 99);
            b = rng.int(10, 99);
            answer = a + b;
            break;
          }
          case "subtraction_1_1": {
            let sa: number;
            let sb: number;
            do {
              sa = rng.int(1, 9);
              sb = rng.int(1, 9);
              attempts++;
              if (attempts >= 50) {
                sa = 9;
                sb = 1;
                break;
              }
            } while (sa - sb < 0);
            a = sa;
            b = sb;
            answer = a - b;
            break;
          }
          case "subtraction_2_1": {
            let sa: number;
            let sb: number;
            do {
              sa = rng.int(10, 99);
              sb = rng.int(1, 9);
              attempts++;
              if (attempts >= 50) {
                sa = 55;
                sb = 23;
                break;
              }
            } while (sa - sb < 0);
            a = sa;
            b = sb;
            answer = a - b;
            break;
          }
          case "subtraction_2_2": {
            let sa: number;
            let sb: number;
            do {
              sa = rng.int(10, 99);
              sb = rng.int(10, 99);
              attempts++;
              if (attempts >= 50) {
                sa = 77;
                sb = 33;
                break;
              }
            } while (sa - sb < 0);
            a = sa;
            b = sb;
            answer = a - b;
            break;
          }
          case "multiplication_1_1": {
            a = rng.int(1, 9);
            b = rng.int(1, 9);
            answer = a * b;
            break;
          }
          case "multiplication_2_1": {
            a = rng.int(10, 99);
            b = rng.int(1, 9);
            answer = a * b;
            break;
          }
          case "multiplication_2_2": {
            a = rng.int(10, 99);
            b = rng.int(10, 99);
            answer = a * b;
            break;
          }
          case "division_2_1": {
            const divisor = rng.int(1, 9);
            const quotient = rng.int(Math.pow(10, digitsA - 1) || 10, Math.pow(10, digitsA) - 1 || 99);
            a = divisor * quotient;
            b = divisor;
            answer = quotient;
            break;
          }
          default: {
            a = 0;
            b = 0;
            answer = 0;
          }
        }

        const questionKey = type + "_" + a + "_" + b;
        if (usedQuestions.has(questionKey)) {
          i--;
          continue;
        }
        usedQuestions.add(questionKey);

        const problem: Problem = {
          id: generateProblemId(),
          category: this.category,
          type: this.type,
          difficulty: { level: difficulty, components: { calculationComplexity: 1, numberComplexity: 1, reasoningComplexity: 1, readingComplexity: 1 } },
          question: questionIndex + ". " + formatQuestion(type, a, b),
          answer: { kind: "integer", value: answer },
          explanation: a + OP_SYMBOL[type] + b + "=" + answer + " です。",
          inputType: "integer",
          parameters: {
            type: type,
            a: a,
            b: b,
          },
        };
        problems.push(problem);
        questionIndex++;
      }
    }

    return problems.length > 0 ? problems[0] : { id: generateProblemId(), category: this.category, type: this.type, difficulty: { level: 1, components: { calculationComplexity: 1, numberComplexity: 1, reasoningComplexity: 1, readingComplexity: 1 } }, question: "", answer: { kind: "integer", value: 0 }, explanation: "", inputType: "integer", parameters: { type: "addition_1_1", a: 0 } };
  }

  validate(problem: Problem): ValidationResult {
    if (!problem) {
      return { valid: false, errors: ['Problem is required'] };
    }
    if (!problem.id) {
      return { valid: false, errors: ['Problem missing id'] };
    }
    if (problem.answer?.kind !== 'integer') {
      return { valid: false, errors: ['Unsupported answer type'] };
    }
    if (typeof problem.difficulty?.level !== 'number') {
      return { valid: false, errors: ['Missing or invalid difficulty level'] };
    }
    return { valid: true, errors: [] };
  }
}

const OP_SYMBOL: Record<CalculationType, string> = {
  addition_1_1: "＋",
  addition_2_1: "＋",
  addition_2_2: "＋",
  subtraction_1_1: "−",
  subtraction_2_1: "−",
  subtraction_2_2: "−",
  multiplication_1_1: "×",
  multiplication_2_1: "×",
  multiplication_2_2: "×",
  division_2_1: "÷",
};

function formatQuestion(type: CalculationType, a: number, b: number): string {
  return `${a} ${OP_SYMBOL[type]} ${b}`;
}
