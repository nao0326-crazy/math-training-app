import { useEffect, useMemo, useState } from 'react';
import { getAllAnswerRecords } from '../storage/db';
import type { Category } from '../types/problem';
import type { AnswerRecord } from '../types/history';
import { calculateStats, categoryLabel, formatPercent, formatTime } from '../utils/stats';
import { getStudyDateKey } from '../utils/dailyCount';
import {
  buildCalendarDays,
  formatStudyDateLabel,
  formatStudyMonth,
  getRecordUnitLabel,
  getStudyMonth,
  groupRecordsByStudyDate,
  shiftStudyMonth,
  summarizeRecordUnits,
  toStudyDateKey,
  type StudyMonth,
} from '../utils/learningCalendar';
import {
  findWeakAreas,
  getMostRecentDifficultyLevel,
  REVIEW_QUESTION_COUNT,
  type WeakArea,
} from '../utils/weakAreas';
import { difficultyLabel } from '../engine/difficulty/difficulty';

const WEEKDAYS = ['月', '火', '水', '木', '金', '土', '日'] as const;

/**
 * 履歴レコードのフォールバック付き表示用ヘルパー
 * 既存履歴には question が存在しない場合があるため安全にフォールバックする
 */
function safeQuestion(record: AnswerRecord): string {
  return record.question && record.question.trim() !== '' ? record.question : '記録なし';
}

function safeUserAnswer(record: AnswerRecord): string {
  return record.userAnswer && record.userAnswer.trim() !== '' ? record.userAnswer : '記録なし';
}

function safeCorrectAnswer(record: AnswerRecord): string {
  return record.correctAnswer && record.correctAnswer.trim() !== '' ? record.correctAnswer : '記録なし';
}

interface HistoryPageProps {
  /** 苦手分野から復習を開始する (カテゴリと直近の難易度を渡す) */
  onStartReview: (category: Category, difficulty: number) => void;
}

export default function HistoryPage({ onStartReview }: HistoryPageProps) {
  const [records, setRecords] = useState<AnswerRecord[]>([]);
  const [loading, setLoading] = useState(true);
  // 復習開始前の確認ダイアログに表示する分野 (null のときは非表示)
  const [confirmArea, setConfirmArea] = useState<WeakArea | null>(null);

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

  const todayKey = getStudyDateKey();
  const [visibleMonth, setVisibleMonth] = useState<StudyMonth>(() => getStudyMonth(todayKey));
  const [selectedDateKey, setSelectedDateKey] = useState(todayKey);
  const recordsByDate = useMemo(() => groupRecordsByStudyDate(records), [records]);
  const calendarDays = useMemo(
    () => buildCalendarDays(visibleMonth, todayKey),
    [todayKey, visibleMonth],
  );
  const selectedRecords = useMemo(
    () => recordsByDate.get(selectedDateKey) ?? [],
    [recordsByDate, selectedDateKey],
  );
  const unitSummary = useMemo(() => summarizeRecordUnits(selectedRecords), [selectedRecords]);

  const changeMonth = (delta: number) => {
    const nextMonth = shiftStudyMonth(visibleMonth, delta);
    setVisibleMonth(nextMonth);
    setSelectedDateKey(toStudyDateKey(nextMonth.year, nextMonth.month, 1));
  };

  if (loading) {
    return (
      <div className="history-page">
        <div className="loading-message">読み込み中...</div>
      </div>
    );
  }

  const stats = calculateStats(records);

  // 苦手分野の判定 (既存の分野別集計 calculateStats を再利用)
  const weakAreas = findWeakAreas(records);

  /** 確認ダイアログで「復習をはじめる」を選んだとき */
  const handleConfirmReview = () => {
    if (!confirmArea) return;
    // 直近で使用していた難易度のまま、既存の問題生成システムで復習する
    onStartReview(confirmArea.category as Category, getMostRecentDifficultyLevel(records));
    setConfirmArea(null);
  };

  return (
    <div className="history-page">
      <h2>学習履歴</h2>

      <section className="stats-section calendar-section" aria-labelledby="calendar-heading">
        <div className="calendar-header">
          <button
            type="button"
            className="calendar-nav-button"
            onClick={() => changeMonth(-1)}
            aria-label="前の月"
          >
            ‹
          </button>
          <h3 id="calendar-heading">{formatStudyMonth(visibleMonth)}</h3>
          <button
            type="button"
            className="calendar-nav-button"
            onClick={() => changeMonth(1)}
            aria-label="次の月"
          >
            ›
          </button>
        </div>
        <div className="calendar-weekdays" aria-hidden="true">
          {WEEKDAYS.map((weekday) => (
            <span key={weekday}>{weekday}</span>
          ))}
        </div>
        <div className="calendar-grid" role="grid" aria-label={`${formatStudyMonth(visibleMonth)}の学習カレンダー`}>
          {calendarDays.map((day, index) => {
            if (!day) return <span key={`empty-${index}`} className="calendar-cell empty" aria-hidden="true" />;
            const count = recordsByDate.get(day.dateKey)?.length ?? 0;
            const isSelected = selectedDateKey === day.dateKey;
            return (
              <button
                key={day.dateKey}
                type="button"
                className={`calendar-cell day ${isSelected ? 'selected' : ''} ${day.isToday ? 'today' : ''} ${count > 0 ? 'has-records' : ''}`}
                onClick={() => setSelectedDateKey(day.dateKey)}
                aria-label={`${day.day}日、${count}問${day.isToday ? '、今日' : ''}`}
                aria-pressed={isSelected}
              >
                <span className="calendar-day-number">{day.day}</span>
                {count > 0 && <span className="calendar-day-count">{count}問</span>}
              </button>
            );
          })}
        </div>
      </section>

      <section className="stats-section selected-day-section" aria-live="polite">
        <h3>{formatStudyDateLabel(selectedDateKey)}</h3>
        <div className="selected-day-total">{selectedRecords.length}問</div>
        {selectedRecords.length === 0 ? (
          <p className="no-data">この日はまだ学習記録がありません。</p>
        ) : (
          <>
            <div className="day-unit-summary" aria-label="単元別の問題数">
              {unitSummary.map((unit) => (
                <div className="day-unit-chip" key={unit.key}>
                  <span>{unit.label}</span>
                  <strong>{unit.count}問</strong>
                </div>
              ))}
            </div>
            <div className="day-record-list">
              {[...selectedRecords].reverse().map((record, index) => (
                <article className="day-record-item" key={`${record.submissionId ?? record.problemId}-${index}`}>
                  <div className="day-record-meta">
                    <span>{getRecordUnitLabel(record)}</span>
                    <span className={record.isCorrect ? 'correct-text' : 'incorrect-text'}>
                      {record.isCorrect ? '正解' : '不正解'}
                    </span>
                    <span>{formatTime(record.answerTimeSec)}</span>
                  </div>
                  <p className="day-record-question">{safeQuestion(record)}</p>
                </article>
              ))}
            </div>
          </>
        )}
      </section>

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

          {/* 苦手分野: 回答数5問以上かつ正答率70%未満の分野 (weakAreas.ts の定数) */}
          <section className="stats-section weak-areas-section">
            <h3>苦手分野</h3>
            {weakAreas.length === 0 ? (
              <p className="no-weak-message">
                今のところ大きな苦手分野はありません。
                <br />
                いろいろな分野に挑戦してみよう！
              </p>
            ) : (
              weakAreas.map((area) => (
                <div className="weak-area-card" key={area.category}>
                  <div className="weak-area-info">
                    <span className="weak-area-name">{categoryLabel(area.category)}</span>
                    <span className="weak-area-stats">
                      正答率 {formatPercent(area.accuracyRate)}
                    </span>
                    <span className="weak-area-stats">
                      {area.totalCount}問中 {area.correctCount}問正解
                    </span>
                  </div>
                  <button
                    type="button"
                    className="secondary-button review-button"
                    onClick={() => setConfirmArea(area)}
                  >
                    {categoryLabel(area.category)}を{REVIEW_QUESTION_COUNT}問復習
                  </button>
                </div>
              ))
            )}
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
            <table className="stats-table history-detail-table">
              <thead>
                <tr>
                  <th>日時</th>
                  <th>分野</th>
                  <th>問題</th>
                  <th>正解</th>
                  <th>あなたの入力</th>
                  <th>結果</th>
                  <th>時間</th>
                </tr>
              </thead>
              <tbody>
                {[...records]
                  .reverse()
                  .slice(0, 10)
                  .map((record, index) => (
                    <tr key={`${record.problemId}-${index}`} className="history-detail-row">
                      <td>{new Date(record.answeredAt).toLocaleString('ja-JP')}</td>
                      <td>{categoryLabel(record.category)}</td>
                      <td className="history-question-cell">{safeQuestion(record)}</td>
                      <td className="history-answer-cell">{safeCorrectAnswer(record)}</td>
                      <td className="history-answer-cell">{safeUserAnswer(record)}</td>
                      <td className={record.isCorrect ? 'correct-text' : 'incorrect-text'}>
                        {record.isCorrect ? '○ 正解' : '× 不正解'}
                      </td>
                      <td>{Math.round(record.answerTimeSec)}秒</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </section>
        </>
      )}

      {/* 復習開始前の確認 (操作を重くしないよう最小構成) */}
      {confirmArea && (
        <div className="modal-overlay" onClick={() => setConfirmArea(null)}>
          <div
            className="modal-card"
            role="dialog"
            aria-modal="true"
            aria-label="復習の確認"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-title">
              {categoryLabel(confirmArea.category)}を{REVIEW_QUESTION_COUNT}問復習します
            </div>
            <div className="modal-buttons">
              <button type="button" className="primary-button" onClick={handleConfirmReview}>
                復習をはじめる
              </button>
              <button
                type="button"
                className="secondary-button"
                onClick={() => setConfirmArea(null)}
              >
                やめる
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}