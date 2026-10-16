/**
 * 手書き途中式ノートのデータモデル
 *
 * 設計方針:
 * - 筆跡はストローク (点の列 + 描画属性) のベクターデータとして保存する。
 *   画像保存と違い、取り消し・再描画・サイズ変更への対応が容易で、
 *   将来の拡張 (色・太さの変更など) にも耐える。
 * - 座標はキャンバスの表示サイズに依存しないよう、正規化座標 [0, 1] で保存する。
 *   これにより画面サイズが変わっても筆跡は相対位置を保ち、ずれたり消えたりしない。
 * - 保存の単位は「出題インスタンス」を一意に示す attemptId を主キーとする。
 *   problem.id だけでは「同じ問題を再解答したとき」に過去の記録を上書きしてしまう
 * ため、出題のたびに新しく生成する attemptId を用いる (同じ問題でも上書きしない)。
 */

/** 正規化座標の点 [0, 1]。x は幅、y は高さに対する比率 */
export interface ScratchPoint {
  x: number;
  y: number;
}

/** 1本の筆跡 (ストローク) */
export interface ScratchStroke {
  /** 点の列 (描いた順)。正規化座標 */
  points: ScratchPoint[];
  /** 線の色 (CSS カラー)。将来の拡張用に保持 */
  color: string;
  /** 線の太さ (CSS ピクセル)。正規化はしない (太さの歪みを避けるため) */
  width: number;
}

/** 途中式を問題と紐付けるための最小限のメタ情報 */
export interface ScratchNoteMeta {
  /** 出題インスタンスごとに一意な識別子 (主キー) */
  attemptId: string;
  /** 元の問題を識別するID (参考情報) */
  problemId: string;
  /** 問題タイプ (復習画面での表示用) */
  problemType: string;
  /** カテゴリ (復習画面での表示用) */
  category: string;
  /** 問題文 (復習時に元の問題を確認できるように) */
  question: string;
}

/** 途中式ノート (描画データ + メタ情報) */
export interface ScratchNote extends ScratchNoteMeta {
  /** 描かれた筆跡の集合 (空配列は「書いていない / 全消去した」状態を表す) */
  strokes: ScratchStroke[];
  /** 初回作成日時 (ISO 文字列) */
  createdAt: string;
  /** 最終更新日時 (ISO 文字列) */
  updatedAt: string;
}

/** 同一ミリ秒内でも衝突しないよう、自動採番カウンタを併用する */
let attemptCounter = 0;

/**
 * 出題インスタンスごとに一意な途中式の識別子を生成する。
 * problem.id とは別の命名空間にすることで、同一問題の再解答でも
 * 過去の途中式を上書きしない。
 */
export function createScratchAttemptId(): string {
  attemptCounter = (attemptCounter + 1) % 0xffffff;
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).slice(2, 10);
  return `scratch_${timestamp}_${attemptCounter.toString(36)}_${randomPart}`;
}

/** 描画データが「空 (何も書いていない/全消除済み) か」を判定する */
export function isEmptyScratch(strokes: ScratchStroke[]): boolean {
  return !Array.isArray(strokes) || strokes.every((s) => s.points.length === 0);
}
