/**
 * 現実連動教材の写真レンダラ
 *
 * 写真から情報を読み取って算数で解く教材の「写真」を表示する。
 * 図形 (FigureRenderer / SVG) とは別に、写真・画像 (img 要素) を表示する。
 *
 * 設計方針 (既存の FigureRenderer と対になる後方互換):
 * - image === undefined なら何も描かない (既存の全問題は image を持たない)。
 * - 画像の読み込みに失敗した場合は alt テキスト (価格等の必要情報を含む) を
 *   本文として表示する。写真が見えなくても解答・学習記録が破綻しないようにするため。
 * - src は public/ からのルート相対パス。外部サイトへの直リンクはしない
 *   (配布先の環境・オフライン (PWA) でも確実に表示される構成)。
 * - 外部ライブラリは使わない (ブラウザ標準の img 要素のみ)。
 */

import { useState } from 'react';
import type { ImageSpec } from '../types/problem';

export interface ImageRendererProps {
  /** 表示する写真の仕様 (undefined のときは何も描かない) */
  spec?: ImageSpec;
}

/**
 * 画像が読み込めない環境向けのフォールバック表示。
 * 価格などの必要情報を含む altText を、読める形で表示する。
 * (純粋な表示のため、描画をテストから直接検証できる)
 */
export function ImageFallback({ altText }: { altText: string }) {
  return (
    <div className="problem-image-fallback" role="img" aria-label={altText}>
      <span className="problem-image-fallback-label">写真を読み込めませんでした</span>
      <span className="problem-image-fallback-text">{altText}</span>
    </div>
  );
}

/**
 * 現実連動教材の写真を表示する。
 * spec が undefined のときは null を返し、既存問題のUIを一切変えない。
 *
 * 画像読み込み失敗時 (onError) は画像の代わりに altText (価格などの必要情報を含む) を
 * 表示する。これにより「画像が配布先で読み込めない」「オフラインで未キャッシュ」などでも、
 * 解答に必要な情報は画面に残り、採点・学習記録は正常に動作する (破綻しない)。
 */
export default function ImageRenderer({ spec }: ImageRendererProps) {
  const [failed, setFailed] = useState(false);

  if (!spec || !spec.src || spec.src.trim() === '') return null;

  return (
    <figure className="problem-image">
      {failed ? (
        <ImageFallback altText={spec.altText} />
      ) : (
        <img
          className="problem-image-img"
          src={spec.src}
          alt={spec.altText}
          onError={() => setFailed(true)}
        />
      )}
      {spec.caption ? <figcaption className="image-caption">{spec.caption}</figcaption> : null}
      {spec.credit ? <div className="image-credit">{spec.credit}</div> : null}
    </figure>
  );
}
