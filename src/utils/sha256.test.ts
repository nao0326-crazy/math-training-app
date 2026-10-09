/**
 * SHA-256 純実装のテスト
 *
 * 期待値は Node の crypto.createHash('sha256') で求めた実測値。
 * 1文字違えば判定が反転するため境界長 (55/56/63/64/65 バイト) を含める。
 */

import { describe, expect, it } from 'vitest';
import { sha256Hex } from './sha256';

/** [入力, 期待ハッシュ] (node crypto での実測値) */
const VECTORS: [string, string][] = [
  ['abc', 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'],
  ['', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'],
  ['a'.repeat(55), '9f4390f8d30c2dd92ec9f095b65e2b9ae9b0a925a5258e241c9f1e910f734318'],
  ['a'.repeat(56), 'b35439a4ac6f0948b6d6f9e3c6af0f5f590ce20f1bde7090ef7970686ec6738a'],
  ['a'.repeat(63), '7d3e74a05d7db15bce4ad9ec0658ea98e3f06eeecf16b4c6fff2da457ddc2f34'],
  ['a'.repeat(64), 'ffe054fe7ae0cb6dc65c3af9b61d5209f439851db43d0ba5997337df154668eb'],
  ['a'.repeat(65), '635361c48bb9eab14198e76ea8ab7f1a41685d6ad62aa9146d301d4f17eb0ae0'],
  ['日本語テスト', '4b09dffafb42f5b069c66a0283523c0e85c9af2a5530a8fbd541b3e5f9a9c7cd'],
  [':pw', '61fbe1d03488914101f1f1350ab60c16460972964da5ddcfd0a848ed79b6b192'],
  ['hello world 123', 'd4223bf93e202505a6a501421a88d9fa43341f7757e217dd603ccdce157c13bd'],
];

describe('sha256Hex', () => {
  it('既知のハッシュと一致する', () => {
    for (const [input, expected] of VECTORS) {
      expect(sha256Hex(input), `input=${JSON.stringify(input.slice(0, 12))}`).toBe(expected);
    }
  });

  it('小文字 hex の64文字を返す', () => {
    const hex = sha256Hex('abc');
    expect(hex).toMatch(/^[0-9a-f]{64}$/);
  });

  it('1文字違えば別ハッシュになる', () => {
    expect(sha256Hex('abc')).not.toBe(sha256Hex('abd'));
  });
});
