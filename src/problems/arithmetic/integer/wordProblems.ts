/**
 * 整数の文章題ジェネレータ
 * 足し算・引き算・掛け算・割り算の文章題
 */

import type {
  DifficultyLevel,
  GenerationConfig,
  Problem,
  ProblemGenerator,
  ValidationResult,
} from '../../../types/problem';
import { createRandom, generateProblemId } from '../../../utils/random';
import { validateProblem } from '../../../engine/validator/validator';
import { createIntegerDifficulty } from './helpers';

/**
 * 文章題のテンプレート
 */
interface WordProblemTemplate {
  /** 演算タイプ */
  op: '+' | '-' | '×' | '÷';
  /** 文章テンプレート。{a}, {b} が数値に置き換わる */
  template: string;
  /** 質問文 */
  question: string;
  /** 解説テンプレート */
  explanation: string;
  /** 読解の複雑さ */
  readingLevel: DifficultyLevel;
  /** 思考の複雑さ */
  reasoningLevel: DifficultyLevel;
}

/**
 * 文章題テンプレート集
 */
const TEMPLATES: WordProblemTemplate[] = [
  // 足し算
  {
    op: '+',
    template: 'りんごが{a}個あります。そこに{b}個もってきました。',
    question: 'りんごは全部で何個になりますか',
    explanation: '{a}＋{b}＝{answer} です。',
    readingLevel: 1,
    reasoningLevel: 1,
  },
  {
    op: '+',
    template: '本が{a}冊あります。あたらしく{b}冊かいました。',
    question: '本は全部で何冊になりますか',
    explanation: '{a}＋{b}＝{answer} です。',
    readingLevel: 1,
    reasoningLevel: 1,
  },
  {
    op: '+',
    template: 'たろうくんは{a}円もっています。おばあさんから{b}円もらいました。',
    question: 'たろうくんは何円もっていますか',
    explanation: '{a}＋{b}＝{answer} です。',
    readingLevel: 2,
    reasoningLevel: 1,
  },

  // 引き算
  {
    op: '-',
    template: 'クッキーが{a}個あります。{b}個たべました。',
    question: 'のこりは何個ですか',
    explanation: '{a}−{b}＝{answer} です。',
    readingLevel: 1,
    reasoningLevel: 1,
  },
  {
    op: '-',
    template: 'えんぴつが{a}本あります。{b}本つかいました。',
    question: 'のこりは何本ですか',
    explanation: '{a}−{b}＝{answer} です。',
    readingLevel: 1,
    reasoningLevel: 1,
  },
  {
    op: '-',
    template: 'クラスに{a}人の子どもがいます。そのうち{b}人がおとこの子です。',
    question: 'おんなの子は何人ですか',
    explanation: '{a}−{b}＝{answer} です。',
    readingLevel: 2,
    reasoningLevel: 2,
  },

  // 掛け算
  {
    op: '×',
    template: '1ふくろに{a}このあめが入っています。{b}ふくろあります。',
    question: 'あめは全部で何こありますか',
    explanation: '{a}×{b}＝{answer} です。',
    readingLevel: 1,
    reasoningLevel: 1,
  },
  {
    op: '×',
    template: '1台の車に{a}人ずつのっています。{b}台あります。',
    question: '車にのっている人は全部で何人ですか',
    explanation: '{a}×{b}＝{answer} です。',
    readingLevel: 2,
    reasoningLevel: 1,
  },
  {
    op: '×',
    template: '1日で{a}ページずつ本をよみます。{b}日間よみました。',
    question: 'よんだページは全部で何ページですか',
    explanation: '{a}×{b}＝{answer} です。',
    readingLevel: 2,
    reasoningLevel: 2,
  },

  // 割り算
  {
    op: '÷',
    template: '{a}このあめを{b}人で同じ数ずつ分けます。',
    question: '1人分は何こになりますか',
    explanation: '{a}÷{b}＝{answer} です。',
    readingLevel: 1,
    reasoningLevel: 1,
  },
  {
    op: '÷',
    template: '{a}まいの色紙を{b}人で同じ数ずつ分けます。',
    question: '1人分は何まいになりますか',
    explanation: '{a}÷{b}＝{answer} です。',
    readingLevel: 1,
    reasoningLevel: 1,
  },
  {
    op: '÷',
    template: '{a}このおはじきを1人{b}こずつ分けます。',
    question: '何人に分けられますか',
    explanation: '{a}÷{b}＝{answer} です。',
    readingLevel: 2,
    reasoningLevel: 2,
  },
];

/**
 * 整数の文章題ジェネレータ
 */
export class IntegerWordProblemGenerator implements ProblemGenerator {
  readonly type = 'integer_word_problem';
  readonly category = 'integer' as const;
  readonly description = '整数の文章題';

  generate(config?: GenerationConfig): Problem {
    const rng = createRandom(config?.seed);
    const level = (config?.difficulty ?? rng.int(1, 3)) as DifficultyLevel;

    // 難易度に合うテンプレートを選ぶ
    const candidates = TEMPLATES.filter((t) => {
      const maxReading = Math.max(t.readingLevel, t.reasoningLevel);
      return maxReading <= level + 1;
    });
    const template = rng.pick(candidates.length > 0 ? candidates : TEMPLATES);

    // 数値を生成
    let a: number;
    let b: number;
    let answer: number;

    switch (template.op) {
      case '+': {
        const maxNum = level <= 1 ? 9 : level === 2 ? 20 : 50;
        a = rng.int(1, maxNum);
        b = rng.int(1, maxNum);
        answer = a + b;
        break;
      }
      case '-': {
        const maxNum = level <= 1 ? 9 : level === 2 ? 20 : 50;
        a = rng.int(2, maxNum);
        b = rng.int(1, a - 1);
        answer = a - b;
        break;
      }
      case '×': {
        const maxNum = level <= 1 ? 5 : level === 2 ? 9 : 12;
        a = rng.int(2, maxNum);
        b = rng.int(2, maxNum);
        answer = a * b;
        break;
      }
      case '÷': {
        const maxNum = level <= 1 ? 5 : level === 2 ? 9 : 12;
        b = rng.int(2, maxNum);
        answer = rng.int(2, maxNum);
        a = b * answer;
        break;
      }
    }

    // 文章を組み立てる
    const story = template.template
      .replace('{a}', String(a))
      .replace('{b}', String(b));
    const question = `${story}${template.question}。`;
    const explanation = template.explanation
      .replace('{a}', String(a))
      .replace('{b}', String(b))
      .replace('{answer}', String(answer));

    return {
      id: generateProblemId(),
      category: this.category,
      type: this.type,
      difficulty: createIntegerDifficulty(
        level,
        a,
        b,
        template.reasoningLevel,
        template.readingLevel,
      ),
      question,
      answer: { kind: 'integer', value: answer },
      explanation,
      parameters: {
        a,
        b,
        operator: template.op,
        answer,
        difficultyLevel: level,
        templateIndex: TEMPLATES.indexOf(template),
        readingLevel: template.readingLevel,
        reasoningLevel: template.reasoningLevel,
      },
    };
  }

  validate(problem: Problem): ValidationResult {
    return validateProblem(problem);
  }
}