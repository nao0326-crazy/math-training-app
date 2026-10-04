// figure.test.ts — 図形描画基盤 (FigureSpec / FigureRenderer / Problem 接続)
//
// 目的:
//   - FigureSpec が頂点・ラベル・寸法を保持できること
//   - FigureRenderer が三角形/四角形/平行四辺形を描画できること
//   - figure を持たない既存問題が変わらないこと (後方互換性)
//   - 複数図 (図Aと図B) を扱えること
//
// 座標は数学座標系 (上が +y) で与える前提のテスト。

import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import FigureRenderer from './FigureRenderer';
import type { Figure, FigureSpec, Problem } from '../types/problem';

/** テスト用の三角形 (底辺6、高さ4) */
const TRIANGLE: Figure = {
  kind: 'triangle',
  vertices: [
    { x: 0, y: 0 },
    { x: 6, y: 0 },
    { x: 0, y: 4 },
  ],
  caption: '図A',
  points: [
    { at: { x: 0, y: 0 }, label: 'A' },
    { at: { x: 6, y: 0 }, label: 'B' },
    { at: { x: 0, y: 4 }, label: 'C' },
  ],
  segments: [{ from: { x: 0, y: 0 }, to: { x: 6, y: 0 }, label: '6cm' }],
};

/** テスト用の長方形 */
const RECTANGLE: Figure = {
  kind: 'rectangle',
  vertices: [
    { x: 0, y: 0 },
    { x: 5, y: 0 },
    { x: 5, y: 3 },
    { x: 0, y: 3 },
  ],
  fill: '#eef',
};

/** テスト用の平行四辺形 */
const PARALLELOGRAM: Figure = {
  kind: 'parallelogram',
  vertices: [
    { x: 1, y: 0 },
    { x: 5, y: 0 },
    { x: 6, y: 3 },
    { x: 2, y: 3 },
  ],
};

/** 独立に頂点間距離を求める (描画の検証に使う) */
function dist(
  a: { x: number; y: number },
  b: { x: number; y: number },
): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

describe('FigureSpec: 図形データを保持できる', () => {
  it('三角形の頂点・ラベル・寸法を保持する', () => {
    expect(TRIANGLE.vertices).toHaveLength(3);
    expect(TRIANGLE.points).toHaveLength(3);
    expect(TRIANGLE.points?.map((p) => p.label)).toEqual(['A', 'B', 'C']);
    expect(TRIANGLE.segments?.[0].label).toBe('6cm');
    expect(TRIANGLE.caption).toBe('図A');
  });

  it('四角形・平行四辺形の頂点を保持する', () => {
    expect(RECTANGLE.vertices).toHaveLength(4);
    expect(PARALLELOGRAM.vertices).toHaveLength(4);
  });

  it('頂点座標から辺長が数学的に正しい (描画の前提)', () => {
    // 三角形の底辺は 6、斜辺は sqrt(36+16)、縦辺は 4
    expect(dist(TRIANGLE.vertices[0], TRIANGLE.vertices[1])).toBeCloseTo(6, 10);
    expect(dist(TRIANGLE.vertices[1], TRIANGLE.vertices[2])).toBeCloseTo(Math.sqrt(52), 10);
    expect(dist(TRIANGLE.vertices[0], TRIANGLE.vertices[2])).toBeCloseTo(4, 10);
  });

  it('平行四辺形は向かい合う辺が平行かつ等しい', () => {
    const [a, b, c, d] = PARALLELOGRAM.vertices;
    const ab = { x: b.x - a.x, y: b.y - a.y };
    const dc = { x: c.x - d.x, y: c.y - d.y };
    expect(ab.x).toBeCloseTo(dc.x, 10);
    expect(ab.y).toBeCloseTo(dc.y, 10);
    expect(dist(a, b)).toBeCloseTo(dist(d, c), 10);
  });
});

describe('FigureRenderer: SVG を生成する', () => {
  it('三角形が描画される (頂点・ラベル・寸法)', () => {
    const html = renderToStaticMarkup(<FigureRenderer spec={{ figures: [TRIANGLE] }} />);
    expect(html).toContain('<polygon');
    expect(html).toContain('<circle'); // 頂点の点
    expect(html).toContain('>A<'); // 頂点名
    expect(html).toContain('6cm'); // 寸法
    expect(html).toContain('図A'); // 見出し
    expect(html).toContain('<svg');
  });

  it('四角形・平行四辺形が描画される', () => {
    expect(renderToStaticMarkup(<FigureRenderer spec={{ figures: [RECTANGLE] }} />)).toContain('<polygon');
    expect(renderToStaticMarkup(<FigureRenderer spec={{ figures: [PARALLELOGRAM] }} />)).toContain('<polygon');
  });

  it('figure が undefined なら何も描かない (既存問題の挙動を変えない)', () => {
    expect(renderToStaticMarkup(<FigureRenderer spec={undefined} />)).toBe('');
    expect(renderToStaticMarkup(<FigureRenderer />)).toBe('');
  });

  it('figures が空配列でも何も描かない', () => {
    const empty: FigureSpec = { figures: [] };
    expect(renderToStaticMarkup(<FigureRenderer spec={empty} />)).toBe('');
  });

  it('複数図 (図Aと図B) を並べて描画できる', () => {
    const html = renderToStaticMarkup(
      <FigureRenderer spec={{ figures: [TRIANGLE, RECTANGLE], note: '図は概略です' }} />,
    );
    // svg が2つあること
    const svgCount = html.split('<svg').length - 1;
    expect(svgCount).toBe(2);
    expect(html).toContain('図A');
    expect(html).toContain('図は概略です');
  });

  it('平行移動した同じ形を2つ描ける (座標変換がレンダラ側で可能)', () => {
    const moved: Figure = {
      ...TRIANGLE,
      caption: '図B',
      vertices: TRIANGLE.vertices.map((v) => ({ x: v.x + 10, y: v.y })),
    };
    const html = renderToStaticMarkup(<FigureRenderer spec={{ figures: [TRIANGLE, moved] }} />);
    expect(html.split('<svg').length - 1).toBe(2);
    expect(html).toContain('図B');
  });

  it('y 座標の上下が反転している (数学座標系 → 画面座標系)', () => {
    // 縦だけの線分を持つ三角形。y=0 の点が画面の下、y=4 の点が画面の上になるはず。
    const seg: Figure = {
      kind: 'triangle',
      vertices: [
        { x: 0, y: 0 },
        { x: 0, y: 4 },
        { x: 1, y: 0 },
      ],
      segments: [{ from: { x: 0, y: 0 }, to: { x: 0, y: 4 } }],
    };
    const html = renderToStaticMarkup(<FigureRenderer spec={{ figures: [seg] }} />);
    // toScreen(p, maxY) = { x: p.x, y: maxY - p.y } なので
    // y=0 の線分端点のほうが画面座標の y が大きく (= 下側) になる。
    const y1 = Number(/y1="([\d.]+)"/.exec(html)?.[1]);
    const y2 = Number(/y2="([\d.]+)"/.exec(html)?.[1]);
    expect(Number.isFinite(y1)).toBe(true);
    expect(Number.isFinite(y2)).toBe(true);
    expect(y1).toBeGreaterThan(y2);
  });
});

describe('後方互換性: figure を持たない既存問題', () => {
  it('figure 未設定の Problem は型チェックを通過する', () => {
    // 既存の生成器がつくるのと同じ形。figure は持たない。
    const legacy: Problem = {
      id: 'legacy',
      category: 'integer',
      type: 'integer_addition',
      difficulty: {
        level: 1,
        components: {
          calculationComplexity: 1,
          numberComplexity: 1,
          reasoningComplexity: 1,
          readingComplexity: 1,
        },
      },
      question: '1 たす 1 は?',
      answer: { kind: 'integer', value: 2 },
      parameters: { a: 1, b: 1 },
    };
    // figure が無いことは型として保証される
    expect(legacy.figure).toBeUndefined();
    // Renderer に渡しても何も描かない
    expect(renderToStaticMarkup(<FigureRenderer spec={legacy.figure} />)).toBe('');
  });
});