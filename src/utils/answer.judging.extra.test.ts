/**
 * 回答の正規化・判定処理の追加エッジケーステスト
 *
 * 既存 answer.test.ts がカバーしていない境界・異常系を、
 * 「空欄や不正入力が正解扱いされない」「正しい回答が不正解扱いされない」
 * の2方向で検証する。
 */

import { describe, expect, it } from 'vitest';
import {
  canonicalizeExpressionString,
  checkUserAnswer,
  formatAnswer,
  judgeUserAnswer,
  normalizeAnswerInput,
  parseFractionListInput,
} from './answer';
import type { Answer } from '../types/problem';

const int = (value: number): Answer => ({ kind: 'integer', value });
const dec = (value: number): Answer => ({ kind: 'decimal', value });
const frac = (numerator: number, denominator: number): Answer => ({
  kind: 'fraction',
  numerator,
  denominator,
});
const mixed = (whole: number, numerator: number, denominator: number): Answer => ({
  kind: 'mixed',
  whole,
  numerator,
  denominator,
});
const str = (value: string): Answer => ({ kind: 'string', value });
const fracs = (values: { numerator: number; denominator: number }[]): Answer => ({
  kind: 'fractions',
  values,
});

describe('空欄・不正入力が正解扱いされない', () => {
  const cases: { label: string; input: string; answer: Answer }[] = [
    { label: '空文字 → 整数', input: '', answer: int(5) },
    { label: '空白のみ → 整数', input: '   ', answer: int(5) },
    { label: '空文字 → 小数', input: '', answer: dec(2.5) },
    { label: '空文字 → 分数', input: '', answer: frac(3, 4) },
    { label: '空文字 → 帯分数', input: '', answer: mixed(1, 2, 3) },
    { label: '空文字 → 文字列', input: '', answer: str('A組') },
    { label: '空文字 → 複数分数', input: '', answer: fracs([{ numerator: 15, denominator: 20 }]) },
    { label: 'NaN 文字列 → 整数', input: 'NaN', answer: int(0) },
    { label: 'Infinity 文字列 → 整数', input: 'Infinity', answer: int(5) },
    { label: '分母0 → 分数', input: '3/0', answer: frac(3, 4) },
    { label: '分母0 → 帯分数', input: '1と2/0', answer: mixed(1, 2, 3) },
    { label: '0同士 → 分数 3/4', input: '0/0', answer: frac(3, 4) },
    { label: 'ただのスラッシュ → 分数', input: '/', answer: frac(3, 4) },
    { label: '負の分母表記 → 分数', input: '3/-4', answer: frac(3, 4) },
    { label: 'ゼロ → 分数 1/2', input: '0', answer: frac(1, 2) },
    { label: '1/2 → ゼロ', input: '1/2', answer: int(0) },
    { label: '違 answer → 選択肢', input: 'B組', answer: str('A組') },
    { label: 'はい → いいえ問題', input: 'はい', answer: str('いいえ') },
    { label: 'リスト要素不足', input: '1, 2', answer: str('1, 2, 3') },
    { label: 'リスト順序違い', input: '3, 2, 1', answer: str('1, 2, 3') },
    {
      label: '複数分数 要素数不足',
      input: '15/20',
      answer: fracs([
        { numerator: 15, denominator: 20 },
        { numerator: 8, denominator: 20 },
      ]),
    },
    {
      label: '複数分数 片方だけ不正解',
      input: '15/20 と 7/20',
      answer: fracs([
        { numerator: 15, denominator: 20 },
        { numerator: 8, denominator: 20 },
      ]),
    },
    {
      label: '複数分数 分母がそろっていない (通分できていない)',
      input: '3/4 と 1/2',
      answer: fracs([
        { numerator: 15, denominator: 20 },
        { numerator: 8, denominator: 20 },
      ]),
    },
  ];

  for (const c of cases) {
    it(`${c.label}: "${c.input}" は正解扱いされない`, () => {
      expect(checkUserAnswer(c.input, c.answer)).toBe(false);
      const judged = judgeUserAnswer(c.input, c.answer);
      expect(judged.status).not.toBe('correct');
    });
  }
});

describe('正しい回答が正解扱いされる (表記揺れ含む)', () => {
  it('全角数字・全角小数点', () => {
    expect(checkUserAnswer('４２', int(42))).toBe(true);
    expect(checkUserAnswer('２．５', dec(2.5))).toBe(true);
  });

  it('桁区切りカンマ (3桁単位のみ)', () => {
    expect(checkUserAnswer('1,000', int(1000))).toBe(true);
    expect(checkUserAnswer('1,234,567', int(1234567))).toBe(true);
    // 妥当でないカンマは数値化できず誤答になる
    expect(checkUserAnswer('1,2', int(12))).toBe(false);
  });

  it('マイナス記号の種類 (− ‐ – など) を正しく扱う', () => {
    expect(checkUserAnswer('−5', int(-5))).toBe(true);
    expect(checkUserAnswer('–5', int(-5))).toBe(true);
    expect(checkUserAnswer('-5', int(-5))).toBe(true);
  });

  it('負の数の回答', () => {
    expect(checkUserAnswer('-7', int(-7))).toBe(true);
    expect(checkUserAnswer('-3/4', frac(3, -4))).toBe(true);
    expect(checkUserAnswer('-3/4', frac(-3, 4))).toBe(true);
  });

  it('小数の末尾0・先頭0', () => {
    expect(checkUserAnswer('2.50', dec(2.5))).toBe(true);
    expect(checkUserAnswer('.5', dec(0.5))).toBe(true);
    expect(checkUserAnswer('5.', dec(5))).toBe(true);
  });

  it('分数は約分されていなくても正解 (数学的等価)', () => {
    expect(checkUserAnswer('2/4', frac(1, 2))).toBe(true);
    expect(checkUserAnswer('6/8', frac(3, 4))).toBe(true);
  });

  it('帯分数「1と2/3」と假分数「5/3」の両方', () => {
    expect(checkUserAnswer('1と2/3', mixed(1, 2, 3))).toBe(true);
    expect(checkUserAnswer('5/3', mixed(1, 2, 3))).toBe(true);
    expect(checkUserAnswer('0と2/3', frac(2, 3))).toBe(true);
  });

  it('式・リストの表記揺れ (×・x・全角)', () => {
    expect(checkUserAnswer('5×x', str('5x'))).toBe(true);
    expect(checkUserAnswer('5x', str('5×x'))).toBe(true);
    expect(checkUserAnswer('５ｘ', str('5x'))).toBe(true);
    expect(checkUserAnswer('1,2,3', str('1, 2, 3'))).toBe(true);
    expect(checkUserAnswer('1, 2, 3', str('1,2,3'))).toBe(true);
  });

  it('はい/いいえ判定', () => {
    expect(checkUserAnswer('はい', str('はい'))).toBe(true);
    expect(checkUserAnswer('いいえ', str('いいえ'))).toBe(true);
    expect(checkUserAnswer('はい ', str('はい'))).toBe(true);
  });

  it('formatAnswer の往復は全 Answer 種別で成立する', () => {
    const answers: Answer[] = [
      int(42),
      dec(3.14),
      frac(3, 4),
      mixed(1, 2, 3),
      str('A組'),
      str('1, 2, 3'),
      str('5x'),
      str('たろうさん'),
      fracs([
        { numerator: 15, denominator: 20 },
        { numerator: 8, denominator: 20 },
      ]),
    ];
    for (const a of answers) {
      const shown = formatAnswer(a);
      expect(shown.trim().length, `${a.kind} の表示形式が空`).toBeGreaterThan(0);
      expect(checkUserAnswer(shown, a), `${a.kind}: "${shown}" が自明解として採点不能`).toBe(true);
    }
  });

describe('複数分数 (通分) の判定詳細', () => {
  const canonical = fracs([
    { numerator: 15, denominator: 20 },
    { numerator: 8, denominator: 20 },
  ]);

  it('標準形は correct', () => {
    expect(judgeUserAnswer('15/20 と 8/20', canonical).status).toBe('correct');
  });

  it('数学的等価だが最小公倍数以外の共通分母は equivalent-not-canonical', () => {
    const judged = judgeUserAnswer('30/40 と 16/40', canonical);
    expect(judged.status).toBe('equivalent-not-canonical');
  });

  it('等価でなければ incorrect', () => {
    expect(judgeUserAnswer('15/20 と 9/20', canonical).status).toBe('incorrect');
  });

  it('区切り文字 (読点・カンマ) の揺れを許容', () => {
    expect(judgeUserAnswer('15/20、8/20', canonical).status).toBe('correct');
    expect(judgeUserAnswer('15/20,8/20', canonical).status).toBe('correct');
  });

  it('parseFractionListInput の入力検証', () => {
    expect(parseFractionListInput('1/2 と 3/4')).toEqual([
      { numerator: 1, denominator: 2 },
      { numerator: 3, denominator: 4 },
    ]);
    expect(parseFractionListInput('1/2')).toBeNull();
    expect(parseFractionListInput('1/0 と 2/3')).toBeNull();
    expect(parseFractionListInput('a/2 と 3/4')).toBeNull();
    expect(parseFractionListInput('')).toBeNull();
  });
});

describe('正規化関数の単体境界', () => {
  it('normalizeAnswerInput', () => {
    expect(normalizeAnswerInput('  42  ')).toBe('42');
    expect(normalizeAnswerInput('１２３')).toBe('123');
    expect(normalizeAnswerInput('1234567')).toBe('1234567');
    expect(normalizeAnswerInput('−1000')).toBe('-1000');
    expect(normalizeAnswerInput('÷3')).toBe('/3');
  });

  it('canonicalizeExpressionString', () => {
    expect(canonicalizeExpressionString('3×4')).toBe('3*4');
    expect(canonicalizeExpressionString('3・4')).toBe('3*4');
    expect(canonicalizeExpressionString('12x')).toBe('12*x');
    expect(canonicalizeExpressionString('x×3')).toBe('x*3');
  });
});

});
