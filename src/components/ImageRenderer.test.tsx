// ImageRenderer.test.tsx — 現実連動教材の写真レンダラ
//
// 目的:
//   - image を持つ問題で写真 (img) が描画されること
//   - 代替テキスト (alt) に必要情報が含まれること
//   - image 未設定・src 空なら何も描かないこと (既存問題の後方互換)
//   - 見出し・出典が表示されること
//
// FigureRenderer (SVG) と同様、renderToStaticMarkup で静的に検証する。

import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import ImageRenderer, { ImageFallback } from './ImageRenderer';
import type { ImageSpec } from '../types/problem';

const SPEC: ImageSpec = {
  src: '/images/supermarket-shelf.svg',
  altText: 'スーパーの棚の写真。値札は、たまご1パック120円、りんご1ふさ260円。',
  caption: 'スーパーの棚 (値札が見えます)',
  credit: '本プロジェクト作成のオリジナル画像 (SVG)',
};

describe('ImageRenderer: 写真を描画する', () => {
  it('img 要素・src・alt が描画される', () => {
    const html = renderToStaticMarkup(<ImageRenderer spec={SPEC} />);
    expect(html).toContain('<img');
    expect(html).toContain('src="/images/supermarket-shelf.svg"');
    expect(html).toContain('120円');
    expect(html).toContain('260円');
  });

  it('見出し・出典が表示される', () => {
    const html = renderToStaticMarkup(<ImageRenderer spec={SPEC} />);
    expect(html).toContain('スーパーの棚 (値札が見えます)');
    expect(html).toContain('本プロジェクト作成のオリジナル画像 (SVG)');
  });

  it('figure 要素で囲まれる (figure/problem-image)', () => {
    const html = renderToStaticMarkup(<ImageRenderer spec={SPEC} />);
    expect(html).toContain('class="problem-image"');
    expect(html).toContain('<figure');
  });
});

describe('ImageRenderer: 画像読み込み失敗時のフォールバック', () => {
  it('フォールバックは価格などの必要情報 (altText) を読める形で表示する', () => {
    const html = renderToStaticMarkup(<ImageFallback altText={SPEC.altText} />);
    expect(html).toContain('problem-image-fallback');
    expect(html).toContain('写真を読み込めませんでした');
    // 解答に必要な価格情報がフォールバック本文に含まれる (破綻防止)
    expect(html).toContain('120円');
    expect(html).toContain('260円');
    expect(html).toContain('たまご');
  });
});

describe('ImageRenderer: 後方互換 (既存問題を変えない)', () => {
  it('image が undefined なら何も描かない', () => {
    expect(renderToStaticMarkup(<ImageRenderer spec={undefined} />)).toBe('');
    expect(renderToStaticMarkup(<ImageRenderer />)).toBe('');
  });

  it('src が空文字なら何も描かない', () => {
    const empty: ImageSpec = { src: '', altText: 'なし' };
    expect(renderToStaticMarkup(<ImageRenderer spec={empty} />)).toBe('');
  });
});
