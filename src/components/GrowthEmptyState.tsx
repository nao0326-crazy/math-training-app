/** 成長記録画面の空状態コンポーネント */

export default function GrowthEmptyState() {
  return (
    <div className="growth-empty">
      <div className="growth-empty-icon">📊</div>
      <h2>成長記録はまだありません</h2>
      <p>
        問題を解くと、ここに正答率・平均回答時間・学習問題数などの<br />
        学習成長グラフが表示されます。
      </p>
      <p className="growth-empty-hint">
        「問題を解く」から学習を始めてください。
      </p>
    </div>
  );
}