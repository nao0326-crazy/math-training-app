import { useEffect, useState } from 'react';
import { getAllAnswerRecords } from '../storage/db';
import type { AnswerRecord } from '../types/history';
import { calculateStats, categoryLabel, formatPercent, formatTime } from '../utils/stats';
import { difficultyLabel } from '../engine/difficulty/difficulty';

export default function HistoryPage() {
  const [records, setRecords] = useState<AnswerRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const all = await getAllAnswerRecords();
        if (!cancelled) {
          setRecords(all);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="history-page">
        <div className="loading-message">読み込み中...</div>
      </div>
    );
  }

  const stats = calculateStats(records);

  return (
    <div className="history-page">
      <h2>学習履歴</h2>

      {records.length === 0 ? (
        <div className="empty-state">
          <p>まだ学習履歴がありません。</p>
          <p>ホームから学習をはじめましょう！</p>
        </div>
      ) : (
        <>
          <section className="stats-overview">
            <div className="stat-card">
              <span className="stat-label">問題数</span>
              <span className="stat-value">{stats.totalCount}問</span>
            </div>
            <div className="stat-card">
              <span className="stat-label">正答率</span>
              <span className="stat-value">{formatPercent(stats.accuracyRate)}</span>
            </div>
            <div className="stat-card">
              <span className="stat-label">平均解答時間</span>
              <span className="stat-value">{formatTime(stats.averageTimeSec)}</span>
            </div>
          </section>

          <section className="stats-section">
            <h3>分野別成績</h3>
            {stats.byCategory.length === 0 ? (
              <p className="no-data">データがありません</p>
            ) : (
              <table className="stats-table">
                <thead>
                  <tr>
                    <th>分野</th>
                    <th>問題数</th>
                    <th>正答率</th>
                    <th>平均時間</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.byCategory.map((cat) => (
                    <tr key={cat.category}>
                      <td>{categoryLabel(cat.category)}</td>
                      <td>{cat.totalCount}問</td>
                      <td>{formatPercent(cat.correctCount / cat.totalCount)}</td>
                      <td>{formatTime(cat.averageTimeSec)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <section className="stats-section">
            <h3>難易度別成績</h3>
            {stats.byDifficulty.length === 0 ? (
              <p className="no-data">データがありません</p>
            ) : (
              <table className="stats-table">
                <thead>
                  <tr>
                    <th>難易度</th>
                    <th>問題数</th>
                    <th>正答率</th>
                    <th>平均時間</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.byDifficulty.map((diff) => (
                    <tr key={diff.level}>
                      <td>{difficultyLabel(diff.level as 1 | 2 | 3 | 4 | 5)}</td>
                      <td>{diff.totalCount}問</td>
                      <td>{formatPercent(diff.correctCount / diff.totalCount)}</td>
                      <td>{formatTime(diff.averageTimeSec)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <section className="stats-section">
            <h3>最近の問題</h3>
            <table className="stats-table">
              <thead>
                <tr>
                  <th>日時</th>
                  <th>分野</th>
                  <th>結果</th>
                  <th>時間</th>
                </tr>
              </thead>
              <tbody>
                {[...records]
                  .reverse()
                  .slice(0, 10)
                  .map((record, index) => (
                    <tr key={`${record.problemId}-${index}`}>
                      <td>{new Date(record.answeredAt).toLocaleString('ja-JP')}</td>
                      <td>{categoryLabel(record.category)}</td>
                      <td className={record.isCorrect ? 'correct-text' : 'incorrect-text'}>
                        {record.isCorrect ? '○' : '×'}
                      </td>
                      <td>{Math.round(record.answerTimeSec)}秒</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </section>
        </>
      )}
    </div>
  );
}