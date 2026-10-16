import type { ScratchStroke } from '../types/scratch';

/**
 * ストローク群を Canvas 2D コンテキストに描画する。
 *
 * - 座標は正規化 [0, 1] なので、渡した width / height を掛けて描画する。
 * - この関数はクリアを行わない。呼び出し側で先に canvas をクリアしてから
 *   呼ぶことで、作業中の筆跡などを合成描画できる。
 * - 高DPI対応は呼び出し側でコンテキストを devicePixelRatio 倍に
 *   スケールした状態で渡すこと (lineWidth は CSS ピクセルのまま)。
 */
export function drawStrokes(
  ctx: CanvasRenderingContext2D,
  strokes: readonly ScratchStroke[],
  width: number,
  height: number,
): void {
  for (const stroke of strokes) {
    if (!stroke || !Array.isArray(stroke.points) || stroke.points.length === 0) continue;

    ctx.strokeStyle = stroke.color;
    ctx.fillStyle = stroke.color;
    ctx.lineWidth = stroke.width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const first = stroke.points[0];
    const fx = first.x * width;
    const fy = first.y * height;

    // 1点だけのストローク (点打ち) は小さな円で描く
    if (stroke.points.length === 1) {
      ctx.beginPath();
      ctx.arc(fx, fy, stroke.width / 2, 0, Math.PI * 2);
      ctx.fill();
      continue;
    }

    ctx.beginPath();
    ctx.moveTo(fx, fy);
    for (let i = 1; i < stroke.points.length; i++) {
      const p = stroke.points[i];
      ctx.lineTo(p.x * width, p.y * height);
    }
    ctx.stroke();
  }
}

/**
 * 点 (正規化座標) からどれだけ離れたストロークを消しゴムで消すか (正規化距離)。
 * キャンバスの縦横比による歪みは無視できる大きさにしている。
 */
export const ERASER_RADIUS = 0.05;

/** ストローク上の任意の点が消しゴムの位置に近ければ true (そのストロークを消す) */
export function isStrokeNear(
  stroke: ScratchStroke,
  x: number,
  y: number,
  radius: number = ERASER_RADIUS,
): boolean {
  if (!stroke || !Array.isArray(stroke.points)) return false;
  for (const p of stroke.points) {
    const dx = p.x - x;
    const dy = p.y - y;
    if (dx * dx + dy * dy <= radius * radius) return true;
  }
  return false;
}

/** 0..1 にクランプする (ポインタがキャンバス外に出た場合の対策) */
export function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return value < 0 ? 0 : value > 1 ? 1 : value;
}
