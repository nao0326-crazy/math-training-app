/**
 * 解答ユーティリティのテスト
 */

import { describe, expect, it } from 'vitest';
import {
  formatAnswer,
  toAnswerKey,
  answersEqual,
  answerToNumber,
  checkUserAnswer,
  isReasonableAnswer,
  normalizeAnswerInput,
  judgeUserAnswer,
  canonicalizeExpressionString,
} from './answer';
import type { Answer } from '../types/problem';

describe('formatAnswer', () => {
  it('整数をフォーマットする', () => {
    const answer: Answer = { kind: 'integer', value: 42 };
    expect(formatAnswer(answer)).toBe('42');
  });

  it('小数をフォーマットする', () => {
    const answer: Answer = { kind: 'decimal', value: 3.14 };
    expect(formatAnswer(answer)).toBe('3.14');
  });

  it('分数をフォーマットする', () => {
    const answer: Answer = { kind: 'fraction', numerator: 3, denominator: 4 };
    expect(formatAnswer(answer)).toBe('3/4');
  });

  it('帯分数をフォーマットする', () => {
    const answer: Answer = { kind: 'mixed', whole: 1, numerator: 1, denominator: 2 };
    expect(formatAnswer(answer)).toBe('1と1/2');
  });

  it('文字列をフォーマットする', () => {
    const answer: Answer = { kind: 'string', value: 'はい' };
    expect(formatAnswer(answer)).toBe('はい');
  });
});

describe('toAnswerKey', () => {
  it('分数を約分してキーに変換する', () => {
    const answer: Answer = { kind: 'fraction', numerator: 2, denominator: 4 };
    expect(toAnswerKey(answer)).toBe('1/2');
  });

  it('帯分数を仮分数に変換してキーにする', () => {
    const answer: Answer = { kind: 'mixed', whole: 1, numerator: 1, denominator: 2 };
    expect(toAnswerKey(answer)).toBe('3/2');
  });
});

describe('answersEqual', () => {
  it('同じ値の分数は等しい', () => {
    const a: Answer = { kind: 'fraction', numerator: 1, denominator: 2 };
    const b: Answer = { kind: 'fraction', numerator: 2, denominator: 4 };
    expect(answersEqual(a, b)).toBe(true);
  });

  it('整数と小数は数値的に比較できる', () => {
    const a: Answer = { kind: 'integer', value: 5 };
    const b: Answer = { kind: 'decimal', value: 5.0 };
    expect(answersEqual(a, b)).toBe(true);
  });

  it('異なる値は等しくない', () => {
    const a: Answer = { kind: 'integer', value: 5 };
    const b: Answer = { kind: 'integer', value: 6 };
    expect(answersEqual(a, b)).toBe(false);
  });

  it('帯分数と仮分数は等しい', () => {
    const a: Answer = { kind: 'mixed', whole: 1, numerator: 1, denominator: 2 };
    const b: Answer = { kind: 'fraction', numerator: 3, denominator: 2 };
    expect(answersEqual(a, b)).toBe(true);
  });
});

describe('answerToNumber', () => {
  it('数値に変換する', () => {
    expect(answerToNumber({ kind: 'integer', value: 5 })).toBe(5);
    expect(answerToNumber({ kind: 'decimal', value: 2.5 })).toBe(2.5);
    expect(answerToNumber({ kind: 'fraction', numerator: 1, denominator: 2 })).toBe(0.5);
    expect(answerToNumber({ kind: 'mixed', whole: 1, numerator: 1, denominator: 2 })).toBe(1.5);
  });

  it('文字列は数値に変換できる場合のみ変換する', () => {
    expect(answerToNumber({ kind: 'string', value: '42' })).toBe(42);
    expect(answerToNumber({ kind: 'string', value: 'abc' })).toBeNull();
  });
});

describe('normalizeAnswerInput', () => {
  it('全角数字を半角に変換する', () => {
    expect(normalizeAnswerInput('３１')).toBe('31');
    expect(normalizeAnswerInput('１２３４５')).toBe('12345');
  });

  it('全角小数点を半角に変換する', () => {
    expect(normalizeAnswerInput('１．５')).toBe('1.5');
  });

  it('全角カンマを半角に変換してから桁区切りを処理する', () => {
    expect(normalizeAnswerInput('１，０００')).toBe('1000');
  });

  it('桁区切りとして妥当なカンマを削除する', () => {
    expect(normalizeAnswerInput('1,000')).toBe('1000');
    expect(normalizeAnswerInput('12,000')).toBe('12000');
    expect(normalizeAnswerInput('1,234,567')).toBe('1234567');
    expect(normalizeAnswerInput('1000')).toBe('1000');
  });

  it('桁区切りとして妥当でないカンマは削除しない', () => {
    // 1,2 は123としては扱わない (削除されない)
    expect(normalizeAnswerInput('1,2')).toBe('1,2');
    // リスト「1, 2, 3」も削除されない
    expect(normalizeAnswerInput('1, 2, 3')).toBe('1, 2, 3');
  });

  it('全角マイナスを半角に変換する', () => {
    expect(normalizeAnswerInput('－３')).toBe('-3');
  });

  it('Unicode上の類似したマイナス記号を半角に変換する', () => {
    // U+2212 MINUS SIGN
    expect(normalizeAnswerInput('\u22123')).toBe('-3');
    // U+2010 HYPHEN
    expect(normalizeAnswerInput('\u20103')).toBe('-3');
    // U+2013 EN DASH
    expect(normalizeAnswerInput('\u20133')).toBe('-3');
    // U+2014 EM DASH
    expect(normalizeAnswerInput('\u20143')).toBe('-3');
  });

  it('前後の空白を除去する', () => {
    expect(normalizeAnswerInput('31')).toBe('31');
    expect(normalizeAnswerInput(' 31')).toBe('31');
    expect(normalizeAnswerInput('31 ')).toBe('31');
    expect(normalizeAnswerInput(' 31 ')).toBe('31');
  });

  it('全角スラッシュを半角に変換する', () => {
    expect(normalizeAnswerInput('３／４')).toBe('3/4');
  });

  it('不正な入力をそのまま返す', () => {
    expect(normalizeAnswerInput('31abc')).toBe('31abc');
    expect(normalizeAnswerInput('abc')).toBe('abc');
  });
});

describe('checkUserAnswer', () => {
  it('整数の入力', () => {
    const answer: Answer = { kind: 'integer', value: 42 };
    expect(checkUserAnswer('42', answer)).toBe(true);
    expect(checkUserAnswer('43', answer)).toBe(false);
  });

  it('全角数字の入力は正解として判定される', () => {
    const answer: Answer = { kind: 'integer', value: 31 };
    expect(checkUserAnswer('３１', answer)).toBe(true);
  });

  it('桁区切りカンマ付きの入力は正解として判定される', () => {
    const answer: Answer = { kind: 'integer', value: 1000 };
    expect(checkUserAnswer('1,000', answer)).toBe(true);
    expect(checkUserAnswer('１,０００', answer)).toBe(true);
  });

  it('全角小数の入力は正解として判定される', () => {
    const answer: Answer = { kind: 'decimal', value: 1.5 };
    expect(checkUserAnswer('１.５', answer)).toBe(true);
  });

  it('マイナス記号の表記揺れは正解として判定される', () => {
    const answer: Answer = { kind: 'integer', value: -3 };
    expect(checkUserAnswer('−３', answer)).toBe(true);
    expect(checkUserAnswer('－３', answer)).toBe(true);
    expect(checkUserAnswer('\u22123', answer)).toBe(true);
  });

  it('前後の空白は無視される', () => {
    const answer: Answer = { kind: 'integer', value: 31 };
    expect(checkUserAnswer(' 31 ', answer)).toBe(true);
    expect(checkUserAnswer('  31', answer)).toBe(true);
    expect(checkUserAnswer('31  ', answer)).toBe(true);
  });

  it('明確な誤答は不正解のまま', () => {
    const answer: Answer = { kind: 'integer', value: 31 };
    expect(checkUserAnswer('32', answer)).toBe(false);
  });

  it('正規化で誤答を正答にしない', () => {
    const answer: Answer = { kind: 'integer', value: 1000 };
    expect(checkUserAnswer('100', answer)).toBe(false);
  });

  it('31abc のような入力は不正解のまま', () => {
    const answer: Answer = { kind: 'integer', value: 31 };
    expect(checkUserAnswer('31abc', answer)).toBe(false);
  });

  it('1,2 のような入力は123として扱わない', () => {
    const answer: Answer = { kind: 'integer', value: 123 };
    expect(checkUserAnswer('1,2', answer)).toBe(false);
  });

  it('分数の全角入力も正解として判定される', () => {
    const answer: Answer = { kind: 'fraction', numerator: 3, denominator: 4 };
    expect(checkUserAnswer('３／４', answer)).toBe(true);
  });

  it('小数の入力', () => {
    const answer: Answer = { kind: 'decimal', value: 3.5 };
    expect(checkUserAnswer('3.5', answer)).toBe(true);
    expect(checkUserAnswer('3.50', answer)).toBe(true);
  });

  it('分数の入力', () => {
    const answer: Answer = { kind: 'fraction', numerator: 3, denominator: 4 };
    expect(checkUserAnswer('3/4', answer)).toBe(true);
    expect(checkUserAnswer('6/8', answer)).toBe(true); // 約分して一致
    expect(checkUserAnswer('0.75', answer)).toBe(true); // 小数でも一致
    expect(checkUserAnswer('1/2', answer)).toBe(false);
  });

  it('同値な分数 (1/2・2/4・3/6) はすべて正解として判定される', () => {
    const answer: Answer = { kind: 'fraction', numerator: 1, denominator: 2 };
    expect(checkUserAnswer('1/2', answer)).toBe(true);
    expect(checkUserAnswer('2/4', answer)).toBe(true);
    expect(checkUserAnswer('3/6', answer)).toBe(true);
    expect(checkUserAnswer('2/3', answer)).toBe(false); // 同値でないものは不正解
  });

  it('帯分数の入力', () => {
    const answer: Answer = { kind: 'mixed', whole: 1, numerator: 1, denominator: 2 };
    expect(checkUserAnswer('1と1/2', answer)).toBe(true);
    expect(checkUserAnswer('3/2', answer)).toBe(true);
    expect(checkUserAnswer('1.5', answer)).toBe(true);
  });

  it('空文字は不正解', () => {
    const answer: Answer = { kind: 'integer', value: 42 };
    expect(checkUserAnswer('', answer)).toBe(false);
    expect(checkUserAnswer('   ', answer)).toBe(false);
  });

  it('不正な入力は不正解', () => {
    const answer: Answer = { kind: 'integer', value: 42 };
    expect(checkUserAnswer('abc', answer)).toBe(false);
    expect(checkUserAnswer('1/0', answer)).toBe(false);
  });
});

describe('canonicalizeExpressionString (式の乗算記号・変数xの正規化)', () => {
  it('×・＊・**・全角＊はすべて同じ "*" に正規化する', () => {
    expect(canonicalizeExpressionString('3×4')).toBe('3*4');
    expect(canonicalizeExpressionString('3＊4')).toBe('3*4');
    expect(canonicalizeExpressionString('3*4')).toBe('3*4');
    expect(canonicalizeExpressionString('3・4')).toBe('3*4');
  });

  it('変数 x の表記揺れ (全角・大文字) を小文字 x に統一する', () => {
    expect(canonicalizeExpressionString('5x')).toBe('5*x');
    expect(canonicalizeExpressionString('5ｘ')).toBe('5*x');
    expect(canonicalizeExpressionString('5X')).toBe('5*x');
    expect(canonicalizeExpressionString('5Ｘ')).toBe('5*x');
  });

  it('数字と x の間の乗算省略を補完する', () => {
    expect(canonicalizeExpressionString('12x')).toBe('12*x');
    expect(canonicalizeExpressionString('20x+5')).toBe('20*x+5');
  });

  it('×を使った式と x を使った式が等価になる', () => {
    expect(canonicalizeExpressionString('5×x')).toBe(canonicalizeExpressionString('5x'));
    expect(canonicalizeExpressionString('5×x')).toBe(canonicalizeExpressionString('5*x'));
    expect(canonicalizeExpressionString('１２×Ｘ')).toBe(canonicalizeExpressionString('12x'));
  });
});

describe('checkUserAnswer (文字と式・式文字列の正誤判定)', () => {
  it('正解 "5x" に対し、5x・5×x・5*x・全角 ５ｘ を正解として扱う', () => {
    const answer: Answer = { kind: 'string', value: '5x' };
    expect(checkUserAnswer('5x', answer)).toBe(true);
    expect(checkUserAnswer('5×x', answer)).toBe(true);
    expect(checkUserAnswer('5＊x', answer)).toBe(true);
    expect(checkUserAnswer('5*x', answer)).toBe(true);
    expect(checkUserAnswer('５ｘ', answer)).toBe(true);
  });

  it('正解 "5×x" に対し、5x や 5×x を正解として扱う', () => {
    const answer: Answer = { kind: 'string', value: '5×x' };
    expect(checkUserAnswer('5×x', answer)).toBe(true);
    expect(checkUserAnswer('5x', answer)).toBe(true);
    expect(checkUserAnswer('5*x', answer)).toBe(true);
    expect(checkUserAnswer('6x', answer)).toBe(false); // 係数が違うのは不正解
  });

  it('係数が異なる式は不正解', () => {
    const answer: Answer = { kind: 'string', value: '5x' };
    expect(checkUserAnswer('4x', answer)).toBe(false);
    expect(checkUserAnswer('x5', answer)).toBe(false);
  });

  it('誤答 (式が違う) は正解として扱わない', () => {
    const answer: Answer = { kind: 'string', value: '3×4' };
    expect(checkUserAnswer('3×5', answer)).toBe(false);
    expect(checkUserAnswer('4×3', answer)).toBe(false);
  });
});


describe('isReasonableAnswer', () => {
  it('正常な解答はtrue', () => {
    expect(isReasonableAnswer({ kind: 'integer', value: 42 })).toBe(true);
    expect(isReasonableAnswer({ kind: 'decimal', value: 3.14 })).toBe(true);
    expect(isReasonableAnswer({ kind: 'fraction', numerator: 1, denominator: 2 })).toBe(true);
    expect(isReasonableAnswer({ kind: 'string', value: 'はい' })).toBe(true);
  });

  it('異常な解答はfalse', () => {
    expect(isReasonableAnswer({ kind: 'fraction', numerator: 1, denominator: 0 })).toBe(false);
    expect(isReasonableAnswer({ kind: 'integer', value: Infinity })).toBe(false);
    expect(isReasonableAnswer({ kind: 'integer', value: NaN })).toBe(false);
    expect(isReasonableAnswer({ kind: 'integer', value: 1_000_001 })).toBe(false);
  });
});

// ===== 複数分数 (通分) の構造化解答と判定 =====

// ユーザー報告ケース「3/4 と 2/5」の正解 (15/20 と 8/20)
const tsuuhenAnswer: Answer = {
  kind: 'fractions',
  values: [
    { numerator: 15, denominator: 20 },
    { numerator: 8, denominator: 20 },
  ],
};

describe('formatAnswer / toAnswerKey (複数分数)', () => {
  it('複数分数を「15/20 と 8/20」形式でフォーマットする (約分しない)', () => {
    expect(formatAnswer(tsuuhenAnswer)).toBe('15/20 と 8/20');
  });

  it('4/8 のような通分後の値は約分せず表示する', () => {
    const answer = {
      kind: 'fractions' as const,
      values: [
        { numerator: 4, denominator: 8 },
        { numerator: 3, denominator: 8 },
      ],
    };
    expect(formatAnswer(answer)).toBe('4/8 と 3/8');
  });

  it('toAnswerKey は約分したキーを返す', () => {
    expect(toAnswerKey(tsuuhenAnswer)).toBe('3/4|2/5');
  });
});

describe('answersEqual / answerToNumber (複数分数)', () => {
  it('位置ごとに数学的等価性で比較する', () => {
    const equivalent = {
      kind: 'fractions' as const,
      values: [
        { numerator: 30, denominator: 40 },
        { numerator: 16, denominator: 40 },
      ],
    };
    expect(answersEqual(tsuuhenAnswer, equivalent)).toBe(true);
    const different = {
      kind: 'fractions' as const,
      values: [
        { numerator: 1, denominator: 2 },
        { numerator: 2, denominator: 5 },
      ],
    };
    expect(answersEqual(tsuuhenAnswer, different)).toBe(false);
  });

  it('単一の数値には変換できない (null)', () => {
    expect(answerToNumber(tsuuhenAnswer)).toBeNull();
  });
});

describe('isReasonableAnswer (複数分数)', () => {
  it('正しい複数分数はtrue', () => {
    expect(isReasonableAnswer(tsuuhenAnswer)).toBe(true);
  });

  it('空リスト・分母0はfalse', () => {
    expect(isReasonableAnswer({ kind: 'fractions', values: [] })).toBe(false);
    expect(
      isReasonableAnswer({
        kind: 'fractions',
        values: [{ numerator: 1, denominator: 0 }],
      }),
    ).toBe(false);
  });
});

describe('checkUserAnswer (複数分数・通分)', () => {
  it('標準形の入力は正解', () => {
    expect(checkUserAnswer('15/20 と 8/20', tsuuhenAnswer)).toBe(true);
    // 区切り文字の揺れ (読点・カンマ) も許容する
    expect(checkUserAnswer('15/20、8/20', tsuuhenAnswer)).toBe(true);
    expect(checkUserAnswer('15/20, 8/20', tsuuhenAnswer)).toBe(true);
    // 全角数字・全角スラッシュ
    expect(checkUserAnswer('１５／２０ と ８／２０', tsuuhenAnswer)).toBe(true);
  });

  it('最小公倍数以外の共通分母による通分は正解扱いにしないが、数学的には区別する', () => {
    // ユーザー報告ケース: 30/40 と 16/40 は数学的には等価だが標準形ではない
    expect(checkUserAnswer('30/40 と 16/40', tsuuhenAnswer)).toBe(false);
    const judgement = judgeUserAnswer('30/40 と 16/40', tsuuhenAnswer);
    expect(judgement.status).toBe('equivalent-not-canonical');
    if (judgement.status === 'equivalent-not-canonical') {
      expect(judgement.message).toContain('最小公倍数');
      expect(judgement.message).toContain('15/20 と 8/20');
    }
  });

  it('未通分の入力や誤りは不正解 (equivalent-not-canonical にならない)', () => {
    // 通分していない
    expect(checkUserAnswer('3/4 と 2/5', tsuuhenAnswer)).toBe(false);
    expect(judgeUserAnswer('3/4 と 2/5', tsuuhenAnswer).status).toBe('incorrect');
    // 値そのものが誤り (分母はそろっているが計算ミス)
    expect(checkUserAnswer('14/20 と 8/20', tsuuhenAnswer)).toBe(false);
    expect(judgeUserAnswer('14/20 と 8/20', tsuuhenAnswer).status).toBe('incorrect');
    // 分数の個数が合わない
    expect(checkUserAnswer('15/20', tsuuhenAnswer)).toBe(false);
    expect(checkUserAnswer('15/20 と 8/20 と 7/20', tsuuhenAnswer)).toBe(false);
  });

  it('他の問題タイプの判定は従来どおり (帯分数など影響なし)', () => {
    const mixed: Answer = { kind: 'mixed', whole: 1, numerator: 2, denominator: 3 };
    expect(checkUserAnswer('1と2/3', mixed)).toBe(true);
    expect(checkUserAnswer('5/3', mixed)).toBe(true);
  });
});