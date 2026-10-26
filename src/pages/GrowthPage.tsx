/**
 * 成長記録画面
 * 実際の学習記録 (IndexedDB) に基づいて学習成長を可視化する。
 */

import { useCallback, useEffect, useState } from 'react';
import {
  aggregateGrowthData,
  formatAccuracy,
  formatAverageTime,
  formatMs,
} from '../utils/growthStats';
import { GROWTH_PERIOD_LABELS } from '../types/growth';
import type { GrowthData, GrowthPeriod } from '../types/growth';
import {
  AccuracyLineChart,
  QuestionCountBarChart,
  SpeedGateAccuracyChart,
} from '../components/GrowthChart';
import GrowthEmptyState from '../components/GrowthEmptyState';

const PERIOD_OPTIONS: GrowthPeriod[] = [7, 30, 90];

export default function GrowthPage() {
  const [period, setPeriod] = useState<GrowthPeriod>(7);
  const [data, setData] = useState<GrowthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const d = await aggregateGrowthData(period);
      setData(d);
    } catch {
      setError('学習記録の読み込みに失敗しました。');
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (loading) {
    return (
      <div className="growth-page">
        <h2>成長記録</h2>
        <p>読み込み中...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="growth-page">
        <h2>成長記録</h2>
        <p className="error-message" role="alert">{error}</p>
        <button className="secondary-button" onClick={refresh}>
          もう一度試す
        </button>
      </div>
    );
  }

  if (!data || !data.hasData) {
    return (
      <div className="growth-page">
        <div className="growth-header">
          <h2>成長記録</h2>
          <div className="growth-period-selector">
            {PERIOD_OPTIONS.map((p) => (
              <button
                key={p}
                className={`period-button ${period === p ? 'active' : ''}`}
                onClick={() => setPeriod(p)}
              >
                {GROWTH_PERIOD_LABELS[p as keyof typeof GROWTH_PERIOD_LABELS]}
              </button>
            ))}
          </div>
        </div>
        <GrowthEmptyState />
      </div>
    );
  }

  return (
    <div className="growth-page">
      <div className="growth-header">
        <h2>成長記録</h2>
        <div className="growth-period-selector">
          {PERIOD_OPTIONS.map((p) => (
            <button
              key={p}
              className={`period-button ${period === p ? 'active' : ''}`}
              onClick={() => setPeriod(p)}
            >
              {GROWTH_PERIOD_LABELS[p as keyof typeof GROWTH_PERIOD_LABELS]}
            </button>
          ))}
        </div>
      </div>

      <section className="growth-today">
        <h3>今日の学習</h3>
        <div className="today-cards">
          <div className="today-card">
            <div className="today-card-label">正答率</div>
            <div className="today-card-value">
              {data.today ? formatAccuracy(data.today.accuracyRate) : '--'}
            </div>
            <div className="today-card-detail">
              {data.today
                ? `${data.today.correctCount} / ${data.today.questionCount} 問`
                : '未学習'}
            </div>
          </div>
          <div className="today-card">
            <div className="today-card-label">解いた問題数</div>
            <div className="today-card-value">
              {data.today ? `${data.today.questionCount} 問` : '0 問'}
            </div>
            <div className="today-card-detail">問題</div>
          </div>
          <div className="today-card">
            <div className="today-card-label">平均回答時間</div>
            <div className="today-card-value">
              {data.today ? formatAverageTime(data.today.averageTimeSec) : '--'}
            </div>
            <div className="today-card-detail">1 問あたり</div>
          </div>
        </div>

        {data.todaySpeedGate && (
          <div className="today-card speedgate-card">
            <div className="today-card-label">朝の100問</div>
            <div className="today-card-value">
              {formatAccuracy(data.todaySpeedGate.accuracyRate)}
            </div>
            <div className="today-card-detail">
              {data.todaySpeedGate.correctCount} /
              {data.todaySpeedGate.totalCount} 正解 ・
              {formatMs(data.todaySpeedGate.totalMs)}
            </div>
          </div>
        )}
      </section>

      <section className="growth-charts">
        <div className="chart-row">
          <AccuracyLineChart data={data.dailyGrowth} metric="accuracy" />
          <AccuracyLineChart data={data.dailyGrowth} metric="time" />
        </div>
        <div className="chart-row">
          <QuestionCountBarChart data={data.dailyGrowth} />
          {data.dailySpeedGate.length > 0 ? (
            <SpeedGateAccuracyChart data={data.dailySpeedGate} />
          ) : (
            <div
              style={{
                width: 340,
                height: 180,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#999',
                fontSize: '0.9rem',
              }}
            >
              朝の100問 データなし
            </div>
          )}
        </div>
      </section>

      <section className="growth-type-table">
        <h3>問題タイプ別正答率</h3>
        <table className="type-table">
          <thead>
            <tr>
              <th>タイプ</th>
              <th>問題数</th>
              <th>正解数</th>
              <th>正答率</th>
            </tr>
          </thead>
          <tbody>
            {data.byProblemType.map((item) => (
              <tr key={item.problemType}>
                <td>{item.label}</td>
                <td>{item.totalCount}</td>
                <td>{item.correctCount}</td>
                <td>{item.accuracyRate}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {data.byProblemType.length === 0 && (
          <p className="empty-hint">データがありません</p>
        )}
      </section>

      <section className="growth-comparison">
        <h3>期間比較</h3>
        <div className="comparison-cards">
          <div className="comparison-card">
            <div className="comparison-label">正答率</div>
            <div className="comparison-values">
              <span>前: {formatAccuracy(data.comparison.prevAccuracyRate)}</span>
              <span>直近: {formatAccuracy(data.comparison.recentAccuracyRate)}</span>
            </div>
          </div>
          <div className="comparison-card">
            <div className="comparison-label">平均回答時間</div>
            <div className="comparison-values">
              <span>前: {formatAverageTime(data.comparison.prevAverageTimeSec)}</span>
              <span>直近: {formatAverageTime(data.comparison.recentAverageTimeSec)}</span>
            </div>
          </div>
          <div className="comparison-card">
            <div className="comparison-label">問題数</div>
            <div className="comparison-values">
              <span>前: {data.comparison.prevQuestionCount} 問</span>
              <span>直近: {data.comparison.recentQuestionCount} 問</span>
            </div>
          </div>
        </div>
      </section>

      <section className="growth-summary">
        <h3>直近 {period}日間 の総計</h3>
        <div className="summary-cards">
          <div className="summary-card">
            <div className="summary-label">総問題数</div>
            <div className="summary-value">{data.totalQuestionCount} 問</div>
          </div>
          <div className="summary-card">
            <div className="summary-label">総正解数</div>
            <div className="summary-value">{data.totalCorrectCount} 問</div>
          </div>
          <div className="summary-card">
            <div className="summary-label">期間平均回答時間</div>
            <div className="summary-value">
              {formatAverageTime(data.totalAverageTimeSec)}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
