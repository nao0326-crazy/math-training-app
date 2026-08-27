/**
 * 入力タイプユーティリティのテスト
 */

import { describe, expect, it } from 'vitest';
import {
  getAnswerInputType,
  fractionInputToString,
  fractionListToString,
  mixedInputToString,
  validateAnswerInput,
  isAnswerInputValid,
  getNormalizedAnswer,
} from './inputType';
import type { Answer } from '../types/problem';

describe('getAnswerInputType', () => {
  it('整数の解答から integer 入力タイプを判定する', () => {
    const answer: Answer = { kind: 'integer', value: 24 };
    expect(getAnswerInputType(answer, '24に5をたすといくつになりますか')).toBe('integer');
  });

  it('小数の解答から decimal 入力タイプを判定する', () => {
    const answer: Answer = { kind: 'decimal', value: 3.14 };
    expect(getAnswerInputType(answer, '3.14はいくつですか')).toBe('decimal');
  });

  it('分数の解答から fraction 入力タイプを判定する', () => {
    const answer: Answer = { kind: 'fraction', numerator: 1, denominator: 2 };
    expect(getAnswerInputType(answer, '1/2はいくつですか')).toBe('fraction');
  });

  it('帯分数の解答から mixed 入力タイプを判定する', () => {
    const answer: Answer = { kind: 'mixed', whole: 1, numerator: 1, denominator: 2 };
    expect(getAnswerInputType(answer, '1と1/2はいくつですか')).toBe('mixed');
  });

  it('はい/いいえを含む文字列問題から yesno 入力タイプを判定する', () => {
    const answer: Answer = { kind: 'string', value: 'はい' };
    expect(getAnswerInputType(answer, 'これは点対称ですか？（はい/いいえ）')).toBe('yesno');
    expect(getAnswerInputType(answer, 'これは点対象ですか。はいかいいえで答えなさい')).toBe('yesno');
  });

  it('はい/いいえを含まない文字列問題から string 入力タイプを判定する', () => {
    const answer: Answer = { kind: 'string', value: 'y=3x' };
    expect(getAnswerInputType(answer, 'yをxの式で表しなさい')).toBe('string');
  });
});

describe('fractionInputToString', () => {
  it('分子と分母を "n/d" 形式に変換する', () => {
    expect(fractionInputToString('1', '2')).toBe('1/2');
    expect(fractionInputToString('3', '4')).toBe('3/4');
  });

  it('前後の空白をトリムする', () => {
    expect(fractionInputToString(' 1 ', ' 2 ')).toBe('1/2');
  });

  it('分子または分母が空の場合は空文字を返す', () => {
    expect(fractionInputToString('', '2')).toBe('');
    expect(fractionInputToString('1', '')).toBe('');
    expect(fractionInputToString('', '')).toBe('');
  });
});

describe('mixedInputToString', () => {
  it('整数部・分子・分母を "wとn/d" 形式に変換する', () => {
    expect(mixedInputToString('1', '1', '2')).toBe('1と1/2');
    expect(mixedInputToString('2', '3', '4')).toBe('2と3/4');
  });

  it('整数部が空の場合は0として扱う', () => {
    expect(mixedInputToString('', '1', '2')).toBe('0と1/2');
  });

  it('前後の空白をトリムする', () => {
    expect(mixedInputToString(' 1 ', ' 1 ', ' 2 ')).toBe('1と1/2');
  });

    it('分子または分母が空の場合は空文字を返す', () => {
    expect(mixedInputToString('1', '', '2')).toBe('');
    expect(mixedInputToString('1', '1', '')).toBe('');
  });
});

describe('validateAnswerInput', () => {
  it('整数入力: 空の場合はエラー', () => {
    expect(validateAnswerInput('integer', { text: '' })).toBe('答えを入力してください。');
    expect(validateAnswerInput('integer', { text: '  ' })).toBe('答えを入力してください。');
  });

  it('整数入力: 値がある場合は null', () => {
    expect(validateAnswerInput('integer', { text: '24' })).toBeNull();
    expect(validateAnswerInput('integer', { text: '1000' })).toBeNull();
  });

  it('小数入力: 小数点を含む値も有効', () => {
    expect(validateAnswerInput('decimal', { text: '3.14' })).toBeNull();
  });

  it('分数入力: 分子・分母とも空の場合はエラー', () => {
    expect(validateAnswerInput('fraction', { fraction: { numerator: '', denominator: '' } })).toBe(
      '分子と分母を入力してください。',
    );
    expect(validateAnswerInput('fraction', {})).toBe('答えを入力してください。');
  });

  it('分数入力: 分子だけ未入力の場合は分子を案内する', () => {
    expect(validateAnswerInput('fraction', { fraction: { numerator: '', denominator: '4' } })).toBe(
      '分子を入力してください。',
    );
  });

  it('分数入力: 分母だけ未入力の場合は分母を案内する', () => {
    expect(validateAnswerInput('fraction', { fraction: { numerator: '1', denominator: '' } })).toBe(
      '分母を入力してください。',
    );
  });

  it('分数入力: 分母が0の場合はエラー', () => {
    expect(
      validateAnswerInput('fraction', { fraction: { numerator: '1', denominator: '0' } }),
    ).toBe('分母に0を入力できません。');
  });

  it('分数入力: 有効な入力の場合は null', () => {
    expect(
      validateAnswerInput('fraction', { fraction: { numerator: '1', denominator: '2' } }),
    ).toBeNull();
  });

  it('帯分数入力: 分母が0の場合はエラー', () => {
    expect(
      validateAnswerInput('mixed', {
        mixed: { whole: '1', numerator: '2', denominator: '0' },
      }),
    ).toBe('分母に0を入力できません。');
  });

  it('帯分数入力: 有効な入力の場合は null', () => {
    expect(
      validateAnswerInput('mixed', {
        mixed: { whole: '1', numerator: '1', denominator: '2' },
      }),
    ).toBeNull();
  });

  it('帯分数入力: 整数部だけ入力した場合は分子と分母を案内する', () => {
    expect(
      validateAnswerInput('mixed', {
        mixed: { whole: '2', numerator: '', denominator: '' },
      }),
    ).toBe('分子と分母を入力してください。');
  });

  it('帯分数入力: 分子だけ未入力の場合は分子を案内する', () => {
    expect(
      validateAnswerInput('mixed', {
        mixed: { whole: '2', numerator: '', denominator: '4' },
      }),
    ).toBe('分子を入力してください。');
  });

  it('帯分数入力: 分母だけ未入力の場合は分母を案内する', () => {
    expect(
      validateAnswerInput('mixed', {
        mixed: { whole: '2', numerator: '1', denominator: '' },
      }),
    ).toBe('分母を入力してください。');
  });

  it('yesno: 未選択の場合はエラー', () => {
    expect(validateAnswerInput('yesno', { text: '' })).toBe(
      'はいまたはいいえを選んでください。',
    );
  });

  it('yesno: 選択済みの場合は null', () => {
    expect(validateAnswerInput('yesno', { text: 'はい' })).toBeNull();
    expect(validateAnswerInput('yesno', { text: 'いいえ' })).toBeNull();
  });

  it('string: 空の場合はエラー', () => {
    expect(validateAnswerInput('string', { text: '' })).toBe('答えを入力してください。');
  });

  it('string: 値がある場合は null', () => {
    expect(validateAnswerInput('string', { text: 'y=3x' })).toBeNull();
  });

  it('整数入力: 数字以外が含まれる場合はエラー', () => {
    expect(validateAnswerInput('integer', { text: 'abc' })).toBe('半角の整数を入力してください。');
    expect(validateAnswerInput('integer', { text: '3.14' })).toBe('半角の整数を入力してください。');
    expect(validateAnswerInput('integer', { text: '2 4' })).toBe('半角の整数を入力してください。');
  });

  it('小数入力: 不正な形式の場合はエラー', () => {
    expect(validateAnswerInput('decimal', { text: 'abc' })).toBe('正しい小数を入力してください。');
    expect(validateAnswerInput('decimal', { text: '.' })).toBe('正しい小数を入力してください。');
    expect(validateAnswerInput('decimal', { text: '1.2.3' })).toBe(
      '正しい小数を入力してください。',
    );
  });

  it('小数入力: 様々な有効な形式は null', () => {
    expect(validateAnswerInput('decimal', { text: '3.14' })).toBeNull();
    expect(validateAnswerInput('decimal', { text: '0.5' })).toBeNull();
    expect(validateAnswerInput('decimal', { text: '.5' })).toBeNull();
    expect(validateAnswerInput('decimal', { text: '42' })).toBeNull();
  });
});

describe('isAnswerInputValid', () => {
  it('整数入力: 空は無効', () => {
    expect(isAnswerInputValid('integer', { text: '' })).toBe(false);
  });

  it('整数入力: 値ありは有効', () => {
    expect(isAnswerInputValid('integer', { text: '24' })).toBe(true);
  });

  it('分数入力: 分母0は無効', () => {
    expect(
      isAnswerInputValid('fraction', { fraction: { numerator: '1', denominator: '0' } }),
    ).toBe(false);
  });

  it('分数入力: 分子・分母ありは有効', () => {
    expect(
      isAnswerInputValid('fraction', { fraction: { numerator: '1', denominator: '2' } }),
    ).toBe(true);
  });
});

describe('getNormalizedAnswer', () => {
  it('整数入力: テキストをそのまま返す', () => {
    expect(getNormalizedAnswer('integer', { text: '24' })).toBe('24');
    expect(getNormalizedAnswer('integer', { text: '1000' })).toBe('1000');
  });

  it('小数入力: テキストをそのまま返す', () => {
    expect(getNormalizedAnswer('decimal', { text: '3.14' })).toBe('3.14');
  });

  it('分数入力: "n/d" 形式に変換', () => {
    expect(
      getNormalizedAnswer('fraction', {
        fraction: { numerator: '1', denominator: '2' },
      }),
    ).toBe('1/2');
  });

  it('分数入力: 空の場合は空文字', () => {
    expect(
      getNormalizedAnswer('fraction', {
        fraction: { numerator: '', denominator: '2' },
      }),
    ).toBe('');
  });

  it('帯分数入力: "wとn/d" 形式に変換', () => {
    expect(
      getNormalizedAnswer('mixed', {
        mixed: { whole: '1', numerator: '1', denominator: '2' },
      }),
    ).toBe('1と1/2');
  });

  it('帯分数入力: 整数部空の場合は0として変換', () => {
    expect(
      getNormalizedAnswer('mixed', {
        mixed: { whole: '', numerator: '1', denominator: '2' },
      }),
    ).toBe('0と1/2');
  });

  it('yesno: テキストをそのまま返す', () => {
    expect(getNormalizedAnswer('yesno', { text: 'はい' })).toBe('はい');
    expect(getNormalizedAnswer('yesno', { text: 'いいえ' })).toBe('いいえ');
  });

  it('string: テキストをそのまま返す', () => {
    expect(getNormalizedAnswer('string', { text: 'y=3x' })).toBe('y=3x');
  });
});

describe('getAnswerInputType (複数分数 / 通分)', () => {
  it('kind: fractions は fraction-list 入力タイプになる', () => {
    const answer: Answer = {
      kind: 'fractions',
      values: [
        { numerator: 15, denominator: 20 },
        { numerator: 8, denominator: 20 },
      ],
    };
    expect(getAnswerInputType(answer, '分母をそろえて表しなさい')).toBe('fraction-list');
  });
});

describe('fractionListToString', () => {
  it('複数分数を "n/d と n/d" 形式に変換する', () => {
    expect(
      fractionListToString([
        { numerator: '15', denominator: '20' },
        { numerator: '8', denominator: '20' },
      ]),
    ).toBe('15/20 と 8/20');
  });

  it('空の分数があれば空文字を返す', () => {
    expect(
      fractionListToString([
        { numerator: '15', denominator: '20' },
        { numerator: '', denominator: '20' },
      ]),
    ).toBe('');
  });
});

describe('validateAnswerInput (fraction-list)', () => {
  it('全部入力済みで分母0がなければ null', () => {
    expect(
      validateAnswerInput('fraction-list', {
        fractionList: [
          { numerator: '15', denominator: '20' },
          { numerator: '8', denominator: '20' },
        ],
      }),
    ).toBeNull();
  });

  it('1つ目の分数の分子・分母が空なら案内する', () => {
    expect(
      validateAnswerInput('fraction-list', {
        fractionList: [
          { numerator: '', denominator: '' },
          { numerator: '8', denominator: '20' },
        ],
      }),
    ).toBe('1つ目の分数の分子と分母を入力してください。');
  });

  it('2つ目の分母が0ならエラー', () => {
    expect(
      validateAnswerInput('fraction-list', {
        fractionList: [
          { numerator: '15', denominator: '20' },
          { numerator: '8', denominator: '0' },
        ],
      }),
    ).toBe('2つ目の分数の分母に0を入力できません。');
  });

  it('数字以外の文字はエラー', () => {
    expect(
      validateAnswerInput('fraction-list', {
        fractionList: [
          { numerator: 'a', denominator: '20' },
          { numerator: '8', denominator: '20' },
        ],
      }),
    ).toBe('1つ目の分数は半角の整数で入力してください。');
  });
});

describe('getNormalizedAnswer (fraction-list)', () => {
  it('複数分数を "n/d と n/d" 形式に変換する', () => {
    expect(
      getNormalizedAnswer('fraction-list', {
        fractionList: [
          { numerator: '15', denominator: '20' },
          { numerator: '8', denominator: '20' },
        ],
      }),
    ).toBe('15/20 と 8/20');
  });
});
