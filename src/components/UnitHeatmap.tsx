/** 単元別ヒートマップコンポーネント */

/** 成長記録画面に単元ごとの習熟度をタイル状に表示する。
 * 外部ライブラリを使わず、SVG / CSS で直接描画する。
 * GrowthChart.tsx と同じ設計方針に従う。
 */

import type { UnitStats } from '../types/unitHeatmap';
import { MASTERY_STYLES } from '../types/unitHeatmap';

interface UnitHeatmapProps {
  /** 単元別統計データ */
  units: UnitStats[];
  /** 単元選択時のコールバック (未指定時は選択不可) */
  onUnitSelect?: (category: string) => void;
  /** 現在選択中のカテゴリ */
  selectedCategory?: string | null;
}

interface MasteryTileProps {
  unit: UnitStats;
  isSelected: boolean;
  onClick?: () => void;
}

function MasteryTile({ unit, isSelected, onClick }: MasteryTileProps) {
  const style = MASTERY_STYLES[unit.masteryLevel];
  const isClickable = !!onClick;

  return (
    <button
      type="button"
      className={`mastery-tile ${isSelected ? 'selected' : ''} ${isClickable ? 'clickable' : 'disabled'}`}
      onClick={onClick}
      disabled={!isClickable}
      aria-label={`${unit.label}: 正答率${Math.round(unit.accuracyRate)}%, 回答数${unit.totalCount}, ${style.label}`}
    >
      <div className="mastery-tile-header" style={{ color: style.color }}>
        {unit.label}
      </div>
      <div className="mastery-tile-stats">
        <div className="mastery-tile-stat">
          <span className="mastery-tile-value">{Math.round(unit.accuracyRate)}%</span>
          <span className="mastery-tile-label">正答率</span>
        </div>
        <div className="mastery-tile-stat">
          <span className="mastery-tile-value">{unit.totalCount}</span>
          <span className="mastery-tile-label">回答数</span>
        </div>
      </div>
      <div className="mastery-tile-status" style={{ color: style.color }}>
        {style.label}
      </div>
      {isClickable && (
        <div className="mastery-tile-hint">詳細をみる</div>
      )}
    </button>
  );
}

export default function UnitHeatmap({ units, onUnitSelect, selectedCategory }: UnitHeatmapProps) {
  const hasData = units.some((u) => u.totalCount > 0);

  if (units.length === 0) {
    return (
      <div className="unit-heatmap">
        <p className="unit-heatmap-empty">学習データがありません。</p>
      </div>
    );
  }

  return (
    <section className="unit-heatmap">
      <h2 className="unit-heatmap-title">単元別習熟度ヒートマップ</h2>
      <p className="unit-heatmap-description">
        単元ごとの正答率と回答数に基づき、習熟度を色分けして表示します。
        タイルを選択すると、その単元内の問題タイプ別の詳細をみられます。
      </p>
      <div className="mastery-tile-grid">
        {units.map((unit) => {
          const isSelected = selectedCategory === unit.category;
          return (
            <MasteryTile
              key={unit.category}
              unit={unit}
              isSelected={isSelected}
              onClick={onUnitSelect ? () => onUnitSelect(unit.category) : undefined}
            />
          );
        })}
      </div>
      {!hasData && <p className="unit-heatmap-empty">まだ回答履歴がありません。問題を解くとここにデータが表示されます。</p>}
      <p className="unit-heatmap-legend">
        {Object.entries(MASTERY_STYLES).map(([level, style]) => (
          <span key={level} className="mastery-legend-item">
            <span
              className="mastery-legend-color"
              style={{ backgroundColor: style.color }}
            />
            {style.label}
          </span>
        ))}
      </p>
    </section>
  );
}
