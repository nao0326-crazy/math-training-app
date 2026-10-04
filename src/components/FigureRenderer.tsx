/**
 * 図形レンダラ
 *
 * generator が保持する「数学座標 (上が +y)」を SVG の画面座標 (下が +y) に変換して描く。
 * generator 側は px を持たないため、回転・反転・平行移動・拡大縮小は
 * generator 側で頂点座標を変換するだけで済む。
 *
 * 図形が無い問題 (figure === undefined) では何も描かない。
 * 外部ライブラリは使わない (ブラウザ標準の SVG のみ)。
 */
import type { Figure, FigureSpec, FigurePoint } from '../types/problem';

/** 図形の取り巻く余白 (数学座標) */
const PADDING = 2;

/** 数学座標 -> 画面座標 (上下反転) */
function toScreen(p: FigurePoint, height: number): { x: number; y: number } {
  return { x: p.x, y: height - p.y };
}

/**
 * 図形が収まる正方形 viewBox を求める。
 *
 * stroke / 点半径 / 文字サイズを viewBox の 1 辺に対する比率で指定するため、
 * 辺の長さ (数学座標) に応じて描画の細かさが上がらない。
 * 縦横比は崩さず、余白を足した正方形に収めて中央に配置する。
 */
function computeView(figure: Figure) {
  const xs = figure.vertices.map((v) => v.x);
  const ys = figure.vertices.map((v) => v.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  const side = Math.max(maxX - minX, maxY - minY, 1) + PADDING * 2;

  // 画面座標系における図形の中央 (toScreen と同じ変換を使う)
  const centerX = (minX + maxX) / 2;
  const centerY = maxY - (minY + maxY) / 2;

  return {
    side,
    // 描画の細かさ (すべて 1 辺に対する比率)
    stroke: side * 0.012,
    auxStroke: side * 0.007,
    dash: side * 0.05,
    gap: side * 0.035,
    pointRadius: side * 0.022,
    fontSize: side * 0.11,
    viewBox: `${centerX - side / 2} ${centerY - side / 2} ${side} ${side}`,
  };
}

/** 頂点の重心 (ラベルを外向きに置くときの基準) */
function centroid(vertices: FigurePoint[]): FigurePoint {
  const n = vertices.length || 1;
  return {
    x: vertices.reduce((s, v) => s + v.x, 0) / n,
    y: vertices.reduce((s, v) => s + v.y, 0) / n,
  };
}

/** 図形 1 つを SVG として描画する内部コンポーネント */
function SingleFigure({ figure }: { figure: Figure }) {
  const v = computeView(figure);
  const maxY = Math.max(...figure.vertices.map((p) => p.y));
  const c = centroid(figure.vertices);

  const screen = figure.vertices.map((p) => toScreen(p, maxY));
  const pointsAttr = screen.map((p) => `${p.x},${p.y}`).join(' ');

  return (
    <svg
      className="figure-svg"
      viewBox={v.viewBox}
      role="img"
      aria-label={figure.caption ?? '図'}
      preserveAspectRatio="xMidYMid meet"
    >
      {/* 多角形の辺 */}
      <polygon
        className="figure-polygon"
        points={pointsAttr}
        fill={figure.fill ?? 'none'}
        strokeWidth={v.stroke}
        strokeLinejoin="round"
      />

      {/* 追加の線分と寸法 (補助線として破線にする) */}
      {(figure.segments ?? []).map((s, i) => {
        const from = toScreen(s.from, maxY);
        const to = toScreen(s.to, maxY);
        // 寸法は線分の中点から、重心の反対側へ perpendicular にずらす
        let dim: { x: number; y: number } | null = null;
        if (s.label) {
          const mx = (from.x + to.x) / 2;
          const my = (from.y + to.y) / 2;
          const dx = to.x - from.x;
          const dy = to.y - from.y;
          const len = Math.hypot(dx, dy) || 1;
          let px = -dy / len;
          let py = dx / len;
          // 重心から遠い向きを選ぶ (線分の上側 / 下側)
          if (px * (c.x - toScreen(c, maxY).x) + py * (c.y - toScreen(c, maxY).y) < 0) {
            px = -px;
            py = -py;
          }
          const off = v.fontSize * 0.7;
          dim = { x: mx + px * off, y: my + py * off + v.fontSize * 0.35 };
        }
        return (
          <g key={`seg-${i}`} className="figure-segment">
            <line
              x1={from.x} y1={from.y} x2={to.x} y2={to.y}
              strokeWidth={v.auxStroke} strokeDasharray={`${v.dash} ${v.gap}`}
            />
            {dim && s.label ? (
              <text
                className="figure-segment-label"
                x={dim.x} y={dim.y}
                fontSize={v.fontSize} textAnchor="middle"
              >
                {s.label}
              </text>
            ) : null}
          </g>
        );
      })}

      {/* 頂点の点と名前 (重心から見て外向きに置く) */}
      {(figure.points ?? []).map((p, i) => {
        const s = toScreen(p.at, maxY);
        const cs = toScreen(c, maxY);
        let dx = s.x - cs.x;
        let dy = s.y - cs.y;
        const len = Math.hypot(dx, dy) || 1;
        dx /= len;
        dy /= len;
        const off = v.pointRadius * 2.6;
        const lx = s.x + dx * off;
        const ly = s.y + dy * off;
        // 左右どちらにあるかで揃え、上下で baseline を変える
        const anchor = dx >= 0 ? 'start' : 'end';
        const dyText = dy > 0.3 ? v.fontSize * 0.35 : dy < -0.3 ? -v.fontSize * 0.8 : 0;
        return (
          <g key={`pt-${i}`} className="figure-point">
            <circle cx={s.x} cy={s.y} r={v.pointRadius} />
            {p.label ? (
              <text
                className="figure-point-label"
                x={lx}
                y={ly + dyText}
                fontSize={v.fontSize}
                textAnchor={anchor}
              >
                {p.label}
              </text>
            ) : null}
          </g>
        );
      })}

      {/* その他のラベル */}
      {(figure.labels ?? []).map((l, i) => {
        const s = toScreen(l.at, maxY);
        return (
          <text
            key={`label-${i}`}
            className="figure-label"
            x={s.x} y={s.y}
            fontSize={v.fontSize}
            textAnchor={l.anchor ?? 'middle'}
          >
            {l.text}
          </text>
        );
      })}
    </svg>
  );
}

export interface FigureRendererProps {
  /** 表示する図形の仕様 (undefined のときは何も描かない) */
  spec?: FigureSpec;
}

/**
 * 問題の図形を描画する。
 * spec が undefined のときは null を返し、既存問題のUIを一切変えない。
 *
 * 見出し (図A など) は SVG 内ではなく HTML に置く。
 * SVG 内の text は図形の大きさに応じてスケールするため、
 * 教材として常に同じ文字サイズで見せるには HTML 側のほうが確実なため。
 */
export default function FigureRenderer({ spec }: FigureRendererProps) {
  if (!spec || spec.figures.length === 0) return null;
  return (
    <figure className="problem-figure">
      <div className="problem-figure-row">
        {spec.figures.map((f, i) => (
          <div className="problem-figure-item" key={i}>
            {f.caption ? <div className="figure-caption">{f.caption}</div> : null}
            <SingleFigure figure={f} />
          </div>
        ))}
      </div>
      {spec.note ? <figcaption className="figure-note">{spec.note}</figcaption> : null}
    </figure>
  );
}