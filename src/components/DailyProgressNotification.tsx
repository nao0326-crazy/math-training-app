/** 今日の回答数・目標・残りを表示する日次学習メーター */

import { useCallback, useEffect, useState } from 'react';
import { getAllAnswerRecords } from '../storage/db';
import {
  countTodayAnswers,
  getDailyProgress,
  ANSWER_RECORDED_EVENT,
} from '../utils/dailyCount';

export default function DailyProgressNotification() {
  const [todayCount, setTodayCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const records = await getAllAnswerRecords();
      setTodayCount(countTodayAnswers(records));
      setLoading(false);
    } catch {
      setLoading(false);
    }
  }, []);

  // 初期ロードと回答記録イベントでカウントを更新
  useEffect(() => {
    void refresh();

    // 回答が送信されたらカウントを更新
    const handleAnswerRecorded = () => {
      void refresh();
    };
    window.addEventListener(ANSWER_RECORDED_EVENT, handleAnswerRecorded);

    return () => {
      window.removeEventListener(ANSWER_RECORDED_EVENT, handleAnswerRecorded);
    };
  }, [refresh]);

  // 日付が変わったらカウントをリセット
  useEffect(() => {
    // 1分ごとに日付変更をチェック
    const interval = setInterval(() => {
      void refresh();
    }, 60 * 1000);
    return () => clearInterval(interval);
  }, [refresh]);

  if (loading) {
    return null;
  }

  const { goal, remaining, achieved } = getDailyProgress(todayCount);

  return (
    <div
      className={`daily-progress ${achieved ? 'achieved' : ''}`}
      role="status"
      aria-label="今日の学習進捗"
    >
      <div className="daily-progress-title">今日の学習目標</div>
      <div className="daily-progress-stats">
        <span>回答数：{todayCount} / {goal}問</span>
        <span>残り：{remaining}問</span>
      </div>
      {achieved && (
        <div className="daily-progress-message">今日の目標を達成しました。</div>
      )}
    </div>
  );
}